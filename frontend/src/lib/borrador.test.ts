import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_ANTIGUEDAD_DIAS,
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
  tieneContenido,
} from './borrador';
import { DATOS_VACIOS } from '../components/publicar/datos';

/**
 * El autoguardado del formulario. DS-8.
 *
 * El criterio del issue es "el borrador sobrevive a recarga y cierre
 * de navegador", y eso es exactamente lo que se prueba aqui.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ALGO_ESCRITO = { ...DATOS_VACIOS, title: 'Apartamento con terraza', monthly_rent: 280000 };

describe('el borrador', () => {
  it('se guarda y se lee con los mismos datos', () => {
    guardarBorrador(2, ALGO_ESCRITO);

    const borrador = leerBorrador();

    expect(borrador).not.toBeNull();
    expect(borrador?.datos.title).toBe('Apartamento con terraza');
    expect(borrador?.paso).toBe(2);
  });

  /**
   * El paso guardado es lo que hace que al volver aparezca donde se
   * dejo, y no siempre en el primero.
   */
  it('recuerda en que paso se estaba', () => {
    guardarBorrador(4, ALGO_ESCRITO);

    expect(leerBorrador()?.paso).toBe(4);
  });

  it('no hay borrador al empezar', () => {
    expect(leerBorrador()).toBeNull();
  });

  it('se borra', () => {
    guardarBorrador(1, ALGO_ESCRITO);
    borrarBorrador();

    expect(leerBorrador()).toBeNull();
  });

  /**
   * Un JSON corrupto no puede romper la pantalla de publicacion.
   *
   * Se descarta solo en vez de propagar el error: el peor caso de un
   * parseo fallido es perder el autoguardado, y el peor caso de
   * propagarlo es una pantalla en blanco.
   */
  it('descarta un borrador corrupto sin lanzar', () => {
    localStorage.setItem('roomies.borrador', '{esto no es json');

    expect(() => leerBorrador()).not.toThrow();
    expect(leerBorrador()).toBeNull();
  });

  /**
   * Los pasos habrian cambiado si la version del formulario cambio.
   * Intentar migrarlo llenaria campos que ya no existen.
   */
  it('descarta un borrador de otra version del formulario', () => {
    localStorage.setItem(
      'roomies.borrador',
      JSON.stringify({ version: 99, paso: 1, datos: ALGO_ESCRITO, momento: Date.now() }),
    );

    expect(leerBorrador()).toBeNull();
  });

  /**
   * Un borrador de hace dos meses es de otra versión del formulario,
   * aunque el numero diga lo mismo. Preguntar por el parece que la
   * aplicacion perdio el trabajo de la persona.
   */
  it('descarta un borrador mas viejo que un mes', () => {
    const haceMucho = Date.now() - (MAX_ANTIGUEDAD_DIAS + 1) * 86_400_000;

    localStorage.setItem(
      'roomies.borrador',
      JSON.stringify({ version: 1, paso: 1, datos: ALGO_ESCRITO, momento: haceMucho }),
    );

    expect(leerBorrador()).toBeNull();
  });

  it('conserva un borrador de ayer', () => {
    const ayer = Date.now() - 86_400_000;

    localStorage.setItem(
      'roomies.borrador',
      JSON.stringify({ version: 1, paso: 1, datos: ALGO_ESCRITO, momento: ayer }),
    );

    expect(leerBorrador()).not.toBeNull();
  });

  /**
   * Cuota llena o pestana privada. Perder el autoguardado es malo,
   * pero romper el formulario es peor: se sigue llenando y se manda.
   */
  it('no rompe cuando el almacenamiento falla', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota llena', 'QuotaExceededError');
    });

    expect(() => guardarBorrador(1, ALGO_ESCRITO)).not.toThrow();

    setItem.mockRestore();
  });

  it('no rompe cuando leer el almacenamiento falla', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denegado', 'SecurityError');
    });

    expect(() => leerBorrador()).not.toThrow();
    expect(leerBorrador()).toBeNull();
  });
});

describe('tieneContenido', () => {
  /**
   * Solo con el pin no cuenta. Elegir el punto es lo primero que hace
   * todo el mundo, y preguntar "¿seguimos?" por eso seria molesto.
   */
  it('no cuenta el pin solo', () => {
    expect(tieneContenido({ ...DATOS_VACIOS, latitude: 10.32, longitude: -84.42 })).toBe(false);
  });

  it('tampoco cuenta la moneda o los contadores', () => {
    expect(
      tieneContenido({
        ...DATOS_VACIOS,
        currency: 'USD',
        bedrooms: 3,
        furnished: true,
        pets_allowed: true,
      }),
    ).toBe(false);
  });

  it('cuenta con un titulo', () => {
    expect(tieneContenido({ ...DATOS_VACIOS, title: 'Casa' })).toBe(true);
  });

  it('cuenta con un precio', () => {
    expect(tieneContenido({ ...DATOS_VACIOS, monthly_rent: 250_000 })).toBe(true);
  });

  /**
   * El precio cero cuenta: es un intercambio o una ayudada, y es un
   * dato muy puesto.
   */
  it('cuenta con un precio de cero', () => {
    expect(tieneContenido({ ...DATOS_VACIOS, monthly_rent: 0 })).toBe(true);
  });

  it('no cuenta con la forma vacia', () => {
    expect(tieneContenido(DATOS_VACIOS)).toBe(false);
  });
});
