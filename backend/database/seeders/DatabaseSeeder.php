<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Modules\Properties\Database\Seeders\PropertySeeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * El seeder de inmuebles va primero: sin-properties el mapa abre
     * vacio y no hay forma de revisar la busqueda por radio.
     */
    public function run(): void
    {
        $this->call(PropertySeeder::class);

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);
    }
}
