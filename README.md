# Roomies San Carlos

Plataforma para descubrir y publicar opciones de vivienda compartida en San Carlos, Costa Rica y sus alrededores. El proyecto está organizado como un monolito modular: Laravel expone la API y React/Vite entrega la interfaz.

## Estructura

```text
RoomSearch/
├── backend/                 # Laravel: API, dominio y persistencia
│   ├── src/                 # Módulos del monolito (Properties, Identity, Interests)
│   ├── app/                 # Transporte HTTP: controladores, requests, resources
│   └── .ai/rules/           # Decisiones y trampas del proyecto. Leelas antes de codear
├── frontend/                # React + Vite; interfaz en frontend/src/
├── docker/
│   ├── nginx/               # Reservado. Serviría el frontend en producción; ver su README
│   └── mysql/init/          # Scripts de inicialización de MySQL
├── docker-compose.yml       # MySQL local
└── README.md
```

> **No hay servidor web de producción todavía.** En desarrollo lo sirve
> Vite; en producción no hay nada configurado. Por eso la CSP de RNF-04
> y el HTTPS de RNF-06 siguen abiertos: las dos las emite el servidor
> que entrega el HTML, no Laravel. Ver
> [`docker/nginx/README.md`](docker/nginx/README.md).

## Arquitectura

Monolito modular con DDD ligero. Los módulos del backend viven en
`backend/src/`:

- `Properties`: alojamientos y publicaciones.
- `Identity`: usuarios y roles.
- `Interests`: solicitudes de contacto. *Pendiente.*

Los roles iniciales son `admin` (superusuario), `landlord` (arrendador) y `tenant` (inquilino).

La regla que decide qué va en cada lado: **las reglas de negocio van
en el módulo, el transporte HTTP va en `app/`**. Está explicado con
ejemplos en [`backend/.ai/rules/modulos.md`](backend/.ai/rules/modulos.md).

## Ramas

**`main` es la única rama remota permanente.** Cada cambio se trabaja en
una rama corta, con un solo objetivo y su propio PR. Tras fusionarlo, se
elimina la rama. Evitamos mantener varias ramas encadenadas abiertas.

```
main
 └── feature/mi-cambio      <- se abre contra main, se borra al fusionar
```

Reglas de trabajo:

1. **Nadie trabaja en `main`.** Ni para un fix de una línea.
2. **Un objetivo por PR.** Mantener como máximo un PR de implementación
   abierto por persona, salvo una dependencia explícita y documentada.
3. **Revisar y probar antes de fusionar.** Después, borrar la rama.

El 10 de noviembre de 2026 se cerraron los PR #101–#105 y se eliminaron
sus ramas y `archivo/produccion`. Ninguno de esos cambios se fusionó a
`main`. Un bundle local verificado conserva todos los commits:
`../RoomSearch-branches-2026-11-10.bundle`. Ese archivo debe respaldarse
fuera de este equipo si se necesita recuperación duradera. Las razones
históricas del port están en
[`backend/.ai/rules/port-produccion.md`](backend/.ai/rules/port-produccion.md).

La reestructuración móvil y sus etapas están en
[`docs/restructuring/PLAN.md`](docs/restructuring/PLAN.md).

## Reglas del proyecto

`backend/.ai/rules/` es la memoria del proyecto: decisiones ya
tomadas, trampas ya pisadas y convenciones que hay que seguir. No es
documentación, es guía de trabajo.

Empieza por [`backend/.ai/rules/index.md`](backend/.ai/rules/index.md).

Lo más importante que hay adentro: **las tres trampas de MySQL 8.4
que hacen fallar la búsqueda por radio en silencio**. Si las pisás sin
saber que existen, el mapa se queda vacío y ningún error avisa.

## Arranque

Requiere PHP 8.4, Composer, Node 20+, y Docker para MySQL.

### 1 · Base de datos

```powershell
docker compose up -d mysql
docker compose ps          # esperá a que diga healthy
```

MySQL 8.4 corre en el puerto **3308** y la base se llama `roomies`.

### 2 · Backend

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate --seed     # siembra 19 inmuebles de San Carlos
php artisan serve --port=8001
```

`migrate --seed` es lo que hace que el mapa tenga algo que mostrar. Sin
datos se abre vacío y no hay forma de probar la búsqueda por radio.

### 3 · Frontend

```powershell
cd frontend
npm install
npm run dev
```

Abrí `http://localhost:5173`. El frontend llama a rutas relativas
(`/api/properties`) y Vite hace de proxy hacia `:8001`, así que en
desarrollo y en producción el código es el mismo y no hay CORS que
configurar.

### Variables de entorno

Solo dos importan:

| Variable | Para qué |
| --- | --- |
| `TRUSTED_PROXIES` | **Obligatoria en producción.** Sin ella, el rate limiting de RNF-05 se vuelve global detrás de un proxy |
| `CORS_ALLOWED_ORIGINS` | Solo si el frontend se sirve desde otro dominio |

## Estado actual

- MySQL 8.4 en Docker, con el esquema completo de `properties`, la
  columna `POINT SRID 4326` **con índice espacial** y el dueño de cada
  publicación.
- API pública `GET /api/properties` con búsqueda por radio, filtros
  combinables, orden y rate limiting.
- Registro e inicio de sesión con Sanctum, y tres roles: `admin`,
  `landlord`, `tenant`.
- Verificación de correo y recuperación de contraseña, con enlace
  firmado, token de un solo uso y rate limiting.
- Publicar, editar, pausar, reanudar, marcar como alquilada y borrar.
  Lo publica un `landlord`; el estado lo fija el servidor y nace
  `pendiente`.
- Moderación: `approve` y `reject`, solo para `admin`. Es el único
  camino por el que un inmueble se vuelve visible.
- Frontend conectado a la API real para buscar: lista, mapa Leaflet y
  tarjetas. La búsqueda móvil empieza por la lista; el mapa se consulta
  al confirmar una zona.
- El parámetro `area=ciudad-quesada` acota el listado público a
  habitaciones y apartamentos del distrito registrado como Ciudad
  Quesada. Es un primer límite por datos existentes; la validación de
  barrios y del polígono de cobertura está pendiente.
- Pruebas de backend contra MySQL real y pruebas de frontend con Vitest.

### Cuentas de demostración

`php artisan migrate --seed` deja tres cuentas, una por rol, con la
contraseña `password`:

| Correo | Rol |
| --- | --- |
| `admin@roomies.test` | Administrador (aprueba publicaciones) |
| `landlord@roomies.test` | Arrendadora (publica) |
| `tenant@roomies.test` | Inquilino (busca) |

El registro normal crea inquilinos. Para publicar hay que pasar la
cuenta a `landlord`.

### Lo que sigue

El repositorio ya contiene pantallas de acceso, publicación, detalle y
moderación, además de pruebas de componentes. El objetivo siguiente es
validar esos recorridos completos en móvil, delimitar el área de servicio
con datos revisados, resolver la cobertura del mapa y preparar despliegue,
respaldo y monitoreo. Las etapas y criterios están en
[`docs/restructuring/PLAN.md`](docs/restructuring/PLAN.md).
