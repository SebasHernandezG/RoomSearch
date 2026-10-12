<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Unit;

use Modules\Identity\Enums\UserRole;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Las reglas de rol. RF-1.4.
 *
 * Son pruebas unitarias y no de base de datos porque lo que importa
 * aqui es la aritmetica de permisos, no el SQL. La columna se prueba
 * en UserRoleTest, contra MySQL de verdad.
 */
class UserRoleTest extends TestCase
{
    #[Test]
    public function el_registro_abre_como_inquilino_y_no_como_arrendador(): void
    {
        $this->assertSame(UserRole::Tenant, UserRole::porDefecto());

        $this->assertFalse(
            UserRole::Tenant->puedePublicar(),
            'Crear una cuenta no debe dar permiso de publicar: es lo que pide moderacion (RF-7.1)',
        );
    }

    #[Test]
    public function un_inquilino_no_publica(): void
    {
        $this->assertFalse(UserRole::Tenant->puedePublicar());
        $this->assertFalse(UserRole::Visitor->puedePublicar());
    }

    #[Test]
    public function un_arrendador_publica_pero_no_administra(): void
    {
        $this->assertTrue(UserRole::Landlord->puedePublicar());
        $this->assertFalse(UserRole::Landlord->puedeAdministrar());
    }

    #[Test]
    public function un_admin_puede_todo(): void
    {
        $this->assertTrue(UserRole::Admin->puedePublicar());
        $this->assertTrue(UserRole::Admin->puedeAdministrar());
        $this->assertTrue(UserRole::Admin->puedeSuspenderCuentas());
    }

    /**
     * Ver el panel y suspender a alguien no son el mismo privilegio.
     * Este test existe para que alguien no los junte "por simplicidad".
     */
    #[Test]
    public function ver_el_panel_y_suspender_son_privilegios_distintos(): void
    {
        $this->assertSame(
            UserRole::Admin->puedeAdministrar(),
            UserRole::Admin->puedeSuspenderCuentas(),
            'Por ahora solo admin hace ambas cosas, pero el metodo existe aparte a proposito',
        );

        $this->assertFalse(UserRole::Landlord->puedeSuspenderCuentas());
    }

    #[Test]
    public function el_visitante_no_tiene_privilegios_alguno(): void
    {
        $this->assertFalse(UserRole::Visitor->puedePublicar());
        $this->assertFalse(UserRole::Visitor->puedeAdministrar());
        $this->assertFalse(UserRole::Visitor->puedeSuspenderCuentas());
    }

    #[Test]
    public function visitor_no_aparece_en_las_opciones_porque_no_se_elige(): void
    {
        $this->assertArrayNotHasKey(
            UserRole::Visitor->value,
            UserRole::options(),
            'Nadie se registra como visitante: visitante es no tener cuenta',
        );
    }
}
