# Convenciones de la API

Aplica a: `routes/api.php`, `app/Http/**`, `app/Providers/AppServiceProvider.php`.

## Prefijo

Todo va bajo `/api` y sin sesión. RF-1.4 dice que quien busca no
necesita cuenta. La autenticación entra con RF-1.1 y vive en un grupo
de rutas aparte, no mezclada con las públicas.

`bootstrap/app.php` fuerza la respuesta JSON en `api/*`, así que un
error dentro de un controlador devuelve JSON y no HTML. Un controlador
que lance una excepción no necesita construir la respuesta de error a
mano.

## Validación: FormRequest, no validación en el controlador

`app/Http/Requests/Api/ListPropertiesRequest.php`. El controlador solo
lee. Ponerle reglas a mano adentro del controlador tiene dos
desventajas: el 422 no sale con el formato estándar de Laravel, y las
reglas quedan enterradas en el método.

Reglas que ya están y conviene respetar:

- Los límites de latitud y longitud cubren **Alajuela**, no solo San
  Carlos: la plataforma crece hacia otros cantones.
- El radio se acota a 10 km (`PropertyRadiusQuery::RADIO_MAXIMO`). El
  mismo número está en la validación y en la consulta: si divergen,
  la validación deja pasar lo que la consulta no puede responder.
- Ordenar por distancia sin punto de referencia es un **422**, no un
  orden arbitrario.

## Los tres filtros que estaban rotos

Los tres se implementaron sin una sola prueba, y los tres fallaban.
`PropertyFiltersTest` y `PropertyTextSearchTest` los vigilan.

**1 · `max_rent` sin `min_rent` daba 422.** La regla era
`'max_rent' => [..., 'gte:min_rent']`, y `gte` compara contra un
parámetro que no vino. Filtrar por "hasta 300 000", que es lo más
natural de escribir, respondía error. La comparación min/max vive
ahora en `withValidator()`, que ya existía para el caso del orden por
distancia.

**2 · `parking=0` no filtraba nada.** Era
`where('parking_spaces', '>=', $boolean ? 1 : 0)`. Con `parking=0`
comparaba `>= 0`, que es cierto para **todas** las filas: devolvía la
página entera. Quien lo prendía creyendo ver los que no tienen parqueo
estaba viendo también los que sí. El cero se compara con igualdad.

**3 · Una palabra de un carácter disparaba consulta.** `%a%` matchea
casi todo contra tres columnas. `ListPropertiesRequest::tieneTerminoDeBusqueda()`
devuelve `false` con menos de `TERMINO_MINIMO` (2) caracteres y el
listado sale **completo**, no vacío.

El tercero no es un 422 a propósito: la persona está escribiendo, y un
error en pantalla mientras teclea la primera letra es peor que no
filtrar. "No dispara consulta" significa "no aplica el filtro", no
"no hay resultados".

## La búsqueda SÍ distingue acentos, por casualidad

`utf8mb4_unicode_ci` es *accent insensitive* además de *case
insensitive*. Por eso `buscar('Alajuela')` encuentra `Alajuela` sin
que nadie normalice nada, y por eso las pruebas de acentos pasan sin
código de normalización.

**No confíes en esto sin probarlo.** Si algún día alguien cambia la
collation de las columnas (por ejemplo a `utf8mb4_0900_as_cs` para
ordenar mejor con la Ñ), la búsqueda deja de ignorar tildes sin que
ningún error lo diga. Las pruebas de acentos y de enye en
`PropertyTextSearchTest` son las que lo detectan.

## Sobre los comodines de LIKE

El término va ligado como parámetro, así que una comilla no rompe la
consulta. Pero `%` y `_` **dentro** del término siguen siendo comodines
para LIKE, porque van en el patrón y no en el SQL. Ligarlos evita
inyección, no el comportamiento de LIKE.

Aquí es inofensivo: buscar `50%` devuelve de más, no rompe nada. Por eso
no se escapan. Si alguna vez el término se usa en un `LIKE` donde
importa (un email, un teléfono), ahí sí hay que `ESCAPE`.

## Salida: API Resource

Todo lo que sale por un Resource. No devuelvas el modelo.

