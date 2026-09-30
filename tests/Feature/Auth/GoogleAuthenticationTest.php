<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_google_login_redirects_to_google_with_a_state_value(): void
    {
        config()->set('services.google.client_id', 'google-client-id');
        config()->set('services.google.redirect', 'http://localhost:8000/auth/google/callback');

        $response = $this->get(route('google.redirect'));

        $response->assertRedirectContains('https://accounts.google.com/o/oauth2/v2/auth');
        $response->assertSessionHas('google_oauth_state');
    }

    public function test_google_callback_creates_and_authenticates_a_verified_google_user(): void
    {
        config()->set('services.google.client_id', 'google-client-id');
        config()->set('services.google.client_secret', 'google-client-secret');
        config()->set('services.google.redirect', 'http://localhost:8000/auth/google/callback');
        Http::preventStrayRequests();
        Http::fake([
            'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token']),
            'https://openidconnect.googleapis.com/v1/userinfo' => Http::response([
                'email' => 'roomie@example.com',
                'email_verified' => true,
                'name' => 'Roomie Example',
            ]),
        ]);

        $this->get(route('google.redirect'));
        $state = session('google_oauth_state');

        $response = $this->get(route('google.callback', [
            'code' => 'authorization-code',
            'state' => $state,
        ]));

        $user = User::where('email', 'roomie@example.com')->firstOrFail();

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->email_verified_at);
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_google_callback_rejects_an_unexpected_state_value(): void
    {
        $this->get(route('google.redirect'));

        $response = $this->get(route('google.callback', [
            'code' => 'authorization-code',
            'state' => 'unexpected-state',
        ]));

        $this->assertGuest();
        $response->assertRedirect(route('login', absolute: false));
        $response->assertSessionHasErrors('google');
    }
}
