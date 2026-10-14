<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Http\Requests\Api\RegisterRequest;
use App\Http\Resources\UserResource;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Modules\Identity\Models\User;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

/**
 * Registro, inicio y fin de sesion. RF-1.1.
 *
 * La API es sin sesion: la autenticacion viaja con un token de Sanctum
 * en la cabecera Authorization. El cliente decide donde guardarlo; ver
 * la nota de seguridad al final de la clase.
 */
class AuthController extends Controller
{
    /**
     * Crea la cuenta y devuelve el token.
     *
     * Registrar e iniciar sesion en una sola llamada: pedirle a alguien
     * que se registre y despues vaya a "iniciar sesion" con lo que
     * acaba de escribir es un paso que no aporta nada.
     *
     * La cuenta nace SIN verificar y se manda el correo. RF-1.3: sin
     * confirmar el correo, publicar es escribir a cualquiera con
     * cualquier direccion.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $usuario = User::create($request->datosParaCrear());

        /*
         * El envio va en la cola (la notificacion implementa ShouldQueue),
         * asi que esto no espera al SMTP. Si el correo falla, la cuenta
         * ya esta creada y se puede pedir un reenvio; al reves, la
         * pantalla de registro se quedaria colgada.
         */
        event(new Registered($usuario));

        return $this->respuestaConToken($usuario, 'Cuenta creada. Te enviamos un correo para confirmarla.');
    }

    /**
     * Inicia sesion.
     *
     * El mensaje de error es el mismo exista la cuenta o no. Si
     * diferenciáramos los dos casos, el endpoint serviría para saber
     * quién tiene cuenta en la plataforma.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        if ($request->limiteAgotado()) {
            throw new TooManyRequestsHttpException(
                $request->segundosParaReintentar(),
                trans('auth.throttle', ['seconds' => $request->segundosParaReintentar()]),
            );
        }

        $credenciales = $request->only('email', 'password');

        // Se intenta con el correo ya en minúsculas, que es como se
        // guardó al registrar. Sin esto, alguien que se registró con
        // minúsculas no podría entrar escribiendo su correo en
        // mayúsculas, aunque el correo no distingue.
        $credenciales['email'] = mb_strtolower((string) $credenciales['email']);

        if (! Auth::attempt($credenciales, remember: false)) {
            $request->contarIntentoFallido();

            /*
             * 422 y no 401. El 422 significa "corregí esto", y el
             * frontend lo muestra junto al campo del correo, que es
             * donde una contraseña incorrecta tiene sentido. Un 401
             * genérico se vería como una caída de la página.
             *
             * El mensaje es el mismo exista la cuenta o no: si
             * diferenciáramos los casos, este endpoint serviría para
             * enumerar quién tiene cuenta en la plataforma.
             */
            throw ValidationException::withMessages([
                'email' => [trans('auth.failed')],
            ]);
        }

        $request->limpiarIntentos();

        return $this->respuestaConToken($request->user(), 'Sesión iniciada.');
    }

    /**
     * Cierra la sesion revocando el token.
     *
     * Revocar y no solo olvidar: un token que sigue en la base sirve
     * hasta que expire. Si a alguien le roban el token, la única forma
     * de que deje de servir es borrarlo.
     */
    public function logout(Request $request): JsonResponse
    {
        $usuario = $request->user();

        // Puede venir null si el endpoint se llama sin token: no es un
        // error, no hay nada que cerrar.
        $usuario?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Sesión cerrada.',
        ]);
    }

    /**
     * La cuenta con la que se entra. Handy para el frontend: al
     * abrir la aplicación comprueba si el token guardado sigue vivo.
     */
    public function user(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    /**
     * El token nuevo siempre nace con ability '*'.
     *
     * Es la unica ability que usa la plataforma hoy. Los tokens de
     * Sanctum guardan las habilidades como JSON para que mas adelante
     * se pueda dar un token de solo lectura sin cambiar la tabla.
     */
    private function respuestaConToken(?User $usuario, string $mensaje): JsonResponse
    {
        return response()->json([
            'message' => $mensaje,
            'token' => $usuario->createToken('app')->plainTextToken,
            'user' => new UserResource($usuario),
        ]);
    }
}
