import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorApi, listarPropiedades, obtenerPropiedad } from './api';
import type { Filtros } from './api';

/**
 * El cliente de la API. RNF-05.
 *
 * Lo que se prueba aqui no es el transporte, sino las tres decisiones
 * que estan escritas en el archivo: que los filtros vacios no viajan,
 * que el 429 se distingue de los demas errores, y que el `Retry-After`
 * se lee en las dos formas que permite el estandar.
 *
 * Ver `.ai/rules/api.md` en el backend.
 */

type RespuestaFalso = {
  status?: number;
  cabeceras?: Record<string, string>;
};

/**
 * Respuesta de mentira con las piezas que el cliente lee.
 */
function respuestaFalso(cuerpo: unknown, init: RespuestaFalso = {}) {
  const status = init.status ?? 200;

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(init.cabeceras ?? {}),
    json: async () => cuerpo,
  } as unknown as Response;
}

/**
 * Mock de `fetch` con la firma real.
 *
 * Tiparlo con los parametros es lo que hace que `mock.calls[0][0]`
 * tenga tipo. Sin ellos, TypeScript infiere una tupla vacia y
 * `calls[0][0]` no compila.
 */
function mockFetch(cuerpo: unknown, init: RespuestaFalso = {}) {
  const llamada = vi.fn((_url: RequestInfo | URL, _opciones?: RequestInit) =>
    Promise.resolve(respuestaFalso(cuerpo, init)),
  );

  vi.stubGlobal('fetch', llamada);

  return llamada;
}

/** Pagina vacia, que es la respuesta de una busqueda sin resultados. */
const PAGINA_VACIA = {
  data: [],
  meta: { current_page: 1, last_page: 1, per_page: 24, total: 0 },
};

const urlDe = (llamada: ReturnType<typeof mockFetch>) => String(llamada.mock.calls[0]?.[0]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listarPropiedades', () => {
  it('devuelve la pagina tal cual', async () => {
    mockFetch(PAGINA_VACIA);

    await expect(listarPropiedades()).resolves.toEqual(PAGINA_VACIA);
  });

  /**
   * Un filtro en `undefined` serializado como la cadena "undefined"
   * viaja al backend, que responde 422. El mapa dispara esta llamada
   * cada vez que se mueve, asi que el error aparecia solo en
   * movimiento.
   */
  it('no manda los filtros que no tienen valor', async () => {
    const llamada = mockFetch(PAGINA_VACIA);

    await listarPropiedades({
      lat: 10.3236,
      lng: -84.4274,
      radius: undefined,
      type: undefined,
      q: '',
      district: 'Ciudad Quesada',
    });

    const url = urlDe(llamada);

    expect(url).toContain('lat=10.3236');
    expect(url).toContain('district=Ciudad+Quesada');
    expect(url).not.toContain('undefined');
    expect(url).not.toContain('q=');
  });

  /**
   * `Filtros` no admite `null`, pero el guarda de `api.ts` lo contempla
   * porque los filtros pueden venir de un `URLSearchParams` o de estado
   * de formulario, donde `null` es natural.
   *
   * El casteo va por `unknown` a proposito: TypeScript no deja pasar
   * `null` a un campo `number`, y ensuciar el tipo publico para que una
   * prueba sea mas comoda seria cambiar la API por el test.
   */
  it('tambien descarta un null, por si el filtro viene de un formulario', async () => {
    const llamada = mockFetch(PAGINA_VACIA);

    await listarPropiedades({
      min_rent: null,
      max_rent: 300_000,
    } as unknown as Filtros);

    const url = urlDe(llamada);

    expect(url).not.toContain('min_rent');
    expect(url).not.toContain('null');
    expect(url).toContain('max_rent=300000');
  });

  /**
   * El cero y `false` son filtros validos, no "sin valor": si se
   * descartaran, no habria forma de pedir "hasta 0 colones" ni
   * "sin amoblado".
   */
  it('mantiene el cero y el false, que son filtros validos', async () => {
    const llamada = mockFetch(PAGINA_VACIA);

    await listarPropiedades({ min_rent: 0, furnished: false });

    const url = urlDe(llamada);

    expect(url).toContain('min_rent=0');
    expect(url).toContain('furnished=false');
  });

  it('lanza ErrorApi con los errores por campo del 422', async () => {
    mockFetch(
      {
        message: 'Los datos no son válidos.',
        errors: { latitude: ['Tenés que poner el pin en el mapa.'] },
      },
      { status: 422 },
    );

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.codigo).toBe(422);
    expect(error.errores.latitude?.[0]).toBe('Tenés que poner el pin en el mapa.');
  });
});

