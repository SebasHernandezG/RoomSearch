/**
 * El chequeo de accesibilidad. DS-10.
 *
 * ## Que reglas corren y cuales no, y por que
 *
 * Corre **todo axe-core** sobre el componente renderizado. Es la
 * decision que mas conviene: el conjunto de reglas por defecto
 * cubre WCAG 2.0 A y AA, que es lo que el issue pide, y nadie tiene
 * que acordarse de ir agregando reglas a una lista.
 *
 * Lo que **no** hace axe y esta lista de aqui:
 *
 * | Lo que falta | Por que no lo cubre axe |
 * | --- | --- |
 * | Area tactil de 44x44 px | Es geometria: axe no mide cajas |
 * | El anillo de foco de 3 px | Verifica que hay foco, no cuanto mide |
 * | El mapa no es navegable por teclado | El mapa es canvas y divs de Leaflet |
 *
 * Los tres estan probados donde toca: `areaTactil.test.ts`,
 * `foco.test.ts` y `mapa-accesible.test.ts`. axe hace la parte
 * general; esos tres cubren lo que el mapa no ve.
 */

import axe from 'axe-core';

/**
 * Los fallos de accesibilidad de un elemento.
 *
 * Devuelve la lista en vez de lanzar: una prueba que falla con un
 * array de objetos queda claro en la salida del runner, mientras que
 * un `throw` desde adentro de un helper muchas veces solo dice
 * "expected undefined to be []".
 */
export async function fallosDeAccesibilidad(nodo: Element = document.body) {
  const resultados = await axe.run(nodo, {
    /*
     * Los dos que se apagan a proposito.
     *
     * `region`: todos los componentes deben estar dentro de un
     * landmark para que un lector de pantalla pueda saltarlos. En
     * pruebas se renderiza un componente suelto, sin la pagina
     * alrededor, asi que fallaria siempre y no por un problema real.
     * El landmark se prueba en la pantalla entera, en
     * `pantallas.test.tsx`.
     *
     * `color-contrast`: jsdom no calcula contraste --no hay
     * motor de layout-- asi que axe lo evalua como "no verificable" y
     * lo reporta como fallo aunque este bien. El contraste real se
     * verifica sobre los tokens, en `contraste.test.ts`.
     */
    rules: {
      region: { enabled: false },
      'color-contrast': { enabled: false },
    },
  });

  return resultados.violations;
}

/** Los ids de las reglas que fallaron, para el mensaje del test. */
export function resumen(violaciones: axe.Result[]): string {
  if (violaciones.length === 0) return 'sin fallos';

  return violaciones.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`).join('; ');
}
