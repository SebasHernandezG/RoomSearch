<?php

declare(strict_types=1);

namespace Modules\Properties\Enums;

/**
 * Tipo de inmueble. RF-2.2.
 *
 * Los valores se guardan tal cual en la base de datos, asi que
 * renombrarlos despues exige una migracion.
 */
enum PropertyType: string
{
    case Apartamento = 'apartamento';
    case Casa = 'casa';
    case Habitacion = 'habitacion';
    case Estudio = 'estudio';

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            self::Apartamento->value => 'Apartamento',
            self::Casa->value => 'Casa',
            self::Habitacion->value => 'Habitación',
            self::Estudio->value => 'Estudio',
        ];
    }

    /**
     * Un estudio no tiene cocina ni se amuebla como una casa.
     * Se usa para validar la combinacion de caracteristicas.
     */
    public function allowsBedrooms(): bool
    {
        return $this !== self::Estudio;
    }
}
