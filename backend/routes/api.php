<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PropertyController;
use Illuminate\Support\Facades\Route;

/*
 | API publica.
 |
 | Sin sesion: RF-1.4 dice que el visitante busca y ve el mapa sin crear
 | cuenta. La autenticacion entra en RF-1.1 con Sanctum y vive en un
 | grupo aparte.
 |
 | Todo lo que cuelgue de aqui lleva el techo de RNF-05. Es preferible
 | aplicarlo al grupo completo que ir poniendo middleware ruta por
 | ruta: una ruta nueva sin limite es un agujero, y es el error que
 | mas cuesta detectar.
 */

Route::middleware('throttle:api')->group(function (): void {
    Route::get('/properties', [PropertyController::class, 'index'])
        ->name('api.properties.index');

    Route::get('/properties/{property}', [PropertyController::class, 'show'])
        ->name('api.properties.show');

    /*
     | Rutas publicas de sesion.
     |
     | Registro e inicio de sesion llevan su propio limite, mas
     | estricto, dentro de LoginRequest: cinco intentos por correo y
     | treinta por IP. El general de arriba no alcanza, porque son dos
     | minutos de ventana y una contrasena se adivina con poco.
     */
    Route::post('/register', [AuthController::class, 'register'])
        ->name('api.register');

    Route::post('/login', [AuthController::class, 'login'])
        ->name('api.login');
});

/*
 | Rutas que exigen token.
 |
 | El guard 'sanctum' valida la cabecera Authorization: Bearer <token>.
 | Sin token valido responde 401, y `Accept: application/json` hace
 | que la respuesta sea JSON y no HTML.
 */
Route::middleware(['throttle:api', 'auth:sanctum'])->group(function (): void {
    Route::get('/user', [AuthController::class, 'user'])
        ->name('api.user');

    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('api.logout');
});
