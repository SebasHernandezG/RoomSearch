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
 */

Route::get('/properties', [PropertyController::class, 'index'])
    ->name('api.properties.index');

Route::get('/properties/{property}', [PropertyController::class, 'show'])
    ->name('api.properties.show');
