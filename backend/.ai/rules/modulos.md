# Módulos del monolito

Aplica a: todo `backend/src/**`.

El backend es un monolito modular con DDD ligero. Los módulos viven en
`backend/src/` y se registran en `composer.json`.

## Reparto

| Módulo | Qué contiene |
| --- | --- |
| `Properties` | Inmuebles: modelo, enum, consultas, reglas de privacidad, Policy, seeders, pruebas |
| `Identity` | Usuarios y roles: `User`, `UserRole`, notificaciones, pruebas |
| `Platform` | Reglas que no pertenecen a un dominio: configuración. Hoy, solo la base de datos |
| `Interests` | Contacto y WhatsApp. **Está vacío** |

`Identity` ya tiene su entidad: `User` vive en
`src/Identity/Models/User.php` desde RF-1.1, con `UserFactory`
apuntándolo explícitamente porque la convención de nombre de Laravel
no lo encuentra.

## Qué va en el módulo y qué en `app/`

Regla práctica: **las reglas de negocio van en el módulo; el transporte
HTTP va en `app/`.**

```
src/Properties/Queries/PropertyRadiusQuery.php   regla: cómo se busca por radio   -> módulo
src/Properties/Support/PropertyLocation.php     regla: qué pin se puede mostrar    -> módulo
src/Properties/Models/Property.php              la entidad                        -> módulo
src/Properties/Models/PropertyPolicy.php        regla: quién puede tocarla         -> módulo
src/Properties/Enums/PropertyStatus.php         los estados y sus transiciones    -> módulo
src/Properties/Database/Seeders/                datos de ejemplo                  -> módulo

app/Http/Controllers/Api/PropertyController.php   orquesta y responde  -> app
app/Http/Controllers/Api/MyPropertyController.php orquesta y responde  -> app
app/Http/Requests/Api/ListPropertiesRequest.php  valida la entrada      -> app
app/Http/Resources/PropertyResource.php          formatea la salida     -> app
routes/api.php                                   declara las rutas      -> app
```

El Resources queda en `app/` y no en el módulo porque serializar es
decidir qué ve cada rol, y eso es una decisión de la aplicación, no del
dominio. Lo que hay que saber, el Resource lo pide.

### La Policy va en el módulo, pero hay que registrarla

`PropertyPolicy` es una regla de negocio ("solo el dueño edita"), así
que va en el módulo. Pero Laravel la busca en `App\Policies` por
convención de nombre, no la encuentra, y **todas las autorizaciones
pasan en silencio**. Por eso `AppServiceProvider::boot()` la registra
con `Gate::policy(...)`. Ver [auth.md](auth.md).

### El ejemplo que lo aclara

RF-2.5 dice que el pin se puede desplazar. Eso es una regla de
dominio, así que está en `PropertyLocation`. La versión inicial estaba
dentro de `PropertyResource` y terminó con un `TypeError` en
producción: la regla se probaba solo a través del endpoint, y el
factory dejaba `show_exact_location` en `true`, así que el camino del
desplazamiento **nunca se ejecutaba**.

Cuando muevas una regla de `app/` al módulo, preguntate si su prueba
puede correr sin HTTP. Si no puede, es una pista de que la regla está
en el lugar equivocado.

## Enums

Los valores se guardan tal cual en la base, así que **renombrarlos
después exige una migración**. Los tres que existen:

- `PropertyType`: `apartamento`, `casa`, `habitacion`, `estudio`
- `Currency`: `CRC`, `USD` (ISO 4217)
- `PropertyStatus`: incluye `activa`, `borrador`, `pausada`

`PropertyStatus::canTransitionTo()` es la única fuente de verdad sobre
qué transiciones existen. Si agregás un estado, actualizala.

## Pruebas

Las pruebas de un módulo van **dentro** del módulo:

```
src/Properties/Tests/Feature/PropertyRadiusQueryTest.php
src/Properties/Tests/Feature/PublishPropertyFlowTest.php
src/Properties/Tests/Unit/PropertyLocationTest.php
```

Unitarias (`Unit/`) cuando la regla es aritmética pura y no necesita
base de datos. De Feature cuando toca HTTP o SQL.

**Las pruebas de Feature corren contra MySQL real**, no SQLite, porque
`ST_Distance_Sphere` no existe en SQLite. La base es `roomies_testing`.
No cambies eso sin revisar `PropertyGeolocationTest`, que es el guardián
del orden de ejes.

### La prueba que dice si el producto funciona

`PublishPropertyFlowTest::una_persona_publica_y_el_inmueble_aparece_en_el_mapa`
recorre el camino entero: se registra, publica, un admin aprueba y el
inmueble aparece en el mapa. Es lenta comparada con las demás porque
siembra y migra, y por eso conviene correr el archivo entero y no un
solo método cuando se toca el flujo.

## Lo que falta

- `Interests` sigue vacío: es RF-5, contacto por WhatsApp.
- Las Policies viven al lado del modelo (`Models/PropertyPolicy.php`).
  Cuando haya más de una, vale la pena un `src/Properties/Policies/`
  para que `Models/` siga siendo solo entidades. Con una sola no vale
  la pena abrir el directorio.
