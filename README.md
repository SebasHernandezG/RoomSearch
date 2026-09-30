# Roomies

Aplicación web para encontrar compañeros de vivienda. Permite publicar habitaciones disponibles o solicitudes de habitación y conectar a personas interesadas mediante una solicitud interna.

## Funcionalidades actuales

- Registro, inicio y cierre de sesión con Laravel Breeze.
- Perfil de roomie con ciudad, zona, rango de presupuesto, biografía y teléfono.
- Publicaciones de dos tipos: `offer` (ofrezco habitación) y `search` (busco habitación).
- Datos de ubicación, presupuesto y descripción para cada publicación.
- Filtros públicos por ciudad y tipo de publicación.
- Creación, edición y eliminación de publicaciones para su propietario.
- Interés con mensaje opcional; cada usuario puede registrar un interés por publicación y no puede hacerlo en la propia.

## Tecnologías

- PHP 8.3 o superior y Laravel 13.
- Laravel Breeze con vistas Blade.
- SQLite para la base de datos local.
- Tailwind CSS, Alpine.js y Vite.
- PHPUnit para pruebas.

## Requisitos

- PHP 8.3 o superior con extensión SQLite habilitada.
- Composer.
- Node.js y npm.

## Instalación local

Desde la carpeta del proyecto:

```powershell
composer install
Copy-Item .env.example .env
New-Item -ItemType File -Path database\database.sqlite -Force
php artisan key:generate
php artisan migrate
npm install
```

La configuración de ejemplo ya usa SQLite. No es necesario configurar un servidor de base de datos para el entorno local.

Como alternativa, el proyecto incluye el script de preparación:

```powershell
composer run setup
```

## Ejecutar la aplicación

Para iniciar el entorno de desarrollo (aplicación Laravel, cola de trabajo, registros y Vite):

```powershell
composer run dev
```

Abre la dirección que muestre Laravel en la terminal. Si solo se desea compilar los recursos para producción:

```powershell
npm run build
```

## Pruebas

Ejecuta toda la suite:

```powershell
composer run test
```

La cobertura inicial de publicaciones se puede ejecutar de forma aislada con:

```powershell
php artisan test --compact tests\Feature\ListingFlowTest.php
```

Estas pruebas verifican la exploración pública, la creación autenticada, la autorización de edición y las validaciones básicas de una publicación.

## Estructura

```text
app/Models/                 Modelos User, Profile, Listing e Interest
app/Http/Controllers/       Flujos de perfiles, publicaciones e intereses
app/Http/Requests/          Validación de perfiles, publicaciones e intereses
database/migrations/        Esquema SQLite de la aplicación
resources/views/            Vistas Blade, autenticación y pantallas de Roomies
routes/web.php              Rutas públicas y protegidas
tests/Feature/              Pruebas de funcionalidades HTTP
```

## Estado e ideas futuras

La base inicial está lista para uso local y cubre el flujo esencial de descubrimiento, publicación y expresión de interés. Posibles siguientes pasos: bandeja para gestionar intereses, imágenes de habitaciones, moderación de publicaciones, criterios adicionales de compatibilidad y notificaciones.
