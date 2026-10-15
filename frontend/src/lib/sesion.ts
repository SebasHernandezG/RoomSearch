/**
 * Sesion: token, API de identidad y errores. RF-1.1 y RF-1.3.
 *
 * Live aparte de `lib/api.ts` a proposito. Ese archivo es la lectura
 * publica del catalogo, y sus pruebas fijan que un filtro vacio no
 * viaje. Meter aqui el login --que escribe, que guarda estado y que
 * tiene reglas propias-- mezclaria dos cosas con criterios opuestos.
 */

import { ErrorApi } from './api';

export type Rol = 'admin' | 'landlord' | 'tenant';

export type Usuario = {
  id: number;
  name: string;
  email: string;
  role: Rol;
  /** RF-1.3: `false` hasta que abre el enlace del correo. */
  email_verified: boolean;
  created_at: string | null;
};

/**
 * Donde vive el token.
 *
 * `localStorage` es una decision **asumida como riesgo**, no
 * resuelta: sin CSP (RNF-04) un XSS puede leerlo. Las otras opciones
 * tampoco son buenas hoy:
 *
 * - Cookie: necesitaria CSRF, porque la API es sin sesion pero el
 *   navegador igual mandaria la cookie. Ver RNF-04.
 * - Solo en memoria: obliga a iniciar sesion en cada pestana y en cada
 *   recarga. En movil, eso es una pantalla de ingreso cada vez que
 *   volves de la bandeja.
 *
 * Cuando exista la CSP hay que revisar esto, y la migracion a cookie
 * con `SANCTUM_STATEFUL_DOMAINS` esta anotada en
 * `.ai/rules/auth.md`.
 */
const LLAVE_TOKEN = 'roomies.token';

/**
 * El token, o `null` si no hay sesion.
 */
export function leerToken(): string | null {
  try {
    return localStorage.getItem(LLAVE_TOKEN);
  } catch {
    /*
     * `localStorage` lanza en modo privado de Safari y en iframes de
     * terceros sin permisos. Sin esto, abrir la pagina en pestana
     * privada --que es como abre la gente en un celular-- deja la app
     * en blanco con un error en la consola.
     */
    return null;
  }
}

export function guardarToken(token: string): void {
  try {
    localStorage.setItem(LLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento no hay sesion, pero la app debe seguir
    // funcionando para buscar. El fallo se manifiesta al entrar.
  }
}

export function borrarToken(): void {
  try {
    localStorage.removeItem(LLAVE_TOKEN);
  } catch {
    // Idem.
  }
}

/**
 * Normaliza el correo antes de mandarlo.
 *
 * La regla `lowercase` de Laravel **rechaza** las mayusculas, no las
 * convierte, y `RegisterRequest` normaliza en `prepareForValidation`.
 * Normalizar aqui evita el 422 y deja la misma cuenta con dos llaves
 * distintas en la base.
 *
 * El nombre NO se normaliza: "Ana" y "ana" son dos personas distintas
 * a ojos del usuario.
 */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

type RespuestaAuth = {
  message: string;
  token: string;
  user: Usuario;
};

/**
 * Una peticion con el token cuando hay sesion.
 *
 * `ErrorApi` en vez de un error propio: el cliente de la API ya lo
 * traduce, y los errores por campo del 422 llegan igual. La pantalla
 * de ingreso y la de publicacion muestran los dos de la misma forma.
 */
async function pedirAuth(
  ruta: string,
  cuerpo: unknown,
  metodo: 'POST' | 'GET' = 'POST',
): Promise<RespuestaAuth | Usuario> {
  const token = leerToken();

  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined,
  });

  if (!respuesta.ok) {
    let cuerpoError: { message?: string; errors?: Record<string, string[]> } = {};

    try {
      cuerpoError = await respuesta.json();
    } catch {
      // Sin JSON se pierde el mensaje de Laravel; el generico sirve.
    }

    throw new ErrorApi(
      cuerpoError.message ?? 'No pudimos completar eso.',
      respuesta.status,
      cuerpoError.errors ?? {},
    );
  }

  return (await respuesta.json()) as RespuestaAuth | Usuario;
}

export async function registrar(
  nombre: string,
  correo: string,
  contrasena: string,
): Promise<{ token: string; usuario: Usuario }> {
  const datos = await pedirAuth('/register', {
    name: nombre.trim(),
    email: normalizarCorreo(correo),
    password: contrasena,
  });

  const respuesta = datos as RespuestaAuth;

  guardarToken(respuesta.token);

  return { token: respuesta.token, usuario: respuesta.user };
}

export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<{ token: string; usuario: Usuario }> {
  const datos = await pedirAuth('/login', {
    email: normalizarCorreo(correo),
    password: contrasena,
  });

  const respuesta = datos as RespuestaAuth;

  guardarToken(respuesta.token);

  return { token: respuesta.token, usuario: respuesta.user };
}

/**
 * Cierra sesion revocando el token en el servidor.
 *
 * Revocar y no solo olvidar: un token que sigue en la base sirve hasta
 * que expire. Si a alguien le roban el token, la unica forma de que
 * deje de servir es borrarlo.
 *
 * Se borra en local **antes** de la peticion, y no despues: si la red
 * falla, la persona espera en la pantalla de ingreso con un token que
 * ya no funciona y sin entender por que.
 */
export async function cerrarSesion(): Promise<void> {
  const token = leerToken();

  borrarToken();

  if (!token) return;

  try {
    await fetch('/api/logout', {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    // El token ya esta borrado de este lado, que es lo que importa.
  }
}

/**
 * La cuenta con la que se entra, o `null` si no hay sesion.
 *
 * Es la que llama el frontend al abrir la aplicacion, para comprobar
 * que el token guardado sigue vivo en vez de suponer que si.
 */
export async function yo(): Promise<Usuario | null> {
  if (!leerToken()) return null;

  try {
    const usuario = await pedirAuth('/user', undefined, 'GET');

    return usuario as Usuario;
  } catch (error) {
    // 401 es lo normal: el token caduco o se cerro sesion en otro
    // dispositivo. Se limpia para no reintentar en bucle.
    if (error instanceof ErrorApi && (error.codigo === 401 || error.codigo === 403)) {
      borrarToken();
      return null;
    }

    // Un 500 o un fallo de red **no** es motivo para borrar el token:
    // la sesion puede seguir viva y tirar la gente de la aplicacion.
    throw error;
  }
}

/**
 * Si el error es de validacion y trae errores por campo.
 *
 * Lo que la pantalla de ingreso necesita para poner el mensaje junto al
 * campo, que es donde tiene sentido.
 */
export function erroresPorCampo(error: unknown): Record<string, string[]> {
  return error instanceof ErrorApi ? error.errores : {};
}
