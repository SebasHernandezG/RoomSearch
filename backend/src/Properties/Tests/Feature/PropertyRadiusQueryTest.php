<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Busqueda por radio contra MySQL real. RF-3.3.
 *
 * Este archivo es la defensa contra las tres trampas de MySQL que se
 * encontraron probando el issue #16. Las tres fallan EN SILENCIO: la
 * consulta devuelve cero filas y no hay ningun error.
 *
 * Si alguien invierte el orden de los ejes o usa ST_MakeEnvelope, el
 * mapa se queda vacio y nada avisa. Estos tests son lo unico que avisa.
 */
class PropertyRadiusQueryTest extends TestCase
{
    use RefreshDatabase;

    private const LAT = 10.3236;

    private const LNG = -84.4274;

    #[Test]
    public function devuelve_las_propiedades_dentro_del_radio(): void
    {
        Property::factory()->cercaDe(self::LAT, self::LNG, 300)->count(3)->create();
        Property::factory()->lejosDe(self::LAT, self::LNG, 40_000)->count(5)->create();

        $respuesta = $this->getJson(
            '/api/properties?lat='.self::LAT.'&lng='.self::LNG.'&radius=1000'
        );

        $respuesta->assertOk()->assertJsonCount(3, 'data');

        $this->assertSame(
            3,
            $respuesta->json('meta.total'),
            'Las 5 que estan a 40 km no deben contar en el total',
        );
    }

    #[Test]
    public function la_distancia_viene_calculada_por_el_servidor(): void
    {
        Property::factory()->placePin(self::LAT, self::LNG)->create();

        $datos = $this->getJson(
            '/api/properties?lat='.self::LAT.'&lng='.self::LNG.'&radius=1000'
        )->json('data.0');

        $this->assertNotNull($datos['distance_meters'], 'La distancia la calcula la consulta');
        $this->assertLessThan(100, $datos['distance_meters']);
    }

    #[Test]
    public function resultados_vienen_ordenados_por_distancia(): void
    {
        Property::factory()->placePin(self::LAT + 0.005, self::LNG)->create();
        Property::factory()->placePin(self::LAT, self::LNG)->create();
        Property::factory()->placePin(self::LAT - 0.003, self::LNG)->create();

        $distancias = $this->getJson(
            '/api/properties?lat='.self::LAT.'&lng='.self::LNG.'&radius=2000&sort=distance'
        )->json('data.*.distance_meters');

        $ordenados = $distancias;
        sort($ordenados);

        $this->assertSame($ordenados, $distancias, 'Deben venir de menor a mayor distancia');
    }

