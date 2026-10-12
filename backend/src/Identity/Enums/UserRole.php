<?php

declare(strict_types=1);

namespace Modules\Identity\Enums;

/**
 * Rol de la persona. RF-1.4.
 *
 * Los valores se guardan tal cual en la base, asi que renombrarlos
 * despues exige una migracion.
 */
enum UserRole: string
{
    /*
     * Sin cuenta. NO es un rol que se guarde en la tabla: nadie esta
     * autenticado y no hay fila. Existe en el enum porque las reglas de
     * autorizacion lo necesitan: un visitante puede buscar y ver el
     * mapa (RF-3.1), y ese caso hay que poder nombrarlo.
     *
     * Si alguna vez se guarda, es un bug: significaria que hay una
     * fila para alguien que no se autentico.
     */
    case Visitor = 'visitor';

    case Tenant = 'tenant';

    case Landlord = 'landlord';

    case Admin = 'admin';

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            self::Tenant->value => 'Inquilino',
            self::Landlord->value => 'Arrendador',
            self::Admin->value => 'Administrador',
        ];
    }

    /**
     * El rol con el que se registra cualquiera. RF-1.4.
     *
     * Landlord no es el default a proposito: publicar housing es la
     * accion con consecuencias (RF-7.1 pide moderacion), asi que el
     * privilege se pide explicitamente, no se concede por crear una
     * cuenta.
     */
    public static function porDefecto(): self
    {
        return self::Tenant;
    }

    /**
     * Si este rol puede crear publicaciones. RF-2.1 y RF-1.4.
     */
    public function puedePublicar(): bool
    {
        return $this === self::Landlord || $this === self::Admin;
    }

    /**
     * Si este rol puede entrar al panel de administracion. RF-7.1.
     */
    public function puedeAdministrar(): bool
    {
        return $this === self::Admin;
    }

    /**
     * Si este rol puede suspender cuentas ajenas. RF-7.2.
     *
     * Deliberadamente mas estrecho que puedeAdministrar(): ver el
     * panel y suspender a alguien no son el mismo privilegio.
     */
    public function puedeSuspenderCuentas(): bool
    {
        return $this === self::Admin;
    }
}
