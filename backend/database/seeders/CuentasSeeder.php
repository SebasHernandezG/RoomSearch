<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Identity\Enums\UserRole;
use Modules\Identity\Models\User;

/**
 * Cuentas de demostracion, una por rol. RF-1.4.
 *
 * Sirven para revisar la autorizacion sin tener que crear cuentas a
 * mano cada vez. Las contrasenas son las de development y estan en el
 * codigo a proposito: estas cuentas nunca llegan a produccion porque
 * `db:seed --class=CuentasSeeder` no se ejecuta ahi.
 *
 * Si alguna vez se corre en un entorno real, esto es lo primero que
 * hay que borrar.
 */
class CuentasSeeder extends Seeder
{
    /**
     * @var list<array{0: string, 1: string, 2: UserRole}>
     */
    private const CUENTAS = [
        ['Yeri Administrador', 'admin@roomies.test', UserRole::Admin],
        ['Yeri Arrendadora', 'landlord@roomies.test', UserRole::Landlord],
        ['Yeri Inquilino', 'tenant@roomies.test', UserRole::Tenant],
    ];

    public function run(): void
    {
        foreach (self::CUENTAS as [$nombre, $correo, $rol]) {
            User::factory()->create([
                'name' => $nombre,
                'email' => $correo,
                'role' => $rol,
            ]);
        }

        $this->command?->info(sprintf(
            '  %d cuentas de demostracion (contrasena: "password").',
            count(self::CUENTAS),
        ));
    }
}
