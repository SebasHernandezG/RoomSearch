/**
 * Los filtros de la busqueda: estado, URL y chips. DS-6.
 *
 * Todo lo que se puede decidir sin pintar nada vive aqui y se prueba
 * sin DOM. La hoja de filtros y los chips son vistas de esta logica,
 * no al reves: cuando un chip y un control discrepan, es porque la
 * decision se tomo dos veces y en un solo sitio se van aequivocar.
 *
 * ## Por que la URL y no solo memoria
 *
 * Un enlace con `?type=apartamento&max_rent=350000` es la unica forma
 * de que alguien pueda mandarle a otro la busqueda que ya esta
 * haciendo, y de que el boton de atras del navegador funcione. Por
 * eso `escribirEnUrl` existe y no es decoracion: el estado vive en la
 * URL y de ahi sale.
 *
 * La excepcion son `sort` y `page`: no van a la URL. El orden cambia
 * con cada toque y llenarla de `?sort=recent` al abrir la pagina es
 * ruido en el enlace que se copia.
 *
 * ## Por que `Filtros` se redeclara y no se importa
 *
 * El de `api.ts` es lo que viaja al servidor, con `lat`, `lng`,
 * `radius` y `page`. Este es el que el panel de filtros entiende.
 * Son dos cosas distintas: confundirlas es como aparece un `radius`
 * en un chip de filtro activo.
 */

export type Filtros = {
  type?: string;
  min_rent?: number;
  max_rent?: number;
  currency?: string;
  bedrooms?: number;
  bathrooms?: number;
  furnished?: boolean;
  pets_allowed?: boolean;
  parking?: boolean;
  district?: string;
  q?: string;
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'distance';
  page?: number;
};

/** Cuantos chips se muestran antes de colapsar en "+N". */
export const MAX_CHIPS = 3;

const MONEDA: Record<string, string> = { CRC: '₡', USD: 'US$' };

const TIPOS: Record<string, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  habitacion: 'Habitación',
  estudio: 'Estudio',
};

const ORDENES: Record<string, string> = {
  recent: 'Más recientes',
  price_asc: 'Precio: menor',
  price_desc: 'Precio: mayor',
  distance: 'Más cerca',
};

/**
 * Que filtros van a la URL.
 *
 * `sort` y `page` fuera, por lo de arriba. Todo lo demas entra: son
 * filtros, y un filtro que no viaja en el enlace no se puede compartir.
 */
const EN_LA_URL = [
  'type',
  'min_rent',
  'max_rent',
  'currency',
  'bedrooms',
  'bathrooms',
  'furnished',
  'pets_allowed',
  'parking',
  'district',
  'q',
] as const;

/**
 * Limpia los filtros para mandarlos a la API.
 *
 * Quita lo que esta vacio y **no** manda `false` en los booleanos.
 *
 * `parking: false` significaria "sin parqueo" -- un filtro real, pero
 * uno raro y con el nombre equivocado. La API lo toma como "tiene
 * parqueo", y mandarlo cambia los resultados sin que nadie lo haya
 * pedido. Por eso los booleanos solo viajan cuando son `true`, y para
 * decir "sin parqueo" no hay filtro: no lo hay pedido en ningun lado.
 */
export function limpiar(filtros: Filtros): Filtros {
  const limpio: Filtros = {};

  if (filtros.type) limpio.type = filtros.type;
  if (filtros.min_rent !== undefined) limpio.min_rent = filtros.min_rent;
  if (filtros.max_rent !== undefined) limpio.max_rent = filtros.max_rent;
  if (filtros.currency) limpio.currency = filtros.currency;
  if (filtros.bedrooms !== undefined) limpio.bedrooms = filtros.bedrooms;
  if (filtros.bathrooms !== undefined) limpio.bathrooms = filtros.bathrooms;
  if (filtros.district) limpio.district = filtros.district;
  if (filtros.sort) limpio.sort = filtros.sort;
  if (filtros.page !== undefined) limpio.page = filtros.page;

  /*
   * Los tres textos se recortan antes de decidir si estan vacios.
   *
   * Sin el recorte, una busqueda de dos espacios --lo que queda
   * cuando se borra lo escrito-- pasa el `if` porque "  " es truthy,
   * viaja a la API y sale en el enlace como `?q=++`. El recorte hace
   * que el filtro vacio se trate como vacio en los dos caminos.
   */
  const q = filtros.q?.trim();

  if (q) limpio.q = q;

  if (filtros.furnished) limpio.furnished = true;
  if (filtros.pets_allowed) limpio.pets_allowed = true;
  if (filtros.parking) limpio.parking = true;

  return limpio;
}

