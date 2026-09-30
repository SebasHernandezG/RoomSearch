<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GoogleAuthenticatedSessionController extends Controller
{
    private const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    public function redirect(Request $request): RedirectResponse
    {
        $state = Str::random(40);

        $request->session()->put('google_oauth_state', $state);

        return redirect()->away(self::AUTHORIZE_URL.'?'.http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
        ]));
    }

    public function callback(Request $request): RedirectResponse
    {
        $request->validate([
            'code' => ['required', 'string'],
            'state' => ['required', 'string'],
        ]);

        $expectedState = $request->session()->pull('google_oauth_state');

        if (! is_string($expectedState) || ! hash_equals($expectedState, $request->string('state')->toString())) {
            return redirect()->route('login')->withErrors([
                'google' => 'No se pudo validar el inicio de sesión con Google. Inténtalo de nuevo.',
            ]);
        }

        $tokenResponse = Http::asForm()->acceptJson()->post(self::TOKEN_URL, [
            'code' => $request->string('code')->toString(),
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => config('services.google.redirect'),
            'grant_type' => 'authorization_code',
        ]);

        $accessToken = $tokenResponse->json('access_token');

        if (! $tokenResponse->successful() || ! is_string($accessToken)) {
            return redirect()->route('login')->withErrors([
                'google' => 'No se pudo completar el inicio de sesión con Google. Inténtalo de nuevo.',
            ]);
        }

        $googleUserResponse = Http::acceptJson()
            ->withToken($accessToken)
            ->get(self::USER_INFO_URL);

        $email = $googleUserResponse->json('email');
        $name = $googleUserResponse->json('name');

        if (! $googleUserResponse->successful()
            || $googleUserResponse->json('email_verified') !== true
            || ! is_string($email)
            || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return redirect()->route('login')->withErrors([
                'google' => 'Google no pudo confirmar una dirección de correo válida.',
            ]);
        }

        $user = User::firstOrCreate(
            ['email' => Str::lower($email)],
            [
                'name' => is_string($name) ? $name : Str::before($email, '@'),
                'email_verified_at' => now(),
                'password' => Hash::make(Str::random(64)),
            ],
        );

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
