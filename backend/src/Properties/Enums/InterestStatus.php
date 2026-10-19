<?php

declare(strict_types=1);

namespace Modules\Properties\Enums;

/**
 * El estado de una solicitud de "Me interesa". RF-5.1.
 *
 * ## Por que el estado no se deduce de si hay respuesta
 *
 * Porque "respondida" y "descartada" son cosas distintas y las dos
 * tienen `reply`. Un dueno que descarta con un motivo --"ya lo
 * alquile, gracias"-- tambien escribe. Si el estado fuera "¿tiene
 * `reply`?", las dos quedarian iguales y la bandeja no podria
 * distinguir "no contesto todavia" de "no voy a contestar nunca".
 *
 * La diferencia importa para la otra punta: quien espera una
 * respuesta necesita saber si sigue en cola o si ya la tiene.
 *
 * ## Por que `Descartada` tiene `reply` opcional
 *
 * Porque el motivo es lo mas util de un descarte, y no todos lo dan.
 * Un descarte sin motivo sigue siendo valido; el frontend muestra el
 * motivo si viene y "descartada" si no.
 */
enum InterestStatus: string
{
    case Nueva = 'nueva';
    case Respondida = 'respondida';
    case Descartada = 'descartada';

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            self::Nueva->value => 'Nueva',
            self::Respondida->value => 'Respondida',
            self::Descartada->value => 'Descartada',
        ];
    }

    /**
     * Si es una solicitud que el dueno todavia no miro.
     *
     * Es lo que cuenta el badge. Una respondida ya se vio: no puede
     * seguir en la bandeja como si fuera nueva, o el numero nunca baja
     * y el badge deja de significar nada.
     */
    public function isUnread(): bool
    {
        return $this === self::Nueva;
    }

    /**
     * Si ya no espera nada.
     *
     * El boton de "Me interesa" se pone en este estado en la ficha: no
     * tiene sentido volver a preguntar por un anuncio que ya se
     * respondio, y menos por uno que se descarto.
     */
    public function isClosed(): bool
    {
        return $this !== self::Nueva;
    }
}
