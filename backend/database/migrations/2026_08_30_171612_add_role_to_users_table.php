<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega el rol a la tabla de usuarios. RF-1.4.
 *
 * Esta migracion estaba vacia: el archivo existia y se ejecutaba, pero
 * el cuerpo era `//`. Nadie lo noto porque una migracion que no hace
 * nada pasa igual que una que si.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->enum('role', ['tenant', 'landlord', 'admin'])
                ->default('tenant')
                ->after('password')
                ->comment('RF-1.4. visitor no se guarda: no hay fila sin sesion');
        });

        /*
         * No hace falta un UPDATE para las cuentas que ya existieran:
         * al agregar una columna con default, MySQL les asigna ese
         * valor a todas.
         *
         * El valor por defecto es tenant, que es el rol con menos
         * privilegios, a proposito: dar landlord o admin por omision
         * otorgaria privilegios a cuentas creadas antes de que
         * existiera el concepto de rol.
         */
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('role');
        });
    }
};
