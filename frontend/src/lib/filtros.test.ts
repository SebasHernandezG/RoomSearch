import { describe, expect, it } from 'vitest';

import {
  MAX_CHIPS,
  chipsVisibles,
  escribirEnUrl,
  filtrosActivos,
  filtrosDesdeUrl,
  hayFiltros,
  limpiar,
  quitarFiltro,
  quitarTodos,
} from './filtros';

/**
 * Los filtros de la busqueda. DS-6.
 *
 * Lo que se prueba aqui es la logica, no el pintado: la hoja y los
 * chips son vistas de estas funciones, y un chip que no corresponde con
 * lo que hace el control al lado es el error que hace perder la
 * confianza en toda la pantalla.
 */

describe('limpiar', () => {
  /**
   * El caso que motivo el comentario del codigo.
   *
   * `parking: false` en la API significa "tiene parqueo". Mandarlo
   * cambia los resultados sin que nadie lo haya pedido, asi que
   * `false` no viaja nunca.
   */
  it('no manda false en los booleanos', () => {
    const limpio = limpiar({ parking: false, furnished: false, pets_allowed: false });

    expect(limpio).toEqual({});
  });

  it('manda true en los booleanos', () => {
    expect(limpiar({ parking: true, furnished: true })).toEqual({
      parking: true,
      furnished: true,
    });
  });

  /**
   * El cero es un filtro valido. Un alquiler de 0 colones es un
   * intercambio o una ayudada, y con un truthy "hasta ₡0" se
   * convertiria en "sin filtro de precio" sin avisar.
   */
  it('respeta el cero en los precios', () => {
    expect(limpiar({ max_rent: 0 }).max_rent).toBe(0);
    expect(limpiar({ min_rent: 0 }).min_rent).toBe(0);
  });

  it('respeta el cero en los contadores', () => {
    expect(limpiar({ bedrooms: 0 }).bedrooms).toBe(0);
  });

  it('quita lo vacio', () => {
    expect(limpiar({ type: '', q: '  ', district: '' })).toEqual({});
  });

  it('conserva todo lo que tiene valor', () => {
    const limpio = limpiar({
      type: 'casa',
      min_rent: 100,
      max_rent: 300,
      currency: 'USD',
      bedrooms: 2,
      district: 'Zarcero',
      sort: 'price_asc',
    });

    expect(limpio.type).toBe('casa');
    expect(limpio.currency).toBe('USD');
    expect(limpio.district).toBe('Zarcero');
    expect(limpio.sort).toBe('price_asc');
  });
});

describe('filtrosActivos', () => {
  it('no hay chips sin filtros', () => {
    expect(filtrosActivos({})).toEqual([]);
  });

  it('pone el nombre del tipo, no la clave', () => {
    expect(filtrosActivos({ type: 'apartamento' })[0].texto).toBe('Apartamento');
  });

  /**
   * Dos rangos con los mismos numeros en distinta moneda son
   * respuestas distintas. Sin el simbolo, el chip miente.
   */
  it('el rango usa el simbolo de la moneda', () => {
    const [enColones] = filtrosActivos({ min_rent: 250000, max_rent: 350000 });
    const [enDolares] = filtrosActivos({
      min_rent: 250,
      max_rent: 350,
      currency: 'USD',
    });

    expect(enColones.texto).toBe('₡250000–₡350000');
    expect(enDolares.texto).toBe('US$250–US$350');
  });

  it('solo el maximo se lee "hasta"', () => {
    expect(filtrosActivos({ max_rent: 350000 })[0].texto).toBe('Hasta ₡350000');
  });

  it('solo el minimo se lee "desde"', () => {
    expect(filtrosActivos({ min_rent: 200000 })[0].texto).toBe('Desde ₡200000');
  });

  /**
   * `0` tiene que salir como chip. Si el rango se armara con un
   * truthy, "hasta ₡0" --una palabra-- se perderia sin avisar.
   */
  it('un rango hasta cero sale como chip', () => {
    expect(filtrosActivos({ max_rent: 0 })).toHaveLength(1);
  });

  it('la clave del chip es el filtro que quita', () => {
    const activos = filtrosActivos({ type: 'casa', parking: true });

    expect(activos.map((a) => a.clave)).toEqual(['type', 'parking']);
  });

  it('los booleanos en false no cuentan como activos', () => {
    expect(filtrosActivos({ furnished: false, parking: false })).toEqual([]);
  });

  it('cada chip tiene texto', () => {
    const activos = filtrosActivos({
      type: 'casa',
      max_rent: 300000,
      bedrooms: 2,
      district: 'Grecia',
      q: 'terraza',
      furnished: true,
      pets_allowed: true,
      parking: true,
    });

    expect(activos).toHaveLength(8);

    for (const activo of activos) {
      expect(activo.texto.length).toBeGreaterThan(0);
    }
  });
});

