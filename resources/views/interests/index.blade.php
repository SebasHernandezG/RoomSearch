<x-app-layout>
    <x-slot name="header"><h1 class="roomie-title text-3xl">Mis solicitudes</h1></x-slot>
    <div class="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-2">
        <section class="min-w-0 space-y-5">
            <div><p class="roomie-label">Tus publicaciones</p><h2 class="roomie-title mt-2 text-3xl">Recibidas</h2><p class="mt-3 text-sm text-[#56615c]">Solo tú y la persona interesada pueden leer estos mensajes.</p></div>
            @forelse ($received as $interest)
                <article class="roomie-card break-words p-6">
                    <a class="roomie-label underline" href="{{ route('listings.show', $interest->listing) }}">{{ $interest->listing->title }}</a>
                    <h3 class="mt-3 font-semibold">{{ $interest->user->name }}</h3>
                    <p class="mt-1 text-xs text-[#56615c]">{{ $interest->created_at->format('d/m/Y H:i') }}</p>
                    <p class="mt-4 whitespace-pre-line">{{ $interest->message ?: 'Me interesa este anuncio.' }}</p>
                    @if ($interest->reply)
                        <div class="mt-5 border-l-2 border-[#8b6a16] pl-4"><p class="roomie-label">Tu respuesta</p><p class="mt-2 whitespace-pre-line">{{ $interest->reply }}</p></div>
                    @endif
                    <form class="mt-6 space-y-3" method="POST" action="{{ route('interests.update', $interest) }}">
                        @csrf @method('PUT')
                        <input type="hidden" name="interest_id" value="{{ $interest->id }}" />
                        <label class="roomie-label" for="reply-{{ $interest->id }}">{{ $interest->reply ? 'Actualizar respuesta' : 'Responder' }}</label>
                        <textarea class="roomie-input" id="reply-{{ $interest->id }}" name="reply" rows="3" maxlength="2000" required>{{ old('interest_id') == $interest->id ? old('reply', $interest->reply) : $interest->reply }}</textarea>
                        <button class="roomie-button">Guardar respuesta</button>
                    </form>
                </article>
            @empty
                <p class="roomie-card p-6 text-[#56615c]">Todavía no tienes solicitudes. Cuando alguien contacte uno de tus anuncios, aparecerá aquí.</p>
            @endforelse
            {{ $received->links() }}
        </section>
        <section class="min-w-0 space-y-5">
            <div><p class="roomie-label">Tu búsqueda</p><h2 class="roomie-title mt-2 text-3xl">Enviadas</h2><p class="mt-3 text-sm text-[#56615c]">Consulta aquí las respuestas a los espacios que te interesan.</p></div>
            @forelse ($sent as $interest)
                <article class="roomie-card break-words p-6">
                    <p class="roomie-label">{{ $interest->reply ? 'Respondida' : 'Esperando respuesta' }}{{ ! $interest->listing->is_active ? ' · Anuncio pausado' : '' }}</p>
                    <h3 class="roomie-title mt-3 text-2xl">@if ($interest->listing->is_active)<a href="{{ route('listings.show', $interest->listing) }}">{{ $interest->listing->title }}</a>@else {{ $interest->listing->title }} @endif</h3>
                    <p class="mt-2 text-sm text-[#56615c]">{{ $interest->listing->user->name }}</p>
                    <p class="mt-4 whitespace-pre-line">{{ $interest->message ?: 'Me interesa este anuncio.' }}</p>
                    @if ($interest->reply)
                        <div class="mt-5 border-l-2 border-[#8b6a16] pl-4"><p class="roomie-label">Respuesta · {{ $interest->replied_at->format('d/m/Y') }}</p><p class="mt-2 whitespace-pre-line">{{ $interest->reply }}</p></div>
                    @endif
                </article>
            @empty
                <div class="roomie-card p-6"><p class="text-[#56615c]">Aún no has contactado ningún anuncio.</p><a class="roomie-button mt-5" href="{{ route('listings.index') }}">Explorar espacios</a></div>
            @endforelse
            {{ $sent->links() }}
        </section>
    </div>
</x-app-layout>
