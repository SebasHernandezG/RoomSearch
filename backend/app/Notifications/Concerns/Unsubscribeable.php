<?php

declare(strict_types=1);

namespace App\Notifications\Concerns;

use Illuminate\Support\Str;

/**
 * Token de baja para correos de notificacion. RF-5.4, RNF-08.
 *
 * Cada correo tiene un enlace "dáme de baja" con un token que
 * identifica al usuario y al tipo de notificacion. Al hacer clic,
 * se desactiene esa preferencia y no se envian mas correos de ese
 * tipo.
 *
 * El token es un hash HMAC de user_id + tipo + clave secreta,
 * como el de reset de contrasena: solo quien tiene el enlace
 * puede dar de baja, y no sirve para enumerar usuarios.
 */
trait Unsubscribeable
{
    /**
     * Tipos de notificacion que admiten baja.
     *
     * @return array<string, string>
     */
    public static function unsubscribeTypes(): array
    {
        return [
            'interest_new' => 'nueva solicitud de Me interesa',
            'interest_reply' => 'respuesta a tu solicitud de Me interesa',
        ];
    }

    /**
     * Genera el token de baja para un usuario y tipo.
     *
     * @param  string  $type  Clave de `unsubscribeTypes()`
     */
    public function unsubscribeToken(int $userId, string $type): string
    {
        $secreto = config('app.key');

        return hash_hmac('sha256', "{$userId}|{$type}|{$secreto}", $secreto);
    }

    /**
     * Valida que un token corresponda a un usuario y tipo.
     *
     * @param  string  $type  Clave de `unsubscribeTypes()`
     */
    public function validateUnsubscribeToken(int $userId, string $type, string $token): bool
    {
        $esperado = $this->unsubscribeToken($userId, $type);

        return hash_equals($esperado, $token);
    }

    /**
     * URL de baja para un usuario y tipo.
     *
     * @param  string  $type  Clave de `unsubscribeTypes()`
     */
    public function unsubscribeUrl(int $userId, string $type): string
    {
        $token = $this->unsubscribeToken($userId, $type);

        return config('app.url').'/api/notifications/unsubscribe?user='.$userId.'&type='.$type.'&token='.urlencode($token);
    }
}
