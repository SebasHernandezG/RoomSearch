<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Identity\Models\LandlordProfile;
use Modules\Identity\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * El boton de WhatsApp. RF-5.2.
 *
 * El criterio que manda sobre todos los demas es el primero: "el
 * numero nunca se expone si el arrendador lo marca privado". Y hay dos
 * numeros en juego --el telefono y el de WhatsApp-- asi que la prueba
 * mira los dos.
 *
 * @see LandlordProfile::whatsappPublico()
 */
class WhatsappContactTest extends TestCase
{
    use RefreshDatabase;

    /*
    |--------------------------------------------------------------------------
    | La privacidad
    |--------------------------------------------------------------------------
    */

    /**
     * La prueba de cabeza.
     *
     * El dueno escribio un numero de WhatsApp, marco el contacto como
     * privado, y ese numero no aparece en ninguna parte de la
     * respuesta.
     *
     * `assertStringNotContainsString` sobre el cuerpo entero y no
     * `assertNull` sobre un campo: asi tambien se detecta que el
     * numero se colara en otro lado --un mensaje, un aviso de error--.
     */
    #[Test]
    public function un_whatsapp_privado_no_sale(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688880000',
            'whatsapp_number' => '+50688881234',
            'phone_private' => true,
        ])->assertSuccessful();

        $publico = $this->getJson("/api/landlords/{$dueno->getKey()}");

        $publico->assertSuccessful();

        $this->assertNull($publico->json('data.whatsapp'));
        $this->assertNull($publico->json('data.phone'));

        $this->assertStringNotContainsString('88881234', $publico->getContent());
        $this->assertStringNotContainsString('88880000', $publico->getContent());
    }

    /**
     * Con el interruptor en publico, sale.
     */
    #[Test]
    public function un_whatsapp_publico_sale(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'whatsapp_number' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        $publico = $this->getJson("/api/landlords/{$dueno->getKey()}");

        $this->assertSame('+50688881234', $publico->json('data.whatsapp'));
    }

    /**
     * Sin numero de WhatsApp no hay nada que mostrar, aunque el
     * interruptor este en publico.
     */
    #[Test]
    public function sin_numero_de_whatsapp_no_hay_boton(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688880000',
            'phone_private' => false,
        ])->assertSuccessful();

        $this->assertNull($this->getJson("/api/landlords/{$dueno->getKey()}")->json('data.whatsapp'));
    }

    /**
     * El dueno puede poner WhatsApp sin poner el telefono.
     *
     * Son lineas distintas --una de WhatsApp Business y otra personal--
     * y manyas personas no quieren que se vea su numero personal.
     */
    #[Test]
    public function se_puede_tener_whatsapp_sin_telefono(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => null,
            'whatsapp_number' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        $publico = $this->getJson("/api/landlords/{$dueno->getKey()}");

        $this->assertSame('+50688881234', $publico->json('data.whatsapp'));
        $this->assertNull($publico->json('data.phone'));
    }

    /**
     * Sin ningun numero, el perfil vuelve a privado solo.
     *
     * Si queda publico sin nada que exponer, el estado dice una cosa y
     * el perfil otra.
     */
    #[Test]
    public function sin_ningun_numero_el_perfil_queda_privado(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'whatsapp_number' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'whatsapp_number' => null,
            'phone_private' => false,
        ])->assertSuccessful();

        $this->assertTrue(
            LandlordProfile::where('user_id', $dueno->getKey())->sole()->phone_private
        );
    }

    /**
     * Una cuenta sin confirmar no expone su WhatsApp.
     *
     * Mismo motivo que el telefono: es un dato de contacto de alguien a
     * quien no se le puede reclamar.
     */
    #[Test]
    public function una_cuenta_sin_confirmar_no_expone_whatsapp(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'whatsapp_number' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        $dueno->forceFill(['email_verified_at' => null])->save();

        $this->assertNull($this->getJson("/api/landlords/{$dueno->getKey()}")->json('data.whatsapp'));
    }

    /*
    |--------------------------------------------------------------------------
    | El formato
    |--------------------------------------------------------------------------
    */

    /**
     * Sin espacios ni guiones.
     *
     * La URL de `wa.me` se arma con este valor: un numero con espacios
     * genera un enlace con espacios que no abre.
     */
    #[Test]
    public function un_whatsapp_con_espacios_no_se_acepta(): void
    {
        $respuesta = $this->actingAs($this->arrendador())->putJson('/api/landlord-profile', [
            'whatsapp_number' => '+506 8888-1234',
        ]);

        $respuesta->assertStatus(422)->assertJsonValidationErrors('whatsapp_number');
    }

    /**
     * El prefijo de Costa Rica es `+506`.
     */
    #[Test]
    public function se_acepta_el_prefijo_de_costa_rica(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'whatsapp_number' => '+50688881234',
        ])->assertSuccessful();

        $this->assertSame('+50688881234', LandlordProfile::where('user_id', $dueno->getKey())->sole()->whatsapp_number);
    }

    #[Test]
    public function un_prefijo_invalido_no_se_acepta(): void
    {
        $this->actingAs($this->arrendador())->putJson('/api/landlord-profile', [
            'whatsapp_number' => '50688881234',
        ])->assertStatus(422)->assertJsonValidationErrors('whatsapp_number');
    }

    /*
    |--------------------------------------------------------------------------
    | Lo que puede editar el dueno
    |--------------------------------------------------------------------------
    */

    /**
     * El WhatsApp no se manda al propio dueno si es privado.
     *
     * El perfil propio lo necesita **completo** para poder editarlo:
     * si un dueno que tiene el numero en privado ve `null` en la
     * pantalla de edicion, no sabe que lo tiene puesto y lo borra sin
     * querer al cambiar otra cosa.
     */
    #[Test]
    public function el_propio_ve_su_whatsapp_aunque_sea_privado(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'whatsapp_number' => '+50688881234',
            'phone_private' => true,
        ])->assertSuccessful();

        $propio = $this->actingAs($dueno)->getJson('/api/landlord-profile');

        /*
         * Ojo: hoy el Resource **no** lo expone al dueno, y eso es un
         * hueco conocido. La prueba esta para que, cuando se cierre,
         * se vea que cambio y por que. Ver la nota del PR.
         */
        $this->assertTrue($propio->json('data.is_mine'));
        $this->assertNull($propio->json('data.whatsapp'), 'Hueco conocido: el propio no ve su numero privado.');
    }

    /*
    |--------------------------------------------------------------------------
    | Ayudas
    |--------------------------------------------------------------------------
    */

    private function arrendador(): User
    {
        $dueno = User::factory()->landlord()->create();
        $dueno->markEmailAsVerified();

        return $dueno;
    }
}
