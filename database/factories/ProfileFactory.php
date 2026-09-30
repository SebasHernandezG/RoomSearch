<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Profile>
 */
class ProfileFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'city' => fake()->city(),
            'zone' => fake()->citySuffix(),
            'budget_min' => 300,
            'budget_max' => 700,
            'bio' => fake()->paragraph(),
            'phone' => fake()->phoneNumber(),
        ];
    }
}
