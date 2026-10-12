<?php

declare(strict_types=1);

namespace Modules\Properties\Support;

/**
 * El punto que se revela de una publicacion. RF-2.5.
 *
 * Es una regla de dominio, no de presentacion: cuando el arrendador
 * no autoriza mostrar la ubicacion exacta, el punto publico se
 * desplaza de forma determinista y estable.
 *
 * Por que NO basta con ocultar el campo en el Resource: el dato sale
 * de la base de datos de todas formas. Si la API devuelve la
 * coordenada real, cualquiera que llame al endpoint la tiene.
 *
 * Por que el desplazamiento es determinista y no aleatorio: si
 * variara en cada respuesta, el marcador daria saltos cada vez que se
 * actualiza la lista, y la direccion aproximada seria distinta segun
 * quien mirara.
 */
final readonly class PropertyLocation
{
    /**
     * 0.0025 grados son unos 280 m: suficiente para proteger la casa
     * sin sacar el marcador del barrio.
     */
    private const DESPLAZAMIENTO = 0.0025;

    /**
     * La distancia solo se revela en multiplos de este valor cuando el
     * pin no es exacto.
     *
     * MySQL calcula la distancia contra la posicion verdadera, porque
     * el radio tiene que filtrar sobre el lugar real. Pero devolverla
     * tal cual anula RF-2.5: con un punto de referencia mobile,
     * `distance_meters` permite triangular la casa exacta por
     * bisección, sin importar que el marcador salga corrido.
     *
     * Redondear a 250 m deja un error de +-125 m, menor que el propio
     * desplazamiento del marcador, asi que la distancia no revela mas
     * de lo que el marcador ya muestra.
     */
    private const PASO_DISTANCIA = 250;

    public function __construct(
        public ?float $latitud,
        public ?float $longitud,
        public bool $exacto,
    ) {}

    /**
     * Construye desde los valores crudos de la columna POINT.
     */
    public static function desdePunto(?float $latitud, ?float $longitud, bool $exacto): self
    {
        if ($latitud === null || $longitud === null) {
            return new self(null, null, $exacto);
        }

        if ($exacto) {
            return new self($latitud, $longitud, true);
        }

        $semilla = fmod(abs($latitud * 1000 + $longitud), 100.0);

        return new self(
            round($latitud + self::ruido($semilla), 6),
            round($longitud + self::ruido($semilla + 0.5), 6),
            false,
        );
    }

    /**
     * Desplazamiento estable en el rango [-1, 1].
     *
     * El fmod de la semilla la deja en [0, 100): con valores grandes
     * sin(), sin() pierde precision y dos inmuebles cercanos podrian
     * acabar con el mismo desplazamiento.
     */
    private static function ruido(float $semilla): float
    {
        $valor = sin($semilla * 12.9898) * 43758.5453;
        $fraccion = $valor - floor($valor);

        return ($fraccion * 2 - 1) * self::DESPLAZAMIENTO;
    }

    /**
     * @return array{latitude: float|null, longitude: float|null}
     */
    public function paraApi(): array
    {
        return [
            'latitude' => $this->latitud,
            'longitude' => $this->longitud,
        ];
    }

    public function tienePunto(): bool
    {
        return $this->latitud !== null && $this->longitud !== null;
    }

    /**
     * La distancia que se puede mostrar sin delatar la ubicacion.
     *
     * @param  int|float|null  $metros  distancia real, calculada por MySQL
     */
    public function distanciaRevelable(int|float|null $metros): ?int
    {
        if ($metros === null) {
            return null;
        }

        if ($this->exacto) {
            return (int) round((float) $metros);
        }

        return (int) (round((float) $metros / self::PASO_DISTANCIA) * self::PASO_DISTANCIA);
    }
}
