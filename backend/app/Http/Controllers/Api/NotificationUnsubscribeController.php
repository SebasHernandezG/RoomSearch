<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Identity\Models\User;

/**
 * Dar de baja a un tipo de notificacion. RF-5.4, RNF-08.
 *
 * El enlace de cada correo lleva `user`, `type` y `token`.
 * El token se valida contra user_id + tipo + clave secreta, y
 * solo entonces se desactiva la preferencia correspondiente.
 *
 * Siempre responde 200, exista el usuario o no, sea valido o no:
 * si distinguiera los casos, el enlace serviría para averiguar
 * quién tiene cuenta en la plataforma.
 */
class NotificationUnsubscribeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $usuarioId = (int) $request->query('user', 0);
        $tipo = $request->query('type', '');
        $token = $request->query('token', '');

        $usuario = User::find($usuarioId);

        if ($usuario !== null && $tipo !== '' && $token !== '') {
            $preferencia = $usuario->notificationPreference;

            if ($preferencia !== null) {
                $valido = match ($tipo) {
                    'interest_new' => $this->validarToken($usuarioId, 'interest_new', $token),
                    'interest_reply' => $this->validarToken($usuarioId, 'interest_reply', $token),
                    default => false,
                };

                if ($valido) {
                    match ($tipo) {
                        'interest_new' => $preferencia->update(['interest_new' => false]),
                        'interest_reply' => $preferencia->update(['interest_reply' => false]),
                        default => null,
                    };
                }
            }
        }

        return response()->json([
            'message' => 'Si el enlace era valido, ya no recibes ese tipo de correos.',
        ]);
    }

    /**
     * Valida el token HMAC sin revelar si es correcto o no.
     */
    private function validarToken(int $usuarioId, string $tipo, string $token): bool
    {
        $secreto = config('app.key');
        $esperado = hash_hmac('sha256', "{$usuarioId}|{$tipo}|{$secreto}", config('app.key'));

        return hash_equals($esperado, $token);
    }
}
