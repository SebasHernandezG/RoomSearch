<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * Inicio de sesion. RF-1.1.
 *
 * Ademas de validar, este request decide si la peticion llega a provar
 * la contrasena o si ya se gastaron los intentos.
 */
class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Intentos por correo antes de frenar. RNF-05.
     */
    public const MAX_INTENTOS = 5;

    /**
     * Ventana en segundos.
     */
    public const VENTANA = 60;

    /**
     * Intentos por IP, independiente del correo.
     *
     * El limite por correo solo frena a quien insiste con la misma
     * casilla. Un atacante que vaya probando correos distintos pasa de
     * largo: para cada uno tendria cinco intentos libres. Este es el
     * techo que de verdad lo detiene, y va mas alto porque cada acierto
     * es una cuenta distinta.
     */
    public const MAX_INTENTOS_POR_IP = 30;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'max:120'],
            'password' => ['required', 'string', 'max:200'],
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
     * Si todavia hay margen, y si no, por cuanto.
     */
    public function limiteAgotado(): bool
    {
        return RateLimiter::tooManyAttempts($this->clave(), self::MAX_INTENTOS)
            || RateLimiter::tooManyAttempts($this->claveIp(), self::MAX_INTENTOS_POR_IP);
    }

    /**
     * Segundos que faltan para volver a intentar. Lo que mande mas.
     */
    public function segundosParaReintentar(): int
    {
        $restantes = [
            RateLimiter::availableIn($this->clave()),
            RateLimiter::availableIn($this->claveIp()),
        ];

        return (int) max($restantes);
    }

    /**
     * Cuenta un intento fallido.
     *
     * OJO: se suma en los dos contadores, el del correo y el de la IP.
     * Sumar solo en el del correo deja abierta la puerta de probar
     * manyos correos distintos desde una sola maquina.
     */
    public function contarIntentoFallido(): void
    {
        RateLimiter::hit($this->clave(), self::VENTANA);
        RateLimiter::hit($this->claveIp(), self::VENTANA);
    }

    /**
     * Olvida los intentos. Solo cuando la contrasena estaba bien.
     */
    public function limpiarIntentos(): void
    {
        RateLimiter::clear($this->clave());
        RateLimiter::clear($this->claveIp());
    }

    /**
     * Clave por correo e IP.
     *
     * El correo va normalizado porque "Ana@x.com" y "ana@x.com" son la
     * misma casilla y no pueden llevar contadores distintos.
     */
    private function clave(): string
    {
        return 'login:'.Str::transliterate(Str::lower((string) $this->input('email')))
            .'|'.$this->ip();
    }

    private function claveIp(): string
    {
        return 'login-ip:'.$this->ip();
    }
}
