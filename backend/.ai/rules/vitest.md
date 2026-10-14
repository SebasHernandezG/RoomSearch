# Vitest en el frontend

Aplica a: `frontend/package.json`, `frontend/vite.config.js`,
`frontend/src/**/*.test.ts`.

El frontend tiene runner de pruebas. Antes no lo tenia, y el bucle de
779 peticiones lo cazó una persona leyendo el log del servidor
([mapa-frontend.md](mapa-frontend.md)).

## Correrlas

```powershell
cd frontend
npm run test          # una vez
npm run test:watch    # mientras escribis
```

CI las corre antes de ESLint: si hay una prueba rota, no vale la pena
quejarse del formato.

## Dónde viven

Junto al código, con sufijo `.test.ts`, igual que en el backend, donde
las pruebas van dentro del módulo (`src/Properties/Tests/Feature/`).

```
src/components/PantallaBusqueda.test.ts
src/components/mapa/PropertyMap.test.ts
src/lib/format.test.ts
src/lib/api.test.ts
```

No hay carpeta `tests/`. Para encontrar una prueba se busca el nombre de
la función en `src`.

## Exportá lo que quieras probar

Una función que nadie importa no se puede probar. Exportarla no cambia
el comportamiento ni ensucia la API de un componente: es lo mismo que
en el backend, donde las reglas de dominio viven en el módulo para
poder probarlas sin pasar por HTTP.

Lo exportado hasta ahora por eso:

| Exportada | Dónde | Por qué |
| --- | --- | --- |
| `sonLaMismaZona` | `PantallaBusqueda.tsx` | Fija la tolerancia de 50 m |
| `ajustarVista` | `mapa/PropertyMap.tsx` | Fija el guardia anti-bucle |
| `ajustesEnCurso` | `mapa/PropertyMap.tsx` | Para poder preguntar si un mapa está marcado |

## `pool: 'threads'` y no el de por defecto

La config fija `pool: 'threads'`. Con el pool por defecto (`forks`), el
worker no levanta y la corrida muere con:

```
[vitest-pool]: Failed to start forks worker for test files ...
Timeout waiting for worker to respond
```

Pasa cuando el repo está dentro de OneDrive: el proceso hijo no logra
arrancar desde una ruta sincronizada. En Linux (CI) los dos funcionan;
este es el que funciona en la máquina de desarrollo.

Si algún día `threads` deja de funcionar, el arreglo **no** es quitar
el pool: es probar `forks` primero, porque el síntoma se parece mucho
a "las pruebas están rotas" y no lo están.

## `globals: false`

Hay que importar `describe`, `it`, `expect` de `vitest`. No es estilo:
con los globales activados, un `expect` sin usar pasa en verde, y una
prueba que no afirma nada se ve en el conteo.

## Lo que NO se prueba con DOM

`PropertyMap.test.ts` usa mapas de mentira, no Leaflet de verdad.

En jsdom, Leaflet depende de medidas de capas que no existen, y
domarlas es un problema más grande que el que se quiere probar. Si
alguna vez hace falta probar algo que sí depende del Leaflet real,
ese caso pide `@vitest/browser-playwright`, no un `vi.mock` más grande.

## Qué falta probar

- **React Testing Library.** No está instalado. Sin él no hay forma de
  probar un componente: hoy solo se prueba lógica suelta.
- **`PantallaBusqueda` montada.** Es la que coordina mapa, zona y
  peticiones. Ahí es donde vive el bucle de verdad, y probarla
  montada requiere RTL.
- **Accesibilidad.** RNF-11 y DS-10 quedan sin red de seguridad.
