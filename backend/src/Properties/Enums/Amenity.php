<?php

declare(strict_types=1);

namespace Modules\Properties\Enums;

/**
 * Amenidades de un inmueble. RF-2.2.
 *
 * Se guardan como catalogo independiente en vez de columnas booleanas
 * sueltas porque la lista puede crecer sin tocar el esquema: wifi,
 * aire acondicionado, balcon, etc. Cada propiedad puede tener varias.
 */
enum Amenity: string
{
    case AguaCaliente = 'agua_caliente';
    case AireAcondicionado = 'aire_acondicionado';
    case Balcon = 'balcon';
    case Bbq = 'bbq';
    case Gimnasio = 'gimnasio';
    case Lavadora = 'lavadora';
    case ParqueoTechado = 'parqueo_techado';
    case Piscina = 'piscina';
    case Seguridad24 = 'seguridad_24_horas';
    case Terraza = 'terraza';

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            self::AguaCaliente->value => 'Agua caliente',
            self::AireAcondicionado->value => 'Aire acondicionado',
            self::Balcon->value => 'Balcon',
            self::Bbq->value => 'Area de BBQ',
            self::Gimnasio->value => 'Gimnasio',
            self::Lavadora->value => 'Lavadora',
            self::ParqueoTechado->value => 'Parqueo techado',
            self::Piscina->value => 'Piscina',
            self::Seguridad24->value => 'Seguridad 24 horas',
            self::Terraza->value => 'Terraza',
        ];
    }
}
