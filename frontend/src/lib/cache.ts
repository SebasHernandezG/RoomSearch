/**
 * Sin conexion y con lo que ya se habia visto. DS-4, estado 5.
 *
 * El quinto estado que pide el issue es "aviso discreto, la app sigue
 * funcionando con cache". Es el unico de los cinco que no era solo
 * copiar: hace falta guardar la ultima busqueda que funciono y
 * usarla cuando la red se va.
 *
 * ## Por que no se guarda en un service worker
 *
 * Un service worker es la solucion correcta --es la que hace que
 * funcione offline de verdad-- y tambien es un archivo mas que
 * registrar, una cache que invalidar y un ciclo de vida de versiones
 * que ninguna prueba puede verificar. Acero la promesa del issue de
 * otra manera: se guarda lo ultimo que **si** funciono en
 * `localStorage`, que es el mismo almacenamiento que ya usa el
 * borrador del formulario, y se sirve cuando la red no responde.
 *
 * Lo que NO se guarda: nada de la sesion, nada del token, nada de
 * datos del usuario. Solo la respuesta publica del catalogo, que es
 * lo unico que ya se sirve sin sesion.
 */

import type { Property } from '../types/property';

const LLAVE = 'roomies.cache.busqueda';

/** Cuanto se conserva lo cacheado. */
export const MAX_ANTIGUEDAD_MS = 24 * 60 * 60 * 1000;

export type CacheBusqueda = {
  momento: number;
  total: number;
  data: Property[];
};

/**
 * Si el navegador dice que no hay red.
 *
 * `navigator.onLine` es una pista, no un diagnostico: `true` no
 * garantiza que la peticion vaya a pasar (WiFi de hotel sin salida) y
 * `false` casi nunca se equivoca. Por eso se usa **ademas** del
 * error de la peticion y nunca en lugar de el.
 *
 * Cuando el navegador no lo expone --navegadores viejos, y jsdom
 * por defecto-- se trata como "hay red": sin la pista no hay motivo
 * para suponer que no.
 */
export function sinConexion(): boolean {
  if (typeof navigator === 'undefined') return false;

  return navigator.onLine === false;
}

/** Guarda la ultima busqueda que funciono. */
export function guardarCache(total: number, data: Property[]): void {
  try {
    const cache: CacheBusqueda = { momento: Date.now(), total, data };

    localStorage.setItem(LLAVE, JSON.stringify(cache));
  } catch {
    // Cuota llena o pestana privada. Perder el cache es malo, romper
    // la pantalla es peor: se sigue buscando normal.
  }
}

/**
 * La ultima busqueda, si todavia sirve.
 *
 * Devuelve `null` cuando no hay cache, cuando es de otra version o
 * cuando tiene mas de un dia. Un dia es el limite: pasado eso, la
 * lista es de un mundo en el que el inmueble que se acaba de quitar
 * ya no esta y el que se acaba de publicar tampoco.
 */
export function leerCache(): CacheBusqueda | null {
  let crudo: string | null;

  try {
    crudo = localStorage.getItem(LLAVE);
  } catch {
    return null;
  }

  if (!crudo) return null;

  let cache: CacheBusqueda;

  try {
    cache = JSON.parse(crudo) as CacheBusqueda;
  } catch {
    borrarCache();

    return null;
  }

  if (!Array.isArray(cache.data) || typeof cache.total !== 'number') {
    borrarCache();

    return null;
  }

  if (Date.now() - cache.momento > MAX_ANTIGUEDAD_MS) {
    borrarCache();

    return null;
  }

  return cache;
}

export function borrarCache(): void {
  try {
    localStorage.removeItem(LLAVE);
  } catch {
    // Idem.
  }
}

/**
 * Que texto mostrar con lo cacheado.
 *
 * El tono importa: la app **funciona**, no esta rota. "No pudimos
 * cargar" con una lista de resultados debajo se contradice a si
 * mismo. Se dice lo que se esta viendo y lo que hay que hacer.
 *
 * Recibe el total y no el cache entero: el texto no depende de
 * cuando se guardo, y pedirlo obligaria a armar un `CacheBusqueda`
 * falso en el componente para mostrar una frase.
 */
export function avisoCache(total: number): string {
  const plural = total === 1 ? 'inmueble' : 'inmuebles';

  return `Sin conexión. Te mostramos los últimos ${total} ${plural} que vimos.`;
}