describe('chipsVisibles', () => {
  it('muestra hasta el maximo', () => {
    const { visibles, ocultos } = chipsVisibles({
      type: 'casa',
      max_rent: 300000,
      bedrooms: 2,
    });

    expect(visibles).toHaveLength(MAX_CHIPS);
    expect(ocultos).toBe(0);
  });

  /**
   * DS-6 pide `[ Apartamento x ] [ ₡200-350k x ] [ +2 x ]`. Con mas
   * de tres activos sin colapsar, los chips empujan la lista de
   * resultados fuera de la pantalla en movil.
   */
  it('colapsa lo que sobra en "+N"', () => {
    const { visibles, ocultos } = chipsVisibles({
      type: 'casa',
      max_rent: 300000,
      bedrooms: 2,
      district: 'Grecia',
      furnished: true,
    });

    expect(visibles).toHaveLength(MAX_CHIPS);
    expect(ocultos).toBe(2);
  });

  it('nada que ocultar con pocos filtros', () => {
    expect(chipsVisibles({ type: 'casa' }).ocultos).toBe(0);
  });

  it('no hay ocultos sin filtros', () => {
    expect(chipsVisibles({})).toEqual({ visibles: [], ocultos: 0 });
  });
});

describe('quitarFiltro', () => {
  it('quita el filtro del chip', () => {
    expect(quitarFiltro({ type: 'casa', parking: true }, 'parking')).toEqual({ type: 'casa' });
  });

  /**
   * El chip de rango quita **los dos** a la vez. Si solo quitara el
   * maximo, el chip se partiria en "Desde ₡200000" y el filtro que
   * la persona queria quitar seguiria puesto.
   */
  it('el chip de precio quita el rango completo', () => {
    const resto = quitarFiltro({ min_rent: 200000, max_rent: 350000, type: 'casa' }, 'precio');

    expect(resto).toEqual({ type: 'casa' });
  });

  it('no toca los demas filtros', () => {
    const filtros = { type: 'casa', bedrooms: 2, district: 'Grecia' };

    expect(quitarFiltro(filtros, 'bedrooms')).toEqual({ type: 'casa', district: 'Grecia' });
  });

  it('no muta el filtro original', () => {
    const original = { type: 'casa', parking: true };

    quitarFiltro(original, 'parking');

    expect(original.parking).toBe(true);
  });

  it('quitar lo que no esta no rompe nada', () => {
    expect(quitarFiltro({ type: 'casa' }, 'parking')).toEqual({ type: 'casa' });
  });
});

describe('quitarTodos', () => {
  /**
   * El orden se queda. Quitar todos los filtros es limpiar la
   * busqueda, no devolver la pagina a como estaba al entrar: alguien
   * que estaba viendo "precio: menor" y quita el tipo quiere seguir
   * viendo los mas baratos.
   */
  it('quita todo menos el orden', () => {
    expect(quitarTodos({ type: 'casa', parking: true, sort: 'price_asc' })).toEqual({
      sort: 'price_asc',
    });
  });

  it('no inventa el orden si no habia', () => {
    expect(quitarTodos({ type: 'casa' })).toEqual({});
  });
});

