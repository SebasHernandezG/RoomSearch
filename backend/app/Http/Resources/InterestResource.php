<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Properties\Models\Interest;

/**
 * Una solicitud de "Me interesa". RF-5.1.
 *
 * ## La misma clase para las dos puntas, con una bandera
 *
 * El que manda la solicitud y el que la recibe ven cosas distintas de
 * la misma fila, y una clase por vista obliga a duplicar la fila
 * entera:
 *
 * - El **interesado** no necesita el nombre del dueno --ya lo tiene en
 *   la ficha--, pero si el estado del inmueble y la ubicacion exacta.
 * - El **dueno** necesita el nombre del interesado, que sin eso no
 *   puede ni contestar "hola, soy Ana".
 *
 * La bandera la pone `InterestForDuenoResource`, que es esta clase con
 * `paraDueno = true`.
 *
 * ## Por que no se pasa por `additional()`
 *
 * Porque `ResourceCollection::additional()` se mezcla en la **respuesta
 * completa**, no en cada `toArray()`. Un `$this->additional['para_dueno']`
 * dentro del recurso lee el `additional` de la instancia, que sigue
 * vacio, y el resultado es que la bandeja devuelve `interesado: null`
 * sin ningun error: el dato simplemente no viaja.
 *
 * @see InterestForDuenoResource
 *
 * @mixin Interest
 */
class InterestResource extends JsonResource
{
    /**
     * Si lo que se va a ver es la vista del dueno.
     *
     * La question es "esto lo mira el dueno", no "esto lo puede ver el
     * dueno": el unico filtro real --que solo el dueno de ese inmueble
     * pueda ver la fila-- vive en la consulta y en `InterestPolicy`.
     */
    protected bool $paraDueno = false;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $inmueble = $this->resource->inmueble;

        return [
            'id' => $this->id,
            'status' => $this->status->value,

            'message' => $this->message,

            /*
             * La respuesta la ven las dos puntas: el interesado es
             * quien vino a buscarla, y el dueno necesita saber que ya
             * contesto. No hay nada que ocultar entre ellas.
             */
            'reply' => $this->reply,
            'replied_at' => $this->replied_at?->toIso8601String(),

            /*
             * Si el dueno no lo ha mirado.
             *
             * Va aparte del `status` porque el boton de la ficha
             * depende de esto y no del texto: una solicitud ya
             * respondida se muestra como "Anotado", no como "Me
             * interesa".
             */
            'unread' => $this->status->isUnread(),

            'created_at' => $this->created_at?->toIso8601String(),

            /*
             * El inmueble, minimo.
             *
             * Sin esto la bandeja es una lista de textos sueltos y no
             * hay forma de saber a que anuncio corresponde cada uno.
             */
            'inmueble' => $inmueble === null ? null : [
                'id' => $inmueble->getKey(),
                'title' => $inmueble->title,
                'district' => $inmueble->district,

                /*
                 * La foto principal, y solo la principal.
                 *
                 * La bandeja muestra una miniatura por solicitud: ocho
                 * fotos por fila serian ruido, y cargar la galeria
                 * entera de cada anuncio para pintar un cuadrado de
                 * 40 px es ancho de banda tirado.
                 */
                'foto' => $inmueble->relationLoaded('imagenes')
                    ? $inmueble->imagenes->firstWhere('is_primary', true)?->url()
                        ?? $inmueble->imagenes->first()?->url()
                    : null,

                /*
                 * Lo unico que el interesado **no** puede ver todavia.
                 *
                 * RF-2.5: "el radio real solo se revela al inquilino
                 * tras Me interesa". Y este es el momento exacto en
                 * que se revela: escribir es la puerta, y el dueno la
                 * abrio --tiene una bandeja con el nombre de quien
                 * escribe-- asi que ya sabe a quien le dijo que si.
                 *
                 * Solo se calcula para el interesado, y por
                 * rendimiento: `latitude()` y `longitude()` son
                 * **metodos que lanzan una consulta cada uno** --leen
                 * de la columna POINT-- no atributos de la fila ya
                 * cargada. En la bandeja del dueno serian 48
                 * consultas para pintar algo que ya tiene en su propio
                 * formulario de edicion.
                 *
                 * Y van con parentesis: `$inmueble->latitude` sin ellos
                 * hace que Eloquent busque una relacion llamada
                 * `latitude` y falle con "must return a relationship
                 * instance".
                 */
                'ubicacion_exacta' => ! $this->paraDueno
                    ? [
                        'latitude' => $inmueble->latitude(),
                        'longitude' => $inmueble->longitude(),
                    ]
                    : null,
            ],

            /*
             * Quien escribio, y solo cuando lo necesita quien mira.
             *
             * El interesado ya sabe quien es: es el.
             */
            'interesado' => $this->paraDueno && $this->resource->relationLoaded('interesado')
                ? [
                    'id' => $this->interesado->getKey(),
                    'name' => $this->interesado->name,
                    'email_verified' => $this->interesado->hasVerifiedEmail(),
                ]
                : null,

            /*
             * Solo para quien mando la solicitud: el estado del
             * inmueble.
             *
             * Al dueno no le sirve --lo tiene-- y al interesado le
             * dice si su solicitud murio porque el anuncio se
             * alquilo, que es la diferencia entre "me van a
             * contestar" y "estoy esperando por nada".
             */
            'estado_inmueble' => ! $this->paraDueno && $inmueble !== null
                ? $inmueble->status->value
                : null,
        ];
    }
}
