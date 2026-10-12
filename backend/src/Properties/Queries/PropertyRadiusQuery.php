<?php

declare(strict_types=1);

namespace Modules\Properties\Queries;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Modules\Properties\Models\Property;

/**
 * Busqueda por radio. RF-3.3.
 *
 * Este codigo es la traslacion de la consulta validada contra MySQL 8.4
 * en el issue #16. Las tres trampas de MySQL que se encontraron estan
 * comentadas aqui porque son facilisimas de reintroducir.
 *
 * TRAMPA 1 -- ST_MakeEnvelope no existe para SRID 4326
 *
 *   ERROR 3618: st_makeenvelope(POINT, POINT) has not been implemented
 *   for geographic spatial reference systems.
 *
 * La envoltura se construye como POLYGON con ST_GeomFromText.
 *
 * TRAMPA 2 -- MySQL usa orden de ejes DISTINTO en cada funcion
 *
 *   ST_SRID(POINT(-84.4274, 10.3236), 4326)  ->  lat 10.3236, lng -84.4274
 *   ST_GeomFromText('POLYGON((10.3236 -84.4274, ...))', 4326) -> lat primero
 *
 * POINT recibe (longitud, latitud), que es lo mismo que usan Leaflet y
 * GeoJSON. El WKT del POLYGON recibe (latitud, longitud), al reves.
 *
 * Invertir cualquiera de los dos no lanza error: devuelve cero
 * resultados en silencio. Por eso hay tests que fallan si se invierten.
 *
 * TRAMPA 3 -- sin indice espacial la consulta no escala
 *
 * MySQL exige NOT NULL en toda columna con indice espacial:
 *
 *   ERROR 1252: All parts of a SPATIAL index must be NOT NULL
 *
 * location es nullable porque RF-2.6 exige estado 'borrador' y el
 * formulario pide el pin en el paso 6 de 6. Por eso AUN NO HAY indice
 * espacial. Se agrega cuando publicar exija el pin.
 *
 * Medido en MySQL 8.4 con 10 000 filas: con indice espacial se
 * examinan 251 filas, sin el, 5 077. Es la diferencia entre cumplir y
 * no cumplir RNF-01.
 */
class PropertyRadiusQuery
{
    /**
     * Radio maximo admitido, en metros.
     *
     * Acotarlo mantiene la envoltura pequena: un radio enorme degenera
     * la consulta en un table scan.
     */
    public const RADIO_MAXIMO = 10_000;

    public const RADIO_MINIMO = 100;

    public function __construct(
        private readonly float $latitud,
        private readonly float $longitud,
        private readonly int $metros,
    ) {}

    /**
     * @param  Builder<Property>  $query
     * @return Builder<Property>
     */
    public function aplicar(Builder $query): Builder
    {
        $envoltura = $this->envolturaRectangular();

        return $query
            /*
             * location es nullable, asi que ST_Contains sobre NULL da
             * NULL y la fila queda fuera sola. Es lo correcto: un
             * borrador sin pin no puede salir en el mapa.
             *
             * ST_GeomFromText es obligatorio. Pasar el WKT crudo hace
             * que MySQL lo interprete como un numero de SRID:
             *   ERROR 3548: There's no spatial reference system with
             *   SRID 1498173264
             */
            ->whereRaw('ST_Contains(ST_GeomFromText(?, 4326), location)', [$envoltura])
            ->whereRaw('ST_Distance_Sphere(location, ST_SRID(POINT(?, ?), 4326)) <= ?', [
                $this->longitud,
                $this->latitud,
                $this->metros,
            ])
            ->select('properties.*')
            ->selectRaw(
                'ST_Distance_Sphere(location, ST_SRID(POINT(?, ?), 4326)) AS distance_meters',
                [$this->longitud, $this->latitud],
            )
            /*
             * Las coordenadas salen aqui para no volver a pedirlas una
             * por una en Property::ubicacionPublica(). Los alias no
             * colisionan con ninguna columna: la geometria se llama
             * location, no latitud.
             */
            ->selectRaw('ST_Latitude(location) AS latitud')
            ->selectRaw('ST_Longitude(location) AS longitud')
            ->orderBy('distance_meters');
    }

    /**
     * Rectangulo envolvente del circulo.
     *
     * El circulo exacto no se puede expresar como poligono, asi que se
     * usa el rectangulo que lo envuelve y despues ST_Distance_Sphere
     * acota. Medido: el rectangulo da 210 filas y el circulo 190, asi
     * que el rectangulo es un superconjunto y el filtro de distancia
     * hace el resto.
     *
     * @return string geometria WKT
     */
    private function envolturaRectangular(): string
    {
        [$sur, $norte] = $this->latitudMinimaYMaxima();
        [$oeste, $este] = $this->longitudMinimaYMaxima();

        /*
         * OJO: el orden aqui es (latitud, longitud), al reves que en
         * puntoCentral(). Es la TRAMPA 2.
         */
        return sprintf(
            'POLYGON((%F %F, %F %F, %F %F, %F %F, %F %F))',
            $sur,
            $oeste,
            $sur,
            $este,
            $norte,
            $este,
            $norte,
            $oeste,
            $sur,
            $oeste,
        );
    }

    /**
     * @return array{float, float} latitud sur, latitud norte
     */
    private function latitudMinimaYMaxima(): array
    {
        $delta = $this->metros / 1000 / 110.574;

        return [$this->latitud - $delta, $this->latitud + $delta];
    }

    /**
     * @return array{float, float} longitud oeste, longitud este
     */
    private function longitudMinimaYMaxima(): array
    {
        // Un grado de longitud se acorta al avanzar hacia los polos.
        $delta = $this->metros / 1000 / (111.320 * cos(deg2rad($this->latitud)));

        return [$this->longitud - $delta, $this->longitud + $delta];
    }

    /**
     * Punto central, para consultas que no necesitan envoltura.
     *
     * @return string expresion SQL
     */
    public function puntoCentralSql(): string
    {
        return 'ST_SRID(POINT('.$this->longitud.', '.$this->latitud.'), 4326)';
    }

    /**
     * Distancia de una propiedad al centro, en metros.
     */
    public function distanciaDe(Property $propiedad): ?float
    {
        if ($propiedad->latitude() === null) {
            return null;
        }

        $valor = DB::table('properties')
            ->where('id', $propiedad->getKey())
            ->selectRaw(
                'ST_Distance_Sphere(location, '.$this->puntoCentralSql().') AS metros'
            )
            ->value('metros');

        return $valor === null ? null : (float) $valor;
    }
}
