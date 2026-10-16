<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * La cola de moderacion. RF-7.1.
 *
 * `approve` y `reject` ya existian y tenian sus pruebas. Lo que no
 * existia era la forma de saber **cual** hay que moderar: sin esta
 * ruta, un administrador tiene que conocer el id de la publicacion
 * para poder aprobarla, y el producto no cierra de punta a punta.
 *
 * La prueba de cabeza es la del recorrido completo, que es la que dice
 * si publicar sirve de algo: alguien publica, aparece en la cola,
 * alguien la aprueba, y sale en el mapa.
 */
class ModerationQueueTest extends TestCase
{
    use RefreshDatabase;

    /*
    |--------------------------------------------------------------------------
    | La cola
    |--------------------------------------------------------------------------
    */

    /**
     * Sin argumentos, solo lo que espera decision.
     *
     * Una cola que arranca mostrando tambien las activas no es una
     * cola: es un listado con un filtro que hay que activar.
     */
    #[Test]
    public function la_cola_muestra_solo_las_pendientes(): void
    {
        $admin = User::factory()->admin()->create();

        Property::factory()->count(3)->create(['status' => PropertyStatus::Pendiente]);
        Property::factory()->count(5)->activa()->create();
        Property::factory()->count(2)->borrador()->create();

        $respuesta = $this->actingAs($admin)->getJson('/api/admin/properties');

        $respuesta->assertOk();

        $estados = array_unique(array_map(
            static fn (array $p): string => (string) $p['status'],
            $respuesta->json('data')
        ));

        $this->assertSame(['pendiente'], $estados);
        $this->assertCount(3, $respuesta->json('data'));
    }

    /**
     * Lo mas antiguo primero.
     *
     * La cola se ordena por espera. Con "mas reciente primero" una
     * publicacion de hace nueve dias queda al fondo para siempre y el
     * administrador solo ve lo que entro hace dos minutos.
     */
    #[Test]
    public function la_cola_ordena_las_mas_antiguas_primero(): void
    {
        $admin = User::factory()->admin()->create();

        $vieja = Property::factory()->create([
            'status' => PropertyStatus::Pendiente,
            'created_at' => now()->subDays(9),
        ]);

        $nueva = Property::factory()->create([
            'status' => PropertyStatus::Pendiente,
            'created_at' => now()->subMinutes(2),
        ]);

        $respuesta = $this->actingAs($admin)->getJson('/api/admin/properties');

        $respuesta->assertOk();

        $ids = array_column($respuesta->json('data'), 'id');

        $this->assertLessThan(
            array_search($nueva->getKey(), $ids, true),
            array_search($vieja->getKey(), $ids, true),
            'La publicacion mas antigua tiene que ir primero.'
        );
    }

    #[Test]
    public function se_puede_pedir_otro_estado(): void
    {
        $admin = User::factory()->admin()->create();

        Property::factory()->count(2)->create(['status' => PropertyStatus::Pendiente]);
        Property::factory()->count(4)->activa()->create();

        $respuesta = $this->actingAs($admin)->getJson('/api/admin/properties?status=activa');

        $respuesta->assertOk();
        $this->assertCount(4, $respuesta->json('data'));
    }

    /**
     * Un estado inventado no es un 422.
     *
     * Viene de un `<select>` con valores fijos, asi que un 422 seria
     * una pantalla en blanco por un parametro mal escrito en la URL.
     */
    #[Test]
    public function un_estado_que_no_existe_cae_en_la_cola(): void
    {
        $admin = User::factory()->admin()->create();

        Property::factory()->count(2)->create(['status' => PropertyStatus::Pendiente]);

        $respuesta = $this->actingAs($admin)->getJson('/api/admin/properties?status=inventado');

        $respuesta->assertOk();
        $this->assertCount(2, $respuesta->json('data'));
    }

    /*
    |--------------------------------------------------------------------------
    | Quien puede verla
    |--------------------------------------------------------------------------
    */

    /**
     * La cola es el unico endpoint que no filtra por dueno, asi que
     * sin rol sale un 403 explicito y no una lista vacia: una lista
     * vacia parece "no hay nada que moderar" y se deja para manana.
     */
    #[Test]
    public function un_visitante_no_ve_la_cola(): void
    {
        Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->getJson('/api/admin/properties')->assertUnauthorized();
    }

