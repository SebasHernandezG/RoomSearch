/**
 * Los chips de filtro activo. DS-6.
 *
 * ```
 * [ Apartamento  x ]  [ ₡200-350k  x ]  [ +2  x ]
 * ```
 *
 * Van **encima** de la lista de resultados, no escondidos en la hoja:
 * con la hoja cerrada, el chip es la unica prueba de que el filtro
 * sigue puesto. Es la diferencia entre "no aparecio nada" y "estoy
 * filtrando y no hay nada", que son dos mensajes distintos y el
 * equivocado cuesta una publicacion.
 */

import { useState } from 'react';

import { chipsVisibles, filtrosActivos, quitarFiltro, type Filtros } from '../../lib/filtros';

type Props = {
  filtros: Filtros;
  onCambio: (filtros: Filtros) => void;
};

export default function ChipsActivos({ filtros, onCambio }: Props) {
  const [expandido, setExpandido] = useState(false);

  const activos = filtrosActivos(filtros);

  if (activos.length === 0) {
    return null;
  }

  const { visibles, ocultos } = chipsVisibles(filtros);
  const aMostrar = expandido || ocultos === 0 ? activos : visibles;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {aMostrar.map((activo) => (
        <button
          key={activo.clave}
          type="button"
          onClick={() => onCambio(quitarFiltro(filtros, activo.clave))}
          // El nombre accesible incluye el filtro: sin el, el lector
          // anuncia "Apartamento" y no dice que al tocarlo se quita.
          aria-label={`Quitar filtro ${activo.texto}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-sand px-3 py-1 text-small text-ink transition-colors duration-200 hover:bg-paper motion-reduce:transition-none"
        >
          <span>{activo.texto}</span>

          {/*
            La "x" va con `aria-hidden`: si se leyera, el lector
            anuncia "Apartamento x" y nadie sabe que esa x significa
            algo.
          */}
          <span aria-hidden="true" className="text-stone">
            ×
          </span>
        </button>
      ))}

      {/*
        El "+N" es un boton de verdad y no solo texto: al tocarlo se
        ven los que faltan. Si fuera texto, habria que abrir la hoja
        para saber que mas hay, y la hoja es un viaje de ida y vuelta
        en movil.
      */}
      {ocultos > 0 && !expandido && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          aria-expanded="false"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-3 text-small font-semibold text-leaf transition-colors duration-200 hover:bg-sand motion-reduce:transition-none"
        >
          +{ocultos}
        </button>
      )}

      {expandido && ocultos > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(false)}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold text-leaf underline underline-offset-4"
        >
          Ver menos
        </button>
      )}

      {activos.length > 1 && (
        <button
          type="button"
          onClick={() => onCambio({ sort: filtros.sort })}
          className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-leaf underline underline-offset-4"
        >
          Quitar todo
        </button>
      )}
    </div>
  );
}
