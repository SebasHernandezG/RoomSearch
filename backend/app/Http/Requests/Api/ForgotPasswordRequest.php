<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

/**
 * "Olvide mi contrasena". RF-1.3.
 *
 * El correo se normaliza igual que en `RegisterRequest`: "Ana@x.com" y
 * "ana@x.com" son la misma casilla, y el broker busca por igualdad
 * exacta.
 */
class ForgotPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($this->input('email')))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.email' => 'Revisá el correo: no parece una dirección válida.',
        ];
    }

    /**
     * Lo que espera el broker de contrasenas.
     *
     * @return array<string, string>
     */
    public function credenciales(): array
    {
        return ['email' => (string) $this->validated('email')];
    }
}
