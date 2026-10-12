<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Modules\Identity\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Autorizacion por rol. RF-1.4.
 *
 * Se prueban rutas montadas al vuelo y no las reales, porque todavia no
 * hay endpoint de publicaciones (RF-2.1) ni panel de administracion
 * (RF-7.1). Cuando existan, hay que repetir estas mismas pruebas contra
 * las rutas de verdad: un middleware bien escrito y aplicado a la ruta
 * equivocada deja pasar a cualquiera.
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
}
