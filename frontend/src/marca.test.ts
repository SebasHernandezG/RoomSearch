import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * La identidad visual. DS-9.
 *
 * ## Por que hay una prueba sobre archivos, y no solo sobre codigo
 *
 * La razon por la que este archivo existe es que **el favicon que
 * estaba puesto era el logo por defecto de Vite**, con su relampago
 * morado (#863bff). Nadie lo habia notado porque un favicon se mira
 * cuando se nota que esta raro, y el relampago morado sobre una
 * pagina verde se lee como "marca del proveedor" a simple vista.
 *
 * Un SVG en `public/` no lo agarra ni ESLint ni TypeScript: es un
 * archivo que nadie importa. La unica forma de que algo lo revise es
 * una prueba que lo abra.
 */

/**
 * Los SVG publicos y el `index.html`.
 *
 * Dos candidatas por archivo, igual que en `contraste.test.ts`:
 * `npm test` corre desde `frontend/` y `npm --prefix frontend test`
 * desde la raiz del repositorio.
 */
function leer(relativo: string): string {
  const candidatas = [
    resolve(process.cwd(), relativo),
    resolve(process.cwd(), 'frontend', relativo),
  ];

  const ruta = candidatas.find((c) => {
    try {
      readFileSync(c, 'utf8');

      return true;
    } catch {
      return false;
    }
  });

  if (!ruta) {
    throw new Error(`No se encontro ${relativo}. Buscado en:\n  ${candidatas.join('\n  ')}`);
  }

  return readFileSync(ruta, 'utf8');
}

const SVG = ['<svg', 'xmlns="http://www.w3.org/2000/svg"', 'viewBox='];

describe('el favicon', () => {
  const favicon = leer('public/favicon.svg');

  /**
   * El hallazgo que motivo este archivo.
   *
   * `#863bff` es el morado del logo por defecto de Vite. Si alguien
   * corre `npm create vite` encima de `public/`, el archivo vuelve a
   * ser ese y el bug regresa sin que ninguna prueba de codigo lo note.
   */
  it('NO es el logo por defecto de Vite', () => {
    expect(favicon).not.toContain('#863bff');
    expect(favicon).not.toContain('#7e14ff');
    expect(favicon).not.toContain('#47bfff');
    expect(favicon).not.toContain('ede6ff');
  });

  it('es un SVG valido con viewBox', () => {
    for (const trozo of SVG) {
      expect(favicon).toContain(trozo);
    }
  });

  /**
   * El color de la marca. Si cambia en `tokens.css` y no aqui, el
   * favicon queda de otro verde que la pagina y no hay forma de
   * notarlo mirando el navegador.
   */
  it('usa el verde de la marca', () => {
    expect(favicon).toContain('#1b4332');
  });

  /**
   * Un favicon se pinta solo: no hay hoja de estilos donde resolver un
   * color de contexto, asi que `currentColor` se queda en negro --o
   * en nada--. El color va fijo.
   *
   * La comprobacion mira el atributo `fill`, no la palabra: el
   * comentario del propio SVG la nombra y una prueba que busca texto
   * plano falla por la documentacion.
   */
  it('no usa currentColor en un atributo, que el favicon no puede resolver', () => {
    expect(favicon).not.toContain('fill="currentColor"');
  });

  it('declara el texto alternativo para cuando se usa como imagen', () => {
    expect(leer('public/marca.svg')).toContain('aria-label="Roomies San Carlos"');
  });
});

describe('las versiones de la marca', () => {
  it('la monocroma existe y usa `currentColor`', () => {
    const mono = leer('public/marca-monocroma.svg');

    expect(mono).toContain('currentColor');
    expect(mono).toContain('viewBox=');
  });

  /**
   * La version monocroma es para iconos adaptativos, y ahi el sistema
   * pinta el fondo. Un SVG con los tres colores de la marca se ve
   * amontonado sobre un fondo oscuro y se pierde.
   */
  it('la monocroma tiene un solo color', () => {
    const mono = leer('public/marca-monocroma.svg');

    const colores = mono.match(/#[0-9a-f]{6}/gi) ?? [];

    expect(colores).toHaveLength(0);
  });

  it('la de color tiene la hoja de `coffee', () => {
    expect(leer('public/marca.svg')).toContain('#74c69d');
  });
});

describe('index.html', () => {
  const html = leer('index.html');

  it('no tiene el titulo de ejemplo de Vite', () => {
    expect(html).not.toContain('<title>Vite + React</title>');
  });

  it('el titulo dice el nombre y la ciudad', () => {
    expect(html).toContain('Roomies San Carlos');
    expect(html).toContain('Vivienda en San Carlos');
  });

  /**
   * El titulo tenia un caracter roto: `Roomies San Carlos ?? Vivienda`.
   *
   * No se ve al pintar --el navegador lo muestra como un rombo--, pero
   * es lo que Google indexa como titulo de la pagina. Un `?` de UTF-8
   * no decodificado se queda ahi para siempre.
   */
  it('el titulo no tiene caracteres rotos', () => {
    const titulo = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';

    expect(titulo).not.toMatch(/[\uFFFD]/);
  });

  it('declara el idioma', () => {
    expect(html).toContain('lang="es"');
  });

  /**
   * `theme-color` pinta la barra del navegador en Android. Sin ella
   * el navegador usa el color por defecto del sistema y la pantalla
   * se ve como si fuera de otra aplicacion.
   */
  it('declara el color de la barra del sistema', () => {
    expect(html).toContain('name="theme-color"');
  });

  it('apunta al favicon de la marca', () => {
    expect(html).toContain('href="/favicon.svg"');
  });

  it('ofrece la version monocroma para tema oscuro', () => {
    expect(html).toContain('marca-monocroma.svg');
  });
});
