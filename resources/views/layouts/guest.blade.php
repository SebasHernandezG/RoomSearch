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
        <div class="min-h-screen bg-[#e8e9e5] px-4 py-4 sm:px-8 sm:py-8 lg:flex lg:items-center lg:justify-center">
            <main class="grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden bg-[#f8f8f5] shadow-2xl shadow-black/15 sm:min-h-[calc(100vh-4rem)] lg:min-h-[42rem] lg:grid-cols-[1.08fr_0.92fr]">
                <section class="relative flex min-h-72 flex-col justify-between overflow-hidden bg-[#17231f] px-6 py-7 text-white sm:min-h-80 sm:px-10 sm:py-9 lg:min-h-0 lg:px-12 lg:py-11">
                    <div class="absolute inset-0 bg-cover bg-center opacity-75" style="background-image: url('https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&amp;fit=crop&amp;w=1400&amp;q=85');"></div>
                    <div class="absolute inset-0 bg-[#10201b]/50"></div>

                    <a class="relative text-lg font-bold tracking-[0.08em]" href="{{ route('listings.index') }}">ROOMSEARCH<span class="text-[#e7b54b]">.</span></a>

                    <div class="relative max-w-md">
                        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cf76]">Encuentra donde encajar</p>
                        <h1 class="mt-4 font-['Libre_Caslon_Text'] text-4xl leading-tight sm:text-5xl">Un hogar se comparte mejor con la persona adecuada.</h1>
                        <p class="mt-5 max-w-sm text-sm leading-6 text-white/80 sm:text-base">Explora espacios y conecta con personas que buscan una convivencia compatible contigo.</p>
                    </div>

                    <p class="relative text-xs font-medium uppercase tracking-[0.16em] text-white/70">RoomSearch - Costa Rica</p>
                </section>

                <section class="flex px-6 py-10 sm:px-12 sm:py-12 lg:items-center lg:px-14">
                    <div class="mx-auto w-full max-w-sm">
                        <a class="text-base font-bold tracking-[0.08em] text-[#18211f] lg:hidden" href="{{ route('listings.index') }}">ROOMSEARCH<span class="text-[#be3f3c]">.</span></a>

                        <div class="mt-10 lg:mt-0">
                            {{ $slot }}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    </body>
</html>
