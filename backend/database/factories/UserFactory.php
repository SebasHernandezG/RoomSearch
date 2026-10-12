<?php

declare(strict_types=1);

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Modules\Identity\Enums\UserRole;
use Modules\Identity\Models\User;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * El modelo vive en el modulo Identity, no en App\Models, asi que
     * la convención de nombre de Laravel no lo encuentra y hay que
     * decirlo. Igual que PropertyFactory.
     *
     * @var class-string<User>
     */
    protected $model = User::class;

    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),

            // Inquilino a proposito: es el rol con menos privilegios, y
            // una prueba que no dice que rol quiere no debe crear
            // cuentas con mas de los necesarios.
            'role' => UserRole::Tenant,
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Indicate that the user is a landlord. RF-1.4.
     */
    public function landlord(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Landlord,
        ]);
    }

    /**
     * Indicate that the user is an administrator. RF-1.4.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Admin,
        ]);
    }

    /**
     * Indicate that the user is a tenant. RF-1.4.
     */
    public function tenant(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Tenant,
        ]);
    }
}
