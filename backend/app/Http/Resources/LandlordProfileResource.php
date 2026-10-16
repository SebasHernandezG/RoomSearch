<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Identity\Models\LandlordProfile;

/**
 * El perfil publico de un arrendador. RF-1.5.
 *
 * ## El telefono no sale si el dueno no lo expone
 *
 * Es lo unico de este Resource que hay que mirar dos veces. El
 * criterio del issue es literal: "el telefono no se expone si el
 * arrendador lo marca privado". Y hay una tercera condicion que el
 * issue no menciona y que si importa: la cuenta tiene que tener el
 * correo confirmado. Un contacto publicado de una cuenta sin confirmar
 * es un dato de alguien a quien no se le puede reclamar.
 *
 * `LandlordProfile::telefonoPublico()` decide las tres. Aqui no se
 * decide nada: se llama y se escribe lo que devuelva.
 *
 * @mixin LandlordProfile
 */
class LandlordProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $dueno = $this->resource->user;

        $telefono = $this->resource->telefonoPublico();

        return [
            'user_id' => $this->resource->user_id,

            'name' => $dueno?->name,

            'email_verified' => $dueno !== null && $dueno->hasVerifiedEmail(),

            /*
             * `null` cuando no se puede mostrar. Nunca el numero
             * "oculto" ni una cadena vacia: el frontend tiene que poder
             * distinguir "no hay telefono" de "no se puede ver".
             */
            'phone' => $telefono,

            /*
             * Si se puede o no, independiente del valor.
             *
             * Con esto el frontend puede decir "el dueno dejo su
             * telefono privado" en vez de no mostrar nada, que es lo
             * que hace que un anuncio parezca de alguien que no
             * contestara el telefono.
             */
            'phone_public' => $telefono !== null,

            'photo_url' => $this->resource->fotoUrl(),

            'bio' => $this->resource->bio,

            'years_experience' => $this->resource->years_experience,

            /*
             * Solo para quien edita su propio perfil.
             *
             * `is_mine` es lo que permite que la pantalla de edicion
             * muestre el interruptor de privacidad sin que el
             * frontend tenga que adivinar con una peticion aparte.
             */
            'is_mine' => $request->user()?->getKey() === $this->resource->user_id,
        ];
    }
}
