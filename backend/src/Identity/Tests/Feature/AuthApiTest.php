<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Modules\Identity\Enums\UserRole;
use Modules\Identity\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Registro, inicio de sesion y fin de sesion. RF-1.1.
 */
class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'una-frase-larga';

    /*
    |--------------------------------------------------------------------------
    | Registro
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function registra_y_devuelve_el_token(): void
    {
        $respuesta = $this->postJson('/api/register', [
            'name' => 'Ana Prueba',
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        $respuesta->assertOk()
            ->assertJsonStructure(['message', 'token', 'user' => ['id', 'name', 'email', 'role']]);

        $this->assertDatabaseHas('users', ['email' => 'ana@prueba.test']);
    }

    /**
     * RNF-03. La contrasena no puede guardarse en claro.
     *
     * Se comprueba contra la base y no contra el modelo a proposito:
     * el cast `hashed` es lo que lo garantiza, y un cambio en el cast
     * se veria aqui aunque el modelo devuelva bien.
     */
    #[Test]
    public function la_contrasena_se_guarda_con_hash(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Ana Prueba',
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ])->assertOk();

        $guardada = DB::table('users')->value('password');

        $this->assertNotSame(self::PASSWORD, $guardada);
        $this->assertTrue(Hash::check(self::PASSWORD, $guardada));
        $this->assertStringStartsWith('$2y$', $guardada, 'bcrypt con el prefijo de la version 2');
    }

    /**
     * El rol nunca viene del cuerpo de la peticion.
     *
     * Si una persona pudiera pedir admin al registrarse, el registro
     * seria un escalamiento de privilegios de una línea.
     */
    #[Test]
    public function el_rol_no_se_puede_elegir_al_registrarse(): void
    {
        $respuesta = $this->postJson('/api/register', [
            'name' => 'Ana Prueba',
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
            'role' => 'admin',
        ]);

        $respuesta->assertOk()
            ->assertJsonPath('user.role', UserRole::Tenant->value);

        $this->assertDatabaseHas('users', [
            'email' => 'ana@prueba.test',
            'role' => UserRole::Tenant->value,
        ]);
    }

    /**
     * `lowercase` de Laravel rechaza las mayusculas en vez de
     * convertirlas. Sin normalizar antes, alguien que escribiera su
     * correo con mayusculas recibiria un error.
     */
    #[Test]
    public function el_correo_se_normaliza_a_minusculas(): void
    {
        $respuesta = $this->postJson('/api/register', [
            'name' => '  Ana Prueba  ',
            'email' => '  ANA@Prueba.Test  ',
            'password' => self::PASSWORD,
        ]);

        $respuesta->assertOk()
            ->assertJsonPath('user.email', 'ana@prueba.test')
            ->assertJsonPath('user.name', 'Ana Prueba');
    }

    #[Test]
    public function no_se_puede_registrar_un_correo_ya_usado(): void
    {
        User::factory()->create(['email' => 'ana@prueba.test']);

        $respuesta = $this->postJson('/api/register', [
            'name' => 'Otra Persona',
            'email' => 'ANA@prueba.test',
            'password' => self::PASSWORD,
        ]);

        $respuesta->assertStatus(422)->assertJsonValidationErrors('email');
    }

    /**
     * Los mensajes van en español y con "vos". El usuario nunca ve
     * "The email field is required."
     */
    #[Test]
    public function los_errores_de_validacion_van_en_espanol(): void
    {
        $respuesta = $this->postJson('/api/register', []);

        $respuesta->assertStatus(422)->assertJsonValidationErrors(['name', 'email', 'password']);

        $errores = $respuesta->json('errors');

        $this->assertStringContainsString('es obligatorio', $errores['name'][0]);
        $this->assertStringNotContainsString('required', implode(' ', $errores['email']));
    }

    #[Test]
    public function una_contrasena_corta_se_rechaza(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Ana Prueba',
            'email' => 'ana@prueba.test',
            'password' => 'corta',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    /*
    |--------------------------------------------------------------------------
    | Inicio de sesion
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function inicia_sesion_con_credenciales_correctas(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        $respuesta = $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        $respuesta->assertOk()
            ->assertJsonStructure(['message', 'token', 'user'])
            ->assertJsonPath('user.email', 'ana@prueba.test');
    }

    /**
     * El correo se normaliza tambien al entrar. Si alguien se registro
     * en minusculas y despues escribe su correo en mayusculas, el
     * correo no distingue y deberia poder entrar.
     */
    #[Test]
    public function el_correo_se_normaliza_tambien_al_entrar(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        $this->postJson('/api/login', [
            'email' => 'ANA@Prueba.Test',
            'password' => self::PASSWORD,
        ])->assertOk();
    }

    #[Test]
    public function una_contrasena_incorrecta_no_entra(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => 'no-es-la-misma',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    /**
     * El mensaje tiene que ser indistinguible entre "no existe la
     * cuenta" y "la contrasena esta mal".
     *
     * Si difirieran, este endpoint serviria para enumerar quien tiene
     * cuenta en la plataforma, que es informacion que vale.
     */
    #[Test]
    public function el_mensaje_no_revela_si_la_cuenta_existe(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        $conCuenta = $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => 'no-es-la-misma',
        ]);

        $sinCuenta = $this->postJson('/api/login', [
            'email' => 'nadie@prueba.test',
            'password' => 'no-es-la-misma',
        ]);

        $this->assertSame(
            $conCuenta->json('errors.email'),
            $sinCuenta->json('errors.email'),
            'La respuesta no puede distinguir los dos casos',
        );

        $this->assertSame($conCuenta->status(), $sinCuenta->status());
    }

    /*
    |--------------------------------------------------------------------------
    | Fin de sesion
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function la_sesion_activa_devuelve_la_cuenta(): void
    {
        $usuario = User::factory()->landlord()->create();

        $this->actingAs($usuario, 'sanctum')
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.email', $usuario->email)
            ->assertJsonPath('data.role', UserRole::Landlord->value);
    }

    /**
     * Sin token, 401.
     */
    #[Test]
    public function sin_token_no_hay_cuenta_que_devolver(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    /**
     * Logout revoca el token de verdad: deja de servir de inmediato.
     *
     * Revocar y no solo olvidar. Un token que sigue en la base sirve
     * hasta que expire, asi que si a alguien le roban el token, la
     * unica forma de que deje de funcionar es borrarlo.
     */
    #[Test]
    public function al_cerrar_sesion_el_token_deja_de_servir(): void
    {
        $usuario = User::factory()->create();

        $token = $usuario->createToken('app')->plainTextToken;

        $cabecera = ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];

        $this->postJson('/api/logout', [], $cabecera)->assertOk();

        $this->assertSame(0, DB::table('personal_access_tokens')->count(), 'El token debe borrarse');

        /*
         * forgetGuards() no es cosmetico.
         *
         * En pruebas todas las peticiones comparten la misma instancia
         * de la aplicacion, y el guard de Sanctum guarda en memoria el
         * usuario que ya resolvio. Sin esto, la peticion siguiente
         * seguiría autenticada con el token que se acaba de revocar y
         * la prueba passaria al reves de como funciona en produccion,
         * donde cada peticion arranca de cero.
         */
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user', $cabecera)->assertUnauthorized();
    }

    #[Test]
    public function la_cuenta_nunca_devuelve_la_contrasena(): void
    {
        $usuario = User::factory()->create();

        $respuesta = $this->actingAs($usuario, 'sanctum')->getJson('/api/user');

        $respuesta->assertOk();

        $this->assertArrayNotHasKey('password', $respuesta->json('data'));
        $this->assertArrayNotHasKey('remember_token', $respuesta->json('data'));
        $this->assertStringNotContainsString(
            'password',
            $respuesta->getContent(),
            'Ni siquiera el nombre de la clave puede aparecer',
        );
    }
}
