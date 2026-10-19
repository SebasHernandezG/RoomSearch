<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use App\Http\Controllers\Api\InterestController;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\InterestStatus;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Interest;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * "Me interesa" de punta a punta. RF-5.1.
 *
 * La prueba de cabeza es `el_recorrido_completo`: alguien escribe, el
 * dueno lo ve en su bandeja, responde, y el interesado lee la
 * respuesta. Sin el ultimo paso el boton no le sirve de nada a quien
 * lo pulsa.
 *
 * @see InterestController
 */
class InterestFlowTest extends TestCase
{
    use RefreshDatabase;

    /*
    |--------------------------------------------------------------------------
    | Mandar la solicitud
    |--------------------------------------------------------------------------
    */

    /**
     * La prueba minima: se manda y existe.
     */
    #[Test]
    public function se_manda_una_solicitud(): void
    {
        $inmueble = $this->inmueble();

        $respuesta = $this->actingAs($this->inquilino())->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        );

        $respuesta->assertCreated()
            ->assertJsonPath('data.status', 'nueva')
            ->assertJsonPath('data.reply', null);

        $this->assertDatabaseHas('interests', [
            'property_id' => $inmueble->getKey(),
            'status' => 'nueva',
        ]);
    }

    /**
     * Sin sesion no se manda.
     */
    #[Test]
    public function sin_sesion_no_se_manda(): void
    {
        $inmueble = $this->inmueble();

        $this->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertUnauthorized();
    }

    /**
     * Un mensaje de dos palabras no es una solicitud.
     *
     * "Me interesa" pasa un `required` y no le dice nada al dueno. Por
     * eso hay un minimo de 10 caracteres: con eso ya hay una frase.
     */
    #[Test]
    public function un_mensaje_muy_corto_no_alcanza(): void
    {
        $inmueble = $this->inmueble();

        $respuesta = $this->actingAs($this->inquilino())->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Me interesa'],
        );

        $respuesta->assertStatus(422)->assertJsonValidationErrors('message');

        $this->assertSame(0, Interest::query()->count());
    }

    /**
     * Diez espacios cumplen el minimo y no dicen nada.
     *
     * Por eso `solicitud()` hace `trim()`: el `min` de Laravel cuenta
     * antes de recortar.
     */
    #[Test]
    public function un_mensaje_de_espacios_no_alcanza(): void
    {
        $inmueble = $this->inmueble();

        $respuesta = $this->actingAs($this->inquilino())->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => '          '],
        );

        $respuesta->assertStatus(422)->assertJsonValidationErrors('message');
    }

    /**
     * Un anuncio que no esta activo no recibe solicitudes.
     *
     * Con 404 y no 422: un anuncio pausado no existe para el publico, y
     * un 422 diria "tu solicitud tiene un problema" cuando el problema
     * no es de quien escribe.
     */
    #[Test]
    public function un_anuncio_pausado_no_recibe_solicitudes(): void
    {
        $inmueble = $this->inmueble(['status' => PropertyStatus::Pausada]);

        $this->actingAs($this->inquilino())->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertNotFound();
    }

    /**
     * Nadie se interesa en su propio anuncio.
     */
    #[Test]
    public function el_dueno_no_se_interesa_en_su_propio_anuncio(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertStatus(422);
    }

    /**
     * El criterio literal del issue: no hay dos.
     */
    #[Test]
    public function no_se_puede_escribir_dos_veces_en_el_mismo_anuncio(): void
    {
        $inmueble = $this->inmueble();
        $inquilino = $this->inquilino();

        $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Primera vez, ¿sigue disponible?'],
        )->assertCreated();

        $segunda = $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Segunda vez, insistiendo un poco.'],
        );

        $segunda->assertStatus(422)->assertJsonValidationErrors('property_id');

        $this->assertSame(1, Interest::query()->count());
    }

    /**
     * El 422 del duplicado trae la fila que ya existe.
     *
     * Sin ella, quien ya habia escrito pierde su mensaje al recibir el
     * error, y el boton queda en un estado que no sabe pintar.
     */
    #[Test]
    public function el_error_de_duplicado_devuelve_la_solicitud_existente(): void
    {
        $inmueble = $this->inmueble();
        $inquilino = $this->inquilino();

        $primera = $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Primera vez, ¿sigue disponible?'],
        )->assertCreated();

        $segunda = $this->actingAs($inquilino)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Segunda vez, insistiendo un poco.'],
        )->assertStatus(422);

        $this->assertSame(
            $primera->json('data.id'),
            $segunda->json('data.id'),
            'El error tiene que devolver la fila que ya existia.',
        );

        $this->assertSame('Primera vez, ¿sigue disponible?', $segunda->json('data.message'));
    }

    /**
     * El indice unico, no solo la comprobacion.
     *
     * La comprobacion previa tiene una ventana de milisegundos: dos
     * pestanas la cruzan y las dos insertan. Lo que cierra esa ventana
     * es la base, y se comprueba sin pasar por el controlador.
     */
    #[Test]
    public function el_indice_no_permite_dos_filas_iguales(): void
    {
        $inmueble = $this->inmueble();
        $inquilino = $this->inquilino();

        Interest::create([
            'property_id' => $inmueble->getKey(),
            'user_id' => $inquilino->getKey(),
            'message' => 'La primera.',
            'status' => InterestStatus::Nueva,
        ]);

        $this->expectException(UniqueConstraintViolationException::class);

        DB::table('interests')->insert([
            'property_id' => $inmueble->getKey(),
            'user_id' => $inquilino->getKey(),
            'message' => 'La segunda, que deberia rebotar.',
            'status' => 'nueva',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | La bandeja del dueno
    |--------------------------------------------------------------------------
    */

    /**
     * El criterio literal: solo ve las suyas.
     *
     * Y no solo en la bandeja: si la consulta no filtra, la respuesta
     * tambien se escapa.
     */
    #[Test]
    public function el_dueno_solo_ve_las_solicitudes_de_sus_inmuebles(): void
    {
        $dueno = $this->dueno();
        $suyo = $this->inmueble(['user_id' => $dueno->getKey()]);

        $ajeno = $this->inmueble(['user_id' => $this->otroDueno()->getKey()]);

        Interest::factory()->create(['property_id' => $suyo->getKey()]);
        Interest::factory()->create(['property_id' => $ajeno->getKey()]);

        $bandeja = $this->actingAs($dueno)->getJson('/api/my/interests');

        $bandeja->assertSuccessful();

        $ids = array_map(
            static fn (array $_): ?int => $_['inmueble']['id'] ?? null,
            $bandeja->json('data'),
        );

        $this->assertContains($suyo->getKey(), $ids);
        $this->assertNotContains($ajeno->getKey(), $ids);
    }

    /**
     * El dueno necesita saber **quien** le escribe.
     *
     * Sin esto no puede ni contestar "hola, soy Ana", y la bandeja es
     * una lista de textos sueltos.
     */
    #[Test]
    public function la_bandeja_dice_quien_escribio(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);
        $inquilino = $this->inquilino();

        Interest::factory()->create([
            'property_id' => $inmueble->getKey(),
            'user_id' => $inquilino->getKey(),
        ]);

        $bandeja = $this->actingAs($dueno)->getJson('/api/my/interests');

        $bandeja->assertSuccessful()
            ->assertJsonPath('data.0.interesado.id', $inquilino->getKey())
            ->assertJsonPath('data.0.interesado.name', $inquilino->name);
    }

    /**
     * Y tambien necesita saber si la cuenta es real.
     */
    #[Test]
    public function la_bandeja_dice_si_el_correo_esta_confirmado(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);

        Interest::factory()->create([
            'property_id' => $inmueble->getKey(),
            'user_id' => $this->inquilino()->getKey(),
        ]);

        Interest::factory()->create([
            'property_id' => $inmueble->getKey(),
            'user_id' => $this->inquilinoSinConfirmar()->getKey(),
        ]);

        $bandeja = $this->actingAs($dueno)->getJson('/api/my/interests');

        $verificados = array_map(
            static fn (array $_): ?int => $_['interesado']['id'] ?? null,
            array_filter(
                $bandeja->json('data'),
                static fn (array $i): bool => ($i['interesado']['email_verified'] ?? false) === true,
            ),
        );

        $this->assertCount(1, $verificados, 'Una sola de las dos cuentas tiene el correo confirmado.');
    }

    /**
     * El badge cuenta lo que no se ha mirado.
     *
     * Y va **sin** el filtro de estado: si el dueno esta viendo
     * "descartadas", el numero de nuevas sigue siendo el mismo.
     */
    #[Test]
    public function el_badge_cuenta_las_nuevas(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);

        Interest::factory()->count(3)->nueva()->create(['property_id' => $inmueble->getKey()]);
        Interest::factory()->count(2)->respondida()->create(['property_id' => $inmueble->getKey()]);
        Interest::factory()->count(1)->descartada()->create(['property_id' => $inmueble->getKey()]);

        $this->actingAs($dueno)->getJson('/api/my/interests')
            ->assertSuccessful()
            ->assertJsonPath('nuevas', 3);
    }

    /**
     * Y no baja con el filtro puesto.
     *
     * Si bajara, el badge dependeria de la pantalla en la que se este:
     * el mismo dueno veria 3 en "todas" y 0 en "descartadas".
     */
    #[Test]
    public function el_badge_no_cambia_con_el_filtro(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);

        Interest::factory()->count(3)->nueva()->create(['property_id' => $inmueble->getKey()]);
        Interest::factory()->count(2)->descartada()->create(['property_id' => $inmueble->getKey()]);

        $this->actingAs($dueno)->getJson('/api/my/interests?status=descartada')
            ->assertSuccessful()
            ->assertJsonPath('nuevas', 3)
            ->assertJsonCount(2, 'data');
    }

    /**
     * Las de otro no cuentan en el badge de este.
     */
    #[Test]
    public function el_badge_no_cuenta_lo_de_otros(): void
    {
        $dueno = $this->dueno();
        $ajeno = $this->inmueble(['user_id' => $this->otroDueno()->getKey()]);

        Interest::factory()->count(5)->create(['property_id' => $ajeno->getKey()]);

        $this->actingAs($dueno)->getJson('/api/my/interests')
            ->assertSuccessful()
            ->assertJsonPath('nuevas', 0);
    }

    #[Test]
    public function se_puede_filtrar_por_estado(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);

        Interest::factory()->count(3)->nueva()->create(['property_id' => $inmueble->getKey()]);
        Interest::factory()->count(1)->respondida()->create(['property_id' => $inmueble->getKey()]);

        $this->actingAs($dueno)->getJson('/api/my/interests?status=respondida')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'respondida');
    }

    /**
     * Un estado inventado cae a "todas".
     *
     * Viene de un `<select>` con valores fijos, y un 422 por un
     * parametro mal escrito en la URL es una pantalla en blanco.
     */
    #[Test]
    public function un_estado_que_no_existe_muestra_todas(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);

        Interest::factory()->count(2)->create(['property_id' => $inmueble->getKey()]);

        $this->actingAs($dueno)->getJson('/api/my/interests?status=inventado')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data');
    }

    #[Test]
    public function la_bandeja_exige_sesion(): void
    {
        $this->getJson('/api/my/interests')->assertUnauthorized();
    }

    /*
    |--------------------------------------------------------------------------
    | Responder
    |--------------------------------------------------------------------------
    */

    /**
     * Responder cambia el estado y guarda cuando.
     */
    #[Test]
    public function el_dueno_puede_responder(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud->getKey()}", [
            'reply' => 'Sí, sigue disponible. Escribeme para coordinar una visita.',
            'status' => 'respondida',
        ])->assertSuccessful()->assertJsonPath('data.status', 'respondida');

        $this->assertNotNull($solicitud->refresh()->replied_at);
    }

    /**
     * Y descartar, que es distinto aunque tambien lleve respuesta.
     */
    #[Test]
    public function el_dueno_puede_descartar_con_motivo(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud->getKey()}", [
            'reply' => 'Gracias por escribir, pero ya está alquilado.',
            'status' => 'descartada',
        ])->assertSuccessful()->assertJsonPath('data.status', 'descartada');
    }

    /**
     * La respuesta es obligatoria.
     *
     * Un descarte sin motivo es un "no" sin explicacion, que es la
     * experiencia que hace que alguien no vuelva a escribir a nadie.
     */
    #[Test]
    public function descartar_sin_motivo_no_se_puede(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud->getKey()}", [
            'status' => 'descartada',
        ])->assertStatus(422)->assertJsonValidationErrors('reply');
    }

    /**
     * El estado va explicito.
     *
     * Adivinar si el dueno quiere responder o descartar es justo lo que
     * no hay que hacer.
     */
    #[Test]
    public function el_estado_es_obligatorio(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud->getKey()}", [
            'reply' => 'Una respuesta sin destino.',
        ])->assertStatus(422)->assertJsonValidationErrors('status');
    }

    /**
     * El estado no puede volver a 'nueva'.
     *
     * Con la validacion `in:respondida,descartada`: si el dueno
     * pudiera volver a "nueva", el badge volveria a contar una
     * solicitud que ya contesto.
     */
    #[Test]
    public function no_se_puede_deshacer_a_nueva(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud->getKey()}", [
            'reply' => 'Intentando devolverla a la bandeja.',
            'status' => 'nueva',
        ])->assertStatus(422)->assertJsonValidationErrors('status');
    }

    /**
     * El interesado no puede responder ni a si mismo.
     *
     * Si pudiera, podria editar su propio mensaje disfrazado de
     * respuesta y borrar la evidencia de que le contestaron.
     */
    #[Test]
    public function el_interesado_no_puede_responder(): void
    {
        $interesado = $this->inquilino();
        $solicitud = Interest::factory()->create(['user_id' => $interesado->getKey()]);

        $this->actingAs($interesado)->patchJson("/api/interests/{$solicitud->getKey()}", [
            'reply' => 'Fingiendo que soy el dueno del inmueble.',
            'status' => 'respondida',
        ])->assertForbidden();
    }

    /**
     * Ni un dueno que no es dueno de ese inmueble.
     *
     * Si pudiera, el interesado recibiria la respuesta de alguien que no
     * es el dueño del anuncio y no tendria forma de notarlo.
     */
    #[Test]
    public function otro_dueno_no_puede_responder(): void
    {
        $solicitud = $this->solicitudPara($this->dueno());

        $this->actingAs($this->otroDueno())->patchJson(
            "/api/interests/{$solicitud->getKey()}",
            [
                'reply' => 'Yo no soy el dueño, pero contesto igual.',
                'status' => 'respondida',
            ],
        )->assertForbidden();
    }

    #[Test]
    public function responder_exige_sesion(): void
    {
        $solicitud = $this->solicitudPara($this->dueno());

        $this->patchJson("/api/interests/{$solicitud->getKey()}", [
            'reply' => 'Sin sesion no hay quien responda.',
            'status' => 'respondida',
        ])->assertUnauthorized();
    }

    /*
    |--------------------------------------------------------------------------
    | Mis solicitudes
    |--------------------------------------------------------------------------
    */

    /**
     * El otro criterio literal: el interesado ve la respuesta.
     */
    #[Test]
    public function el_interesado_ve_la_respuesta(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $this->actingAs($dueno)->patchJson("/api/interests/{$solicitud->getKey()}", [
            'reply' => 'Sí, sigue disponible. Escribeme para coordinar una visita.',
            'status' => 'respondida',
        ])->assertSuccessful();

        $this->actingAs($solicitud->interesado)
            ->getJson('/api/interests')
            ->assertSuccessful()
            ->assertJsonPath('data.0.reply', 'Sí, sigue disponible. Escribeme para coordinar una visita.')
            ->assertJsonPath('data.0.status', 'respondida');
    }

    /**
     * Solo las suyas.
     */
    #[Test]
    public function uno_solo_ve_las_solicitudes_que_mando(): void
    {
        $yo = $this->inquilino();

        $mio = Interest::factory()->create(['user_id' => $yo->getKey()]);
        Interest::factory()->create(['user_id' => $yo->getKey()]);

        /*
         * `actingAs` con el modelo y no con `$mio->user_id`.
         *
         * El atributo es un `int` y el metodo pide un
         * `Authenticatable`: el error sale al correr, no al escribir,
         * y en medio de una prueba de veinte no dice nada de que lo
         * que hay que pasar es el usuario.
         */
        $vistos = array_column(
            $this->actingAs($yo)->getJson('/api/interests')->assertSuccessful()->json('data'),
            'id',
        );

        $this->assertContains($mio->getKey(), $vistos);
        $this->assertCount(2, $vistos);
    }

    /**
     * Y ve el estado del inmueble, que es lo que explica un silencio.
     *
     * Sin esto, "Anotado" es ambiguo: no se sabe si le van a contestar
     * o si el anuncio se alquilo mientras tanto.
     */
    #[Test]
    public function mis_solicitudes_dicen_el_estado_del_inmueble(): void
    {
        $inmueble = $this->inmueble();
        $interesado = $this->inquilino();

        $solicitud = Interest::factory()->create([
            'property_id' => $inmueble->getKey(),
            'user_id' => $interesado->getKey(),
        ]);

        $this->actingAs($interesado)->getJson('/api/interests')
            ->assertSuccessful()
            ->assertJsonPath('data.0.estado_inmueble', 'activa');

        $inmueble->update(['status' => PropertyStatus::Alquilada]);

        $this->actingAs($interesado)->getJson('/api/interests')
            ->assertSuccessful()
            ->assertJsonPath('data.0.estado_inmueble', 'alquilada');
    }

    #[Test]
    public function mis_solicitudes_exigen_sesion(): void
    {
        $this->getJson('/api/interests')->assertUnauthorized();
    }

    /*
    |--------------------------------------------------------------------------
    | RF-2.5: la ubicacion se revela al escribir
    |--------------------------------------------------------------------------
    */

    /**
     * Quien escribe recibe la ubicacion exacta del inmueble.
     *
     * Es el criterio de RF-2.5 --"el radio real solo se revela al
     * inquilino tras Me interesa"-- y es lo que hace que el boton
     * tenga un valor mas alla de avisar.
     */
    #[Test]
    public function escribir_revela_la_ubicacion_exacta(): void
    {
        $inmueble = $this->inmueble(['show_exact_location' => false]);
        $interesado = $this->inquilino();

        $this->actingAs($interesado)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Me mudaría la próxima semana.'],
        )->assertSuccessful();

        /*
         * Las coordenadas se comparan contra el modelo y no contra un
         * numero fijo.
         *
         * La fabrica pone un distrito al azar de San Carlos con su
         * centro aproximado, y comprobar contra `10.3236` --el valor
         * de Ciudad Quesada-- mide el azar del faker y no la
         * funcionalidad. Si el inmueble cae en otro distrito la
         * prueba falla sin que nada este roto.
         *
         * Y se leen **con parentesis**: `latitude()` es un metodo que
         * consulta la columna POINT, no un atributo.
         */
        $this->actingAs($interesado)
            ->getJson('/api/interests')
            ->assertSuccessful()
            ->assertJsonPath('data.0.inmueble.ubicacion_exacta.latitude', $inmueble->latitude())
            ->assertJsonPath('data.0.inmueble.ubicacion_exacta.longitude', $inmueble->longitude());
    }

    /**
     * Y no se revela en la bandeja del dueno, que ya la tiene.
     *
     * Mandarsela seria hacer trabajar al frontend para nada.
     */
    #[Test]
    public function la_bandeja_no_repita_la_ubicacion(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $this->actingAs($dueno)->getJson('/api/my/interests')
            ->assertSuccessful()
            ->assertJsonPath('data.0.id', $solicitud->getKey())
            ->assertJsonPath('data.0.inmueble.ubicacion_exacta', null);
    }

    /*
    |--------------------------------------------------------------------------
    | El recorrido completo
    |--------------------------------------------------------------------------
    */

    /**
     * La prueba que dice si el boton sirve de algo.
     *
     * Alguien escribe, el dueno lo ve, responde, y el interesado lee
     * la respuesta. Sin el ultimo paso, "Me interesa" seria un
     * formulario que desaparece.
     */
    #[Test]
    public function el_recorrido_completo(): void
    {
        $dueno = $this->dueno();
        $inmueble = $this->inmueble(['user_id' => $dueno->getKey()]);
        $interesado = $this->inquilino();

        // 1 · Alguien escribe desde la ficha.
        $mandada = $this->actingAs($interesado)->postJson(
            "/api/properties/{$inmueble->getKey()}/interests",
            ['message' => 'Hola, ¿sigue disponible? Puedo dar referencias.'],
        )->assertCreated();

        $id = $mandada->json('data.id');

        // 2 · Aparece en la bandeja del dueno, con quien la mando.
        $bandeja = $this->actingAs($dueno)->getJson('/api/my/interests');

        $bandeja->assertSuccessful()
            ->assertJsonPath('nuevas', 1)
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.interesado.name', $interesado->name)
            ->assertJsonPath('data.0.unread', true);

        // 3 · El dueno responde.
        $this->actingAs($dueno)->patchJson("/api/interests/{$id}", [
            'reply' => 'Sí, sigue disponible. Llamame al 8888-1234.',
            'status' => 'respondida',
        ])->assertSuccessful();

        // 4 · El interesado lee la respuesta, y el badge baja.
        $this->actingAs($interesado)->getJson('/api/interests')
            ->assertSuccessful()
            ->assertJsonPath('data.0.reply', 'Sí, sigue disponible. Llamame al 8888-1234.');

        $this->actingAs($dueno)->getJson('/api/my/interests')
            ->assertSuccessful()
            ->assertJsonPath('nuevas', 0);
    }

    /**
     * Borrar el inmueble se lleva sus solicitudes.
     *
     * Si no, la bandeja del dueno --que se calcula por `whereHas`--
     * dejaria filas huerfanas que nadie puede responder ni borrar.
     *
     * El inmueble va en `borrador` porque es el unico estado del que
     * `PropertyPolicy` deja borrar: un anuncio activo primero se pausa
     * o se alquila, y probarlo en `borrador` es lo que se quiere
     * comprobar aqui.
     */
    #[Test]
    public function borrar_el_inmueble_se_lleva_las_solicitudes(): void
    {
        $dueno = $this->dueno();
        $solicitud = $this->solicitudPara($dueno);

        $inmueble = $solicitud->inmueble;
        $inmueble->update(['status' => PropertyStatus::Borrador]);

        $this->actingAs($dueno)->deleteJson("/api/properties/{$inmueble->getKey()}")->assertOk();

        $this->assertSame(0, Interest::query()->count());
    }

    /*
    |--------------------------------------------------------------------------
    | Ayudas
    |--------------------------------------------------------------------------
    */

    private function dueno(): User
    {
        $dueno = User::factory()->landlord()->create();
        $dueno->markEmailAsVerified();

        return $dueno;
    }

    private function otroDueno(): User
    {
        $dueno = User::factory()->landlord()->create();
        $dueno->markEmailAsVerified();

        return $dueno;
    }

    private function inquilino(): User
    {
        $inquilino = User::factory()->tenant()->create();
        $inquilino->markEmailAsVerified();

        return $inquilino;
    }

    private function inquilinoSinConfirmar(): User
    {
        // Sin `unverified()` la fabrica crea la cuenta ya confirmada.
        return User::factory()->tenant()->unverified()->create();
    }

    private function inmueble(array $extra = []): Property
    {
        return Property::factory()->activa()->create([
            'user_id' => $this->dueno()->getKey(),
            ...$extra,
        ]);
    }

    /**
     * Una solicitud sobre un inmueble de $dueno.
     */
    private function solicitudPara(User $dueno): Interest
    {
        return Interest::factory()->create([
            'property_id' => $this->inmueble(['user_id' => $dueno->getKey()])->getKey(),
            'user_id' => $this->inquilino()->getKey(),
        ]);
    }
}
