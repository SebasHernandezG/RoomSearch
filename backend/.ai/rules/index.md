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
| [mapa-frontend.md](mapa-frontend.md) | `frontend/src/components/mapa/**`, `frontend/src/components/PantallaBusqueda.tsx` | Los bucles entre mapa, zona y peticiones, y el tamaño del contenedor en Leaflet |
| [vitest.md](vitest.md) | `frontend/**/*.test.ts`, `frontend/vite.config.js` | El runner del frontend, dónde viven las pruebas y qué no se prueba con DOM |

## Búsqueda rápida

Si no sabés en qué archivo está lo que buscás:

```bash
grep -rin 'geometria\|spatial\|srid' .ai/rules
grep -rin 'throttle\|rate' .ai/rules
grep -rin 'invalidate\|leaflet\|zoom' .ai/rules
```

## Lo que estas reglas NO cubren

- **El formulario de publicación (DS-8).** RF-2.1 ya publica por API,
  pero en el frontend no hay pantalla: quien llega a `/api/properties`
  desde el navegador lo que encuentra es un 401.
- **La moderación es solo dos rutas.** `approve` y `reject` funcionan y
  tienen pruebas, pero no hay panel, ni cola, ni registro de quién
  aprobó qué (RF-7.4).
- Perfiles de arrendador e inquilino: llegan con RF-1.5. Cuando
  existan, agregar `profiles.md`.
- Verificación de correo y recuperación de contraseña: llegan con
  RF-1.3.
- **React Testing Library.** Vitest corre, pero solo se prueba lógica
  suelta: no hay forma de montar un componente todavía. Ver
  [vitest.md](vitest.md).
