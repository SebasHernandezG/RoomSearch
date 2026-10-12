<?php

declare(strict_types=1);

namespace Modules\Properties\Enums;

/**
 * Moneda del alquiler. RF-2.2 y RNF-14.
 *
 * Se guardan como ISO 4217: CRC para colones y USD para dolares.
 */
enum Currency: string
{
    case Colon = 'CRC';
    case Dolar = 'USD';

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            self::Colon->value => 'Colones (₡)',
            self::Dolar->value => 'Dólares (US$)',
        ];
    }

    /**
     * Simbolo para la interfaz. El documento exige que el precio se
     * lea de un vistazo y con el formato local (DS-5).
     */
    public function symbol(): string
    {
        return match ($this) {
            self::Colon => '₡',
            self::Dolar => 'US$',
        };
    }

    /**
     * Formatea un monto con el separador de miles costarricense.
     *
     * Sin usar number_format porque fija el punto decimal, y aqui
     * los precios son enteros.
     */
    public function format(int|float $amount): string
    {
        $formatted = number_format($amount, 0, '.', ',');

        return $this->symbol().$formatted;
    }
}
