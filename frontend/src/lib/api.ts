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

  constructor(message: string, codigo: number, errores: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.errores = errores;
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
    cuerpo.message ?? `No pudimos cargar los inmuebles (${respuesta.status}).`,
    respuesta.status,
    cuerpo.errors ?? {},
  );
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
