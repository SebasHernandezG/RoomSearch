# Reglas del proyecto

Este directorio es la memoria del proyecto. Lo que está aquí son
decisiones ya tomadas y trampas ya pisadas. **Antes de escribir código,
buscá la regla que aplique al archivo que vas a tocar.**

Las reglas no son sugerencias de estilo: son cosas que costaron
tiempo descubrir y que se vuelven a perder si no quedan escritas.

## Por qué existe

Hay tres tipos de regla acá:

1. **Decisiones tomadas** que no se deducen leyendo el código.
2. **Trampas** que fallan en silencio y no avisan.
3. **Convenciones** que hay que seguir para no abrir dos caminos.

Si algo de lo que escribiste no está en ninguna regla y te costó
tiempo descubrirlo, agregalo. Si encontraste una regla que ya no
aplica, borrala o marcala como obsoleta: una regla vieja es peor que
ninguna, porque se sigue creyendo.

## Índice

| Archivo | Aplica a | De qué trata |
| --- | --- | --- |
| [mysql-geoespacial.md](mysql-geoespacial.md) | `src/Properties/**`, migraciones de `properties` | Las tres trampas de MySQL 8.4 que hacen fallar la búsqueda por radio en silencio |
| [modulos.md](modulos.md) | `src/**` | Cómo está partido el monolito modular y qué va en cada módulo |
| [api.md](api.md) | `routes/api.php`, `app/Http/**` | Convenciones de la API: validación, Resources, rate limiting |
| [auth.md](auth.md) | `routes/api.php`, `src/Identity/**`, `src/Properties/Models/PropertyPolicy.php`, `app/Http/Middleware/**`, `lang/**` | Tokens, roles, Policies, límites de intentos y los 422 en español |
| [pruebas.md](pruebas.md) | `**/*Test.php`, `database/factories/**` | Las trampas de las fábricas y de `RefreshDatabase` que hacen que una prueba pase midiendo lo contrario |
| [mapa-frontend.md](mapa-frontend.md) | `frontend/src/components/mapa/**`, `frontend/src/components/PantallaBusqueda.tsx` | Los bucles entre mapa, zona y peticiones, y el tamaño del contenedor en Leaflet |
| [port-produccion.md](port-produccion.md) | `frontend/src/components/mapa/SelectorPin.tsx`, `config/database.php` | Qué se trajo de la rama `Producción`, qué se descartó y por qué |
| [vitest.md](vitest.md) | `frontend/**/*.test.ts`, `frontend/vite.config.js` | El runner del frontend, dónde viven las pruebas y qué no se prueba con DOM |

## Búsqueda rápida

Si no sabés en qué archivo está lo que buscás:

```bash
grep -rin 'geometria\|spatial\|srid' .ai/rules
grep -rin 'throttle\|rate' .ai/rules
grep -rin 'invalidate\|leaflet\|zoom' .ai/rules
grep -rin 'factory\|RefreshDatabase\|casts' .ai/rules
```

## Lo que estas reglas NO cubren

Lo que sigue está pendiente. Si algo de esta lista ya se hizo y la
lista no se actualizó, **esa lista es el bug**: una regla vieja es
peor que ninguna, porque se sigue creyendo.

- **Compresión de imágenes (RF-2.3).** La galería sube, elige
  principal y borra, pero los archivos se guardan tal cual. El issue la
  pide y es trabajo real: GD o un servicio aparte, más una cola para no
  bloquear la petición.
- **Registro de quién aprobó qué (RF-7.4).** El panel de moderación
  funciona y decide, pero no queda rastro de quién tomó la decisión.
- **"Me interesa" no tiene a quién avisar (RF-5.1).** No hay endpoint
  de contacto ni de favoritos: `routes/api.php` no pasa de moderación.
  El botón alterna estado local y lo dice en un aviso.
- **Perfil del inquilino (RF-1.6).** El del arrendador existe; el del
  inquilino no.
- **La compresión y el registro de moderación** son los dos huecos
  reales del backend actual.
