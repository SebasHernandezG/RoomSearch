<?php

declare(strict_types=1);

namespace Modules\Properties\Models;

use Modules\Identity\Models\User;

/**
 * Quien puede tocar una publicacion. RF-2.1.
 *
 * Vive en el modulo Properties y no en app/Policies porque es una regla
 * de negocio: "solo el dueno edita" no tiene nada de HTTP.
 */
class PropertyPolicy
{
    /**
     * Ver el inmueble en el mapa. Todo el mundo.
     */
    public function view(?User $user, Property $property): bool
    {
        return true;
    }

    /**
     * Crear publicaciones. Solo quien puede publicar. RF-1.4.
     *
     * Y con el correo confirmado. RF-1.3.
     *
     * Sin esto, publicar es escribir a cualquiera con cualquier
     * direccion: no habria forma de saber a quien avisar cuando un
     * anuncio es un fraude, ni de reclaimar una cuenta falsa.
     *
     * La cuenta nace como `tenant` y se pasa a `landlord` aparte, asi
     * que el rol ya no es una garantia: cualquier persona puede
     * escribirse con el correo que quiera.
     */
    public function create(?User $user): bool
    {
        return $user !== null
            && $user->isLandlord()
            && $user->hasVerifiedEmail();
    }

    /**
     * Editar. Solo el dueno.
     *
     * No se pide correo confirmado a proposito: si pudo crearla, ya lo
     * tenia confirmado, y la verificacion no se revierte. Pedirlo
     * otra vez solo dejaria fuera a alguien cuyo correo quedo sin
     * confirmar por un cambio de direccion.
     *
     * Un admin NO edita la publicacion de otro: la moderacion
     * (RF-7.1) suspende o rechaza, no corrige el texto de alguien. Si
     * un admin puede editar, nadie sabe quien escribio que.
     */
    public function update(User $user, Property $property): bool
    {
        return $this->esDueño($user, $property);
    }

    /**
     * Borrar. El dueno o un admin. RF-2.1.
     *
     * A diferencia de editar, aca el admin si interviene: borrar una
     * publicacion que incumple las reglas es una accion de moderacion.
     */
    public function delete(User $user, Property $property): bool
    {
        return $this->esDueño($user, $property) || $user->isAdmin();
    }

    /**
     * Mover el inmueble por la maquina de estados.
     *
     * El dueno puede pausar, reanudar y marcar como alquilada: son
     * decisiones sobre SU inmueble. No puede activar una que esta
     * pendiente de moderacion (eso lo hace `aprobar`).
     */
    public function cambiarEstado(User $user, Property $property): bool
    {
        return $this->esDueño($user, $property);
    }

    /**
     * Aprobar o rechazar. Solo admin. RF-7.1.
     */
    public function moderar(User $user, Property $property): bool
    {
        return $user->isAdmin();
    }

    private function esDueño(User $user, Property $property): bool
    {
        return $property->user_id !== null
            && (int) $property->user_id === (int) $user->getKey();
    }
}
