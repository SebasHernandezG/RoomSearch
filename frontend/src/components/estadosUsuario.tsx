/**
 * Estados de las paginas del usuario. DS-4.
 *
 * Todos ofrecen una salida. Un "no tenes nada" sin boton deja a la
 * persona mirando una pantalla muerta sin saber si fallo algo o si
 * nunca empezo.
 */

import Estado, { AccionPrimaria, AccionSecundaria } from './Estado';
import {
  IlustracionAlertas,
  IlustracionConexion,
  IlustracionFavoritos,
  IlustracionPublicar,
} from './ilustraciones';
import { MICROCOPY } from '../lib/microcopy';

export function SinPublicaciones({ onPublicar }: { onPublicar?: () => void }) {
  const copy = MICROCOPY.publicaciones.sinNinguna;

  return (
    <Estado
      ilustracion={<IlustracionPublicar />}
      titulo={copy.titulo}
      detalle={copy.detalle}
      acciones={onPublicar && <AccionPrimaria onClick={onPublicar}>{copy.accion}</AccionPrimaria>}
    >
      <ol className="mt-6 flex flex-wrap justify-center gap-2">
        {copy.pasos.map((paso, i) => (
          <li
            key={paso}
            className="flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-caption text-stone"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coffee text-caption font-semibold text-forest">
              {i + 1}
            </span>
            {paso}
          </li>
        ))}
      </ol>
    </Estado>
  );
}

export function SinFavoritos({ onExplorar }: { onExplorar?: () => void }) {
  const copy = MICROCOPY.publicaciones.sinFavoritos;

  return (
    <Estado
      ilustracion={<IlustracionFavoritos />}
      titulo={copy.titulo}
      detalle={copy.detalle}
      acciones={onExplorar && <AccionPrimaria onClick={onExplorar}>Ver inmuebles</AccionPrimaria>}
    />
  );
}

export function SinAlertas({ onCrear }: { onCrear?: () => void }) {
  const copy = MICROCOPY.publicaciones.sinAlertas;

  return (
    <Estado
      ilustracion={<IlustracionAlertas />}
      titulo={copy.titulo}
      detalle={copy.detalle}
      acciones={onCrear && <AccionPrimaria onClick={onCrear}>{copy.accion}</AccionPrimaria>}
    />
  );
}

/**
 * Aviso de conexion perdida.
 *
 * DS-4 pide que sea discreto y que la app siga funcionando con lo
 * cacheado. Por eso no es un Estado a pantalla completa: es una banda
 * que no tapa el contenido. role="status" y no "alert", porque no
 * requiere accion inmediata.
 */
export function AvisoSinConexion() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-sun/30 px-4 py-2 text-small text-ink"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-clay" aria-hidden="true" />
      {MICROCOPY.general.conexionPerdida}
    </div>
  );
}

export function ErrorGeneral({ onReintentar }: { onReintentar?: () => void }) {
  return (
    <Estado
      ilustracion={<IlustracionConexion />}
      titulo={MICROCOPY.general.errorInesperado}
      acciones={
        onReintentar && <AccionSecundaria onClick={onReintentar}>Reintentar</AccionSecundaria>
      }
    />
  );
}
