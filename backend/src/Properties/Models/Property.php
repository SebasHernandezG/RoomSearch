<?php

declare(strict_types=1);

namespace Modules\Properties\Models;

use Database\Factories\PropertyFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Un inmueble publicado por un arrendador.
 *
 * La tabla `properties` arranca con solo `id` y `timestamps` (migracion
 * 2026_08_30_171611). El esquema completo del inmueble --tipo, moneda,
 * deposito, servicios y la columna POINT SRID 4326-- llega con RF-2.2 y
 * RF-2.4, no antes.
 *
 * @see \Modules\Identity\Models\User  dueno de la publicacion
 */
class Property extends Model
{
    /** @use HasFactory<PropertyFactory> */
    use HasFactory;

    /**
     * Get the factory that creates the model's instances.
     */
    protected static function newFactory(): PropertyFactory
    {
        return PropertyFactory::new();
    }
}
