<x-app-layout>
    <x-slot name="header"><a href="{{ route('listings.index') }}" class="roomie-label hover:underline">← Volver a explorar</a></x-slot>
    <div class="mx-auto max-w-6xl px-5 py-10">
        @if ($listing->photos)
            <div class="mb-8 grid gap-3 sm:grid-cols-2">
                @foreach ($listing->photos as $photo)
                    <a href="{{ Storage::disk('public')->url($photo) }}" target="_blank" rel="noopener"><img class="h-64 w-full object-cover sm:h-80" src="{{ Storage::disk('public')->url($photo) }}" alt="{{ $listing->title }} — foto {{ $loop->iteration }}" loading="{{ $loop->first ? 'eager' : 'lazy' }}" /></a>
                @endforeach
            </div>
        @endif
        <div class="grid gap-8 lg:grid-cols-[1fr_320px]">
            <article class="roomie-card min-w-0 break-words p-7">
                <p class="roomie-label">{{ $listing->type === 'offer' ? 'Ofrezco habitación' : 'Busco habitación' }} · {{ $listing->is_active ? 'Disponible' : 'Pausado' }}</p>
                <h1 class="roomie-title mt-5 text-4xl sm:text-5xl">{{ $listing->title }}</h1>
                <p class="mt-5 text-lg font-semibold">USD ${{ number_format($listing->budget) }} / mes</p>
                <p class="mt-2 text-[#56615c]">{{ $listing->city }}@if ($listing->zone), {{ $listing->zone }}@endif</p>
                <p class="mt-7 whitespace-pre-line leading-7">{{ $listing->description }}</p>
            </article>
            <aside class="roomie-card h-fit p-6">
                <p class="roomie-label">Publicado por</p><h2 class="roomie-title mt-2 text-2xl">{{ $listing->user?->name ?? 'Comunidad RoomSearch' }}</h2>
                <p class="mt-3 text-sm leading-6 text-[#56615c]">Un mensaje breve es un buen comienzo. Las respuestas aparecen en Mis solicitudes.</p>
                @auth
                    @if (auth()->id() === $listing->user_id)
                        <div class="mt-6 space-y-4">
                            <a class="roomie-button-alt w-full" href="{{ route('listings.edit', $listing) }}">Editar anuncio</a>
                            <a class="roomie-button w-full" href="{{ route('interests.index') }}">Ver solicitudes</a>
                            <form method="POST" action="{{ route('listings.destroy', $listing) }}" onsubmit="return confirm('¿Eliminar este anuncio y sus solicitudes? Esta acción no se puede deshacer.')">@csrf @method('DELETE')<button class="text-sm text-red-700 underline">Eliminar anuncio</button></form>
                        </div>
                    @elseif ($interest)
                        <p class="mt-6 text-sm font-semibold">Ya contactaste este anuncio.</p><a class="roomie-button mt-4 w-full" href="{{ route('interests.index') }}">Ver mi solicitud</a>
                    @else
                        <form method="POST" action="{{ route('listings.interests.store', $listing) }}" class="mt-6 space-y-3 border-t border-[#d9ddd6] pt-5">
                            @csrf<label class="roomie-label" for="message">Tu mensaje</label><textarea name="message" id="message" class="roomie-input" rows="4" maxlength="1000" required placeholder="Hola, me interesa tu anuncio...">{{ old('message') }}</textarea><x-input-error :messages="$errors->get('message')" /><button class="roomie-button w-full">Me interesa</button>
                        </form>
                    @endif
                @else
                    <a class="roomie-button mt-6 w-full" href="{{ route('login') }}">Inicia sesión para contactar</a>
                @endauth
            </aside>
        </div>
    </div>
</x-app-layout>
