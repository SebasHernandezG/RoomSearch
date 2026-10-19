<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Responder o descartar una solicitud. RF-5.1.
 *
 * Un solo request para las dos acciones porque el cuerpo es el mismo --
 * `reply` y `status`-- y separarlos en dos clases seria duplicar las
 * reglas para un campo.
 */
class ReplyInterestRequest extends FormRequest
{
    public function authorize(): bool
    {
        /*
         * Sesion, no propiedad.
         *
         * "Es dueno de este inmueble" no se puede decidir en
         * `authorize()` sin la fila, y exigirlo aqui devolveria un 403
         * a alguien que solo queria responder un anuncio que no es
         * suyo -- que es un mensaje que no ayuda a nadie.
         *
         * El permiso real lo revisa `InterestPolicy`, que ya tiene el
         * `property_id` de la fila.
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
             * La respuesta es obligatoria en las dos acciones.
             *
             * Un descarte sin motivo es un "no" sin explicación, que
             * es exactamente la experiencia que hace que alguien se
             * vaya y no vuelva a escribir a nadie. Y el dueno escribe
             * una linea, no un Ensayo.
             *
             * 1000, igual que el mensaje de entrada: los dos van a la
             * misma columna de la pantalla y un limite distinto entre
             * ellos se ve como un bug.
             */
            'reply' => ['required', 'string', 'min:5', 'max:1000'],

            /*
             * El estado va explicito.
             *
             * No hay default a proposito: la accion es "responder" o
             * "descartar", y adivinar cual de las dos quiere el dueno
             * es justo lo que no hay que hacer. Sin el campo, un 422.
             */
            'status' => ['required', 'in:respondida,descartada'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reply.required' => 'Escribí algo: un descarte sin motivo no le sirve de nada a quien escribió.',
            'reply.min' => 'Contá un poco más para que se entienda.',
            'reply.max' => 'La respuesta es demasiado larga.',
            'status.required' => 'Indicá si respondés o descartás la solicitud.',
            'status.in' => 'Ese estado no existe.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'reply' => 'respuesta',
            'status' => 'estado',
        ];
    }
}
