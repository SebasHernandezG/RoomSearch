/**
 * Los avisos que aparecen abajo. DS-11.
 *
 * ## Abajo, no arriba
 *
 * Arriba esta el encabezado y la barra de pestanas. Un aviso arriba
 * los tapa, y el aviso aparece **justo cuando** alguien esta tocando
 * la barra para cambiar de vista. Abajo solo se cruza con la barra de
 * acciones de la ficha, y esa barra esta ahi porque el aviso la
 * empujaria hacia arriba un momento, no la esconde.
 *
 * ## Los errores no se descartan solos
 *
 * Un aviso que se va a los cuatro segundos y no se ha leido es un
 * aviso que no existio. DS-11 lo dice de forma explicita, y tiene
 * razon: un error que desaparece deja a la persona pensando que si
 * funciono. El cierre es manual.
 */

/** Un aviso, tal como se guarda. */
export type Aviso = {
  id: number;
  texto: string;
  tono: 'exito' | 'error' | 'info';
  /** `true` si se queda hasta que lo cierren. */
  persiste: boolean;
};

/** Cuanto vive un aviso que se descarta solo. DS-11: 4 s. */
export const DURACION_AVISO = 4000;

/** Para los errores, de nuevo: DS-11 pide 4 s. */
export const DURACION_ERROR = DURACION_AVISO;

/**
 * Que avisos se descartan solos.
 *
 * **Los errores no.** Vive aqui, y no en el componente, para que la
 * regla se pueda probar: es la unica parte de este archivo que no es
 * obvia mirando el JSX.
 */
export function seDescarta(aviso: Aviso): boolean {
  return !aviso.persiste && aviso.tono !== 'error';
}

/**
 * El siguiente estado de la lista, sin mutar el original.
 *
 * Puro a proposito: el reloj del navegador y el de React corren a
 * horas distintas, y una lista que se guarda en un `ref` se actualiza
 * con lo que habia. Devolver una lista nueva hace que la prueba pueda
 * fijar el resultado sin montar nada.
 */
export function agregar(avisos: Aviso[], aviso: Aviso): Aviso[] {
  return [...avisos, aviso];
}

/** Quita el aviso con ese id. */
export function quitar(avisos: Aviso[], id: number): Aviso[] {
  return avisos.filter((a) => a.id !== id);
}

/**
 * Como se anuncia cada tono en el lector de pantalla.
 *
 * `assertive` solo para el error, y no por entusiasmo: `assertive`
 * interrumpe lo que el lector estaba leyendo. Un "guardado" que
 * corta a media frase de una descripcion es peor que un "guardado"
 * que se oye medio segundo despues.
 */
export function announcedPoliteness(aviso: Aviso): 'polite' | 'assertive' | null {
  if (aviso.tono === 'error') return 'assertive';

  return 'polite';
}
