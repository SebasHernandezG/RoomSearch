/**
 * La galeria de fotos. RF-2.3.
 *
 * ## Por que vive en su propia libreria
 *
 * Porque la usa el formulario --subir-- y la ficha --mostrar--, y las
 * dos necesitan el mismo vocabulario: que una foto es la principal, que
 * hay un maximo, que no se puede borrar la ultima. Si cada pantalla
 * decidiera eso por su cuenta, el formulario permitiria subir nueve y
 * la ficha se olvidaria de que hay ocho.
 */

/** Cuantas fotos acepta un anuncio. Debe coincidir con el backend. */
export const MAXIMO_FOTOS = 8;

/** El peso maximo por foto, en bytes. Lo dice el backend. */
export const MAXIMO_BYTES = 8 * 1024 * 1024;

/**
 * Lo que se acepta.
 *
 * Los mismos que el backend. Si el navegador acepta un PNG y el
 * servidor no, la persona sube el archivo, ve el progreso, y recibe un
 * 422 al final: el peor momento posible para enterarse.
 */
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/webp'];

export type FotoElegida = {
  /** `null` mientras es una foto nueva: todavia no tiene id. */
  id: number | null;
  archivo: File;
  /** Miniatura local, para que la previsualizacion no espere al servidor. */
  vista: string;
  esPrincipal: boolean;
};

/**
 * Si el navegador puede previsualizar este archivo.
 *
 * Antes de dejar elegir el archivo. Un `accept` en el input es una
 * sugerencia que el usuario puede ignorar escribiendo el nombre a mano,
 * y un filtro aqui es el que de verdad evita que llegue al servidor.
 */
export function esTipoAceptado(archivo: File): boolean {
  return TIPOS_ACEPTADOS.includes(archivo.type);
}

/**
 * Los problemas de un archivo, en el tono del proyecto.
 *
 * Varios a la vez, no el primero: una persona que eligio tres y el
 * segundo esta mal tiene que saber cual es sin probarlos uno por uno.
 */
/**
 * Los problemas de un archivo, o `[]` si no hay archivo.
 *
 * `undefined` es un caso real: cuando el input de archivos se vacia, o
 * cuando un componente recibe el valor antes de que haya nada elegido.
 */
export function tipoProblematico(archivo: File | null | undefined): string[] {
  if (!archivo) {
    return [];
  }

  return problemasDe(archivo);
}

export function problemasDe(archivo: File): string[] {
  const problemas: string[] = [];

  if (!esTipoAceptado(archivo)) {
    problemas.push('Solo aceptamos JPG o WebP.');
  }

  if (archivo.size > MAXIMO_BYTES) {
    problemas.push(`Esta foto pesa ${formatoPeso(archivo.size)} y el máximo es 8 MB.`);
  }

  return problemas;
}

/** `1.4 MB`, `820 KB`. */
export function formatoPeso(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Que problemas tiene el conjunto entero.
 *
 * El maximo se comprueba aca y no en el servidor porque el boton de
 * "subir" se puede poner en estado deshabilitado: es mejor que no dejar
 * elegir la novena foto que aceptarla y avisar despues.
 */
export function problemasDelConjunto(fotos: FotoElegida[]): string[] {
  const problemas: string[] = [];

  if (fotos.length > MAXIMO_FOTOS) {
    problemas.push(`Máximo ${MAXIMO_FOTOS} fotos por anuncio. Tenés ${fotos.length}.`);
  }

  return problemas;
}

/**
 * Cuantas de las fotos elegidas se van a subir de verdad.
 *
 * Las que ya tienen `id` ya estan en el servidor; las nuevas son las
 * que viajan en el `FormData`.
 */
export function nuevas(fotos: FotoElegida[]): FotoElegida[] {
  return fotos.filter((foto) => foto.id === null);
}

/** El indice de la principal, o 0 si no hay. */
export function indiceDePrincipal(fotos: FotoElegida[]): number {
  return Math.max(
    0,
    fotos.findIndex((foto) => foto.esPrincipal),
  );
}
