<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Listing>
 */
class ListingFactory extends Factory
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
            'type' => fake()->randomElement(['offer', 'search']),
            'title' => fake()->sentence(5),
            'description' => fake()->paragraph(),
            'city' => fake()->city(),
            'zone' => fake()->optional()->citySuffix(),
            'budget' => fake()->numberBetween(200, 1500),
            'contact_method' => 'interest',
            'is_active' => true,
        ];
    }
}
