<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Modules\Identity\Models\User;
use Modules\Identity\Notifications\VerifyEmailNotification;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Verificacion de correo. RF-1.3.
 *
 * El criterio que pesa aqui es el de enumeracion: ningun endpoint puede
 * decir si una casilla esta registrada.
 */
class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * El enlace tal como lo recibe la persona, con la firma incluida.
     *
     * @return array{id: int, url: string}
     */
    private function enlaceDe(User $usuario): array
    {
        $url = URL::temporarySignedRoute(
            'api.email.verify',
            now()->addMinutes((int) config('auth.verification.expire', 60)),
            [
                'id' => $usuario->getKey(),
                'hash' => sha1($usuario->getEmailForVerification()),
            ],
        );

        return [
            'id' => $usuario->getKey(),
            'url' => $url,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Al registrarse
    |--------------------------------------------------------------------------
    */

    /**
     * La notificacion del modulo, no la de Laravel: la de Laravel
     * habla ingles y no pasa por la cola.
     */
    #[Test]
    public function registrarse_manda_la_notificacion_del_modulo(): void
    {
        Notification::fake();

        $this->postJson('/api/register', [
            'name' => 'Ana',
            'email' => 'ana@correo.test',
            'password' => 'una-frase-larga',
        ])->assertOk();

        Notification::assertSentTo(
            User::where('email', 'ana@correo.test')->sole(),
            VerifyEmailNotification::class,
        );
    }

    /**
     * Y sale `false`: la cuenta nace sin verificar.
     */
    #[Test]
    public function una_cuenta_nace_sin_verificar(): void
    {
        Notification::fake();

        $respuesta = $this->postJson('/api/register', [
            'name' => 'Ana',
            'email' => 'ana@correo.test',
            'password' => 'una-frase-larga',
        ])->assertOk();

        $this->assertFalse($respuesta->json('user.email_verified'));
        $this->assertFalse(User::where('email', 'ana@correo.test')->sole()->hasVerifiedEmail());
    }

    /**
     * La notificacion va en la cola.
     *
     * Sin esto, un SMTP lento convierte el registro en una pantalla
     * colgada, y si el envio falla la cuenta se queda sin crear.
     */
    #[Test]
    public function la_notificacion_va_en_cola(): void
    {
        $this->assertInstanceOf(
            ShouldQueue::class,
            new VerifyEmailNotification,
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Verificar
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function el_enlace_confirma_el_correo(): void
    {
        $usuario = User::factory()->unverified()->create();

        $enlace = $this->enlaceDe($usuario);

        $this->getJson($enlace['url'])
            ->assertOk()
            ->assertJsonPath('user.email_verified', true);

        $this->assertTrue($usuario->fresh()->hasVerifiedEmail());
        $this->assertDatabaseHas('users', [
            'id' => $usuario->id,
        ]);
    }

    /**
     * El enlace sin firma no verifica a nadie.
     *
     * Sin esto, cualquiera podria confirmar el correo de otra persona
     * cambiando el id en la URL, y la verificacion --que es justamente
     * lo que impide el spam-- no valdria nada.
     */
    #[Test]
    public function un_enlace_sin_firma_no_verifica(): void
    {
        $usuario = User::factory()->unverified()->create();

        $this->getJson("/api/email/verify/{$usuario->id}/".sha1($usuario->email))
            ->assertForbidden();

        $this->assertFalse($usuario->fresh()->hasVerifiedEmail());
    }

    /**
     * Con firma pero con el hash de otro correo tampoco.
     *
     * El hash es `sha1(correo)`, y cambia cuando alguien cambia su
     * direccion. Sin compararlo, cambiarse el correo dejaria confirmado
     * el anterior.
     */
    #[Test]
    public function un_hash_que_no_corresponde_no_verifica(): void
    {
        $usuario = User::factory()->unverified()->create();

        $enlace = $this->enlaceDe($usuario);

        $otro = str_replace(
            sha1($usuario->getEmailForVerification()),
            sha1('otra@persona.test'),
            $enlace['url'],
        );

        $this->getJson($otro)->assertForbidden();

        $this->assertFalse($usuario->fresh()->hasVerifiedEmail());
    }

    /**
     * Un id que no existe no verifica a nadie, y tampoco revienta.
     *
     * La firma es valida --la genera el propio Laravel-- lo unico que
     * cambia es que no hay quien verificar.
     */
    #[Test]
    public function un_id_inexistente_no_verifica(): void
    {
        $url = URL::temporarySignedRoute(
            'api.email.verify',
            now()->addHour(),
            ['id' => 999999, 'hash' => sha1('nadie@correo.test')],
        );

        $this->getJson($url)->assertForbidden();
    }

    /**
     * Verificar dos veces no es un error.
     *
     * La persona que reabrio el correo no hizo nada malo, y un error
     * la deja pensando que su cuenta esta danada.
     */
    #[Test]
    public function verificar_dos_veces_no_falla(): void
    {
        $usuario = User::factory()->unverified()->create();

        $enlace = $this->enlaceDe($usuario);

        $this->getJson($enlace['url'])->assertOk();

        $this->getJson($enlace['url'])
            ->assertOk()
            ->assertJsonPath('message', trans('auth.yaVerificado'));
    }

    /*
    |--------------------------------------------------------------------------
    | Reenviar
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function se_puede_pedir_un_reenvio_con_sesion(): void
    {
        Notification::fake();

        $usuario = User::factory()->unverified()->create();

        $this->actingAs($usuario, 'sanctum')
            ->postJson('/api/email/verification-notification')
            ->assertOk();

        Notification::assertSentTo($usuario, VerifyEmailNotification::class);
    }

    /**
     * Sin sesion no se pide. Sin token no se sabe a quien mandarlo.
     */
    #[Test]
    public function sin_sesion_no_se_pide_reenvio(): void
    {
        $this->postJson('/api/email/verification-notification')
            ->assertUnauthorized();
    }

    /**
     * Una cuenta ya verificada no recibe nada.
     *
     * Si lo recibiera, reenviar seria una forma de bombardear una
     * casilla ajena con correos de la plataforma.
     */
    #[Test]
    public function una_cuenta_verificada_no_recibe_nada(): void
    {
        Notification::fake();

        $usuario = User::factory()->create();

        $this->actingAs($usuario, 'sanctum')
            ->postJson('/api/email/verification-notification')
            ->assertOk();

        Notification::assertNothingSent();
    }

    /**
     * Sin limite, esto es un canon de correo. RNF-05.
     */
    #[Test]
    public function los_reenvios_estan_limitados(): void
    {
        Notification::fake();

        $usuario = User::factory()->unverified()->create();

        $this->actingAs($usuario, 'sanctum');

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/email/verification-notification')->assertOk();
        }

        $this->postJson('/api/email/verification-notification')
            ->assertStatus(429);
    }

    /**
     * El limite es por cuenta, no global: que uno se quede sin margen
     * no puede frenar a los demas.
     */
    #[Test]
    public function el_limite_es_por_cuenta(): void
    {
        Notification::fake();

        $primero = User::factory()->unverified()->create();
        $segundo = User::factory()->unverified()->create();

        $this->actingAs($primero, 'sanctum');

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/email/verification-notification')->assertOk();
        }

        $this->postJson('/api/email/verification-notification')->assertStatus(429);

        $this->actingAs($segundo, 'sanctum')
            ->postJson('/api/email/verification-notification')
            ->assertOk();
    }
}
