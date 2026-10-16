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

Junto al código, con sufijo `.test.ts` para la lógica y `.test.tsx`
para los componentes montados, igual que en el backend, donde las
pruebas van dentro del módulo (`src/Properties/Tests/Feature/`).

```
src/components/PantallaBusqueda.test.ts
src/components/mapa/PropertyMap.test.ts
src/lib/format.test.ts
src/lib/api.test.ts
src/components/detalle/BotonWhatsApp.test.tsx
src/components/moderacion/PanelModeracion.test.tsx
```

No hay carpeta `tests/`. Para encontrar una prueba se busca el nombre de
la función o del componente en `src`.

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

## React Testing Library

Está instalado: `@testing-library/react`, `user-event`,
`@testing-library/jest-dom` y `axe-core`, todos **devDependencies**.
Ninguno llega al bundle — aparecen en el manifiesto solo si se chequea.

Con esto hay componentes montados que se prueban de verdad:
`BotonWhatsApp.test.tsx`, `PanelModeracion.test.tsx` y
`accesibilidad.test.tsx`.

### `fireEvent` y no `element.click()`

Pulsar el nodo directamente **no actualiza** el estado de React bajo
RTL:

```ts
// MAL: el manejador corre, el estado no se aplica
screen.getByRole('button', { name: /rechazar/i }).click();
expect(screen.getByRole('dialog')).toBeInTheDocument();  // falla

// BIEN
fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
```

La actualización queda fuera de `act()`, así que la prueba ve la
pantalla de antes. El síntoma es desconcertante porque el `onClick`
**sí** se ejecutó: lo que no se aplicó fue el render.

La regla corta: **siempre `fireEvent` o `userEvent`, nunca `.click()`
directo sobre el nodo.**

### Lo que axe no puede verificar

`src/test/accesibilidad.ts` desactiva dos reglas, y no por pereza:

| Regla | Por qué |
| --- | --- |
| `region` | jsdom no calcula la geometría, así que marca como "fuera de región" todo lo que no este en un landmark real |
| `color-contrast` | jsdom no renderiza: no hay píxeles, no hay contraste |

La regla que **sí** corre y que de verdad atrapa cosas: los nombres
accesibles. Un `<form>` sin etiqueta y un `<button>` sin texto son
fallos que el resto de pruebas no ven.

El contraste real lo mide `src/styles/contraste.test.ts`, leyendo
`tokens.css` con `node:fs` y calculando la ratio a mano. Es un
arreglo distinto y complementario: `tokens.css` es la única fuente de
color, y si alguien mete un `#fff` suelto, el test lo ve.
