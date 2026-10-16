<?php

declare(strict_types=1);

namespace Modules\Identity\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * El perfil publico del arrendador. RF-1.5.
 *
 * ## Por que el telefono tiene su propio interruptor
 *
 * Porque "el telefono no se expone si el arrendador lo marca privado"
 * no es un detalle de la vista: es una **decision que se toma al
 * escribir** y que no se puede deshacer leyendo. Una vez publicado un
 * numero, alguien ya lo tiene.
 *
 * Por eso el default es privado. Un default publico expone el
 * telefono de todos los que noofillaron el campo, y ahi no hay forma de
 * saber quienes quedaron asi. Quien quiera el telefono publico lo
 * pide.
 *
 * @property int $user_id
 * @property string|null $phone
 * @property bool $phone_private
 * @property string|null $photo_path
 * @property string|null $bio
 * @property int|null $years_experience
 */
#[Fillable(['user_id', 'phone', 'phone_private', 'photo_path', 'bio', 'years_experience'])]
class LandlordProfile extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            /*
             * El cast de `phone_private` no es cosmetico: **la decision
             * de privacidad depende de el**.
             *
             * MySQL devuelve `1` y `0` en una columna tinyint, no
             * `true` y `false`. Sin el cast, `$perfil->phone_private` es
             * `1`, que en PHP es truthy, asi que la comprobacion
             * "esta privado" de `telefonoPublicable()` daria `false` --
             * o sea, **publicaria el telefono de quien lo marco
             * privado**. Es el fallo que ninguna prueba de "sale el
             * numero" detecta y que esta linea evita.
             */
            'phone_private' => 'boolean',

            'years_experience' => 'integer',
        ];
    }

    /**
     * Si se puede mostrar el telefono.
     *
     * Las tres condiciones, no dos:
     *
     * 1. Hay telefono.
     * 2. El dueno no lo marco privado.
     * 3. La cuenta tiene el correo confirmado.
     *
     * La tercera es la que se olvida. Un contacto publicado de una
     * cuenta sin confirmar es un dato de contacto de alguien a quien no
     * se le puede reclamar: si el anuncio es un fraude, el telefono
     * ya esta en miles de pantallas y no hay a quien avisarle.
     */
    public function telefonoPublicable(): bool
    {
        if ($this->phone === null || $this->phone === '') {
            return false;
        }

        if ($this->phone_private) {
            return false;
        }

        return $this->user !== null && $this->user->hasVerifiedEmail();
    }

    /**
     * El telefono, o `null` si no se puede mostrar.
     *
     * `publicarTelefono()` y no `telefonoPublicable()` en los
     * Resources: la regla de "se puede o no" y el dato son dos
     * preguntas distintas, y mezclarlas hace que un sitio escriba
     * `$perfil->telefono` sin mirar.
     */
    public function telefonoPublico(): ?string
    {
        return $this->telefonoPublicable() ? $this->phone : null;
    }

    /**
     * La URL de la foto, o `null` si no hay o el archivo no esta.
     *
     * `null` y no una ruta rota: el frontend muestra iniciales, y una
     * URL que da 404 se muestra como una imagen rota.
     */
    public function fotoUrl(): ?string
    {
        if ($this->photo_path === null || $this->photo_path === '') {
            return null;
        }

        if (! Storage::disk('public')->exists($this->photo_path)) {
            return null;
        }

        return Storage::disk('public')->url($this->photo_path);
    }
}
