<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ModerationResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;

/**
 * La cola de moderacion. RF-7.1.
 *
 * ## Por que este controlador existe
 *
 * `approve` y `reject` ya estaban en `MyPropertyController` y el
 * permiso tambien (`PropertyPolicy::moderar`). Lo que **no** existia
 * era la forma de saber *cual* hay que moderar: `GET /api/my
 * /properties` devuelve las publicaciones de quien pregunta, y un
 * administrador no es dueno de ninguna.
 *
 * Sin esta pantalla el producto no cierra de punta a punta: alguien
 * publica, la publicacion nace en 'pendiente', y no hay forma de que
 * llegue a 'activa'. El mapa nunca muestra un inmueble nuevo.
 *
 * ## Por que no reusa el listado publico
 *
 * `PropertyController::index` devuelve solo las activas y exige zona o
 * radio. Una cola de moderacion necesita lo contrario: ver las que
 * **no** son visibles, ordenadas por antiguedad, sin filtro geografico.
 *
 * @see MyPropertyController::approve()
 */
class AdminPropertyController extends Controller
{
    /**
     * Las publicaciones que esperan decision.
     *
     * Sin argumentos devuelve la cola: solo 'pendiente'. Es lo que un
     * administrador mira el 90 % del tiempo, y una pantalla que
     * arranca mostrando todas las activas no tiene cola.
     *
     * Acepta cualquier estado para poder revisar de nuevo una
     * rechazada o una ya activa.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $estado = $this->estadoPedido($request);

        $consulta = Property::query()
            /*
             * El dueno viene con la publicacion.
             *
             * `ModerationResource` lo necesita para decir de quien es
             * el anuncio. Sin esto el `whenLoaded` se resuelve a null y
             * la cola muestra anuncios sin dueno, que es exactamente
             * una cola en la que no se puede moderar nada.
             */
            ->with('dueno')

            // Los mas antiguos primero. La cola se ordena por espera:
            // una publicacion de hace nueve dias es mas urgente que
            // una de hace dos minutos, y "mas reciente primero" las
            // manda al fondo para siempre.
            ->orderBy('created_at');

        if ($estado !== null) {
            $consulta->where('status', $estado);
        }

        return ModerationResource::collection($consulta->paginate(24));
    }

    /**
     * El estado pedido, o null para "solo pendientes".
     *
     * Un estado invalido no es un 422: la peticion viene de un
     * `<select>` con valores fijos y un 422 aqui seria una pantalla en
     * blanco por un parametro mal escrito en la URL. Si no se
     * reconoce, se cae al comportamiento de la cola.
     */
    private function estadoPedido(Request $request): ?PropertyStatus
    {
        $pedido = $request->query('status');

        if ($pedido === null || $pedido === '') {
            return PropertyStatus::Pendiente;
        }

        return PropertyStatus::tryFrom($pedido);
    }
}
