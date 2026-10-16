<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateLandlordProfileRequest;
use App\Http\Resources\LandlordProfileResource;
use App\Http\Resources\PropertyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Modules\Identity\Models\LandlordProfile;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\PropertyStatus;

/**
 * El perfil del arrendador. RF-1.5.
 *
 * Tres rutas y no dos: el perfil **propio** se edita, el de **otro** se
 * ve. La diferencia importa porque el de otro no lleva el interruptor
 * de privacidad ni el correo.
 */
class LandlordProfileController extends Controller
{
    /** La foto pesa menos: es un avatar, no una foto de inmueble. */
    private const MAXIMO_FOTO_BYTES = 2048 * 1024;

    /**
     * El perfil de la cuenta con sesion.
     *
     * Crea uno vacio si no existe, para que la pantalla de edicion
     * tenga contra que escribir en la primera vez. Crearlo aqui y no
     * en el `PUT` es lo que hace que "mi perfil" siempre responda
     * 200 y no 404 para alguien que todavia no lo lleno.
     */
    public function mine(Request $request): LandlordProfileResource
    {
        $usuario = $this->exigirArrendador($request);

        $perfil = LandlordProfile::firstOrCreate(
            ['user_id' => $usuario->getKey()],
            ['phone_private' => true],
        );

        $perfil->load('user');

        return new LandlordProfileResource($perfil);
    }

    /**
     * Guarda el perfil.
     */
    public function update(UpdateLandlordProfileRequest $request): LandlordProfileResource
    {
        $usuario = $this->exigirArrendador($request);

        $perfil = LandlordProfile::firstOrCreate(
            ['user_id' => $usuario->getKey()],
            ['phone_private' => true],
        );

        $perfil->fill($request->perfil());

        /*
         * Sin telefono, no hay nada que exponer.
         *
         * Si alguien borra el numero pero deja el interruptor en
         * publico, el estado queda incoherente: el perfil dice "puede
         * ver mi telefono" y no hay telefono. Se resuelve aqui y no en
         * el Resource, para que el dato guardado sea coherente por si
         * solo.
         */
        if ($perfil->phone === null || $perfil->phone === '') {
            $perfil->phone_private = true;
        }

        $this->guardarFoto($request, $perfil);

        $perfil->save();

        return new LandlordProfileResource($perfil->refresh()->load('user'));
    }

    /**
     * El perfil publico de alguien.
     *
     * **No pide sesion.** Un announcement se puede mirar sin cuenta
     * (RF-1.4), y si el perfil exigiera sesion habria que crear una
     * para ver un dato que ya se muestra en el anuncio.
     */
    public function show(Request $request, User $dueno): LandlordProfileResource|JsonResponse
    {
        $perfil = LandlordProfile::query()
            ->where('user_id', $dueno->getKey())
            ->first();

        if ($perfil === null) {
            return response()->json([
                'message' => 'Esta cuenta todavía no tiene perfil público.',
            ], 404);
        }

        $perfil->load('user');

        return new LandlordProfileResource($perfil);
    }

    /**
     * Las publicaciones activas de un arrendador.
     *
     * El criterio del issue: "muestra solo publicaciones en estado
     * activa". No una pausa ni una rechazada ni una pendiente: son datos
     * que el dueno todavia no quiere que se vean.
     */
    public function publicaciones(Request $request, User $dueno): AnonymousResourceCollection
    {
        $publicaciones = $dueno->publicaciones()
            ->where('status', PropertyStatus::Activa->value)
            ->with('imagenes')
            ->latest()
            ->paginate(12)
            ->withQueryString();

        return PropertyResource::collection($publicaciones);
    }

    /**
     * Solo un arrendador --o un admin-- tiene perfil.
     *
     * No se responde 403: se responde con el mismo mensaje que el
     * middleware de roles, porque el dueno no tiene forma de arreglarlo
     * por su cuenta y un "prohibido" seco lo deja probando.
     */
    private function exigirArrendador(Request $request): User
    {
        $usuario = $request->user();

        if ($usuario === null) {
            abort(401);
        }

        abort_unless(
            $usuario->isLandlord() || $usuario->isAdmin(),
            403,
            'Esta cuenta no puede tener perfil de arrendador.',
        );

        return $usuario;
    }

    /**
     * Guarda o quita la foto.
     *
     * El archivo primero y la fila despues, al reves que en las fotos
     * del inmueble: aqui no hay transaction que valga, y una fila con
     * una ruta a un archivo que no se escribio es una foto rota que se
     * queda ahi para siempre. Con el orden contrario, un fallo deja un
     * archivo huerfano, que es lo que se puede limpiar.
     */
    private function guardarFoto(UpdateLandlordProfileRequest $request, LandlordProfile $perfil): void
    {
        if ($request->boolean('quitar_foto')) {
            if ($perfil->photo_path !== null) {
                Storage::disk('public')->delete($perfil->photo_path);
                $perfil->photo_path = null;
            }

            return;
        }

        $archivo = $request->file('foto');

        if ($archivo === null) {
            return;
        }

        if ($perfil->photo_path !== null) {
            Storage::disk('public')->delete($perfil->photo_path);
        }

        $nombre = sprintf('perfiles/%d/avatar-%d.jpg', $perfil->user_id, time());

        Storage::disk('public')->put($nombre, file_get_contents($archivo->getRealPath()));

        $perfil->photo_path = $nombre;
    }
}
