import { describe, expect, it } from 'vitest';

import {
  DURACION_AVISO,
  agregar,
  announcedPoliteness,
  quitar,
  seDescarta,
  type Aviso,
} from './avisos';

/**
 * Los avisos. DS-11.
 *
 * Lo que se prueba aqui es la regla que no se ve leyendo el JSX: que
 * un error **no** se descarta solo.
 */

function aviso(extra: Partial<Aviso> = {}): Aviso {
  return { id: 1, texto: 'Guardado', tono: 'exito', persiste: false, ...extra };
}

describe('seDescarta', () => {
  it('un exito se va solo', () => {
    expect(seDescarta(aviso({ tono: 'exito' }))).toBe(true);
  });

  it('una info se va sola', () => {
    expect(seDescarta(aviso({ tono: 'info' }))).toBe(true);
  });

  /**
   * La regla de DS-11, y la mas importante de este archivo.
   *
   * Un error que desaparece a los cuatro segundos y no se ha leido es
   * un error que no existio: la persona se queda pensando que si
   * funciono y repite la accion.
   */
  it('un error NO se descarta solo', () => {
    expect(seDescarta(aviso({ tono: 'error' }))).toBe(false);
  });

  /**
   * `persiste` manda sobre el tono. Un exito marcado como persistente
   * se queda, y un "volvemos a intentar" no se va a medio camino.
   */
  it('persiste manda sobre el tono', () => {
    expect(seDescarta(aviso({ tono: 'exito', persiste: true }))).toBe(false);
  });
});

describe('DURACION_AVISO', () => {
  /**
   * Cuatro segundos, que es lo que dice DS-11. Menos y no alcanza a
   * leerse un aviso de una linea larga; mas y se convierte en una capa
   * encima de la pantalla.
   */
  it('es de 4 segundos', () => {
    expect(DURACION_AVISO).toBe(4000);
  });
});

describe('agregar y quitar', () => {
  it('agrega al final', () => {
    const lista = agregar([aviso({ id: 1 })], aviso({ id: 2 }));

    expect(lista.map((a) => a.id)).toEqual([1, 2]);
  });

  /**
   * La lista se devuelve nueva en vez de mutarse: un aviso que se
   * quita tiene que re-renderizar, y `push`/`splice` sobre el estado
   * no lo hacen.
   */
  it('no muta el original', () => {
    const original = [aviso({ id: 1 })];

    agregar(original, aviso({ id: 2 }));

    expect(original).toHaveLength(1);
  });

  it('quita por id', () => {
    expect(quitar([aviso({ id: 1 }), aviso({ id: 2 })], 1).map((a) => a.id)).toEqual([2]);
  });

  it('quitar un id que no esta no rompe nada', () => {
    expect(quitar([aviso({ id: 1 })], 99)).toHaveLength(1);
  });

  it('quitar de una lista vacia no rompe nada', () => {
    expect(quitar([], 1)).toEqual([]);
  });
});

describe('announcedPoliteness', () => {
  /**
   * `assertive` interrumpe lo que el lector estaba leyendo. Solo el
   * error lo amerita: un "guardado" que corta a media frase de una
   * descripcion es peor que uno que se oye medio segundo despues.
   */
  it('el error es assertive', () => {
    expect(announcedPoliteness(aviso({ tono: 'error' }))).toBe('assertive');
  });

  it('el exito y la info son polite', () => {
    expect(announcedPoliteness(aviso({ tono: 'exito' }))).toBe('polite');
    expect(announcedPoliteness(aviso({ tono: 'info' }))).toBe('polite');
  });
});
