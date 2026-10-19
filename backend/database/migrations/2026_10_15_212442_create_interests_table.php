<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Properties\Models\Interest;

/**
 * Las solicitudes de "Me interesa". RF-5.1.
 *
 * Trae la tabla de la rama `archivo/produccion` y le agrega lo que
 * faltaba: el estado, y los indices de la bandeja.
 *
 * @see Interest
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interests', function (Blueprint $table): void {
            $table->id();

            /*
             * Las dos columnas que unen.
             *
             * CASCADE en las dos: si se borra el inmueble, la solicitud
             * no tiene a quien preguntar; y si se borra la cuenta, la
             * solicitud era de alguien que ya no esta.
             */
            $table->foreignId('property_id')
                ->constrained('properties')
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            /*
             * El mensaje es obligatorio.
             *
             * Opcional seria "Me interesa" y ya, que es una solicitud
             * sin nada que decir y no distinguishes de un clic. Con un
             * mensaje, el dueno puede responder algo concreto.
             */
            $table->text('message');

            /*
             * La respuesta del dueno y cuando la dio.
             *
             * `replied_at` y `status` son cosas distintas: una
             * solicitud descartada con motivo **tambien** tiene
             * respuesta, y no esta "respondida" en el sentido de que
             * la conversation sigue viva.
             */
            $table->text('reply')->nullable();
            $table->timestamp('replied_at')->nullable();

            /*
             * El estado, con default 'nueva'.
             *
             * El default es lo que hace que una fila recien insertada
             * sea una solicitud sin responder sin que ningun codigo
             * tenga que decirlo.
             */
            $table->enum('status', ['nueva', 'respondida', 'descartada'])
                ->default('nueva');

            $table->timestamps();

            /*
             * El indice unico que hace imposible el duplicado.
             *
             * ## Por que no basta con comprobar antes de insertar
             *
             * Porque el "comprobar y luego insertar" tiene una ventana:
             * dos pestanas abiertas --o doble clic-- pasan las dos por
             * la comprobacion y las dos insertan. Con el indice, la
             * segunda falla con un error de MySQL.
             *
             * Y por que `Property` y no un id suelto: el nombre del
             * indice es lo que sale en el error de la base cuando algo
             * se escapa, y `uninquepropertyuser` no dice nada.
             */
            $table->unique(['property_id', 'user_id'], 'interests_unica_por_inmueble');

            /*
             * El indice de la bandeja del dueno.
             *
             * `property_id, status` porque la consulta es "las
             * solicitudes de **mis** inmuebles con estado X": primero
             * filtra por inmueble y despues por estado. Al reves, el
             * filtro por estado toca todas las solicitudes de la
             * plataforma antes de descartar las que no son mias.
             */
            $table->index(['property_id', 'status'], 'interests_bandeja');

            /*
             * Y el de "mis solicitudes".
             *
             * `user_id` primero porque es la columna de la consulta
             * entera: sin indice, la lista de lo que yo envie es un
             * recorrido de tabla.
             */
            $table->index(['user_id', 'status'], 'interests_mias');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interests');
    }
};
