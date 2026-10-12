<?php

declare(strict_types=1);

/*
 |--------------------------------------------------------------------------
 | Mensajes de validación
 |--------------------------------------------------------------------------
 |
 | El usuario nunca ve una palabra en inglés. La plataforma es de Costa
 | Rica y el tono es de "vos", como el resto del microcopy del frontend.
 |
 | Toda clave que falte acá NO tiene un texto de reserva: Laravel
 | muestra el nombre de la clave literal, o sea `validation.required`
 | en pantalla. Si agregás una regla nueva, agregá su mensaje.
 |
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Mensajes de error
    |--------------------------------------------------------------------------
    */

    'accepted' => 'El campo :attribute debe ser aceptado.',
    'accepted_if' => 'El campo :attribute debe ser aceptado cuando :other es :value.',
    'active_url' => 'El campo :attribute no es una URL válida.',
    'after' => 'La fecha :attribute debe ser posterior a :date.',
    'after_or_equal' => 'La fecha :attribute debe ser igual o posterior a :date.',
    'alpha' => 'El campo :attribute solo puede llevar letras.',
    'alpha_dash' => 'El campo :attribute solo puede llevar letras, números, guiones y guiones bajos.',
    'alpha_num' => 'El campo :attribute solo puede llevar letras y números.',
    'array' => 'El campo :attribute tiene que ser una lista.',
    'ascii' => 'El campo :attribute solo puede llevar caracteres y símbolos de un byte.',
    'before' => 'La fecha :attribute debe ser anterior a :date.',
    'before_or_equal' => 'La fecha :attribute debe ser igual o anterior a :date.',
    'between' => [
        'array' => 'El campo :attribute tiene que tener entre :min y :max elementos.',
        'file' => 'El campo :attribute tiene que pesar entre :min y :max kilobytes.',
        'numeric' => 'El campo :attribute tiene que estar entre :min y :max.',
        'string' => 'El campo :attribute tiene que tener entre :min y :max caracteres.',
    ],
    'boolean' => 'El campo :attribute tiene que ser verdadero o falso.',
    'can' => 'El campo :attribute tiene un valor no permitido.',
    'confirmed' => 'La confirmación de :attribute no coincide.',
    'contains' => 'Al campo :attribute le falta un valor obligatorio.',
    'current_password' => 'La contraseña está incorrecta.',
    'date' => 'El campo :attribute no es una fecha válida.',
    'date_equals' => 'El campo :attribute tiene que ser la fecha :date.',
    'date_format' => 'El campo :attribute no coincide con el formato :format.',
    'decimal' => 'El campo :attribute tiene que tener :decimal decimales.',
    'declined' => 'El campo :attribute tiene que rechazarse.',
    'declined_if' => 'El campo :attribute tiene que rechazarse cuando :other es :value.',
    'different' => 'Los campos :attribute y :other tienen que ser diferentes.',
    'digits' => 'El campo :attribute tiene que tener :digits dígitos.',
    'digits_between' => 'El campo :attribute tiene que tener entre :min y :max dígitos.',
    'dimensions' => 'El campo :attribute tiene dimensiones de imagen no válidas.',
    'distinct' => 'El campo :attribute tiene un valor repetido.',
    'doesnt_end_with' => 'El campo :attribute no puede terminar con: :values.',
    'doesnt_start_with' => 'El campo :attribute no puede empezar con: :values.',
    'email' => 'El campo :attribute tiene que ser un correo válido.',
    'ends_with' => 'El campo :attribute tiene que terminar con: :values.',
    'enum' => 'El valor de :attribute no es válido.',
    'exists' => 'El campo :attribute no existe.',
    'extensions' => 'El campo :attribute tiene que tener una de estas extensiones: :values.',
    'file' => 'El campo :attribute tiene que ser un archivo.',
    'filled' => 'El campo :attribute no puede quedar vacío.',
    'gt' => [
        'array' => 'El campo :attribute tiene que tener más de :value elementos.',
        'file' => 'El campo :attribute tiene que pesar más de :value kilobytes.',
        'numeric' => 'El campo :attribute tiene que ser mayor que :value.',
        'string' => 'El campo :attribute tiene que tener más de :value caracteres.',
    ],
    'gte' => [
        'array' => 'El campo :attribute tiene que tener :value elementos o más.',
        'file' => 'El campo :attribute tiene que pesar :value kilobytes o más.',
        'numeric' => 'El campo :attribute tiene que ser :value o mayor.',
        'string' => 'El campo :attribute tiene que tener :value caracteres o más.',
    ],
    'hex_color' => 'El campo :attribute tiene que ser un color hexadecimal válido.',
    'image' => 'El campo :attribute tiene que ser una imagen.',
    'in' => 'El valor de :attribute no es válido.',
    'in_array' => 'El campo :attribute no está en :other.',
    'integer' => 'El campo :attribute tiene que ser un número entero.',
    'ip' => 'El campo :attribute tiene que ser una dirección IP válida.',
    'ipv4' => 'El campo :attribute tiene que ser una dirección IPv4 válida.',
    'ipv6' => 'El campo :attribute tiene que ser una dirección IPv6 válida.',
    'json' => 'El campo :attribute tiene que ser un texto JSON válido.',
    'list' => 'El campo :attribute tiene que ser una lista.',
    'lowercase' => 'El campo :attribute tiene que estar en minúsculas.',
    'lt' => [
        'array' => 'El campo :attribute tiene que tener menos de :value elementos.',
        'file' => 'El campo :attribute tiene que pesar menos de :value kilobytes.',
        'numeric' => 'El campo :attribute tiene que ser menor que :value.',
        'string' => 'El campo :attribute tiene que tener menos de :value caracteres.',
    ],
    'lte' => [
        'array' => 'El campo :attribute no puede tener más de :value elementos.',
        'file' => 'El campo :attribute tiene que pesar :value kilobytes o menos.',
        'numeric' => 'El campo :attribute tiene que ser :value o menor.',
        'string' => 'El campo :attribute tiene que tener :value caracteres o menos.',
    ],
    'mac_address' => 'El campo :attribute tiene que ser una dirección MAC válida.',
    'max' => [
        'array' => 'El campo :attribute no puede tener más de :max elementos.',
        'file' => 'El campo :attribute tiene que pesar :max kilobytes.',
        'numeric' => 'El campo :attribute no puede ser mayor que :max.',
        'string' => 'El campo :attribute no puede tener más de :max caracteres.',
    ],
    'max_digits' => 'El campo :attribute no puede tener más de :max dígitos.',
    'mimes' => 'El campo :attribute tiene que ser un archivo de tipo: :values.',
    'mimetypes' => 'El campo :attribute tiene que ser un archivo de tipo: :values.',
    'min' => [
        'array' => 'El campo :attribute tiene que tener al menos :min elementos.',
        'file' => 'El campo :attribute tiene que pesar al menos :min kilobytes.',
        'numeric' => 'El campo :attribute tiene que ser al menos :min.',
        'string' => 'El campo :attribute tiene que tener al menos :min caracteres.',
    ],
    'min_digits' => 'El campo :attribute tiene que tener al menos :min dígitos.',
    'missing' => 'El campo :attribute no tiene que enviarse.',
    'multiple_of' => 'El campo :attribute tiene que ser múltiplo de :value.',
    'not_in' => 'El valor de :attribute no es válido.',
    'not_regex' => 'El formato del campo :attribute no es válido.',
    'numeric' => 'El campo :attribute tiene que ser un número.',
    'password' => [
        'letters' => 'La contraseña tiene que tener al menos una letra.',
        'mixed' => 'La contraseña tiene que tener mayúsculas y minúsculas.',
        'numbers' => 'La contraseña tiene que tener al menos un número.',
        'symbols' => 'La contraseña tiene que tener al menos un símbolo.',
        'uncompromised' => 'Esa contraseña apareció en una filtración de datos. Elegí otra.',
    ],
    'present' => 'El campo :attribute tiene que enviarse.',
    'prohibited' => 'El campo :attribute está prohibido.',
    'prohibited_if' => 'El campo :attribute está prohibido cuando :other es :value.',
    'prohibits' => 'El campo :attribute prohíbe que :other tenga algún valor.',
    'prohibited_unless' => 'El campo :attribute está prohibido salvo que :other sea :values.',
    'prohibits_unless' => 'El campo :attribute prohíbe :other salvo que sea :values.',
    'regex' => 'El formato del campo :attribute no es válido.',
    'required' => 'El campo :attribute es obligatorio.',
    'required_if' => 'El campo :attribute es obligatorio cuando :other es :value.',
    'required_if_accepted' => 'El campo :attribute es obligatorio cuando :other está aceptado.',
    'required_if_declined' => 'El campo :attribute es obligatorio cuando :other está rechazado.',
    'required_unless' => 'El campo :attribute es obligatorio salvo que :other sea :values.',
    'required_with' => 'El campo :attribute es obligatorio cuando hay :values.',
    'required_with_all' => 'El campo :attribute es obligatorio cuando :values están.',
    'required_without' => 'El campo :attribute es obligatorio cuando no hay :values.',
    'required_without_all' => 'El campo :attribute es obligatorio cuando :values no están.',
    'same' => 'Los campos :attribute y :other tienen que coincidir.',
    'size' => [
        'array' => 'El campo :attribute tiene que tener :size elementos.',
        'file' => 'El campo :attribute tiene que pesar :size kilobytes.',
        'numeric' => 'El campo :attribute tiene que ser :size.',
        'string' => 'El campo :attribute tiene que tener :size caracteres.',
    ],
    'starts_with' => 'El campo :attribute tiene que empezar con: :values.',
    'string' => 'El campo :attribute tiene que ser texto.',
    'timezone' => 'El campo :attribute tiene que ser una zona horaria válida.',
    'unique' => 'Ese :attribute ya está en uso.',
    'uploaded' => 'No se pudo subir el archivo de :attribute.',
    'uppercase' => 'El campo :attribute tiene que estar en mayúsculas.',
    'url' => 'El campo :attribute tiene que ser una URL válida.',
    'ulid' => 'El campo :attribute tiene que ser un ULID válido.',
    'uuid' => 'El campo :attribute tiene que ser un UUID válido.',

    /*
    |--------------------------------------------------------------------------
    | Mensajes de error para atributos
    |--------------------------------------------------------------------------
    |
    | Los nombres de los campos que la persona ve. Sin esto, Laravel
    | traduce "email" y "password" pero deja "monthly_rent" como
    | "monthly rent".
    |
    */

    'attributes' => [
        'name' => 'nombre',
        'email' => 'correo',
        'password' => 'contraseña',
        'password_confirmation' => 'confirmación de la contraseña',
        'current_password' => 'contraseña actual',
        'role' => 'rol',

        'title' => 'título',
        'description' => 'descripción',
        'type' => 'tipo de inmueble',
        'monthly_rent' => 'alquiler mensual',
        'deposit' => 'depósito',
        'bedrooms' => 'habitaciones',
        'bathrooms' => 'baños',
        'parking_spaces' => 'espacios de parqueo',
        'district' => 'distrito',
        'neighborhood' => 'barrio',
        'address_reference' => 'referencia de dirección',

        'lat' => 'latitud',
        'lng' => 'longitud',
        'latitud' => 'latitud',
        'longitud' => 'longitud',
        'radius' => 'radio',
    ],

    /*
    |--------------------------------------------------------------------------
    | Mensajes personalizados
    |--------------------------------------------------------------------------
    |
    | Solo los genericos. Los que dependen del dominio (el radio maximo,
    | el precio maximo vs minimo) viven en el FormRequest que los
    | aplica, porque son reglas de esa pantalla y no del framework.
    |
    */

    'custom' => [
        'password' => [
            'min' => 'La contraseña necesita al menos :min caracteres.',
        ],
    ],

];
