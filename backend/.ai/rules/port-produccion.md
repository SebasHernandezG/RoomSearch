# La rama `Producción` y qué se trajo de ella

Aplica a: todo `backend/**` y `frontend/**`, cuando alguien pregunte
"¿por qué no se fusionó la rama `Producción`?" o "esto ya estaba hecho,
¿no?".

**La respuesta es: casi nada, y a propósito.**

Este archivo es el inventario de la decisión "se porta a Laravel, no se
fusiona tal cual". Sin él, la rama queda archivada sin explicación y en
seis meses alguien la reabre, la fusiona, y Rompe el mapa.

Ver issue #2.

---

## Qué es `origin/Producción`

12 040 líneas y **dos aplicaciones en el mismo repo**:

| Parte | Qué es |
| --- | --- |
| `app/`, `resources/views/`, `database/migrations/` | Laravel con Breeze, sesiones y Blade |
| `src/server/` | Un servidor **Elysia** (Bun) en paralelo, con SQLite |
| `src/client/` | Un cliente **React** con Vite |

La mitad Laravel nunca se conectó con la mitad Elysia. Son dos
implementaciones del mismo producto, y la que funciona es la de Blade.
Por eso el issue dice "arquitectura distinta".

## Lo que se traen

| Pieza | De dónde | Estado |
| --- | --- | --- |
| Auth (registro, login, verificación, reset) | `app/Http/Controllers/Auth/*` | **Portada** a Sanctum, API-first |
| CRUD de anuncios | `ListingController`, `StoreListingRequest` | **Portada** al módulo `Properties` |
| Permisos | `ListingPolicy` | **Reescrita**: el original es un stub |
| Selector de pin | `src/client/components/LocationPicker.tsx` | **Portada** a Leaflet |

### El selector de pin: qué se conserva y qué no

**Se conserva el contrato de interacción**, que era bueno:

- Click en el mapa coloca el pin.
- Arrastrar el pin lo ajusta.

**Se descarta el motor.** El original usaba Google Maps, y sin
`VITE_GOOGLE_MAPS_API_KEY` **no hacía nada**: renderizaba un cartel
diciendo "Configura Google Maps". Es decir, el pin —que es
obligatorio para publicar (RF-2.4)— era inalcanzable sin una clave de
pago.

Ahora es `frontend/src/components/mapa/SelectorPin.tsx`, con Leaflet y
teselas de OpenStreetMap. Cero claves, cero costo por uso.

### La Policy: el original no servía

```php
public function viewAny(User $user): bool { return false; }
public function view(User $user, Listing $listing): bool { return false; }
public function create(User $user): bool { return false; }
```

Es el stub que genera Breeze: todo en `false` salvo `update` y
`delete`, que comprueban `$user->is($listing->user)`.

`PropertyPolicy` hace todo eso **y además** distingue dueño de admin,
comprueba el rol para publicar, y exige el correo confirmado (RF-1.3).
No hay nada que traer: hay todo que rehacer.

## Lo que se descarta, y por qué

| Pieza | Por qué |
| --- | --- |
| `src/server/*` (Elysia) | Otro framework entero. El proyecto es Laravel; mantener dos servidores es mantener dos bases de datos. |
| `src/server/database.ts` | **SQLite**. No hay `ST_Distance_Sphere`, ni índices espaciales, ni columnas `POINT`. El mapa abriría vacío sin error. |
| `bun.lock`, `.npmrc` | Bun no se usa. |
| `dist/` commiteado | Build generado, 268 archivos de ruido. Se construye en CI. |
| `resources/views/**` (Blade) | La API es sin sesión y el frontend es React. Las vistas Blade de Breeze no tienen a dónde vivir. |
| `src/client/api.ts` | Usa `credentials: "include"` — cookies de sesión. Nuestra API usa `Authorization: Bearer`. **No es intercambiable**: cambiarlo no es adaptar, es reescribir. |
| `app/Models/Listing` y `Profile` | El modelo es `Property`, con la columna `POINT SRID 4326` y la máquina de estados de RF-2.6. `Listing` no tiene nada de eso. |

## La migración rota — no la arregles si la copias

`2026_09_06_043535_add_photos_to_listings_and_replies_to_interests.php`
anida `Schema::table()` dentro de `Schema::table()`:

```php
Schema::table('interests', function (Blueprint $table) {
    Schema::table('listings', function (Blueprint $table) {   // dentro de interests
        $table->json('photos')->nullable();
    });
    Schema::table('interests', function (Blueprint $table) {  // interests dentro de interests
        $table->text('reply')->nullable();
    });
});
```

No es un bug de estilo: **no funciona**. Y el `down()` repite el
patrón, así que tampoco se puede deshacer.

Está en la rama archivada y no se corrige porque no se usa. Si alguien
porta fotos (RF-2.3), la migración se escribe **de cero**, no se copia
esta.

## Criterios del issue, verificados

| Criterio | Cómo se comprueba |
| --- | --- |
| Lista de lo portado documentada | Este archivo |
| Nada de código Elysia/SQLite en `main` | Abajo |
| Mapa con Leaflet, sin claves de pago | `SelectorPin.tsx` + `iconos.ts`, teselas de OSM |

### Cómo volver a comprobarlo

```bash
git grep -rilE 'elysia|bun\.lock' -- . ':!*.md'   # sin resultados
git grep -ilE 'GOOGLE_MAPS|google\.maps' -- . ':!*.md'   # sin resultados
php artisan test src/Platform    # el default NO es sqlite
```

`git grep` sobre `main`, no sobre la rama de trabajo: la idea es
comprobar lo que está fusionado.

La tercera es la que más importa y la que más fácil se pasa por alto.
El `config/database.php` traía `env('DB_CONNECTION', 'sqlite')` del
esqueleto de Laravel, y `.env.example` sí pone `mysql`. Con eso
parecía hecho, y en un despliegue al que le faltara la variable
**todo arrancaba bien y el mapa abría vacío**.

Es el mismo patrón que las tres trampas de
[mysql-geoespacial.md](mysql-geoespacial.md): algo que parece
funcionar y falla sin avisar. Por eso ahora hay una prueba que lo
afirma, en vez de una nota que lo menciona.
