<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use App\Http\Controllers\Api\InterestController;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Mandar "Me interesa" sobre un inmueble. RF-5.1.
 *
 * ## Lo que se valida aqui y lo que no
 *
 * Aqui solo el mensaje, que es un campo del cuerpo y no depende de
 * nada mas.
 *
 * El duplicado **no** se valida aqui aunque pareceria su sitio: un
 * `Rule::unique` de dos columnas --`property_id` + `user_id`-- no se
 * puede escribir, y el parche de buscar antes de insertar es
 * exactamente la ventana de carrera que el indice unico ya cierra.
 * Se comprueba en el controlador y se responde con el mismo formato
 * de 422 por campo, que el frontend ya sabe pintar.
 *
 * @see InterestController::store()
 */
class StoreInterestRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Con sesion y punto. Quien publica su propio anuncio no tiene
        // a quien escribirle: eso lo comprueba el controlador, que es
        // donde esta el `user_id` del inmueble.
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            /*
             * El mensaje es obligatorio, y con un minimo de 20
             * caracteres.
             *
             * "Me interesa" son once y pasa un `required`. Con un
             * minimo de 20 ya no cabe: "Hola, ¿sigue disponible?"
             * son veintidos y sí pasa, que es el mensaje más corto que
             * de verdad dice algo.
             *
             * 1000 es el tope de un `TEXT` utf8mb4. Pasarse da un
             * error de MySQL en el insert, que es de los que se ven
             * como un 500 sin explicar nada.
             */
            'message' => ['required', 'string', 'min:20', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'message.required' => 'Escribí un mensaje para que el arrendador te pueda responder.',
            'message.min' => 'Contá un poco más: con "me interesa" no hay nada que responder.',
            'message.max' => 'El mensaje es demasiado largo.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['message' => 'mensaje'];
    }

    /**
     * El mensaje, recortado.
     *
     * `trim` y no el `middleware` de Laravel: ese solo recorta el
     * cuerpo entero cuando es una cadena, y "hola     " pasa las
     * 10 letras de `min` igual. Un mensaje de 10 espacios cumple el
     * minimo y no dice nada.
     *
     * @return array<string, string>
     */
    public function solicitud(): array
    {
        return ['message' => trim((string) $this->input('message'))];
    }
}
