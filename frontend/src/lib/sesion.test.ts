import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  borrarToken,
  cerrarSesion,
  guardarToken,
  iniciarSesion,
  leerToken,
  normalizarCorreo,
  registrar,
  yo,
} from './sesion';

/**
 * Sesion. RF-1.1 y RF-1.3.
 *
 * Lo que se prueba aqui no es el transporte, sino las cuatro decisiones
 * que estan escritas en el archivo: donde vive el token, que se
 * normaliza antes de mandarse, que se borra en local antes de
 * revocar, y que un 500 no tira a la gente de la aplicacion.
 */

function respuestaFalso(cuerpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => cuerpo,
  } as unknown as Response;
}

/**
 * Mock de `fetch` con la firma real.
 *
 * Tiparlo con los parametros es lo que hace que `mock.calls[0][1]`
 * tenga tipo: sin ellos TypeScript infiere una tupla vacia.
 */
function mockFetch(cuerpo: unknown, status = 200) {
  const llamada = vi.fn((_url: RequestInfo | URL, _opciones?: RequestInit) =>
    Promise.resolve(respuestaFalso(cuerpo, status)),
  );

  vi.stubGlobal('fetch', llamada);

  return llamada;
}

/** El cuerpo JSON de la primera llamada. */
const cuerpoDe = (llamada: ReturnType<typeof mockFetch>) =>
  JSON.parse(String((llamada.mock.calls[0]?.[1] as RequestInit)?.body)) as Record<string, unknown>;

/** Las opciones de la primera llamada. */
const opcionesDe = (llamada: ReturnType<typeof mockFetch>) =>
  llamada.mock.calls[0]?.[1] as RequestInit;

const USUARIO = {
  id: 1,
  name: 'Ana',
  email: 'ana@correo.test',
  role: 'landlord' as const,
  email_verified: false,
  created_at: null,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('el token', () => {
  it('se guarda y se lee', () => {
    guardarToken('abc123');

    expect(leerToken()).toBe('abc123');
  });

  it('se borra', () => {
    guardarToken('abc123');
    borrarToken();

    expect(leerToken()).toBeNull();
  });

  /**
   * Safari en modo privado y los iframes de terceros sin permisos
   * lanzan al tocar `localStorage`. Sin esto, abrir la pagina en
   * pestana privada --que es como abre la gente en un celular-- deja
   * la app en blanco con un error en consola.
   */
  it('no revienta si el almacenamiento no esta disponible', () => {
    const original = Storage.prototype.getItem;
    const getItem = vi.fn(() => {
      throw new DOMException('denegado', 'SecurityError');
    });

    Storage.prototype.getItem = getItem as unknown as typeof original;

    try {
      expect(leerToken()).toBeNull();

      guardarToken('abc');
      expect(borrarToken()).toBeUndefined();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe('normalizarCorreo', () => {
  /**
   * La regla `lowercase` de Laravel **rechaza** las mayusculas, no las
   * convierte. Sin normalizar, "Ana@correo.test" da 422 aunque el
   * correo sea tan valido como el de al lado.
   */
  it('baja a minusculas y quita espacios', () => {
    expect(normalizarCorreo('  Ana@Correo.Test ')).toBe('ana@correo.test');
  });
});

describe('registrar', () => {
  it('manda el correo normalizado', async () => {
    const llamada = mockFetch({ message: 'Cuenta creada.', token: 't1', user: USUARIO });

    await registrar('Ana', '  Ana@Correo.Test ', 'una-frase-larga');

    expect(cuerpoDe(llamada).email).toBe('ana@correo.test');
  });

  it('guarda el token y devuelve el usuario', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaFalso({ message: 'Cuenta creada.', token: 't1', user: USUARIO })),
    );

    const { token, usuario } = await registrar('Ana', 'ana@correo.test', 'una-frase-larga');

    expect(token).toBe('t1');
    expect(usuario.email_verified).toBe(false);
    expect(leerToken()).toBe('t1');
  });

  it('el nombre se manda sin cambios de mayusculas', async () => {
    const llamada = mockFetch({ message: 'Cuenta creada.', token: 't1', user: USUARIO });

    await registrar('  Ana  ', 'ana@correo.test', 'una-frase-larga');

    // Solo se recorta. "Ana" y "ana" son dos personas distintas.
    expect(cuerpoDe(llamada).name).toBe('Ana');
  });

  it('devuelve los errores por campo del 422', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuestaFalso(
          { message: 'x', errors: { email: ['Ya hay una cuenta con ese correo.'] } },
          422,
        ),
      ),
    );

    const error = await registrar('Ana', 'ana@correo.test', 'x').catch((e: unknown) => e);

    expect((error as { errores: Record<string, string[]> }).errores.email?.[0]).toBe(
      'Ya hay una cuenta con ese correo.',
    );
  });

  it('no guarda token si el registro falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaFalso({ message: 'Ya hay una cuenta con ese correo.' }, 422)),
    );

    await registrar('Ana', 'ana@correo.test', 'x').catch(() => undefined);

    expect(leerToken()).toBeNull();
  });
});

