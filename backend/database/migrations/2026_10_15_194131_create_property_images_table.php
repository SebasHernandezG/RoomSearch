<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Properties\Models\PropertyImage;

/**
 * Las fotos de un inmueble. RF-2.3.
 *
 * @see PropertyImage
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_images', function (Blueprint $table): void {
            $table->id();

            /*
             * ON DELETE CASCADE y no restrict.
             *
             * Una publicacion borrada tiene que llevarse sus fotos. Si
             * el archivo se queda en el disco sin fila que lo referencie,
             * nadie lo va a borrar nunca: es el modo de fallo clasico del
             * almacenamiento de archivos y se descubre cuando el disco
             * esta lleno.
             */
            $table->foreignId('property_id')
                ->constrained('properties')
                ->cascadeOnDelete();

            /*
             * La ruta relativa, no la URL.
             *
             * Guardar la URL ata el archivo al dominio y al esquema de
             * hoy: cambiar de `APP_URL` deja todas las fotos rotas de
             * golpe. Con la ruta, la URL se arma al responder y mover el
             * sitio es cambiar una variable.
             */
            $table->string('path', 255);

            /*
             * El texto alternativo. DS-10 lo exige en toda imagen y una
             * foto sin alt es una foto que un lector de pantalla no
             * puede leer.
             */
            $table->string('alt', 180)->default('');

            $table->unsignedSmallInteger('position')->default(0);

            $table->boolean('is_primary')->default(false);

            /*
             * El tamano guardado, no el del disco.
             *
             * Sirve para el resumen de "cuanto pesa este anuncio" sin
             * recorrer el almacenamiento, y para detectar de inmediato
             * que un archivo se substituyo por otro mucho mas grande.
             */
            $table->unsignedInteger('size_bytes')->default(0);

            $table->timestamps();

            /*
             * La marca de "esta es la unica principal".
             *
             * ## Por que una columna generada y no un indice unico
             *
             * La forma obvia es `unique(['property_id', 'is_primary'])
             * ->where('is_primary', true)`. **No funciona en MySQL.**
             *
             * MySQL no tiene indices parciales: la clausula `WHERE`
             * se acepta en el DDL y se ignora. El indice unique
             * aplicaria entonces a **todas** las filas, y como
             * `is_primary` es 0 en casi todas, solo podria haber una
             * foto que no es principal por anuncio. El limite de ocho
             * fotos habria sido un error en la segunda.
             *
             * El truco es una columna generada que vale NULL en las
             * que no son principales. En MySQL --y en SQL en general--
             * varios NULL **no** colisionan en un indice unique, asi
             * que la restriccion solo aplica a las que si importan.
             *
             * Esta es la razon por la que las pruebas escriben dos
             * fotos no principales en casi todas las pruebas: es el
             * caso que rompe el indice mal hecho.
             */
            $table->boolean('unica_principal')
                ->storedAs('if(`is_primary`, 1, NULL)');

            $table->unique(['property_id', 'unica_principal'], 'property_images_solo_una_principal');

            /*
             * El orden de lectura de la galeria: principal primero y
             * luego por puesto. Es el mismo criterio que usa el
             * Resource, y por eso va aqui y no solo en el codigo.
             */
            $table->index(['property_id', 'is_primary', 'position'], 'property_images_orden');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_images');
    }
};
