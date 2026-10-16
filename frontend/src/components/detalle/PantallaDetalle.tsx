/**
 * La ficha del inmueble. DS-12.
 *
 * La pagina donde se decide el contacto. En movil se consulta rapido
 * y con una sola mano, asi que el precio y el boton estan arriba sin
 * scroll y la barra de acciones queda fija al pie.
 *
 * ## Lo que falta y por que
 *
 * | Falta | Por que |
 * | --- | --- |
 * | Galeria real | RF-2.3 no existe: `images` llega `[]` |
 * | Boton de WhatsApp | La API no manda telefono |
 * | Perfil del arrendador | La API no manda el usuario |
 * | Reseñas | No estan en ningun requisito activo |
 *
 * Los tres primeros estan escritos en `lib/inmueble.ts` con el
 * motivo al lado, para que cuando exista la pieza que falta sea
 * cambiar una linea y no decidir de nuevo.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Cargando from '../Cargando';
import { ErrorConexion } from '../estadosBusqueda';
import Estado, { AccionPrimaria } from '../Estado';
import MiniMapa from '../mapa/MiniMapa';
import GaleriaImagenes from './GaleriaImagenes';
import { useAvisos } from '../ProveedorAvisos';
import { obtenerPropiedad } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import {
  cintillo,
  datosEstructurados,
  imagenes,
  puedeContactar,
  puedeWhatsApp,
  pinVisible,
  plural,
  referencia,
  servicios,
  textoPrincipal,
  tipoTexto,
} from '../../lib/inmueble';
import type { Property } from '../../types/property';

export default function PantallaDetalle() {
  const { id } = useParams<{ id: string }>();

  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error' | 'no-existe'>('cargando');
  const [inmueble, setInmueble] = useState<Property | null>(null);
  const avisar = useAvisos();

  const numero = Number(id);

  useEffect(() => {
    if (!Number.isInteger(numero) || numero <= 0) {
      setEstado('no-existe');
      return;
    }

    let vigente = true;

    setEstado('cargando');

    obtenerPropiedad(numero)
      .then((p) => {
        if (!vigente) return;

        setInmueble(p);
        setEstado('listo');
      })
      .catch(() => {
        if (!vigente) return;

        setEstado('error');
      });

    /*
     * `vigente` y no el cleanup que cancela la peticion.
     *
     * Una cancelacion solo funciona si el navegador la soporta; con
     * `fetch` a veces la peticion ya se resolvio y el `.then` se
     * dispara igual. El flag es la unica forma de estar seguro de que
     * la respuesta de la ficha anterior no se pinte encima de la
     * nueva --que es lo que pasa al pasar de un inmueble a otro con las
     * flechas del navegador.
     */
    return () => {
      vigente = false;
    };
  }, [numero]);

  if (estado === 'cargando') {
    return <Cargando cantidad={3} />;
  }

  if (estado === 'error') {
    return <ErrorConexion onReintentar={() => window.location.reload()} />;
  }

  /*
   * DS-12 pide "anuncio eliminado: 404 con busqueda alternativa". Una
   * pantalla de error sin salida deja a alguien mirando un mensaje
   * tecnico sin saber que hacer.
   */
  if (estado === 'no-existe' || inmueble === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Estado
          titulo="Ese anuncio ya no está"
          detalle="Puede que el arrendador lo haya quitado o que el enlace esté equivocado."
          acciones={
            <Link to="/">
              <AccionPrimaria>Buscar inmuebles</AccionPrimaria>
            </Link>
          }
        />
      </main>
    );
  }

  const aviso = cintillo(inmueble.status);
  const fotos = imagenes(inmueble);
  const conWhatsApp = puedeWhatsApp(inmueble);

  /*
    "Me interesa" todavia no tiene a quien avisar.

    La API no tiene endpoint de contacto ni de favoritos: `routes/api.php`
    llega hasta moderacion y no hay nada mas. Poner un boton que
    "envia" a ninguna parte seria peor que no ponerlo: alguien
    escribiria al arrendador al dia siguiente esperando respuesta y
    no sabria a que se debe.

    Asi que el boton dice la verdad en el momento en que se toca, con
    un aviso que **no** se descarta solo, y el estado queda a la vista
    para el resto de la sesion. Cuando exista el endpoint, se cambia
    la funcion de este manejador y nada mas.
  */
  const [interesado, setInteresado] = useState(false);

  function alInteresar() {
    setInteresado(true);

    avisar.info(
      'Te anotamos el interés, pero todavía no podemos avisarle al arrendador: el contacto se habilita con la moderación.',
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-28 md:pb-8">
      {/*
        Los datos estructurados de RNF-13.

        Van en el `<head>` con `dangerouslySetInnerHTML`, que es la unica
        forma de meter JSON-LD desde React. El contenido lo genera
        `datosEstructurados`, que **borra las claves sin valor**: meter
        a mano `undefined` aca es como se termina indexando
        `{"description": null}` en Google.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(datosEstructurados(inmueble, window.location.href)),
        }}
      />

      {aviso && (
        <div
          role="status"
          className={`mb-6 rounded-md border px-4 py-3 ${
            aviso.tono === 'alerta' ? 'border-clay bg-clay/10' : 'border-line bg-sand'
          }`}
        >
          <p className="text-body font-semibold text-ink">{aviso.titulo}</p>
          <p className="text-small mt-1 text-stone">{aviso.detalle}</p>
        </div>
      )}

      {/*
        La galeria va primero y ocupa toda la pantalla: DS-12 pide
        "las fotos se ven deslizando, no miniaturas minusculas". Con
        RF-2.3 pendiente cae al placeholder, que es lo que hace que la
        ficha no parezca rota mientras tanto.
      */}
      <section aria-label="Fotos del inmueble" className="mb-6">
        {fotos === 'sin-fotos' ? (
          <div
            role="img"
            aria-label="Este anuncio todavía no tiene fotos"
            className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-sand text-center"
          >
            <div>
              <p className="text-h2 text-stone">Sin fotos todavía</p>
              <p className="text-small mt-1 text-stone">El arrendador las está subiendo.</p>
            </div>
          </div>
        ) : (
          /*
           * La galeria de verdad: la primera a pantalla completa,
           * deslizable con el dedo, con contador. DS-12.
           *
           * Antes era una cuadricula de miniaturas, que es exactamente
           * lo que el issue rechaza: "las fotos se ven deslizando, no
           * miniaturas minusculas".
           */
          <GaleriaImagenes imagenes={fotos} titulo={inmueble.title} />
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {/* 2 · Datos clave */}
          <header>
            <h1 className="text-h1">{inmueble.title}</h1>

            <p className="text-body mt-2 text-stone">
              {tipoTexto(inmueble)}
              {inmueble.district && ` · ${inmueble.district}`}
            </p>

            {/*
              El precio va aqui, arriba, y **no** solo en la barra
              lateral: DS-12 lo pide como criterio de aceptacion, y en
              movil la barra esta debajo del pliegue.
            */}
            <p className="text-h1 mt-4 font-bold text-forest">
              {formatPrice(inmueble.monthly_rent, inmueble.currency)}
              <span className="text-body ml-2 font-normal text-stone">al mes</span>
            </p>

            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-small text-ink">
              <li>{plural(inmueble.bedrooms, 'habitación', 'habitaciones')}</li>
              <li>{plural(inmueble.bathrooms, 'baño', 'baños')}</li>
              <li>{plural(inmueble.parking_spaces, 'espacio', 'espacios')} de parqueo</li>
            </ul>
          </header>

          {/* 3 · Mapa */}
          {pinVisible(inmueble) && (
            <section aria-label="Ubicación en el mapa" className="mt-8">
              {/*
                `pointer-events-none` en el contenedor: el mini mapa
                **invade** el scroll de la pagina, que es lo que pide
                DS-12. Con eventos propios, en un celular cualquier
                intento de bajar por la ficha se traducia en arrastrar
                el mapa, y la ficha se comia sola.
              */}
              <div className="pointer-events-none overflow-hidden rounded-lg border border-line">
                <MiniMapa
                  latitud={inmueble.latitude!}
                  longitud={inmueble.longitude!}
                  etiqueta={inmueble.title}
                />
              </div>

              <p className="text-caption mt-2 text-stone">{referencia(inmueble)}</p>
            </section>
          )}

          {/* 4 · Descripcion */}
          {inmueble.description && (
            <section aria-labelledby="descripcion" className="mt-8">
              <h2 id="descripcion" className="text-h2">
                Descripción
              </h2>

              {/*
                Los parrafos se separan de verdad, con `<p>` por
                parrafo. Un solo bloque con saltos de linea hace que
                todo se lea seguido, y DS-12 pide "parrafos
                legibles", que no es un detalle de tipografia.
              */}
              <div className="mt-3 flex flex-col gap-3">
                {inmueble.description
                  .split(/\n{2,}/)
                  .map((parrafo) => parrafo.trim())
                  .filter(Boolean)
                  .map((parrafo) => (
                    <p key={parrafo.slice(0, 40)} className="text-body text-ink">
                      {parrafo}
                    </p>
                  ))}
              </div>
            </section>
          )}

          {/* 5 · Servicios y reglas */}
          <section aria-labelledby="servicios" className="mt-8">
            <h2 id="servicios" className="text-h2">
              Servicios y reglas
            </h2>

            <ul className="mt-3 flex flex-col gap-2">
              {servicios(inmueble).map((servicio) => (
                <li key={servicio.clave} className="flex items-center gap-3 text-small text-ink">
                  {/*
                    El icono va con `aria-hidden` y el estado lo dice
                    el texto. Un `aria-label` en el icono del "no"
                    seria peor: el lector diria el emoji y no el
                    significado.
                  */}
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-small ${
                      servicio.incluido ? 'bg-coffee/30 text-ink' : 'bg-sand text-stone'
                    }`}
                  >
                    {servicio.incluido ? '✓' : '—'}
                  </span>

                  <span className={servicio.incluido ? '' : 'text-stone'}>
                    {servicio.etiqueta}
                    <span className="text-stone">
                      {servicio.incluido ? ': incluido' : ': corre por cuenta de quien alquila'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {inmueble.rules && (
              <div className="mt-5">
                <h3 className="text-small font-semibold text-ink">Reglas de la casa</h3>
                <p className="text-small mt-1 text-stone">{inmueble.rules}</p>
              </div>
            )}
          </section>

          {/* 7 · Ubicacion */}
          <section aria-labelledby="ubicacion" className="mt-8">
            <h2 id="ubicacion" className="text-h2">
              Dónde está
            </h2>

            {/*
              Nunca un pin exacto sin permiso (RF-2.5). Cuando
              `show_exact_location` es falso lo que se muestra es la
              referencia escrita y el distrito -- y nada mas.
            */}
            <p className="text-body mt-2 text-ink">{referencia(inmueble)}</p>

            {!pinVisible(inmueble) && (
              <p className="text-small mt-1 text-stone">
                El arrendador decidió no mostrar la ubicación exacta.
              </p>
            )}
          </section>
        </div>

        {/*
          6 · Acciones.

          En movil la barra va **fija al pie** con `fixed`: DS-12 pide
          que siga visible al hacer scroll, y el pulgar llega ahi. En
          escritorio pasa a `md:static`, en su columna y sin fijarse:
          fijarla taparia la columna al bajar.

          Es un solo marcado para las dos formas. Duplicarlo --
          una barra movil y una columna de escritorio-- pondria los
          mismos botones dos veces en el arbol de accesibilidad, y el
          lector de pantalla leeria "Me interesa" dos veces en la
          misma pagina.
        */}
        <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 py-3 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
          <div className="flex flex-col gap-2 md:rounded-lg md:border md:border-line md:bg-white md:p-4">
            <button
              type="button"
              onClick={alInteresar}
              disabled={!puedeContactar(inmueble.status) || interesado}
              aria-pressed={interesado}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-forest px-5 text-body font-semibold text-paper transition-colors duration-200 hover:bg-leaf disabled:cursor-not-allowed disabled:bg-stone motion-reduce:transition-none"
            >
              {interesado ? 'Anotado' : textoPrincipal(inmueble.status)}
            </button>

            {conWhatsApp && (
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sun px-5 text-body font-semibold text-ink transition-colors duration-200 hover:bg-sun/80 motion-reduce:transition-none"
              >
                WhatsApp
              </button>
            )}

            <Link
              to="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-line bg-paper px-5 text-body font-semibold text-leaf transition-colors duration-200 hover:bg-sand motion-reduce:transition-none"
            >
              Volver a la búsqueda
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
