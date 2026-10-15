<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Modules\Identity\Enums\UserRole;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * El flujo completo de publicar, de punta a punta. RF-2.1.
 *
 * Esta prueba es la que dice si el producto funciona: alguien se
 * registra, publica, un administrador lo aprueba y aparece en el mapa
 * que estaba mirando alguien mas.
 */
class PublishPropertyFlowTest extends TestCase
{
    use RefreshDatabase;

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

    /*
    |--------------------------------------------------------------------------
    | El recorrido completo
    |--------------------------------------------------------------------------
    */

    /**
     * El mismo recorrido que va a hacer una persona en el navegador,
     * paso por paso. Si esta prueba pasa, el producto funciona.
     */
    #[Test]
    public function una_persona_publica_y_el_inmueble_aparece_en_el_mapa(): void
    {
        // 1. Se registra.
        $registro = $this->postJson('/api/register', [
            'name' => 'Ana Arrendadora',
            'email' => 'ana@prueba.test',
            'password' => 'una-frase-larga',
        ])->assertOk();

        $this->assertSame(UserRole::Tenant->value, $registro->json('user.role'));

        // 2. Al registrarse queda como inquilina y no puede publicar.
        //    El privilegio se pide aparte, no se concede por crear una
        //    cuenta.
        $token = $registro->json('token');
        $cabecera = ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];

        $this->postJson('/api/properties', $this->datosValidos(), $cabecera)
            ->assertForbidden();

        // 3. La cuenta pasa a arrendadora.
        $arrendadora = User::where('email', 'ana@prueba.test')->sole();
        $arrendadora->update(['role' => UserRole::Landlord]);

        $this->app['auth']->forgetGuards();

        // 3.5. Y confirma su correo.
        //
        //     Este paso no estaba antes de RF-1.3 y la prueba fallaba sin
        //     el: la cuenta nace sin verificar y publicar exige
        //     verificar. Es exactamente la puerta que se acaba de anadir,
        //     vista desde el otro lado: si alguien la aflojara, esta
        //     prueba sigue pasando --por eso hay otras que affirmative
        //     el 403-- pero si se endureciera de mas, esta lo canta.
        $this->getJson(
            URL::temporarySignedRoute(
                'api.email.verify',
                now()->addHour(),
                [
                    'id' => $arrendadora->id,
                    'hash' => sha1($arrendadora->getEmailForVerification()),
                ],
            ),
        )->assertOk();

        $this->assertTrue($arrendadora->fresh()->hasVerifiedEmail());

        // 4. Publica. Nace pendiente de moderacion, no visible.
        //
        //    El dueno se comprueba en la base y no en la respuesta: el
        //    Resource no expone `user_id` porque el listado publico no
        //    tiene por que darle a un visitante el id interno de quien
        //    publico cada inmueble.
        $creada = $this->postJson('/api/properties', $this->datosValidos(), $cabecera)
            ->assertCreated()
            ->assertJsonPath('data.status', PropertyStatus::Pendiente->value)
            ->assertJsonMissingPath('data.user_id');

        $id = $creada->json('data.id');

        $this->assertDatabaseHas('properties', [
            'id' => $id,
            'user_id' => $arrendadora->id,
        ]);

        // 5. Nadie la ve todavia. Ni la duena ni el resto del mundo.
        $this->getJson('/api/properties/'.$id)->assertNotFound();

        $this->getJson('/api/properties?lat=10.3236&lng=-84.4274&radius=1000')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // 6. La duena si la ve en su lista, con su estado.
        $this->getJson('/api/my/properties', $cabecera)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', PropertyStatus::Pendiente->value);

        // 7. Un administrador la aprueba.
        $admin = User::factory()->admin()->create();
        $adminCabecera = [
            'Authorization' => 'Bearer '.$admin->createToken('app')->plainTextToken,
            'Accept' => 'application/json',
        ];

