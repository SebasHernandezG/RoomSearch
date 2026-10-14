<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Properties\Enums\PropertyType;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Filtros del listado. RF-4.1.
 *
 * Los filtros se implementaron sin ninguna prueba, y por ahi se colaron
 * dos cosas:
 *
 * - Filtrar solo por precio maximo daba 422. Es el filtro mas natural
 *   de escribir ("hasta 300 000"), y estaba roto para todo el mundo.
 * - El radio no tenia su propia prueba de borde, que es el parametro
 *   con mas chances de que un valor se escape al SQL.
 */
class PropertyFiltersTest extends TestCase
{
    use RefreshDatabase;

    private function conPrecio(int $precio, string $moneda = 'CRC'): Property
    {
        return Property::factory()->activa()->create([
            'monthly_rent' => $precio,
            'currency' => $moneda,
        ]);
    }

    /**
     * @return list<int>
     */
    private function filtrar(string $consulta): array
    {
        $respuesta = $this->getJson('/api/properties?'.$consulta)->assertOk();

        return array_column($respuesta->json('data'), 'id');
    }

    /*
    |--------------------------------------------------------------------------
    | El rango de precio
    |--------------------------------------------------------------------------
    */

    /**
     * El bug: `max_rent` venía con la regla `gte:min_rent`, que compara
     * contra un `min_rent` que no se envió. Filtrar por un techo de
     * precio --la forma normal de buscar "no quiero pagar mas que
     * esto"-- respondía 422.
     */
    #[Test]
    public function filtrar_solo_por_precio_maximo(): void
    {
        $barato = $this->conPrecio(250_000);
        $caro = $this->conPrecio(600_000);

        $encontrados = $this->filtrar('max_rent=300000');

        $this->assertContains($barato->id, $encontrados);
        $this->assertNotContains($caro->id, $encontrados);
    }

    #[Test]
    public function filtrar_solo_por_precio_minimo(): void
    {
        $barato = $this->conPrecio(250_000);
        $caro = $this->conPrecio(600_000);

        $encontrados = $this->filtrar('min_rent=300000');

        $this->assertNotContains($barato->id, $encontrados);
        $this->assertContains($caro->id, $encontrados);
    }

    #[Test]
    public function los_dos_extremos_a_la_vez(): void
    {
        $muy_barato = $this->conPrecio(150_000);
        $medio = $this->conPrecio(300_000);
        $muy_caro = $this->conPrecio(700_000);

        $encontrados = $this->filtrar('min_rent=200000&max_rent=400000');

        $this->assertNotContains($muy_barato->id, $encontrados);
        $this->assertContains($medio->id, $encontrados);
        $this->assertNotContains($muy_caro->id, $encontrados);
    }

    /**
     * El cero es un precio valido: un inmueble de intercambio o de
     * apoyo. Si `min_rent=0` se tratara como "sin filtro", el filtro
     * no serviria para excluir los caros.
     */
    #[Test]
    public function un_rango_desde_cero_sigue_sirviendo(): void
    {
        $this->conPrecio(0);
        $caro = $this->conPrecio(600_000);

        $encontrados = $this->filtrar('min_rent=0&max_rent=300000');

        $this->assertNotContains($caro->id, $encontrados);
    }

    /**
     * El error sigue existiendo cuando los dos vienen y estan al reves.
     */
    #[Test]
    public function un_rango_al_reves_sigue_siendo_error(): void
    {
        $this->getJson('/api/properties?min_rent=400000&max_rent=200000')
            ->assertStatus(422)
            ->assertJsonValidationErrors('max_rent');
    }

    /**
     * Un max igual al min no es un rango invertido: incluye
     * justamente ese precio.
     */
    #[Test]
    public function un_rango_de_un_solo_valor(): void
    {
        $este = $this->conPrecio(300_000);

        $encontrados = $this->filtrar('min_rent=300000&max_rent=300000');

        $this->assertContains($este->id, $encontrados);
    }

    /*
    |--------------------------------------------------------------------------
    | Caracteristicas
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function por_tipo_de_inmueble(): void
    {
        $apartamento = Property::factory()->activa()->tipo(PropertyType::Apartamento)->create();
        $casa = Property::factory()->activa()->tipo(PropertyType::Casa)->create();

        $encontrados = $this->filtrar('type=apartamento');

        $this->assertContains($apartamento->id, $encontrados);
        $this->assertNotContains($casa->id, $encontrados);
    }

    /**
     * Las habitaciones y los banos son "al menos", no "exactamente":
     * alguien buscando dos habitaciones quiere ver las de tres tambien.
     */
    #[Test]
    public function por_numero_de_habitaciones_como_minimo(): void
    {
        $una = Property::factory()->activa()->create(['bedrooms' => 1]);
        $tres = Property::factory()->activa()->create(['bedrooms' => 3]);

        $encontrados = $this->filtrar('bedrooms=2');

        $this->assertNotContains($una->id, $encontrados);
        $this->assertContains($tres->id, $encontrados);
    }

