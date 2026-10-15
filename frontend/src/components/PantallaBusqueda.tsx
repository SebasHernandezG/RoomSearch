/**
 * Pantalla de busqueda por zona. DS-7.
 *
 * Movil: pestanas de 56 px, el mapa arranca por defecto porque es lo
 * que distingue esta plataforma de un listado clasico.
 *
 * Escritorio: mapa 55 % izquierda, lista 45 % derecha con scroll
 * propio. La lista nunca pierde el contexto del mapa.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import Cargando from './Cargando';
import { useAvisos } from './ProveedorAvisos';
import { avisoCache, guardarCache, leerCache } from '../lib/cache';
import ChipsActivos from './filtros/ChipsActivos';
import PanelFiltros from './filtros/PanelFiltros';
import PropertyCard from './PropertyCard';
import { ErrorConexion, SinResultados } from './estadosBusqueda';
import PropertyMap, { RADIOS, type PuntoZona } from './mapa/PropertyMap';
import SelectorRadio from './mapa/SelectorRadio';
import { ErrorApi, listarPropiedades, type Filtros as FiltrosApi } from '../lib/api';
import {
  escribirEnUrl,
  filtrosActivos,
  filtrosDesdeUrl,
  limpiar,
  type Filtros,
} from '../lib/filtros';
import { MICROCOPY } from '../lib/microcopy';
import type { Property } from '../types/property';

type Vista = 'mapa' | 'lista';
type Estado = 'cargando' | 'listo' | 'error';

/** Radio inicial de DS-7: 1 km cubre casi todo San Carlos. */
const ZONA_INICIAL: PuntoZona = { latitud: 10.3236, longitud: -84.4274, metros: 1000 };

