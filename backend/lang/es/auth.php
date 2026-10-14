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

    'noAutorizado' => 'Esta cuenta no puede hacer eso.',

    'sinSesion' => 'Necesitás iniciar sesión para hacer eso.',

    /*
    | RF-1.3 · Verificación de correo y recuperación de contraseña.
    |
    | Mismo criterio que `failed`: la respuesta no dice si la cuenta
    | existe. `verificacionEnviada` y `resetEnviado` son la MISMA
    | palabra exista o no la cuenta, porque si se distinguieran estos
    | dos endpoints servirían para enumerar quién tiene cuenta, que es
    | justo lo que el login evita.
    */

    'verificacionEnviada' => 'Si esa cuenta existe y falta confirmarla, te enviamos el enlace.',

    'verificacionInvalida' => 'Ese enlace no sirve. Pedí uno nuevo.',

    'yaVerificado' => 'Tu correo ya estaba confirmado.',

    'verificado' => '¡Listo! Tu correo quedó confirmado.',

    'resetEnviado' => 'Si esa cuenta existe, te enviamos un enlace para cambiar la contraseña.',

    'resetFallido' => 'Ese enlace ya no sirve. Pedí uno nuevo.',

    'resetHecho' => 'Cambiamos tu contraseña. Ya podés entrar con la nueva.',

];
