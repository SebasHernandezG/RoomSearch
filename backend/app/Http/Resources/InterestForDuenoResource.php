<?php

declare(strict_types=1);

namespace App\Http\Resources;

/**
 * Una solicitud vista desde la bandeja del dueno. RF-5.1.
 *
 * ## Por que una subclase y no un parametro
 *
 * Porque la fila se pide **en grupo** --veinticuatro de golpe-- y
 * `additional()` no llega a cada elemento de una coleccion: se mezcla
 * en la respuesta completa, no en cada `toArray()`. La bandera tiene
 * que estar en la instancia.
 *
 * La alternativa --dos clases con el `toArray()` completo cada una--
 * duplica cincuenta lineas que cambian al mismo ritmo, y la copia es
 * la que se queda vieja.
 *
 * @see InterestResource
 */
class InterestForDuenoResource extends InterestResource
{
    protected bool $paraDueno = true;
}
