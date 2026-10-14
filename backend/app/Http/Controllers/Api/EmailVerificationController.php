<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SendVerificationEmailRequest;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Identity\Models\User;

/**
 * Verificacion del correo. RF-1.3.
 *
 * La cuenta nace sin verificar (`email_verified_at` en null). Nadie
 * puede publicar hasta confirmar su correo: sin eso, publicar es
 * escribir a cualquiera con cualquier direccion, y la plataforma se
 * llena de anuncios falsos.
 */
class EmailVerificationController extends Controller
{
    /**
     * Confirma el correo desde el enlace del correo.
     *
     * La ruta es una URL **firmada**: el enlace lleva `id`, `hash` y la
     * firma, y sin los tres no se puede verificar a mano. Por eso este
     * metodo no necesita sesion ni token --quien llega es la persona
     * que abrio el correo-- y por eso va fuera del grupo de `auth`.
     *
     * Responde 200 y no 403 cuando el correo ya estaba verificado:
     * la persona que reabrio el correo no hizo nada malo, y un error
     * la deja pensando que su cuenta esta danada.
     */
    public function verify(Request $request, int $id, string $hash): JsonResponse
    {
        $usuario = User::find($id);

        /*
         * El hash es `sha1(correo)` y cambia si alguien edita el
         * correo. Sin esta comparacion, cambiarse el correo dejaria
         * confirmado el anterior: alguien verifica su cuenta y despues
         * se la cambia por otra que no le pertenece.
         */
        if ($usuario === null || ! hash_equals(sha1($usuario->getEmailForVerification()), $hash)) {
            return $this->fallo(trans('auth.verificacionInvalida'));
        }

        if ($usuario->hasVerifiedEmail()) {
            return $this->exito($usuario, trans('auth.yaVerificado'));
        }

        $usuario->markEmailAsVerified();

        event(new Verified($usuario));

        return $this->exito($usuario, trans('auth.verificado'));
    }

    /**
     * Reenvia el correo de verificacion.
     *
     * La cuenta sale del token, no del cuerpo: ver
     * `SendVerificationEmailRequest`.
     *
     * Y siempre 200, exista la cuenta o no, este verificada o no. Si
     * contestara distinto en algun caso, el endpoint serviria para
     * saber si una casilla esta registrada en la plataforma, que es lo
     * mismo que hace `POST /api/login` y lo que ese endpoint evita a
     * proposito.
     */
    public function resend(SendVerificationEmailRequest $request): JsonResponse
    {
        $request->exigirMargen();

        $usuario = $request->usuario();

        if (! $usuario->hasVerifiedEmail()) {
            $usuario->sendEmailVerificationNotification();

            /*
             * Contar SOLO si se llego a mandar. Si contara antes,
             * alguien podria gastar el limite de otra persona con solo
             * escribir su correo: seis pedidos y esa casilla ya no
             * puede pedir el suyo.
             */
            $request->contarReenvio();
        }

        return response()->json([
            'message' => trans('auth.verificacionEnviada'),
        ]);
    }

    private function exito(User $usuario, string $mensaje): JsonResponse
    {
        return response()->json([
            'message' => $mensaje,
            'user' => [
                'id' => $usuario->id,
                'email_verified' => true,
            ],
        ]);
    }

    private function fallo(string $mensaje): JsonResponse
    {
        return response()->json(['message' => $mensaje], 403);
    }
}
