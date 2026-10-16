<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Properties\Models\Property;
use Modules\Properties\Models\PropertyImage;

/**
 * Representacion de un inmueble para la API.
 *
 * Toda la logica de privacidad del pin vive en
 * Modules\Properties\Support\PropertyLocation. Este Resource solo
 * formatea.
 *
 * @mixin Property
 */
class PropertyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // RF-2.5: si el arrendador no autoriza mostrar la ubicacion
        // exacta, aqui llega el punto desplazado.
        $punto = $this->resource->ubicacionPublica();

        $distancia = $this->resource->getAttribute('distance_meters');

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'type' => $this->type?->value,
            'status' => $this->status?->value,

            'monthly_rent' => $this->monthly_rent,
            'currency' => $this->currency?->value,
            'deposit' => $this->deposit,

            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'parking_spaces' => $this->parking_spaces,
            'furnished' => $this->furnished,
            'pets_allowed' => $this->pets_allowed,

            'includes_water' => $this->includes_water,
            'includes_electricity' => $this->includes_electricity,
            'includes_internet' => $this->includes_internet,

            'available_from' => $this->available_from?->toDateString(),
            'rules' => $this->rules,

            'district' => $this->district,
            'neighborhood' => $this->neighborhood,
            'address_reference' => $this->address_reference,

            'latitude' => $punto->latitud,
            'longitude' => $punto->longitud,
            'show_exact_location' => $this->show_exact_location,

            // Lo calcula la consulta de radio, no el modelo. Pasa por
            // distanciaRevelable() porque el dato crudo viene de la
            // posicion verdadera: darlo sin filtrar delata el pin.
            'distance_meters' => $punto->distanciaRevelable($distancia),

            /*
             * RF-2.3. La galeria llega vacia hasta que exista el
             * endpoint; mientras tanto el frontend la pinta como
             * placeholder.
             *
             * `url()` devuelve `null` cuando el archivo no esta, y la
             * foto se omite en vez de salir con una URL rota: el issue
             * de DS-12 pide "placeholder elegante, no imagen rota".
             */
            'images' => $this->resource->relationLoaded('imagenes')
                ? $this->resource->imagenes
                    ->map(fn (PropertyImage $imagen): ?array => $imagen->url() === null ? null : [
                        'id' => $imagen->id,
                        'url' => $imagen->url(),
                        'alt' => $imagen->alt,
                        'is_primary' => (bool) $imagen->is_primary,
                    ])
                    ->filter()
                    ->values()
                    ->all()
                : [],

            'landlord_verified' => false,
            'is_favorite' => false,

            /*
             * El contacto del dueno. RF-5.2.
             *
             * ## Por que va aqui y no se pide `/landlords/{id}`
             *
             * Porque el frontend **no sabe de quien es el inmueble**:
             * el Resource publico no lleva el id del dueno, y sin el
             * no hay forma de pedir el perfil. Y meter
             * `landlord_id` para obligar al navegador a hacer una
             * segunda peticion solo para eso es una ida y vuelta en
             * cada ficha, con un fallo mas que puede dejar la pantalla
             * a medias.
             *
             * ## Por que la privacidad se decide en el modelo
             *
             * No se reevalua aqui. `LandlordProfile` ya sabe si el
             * dueno marco el contacto privado y si su correo esta
             * confirmado, y esa regla es de negocio, no de formato.
             * Reimplementarla en cada Resource que imprima contacto es
             * como se acaba publicando un numero por privado.
             *
             * El guardia es `dueno`, no `dueno.perfilArrendador`:
             * `whenLoaded` mira `$this->relations`, y una relacion
             * anidada que se cargo con `load(['dueno.perfil'])` queda
             * registrada como `dueno` en el padre --no como
             * `dueno.perfil`-- asi que `whenLoaded('dueno.perfil')`
             * nunca encuentra nada y la clave sale siempre ausente.
             */
            'contacto' => $this->whenLoaded('dueno', fn (): array => [
                'phone' => $this->dueno?->perfilArrendador?->telefonoPublico(),
                'whatsapp' => $this->dueno?->perfilArrendador?->whatsappPublico(),
                'email_verified' => (bool) $this->dueno?->hasVerifiedEmail(),
            ]),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
