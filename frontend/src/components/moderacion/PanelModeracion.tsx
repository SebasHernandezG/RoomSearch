/**
 * El panel de moderacion. RF-7.1.
 *
 * La pantalla donde alguien decide si un anuncio se ve. Es la unica
 * forma de que una publicacion llegue al mapa, asi que es la mas
 * pesada de consequences de todo el proyecto: aprobar un anuncio de
 * estafa es un problema para quien lo vio, y rechazar el legitimo es
 * un problema para quien lo puso.
 *
 * ## Por que el rechazo pide confirmacion y la aprobacion no
 *
 * Rechazar devuelve el anuncio a 'borrador' y saca la publicacion del
 * mapa. Es la unica accion del panel que no se puede deshacer con un
 * boton, asi que pide confirmacion.
 *
 * Aprobar **no** pide. Un anuncio aprobado se puede pausar a la
 * entrada, y preguntar "¿seguro?" antes de cada aprobacion entrena a
 * la gente a darle al boton sin leer. DS-4 lo pide asi para el resto
 * de acciones reversibles.
 *
 * ## Lo que la pantalla muestra y por que
 *
 * Cada anuncio trae los datos del dueno, y no por cortesia:
 *
 * - **El nombre y el correo**: sin ellos se aprueba a ciegas.
 * - **Si el correo esta confirmado**: una cuenta sin confirmar puede
 *   publicar un anuncio de estafa y desaparecer.
 * - **El historial**: "3 anuncios, 0 aceptados" es un perfil distinto
 *   de "3 anuncios, 3 aceptados" con el mismo numero.
 */

import { useState } from 'react';

import Estado, { AccionPrimaria, AccionSecundaria } from '../Estado';
import { formatPrice } from '../../lib/format';
import { referencia, tipoTexto } from '../../lib/inmueble';
import type { EnModeracion } from '../../lib/moderacion';
import type { Currency } from '../../types/property';

type Props = {
  anuncios: EnModeracion[];
  cargando: boolean;
  onAprobar: (id: number) => void;
  onRechazar: (id: number) => void;
};

export default function PanelModeracion({ anuncios, cargando, onAprobar, onRechazar }: Props) {
  const [porRechazar, setPorRechazar] = useState<EnModeracion | null>(null);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-h1">Moderación</h1>

      <p className="text-body mt-1 text-stone">
        {cargando
          ? 'Cargando la cola…'
          : `${anuncios.length} ${anuncios.length === 1 ? 'anuncio espera' : 'anuncios esperan'} decisión`}
      </p>

      {cargando && <Esqueleto />}

      {!cargando && anuncios.length === 0 && (
        <Estado
          titulo="No hay nada que moderar"
          detalle="Cuando alguien publique un inmueble aparece acá para decidir si se ve."
        />
      )}

      {!cargando && anuncios.length > 0 && (
        <ul className="mt-6 flex flex-col gap-4">
          {anuncios.map((anuncio) => (
            <li key={anuncio.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
              <article>
                <h2 className="text-h2">{anuncio.title}</h2>

                <p className="text-small mt-1 text-stone">
                  {tipoTexto(anuncio)}
                  {anuncio.district && ` · ${anuncio.district}`} ·{' '}
                  {formatPrice(anuncio.monthly_rent, anuncio.currency as Currency)}
                </p>

                {/*
                  La descripcion va completa, no recortada.
                  Cortarla es la razon por la que un moderador aprueba
                  sin haber leido: el texto sospechoso --"se entrega
                  efectivo, sin contrato", "llamar a este numero
                 whatsapp"-- casi siempre esta al final.
                */}
                {anuncio.description && (
                  <p className="text-body mt-3 whitespace-pre-line text-ink">
                    {anuncio.description}
                  </p>
                )}

                <p className="text-small mt-3 text-stone">{referencia(anuncio)}</p>

                <FilaDueno dueno={anuncio.landlord} />

                <nav className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => onAprobar(anuncio.id)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-forest px-5 text-body font-semibold text-paper transition-colors duration-200 hover:bg-leaf motion-reduce:transition-none"
                  >
                    Aprobar
                  </button>

                  <button
                    type="button"
                    onClick={() => setPorRechazar(anuncio)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-alert bg-paper px-5 text-body font-semibold text-ink transition-colors duration-200 hover:bg-sand motion-reduce:transition-none"
                  >
                    Rechazar
                  </button>
                </nav>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/*
        La confirmacion va en un dialogo y no en un `confirm()`.

        `window.confirm` es un boton del navegador: no se puede
        estilizar, en algunos navegadores no se traduce y en iOS
        Safari se lee como parte de la pagina. Peor: no es anunciable,
        asi que un lector de pantalla se queda sin saber que hay una
        pregunta pendiente.
      */}
      {porRechazar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-rechazar"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id="titulo-rechazar" className="text-h2">
              ¿Rechazar este anuncio?
            </h2>

            <p className="text-body mt-2 text-stone">
              Vuelve a borrador y deja de verse. La persona puede corregirlo y volver a enviarlo; no
              se pierde el trabajo.
            </p>

            <p className="text-small mt-3 font-semibold text-ink">{porRechazar.title}</p>

            <div className="mt-6 flex flex-col gap-2">
              <AccionPrimaria
                onClick={() => {
                  onRechazar(porRechazar.id);
                  setPorRechazar(null);
                }}
              >
                Sí, rechazar
              </AccionPrimaria>

              <AccionSecundaria onClick={() => setPorRechazar(null)}>Mejor no</AccionSecundaria>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * Los datos del dueno.
 *
 * Es la fila que hace que esto sea moderacion y no un boton. Va en
 * `sand` para separarse del anuncio sin el borde, que a esta
 * distancia no se ve.
 */
function FilaDueno({ dueno }: { dueno: EnModeracion['landlord'] }) {
  return (
    <div className="mt-4 rounded-md bg-sand px-3 py-2">
      <p className="text-small font-semibold text-ink">{dueno.name}</p>

      <p className="text-caption text-stone">{dueno.email}</p>

      {/*
        El aviso de "correo sin confirmar" lleva `role="status"` y no
        un color: el color es la unica senal de que algo anda mal, y
        una persona que ve bien no la va a notar.
      */}
      {!dueno.email_verified && (
        <p role="status" className="text-caption mt-1 text-ink">
          ⚠ Correo sin confirmar: la cuenta puede desaparecer en cualquier momento.
        </p>
      )}

      <p className="text-caption mt-1 text-stone">
        {dueno.published_count} anuncios · {dueno.approved_count} aceptados
      </p>
    </div>
  );
}

/**
 * El esqueleto de la cola.
 *
 * Con la forma de un anuncio, no un spinner: DS-4 lo pide y la razon
 * es que la pagina no salte cuando llegan.
 */
function Esqueleto() {
  return (
    <div role="status" aria-busy="true" className="mt-6 flex flex-col gap-4">
      <span className="sr-only">Cargando anuncios</span>

      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="motion-reduce:animate-none rounded-lg border border-line bg-white p-4"
        >
          <div className="h-6 w-2/3 animate-pulse rounded-md bg-sand" />
          <div className="mt-3 h-4 w-1/3 animate-pulse rounded-md bg-sand" />
          <div className="mt-3 h-16 w-full animate-pulse rounded-md bg-sand" />
        </div>
      ))}
    </div>
  );
}
