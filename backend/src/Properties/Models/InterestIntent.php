<?php

declare(strict_types=1);

namespace Modules\Properties\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Intento de crear una solicitud de "Me interesa". RF-5.6.
 *
 * Se registra cada intento para aplicar el limite diario y
 * detectar patrones abusivos (anti-spam).
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $ip_address
 * @property int|null $property_id
 */
#[Fillable(['user_id', 'ip_address', 'property_id'])]
class InterestIntent extends Model
{
    public $timestamps = true;

    /**
     * Cuantos intentos hizo este usuario hoy (fecha local).
     */
    public static function intentosHoyDeUsuario(int $usuarioId): int
    {
        return self::query()
            ->where('user_id', $usuarioId)
            ->whereDate('created_at', today())
            ->count();
    }

    /**
     * Cuantos intentos hizo esta IP hoy (fecha local).
     */
    public static function intentosHoyDeIp(string $ip): int
    {
        return self::query()
            ->where('ip_address', $ip)
            ->where('user_id', null)
            ->whereDate('created_at', today())
            ->count();
    }

    /**
     * Registra un intento y devuelve si esta dentro del limite diario.
     *
     * @return array{dentroDelLimite: bool, intentos: int, limite: int}
     */
    public static function registrarIntento(
        ?int $usuarioId,
        string $ip,
        ?int $propertyId,
        int $limiteDiario = 10,
    ): array {
        self::create([
            'user_id' => $usuarioId,
            'ip_address' => $ip,
            'property_id' => $propertyId,
        ]);

        $intentos = $usuarioId !== null
            ? self::intentosHoyDeUsuario($usuarioId)
            : self::intentosHoyDeIp($ip);

        return [
            'dentroDelLimite' => $intentos <= $limiteDiario,
            'intentos' => $intentos,
            'limite' => $limiteDiario,
        ];
    }
}
