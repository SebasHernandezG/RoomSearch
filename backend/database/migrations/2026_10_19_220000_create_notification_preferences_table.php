<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Preferencias de notificacion por usuario. RF-5.4.
 *
 * Cada usuario puede elegir que correos recibe y cuales no.
 * La tabla es aparte de `users` porque las preferencias crecen
 * con el tiempo (nuevos tipos de notificacion) y no conviene
 * ir agregando columnas a la tabla de cuentas.
 *
 * Los default son "sí a todo": al registrarse recibes todo, y
 * das de baja lo que no quieras desde el enlace de cada correo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_preferences', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            /*
             * Correos generales (verificacion, reset de contrasena).
             * Si se apagan, la persona no recibe ni el enlace de
             * verificacion ni el de recuperacion: es suDecision.
             */
            $table->boolean('email_general')->default(true);

            /*
             * Aviso al arrendador cuando llega una solicitud nueva
             * de "Me interesa".
             */
            $table->boolean('interest_new')->default(true);

            /*
             * Aviso al inquilino cuando el arrendador responde
             * o descarta su solicitud.
             */
            $table->boolean('interest_reply')->default(true);

            $table->timestamps();

            /*
             * Una fila por usuario. Sin esto, cada cambio de
             * preferencia duplica la fila y no se sabe cual usar.
             */
            $table->unique('user_id', 'notification_preferences_usuario_unico');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_preferences');
    }
};
