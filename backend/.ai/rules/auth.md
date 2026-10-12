# Autenticación y roles

Aplica a: `routes/api.php`, `src/Identity/**`, `app/Http/Middleware/**`,
`bootstrap/app.php`, `lang/es/**`.

Cubre RF-1.1 (registro e inicio de sesión) y RF-1.4 (roles).

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

Cuando lleguen las Policies: este método queda para preguntas simples
de rol, y las autorizaciones con lógica van por `Gate::define`.

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

En producción no hace falta: cada petición arranca de cero. Si
olvidás esa línea, la prueba pasa al revés de como funciona el sistema
real, que es peor que no tenerla.

## Pruebas contra rutas montadas al vuelo

`RoleMiddlewareTest` monta sus propias rutas porque todavía no existe
RF-2.1 ni RF-7.1. **Cuando existan, hay que repetir esas mismas
pruebas contra las rutas de verdad**: un middleware bien escrito y
aplicado a la ruta equivocada deja pasar a cualquiera.

## Lo que falta

- **RF-1.3**: verificación de correo y recuperación de contraseña.
  `password_reset_tokens` ya existe en el esquema; la parte de
  verificación de correo no.
- **RF-1.2**: Google, en v2.
- **RF-1.5**: perfil de arrendador con teléfono y foto.
- **CSP (RNF-04)**: mientras no exista, el token en `localStorage` es
  un riesgo asumido, no resuelto.
