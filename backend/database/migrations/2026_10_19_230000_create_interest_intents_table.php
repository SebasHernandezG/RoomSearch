<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Intento de crear una solicitud de "Me interesa". RF-5.6.
 *
 * Se registra cada intento (exitoso o no) para detectar patrones
 * abusivos y aplicar el limite diario. No es un log de auditoria:
 * se borra o se rota periodicamente porque solo sirve para el
 * conteo del dia en curso.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interest_intents', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('ip_address', 45);

            $table->foreignId('property_id')
                ->nullable()
                ->constrained('properties')
                ->nullOnDelete();

            $table->timestamps();

            /*
             * Limite diario por usuario: cuantos intereses intento
             * crear hoy este usuario.
             */
            $table->index(['user_id', 'created_at'], 'interest_intents_usuario_dia');

            /*
             * Limite diario por IP: para cuentas sin sesion.
             */
            $table->index(['ip_address', 'created_at'], 'interest_intents_ip_dia');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interest_intents');
    }
};
