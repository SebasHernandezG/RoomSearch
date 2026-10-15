/**
 * Lo que necesita toda prueba de componente. DS-10.
 *
 * ## Por que hay un archivo de setup y no un import por prueba
 *
 * `jest-dom` agrega matchers (`toBeInTheDocument`, `toHaveFocus`) que
 * no existen en Vitest, y `testing-library` limpia el DOM entre
 * pruebas. Importarlos en cada archivo es trabajo que se puede
 * equivocar: una prueba sin el import pasa con `toBeInTheDocument`
 * como una funcion cualquiera y falla con un error que no señala el
 * archivo.
 *
 * ## Sin `jest-axe`
 *
 * axe corre directo: `axe.run(document.body)` con el `axe-core` a
 * pelo. El paquete `jest-axe` solo anade una capa sobre lo mismo y su
 * API de matchers duplica lo que `expect` ya hace.
 */

import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

/*
 * jsdom no implementa `matchMedia`, y lo consulta
 * `SelectorRadio` y la hoja de filtros para decidir si hay que
 * respecting la preferencia de menos animacion.
 *
 * Sin esto, la llamada revienta y la prueba muere por una razon que
 * no tiene nada que ver con lo que esta probando.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (consulta: string) => ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