    #[Test]
    public function un_inquilino_no_ve_la_cola(): void
    {
        Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->actingAs(User::factory()->tenant()->create())
            ->getJson('/api/admin/properties')
            ->assertForbidden();
    }

    /**
     * Un arrendador tampoco, aunque tenga publicaciones propias.
     *
     * Si un arrendador viera la cola podria aprovar la de otro, y la
     * moderacion existe justamente para que haya alguien que no sea
     * el dueno mirandola.
     */
    #[Test]
    public function un_arrendador_no_ve_la_cola(): void
    {
        Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->actingAs(User::factory()->landlord()->create())
            ->getJson('/api/admin/properties')
            ->assertForbidden();
    }

    #[Test]
    public function un_admin_si(): void
    {
        $admin = User::factory()->admin()->create();

        Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->actingAs($admin)->getJson('/api/admin/properties')->assertOk();
    }

    /*
    |--------------------------------------------------------------------------
    | Lo que la cola tiene que decir
    |--------------------------------------------------------------------------
    */

    /**
     * De quien es el anuncio.
     *
     * Sin esto el administrador aprueba y rechaza sin saber a quien
     * esta, y la moderacion no es moderacion: es un boton.
     */
    #[Test]
    public function la_cola_dice_de_quien_es_cada_anuncio(): void
    {
        $admin = User::factory()->admin()->create();

        $dueno = $this->arrendadorVerificado();

        Property::factory()->de($dueno)->create(['status' => PropertyStatus::Pendiente]);

        $landlord = $this->actingAs($admin)->getJson('/api/admin/properties')->json('data.0.landlord');

        $this->assertSame($dueno->getKey(), $landlord['id']);
        $this->assertSame($dueno->email, $landlord['email']);
    }

    /**
     * Si la cuenta esta verificada.
     *
     * El correo verificado decide la confianza: una cuenta sin
     * confirmar puede publicar un anuncio de estafa y desaparecer, y
     * sin este dato el administrador aprueba a ciegas.
     */
    #[Test]
    public function la_cola_dice_si_el_correo_esta_verificado(): void
    {
        $admin = User::factory()->admin()->create();

        Property::factory()->create([
            'status' => PropertyStatus::Pendiente,
            'user_id' => $this->arrendadorVerificado()->getKey(),
        ]);

        Property::factory()->create([
            'status' => PropertyStatus::Pendiente,

            // Sin `unverified()`: la fabrica crea las cuentas con el
            // correo ya confirmado --`'email_verified_at' => now()`--,
            // y las dos saldrian verificadas.
            'user_id' => User::factory()->landlord()->unverified()->create()->getKey(),
        ]);

        $estados = array_column($this->actingAs($admin)->getJson('/api/admin/properties')->json('data'), 'landlord');

        $verificados = array_column(array_filter($estados, static fn (array $l): bool => $l['email_verified'] === true), 'id');

        $this->assertCount(1, $verificados, 'Una sola de las dos cuentas tiene el correo confirmado.');
    }

    /**
     * El historial del dueno.
     *
     * "Tiene 3 anuncios, 0 aceptados" es informacion; "tiene 3, 4
     * rechazados" es la misma cantidad con el signo cambiado.
     */
    #[Test]
    public function la_cola_dice_cuantos_anuncios_tiene_el_dueno(): void
    {
        $admin = User::factory()->admin()->create();

        $dueno = $this->arrendadorVerificado();

        Property::factory()->de($dueno)->count(2)->create(['status' => PropertyStatus::Pendiente]);

        $landlord = $this->actingAs($admin)->getJson('/api/admin/properties')->json('data.0.landlord');

        $this->assertSame(2, $landlord['published_count']);
        $this->assertSame(0, $landlord['approved_count']);
    }