/**
 * Un filtro activo, con el texto corto del chip.
 *
 * `clave` es lo que se quita al tocar el chip, asi que tiene que ser
 * la clave exacta del filtro -- no la del control, ni el indice.
 */
export type FiltroActivo = {
  clave: string;
  texto: string;
};

/**
 * Los filtros que se pueden quitar tocando un chip.
 *
 * El texto se arma con los rangos de la moneda correcta: un filtro
 * de ₡250k a ₡350k y uno de US$250 a US$350 se ven iguales en
 * numeros y son cosas distintas. Sin el simbolo, el chip miente.
 */
export function filtrosActivos(filtros: Filtros): FiltroActivo[] {
  const activos: FiltroActivo[] = [];
  const simbolo = MONEDA[filtros.currency ?? 'CRC'] ?? '';

  if (filtros.type) {
    activos.push({ clave: 'type', texto: TIPOS[filtros.type] ?? filtros.type });
  }

  const { min_rent: min, max_rent: max } = filtros;

  if (min !== undefined && max !== undefined) {
    activos.push({ clave: 'precio', texto: `${simbolo}${min}–${simbolo}${max}` });
  } else if (max !== undefined) {
    activos.push({ clave: 'max_rent', texto: `Hasta ${simbolo}${max}` });
  } else if (min !== undefined) {
    activos.push({ clave: 'min_rent', texto: `Desde ${simbolo}${min}` });
  }

  if (filtros.bedrooms !== undefined) {
    activos.push({
      clave: 'bedrooms',
      texto: `${filtros.bedrooms}+ hab`,
    });
  }

  if (filtros.bathrooms !== undefined) {
    activos.push({ clave: 'bathrooms', texto: `${filtros.bathrooms}+ baños` });
  }

  if (filtros.district) {
    activos.push({ clave: 'district', texto: filtros.district });
  }

  if (filtros.q) {
    activos.push({ clave: 'q', texto: `“${filtros.q}”` });
  }

  if (filtros.furnished) activos.push({ clave: 'furnished', texto: 'Amueblado' });
  if (filtros.pets_allowed) activos.push({ clave: 'pets_allowed', texto: 'Con mascotas' });
  if (filtros.parking) activos.push({ clave: 'parking', texto: 'Con parqueo' });

  return activos;
}

/**
 * Los chips con el "y el resto" de DS-6.
 *
 * Con mas de tres activos, los ultimos no caben en una fila de movil
 * sin empujar los resultados fuera de la pantalla. El "+N" los
 * conserva y los deja a un toque de distancia, en vez de esconderlos
 * sin avisar.
 */
export function chipsVisibles(filtros: Filtros): { visibles: FiltroActivo[]; ocultos: number } {
  const activos = filtrosActivos(filtros);

  return {
    visibles: activos.slice(0, MAX_CHIPS),
    ocultos: Math.max(0, activos.length - MAX_CHIPS),
  };
}

/**
 * Quita un filtro por la clave del chip.
 *
 * La clave `precio` no es un campo del filtro sino los dos a la vez:
 * un chip de rango tiene que quitar el rango, no dejar la mitad.
 */
export function quitarFiltro(filtros: Filtros, clave: string): Filtros {
  if (clave === 'precio') {
    const { min_rent: _min, max_rent: _max, ...resto } = filtros;

    return resto;
  }

  const copia = { ...filtros };

  delete copia[clave as keyof Filtros];

  return copia;
}

