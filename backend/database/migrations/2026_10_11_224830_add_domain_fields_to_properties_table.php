<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Esquema completo del inmueble. RF-2.2, RF-2.4 y RF-2.6.
 *
 * Sobre la columna location:
 *
 * - Es POINT SRID 4326 (WGS 84), el mismo sistema que usa Leaflet y
 *   OpenStreetMap.
 * - El SPATIAL INDEX es obligatorio. Sin el, la busqueda por radio
 *   recorre la tabla entera: medido en MySQL 8.4 con 10 000 filas,
 *   5 077 filas examinadas sin indice frente a 251 con indice.
 *
 * Ver https://github.com/SebasHernandezG/RoomSearch/issues/16 para las
 * tres trampas de MySQL que condicionan como se escribe la consulta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table): void {
            // Titulo y descripcion. La tabla nace solo con id y timestamps.
            $table->string('title', 120)->after('id');
            $table->text('description')->nullable();

            // Tipo de inmueble. RF-2.2.
            $table->string('type', 20)->default('apartamento');

            // Precio. El monto va como entero en la moneda indicada;
            // los precios en colones no manejan decimales. RF-2.2, RNF-14.
            $table->unsignedBigInteger('monthly_rent')->default(0);
            $table->char('currency', 3)->default('CRC');
            $table->unsignedBigInteger('deposit')->nullable();

            // Caracteristicas. RF-2.2.
            $table->unsignedTinyInteger('bedrooms')->default(0);
            $table->unsignedTinyInteger('bathrooms')->default(0);
            $table->unsignedTinyInteger('parking_spaces')->default(0);
            $table->boolean('furnished')->default(false);
            $table->boolean('pets_allowed')->default(false);

            // Servicios incluidos. RF-2.2 los pide como catalogo, no
            // como texto libre; estas son las comodidades basicas y
            // property_amenities se crea en un PR aparte.
            $table->boolean('includes_water')->default(false);
            $table->boolean('includes_electricity')->default(false);
            $table->boolean('includes_internet')->default(false);

            $table->date('available_from')->nullable();
            $table->text('rules')->nullable();

            // Ciclo de vida de la publicacion. RF-2.6.
            $table->string('status', 20)->default('borrador');

            // Ubicacion. RF-2.4.
            //
            // En Costa Rica las direcciones son descriptivas ("200 m
            // norte de la gasolinera") y no se pueden geocodificar de
            // forma fiable, asi que el pin lo coloca el arrendador.
            // geometry('location', 'point', 4326) produce
            // POINT SRID 4326 en MySQL.
            //
            // La columna es nullable a proposito: RF-2.6 exige estado
            // 'borrador' y el formulario (DS-8) pide el pin en el paso
            // 6 de 6, asi que un borrador todavia no lo tiene.
            //
            // POR ESO NO HAY INDICE ESPACIAL TODAVIA. MySQL rechaza con
            //   ERROR 1252: All parts of a SPATIAL index must be NOT NULL
            // cualquier indice espacial sobre una columna nullable.
            //
            // El indice se agrega en el PR de RF-2.1, cuando publicar
            // exija el pin y la columna pueda pasar a NOT NULL.
            // Medido en MySQL 8.4 sobre 10 000 filas: con indice
            // espacial se examinan 251 filas, sin el, 5 077.
            $table->geometry('location', 'point', 4326)->nullable();
            $table->string('address_reference', 180)->nullable();
            $table->string('district', 80)->nullable();
            $table->string('neighborhood', 80)->nullable();
            $table->boolean('show_exact_location')->default(true);

            // Indices para los filtros de RF-4.1 y el orden de RF-4.2.
            $table->index(['status', 'monthly_rent'], 'properties_status_rent_index');
            $table->index(['status', 'type'], 'properties_status_type_index');
            $table->index('district', 'properties_district_index');
        });
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table): void {
            $table->dropIndex('properties_status_rent_index');
            $table->dropIndex('properties_status_type_index');
            $table->dropIndex('properties_district_index');

            $table->dropColumn([
                'title',
                'description',
                'type',
                'monthly_rent',
                'currency',
                'deposit',
                'bedrooms',
                'bathrooms',
                'parking_spaces',
                'furnished',
                'pets_allowed',
                'includes_water',
                'includes_electricity',
                'includes_internet',
                'available_from',
                'rules',
                'status',
                'location',
                'address_reference',
                'district',
                'neighborhood',
                'show_exact_location',
            ]);
        });
    }
};
