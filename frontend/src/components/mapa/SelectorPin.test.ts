import { describe, expect, it, vi } from 'vitest';
import type L from 'leaflet';

import { eventoALatLng } from './SelectorPin';

/**
 * El selector de pin. RF-2.4.
 *
 * El componente entero necesita un Leaflet de verdad, y en jsdom eso
 * es un problema mas grande que el que se quiere probar. Lo unico con
 * ramas de verdad aqui es el **recorte del click**, que se prueba con
 * un mapa de mentira, igual que `PropertyMap.test.ts` hace con Leaflet.
 *
 * Ver `.ai/rules/port-produccion.md`.
 */

/**
 * Mapa de mentira con las dos unicas cosas que usa `eventoALatLng`.
 *
 * Se anota a mano donde va el click para poder comprobar que se
 * convierte con el desplazamiento de la caja, que es justo donde
 * estan los errores.
 */
function mapaFalso(caja = { left: 100, top: 50, width: 400, height: 300 }) {
  const containerPointToLatLng = vi.fn((punto: { x: number; y: number }) => ({
    lat: 10 - punto.y / 1000,
    lng: -84 - punto.x / 1000,
  }));

  const instancia = {
    getContainer: () => ({
      getBoundingClientRect: () => ({
        left: caja.left,
        top: caja.top,
        width: caja.width,
        height: caja.height,
        right: caja.left + caja.width,
        bottom: caja.top + caja.height,
      }),
    }),
    containerPointToLatLng,
  } as unknown as L.Map & { containerPointToLatLng: typeof containerPointToLatLng };

  return instancia;
}

function click(clientX: number, clientY: number): MouseEvent {
  return { clientX, clientY } as MouseEvent;
}

describe('eventoALatLng', () => {
  it('convierte un click dentro del mapa', () => {
    const mapa = mapaFalso();

    const punto = eventoALatLng(mapa, click(300, 200));

    expect(punto).not.toBeNull();
  });

  /**
   * El desplazamiento de la caja es donde se cuelan los errores: sin
   * restarlo, la esquina superior izquierda del mapa devolveria el
   * punto equivocado y el pin caeria fuera de San Carlos.
   */
  it('desplaza el click con la posicion de la caja', () => {
    const mapa = mapaFalso({ left: 100, top: 50, width: 400, height: 300 });

    eventoALatLng(mapa, click(300, 200));

    // (300 - 100, 200 - 50) = (200, 150)
    expect(mapa.containerPointToLatLng).toHaveBeenCalledWith(
      expect.objectContaining({ x: 200, y: 150 }),
    );
  });

  it('acepta las cuatro esquinas exactas del mapa', () => {
    const caja = { left: 0, top: 0, width: 400, height: 300 };
    const mapa = mapaFalso(caja);

    expect(eventoALatLng(mapa, click(0, 0))).not.toBeNull();
    expect(eventoALatLng(mapa, click(400, 0))).not.toBeNull();
    expect(eventoALatLng(mapa, click(0, 300))).not.toBeNull();
    expect(eventoALatLng(mapa, click(400, 300))).not.toBeNull();
  });

  /**
   * El caso que motiva el recorte: en un celular, un dedo que arrastro
   * un poco y solto sobre el mapa genera un click con coordenadas por
   * fuera. Sin esto, el pin se va a cientos de kilometras y la persona
   * no entiende que paso.
   */
  describe('un click fuera del mapa', () => {
    it('descarta el que se sale por la izquierda', () => {
      const mapa = mapaFalso();

      expect(eventoALatLng(mapa, click(99, 200))).toBeNull();
    });

    it('descarta el que se sale por arriba', () => {
      const mapa = mapaFalso();

      expect(eventoALatLng(mapa, click(300, 49))).toBeNull();
    });

    it('descarta el que se sale por la derecha', () => {
      const mapa = mapaFalso();

      expect(eventoALatLng(mapa, click(501, 200))).toBeNull();
    });

    it('descarta el que se sale por abajo', () => {
      const mapa = mapaFalso();

      expect(eventoALatLng(mapa, click(300, 351))).toBeNull();
    });

    it('no llama al mapa cuando el click esta fuera', () => {
      const mapa = mapaFalso();

      eventoALatLng(mapa, click(9999, 9999));

      expect(mapa.containerPointToLatLng).not.toHaveBeenCalled();
    });
  });
});