/**
 * Quita todos los filtros y vuelve a la pagina 1.
 *
 * La pagina se reinicia porque el filtro nuevo casi siempre deja menos
 * resultados: quedarse en la pagina 4 de 6 con un filtro nuevo da una
 * lista vacia que parece un error del servidor.
 */
export function quitarTodos(filtros: Filtros): Filtros {
  return limpiar({ sort: filtros.sort });
}

/**
 * Los filtros que salen de la query de la URL.
 *
 * Se construye con `URLSearchParams` y no con `location.search`: asi
 * la funcion es pura y se puede probar sin DOM.
 *
 * `sort` y `page` si se leen de la URL: aunque no se escriban,
 * alguien puede pegarlos a mano, y leerlos no cuesta nada.
 */
export function filtrosDesdeUrl(busqueda: string): Filtros {
  const params = new URLSearchParams(busqueda);

  const filtros: Filtros = {};

  const entero = (clave: string): number | undefined => {
    const bruto = params.get(clave);

    if (bruto === null || bruto.trim() === '') return undefined;

    const valor = Number(bruto);

    return Number.isFinite(valor) ? valor : undefined;
  };

  const numero = (clave: string): number | undefined => {
    const valor = entero(clave);

    return valor !== undefined && valor >= 0 ? valor : undefined;
  };

  const booleano = (clave: string): true | undefined =>
    params.get(clave) === 'true' ? true : undefined;

  const texto = (clave: string): string | undefined => {
    const valor = params.get(clave)?.trim();

    return valor ? valor : undefined;
  };

  const type = texto('type');
  if (type) filtros.type = type;

  const min_rent = numero('min_rent');
  if (min_rent !== undefined) filtros.min_rent = min_rent;

  const max_rent = numero('max_rent');
  if (max_rent !== undefined) filtros.max_rent = max_rent;

  const currency = texto('currency');
  if (currency === 'CRC' || currency === 'USD') filtros.currency = currency;

  const bedrooms = numero('bedrooms');
  if (bedrooms !== undefined) filtros.bedrooms = bedrooms;

  const bathrooms = numero('bathrooms');
  if (bathrooms !== undefined) filtros.bathrooms = bathrooms;

  const furnished = booleano('furnished');
  if (furnished) filtros.furnished = furnished;

  const pets_allowed = booleano('pets_allowed');
  if (pets_allowed) filtros.pets_allowed = pets_allowed;

  const parking = booleano('parking');
  if (parking) filtros.parking = parking;

  const district = texto('district');
  if (district) filtros.district = district;

  const q = texto('q');
  if (q) filtros.q = q;

  const sort = texto('sort');
  if (sort && sort in ORDENES) filtros.sort = sort as NonNullable<Filtros['sort']>;

  const page = entero('page');
  if (page !== undefined && page > 1) filtros.page = page;

  return filtros;
}

/**
 * La query de la URL para un conjunto de filtros.
 *
 * Devuelve `''` cuando no hay nada que escribir, para que el
 *History API no guarde una entrada vacia por cada cambio de filtro:
 * sin esto, el boton de atras de Android recorre cada tecla escrita
 * en el buscador.
 */
export function escribirEnUrl(filtros: Filtros): string {
  const limpio = limpiar(filtros);

  const params = new URLSearchParams();

  for (const clave of EN_LA_URL) {
    const valor = limpio[clave];

    if (valor === undefined) continue;

    params.set(clave, String(valor));
  }

  return params.toString();
}

/** El nombre corto de un orden, para el selector. */
export function nombreOrden(orden: Filtros['sort']): string {
  return orden ? (ORDENES[orden] ?? orden) : ORDENES.recent;
}

/** Los filtros que la hoja necesita para el boton de "Ver N". */
export function hayFiltros(filtros: Filtros): boolean {
  return filtrosActivos(filtros).length > 0;
}
