<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
         * Nada que hacer todavia con el middleware.
         *
         * CORS se configura en config/cors.php, no aqui. Y CSRF no se
         * toca: la API es sin sesion y la proteccion de CSRF se
         * resuelve con el token de Sanctum en RF-1.1, no abriendo
         * excepciones aqui. Excluir api/* de CSRF sin autenticacion
         * seria relajar RNF-04 a cambio de nada.
         */
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
