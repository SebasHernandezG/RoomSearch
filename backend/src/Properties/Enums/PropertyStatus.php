<?php

declare(strict_types=1);

namespace Modules\Properties\Enums;

/**
 * Ciclo de vida de una publicacion. RF-2.1 y RF-2.6.
 *
 * Las transiciones validas viven en canTransitionTo(); este enum solo
 * describe los estados. Sin la tabla de transiciones, una publicacion
 * poderia pasar de 'alquilada' a 'borrador' saltandose la moderacion.
 */
enum PropertyStatus: string
{
    case Borrador = 'borrador';
    case Pendiente = 'pendiente';
    case Activa = 'activa';
    case Pausada = 'pausada';
    case Alquilada = 'alquilada';

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            self::Borrador->value => 'Borrador',
            self::Pendiente->value => 'Pendiente de revisión',
            self::Activa->value => 'Activa',
            self::Pausada->value => 'Pausada',
            self::Alquilada->value => 'Alquilada',
        ];
    }

    /**
     * Devuelve true si el estado puede pasar a $next.
     *
     *     borrador  -> pendiente, activa
     *     pendiente -> activa, borrador
     *     activa    -> pausada, alquilada
     *     pausada   -> activa, alquilada
     *     alquilada -> activa (reactivar si el inquilino no concreto)
     */
    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Borrador => $next === self::Pendiente || $next === self::Activa,
            self::Pendiente => $next === self::Activa || $next === self::Borrador,
            self::Activa => $next === self::Pausada || $next === self::Alquilada,
            self::Pausada => $next === self::Activa || $next === self::Alquilada,
            self::Alquilada => $next === self::Activa,
        };
    }

    /**
     * Solo estas aparecem en el listado publico.
     */
    public function isPubliclyVisible(): bool
    {
        return $this === self::Activa;
    }
}
