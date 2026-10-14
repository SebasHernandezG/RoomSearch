/**
 * Mapa de propiedades. DS-7.
 *
 * Leaflet con OpenStreetMap. Se descarto Google Maps porque cobra por
 * uso y el documento lo dice: es el riesgo tecnico menos interesante de
 * asumir en un producto que casi no tiene ingresos.
 *
 * Decision: Leaflet directo, sin react-leaflet. Los marcadores son
 * DivIcon con HTML, y la vista divided necesita controlar el mapa desde
 * el contenedor, no desde un arbol de componentes declarativo.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

import { formatDistance } from '../../lib/format';
import type { Property } from '../../types/property';
import { iconoFantasma, iconoMarcador } from './iconos';
import './marcadores.css';

/**
 * San Carlos. El mapa arranca aqui, no en el punto (0,0) del Atlantico.
 *
 * Tupla explicita para poder leer la latitud: LatLngExpression tambien
 * admite objetos y no se puede indexar.
 */
export const CENTRO_SAN_CARLOS: [number, number] = [10.3236, -84.4274];
export const ZOOM_INICIAL = 13;

/** Radios que ofrece el selector. DS-7. */
export const RADIOS = [500, 1000, 2000, 3000, 5000, 10_000] as const;

/** 1 km cubre casi todo Ciudad Quesada. */
export const RADIO_POR_DEFECTO = 1000;

export type PuntoZona = { latitud: number; longitud: number; metros: number };

type Props = {
  propiedades: Property[];
  cargando?: boolean;
  zona?: PuntoZona | null;
  onMoverZona?: (zona: PuntoZona | null) => void;
  /** Id de la propiedad resaltada, para RF-3.5. */
  resaltada?: number | null;
  onSeleccionar?: (id: number) => void;
  onPedirZonaEnVista?: () => void;
  className?: string;
};

