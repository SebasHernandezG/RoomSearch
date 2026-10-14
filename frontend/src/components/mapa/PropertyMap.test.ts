import { afterEach, describe, expect, it, vi } from 'vitest';
import type L from 'leaflet';

import { ajustesEnCurso, ajustarVista } from './PropertyMap';

/**
 * El guardia que impide el bucle de `fitBounds`. RF-3.3 y RF-3.5.
 *
 * La otra mitad del problema esta en `sonLaMismaZona`, probada en
 * PantallaBusqueda.test.ts. Ver `.ai/rules/mapa-frontend.md`.
 */

/**
 * Mapa de mentira.
 *
 * No se usa Leaflet de verdad porque `ajustarVista` solo necesita dos
 * cosas: que `fitBounds` reciba los limites del circulo, y que se
 * pueda preguntar si el mapa esta marcado. Levantar un Leaflet real en
 * jsdom exigiria domar sus medidas de capas, que es justo el problema
 * que el ResizeObserver del componente resuelve.
 */
function mapaFalso() {
  return {
    fitBounds: vi.fn(),
  } as unknown as L.Map & { fitBounds: ReturnType<typeof vi.fn> };
}

/**
 * Circulo de mentira: a `ajustarVista` solo le interesa que
 * `getBounds()` responda.
 */
function circuloFalso() {
  const limites = [
    [10.2, -84.5],
    [10.4, -84.3],
  ] as [[number, number], [number, number]];

  return {
    getBounds: () => limites,
  } as unknown as L.Circle;
}

describe('ajustarVista', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('encuadra los limites del circulo con el margen del componente', () => {
    const mapa = mapaFalso();
    const circulo = circuloFalso();

    ajustarVista(mapa, circulo);

    expect(mapa.fitBounds).toHaveBeenCalledExactlyOnceWith(
      (circulo as unknown as { getBounds: () => unknown }).getBounds(),
      { padding: [40, 40], animate: false },
    );
  });

  /**
   * `animate: false` no es cosmetico: con animacion, Leaflet dispara
   * `moveend` mas tarde, cuando el temporal del guardia ya se levanto,
   * y el guardia no protege nada.
   *
   * Se mira solo esa clave y no el segundo argumento entero, porque la
   * prueba de arriba ya fija el `padding` y comparar el objeto entero
   * dos veces no anade nada.
   */
  it('no anima, para que el moveend llegue antes de levantar el guardia', () => {
    const mapa = mapaFalso();

    ajustarVista(mapa, circuloFalso());

    expect(mapa.fitBounds.mock.calls[0]?.[1]).toMatchObject({ animate: false });
  });

  it('marca el mapa como "en ajuste" mientras encuadra', () => {
    const mapa = mapaFalso();

    ajustarVista(mapa, circuloFalso());

    expect(ajustesEnCurso.has(mapa)).toBe(true);
  });

  /**
   * El caso del que habla la regla: si el circulo ya cabia,
   * `fitBounds` no mueve nada y no llega ningun `moveend` que limpiar
   * el guardia. Sin el temporal, el mapa quedaria marcado para
   * siempre y se tragaria el siguiente movimiento real de la persona.
   */
  it('levanta el guardia en el siguiente turno aunque no llegue ningun moveend', () => {
    vi.useFakeTimers();

    const mapa = mapaFalso();

    ajustarVista(mapa, circuloFalso());

    expect(ajustesEnCurso.has(mapa)).toBe(true);

    vi.runAllTimers();

    expect(ajustesEnCurso.has(mapa)).toBe(false);
  });

  /**
   * El guardia no se levanta antes de tiempo: mientras dura, un
   * `moveend` de verdad se ignora.
   */
  it('aguanta hasta que pasa el turno, no solo hasta que termina fitBounds', () => {
    vi.useFakeTimers();

    const mapa = mapaFalso();

    ajustarVista(mapa, circuloFalso());

    // Sincrono, todavia dentro del mismo turno.
    expect(ajustesEnCurso.has(mapa)).toBe(true);

    vi.advanceTimersByTime(0);

    expect(ajustesEnCurso.has(mapa)).toBe(false);
  });

  /**
   * Dos ajustes seguidos sobre el mismo mapa: el segundo vuelve a
   * marcar, y el temporal del primero lo levanta. Importa que no se
   * traguen entre si.
   */
  it('aguanta dos ajustes seguidos sobre el mismo mapa', () => {
    vi.useFakeTimers();

    const mapa = mapaFalso();

    ajustarVista(mapa, circuloFalso());
    ajustarVista(mapa, circuloFalso());

    expect(mapa.fitBounds).toHaveBeenCalledTimes(2);

    vi.runAllTimers();

    expect(ajustesEnCurso.has(mapa)).toBe(false);
  });

  /**
   * Dos mapas a la vez no se pisan: el guardia es por mapa, no global.
   *
   * Por eso es un `WeakSet` de instancias y no un booleano. Con un
   * booleano, encuadrar el mapa de una lista hidden mientras el otro
   * esta en ajuste dejaria al segundo marcado y sin poder recibir el
   * movimiento de la persona.
   */
  it('marca cada mapa por separado', () => {
    vi.useFakeTimers();

    const primero = mapaFalso();
    const segundo = mapaFalso();

    ajustarVista(primero, circuloFalso());

    expect(ajustesEnCurso.has(primero)).toBe(true);
    expect(ajustesEnCurso.has(segundo)).toBe(false);

    vi.runAllTimers();
  });
});