`PropertyResource` decide qué ve cada rol y aplica RF-2.5. La distancia
pasa por `PropertyLocation::distanciaRevelable()`, no por un `round()`
en el Resource: la regla de privacidad es del dominio.

Los tres campos que hoy salen vacíos a propósito:

```php
'images' => [],              // RF-2.3, pendiente
'landlord_verified' => false, // RF-8.1, pendiente
'is_favorite' => false,       // necesita sesión, RF-1.1
```

Están para que el frontend pueda compilar contra la forma final. El
frontend **no debe** inventar un `true` cuando vienen vacíos.

## Rate limiting (RNF-05)

El limitador `api` está en `AppServiceProvider::boot()`. Se aplica al
**grupo completo** en `routes/api.php`, no ruta por ruta: una ruta
nueva sin `throttle` es un agujero, y es el error que más cuesta
detectar.

Son 120 por minuto. El número sale del frontend más rápido que hay, no
de lo que parece cómodo: el mapa dispara su búsqueda con un debounce
de 300 ms, así que arrastrar sin parar no genera ni una petición.

El 429 responde con `Retry-After`. `frontend/src/lib/api.ts` lo lee en
`ErrorApi.esperarSegundos`, y la pantalla muestra una cuenta regresiva
**conservando los resultados que ya tenía**. Tirar la lista porque el
servidor pidió esperar sería castigar a alguien por haber cargado mucho.

### El proxy hay que configurarlo

Sin `TRUSTED_PROXIES`, detrás de nginx la IP que ve Laravel es la del
proxy, la misma para todos, y el techo se vuelve **global**: 120
peticiones por minuto para todo el mundo junto. Es peor que no tener
límite, porque además de no proteger molesta.

En desarrollo queda vacío, que es lo correcto: no hay proxy delante.

## Consultas parametrizadas

Toda consulta con input de usuario va ligada, nunca interpolada.

Ojo con las expresiones espaciales: **no se pueden ligar**. Van en el
SQL literal. Por eso la envoltura del radio se construye con
`sprintf` de floats que ya vienen validados como `numeric` dentro de
Alajuela. Ver [mysql-geoespacial.md](mysql-geoespacial.md).

## Los filtros que existen

Todos opcionales y combinables (RF-4.1). Los booleanos usan `has()`, no
`filled()`, porque `furnished=0` es una consulta legítima.

| Parámetro | Efecto |
| --- | --- |
| `type` | Un tipo de inmueble |
| `min_rent` / `max_rent` | Rango de precio, uno o los dos |
| `bedrooms` / `bathrooms` | **Al menos** ese número, no exactamente |
| `furnished`, `pets_allowed` | Exactamente ese valor |
| `parking` | `1` = al menos un espacio; `0` = **cero** espacios |
| `includes_water`, `includes_electricity`, `includes_internet` | Exactamente ese valor |
| `available_from` | Disponible en esa fecha o antes |
| `district` | Un distrito exacto |
| `q` | Texto libre sobre título, distrito y barrio |
| `sort` | `recent`, `price_asc`, `price_desc`, `distance` |

`available_from` es nullable, así que un inmueble sin fecha **sale**
del filtro por fecha. No se le inventa una por defecto: "sin fecha"
significa "disponible ya", no "disponible desde 1970".

## Pruebas

`RateLimitApiTest` fija el comportamiento del 429. Si cambiás el
número, actualizá la prueba: los valores están escritos a mano ahí a
propósito, para que cambiar el límite sea una decisión visible.

De los filtros y la búsqueda:

| Archivo | Qué fija |
| --- | --- |
| `PropertyFiltersTest` | Los filtros de RF-4.1 y que sean combinables |
| `PropertyTextSearchTest` | La búsqueda de RF-4.3, acentos, enye y longitud mínima |
| `PropertyRadiusQueryTest` | La búsqueda por radio y las trampas de MySQL |

Las tres corrigen contra **MySQL real**, porque el comportamiento de
la búsqueda depende de la collation de las columnas, que SQLite no
tiene igual. Una prueba de acentos en SQLite pasaría o fallaría por
el motivo equivocado.
