/**
 * Cliente de la API.
 *
 * Por defecto usa rutas relativas, asi que el frontend y la API
 * comparten origen: en desarrollo Vite hace de proxy (ver
 * vite.config.js) y en produccion los dos se sirven desde el mismo
 * dominio. En los dos casos el navegador no hace una peticion
 * cross-origin, y por eso no hay CORS que configurar ni debuggear.
 *
 * VITE_API_BASE solo hace falta si alguna vez el frontend se sirve
 * desde un host distinto al de la API, que es el unico caso en que
 * entra en juego config/cors.php en el backend.
 */

import type { Property } from '../types/property';

const BASE = import.meta.env.VITE_API_BASE ?? '';

export type RespuestaPaginada<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type Filtros = {
  lat?: number;
  lng?: number;
  radius?: number;
  type?: string;
  min_rent?: number;
  max_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  furnished?: boolean;
  pets_allowed?: boolean;
  parking?: boolean;
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'distance';
  q?: string;
  district?: string;
  page?: number;
  per_page?: number;
};

/**
 * Error de la API con el codigo HTTP y los errores por campo.
 *
 * Los campos van declarados a mano y asignados en el constructor:
 * los parameter properties de TypeScript no compilan con
 * `erasableSyntaxOnly`, que esta activo en tsconfig.
 */
export class ErrorApi extends Error {
  readonly codigo: number;
  readonly errores: Record<string, string[]>;

  /**
   * Segundos que faltan para poder volver a pedir, o null si la
   * respuesta no lo decia.
   *
   * Lo manda el backend en el 429 de RNF-05. Sin esto el frontend solo
   * puede mostrar un error generico y el usuario reintenta a lo loco,
   * gastando un techo que ya se acabo.
   */
  readonly esperarSegundos: number | null;

  constructor(
    message: string,
    codigo: number,
    errores: Record<string, string[]> = {},
    esperarSegundos: number | null = null,
  ) {
    super(message);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.errores = errores;
    this.esperarSegundos = esperarSegundos;
  }

  /**
   * Si conviene esperar antes de reintentar.
   *
   * Solo cuando el servidor lo dice. Un 500 no trae Retry-After y
   * reintentar a ciegas no arregla nada.
   */
  get hayQueEsperar(): boolean {
    return this.esperarSegundos !== null;
  }
}

/**
 * Traduce la respuesta de error de Laravel a algo mostrable.
 *
 * El backend responde 422 con un objeto de campo -> mensajes. El
 * frontend lo muestra tal cual en los campos, asi que se pasa entero.
 */
async function manejarError(respuesta: Response): Promise<never> {
  let cuerpo: { message?: string; errors?: Record<string, string[]> } = {};

  try {
    cuerpo = await respuesta.json();
  } catch {
    // Si no es JSON, se pierde el mensaje de Laravel y queda el generico.
  }

  throw new ErrorApi(
    cuerpo.message ?? mensajePorDefecto(respuesta.status),
    respuesta.status,
    cuerpo.errors ?? {},
    leerRetryAfter(respuesta),
  );
}

/**
 * Lee la cabecera Retry-After.
 *
 * Puede venir como numero de segundos o como fecha HTTP. Se
 * soportan las dos porque el estandar permite cualquiera de las dos y
 * un proxy intermedio puede reescribirla.
 */
function leerRetryAfter(respuesta: Response): number | null {
  const cabecera = respuesta.headers.get('Retry-After');

  if (!cabecera) return null;

  const segundos = Number(cabecera);

  if (Number.isFinite(segundos)) {
    return Math.max(0, Math.ceil(segundos));
  }

  const fecha = Date.parse(cabecera);

  if (Number.isNaN(fecha)) return null;

  return Math.max(0, Math.ceil((fecha - Date.now()) / 1000));
}

/**
 * Un mensaje por codigo, no uno generico para todo.
 *
 * El 429 merece el suyo porque la accion es distinta: no hay que
 * reintentar ya, hay que esperar. Decirle a alguien "no pudimos
 * cargar" cuando solo tiene queaguardar treinta segundos lo hace
 * pensar que la pagina esta rota.
 */
function mensajePorDefecto(codigo: number): string {
  if (codigo === 429) {
    return 'Vamos con calma: hiciste demasiadas consultas seguidas.';
  }

  if (codigo === 404) {
    return 'Ese inmueble ya no está disponible.';
  }

  return `No pudimos cargar los inmuebles (${codigo}).`;
}

export async function listarPropiedades(
  filtros: Filtros = {},
): Promise<RespuestaPaginada<Property>> {
  const parametros = new URLSearchParams();

  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    parametros.set(clave, String(valor));
  }

  const url = `${BASE}/api/properties?${parametros.toString()}`;

  const respuesta = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) {
    await manejarError(respuesta);
  }

  return (await respuesta.json()) as RespuestaPaginada<Property>;
}

export async function obtenerPropiedad(id: number): Promise<Property> {
  const respuesta = await fetch(`${BASE}/api/properties/${id}`, {
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) {
    await manejarError(respuesta);
  }

  const cuerpo = (await respuesta.json()) as { data: Property };

  return cuerpo.data;
}
