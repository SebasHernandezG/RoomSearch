/**
 * El borrador del formulario. DS-8.
 *
 * Vive en `localStorage`, no en el servidor, y hay que ser claro por
 * que: RF-2.6 define el estado `borrador` en la maquina de estados,
 * pero **no hay endpoint que lo cree**. `POST /api/properties` nace
 * siempre en `pendiente`, porque publicar pasa por moderacion.
 *
 * Asi que lo que se guarda aqui es el formulario a medio llenar, y el
 * criterio del issue se cumple entero:
 *
 *   "El borrador sobrevive a recarga y cierre de navegador"
 *
 * El borrador de servidor, con su endpoint y su transicion, es
 * trabajo aparte. Ver RF-2.6.
 */

import type { DatosPublicacion } from '../components/publicar/datos';

const LLAVE = 'roomies.borrador';

/** La version guardada. Se sube si cambia la forma del formulario. */
const VERSION = 1;

type Guardado = {
  version: number;
  paso: number;
  datos: Partial<DatosPublicacion>;
  /** Cuando se guardo, para no preguntar por un borrador de la semana pasada. */
  momento: number;
};

/**
 * Un borrador mas viejo que esto se descarta.
 *
 * Un mes. Pasado eso, lo que hay guardado es de otra versión de la
 * formulario y casi seguro confuse: los campos no coinciden con lo
 * que la persona ve.
 */
export const MAX_ANTIGUEDAD_DIAS = 30;

function almacenamientoDisponible(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function guardarBorrador(paso: number, datos: Partial<DatosPublicacion>): void {
  if (!almacenamientoDisponible()) return;

  try {
    const guardado: Guardado = { version: VERSION, paso, datos, momento: Date.now() };

    localStorage.setItem(LLAVE, JSON.stringify(guardado));
  } catch {
    /*
     * Cuota llena o modo privado. Perder el autoguardado es malo, pero
     * romper el formulario es peor: se sigue llenando y se manda.
     */
  }
}

/**
 * El borrador guardado, o `null` si no hay.
 *
 * Descarta lo que es de otra versión del formulario otoo viejo, en
 * vez de intentar migrarlo: los pasos habrian cambiado y el formulario
 * llenaria campos que ya no existen.
 */
export function leerBorrador(): { paso: number; datos: Partial<DatosPublicacion> } | null {
  if (!almacenamientoDisponible()) return null;

  let crudo: string | null;

  try {
    crudo = localStorage.getItem(LLAVE);
  } catch {
    return null;
  }

  if (!crudo) return null;

  let guardado: Guardado;

  try {
    guardado = JSON.parse(crudo) as Guardado;
  } catch {
    // JSON corrupto: se descarta sin drama.
    borrarBorrador();
    return null;
  }

  if (guardado.version !== VERSION) {
    borrarBorrador();
    return null;
  }

  const dias = (Date.now() - guardado.momento) / 86_400_000;

  if (dias > MAX_ANTIGUEDAD_DIAS) {
    borrarBorrador();
    return null;
  }

  return { paso: guardado.paso, datos: guardado.datos };
}

export function borrarBorrador(): void {
  if (!almacenamientoDisponible()) return;

  try {
    localStorage.removeItem(LLAVE);
  } catch {
    // Idem.
  }
}

/**
 * Si el borrador tiene algo que valga la pena recuperar.
 *
 * Solo con el pin no cuenta: elegir el punto es lo primero que hace
 * todo el mundo, y preguntar "¿seguimos?" por eso seria molesto.
 */
export function tieneContenido(datos: Partial<DatosPublicacion>): boolean {
  if (datos.title || datos.description || datos.district) return true;

  /*
   * `!= null` y no un truthy: el cero cuenta.
   *
   * Un alquiler de 0 colones es un intercambio o una ayudada, y es un
   * dato muy puesto. Con un truthy, llenar el precio en cero seria
   * indistinguible de no haber tocado el campo, y el formulario
   * perderia el trabajo de alguien que quiere mucho publicar en cero.
   */
  return datos.monthly_rent != null;
}
