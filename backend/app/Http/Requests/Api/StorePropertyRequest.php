<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Properties\Enums\Currency;
use Modules\Properties\Enums\PropertyType;

/**
 * Datos para crear o editar una publicacion. RF-2.1.
 *
 * El mismo request para las dos operaciones a proposito: si divergen,
 * alguien puede publicar algo que despues no podria editar sin cambiar
 * los campos, y la publicacion se rompe a la mitad.
 */
class StorePropertyRequest extends FormRequest
{
    public function authorize(): bool
    {
        // El permiso real lo revisa la politica. Aqui solo se exige
        // que haya sesion, para no devolver 403 a un visitante sin
        // sesion en vez de 401.
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:10', 'max:120'],

            'description' => ['nullable', 'string', 'max:2000'],

            'type' => ['required', Rule::enum(PropertyType::class)],

            /*
             * El precio va en la unidad de la moneda: colones enteros
             * o dolares enteros. Un entero, porque los precios
             * costarricenses casi nunca tienen centavos y redondear
             * hacia abajo en el servidor regala plata.
             */
            /*
             * El techo va sin separador de miles: la regla `max` de
             * Laravel espera un entero plano y lee "999_999_999" como
             * una cadena de longitud, no como un numero.
             */
            'monthly_rent' => ['required', 'integer', 'min:0', 'max:999999999'],
            'currency' => ['required', Rule::enum(Currency::class)],
            'deposit' => ['nullable', 'integer', 'min:0', 'max:999999999'],

            'bedrooms' => ['required', 'integer', 'between:0,20'],
            'bathrooms' => ['required', 'integer', 'between:0,20'],
            'parking_spaces' => ['required', 'integer', 'between:0,20'],

            'furnished' => ['required', 'boolean'],
            'pets_allowed' => ['required', 'boolean'],

            'includes_water' => ['boolean'],
            'includes_electricity' => ['boolean'],
            'includes_internet' => ['boolean'],

            'available_from' => ['nullable', 'date', 'after_or_equal:today'],
            'rules' => ['nullable', 'string', 'max:1000'],

            /*
             * RF-2.4: el pin va acompanado de una referencia de texto y
             * un distrito. La referencia es lo que se muestra cuando el
             * arrendador decide no mostrar la ubicacion exacta
             * (RF-2.5), asi que no es opcional.
             */
            'latitude' => ['required', 'numeric', 'between:8,12'],
            'longitude' => ['required', 'numeric', 'between:-86,-82'],
            'address_reference' => ['required', 'string', 'max:180'],
            'district' => ['required', 'string', 'max:80'],
            'neighborhood' => ['nullable', 'string', 'max:80'],

            'show_exact_location' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.min' => 'Poné un título un poco más descriptivo: al menos 10 letras.',
            'monthly_rent.required' => 'Falta el precio del alquiler.',
            'latitude.required' => 'Tenés que poner el pin en el mapa.',
            'longitude.required' => 'Tenés que poner el pin en el mapa.',
            'address_reference.required' => 'Escribí una referencia de dónde está: "a 200 m norte de la iglesia". '
                .'Es lo que se ve cuando alguien elige no mostrar la ubicación exacta.',
            'district.required' => 'Elegí el distrito.',
            'available_from.after_or_equal' => 'La fecha no puede ser en el pasado.',
        ];
    }

    /**
     * Los atributos que van al modelo. El pin se resuelve aparte.
     *
     * @return array<string, mixed>
     */
    public function atributos(): array
    {
        return collect($this->validated())
            ->except(['latitude', 'longitude'])
            ->all();
    }
}
