# Módulos del monolito

Aplica a: todo `backend/src/**`.

El backend es un monolito modular con DDD ligero. Los módulos viven en
`backend/src/` y se registran en `composer.json`.

## Reparto

| Módulo | Qué contiene |
| --- | --- |
| `Properties` | Inmuebles: modelo, enums, consultas, reglas de privacidad, seeders, pruebas |
| `Identity` | Usuarios y roles. **Está vacío**: `User` sigue en `app/Models/` |
| `Interests` | Contacto y WhatsApp. **Está vacío** |

## Qué va en el módulo y qué en `app/`

Regla práctica: **las reglas de negocio van en el módulo; el transporte
HTTP va en `app/`.**

```
src/Properties/Queries/PropertyRadiusQuery.php   regla: cómo se busca por radio   -> módulo
src/Properties/Support/PropertyLocation.php     regla: qué pin se puede mostrar    -> módulo
src/Properties/Models/Property.php              la entidad                        -> módulo
src/Properties/Enums/PropertyStatus.php         los estados y sus transiciones    -> módulo
src/Properties/Database/Seeders/                datos de ejemplo                  -> módulo

app/Http/Controllers/Api/PropertyController.php   orquesta y responde  -> app
app/Http/Requests/Api/ListPropertiesRequest.php  valida la entrada      -> app
app/Http/Resources/PropertyResource.php          formatea la salida     -> app
routes/api.php                                   declara las rutas      -> app
```

El Resources queda en `app/` y no en el módulo porque serializar es
decidir qué ve cada rol, y eso es una decisión de la aplicación, no del
dominio. Lo que hay que saber, el Resource lo pide.

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
src/Properties/Tests/Unit/PropertyLocationTest.php
```

Unitarias (`Unit/`) cuando la regla es aritmética pura y no necesita
base de datos. De Feature cuando toca HTTP o SQL.

**Las pruebas de Feature corren contra MySQL real**, no SQLite, porque
`ST_Distance_Sphere` no existe en SQLite. La base es `roomies_testing`.
No cambies eso sin revisar `PropertyGeolocationTest`, que es el guardián
del orden de ejes.

## Lo que falta

`Identity` está vacío y `User` sigue en `app/Models/`. Moverlo es la
tarea del issue #1, y es lo primero que hay que hacer cuando llegue
RF-1.1: el módulo de identidad no puede vivir sin su entidad.