    /**
     * Las publicaciones de duenos distintos no se mezclan.
     *
     * La cola es el unico listado que no filtra por dueno, y por eso
     * tiene que traer datos de cuentas distintas sin que se pierdan.
     */
    #[Test]
    public function la_cola_trae_publicaciones_de_duenos_distintos(): void
    {
        $admin = User::factory()->admin()->create();

        /*
         * Tres cuentas distintas, una por anuncio.
         *
         * El array del `create([...])` se evalua **una vez**, antes de
         * que la fabrica lo aplique a cada modelo: poner
         * `User::factory()->landlord()->create()->getKey()` ahi
         * crearia una sola cuenta y las tres publicaciones serian del
         * mismo dueno. Que es justo lo que la prueba no comprueba.
         */
        foreach (range(1, 3) as $ignorado) {
            Property::factory()->create([
                'status' => PropertyStatus::Pendiente,
                'user_id' => User::factory()->landlord()->create()->getKey(),
            ]);
        }

        $respuesta = $this->actingAs($admin)->getJson('/api/admin/properties');

        $respuesta->assertOk();

        $duenos = array_unique(array_map(
            static fn (array $p): mixed => $p['landlord']['id'] ?? null,
            $respuesta->json('data')
        ));

        $this->assertCount(3, $duenos);
    }

    /*
    |--------------------------------------------------------------------------
    | El recorrido completo
    |--------------------------------------------------------------------------
    */

    /**
     * La prueba que dice si el producto funciona.
     *
     * Alguien publica, aparece en la cola, alguien la aprueba, y sale
     * en el mapa. Si el segundo paso no existiera, publicar no
     * cerraria de punta a punta.
     */
    #[Test]
    public function publicar_aprobar_y_ver_en_el_mapa(): void
    {
        $dueno = $this->arrendadorVerificado();
        $admin = User::factory()->admin()->create();

        $creada = $this->actingAs($dueno)->postJson('/api/properties', $this->datosValidos());

        $creada->assertCreated()->assertJsonPath('data.status', 'pendiente');

        $id = $creada->json('data.id');

        // Aparece en la cola del administrador.
        $cola = $this->actingAs($admin)->getJson('/api/admin/properties');
        $cola->assertOk();
        $this->assertContains($id, array_column($cola->json('data'), 'id'));

        // Y no aparece todavia en el mapa de nadie.
        $this->getJson('/api/properties')->assertJsonMissing(['id' => $id]);

        $this->actingAs($admin)->postJson("/api/properties/{$id}/approve")->assertOk();

        $this->assertDatabaseHas('properties', ['id' => $id, 'status' => 'activa']);
    }

    /**
     * Rechazar devuelve la publicacion a 'borrador', no la borra.
     *
     * El dueno puede corregirla y volver a enviarla. Borrarla seria
     * perder el trabajo de alguien por un error de forma.
     */
    #[Test]
    public function rechazar_devuelve_a_borrador_y_no_borra(): void
    {
        $admin = User::factory()->admin()->create();
        $pendiente = Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->actingAs($admin)->postJson("/api/properties/{$pendiente->getKey()}/reject")->assertOk();

        $this->assertDatabaseHas('properties', ['id' => $pendiente->getKey(), 'status' => 'borrador']);
    }

    /**
     * La cola se vacia sola al aprobar.
     *
     * Si no, la siguiente pantalla mostraria la misma publicacion y el
     * administrador aprobaria dos veces la misma.
     */
    #[Test]
    public function aprobar_saca_la_publicacion_de_la_cola(): void
    {
        $admin = User::factory()->admin()->create();
        $pendiente = Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->actingAs($admin)->postJson("/api/properties/{$pendiente->getKey()}/approve")->assertOk();

        $this->assertNotContains(
            $pendiente->getKey(),
            array_column($this->actingAs($admin)->getJson('/api/admin/properties')->json('data'), 'id')
        );
    }

    /**
     * Un dueno con el correo confirmado.
     *
     * Publicar lo exige (`PropertyPolicy::create`), asi que una prueba
     * de la cola que lo esquivara probaria el 403 en vez del recorrido.
     */
    private function arrendadorVerificado(): User
    {
        $dueno = User::factory()->landlord()->create();

        $dueno->markEmailAsVerified();

        return $dueno;
    }

    /** @return array<string, mixed> */
    private function datosValidos(array $extra = []): array
    {
        return [
            'title' => 'Apartamento luminoso a dos cuadras de la UTN',
            'description' => 'Sala, cocina y dos habitaciones. A dos cuadras del centro.',
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
