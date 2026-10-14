<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * Elegir la contrasena nueva. RF-1.3.
 *
 * El `token` viaja en el cuerpo y no como parametro de ruta a
 * proposito: viaja en el cuerpo, que es lo que viaja cifrado cuando la
 * peticion va por HTTPS, y no en una URL que queda registrada en los
 * logs del servidor y del proxy.
 *
 * El **correo tambien es obligatorio**, y no es un detalle. El broker
 * de Laravel busca la cuenta con `retrieveByCredentials(['email' => ..,
 * 'token' => ..])`, y el provider de Eloquent **descarta lo que no es
 * una columna de la tabla**: `token` se va, y `password` se va
 * explicitamente porque contiene la palabra. Si faltara el correo, las
 * credenciales quedarian vacias, `retrieveByCredentials` devolveria el
 * PRIMER usuario de la tabla, y la comprobacion del token se haria
 * contra la cuenta equivocada.
 *
 * El sintoma es sutil: el enlace dice "ese enlace ya no sirve" en vez
 * de un 500, y el reset simplemente nunca funciona.
 */
class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email:rfc', 'max:120'],

            /*
             * Igual que en el registro: ocho caracteres y nada mas. No
             * se exige mayuscula ni simbolo porque empujan a la gente
             * hacia "Password123!", que es peor que una frase larga.
             */
            'password' => ['required', 'string', Password::min(8), 'max:200'],

            'password_confirmation' => ['required', 'same:password'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.email' => 'Revisá el correo: no parece una dirección válida.',
            'password_confirmation.same' => 'Las dos contraseñas no coinciden.',
        ];
    }

    /**
     * Lo que espera el broker de contrasenas.
     *
     * @return array<string, string>
     */
    public function credenciales(): array
    {
        return [
            'email' => (string) $this->validated('email'),
            'token' => (string) $this->validated('token'),
            'password' => (string) $this->validated('password'),
        ];
    }
}
