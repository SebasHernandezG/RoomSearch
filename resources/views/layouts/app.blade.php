<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>RoomSearch</title>
        <link rel="icon" href="{{ asset('images/roomsearch-logo.png') }}">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700&family=libre-caslon-text:400,700&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="font-sans text-[#18211f] antialiased">
        <div class="roomie-shell">
            @include('layouts.navigation')

            <!-- Page Heading -->
            @isset($header)
                <header class="border-b border-[#d9ddd6] bg-[#f7f7f3]">
                    <div class="mx-auto max-w-7xl px-5 py-5 sm:px-8 lg:px-10">
                        {{ $header }}
                    </div>
                </header>
            @endisset

            <!-- Page Content -->
            <main>
                @if (session('status') && ! in_array(session('status'), ['profile-updated', 'password-updated', 'verification-link-sent']))
                    <div role="status" class="mx-auto mt-6 max-w-5xl border border-[#b8c0b9] bg-[#e3ece6] p-4 text-sm">{{ session('status') }}</div>
                @endif
                @if ($errors->any())
                    <div role="alert" class="mx-auto mt-6 max-w-5xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        <p class="font-semibold">Revisa los siguientes datos:</p>
                        <ul class="mt-2 list-inside list-disc">@foreach ($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
                    </div>
                @endif
                {{ $slot }}
            </main>
        </div>
    </body>
</html>
