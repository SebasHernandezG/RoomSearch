<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Identity\Models\User;
use Modules\Properties\Models\InterestIntent;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Limite diario anti-spam para "Me interesa". RF-5.6.
 *
 * Un usuario no puede inundar a un arrendador con solicitudes.
 * El limite es diario y se aplica por usuario (y por IP para
 * cuentas sin sesion, aunque este endpoint requiere sesion).
 */
class InterestRateLimitTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function usuario_puede_crear_hasta_dies_intereses_por_dia(): void
    {
        $inquilino = $this->inquilino();
        $inmuebles = Property::factory()->activa()->count(10)->create();

        foreach ($inmuebles as $inmueble) {
            $this->actingAs($inquilino)->postJson(
                "/api/properties/{$inmueble->getKey()}/interests",
                ['message' => 'Hola, ¿sigue disponible? Me interesa este inmueble.'],
            )->assertCreated();
        }

        $this->assertSame(10, InterestIntent::intentosHoyDeUsuario($inquilino->getKey()));
    }

    #[Test]
    public function el_undecimo_interes_por_dia_devuelve_429(): void
    {
        $inquilino = $this->inquilino();
        $inmuebles = Property::factory()->activa()->count(11)->create();

        foreach ($inmuebles as $index => $inmueble) {
            $respuesta = $this->actingAs($inquilino)->postJson(
                "/api/properties/{$inmueble->getKey()}/interests",
                ['message' => 'Hola, ¿sigue disponible? Mensaje numero '.($index + 1).'.'],
            );

            if ($index < 10) {
                $respuesta->assertCreated();
            } else {
                $respuesta->assertStatus(429)
                    ->assertJsonValidationErrors('property_id');
            }
        }

        $this->assertSame(11, InterestIntent::intentosHoyDeUsuario($inquilino->getKey()));
    }

    #[Test]
    public function cuenta_admin_no_tiene_limite_diario(): void
    {
        $admin = User::factory()->admin()->create();
        $admin->markEmailAsVerified();
        $inmueble = Property::factory()->activa()->create();

        $this->actingAs($admin)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me interesa este inmueble y quiero saber más detalles sobre las condiciones de alquiler y las fechas de entrada.'],
        )->assertCreated();

        $this->assertDatabaseHas('interests', [
            'property_id' => $inmueble->getKey(),
            'user_id' => $admin->getKey(),
        ]);
        $this->assertSame(1, InterestIntent::intentosHoyDeUsuario($admin->getKey()));
    }

    #[Test]
    public function intento_registrado_incluso_si_es_duplicado(): void
    {
        $inquilino = $this->inquilino();
        $inmueble = $this->inmueble();

        $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Primera vez, ¿sigue disponible?'],
        )->assertCreated();

        $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Segunda vez, duplicado.'],
        )->assertStatus(422);

        // Ambos intentos se registraron aunque el segundo fallara por duplicado
        $this->assertSame(2, InterestIntent::intentosHoyDeUsuario($inquilino->getKey()));
    }

    #[Test]
    public function intento_no_registrado_si_es_anuncio_propio(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible?'],
        )->assertStatus(422);

        // Auto-contacto no cuenta como intento de spam
        $this->assertSame(0, InterestIntent::intentosHoyDeUsuario($dueno->getKey()));
    }

    /*
     * Ayudas
     */

    private function dueno(): User
    {
        $dueno = User::factory()->landlord()->create();
        $dueno->markEmailAsVerified();

        return $dueno;
    }

    private function inquilino(): User
    {
        $inquilino = User::factory()->tenant()->create();
        $inquilino->markEmailAsVerified();

        return $inquilino;
    }

    private function inmueble(array $extra = []): Property
    {
        return Property::factory()->activa()->create([
            'user_id' => $this->dueno()->getKey(),
            ...$extra,
        ]);
    }
}
