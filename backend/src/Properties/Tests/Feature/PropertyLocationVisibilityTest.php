<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Identity\Models\User;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * RF-2.5: la ubicacion exacta no se filtra en el endpoint publico.
 *
 * La logica de privacidad del pin vive en Property::ubicacionPublica()
 * y PropertyLocation. Estas pruebas verifican que cuando
 * show_exact_location = false, el punto publico se desplaza y nunca
 * revela la coordenada verdadera.
 */
class PropertyLocationVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function crearPropiedad(bool $exacta): Property
    {
        $dueno = User::factory()->landlord()->create();

        $propiedad = Property::factory()->create([
            'user_id' => $dueno->getKey(),
            'show_exact_location' => $exacta,
        ]);

        // Escribir location directamente en la BD para evitar problemas
        // con DB::raw() en Eloquent update() sobre columnas geometry.
        DB::table('properties')->where('id', $propiedad->getKey())->update([
            'location' => DB::raw('ST_SRID(POINT(-84.4274, 10.3236), 4326)'),
        ]);

        return $propiedad->fresh();
    }

    #[Test]
    public function ubicacion_publica_desplaza_el_pin_cuando_show_exact_location_es_falso(): void
    {
        $propiedad = $this->crearPropiedad(false);

        $punto = $propiedad->ubicacionPublica();

        $this->assertFalse($punto->exacto);
        $this->assertNotSame(10.3236, $punto->latitud);
        $this->assertNotSame(-84.4274, $punto->longitud);
        $this->assertLessThanOrEqual(0.005, abs($punto->latitud - 10.3236));
        $this->assertLessThanOrEqual(0.005, abs($punto->longitud - (-84.4274)));
    }

    #[Test]
    public function ubicacion_publica_devuelve_pin_exacto_cuando_show_exact_location_es_verdadero(): void
    {
        $propiedad = $this->crearPropiedad(true);

        $punto = $propiedad->ubicacionPublica();

        $this->assertTrue($punto->exacto);
        $this->assertSame(10.3236, $punto->latitud);
        $this->assertSame(-84.4274, $punto->longitud);
    }

    #[Test]
    public function desplazamiento_es_determinista_mismo_pin_misma_ubicacion(): void
    {
        $propiedad1 = $this->crearPropiedad(false);
        $propiedad2 = $this->crearPropiedad(false);

        $punto1 = $propiedad1->ubicacionPublica();
        $punto2 = $propiedad2->ubicacionPublica();

        // El desplazamiento es determinista: mismo punto, mismo desplazamiento
        $this->assertSame($punto1->latitud, $punto2->latitud);
        $this->assertSame($punto1->longitud, $punto2->longitud);
    }

    #[Test]
    public function distancia_revelable_se_redondea_cuando_no_es_exacto(): void
    {
        $propiedad = $this->crearPropiedad(false);

        $punto = $propiedad->ubicacionPublica();

        // Distancia real de 373 m -> se revela como 250 m (multiplo de 250)
        $this->assertSame(250, $punto->distanciaRevelable(373));
        // Distancia real de 10 m -> se revela como 0 m
        $this->assertSame(0, $punto->distanciaRevelable(10));
    }
}
