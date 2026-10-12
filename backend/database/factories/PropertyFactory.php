<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Properties\Models\Property;

/**
 * @extends Factory<Property>
 */
class PropertyFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<Property>
     */
    protected $model = Property::class;

    /**
     * Define the model's default state.
     *
     * Los campos de la tabla se anaden en RF-2.2. Se declara aqui el
     * nombre explicito para que la migracion de modulo no rompa la
     * convencion de Laravel.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            //
        ];
    }
}
