<?php

declare(strict_types=1);

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Query\Expression;
use Illuminate\Support\Facades\DB;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\Currency;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Enums\PropertyType;
use Modules\Properties\Models\Property;

/**
 * @extends Factory<Property>
 */
class PropertyFactory extends Factory
{
    /**
     * @var class-string<Property>
     */
    protected $model = Property::class;

    /**
     * Distritos de San Carlos con su centro aproximado.
     *
     * Las direcciones en Costa Rica son descriptivas ("200 m norte de
     * la gasolinera") y no se pueden geocodificar de forma fiable, asi
     * que estos centros son aproximados y solo sirven para desarrollo.
     *
     * @var array<string, array{latitude: float, longitude: float}>
     */
    private const DISTRITOS = [
        'Ciudad Quesada' => ['latitude' => 10.3236, 'longitude' => -84.4274],
        'San Carlos' => ['latitude' => 10.3733, 'longitude' => -84.4658],
        'Zarcero' => ['latitude' => 10.4775, 'longitude' => -84.3925],
        'Grecia' => ['latitude' => 10.0897, 'longitude' => -84.3167],
        'Aguas Zarcas' => ['latitude' => 10.4931, 'longitude' => -84.5167],
        'Pital' => ['latitude' => 10.4433, 'longitude' => -84.4439],
        'La Fortuna' => ['latitude' => 10.4678, 'longitude' => -84.6450],
        'Florencia' => ['latitude' => 10.5047, 'longitude' => -84.4731],
    ];

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $distrito = $this->faker->randomElement(array_keys(self::DISTRITOS));
        $centro = self::DISTRITOS[$distrito];
        $esDolar = $this->faker->boolean(25);

        return [
            /*
             * Toda publicacion tiene dueno.
             *
             * Se crea una cuenta de arrendador por propiedad en vez de
             * compartir una, porque las pruebas de autorizacion
             * comparan "este inmueble es de este dueno" y un dueno
             * compartido haria que dos pruebas se pisen.
             */
            'user_id' => User::factory()->landlord(),

            'title' => $this->faker->sentence(4),
            'description' => $this->faker->paragraph(),
            'type' => $this->faker->randomElement(PropertyType::cases()),
            'monthly_rent' => $esDolar
                ? $this->faker->numberBetween(180, 900)
                : $this->faker->numberBetween(120_000, 650_000),
            'currency' => $esDolar ? Currency::Dolar : Currency::Colon,
            'deposit' => $this->faker->numberBetween(50_000, 400_000),
            'bedrooms' => $this->faker->numberBetween(1, 4),
            'bathrooms' => $this->faker->numberBetween(1, 3),
            'parking_spaces' => $this->faker->numberBetween(0, 2),
            'furnished' => $this->faker->boolean(45),
            'pets_allowed' => $this->faker->boolean(60),
            'includes_water' => true,
            'includes_electricity' => $this->faker->boolean(80),
            'includes_internet' => $this->faker->boolean(75),
            'available_from' => $this->faker->dateTimeBetween('now', '+3 months'),
            'rules' => $this->faker->optional()->sentence(),
            'status' => PropertyStatus::Activa,
            'address_reference' => $this->faker->numberBetween(50, 800).' m norte del centro de '.$distrito,
            'district' => $distrito,
            'neighborhood' => $this->faker->randomElement(['Centro', 'El Tanque', 'Los Angeles', 'La Pradera']),
            'show_exact_location' => true,

            // Radio de 4 km alrededor del centro del distrito para que
            // los puntos de prueba sean coherentes con la zona.
            'location' => DB::raw(sprintf(
                'ST_SRID(POINT(%F, %F), 4326)',
                $centro['longitude'] + $this->faker->randomFloat(4, -0.036, 0.036),
                $centro['latitude'] + $this->faker->randomFloat(4, -0.036, 0.036),
            )),
        ];
    }

    /**
     * De otro dueno, para probar autorizacion. RF-2.1.
     */
    public function de(User $dueno): static
    {
        return $this->state(fn (array $attributes): array => [
            'user_id' => $dueno->getKey(),
        ]);
    }

    public function borrador(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => PropertyStatus::Borrador,
        ]);
    }

    public function activa(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => PropertyStatus::Activa,
        ]);
    }

    public function alquilada(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => PropertyStatus::Alquilada,
        ]);
    }

    public function enColones(): static
    {
        return $this->state(fn (array $attributes): array => [
            'currency' => Currency::Colon,
            'monthly_rent' => $this->faker->numberBetween(120_000, 650_000),
            'deposit' => $this->faker->numberBetween(50_000, 400_000),
        ]);
    }

    public function enDolares(): static
    {
        return $this->state(fn (array $attributes): array => [
            'currency' => Currency::Dolar,
            'monthly_rent' => $this->faker->numberBetween(180, 900),
            'deposit' => $this->faker->numberBetween(150, 900),
        ]);
    }

    public function tipo(PropertyType $tipo): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => $tipo,
        ]);
    }

    /**
     * Punto dentro de un radio concreto alrededor de un punto.
     *
     * Lo usan los tests de RF-3.3, que necesitan saber de antemano
     * cuantas propiedades deberian caer dentro del circulo.
     */
    public function cercaDe(float $latitude, float $longitude, float $metros = 500): static
    {
        return $this->state(fn (array $attributes): array => [
            'location' => $this->puntoEnCoordenadas($latitude, $longitude, $metros),
        ]);
    }

    /**
     * Punto claramente fuera de un radio, para el caso negativo.
     */
    public function lejosDe(float $latitude, float $longitude, float $metros = 50_000): static
    {
        return $this->state(fn (array $attributes): array => [
            'location' => $this->puntoEnCoordenadas($latitude, $longitude, $metros),
        ]);
    }

    /**
     * Coloca el pin exactamente en el centro indicado, sin dispersion.
     *
     * MySQL exige el orden (longitud, latitud) en POINT() para SRID
     * 4326. Invertirlo no lanza error: mueve el punto al hemisferio
     * equivocado, a ~11 000 km de donde deberia.
     */
    public function placePin(float $latitude, float $longitude): static
    {
        return $this->state(fn (array $attributes): array => [
            'location' => DB::raw(
                sprintf('ST_SRID(POINT(%F, %F), 4326)', $longitude, $latitude)
            ),
        ]);
    }

    /**
     * @return Expression
     */
    private function puntoEnCoordenadas(float $latitude, float $longitude, float $metros)
    {
        return DB::raw(sprintf(
            'ST_SRID(POINT(%F, %F), 4326)',
            $longitude + $this->faker->randomFloat(6, -$metros / 100_000, $metros / 100_000),
            $latitude + $this->faker->randomFloat(6, -$metros / 100_000, $metros / 100_000),
        ));
    }
}
