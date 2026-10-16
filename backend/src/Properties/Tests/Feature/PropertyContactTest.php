<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use App\Http\Resources\PropertyResource;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Modules\Identity\Models\LandlordProfile;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * El contacto del dueno dentro de la ficha. RF-5.2.
 *
 * ## Por que va en la ficha y no en una peticion aparte
 *
 * El frontend **no sabe de quien es el inmueble**: el Resource publico
 * no lleva el id del dueno, y sin el no hay forma de pedir su perfil.
 * Meter `landlord_id` obligaria al navegador a una segunda peticion en
 * cada ficha, con un fallo mas que puede dejarla a medias.
 *
 * Y la regla de privacidad **no se reevalua aca**: la decide
 * `LandlordProfile`, y reimprimirla en cada Resource es como se acaba
 * publicando un numero por privado.
 *
 * @see PropertyResource
 */
class PropertyContactTest extends TestCase
{
    use RefreshDatabase;

    /*
    |--------------------------------------------------------------------------
    | Que sale
    |--------------------------------------------------------------------------
    */

    /**
     * La prueba de cabeza: con el contacto publicado, sale.
     */
    #[Test]
    public function el_contacto_del_dueno_viaja_en_la_ficha(): void
    {
        $ficha = $this->fichaDe($this->publicarConWhatsApp());

        $ficha->assertSuccessful()
            ->assertJsonPath('data.contacto.whatsapp', '+50688881234')
            ->assertJsonPath('data.contacto.phone', '+50688880000')
            ->assertJsonPath('data.contacto.email_verified', true);
    }

    /**
     * Privado sale como `null`, no como un numero tapado.
     *
     * La prueba mira el cuerpo entero con `assertStringNotContainsString`
     * porque `assertNull` sobre un campo solo comprobaria ese campo: el
     * numero podria colarse en otro y la prueba pasaria.
     */
    #[Test]
    public function un_contacto_privado_no_sale_de_la_ficha(): void
    {
        $ficha = $this->fichaDe($this->publicarConWhatsApp(privado: true));

        $ficha->assertSuccessful()
            ->assertJsonPath('data.contacto.whatsapp', null)
            ->assertJsonPath('data.contacto.phone', null);

        $this->assertStringNotContainsString('88881234', $ficha->getContent());
        $this->assertStringNotContainsString('88880000', $ficha->getContent());
    }

    /**
     * Una cuenta sin confirmar tampoco.
     */
    #[Test]
    public function una_cuenta_sin_confirmar_no_trae_contacto(): void
    {
        $ficha = $this->fichaDe($this->publicarConWhatsApp(verificado: false));

        $this->assertNull($ficha->json('data.contacto.whatsapp'));
    }

    /**
     * Un dueno sin perfil no rompe la ficha.
     *
     * `null` y no un 500: la ausencia de perfil es lo normal en una
     * cuenta recien creada, y la ficha tiene que salir igual.
     */
    #[Test]
    public function un_dueno_sin_perfil_no_rompe_la_ficha(): void
    {
        $ficha = $this->fichaDe(Property::factory()->activa()->create());

        $ficha->assertSuccessful()
            ->assertJsonPath('data.contacto.whatsapp', null)
            ->assertJsonPath('data.contacto.phone', null);
    }

    /*
    |--------------------------------------------------------------------------
    | Donde sale
    |--------------------------------------------------------------------------
    */

    /**
     * El listado **no** trae contacto.
     *
     * Son hasta 24 inmuebles y cargar el perfil de 24 duenos para
     * pintar un boton que la tarjeta ni siquiera muestra es una
     * peticion extra por anuncio.
     */
    #[Test]
    public function el_listado_no_trae_contacto(): void
    {
        $this->publicarConWhatsApp();

        $listado = $this->getJson('/api/properties');

        $listado->assertSuccessful();
        $this->assertArrayNotHasKey('contacto', $listado->json('data.0'));
    }

    /*
    |--------------------------------------------------------------------------
    | El recorrido completo
    |--------------------------------------------------------------------------
    */

    /**
     * Publicar, completar el perfil y que la ficha muestre el boton.
     */
    #[Test]
    public function publicar_con_contacto_y_verlo_en_la_ficha(): void
    {
        $dueno = User::factory()->landlord()->create();
        $dueno->markEmailAsVerified();

        $creada = $this->actingAs($dueno)->postJson('/api/properties', $this->datosValidos());
        $creada->assertCreated();

        $id = $creada->json('data.id');

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688880000',
            'whatsapp_number' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        // Aprobada, para que la ficha publica la vea.
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->postJson("/api/properties/{$id}/approve")->assertOk();

        $ficha = $this->getJson("/api/properties/{$id}");

        $ficha->assertSuccessful()->assertJsonPath('data.contacto.whatsapp', '+50688881234');

        $this->assertSame(
            PropertyStatus::Activa->value,
            $ficha->json('data.status'),
            'La ficha solo muestra anuncios activos.',
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Ayudas
    |--------------------------------------------------------------------------
    */

    /**
     * La ficha publica de un inmueble, por su id real.
     *
     * Existe para que ninguna prueba suponga `/api/properties/1`: la
     * fabrica de duenos ya consume los primeros ids, y un 1 supuesto
     * devuelve 404 --que se lee como "el contacto no viaja" en vez de
     * como "el id no existe".
     */
    private function fichaDe(Property $inmueble): TestResponse
    {
        return $this->getJson("/api/properties/{$inmueble->getKey()}");
    }

    /**
     * Un inmueble activo cuyo dueno tiene WhatsApp.
     */
    private function publicarConWhatsApp(bool $privado = false, bool $verificado = true): Property
    {
        /*
         * El estado `unverified()` es **imprescindible**.
         *
         * `UserFactory::definition()` trae `'email_verified_at' =>
         * now()`: la cuenta sale verificada sin pedirlo. Una prueba
         * que quiere medir "sin confirmar" y no dice `unverified()`
         * esta midiendo la cuenta confirmada, y falla sin que nada
         * parezca roto --que es la peor forma de fallar.
         */
        $dueno = User::factory()
            ->landlord()
            ->when(! $verificado, fn ($f) => $f->unverified())
            ->create();

        if ($verificado) {
            $dueno->markEmailAsVerified();
        }

        LandlordProfile::create([
            'user_id' => $dueno->getKey(),
            'phone' => '+50688880000',
            'whatsapp_number' => '+50688881234',
            'phone_private' => $privado,
        ]);

        return Property::factory()->de($dueno)->activa()->create();
    }

    /** @return array<string, mixed> */
    private function datosValidos(array $extra = []): array
    {
        return [
            'title' => 'Apartamento luminoso a dos cuadras de la UTN',
            'description' => 'Sala, cocina y dos habitaciones.',
            'type' => 'apartamento',
            'monthly_rent' => 280_000,
            'currency' => 'CRC',
            'deposit' => 280_000,
            'bedrooms' => 2,
            'bathrooms' => 1,
            'parking_spaces' => 1,
            'furnished' => true,
            'pets_allowed' => true,
            'available_from' => now()->addWeek()->toDateString(),
            'latitude' => 10.3236,
            'longitude' => -84.4274,
            'address_reference' => '200 m norte de la iglesia, Ciudad Quesada',
            'district' => 'Ciudad Quesada',
            'neighborhood' => 'Centro',
            'show_exact_location' => true,
            ...$extra,
        ];
    }
}
