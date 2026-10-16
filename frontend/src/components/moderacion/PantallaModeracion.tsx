/**
 * La pantalla de moderacion. RF-7.1.
 *
 * Es la que carga la cola y llama a las dos acciones. El panel es una
 * vista pura -- recibe anuncios y avisa-- para que se pueda probar sin
 * red y sin token; esta es la que sabe de donde salen.
 */

import { useCallback, useEffect, useState } from 'react';

import PanelModeracion from './PanelModeracion';
import { ErrorConexion } from '../estadosBusqueda';
import { useAvisos } from '../ProveedorAvisos';
import { useSesion } from '../SesionContexto';
import { aprobar, listarCola, rechazar } from '../../lib/moderacion';
import type { EnModeracion } from '../../lib/moderacion';
import type { PropertyStatus } from '../../types/property';

type Filtro = { estado: PropertyStatus };

/** A cuanto se sale de la pantalla. */
const TAMANO_PAGINA = 24;

export default function PantallaModeracion() {
  const { usuario, estado: sesion } = useSesion();
  const avisar = useAvisos();

  const [anuncios, setAnuncios] = useState<EnModeracion[]>([]);
  const [filtro] = useState<Filtro>({ estado: 'pendiente' });
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setFallo(false);

    try {
      const respuesta = await listarCola(filtro.estado);

      setAnuncios(respuesta.data);
    } catch {
      setFallo(true);
    } finally {
      setCargando(false);
    }
  }, [filtro.estado]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /*
   * Quitar el anuncio de la lista en vez de recargar.
   *
   * Recargar tras cada aprobacion pierde la posicion de scroll y
   * hace parpadear las N filas siguientes, que es justo cuando el
   * administrador está revisando la siguiente. Sacarlo en su sitio es
   * un cambio de una fila.
   */
  const alAprobar = useCallback(
    (id: number) => {
      setAnuncios((actuales) => actuales.filter((a) => a.id !== id));

      avisar.exito('Anuncio aprobado. Ya aparece en el mapa.');

      void aprobar(id).catch(() => {
        /*
         * El aviso **no** se descarta solo: es un error.
         *
         * Y se recarga la cola porque el anuncio no se fue de verdad.
         * Sacarlo de la lista sin que el servidor lo acepte dejaria a
         * alguien creyendo que esta aprobado un anuncio que sigue
         * invisible.
         */
        avisar.error('No pudimos aprobar el anuncio. Volvemos a cargar la cola.');
        void cargar();
      });
    },
    [avisar, cargar],
  );

  const alRechazar = useCallback(
    (id: number) => {
      setAnuncios((actuales) => actuales.filter((a) => a.id !== id));

      avisar.info('Anuncio devuelto a borrador. La persona puede corregirlo.');

      void rechazar(id).catch(() => {
        avisar.error('No pudimos rechazar el anuncio. Volvemos a cargar la cola.');
        void cargar();
      });
    },
    [avisar, cargar],
  );

  /*
   * La pantalla no se pinta para quien no es administrador.
   *
   * `usuario === null` y `estado.fase === 'sin-sesion'` son caminos
   * distintos: el primero es "todavia no sabemos", y pintar un
   * "no tenes permiso" durante la comprobacion del token seria
   *rictions parpadeo en cada recarga (ver `App.tsx`).
   */
  if (sesion.fase !== 'con-sesion') {
    return null;
  }

  if (!usuario || usuario.role !== 'admin') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-h1">Moderación</h1>

        <p className="text-body mt-2 text-stone" role="alert">
          Esta cuenta no puede revisar anuncios.
        </p>
      </main>
    );
  }

  if (fallo) {
    return <ErrorConexion onReintentar={() => void cargar()} />;
  }

  return (
    <PanelModeracion
      anuncios={anuncios.slice(0, TAMANO_PAGINA)}
      cargando={cargando}
      onAprobar={alAprobar}
      onRechazar={alRechazar}
    />
  );
}
