<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Unit;

use Modules\Properties\Enums\Currency;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Enums\PropertyType;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Reglas de dominio que no dependen de la base de datos.
 */
class PropertyEnumsTest extends TestCase
{
    #[Test]
    public function un_estudio_no_admite_habitaciones(): void
    {
        $this->assertFalse(PropertyType::Estudio->allowsBedrooms());

        foreach ([PropertyType::Apartamento, PropertyType::Casa, PropertyType::Habitacion] as $tipo) {
            $this->assertTrue($tipo->allowsBedrooms(), "{$tipo->value} si admite habitaciones");
        }
    }

    /**
     * La tabla de transiciones de RF-2.6. Sin esto una publicacion
     * podria volver de 'alquilada' a 'borrador' saltandose la moderacion.
     */
    #[Test]
    #[DataProvider('transicionesValidas')]
    public function transiciones_validas(PropertyStatus $desde, PropertyStatus $hacia): void
    {
        $this->assertTrue($desde->canTransitionTo($hacia));
    }

    /**
     * @return array<string, array{PropertyStatus, PropertyStatus}>
     */
    public static function transicionesValidas(): array
    {
        return [
            'borrador a pendiente' => [PropertyStatus::Borrador, PropertyStatus::Pendiente],
            'borrador a activa' => [PropertyStatus::Borrador, PropertyStatus::Activa],
            'pendiente a activa' => [PropertyStatus::Pendiente, PropertyStatus::Activa],
            'pendiente a borrador' => [PropertyStatus::Pendiente, PropertyStatus::Borrador],
            'activa a pausada' => [PropertyStatus::Activa, PropertyStatus::Pausada],
            'activa a alquilada' => [PropertyStatus::Activa, PropertyStatus::Alquilada],
            'pausada a activa' => [PropertyStatus::Pausada, PropertyStatus::Activa],
            'pausada a alquilada' => [PropertyStatus::Pausada, PropertyStatus::Alquilada],
            'alquilada a activa' => [PropertyStatus::Alquilada, PropertyStatus::Activa],
        ];
    }

    #[Test]
    #[DataProvider('transicionesInvalidas')]
    public function transiciones_invalidas(PropertyStatus $desde, PropertyStatus $hacia): void
    {
        $this->assertFalse($desde->canTransitionTo($hacia));
    }

    /**
     * @return array<string, array{PropertyStatus, PropertyStatus}>
     */
    public static function transicionesInvalidas(): array
    {
        return [
            'borrador no se alquila' => [PropertyStatus::Borrador, PropertyStatus::Alquilada],
            'borrador no se pausa' => [PropertyStatus::Borrador, PropertyStatus::Pausada],
            'activa no vuelve a borrador' => [PropertyStatus::Activa, PropertyStatus::Borrador],
            'activa no va a pendiente' => [PropertyStatus::Activa, PropertyStatus::Pendiente],
            'alquilada no vuelve a borrador' => [PropertyStatus::Alquilada, PropertyStatus::Borrador],
            'alquilada no se pausa' => [PropertyStatus::Alquilada, PropertyStatus::Pausada],
        ];
    }

    #[Test]
    public function solo_activa_es_publica(): void
    {
        $this->assertTrue(PropertyStatus::Activa->isPubliclyVisible());

        foreach ([
            PropertyStatus::Borrador,
            PropertyStatus::Pendiente,
            PropertyStatus::Pausada,
            PropertyStatus::Alquilada,
        ] as $estado) {
            $this->assertFalse($estado->isPubliclyVisible(), "{$estado->value} no deberia ser publica");
        }
    }

    #[Test]
    public function el_precio_se_formatea_con_simbolo_y_miles(): void
    {
        $this->assertSame('₡280,000', Currency::Colon->format(280000));
        $this->assertSame('US$450', Currency::Dolar->format(450));
    }

    #[Test]
    public function los_enums_exponen_etiquetas_en_espanol(): void
    {
        $this->assertSame('Habitación', PropertyType::options()['habitacion']);
        $this->assertSame('Pendiente de revisión', PropertyStatus::options()['pendiente']);
        $this->assertSame('Colones (₡)', Currency::options()['CRC']);
    }
}
