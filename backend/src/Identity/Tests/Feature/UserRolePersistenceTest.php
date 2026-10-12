<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Identity\Enums\UserRole;
use Modules\Identity\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * El modelo User con su columna de rol. RF-1.4.
 *
 * Estas van contra MySQL de verdad porque lo que se comprueba es que
 * la columna existe con el enum correcto y que el cast la convierte.
 */
class UserRolePersistenceTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function una_cuenta_nueva_queda_como_inquilino(): void
    {
        $usuario = User::factory()->create();

        $this->assertSame(UserRole::Tenant, $usuario->role);
    }

    #[Test]
    public function el_rol_sobrevive_a_un_round_trip(): void
    {
        User::factory()->landlord()->create(['email' => 'landlord@roomies.test']);

        $recargado = User::where('email', 'landlord@roomies.test')->sole();

        $this->assertSame(UserRole::Landlord, $recargado->role);
    }

    /**
     * El cast tiene que devolver el enum, no el texto. Si devolviera el
     * string, `$usuario->role->puedePublicar()` reventaria en produccion
     * con un error poco claro.
     */
    #[Test]
    public function el_cast_devuelve_el_enum_y_no_el_texto(): void
    {
        $usuario = User::factory()->create();

        $this->assertInstanceOf(UserRole::class, $usuario->role);
        $this->assertSame('tenant', $usuario->getRawOriginal('role'));
    }

    /**
     * Un rol inválido lo rechaza PHP antes de que la consulta salga.
     *
     * El enum de MySQL tambien lo rechazaria, pero nunca llega ahi: el
     * cast de Eloquent castea a enum al asignar y lanza ValueError. Es
     * mejor asi, porque el mensaje dice cual fue el valor malo.
     */
    #[Test]
    public function un_rol_inexistente_falla_antes_de_llegar_a_la_base(): void
    {
        $this->expectException(\ValueError::class);

        User::factory()->create(['role' => 'dictador']);
    }

    /**
     * El default en memoria, para el caso en que el rol llegue en null.
     *
     * La columna es NOT NULL con default 'tenant', asi que desde la
     * base esto no puede pasar: una cuenta vieja quedo con el valor por
     * omision al agregar la columna. El unico camino es una asignacion
     * en memoria, y por eso el test no guarda.
     */
    #[Test]
    public function un_rol_nulo_en_memoria_cae_a_inquilino(): void
    {
        $usuario = User::factory()->landlord()->create();

        $usuario->role = null;

        $this->assertNull($usuario->role);
        $this->assertFalse($usuario->isLandlord(), 'Y aun asi no puede publicar');
        $this->assertFalse($usuario->isAdmin());
        $this->assertTrue($usuario->tieneRol(['tenant']), 'Y se comporta como inquilino');
    }

    /**
     * La base no admite un rol nulo. Es lo que hace innecesario
     * pelearse en el codigo con cuentas sin rol.
     */
    #[Test]
    public function la_base_no_admite_un_rol_nulo(): void
    {
        $usuario = User::factory()->create();

        $this->expectException(QueryException::class);

        $usuario->forceFill(['role' => null])->saveQuietly();
    }

    #[Test]
    public function un_arrendador_puede_publicar(): void
    {
        $this->assertTrue(User::factory()->landlord()->create()->isLandlord());
    }

    #[Test]
    public function un_inquilino_no_puede_publicar(): void
    {
        $this->assertFalse(User::factory()->tenant()->create()->isLandlord());
    }

    #[Test]
    public function solo_el_admin_administra(): void
    {
        $this->assertTrue(User::factory()->admin()->create()->isAdmin());
        $this->assertFalse(User::factory()->landlord()->create()->isAdmin());
        $this->assertFalse(User::factory()->tenant()->create()->isAdmin());
    }

    /**
     * tieneRol() acepta el enum y tambien el texto, porque el
     * middleware lo arma desde configuracion.
     */
    #[Test]
    public function tiene_rol_acepta_enum_y_texto(): void
    {
        $landlord = User::factory()->landlord()->create();

        $this->assertTrue($landlord->tieneRol([UserRole::Landlord]));
        $this->assertTrue($landlord->tieneRol(['landlord']));
        $this->assertTrue($landlord->tieneRol(['tenant', 'landlord']));
        $this->assertFalse($landlord->tieneRol(['admin']));
        $this->assertFalse($landlord->tieneRol([]));
    }

    /**
     * Un nombre de rol mal escrito se ignora en vez de reventar con un
     * 500. Sale del middleware, no de un usuario.
     */
    #[Test]
    public function un_rol_desconocido_se_ignora_y_no_lanza(): void
    {
        $admin = User::factory()->admin()->create();

        $this->assertFalse($admin->tieneRol(['inventado']));
        $this->assertTrue($admin->tieneRol(['inventado', 'admin']));
    }
}
