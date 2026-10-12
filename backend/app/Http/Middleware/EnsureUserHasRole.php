<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Identity\Enums\UserRole;
use Symfony\Component\HttpFoundation\Response;

/**
 * Deja pasar solo a los roles indicados. RF-1.4.
 *
 *     ->middleware('role:landlord,admin')
 *     ->middleware('role:admin')
 */
class EnsureUserHasRole
{
    /**
     * @param  Closure(Request): Response  $siguiente
     */
    public function handle(Request $request, Closure $siguiente, string ...$roles): Response
    {
        $usuario = $request->user();

        /*
         * Sin sesion responde 401 y con sesion pero sin rol, 403.
         *
         * No es un detalle: mezclarlos le dice a alguien que entro sin
         * cuenta que su cuenta esta mal, cuando lo que pasa es que no
         *tiene cuenta. Y 403 en un visitante lleva a la gente a pensar
         * que hay un bug de sesion.
         *
         * En la practica, si la ruta lleva `auth:sanctum` antes que
         * este middleware, el 401 ya salio antes de llegar aca. Esto
         * queda como red de seguridad para cuando se use `role:` solo,
         * sin el guard delante.
         */
        if ($usuario === null) {
            return response()->json([
                'message' => trans('auth.sinSesion'),
            ], 401);
        }

        if ($usuario->tieneRol($roles)) {
            return $siguiente($request);
        }

        return response()->json([
            'message' => trans('auth.noAutorizado'),
        ], 403);
    }

    /**
     * Los roles que el middleware acepta.
     *
     * Vive aca para que un nombre mal escrito se note al arrancar y no
     * en produccion, cuando alguien intenta usar una ruta protegida.
     *
     * @return list<string>
     */
    public static function rolesValidos(): array
    {
        return array_column(UserRole::cases(), 'value');
    }
}
