import { describe, expect, it } from 'vitest';

import { sonLaMismaZona } from './PantallaBusqueda';
import type { PuntoZona } from './mapa/PropertyMap';

/**
 * El guard que decide si el mapa vuelve a pedir datos. RF-3.5.
 *
 * Esta prueba existe por un bug concreto: la pantalla se quedo colgada
 * en un bucle de 779 peticiones seguidas y los marcadores nunca
 * salieron. Lo detecto una persona leyendo el log del servidor, porque
 * no habia ninguna prueba que lo pudiera detectar.
 *
 * Ver `.ai/rules/mapa-frontend.md`.
 */

/** Ciudad Quesada, el centro con el que arranca el mapa. */
const CENTRO: PuntoZona = { latitud: 10.3236, longitud: -84.4274, metros: 1000 };

/**
 * Cuantos metros se mueve la zona al desplazar `grados` de latitud.
 *
 * Copia la conversion de `sonLaMismaZona` para poder armar el caso
 * limite sin escribir el numero en grados, que no se lee.
 */
const metrosPorGrado = 111_320;

describe('sonLaMismaZona', () => {
  it('acepta la zona identica', () => {
    expect(sonLaMismaZona(CENTRO, { ...CENTRO })).toBe(true);
  });

  /**
   * El caso que dispara el bucle: `fitBounds` reencuadra al circulo y
   * devuelve el centro al mismo punto. Sin tolerancia, eso se leia
   * como "la persona movio el mapa" y volvia a pedir.
   */
  it('acepta el retorno del centro tras reencuadrar', () => {
    const trasReencuadrar: PuntoZona = {
      latitud: Number(CENTRO.latitud.toFixed(6)),
      longitud: Number(CENTRO.longitud.toFixed(6)),
      metros: CENTRO.metros,
    };

    expect(sonLaMismaZona(CENTRO, trasReencuadrar)).toBe(true);
  });

  /**
   * El radio cambia la zona aunque el centro no se mueva. Si esto
   * pasara, cambiar el selector de radio no recargaria nada y el mapa
   * seguiria mostrando el circulo anterior.
   */
  it('rechaza un radio distinto aunque el centro sea el mismo', () => {
    expect(sonLaMismaZona(CENTRO, { ...CENTRO, metros: 2000 })).toBe(false);
  });

  describe('la tolerancia de 50 m', () => {
    /**
     * Un grado de latitud son unos 111 km, asi que 50 m son una
     * fraccion minuscula. Sin esto, el caso limite se escribiria como
     * 0.00045 y nadie sabria que el numero es el que importa.
     */
    const gradosPara = (metros: number) => metros / metrosPorGrado;

    it('acepta un desplazamiento por debajo de 50 m', () => {
      const movida: PuntoZona = {
        ...CENTRO,
        latitud: CENTRO.latitud + gradosPara(49),
      };

      expect(sonLaMismaZona(CENTRO, movida)).toBe(true);
    });

    it('rechaza un desplazamiento por encima de 50 m', () => {
      const movida: PuntoZona = {
        ...CENTRO,
        latitud: CENTRO.latitud + gradosPara(51),
      };

      expect(sonLaMismaZona(CENTRO, movida)).toBe(false);
    });

    /**
     * El limite es estricto: exactamente 50 m ya es otra zona. La
     * funcion usa `<` y no `<=`, asi que el numero de la regla es el
     * que dice. Si alguna vez se cambia a `<=`, esta prueba avisa.
     */
    it('rechaza exactamente 50 m, porque el limite es estricto', () => {
      const justo: PuntoZona = {
        ...CENTRO,
        latitud: CENTRO.latitud + gradosPara(50),
      };

      expect(sonLaMismaZona(CENTRO, justo)).toBe(false);
    });

    it('mide la longitud igual que la latitud', () => {
      const movida: PuntoZona = {
        ...CENTRO,
        longitud: CENTRO.longitud + gradosPara(51),
      };

      expect(sonLaMismaZona(CENTRO, movida)).toBe(false);
    });

    /**
     * Mover en diagonal 40 m por eje son ~56 m recorridos, pero la
     * funcion compara cada eje por separado y no la distancia total.
     *
     * Es lo correcto: lo que se nota al arrastrar es el desplazamiento
     * en cada eje, no la distancia en linea recta.
     */
    it('compara cada eje por separado, no la distancia en linea recta', () => {
      const enDiagonal: PuntoZona = {
        ...CENTRO,
        latitud: CENTRO.latitud + gradosPara(40),
        longitud: CENTRO.longitud + gradosPara(40),
      };

      expect(sonLaMismaZona(CENTRO, enDiagonal)).toBe(true);
    });
  });

  /**
   * `NaN` en cualquier comparacion da `false`, asi que una zona rota
   * se trataria como "distinta" y dispararia peticiones. Comprueba que
   * eso no se cuela: el radio es obligatorio y tiene que valer.
   */
  it('no confunde una zona sin radio con la zona valida', () => {
    const sinRadio = { ...CENTRO, metros: undefined } as unknown as PuntoZona;

    expect(sonLaMismaZona(CENTRO, sinRadio)).toBe(false);
  });

  /**
   * El otro bucle documentado: el radio NO se deduce del zoom.
   *
   * Si alguien reintrodujera la deduccion, dos zonas con el mismo
   * centro y distinto radio regresarian a ser distintas y el mapa
   * entraria en el ciclo zoom -> radio -> circulo -> fitBounds.
   *
   * Aqui solo se fija la mitad que se puede probar sin DOM: que dos
   * radios distintos nunca son la misma zona. La otra mitad es
   * `leerCentro`, que recibe el radio del selector como parametro.
   */
  it('nunca considera la misma zona a dos radios distintos', () => {
    const radios = [500, 1000, 2000, 3000, 5000, 10_000];

    for (const metros of radios) {
      expect(sonLaMismaZona(CENTRO, { ...CENTRO, metros })).toBe(metros === CENTRO.metros);
    }
  });
});
