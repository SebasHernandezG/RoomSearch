<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Modules\Identity\Models\User;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

/**
 * Reenvio del correo de verificacion. RF-1.3.
 *
 * **No acepta un correo en el cuerpo.** El que pide el reenvio es
 * `$this->user()`, que viene del token.
 *
 * Aceptarlo seria un agujero: con un token propio y el correo de otra
 * persona en el cuerpo, cualquiera podria pedir cientos de correos a
 * una direccion ajena y hundirla en spam -- o que Ser Mail la de de
 * baja -- sin haber hecho nada con su propia cuenta.
 *
 * Sin limite, ademas, esto es un canon de correo. RNF-05.
 */
class SendVerificationEmailRequest extends FormRequest
{
    /**
     * Reenvios por usuario antes de frenar.
     *
     * Es mas alto que el del login porque pedir que te reenvien un
     * correo legitimo no es un ataque: la letra se pierde, la bandeja
     * se vacia sola, alguien cambia de correo. Seis es holgado para
     * quien se confundio y cerrado para un abusive.
     */
    public const MAX_REENVIO = 6;

    /**
     * Ventana en segundos.
     */
    public const VENTANA = 60;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * La cuenta que esta pidiendo el reenvio.
     */
    public function usuario(): User
    {
        return $this->user();
    }

    /**
     * El correo va normalizado porque es la clave del contador, y
     * "Ana@x.com" y "ana@x.com" no pueden llevar contadores distintos.
     */
    private function clave(): string
    {
        $correo = Str::transliterate(Str::lower((string) $this->user()?->email));

        return 'verificacion:'.$correo.'|'.$this->ip();
    }

    /**
     * @throws TooManyRequestsHttpException
     */
    public function exigirMargen(): void
    {
        if (! $this->limiteAgotado()) {
            return;
        }

        /*
         * `availableIn` devuelve los segundos que quedan de la
         * VENTANA, que es 0 cuando la ventana ya se cumplio. Por eso
         * el max con 1: un 429 con 0 segundos deja a la persona
         * reintentando sin parar contra un techo que sigue intacto.
         *
         * El mismo razonamiento que en `LoginRequest`.
         */
        $segundos = max((int) RateLimiter::availableIn($this->clave()), 1);

        throw new TooManyRequestsHttpException(
            $segundos,
            trans('auth.throttle', ['seconds' => $segundos]),
        );
    }

    /**
     * Cuenta el reenvio SOLO si se llego a mandar.
     *
     * Si contara antes, bastaba con escribir el correo de otra persona
     * para agotarle el limite.
     */
    public function contarReenvio(): void
    {
        RateLimiter::hit($this->clave(), self::VENTANA);
    }

    /**
     * Si todavia hay margen.
     */
    public function limiteAgotado(): bool
    {
        return RateLimiter::tooManyAttempts($this->clave(), self::MAX_REENVIO);
    }
}
