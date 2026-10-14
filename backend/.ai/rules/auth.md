# Autenticación, roles y autorizaciones

Aplica a: `routes/api.php`, `src/Identity/**`, `src/Properties/Models/PropertyPolicy.php`,
`app/Http/Middleware/**`, `app/Providers/AppServiceProvider.php`,
`bootstrap/app.php`, `lang/es/**`.

Cubre RF-1.1 (registro e inicio de sesión), RF-1.4 (roles) y quién
puede tocar una publicación (RF-2.1 y RF-7.1).

---

## El token viaja en la cabecera

```
Authorization: Bearer <token>
```

Guard `sanctum`. Sanctum **hashea** el token en la base: lo que se
guarda no sirve para autenticarse. Si alguna vez alguien propone
comparar el token contra la base en crudo, no se puede.

El cliente decide dónde lo guarda. Ese es el punto abierto más serio de
esta parte: en `localStorage` queda expuesto a XSS, y la plataforma no
tiene CSP todavía (RNF-04). Cuando exista, revisar si conviene migrar a
cookie de sesión con Sanctum SPA (`SANCTUM_STATEFUL_DOMAINS`).

## El rol nunca viene del cuerpo

`RegisterRequest::datosParaCrear()` fija `role: UserRole::Tenant` y
descarta lo que mande el cliente. Si una persona pudiera pedir `admin`
al registrarse, el registro sería un escalamiento de privilegios de
una línea.

El default es inquilino, no arrendador. Publicar vivienda es la acción
con consecuencias y RF-7.1 pide moderación: el privilegio se pide
aparte.

## `tieneRol()`, no `can()`

`can()` ya existe en `Illuminate\Foundation\Auth\User` con firma
`can($abilities, $arguments = [])`. Redefinirla impide que el modelo
cargue, y rompería los Gate de Laravel más adelante.

`tieneRol()` sigue siendo lo que usa el middleware `role:`, que solo
pregunta "¿tenés alguno de estos roles?":

```
->middleware('role:admin')
```

Las autorizaciones con lógica ya existen y van por `Gate`, en
`PropertyPolicy`: quién es el dueño de un inmueble no es una pregunta
de rol sino de pertenencia, y el middleware no puede responderla.

## La Policy hay que registrarla a mano

`PropertyPolicy` vive en `Modules\Properties\Models`, no en
`App\Policies`, porque es una regla de negocio y no transporte HTTP.
Laravel la buscaría en `App\Policies` por convención de nombre, no la
encontraría, y **todas las autorizaciones pasarían en silencio**: sin
Policy, `authorize()` no encuentra nada que lo niegue y deja pasar.

Por eso `AppServiceProvider::boot()` hace:

```php
Gate::policy(Property::class, PropertyPolicy::class);
```

Un `authorize()` que no existe no da error. Es el fallo más caro de
esta parte: protegería la prueba contra sí mismo si no probara que un
tercero **no** puede editar la publicación de otro.

## `role` en inglés, `rol` en los métodos

La columna se llama `role`. Leerla como `$this->rol` devuelve `null`
**en silencio**, porque no existe ningún atributo con ese nombre, y el
default de `rolEfectivo()` lo convertía en "todos son inquilinos":
`isLandlord()` daba `false` para todo el mundo, arrendadores
incluidos.

Los métodos y el resto del dominio van en español. Solo el nombre de
la columna y de los parámetros de la API van en inglés, que es lo que
espera el resto del framework.

## Sin sesión es 401, sin permiso es 403

No mezclarlos. Decirle a alguien que no tiene cuenta que su cuenta no
tiene permisos lo manda a pensar que hay un bug de sesión.

El 401 de Laravel sale **antes** que cualquier middleware propio,
porque el guard va primero en la cadena. Por eso el mensaje se
traduce en `bootstrap/app.php` (`withExceptions`), no en
`EnsureUserHasRole`: el problema es general, le pasa a toda petición
sin token válido.

## El 403 se traduce escuchando `AccessDeniedHttpException`

Hay dos caminos al 403 y cada uno salía en su idioma: el middleware
`role:` contestaba "Esta cuenta no puede hacer eso." y
`$this->authorize()` contestaba `This action is unauthorized.`, que es
un string escrito a mano en `AuthorizationException` y que no pasa por
traducción.

Ahora los dos usan `auth.noAutorizado`. Pero el callback de `bootstrap/app.php`
está tipado con **`AccessDeniedHttpException`**, y no con
`AuthorizationException`, por esto:

```
Handler::render()
  -> mapException()
  -> prepareException()        <-- convierte una en la otra
  -> renderViaCallbacks()      <-- los callbacks de render()
```

`prepareException()` corre **antes**, y reemplaza
`AuthorizationException` por `AccessDeniedHttpException`. Un callback
tipado con `AuthorizationException` no se activa nunca y no da ningún
error: simplemente no se ejecuta.

Es el mismo tipo de fallo silencioso que una Policy sin registrar en
`Gate`: algo que debería estar protegiendo y que en realidad no está.

Dos pruebas lo fijan: `el_403_de_la_politica_no_sale_en_ingles` y
`el_403_de_una_ruta_real_lleva_el_mensaje_en_espanol`.

**El mensaje es uno solo, para todos los 403.** No se personaliza por
Policy ("esta publicación no es tuya", "tu cuenta no puede publicar"):
un 403 con detalle distinto según el caso le dice a quien va probando
rutas cuáles existen y cuáles no.

