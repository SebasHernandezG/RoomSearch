<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Identity\Models\LandlordProfile;

/**
 * El perfil publico del arrendador. RF-1.5.
 *
 * Tabla aparte y no columnas en `users`: un inquilino no tiene perfil
 * de arrendador, y `users` ya tiene lo que necesita de identidad.
 * Ademas permite borrar el perfil sin tocar la cuenta.
 *
 * @see LandlordProfile
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landlord_profiles', function (Blueprint $table): void {
            /*
             * Una fila por cuenta, y la cuenta puede no tener fila.
             *
             * `unique` y no `primary`: la clave primaria de una tabla
             * con `user_id` unico seria redundante, y Laravel ya sabe
             * que `user_id` es la clave de la relacion.
             *
             * La FK es CASCADE porque el perfil no sobrevive a la
             * cuenta: un perfil sin dueno es un telefono suelto en una
             * base, y el `showPublico` lo devolveria como error 500.
             */
            $table->id();

            $table->foreignId('user_id')
                ->unique()
                ->constrained('users')
                ->cascadeOnDelete();

            /*
             * El telefono, en formato E.164 sin signos.
             *
             * Se guarda normalizado y no como lo escribe la persona:
             * "+506 8888-1234" y "+50688881234" son el mismo numero y
             * un buscador por telefono los trataria como dos. La
             * normalizacion va en el request.
             */
            $table->string('phone', 20)->nullable();

            /*
             * El interruptor de privacidad. RF-1.5 lo pide de forma
             * explicita: "el telefono no se expone si el arrendador lo
             * marca privado".
             *
             * El default es **privado**. Es la opcion que falla
             * peor si se olvida: un default publico expone el telefono
             * de alguien que no quiso, y ahi no hay forma de saber
             * quienes quedaron asi. Quien quiera el telefono publico lo
             * decide, no al registrarse.
             */
            $table->boolean('phone_private')->default(true);

            $table->string('photo_path', 255)->nullable();

            $table->string('bio', 400)->nullable();

            /*
             * Los anos de experiencia, nullable y no `0`.
             *
             * `0` significa "cero anos"; `null` significa "no lo dice".
             * Con un default en 0, medio mundo aparece como alguien
             * que empieza hoy y nadie puede distinguirlo de alguien que
             * no lleno el campo.
             */
            $table->unsignedTinyInteger('years_experience')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landlord_profiles');
    }
};
