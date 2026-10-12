<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Modules\Properties\Enums\PropertyType;
use Modules\Properties\Queries\PropertyRadiusQuery;

/**
 * Validacion del listado de inmuebles. RF-3.3 y RF-4.1.
 *
 * Los limites de latitud y longitud cubren Alajuela y no solo San
 * Carlos: el documento menciona cobertura de Florencia, Aguas Zarcas,
 * Pital y La Fortuna, y despues habra mas cantones.
 */
class ListPropertiesRequest extends FormRequest
{
    public function authorize(): bool
    {
        // El listado es publico: RF-1.4 dice que el visitante busca sin
        // tener cuenta.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Punto de referencia. Los tres van juntos o ninguno.
            'lat' => ['nullable', 'required_with:radius', 'numeric', 'between:8,12'],
            'lng' => ['nullable', 'required_with:radius', 'numeric', 'between:-86,-82'],
            'radius' => [
                'nullable',
                'required_with:lat',
                'integer',
                'min:'.PropertyRadiusQuery::RADIO_MINIMO,
                'max:'.PropertyRadiusQuery::RADIO_MAXIMO,
            ],

            // RF-4.1: filtros. Todos opcionales y combinables.
            'type' => ['nullable', Rule::enum(PropertyType::class)],
            'min_rent' => ['nullable', 'integer', 'min:0'],
            'max_rent' => ['nullable', 'integer', 'min:0', 'gte:min_rent'],
            'bedrooms' => ['nullable', 'integer', 'between:0,10'],
            'bathrooms' => ['nullable', 'integer', 'between:0,10'],
            'furnished' => ['nullable', 'boolean'],
            'pets_allowed' => ['nullable', 'boolean'],
            'parking' => ['nullable', 'boolean'],

            // RF-4.2: orden.
            'sort' => ['nullable', Rule::in(['recent', 'price_asc', 'price_desc', 'distance'])],

            // RF-4.3: busqueda por texto.
            'q' => ['nullable', 'string', 'max:80'],

            'district' => ['nullable', 'string', 'max:80'],

            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:1,60'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lat.between' => 'La latitud debe estar dentro de Alajuela.',
            'lng.between' => 'La longitud debe estar dentro de Alajuela.',
            'radius.max' => 'El radio maximo es de 10 km.',
            'max_rent.gte' => 'El precio maximo no puede ser menor que el minimo.',
        ];
    }

    /**
     * El orden por distancia solo tiene sentido con punto de referencia.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            if ($this->input('sort') === 'distance' && $this->input('lat') === null) {
                $v->errors()->add(
                    'sort',
                    'Para ordenar por distancia hay que elegir un punto en el mapa.',
                );
            }
        });
    }

    /**
     * Hay punto de referencia solo si vienen los tres parametros.
     */
    public function tienePuntoDeReferencia(): bool
    {
        return $this->filled('lat') && $this->filled('lng');
    }
}
