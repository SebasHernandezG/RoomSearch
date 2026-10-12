/**
 * Formato de moneda costarricense. RNF-14 y DS-5.
 *
 * El precio es lo primero que se lee de una tarjeta: DS-5 pide que se
 * entienda a dos metros de distancia. Por eso se formatea aqui y no con
 * toLocaleString a pelo, que aplica el formato del navegador.
 */

import type { Currency } from '../types/property';

const SIMBOLO: Record<Currency, string> = {
  CRC: '₡',
  USD: 'US$',
};

/**
 * Formatea un monto con separador de miles y el simbolo correcto.
 *
 *   ₡280.000    280 000 colonicos
 *   US$450       450 dolares
 *
 * Sin decimales: en colones no se manejan, y en dolares el precio de
 * un alquiler siempre es entero.
 */
export function formatPrice(amount: number, currency: Currency): string {
  const miles = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${SIMBOLO[currency]}${miles}`;
}

/**
 * Formatea una distancia en metros de forma compacta.
 *
 *   850      -> 850 m
 *   1200     -> 1.2 km
 *   25000    -> 25 km
 */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined) {
    return null;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const km = meters / 1000;

  // 1 km entero se muestra sin decimales: "1 km" se lee mejor que "1.0 km".
  return `${km < 10 ? km.toFixed(1).replace(/\.0$/, '') : Math.round(km)} km`;
}

/**
 * Etiquetas de tipo de inmueble en espanol.
 *
 * Deben coincidir con PropertyType::options() del backend.
 */
export const TIPO_LABEL: Record<string, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  habitacion: 'Habitación',
  estudio: 'Estudio',
};
