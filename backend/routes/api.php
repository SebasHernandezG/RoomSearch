<?php

declare(strict_types=1);

use App\Http\Controllers\Api\PropertyController;
use Illuminate\Support\Facades\Route;

/*
 * API publica.
 *
 * Sin sesion: RF-1.4 dice que el visitante busca y ve el mapa sin crear
 * cuenta. La autenticacion entra en RF-1.1 con Sanctum y vive en un
 * grupo aparte.
 *
 * Todo lo que cuelgue de aqui lleva el techo de RNF-05. Es preferible
 * aplicarlo al grupo completo que ir poniendo middleware ruta por
 * ruta: una ruta nueva sin limite es un agujero, y es el error que
 * cuesta mas detectar.
 */

Route::middleware('throttle:api')->group(function (): void {
    Route::get('/properties', [PropertyController::class, 'index'])
        ->name('api.properties.index');

    Route::get('/properties/{property}', [PropertyController::class, 'show'])
        ->name('api.properties.show');
});
