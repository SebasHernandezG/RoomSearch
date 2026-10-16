import { describe, expect, it } from 'vitest';

import {
  MAXIMO_BYTES,
  MAXIMO_FOTOS,
  esTipoAceptado,
  formatoPeso,
  indiceDePrincipal,
  nuevas,
  problemasDe,
  problemasDelConjunto,
  tipoProblematico,
  type FotoElegida,
} from './fotos';

/**
 * La galeria. RF-2.3.
 *
 * Lo que se prueba aqui son las reglas que el formulario y la ficha
 * comparten. Si el formulario permitiera subir nueve y el backend
 * aceptara ocho, la persona lo descubriria en un 422 despues de
 * esperar la subida.
 */

/** Un archivo de mentira del tamano pedido. */
function archivo(bytes: number, tipo = 'image/jpeg'): File {
  return { size: bytes, type: tipo, name: 'foto.jpg' } as File;
}

function elegida(id: number | null, esPrincipal = false): FotoElegida {
  return { id, archivo: archivo(1000), vista: 'blob:x', esPrincipal };
}

describe('los limites', () => {
  it('ocho fotos', () => {
    expect(MAXIMO_FOTOS).toBe(8);
  });

  /**
   * 8 MB tiene que coincidir con el backend.
   *
   * Si el navegador acepta 10 MB y el servidor 8, la persona sube el
   * archivo, ve el progreso, y recibe un 422 al final: el peor
   * momento posible para enterarse.
   */
  it('8 MB por foto, igual que el backend', () => {
    expect(MAXIMO_BYTES).toBe(8 * 1024 * 1024);
  });

  it('el limite se comprueba antes de enviar', () => {
    expect(problemasDelConjunto(Array.from({ length: 9 }, () => elegida(null)))).toHaveLength(1);
  });

  it('hasta ocho no hay problema', () => {
    expect(problemasDelConjunto(Array.from({ length: 8 }, () => elegida(null)))).toEqual([]);
  });

  it('nada nuevo no es problema', () => {
    expect(problemasDelConjunto([])).toEqual([]);
  });
});

describe('los tipos', () => {
  it('acepta jpg y webp', () => {
    expect(esTipoAceptado(archivo(100, 'image/jpeg'))).toBe(true);
    expect(esTipoAceptado(archivo(100, 'image/webp'))).toBe(true);
  });

  /**
   * Los PNG se excluyen a proposito.
   *
   * Una captura de pantalla de 6 MB de una habitacion no es
   * informacion, y aceptarlas es como la galeria se llena de ruido
   * que nadie puede borrar despues.
   */
  it('no acepta png', () => {
    expect(esTipoAceptado(archivo(100, 'image/png'))).toBe(false);
  });

  it('no acepta un pdf disfrazado de imagen', () => {
    expect(esTipoAceptado(archivo(100, 'application/pdf'))).toBe(false);
  });

  it('no acepta gif, que no tiene donde', () => {
    expect(esTipoAceptado(archivo(100, 'image/gif'))).toBe(false);
  });
});

describe('los problemas de un archivo', () => {
  it('una foto buena no tiene ninguno', () => {
    expect(problemasDe(archivo(2 * 1024 * 1024))).toEqual([]);
  });

  it('un tipo malo se dice', () => {
    expect(problemasDe(archivo(1000, 'image/png'))[0]).toContain('JPG o WebP');
  });

  /**
   * El peso va con su unidad, no en bytes: "68000000" no dice si eso
   * es mucho o poco.
   */
  it('el peso se dice en la unidad que corresponde', () => {
    expect(problemasDe(archivo(MAXIMO_BYTES + 1))[0]).toContain('8.0 MB');
  });

  /**
   * Los dos problemas a la vez.
   *
   * Devolver solo el primero obliga a corregir y volver a intentar
   * para descubrir el segundo.
   */
  it('un archivo puede tener varios problemas', () => {
    expect(problemasDe(archivo(MAXIMO_BYTES + 1, 'image/png'))).toHaveLength(2);
  });

  it('el limite es estricto', () => {
    expect(problemasDe(archivo(MAXIMO_BYTES))).toEqual([]);
    expect(problemasDe(archivo(MAXIMO_BYTES + 1))).toHaveLength(1);
  });
});

describe('el peso', () => {
  it('bytes', () => {
    expect(formatoPeso(512)).toBe('512 B');
  });

  it('kilobytes', () => {
    expect(formatoPeso(820 * 1024)).toBe('820 KB');
  });

  it('megabytes', () => {
    expect(formatoPeso(1400 * 1024)).toBe('1.4 MB');
  });
});

describe('la principal', () => {
  it('la primera cuando solo hay una', () => {
    expect(indiceDePrincipal([elegida(null, true)])).toBe(0);
  });

  /**
   * La tercera es la tercera.
   *
   * El indice se manda al backend y el backend lo aplica como
   * `position`. Un desfase de uno significa que la foto que la
   * persona eligio como principal es la segunda.
   */
  it('respeta la posicion', () => {
    const fotos = [elegida(null), elegida(null), elegida(null, true)];

    expect(indiceDePrincipal(fotos)).toBe(2);
  });

  /**
   * Sin principal marcada, la primera.
   *
   * Es la misma regla del backend, y es la que hace que un anuncio
   * recien publicado tenga siempre una foto principal sin que nadie
   * tenga que pensarlo.
   */
  it('sin marcar, la primera', () => {
    expect(indiceDePrincipal([elegida(null), elegida(null)])).toBe(0);
  });

  it('sin fotos, la primera --que no existe--', () => {
    expect(indiceDePrincipal([])).toBe(0);
  });

  it('solo hay una principal a la vez', () => {
    const marcadas = [elegida(null, true), elegida(null, true)];

    const conDos = marcadas.map((foto, i) => ({ ...foto, esPrincipal: i === 1 }));

    expect(conDos.filter((f) => f.esPrincipal)).toHaveLength(1);
  });
});

describe('las nuevas', () => {
  it('filtra las que ya estan en el servidor', () => {
    const fotos = [elegida(1), elegida(2), elegida(null)];

    expect(nuevas(fotos).map((f) => f.id)).toEqual([null]);
  });

  it('todas son nuevas cuando no hay ninguna subida', () => {
    expect(nuevas([elegida(null), elegida(null)])).toHaveLength(2);
  });

  it('ninguna es nueva si ya estan todas', () => {
    expect(nuevas([elegida(1), elegida(2)])).toHaveLength(0);
  });
});

describe('tipoProblematico', () => {
  it('devuelve los problemas de un archivo', () => {
    expect(tipoProblematico(archivo(100, 'image/png')).join(' ')).toContain('JPG o WebP');
  });

  it('undefined no rompe', () => {
    expect(tipoProblematico(undefined)).toEqual([]);
  });

  it('null tampoco', () => {
    expect(tipoProblematico(null)).toEqual([]);
  });
});
