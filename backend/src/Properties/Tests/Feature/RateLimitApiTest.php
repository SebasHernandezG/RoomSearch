<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Techo de peticiones de la API publica. RNF-05.
 *
 * El listado es la operacion mas cara del sistema: cada peticion
 * evalua ST_Distance_Sphere sobre una columna POINT sin indice
 * espacial. Estas pruebas fijan que el techo exista y que la respuesta
 * sea utilizable por el cliente.
 */
class RateLimitApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        RateLimiter::clear('api');

        Property::factory()->placePin(10.3236, -84.4274)->create();
    }

    #[Test]
    public function el_listado_responde_dentro_del_techo(): void
    {
        $this->getJson('/api/properties')
            ->assertOk()
            ->assertHeader('X-RateLimit-Limit', 120);
    }

    #[Test]
    public function al_exceder_el_techo_responde_429(): void
    {
        for ($i = 0; $i < 120; $i++) {
            $this->getJson('/api/properties')->assertOk();
        }

        $this->getJson('/api/properties')
            ->assertStatus(429);
    }

    /**
     * El cliente necesita saber cuando reintentar. Sin la cabecera, el
     * frontend solo puede mostrar un error generico y el usuario
     * reintenta a lo loco, gastando el techo que ya se acabo.
     */
    #[Test]
    public function el_429_trae_retry_after(): void
    {
        for ($i = 0; $i < 120; $i++) {
            $this->getJson('/api/properties');
        }

        $respuesta = $this->getJson('/api/properties')->assertStatus(429);

        $this->assertNotNull(
            $respuesta->headers->get('Retry-After'),
            'El 429 debe decir cuanto tiempo esperar',
        );
    }

    /**
     * El 429 tiene que ser JSON. El frontend llama con Accept:
     * application/json y si recibiera HTML terminaria mostrando un
     * error de red en vez de "espera un momento".
     */
    #[Test]
    public function el_429_es_json_y_no_html(): void
    {
        for ($i = 0; $i < 120; $i++) {
            $this->getJson('/api/properties');
        }

        $this->getJson('/api/properties')
            ->assertStatus(429)
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonStructure(['message']);
    }

    /**
     * El techo es por cliente, no global. Si fuera global, una
     * ventana abierta de mas dejaria sin servicio a todos los demas.
     */
    #[Test]
    public function el_techo_es_por_cliente_y_no_global(): void
    {
        for ($i = 0; $i < 120; $i++) {
            $this->getJson('/api/properties')->assertOk();
        }

        $this->getJson('/api/properties')->assertStatus(429);

        // Otro cliente, con otra IP, entra normal.
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->getJson('/api/properties')
            ->assertOk();
    }

    /**
     * Las rutas que no son de la API no se ven afectadas.
     */
    #[Test]
    public function la_health_check_no_cuenta(): void
    {
        for ($i = 0; $i < 130; $i++) {
            $this->getJson('/api/properties');
        }

        $this->get('/up')->assertOk();
    }

    #[Test]
    public function el_detalle_tambien_lleva_techo(): void
    {
        $propiedad = Property::factory()->placePin(10.3236, -84.4274)->create();

        $this->getJson('/api/properties/'.$propiedad->id)
            ->assertOk()
            ->assertHeader('X-RateLimit-Limit', 120);
    }
}
