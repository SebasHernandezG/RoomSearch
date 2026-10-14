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
    /**
     * Caracteres minimos para que un termino dispare consulta.
     *
     * RF-4.3 lo pide como criterio: "una palabra de 1 caracter no
     * dispara consulta".
     */
    public const TERMINO_MINIMO = 2;

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

            /*
             * La relacion min/max NO va en `gte:min_rent` aqui, sino
             * abajo en withValidator().
             *
             * Con la regla en la lista, filtrar solo por precio maximo
             * --"hasta 300 000", que es lo mas natural de escribir-- daba
             * 422 con "El precio maximo no puede ser menor que el
             * minimo", porque `gte` compara contra un `min_rent` que no
             * vino. Nadie que llegue a la pagina 6 de resultados y
             * ponga un techo de precio se da cuenta de que el filtro
             * mas usado del buscador esta roto.
             */
            'max_rent' => ['nullable', 'integer', 'min:0'],
            'bedrooms' => ['nullable', 'integer', 'between:0,10'],
            'bathrooms' => ['nullable', 'integer', 'between:0,10'],
            'furnished' => ['nullable', 'boolean'],
            'pets_allowed' => ['nullable', 'boolean'],
            'parking' => ['nullable', 'boolean'],

            // RF-2.2 los servicios incluidos como catalogo, no texto.
            'includes_water' => ['nullable', 'boolean'],
            'includes_electricity' => ['nullable', 'boolean'],
            'includes_internet' => ['nullable', 'boolean'],

            'available_from' => ['nullable', 'date'],

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
        ];
    }

    /**
     * Las reglas que dependen de otros parametros.
     *
     * Van en `withValidator` y no en `rules()` porque comparan dos
     * entradas entre si: cada una sola no sabe si la otra vino.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $this->validarOrdenPorDistancia($v);

            $this->validarRangoDePrecio($v);
        });
    }

    /**
     * El orden por distancia solo tiene sentido con punto de referencia.
     */
    private function validarOrdenPorDistancia(Validator $v): void
    {
        if ($this->input('sort') === 'distance' && $this->input('lat') === null) {
            $v->errors()->add(
                'sort',
                'Para ordenar por distancia hay que elegir un punto en el mapa.',
            );
        }
    }

    /**
     * Max >= min, y solo cuando vienen los dos.
     *
     * La comparacion va aqui y no como regla `gte` porque el mensaje
     * depende del dominio, y porque `gte` con el otro valor ausente
     * rechaza el caso legitimo de filtrar solo por un techo de precio.
     */
    private function validarRangoDePrecio(Validator $v): void
    {
        if (! $this->filled('min_rent') || ! $this->filled('max_rent')) {
            return;
        }

        if ((int) $this->input('max_rent') < (int) $this->input('min_rent')) {
            $v->errors()->add('max_rent', 'El precio maximo no puede ser menor que el minimo.');
        }
    }

    /**
     * Hay punto de referencia solo si vienen los tres parametros.
     */
    public function tienePuntoDeReferencia(): bool
    {
        return $this->filled('lat') && $this->filled('lng');
    }

    /**
     * Si el termino de busqueda es lo bastante largo para buscar.
     *
     * Un caracter NO dispara consulta. "%a%" matchea practicamente
     * todo contra tres columnas y devuelve la pagina entera: es lo mas
     * caro y lo menos util que se puede pedir.
     *
     * No es un 422 a proposito. La persona esta escribiendo, y un error
     * en pantalla mientras teclea la primera letra es peor que no
     * filtrar: parece que el buscador esta roto. Con un caracter, no
     * filtrar es justo lo que quiere la persona todavia.
     */
    public function tieneTerminoDeBusqueda(): bool
    {
        return $this->filled('q')
            && mb_strlen(trim((string) $this->input('q'))) >= self::TERMINO_MINIMO;
    }
}
