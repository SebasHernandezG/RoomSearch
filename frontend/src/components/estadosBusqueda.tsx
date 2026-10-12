/**
 * Estados de la busqueda. DS-4.
 *
 * Sin resultados NO es un error: es la situacion mas comun cuando se
 * filtra por zona. Por eso el copy lo dice sin disculparse y ofrece
 * ampliar el radio o quitar el filtro que fallo, en vez de un
 * "reintentar" que no llevaria a ningun lado.
 */

import Estado, { AccionPrimaria, AccionSecundaria } from './Estado';
import { IlustracionBusqueda, IlustracionConexion } from './ilustraciones';
import { MICROCOPY, nombreFiltro } from '../lib/microcopy';
import type { Currency } from '../types/property';

type SinResultadosProps = {
  /** Filtros activos, para nombrarlos en el mensaje y en los chips. */
  filtros?: Record<string, unknown>;
  /** Radio actual en metros, si hay punto de referencia. */
  radioActual?: number;
  currency?: Currency;
  onQuitarFiltro?: (clave: string) => void;
  onQuitarTodos?: () => void;
  onAmpliarRadio?: (metros: number) => void;
};

export function SinResultados({
  filtros = {},
  radioActual,
  onQuitarFiltro,
  onQuitarTodos,
  onAmpliarRadio,
}: SinResultadosProps) {
  const claves = Object.keys(filtros).filter((c) => filtros[c] !== null && filtros[c] !== '');
  const nombres = claves.map((c) => nombreFiltro(filtros[c] as Record<string, unknown>));
  const copy = MICROCOPY.busqueda.sinResultados;

  const radioSugerido = radioActual ? radioActual * 2 : undefined;

  return (
    <Estado
      ilustracion={<IlustracionBusqueda />}
      titulo={copy.titulo}
      detalle={
        <>
          {nombres.length > 0 && <span className="block">{copy.conFiltros(nombres)}</span>}
          <span className="block">
            {radioActual ? copy.consejoConZona(radioSugerido!) : copy.consejoSinZona}
          </span>
        </>
      }
      acciones={
        <>
          {claves.length > 0 && onQuitarTodos && (
            <AccionPrimaria onClick={onQuitarTodos}>{copy.quitarTodos}</AccionPrimaria>
          )}

          {claves.slice(0, 2).map((clave) => (
            <AccionSecundaria key={clave} onClick={() => onQuitarFiltro?.(clave)}>
              {copy.quitarFiltro(nombreFiltro(filtros[clave] as Record<string, unknown>))}
            </AccionSecundaria>
          ))}

          {radioActual && radioSugerido && onAmpliarRadio && (
            <AccionSecundaria onClick={() => onAmpliarRadio(radioSugerido)}>
              {copy.consejoConZona(radioSugerido)}
            </AccionSecundaria>
          )}

          {!claves.length && !radioActual && onAmpliarRadio && (
            <AccionPrimaria onClick={() => onAmpliarRadio(1000)}>Buscar en 1 km</AccionPrimaria>
          )}
        </>
      }
    />
  );
}

export function ErrorConexion({ onReintentar }: { onReintentar?: () => void }) {
  const copy = MICROCOPY.busqueda.errorConexion;

  return (
    <Estado
      ilustracion={<IlustracionConexion />}
      titulo={copy.titulo}
      detalle={copy.detalle}
      acciones={
        onReintentar && <AccionPrimaria onClick={onReintentar}>{copy.reintentar}</AccionPrimaria>
      }
    />
  );
}
