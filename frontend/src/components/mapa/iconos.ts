/**
 * Marcadores del mapa. DS-7.
 *
 * Se usan DivIcon de Leaflet, es decir HTML dentro del mapa, en vez de
 * los marcadores PNG por defecto. Dos razones:
 *
 * 1. Los PNG por defecto de Leaflet se rompen con cualquier bundler
 *    moderno, porque apuntan a rutas de imagenes que no existen.
 * 2. DS-7 pide pines con miniatura, insignia de verificado y halo para
 *    ubicacion aproximada. Eso no se hace con una imagen.
 *
 * Todos los marcadores usan currentColor y los tokens del sistema de
 * diseno, asi que el mapa hereda el tema sin estilos aparte.
 */

import L from 'leaflet';

import type { Property } from '../../types/property';
import { formatPrice } from '../../lib/format';

/** tamano del icono en píxeles */
const TAMANO = 40;
const ANCLA: L.PointExpression = [TAMANO / 2, TAMANO / 2];

export type VarianteMarcador = 'normal' | 'favorito' | 'verificado' | 'aproximado';

export function iconoMarcador(propiedad: Property, variante: VarianteMarcador): L.DivIcon {
  const { landlord_verified, is_favorite, images, monthly_rent, currency } = propiedad;

  const clases = ['ds-marcador'];

  if (is_favorite) clases.push('ds-marcador--favorito');
  if (landlord_verified) clases.push('ds-marcador--verificado');
  if (variante === 'aproximado') clases.push('ds-marcador--aproximado');

  const portada = images[0];

  const contenido = portada
    ? `<img class="ds-marcador__foto" src="${escapar(portada.url)}" alt="" />`
    : `<svg class="ds-marcador__casa" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
         <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>
       </svg>`;

  const insignia = landlord_verified
    ? `<span class="ds-marcador__verificado" aria-hidden="true">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round">
           <path d="m5 13 4 4L19 7"/>
         </svg>
       </span>`
    : '';

  const precio = `<span class="ds-marcador__precio">${escapar(formatPrice(monthly_rent, currency))}</span>`;

  return L.divIcon({
    html: `<div class="${clases.join(' ')}">${contenido}${insignia}${precio}</div>`,
    className: 'ds-marcador-wrapper',
    iconSize: [TAMANO, TAMANO],
    iconAnchor: ANCLA,
  });
}

/**
 * Marcador fantasma mientras llegan los pines. DS-4 lo pide para que el
 * mapa no quede en blanco.
 */
export function iconoFantasma(): L.DivIcon {
  return L.divIcon({
    html: '<div class="ds-marcador ds-marcador--fantasma"></div>',
    className: 'ds-marcador-wrapper',
    iconSize: [TAMANO, TAMANO],
    iconAnchor: ANCLA,
  });
}

/**
 * Escapa lo que venga de la base de datos antes de inyectarlo en el
 * HTML del DivIcon.
 *
 * Leaflet mete este string tal cual en el DOM. Sin escapar, un titulo
 * con comillas romperia el atributo y una direccion de referencia con
 * un > podria inyectar marcado. Las direcciones en Costa Rica son texto
 * libre del arrendador, asi que el riesgo es real.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