    /**
     * `parking=0` tiene que filtrar por los que NO tienen parqueo. Con
     * un `filled()` cualquiera, el cero se perderia y el filtro no
     * haria nada.
     */
    #[Test]
    public function por_ausencia_de_parqueo(): void
    {
        $sin_parqueo = Property::factory()->activa()->create(['parking_spaces' => 0]);
        $con_parqueo = Property::factory()->activa()->create(['parking_spaces' => 2]);

        $encontrados = $this->filtrar('parking=0');

        $this->assertContains($sin_parqueo->id, $encontrados);
        $this->assertNotContains($con_parqueo->id, $encontrados);
    }

    #[Test]
    public function por_amueblado_y_mascotas(): void
    {
        $amoblado = Property::factory()->activa()->create(['furnished' => true]);
        $sencillo = Property::factory()->activa()->create(['furnished' => false]);

        $this->assertContains($amoblado->id, $this->filtrar('furnished=1'));
        $this->assertNotContains($sencillo->id, $this->filtrar('furnished=1'));
        $this->assertContains($sencillo->id, $this->filtrar('furnished=0'));
    }

    /**
     * RF-2.2 los servicios como catalogo: tres casillas, no texto.
     */
    #[Test]
    public function por_servicios_incluidos(): void
    {
        $con_internet = Property::factory()->activa()->create([
            'includes_internet' => true,
            'includes_water' => false,
        ]);

        $sin_internet = Property::factory()->activa()->create([
            'includes_internet' => false,
            'includes_water' => true,
        ]);

        $this->assertContains($con_internet->id, $this->filtrar('includes_internet=1'));
        $this->assertNotContains($sin_internet->id, $this->filtrar('includes_internet=1'));

        $this->assertContains($sin_internet->id, $this->filtrar('includes_water=1'));
        $this->assertNotContains($con_internet->id, $this->filtrar('includes_water=1'));
    }

    /**
     * "Disponible desde el X": el inmueble entra al mundo el dia que
     * dice `available_from`, asi que para estar disponible en la fecha
     * que pide quien busca tiene que ser anterior o igual.
     */
    #[Test]
    public function por_fecha_de_disponibilidad(): void
    {
        $ya_disponible = Property::factory()->activa()->create([
            'available_from' => now()->subWeek()->toDateString(),
        ]);

        $todavia_no = Property::factory()->activa()->create([
            'available_from' => now()->addMonth()->toDateString(),
        ]);

        $fecha = now()->addDay()->toDateString();

        $encontrados = $this->filtrar('available_from='.$fecha);

        $this->assertContains($ya_disponible->id, $encontrados);
        $this->assertNotContains($todavia_no->id, $encontrados);
    }

    /**
     * Sin fecha no se puede comparar con una fecha, y sale. No se le
     * inventa una por defecto: un inmueble sin `available_from` es el
     * que "esta disponible ya", no "disponible desde 1970".
     */
    #[Test]
    public function un_inmueble_sin_fecha_sale_del_filtro_por_fecha(): void
    {
        $sin_fecha = Property::factory()->activa()->create(['available_from' => null]);

        $fecha = now()->addDay()->toDateString();

        $this->assertNotContains($sin_fecha->id, $this->filtrar('available_from='.$fecha));
    }

    /*
    |--------------------------------------------------------------------------
    | Combinables
    |--------------------------------------------------------------------------
    */

    /**
     * Los filtros son Y entre si. Este es el criterio de RF-4.1: "sin
     * perder resultados por error".
     */
    #[Test]
    public function los_filtros_se_combinan_entre_si(): void
    {
        $este = Property::factory()->activa()->create([
            'type' => 'apartamento',
            'monthly_rent' => 280_000,
            'currency' => 'CRC',
            'bedrooms' => 2,
            'parking_spaces' => 1,
        ]);

        Property::factory()->activa()->create([
            'type' => 'apartamento',
            'monthly_rent' => 280_000,
            'currency' => 'CRC',
            'bedrooms' => 4,
            'parking_spaces' => 0,
        ]);

        Property::factory()->activa()->create([
            'type' => 'casa',
            'monthly_rent' => 280_000,
            'currency' => 'CRC',
            'bedrooms' => 2,
            'parking_spaces' => 1,
        ]);

        $encontrados = $this->filtrar('type=apartamento&max_rent=300000&bedrooms=2&parking=1');

        $this->assertSame([$este->id], $encontrados);
    }

    #[Test]
    public function un_filtro_sin_coincidencias_devuelve_una_lista_vacia(): void
    {
        $this->conPrecio(250_000);

        $this->getJson('/api/properties?min_rent=900000')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
