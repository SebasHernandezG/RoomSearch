/**
 * El mini mapa de la ficha. DS-12.
 *
 * Es un Leaflet **sin interaccion**: sin arrastre, sin zoom, sin
 * scroll, con `dragging`, `scrollWheelZoom`, `touchZoom`,
 * `doubleClickZoom` y la rueda del teclado apagados.
 *
 * ## Por que todo eso
 *
 * DS-12 pide que "el mini mapa no se puede arrastrar por error (debe
 * invadir el scroll)". En un celular, un mapa con arrastre dentro de
 * una pagina que se desplaza verticalmente se queda con el gesto: la
 * persona intento bajar por la ficha y en cambio movio el mapa tres
 * pantallas, sin haber leido nada. Apagar los gestos no es una
 * excepcion: es la unica forma de que la ficha se pueda bajar completa
 * con un dedo.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { CENTRO_SAN_CARLOS } from './PropertyMap';
import './selector-pin.css';

type Props = {
  latitud: number;
  longitud: number;
  /** Texto alternativo del mapa. DS-10 lo exige en toda imagen. */
  etiqueta: string;
  className?: string;
};

/** 15: el punto se ve sin zoomear, y el barrio tambien entra. */
const ZOOM = 15;

/**
 * El mismo pin del selector, en su version sin sombra.
 *
 * Un `divIcon` con HTML y no el PNG por defecto de Leaflet: los PNG
 * apuntan a rutas que no existen en un bundler moderno, y es la misma
 * razon por la que `SelectorPin` ya no usa Google Maps.
 */
const ICONO_PIN = L.divIcon({
  html:
    '<div class="ds-pin" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>' +
    '</div>',
  className: 'ds-pin-wrapper',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

export default function MiniMapa({ latitud, longitud, etiqueta, className = '' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = contenedor.current;

    if (!nodo) return;

    const mapa = L.map(nodo, {
      center: [latitud, longitud],
      zoom: ZOOM,
      attributionControl: false,
      zoomControl: false,

      /*
       * Los cuatro de abajo son el motivo de que este componente
       * exista. Desactivados uno por uno, cada gesto que se cuela
       * roba el scroll de la pagina.
       */
      dragging: false,
      scrollWheelZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mapa);

    L.marker([latitud, longitud], { icon: ICONO_PIN, interactive: false }).addTo(mapa);

    /*
     * El `invalidateSize` espera un turno, igual que en `PropertyMap`.
     *
     * Sin el, corre antes de que Leaflet sepa cuanto mide el div y el
     * centro queda corrido: el mapa se dibuja en el punto (0,0) del
     * Atlantico y de ahi salta al punto real con un tirón visible.
     */
    const turno = window.setTimeout(() => mapa.invalidateSize({ animate: false }), 0);

    return () => {
      window.clearTimeout(turno);
      mapa.remove();
    };
  }, [latitud, longitud]);

  return (
    <div
      /*
       * El texto alternativo va en el contenedor, no en una capa de
       * Leaflet: un mapa sin capa de texto es una imagen sin
       * `alt`, y DS-10 exige texto en todas las imagenes.
       */
      role="img"
      aria-label={`Ubicación aproximada de ${etiqueta}`}
      ref={contenedor}
      className={`h-48 w-full ${className}`}
    />
  );
}

export { CENTRO_SAN_CARLOS };
