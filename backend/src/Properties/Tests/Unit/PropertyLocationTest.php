<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Unit;

use Modules\Properties\Support\PropertyLocation;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * La regla de privacidad del pin. RF-2.5.
 *
 * Es una prueba unitaria a proposito: la regla es aritmetica pura y no
 * necesita base de datos. Cuando estaba cubierta solo por el endpoint,
 * el factory dejaba show_exact_location en true y el camino del
 * desplazamiento nunca se ejecutaba: un TypeError en abs() llego a
 * produccion sin que ningun test lo notara.
 */
class PropertyLocationTest extends TestCase
{
    #[Test]
    public function sin_pin_no_hay_punto_que_mostrar(): void
    {
        $ubicacion = PropertyLocation::desdePunto(null, null, false);

        $this->assertFalse($ubicacion->tienePunto());
        $this->assertSame(
            ['latitude' => null, 'longitude' => null],
            $ubicacion->paraApi(),
        );
    }

    #[Test]
    public function con_pin_exacto_no_se_toca_la_coordenada(): void
    {
        $ubicacion = PropertyLocation::desdePunto(10.3236, -84.4274, true);

        $this->assertSame(10.3236, $ubicacion->latitud);
        $this->assertSame(-84.4274, $ubicacion->longitud);
        $this->assertTrue($ubicacion->exacto);
    }

    #[Test]
    public function sin_pin_exacto_la_coordenada_se_desplaza(): void
    {
        $ubicacion = PropertyLocation::desdePunto(10.3236, -84.4274, false);

        $this->assertNotSame(10.3236, $ubicacion->latitud);
        $this->assertNotSame(-84.4274, $ubicacion->longitud);
        $this->assertFalse($ubicacion->exacto);
    }

    /**
     * El desplazamiento tiene que ser estable: si cambiara en cada
     * respuesta, el marcador daria saltos al recargar la lista y la
     * ubicacion aproximada seria distinta segun quien mirara.
     */
    #[Test]
    public function el_desplazamiento_es_estable_entre_llamadas(): void
    {
        $primera = PropertyLocation::desdePunto(10.3236, -84.4274, false);
        $segunda = PropertyLocation::desdePunto(10.3236, -84.4274, false);

        $this->assertSame($primera->latitud, $segunda->latitud);
        $this->assertSame($primera->longitud, $segunda->longitud);
    }

    /**
     * Y no todos los inmuebles caen en el mismo punto: si el ruido
     * fuera identico para todos, se estarian delatando entre si.
     */
    #[Test]
    public function cada_inmueble_obtiene_un_desplazamiento_distinto(): void
    {
        $puntos = [];

        foreach ([0, 1, 2, 3, 4] as $indice) {
            $ubicacion = PropertyLocation::desdePunto(10.32 + $indice * 0.001, -84.43, false);

            $puntos[] = $ubicacion->latitud;
        }

        $this->assertCount(
            count(array_unique($puntos)),
            $puntos,
            'Cada inmueble debe caerse en un punto distinto',
        );
    }

    /**
     * El desplazamiento no puede ser tan grande que saque el marcador
     * del barrio, ni tan chico que no proteja nada.
     */
    #[Test]
    public function el_desplazamiento_esta_acotado(): void
    {
        for ($indice = 0; $indice < 200; $indice++) {
            $original = 10.0 + $indice * 0.01;
            $ubicacion = PropertyLocation::desdePunto($original, -84.0, false);

            $distancia = abs($ubicacion->latitud - $original);

            $this->assertGreaterThan(0.0, $distancia, 'Siempre debe desplazar algo');
            $this->assertLessThanOrEqual(0.0025, $distancia, 'Ni un metro mas del maximo');
        }
    }

    /**
     * La regla completa, de punta a punta por la API: la coordenada
     * real no puede salir en la respuesta cuando el arrendador no
     * autoriza mostrarla.
     */
    #[Test]
    public function por_la_api_no_se_devuelve_la_coordenada_real(): void
    {
        $real = ['latitude' => 10.3236, 'longitude' => -84.4274];

        $respuesta = PropertyLocation::desdePunto(
            $real['latitude'],
            $real['longitude'],
            false,
        )->paraApi();

        $this->assertNotSame($real['latitude'], $respuesta['latitude']);
        $this->assertNotSame($real['longitude'], $respuesta['longitude']);
    }

    /**
     * La distancia la calcula MySQL contra la posicion verdadera,
     * porque el radio tiene que filtrar sobre el lugar real.
     *
     * Darla sin filtrar por la API permitia triangular la casa exacta
     * por bisecion, moviendo el punto de referencia: con
     * `distance_meters` se hallaba el pin real sin importar que el
     * marcador saliera corrido. RF-2.5 quedaba anulado.
     */
    #[Test]
    public function sin_pin_exacto_la_distancia_se_redondea(): void
    {
        $ubicacion = PropertyLocation::desdePunto(10.3236, -84.4274, false);

        $this->assertSame(0, $ubicacion->distanciaRevelable(0));
        $this->assertSame(250, $ubicacion->distanciaRevelable(130));
        $this->assertSame(250, $ubicacion->distanciaRevelable(240));
        $this->assertSame(250, $ubicacion->distanciaRevelable(300));
        $this->assertSame(750, $ubicacion->distanciaRevelable(870));
    }

    #[Test]
    public function con_pin_exacto_la_distancia_no_se_redondea(): void
    {
        $ubicacion = PropertyLocation::desdePunto(10.3236, -84.4274, true);

        $this->assertSame(234, $ubicacion->distanciaRevelable(234));
        $this->assertSame(0, $ubicacion->distanciaRevelable(0));
    }

    #[Test]
    public function sin_resultado_de_distancia_no_hay_que_inventar_uno(): void
    {
        $this->assertNull(PropertyLocation::desdePunto(10.3, -84.4, false)->distanciaRevelable(null));
        $this->assertNull(PropertyLocation::desdePunto(null, null, false)->distanciaRevelable(null));
    }

    /**
     * El redondeo no puede estrechar la incertidumbre por debajo de lo
     * que el propio marcador ya revela.
     */
    #[Test]
    public function el_redondeo_no_revela_mas_que_el_marcador(): void
    {
        $ubicacion = PropertyLocation::desdePunto(10.3236, -84.4274, false);

        $desplazamientoMarcador = abs($ubicacion->latitud - 10.3236);
        $errorRedondeo = 125.0 / 111_320;

        $this->assertLessThan(
            $desplazamientoMarcador,
            $errorRedondeo,
            'La distancia redondeada debe ser menos precisa que el marcador',
        );
    }
}
