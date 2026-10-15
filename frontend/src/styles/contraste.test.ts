import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Contraste de los tokens. DS-10.
 *
 * ## Por que un calculo propio y no axe
 *
 * axe lo reporta como "no verificable" en jsdom --no hay motor de
 * layout-- asi que hay que apagarlo en `accesibilidad.ts` y medirlo
 * aqui. La alternativa era no medirlo, y entonces nadie sabe si el
 * `ink` de los textos sigue jugando contra el `paper` que dice el
 * ticket.
 *
 * La formula es la de WCAG 2.1, sin dependencias. Es corta y es la
 * que hay que entender para saber que hacer cuando un color falla.
 *
 * ## Por que los tokens se leen del CSS y no se copian aqui
 *
 * Copiar los hex a un archivo de TypeScript crea una segunda fuente
 * de verdad: alguien cambia `--color-ink` en `tokens.css`, la prueba
 * sigue midiendo el hex viejo en verde y nadie se entera hasta que un
 * usuario no puede leer la pagina.
 *
 * ## Por que `fs` y no `?raw`
 *
 * `@tailwindcss/vite` intercepta los imports de CSS y `?raw` devuelve
 * cadena vacia. Y `import.meta.url` tampoco sirve: en jsdom no es una
 * URL de esquema `file` y `fileURLToPath` lanza.
 */
