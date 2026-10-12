<?php

declare(strict_types=1);

namespace Modules\Properties\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Properties\Enums\Currency;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Enums\PropertyType;
use Modules\Properties\Models\Property;

/**
 * Inmuebles de demostracion del cantón de San Carlos.
 *
 * Sirve para revisar el mapa con datos de verdad en vez de con los
 * cuatro registros del factory. Sin esto no hay forma de comprobar de
 * punta a punta que el radio, el orden por distancia y el
 * desplazamiento de RF-2.5 funcionan.
 *
 *     php artisan db:seed --class=PropertySeeder
 *
 * Los puntos se reparten en los ocho distritos del canton. Solo los de
 * Ciudad Quesada caen dentro del radio inicial de 1 km del mapa: los
 * demas aparecen al mover la zona, que es justo lo que RF-3.3 pide.
 */
class PropertySeeder extends Seeder
{
    /**
     * Cada fila es un inmueble completo. Los campos van con nombre y
     * no por posicion: con nueve elementos en orden, un error de
     * tipeo se descubre tarde y en silencio.
     *
     * @var list<array{
     *     titulo: string,
     *     distrito: string,
     *     barrio: string,
     *     tipo: PropertyType,
     *     precio: int,
     *     moneda: Currency,
     *     habitaciones: int,
     *     banos: int,
     *     lat: float,
     *     lng: float
     * }>
     */
    private const INMUEBLES = [
        [
            'titulo' => 'Apartamento luminoso a dos cuadras de la UTN',
            'distrito' => 'Ciudad Quesada', 'barrio' => 'Centro',
            'tipo' => PropertyType::Apartamento, 'precio' => 280_000, 'moneda' => Currency::Colon,
            'habitaciones' => 2, 'banos' => 1, 'lat' => 10.3236, 'lng' => -84.4274,
        ],
        [
            'titulo' => 'Habitación amplia en casa familiar',
            'distrito' => 'Ciudad Quesada', 'barrio' => 'Rincón de Jobs',
            'tipo' => PropertyType::Habitacion, 'precio' => 120_000, 'moneda' => Currency::Colon,
            'habitaciones' => 1, 'banos' => 1, 'lat' => 10.3300, 'lng' => -84.4180,
        ],
        [
            'titulo' => 'Apartamento de una habitación, nuevo',
            'distrito' => 'Ciudad Quesada', 'barrio' => 'Los Álamos',
            'tipo' => PropertyType::Apartamento, 'precio' => 265_000, 'moneda' => Currency::Colon,
            'habitaciones' => 1, 'banos' => 1, 'lat' => 10.3180, 'lng' => -84.4330,
        ],
        [
            'titulo' => 'Casa para familia cerca del hospital',
            'distrito' => 'Ciudad Quesada', 'barrio' => 'San Gerardo',
            'tipo' => PropertyType::Casa, 'precio' => 410_000, 'moneda' => Currency::Colon,
            'habitaciones' => 3, 'banos' => 2, 'lat' => 10.3400, 'lng' => -84.4400,
        ],
        [
            'titulo' => 'Apartamento frente al parque central',
            'distrito' => 'Ciudad Quesada', 'barrio' => 'Centro',
            'tipo' => PropertyType::Apartamento, 'precio' => 320_000, 'moneda' => Currency::Colon,
            'habitaciones' => 2, 'banos' => 2, 'lat' => 10.3250, 'lng' => -84.4290,
        ],
        [
            'titulo' => 'Apartamento con vista al valle',
            'distrito' => 'Ciudad Quesada', 'barrio' => 'Barva',
            'tipo' => PropertyType::Apartamento, 'precio' => 295_000, 'moneda' => Currency::Colon,
            'habitaciones' => 2, 'banos' => 1, 'lat' => 10.3270, 'lng' => -84.4350,
        ],
        [
            'titulo' => 'Habitación con escritorio y wifi',
            'distrito' => 'San Carlos', 'barrio' => 'California',
            'tipo' => PropertyType::Habitacion, 'precio' => 145_000, 'moneda' => Currency::Colon,
            'habitaciones' => 1, 'banos' => 1, 'lat' => 10.3733, 'lng' => -84.4658,
        ],
        [
            'titulo' => 'Casa pequeña para una persona',
            'distrito' => 'San Carlos', 'barrio' => 'San Marcos',
            'tipo' => PropertyType::Casa, 'precio' => 260_000, 'moneda' => Currency::Colon,
            'habitaciones' => 1, 'banos' => 1, 'lat' => 10.3700, 'lng' => -84.4600,
        ],
        [
            'titulo' => 'Apartamento con balcón',
            'distrito' => 'Zarcero', 'barrio' => 'Los Ángeles',
            'tipo' => PropertyType::Apartamento, 'precio' => 195_000, 'moneda' => Currency::Colon,
            'habitaciones' => 2, 'banos' => 1, 'lat' => 10.4775, 'lng' => -84.3925,
        ],
        [
            'titulo' => 'Habitación amplia cerca del parque',
            'distrito' => 'Zarcero', 'barrio' => 'Cerro Blanco',
            'tipo' => PropertyType::Habitacion, 'precio' => 155_000, 'moneda' => Currency::Colon,
            'habitaciones' => 1, 'banos' => 1, 'lat' => 10.4790, 'lng' => -84.3900,
        ],
        [
            'titulo' => 'Casa con patio en Aguas Zarcas',
            'distrito' => 'Aguas Zarcas', 'barrio' => 'San Isidro',
            'tipo' => PropertyType::Casa, 'precio' => 520_000, 'moneda' => Currency::Colon,
            'habitaciones' => 3, 'banos' => 2, 'lat' => 10.4931, 'lng' => -84.5167,
        ],
        [
            'titulo' => 'Apartamento remodelado',
            'distrito' => 'Aguas Zarcas', 'barrio' => 'San Luis',
            'tipo' => PropertyType::Apartamento, 'precio' => 275_000, 'moneda' => Currency::Colon,
            'habitaciones' => 2, 'banos' => 2, 'lat' => 10.4900, 'lng' => -84.5200,
        ],
        [
            'titulo' => 'Estudio amoblado para una persona',
            'distrito' => 'Grecia', 'barrio' => 'La Pradera',
            'tipo' => PropertyType::Estudio, 'precio' => 240, 'moneda' => Currency::Dolar,
            'habitaciones' => 0, 'banos' => 1, 'lat' => 10.0897, 'lng' => -84.3167,
        ],
        [
            'titulo' => 'Estudio con cocina equipada',
            'distrito' => 'Grecia', 'barrio' => 'Centro',
            'tipo' => PropertyType::Estudio, 'precio' => 210, 'moneda' => Currency::Dolar,
            'habitaciones' => 0, 'banos' => 1, 'lat' => 10.0910, 'lng' => -84.3150,
        ],
        [
            'titulo' => 'Apartamento con parqueo en Pital',
            'distrito' => 'Pital', 'barrio' => 'Buenos Aires',
            'tipo' => PropertyType::Apartamento, 'precio' => 230_000, 'moneda' => Currency::Colon,
            'habitaciones' => 2, 'banos' => 2, 'lat' => 10.4433, 'lng' => -84.4439,
        ],
        [
            'titulo' => 'Casa con patio grande',
            'distrito' => 'Pital', 'barrio' => 'Centro',
            'tipo' => PropertyType::Casa, 'precio' => 350_000, 'moneda' => Currency::Colon,
            'habitaciones' => 3, 'banos' => 2, 'lat' => 10.4450, 'lng' => -84.4450,
        ],
        [
            'titulo' => 'Casa de campo cerca de Florencia',
            'distrito' => 'Florencia', 'barrio' => 'Centro',
            'tipo' => PropertyType::Casa, 'precio' => 450_000, 'moneda' => Currency::Colon,
            'habitaciones' => 3, 'banos' => 2, 'lat' => 10.5047, 'lng' => -84.4731,
        ],
        [
            'titulo' => 'Casa de alquiler en La Fortuna',
            'distrito' => 'La Fortuna', 'barrio' => 'San Rafael',
            'tipo' => PropertyType::Casa, 'precio' => 380, 'moneda' => Currency::Dolar,
            'habitaciones' => 2, 'banos' => 1, 'lat' => 10.4700, 'lng' => -84.6400,
        ],
        [
            'titulo' => 'Habitación cerca del parque nacional',
            'distrito' => 'La Fortuna', 'barrio' => 'El Tanque',
            'tipo' => PropertyType::Habitacion, 'precio' => 160_000, 'moneda' => Currency::Colon,
            'habitaciones' => 1, 'banos' => 1, 'lat' => 10.4678, 'lng' => -84.6450,
        ],
    ];

