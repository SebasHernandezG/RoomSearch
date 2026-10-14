<?php

declare(strict_types=1);

/*
 |--------------------------------------------------------------------------
 | Mensajes de propiedades
 |--------------------------------------------------------------------------
 |
 | Solo lo que depende del dominio y no sale de una regla de autorizacion.
 |
 | Los 403 NO van aqui. Salen por `auth.noAutorizado`, que es lo mismo
 | que contesta el middleware de roles: un 403 con detalle distinto
 | segun el caso le dice a quien va probando rutas cuales existen y
 | cuales no. Ver bootstrap/app.php.
 |
 | Los 422 de validacion tampoco: cada uno vive en el FormRequest que
 | lo aplica. Ver .ai/rules/auth.md.
 |
 */

return [

    'transicionInvalida' => 'Esta publicación está en «:estado» y no puede pasar a «:destino».',

];
