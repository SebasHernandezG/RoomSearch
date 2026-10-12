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
│   ├── nginx/               # Reservado para el servidor web
│   └── mysql/               # Scripts de inicialización
├── docker-compose.yml       # MySQL local
└── README.md
```

## Arquitectura

Monolito modular con DDD ligero. Los módulos del backend viven en
`backend/src/`:

- `Properties`: alojamientos y publicaciones.
- `Identity`: usuarios y roles. *Pendiente de RF-1.1.*
- `Interests`: solicitudes de contacto. *Pendiente.*

Los roles iniciales son `admin` (superusuario), `landlord` (arrendador) y `tenant` (inquilino).

La regla que decide qué va en cada lado: **las reglas de negocio van
en el módulo, el transporte HTTP va en `app/`**. Está explicado con
ejemplos en [`backend/.ai/rules/modulos.md`](backend/.ai/rules/modulos.md).

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

- MySQL 8.4 en Docker, con el esquema completo de `properties` y la
  columna `POINT SRID 4326`.
- API pública `GET /api/properties` con búsqueda por radio, filtros
  combinables, orden y rate limiting.
- Frontend conectado a la API real: mapa Leaflet, lista y tarjetas.
- Tests: **52** corriendo contra MySQL real, no SQLite.

### Lo que falta

- **Autenticación (RF-1.1).** Hoy la plataforma es de solo lectura:
  nadie puede publicar. Es el bloqueador principal.
- **Publicar un inmueble (RF-2.1).** Habilita el índice espacial, que
  MySQL rechaza hoy porque `location` es nullable.
- **Fotos (RF-2.3)**, verificación de arrendador (RF-8.1) y
  favoritos: los campos ya salen en la API, siempre vacíos.
- **Pruebas del frontend.** No hay runner.
