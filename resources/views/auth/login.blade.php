<x-guest-layout>
    <div class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6a16]">Bienvenido de vuelta</p>
        <h2 class="font-['Libre_Caslon_Text'] text-4xl leading-none text-[#18211f]">Inicia sesión</h2>
        <p class="text-sm leading-6 text-[#5a625f]">Accede a tus espacios, conversaciones y conexiones.</p>
    </div>

    <x-auth-session-status class="mb-4" :status="session('status')" />

    <a class="mt-8 inline-flex w-full items-center justify-center gap-3 border border-[#c8cbc5] bg-white px-4 py-3.5 text-sm font-semibold text-[#26312e] transition hover:border-[#78817d] hover:bg-[#f3f4f0] focus:outline-none focus:ring-2 focus:ring-[#8b6a16] focus:ring-offset-2" href="{{ route('google.redirect') }}">
        <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.35 12.18c0-.72-.06-1.41-.18-2.07H12v3.92h5.24a4.48 4.48 0 0 1-1.94 2.94v2.54h3.15c1.84-1.7 2.9-4.2 2.9-7.33Z"/>
            <path fill="#34A853" d="M12 21.7c2.63 0 4.83-.87 6.45-2.35l-3.15-2.54c-.87.58-1.99.92-3.3.92-2.53 0-4.68-1.71-5.45-4.02H3.3v2.62A9.74 9.74 0 0 0 12 21.7Z"/>
            <path fill="#FBBC05" d="M6.55 13.71a5.86 5.86 0 0 1 0-3.42V7.67H3.3a9.72 9.72 0 0 0 0 8.66l3.25-2.62Z"/>
            <path fill="#EA4335" d="M12 6.27c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.36 14.63 2.3 12 2.3A9.74 9.74 0 0 0 3.3 7.67l3.25 2.62C7.32 7.98 9.47 6.27 12 6.27Z"/>
        </svg>
        Continuar con Google
    </a>

    @if ($errors->has('google'))
        <p class="mt-3 text-sm text-red-700">{{ $errors->first('google') }}</p>
    @endif

    <div class="my-8 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b827f]">
        <span class="h-px flex-1 bg-[#d7d9d4]"></span>
        o con correo
        <span class="h-px flex-1 bg-[#d7d9d4]"></span>
    </div>

    <form class="space-y-6" method="POST" action="{{ route('login') }}">
        @csrf

        <!-- Email Address -->
        <div>
            <x-input-label class="font-semibold text-[#3d4743]" for="email" :value="__('Correo electrónico')" />
            <x-text-input id="email" class="mt-2 block w-full border-0 border-b border-[#aeb5ae] bg-transparent px-0 py-3 shadow-none focus:border-[#8b6a16] focus:ring-0" type="email" name="email" :value="old('email')" required autofocus autocomplete="username" />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <!-- Password -->
        <div>
            <div class="flex items-center justify-between gap-4">
                <x-input-label class="font-semibold text-[#3d4743]" for="password" :value="__('Contraseña')" />

                @if (Route::has('password.request'))
                    <a class="text-xs font-semibold text-[#69716d] hover:text-[#8b6a16] focus:outline-none focus:ring-2 focus:ring-[#8b6a16] focus:ring-offset-2" href="{{ route('password.request') }}">
                        Olvidé mi contraseña
                    </a>
                @endif
            </div>

            <x-text-input id="password" class="mt-2 block w-full border-0 border-b border-[#aeb5ae] bg-transparent px-0 py-3 shadow-none focus:border-[#8b6a16] focus:ring-0"
                            type="password"
                            name="password"
                            required autocomplete="current-password" />

            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Remember Me -->
        <div class="flex items-center">
            <label for="remember_me" class="inline-flex items-center">
                <input id="remember_me" type="checkbox" class="rounded border-[#aeb5ae] text-[#8b6a16] shadow-sm focus:ring-[#8b6a16]" name="remember">
                <span class="ms-2 text-sm text-[#5a625f]">{{ __('Recordarme') }}</span>
            </label>
        </div>

        <x-primary-button class="w-full justify-center bg-[#18211f] px-4 py-3.5 text-sm tracking-[0.08em] shadow-none transition hover:bg-[#32423d] focus:bg-[#32423d] active:bg-[#101614]">
            Iniciar sesión
        </x-primary-button>
    </form>

    <p class="mt-8 text-center text-sm text-[#5a625f]">
        ¿No tienes una cuenta?
        <a class="font-semibold text-[#8b6a16] hover:text-[#604912]" href="{{ route('register') }}">Crea una cuenta</a>
    </p>
</x-guest-layout>
