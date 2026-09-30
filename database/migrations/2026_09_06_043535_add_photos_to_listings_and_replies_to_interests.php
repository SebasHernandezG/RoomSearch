<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('interests', function (Blueprint $table) {
            Schema::table('listings', function (Blueprint $table) {
                $table->json('photos')->nullable();
            });
            Schema::table('interests', function (Blueprint $table) {
                $table->text('reply')->nullable();
                $table->timestamp('replied_at')->nullable();
            });
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('interests', function (Blueprint $table) {
            Schema::table('interests', function (Blueprint $table) {
                $table->dropColumn(['reply', 'replied_at']);
            });
            Schema::table('listings', function (Blueprint $table) {
                $table->dropColumn('photos');
            });
        });
    }
};
