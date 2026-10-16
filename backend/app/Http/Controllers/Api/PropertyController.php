<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ListPropertiesRequest;
use App\Http\Resources\PropertyResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use Modules\Properties\Queries\PropertyRadiusQuery;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Inmuebles. RF-2.1, RF-3.3 y RF-4.1.
 *
 * API sin sesion: RF-1.4 dice que el visitante busca y ve el mapa sin
 * crear cuenta. La autenticacion entra en RF-1.1 con Sanctum y no se
 * mezcla aqui.
 */
class PropertyController extends Controller
{
    /**
     * Listado con busqueda por radio y filtros combinables.
     */
    public function index(ListPropertiesRequest $request): AnonymousResourceCollection
    {
        $consulta = $this->consultaBase($request);

        if ($request->tienePuntoDeReferencia()) {
            $radio = new PropertyRadiusQuery(
                (float) $request->input('lat'),
                (float) $request->input('lng'),
                (int) $request->input('radius', PropertyRadiusQuery::RADIO_MAXIMO),
            );

            $radio->aplicar($consulta);
        }

        $this->aplicarFiltros($consulta, $request);
        $this->aplicarOrden($consulta, $request);

        $paginacion = $consulta
            /*
             * Las fotos vienen con el listado. RF-2.3.
             *
             * Sin esto, `PropertyResource` devuelve `images: []`
             * porque la relacion no esta cargada, y la tarjeta del
             * mapa muestra el placeholder en todos los anuncios que si
             * tienen fotos.
             *
             * Va en la consulta y no en un `load` despues de la
             * paginacion: cargarlo despues seria N+1, una consulta por
             * inmueble.
             */
            ->with('imagenes')
            ->paginate((int) $request->input('per_page', 24))
            ->withQueryString();

        return PropertyResource::collection($paginacion);
    }

    /**
     * Detalle de un inmueble.
     */
    public function show(Request $request, Property $property): PropertyResource
    {
        if ($property->status !== PropertyStatus::Activa) {
            throw new NotFoundHttpException('Este inmueble no esta disponible.');
        }

        return new PropertyResource($property->load('imagenes'));
    }

    /**
     * Solo las activas son publicas. RF-2.6.
     *
     * @return Builder<Property>
     */
    private function consultaBase(ListPropertiesRequest $request): Builder
    {
        return Property::query()
            ->where('status', PropertyStatus::Activa->value);
    }

    /**
     * RF-4.1: todos opcionales y combinables.
     *
     * @param  Builder<Property>  $consulta
     */
    private function aplicarFiltros(
        Builder $consulta,
        ListPropertiesRequest $request,
    ): void {
        if ($request->filled('type')) {
            $consulta->where('type', $request->string('type')->value());
        }

        if ($request->filled('min_rent')) {
            $consulta->where('monthly_rent', '>=', $request->integer('min_rent'));
        }

        if ($request->filled('max_rent')) {
            $consulta->where('monthly_rent', '<=', $request->integer('max_rent'));
        }

        if ($request->filled('bedrooms')) {
            $consulta->where('bedrooms', '>=', $request->integer('bedrooms'));
        }

        if ($request->filled('bathrooms')) {
            $consulta->where('bathrooms', '>=', $request->integer('bathrooms'));
        }

        if ($request->has('furnished')) {
            $consulta->where('furnished', $request->boolean('furnished'));
        }

        if ($request->has('pets_allowed')) {
            $consulta->where('pets_allowed', $request->boolean('pets_allowed'));
        }

        /*
         * `parking` es el filtro que mas trampas tiene, porque su
         * valor por defecto es cero.
         *
         * Con `where('parking_spaces', '>=', $request->boolean('parking')
         * ? 1 : 0)`, pedir "sin parqueo" comparaba `>= 0`, que es
         * cierto para TODAS las filas: el filtro no filtraba nada y
         * devolvia la pagina entera. Quien lo prendia creyendo que
         * estaba viendo solo los que no tienen parqueo estaba viendo
         * los que tienen parqueo tambien.
         *
         * Por eso el cero se compara con igualdad, no con mayor o
         * igual. Y por eso se usa `has()` y no `filled()`: `parking=0`
         * esta presente aunque sea "falsy".
         */
        if ($request->has('parking')) {
            $request->boolean('parking')
                ? $consulta->where('parking_spaces', '>=', 1)
                : $consulta->where('parking_spaces', 0);
        }

        /*
         * RF-2.2 pide los servicios incluidos como catalogo y no como
         * texto libre: son tres casillas, no un campo de texto. Por eso
         * se filtran por booleano y no con un `LIKE`.
         *
         * Un inmueble sin marcar un servicio tiene `false`, que es lo
         * que la API devuelve; no hay un tercer estado de "no aplica".
         */
        foreach (['includes_water', 'includes_electricity', 'includes_internet'] as $servicio) {
            if ($request->has($servicio)) {
                $consulta->where($servicio, $request->boolean($servicio));
            }
        }

        /*
         * "Disponible desde el X": el inmueble entra al mundo el dia
         * que dice `available_from`, asi que para estar disponible en la
         * fecha que pide quien busca tiene que ser `<=` a ella.
         *
         * Y `available_from` es nullable: un inmueble sin fecha no se
         * puede comparar con una fecha, y sale del resultado. No se
         * inventa una fecha por defecto.
         */
        if ($request->filled('available_from')) {
            $consulta->whereDate('available_from', '<=', $request->date('available_from'));
        }

        if ($request->filled('district')) {
            $consulta->where('district', $request->string('district')->value());
        }

        // RF-4.3: busqueda por texto, sin distinguir acentos ni mayusculas.
        if ($request->tieneTerminoDeBusqueda()) {
            $termino = trim($request->string('q')->value());

            $consulta->where(function ($q) use ($termino): void {
                $q->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower($termino).'%'])
                    ->orWhereRaw('LOWER(district) LIKE ?', ['%'.mb_strtolower($termino).'%'])
                    ->orWhereRaw('LOWER(neighborhood) LIKE ?', ['%'.mb_strtolower($termino).'%']);
            });
        }
    }

    /**
     * RF-4.2.
     *
     * @param  Builder<Property>  $consulta
     */
    private function aplicarOrden(
        Builder $consulta,
        ListPropertiesRequest $request,
    ): void {
        match ($request->input('sort', 'recent')) {
            'price_asc' => $consulta->orderBy('monthly_rent'),
            'price_desc' => $consulta->orderByDesc('monthly_rent'),
            // La consulta de radio ya ordeno por distancia. Sin punto
            // de referencia se cae a fecha, no a algo arbitrario.
            'distance' => $consulta->orderBy('distance_meters'),
            default => $consulta->latest(),
        };
    }
}
