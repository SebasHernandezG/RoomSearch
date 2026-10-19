<?php

declare(strict_types=1);

namespace Modules\Identity\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Preferencias de notificacion de un usuario. RF-5.4.
 *
 * Una fila por usuario con los tipos de correo que quiere recibir.
 * Los default son "sí a todo": al registrarse recibes todo, y
 * das de baja lo que no quieras desde el enlace de cada correo.
 *
 * @property int $id
 * @property int $user_id
 * @property bool $email_general
 * @property bool $interest_new
 * @property bool $interest_reply
 */
#[Fillable(['user_id', 'email_general', 'interest_new', 'interest_reply'])]
class NotificationPreference extends Model
{
    public $timestamps = true;

    /**
     * La cuenta a la que pertenecen estas preferencias.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Si quiere recibir correos generales (verificacion, reset de contrasena).
     */
    public function recibeEmailGeneral(): bool
    {
        return (bool) $this->email_general;
    }

    /**
     * Si quiere recibir aviso de solicitud nueva de "Me interesa".
     */
    public function recibeInteresNuevo(): bool
    {
        return (bool) $this->interest_new;
    }

    /**
     * Si quiere recibir aviso de respuesta a su solicitud.
     */
    public function recibeRespuestaInteres(): bool
    {
        return (bool) $this->interest_reply;
    }
}
