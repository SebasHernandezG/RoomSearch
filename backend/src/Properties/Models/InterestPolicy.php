<?php

declare(strict_types=1);

namespace Modules\Properties\Models;

use Modules\Identity\Models\User;

/**
 * Quien puede responder una solicitud de "Me interesa". RF-5.1.
 *
 * ## Por que hace falta y por que no alcanza con filtrar la consulta
 *
 * Porque responder tiene un efecto que **nadie ve en la bandeja** si se
 * filtra mal: si un dueno que no es el dueno del inmueble escribe en
 * una fila ajena, el interesado recibe una respuesta de alguien que no
 * es el dueño del anuncio, y no hay forma de que lo note.
 *
 * La consulta de la bandeja ya filtra por dueno, asi que el hueco no
 * se ve probando la bandeja: se ve probando el `reply` de una fila que
 * uno no es dueno de.
 *
 * ## El interesado tampoco puede responder
 *
 * Ni siquiera a si mismo. Responder es la voz del dueno del inmueble, y
 * si el interesado pudiera, podría editar su propio mensaje disfrazado
 * de respuesta y borrar la evidencia de que le contestaron.
 */
class InterestPolicy
{
    /**
     * Ver la solicitud.
     *
     * Las dos puntas pueden: el dueno la necesita para contestarla, y
     * el interesado para leer la respuesta.
     */
    public function view(?User $user, Interest $interest): bool
    {
        if ($user === null) {
            return false;
        }

        return $this->esDueno($user, $interest)
            || $this->esInteresado($user, $interest);
    }

    /**
     * Responder o descartar.
     *
     * Solo el dueno del inmueble. Ver la nota de la clase.
     */
    public function responder(User $user, Interest $interest): bool
    {
        return $this->esDueno($user, $interest);
    }

    private function esDueno(User $user, Interest $interest): bool
    {
        return $interest->inmueble !== null
            && $interest->inmueble->user_id === $user->getKey();
    }

    private function esInteresado(User $user, Interest $interest): bool
    {
        return $interest->user_id === $user->getKey();
    }
}
