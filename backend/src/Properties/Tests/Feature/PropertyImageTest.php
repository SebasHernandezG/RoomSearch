<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use App\Http\Controllers\Api\PropertyImageController;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Models\Property;
use Modules\Properties\Models\PropertyImage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * La galeria de fotos. RF-2.3.
 *
 * Estas pruebas escriben y borran archivos de verdad, con el disco
 * `public` falseado a `local`. El falseado importa: con el disco real,
 * las pruebas dejarian imagenes en `storage/app/public` y el nombre
 * del archivo --que lleva `time()`-- haria que dos corridas nunca
 * coincidieran.
 *
 * @see PropertyImageController
 */
class PropertyImageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // `Storage::fake` no sirve para el disco `public`: los archivos
        // de la prueba tienen que pasar por `Storage::disk('public')`
        // como los de verdad.
        Storage::fake('public');
    }

    /*
    |--------------------------------------------------------------------------
    | Subir
    |--------------------------------------------------------------------------
    */

    /**
     * La prueba de cabeza: una foto y sale en la publicacion.
     */
    #[Test]
    public function se_sube_una_foto(): void
    {
        $property = $this->propiedad();

        $respuesta = $this->actingAs($this->dueno())->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('casa.jpg')]]
        );

        $respuesta->assertCreated();

        $this->assertCount(1, $respuesta->json('data.images'));
        $this->assertCount(1, $property->imagenes()->get());
    }

    /**
     * Sin fotos es un 422 con mensaje en el tono del proyecto.
     *
     * La foto es el unico campo obligatorio de la galeria, y el mensaje
     * tiene que decir que hacer en vez de "fotos field is required".
     */
    #[Test]
    public function sin_fotos_es_422(): void
    {
        $property = $this->propiedad();

        $respuesta = $this->actingAs($this->dueno())->postJson("/api/properties/{$property->getKey()}/images", []);

        $respuesta->assertStatus(422)->assertJsonValidationErrors('fotos');
    }

    /**
     * El limite de cantidad va en el request.
     *
     * Si se comprobara en el controlador despues de escribir los
     * archivos, nueve archivos llegarian al disco y solo se aceptarian
     * ocho.
     */
    #[Test]
    public function mas_de_ocho_fotos_es_422_y_no_escribe_nada(): void
    {
        $property = $this->propiedad();

        $fotos = array_map(fn (int $i) => $this->archivo("casa-{$i}.jpg"), range(1, 9));

        $respuesta = $this->actingAs($this->dueno())
            ->postJson("/api/properties/{$property->getKey()}/images", ['fotos' => $fotos]);

        $respuesta->assertStatus(422)->assertJsonValidationErrors('fotos');

        $this->assertSinArchivos();
        $this->assertSame(0, PropertyImage::query()->count());
    }

    /**
     * Un tipo no admitido se rechaza **antes** de escribir.
     */
    #[Test]
    public function un_pdf_no_es_una_foto(): void
    {
        $property = $this->propiedad();

        $respuesta = $this->actingAs($this->dueno())->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [UploadedFile::fake()->create('contrato.pdf', 100, 'application/pdf')]]
        );

        $respuesta->assertStatus(422)->assertJsonValidationErrors('fotos.0');

        $this->assertSinArchivos();
    }

    /**
     * El limite de tamano se comprueba antes de escribir, que es
     * cuando importa: despues, el archivo ya esta en el disco.
     */
    #[Test]
    public function una_foto_demasiado_grande_no_se_guarda(): void
    {
        $property = $this->propiedad();

        $enorme = UploadedFile::fake()
            ->image('enorme.jpg')
            ->size(PropertyImage::MAXIMO_BYTES + 1024);

        $respuesta = $this->actingAs($this->dueno())->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$enorme]]
        );

        $respuesta->assertStatus(422)->assertJsonValidationErrors('fotos.0');

        $this->assertSinArchivos();
    }

    /*
    |--------------------------------------------------------------------------
    | La principal
    |--------------------------------------------------------------------------
    */

    /**
     * Sin decir cual, la primera es la principal.
     *
     * Es la regla que hace que un anuncio recien publicado tenga
     * siempre una foto principal sin que el frontend tenga que
     * pensarlo.
     */
    #[Test]
    public function sin_indicarla_la_primera_es_la_principal(): void
    {
        $property = $this->propiedad();

        $respuesta = $this->actingAs($this->dueno())->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg'), $this->archivo('b.jpg')]]
        );

        $respuesta->assertCreated();

        $principales = $property->imagenes()->where('is_primary', true)->get();

        $this->assertCount(1, $principales);
        $this->assertSame(0, (int) $principales->first()->position);
    }

    #[Test]
    public function se_puede_elegir_cual_es_la_principal(): void
    {
        $property = $this->propiedad();

        $this->actingAs($this->dueno())->postJson(
            "/api/properties/{$property->getKey()}/images",
            [
                'fotos' => [$this->archivo('a.jpg'), $this->archivo('b.jpg'), $this->archivo('c.jpg')],
                'principal' => 2,
            ]
        )->assertCreated();

        $principal = $property->imagenes()->where('is_primary', true)->sole();

        $this->assertSame(2, (int) $principal->position);
    }

    /**
     * El indice tiene que existir.
     *
     * `principal: 9` en una subida de tres no es "la ultima": si se
     * aceptara, la galeria quedaria sin principal y el frontend no
     * sabria cual poner primero.
     */
    #[Test]
    public function un_principal_que_no_existe_cae_en_la_primera(): void
    {
        $property = $this->propiedad();

        $this->actingAs($this->dueno())->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg')], 'principal' => 9]
        )->assertCreated();

        $this->assertSame(1, $property->imagenes()->where('is_primary', true)->count());
    }

    /**
     * Subir una nueva principal baja la anterior.
     *
     * El indice unico parcial de la tabla es lo que garantiza que no
     * haya dos; esta prueba es la que comprueba que la aplicacion
     * resuelve **antes** de insertar, y no que la base la rechace a
     * mitad de una subida.
     */
    #[Test]
    public function una_nueva_principal_reemplaza_a_la_anterior(): void
    {
        $property = $this->propiedad();
        $dueno = $this->dueno();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg'), $this->archivo('b.jpg')]]
        )->assertCreated();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('c.jpg')], 'principal' => 0]
        )->assertCreated();

        $this->assertSame(1, $property->imagenes()->where('is_primary', true)->count());
    }

    /*
    |--------------------------------------------------------------------------
    | Permisos
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function un_visitante_no_sube_fotos(): void
    {
        $property = $this->propiedad();

        $this->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg')]]
        )->assertUnauthorized();
    }

    /**
     * Un arrendador no sube fotos al anuncio de otro.
     */
    #[Test]
    public function un_arrendador_no_sube_fotos_al_annuncio_de_otro(): void
    {
        $property = $this->propiedad();

        $otro = User::factory()->landlord()->create();
        $otro->markEmailAsVerified();

        $this->actingAs($otro)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg')]]
        )->assertForbidden();
    }

    /*
    |--------------------------------------------------------------------------
    | Borrar
    |--------------------------------------------------------------------------
    */

    /**
     * No se borra la ultima foto.
     *
     * Un anuncio sin ninguna es un anuncio que no se puede ver con
     * informacion, y dejar al dueno en esa situacion sin avisar es
     * peor que negar la operacion.
     */
    #[Test]
    public function no_se_borra_la_ultima_foto(): void
    {
        $property = $this->propiedad();
        $dueno = $this->dueno();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg')]]
        )->assertCreated();

        $imagen = $property->imagenes()->sole();

        $respuesta = $this->actingAs($dueno)->deleteJson("/api/properties/{$property->getKey()}/images/{$imagen->getKey()}");

        $respuesta->assertStatus(422);
        $this->assertSame(1, $property->imagenes()->count());
        $this->assertThatHayArchivos();
    }

    /**
     * El archivo se borra del disco, no solo la fila.
     *
     * Una fila sin archivo es una foto rota que se queda ahi para
     * siempre; un archivo sin fila ocupa disco y nadie la va a borrar.
     */
    #[Test]
    public function al_borrar_se_borra_el_archivo(): void
    {
        $property = $this->propiedad();
        $dueno = $this->dueno();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg'), $this->archivo('b.jpg')]]
        )->assertCreated();

        $imagen = $property->imagenes()->where('is_primary', false)->sole();

        $this->actingAs($dueno)->deleteJson("/api/properties/{$property->getKey()}/images/{$imagen->getKey()}")
            ->assertOk();

        Storage::disk('public')->assertMissing($imagen->path);
        $this->assertSame(1, $property->imagenes()->count());
    }

    /**
     * Si la que se borro era la principal, otra pasa a serlo.
     */
    #[Test]
    public function al_borrar_la_principal_otra_toma_el_lugar(): void
    {
        $property = $this->propiedad();
        $dueno = $this->dueno();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg'), $this->archivo('b.jpg')]]
        )->assertCreated();

        $principal = $property->imagenes()->where('is_primary', true)->sole();

        $this->actingAs($dueno)->deleteJson("/api/properties/{$property->getKey()}/images/{$principal->getKey()}")
            ->assertOk();

        $this->assertSame(1, $property->imagenes()->where('is_primary', true)->count());
    }

    /**
     * Una foto de otro anuncio no se borra desde este.
     *
     * Sin esto, `DELETE /properties/1/images/99` borraria la foto de
     * la publicacion 99 escribiendo en el recurso de la 1.
     */
    #[Test]
    public function no_se_borra_una_foto_de_otro_anuncio(): void
    {
        $property = $this->propiedad();
        $ajena = $this->propiedad();

        $dueno = $this->dueno();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$ajena->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg'), $this->archivo('b.jpg')]]
        )->assertCreated();

        $imagen = $ajena->imagenes()->firstOrFail();

        $this->actingAs($dueno)->deleteJson("/api/properties/{$property->getKey()}/images/{$imagen->getKey()}")
            ->assertNotFound();

        $this->assertSame(2, $ajena->imagenes()->count());
    }

    /*
    |--------------------------------------------------------------------------
    | Como sale
    |--------------------------------------------------------------------------
    */

    /**
     * La galeria viaja con `url`, `alt` y cual es la principal.
     */
    #[Test]
    public function la_galeria_trae_url_alt_y_cual_es_la_principal(): void
    {
        $property = $this->propiedad();
        $dueno = $this->dueno();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg')]]
        )->assertCreated();

        /*
         * Se lee por `/my/properties` y no por el detalle publico.
         *
         * El detalle publico da 404 para una publicacion que no esta
         * 'activa' --correcto-- y esta prueba necesita una en
         * 'pendiente' para ver la galeria de algo que aun no se publico.
         */
        $foto = $this->actingAs($dueno)
            ->getJson('/api/my/properties')
            ->json('data.0.images.0');

        $this->assertArrayHasKey('url', $foto);
        $this->assertArrayHasKey('alt', $foto);
        $this->assertTrue($foto['is_primary']);
    }

    /**
     * Una foto cuyo archivo no esta, se omite.
     *
     * Devolverla con una URL rota produce una imagen rota en pantalla.
     * El issue de DS-12 lo pide de forma explicita: "placeholder
     * elegante, no imagen rota".
     */
    #[Test]
    public function una_foto_sin_archivo_no_sale_rota(): void
    {
        $property = $this->propiedad();
        $dueno = $this->dueno();

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg')]]
        )->assertCreated();

        // Se borra el archivo de disco dejando la fila viva.
        Storage::disk('public')->delete($property->imagenes()->sole()->path);

        $this->assertSame([], $this->actingAs($dueno)->getJson('/api/my/properties')->json('data.0.images'));
    }

    /**
     * El texto alternativo por defecto es el titulo del anuncio.
     *
     * Describe el inmueble y es lo unico que hay sin que el dueno
     * escriba nada. DS-10 exige `alt` en toda imagen.
     */
    #[Test]
    public function el_alt_por_defecto_es_el_titulo(): void
    {
        $property = $this->propiedad();

        $this->actingAs($this->dueno())->postJson(
            "/api/properties/{$property->getKey()}/images",
            ['fotos' => [$this->archivo('a.jpg')]]
        )->assertCreated();

        $this->assertSame($property->title, $property->imagenes()->sole()->alt);
    }

    /*
    |--------------------------------------------------------------------------
    | El recorrido completo
    |--------------------------------------------------------------------------
    */

    /**
     * Publicar, subir foto y ver la galeria en el mapa.
     */
    #[Test]
    public function publicar_con_foto_y_verla_en_el_listado_publico(): void
    {
        $dueno = $this->dueno();

        $creada = $this->actingAs($dueno)->postJson('/api/properties', $this->datosValidos());
        $creada->assertCreated();

        $id = $creada->json('data.id');

        $this->actingAs($dueno)->postJson(
            "/api/properties/{$id}/images",
            ['fotos' => [$this->archivo('sala.jpg'), $this->archivo('cocina.jpg')]]
        )->assertCreated();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->postJson("/api/properties/{$id}/approve")->assertOk();

        $foto = $this->getJson('/api/properties')->json('data.0.images.0');

        $this->assertNotNull($foto, 'La foto tiene que salir en el listado publico.');
        $this->assertTrue($foto['is_primary']);
    }

    /*
    |--------------------------------------------------------------------------
    | Ayudas
    |--------------------------------------------------------------------------
    */

    /**
     * El dueno de esta prueba.
     *
     * **Cacheado** a proposito. Si creara una cuenta nueva en cada
     * llamada, `propiedad()` y `actingAs(dueno())` usarian cuentas
     * distintas y el 403 del permiso seria del test, no del codigo --
     * que es como se confunde un fallo real con uno propio. Paso con
     * esto: doce pruebas en rojo por un helper.
     */
    private function dueno(): User
    {
        if ($this->dueno instanceof User) {
            return $this->dueno;
        }

        $this->dueno = User::factory()->landlord()->create();
        $this->dueno->markEmailAsVerified();

        return $this->dueno;
    }

    /** El dueno cacheado de esta prueba. */
    private ?User $dueno = null;

    private function propiedad(): Property
    {
        return Property::factory()->de($this->dueno())->create([
            'status' => PropertyStatus::Pendiente,
        ]);
    }

    private function archivo(string $nombre): UploadedFile
    {
        return UploadedFile::fake()->image($nombre)->size(200);
    }

    /**
     * Que no quedo ningun archivo en el disco.
     *
     * Storage::disk()->assertCount() pide un directorio, y contar
     * archivos sueltos con llFiles() es lo que de verdad comprueba
     * que no se escribio nada.
     */
    private function assertSinArchivos(): void
    {
        $this->assertSame([], Storage::disk('public')->allFiles(), 'Quedaron archivos en el disco.');
    }

    /**
     * Que hay al menos un archivo, sin decir cuantos.
     */
    private function assertThatHayArchivos(): void
    {
        $this->assertNotSame([], Storage::disk('public')->allFiles());
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
