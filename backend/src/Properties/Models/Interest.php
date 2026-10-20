<?php

declare(strict_types=1);

namespace Modules\Properties\Models;

use Database\Factories\InterestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\InterestStatus;

/**
 * La solicitud de "Me interesa" de una persona sobre un inmueble. RF-5.1.
 *
 * ## Por que esta en Properties y no en Identity
 *
 * Porque la fila no es de una persona ni de una cuenta: es una
 * relacion entre alguien y **algo concreto**. Si viviera en Identity,
 * el modulo de usuarios empezaria a saber de inmuebles --y el
 * `PolicyPolicy`-- para poder responder una bandeja.
 *
 * ## Las relaciones se llaman en espanol
 *
 * `inmueble()` y `interesado()`, no `property()` y `user()`. Es la
 * convencion del modulo: `Property::dueno()`, `Property::imagenes()`.
 * Mezclar las dos hace que un `->user()` en un modelo de Properties
 * devuelva lo que uno espera y no lo que dice.
 *
 * @property int $id
 * @property int $property_id
 * @property int $user_id
 * @property string $message
 * @property string|null $reply
 * @property Carbon|null $replied_at
 * @property InterestStatus $status
 */
#[Fillable(['property_id', 'user_id', 'message', 'reply', 'replied_at', 'status'])]
class Interest extends Model
{
    /** @use HasFactory<InterestFactory> */
    use HasFactory;

    /**
     * La fabrica esta en `Database\Factories`, no junto al modelo.
     *
     * `HasFactory` la busca en el namespace de la clase --que es
     * `Modules\Properties\Models`-- y no la encuentra. Sin esta
     * declaracion, `Interest::factory()` falla con
     * `Class "Modules\Properties\Models\InterestFactory" not found`.
     *
     * ## Por que `property_id` y `user_id` estan en el `$fillable`
     *
     * Porque el controlador los pasa por `create([...])` y la
     * proteccion contra asignacion masiva los descarta en silencio si
     * no estan. El fallo es `Field 'property_id' doesn't have a default
     * value`, que no menciona el modelo ni la proteccion: es un error
     * de MySQL que parece de esquema.
     */
    protected static function newFactory(): InterestFactory
    {
        return InterestFactory::new();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => InterestStatus::class,
            'replied_at' => 'datetime',

            /*
             * Sin este cast el estado viaja como `1`.
             *
             * El frontend lo compara con `=== 'respondida'` y con `1`
             * eso nunca da true: la respuesta se guardaria, el badge
             * no bajaria y la bandeja seguiria mostrando la solicitud
             * como nueva. Es el mismo motivo que en `LandlordProfile`.
             */
        ];
    }

    /**
     * El inmueble del que se interesa.
     */
    public function inmueble(): BelongsTo
    {
        return $this->belongsTo(Property::class, 'property_id');
    }

    /**
     * Quien la mando.
     *
     * `interesado()` y no `inquilino()`: no esta verificado que sea un
     * inquilino, solo que tiene sesion. Se llama "interesado" porque es
     * lo que el registro sabe.
     */
    public function interesado(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Si el dueno todavia no la miró.
     */
    public function isUnread(): bool
    {
        return $this->status->isUnread();
    }
}
