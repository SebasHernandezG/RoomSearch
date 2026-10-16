<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePropertyImagesRequest;
use App\Http\Resources\PropertyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Properties\Models\Property;
use Modules\Properties\Models\PropertyImage;

/**
 * Las fotos de un inmueble. RF-2.3.
 *
 * Vive aparte de `MyPropertyController` porque es lo unico que **escribe
 * archivos**. Ahi todo son filas de la base; aca cada operacion deja algo
 * en el disco, y un archivo sin fila que lo referencie es el modo de
 * fallo mas caro de limpiar.
 */
class PropertyImageController extends Controller
{
    /**
     * Sube fotos a una publicacion.
     *
     * Las tres reglas que gobiernan esto:
     *
     * 1. **Todo o nada.** Si la tercera foto falla, las dos primeras
     *    tambien se van. Subir "hasta donde pudo" deja una galeria a
     *    medias que el dueno no pidio y que tiene que volver a borrar
     *    una por una, sin ver cual fallo.
     *
     * 2. **El transaction revierte las filas, no los archivos.** La
     *    base no sabe que estan ahi, asi que el `catch` los borra a
     *    mano. Sin eso, cada subida fallida deja archivos que nadie
     *    va a eliminar nunca.
     *
     * 3. **La principal se resuelve antes de insertar**, no despues.
     *    El indice unico parcial de la tabla la haria fallar si se
     *    hiciera al reves, y el error llegaria como un 500 a mitad de
     *    una subida valida.
     */
    public function store(StorePropertyImagesRequest $request, Property $property): JsonResponse
    {
        $this->authorize('update', $property);

        /** @var list<string> $escritos */
        $escritos = [];

        try {
            DB::transaction(function () use ($request, $property, &$escritos): void {
                /*
                 * Donde arranca el puesto de la siguiente foto.
                 *
                 * `0` cuando no hay ninguna, para que el puesto
                 * coincida con el indice del arreglo `fotos` que manda
                 * el frontend. Empezar en 1 obligaria a traducir
                 * "la tercera que subi" a "puesto 3" y el desfase es
                 * justo el tipo de error que nadie ve hasta que la
                 * principal sale distinta de la que se pidio.
                 *
                 * Si no se calculara desde cero, ademas, la segunda vez
                 * que se suben fotos se pisan los puestos y el orden
                 * que el dueno organizo se pierde.
                 */
                $siguiente = $property->imagenes()->exists()
                    ? (int) $property->imagenes()->max('position') + 1
                    : 0;

                $principalIndice = $request->indicePrincipal();

                if ($request->filled('principal')) {
                    $property->imagenes()->where('is_primary', true)->update(['is_primary' => false]);
                }

                foreach ($request->file('fotos') as $indice => $archivo) {
                    $nombre = $this->nombreArchivo($property, $indice, $archivo->extension());

                    Storage::disk('public')->put($nombre, file_get_contents($archivo->getRealPath()));

                    $escritos[] = $nombre;

                    $property->imagenes()->create([
                        'path' => $nombre,
                        'alt' => $property->title,

                        // El texto alternativo por defecto es el titulo
                        // del anuncio: describe el inmueble y es lo que
                        // hay disponible sin que el dueno escriba algo.
                        'position' => $siguiente + $indice,
                        'is_primary' => $indice === $principalIndice,
                        'size_bytes' => (int) $archivo->getSize(),
                    ]);
                }
            });
        } catch (\Throwable $error) {
            foreach ($escritos as $ruta) {
                Storage::disk('public')->delete($ruta);
            }

            throw $error;
        }

        return (new PropertyResource($property->refresh()->load('imagenes')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Borra una foto.
     *
     * No borra la ultima. Un anuncio sin ninguna foto es un anuncio que
     * no se puede ver con informacion -- la foto es la primera cosa que
     * alguien mira-- y dejar al dueno en esa situacion sin avisar es
     * peor que negar la operacion.
     */
    public function destroy(Request $request, Property $property, PropertyImage $imagen): JsonResponse
    {
        $this->authorize('update', $property);

        if ($imagen->property_id !== $property->getKey()) {
            return response()->json([
                'message' => 'Esa foto no es de esta publicación.',
            ], 404);
        }

        if ($property->imagenes()->count() <= 1) {
            return response()->json([
                'message' => 'No podés borrar la última foto. Un anuncio necesita al menos una.',
            ], 422);
        }

        /*
         * La fila primero y el archivo despues.
         *
         * Al reves queda un archivo sin fila: nadie lo va a borrar
         * nunca y ocupa disco para siempre. Este es el unico orden en
         * que el fallo deja basura tolerable.
         */
        $ruta = $imagen->path;

        $imagen->delete();

        Storage::disk('public')->delete($ruta);

        /*
         * Si la que se borro era la principal, la siguiente pasa a
         * serlo.
         *
         * Sin esto el anuncio queda sin principal, y la galeria del
         * frontend --que ordena por principal-- no sabe cual poner
         * primero.
         */
        if ($property->imagenes()->where('is_primary', true)->doesntExist()) {
            $property->imagenes()->orderBy('position')->first()?->update(['is_primary' => true]);
        }

        return (new PropertyResource($property->refresh()->load('imagenes')))->response();
    }

    /**
     * Un nombre de archivo que no depende del nombre original.
     *
     * Un `time()` y no el nombre que subio la persona: "casa mia.jpg"
     * con tilde rompe el nombre, y dos archivos con el mismo nombre se
     * pisan. La carpeta lleva el id del inmueble para que borrar un
     * anuncio sea borrar una carpeta y no un filtro sobre un listado.
     */
    private function nombreArchivo(Property $property, int $indice, string $extension): string
    {
        return sprintf(
            'inmuebles/%d/%d-%d.%s',
            $property->getKey(),
            time(),
            $indice,
            $extension
        );
    }
}
