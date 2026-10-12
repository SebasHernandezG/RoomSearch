/**
 * Esqueleto de carga. DS-4.
 *
 * El criterio del issue es que no haya spinners centrados: un spinner
 * borra la pantalla y hace que el contenido "salte" al aparecer. El
 * esqueleto tiene la forma real del contenido, asi la pagina no se
 * mueve y el ojo ya sabe donde va a estar cada cosa.
 *
 * ARIA: aria-busy en el contenedor y aria-hidden en los bloques. El
 * texto de carga va en un elemento con role="status", que es lo unico
 * que debe anunciarse. Un lector de pantalla no necesita escuchar
 * "cargando" cien veces por los elementos de la maqueta.
 */

import type { ReactElement } from 'react';

const bloque = 'animate-pulse rounded-md bg-sand';

export function PropertyCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-lg border border-line bg-white shadow-sm"
    >
      {/* Misma relacion 16:10 que la foto de la tarjeta real. */}
      <div className={`aspect-[16/10] ${bloque} rounded-none`} />

      <div className="p-4">
        <div className={`h-6 w-28 ${bloque}`} />
        <div className={`mt-3 h-4 w-full ${bloque}`} />
        <div className={`mt-2 h-4 w-2/3 ${bloque}`} />
        <div className={`mt-3 h-3 w-40 ${bloque}`} />
        <div className={`mt-4 h-3 w-32 ${bloque}`} />
      </div>
    </div>
  );
}

type Props = {
  cantidad?: number;
  className?: string;
};

export default function Cargando({ cantidad = 6, className = '' }: Props) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      <span className="sr-only">Cargando inmuebles…</span>
      {Array.from({ length: cantidad }, (_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Marcadores fantasma para el mapa.
 *
 * DS-4 pide que el mapa no quede en blanco mientras carga. Un circulo
 * pulsante en la posicion aproximada es suficiente y deja ver que hay
 * algo ahi. No es un spinner, porque un spinner no comunica "faltan
 * mas".
 */
export function MarcadorFantasma(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-leaf/40"
    />
  );
}

/**
 * Marcadores fantasma para el mapa.
 *
 * Se dibujan sobre el mapa mientras llegan los pines reales. Un
 * circulo pulsante basta: comunica que hay algo ahi sin tapar el
 * mapa como lo haria un spinner a pantalla completa.
 */
export function MarcadoresFantasma({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: cantidad }, (_, i) => (
        <MarcadorFantasma key={i} />
      ))}
    </div>
  );
}
