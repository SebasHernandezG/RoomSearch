<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ForgotPasswordRequest;
use App\Http\Requests\Api\ResetPasswordRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

/**
 * Recuperacion de contrasena. RF-1.3.
 *
 * El broker de Laravel ya resuelve lo dificil: genera un token de un
 * solo uso, lo hashea en `password_reset_tokens`, lo borra cuando se
 * usa y vence a los 60 minutos (`config/auth.php`). Este controlador
 * solo traduce eso a JSON y protege el caso de enumeracion.
 */
class PasswordResetController extends Controller
{
    /**
     * Manda el enlace al correo.
     *
     * SIEMPRE 200, exista la cuenta o no.
     *
     * El broker devuelve un `Password::RESET_THROTTLED` si el correo
     * existe y acaba de pedir uno, y un `INVALID_USER` si no existe.
     * Los dos se responden igual: si uno dijera "no hay cuenta con ese
     * correo", este endpoint serviria para saber quien esta registrado
     * en la plataforma, que es lo mismo que hace `POST /api/login` y
     * lo que ese endpoint evita a proposito.
     *
     * El limite lo pone el propio broker (`throttle` en
     * `config/auth.php`), no uno nuestro.
     */
    public function sendLink(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink($request->credenciales());

        return response()->json([
            'message' => trans('auth.resetEnviado'),
        ]);
    }

    /**
     * Cambia la contrasena.
     *
     * Ahi si se distinguen los casos, pero solo entre "el enlace no
     * sirve" y "si sirve": el mensaje no dice si el correo existe. Un
     * token invalido y un token vencido son el mismo problema para
     * quien lo tiene enfrente.
     */
    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $estado = Password::reset(
            $request->credenciales(),
            function ($usuario, string $contrasena): void {
                /*
                 * El hash lo pone el cast `hashed` del modelo, que es
                 * RNF-03. aqui se guarda en claro la nueva contrasena y
                 * nunca la vieja.
                 *
                 * Y se tira `remember_token`: si alguien tinha una
                 * sesion abierta antes del robo, el cambio de contrasena
                 * tiene que cortarla.
                 */
                $usuario->forceFill([
                    'password' => $contrasena,
                    'remember_token' => null,
                ])->save();
            },
        );

        if ($estado !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => [trans('auth.resetFallido')],
            ]);
        }

        return response()->json([
            'message' => trans('auth.resetHecho'),
        ]);
    }
}
