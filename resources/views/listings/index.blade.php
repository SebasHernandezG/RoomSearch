<x-app-layout>
    <x-slot name="header">
        <span class="text-xs font-semibold uppercase tracking-[0.18em] text-[#69716d]">Comunidad y vivienda compartida</span>
    </x-slot>

    <section class="relative overflow-hidden bg-[#17231f] text-white">
        <div class="absolute inset-0 bg-cover bg-center opacity-30" style="background-image: url('https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&amp;fit=crop&amp;w=1800&amp;q=85');"></div>
        <div class="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#e7c96a]">Vive bien acompañado</p>
            <h1 class="mt-5 max-w-3xl font-['Libre_Caslon_Text'] text-4xl leading-tight sm:text-5xl lg:text-6xl">Encuentra un espacio y una convivencia que encajen contigo.</h1>
            <p class="mt-5 max-w-xl text-base leading-7 text-white/75">Busca habitaciónes, departamentos y personas con quienes compartir tu próximo hogar.</p>
        </div>
    </section>

    <div class="mx-auto max-w-7xl px-5 pb-14 sm:px-8 lg:px-10 lg:pb-20">
        <form class="relative z-10 -mt-8 grid gap-5 border border-[#d9ddd6] bg-[#f7f7f3] p-5 shadow-xl shadow-[#18211f]/10 md:grid-cols-[1fr_1fr_auto] md:items-end lg:p-7" method="GET">
            <div>
                <label class="text-xs font-semibold uppercase tracking-[0.14em] text-[#56615c]" for="city">Ubicación</label>
                <input id="city" name="city" value="{{ request('city') }}" placeholder="Ciudad o zona" class="mt-2 block w-full border-0 border-b border-[#b8c0b9] bg-transparent px-0 py-3 text-[#18211f] placeholder:text-[#7b827f] focus:border-[#8b6a16] focus:ring-0" />
            </div>
            <div>
                <label class="text-xs font-semibold uppercase tracking-[0.14em] text-[#56615c]" for="type">Tipo de anuncio</label>
                <select id="type" name="type" class="mt-2 block w-full border-0 border-b border-[#b8c0b9] bg-transparent px-0 py-3 text-[#18211f] focus:border-[#8b6a16] focus:ring-0">
                    <option value="">Ofrezco y busco</option>
                    <option value="offer" @selected(request('type') === 'offer')>Ofrezco habitación</option>
                    <option value="search" @selected(request('type') === 'search')>Busco habitación</option>
                </select>
            </div>
            <button class="bg-[#18211f] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#32423d]">Buscar espacios</button>
        </form>

        <div class="mt-14 grid gap-10 lg:grid-cols-[15rem_1fr]">
            <aside class="h-fit border-t border-[#b8c0b9] pt-5">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6a16]">Explora</p>
                <h2 class="mt-2 font-['Libre_Caslon_Text'] text-3xl text-[#18211f]">Encuentra tu lugar</h2>
                <div class="mt-7 space-y-6 text-sm leading-6 text-[#5a625f]">
                    <div>
                        <p class="font-semibold text-[#26312e]">Habitaciones disponibles</p>
                        <p class="mt-1">Espacios que alguien está ofreciendo para compartir.</p>
                    </div>
                    <div class="border-t border-[#d9ddd6] pt-5">
                        <p class="font-semibold text-[#26312e]">Personas buscando</p>
                        <p class="mt-1">Perfiles que buscan una nueva convivencia.</p>
                    </div>
                </div>
                @auth
                    <a href="{{ route('listings.create') }}" class="mt-8 inline-flex w-full items-center justify-center bg-[#8b6a16] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6b5111]">Publicar anuncio</a>
                @endauth
            </aside>

            <section>
                <div class="mb-7 flex items-end justify-between gap-4 border-b border-[#b8c0b9] pb-5">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6a16]">Resultados</p>
                        <h2 class="mt-2 font-['Libre_Caslon_Text'] text-3xl text-[#18211f]">Espacios para compartir</h2>
                    </div>
                    <span class="text-sm text-[#5a625f]">{{ $listings->total() }} anuncios</span>
                </div>

                <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    @forelse ($listings as $listing)
                        <a href="{{ route('listings.show', $listing) }}" class="group flex min-h-72 flex-col border border-[#d9ddd6] bg-white p-5 transition hover:-translate-y-1 hover:border-[#a5ada6] hover:shadow-lg hover:shadow-[#18211f]/10">
                            @if ($listing->photos)
                                <img class="mb-5 h-44 w-full object-cover" src="{{ Storage::disk('public')->url($listing->photos[0]) }}" alt="{{ $listing->title }}" loading="lazy" />
                            @else
                                <div class="mb-5 flex h-44 items-center justify-center bg-[#e8efe9] text-sm text-[#56615c]">{{ $listing->type === 'offer' ? 'Fotos por agregar' : 'Buscando un hogar' }}</div>
                            @endif
                            <div class="flex items-start justify-between gap-3">
                                <span class="{{ $listing->type === 'offer' ? 'bg-[#e8efe9]' : 'bg-[#f7efd7]' }} px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#45504c]">{{ $listing->type === 'offer' ? 'Ofrezco' : 'Busco' }}</span>
                                <span class="text-sm font-semibold text-[#26312e]">USD ${{ number_format($listing->budget) }} / mes</span>
                            </div>
                            <h3 class="mt-7 font-['Libre_Caslon_Text'] text-2xl leading-tight text-[#18211f] group-hover:text-[#8b6a16]">{{ $listing->title }}</h3>
                            <p class="mt-3 text-sm leading-6 text-[#69716d]">{{ \Illuminate\Support\Str::limit($listing->description, 100) }}</p>
                            <div class="mt-auto flex items-end justify-between gap-3 border-t border-[#e3e5e0] pt-4 text-xs leading-5 text-[#5a625f]">
                                <span>{{ $listing->city }}@if($listing->zone), {{ $listing->zone }}@endif</span>
                                <span class="text-right font-semibold text-[#45504c]">{{ $listing->user?->name ?? 'Comunidad RoomSearch' }}</span>
                            </div>
                        </a>
                    @empty
                        <div class="col-span-full border border-[#d9ddd6] bg-white p-8">
                            <h3 class="font-['Libre_Caslon_Text'] text-2xl text-[#18211f]">Aún no hay coincidencias</h3>
                            <p class="mt-2 text-sm leading-6 text-[#69716d]">Prueba otra ciudad o elimina los filtros para explorar todos los anuncios.</p>
                        </div>
                    @endforelse
                </div>

                <div class="mt-10">{{ $listings->links() }}</div>
            </section>
        </div>
    </div>
</x-app-layout>