Por eso `lang/es/propiedades.php` **no** tiene claves de 403. Si
alguien necesita un 403 más específico, hay que romper este acuerdo a
propósito y volver a esta sección.

## El límite de intentos cuenta fallidos

`LoginRequest` sube el contador solo cuando la contraseña está mal, y
lo borra al entrar bien. Si contara todos los intentos, alguien que se
equivoca cinco veces y después entra bien quedaría frenado igual.

Hay dos contadores, y el segundo es el que de verdad importa:

| Contador | Techo | Para qué |
| --- | --- | --- |
| por correo + IP | 5 | Frena a quien insiste con la misma casilla |
| por IP | 30 | Frena a quien va probando correos distintos |

Con solo el de correo, un atacante tendría cinco intentos libres por
cada dirección que se invente y **la plataforma entera sería
adivinable**.

El correo va normalizado en la clave: `Ana@x.com` y `ana@x.com` son la
misma casilla y no pueden llevar contadores distintos.

## El mensaje de credenciales es uno solo

`lang/es/auth.php` tiene un único mensaje para "correo no existe" y
"contraseña incorrecta". Si diferenciaran, `POST /api/login` serviría
para enumerar quién tiene cuenta en la plataforma.

Si alguna vez se toca ese mensaje, hay una prueba que lo falla:
`el_mensaje_no_revela_si_la_cuenta_existe`.

## `lowercase` rechaza, no normaliza

La regla `lowercase` de Laravel **rechaza** las mayúsculas, no las
convierte. Por eso `RegisterRequest` normaliza en
`prepareForValidation()` con `Str::lower()`.

Sin eso, alguien que escribiera `Ana@correo.com` recibía un error
aunque su correo sea tan válido como el de al lado.

El nombre **no** se normaliza: "Ana" y "ana" son la misma persona pero
dos nombres distintos, y ahí sí hay distinción.

## Los 422 van en español

`lang/es/validation.php` tiene la traducción completa. Toda clave que
falte ahí se muestra **literal** en pantalla (`validation.required`),
porque Laravel no tiene reserva por clave.

El bloque `attributes` importa: sin él, el error del alquiler mensual
decía "monthly rent" en vez de "alquiler mensual".

Los mensajes que dependen del dominio (radio máximo, precio máximo vs
mínimo) viven en el FormRequest que los aplica, **no** en `lang/`.
Dos fuentes para el mismo texto es peor que una.

---

## Tests: el guard se cachea entre peticiones

En pruebas todas las peticiones comparten la misma instancia de la
aplicación, y el guard guarda en memoria el usuario que ya resolvió.

Por eso una prueba que revoca un token y espera un 401 en la
siguiente petición **falla** sin:

```php
$this->app['auth']->forgetGuards();
```

### Cambiar de identidad a mitad de una prueba también

`PublishPropertyFlowTest` recorre el flujo completo: la arrendadora
publica y después **un admin** la aprueba. Sin `forgetGuards()` entre
los dos, la petición del admin llega con su token correcto pero el
guard sigue teniendo a la arrendadora de la petición anterior, y el
middleware `role:admin` responde **403**. Parece un bug de permisos y
es un bug de la prueba.

En producción no hace falta nada de esto: cada petición arranca de
cero. Si olvidás la línea, la prueba pasa al revés de como funciona el
sistema real, que es peor que no tenerla.

## Pruebas contra rutas montadas al vuelo y contra las de verdad

`RoleMiddlewareTest` tiene las dos mitades, y las dos importan:

- **Rutas montadas al vuelo** (`/prueba/admin`, …) prueban el
  middleware como pieza suelta: qué hace con cada rol y con cada rol
  mal escrito.
- **Las rutas de verdad** prueban que el middleware quedó **colgado de
  la ruta correcta**. Un middleware bien escrito y aplicado a la ruta
  equivocada deja pasar a cualquiera, y la primera mitad no lo
  detecta.

Lo segundo ya se puede hacer porque RF-2.1 y RF-7.1 tienen rutas
(`/api/properties`, `/api/my/properties`,
`/api/properties/{id}/approve`). Cuando llegue el panel de
administración, se repite la idea contra sus rutas.

## `store` fija el estado y el dueño

Igual que el rol en el registro, en `MyPropertyController::store` el
estado y el `user_id` **no vienen del cuerpo**:

```php
'status' => PropertyStatus::Pendiente,   // fijo, ni aunque manden 'activa'
'user_id' => $request->user()->getKey(),
```

Si el estado viniera del cliente, la moderación de RF-7.1 sería
decorativa. Dos pruebas lo fijan: `el_estado_no_se_puede_elegir_al_publicar`
y `el_dueno_no_se_puede_elegir_al_publicar`.

## `StorePropertyRequest` sirve para crear y para editar

A propósito son el mismo request, y por eso **todos los campos son
`required` también en un `PUT`**: una edición es un reemplazo completo,
no un parche. Si divergieran, alguien podría publicar algo que después
no podría editar sin cambiar más campos, y la publicación se rompe a
la mitad.

Consecuencia: el frontend tiene que mandar el objeto entero al
editar, no solo lo que cambió.

## Lo que falta

- **RF-1.3**: verificación de correo y recuperación de contraseña.
  `password_reset_tokens` ya existe en el esquema; la parte de
  verificación de correo no.
- **RF-1.2**: Google, en v2.
- **RF-1.5**: perfil de arrendador con teléfono y foto.
- **CSP (RNF-04)**: mientras no exista, el token en `localStorage` es
  un riesgo asumido, no resuelto.
