/**
 * El cliente de la cola de moderacion. RF-7.1.
 *
 * Vive aparte de `lib/api.ts` por la misma razon que `lib/sesion.ts`:
 * ese archivo es la lectura publica del catalogo y sus pruebas fijan
 * que un filtro vacio no viaje. Este necesita token, tiene dos rutas
 * que escriben y reglas propias --no tocar lo que no es tuyo-- asi que
 * mezclarlas empuja a los dos hacia errores opuestos.
 */

import { ErrorApi } from './api';
import { leerToken } from './sesion';
import type { Property, PropertyStatus } from '../types/property';

/** Lo que la cola dice de cada anuncio. No esta en `Property`. */
export type LandlordModeracion = {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  published_count: number;
  approved_count: number;
  created_at: string | null;
};

export type EnModeracion = Property & { landlord: LandlordModeracion };

export type RespuestaPaginada<T> = {
  data: T[];
  meta: { total: number; current_page: number; last_page: number };
};

/** Los estados que la cola sabe mostrar. */
export const ESTADOS_COLA: { valor: PropertyStatus; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'activa', etiqueta: 'Activas' },
  { valor: 'borrador', etiqueta: 'Borradores' },
  { valor: 'pausada', etiqueta: 'Pausadas' },
  { valor: 'alquilada', etiqueta: 'Alquiladas' },
];

/**
 * Una peticion con token.
 *
 * Sin token no se manda: la cola responde 401 y el error que sale es
 * "esta cuenta no puede hacer eso", que no dice nada de que la sesion
 * se cayo. `null` es mejor que un error que hay que interpretar.
 */
async function pedirAdmin<T>(ruta: string, metodo: 'GET' | 'POST' = 'GET'): Promise<T> {
  const token = leerToken();

  if (!token) {
    throw new ErrorApi('Tu sesión se cerró. Entrá de nuevo.', 401);
  }

  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      Accept: 'application/json',
      ...(metodo === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!respuesta.ok) {
    let cuerpo: { message?: string } = {};

    try {
      cuerpo = await respuesta.json();
    } catch {
      // Sin JSON se pierde el mensaje de Laravel; el generico sirve.
    }

    throw new ErrorApi(cuerpo.message ?? 'No pudimos completar eso.', respuesta.status, {});
  }

  return (await respuesta.json()) as T;
}

/**
 * La cola de un estado.
 *
 * El estado se manda siempre, aunque sea `pendiente`: el backend lo
 * deduce si no viene, y depender de esa deduccion hace que el `?status`
 * de la URL y lo que se pideLeave de desincronizarse.
 */
export async function listarCola(
  estado: PropertyStatus = 'pendiente',
): Promise<RespuestaPaginada<EnModeracion>> {
  return pedirAdmin<RespuestaPaginada<EnModeracion>>(
    `/admin/properties?status=${encodeURIComponent(estado)}`,
  );
}

/** Aprueba. La publicacion pasa a 'activa' y sale del mapa de pendientes. */
export async function aprobar(id: number): Promise<EnModeracion> {
  return pedirAdmin<EnModeracion>(`/properties/${id}/approve`, 'POST');
}

/**
 * Rechaza. Vuelve a 'borrador', no se borra.
 *
 * El `fetch` va sin cuerpo: el backend no pide motivo. Mandar `{}` con
 * `Content-Type: application/json` hace que Laravel espere un JSON y
 * un POST vacio lo responde 400.
 */
export async function rechazar(id: number): Promise<EnModeracion> {
  return pedirAdmin<EnModeracion>(`/properties/${id}/reject`, 'POST');
}
