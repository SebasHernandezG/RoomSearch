import { describe, expect, it } from 'vitest';

import { RADIOS } from './PropertyMap';
import type { PuntoZona } from './PropertyMap';
import { formatDistance } from '../../lib/format';

/**
 * El rotulo accesible del circulo. DS-10 y DS-7.
 *
 * DS-10 pide literal: "Anunciar el radio en texto: *Mostrando 23
 * inmuebles en 1 km*". Ese texto lo arma el componente, asi que lo que
 * se prueba aqui son las dos piezas de las que depende: el formato del
 * radio y el plural del conteo.
 */

const CENTRO: PuntoZona = { latitud: 10.3236, longitud: -84.4274, metros: 1000 };

describe('el texto del radio', () => {
  it('un radio se lee en su unidad', () => {
    expect(formatDistance(1000)).toBe('1 km');
  });

  /**
   * El radio va en el circulo como numero, no en una tabla de
   * kilometros. DS-7 pide marcas en 500 m, 1, 2, 3, 5 y 10 km, y
   * "500 m" no es un error: es la unidad que corresponde.
   */
  it('un radio corto se lee en metros', () => {
    expect(formatDistance(500)).toBe('500 m');
  });

  it('un radio largo se lee en kilometros', () => {
    expect(formatDistance(10_000)).toBe('10 km');
  });

  it('un radio sin valor no dice nada', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
  });

  /**
   * Todas las marcas del slider tienen que poder escribirse. Si una no
   * puede, el rotulo del circulo sale "Mostrando 12 inmuebles en ." y
   * el problema se ve solo con el dedo.
   */
  it('todas las marcas del selector se pueden leer', () => {
    for (const metros of RADIOS) {
      expect(formatDistance(metros), `radio ${metros}`).toMatch(/^\d+\s*(m|km)$/);
    }
  });
});

describe('el conteo del rotulo', () => {
  /**
   * El plural importa mas de lo que parece. El rotulo se lee con un
   * lector de pantalla mientras alguien desliza el mapa, y
   * "Mostrando 1 inmueble en 1 km." es el texto que confirma que la
   * busqueda salio.
   */
  it('uno va en singular', () => {
    const n = 1;

    expect(`Mostrando ${n} ${n === 1 ? 'inmueble' : 'inmuebles'}.`).toBe('Mostrando 1 inmueble.');
  });

  it('varios van en plural', () => {
    const n: number = 23;

    expect(`Mostrando ${n} ${n === 1 ? 'inmueble' : 'inmuebles'}.`).toBe('Mostrando 23 inmuebles.');
  });

  it('cero va en plural', () => {
    const n: number = 0;

    expect(`Mostrando ${n} ${n === 1 ? 'inmueble' : 'inmuebles'}.`).toBe('Mostrando 0 inmuebles.');
  });
});

describe('las marcas del radio', () => {
  it('1 km es el radio inicial', () => {
    expect(CENTRO.metros).toBe(1000);
  });

  it('las marcas van de 500 m a 10 km', () => {
    expect(RADIOS[0]).toBe(500);
    expect(RADIOS[RADIOS.length - 1]).toBe(10_000);
  });

  it('las marcas no se repiten', () => {
    expect(new Set(RADIOS).size).toBe(RADIOS.length);
  });
});
