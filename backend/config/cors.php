<?php

declare(strict_types=1);

/*
 |--------------------------------------------------------------------------
 | CORS
 |--------------------------------------------------------------------------
 |
 | En desarrollo el frontend corre en Vite (:5173) y el backend en
 | artisan serve (:8001). Son origenes distintos, asi que el navegador
 | bloquea las peticiones sin esto.
 |
 | En produccion ambos van en el mismo dominio: el navegador no hace la
 | peticion cross-origin y esta configuracion no aplica. Por eso los
 | origenes_allowed se leen del entorno y en produccion quedan vacios,
 | en vez de dejar "*" que permitiria que cualquier sitio llamara a la
 | API con las credenciales de un usuario.
 |
 */

return [

    /*
     | Rutas a las que aplica CORS.
     */
    'paths' => ['api/*'],

    /*
     | Metodos permitidos.
     */
    'allowed_methods' => ['*'],

    /*
     | Origenes permitidos.
     |
     | Vite elige el puerto automaticamente si el 5173 esta ocupado, asi
     | que se aceptan los puertos habituales del servidor de desarrollo.
     */
    'allowed_origins' => array_values(array_filter(
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'))
    )),

    /*
     | Patrones de origen permitidos, para cuando hay varios subdominios.
     */
    'allowed_origins_patterns' => [],

    /*
     | Cabeceras permitidas.
     */
    'allowed_headers' => ['*'],

    /*
     | Cabeceras que el navegador puede leer.
     |
     | X-Total-Count hace posible que el frontend sepa cuantos hay sin
     * pedir una pagina extra solo por el total.
     */
    'exposed_headers' => ['X-Total-Count'],

    /*
     | Tiempo en segundos que el navegador puede cachear la respuesta
     | de preflight.
     */
    'max_age' => 0,

    /*
     | Enviar credenciales con credenciales cruzadas.
     |
     | False mientras la API sea publica. Se activa con Sanctum en
     | RF-1.1, y solo entonces allowed_origins puede dejar de ser "*".
     */
    'supports_credentials' => false,

];
