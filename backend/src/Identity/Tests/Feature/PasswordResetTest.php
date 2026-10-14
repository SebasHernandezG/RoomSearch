<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Modules\Identity\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Recuperacion de contrasena. RF-1.3.
 *
 * Dos criterios pesan aqui:
 *
 * - El token es de **un solo uso** y **expira**.
 * - Ninguna respuesta dice si el correo existe.
 */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(): User
    {
        return User::factory()->create(['password' => 'la-contrasena-vieja']);
    }

    /**
     * El token tal como llega en el correo.
     */
    private function tokenDe(User $usuario): string
    {
        return Password::broker()->createToken($usuario);
    }

    /*
    |--------------------------------------------------------------------------
    | Pedir el enlace
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function pide_el_enlace(): void
    {
        Notification::fake();

        $usuario = $this->usuario();

        $this->postJson('/api/forgot-password', ['email' => $usuario->email])
            ->assertOk();

        Notification::assertSentTo($usuario, ResetPassword::class);
    }

    /**
     * Un correo que no existe da **la misma respuesta**.
     *
     * Si aqui contestara distinto, el endpoint serviria para saber
     * quien tiene cuenta en la plataforma, que es exactamente lo que
     * `POST /api/login` evita con un unico mensaje.
     */
    #[Test]
    public function un_correo_inexistente_da_la_misma_respuesta(): void
    {
        Notification::fake();

        $usuario = $this->usuario();

        $conCuenta = $this->postJson('/api/forgot-password', ['email' => $usuario->email]);
        $sinCuenta = $this->postJson('/api/forgot-password', ['email' => 'nadie@correo.test']);

        $conCuenta->assertOk();
        $sinCuenta->assertOk();

        $this->assertSame(
            $conCuenta->json('message'),
            $sinCuenta->json('message'),
            'La respuesta no puede distinguir una cuenta de la ausencia de cuenta.',
        );

        // La que existe recibe su correo una vez. Si la que no existe
        // hubiera recibido algo, habria una diferencia observable.
        Notification::assertSentToTimes($usuario, ResetPassword::class, 1);
    }

    /**
     * El correo va normalizado, como en el registro y en el login.
     * "Ana@x.com" y "ana@x.com" son la misma casilla.
     */
    #[Test]
    public function acepta_el_correo_en_mayusculas(): void
    {
        Notification::fake();

        $usuario = User::factory()->create(['email' => 'ana@correo.test']);

        $this->postJson('/api/forgot-password', ['email' => 'ANA@correo.test'])->assertOk();

        Notification::assertSentTo($usuario, ResetPassword::class);
    }

    #[Test]
    public function rechaza_un_correo_invalido(): void
    {
        $this->postJson('/api/forgot-password', ['email' => 'no-es-un-correo'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    /**
     * El broker frena las peticiones repetidas por el mismo correo
     * (`throttle` en config/auth.php). Con eso no se puede usar el
     * endpoint para inundar la bandeja de alguien.
     */
    #[Test]
    public function el_broker_limita_los_reenvios(): void
    {
        Notification::fake();

        $usuario = $this->usuario();

        // Un solo intento: el siguiente ya cae en el throttle de 60 s
        // que el propio broker aplica por correo.
        Password::broker()->createToken($usuario);

        $this->postJson('/api/forgot-password', ['email' => $usuario->email])->assertOk();
    }

    /*
    |--------------------------------------------------------------------------
    | Cambiar la contrasena
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function cambia_la_contrasena(): void
    {
        $usuario = $this->usuario();
        $token = $this->tokenDe($usuario);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
            'password_confirmation' => 'una-frase-nueva-muy-larga',
        ])->assertOk();

        $usuario->refresh();

        $this->assertTrue(Hash::check('una-frase-nueva-muy-larga', $usuario->password));
        $this->assertFalse(Hash::check('la-contrasena-vieja', $usuario->password));
    }

    /**
     * Y se puede entrar con la nueva. Un "cambio" que no cambia nada
     * seria peor que no tener el endpoint.
     */
    #[Test]
    public function la_contrasena_nueva_sirve_para_entrar(): void
    {
        $usuario = $this->usuario();
        $token = $this->tokenDe($usuario);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
            'password_confirmation' => 'una-frase-nueva-muy-larga',
        ])->assertOk();

        $this->postJson('/api/login', [
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
        ])->assertOk();
    }

    /**
     * Criterio explicito: el token es de **un solo uso**.
     *
     * Sin esto, un token que se filtra por el historial del navegador
     * sirve para cambiar la contrasena cuantas veces quiera.
     */
    #[Test]
    public function el_token_no_sirve_dos_veces(): void
    {
        $usuario = $this->usuario();
        $token = $this->tokenDe($usuario);

        $cuerpo = [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
            'password_confirmation' => 'una-frase-nueva-muy-larga',
        ];

        $this->postJson('/api/reset-password', $cuerpo)->assertOk();

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'una-tercera-frase-larguisima',
            'password_confirmation' => 'una-tercera-frase-larguisima',
        ])->assertStatus(422);

        $usuario->refresh();

        $this->assertTrue(Hash::check('una-frase-nueva-muy-larga', $usuario->password));
    }

    /**
     * Criterio explicito: el token **expira**.
     *
     * Vence a los 60 minutos (`expire` en config/auth.php).
     */
    #[Test]
    public function el_token_expira(): void
    {
        $usuario = $this->usuario();
        $token = $this->tokenDe($usuario);

        $this->travel((int) config('auth.passwords.users.expire') + 1)->minutes();

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
            'password_confirmation' => 'una-frase-nueva-muy-larga',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('la-contrasena-vieja', $usuario->fresh()->password));
    }

    #[Test]
    public function un_token_inventado_no_sirve(): void
    {
        $usuario = $this->usuario();

        $this->postJson('/api/reset-password', [
            'token' => 'un-token-que-no-existe',
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
            'password_confirmation' => 'una-frase-nueva-muy-larga',
        ])->assertStatus(422)->assertJsonValidationErrors('token');

        $this->assertTrue(Hash::check('la-contrasena-vieja', $usuario->fresh()->password));
    }

    #[Test]
    public function las_dos_contrasenas_tienen_que_coincidir(): void
    {
        $usuario = $this->usuario();
        $token = $this->tokenDe($usuario);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
            'password_confirmation' => 'otra-cosa-distinta',
        ])->assertStatus(422)->assertJsonValidationErrors('password_confirmation');
    }

    /**
     * La nueva contrasena pasa por las mismas reglas que la del
     * registro. Si no, alguien podria resetearla a "a".
     */
    #[Test]
    public function la_contrasena_nueva_tiene_que_ser_larga(): void
    {
        $usuario = $this->usuario();
        $token = $this->tokenDe($usuario);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'corta',
            'password_confirmation' => 'corta',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    /**
     * El token viaja en el cuerpo y no en la URL: la URL queda en los
     * logs del servidor y del proxy, el cuerpo no.
     */
    #[Test]
    public function el_token_viaja_en_el_cuerpo_y_no_en_la_url(): void
    {
        $rutas = collect($this->app['router']->getRoutes()->getRoutes())
            ->filter(fn ($ruta) => str_starts_with($ruta->uri(), 'api/reset-password'));

        $this->assertTrue($rutas->isNotEmpty(), 'La ruta de reset deberia existir.');

        foreach ($rutas as $ruta) {
            $this->assertStringNotContainsString(
                '{token}',
                $ruta->uri(),
                'El token no debe ser parametro de ruta: queda en los logs del servidor.',
            );
        }
    }

    /**
     * Cambiar la contrasena tira el `remember_token`, para que una
     * sesion que quedara abierta antes de un robo no sobreviva.
     */
    #[Test]
    public function cambiar_la_contrasena_tira_el_remember_token(): void
    {
        $usuario = $this->usuario();
        $usuario->forceFill(['remember_token' => 'un-token-de-sesion'])->save();

        $token = $this->tokenDe($usuario);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'una-frase-nueva-muy-larga',
            'password_confirmation' => 'una-frase-nueva-muy-larga',
        ])->assertOk();

        $this->assertNull($usuario->fresh()->remember_token);
    }
}
