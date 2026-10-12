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
     * El seeder de inmuebles va primero: sin propiedades el mapa abre
     * vacio y no hay forma de revisar la busqueda por radio.
     */
    public function run(): void
    {
        $this->call(PropertySeeder::class);

        $this->call(CuentasSeeder::class);
    }
}
