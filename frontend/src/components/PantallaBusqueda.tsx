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
import PropertyCard from './PropertyCard';
import { ErrorConexion, SinResultados } from './estadosBusqueda';
import PropertyMap, { RADIOS, type PuntoZona } from './mapa/PropertyMap';
import SelectorRadio from './mapa/SelectorRadio';
import { ErrorApi, listarPropiedades, type Filtros } from '../lib/api';
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
   */
  const cargar = useCallback(async (filtros: Filtros) => {
    setEstado('cargando');

    try {
      const respuesta = await listarPropiedades(filtros);

      setPropiedades(respuesta.data);
      setTotal(respuesta.meta.total);
      setEstado('listo');
    } catch (error) {
      // 422 es validacion del cliente: el backend ya explico que esta
      // mal, no es un fallo de conexion al que reintentar.
      if (error instanceof ErrorApi && error.codigo === 422) {
        setPropiedades([]);
        setTotal(0);
        setEstado('listo');
        return;
      }

      setEstado('error');
    }
  }, []);

  useEffect(() => {
    void cargar({
      lat: ZONA_INICIAL.latitud,
      lng: ZONA_INICIAL.longitud,
      radius: ZONA_INICIAL.metros,
      sort: 'distance',
    });
  }, [cargar]);

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
        sort: 'distance',
      });
    },
    [zona, cargar],
  );

  const visibles = propiedades.map((p) => ({ ...p, is_favorite: favoritos.includes(p.id) }));

  const lista = (
    <div className="h-full overflow-y-auto p-4">
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <SelectorRadio valor={zona?.metros ?? RADIOS[1]!} onCambio={cambiarRadio} />
      </div>

      <p className="text-small mt-4 mb-3 text-stone">
        {total === 0
          ? 'NingÃºn inmueble en esta zona'
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
        aria-label="Vista de bÃºsqueda"
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
 */
function sonLaMismaZona(a: PuntoZona, b: PuntoZona): boolean {
  const mediaMetrosPorGrado = 111_320;

  const metros = (unGrado: number) => unGrado * mediaMetrosPorGrado;

  return (
    a.metros === b.metros &&
    metros(Math.abs(a.latitud - b.latitud)) < 50 &&
    metros(Math.abs(a.longitud - b.longitud)) < 50
  );
}