    /**
     * La trampa 1: ST_MakeEnvelope no existe para SRID 4326.
     *
     * Si alguien "simplifica" la consulta usando ST_MakeEnvelope,
     * MySQL lanza ERROR 3618 y el endpoint deja de funcionar.
     *
     * Este test fija ese comportamiento: cuando exista una forma de
     * construir la envoltura, hay que venir a cambiarlo aqui.
     */
    #[Test]
    public function st_makeenvelope_falla_con_srid_4326(): void
    {
        $this->expectException(QueryException::class);

        DB::select(
            'SELECT ST_MakeEnvelope(
                ST_SRID(POINT(10.32, -84.43), 4326),
                ST_SRID(POINT(10.33, -84.42), 4326)
             ) AS envoltura'
        );
    }

    /**
     * La trampa 2: el orden de los ejes.
     *
     * El centro del mapa va en (longitud, latitud) para POINT() y en
     * (latitud, longitud) para el WKT del POLYGON. Si se usa el mismo
     * orden en ambos, la consulta devuelve cero filas y no falla.
     */
    #[Test]
    public function el_orden_de_ejes_es_el_correcto_para_cada_funcion(): void
    {
        // POINT recibe (longitud, latitud). La expresion va en el SQL,
        // no como parametro: MySQL lo interpretaria como un SRID.
        $punto = DB::selectOne(
            'SELECT ST_Latitude(ST_SRID(POINT(-84.4274, 10.3236), 4326)) AS lat,
                    ST_Longitude(ST_SRID(POINT(-84.4274, 10.3236), 4326)) AS lng'
        );

        $this->assertEqualsWithDelta(10.3236, $punto->lat, 0.0001);
        $this->assertEqualsWithDelta(-84.4274, $punto->lng, 0.0001);

        Property::factory()->placePin(self::LAT, self::LNG)->create();

        // Con el orden invertido, el centro caeria al hemisferio equivocado.
        $this->assertGreaterThan(
            0,
            $this->getJson('/api/properties?lat='.self::LAT.'&lng='.self::LNG.'&radius=1000')->json('meta.total'),
            'Con el orden correcto debe encontrar la propiedad',
        );
    }

    /**
     * La trampa 3: el indice espacial tiene que existir.
     *
     * Estuvo tres PRs sin poder agregarse porque `location` era
     * nullable y MySQL exige NOT NULL:
     *
     *   ERROR 1252: All parts of a SPATIAL index must be NOT NULL
     *
     * Ahora `location` es NOT NULL porque toda publicacion nace
     * 'pendiente' (RF-2.1) y no hay borrador sin pin.
     *
     * Esta prueba que diga que NO hay indice estaba bien cuando la
     * columna era nullable, y seria el error exacto que dejaria pasar
     * a una migracion que deshaga el indice. Por eso ahora afirma lo
     * contrario.
     */
    #[Test]
    public function la_columna_location_tiene_indice_espacial(): void
    {
        $indices = DB::select(
            "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'"
        );

        $espaciales = array_filter(
            $indices,
            fn ($i) => str_contains(strtolower((string) $i->INDEX_NAME), 'spatial'),
        );

        $this->assertCount(
            1,
            $espaciales,
            'location debe tener indice espacial: es lo que separa cumplir RNF-01 de no cumplirlo.',
        );
    }

    #[Test]
    public function la_columna_location_no_admite_nulos(): void
    {
        $nulos = DB::select(
            "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
               AND COLUMN_NAME = 'location'"
        );

        $this->assertSame('NO', $nulos[0]->IS_NULLABLE);
    }

    /**
     * Un borrador tiene pin, pero no sale: el filtro es por estado, no
     * por la falta de coordenadas.
     *
     * Antes esto se probaba con una propiedad sin pin, y la fila
     * quedaba fuera sola porque ST_Contains sobre NULL da NULL. Ese
     * caso ya no puede existir (location es NOT NULL), asi que lo que
     * se comprueba ahora es que el estadoPending no se filtre por el
     * pin sino por `status`.
     */
    #[Test]
    public function un_borrador_no_aparece_aunque_tenga_pin(): void
    {
        Property::factory()->borrador()->placePin(self::LAT, self::LNG)->create();

        $this->getJson('/api/properties?lat='.self::LAT.'&lng='.self::LNG.'&radius=1000')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    #[Test]
    public function una_publicacion_pendiente_de_moderacion_no_aparece(): void
    {
        Property::factory()->placePin(self::LAT, self::LNG)
            ->create(['status' => PropertyStatus::Pendiente]);

        $this->getJson('/api/properties?lat='.self::LAT.'&lng='.self::LNG.'&radius=1000')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    #[Test]
    public function el_radio_maximo_esta_acotado(): void
    {
        $this->getJson('/api/properties?lat='.self::LAT.'&lng='.self::LNG.'&radius=50000')
            ->assertStatus(422)
            ->assertJsonValidationErrors('radius');
    }

    #[Test]
    public function una_latitud_fuera_de_alajuela_se_rechaza(): void
    {
        $this->getJson('/api/properties?lat=48.85&lng=2.35&radius=1000')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lat', 'lng']);
    }

    #[Test]
    public function ordenar_por_distancia_exige_punto_de_referencia(): void
    {
        $this->getJson('/api/properties?sort=distance')
            ->assertStatus(422)
            ->assertJsonValidationErrors('sort');
    }
}
