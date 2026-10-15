/**
 * Selector de pin. RF-2.4.
 *
 * Sustituye al `LocationPicker` de la rama `Producción`, que usaba
 * Google Maps y sin `VITE_GOOGLE_MAPS_API_KEY` no hacia nada: pintaba
 * un cartel pidiendo configurar la clave. Eso lo dejaba inutilizable, y
 * Google Maps cobra por uso.
 *
 * El **contrato de interaccion** si se conserva, porque era bueno:
 * click en el mapa coloca el pin, y arrastrarlo lo ajusta. Solo
 * cambia el motor, de Google a Leaflet con teselas de OpenStreetMap.
 *
 * Ver `.ai/rules/port-produccion.md` para el inventario de lo que se
 * trajo de esa rama y lo que se descarto.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

import { CENTRO_SAN_CARLOS } from './PropertyMap';
import './selector-pin.css';

/** Lo que devuelve el selector. */
export type Coordenadas = { latitude: number; longitude: number };

type Props = {
  /** El pin actual, o `null` si todavia no se eligio. */
  value: Coordenadas | null;
  /** Se dispara con el pin nuevo en cada cambio. */
  onChange: (coordenadas: Coordenadas) => void;
  /** Se avisa cuando se deja de tener pin, para limpiar el campo. */
  onClear?: () => void;
  className?: string;
};

/**
 * El pin arrastrable.
 *
 * Un `divIcon` con HTML, como los del mapa de busqueda, y no el
 * marcador PNG por defecto: los PNG de Leaflet apuntan a rutas que no
 * existen en un bundler moderno.
 */
const ICONO_PIN = L.divIcon({
  html:
    '<div class="ds-pin" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>' +
    '</div>',
  className: 'ds-pin-wrapper',
  iconSize: [32, 40],
  /*
   * La punta del pin queda en el punto exacto y no en el centro del
   * icono. Con el centro anclado, quien arrastra "al ojo" deja el pin
   * desplazado del lugar que cree, y eso en una fachada se nota.
   */
  iconAnchor: [16, 40],
});

/**
 * Zoom al abrir.
 *
 * 17 es "una casa": a 10 se ve media provincia y no sirve para senalar
 * una fachada, que es justo lo que se viene a hacer aqui. Y sin pin no
 * hay nada queERIALIZAR, asi que se abre mas atrás.
 */
const ZOOM_CON_PIN = 17;
const ZOOM_SIN_PIN = 13;

export default function SelectorPin({ value, onChange, onClear, className = '' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);

  /*
   * Los callbacks van en refs para no reconstruir el mapa cuando el
   * padre pasa una funcion nueva en cada render.
   */
  const cb = useRef({ onChange, onClear });
  cb.current = { onChange, onClear };

  useEffect(() => {
    const elemento = contenedor.current;

    if (!elemento || mapa.current) return;

    const instancia = L.map(elemento, {
      center: value ? [value.latitude, value.longitude] : CENTRO_SAN_CARLOS,
      zoom: value ? ZOOM_CON_PIN : ZOOM_SIN_PIN,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instancia);

    elemento.addEventListener('click', (evento) => {
      const punto = eventoALatLng(instancia, evento);

      if (!punto) return;

      colocar(instancia, pin, punto, cb);
    });

    mapa.current = instancia;

    return () => {
      instancia.remove();
      mapa.current = null;
      pin.current = null;
    };
  }, []);

  /*
   * El pin externo cambia --el formulario lo limpia, o el landlord
   * vuelve atras-- y el mapa tiene que reflejarlo.
   *
   * Sin este efecto, el mapa se queda con el pin viejo en pantalla
   * mientras el formulario ya no tiene ninguno.
   */
  useEffect(() => {
    const instancia = mapa.current;

    if (!instancia) return;

    if (!value) {
      pin.current?.remove();
      pin.current = null;
      return;
    }

    colocar(instancia, pin, L.latLng(value.latitude, value.longitude), cb);
  }, [value]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        ref={contenedor}
        className="h-72 w-full overflow-hidden rounded-md border border-line"
        role="application"
        aria-label="Seleccioná la ubicación del inmueble en el mapa"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-ink-soft">
          Tocá el mapa para poner el pin, y arrastralo para ajustarlo.
        </p>

        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex min-h-11 items-center rounded-md border border-line bg-paper px-3 text-small font-semibold text-leaf transition-colors duration-200 hover:bg-sand motion-reduce:transition-none"
          >
            Quitar el pin
          </button>
        )}
      </div>

      {value && (
        /*
         * Las coordenadas en texto.
         *
         * Dos razones: quien usa lector de pantalla necesita saber que
         * se puso un pin y donde, y quien quiere comprobar a mano que
         * quedo donde dice no tiene que abrir la consola.
         */
        <p role="status" className="text-small text-ink-soft">
          Pin en {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}.
        </p>
      )}
    </div>
  );
}

/**
 * Traduce un click del DOM a coordenadas del mapa, o `null`.
 *
 * Se escucha en el **contenedor** y no en `map.on('click')` a
 * proposito: el evento del mapa no dispara cuando el click cae sobre
 * el propio marcador, y `latlng` puede venir indefinido. Con el
 * contenedor se descarta cualquier click que no traiga un punto.
 *
 * El recorte evita que un click que "se escapo" del mapa --el dedo
 * arrastro un poco y solto-- cuente como elegir un punto a cientos de
 * kilometros.
 *
 * Va exportada para probar el recorte, que es la unica logica con
 * ramas aqui. Ver `SelectorPin.test.ts`.
 */
export function eventoALatLng(instancia: L.Map, evento: MouseEvent): L.LatLng | null {
  const caja = instancia.getContainer().getBoundingClientRect();

  const x = evento.clientX - caja.left;
  const y = evento.clientY - caja.top;

  if (x < 0 || y < 0 || x > caja.width || y > caja.height) {
    return null;
  }

  return instancia.containerPointToLatLng(L.point(x, y));
}

/**
 * Coloca o mueve el pin.
 *
 * Reutiliza el mismo marcador en vez de crear uno nuevo en cada click:
 * recrearlo deja el anterior huerfano en la capa y, con muchos clicks,
 * el mapa se vuelve lento sin que se note por que.
 */
function colocar(
  instancia: L.Map,
  pin: React.RefObject<L.Marker | null>,
  punto: L.LatLng,
  cb: React.RefObject<{ onChange: Props['onChange']; onClear?: Props['onClear'] }>,
): void {
  if (pin.current) {
    pin.current.setLatLng(punto);
    return;
  }

  const marcador = L.marker(punto, {
    icon: ICONO_PIN,
    draggable: true,
    autoPan: true,
    keyboard: true,
    title: 'Ubicacion del inmueble',
  });

  /*
   * `dragend` y no `drag`: durante el arrastre el pin pasa por puntos
   * intermedios y se emitiria un cambio por cada uno. Para un formulario
   * eso es ruido, y para quien espera un guardado en el servidor es un
   * problema: se guardarian decenas de coordenadas.
   */
  marcador.on('dragend', () => {
    const final = marcador.getLatLng();

    cb.current.onChange({ latitude: final.lat, longitude: final.lng });
  });

  /*
   * Doble click sobre el pin lo quita.
   *
   * Es un atajo, no la unica via: tambien hay el boton "Quitar el
   * pin", porque un atajo que nadie descubre no sirve de nada.
   */
  marcador.on('dblclick', () => {
    marcador.remove();
    pin.current = null;

    cb.current.onClear?.();
  });

  marcador.addTo(instancia);
  pin.current = marcador;
}
