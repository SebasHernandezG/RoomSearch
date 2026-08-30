# Roomies San Carlos

Plataforma para descubrir y publicar opciones de vivienda compartida en San Carlos, Costa Rica y sus alrededores. El proyecto está organizado como un monolito modular: Laravel expone la API y React/Vite entrega la interfaz.

## Estructura

```text
proyecto-roomies/
├── backend/                 # Laravel: API, dominio y persistencia
├── frontend/                # React + Vite; interfaz en frontend/src/
├── docker/
│   ├── nginx/               # Reservado para el servidor web
│   └── mysql/               # Reservado para scripts de inicialización
├── docker-compose.yml       # MySQL local
└── README.md
```

## Arquitectura

Se usará un monolito modular con DDD ligero y arquitectura hexagonal. Los módulos del backend vivirán progresivamente en `backend/src/`:

- `Identity`: usuarios y roles.
- `Properties`: alojamientos y publicaciones.
- `Interests`: solicitudes de contacto.

Los roles iniciales son `admin` (superusuario), `landlord` (arrendador) y `tenant` (inquilino).

## Base de datos

MySQL 8.4 se ejecuta en Docker bajo el servicio `mysql`. La base de datos se llama `roomies` y está disponible localmente en el puerto `3308`.

```powershell
docker compose up -d mysql
docker compose ps
```

## Ejecutar el backend

```powershell
cd backend
php artisan migrate
php artisan serve --port=8001
```

## Ejecutar el frontend

```powershell
cd frontend
npm run dev
```

Abre la dirección indicada por Vite, normalmente `http://localhost:5173`. El proyecto anterior que carga en `http://localhost:8000` no forma parte de esta nueva estructura.

## Estado actual

- MySQL en Docker y migraciones base de Laravel configuradas.
- React y React DOM instalados en el frontend.
- Migración de la interfaz anterior a React en curso.
- Próximos pasos: API de propiedades, datos ficticios de San Carlos, roles y autenticación.
