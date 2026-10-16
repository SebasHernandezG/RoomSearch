# Reglas de las pruebas del backend

Trampas de las fábricas y de `RefreshDatabase` que hacen que una prueba
pase midiendo lo contrario de lo que dice.

## `UserFactory` crea las cuentas **verificadas**

```php
// database/factories/UserFactory.php
'email_verified_at' => now(),
```

La cuenta sale con el correo confirmado sin pedirlo. Una prueba que
quiere medir "sin confirmar" y no dice `unverified()` está midiendo la
cuenta confirmada:

```php
// MAL: mide la cuenta confirmada y falla sin explicar por qué
$dueno = User::factory()->landlord()->create();

// BIEN
$dueno = User::factory()->landlord()->unverified()->create();

// BIEN, condicional
User::factory()->landlord()
    ->when(! $verificado, fn ($f) => $f->unverified())
    ->create();
```

Los estados disponibles son `unverified()`, `landlord()`, `admin()` y
`tenant()`. **No hay `verified()`**: `landlord()` ya viene verificado y
llamar a un `verified()` inexistente es un error de runtime.

Pasó tres veces en una sola sesión, siempre con el mismo síntoma:
pruebas de privacidad de contacto que fallan en la condición de "sin
confirmar" y parece que el código está mal cuando el que miente es el
dato de partida.

## El helper de usuario tiene que estar cacheado

Si el helper crea una cuenta nueva en cada llamada, `propiedad()` y
`actingAs(dueno())` usan **cuentas distintas**, y el 403 del permiso es
del test, no del código:

```php
private ?User $dueno = null;

private function dueno(): User
{
    if ($this->dueno instanceof User) {
        return $this->dueno;
    }

    $this->dueno = User::factory()->landlord()->create();
    $this->dueno->markEmailAsVerified();

    return $this->dueno;
}
```

Con esto llegaron doce pruebas en rojo de golpe. Un fallo de permisos
aparece en todas las pruebas de un archivo a la vez, y el patrón es
sospechoso: probablemente no es el código.

## Los defaults los pone MySQL, no el modelo

`LandlordProfile::create([...])->refresh()` es necesario para leer un
default de columna. El modelo recién creado **no** tiene el atributo
cargado y sale `null`:

```php
$perfil = LandlordProfile::create(['user_id' => $dueno->getKey()]);

$perfil->phone_private;            // null
$perfil->refresh()->phone_private; // true
```

Esto no es cosmético cuando el default es una decisión de privacidad.

## Las columnas `tinyint` necesitan `casts()`

MySQL devuelve `1` y `0` en una columna `boolean`, no `true` y `false`.

**Ojo con la explicación fácil, que es falsa:** no es que `1` sea truthy
y por eso se publique un número privado. En PHP `1` es truthy y `0` es
falsy, así que `if ($perfil->phone_private)` da **la respuesta correcta
por casualidad** en los dos sentidos. La lógica de privacidad no se
rompe; el valor simplemente no es un booleano.

Lo que sí se rompe es todo lo que compara **estricto** o lo que
**viaja en JSON**:

```php
$this->assertTrue($perfil->phone_private);   // recibe 1, no true → falla
$perfil->phone_private === true;              // false con 1
['private' => $perfil->phone_private];        // el JSON lleva 1 y 0
```

Y la tercera es la peligrosa: si el `1` llega al frontend y ahí se
compara con `=== true`, **el botón nunca aparece** — o aparece siempre,
según cómo esté escrito. Es un fallo que se ve en producción y no en
ninguna prueba de backend.

Por eso el cast no es cosmético, pero el motivo correcto es "el valor
viaja", no "la comparación se invierte".

**Ninguna prueba de "sale el número" detecta el problema real.** Hace
falta una prueba de "**no** sale", y tiene que mirar el cuerpo entero:

```php
$this->assertStringNotContainsString('88881234', $respuesta->getContent());
```

`assertNull($respuesta->json('data.phone'))` solo comprueba **un**
campo: el número puede haberse colado en otro y la prueba pasa.

## El id de un recurso no es `1`

Con `RefreshDatabase` la base arranca vacia, pero las fábricas consumen
ids antes: `User::factory()->landlord()->create()` dentro de
`Property::factory()` ya se lleva los primeros. Suponer
`/api/properties/1` devuelve 404, y eso se lee como "el dato no viaja"
cuando lo que pasó es que el id no existe.

```php
$inmueble = Property::factory()->activa()->create();

$this->getJson("/api/properties/{$inmueble->getKey()}");
```

## `201` en el primer `PUT` no es un descuido

`ResourceResponse::calculateStatus()` de Laravel devuelve `201` cuando
el modelounderlying `wasRecentlyCreated`. Con `firstOrCreate()` en un
`PUT`, la primera llamada crea y responde **201**, y las siguientes
**200**.

No es un bug que haya que arreglar: distingue "todavía no tenías perfil"
de "ya lo tenías". Si cambia, que sea documentado y con prueba, no
"arreglado" en silencio.

## `Storage::fake('public')` y los asserts

`Storage::disk('public')->assertCount(1)` pide **un directorio**, no
"un archivo suelto": la firma es `assertCount(int $count, string
$directory)`. Para contar archivos en subdirectorios hay que bajar:

```php
$this->assertCount(1, Storage::disk('public')->allFiles());
$this->assertSame([], Storage::disk('public')->allFiles());
```

Es la forma de detectar que cambiar un avatar **deja el anterior** en el
disco, que es el bug que ninguna prueba de "se subió la foto" ve.

## Lo que se lee de `Property` no está siempre cargado

`PropertyResource` devuelve `[]` para lo que no está cargado en la
relación:

```php
'images' => $this->resource->relationLoaded('imagenes') ? ... : [],
'contacto' => $this->whenLoaded('dueno', fn () => [...]),
```

Para leerlo en una prueba hay que pasar por la ruta que lo carga:
`GET /api/my/properties` para un anuncio pendiente, porque
`GET /api/properties/{id}` da 404 para lo que no está `activa` — y eso
es lo correcto.

## El contenido total manda más que un campo

Cuando la regla es de privacidad o de datos personales, la prueba
mira `getContent()` completo. Un campo puede venir bien y el número
estar en otro —un mensaje de error, un aviso, un campo que nadie leía.