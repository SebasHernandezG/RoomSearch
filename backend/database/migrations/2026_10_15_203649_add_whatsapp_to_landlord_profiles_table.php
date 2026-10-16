<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Identity\Models\LandlordProfile;

/**
 * El numero de WhatsApp. RF-5.2.
 *
 * ## Por que es un campo aparte y no se reusa el telefono
 *
 * Porque no son el mismo numero. En San Carlos es normal tener un
 * celular personal y una linea de WhatsApp Business para el alquiler, y
 * son cosas que se deciden por separado. Meterlos en el mismo campo
 * obliga a elegir uno, y el otro queda como dato que el dueno cree que
 * esta y no esta.
 *
 * ## Por que comparte el interruptor de privacidad
 *
 * Dos interruptores serian mas flexibles y tambien mas engorro de usar.
 * Alguien que quiere recibir llamadas pero no quiere que lo llenen de
 * spam de WhatsApp tendria que resolver un boton que no esta en ninguna
 * pantalla, y lo que acabaria haciendo es marcar los dos privados para
 * no meter la pata.
 *
 * @see LandlordProfile::puedeMostrarContacto()
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landlord_profiles', function (Blueprint $table): void {
            /*
             * E.164, igual que `phone`. El boton arma una URL de
             * `wa.me`, y un numero con espacios o sin `+` genera un
             * enlace que no abre.
             */
            $table->string('whatsapp_number', 20)->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('landlord_profiles', function (Blueprint $table): void {
            $table->dropColumn('whatsapp_number');
        });
    }
};
