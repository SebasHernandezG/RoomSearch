<div><label class="roomie-label" for="type">Tipo de anuncio</label><select id="type" name="type" class="roomie-input"><option value="offer" @selected(old('type', $listing->type ?? '') === 'offer')>Ofrezco habitación</option><option value="search" @selected(old('type', $listing->type ?? '') === 'search')>Busco habitación</option></select></div>
<div><label class="roomie-label" for="title">Título</label><input id="title" name="title" class="roomie-input" value="{{ old('title', $listing->title ?? '') }}" maxlength="120" required /></div>
<div><label class="roomie-label" for="description">Descripción</label><textarea id="description" name="description" class="roomie-input" rows="5" maxlength="2000" placeholder="Describe el espacio, los servicios incluidos y cómo es la convivencia." required>{{ old('description', $listing->description ?? '') }}</textarea></div>
<div class="grid gap-4 sm:grid-cols-2">
    <div><label class="roomie-label" for="city">Ciudad</label><input id="city" name="city" class="roomie-input" value="{{ old('city', $listing->city ?? '') }}" maxlength="100" required /></div>
    <div><label class="roomie-label" for="zone">Zona</label><input id="zone" name="zone" class="roomie-input" value="{{ old('zone', $listing->zone ?? '') }}" maxlength="100" /></div>
</div>
<div><label class="roomie-label" for="budget">Presupuesto mensual (USD)</label><input id="budget" name="budget" type="number" min="1" max="10000000" class="roomie-input" value="{{ old('budget', $listing->budget ?? '') }}" required /></div>
<div>
    <label class="roomie-label" for="photos">Fotos del espacio</label>
    <input id="photos" name="photos[]" type="file" accept="image/jpeg,image/png,image/webp" multiple class="roomie-input" aria-describedby="photos-help" />
    <p id="photos-help" class="mt-2 text-sm text-[#56615c]">Hasta 6 fotos JPG, PNG o WebP, de máximo 1 MB cada una. Al subir fotos nuevas se reemplaza la galería actual.</p>
    @if (isset($listing) && $listing->photos)
        <div class="mt-4 grid grid-cols-3 gap-2">@foreach ($listing->photos as $photo)<img class="h-24 w-full object-cover" src="{{ Storage::disk('public')->url($photo) }}" alt="Foto actual {{ $loop->iteration }}" />@endforeach</div>
        <label class="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="remove_photos" value="1" @checked(old('remove_photos')) /> Quitar las fotos actuales</label>
    @endif
</div>
@if (isset($listing))
    <div><label class="roomie-label" for="is_active">Visibilidad</label><select class="roomie-input" name="is_active" id="is_active"><option value="1" @selected(old('is_active', $listing->is_active) == 1)>Publicado: visible en las búsquedas</option><option value="0" @selected(old('is_active', $listing->is_active) == 0)>Pausado: oculto, conserva tus solicitudes</option></select></div>
@endif
<input type="hidden" name="contact_method" value="interest" />
