<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use App\Http\Controllers\Api\LandlordProfileController;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Modules\Identity\Models\LandlordProfile;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * El perfil del arrendador. RF-1.5.
 *
 * La prueba de cabeza no es "se guarda el perfil": es **"el telefono no
 * sale cuando el dueno lo marco privado"**. Es el criterio que el issue
 * pide de forma explicita y el que, si falla, publica el numero de
 * alguien que decidio no publicarlo.
 *
 * @see LandlordProfileController
 */
class LandlordProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    /*
    |--------------------------------------------------------------------------
    | El telefono y su privacidad
    |--------------------------------------------------------------------------
    */

    /**
     * La prueba de cabeza.
     *
     * El dueno escribio el numero y marco privado. El Resource no lo
     * puede sacar, y dice que es privado para que el frontend pueda
     * explicarlo en vez de omitirlo en silencio.
     */
    #[Test]
    public function un_telefono_privado_no_sale(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688881234',
            'phone_private' => true,
        ])->assertSuccessful();

        /*
         * ctingAs sigue autenticando las peticiones siguientes, asi
         * que para probar la vista **publica** hay que salir de la sesion.
         * Con sesion, is_mine vale 	rue -- que es lo correcto, pero no
         * es lo que esta prueba mide.
         */
        $publico = $this->app['auth']->forgetGuards();

        $publico = $this->getJson("/api/landlords/{$dueno->getKey()}");

        $publico->assertSuccessful();

        $this->assertNull($publico->json('data.phone'));
        $this->assertFalse($publico->json('data.phone_public'));

        /*
         * Y lo que importa de verdad: el numero no aparece en
         * **ningun** lado de la respuesta, ni por error de formato.
         */
        $this->assertStringNotContainsString('88881234', $publico->getContent());
    }

    /**
     * Privado es el default.
     *
     * Un perfil nuevo nace privado. Con default publico, todo el que no
     * lleno el campo queda expuesto y no hay forma de saber quienes.
     */
    #[Test]
    public function un_perfil_nuevo_nace_privado(): void
    {
        $dueno = $this->arrendador();

        /*
         * El `refresh()` no es cosmetico: el default lo pone MySQL y el
         * modelo recien creado todavia no lo tiene cargado, asi que
         * `phone_private` sale `null`.
         */
        $perfil = LandlordProfile::create(['user_id' => $dueno->getKey()])->refresh();

        $this->assertTrue($perfil->phone_private);
    }

    /**
     * Con el interruptor en publico, sale.
     */
    #[Test]
    public function un_telefono_publico_sale(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        $this->assertSame('+50688881234', $this->getJson("/api/landlords/{$dueno->getKey()}")->json('data.phone'));
    }

    /**
     * Se puede volver a privado despues de haberlo hecho publico.
     */
    #[Test]
    public function se_puede_volver_a_privado(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688881234',
            'phone_private' => true,
        ])->assertSuccessful();

        $this->assertNull($this->getJson("/api/landlords/{$dueno->getKey()}")->json('data.phone'));
    }

    /**
     * Sin telefono no hay nada que exponer, y el estado queda
     * coherente.
     *
     * Si alguien borra el numero dejando el interruptor en publico, el
     * perfil quedaria diciendo "puede ver mi telefono" sin tener.
     */
    #[Test]
    public function sin_telefono_el_perfil_queda_privado(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => null,
            'phone_private' => false,
        ])->assertSuccessful();

        $this->assertTrue(LandlordProfile::where('user_id', $dueno->getKey())->sole()->phone_private);
    }

    /**
     * Una cuenta sin confirmar no expone su telefono.
     *
     * Esta condicion **no** esta en el issue, y es la que mas importa.
     * Un contacto publicado de una cuenta sin verificar es el dato de
     * alguien a quien no se le puede reclamar: si el anuncio es un
     * fraude, el telefono ya esta en pantalla y no hay a quien avisar.
     */
    #[Test]
    public function una_cuenta_sin_confirmar_no_expone_su_telefono(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'phone' => '+50688881234',
            'phone_private' => false,
        ])->assertSuccessful();

        // Guardado de verdad: cambiarlo en memoria no cambia la base, y la
        // siguiente peticion vuelve a leer de ahi --con el correo confirmado.
        $dueno->forceFill(['email_verified_at' => null])->save();

        $this->assertNull($this->getJson("/api/landlords/{$dueno->getKey()}")->json('data.phone'));
    }

    /**
     * El E.164 sin formato falla.
     *
     * El enlace a WhatsApp se arma con este mismo valor: un numero con
     * espacios genera un enlace con espacios que no abre.
     */
    #[Test]
    public function un_telefono_con_espacios_no_se_acepta(): void
    {
        $respuesta = $this->actingAs($this->arrendador())->putJson('/api/landlord-profile', [
            'phone' => '+506 8888-1234',
            'phone_private' => false,
        ]);

        $respuesta->assertStatus(422)->assertJsonValidationErrors('phone');
    }

    /*
    |--------------------------------------------------------------------------
    | Lo demas del perfil
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function guarda_los_datos(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'bio' => 'Arrendamos desde 2015. Dos casas en Ciudad Quesada.',
            'years_experience' => 10,
        ])->assertSuccessful();

        $perfil = LandlordProfile::where('user_id', $dueno->getKey())->sole();

        $this->assertStringContainsString('2015', (string) $perfil->bio);
        $this->assertSame(10, $perfil->years_experience);
    }

    /**
     * `null` en los anos significa "no lo dice", no "cero".
     */
    #[Test]
    public function los_anos_pueden_quedar_sin_definir(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [])->assertSuccessful();

        $this->assertNull(LandlordProfile::where('user_id', $dueno->getKey())->sole()->years_experience);
    }

    #[Test]
    public function una_biografia_larga_se_rechaza(): void
    {
        $this->actingAs($this->arrendador())->putJson('/api/landlord-profile', [
            'bio' => str_repeat('a', 500),
        ])->assertStatus(422)->assertJsonValidationErrors('bio');
    }

    #[Test]
    public function anos_absurdos_se_rechazan(): void
    {
        $this->actingAs($this->arrendador())->putJson('/api/landlord-profile', [
            'years_experience' => 900,
        ])->assertStatus(422)->assertJsonValidationErrors('years_experience');
    }

    /*
    |--------------------------------------------------------------------------
    | La foto
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function se_sube_una_foto_de_perfil(): void
    {
        $dueno = $this->arrendador();

        $respuesta = $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'foto' => UploadedFile::fake()->image('cara.jpg')->size(200),
        ]);

        $respuesta->assertSuccessful()->assertJsonPath('data.photo_url', fn (?string $url): bool => $url !== null);

        $this->assertThatHayArchivos();
    }

    /**
     * Sin foto, `photo_url` es `null` y no una URL rota.
     */
    #[Test]
    public function sin_foto_no_hay_url(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [])->assertSuccessful();

        $this->assertNull($this->getJson("/api/landlords/{$dueno->getKey()}")->json('data.photo_url'));
    }

    /**
     * Se quita la foto.
     *
     * Un `<input type="file">` vacio no es `null`: es un archivo sin
     * contenido. Sin un interruptor explicito no hay forma de decir "ya
     * no quiero la foto", que es distinto de "no la cambio".
     */
    #[Test]
    public function se_puede_quitar_la_foto(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'foto' => UploadedFile::fake()->image('cara.jpg')->size(200),
        ])->assertSuccessful();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'quitar_foto' => true,
        ])->assertSuccessful()->assertJsonPath('data.photo_url', null);

        $this->assertSinArchivos();
    }

    /**
     * Subir una foto nueva borra la anterior.
     *
     * Sin esto, cada cambio de foto deja un archivo en el disco que
     * nadie va a borrar.
     */
    #[Test]
    public function cambiar_la_foto_no_deja_la_anterior(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'foto' => UploadedFile::fake()->image('cara.jpg')->size(200),
        ])->assertSuccessful();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'foto' => UploadedFile::fake()->image('otra.jpg')->size(200),
        ])->assertSuccessful();

        $this->assertThatHayArchivos();
    }

    /*
    |--------------------------------------------------------------------------
    | Quien puede ver y editar
    |--------------------------------------------------------------------------
    */

    /**
     * El perfil publico **no pide sesion**.
     *
     * Un anuncio se mira sin cuenta (RF-1.4) y el perfil esta en la
     * ficha: pedir sesion para verlo seria pedir una cuenta para leer
     * algo que ya esta en pantalla.
     */
    #[Test]
    public function el_perfil_publico_no_pide_sesion(): void
    {
        $dueno = $this->arrendador();

        LandlordProfile::create([
            'user_id' => $dueno->getKey(),
            'phone_private' => false,
            'phone' => '+50688881234',
        ]);

        $this->getJson("/api/landlords/{$dueno->getKey()}")->assertSuccessful();
    }

    #[Test]
    public function un_perfil_que_no_existe_es_404(): void
    {
        $this->getJson('/api/landlords/999')->assertNotFound();
    }

    #[Test]
    public function editar_exige_sesion(): void
    {
        $this->putJson('/api/landlord-profile', [])->assertUnauthorized();
    }

    /**
     * Un inquilino no tiene perfil de arrendador.
     *
     * Y no se responde con un 403 seco: el mensaje tiene que decir que
     * hacer, porque el dueno no tiene forma de arreglarlo por su cuenta.
     */
    #[Test]
    public function un_inquilino_no_tiene_perfil_de_arrendador(): void
    {
        $this->actingAs(User::factory()->tenant()->create())
            ->putJson('/api/landlord-profile', [])
            ->assertForbidden();
    }

    /**
     * "Mi perfil" responde siempre, nunca 404.
     *
     * La primera vez responde **201**, porque el perfil se crea en ese
     * momento. No es un descuido: `wasRecentlyCreated` de Laravel hace
     * que el Resource responda 201 cuando lo que se acaba de crear, y
     * es una senal util -- "todavia no tenias perfil" frente a "ya lo
     * tenias". Las dos veces responde 200.
     */
    #[Test]
    public function el_perfil_propio_sempre_responde(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)
            ->getJson('/api/landlord-profile')
            ->assertCreated()
            ->assertJsonPath('data.user_id', $dueno->getKey());

        $this->actingAs($dueno)->getJson('/api/landlord-profile')->assertOk();
    }

    /*
    |--------------------------------------------------------------------------
    | Las publicaciones del dueno
    |--------------------------------------------------------------------------
    */

    /**
     * Solo las activas. El criterio del issue, literal.
     */
    #[Test]
    public function solo_muestra_publicaciones_activas(): void
    {
        $dueno = $this->arrendador();

        Property::factory()->de($dueno)->count(3)->activa()->create();

        Property::factory()->de($dueno)->count(2)->create(['status' => PropertyStatus::Pendiente]);
        Property::factory()->de($dueno)->count(1)->borrador()->create();
        Property::factory()->de($dueno)->count(1)->alquilada()->create();

        $respuesta = $this->getJson("/api/landlords/{$dueno->getKey()}/properties");

        $respuesta->assertSuccessful();
        $this->assertCount(3, $respuesta->json('data'));

        foreach ($respuesta->json('data') as $publicacion) {
            $this->assertSame('activa', $publicacion['status']);
        }
    }

    #[Test]
    public function el_historial_va_paginado(): void
    {
        $dueno = $this->arrendador();

        Property::factory()->de($dueno)->count(15)->activa()->create();

        $respuesta = $this->getJson("/api/landlords/{$dueno->getKey()}/properties");

        $respuesta->assertSuccessful();
        $this->assertCount(12, $respuesta->json('data'));
        $this->assertSame(15, $respuesta->json('meta.total'));
    }

    /**
     * No se ven las publicaciones de otro.
     */
    #[Test]
    public function cada_dueno_solo_muestra_las_suyias(): void
    {
        $dueno = $this->arrendador();

        Property::factory()->de($dueno)->count(2)->activa()->create();
        Property::factory()->count(3)->activa()->create();

        $this->assertCount(2, $this->getJson("/api/landlords/{$dueno->getKey()}/properties")->json('data'));
    }

    /*
    |--------------------------------------------------------------------------
    | El recorrido completo
    |--------------------------------------------------------------------------
    */

    /**
     * El dueno completa su perfil y alguien lo ve desde su anuncio.
     */
    #[Test]
    public function completar_el_perfil_y_verlo_desde_publico(): void
    {
        $dueno = $this->arrendador();

        $this->actingAs($dueno)->putJson('/api/landlord-profile', [
            'bio' => 'Arrendamos desde 2015.',
            'years_experience' => 10,
            'phone' => '+50688881234',
            'phone_private' => false,
            'foto' => UploadedFile::fake()->image('cara.jpg')->size(200),
        ])->assertSuccessful();

        /*
         * ctingAs sigue autenticando las peticiones siguientes, asi
         * que para probar la vista **publica** hay que salir de la sesion.
         * Con sesion, is_mine vale 	rue -- que es lo correcto, pero no
         * es lo que esta prueba mide.
         */
        $publico = $this->app['auth']->forgetGuards();

        $publico = $this->getJson("/api/landlords/{$dueno->getKey()}");

        $publico->assertOk()
            ->assertJsonPath('data.phone', '+50688881234')
            ->assertJsonPath('data.years_experience', 10)
            ->assertJsonPath('data.is_mine', false);

        $this->assertNotNull($publico->json('data.photo_url'));
    }

    /*
    |--------------------------------------------------------------------------
    | Ayudas
    |--------------------------------------------------------------------------
    */

    /**
     * Que quedo exactamente un archivo en el disco.
     *
     * Storage::disk()->assertCount() pide un directorio, y lo que
     * importa aqui es que el cambio de foto **no deje la anterior**:
     * dos archivos es exactamente el bug.
     */
    private function assertThatHayArchivos(): void
    {
        $this->assertCount(1, Storage::disk('public')->allFiles(), 'Hay mas de un archivo en el disco.');
    }

    /**
     * Que no quedo ningun archivo.
     */
    private function assertSinArchivos(): void
    {
        $this->assertSame([], Storage::disk('public')->allFiles(), 'Quedaron archivos en el disco.');
    }

    private function arrendador(): User
    {
        $dueno = User::factory()->landlord()->create();
        $dueno->markEmailAsVerified();

        return $dueno;
    }
}
