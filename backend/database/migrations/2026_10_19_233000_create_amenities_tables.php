<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catalogo de amenidades y su relacion con inmuebles. RF-2.2.
 *
 * `amenities` es el catalogo (agua caliente, piscina, etc.) y
 * `property_amenities` es el pivote many-to-many. Se usan como
 * catalogo en vez de columnas booleanas sueltas para que la lista
 * pueda crecer sin migrar el esquema.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('amenities', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 80)->unique();
            $table->timestamps();
        });

        Schema::create('property_amenities', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('property_id')
                ->constrained('properties')
                ->cascadeOnDelete();
            $table->foreignId('amenity_id')
                ->constrained('amenities')
                ->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['property_id', 'amenity_id'], 'property_amenity_unica');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_amenities');
        Schema::dropIfExists('amenities');
    }
};