export default function PantallaBusqueda() {
  const [vista, setVista] = useState<Vista>('mapa');
  const [estado, setEstado] = useState<Estado>('cargando');
  const [propiedades, setPropiedades] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [zona, setZona] = useState<PuntoZona | null>(ZONA_INICIAL);
  const [resaltada, setResaltada] = useState<number | null>(null);
  const [favoritos, setFavoritos] = useState<number[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({});
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const avisar = useAvisos();
  const [desdeCache, setDesdeCache] = useState(false);

  /*
   * Segundos que faltan para poder volver a pedir, o null si no hay
   * espera activa. Lo llena el 429 de RNF-05.
   */
  const [espera, setEspera] = useState<number | null>(null);

  const temporizador = useRef<number | null>(null);

  /*
   * La zona viva, para compararla sin esperar al re-render.
   *
   * Va en un ref y no en el estado a proposito: alMoverZona necesita
   * leer la zona anterior en el momento en que llega la nueva, y leerla
   * del estado lo daria desfasada por un render.
   */
  const zonaActual = useRef<PuntoZona | null>(ZONA_INICIAL);

  /*
   * Carga contra la API real.
   *
   * La distancia la calcula MySQL con ST_Distance_Sphere, nunca el
   * navegador: el issue #16 documenta las tres trampas de MySQL que
   * hacen que esto no se pueda replicar en el cliente sin fallar.
   *
   * Los filtros del panel se mezclan **aqui**, no en cada llamada.
   * Hay cinco sitios que disparan una busqueda --el montaje, el mapa
   * movido, el radio, el chip y la hoja-- y si cada uno tuviera que
   * acordarse de los filtros, uno de ellos se olvidaria y el filtro
   * desapareceria solo al mover el mapa. Es el error mas dificil de
   * reportar: funciona hasta que alguien arrastra el mapa.
   */
  const filtrosVivos = useRef<Filtros>({});

  useEffect(() => {
    filtrosVivos.current = filtros;
  }, [filtros]);

  const cargar = useCallback(
    async (base: FiltrosApi) => {
      setEstado('cargando');

      try {
        const respuesta = await listarPropiedades({
          ...filtrosAAjax(filtrosVivos.current),
          ...base,
        });

        setPropiedades(respuesta.data);
        setTotal(respuesta.meta.total);
        setEspera(null);
        setEstado('listo');

        /*
         * DS-4, estado 5: se guarda lo ultimo que **si** funciono.
         *
         * Solo en exito. Guardar tambien un error serviria para
         * mostrar un fallo guardado como si fuera un resultado, y la
         * siguiente vez que abrieran la pagina sin red verian un
         * error viejo como si fuera el de ahora.
         */
        guardarCache(respuesta.meta.total, respuesta.data);
        setDesdeCache(false);
      } catch (error) {
        // 422 es validacion del cliente: el backend ya explico que esta
        // mal, no es un fallo de conexion al que reintentar.
        if (error instanceof ErrorApi && error.codigo === 422) {
          setPropiedades([]);
          setTotal(0);
          setEstado('listo');
          return;
        }

        /*
         * 429 es RNF-05: se acabo el techo. No es una pagina rota y
         * reintentar ahora solo lo agrava. Se avisa cuando toca volver
         * a intentarlo.
         *
         * Se conservan los resultados que ya habia en pantalla. Tirar la
         * lista porque el servidor pidio esperar seria castigar a
         * alguien por haber cargado mucho.
         */
        if (error instanceof ErrorApi && error.codigo === 429) {
          setEspera(Math.max(0, error.esperarSegundos ?? 60));
          setEstado('listo');
          return;
        }

        /*
         * DS-4, estado 5: sin conexion, la app sigue funcionando.
         *
         * Se intenta el cache **antes** de rendirse. La pantalla de
         * error con un boton de "Reintentar" es el ultimo recurso, no
         * el primero: si hay algo guardado, se muestra con un aviso
         * discreto en vez de dejar a la persona frente a un hueco.
         *
         * El aviso no es el toast de DS-11 --ese se descarta--, sino
         * una banda sobre la lista que se queda mientras siga sin
         * red. "Sin conexion, te mostramos lo ultimo que cargamos"
         * escrito en un cartel que desaparece a los cuatro segundos
         * es peor que no escribirlo: uno ya esta leyendo la lista.
         */
        const cache = leerCache();

        if (cache !== null) {
          setPropiedades(cache.data);
          setTotal(cache.total);
          setDesdeCache(true);
          setEstado('listo');

          return;
        }

        setEstado('error');

        /*
         * DS-11: el error de conexion no se descarta solo, y ademas se
         * dice **aqui**. La pantalla ya tiene su propio estado de error
         * con su boton de reintentar; el aviso suma lo que paso para
         * quien no llega a leerlo. Y vive en un toast, no en la lista:
         * pintado en medio de los resultados, taparia los ultimos que
         * si se pudieron cargar.
         */
        avisar.error(MICROCOPY.general.conexionPerdida);
      }
    },
    [avisar],
  );

  /*
   * El montaje lee los filtros de la URL **antes** de la primera
   * busqueda.
   *
   * Las dos filas estan aqui y no en dos `useEffect` independientes
   * porque el orden importa: este efecto corre antes que el siguiente
   * en el mismo commit, y por eso `cargar` ya encuentra los filtros
   * del enlace en el ref. Separados, un enlace compartido abriria la
   * pagina con los chips puestos y la lista sin filtrar.
   */
  useEffect(() => {
    filtrosVivos.current = filtrosDesdeUrl(window.location.search);
    setFiltros(filtrosVivos.current);
  }, []);

  useEffect(() => {
    void cargar({
      lat: ZONA_INICIAL.latitud,
      lng: ZONA_INICIAL.longitud,
      radius: ZONA_INICIAL.metros,
      sort: filtrosVivos.current.sort ?? 'distance',
    });
  }, [cargar]);

  /*
   * Cuenta regresiva de la espera impuesta por RNF-05.
   *
   * Vive en el componente y no en la respuesta del error porque el
   * tiempo pasa aunque no haya peticiones: si dependiera de un
   * temporizador creado al recibir el 429, recargar la pantalla lo
   * reiniciaria.
   */
  useEffect(() => {
    if (espera === null) return;

    if (espera === 0) {
      setEspera(null);
      return;
    }

    const id = window.setTimeout(() => setEspera(espera - 1), 1000);

    return () => window.clearTimeout(id);
  }, [espera]);

  /*
   * RF-3.5: debounce de 300 ms al mover el mapa. Sin esto, cada pixel
   * genera una peticion.
   *
   * Ademas se descarta la zona que no cambio de verdad. Ajustar el
   * encuadre al circulo devuelve el centro al mismo sitio, asi que sin
   * esta comparacion cada ajuste volvia a disparar una busqueda: se
   * midieron 779 peticiones seguidas y la pantalla nunca salia de
   * "cargando".
   */
  const alMoverZona = useCallback(
    (nueva: PuntoZona | null) => {
      if (nueva && zonaActual.current && sonLaMismaZona(zonaActual.current, nueva)) {
        return;
      }

      if (temporizador.current !== null) {
        window.clearTimeout(temporizador.current);
      }

      temporizador.current = window.setTimeout(() => {
        zonaActual.current = nueva;
        setZona(nueva);

        void cargar(
          nueva
            ? { lat: nueva.latitud, lng: nueva.longitud, radius: nueva.metros, sort: 'distance' }
            : {},
        );
      }, 300);
    },
    [cargar],
  );

  useEffect(
    () => () => {
      if (temporizador.current !== null) {
        window.clearTimeout(temporizador.current);
      }
    },
    [],
  );

  const cambiarRadio = useCallback(
    (metros: number) => {
      if (!zona) return;

      const nueva = { ...zona, metros };

      zonaActual.current = nueva;
      setZona(nueva);

      void cargar({
        lat: nueva.latitud,
        lng: nueva.longitud,
        radius: nueva.metros,
        sort: filtrosVivos.current.sort ?? 'distance',
      });
    },
    [zona, cargar],
  );

  const cambiarFiltros = useCallback(
    (nuevos: Filtros) => {
      setFiltros(nuevos);

      /*
       * `replace` y no `push`: cada cambio de filtro es una correccion
       * de la misma busqueda, no un sitio nuevo. Con `push`, el atras
       * del navegador --que en Android es el gesto de volver-- recorre
       * cada tecla escrita en el buscador.
       */
      const query = escribirEnUrl(nuevos);

      window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);

      /*
       * Cada cambio de filtro vuelve a la pagina 1. Quedarse en la
       * pagina 4 con un filtro nuevo da una lista vacia que parece un
       * error del servidor.
       */
      void cargar({
        ...filtrosAAjax(nuevos),
        ...(zona ? { lat: zona.latitud, lng: zona.longitud, radius: zona.metros } : {}),
      });
    },
    [cargar, zona],
  );

  const visibles = propiedades.map((p) => ({ ...p, is_favorite: favoritos.includes(p.id) }));

  /*
   * Cuantos filtros hay puestos, para el contador del boton flotante.
   *
   * Sin esto, alguien en la vista de mapa no tiene forma de saber que
   * hay un filtro puesto: los chips viven arriba de la lista y en el
   * mapa no se ven.
   */
  const activos = filtrosActivos(filtros).length;

  const lista = (
    <div className="h-full overflow-y-auto p-4">
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <SelectorRadio valor={zona?.metros ?? RADIOS[1]!} onCambio={cambiarRadio} />
      </div>

      {/*
        Los chips van **encima** de los resultados, no escondidos en la
        hoja. Con la hoja cerrada el chip es la unica prueba de que el
        filtro sigue puesto: sin el, "no aparecio nada" y "estoy
        filtrando y no hay nada" son el mismo mensaje, y el equivocado
        cuesta una publicacion.
      */}

      {/*
       * La banda de sin conexion.
       *
       * Va **encima** de la lista y se queda mientras siga sin red.
       * Un aviso que desaparece a los cuatro segundos es peor que
       * ninguno: la persona ya esta leyendo una lista que no va a
       * cambiar, y a los cinco segundos volveria a creer que esta
       * al dia.
       *
       * `role="status"` y no `alert`: no interrumpe, y no lo es -- la
       * app funciona.
       */}
      {desdeCache && (
        <div
          role="status"
          className="mb-3 flex items-start gap-3 rounded-md border border-line bg-sand px-4 py-3"
        >
          <span aria-hidden="true" className="mt-0.5 text-leaf">
            ·
          </span>
          <p className="text-small text-ink">{avisoCache(total)}</p>
        </div>
      )}

      <div className="mt-3">
        <ChipsActivos filtros={filtros} onCambio={cambiarFiltros} />
      </div>

      <p className="text-small mt-4 mb-3 text-stone">
        {total === 0
          ? 'Ningún inmueble en esta zona'
          : `${total} ${total === 1 ? 'inmueble' : 'inmuebles'} en esta zona`}
      </p>

      {estado === 'cargando' && <Cargando cantidad={3} />}

      {estado === 'error' && (
        <ErrorConexion
          onReintentar={() =>
            zona
              ? void cargar({
                  lat: zona.latitud,
                  lng: zona.longitud,
                  radius: zona.metros,
                  sort: 'distance',
                })
              : void cargar({})
          }
        />
      )}

      {/*
       * RNF-05. Va antes que la lista y no la reemplaza: si ya hay
       * resultados en pantalla, se quedan. Tirar la lista porque el
       * servidor pidió esperar sería castigar a alguien por haber
       * cargado mucho.
       */}
      {espera !== null && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex items-start gap-3 rounded-md border border-clay bg-sand px-4 py-3"
        >
          <span aria-hidden="true" className="mt-0.5 text-leaf">
            ⏳
          </span>
          <div>
            <p className="text-small font-semibold text-ink">{MICROCOPY.busqueda.espera.titulo}</p>
            <p className="text-caption text-stone">{MICROCOPY.busqueda.espera.detalle(espera)}</p>
          </div>
        </div>
      )}

      {estado === 'listo' && total === 0 && (
        <SinResultados radioActual={zona?.metros} onAmpliarRadio={cambiarRadio} />
      )}

      {estado === 'listo' && visibles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibles.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              onToggleFavorite={(propiedad) =>
                setFavoritos((previos) =>
                  previos.includes(propiedad.id)
                    ? previos.filter((x) => x !== propiedad.id)
                    : [...previos, propiedad.id],
                )
              }
              onHover={(id) => setResaltada(id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    /*
     * h-dvh y no h-screen: en movil la barra del navegador encoge la
     * pantalla y h-screen deja el mapa mas alto que lo que se ve.
     *
     * La cadena de alturas tiene que ser explicita en los tres niveles
     * (contenedor flex, panel y mapa). Si falta uno, h-full resuelve a
     * cero y Leaflet se dibuja sobre un div de 0 px.
     */
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      {/* Pestanas de movil: 56 px, el pulgar llega. */}
      <div
        role="tablist"
        aria-label="Vista de búsqueda"
        className="flex shrink-0 border-b border-line bg-paper lg:hidden"
      >
        {(
          [
            ['mapa', 'Mapa'],
            ['lista', 'Lista'],
          ] as const
        ).map(([clave, etiqueta]) => (
          <button
            key={clave}
            role="tab"
            type="button"
            aria-selected={vista === clave}
            aria-controls={`panel-${clave}`}
            id={`tab-${clave}`}
            onClick={() => setVista(clave)}
            className={`h-14 flex-1 text-body font-semibold transition-colors duration-200 motion-reduce:transition-none ${
              vista === clave ? 'border-b-2 border-forest text-forest' : 'text-stone'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {/*
        La columna de escritorio, como primer hijo de la cuadricula.

        Va **dentro** y no fija sobre la pantalla a proposito: si
        flotara, el mapa --que recalcula su tamano al redimensionar
        Leaflet-- no se enteraria de que le quitaron 280 px de ancho
        y se dibujaria debajo de la columna.
      */}
      <div className="hidden md:flex md:min-h-0">
        <PanelFiltros
          variante="columna"
          filtros={filtros}
          onCambio={cambiarFiltros}
          abierto={false}
          onCerrar={() => undefined}
          total={total}
          cargando={estado === 'cargando'}
        />
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[55fr_45fr]">
        <section
          role="tabpanel"
          id="panel-mapa"
          aria-labelledby="tab-mapa"
          className={`h-full min-h-0 ${vista === 'mapa' ? 'block' : 'hidden'} lg:block`}
        >
          <PropertyMap
            className="h-full w-full"
            propiedades={visibles}
            cargando={estado === 'cargando'}
            zona={zona}
            resaltada={resaltada}
            onMoverZona={alMoverZona}
            onSeleccionar={(id) => setResaltada(id)}
          />
        </section>

        <section
          role="tabpanel"
          id="panel-lista"
          aria-labelledby="tab-lista"
          className={`h-full min-h-0 overflow-hidden ${vista === 'lista' ? 'block' : 'hidden'} lg:block`}
        >
          {lista}
        </section>
      </div>

      {/*
        El boton flotante de movil, con el contador de activos.

        El contador va adentro y no solo en los chips: con la hoja
        cerrada los chips estan arriba de la lista y en la vista de
        mapa no se ven. Sin el numero, alguien en el mapa no tiene
        forma de saber que hay un filtro puesto.
      */}
      <button
        type="button"
        onClick={() => setHojaAbierta(true)}
        aria-haspopup="dialog"
        aria-expanded={hojaAbierta}
        className="fixed bottom-5 left-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 text-body font-semibold text-paper shadow-lg transition-colors duration-200 hover:bg-leaf motion-reduce:transition-none md:hidden"
      >
        Filtros
        {activos > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-paper px-1.5 text-small font-bold text-forest">
            {activos}
          </span>
        )}
      </button>

      {/*
        La hoja de movil. Se monta siempre para que la transicion de
        entrada y salida se vea; `pointer-events-none` y el
        desplazamiento la dejan fuera de la pantalla cuando esta
        cerrada.
      */}
      <PanelFiltros
        variante="hoja"
        filtros={filtros}
        onCambio={cambiarFiltros}
        abierto={hojaAbierta}
        onCerrar={() => setHojaAbierta(false)}
        total={total}
        cargando={estado === 'cargando'}
      />
    </div>
  );
}

/**
 * Si dos zonas cubren practicamente lo mismo.
 *
 * El mapa devuelve el centro con seis decimales, y ajustar el encuadre
 * al circulo lo devuelve al mismo punto. Sin esta tolerancia, cada
 * ajuste reventaba una peticion aunque la zona no hubiera cambiado.
 *
 * 50 m es medio bloque: por debajo se nota el temblor al arrastrar y
 * por encima dejas de sentir el mapa pegado al dedo.
 *
 * Va exportada para probar el limite de los 50 m, que es el numero
 * que evita el bucle de peticiones. Ver `.ai/rules/mapa-frontend.md`.
 */
export function sonLaMismaZona(a: PuntoZona, b: PuntoZona): boolean {
  const mediaMetrosPorGrado = 111_320;

  const metros = (unGrado: number) => unGrado * mediaMetrosPorGrado;

  return (
    a.metros === b.metros &&
    metros(Math.abs(a.latitud - b.latitud)) < 50 &&
    metros(Math.abs(a.longitud - b.longitud)) < 50
  );
}

/**
 * Los filtros del panel en la forma que espera la API.
 *
 * `currency` es el unico campo que no viaja. El backend deducela del
 * monto con su propia tabla de umbrales, asi que mandarla seria tirar
 * el valor a la basura; se usa solo para pintar los chips en la
 * moneda correcta.
 */
export function filtrosAAjax(filtros: Filtros): FiltrosApi {
  const { currency: _currency, ...resto } = limpiar(filtros);

  return resto;
}
