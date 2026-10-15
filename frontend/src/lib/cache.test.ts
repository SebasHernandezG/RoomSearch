import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_ANTIGUEDAD_MS,
  avisoCache,
  borrarCache,
  guardarCache,
  leerCache,
  sinConexion,
} from './cache';
import type { Property } from '../types/property';

/**
 * El quinto estado de DS-4: sin conexion, con cache.
 *
 * El criterio del issue es "la app sigue funcionando con cache". Eso
 * tiene dos mitades y las dos estan probadas: que lo cacheado se
 * recupere cuando sirve, y que **no** se sirva cuando ya no sirve.
 * La segunda es la que se olvida y es la que hace que alguien vea un
 * inmueble que se quito hace tres dias.
 */

const INMUEBLE = {
  id: 1,
  title: 'Apartamento en Ciudad Quesada',
  description: null,
  district: 'Ciudad Quesada',
  neighborhood: null,
  type: 'apartamento',
  monthly_rent: 250_000,
  currency: 'CRC',
  deposit: null,
  bedrooms: 2,
  bathrooms: 1,
  parking_spaces: 0,
  furnished: false,
  pets_allowed: false,
  status: 'activa',
  includes_water: true,
  includes_electricity: false,
  includes_internet: true,
  available_from: null,
  rules: null,
  address_reference: null,
  latitude: 10.3,
  longitude: -84.4,
  show_exact_location: true,
  landlord_verified: false,
  is_favorite: false,
  images: [],
  created_at: null,
} as Property;

function ponerEnLinea(valor: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: valor });
}

beforeEach(() => {
  localStorage.clear();

  ponerEnLinea(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sinConexion', () => {
  it('detecta que no hay red', () => {
    ponerEnLinea(false);

    expect(sinConexion()).toBe(true);
  });

  it('con red no dice que no hay', () => {
    ponerEnLinea(true);

    expect(sinConexion()).toBe(false);
  });

  /**
   * `navigator.onLine` no es un diagnostico: `true` no garantiza que
   * la peticion pase (WiFi de hotel sin salida). Por eso se usa
   * ademas del error, nunca en lugar de el.
   */
  it('con red declarada NO decide que la peticion va a pasar', () => {
    ponerEnLinea(true);

    expect(sinConexion()).toBe(false);
  });
});

describe('el cache', () => {
  it('guarda y devuelve lo mismo', () => {
    guardarCache(1, [INMUEBLE]);

    const cache = leerCache();

    expect(cache?.total).toBe(1);
    expect(cache?.data[0]?.id).toBe(1);
  });

  it('no hay cache al empezar', () => {
    expect(leerCache()).toBeNull();
  });

  it('se borra', () => {
    guardarCache(1, [INMUEBLE]);
    borrarCache();

    expect(leerCache()).toBeNull();
  });

  /**
   * Un dia es el limite.
   *
   * Pasado eso, la lista es de un mundo en el que el inmueble que se
   * acaba de quitar ya no esta, y alguien llama por uno que no existe
   * hace tres dias.
   */
  it('descarta el cache de mas de un dia', () => {
    localStorage.setItem(
      'roomies.cache.busqueda',
      JSON.stringify({
        momento: Date.now() - (MAX_ANTIGUEDAD_MS + 1000),
        total: 1,
        data: [INMUEBLE],
      }),
    );

    expect(leerCache()).toBeNull();
  });

  it('conserva el cache de hace una hora', () => {
    localStorage.setItem(
      'roomies.cache.busqueda',
      JSON.stringify({
        momento: Date.now() - 3_600_000,
        total: 1,
        data: [INMUEBLE],
      }),
    );

    expect(leerCache()).not.toBeNull();
  });

  /**
   * JSON corrupto no puede romper la pantalla.
   *
   * Se descarta solo: el peor caso de un parseo fallido es perder el
   * cache, y el peor caso de propagarlo es una pantalla en blanco
   * justo cuando no hay red -- que es cuando mas hace falta.
   */
  it('descarta un cache corrupto sin lanzar', () => {
    localStorage.setItem('roomies.cache.busqueda', '{esto no es json');

    expect(() => leerCache()).not.toThrow();
    expect(leerCache()).toBeNull();
  });

  it('descarta un cache con la forma equivocada', () => {
    localStorage.setItem(
      'roomies.cache.busqueda',
      JSON.stringify({ momento: Date.now(), total: 'muchos', data: 'nada' }),
    );

    expect(leerCache()).toBeNull();
  });

  /** Cuota llena o pestana privada. */
  it('no rompe cuando el almacenamiento falla', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota llena', 'QuotaExceededError');
    });

    expect(() => guardarCache(1, [INMUEBLE])).not.toThrow();
  });

  it('no rompe cuando leer el almacenamiento falla', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denegado', 'SecurityError');
    });

    expect(() => leerCache()).not.toThrow();
    expect(leerCache()).toBeNull();
  });
});

describe('avisoCache', () => {
  /**
   * El tono importa: la app **funciona**, no esta rota. "No pudimos
   * cargar" con una lista de resultados debajo se contradice a si
   * mismo.
   */
  it('dice que se sigue funcionando', () => {
    const texto = avisoCache(12);

    expect(texto).toContain('Sin conexión');
    expect(texto).toContain('12 inmuebles');
    expect(texto.toLowerCase()).not.toContain('no pudimos');
  });

  it('usa singular cuando hay uno', () => {
    expect(avisoCache(1)).toContain('1 inmueble ');
  });
});
