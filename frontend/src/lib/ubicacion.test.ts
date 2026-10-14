import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ESPERANDO,
  MOTIVO,
  TIEMPO_MAXIMO,
  haySoporte,
  mensajeDeError,
  pedirUbicacion,
} from './ubicacion';

/**
 * Ubicacion actual. RF-3.4.
 *
 * Los tres errores del navegador se prueban aqui y no a mano con el
 * navegador denegando permisos uno por uno, que es como se hacia antes
 * de que hubiera runner.
 */

type PosicionFalsa = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
};

/** Constructor de error de posicion, que es una interfaz y no una clase. */
function errorDePosicion(codigo: number): GeolocationPositionError {
  return { code: codigo, message: 'error' } as GeolocationPositionError;
}

/**
 * Instala un `navigator.geolocation` de mentira que responde de una vez,
 * para los casos donde solo interesa el resultado.
 */
function respondiendo(exito: PosicionFalsa | null, codigoError: number | null) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, ko?: PositionErrorCallback | null) => {
    if (exito) {
      ok({ coords: exito.coords } as GeolocationPosition);
    }

    if (codigoError !== null) {
      ko?.(errorDePosicion(codigoError));
    }
  });

  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

  return getCurrentPosition;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('haySoporte', () => {
  it('es true cuando el navegador expone geolocation', () => {
    respondiendo({ coords: { latitude: 10.32, longitude: -84.42, accuracy: 10 } }, null);

    expect(haySoporte()).toBe(true);
  });

  /**
   * Un boton que aparece y falla se lee como un fallo de la plataforma.
   * Por eso el boton no se pinta cuando esto da false.
   */
  it('es false cuando el navegador no lo expone', () => {
    vi.stubGlobal('navigator', {});

    expect(haySoporte()).toBe(false);
  });

  it('es false en un entorno sin navigator', () => {
    vi.stubGlobal('navigator', undefined);

    expect(haySoporte()).toBe(false);
  });
});

describe('pedirUbicacion', () => {
  let getCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  });

  /**
   * Atajo para el caso feliz, que se repite en casi todas las pruebas.
   */
  const conPosicion = (latitud: number, longitud: number, exactitud: number | null = 10) => {
    getCurrentPosition.mockImplementation((ok: PositionCallback) => {
      ok({
        coords: { latitude: latitud, longitude: longitud, accuracy: exactitud },
      } as GeolocationPosition);
    });
  };

  /**
   * `enableHighAccuracy` es lo que separa "la torre de celular" de "el
   * GPS". Con la torre, el error puede ser de 200 m, y una persona
   * señalando su casa publicaria en la casa de al lado.
   */
  it('pide alta precision', async () => {
    conPosicion(10.32, -84.42, 12);

    await pedirUbicacion();

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );
  });

  /**
   * Diez segundos. De menos falla donde la ubicacion si iba a llegar;
   * de mas deja a alguien pensando que el boton no funciona.
   */
  it('tiene tiempo maximo', async () => {
    conPosicion(10.32, -84.42, 12);

    await pedirUbicacion();

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ timeout: TIEMPO_MAXIMO }),
    );
  });

  /**
   * `maximumAge: 0` obliga a preguntar de nuevo en vez de usar una
   * posicion vieja de la cache del navegador, que puede ser de hace
   * media hora.
   */
  it('no acepta una posicion cacheada', async () => {
    conPosicion(10.32, -84.42, 12);

    await pedirUbicacion();

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ maximumAge: 0 }),
    );
  });

  it('devuelve la posicion en una promesa', async () => {
    getCurrentPosition.mockImplementation((ok: PositionCallback) => {
      ok({
        coords: { latitude: 10.3236, longitude: -84.4274, accuracy: 8 },
      } as GeolocationPosition);
    });

    await expect(pedirUbicacion()).resolves.toEqual({
      latitud: 10.3236,
      longitud: -84.4274,
      exactitud: 8,
    });
  });

  /**
   * La API es de 2012 y usa callbacks. Este wrapper existe para que el
   * componente pueda usar await y no un then anidado.
   */
  it.each([1, 2, 3])('rechaza con el codigo %i cuando el navegador falla', async (codigo) => {
    getCurrentPosition.mockImplementation(
      (_ok: PositionCallback, ko?: PositionErrorCallback | null) => {
        ko?.(errorDePosicion(codigo));
      },
    );

    await expect(pedirUbicacion()).rejects.toBe(codigo);
  });
});

describe('mensajeDeError', () => {
  /**
   * Los tres se dicen distinto porque la accion es distinta, y quien no
   * entiende que hacer no va a pulsar "reintentar" con la misma fe.
   */
  it('el permiso denegado dice que hay que cambiarlo en el navegador', () => {
    expect(mensajeDeError(1)).toMatch(/permisos/i);
  });

  it('la posicion no disponible dice que el dispositivo no sabe', () => {
    expect(mensajeDeError(2)).toMatch(/dispositivo/i);
  });

  /**
   * El timeout es el unico de los tres que puede funcionar al reintentar,
   * y por eso su mensaje ofrece otra vez.
   */
  it('el timeout ofrece reintentar o escribir el distrito', () => {
    expect(mensajeDeError(3)).toMatch(/otra vez/i);
  });

  /**
   * Ninguno dice "falló": suena a caida del servidor, y el documento
   * pide que la plataforma se sienta confiable.
   */
  it('ninguno dice que fallo', () => {
    for (const codigo of [1, 2, 3]) {
      expect(mensajeDeError(codigo)).not.toMatch(/falló|error/i);
    }
  });

  /**
   * Un codigo desconocido no debe devolver `undefined` en pantalla: el
   * navegador puede inventarse codigos nuevos.
   */
  it('un codigo desconocido cae en un mensaje util', () => {
    expect(mensajeDeError(99)).toMatch(/mover el mapa/i);
    expect(mensajeDeError(null)).toMatch(/mover el mapa/i);
  });

  it('todos los mensajes son distintos entre si', () => {
    const mensajes = [1, 2, 3].map(mensajeDeError);

    expect(new Set(mensajes).size).toBe(3);
  });
});

describe('textos', () => {
  /**
   * En Chrome y Safari la peticion abre una ventana del navegador que
   * puede quedarse esperando. Sin este texto, la persona cree que la
   * pagina se congelo.
   */
  it('el texto de espera esta en espanol', () => {
    expect(ESPERANDO).toMatch(/buscando/i);
  });

  it('el motivo del permiso explica para que se pide', () => {
    expect(MOTIVO).toMatch(/cerca/i);
  });
});
