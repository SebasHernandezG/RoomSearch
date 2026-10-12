<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Identity\Models\User;

/**
 * La cuenta que se devuelve al cliente.
 *
 * Nunca el modelo entero: `password`, `remember_token` y
 * `email_verified_at` no tienen por que viajar, y `password` en un
 * dump de la respuesta es una pesadilla de depurar.
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,

            // El rol viaja porque el frontend lo necesita para decidir
            // qué mostrar. Sin él, no puede saber si oferecer "publicar
            // un inmueble" o "buscar roomies".
            'role' => $this->role?->value,

            // RF-1.3 (verificación de correo) todavía no existe, así
            // que esto siempre sale true. Se deja el campo para que el
            // frontend no tenga que cambiar de forma cuando llegue.
            'email_verified' => $this->email_verified_at !== null,

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
