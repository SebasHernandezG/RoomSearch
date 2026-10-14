<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Autorizacion por rol. RF-1.4.
 *
 * La primera mitad usa rutas montadas al vuelo y prueba el middleware
 * como pieza suelta. La segunda mitad repite lo mismo contra las rutas
 * de verdad, que es lo unico que demuestra que el middleware quedo
 * COLGADO de la ruta correcta: un middleware bien escrito y aplicado a
 * la ruta equivocada deja pasar a cualquiera.
 */
class RoleMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['auth:sanctum', 'role:landlord,admin'])
            ->get('/prueba/panel', fn () => response()->json(['ok' => true]));

        Route::middleware(['auth:sanctum', 'role:admin'])
            ->get('/prueba/admin', fn () => response()->json(['ok' => true]));

        Route::middleware(['auth:sanctum', 'role:landlord'])
            ->post('/prueba/publicar', fn () => response()->json(['ok' => true]));
    }

    /*
    |--------------------------------------------------------------------------
    | Panel de administracion: solo admin
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function el_admin_puede_entrar_al_panel(): void
    {
        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/prueba/admin')
            ->assertOk();
    }

    #[Test]
    public function un_arrendador_no_entra_al_panel(): void
    {
        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->getJson('/prueba/admin')
            ->assertForbidden();
    }

    #[Test]
    public function un_inquilino_no_entra_al_panel(): void
    {
        $this->actingAs(User::factory()->tenant()->create(), 'sanctum')
            ->getJson('/prueba/admin')
            ->assertForbidden();
    }

    /*
    |--------------------------------------------------------------------------
    | Publicar: arrendador y admin
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function un_arrendador_puede_publicar(): void
    {
        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/prueba/publicar')
            ->assertOk();
    }

    #[Test]
    public function un_inquilino_no_puede_publicar(): void
    {
        $this->actingAs(User::factory()->tenant()->create(), 'sanctum')
            ->postJson('/prueba/publicar')
            ->assertForbidden();
    }

    #[Test]
    public function se_pueden_pedir_varios_roles_a_la_vez(): void
    {
        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/prueba/panel')
            ->assertOk();

        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->getJson('/prueba/panel')
            ->assertOk();

        $this->actingAs(User::factory()->tenant()->create(), 'sanctum')
            ->getJson('/prueba/panel')
            ->assertForbidden();
    }

    /*
    |--------------------------------------------------------------------------
    | Sin sesion
    |--------------------------------------------------------------------------
    */

    /**
     * Sin sesion es 401, no 403. Decirle a alguien que no tiene cuenta
     * que su cuenta no tiene permisos lo manda a pensar que hay un bug
     * de sesion.
     */
    #[Test]
    public function sin_sesion_responde_401_y_no_403(): void
    {
        $this->getJson('/prueba/admin')
            ->assertStatus(401)
            ->assertJsonPath('message', 'Necesitás iniciar sesión para hacer eso.');
    }

    #[Test]
    public function el_403_dice_que_la_cuenta_no_puede(): void
    {
        $this->actingAs(User::factory()->tenant()->create(), 'sanctum')
            ->getJson('/prueba/admin')
            ->assertForbidden()
            ->assertJsonPath('message', 'Esta cuenta no puede hacer eso.');
    }

    /**
     * Las respuestas del middleware son JSON. El frontend llama con
     * Accept: application/json y si recibiera HTML terminaria
     * mostrando un error de red en vez del mensaje.
     */
    #[Test]
    public function el_middleware_responde_json(): void
    {
        $this->actingAs(User::factory()->tenant()->create(), 'sanctum')
            ->getJson('/prueba/admin')
            ->assertHeader('Content-Type', 'application/json');
    }

    /*
    |--------------------------------------------------------------------------
    | Un rol mal escrito
    |--------------------------------------------------------------------------
    */

    /**
     * Si alguien escribe 'landlrod' en el middleware, el rol no
     * coincide con nadie y la ruta queda cerrada para todos. Es el
     * fallo silencioso mas caro: nadie se da cuenta hasta que un
     * arrendador legitimo no puede publicar.
     */
    #[Test]
    public function un_rol_mal_escrito_cierra_la_ruta_para_todos(): void
    {
        Route::middleware(['auth:sanctum', 'role:landlrod'])
            ->get('/prueba/typo', fn () => response()->json(['ok' => true]));

        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->getJson('/prueba/typo')
            ->assertForbidden();
    }

    /*
    |--------------------------------------------------------------------------
    | Las mismas pruebas contra las rutas de verdad
    |--------------------------------------------------------------------------
    |
    | Lo de arriba demuestra que el middleware funciona. Esto demuestra
    | que esta en las rutas correctas: el middleware `role:admin` de las
    | rutas de moderacion (RF-7.1) y el guard de las de publicaciones
    | (RF-2.1).
    |
    | Las rutas de verdad ya se prueban de punta a punta en
    | PublishPropertyFlowTest. Aqui solo va lo que es del middleware y
    | no del flujo: quien puede, quien no, y con que cuerpo de respuesta.
    |
    */

    /**
     * La cabecera que manda el frontend con el token en la
     * `Authorization`, no con `actingAs`.
     *
     * Importa que sea un token de verdad y no `actingAs`: el guard de
     * Sanctum resuelve por cabecera, y una prueba que se la salta no
     * esta probando la ruta real.
     *
     * @return array<string, string>
     */
    private function comoAdmin(): array
    {
        return $this->como(User::factory()->admin()->create());
    }

    /**
     * @return array<string, string>
     */
    private function como(User $usuario): array
    {
        return [
            'Authorization' => 'Bearer '.$usuario->createToken('app')->plainTextToken,
            'Accept' => 'application/json',
        ];
    }

    #[Test]
    public function el_admin_modera_una_publicacion_real(): void
    {
        $propiedad = Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->postJson(
            '/api/properties/'.$propiedad->id.'/approve',
            [],
            $this->comoAdmin(),
        )->assertOk()->assertJsonPath('data.status', PropertyStatus::Activa->value);
    }

    #[Test]
    public function el_inquilino_no_modera_una_publicacion_real(): void
    {
        $propiedad = Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->postJson(
            '/api/properties/'.$propiedad->id.'/approve',
            [],
            $this->como(User::factory()->tenant()->create()),
        )->assertForbidden();

        // Y la publicacion sigue pendiente: un 403 que no frena nada
        // es indistinguible de uno que frena.
        $this->assertDatabaseHas('properties', [
            'id' => $propiedad->id,
            'status' => PropertyStatus::Pendiente->value,
        ]);
    }

    /**
     * El 403 de una ruta real dice lo mismo que el de una ruta de
     * prueba, y sale en JSON. Si el middleware se colgara despues de
     * una excepcion de Laravel, el frontend recibiria HTML y mostraria
     * un error de red en vez del mensaje.
     */
    #[Test]
    public function el_403_de_una_ruta_real_lleva_el_mensaje_en_espanol(): void
    {
        $propiedad = Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->postJson(
            '/api/properties/'.$propiedad->id.'/reject',
            [],
            $this->como(User::factory()->landlord()->create()),
        )
            ->assertForbidden()
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonPath('message', 'Esta cuenta no puede hacer eso.');
    }

    /**
     * Sin sesion, 401 y no 403, en las rutas reales de publicaciones.
     * El 401 lo da el guard, que corre antes que el middleware.
     */
    #[Test]
    public function sin_sesion_las_rutas_reales_de_publicar_dan_401(): void
    {
        $this->postJson('/api/properties', [], ['Accept' => 'application/json'])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Necesitás iniciar sesión para hacer eso.');

        $this->getJson('/api/my/properties', ['Accept' => 'application/json'])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Necesitás iniciar sesión para hacer eso.');
    }
}
