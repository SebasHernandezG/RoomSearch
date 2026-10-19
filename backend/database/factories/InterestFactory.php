<?php

declare(strict_types=1);

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\InterestStatus;
use Modules\Properties\Models\Interest;
use Modules\Properties\Models\Property;

/**
 * @extends Factory<Interest>
 */
class InterestFactory extends Factory
{
    /**
     * @var class-string<Interest>
     */
    protected $model = Interest::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'property_id' => Property::factory(),
            'user_id' => User::factory()->tenant(),

            /*
             * El mensaje tiene que sonar a algo que dijo una persona.
             *
             * Con un `lorem` no se ve si la interfaz aguanta un texto
             * largo --y este es el campo mas largo de la bandeja-- ni
             * uno con acentos, que es lo habitual.
             */
            'message' => 'Hola, ¿sigue disponible? Me mudaría en marzo, puedo dar referencias del anterior alquiler.',

            'reply' => null,
            'replied_at' => null,
            'status' => InterestStatus::Nueva,
        ];
    }

    /**
     * Una solicitud a la que el dueno ya contesto.
     */
    public function respondida(): static
    {
        return $this->state(fn (array $atributos): array => [
            'status' => InterestStatus::Respondida,
            'reply' => 'Sí, sigue disponible. Escribeme al 8888-1234 para coordinar una visita.',
            'replied_at' => now()->subDay(),
        ]);
    }

    /**
     * Una solicitud que el dueno cerro.
     */
    public function descartada(): static
    {
        return $this->state(fn (array $atributos): array => [
            'status' => InterestStatus::Descartada,
            'reply' => 'Gracias por escribir, pero el inmueble ya está alquilado.',
            'replied_at' => now()->subDays(3),
        ]);
    }

    /**
     * Una solicitud sin respuesta del dueno.
     *
     * Es el estado por defecto de `definition()`, y aun asi tiene
     * estado explicito: una prueba que dice "nueva" y lo quiere decir
     * sobrevive a que el default cambie.
     */
    public function nueva(): static
    {
        return $this->state(fn (array $atributos): array => [
            'status' => InterestStatus::Nueva,
            'reply' => null,
            'replied_at' => null,
        ]);
    }
}
