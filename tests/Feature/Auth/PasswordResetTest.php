<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_password_link_screen_can_be_rendered(): void
    {
        $response = $this->get('/forgot-password');

        $response->assertStatus(200);
    }

    public function test_reset_password_link_can_be_requested(): void
    {
        Notification::fake();

        $user = User::factory()->create();

        $this->post('/forgot-password', ['email' => $user->email]);

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_reset_password_screen_can_be_rendered(): void
    {
        Notification::fake();

        $user = User::factory()->create();

        $this->post('/forgot-password', ['email' => $user->email]);

        Notification::assertSentTo($user, ResetPassword::class, function ($notification) {
            $response = $this->get('/reset-password/'.$notification->token);

            $response->assertStatus(200);

            return true;
        });
    }

    public function test_unknown_email_receives_the_same_reset_link_response_as_a_registered_email(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $registeredResponse = $this->from(route('password.request'))->post(route('password.email'), ['email' => $user->email]);
        $registeredResponse->assertRedirect(route('password.request'))->assertSessionHasNoErrors()
            ->assertSessionHas('status', 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.');

        $unknownResponse = $this->from(route('password.request'))->post(route('password.email'), ['email' => 'unknown@example.com']);

        $unknownResponse->assertRedirect(route('password.request'))->assertSessionHasNoErrors()
            ->assertSessionHas('status', 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.');
        Notification::assertSentToTimes($user, ResetPassword::class, 1);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'unknown@example.com']);
    }

    public function test_throttled_reset_link_requests_keep_the_same_public_response(): void
    {
        Notification::fake();
        $this->freezeTime();
        $user = User::factory()->create();
        $this->post(route('password.email'), ['email' => $user->email]);

        $response = $this->from(route('password.request'))->post(route('password.email'), ['email' => $user->email]);

        $response->assertRedirect(route('password.request'))->assertSessionHasNoErrors()
            ->assertSessionHas('status', 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.');
        Notification::assertSentToTimes($user, ResetPassword::class, 1);
    }

    public function test_password_can_be_reset_with_valid_token(): void
    {
        Notification::fake();

        $user = User::factory()->create();

        $this->post('/forgot-password', ['email' => $user->email]);

        Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
            $response = $this->post('/reset-password', [
                'token' => $notification->token,
                'email' => $user->email,
                'password' => 'password',
                'password_confirmation' => 'password',
            ]);

            $response
                ->assertSessionHasNoErrors()
                ->assertRedirect(route('login'));

            return true;
        });
    }
}
