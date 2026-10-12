<?php

declare(strict_types=1);

/*
 |--------------------------------------------------------------------------
 | Mensajes de autenticación
 |--------------------------------------------------------------------------
 |
 | El más importante es el de `failed`. Dice exactamente lo mismo exista
 | la cuenta o no.
 |
 | Si el mensaje fuera "no encontramos ese correo" cuando el correo no
 | existe y "la contraseña está mal" cuando sí, el endpoint sirve para
 | enumerar quién tiene cuenta en la plataforma. La respuesta tiene que
 | ser indistinguible en los dos casos.
 |
 */

return [

    'failed' => 'El correo o la contraseña no están bien.',

    'password' => 'La contraseña está incorrecta.',

    'throttle' => 'Demasiados intentos. Volvé a probar en :seconds segundos.',

];