export default function PropertyMap({
  propiedades,
  cargando = false,
  zona = null,
  onMoverZona,
  resaltada = null,
  onSeleccionar,
  onPedirZonaEnVista,
  className = '',
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaMarcadores = useRef<L.LayerGroup | null>(null);
  const circulo = useRef<L.Circle | null>(null);
  const etiqueta = useRef<L.Marker | null>(null);
  const marcadores = useRef<Map<number, L.Marker>>(new Map());

  /*
   * El mapa se esta moviendo por codigo, no por el usuario. El estado
   * vive en `ajustesEnCurso`, mas abajo.
   */

  // Los callbacks se guardan en refs para no reconstruir el mapa cuando
  // el padre pasa una funcion nueva en cada render.
  const cb = useRef({ onMoverZona, onSeleccionar, onPedirZonaEnVista });
  cb.current = { onMoverZona, onSeleccionar, onPedirZonaEnVista };

  /*
   * El radio lo elige la persona con el selector, no se deduce del
   * zoom.
   *
   * Deducirlo del zoom hacia circular: el zoom determinaba el radio, el
   * radio determinaba el circulo, y ajustar el mapa al circulo movia el
   * zoom otra vez. Ahora el radio solo cambia cuando se pulsa un boton,
   * asi que la unica fuente de movimiento es la persona.
   */
  const radioVigente = useRef<number>(zona?.metros ?? RADIO_POR_DEFECTO);
  radioVigente.current = zona?.metros ?? RADIO_POR_DEFECTO;

  // Creacion del mapa: una sola vez.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const instancia = L.map(contenedor.current, {
      center: CENTRO_SAN_CARLOS,
      zoom: ZOOM_INICIAL,
      zoomControl: false,
      // El scroll de la pagina no debe mover el mapa por accidente.
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instancia);

    L.control.zoom({ position: 'topright' }).addTo(instancia);

    capaMarcadores.current = L.layerGroup().addTo(instancia);

    /*
     * Leaflet mide el contenedor una sola vez, al crearse. Si en ese
     * momento estaba oculto (la pestana "Lista" en movil lo oculta con
     * display:none) se queda con un tamano de cero y dibuja las
     * teselas en una franja, con el resto del mapa en blanco.
     *
     * invalidateSize lo vuelve a medir, y despues hay que volver a
     * encuadrar: el zoom con el que se ajusto el circulo ya no
     * corresponde al alto real.
     */
    const remedir = () => {
      instancia.invalidateSize({ animate: false });
      if (circulo.current) {
        ajustarVista(instancia, circulo.current);
      }
    };

    // El primer invalidateSize espera un turno: al montar todavia no
    // se ha resuelto el layout, y medir ahora daria el tamano viejo.
    const primerFrame = window.requestAnimationFrame(remedir);

    const observador = new ResizeObserver(remedir);
    observador.observe(contenedor.current);

    /*
     * RF-3.5: al mover el mapa se avisa al padre, que decide cuando
     * pedir datos. El debounce vive en el padre, no aqui: el mapa solo
     * informa del movimiento.
     *
     * Solo moveend, no zoomend: hacer zoom sin desplazar deja la zona
     * igual, asi que no hay nada que buscar de nuevo.
     */
    instancia.on('moveend', () => {
      if (ajustesEnCurso.has(instancia)) return;

      cb.current.onMoverZona?.(leerCentro(instancia, radioVigente.current));
    });

    mapa.current = instancia;

    return () => {
      window.cancelAnimationFrame(primerFrame);
      observador.disconnect();
      instancia.remove();
      mapa.current = null;
    };
  }, []);

  // Marcadores.
  useEffect(() => {
    const capa = capaMarcadores.current;
    const instancia = mapa.current;
    if (!capa || !instancia) return;

    capa.clearLayers();
    marcadores.current.clear();

    if (cargando) {
      // DS-4: marcadores fantasma en vez de mapa en blanco.
      const centro = instancia.getCenter();
      for (let i = 0; i < 6; i++) {
        const desvio = 0.004;
        L.marker(
          [
            centro.lat + (Math.random() - 0.5) * desvio,
            centro.lng + (Math.random() - 0.5) * desvio,
          ],
          { icon: iconoFantasma(), interactive: false },
        ).addTo(capa);
      }
      return;
    }

    for (const propiedad of propiedades) {
      if (propiedad.latitude === null || propiedad.longitude === null) continue;

      const variante = propiedad.show_exact_location ? 'normal' : 'aproximado';
      const icono = iconoMarcador(propiedad, variante);

      const marcador = L.marker([propiedad.latitude, propiedad.longitude], {
        icon: icono,
        title: propiedad.title,
        alt: propiedad.title,
        keyboard: true,
      });

      marcador.on('click', () => cb.current.onSeleccionar?.(propiedad.id));
      marcador.on('keypress', () => cb.current.onSeleccionar?.(propiedad.id));

      marcador.addTo(capa);
      marcadores.current.set(propiedad.id, marcador);
    }
  }, [propiedades, cargando]);

  // Resaltado desde la lista (RF-3.5).
  useEffect(() => {
    for (const [id, marcador] of marcadores.current) {
      const elemento = marcador.getElement();
      elemento?.classList.toggle('ds-marcador--resaltado', id === resaltada);
    }

    if (resaltada !== null) {
      const marcador = marcadores.current.get(resaltada);
      const lat = marcador?.getLatLng();
      if (lat && mapa.current) {
        mapa.current.panTo(lat, { animate: false });
        marcador?.openPopup();
      }
    }
  }, [resaltada]);

  // Circulo de la zona de preferencia.
  useEffect(() => {
    const instancia = mapa.current;
    const capa = capaMarcadores.current;
    if (!instancia || !capa) return;

    circulo.current?.remove();
    etiqueta.current?.remove();

    if (!zona) return;

    circulo.current = L.circle([zona.latitud, zona.longitud], {
      radius: zona.metros,
      color: '#2d6a4f',
      weight: 2,
      fillColor: '#74c69d',
      fillOpacity: 0.15,
      // DS-11: sin animacion si el sistema la pidio reducir.
      interactive: false,
    }).addTo(instancia);

    const radio = formatDistance(zona.metros) ?? '';
    const conteo = `${propiedades.length} ${propiedades.length === 1 ? 'inmueble' : 'inmuebles'}`;

    /*
     * La etiqueta va en el borde inferior del circulo, no en el centro.
     * En el centro se monta encima del marcador que este justo en el
     * punto de referencia, que es justo el caso mas comun: se elige el
     * centro de la ciudad y hay un inmueble ahi.
     */
    const latSur = circulo.current.getBounds().getSouth();

    etiqueta.current = L.marker([latSur, zona.longitud], {
      interactive: false,
      zIndexOffset: 1000,
      icon: L.divIcon({
        html:
          `<div class="ds-radio-etiqueta">` +
          `<span class="ds-radio-etiqueta__distancia">${radio}</span>` +
          `<span class="ds-radio-etiqueta__conteo">${conteo}</span>` +
          `</div>`,
        className: 'ds-radio-etiqueta-wrapper',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    }).addTo(instancia);

    ajustarVista(instancia, circulo.current);
  }, [zona, propiedades.length]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={contenedor}
        className="h-full w-full"
        role="application"
        aria-label="Mapa de inmuebles"
      />

      {zona && onPedirZonaEnVista && (
        <button
          type="button"
          onClick={onPedirZonaEnVista}
          className="absolute bottom-4 left-1/2 z-[500] flex min-h-11 -translate-x-1/2 items-center rounded-md bg-forest px-4 text-body font-semibold text-paper shadow-lg transition-colors duration-200 hover:bg-leaf motion-reduce:transition-none"
        >
          Buscar en esta zona
        </button>
      )}

      {zona && (
        <button
          type="button"
          onClick={() => onMoverZona?.(null)}
          className="absolute left-3 top-3 z-[500] flex min-h-11 items-center rounded-md border border-line bg-paper px-3 text-small font-semibold text-leaf shadow-sm transition-colors duration-200 hover:bg-sand motion-reduce:transition-none"
        >
          Limpiar zona
        </button>
      )}
    </div>
  );
}

/**
 * Encuadrar el circulo de la zona.
 *
 * El guardia `ajustando` evita el bucle: fitBounds dispara moveend, y
 * moveend sin guardia lo leeria el padre como "la persona movio el
 * mapa", provoking una busqueda que volveria a cambiar la zona y a
 * volver a llamar a esta funcion.
 *
 * Se levanta en el siguiente turno a proposito. Si el circulo ya
 * cabia, fitBounds no mueve nada y no llega ningun moveend que
 * limpiar; el temporal deja el mapa listo para el siguiente movimiento
 * real de la persona.
 *
 * Va exportada, junto con `ajustesEnCurso`, para poder probar que el
 * guardia se levanta solo y no depende de que llegue un `moveend`.
 * Ver `.ai/rules/mapa-frontend.md`.
 */
export function ajustarVista(instancia: L.Map, circulo: L.Circle): void {
  // El guardia vive fuera del componente: esta funcion se llama desde
  // el efecto del circulo y desde el ResizeObserver, y los dos
  // necesitan el mismo.
  ajustesEnCurso.add(instancia);

  instancia.fitBounds(circulo.getBounds(), { padding: [40, 40], animate: false });

  window.setTimeout(() => {
    ajustesEnCurso.delete(instancia);
  }, 0);
}

/**
 * Mapas que se estan encuadrando por codigo, no por la persona.
 *
 * Vive fuera del componente porque ajustarVista se llama desde dos
 * efectos distintos y un ref no llega al helper suelto.
 */
export const ajustesEnCurso = new WeakSet<L.Map>();

/**
 * Lee el centro del mapa como punto de zona.
 *
 * El radio no se deduce de aqui: lo elige el selector y viaja tal
 * cual. Inferirlo del zoom cerraba un ciclo con fitBounds (ver
 * `ajustando`).
 */
function leerCentro(instancia: L.Map, metros: number): PuntoZona | null {
  const centro = instancia.getCenter();

  if (!centro) return null;

  return {
    latitud: Number(centro.lat.toFixed(6)),
    longitud: Number(centro.lng.toFixed(6)),
    metros,
  };
}