const TOKENS: Record<string, string> = (() => {
  /*
   * Dos candidatas y no una sola.
   *
   * `npm test` corre con el directorio en `frontend/`, pero
   * `npm --prefix frontend test` lo corre desde la raiz del
   * repositorio. Sin la segunda, la prueba pasa en la maquina de
   * desarrollo y falla en el CI -- o al reves, que es peor.
   */
  const candidatas = [
    resolve(process.cwd(), 'src/styles/tokens.css'),
    resolve(process.cwd(), 'frontend/src/styles/tokens.css'),
  ];

  const ruta = candidatas.find((c) => existsSync(c));

  if (!ruta) {
    throw new Error(`No se encontro tokens.css. Buscado en:\n  ${candidatas.join('\n  ')}`);
  }

  const css = readFileSync(ruta, 'utf8');

  const encontrados: Record<string, string> = {};

  const patron = /--color-([a-z]+):\s*(#[0-9a-f]{6})/gi;

  for (const [, nombre, hex] of css.matchAll(patron)) {
    encontrados[nombre!] = hex!;
  }

  return encontrados;
})();

/** Los canales de un `#rrggbb`. */
type Rgb = { r: number; g: number; b: number };

function aRgb(hex: string): Rgb {
  const limpio = hex.replace('#', '');

  return {
    r: parseInt(limpio.slice(0, 2), 16),
    g: parseInt(limpio.slice(2, 4), 16),
    b: parseInt(limpio.slice(4, 6), 16),
  };
}

/**
 * El canal Relative Lightness segun WCAG 2.1.
 *
 * El exponento `2.4` con el corte en `0.03928` es lo que dice la
 * norma. Con el exponento de `1/2.2` a secas --el atajo que se ve en
 * internet-- el resultado se va hasta 0.1 y varios pares pasan o
 * fallan por poco sin motivo.
 */
function luminosidad(canal: number): number {
  const c = canal / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * El ratio de contraste entre dos colores.
 *
 * Va de 1 a 21. `1` es invisible sobre si mismo; `21` es blanco
 * sobre negro y no hay nada mas.
 */
export function contraste(uno: string, otro: string): number {
  const a = aRgb(uno);
  const b = aRgb(otro);

  const la = 0.2126 * luminosidad(a.r) + 0.7152 * luminosidad(a.g) + 0.0722 * luminosidad(a.b);

  const lb = 0.2126 * luminosidad(b.r) + 0.7152 * luminosidad(b.g) + 0.0722 * luminosidad(b.b);

  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);

  return (claro + 0.05) / (oscuro + 0.05);
}

/** AA para texto normal: 4.5:1. */
export const AA_NORMAL = 4.5;

/** AAA para texto normal: 7:1. */
export const AAA_NORMAL = 7;

/** AA para texto grande (18.66 px en negrita o 24 px): 3:1. */
export const AA_GRANDE = 3;

describe('el contraste de los tokens', () => {
  it('el texto normal alcanza AA sobre el fondo de la pagina', () => {
    expect(contraste(TOKENS.ink, TOKENS.paper)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('el texto normal alcanza AAA sobre el fondo de la pagina', () => {
    /*
     * DS-10 pide AAA para texto pequeño y `ink` es el color del
     * cuerpo. Este es el par que mas texto de la aplicacion usa, y
     * es el que no puede fallar sin que falle todo lo demas.
     */
    expect(contraste(TOKENS.ink, TOKENS.paper)).toBeGreaterThanOrEqual(AAA_NORMAL);
  });

  it('el texto secundario alcanza AA', () => {
    /*
     * `stone` es el color de los subtitulos, los campos y los
     * contadores. Es el que mas se acerca al limite de todo el
     * sistema, y por eso tiene prueba propia.
     */
    expect(contraste(TOKENS.stone, TOKENS.paper)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('el texto secundario alcanza AA sobre una tarjeta', () => {
    // Las tarjetas van sobre `sand`, no sobre `paper`.
    expect(contraste(TOKENS.stone, TOKENS.sand)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('el texto de papel alcanza AA sobre el verde principal', () => {
    // Todos los botones primarios: texto claro sobre `forest`.
    expect(contraste(TOKENS.paper, TOKENS.forest)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('el texto de papel alcanza AA sobre el verde de enlace', () => {
    expect(contraste(TOKENS.paper, TOKENS.leaf)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  /**
   * `sun` esta prohibido para texto.
   *
   * Es el hallazgo del propio diseno --DS-1 lo marco-- y la razon
   * esta escrita en el componente de la tarjeta. Aqui esta la prueba
   * que lo fija, para que volver a usarlo falle en CI y no en una
   * revision de diseno.
  /**
   * `sun` no puede ser el fondo de texto claro.
   *
   * Lo que falla no es `sun` como color de texto --`ink` sobre `sun`
   * da 7.17:1 y es perfectamente legible--, sino `paper` sobre `sun`.
   * Es decir: `sun` sirve de fondo **con texto oscuro** y no sirve de
   * fondo con el color de texto del sistema.
   *
   * Por eso el precio de la tarjeta va en `forest` y no en `sun`: la
   * primera combinacion que se probaria es texto claro sobre el color
   * de precio, y esa es justo la que no pasa.
   */
  it('sun NO alcanza AA con texto claro encima', () => {
    expect(contraste(TOKENS.paper, TOKENS.sun)).toBeLessThan(AA_NORMAL);
  });

  it('sun SI alcanza AA con el texto oscuro encima', () => {
    expect(contraste(TOKENS.ink, TOKENS.sun)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  /**
   * `clay` como texto sobre el fondo de la pagina no pasa: 4.28:1.
   *
   * Por eso los errores van en `ink` con el fondo y el borde en
   * `clay`: el aviso se marca por la superficie, y el texto conserva
   * el contraste.
   */
  it('clay NO alcanza AA como texto sobre el fondo', () => {
    expect(contraste(TOKENS.clay, TOKENS.paper)).toBeLessThan(AA_NORMAL);
  });

  /**
   * El borde de error tiene que distinguirse.
   *
   * WCAG 1.4.11 pide 3:1 para el limite de un componente de interfaz,
   * y `clay` da 2.99:1 -- tres centesimas corto. Ese fue el hallazgo
   * que motivo el token `--color-alert`.
   */
  it('clay NO alcanza el 3:1 que pide un borde de interfaz', () => {
    expect(contraste(TOKENS.clay, TOKENS.paper)).toBeLessThan(AA_GRANDE);
  });

  it('alert SI alcanza el 3:1 que pide un borde de interfaz', () => {
    expect(contraste(TOKENS.alert, TOKENS.paper)).toBeGreaterThanOrEqual(AA_GRANDE);
  });

  /**
   * `line` es un filete decorativo y no llega a 3:1.
   *
   * WCAG no pide 3:1 de un separador, asi que aqui se documenta la
   * excepcion en vez de fallar. El borde de un campo de formulario si
   * lo necesita, y por eso existe `--color-edge`: con `line`, un
   * campo vacio se ve como papel en blanco.
   */
  it('line es decorativo y su 1.25:1 es aceptable como separador', () => {
    expect(contraste(TOKENS.line, TOKENS.paper)).toBeLessThan(AA_GRANDE);
  });

  it('edge SI alcanza el 3:1 del borde de un campo', () => {
    expect(contraste(TOKENS.edge, TOKENS.paper)).toBeGreaterThanOrEqual(AA_GRANDE);
  });

  it('edge SI alcanza el 3:1 tambien sobre una tarjeta', () => {
    expect(contraste(TOKENS.edge, TOKENS.sand)).toBeGreaterThanOrEqual(AA_GRANDE);
  });

  /**
   * El anillo de foco tiene que verse sobre el fondo de la pagina.
   *
   * Un anillo de 1.5:1 sobre el fondo es legal segun WCAG 1.4.11 y
   * aun asi inusable: en DS-10 el anillo es de 3 px y tiene que
   * distinguirse. El margen sobre el minimo legal es deliberado.
   */
  it('el anillo de foco se distingue del fondo', () => {
    expect(contraste(TOKENS.leaf, TOKENS.paper)).toBeGreaterThanOrEqual(AA_GRANDE);
  });
});
