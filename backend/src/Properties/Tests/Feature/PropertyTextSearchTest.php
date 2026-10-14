<?php

declare(strict_types=1);

namespace Modules\Properties\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Properties\Models\Property;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Busqueda por texto. RF-4.3.
 *
 * No tenia ninguna prueba. Los filtros y el orden si estaban, pero la
 * parte de texto libre --la que escribe la persona-- nunca se probo,
 * y por ahi es donde se colaron los criterios incumplidos.
 */
class PropertyTextSearchTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Un inmueble con titulo, distrito y barrio propios, para no
     * depender de lo que diga el factory.
     *
     * @param  array<string, mixed>  $datos
     */
    private function inmueble(array $datos): Property
    {
        return Property::factory()->activa()->create($datos);
    }

    /**
     * Los ids que devuelve la busqueda, en cualquier orden.
     *
     * @return list<int>
     */
    private function buscar(string $termino): array
    {
        $respuesta = $this->getJson('/api/properties?q='.urlencode($termino))
            ->assertOk();

        return array_column($respuesta->json('data'), 'id');
    }

    /**
     * Los ids del listado sin busqueda, que es lo que tiene que
     * devolver un termino que no dispara consulta.
     *
     * @return list<int>
     */
    private function listadoCompleto(): array
    {
        $respuesta = $this->getJson('/api/properties')->assertOk();

        return array_column($respuesta->json('data'), 'id');
    }

    /*
    |--------------------------------------------------------------------------
    | Que encuentra
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function encuentra_por_titulo(): void
    {
        $este = $this->inmueble([
            'title' => 'Apartamento con terraza en Ciudad Quesada',
        ]);

        $otro = $this->inmueble(['title' => 'Casa en Zarcero']);

        $this->assertContains($este->id, $this->buscar('terraza'));
        $this->assertNotContains($otro->id, $this->buscar('terraza'));
    }

    #[Test]
    public function encuentra_por_distrito(): void
    {
        $este = $this->inmueble([
            'title' => 'Apartamento luminoso',
            'district' => 'Ciudad Quesada',
        ]);

        $this->assertContains($este->id, $this->buscar('Quesada'));
    }

    #[Test]
    public function encuentra_por_barrio(): void
    {
        $este = $this->inmueble([
            'title' => 'Apartamento luminoso',
            'neighborhood' => 'La Pradera',
        ]);

        $this->assertContains($este->id, $this->buscar('Pradera'));
    }

    /*
    |--------------------------------------------------------------------------
    | Mayusculas y acentos
    |--------------------------------------------------------------------------
    */

    /**
     * Escribir en mayusculas no es una busqueda distinta.
     */
    #[Test]
    public function no_distingue_mayusculas(): void
    {
        $este = $this->inmueble(['title' => 'Apartamento en Ciudad Quesada']);

        $this->assertContains($este->id, $this->buscar('ciudad quesada'));
        $this->assertContains($este->id, $this->buscar('CIUDAD QUESADA'));
        $this->assertContains($este->id, $this->buscar('QuEsAdA'));
    }

    /**
     * Criterio explicito de RF-4.3: la busqueda no distingue acentos.
     *
     * Sin esto, alguien que escribe "Alajuela" no encuentra
     * "Alajuela" escrito con tilde, y el buscador parece roto: el
     * texto esta ahi, se ve en pantalla, y no aparece.
     *
     * En Costa Rica esto no es un caso raro ni exotico: los nombres de
     * distrito llevan tilde todo el tiempo.
     */
    #[Test]
    public function no_distingue_acentos(): void
    {
        $este = $this->inmueble(['title' => 'Apartamento en Alajuela']);

        $this->assertContains($este->id, $this->buscar('Alajuela'));
    }

    /**
     * El otro sentido: el usuario escribe sin tilde y el anuncio la
     * tiene. Es el caso mas comun, porque la gente escribe rapido.
     */
    #[Test]
    public function encuentra_el_anuncio_tildado_cuando_se_busca_sin_tilde(): void
    {
        $este = $this->inmueble(['title' => 'Casa en Zarcero con atico']);

        $this->assertContains($este->id, $this->buscar('atico'));
    }

    #[Test]
    public function encuentra_el_anuncio_sin_tilde_cuando_se_busca_con_tilde(): void
    {
        $este = $this->inmueble(['title' => 'Casa en Panama Nuevo']);

        $this->assertContains($este->id, $this->buscar('Panamá'));
    }

    /**
     * La enye. Es la letra que mas se equivoca al escribir y la que
     * mas ausente queda de una busqueda sin normalizar.
     */
    #[Test]
    public function trata_la_enye_como_n(): void
    {
        $este = $this->inmueble(['title' => 'Casa con montana en San Carlos']);

        $this->assertContains($este->id, $this->buscar('montana'));
        $this->assertContains($este->id, $this->buscar('montaña'));
    }

    /*
    |--------------------------------------------------------------------------
    | Lo que no debe encontrar
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function no_devuelve_nada_para_un_termino_inexistente(): void
    {
        $this->inmueble(['title' => 'Apartamento en Ciudad Quesada']);

        $this->assertCount(0, $this->buscar('avión a propulsión'));
    }

    /**
     * El termino va LIGADO, nunca interpolado.
     *
     * Ojo con lo que esto NO protege: `%` y `_` dentro del termino
     * siguen siendo comodines para LIKE, porque van en el patron y no
     * en el SQL. Ligarlos evita inyeccion, no el comportamiento de
     * LIKE. Aqui es inofensivo --buscar "50%" devuelve de mas, no
     * rompe nada-- y por eso no se escapan.
     *
     * Lo que si tiene que quedar claro es que una comilla no revienta
     * la consulta.
     */
    #[Test]
    public function una_comilla_en_el_termino_no_rompe_la_consulta(): void
    {
        $este = $this->inmueble(['title' => 'Apartamento en Ciudad Quesada']);

        $this->getJson("/api/properties?q=O'Brien")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->assertNotContains($este->id, $this->buscar("' OR 1=1 --"));
    }

    /**
     * Y con un termino corto, `%` no llega a ser consulta: es lo que
     * hace que "una palabra de 1 caracter no dispara consulta" y "el
     * comodin no llega a ejecutarse" sean la misma garantia.
     *
     * "No dispara consulta" significa que devuelve el listado normal,
     * no que devuelva cero: el filtro simplemente no se aplica.
     */
    #[Test]
    public function un_comodin_suelto_no_dispara_consulta(): void
    {
        $este = $this->inmueble(['title' => 'Apartamento luminoso']);

        $this->assertSame($this->listadoCompleto(), $this->buscar('%'));
        $this->assertContains($este->id, $this->buscar('%'));
    }

    /*
    |--------------------------------------------------------------------------
    | Combinable con el resto
    |--------------------------------------------------------------------------
    */

    /**
     * El texto se combina con los otros filtros: son Y, no O entre
     * filtros distintos.
     */
    #[Test]
    public function se_combina_con_el_resto_de_filtros(): void
    {
        $este = $this->inmueble([
            'title' => 'Apartamento con terraza',
            'monthly_rent' => 250_000,
            'currency' => 'CRC',
        ]);

        $this->inmueble([
            'title' => 'Apartamento con terraza y parqueo',
            'monthly_rent' => 600_000,
            'currency' => 'CRC',
        ]);

        $respuesta = $this->getJson('/api/properties?q=terraza&max_rent=300000')
            ->assertOk();

        $this->assertSame([$este->id], array_column($respuesta->json('data'), 'id'));
    }

    /**
     * Solo las activas se buscan. RF-2.6: un borrador no es un
     * resultado de busqueda.
     */
    #[Test]
    public function solo_busca_las_activas(): void
    {
        $borrador = $this->inmueble([
            'title' => 'Apartamento con terraza',
            'status' => 'borrador',
        ]);

        $this->assertNotContains($borrador->id, $this->buscar('terraza'));
    }

    /*
    |--------------------------------------------------------------------------
    | Formas de la entrada
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function una_busqueda_vacia_devuelve_el_listado_normal(): void
    {
        $this->inmueble(['title' => 'Apartamento con terraza']);

        $this->getJson('/api/properties?q=')->assertOk()->assertJsonCount(1, 'data');
    }

    #[Test]
    public function rechaza_un_termino_larguisimo(): void
    {
        $this->getJson('/api/properties?q='.str_repeat('a', 200))
            ->assertStatus(422)
            ->assertJsonValidationErrors('q');
    }

    /**
     * RF-4.3 pide que una palabra de un caracter no dispare consulta.
     *
     * Sin esto, cada tecla de la barra de busqueda pega un LIKE
     * contra tres columnas: "%a%" matchea practicamente todo y
     * devuelve la pagina entera, que es lo mas caro y lo menos util.
     *
     * Que devuelva el listado COMPLETO y no cero es lo correcto: la
     * persona todavia esta escribiendo. Lo que no puede pasar es que
     * le digamos "no hay nada" cuando lo que escribio no es una
     * busqueda.
     */
    #[Test]
    public function un_termino_de_un_caracter_no_filtra(): void
    {
        $este = $this->inmueble(['title' => 'Apartamento con terraza']);

        $this->assertSame($this->listadoCompleto(), $this->buscar('a'));
        $this->assertContains($este->id, $this->buscar('a'));
    }

    #[Test]
    public function un_termino_de_dos_caracteres_si_filtra(): void
    {
        $este = $this->inmueble(['title' => 'Apartamento con terraza']);

        $otro = $this->inmueble(['title' => 'Casa en Zarcero']);

        $encontrados = $this->buscar('te');

        $this->assertContains($este->id, $encontrados);
        $this->assertNotContains($otro->id, $encontrados);
    }

    /**
     * Solo espacios es un termino de cero, no de cinco.
     */
    #[Test]
    public function un_termino_de_solo_espacios_no_filtra(): void
    {
        $este = $this->inmueble(['title' => 'Apartamento con terraza']);

        $this->assertContains($este->id, $this->buscar('    '));
    }
}