    public function run(): void
    {
        foreach (self::INMUEBLES as $indice => $datos) {
            $this->publicar($datos, $indice)->save();
        }

        $this->command?->info(sprintf(
            '  %d inmuebles de San Carlos sembrados (%d en Ciudad Quesada).',
            count(self::INMUEBLES),
            $this->cuantasEn('Ciudad Quesada'),
        ));
    }

    /**
     * @param  array{
     *     titulo: string, distrito: string, barrio: string,
     *     tipo: PropertyType, precio: int, moneda: Currency,
     *     habitaciones: int, banos: int, lat: float, lng: float
     * }  $datos
     */
    private function publicar(array $datos, int $indice): Property
    {
        return (new Property([
            'title' => $datos['titulo'],
            'description' => $this->descripcion($datos),
            'type' => $datos['tipo'],
            'monthly_rent' => $datos['precio'],
            'currency' => $datos['moneda'],
            'deposit' => $datos['moneda'] === Currency::Dolar
                ? (int) round($datos['precio'] * 1.5)
                : $datos['precio'],
            'bedrooms' => $datos['habitaciones'],
            'bathrooms' => $datos['banos'],
            'parking_spaces' => $indice % 3 === 0 ? 2 : 1,
            'furnished' => $indice % 2 === 0,
            'pets_allowed' => $indice % 4 !== 0,
            'includes_water' => true,
            'includes_electricity' => $indice % 5 !== 0,
            'includes_internet' => true,
            'available_from' => now()->addDays($indice % 30),
            'rules' => $indice % 4 === 0 ? 'Sin mascotas.' : null,
            'status' => PropertyStatus::Activa,
            'address_reference' => $this->referencia($datos['distrito']),
            'district' => $datos['distrito'],
            'neighborhood' => $datos['barrio'],

            // Uno de cada seis hides el pin. Sirve para revisar RF-2.5
            // en el mapa: esos marcadores deben salir corridos.
            'show_exact_location' => $indice % 6 !== 0,
        ]))->placePin($datos['lat'], $datos['lng']);
    }

    /**
     * @param  array{distrito: string, barrio: string}  $datos
     */
    private function descripcion(array $datos): string
    {
        return sprintf(
            '%s en %s, a minutos del centro y con acceso a transporte público. '
            .'Ideal para quien busca comodidad sin pagar alquiler de ciudad grande.',
            $datos['barrio'],
            $datos['distrito'],
        );
    }

    /**
     * Referencias al estilo local: distancia y punto de referencia, sin
     * calle ni numero. La direccion exacta la decide el pin.
     */
    private function referencia(string $distrito): string
    {
        $metros = 100 + (random_int(1, 8) * 25);
        $direccion = ['norte', 'sur', 'este', 'oeste'][random_int(0, 3)];
        $ancla = ['la gasolinera', 'el parque central', 'la iglesia', 'el mercado', 'la escuela'][random_int(0, 4)];

        return sprintf('%d m %s de %s, %s', $metros, $direccion, $ancla, $distrito);
    }

    private function cuantasEn(string $distrito): int
    {
        return count(array_filter(
            self::INMUEBLES,
            fn (array $datos): bool => $datos['distrito'] === $distrito,
        ));
    }
}