describe('la URL', () => {
  it('escribe los filtros', () => {
    const query = escribirEnUrl({ type: 'apartamento', max_rent: 350000, bedrooms: 2 });

    expect(query).toContain('type=apartamento');
    expect(query).toContain('max_rent=350000');
    expect(query).toContain('bedrooms=2');
  });

  /**
   * `sort` cambia con cada toque y `page` con cada scroll. Meterlos
   * llena el enlace que la gente copia de "mas recientes" con ruido.
   */
  it('no escribe el orden ni la pagina', () => {
    const query = escribirEnUrl({ type: 'casa', sort: 'price_asc', page: 3 });

    expect(query).not.toContain('sort');
    expect(query).not.toContain('page');
  });

  it('devuelve cadena vacia sin filtros, para no llenar el historial', () => {
    expect(escribirEnUrl({})).toBe('');
  });

  it('no escribe false en los booleanos', () => {
    expect(escribirEnUrl({ parking: false })).toBe('');
  });

  it('lee los filtros de la query', () => {
    expect(filtrosDesdeUrl('?type=apartamento&max_rent=350000&bedrooms=2')).toEqual({
      type: 'apartamento',
      max_rent: 350000,
      bedrooms: 2,
    });
  });

  it('lee los booleanos', () => {
    expect(filtrosDesdeUrl('?parking=true&furnished=true')).toEqual({
      parking: true,
      furnished: true,
    });
  });

  it('ignora los booleanos que no son true', () => {
    expect(filtrosDesdeUrl('?parking=false&parking2=si')).toEqual({});
  });

  /**
   * Un `sort` inventado viaja al backend y la API responde 422, o
   * peor, lo ignora y devuelve un orden que nadie pidio.
   */
  it('ignora un orden que no existe', () => {
    expect(filtrosDesdeUrl('?sort=barato').sort).toBeUndefined();
  });

  it('acepta un orden que si existe', () => {
    expect(filtrosDesdeUrl('?sort=price_desc').sort).toBe('price_desc');
  });

  it('ignora una moneda que no existe', () => {
    expect(filtrosDesdeUrl('?currency=GBP').currency).toBeUndefined();
  });

  it('acepta las dos monedas del proyecto', () => {
    expect(filtrosDesdeUrl('?currency=USD').currency).toBe('USD');
    expect(filtrosDesdeUrl('?currency=CRC').currency).toBe('CRC');
  });

  it('descarta un precio negativo', () => {
    expect(filtrosDesdeUrl('?min_rent=-500').min_rent).toBeUndefined();
  });

  it('acepta un precio en cero', () => {
    expect(filtrosDesdeUrl('?max_rent=0').max_rent).toBe(0);
  });

  it('descarta un precio que no es numero', () => {
    expect(filtrosDesdeUrl('?max_rent=mucho').max_rent).toBeUndefined();
  });

  it('descarta un precio vacio', () => {
    expect(filtrosDesdeUrl('?max_rent=').max_rent).toBeUndefined();
  });

  it('no guarda la pagina 1 en la URL pero si la lee de un enlace', () => {
    expect(filtrosDesdeUrl('?page=1').page).toBeUndefined();
    expect(filtrosDesdeUrl('?page=4').page).toBe(4);
  });

  it('ignora una pagina negativa o cero', () => {
    expect(filtrosDesdeUrl('?page=0').page).toBeUndefined();
    expect(filtrosDesdeUrl('?page=-2').page).toBeUndefined();
  });

  /**
   * El viaje redondo es la garantia de que un enlace compartido
   * devuelve la misma busqueda. Si `escribirEnUrl` empieza a mandar
   * algo que `filtrosDesdeUrl` no lee, el enlace miente en silencio.
   */
  it('el viaje redondo conserva los filtros', () => {
    const filtros = {
      type: 'casa',
      min_rent: 100000,
      max_rent: 300000,
      currency: 'CRC' as const,
      bedrooms: 3,
      bathrooms: 2,
      furnished: true,
      pets_allowed: true,
      parking: true,
      district: 'Zarcero',
      q: 'terraza',
    };

    expect(filtrosDesdeUrl(`?${escribirEnUrl(filtros)}`)).toEqual(filtros);
  });
});

describe('hayFiltros', () => {
  it('falso sin filtros', () => {
    expect(hayFiltros({})).toBe(false);
  });

  it('falso con solo el orden', () => {
    expect(hayFiltros({ sort: 'recent' })).toBe(false);
  });

  it('cierto con un filtro', () => {
    expect(hayFiltros({ type: 'casa' })).toBe(true);
  });
});
