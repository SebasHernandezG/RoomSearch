<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Properties\Models\Property;

/**
 * Una publicacion, vista desde la cola de moderacion. RF-7.1.
 *
 * ## Por que no se reusa `PropertyResource`
 *
 * Porque el recurso publico y el de moderacion responden a preguntas
 * distintas y no se pueden mezclar:
 *
 * - El publico dice **que** se esta alquilando. No dice quien lo puso,
 *   y no deberia: el correo de un tercero en un anuncio publico es
 *   informacion que la persona confio a la plataforma, no al lector.
 * - El de moderacion dice **quien lo puso** y si su cuenta esta
 *   verificada. Sin eso no hay moderacion posible: un administrador
 *   aprueba y rechaza sin saber a quien esta, y a quien se le avisa si el anuncio es un fraude.
 *
 * Un recurso unico seria o bien una fuga de correos en el mapa, o
 * bien una cola donde no se sabe de quien es cada anuncio.
 *
 * @mixin Property
 */
class ModerationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Los datos del inmueble salen del recurso publico: no tiene
        // sentido reimplementarlos y que se wontonen.
        $publico = (new PropertyResource($this->resource))->toArray($request);

        return [
            ...$publico,

            'landlord' => $this->whenLoaded('dueno', fn (): array => [
                'id' => $this->dueno->getKey(),
                'name' => $this->dueno->name,
                'email' => $this->dueno->email,

                /*
                 * El correo verificado decide la confianza. Una
                 * cuenta sin confirmar puede publicar un anuncio de
                 * estafa y desaparecer, y sin este dato el
                 * administrador aprueba a ciegas.
                 */
                'email_verified' => $this->dueno->hasVerifiedEmail(),

                /*
                 * El historial es lo que separa una cuenta de una
                 * cuenta. "Tiene 12 anuncios, 11 aceptados" es
                 * informacion; "tiene 12 anuncios, 4 rechazados" es
                 * la misma cantidad con el signo cambiado.
                 */
                'published_count' => $this->dueno->publicaciones()->count(),
                'approved_count' => $this->dueno->publicaciones()
                    ->where('status', 'activa')
                    ->count(),

                /*
                 * La cuenta recibida. Es el dato mas util de la cola:
                 * una cuenta creada hace dos horas y con un solo
                 * anuncio es el perfil clasico de un fraude.
                 */
                'created_at' => $this->dueno->created_at?->toIso8601String(),
            ]),
        ];
    }
}
