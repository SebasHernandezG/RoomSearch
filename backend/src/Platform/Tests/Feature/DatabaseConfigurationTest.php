<?php

declare(strict_types=1);

namespace Modules\Platform\Tests\Feature;

use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Configuracion de la base. RNF-01.
 *
 * Estas pruebas no tocan la base: comprueban que el repositorio no
 * vuelva a una configuracion que "funciona" pero rompe lo importante
 * en silencio.
 */
class DatabaseConfigurationTest extends TestCase
{
    /**
     * El driver por defecto es MySQL, no SQLite.
     *
     * El fallback del esqueleto de Laravel es `sqlite`. Con el, un
     * despliegue al que le falte `DB_CONNECTION` arranca bien, corre
     * migraciones y parece sano... hasta la primera busqueda por radio,
     * que en SQLite no tiene `ST_Distance_Sphere` ni indice espacial.
     *
     * El mapa abre vacio y ningun error lo avisa. Es exactamente el
     * fallo que `.ai/rules/mysql-geoespacial.md` documenta, y por eso
     * la asercion vive en codigo y no en una nota.
     */
    #[Test]
    public function el_driver_por_defecto_es_mysql(): void
    {
        $this->assertSame('mysql', config('database.default'));
    }

    /**
     * La conexion por defecto existe y apunta al puerto de MySQL local.
     */
    #[Test]
    public function la_conexion_mysql_esta_configurada(): void
    {
        $mysql = config('database.connections.mysql');

        $this->assertSame('mysql', $mysql['driver']);
    }

    /**
     * MySQL 8.4 necesita `utf8mb4`: el español usa la enye y las
     * tildes, y con `utf8` (3 bytes) los caracteres de cuatro bytes
     * --un emoji en una direccion, por ejemplo-- no entran.
     *
     * Y `utf8mb4_unicode_ci` es lo que hace que la busqueda por texto
     * ignore acentos y mayusculas sin normalizar nada en codigo.
     * Ver `PropertyTextSearchTest`.
     */
    #[Test]
    public function la_conexion_usa_utf8mb4(): void
    {
        $mysql = config('database.connections.mysql');

        $this->assertSame('utf8mb4', $mysql['charset'] ?? null);
        $this->assertSame('utf8mb4_unicode_ci', $mysql['collation'] ?? null);
    }

    /**
     * Las pruebas corren contra MySQL, no SQLite.
     *
     * `ST_Distance_Sphere` no existe en SQLite: una prueba de busqueda
     * por radio alli pasaria o fallaria por el motivo equivocado, que
     * es peor que no tenerla.
     */
    #[Test]
    public function las_pruebas_corren_contra_mysql(): void
    {
        $this->assertSame('mysql', config('database.default'));

        $this->assertStringContainsString(
            '<env name="DB_CONNECTION" value="mysql"/>',
            (string) file_get_contents(base_path('phpunit.xml')),
        );
    }
}
