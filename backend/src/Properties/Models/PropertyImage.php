<?php

declare(strict_types=1);

namespace Modules\Properties\Models;

use Database\Factories\PropertyImageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Una foto de un inmueble. RF-2.3.
 *
 * ## Por que la foto principal es una columna y no una bandera
 *
 * Porque "cual es la principal" es una pregunta del dueno, no un dato
 * derivable. Con una columna `is_primary` se responde en SQL; con un
 * orden por `position` habia que desambiguar a mano cuando dos filas
 * empataban en el mismo puesto, y la que ganara seria la que el
 * servidor devolvio primero. Un bug que sale "a veces".
 *
 * Una publicacion tiene como mucho una principal: la base lo dice con
 * un indice unico parcial, no lo vigila el codigo de la aplicacion.
 *
 * @property int $id
 * @property int $property_id
 * @property string $path
 * @property string $alt
 * @property int $position
 * @property bool $is_primary
 * @property int $size_bytes
 */
#[Fillable(['property_id', 'path', 'alt', 'position', 'is_primary', 'size_bytes'])]
class PropertyImage extends Model
{
    /** @use HasFactory<PropertyImageFactory> */
    use HasFactory;

    /**
     * Los bytes por arriba de esto se rechazan.
     *
     * 8 MB es mucho mas que lo que deberia pesar una foto de un
     * celular y suficiente para una toma decente. El limite va **antes**
     * de leer el archivo entero del disco, no despues, porque el
     * problema del limite es la memoria y el ancho de banda.
     */
    public const MAXIMO_BYTES = 8 * 1024 * 1024;

    /**
     * Cuantas fotos acepta un anuncio.
     *
     * Ocho es lo que se ve sin que la galeria se vuelva una tarea: es
     * el numero de fotos de un recorrido por un inmueble. El limite
     * va en el request y no en el controlador para que un formulario
     * con quince campos no pase la validacion del HTML.
     */
    public const MAXIMO_FOTOS = 8;

    /**
     * Lo que se acepta.
     *
     * Solo jpeg y webp. Los PNG se excluyen a proposito: una captura
     * de pantalla de 6 MB de una habitacion no es informacion, y
     * aceptarlas es como la galeria se llena de ruido que nadie puede
     * borrar despues.
     */
    public const TIPOS = ['jpeg', 'jpg', 'webp'];

    /**
     * Las imagenes de un inmueble, la principal primero.
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * La URL publica, o `null` si el archivo no esta.
     *
     * Devolver `null` y no una ruta rota: una foto que falta se
     * muestra como placeholder en la pantalla, y una URL que da 404
     * se muestra como una imagen rota, que es lo que el issue pide
     * explicitamente evitar.
     */
    public function url(): ?string
    {
        if (! Storage::disk('public')->exists($this->path)) {
            return null;
        }

        return Storage::disk('public')->url($this->path);
    }
}
