import { describe, expect, it } from 'vitest';

import { PASO_DE, aEnviar } from './FormularioPublicar';
import { DATOS_VACIOS, PASOS } from './datos';

/**
 * El contrato del formulario contra el backend. DS-8.
 *
 * `aEnviar` es donde el formulario se encuentra con
 * `StorePropertyRequest`. Un campo que sobra aqui es un 422 que la
 * persona ve como "Revisá los campos marcados" sin saber cual; un
 * campo que falta es un requisito que no puede cumplir y del que no
 * se le avisa.
 *
 * Los dos casos graves estan probados abajo:
 *
 * - mandarle `0` donde la persona no escribio nada,
 * - olvidar un campo obligatorio.
 */

describe('aEnviar', () => {
  it('manda todos los campos que StorePropertyRequest pide', () => {
    const enviado = aEnviar(DATOS_VACIOS);

    const obligatorios = [
      'title',
      'type',
      'monthly_rent',
      'currency',
      'bedrooms',
      'bathrooms',
      'parking_spaces',
      'furnished',
      'pets_allowed',
      'latitude',
      'longitude',
      'address_reference',
      'district',
      'show_exact_location',
    ];

    for (const campo of obligatorios) {
      expect(enviado).toHaveProperty(campo);
    }
  });

  /**
   * El texto vacio viaja como `null`, no como `""`.
   *
   * Los dos pasan la validacion, pero `""` en `description` se guarda
   * en la base como una cadena vacia y despues la ficha muestra un
   * espacio en blanco donde deberia decir "sin descripcion".
   */
  it('manda null en vez de cadena vacia en los textos opcionales', () => {
    const enviado = aEnviar({ ...DATOS_VACIOS, description: '', rules: '', neighborhood: '' });

    expect(enviado.description).toBeNull();
    expect(enviado.rules).toBeNull();
    expect(enviado.neighborhood).toBeNull();
  });

  /**
   * Un alquiler de 0 colones es un intercambio o una ayudada, y hay
   * gente que los ofrece. Mandar `null` seria decir "no escribiste".
   */
  it('respeta un precio de cero', () => {
    expect(aEnviar({ ...DATOS_VACIOS, monthly_rent: 0 }).monthly_rent).toBe(0);
  });

  it('deja el pin en null si no se eligio', () => {
    const enviado = aEnviar(DATOS_VACIOS);

    expect(enviado.latitude).toBeNull();
    expect(enviado.longitude).toBeNull();
  });

  it('manda el pin cuando se eligio', () => {
    const enviado = aEnviar({
      ...DATOS_VACIOS,
      latitude: 10.3166,
      longitude: -84.3166,
    });

    expect(enviado.latitude).toBe(10.3166);
    expect(enviado.longitude).toBe(-84.3166);
  });

  it('respeta los contadores en cero', () => {
    const enviado = aEnviar({
      ...DATOS_VACIOS,
      bedrooms: 0,
      bathrooms: 0,
      parking_spaces: 0,
    });

    expect(enviado.bedrooms).toBe(0);
    expect(enviado.bathrooms).toBe(0);
    expect(enviado.parking_spaces).toBe(0);
  });

  /**
   * `0` en las casillas de servicio significa "no viene incluido",
   * que es distinto de "no lo se". El backend las trata como
   * `boolean` sin `required`, asi que mandarlas siempre con el valor
   * real evita el `null` que Laravel leeria como faltante.
   */
  it('manda los servicios como booleano explicito', () => {
    const enviado = aEnviar(DATOS_VACIOS);

    for (const campo of [
      'includes_water',
      'includes_electricity',
      'includes_internet',
      'pets_allowed',
      'furnished',
      'show_exact_location',
    ]) {
      expect(typeof enviado[campo]).toBe('boolean');
    }
  });
});

describe('PASO_DE', () => {
  /**
   * El mapa existe para eso: sin el, alguien en el ultimo paso ve
   * "Revisá los campos marcados" y no tiene forma de saber cual. Es
   * el error que hace que un formulario largo parezca roto.
   */
  it('manda cada campo a un paso que existe', () => {
    const existentes = new Set<number>(PASOS.map((p) => p.numero));

    for (const paso of Object.values(PASO_DE)) {
      expect(existentes.has(paso)).toBe(true);
    }
  });

  it('ubica cada campo en el paso que le toca', () => {
    expect(PASO_DE.title).toBe(1);
    expect(PASO_DE.monthly_rent).toBe(2);
    expect(PASO_DE.bedrooms).toBe(3);
    expect(PASO_DE.pets_allowed).toBe(4);
    expect(PASO_DE.latitude).toBe(6);
  });
});

describe('PASOS', () => {
  /**
   * El paso 5 se ago cuando RF-2.3 dejo de estar bloqueado.
   *
   * Antes se afirmaba lo contrario --"no incluye el paso de fotos"--
   * con el motivo al lado. Esa prueba se eliminaria con el endpoint.
   * Esta la reemplaza y fija que el paso existe y esta en su lugar.
   */
  it('incluye el paso de fotos, en su lugar', () => {
    expect(PASOS.map((p) => p.numero)).toContain(5);
    expect(PASOS[4]).toEqual({ numero: 5, nombre: 'Fotos' });
  });

  it('son los seis, en orden', () => {
    expect(PASOS.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  /**
   * Sin huecos.
   *
   * Un salto --1, 2, 3, 5-- hace que el conteo "Paso 4 de 6" no
   * coincida con nada, y es el tipo de error que solo se ve cuando
   * alguien llega al final del formulario.
   */
  it('no deja numeros sin usar', () => {
    const numeros = PASOS.map((p) => p.numero);

    expect(numeros).toEqual(Array.from({ length: PASOS.length }, (_, i) => i + 1));
  });

  it('cada paso tiene nombre', () => {
    for (const paso of PASOS) {
      expect(paso.nombre.length).toBeGreaterThan(0);
    }
  });
});
