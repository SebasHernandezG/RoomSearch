<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El dueno de cada publicacion, y con el dueno llegan dos cosas que
 * esta tabla no tenia: el indice espacial y la obligacion del pin.
 *
 * Sin esto publicar era imposible: no habia forma de saber de quien es
 * una fila ni de impedir que alguien editara la publicacion de otro.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table): void {
            $table->foreignId('user_id')
                ->nullable()
                ->after('id')
                ->constrained()
                /*
                 * SET NULL, no CASCADE.
                 *
                 * Si un arrendador cierra su cuenta, sus publicaciones
                 * siguen visibles: hay gente que ya las guardo y no
                 * tiene por que desaparecer de un dia para otro.
                 *
                 * El precio es una publicacion huerfana que nadie puede
                 * editar ni moderar, que se resuelve con RF-7.2 (borrado
                 * logico del usuario). El otro extremo es peor:
                 * CASCADE hace desaparecer un inmueble del mapa sin
                 * avisar.
                 */
                ->nullOnDelete();
        });

        /*
         * Las filas que ya existieran no tienen dueno.
         *
         * Se les asigna la ARRENDADORA mas antigua, y si no hay
         * ninguna, la cuenta mas antigua que haya.
         *
         * No es NOT NULL a proposito: la columna es nullable porque la
         * FK es SET NULL, y una cuenta borrada deja su publicacion
         * huerfana a proposito. Asi que no hay que rellenar nada para
         * cambiar la nulabilidad de esta columna, y el paso de abajo
         * solo es para que las filas antiguas no queden sin dueno.
         *
         * Que sea una arrendadora y no "la primera cuenta" importa:
         * con la cuenta mas antigua, el alta de CuentasSeeder deja las
         * publicaciones heredadas en manos del ADMIN, que puede
         * moderarlas y borrarlas pero no editarlas. A un dueno, si.
         */
        $dueno = DB::table('users')
            ->where('role', 'landlord')
            ->orderBy('id')
            ->value('id')
            ?? DB::table('users')->orderBy('id')->value('id');

        if ($dueno !== null) {
            DB::table('properties')->whereNull('user_id')->update(['user_id' => $dueno]);
        }

        /*
         * Lo mismo con location: se dijo que podia quedar en null
         * porque los borradores no piden pin.
         *
         * Los borradores no existen: RF-2.1 dice que toda publicacion
         * nueva nace en 'pendiente', no en 'borrador'. El caso que
         * justificaba la nulabilidad nunca llego a darse.
         *
         * A las filas huerfanas se les pone el centro de Ciudad
         * Quesada. Es un dato inventado, y tiene que quedar dicho: lo
         * que se busca es que la columna pueda ser NOT NULL, no
         * adivinar donde estaba cada inmueble. Si alguna vez hay que
         * deshacer esto, este es el punto donde se pierde la
         * informacion real de esas filas.
         *
         * (longitud, latitud), el orden que exige POINT() para SRID
         * 4326. Invertirlo no da error: coloca el punto en el
         * hemisferio equivocado.
         */
        DB::table('properties')->whereNull('location')->update([
            'location' => DB::raw('ST_SRID(POINT(-84.4274, 10.3236), 4326)'),
        ]);

        Schema::table('properties', function (Blueprint $table): void {
            /*
             * MODIFY, no DROP + ADD.
             *
             * La primera version de esta migracion hacia
             * dropColumn('location') y despues la volvia a agregar con
             * nullable(false). MySQL ejecuta el DROP, y cuando llega
             * al ADD encuentra una tabla con 19 filas y sin default:
             *
             *   ERROR 1138: Invalid use of NULL value
             *
             * La migracion se queda a medias y la tabla queda sin la
             * columna, que es peor que no haberla cambiado. MODIFY
             * cambia la nulabilidad sobre la columna existente, sin
             * pasar por ese estado intermedio.
             */
            $table->geometry('location', 'point', 4326)->nullable(false)->change();

            /*
             * El indice espacial, que era lo que faltaba desde el
             * principio. MySQL lo exige:
             *
             *   ERROR 1252: All parts of a SPATIAL index must be NOT NULL
             *
             * Medido con 10 000 filas: con indice se examinan 251 filas,
             * sin el 5 077. Veinte veces menos, que es la diferencia
             * entre cumplir RNF-01 y no cumplirlo.
             */
            $table->spatialIndex('location');
        });
    }

    public function down(): void
    {
        /*
         * Cada paso va en su propio Schema::table().
         *
         * Mezclar DROP COLUMN y CHANGE sobre la misma tabla en un solo
         * ALTER funciona a veces y falla otras, segun el orden que
         * resuelva MySQL. Separarlos hace que un fallo quede claro en
         * que paso va.
         *
         * Y ojo con el nombre del indice, que es la parte que mas
         * cuesta acertar:
         *
         *   dropSpatialIndex('location')            -> ERROR 1091
         *   dropSpatialIndex('properties_location_spatial_index')
         *                                             -> ERROR 1091
         *   dropSpatialIndex(['location'])           -> funciona
         *
         * Laravel solo deduce el nombre del indice cuando recibe un
         * ARRAY de columnas. Con un string lo toma literal, y el
         * nombre que produce la convencion no es ni
         * `properties_location_index` ni
         * `properties_location_spatial_index`.
         *
         * Pasando el array, el nombre lo arma la MISMA funcion que lo
         * armo al crear el indice, y por lo tanto no puede desfasarse.
         */
        Schema::table('properties', function (Blueprint $table): void {
            $table->dropSpatialIndex(['location']);
        });

        Schema::table('properties', function (Blueprint $table): void {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });

        /*
         * `location` vuelve a ser nullable, como estaba antes de
         * RF-2.1. Esto NO se puede deshacer con el indice puesto: el
         * paso de arriba va primero a proposito.
         */
        Schema::table('properties', function (Blueprint $table): void {
            $table->geometry('location', 'point', 4326)->nullable()->change();
        });
    }
};
