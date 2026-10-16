<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePropertyRequest;
use App\Http\Resources\PropertyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;

/**
 * Publicar, editar y mover el estado de un inmueble. RF-2.1.
 *
 * Todas estas rutas exigen sesion y pasan por PropertyPolicy. El
 * listado y el detalle publicos siguen en PropertyController, que no
 * necesita sesion: RF-1.4 dice que el visitante busca sin cuenta.
 */
class MyPropertyController extends Controller
{
    /**
     * Las publicaciones de la persona con sesion.
     *
     * Es un endpoint aparte del listado publico a proposito: el
     * publico solo devuelve 'activa', y el dueno necesita ver tambien
     * las suyas en borrador, pendientes o pausadas.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $publicaciones = Property::query()
            ->where('user_id', $request->user()->getKey())
            ->latest()
            ->with('imagenes')
            ->paginate(24);

        return PropertyResource::collection($publicaciones);
    }

    /**
     * Publica un inmueble.
     *
     * Nace SIEMPRE en 'pendiente', nunca activo. Es lo que pide RF-2.1
     * y es lo que evita que cualquiera publique lo que quiera: la
     * moderacion (RF-7.1) es la que lo activa.
     */
    public function store(StorePropertyRequest $request): JsonResponse
    {
        $this->authorize('create', Property::class);

        $propiedad = new Property([
            ...$request->atributos(),
            'user_id' => $request->user()->getKey(),

            // El estado va fijo, igual que el rol en el registro. Si
            // viniera del cuerpo, cualquiera podria publicar activo y
            // saltarse la moderacion.
            'status' => PropertyStatus::Pendiente,
        ]);

        $propiedad->placePin(
            (float) $request->validated('latitude'),
            (float) $request->validated('longitude'),
        );

        $propiedad->save();

        return (new PropertyResource($propiedad))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Edita un inmueble.
     *
     * Solo el dueno (PropertyPolicy).
     *
     * Editar NO devuelve la publicacion a 'pendiente'. La maquina de
     * estados no permite activa -> pendiente a proposito, y agregar esa
     * transicion cambiaria el significado de 'activa' para toda la
     * plataforma: cualquier retoque, por pequeno que fuera, sacaria
     * del mapa un inmueble que alguien ya estaba mirando.
     *
     * Que las modificaciones si se moderen es una decision de RF-7.1,
     * no de este metodo.
     */
    public function update(StorePropertyRequest $request, Property $property): PropertyResource
    {
        $this->authorize('update', $property);

        $property->fill($request->atributos());

        $property->placePin(
            (float) $request->validated('latitude'),
            (float) $request->validated('longitude'),
        );

        $property->save();

        return new PropertyResource($property);
    }

    /**
     * Borra un inmueble. El dueno o un admin.
     */
    public function destroy(Request $request, Property $property): JsonResponse
    {
        $this->authorize('delete', $property);

        $property->delete();

        return response()->json([
            'message' => 'Publicación eliminada.',
        ]);
    }

    /**
     * Pausa una publicacion activa.
     *
     * Pausada no es borrada: sigue en la base y el dueno la puede
     * reactivar. Borrarla seria perder el historial.
     */
    public function pause(Request $request, Property $property): PropertyResource
    {
        return $this->cambiarEstado($request, $property, PropertyStatus::Pausada);
    }

    /**
     * Reactiva una publicacion pausada o alquilada.
     */
    public function resume(Request $request, Property $property): PropertyResource
    {
        return $this->cambiarEstado($request, $property, PropertyStatus::Activa);
    }

    /**
     * Marca como alquilada.
     */
    public function markRented(Request $request, Property $property): PropertyResource
    {
        return $this->cambiarEstado($request, $property, PropertyStatus::Alquilada);
    }

    /**
     * El unico camino por el que una publicacion se vuelve visible.
     *
     * Solo admin. El dueno no puede autoaprobar su propia publicacion:
     * la moderacion existe justamente para que haya alguien que no sea
     * el dueno mirandola.
     */
    public function approve(Request $request, Property $property): PropertyResource
    {
        $this->authorize('moderar', $property);

        if ($property->status !== PropertyStatus::Pendiente) {
            return $this->transicionInvalida($property, PropertyStatus::Pendiente);
        }

        $property->update(['status' => PropertyStatus::Activa]);

        return new PropertyResource($property);
    }

    /**
     * Rechaza una publicacion pendiente.
     *
     * Vuelve a 'borrador' en vez de borrarse: el dueno puede
     * corregirla y volver a enviarla.
     */
    public function reject(Request $request, Property $property): PropertyResource
    {
        $this->authorize('moderar', $property);

        if ($property->status !== PropertyStatus::Pendiente) {
            return $this->transicionInvalida($property, PropertyStatus::Pendiente);
        }

        $property->update(['status' => PropertyStatus::Borrador]);

        return new PropertyResource($property);
    }

    /**
     * El cambio de estado comun, con la maquina de estados de por
     * medio. RF-2.1.
     */
    private function cambiarEstado(
        Request $request,
        Property $property,
        PropertyStatus $destino,
    ): PropertyResource {
        $this->authorize('cambiarEstado', $property);

        $origen = $property->status;

        if ($origen === null || ! $origen->canTransitionTo($destino)) {
            return $this->transicionInvalida($property, $destino);
        }

        $property->update(['status' => $destino]);

        return new PropertyResource($property);
    }

    /**
     * Una transicion invalida es un 422 con el motivo.
     *
     * Un 409 seria mas preciso, pero el frontend ya sabe mostrar los
     * errores por campo del 422 y no tendria que aprender otra ruta.
     */
    private function transicionInvalida(Property $property, PropertyStatus $esperaba): never
    {
        abort(422, trans('propiedades.transicionInvalida', [
            'estado' => $property->status?->options()[$property->status->value] ?? '—',
            'destino' => $esperaba->options()[$esperaba->value],
        ]));
    }
}
