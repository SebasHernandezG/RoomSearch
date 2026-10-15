/**
 * El logo. DS-9.
 *
 * Vive como componente y no como `<img>` por tres razones:
 *
 * 1. **Un solo lugar.** El SVG va aqui, no en cinco archivos. Copiarlo
 *    es como el header y la pantalla de acceso terminan con logos
 *    distintos sin que nadie lo decida.
 * 2. **Escala sin perdida.** Un `viewBox` con `width: 100%` se ve
 *    igual a 28 px en la barra del movil y a 160 px en la portada.
 * 3. **El texto del logo es texto de verdad.** Con `<img>`, el motor
 *    de busqueda lee "logo" y el lector de pantalla anuncia el archivo.
 *
 * ## Los tres tonos
 *
 * | Tono | Cuando |
 * | --- | --- |
 * | `color` | Sobre fondo claro. El default |
 * | `blanco` | Sobre el verde del pie o un mapa |
 * | `monocromo` | Impresion, un solo color, favicon adaptativo |
 *
 * `blanco` y `monocromo` no son lo mismo: el blanco mantiene la hoja
 * en `coffee` y el monocromo la quita. A 16 px la hoja es ruido, y el
 * monocromo existe para ese tamano.
 */

import type { Property } from '../types/property';

export type TonoLogo = 'color' | 'blanco' | 'monocromo';

type Props = {
  /**
   * `decorativo` por defecto, y con razon.
   *
   * El logo esta al lado del nombre, que ya esta escrito al lado en
   * texto. Anunciarlo seria hacer que un lector de pantalla repita
   * "Roomies San Carlos" dos veces seguidas en cada pagina.
   *
   * Cuando el logo es lo unico que dice quien es --una pantalla de
   * carga, un correo-- hay que poner `titulo` y el nombre se anuncia.
   */
  titulo?: string;
  tono?: TonoLogo;
  /** Muestra el nombre al lado. Por defecto, no. */
  conNombre?: boolean;
  className?: string;
};

export default function Logo({ titulo, tono = 'color', conNombre = false, className = '' }: Props) {
  const casa = tono === 'blanco' ? '#fdfbf7' : tono === 'monocromo' ? 'currentColor' : '#1b4332';
  const hueco = tono === 'blanco' || tono === 'monocromo' ? '#1b4332' : '#fdfbf7';
  const hoja = tono === 'color' ? '#74c69d' : 'none';

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        /* Sin `width`/`height` fijos: hereda el tamano del texto. */
        className="h-7 w-7 shrink-0"
        role={titulo ? 'img' : undefined}
        aria-label={titulo}
        aria-hidden={titulo ? undefined : true}
        focusable="false"
      >
        <path
          fill={casa}
          d="M16 3.2 3.2 13.6a1.6 1.6 0 0 0 1 3V27a1.8 1.8 0 0 0 1.8 1.8h20A1.8 1.8 0 0 0 27.8 27v-10.4a1.6 1.6 0 0 0 1-3L16 3.2Z"
        />
        <rect fill={hueco} x="9" y="16" width="5.5" height="5.5" rx="1" />
        <rect fill={hueco} x="17.5" y="16" width="5.5" height="5.5" rx="1" />

        {hoja !== 'none' && (
          <path
            fill={hoja}
            d="M16 6.6c-3.4 1.2-5.2 3.5-5.2 6.2 0 1 .3 1.9.8 2.7.4-2.3 1.9-4.4 4.6-6-2.1 1.7-3.4 3.8-3.8 6.3a7.7 7.7 0 0 0 2 .4c3.1 0 5.5-2.1 5.5-5.2 0-1.6-.6-3-1.7-4.2a18 18 0 0 0-2.2-.2Z"
          />
        )}
      </svg>

      {conNombre && (
        <span className="text-h2 font-bold text-ink">
          Roomies <span className="text-leaf">San Carlos</span>
        </span>
      )}
    </span>
  );
}

/**
 * El nombre de la plataforma, para `title` y para el SEO.
 *
 * Va exportado porque aparece en tres sitios --el `title`, el
 * encabezado y los datos estructurados-- y tres cadenas escritas a
 * mano se divergen en una mayuscula y ya nadie sabe cual es la
 * buena.
 */
export const NOMBRE_PLATAFORMA = 'Roomies San Carlos';

/** El `title` completo, con el guion que no se ve al pintar. */
export const TITULO = `${NOMBRE_PLATAFORMA} · Vivienda en San Carlos, Costa Rica`;

export type { Property };
