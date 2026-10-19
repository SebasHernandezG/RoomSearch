<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ReplyInterestRequest;
use App\Http\Requests\Api\StoreInterestRequest;
use App\Http\Resources\InterestForDuenoResource;
use App\Http\Resources\InterestResource;
use App\Notifications\InterestRepliedNotification;
use App\Notifications\NewInterestNotification;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\InterestStatus;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Interest;
use Modules\Properties\Models\InterestIntent;
use Modules\Properties\Models\Property;

/**
 * "Me interesa": la solicitud, la bandeja del dueno y la respuesta. RF-5.1.
 *
 * ## Las cuatro rutas y de quien es cada una
 *
 * | Ruta | Quien la usa |
 * | --- | --- |
 * | `POST /properties/{id}/interests` | El interesado, sobre la ficha |
 * | `GET /my/interests` | El dueno, la bandeja de lo que le llego |
 * | `GET /interests` | El interesado, para leer las respuestas |
 * | `PATCH /interests/{id}` | El dueno, para responder o descartar |
 *
 * Las dos listas son distintas porque las dos preguntan cosas
 * distintas: la bandeja necesita el nombre de quien escribe, y "mis
 * solicitudes" necesita la respuesta.
 *
 * ## Por que responder y descartar son la misma ruta
 *
 * Porque el cuerpo es el mismo --`reply` y `status`-- y la unica
 * diferencia es que valor toma `status`. Dos rutas distintas
 * harían que el frontend duplicase el formulario entero para cambiar
 * una cadena en el `fetch`.
 */
class InterestController extends Controller
{
    /**
     * Mandar la solicitud.
     *
     * Es la ruta que convierte un boton en algo real: sin ella, "Me
     * interesa" no le dice nada a nadie.
     */
    public function store(StoreInterestRequest $request, Property $property): InterestResource|JsonResponse
    {
        $persona = $request->user();

        /*
         * Solo un anuncio activo.
         *
         * Con un 404 y no un 422: un anuncio pausado o alquilado no
         * existe para el publico, asi que escribirle es escribirle a
         * algo que no esta. Un 422 diria "tu solicitud tiene un
         * problema", y el problema no es de quien escribe.
         */
        abort_unless($property->status === PropertyStatus::Activa, 404);

        /*
         * Nadie se interesa en su propio anuncio.
         *
         * Con 422 y no 403: no hay una accion prohibida --hay una
         * accion sin sentido-- y el mensaje lo dice.
         */
        if ($property->user_id !== null && $property->user_id === $persona->getKey()) {
            return response()->json([
                'message' => 'Este anuncio es tuyo. Para compartirlo, publica otro.',
                'errors' => ['property_id' => ['Este anuncio es tuyo.']],
            ], 422);
        }

        /*
         * Anti-spam: limite diario de intereses. RF-5.6.
         *
         * Se registra cada intento aunque sea admin (para tener
         * historial), pero el limite no se aplica a admin.
         */
        $resultado = InterestIntent::registrarIntento(
            $persona->getKey(),
            $request->ip(),
            $property->getKey(),
        );

        if (! $persona->isAdmin() && ! $resultado['dentroDelLimite']) {
            return response()->json([
                'message' => 'Has alcanzado el limite diario de mensajes. Intentalo manana.',
                'errors' => [
                    'property_id' => [
                        'Limite diario alcanzado: '.$resultado['intentos'].' de '.$resultado['limite'].'.',
                    ],
                ],
                'retry_after' => 86400,
            ], 429);
        }

        $existente = Interest::query()
            ->where('property_id', $property->getKey())
            ->where('user_id', $persona->getKey())
            ->first();

        if ($existente !== null) {
            return $this->duplicado($existente);
        }

        try {
            $interes = DB::transaction(fn (): Interest => Interest::create([
                ...$request->solicitud(),

                'property_id' => $property->getKey(),
                'user_id' => $persona->getKey(),

                /*
                 * El estado va explicito, no por default.
                 *
                 * La fila nueva es 'nueva' por definicion, y decirlo
                 * aqui hace que la prueba no dependa del default de la
                 * columna --que es un detalle de MySQL y no del
                 * dominio-- para describir lo que acaba de pasar.
                 */
                'status' => InterestStatus::Nueva,
            ]));
        } catch (UniqueConstraintViolationException) {
            /*
             * El indice unico que se dispara.
             *
             * Solo llega aqui con dos pestanas abiertas sobre el mismo
             * anuncio, o con doble clic. La comprobacion de arriba
             * reduce esto a casi cero, pero el indice es lo que
             * garantiza, y el `catch` evita que esa garantia se
             * convierta en un 500.
             *
             * Va **despues** de la comprobacion y no en su lugar:
             * hacer `catch` sin comprobar antes significaria una
             * consulta de mas en cada solicitud normal.
             */
            $existente = Interest::query()
                ->where('property_id', $property->getKey())
                ->where('user_id', $persona->getKey())
                ->sole();

            return $this->duplicado($existente);
        }

        $interes->load(['inmueble.imagenes', 'interesado', 'inmueble.dueno']);

        /*
         * Aviso al arrendador de que llego una solicitud nueva.
         * Va en la cola: crear la solicitud no espera al SMTP.
         */
        $dueno = $interes->inmueble->dueno;
        if ($dueno !== null) {
            $dueno->notify(new NewInterestNotification($interes, $interes->inmueble));
        }

        return (new InterestResource($interes))->response()->setStatusCode(201);
    }