describe('ErrorApi y el 429', () => {
  it('lee Retry-After como numero de segundos', async () => {
    mockFetch({}, { status: 429, cabeceras: { 'Retry-After': '30' } });

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error.esperarSegundos).toBe(30);
    expect(error.hayQueEsperar).toBe(true);
  });

  /**
   * El estandar permite las dos formas y un proxy intermedio puede
   * reescribir la cabecera. Con una fecha mal leida, la cuenta
   * regresiva muestra NaN.
   */
  it('lee Retry-After como fecha HTTP', async () => {
    const dentroDe45Segundos = new Date(Date.now() + 45_000).toUTCString();

    mockFetch({}, { status: 429, cabeceras: { 'Retry-After': dentroDe45Segundos } });

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error.esperarSegundos).toBeGreaterThanOrEqual(44);
    expect(error.esperarSegundos).toBeLessThanOrEqual(45);
  });

  it('redondea hacia arriba, para no reintentar antes de tiempo', async () => {
    mockFetch({}, { status: 429, cabeceras: { 'Retry-After': '29.2' } });

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error.esperarSegundos).toBe(30);
  });

  /**
   * Una fecha ya vencida daria un negativo, y la cuenta regresiva
   * arrancaria en negativo contando hacia arriba.
   */
  it('nunca devuelve un numero negativo', async () => {
    const haceRato = new Date(Date.now() - 60_000).toUTCString();

    mockFetch({}, { status: 429, cabeceras: { 'Retry-After': haceRato } });

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error.esperarSegundos).toBe(0);
  });

  it('no inventa espera cuando el servidor no la pide', async () => {
    mockFetch({}, { status: 500 });

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error.esperarSegundos).toBeNull();
    expect(error.hayQueEsperar).toBe(false);
  });

  /**
   * El 429 merece su propio mensaje: la accion es esperar, no
   * reintentar. Decir "no pudimos cargar" hace pensar que la pagina
   * esta rota.
   */
  it('el 429 no dice que la pagina esta rota', async () => {
    mockFetch({}, { status: 429, cabeceras: { 'Retry-After': '10' } });

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error.message).not.toContain('No pudimos cargar');
    expect(error.message).toContain('demasiadas');
  });

  it('el 404 dice que el inmueble ya no esta', async () => {
    mockFetch({}, { status: 404 });

    const error = (await obtenerPropiedad(7).catch((e: unknown) => e)) as ErrorApi;

    expect(error.codigo).toBe(404);
    expect(error.message).toBe('Ese inmueble ya no está disponible.');
  });

  /**
   * Si el servidor devuelve HTML en vez de JSON (un 502 del proxy,
   * por ejemplo), no debe reventar el parseo: el mensaje generico es
   * mejor que una excepcion de sintaxis.
   */
  it('aguanta una respuesta que no es JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          headers: new Headers(),
          json: () => Promise.reject(new SyntaxError('Unexpected token <')),
        } as unknown as Response),
      ),
    );

    const error = (await listarPropiedades().catch((e: unknown) => e)) as ErrorApi;

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.codigo).toBe(502);
    expect(error.message).toContain('502');
  });
});

describe('obtenerPropiedad', () => {
  it('desenvuelve el objeto data', async () => {
    mockFetch({ data: { id: 7, title: 'Apartamento' } });

    await expect(obtenerPropiedad(7)).resolves.toMatchObject({ id: 7 });
  });

  it('pide la ruta del detalle, no la del listado', async () => {
    const llamada = mockFetch({ data: { id: 7 } });

    await obtenerPropiedad(7);

    expect(urlDe(llamada)).toContain('/api/properties/7');
  });
});
