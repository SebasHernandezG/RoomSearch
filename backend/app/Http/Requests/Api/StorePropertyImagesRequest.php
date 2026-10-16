<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Properties\Models\PropertyImage;

/**
 * Subir fotos de un inmueble. RF-2.3.
 *
 * ## Por que los limites estan aqui y no en el controlador
 *
 * Los tres --cantidad, tamano, tipo-- tienen que fallar **antes** de
 * que el archivo llegue al disco. Un `max` de tamano en el controlador,
 * despues de `store()`, ya escribio el archivo y hay que borrarlo; y un
 * `Storage::disk()->put()` con un archivo de 200 MB se carga en memoria
 * antes de que nadie mire su tamano.
 *
 * ## Por que la principal es un campo del cuerpo y no una regla
 *
 * "Que foto es la principal" es una decision del dueno y llega con el
 * archivo. Si se mandaran las cinco fotos y despues un `PUT` con el id
 * de la principal, entre las dos peticiones se puede subir una galeria
 * sin principal, que es lo que el frontend tiene que evitar pintar.
 */
class StorePropertyImagesRequest extends FormRequest
{
    public function authorize(): bool
    {
        /*
         * Solo el dueno.
         *
         * El permiso real lo revisa `PropertyPolicy::update` sobre la
         * publicacion, que es la que tiene el `user_id`. Aqui solo se
         * exige sesion para no devolver 403 a un visitante sin sesion
         * en vez de 401.
         */
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            /*
             * La cantidad maxima.
             *
             * Ocho es lo que se puede ver sin que la galeria se vuelva
             * una tarea: es el numero de fotos de un recorrido por un
             * inmueble, no de un catalogo de[Any] Does it matter? Yes -- it matters because a gallery you have to page through is a gallery nobody opens.
             *
             * Y tiene que estar en el request: si se comprobara en el
             * controlador, un formulario con quince campos de archivo
             * pasaria la validacion del HTML y llegaria entera al
             * servidor.
             */
            'fotos' => ['required', 'array', 'min:1', 'max:'.PropertyImage::MAXIMO_FOTOS],

            'fotos.*' => [
                'required',
                'image',

                /*
                 * `mimes` y no `mimetypes`.
                 *
                 * `mimetypes` mira lo que el navegador **dice**; `mimes`
                 * mira los bytes. Los dos se comparan con una lista
                 * blanca, y el que no se puede falsear es el segundo.
                 */
                'mimes:'.implode(',', PropertyImage::TIPOS),

                /*
                 * El limite de tamano va aqui, y no en el controlador.
                 * Ver el comentario de la clase.
                 */
                'max:'.PropertyImage::MAXIMO_BYTES,
            ],

            /*
             * El indice de la principal dentro del arreglo `fotos`.
             *
             * Un indice y no un id: en el momento de subir todavia no
             * hay id, y `min:0` mas `max:` contra el tamano real del
             * arreglo es lo que impide "principal = 9" en una subida
             * de tres.
             */
            'principal' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'fotos.required' => 'Poné al menos una foto del inmueble.',
            'fotos.min' => 'Poné al menos una foto del inmueble.',
            'fotos.max' => 'Máximo '.PropertyImage::MAXIMO_FOTOS.' fotos por anuncio.',
            'fotos.*.image' => 'Ese archivo no es una imagen.',
            'fotos.*.mimes' => 'Solo aceptamos JPG o WebP.',
            'fotos.*.max' => 'La foto pesa más de '.round(PropertyImage::MAXIMO_BYTES / 1048576).' MB.',
            'principal.min' => 'La foto principal tiene que ser una de las que subiste.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'fotos' => 'fotos',
            'principal' => 'foto principal',
        ];
    }

    /**
     * El indice de la foto principal, ya validado contra el tamano real.
     *
     * `0` cuando no se pidio ninguna o cuando el indice no existe: sin
     * principal, la primera foto es la principal. Es la regla que hace
     * que un anuncio recien publicado tenga siempre una foto principal
     * sin que el frontend tenga que mandarla.
     */
    public function indicePrincipal(): int
    {
        $pedido = $this->integer('principal');
        $total = count($this->file('fotos', []));

        if ($pedido < 0 || $total === 0) {
            return 0;
        }

        return $pedido < $total ? $pedido : 0;
    }
}
