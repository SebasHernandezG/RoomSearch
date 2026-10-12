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
import { PROPIEDADES_DEMO } from '../data/demo';
import type { Property } from '../types/property';

type Vista = 'mapa' | 'lista';
type Estado = 'cargando' | 'listo' | 'error';

/** Radio inicial de DS-7: 1 km cubre casi todo San Carlos. */
const ZONA_INICIAL: PuntoZona = { latitud: 10.3236, longitud: -84.4274, metros: 1000 };

export default function PantallaBusqueda() {
  const [vista, setVista] = useState<Vista>('mapa');
  const [estado, setEstado] = useState<Estado>('listo');
  // El estado inicial ya viene filtrado: si no, la etiqueta del mapa
  // diria 4 inmuebles mientras solo se dibuja un marcador.
  const [propiedades, setPropiedades] = useState<Property[]>(() =>
    aplicarZona(PROPIEDADES_DEMO, ZONA_INICIAL),
  );
  const [zona, setZona] = useState<PuntoZona | null>(ZONA_INICIAL);
  const [resaltada, setResaltada] = useState<number | null>(null);
  const [favoritos, setFavoritos] = useState<number[]>([]);
  const [movidoPorUsuario, setMovidoPorUsuario] = useState(false);

  const temporizador = useRef<number | null>(null);

  /*
   * RF-3.5: debounce de 300 ms al mover el mapa. Sin esto, cada pixel
   * genera una peticion.
   *
   * `movidoPorUsuario` evita que pedir datos mueva el mapa, que moveria
   * el mapa pediria datos, en un bucle infinito.
   */
  const alMoverZona = useCallback((nueva: PuntoZona | null) => {
    setMovidoPorUsuario(true);

    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
    }

    temporizador.current = window.setTimeout(() => {
      setZona(nueva);
      setEstado('cargando');

      window.setTimeout(() => {
        setPropiedades(aplicarZona(PROPIEDADES_DEMO, nueva));
        setEstado('listo');
        setMovidoPorUsuario(false);
      }, 450);
    }, 300);
  }, []);

  useEffect(
    () => () => {
      if (temporizador.current !== null) {
        window.clearTimeout(temporizador.current);
      }
    },
    [],
  );

  const visibles = propiedades.map((p) => ({ ...p, is_favorite: favoritos.includes(p.id) }));

  const lista = (
    <div className="h-full overflow-y-auto p-4">
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <SelectorRadio
          valor={zona?.metros ?? RADIOS[1]!}
          onCambio={(metros) => setZona((z) => (z ? { ...z, metros } : z))}
        />
      </div>

      <p className="text-small mt-4 mb-3 text-stone">
        {visibles.length === 0
          ? 'Ningún inmueble en esta zona'
          : `${visibles.length} ${visibles.length === 1 ? 'inmueble' : 'inmuebles'} en esta zona`}
      </p>

      {estado === 'cargando' && <Cargando cantidad={3} />}

      {estado === 'error' && <ErrorConexion onReintentar={() => setEstado('listo')} />}

      {estado === 'listo' && visibles.length === 0 && (
        <SinResultados
          radioActual={zona?.metros}
          onAmpliarRadio={(m) => setZona((z) => (z ? { ...z, metros: m } : z))}
        />
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
            onPedirZonaEnVista={movidoPorUsuario ? () => setMovidoPorUsuario(false) : undefined}
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
 * Filtra por distancia y le pone el valor a la tarjeta.
 *
 * Aqui se usa la formula de haversine para que la demo responda. En
 * produccion lo hace MySQL con ST_Distance_Sphere, y el issue #16
 * documenta las tres trampas de MySQL que hay que respetar.
 */
function aplicarZona(props: Property[], zona: PuntoZona | null): Property[] {
  if (!zona) return props;

  const dentro: Property[] = [];

  for (const p of props) {
    if (p.latitude === null || p.longitude === null) continue;

    const metros = distanciaEnMetros(zona.latitud, zona.longitud, p.latitude, p.longitude);

    if (metros <= zona.metros) {
      dentro.push({ ...p, distance_meters: metros });
    }
  }

  return dentro;
}

function distanciaEnMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const aLat = (lat1 * Math.PI) / 180;
  const bLat = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;

  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