describe('iniciarSesion', () => {
  it('guarda el token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaFalso({ message: 'ok', token: 't2', user: USUARIO })),
    );

    await iniciarSesion('ana@correo.test', 'una-frase-larga');

    expect(leerToken()).toBe('t2');
  });

  /**
   * El backend usa el mismo mensaje exista la cuenta o no. Si aca se
   * distinguiera, el formulario serviria para saber quien tiene cuenta
   * en la plataforma.
   */
  it('propaga el mensaje tal cual', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuestaFalso({ message: 'El correo o la contraseña no están bien.', errors: {} }, 422),
      ),
    );

    const error = (await iniciarSesion('ana@correo.test', 'mal').catch((e: unknown) => e)) as Error;

    expect(error.message).toBe('El correo o la contraseña no están bien.');
  });
});

describe('yo', () => {
  it('devuelve null sin token, sin pegarle a la API', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    await expect(yo()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve el usuario con token', async () => {
    guardarToken('t1');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaFalso(USUARIO)),
    );

    await expect(yo()).resolves.toMatchObject({ id: 1 });
  });

  it('manda el token en la cabecera', async () => {
    guardarToken('t1');

    const llamada = mockFetch(USUARIO);

    await yo();

    expect(opcionesDe(llamada).headers).toMatchObject({
      Authorization: 'Bearer t1',
    });
  });

  /**
   * Un 401 limpia el token. Si no, la app reintenta en bucle con un
   * token muerto y la persona ve una pantalla de carga eterna.
   */
  it('borra el token si el servidor dice 401', async () => {
    guardarToken('t1');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaFalso({ message: 'x' }, 401)),
    );

    await expect(yo()).resolves.toBeNull();
    expect(leerToken()).toBeNull();
  });

  /**
   * Un 500 **no** tira a la gente de la aplicacion.
   *
   * La sesion puede seguir viva: lo que fallo fue el servidor un
   * momento. Borrar el token por eso deja a alguien fuera de su cuenta
   * por un fallo de red, y eso es mucho peor que mostrar un error.
   */
  it('NO borra el token si el fallo no es de sesion', async () => {
    guardarToken('t1');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaFalso({ message: 'x' }, 500)),
    );

    await expect(yo()).rejects.toThrow();
    expect(leerToken()).toBe('t1');
  });

  it('tampoco lo borra si no hay red', async () => {
    guardarToken('t1');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(yo()).rejects.toThrow();
    expect(leerToken()).toBe('t1');
  });
});

describe('cerrarSesion', () => {
  /**
   * Revocar y no solo olvidar: un token en la base sigue sirviendo
   * hasta que expira.
   */
  it('revoca el token en el servidor', async () => {
    guardarToken('t1');

    const fetchMock = vi.fn(async () => respuestaFalso({ message: 'Sesión cerrada.' }));

    vi.stubGlobal('fetch', fetchMock);

    await cerrarSesion();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  /**
   * Se borra en local **antes** de la peticion. Si la red falla, la
   * persona no queda en la pantalla de ingreso con un token que ya no
   * funciona y sin entender por que.
   */
  it('borra el token local aunque la red falle', async () => {
    guardarToken('t1');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(cerrarSesion()).resolves.toBeUndefined();
    expect(leerToken()).toBeNull();
  });

  it('no llama al servidor si no habia sesion', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    await cerrarSesion();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
