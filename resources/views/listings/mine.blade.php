<x-app-layout>
    <x-slot name="header"><h1 class="roomie-title text-3xl">Mis anuncios</h1></x-slot>
    <div class="mx-auto max-w-5xl space-y-6 px-5 py-10">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <p class="text-[#56615c]">Administra tus espacios y conoce a las personas interesadas.</p>
            <a class="roomie-button" href="{{ route('listings.create') }}">Publicar anuncio</a>
        </div>
        @forelse ($listings as $listing)
            <article class="roomie-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                @if ($listing->photos)
                    <img class="h-40 w-full object-cover sm:h-24 sm:w-32" src="{{ Storage::disk('public')->url($listing->photos[0]) }}" alt="{{ $listing->title }}" loading="lazy" />
                @endif
                <div class="min-w-0 flex-1">
                    <p class="roomie-label">{{ $listing->is_active ? 'Publicado' : 'Pausado' }} · {{ $listing->interests_count }} solicitudes</p>
                    <h2 class="roomie-title mt-2 break-words text-2xl"><a href="{{ route('listings.show', $listing) }}">{{ $listing->title }}</a></h2>
                    <p class="mt-2 text-sm text-[#56615c]">{{ $listing->city }} · USD ${{ number_format($listing->budget) }} / mes</p>
                </div>
                <a class="roomie-button-alt" href="{{ route('listings.edit', $listing) }}">Administrar</a>
            </article>
        @empty
            <div class="roomie-card p-8"><h2 class="roomie-title text-2xl">Tu próximo hogar empieza aquí</h2><p class="mt-3">Publica un espacio disponible o cuenta qué habitación buscas.</p></div>
        @endforelse
        {{ $listings->links() }}
    </div>
</x-app-layout>
