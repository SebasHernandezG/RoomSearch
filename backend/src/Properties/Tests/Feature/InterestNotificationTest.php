<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use App\Notifications\InterestRepliedNotification;
use App\Notifications\NewInterestNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Modules\Identity\Models\NotificationPreference;
use Modules\Identity\Models\User;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Notificaciones de "Me interesa" por correo. RF-5.4.
 *
 * Las notificaciones van en la cola (ShouldQueue), asi que las pruebas
 * las interceptan con Notification::fake() y verifican que se
 * dispararon con los datos correctos.
 */
class InterestNotificationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function el_arrendador_recibe_notificacion_de_solicitud_nueva(): void
    {
        Notification::fake();

        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);
        $inquilino = $this->inquilino();

        $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertCreated();

        Notification::assertSentTo(
            $dueno,
            NewInterestNotification::class,
            function ($notificacion) use ($inmueble, $inquilino): bool {
                return $notificacion->inmueble->getKey() === $inmueble->getKey()
                    && $notificacion->interes->interesado->getKey() === $inquilino->getKey();
            },
        );
    }

    #[Test]
    public function el_inquilino_recibe_notificacion_de_respuesta(): void
    {
        Notification::fake();

        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);
        $inquilino = $this->inquilino();

        $solicitud = $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertCreated()->json('data.id');

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud}", [
            'reply' => 'Sí, sigue disponible. Escribeme para coordinar una visita.',
            'status' => 'respondida',
        ])->assertSuccessful();

        Notification::assertSentTo(
            $inquilino,
            InterestRepliedNotification::class,
            function ($notificacion) use ($solicitud): bool {
                return $notificacion->interes->getKey() === $solicitud;
            },
        );
    }

    #[Test]
    public function si_el_arrendador_dio_de_baja_no_recibe_notificacion(): void
    {
        Notification::fake();

        $dueno = $this->dueno();
        NotificationPreference::create([
            'user_id' => $dueno->getKey(),
            'interest_new' => false,
        ]);

        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);
        $inquilino = $this->inquilino();

        $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertCreated();

        Notification::assertNotSentTo($dueno, NewInterestNotification::class);
    }

    #[Test]
    public function si_el_inquilino_dio_de_baja_no_recibe_notificacion_de_respuesta(): void
    {
        Notification::fake();

        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);
        $inquilino = $this->inquilino();
        NotificationPreference::create([
            'user_id' => $inquilino->getKey(),
            'interest_reply' => false,
        ]);

        $solicitud = $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertCreated()->json('data.id');

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud}", [
            'reply' => 'Sí, sigue disponible.',
            'status' => 'respondida',
        ])->assertSuccessful();

        Notification::assertNotSentTo($inquilino, InterestRepliedNotification::class);
    }

    #[Test]
    public function usuario_sin_preferencias_recibe_notificaciones_por_defecto(): void
    {
        Notification::fake();

        $dueno = $this->dueno();
        // No se crea NotificationPreference: default es recibir todo.

        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);
        $inquilino = $this->inquilino();

        $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertCreated();

        Notification::assertSentTo($dueno, NewInterestNotification::class);
    }

    #[Test]
    public function el_enlace_de_baja_desactiva_preferencia_de_interes_nuevo(): void
    {
        $dueno = $this->dueno();
        NotificationPreference::create([
            'user_id' => $dueno->getKey(),
            'interest_new' => true,
        ]);

        $token = hash_hmac('sha256', "{$dueno->getKey()}|interest_new|".config('app.key'), config('app.key'));

        $respuesta = $this->getJson(
            '/api/notifications/unsubscribe?user='.$dueno->getKey().'&type=interest_new&token='.urlencode($token)
        );

        $respuesta->assertSuccessful();

        $this->assertSame(
            0,
            NotificationPreference::where('user_id', $dueno->getKey())->value('interest_new'),
            'La preferencia interest_new deberia estar en 0 despues del unsubscribe.',
        );
    }

    #[Test]
    public function el_enlace_de_baja_con_token_invalido_no_desactiva_nada(): void
    {
        $dueno = $this->dueno();
        NotificationPreference::create([
            'user_id' => $dueno->getKey(),
            'interest_new' => true,
        ]);

        $this->getJson(
            '/api/notifications/unsubscribe?user='.$dueno->getKey().'&type=interest_new&token=token-invalido'
        )->assertSuccessful();

        $this->assertSame(
            1,
            NotificationPreference::where('user_id', $dueno->getKey())->value('interest_new'),
            'Con token invalido la preferencia no deberia cambiar.',
        );
    }

    #[Test]
    public function el_enlace_de_baja_responde_200_incluso_con_usuario_inexistente(): void
    {
        $this->getJson(
            '/api/notifications/unsubscribe?user=99999&type=interest_new&token=cualquier-token'
        )->assertSuccessful();
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
