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

## Pruebas

`RateLimitApiTest` fija el comportamiento del 429. Si cambiás el
número, actualizá la prueba: los valores están escritos a mano ahí a
propósito, para que cambiar el límite sea una decisión visible.
