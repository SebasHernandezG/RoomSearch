<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Identity\Enums\UserRole;
use Modules\Identity\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * La configuracion de autenticacion apunta al modelo correcto.
 *
 * Esta prueba existe porque el archivo config/auth.php seguia
 * importando App\Models\User despues de que User se moviera al modulo
 * Identity. No daba error al compilar: solo reventaba cuando alguien
 * intentaba iniciar sesion, y con un mensaje que no senala la causa
 * real.
 */
class AuthConfigurationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function el_proveedor_de_usuarios_apunta_al_modulo_identity(): void
    {
        $modelo = config('auth.providers.users.model');

        $this->assertSame(User::class, $modelo);
        $this->assertTrue(
            class_exists($modelo),
            'Si el modelo no existe, el login falla con un error que no senala la causa',
        );
    }

    /**
     * La cadena completa: el guard debe poder resolver el modelo a
     * partir de una fila real, no solo comparar nombres de clase.
     */
    #[Test]
    public function el_guard_consigue_recuperar_un_usuario_de_la_base(): void
    {
        $landlord = User::factory()->landlord()->create();

        $recuperado = auth()->getProvider('users')->retrieveById($landlord->id);

        $this->assertNotNull($recuperado);
        $this->assertTrue($recuperado->isLandlord());
        $this->assertSame(UserRole::Landlord, $recuperado->role);
    }

    /**
     * Y por correo, que es como se busca al iniciar sesion.
     */
    #[Test]
    public function el_guard_consigue_recuperar_por_correo(): void
    {
        User::factory()->create(['email' => 'alguien@roomies.test']);

        $recuperado = auth()->getProvider('users')->retrieveByCredentials([
            'email' => 'alguien@roomies.test',
        ]);

        $this->assertNotNull($recuperado);
    }
}