    /**
     * La bandeja del dueno.
     *
     * Todas las solicitudes de **sus** inmuebles, con el nombre de
     * quien las mando, que es lo que no hay forma de saber si no.
     */
    public function bandeja(Request $request): AnonymousResourceCollection
    {
        $persona = $request->user();

        $consulta = Interest::query()
            /*
             * El filtro por dueno va en la consulta, no despues.
             *
             * Es la unica linea que impide que un dueno vea las
             * solicitudes de otro: cargar todo y filtrar en PHP
             * significaria que el que implemente el proximo endpoint
             * olvide el filtro, y la bandeja de otro seria un volcado
             * de mensajes privados.
             */
            ->whereHas(
                'inmueble',
                fn ($query) => $query->where('user_id', $persona->getKey()),
            )
            ->with(['inmueble.imagenes', 'interesado'])
            ->latest();

        $estado = $this->estadoPedido($request);

        if ($estado !== null) {
            $consulta->where('status', $estado);
        }

        $paginacion = $consulta->paginate(24)->withQueryString();

        /*
         * El badge viaja con la bandeja, no en una peticion aparte.
         *
         * Un contador que obliga a una segunda peticion para verse es
         * un contador que llega tarde: entre las dos respuestas el
         * numero ya cambio, y el badge no cuadra con lo que se ve.
         *
         * Se cuenta **sin** el filtro de estado a proposito: si el
         * dueno esta viendo "descartadas", el badge de "nuevas" tiene
         * que seguir contando las nuevas.
         */
        return InterestForDuenoResource::collection($paginacion)
            ->additional(['nuevas' => $this->contarNuevas($persona)]);
    }

    /**
     * Mis solicitudes: las que mande yo, con la respuesta.
     */
    public function mias(Request $request): AnonymousResourceCollection
    {
        $solicitudes = Interest::query()
            ->where('user_id', $request->user()->getKey())

            /*
             * `inmueble` y no solo `inmueble.imagenes`.
             *
             * La respuesta incluye `estado_inmueble`, que es lo que le
             * dice a quien escribió si su solicitud murio porque el
             * anuncio se alquilo en vez de porque nadie contesto. Sin
             * eso, "Anotado" es ambiguo y la persona espera de mas.
             */
            ->with(['inmueble.imagenes'])
            ->latest()
            ->paginate(24)
            ->withQueryString();

        return InterestResource::collection($solicitudes);
    }

    /**
     * Responde o descarta.
     */
    public function update(ReplyInterestRequest $request, Interest $interes): InterestResource
    {
        $this->authorize('responder', $interes);

        $interes->update([
            ...$request->safe()->only(['reply', 'status']),
            'replied_at' => now(),
        ]);

        /*
         * Aviso al interesado de que el arrendador respondio.
         * Va en la cola: responder no espera al SMTP.
         */
        $interesado = $interes->interesado;
        if ($interesado !== null) {
            $interesado->notify(new InterestRepliedNotification($interes));
        }

        return new InterestForDuenoResource($interes->refresh()->load('inmueble.imagenes'));
    }

    /**
     * El 422 de "ya lo escribiste".
     *
     * Devuelve la fila existente ademas del error: el frontend puede
     * poner el boton en "Anotado" sin hacer otra peticion, y quien
     * estaba a punto de escribir puede leer lo que escribio la primera
     * vez en lugar de perderlo.
     */
    private function duplicado(Interest $existente): JsonResponse
    {
        $existente->load(['inmueble.imagenes', 'interesado']);

        return response()->json([
            'message' => 'Ya le escribiste a este anuncio.',
            'errors' => ['property_id' => ['Ya le escribiste a este anuncio.']],

            'data' => (new InterestResource($existente))->resolve(),
        ], 422);
    }

    /**
     * Cuantas hay sin responder.
     *
     * Una consulta aparte y no `->count()` sobre la paginacion: la
     * paginacion viene filtrada por estado y por pagina, y ninguna de
     * las dos cosas sirve para el badge.
     */
    private function contarNuevas(User $persona): int
    {
        return Interest::query()
            ->where('status', InterestStatus::Nueva)
            ->whereHas(
                'inmueble',
                fn ($query) => $query->where('user_id', $persona->getKey()),
            )
            ->count();
    }

    /**
     * El estado pedido, o `null` para todos.
     *
     * Un estado que no existe no es un 422: viene de un `<select>` con
     * valores fijos, y un 422 por un parametro mal escrito en la URL
     * es una pantalla en blanco.
     */
    private function estadoPedido(Request $request): ?InterestStatus
    {
        $pedido = $request->query('status');

        if ($pedido === null || $pedido === '') {
            return null;
        }

        return InterestStatus::tryFrom($pedido);
    }
}
