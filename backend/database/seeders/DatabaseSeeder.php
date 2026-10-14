<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Modules\Properties\Database\Seeders\PropertySeeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Cuentas primero: las publicaciones tienen dueno, y el dueno
     * tiene que existir antes de que se siembren.
     */
    public function run(): void
    {
        $this->call(CuentasSeeder::class);

        $this->call(PropertySeeder::class);
    }
}
