<nav x-data="{ open: false }" class="border-b border-[#d9ddd6] bg-[#f7f7f3]">
    <div class="mx-auto max-w-7xl px-5 lg:px-8 lg:px-10">
        <div class="flex min-h-[4.5rem] justify-between gap-4">
            <div class="flex items-center">
                <a class="flex items-center gap-3" href="{{ route('listings.index') }}">
                    <img class="h-11 w-11 object-cover" src="{{ asset('images/roomsearch-logo.png') }}" alt="RoomSearch" />
                    <span class="text-sm font-bold tracking-[0.12em] text-[#18211f]">ROOMSEARCH</span>
                </a>

                <div class="ml-12 hidden gap-7 lg:flex">
                    <x-nav-link :href="route('listings.index')" :active="request()->routeIs('listings.*')">Explorar</x-nav-link>
                    @auth
                        <x-nav-link :href="route('listings.mine')" :active="request()->routeIs('listings.mine')">Mis anuncios</x-nav-link>
                        <x-nav-link :href="route('interests.index')" :active="request()->routeIs('interests.*')">Mis solicitudes</x-nav-link>
                    @endauth
                </div>
            </div>

            @auth
                <div class="hidden items-center lg:flex lg:ml-6">
                    <x-dropdown align="right" width="48">
                        <x-slot name="trigger">
                            <button class="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#45504c] transition hover:text-[#18211f] focus:outline-none">
                                <span>{{ Auth::user()->name }}</span>
                                <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        </x-slot>

                        <x-slot name="content">
                            <x-dropdown-link :href="route('profile.edit')">Perfil</x-dropdown-link>
                            <x-dropdown-link :href="route('roommate-profile.edit')">Mi perfil de roomie</x-dropdown-link>
                            <form method="POST" action="{{ route('logout') }}">
                                @csrf
                                <x-dropdown-link :href="route('logout')" onclick="event.preventDefault(); this.closest('form').submit();">Cerrar sesión</x-dropdown-link>
                            </form>
                        </x-slot>
                    </x-dropdown>
                </div>
            @else
                <div class="hidden items-center gap-5 lg:flex">
                    <a href="{{ route('login') }}" class="text-sm font-semibold text-[#45504c] hover:text-[#18211f]">Iniciar sesión</a>
                    <a href="{{ route('register') }}" class="bg-[#18211f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#32423d]">Crear cuenta</a>
                </div>
            @endauth

            <div class="-mr-2 flex items-center lg:hidden">
                <button @click="open = ! open" aria-label="Abrir menú" :aria-expanded="open.toString()" class="inline-flex items-center justify-center p-2 text-[#45504c] hover:text-[#18211f] focus:outline-none">
                    <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path :class="{'hidden': open, 'inline-flex': ! open }" class="inline-flex" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        <path :class="{'hidden': ! open, 'inline-flex': open }" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <div :class="{'block': open, 'hidden': ! open}" class="hidden border-t border-[#d9ddd6] px-5 py-3 lg:hidden">
        <div class="space-y-1">
            <x-responsive-nav-link :href="route('listings.index')" :active="request()->routeIs('listings.*')">Explorar</x-responsive-nav-link>
            @auth
                <x-responsive-nav-link :href="route('listings.mine')" :active="request()->routeIs('listings.mine')">Mis anuncios</x-responsive-nav-link>
                <x-responsive-nav-link :href="route('interests.index')" :active="request()->routeIs('interests.*')">Mis solicitudes</x-responsive-nav-link>
                <x-responsive-nav-link :href="route('listings.create')">Publicar anuncio</x-responsive-nav-link>
                <x-responsive-nav-link :href="route('roommate-profile.edit')">Mi perfil de roomie</x-responsive-nav-link>
                <x-responsive-nav-link :href="route('profile.edit')">Mi cuenta</x-responsive-nav-link>
                <form method="POST" action="{{ route('logout') }}">@csrf<button class="px-3 py-2 text-sm font-semibold">Cerrar sesión</button></form>
            @endauth
        </div>
        @guest
            <div class="mt-3 space-y-2 border-t border-[#d9ddd6] pt-3">
                <a href="{{ route('login') }}" class="block text-sm font-semibold text-[#45504c]">Iniciar sesión</a>
                <a href="{{ route('register') }}" class="block text-sm font-semibold text-[#18211f]">Crear cuenta</a>
            </div>
        @endguest
    </div>
</nav>
