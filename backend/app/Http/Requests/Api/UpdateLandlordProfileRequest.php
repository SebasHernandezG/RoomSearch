<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Identity\Models\LandlordProfile;

/**
 * Editar el perfil del arrendador. RF-1.5.
 *
 * @see LandlordProfile
 */
class UpdateLandlordProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Cualquiera con sesion edita su propio perfil. El de otro no
        // existe como endpoint: no hay forma de escribirlo.
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            /*
             * E.164: `+` seguido de hasta 15 digitos, sin espacios ni
             * guiones.
             *
             * Se valida el **formato canonico** y no "algo que parezca
             * un telefono". Un numero que no se puede marcar no sirve
             * para nada, y el enlace a WhatsApp se arma con este mismo
             * valor: si admite espacios, el enlace lleva espacios y no
             * abre.
             */
            'phone' => ['nullable', 'regex:/^\+[1-9]\d{1,14}$/'],

            /*
             * El interruptor va siempre, con default.
             *
             * `sometimes` haria que omitirlo significara "no tocar",
             * y entonces no habria forma de volver a privado sin mandar
             * el campo entero. Aqui se manda siempre desde el
             * formulario.
             */
            /*
             * WhatsApp: mismo formato que el telefono, porque la URL de
             * wa.me se arma con este valor y un numero con espacios no
             * abre. RF-5.2.
             */
            'whatsapp_number' => ['nullable', 'regex:/^\+[1-9]\d{1,14}$/'],

            'phone_private' => ['boolean'],

            'bio' => ['nullable', 'string', 'max:400'],

            /*
             * `null` significa "no lo digo". `0` seria "cero anos de
             * experiencia", que es una afirmacion distinta.
             */
            'years_experience' => ['nullable', 'integer', 'min:0', 'max:80'],

            'foto' => [
                'nullable',
                'image',
                'mimes:jpeg,jpg,webp',
                'max:2048',
            ],

            /*
             * Quitar la foto es un booleano, no mandarla vacia.
             *
             * Un `<input type="file">` vacio no es `null` y no es una
             * cadena: es un `UploadedFile` sin contenido. Sin un
             * interruptor explicito no hay forma de decir "ya no quiero
             * la foto", que es distinto de "no cambio la foto".
             */
            'quitar_foto' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.regex' => 'El teléfono va con código de país y solo números: +50688881234.',
            'years_experience.min' => 'Los años de experiencia no pueden ser negativos.',
            'years_experience.max' => 'Esa cifra no es creíble. ¿Querías decir cuántos años?',
            'foto.max' => 'La foto de perfil pesa demasiado.',
            'bio.max' => 'La presentación es de 400 caracteres, no más.',
            'whatsapp_number.regex' => 'El WhatsApp también va con código de país y solo números: +50688881234.',
        ];
    }

    /**
     * Los datos que van al modelo.
     *
     * `foto` y `quitar_foto` **no** entran: son archivos o banderas, y
     * meterlos en el `fill()` guardaria una ruta de un archivo que el
     * controlador todavia no escribio.
     *
     * @return array<string, mixed>
     */
    public function perfil(): array
    {
        $datos = $this->safe()->only(['phone', 'whatsapp_number', 'bio', 'years_experience']);

        /*
         * El interruptor se guarda tal cual vino.
         *
         * Con un `?? true` se perderia la accion de volver a privado:
         * si el campo no llega, el perfil queda como estaba --que
         * puede ser publico-- y el dueno que quito el numero cree que
         * dejo de exponerse. El valor por defecto ya lo pone la base.
         */
        $datos['phone_private'] = $this->boolean('phone_private');

        return $datos;
    }
}
