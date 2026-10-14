import { describe, expect, it } from 'vitest';

import { TIPO_LABEL, formatDistance, formatPrice } from './format';

/**
 * Formato de lo que se ve en una tarjeta. RNF-14 y DS-5.
 *
 * El precio es lo primero que se lee, a dos metros de distancia. Un
 * separador de miles mal puesto hace que ₡1.500 se lea como mil
 * quinientos cuando son un millón quinientos mil.
 */

describe('formatPrice', () => {
  it('pone el simbolo de colones y el separador de miles', () => {
    expect(formatPrice(280_000, 'CRC')).toBe('₡280.000');
  });

  it('pone el simbolo de dolares sin separador cuando no hace falta', () => {
    expect(formatPrice(450, 'USD')).toBe('US$450');
  });

  it('agrupa los miles en dolares tambien', () => {
    expect(formatPrice(1_500, 'USD')).toBe('US$1.500');
  });

  it('no pone separador antes de un numero de tres cifras', () => {
    expect(formatPrice(999, 'CRC')).toBe('₡999');
  });

  it('redondea a entero: los precios no manejan centavos', () => {
    expect(formatPrice(280_000.4, 'CRC')).toBe('₡280.000');
  });

  it('aguanta siete cifras sin equivocar los grupos', () => {
    expect(formatPrice(1_234_567, 'CRC')).toBe('₡1.234.567');
  });

  /**
   * El cero no es un caso raro: es lo que devuelve un inmueble sin
   * precio, y sale como "₡0" en vez de "₡NaN" o una cadena vacia.
   */
  it('formatea el cero', () => {
    expect(formatPrice(0, 'CRC')).toBe('₡0');
  });
});

describe('formatDistance', () => {
  it('devuelve null cuando no hay distancia', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
  });

  it('deja los metros sin decimales por debajo del kilometro', () => {
    expect(formatDistance(850)).toBe('850 m');
  });

  it('redondea los metros', () => {
    expect(formatDistance(850.6)).toBe('851 m');
  });

  it('pasa a kilometros en el punto', () => {
    expect(formatDistance(1000)).toBe('1 km');
  });

  it('deca un decimal en kilometros', () => {
    expect(formatDistance(1200)).toBe('1.2 km');
  });

  /**
   * "1 km" se lee mejor que "1.0 km". El `.replace(/\.0$/, '')` existe
   * justo para eso y es facil de romper sin querer.
   */
  it('quita el decimal cuando el kilometro es entero', () => {
    expect(formatDistance(3000)).toBe('3 km');
  });

  it('redondea a kilometro entero a partir de 10 km', () => {
    expect(formatDistance(25_000)).toBe('25 km');
  });

  /**
   * 9999 m son 9.999 km, que caen en el lado de "un decimal" y dan
   * "10 km". No es un error de redondeo, es el borde, y conviene
   * dejarlo escrito para que nadie lo lea como bug.
   */
  it('redondea hacia arriba en el borde de los 10 km', () => {
    expect(formatDistance(9999)).toBe('10 km');
  });

  /**
   * `formatDistance` solo formatea. El numero ya viene calculado por
   * MySQL con `ST_Distance_Sphere`; hubo una version con haversine en
   * el cliente y se borro.
   *
   * Ver `.ai/rules/mapa-frontend.md`.
   */
  it('no calcula distancia: solo formatea la que le dan', () => {
    expect(formatDistance(750)).toBe('750 m');
  });
});

describe('TIPO_LABEL', () => {
  /**
   * Tienen que coincidir con `PropertyType::options()` del backend. Si
   * el backend agrega un tipo y aca no, la tarjeta muestra el `value`
   * crudo en vez del nombre.
   */
  it('tiene una etiqueta para cada tipo del backend', () => {
    expect(Object.keys(TIPO_LABEL).sort()).toEqual([
      'apartamento',
      'casa',
      'estudio',
      'habitacion',
    ]);
  });

  it('no deja una etiqueta vacia', () => {
    for (const [tipo, etiqueta] of Object.entries(TIPO_LABEL)) {
      expect(etiqueta.length, `el tipo ${tipo} no tiene etiqueta`).toBeGreaterThan(0);
    }
  });
});
