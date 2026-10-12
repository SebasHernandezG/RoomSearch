<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Modules\Identity\Enums\UserRole;

/**
 * Registro de una cuenta nueva. RF-1.1.
 */
class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normaliza antes de validar.
     *
     * La regla `lowercase` de Laravel RECHAZA las mayusculas, no las
     * convierte. Sin esto, alguien que escribiera "Ana@correo.com" en
     * el formulario recibiria un error, cuando su correo es tan valido
     * como el de al lado.
     *
     * Normalizar aqui deja aceptar cualquier forma de escribirla y
     * guardar siempre la misma version, que es lo que hace que `unique`
     * signifique algo.
     *
     * El nombre se queda como venga: "Ana" y "ana" son la misma
     * persona pero dos nombres distintos, y ahi si hay distincion.
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($this->input('email')))]);
        }

        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:80'],

            'email' => [
                'required',
                'string',
                'email:rfc',
                'max:120',
                'lowercase',
                Rule::unique('users', 'email'),
            ],

            /*
             * El hash no lo hace esta regla: lo hace el cast
             * `hashed` del modelo, que es RNF-03. Aqui solo se pide que
             * la contrasena sea razonable.
             *
             * Ocho caracteres es el minimo de sentido comun en un sitio
             * sin verificacion en dos pasos. No se exige mayuscula ni
             * simbolo porque empujan a la gente hacia "Password123!",
             * que es peor que una frase larga.
             */
            'password' => ['required', 'string', Password::min(8), 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.min' => 'Poné tu nombre, aunque sea de pila.',
            'email.email' => 'Revisá el correo: no parece una dirección válida.',
            'email.unique' => 'Ya hay una cuenta con ese correo.',
        ];
    }

    /**
     * Los datos que llegan al modelo.
     *
     * El rol va fijo en Tenant y nunca se lee del cuerpo de la
     * peticion: publicar vivienda es la accion con consecuencias
     * (RF-7.1 pide moderacion), asi que el privilegio se pide aparte y
     * no se concede por crear una cuenta.
     */
    public function datosParaCrear(): array
    {
        return [
            ...$this->validated(),
            'role' => UserRole::Tenant,
        ];
    }
}
