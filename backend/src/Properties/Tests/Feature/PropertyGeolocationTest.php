<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * El pin y la geolocalizacion contra MySQL real. RF-2.4.
 *
 * Este test existe por una razon concreta: invertir el orden de los
 * ejes en POINT() NO produce error en MySQL, solo coloca el punto en
 * el hemisferio equivocado. Un mapa mostraria los Inmuebles en el
 * oceano y nadie sabria por que. Estos asserts son la unica defensa.
 *
 * Este archivo solo corre con MySQL. Ver phpunit.xml.dist.
 */
class PropertyGeolocationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Ciudad Quesada, centro del canton de San Carlos.
     */
    private const CIUDAD_QUESADA_LAT = 10.3236;

    private const CIUDAD_QUESADA_LNG = -84.4274;

    #[Test]
    public function guarda_el_pin_en_una_columna_point_srid_4326(): void
    {
        $inmueble = Property::factory()
            ->placePin(self::CIUDAD_QUESADA_LAT, self::CIUDAD_QUESADA_LNG)
            ->create();

        $srid = $inmueble->newQuery()
            ->whereKey($inmueble->getKey())
            ->selectRaw('ST_SRID(location) AS srid')
            ->value('srid');

        $this->assertSame(4326, (int) $srid, 'La columna location debe ser SRID 4326');
    }

    #[Test]
    public function el_pin_se_lee_con_la_latitud_y_longitud_correctas(): void
    {
        $inmueble = Property::factory()
            ->placePin(self::CIUDAD_QUESADA_LAT, self::CIUDAD_QUESADA_LNG)
            ->create()
            ->fresh();

        $this->assertEqualsWithDelta(self::CIUDAD_QUESADA_LAT, $inmueble->latitude(), 0.0001);
        $this->assertEqualsWithDelta(self::CIUDAD_QUESADA_LNG, $inmueble->longitude(), 0.0001);
    }

    /**
     * El guardarrail principal.
     *
     * Si alguien invierte el orden en placePin(), la distancia al centro
     * pasa de ~0 m a ~11 000 km. Este assert falla en ese caso.
     */
    #[Test]
    public function el_pin_no_cae_en_el_hemisferio_equivocado(): void
    {
        $inmueble = Property::factory()
            ->placePin(self::CIUDAD_QUESADA_LAT, self::CIUDAD_QUESADA_LNG)
            ->create();

        $distancia = $inmueble->newQuery()
            ->whereKey($inmueble->getKey())
            ->selectRaw(
                'ST_Distance_Sphere(location, ST_SRID(POINT(?, ?), 4326)) AS metros',
                [self::CIUDAD_QUESADA_LNG, self::CIUDAD_QUESADA_LAT],
            )
            ->value('metros');

        $this->assertLessThan(
            100,
            (float) $distancia,
            'El pin deberia estar en Ciudad Quesada, no al otro lado del planeta',
        );
    }

    #[Test]
    public function la_latitud_debe_caer_dentro_de_costa_rica(): void
    {
        $inmueble = Property::factory()
            ->placePin(self::CIUDAD_QUESADA_LAT, self::CIUDAD_QUESADA_LNG)
            ->create()
            ->fresh();

        $latitud = $inmueble->latitude();
        $longitud = $inmueble->longitude();

        $this->assertGreaterThan(8.0, $latitud, 'San Carlos esta entre 9.5 y 11.0 de latitud');
        $this->assertLessThan(11.5, $latitud);
        $this->assertGreaterThan(-85.5, $longitud, 'San Carlos esta entre -85.5 y -83.0 de longitud');
        $this->assertLessThan(-83.0, $longitud);
    }

    /**
     * Toda publicacion tiene pin. No hay excepción.
     *
     * Antes `location` era nullable porque se suponía que un borrador
     * podía quedarse en el paso 1 del formulario sin pin. RF-2.1 dice
     * que toda publicación nueva nace en 'pendiente', así que ese
     * borrador nunca existió, y la nulabilidad solo bloqueaba el
     * índice espacial:
     *
     *   ERROR 1252: All parts of a SPATIAL index must be NOT NULL
     */
    #[Test]
    public function una_publicacion_no_puede_existir_sin_pin(): void
    {
        $this->expectException(QueryException::class);

        Property::factory()->create(['location' => null]);
    }

    #[Test]
    public function un_borrador_tambien_tiene_pin(): void
    {
        $borrador = Property::factory()->borrador()->placePin(10.3236, -84.4274)->create();

        $this->assertNotNull($borrador->fresh()->latitude());
        $this->assertSame(PropertyStatus::Borrador, $borrador->status);
    }

    #[Test]
    public function el_filtro_publico_solo_devuelve_activas(): void
    {
        Property::factory()->activa()->count(3)->create();
        Property::factory()->borrador()->count(2)->create();
        Property::factory()->alquilada()->count(1)->create();

        $this->assertSame(3, Property::query()->publiclyVisible()->count());
    }

    #[Test]
    public function el_pin_no_aparece_en_el_relleno_masivo(): void
    {
        $inmuebles = Property::factory()->count(5)->create();

        foreach ($inmuebles as $inmueble) {
            $array = $inmueble->toArray();

            $this->assertArrayNotHasKey(
                'location',
                $array,
                'La columna POINT no debe serializarse como texto binario',
            );
        }
    }

    #[Test]
    public function el_precio_se_guarda_como_entero_en_la_moneda(): void
    {
        $inmueble = Property::factory()->enColones()->create(['monthly_rent' => 280_000]);
        $recuperado = $inmueble->fresh();

        $this->assertSame(280_000, $recuperado->monthly_rent);
        $this->assertSame('₡', $recuperado->currency->symbol());
    }

    #[Test]
    public function la_distancia_entre_dos_pins_es_correcta(): void
    {
        // Dos puntos separados por 0.01 grados de latitud (~1113 m).
        $inmueble = Property::factory()
            ->placePin(self::CIUDAD_QUESADA_LAT, self::CIUDAD_QUESADA_LNG)
            ->create();

        $distancia = $inmueble->newQuery()
            ->whereKey($inmueble->getKey())
            ->selectRaw(
                'ST_Distance_Sphere(location, ST_SRID(POINT(?, ?), 4326)) AS metros',
                [self::CIUDAD_QUESADA_LNG, self::CIUDAD_QUESADA_LAT + 0.01],
            )
            ->value('metros');

        // 0.01 grados de latitud ronda los 1113 m. Tolerance del 2 %.
        $this->assertGreaterThan(1090, (float) $distancia);
        $this->assertLessThan(1135, (float) $distancia);
    }
}
