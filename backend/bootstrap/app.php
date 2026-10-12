<?php

use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Auth\AuthenticationException;
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
         * CORS se configura en config/cors.php, no aqui. Y CSRF no se
         * toca: la API es sin sesion y la proteccion de CSRF se
         * resuelve con el token de Sanctum en RF-1.1, no abriendo
         * excepciones aqui. Excluir api/* de CSRF sin autenticacion
         * seria relajar RNF-04 a cambio de nada.
         */

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);

        /*
         * Proxies de confianza.
         *
         * Sin esto, detras de nginx la IP que ve Laravel es la del
         * proxy, la misma para todos. Y entonces el rate limiting de
         * RNF-05 se convierte en un techo global: 120 peticiones por
         * minuto para todo el mundo junto. Es peor que no tener
         * limite, porque ademas de no proteger molesta.
         *
         * Se configura por entorno porque el valor depende de donde
         * se despliegue: '*' sirve para un tunel, una IP concreta
         * para un servidor propio. En desarrollo queda vacio, que es
         * lo correcto porque no hay proxy delante.
         */
        $proxies = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('TRUSTED_PROXIES', '')),
        )));

        if ($proxies !== []) {
            $middleware->trustProxies(
                at: $proxies === ['*'] ? '*' : $proxies,
                headers: Request::HEADER_X_FORWARDED_FOR
                    | Request::HEADER_X_FORWARDED_HOST
                    | Request::HEADER_X_FORWARDED_PORT
                    | Request::HEADER_X_FORWARDED_PROTO
                    | Request::HEADER_X_FORWARDED_AWS_ELB,
            );
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        /*
         * El 401 de Laravel dice "Unauthenticated." en ingles, y sale
         * antes de que ningun middleware propio se entere: el guard
         * corre primero en la cadena.
         *
         * Se traduce aqui y no en el middleware de roles porque el
         * problema es general: TODA peticion sin token.valido recibe
         * este mensaje, no solo las que pasan por roles.
         */
        $exceptions->render(function (
            AuthenticationException $e,
            Request $request,
        ) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            return response()->json([
                'message' => trans('auth.sinSesion'),
            ], 401);
        });
    })->create();