        /*
         * Cambiar de identidad a mitad de la prueba necesita lo mismo
         * que revocar un token.
         *
         * El guard cachea en memoria el usuario que ya resolvio, y en
         * pruebas todas las peticiones comparten la misma instancia de
         * la aplicacion. Sin esta linea, la peticion del admin llega
         * con SU token pero el guard sigue teniendo a la arrendadora
         * de la peticion anterior, y el middleware `role:admin` la
         * rechaza con un 403 que parece un bug de permisos.
         */
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/properties/'.$id.'/approve', [], $adminCabecera)
            ->assertOk()
            ->assertJsonPath('data.status', PropertyStatus::Activa->value);

        // 8. Ahora si aparece en el mapa.
        $mapa = $this->getJson('/api/properties?lat=10.3236&lng=-84.4274&radius=1000')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->assertSame($id, $mapa->json('data.0.id'));

        $this->getJson('/api/properties/'.$id)->assertOk();
    }

    /*
    |--------------------------------------------------------------------------
    | Publicar
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function sin_sesion_no_se_publica(): void
    {
        $this->postJson('/api/properties', $this->datosValidos())->assertUnauthorized();
    }

    #[Test]
    public function un_inquilino_no_publica(): void
    {
        $this->actingAs(User::factory()->tenant()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos())
            ->assertForbidden();
    }

    #[Test]
    public function un_arrendador_publica(): void
    {
        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos())
            ->assertCreated();
    }

    /*
    |--------------------------------------------------------------------------
    | Correo confirmado. RF-1.3
    |--------------------------------------------------------------------------
    |
    | El rol ya no es garantia de nada: cualquier persona puede
    | escribirse con el correo que quiera, y pasar de inquilino a
    | arrendador es una fila en la base. Lo que separa a una cuenta de
    | verdad de una inventada es que pueda recibir un correo.
    |
    | El factory crea las cuentas YA verificadas, asi que estas pruebas
    | que usan `landlord()` sin `unverified()` estan probando el camino
    | permiso.
    */

    #[Test]
    public function un_arrendador_sin_confirmar_no_publica(): void
    {
        $this->actingAs(User::factory()->landlord()->unverified()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos())
            ->assertForbidden();

        $this->assertDatabaseCount('properties', 0);
    }

    /**
     * Tampoco el admin escapa. `admin` puede publicar, y un admin sin
     * confirmar es tan inventado como un arrendador sin confirmar.
     */
    #[Test]
    public function un_admin_sin_confirmar_tampoco_publica(): void
    {
        $this->actingAs(User::factory()->admin()->unverified()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos())
            ->assertForbidden();

        $this->assertDatabaseCount('properties', 0);
    }

    /**
     * Y al confirmar, ya puede. El mismo camino, no uno aparte.
     */
    #[Test]
    public function al_confirmar_el_correo_ya_puede_publicar(): void
    {
        $usuario = User::factory()->landlord()->unverified()->create();

        $this->actingAs($usuario, 'sanctum')
            ->postJson('/api/properties', $this->datosValidos())
            ->assertForbidden();

        // `markEmailAsVerified()` muta ESTA instancia, que es la misma
        // que tiene el guard de `actingAs`. Por eso no hace falta
        // `forgetGuards()`, y si se llamara se perderia el actingAs y
        // la peticion siguiente daria 401 en vez de 201.
        $usuario->markEmailAsVerified();

        $this->postJson('/api/properties', $this->datosValidos())->assertCreated();
    }

    /**
     * La puerta esta en la **Policy**, no en el middleware `verified`.
     *
     * No hay ningun middleware `verified` en `POST /api/properties`: si
     * lo hubiera y alguien lo sacara de la ruta, estas pruebas seguirian
     * pasando. Lo que las hace fallar es quitar la condicion de
     * `PropertyPolicy::create`.
     */
    #[Test]
    public function la_comprobacion_no_depende_del_middleware_verified(): void
    {
        $ruta = collect($this->app['router']->getRoutes()->getRoutes())
            ->first(fn ($ruta) => $ruta->uri() === 'api/properties' && in_array('POST', $ruta->methods()));

        $this->assertNotNull($ruta, 'La ruta de publicar deberia existir.');

        $this->assertNotContains(
            'verified',
            $ruta->gatherMiddleware(),
            'Si la puerta fuera el middleware, quitarla de la ruta abriria la API en silencio.',
        );
    }

    /**
     * Editar y gestionar NO exigen correo confirmado.
     *
     * Si pudo crearla, ya lo tenia confirmado, y la verificacion no se
     * revierte: volver a pedirla solo dejaria fuera a alguien cuyo
     * correo quedo sin confirmar por un cambio de direccion.
     */
    #[Test]
    public function un_dueno_sin_confirmar_puede_seguir_gestionando_lo_suyo(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->activa()->create();

        $dueno->forceFill(['email_verified_at' => null])->save();

        $this->actingAs($dueno, 'sanctum')
            ->putJson('/api/properties/'.$propiedad->id, $this->datosValidos())
            ->assertOk();

        $this->actingAs($dueno, 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/pause')
            ->assertOk();
    }

    /**
     * El estado no viene del cuerpo. Si una persona pudiera pedir
     * 'activa' al publicar, la moderacion no existiria.
     */
    #[Test]
    public function el_estado_no_se_puede_elegir_al_publicar(): void
    {
        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos(['status' => 'activa']))
            ->assertCreated()
            ->assertJsonPath('data.status', PropertyStatus::Pendiente->value);
    }

    /**
     * El dueno tampoco viene del cuerpo: no se puede publicar en
     * nombre de otro.
     */
    #[Test]
    public function el_dueno_no_se_puede_elegir_al_publicar(): void
    {
        $otro = User::factory()->landlord()->create();

        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos(['user_id' => $otro->id]))
            ->assertCreated();

        $this->assertDatabaseMissing('properties', ['user_id' => $otro->id]);
    }

    /**
     * RF-2.4: el pin es obligatorio. Sin el no hay nada que mostrar en
     * el mapa, y la columna ahora es NOT NULL.
     */
    #[Test]
    public function el_pin_es_obligatorio(): void
    {
        $datos = $this->datosValidos();
        unset($datos['latitude'], $datos['longitude']);

        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', $datos)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['latitude', 'longitude']);
    }

    /**
     * RF-2.5 y RF-2.4: si no se muestra la ubicacion exacta, tiene que
     * haber una referencia de texto. Si no, el marcador queda en el
     * vacio sin direccion.
     */
    #[Test]
    public function la_referencia_de_direccion_es_obligatoria(): void
    {
        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos(['address_reference' => '']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('address_reference');
    }

    #[Test]
    public function un_pin_fuera_de_alajuela_se_rechaza(): void
    {
        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos(['latitude' => 48.85, 'longitude' => 2.35]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['latitude', 'longitude']);
    }

    #[Test]
    public function una_fecha_en_el_pasado_se_rechaza(): void
    {
        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos([
                'available_from' => now()->subWeek()->toDateString(),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('available_from');
    }

    #[Test]
    public function los_errores_de_publicar_van_en_espanol(): void
    {
        $respuesta = $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties', []);

        $respuesta->assertStatus(422);

        $errores = $respuesta->json('errors');

        $this->assertStringContainsString('Falta el precio', $errores['monthly_rent'][0]);
        $this->assertStringContainsString('pin en el mapa', $errores['latitude'][0]);
    }

    /*
    |--------------------------------------------------------------------------
    | Editar y borrar
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function el_dueno_edita_su_publicacion(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->create();

        $this->actingAs($dueno, 'sanctum')
            ->putJson('/api/properties/'.$propiedad->id, $this->datosValidos([
                'title' => 'Apartamento ya no tan luminoso pero más barato',
            ]))
            ->assertOk()
            ->assertJsonPath('data.title', 'Apartamento ya no tan luminoso pero más barato');
    }

    #[Test]
    public function nadie_mas_edita_la_publicacion_de_otro(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->create();

        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->putJson('/api/properties/'.$propiedad->id, $this->datosValidos())
            ->assertForbidden();
    }

    /**
     * Un admin no edita la publicacion de otro. La moderacion
     * suspende o rechaza; no corrige el texto de alguien. Si un admin
     * puede editar, nadie sabe quien escribio que.
     */
    #[Test]
    public function un_admin_tampoco_edita_la_publicacion_de_otro(): void
    {
        $propiedad = Property::factory()->create();

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->putJson('/api/properties/'.$propiedad->id, $this->datosValidos())
            ->assertForbidden();
    }

    #[Test]
    public function el_dueno_borra_su_publicacion(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->create();

        $this->actingAs($dueno, 'sanctum')
            ->deleteJson('/api/properties/'.$propiedad->id)
            ->assertOk();

        $this->assertDatabaseMissing('properties', ['id' => $propiedad->id]);
    }

    /**
     * Borrar si lo puede el admin: es una accion de moderacion.
     */
    #[Test]
    public function un_admin_si_borra_la_publicacion_de_otro(): void
    {
        $propiedad = Property::factory()->create();

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->deleteJson('/api/properties/'.$propiedad->id)
            ->assertOk();

        $this->assertDatabaseMissing('properties', ['id' => $propiedad->id]);
    }

    #[Test]
    public function un_arrendador_no_borra_la_publicacion_de_otro(): void
    {
        $propiedad = Property::factory()->create();

        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->deleteJson('/api/properties/'.$propiedad->id)
            ->assertForbidden();

        $this->assertDatabaseHas('properties', ['id' => $propiedad->id]);
    }

    /*
    |--------------------------------------------------------------------------
    | La maquina de estados
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function el_dueno_pausa_y_reanuda(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->activa()->create();

        $this->actingAs($dueno, 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/pause')
            ->assertOk()
            ->assertJsonPath('data.status', PropertyStatus::Pausada->value);

        $this->actingAs($dueno, 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/resume')
            ->assertOk()
            ->assertJsonPath('data.status', PropertyStatus::Activa->value);
    }

    #[Test]
    public function marcar_como_alquilada_saca_el_inmueble_del_mapa(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->activa()
            ->placePin(10.3236, -84.4274)->create();

        $this->actingAs($dueno, 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/rented')
            ->assertOk();

        $this->getJson('/api/properties?lat=10.3236&lng=-84.4274&radius=1000')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    /**
     * Pausar no es lo mismo que borrar: la fila sigue y se puede
     * reactivar. Borrarla seria perder el historial.
     */
    #[Test]
    public function pausar_no_borra_la_publicacion(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->activa()->create();

        $this->actingAs($dueno, 'sanctum')->postJson('/api/properties/'.$propiedad->id.'/pause');

        $this->assertDatabaseHas('properties', [
            'id' => $propiedad->id,
            'status' => PropertyStatus::Pausada->value,
        ]);
    }

    /**
     * Pausar algo que no esta activa no vale. El mensaje dice en que
     * estado estaba y a cual pretendia ir.
     */
    #[Test]
    public function una_transicion_invalida_devuelve_422_con_el_motivo(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->borrador()->create();

        $this->actingAs($dueno, 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/pause')
            ->assertStatus(422);
    }

    #[Test]
    public function no_se_puede_aprobar_algo_que_no_esta_pendiente(): void
    {
        $propiedad = Property::factory()->activa()->create();

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/approve')
            ->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Moderacion
    |--------------------------------------------------------------------------
    */

    /**
     * El dueno no puede aprobar su propia publicacion. La moderacion
     * existe justamente para que haya alguien que no sea el dueno
     * mirandola.
     */
    #[Test]
    public function el_dueno_no_aprueba_su_propia_publicacion(): void
    {
        $dueno = User::factory()->landlord()->create();
        $propiedad = Property::factory()->de($dueno)->create([
            'status' => PropertyStatus::Pendiente,
        ]);

        $this->actingAs($dueno, 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/approve')
            ->assertForbidden();
    }

    #[Test]
    public function un_arrendador_no_moderan(): void
    {
        $propiedad = Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/approve')
            ->assertForbidden();
    }

    /**
     * Rechazar devuelve a borrador, no borra: el dueno puede
     * corregirla y volver a enviarla.
     */
    #[Test]
    public function rechazar_devuelve_a_borrador_y_no_borra(): void
    {
        $propiedad = Property::factory()->create(['status' => PropertyStatus::Pendiente]);

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->postJson('/api/properties/'.$propiedad->id.'/reject')
            ->assertOk()
            ->assertJsonPath('data.status', PropertyStatus::Borrador->value);

        $this->assertDatabaseHas('properties', ['id' => $propiedad->id]);
    }

    /**
     * El 403 de una Policy se traduce igual que el del middleware.
     *
     * Sin esto el mismo problema devuelve dos idiomas: `role:` contesta
     * "Esta cuenta no puede hacer eso." y `$this->authorize()` contesta
     * "This action is unauthorized.", que es el mensaje que trae
     * AuthorizationException escrito a mano en el framework.
     */
    #[Test]
    public function el_403_de_la_politica_no_sale_en_ingles(): void
    {
        $this->actingAs(User::factory()->tenant()->create(), 'sanctum')
            ->postJson('/api/properties', $this->datosValidos())
            ->assertForbidden()
            ->assertJsonPath('message', 'Esta cuenta no puede hacer eso.');
    }

    /**
     * Tampoco dice de quien es la publicacion. El 403 es el mismo para
     * "no es tuya" y para "tu cuenta no puede": si distinguiera,
     * quien fuera probando rutas sabria cuales existen.
     */
    #[Test]
    public function el_403_no_dice_de_quien_es_la_publicacion(): void
    {
        $propiedad = Property::factory()->create();

        $respuesta = $this->actingAs(User::factory()->landlord()->create(), 'sanctum')
            ->deleteJson('/api/properties/'.$propiedad->id)
            ->assertForbidden();

        $this->assertStringNotContainsString('tuyo', $respuesta->json('message'));
    }

    /*
    |--------------------------------------------------------------------------
    | La lista de publicaciones propias
    |--------------------------------------------------------------------------
    */

    /**
     * Cada quien ve solo lo suyo. Es un endpoint donde un error de
     * alcance seria una fuga de datos entre cuentas.
     */
    #[Test]
    public function cada_quien_ve_solo_sus_publicaciones(): void
    {
        $mia = User::factory()->landlord()->create();
        $suya = User::factory()->landlord()->create();

        Property::factory()->de($mia)->count(2)->create();
        Property::factory()->de($suya)->create();

        $this->actingAs($mia, 'sanctum')
            ->getJson('/api/my/properties')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAs($suya, 'sanctum')
            ->getJson('/api/my/properties')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    /**
     * La lista propia incluye todos los estados. El listado publico
     * solo muestra las activas, y el dueno necesita ver tambien lo que
     * esta en pausa o esperando.
     */
    #[Test]
    public function la_lista_propia_incluye_los_estados_ocultos(): void
    {
        $dueno = User::factory()->landlord()->create();

        Property::factory()->de($dueno)->activa()->create();
        Property::factory()->de($dueno)->borrador()->create();
        Property::factory()->de($dueno)->alquilada()->create();

        $this->actingAs($dueno, 'sanctum')
            ->getJson('/api/my/properties')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    #[Test]
    public function la_lista_propia_exige_sesion(): void
    {
        $this->getJson('/api/my/properties')->assertUnauthorized();
    }
}
