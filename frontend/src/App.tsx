/**
 * Revision de los Estados de interfaz. DS-4.
 *
 * Muestra cada estado del issue para poder mirarlos antes de construir
 * el listado y el mapa encima. Se borra cuando exista la API real.
 */

import { useState } from 'react';

import Cargando from './components/Cargando';
import PropertyCard from './components/PropertyCard';
import Estado, { AccionPrimaria, AccionSecundaria } from './components/Estado';
import { ErrorConexion, SinResultados } from './components/estadosBusqueda';
import {
  AvisoSinConexion,
  ErrorGeneral,
  SinAlertas,
  SinFavoritos,
  SinPublicaciones,
} from './components/estadosUsuario';
import {
  IlustracionAlertas,
  IlustracionBusqueda,
  IlustracionConexion,
  IlustracionFavoritos,
  IlustracionPublicar,
} from './components/ilustraciones';
import { PROPIEDADES_DEMO } from './data/demo';
import { MICROCOPY } from './lib/microcopy';

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-h2 mb-4">{titulo}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [filtros, setFiltros] = useState<Record<string, unknown>>({
    tipo: 'apartamento',
    max: 350000,
    moneda: 'CRC',
  });

  const quitarFiltro = (clave: string) => {
    const copia = { ...filtros };
    delete copia[clave];
    setFiltros(copia);
  };

  const quitarTodos = () => setFiltros({});

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-forest px-5 py-8 sm:px-8">
        <p className="text-caption uppercase tracking-widest text-coffee">
          Revision del diseno · DS-4
        </p>
        <h1 className="text-display text-paper">Estados de interfaz</h1>
        <p className="text-body max-w-prose text-paper/80">
          Donde una app se siente amigable o rota. Todo estado vacio ofrece una accion, y ninguno
          usa un spinner centrado.
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <Seccion titulo="Cargando · esqueleto con la forma real">
          <p className="text-small mb-4 text-stone">
            La cuadricula no se mueve al llegar los datos: el esqueleto tiene la misma altura que la
            tarjeta.
          </p>
          <Cargando cantidad={3} />
        </Seccion>

        <Seccion titulo="Cargando · con datos reales al lado">
          <p className="text-small mb-4 text-stone">
            Mismo esqueleto, misma tarjeta, misma altura. Ese es el punto.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROPIEDADES_DEMO.slice(0, 3).map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Sin resultados · con filtros">
          <SinResultados
            filtros={filtros}
            radioActual={1000}
            onQuitarFiltro={quitarFiltro}
            onQuitarTodos={quitarTodos}
            onAmpliarRadio={(m) => console.log('ampliar a', m)}
          />
          <p className="text-caption mt-3 text-stone">Filtros activos: {JSON.stringify(filtros)}</p>
        </Seccion>

        <Seccion titulo="Sin resultados · con zona y sin filtros">
          <SinResultados radioActual={2000} onAmpliarRadio={(m) => console.log('ampliar a', m)} />
        </Seccion>

        <Seccion titulo="Sin resultados · sin nada aplicado">
          <SinResultados onAmpliarRadio={(m) => console.log('ampliar a', m)} />
        </Seccion>

        <Seccion titulo="Sin resultados · sin filtros ni zona, a 320 px">
          <div className="max-w-80">
            <SinResultados onAmpliarRadio={(m) => console.log('ampliar a', m)} />
          </div>
        </Seccion>

        <Seccion titulo="Error de conexion">
          <ErrorConexion onReintentar={() => console.log('reintentar')} />
        </Seccion>

        <Seccion titulo="Error inesperado">
          <ErrorGeneral onReintentar={() => console.log('reintentar')} />
        </Seccion>

        <Seccion titulo="Arrendador sin publicaciones">
          <SinPublicaciones onPublicar={() => console.log('publicar')} />
        </Seccion>

        <Seccion titulo="Inquilino · favoritos y alertas">
          <div className="grid gap-4 lg:grid-cols-2">
            <SinFavoritos onExplorar={() => console.log('explorar')} />
            <SinAlertas onCrear={() => console.log('crear alerta')} />
          </div>
        </Seccion>

        <Seccion titulo="Sin conexion · banda discreta">
          <AvisoSinConexion />
          <p className="text-small mt-3 text-stone">
            No es una pantalla completa: la app sigue funcionando con lo cacheado, asi que tapar
            todo seria mentir.
          </p>
        </Seccion>

        <Seccion titulo="Microcopy: lo que no se dice">
          <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
            <table className="w-full text-left text-small">
              <thead className="bg-sand">
                <tr>
                  <th className="px-4 py-2 font-semibold">No</th>
                  <th className="px-4 py-2 font-semibold">Si</th>
                </tr>
              </thead>
              <tbody className="text-stone">
                {[
                  ['No se encontraron resultados', MICROCOPY.busqueda.sinResultados.titulo],
                  ['Error al cargar los datos', MICROCOPY.busqueda.errorConexion.titulo],
                  ['Usuario no autorizado', MICROCOPY.sesion.noAutorizado],
                  ['No tienes publicaciones', MICROCOPY.publicaciones.sinNinguna.titulo],
                ].map(([mal, bien]) => (
                  <tr key={mal} className="border-t border-line">
                    <td className="px-4 py-2">{mal}</td>
                    <td className="px-4 py-2 font-medium text-ink">{bien}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>

        <Seccion titulo="Ilustraciones">
          <p className="text-small mb-4 text-stone">
            Linea de 2 px, sin texto dentro, sin rayado rojo. Una cruz de error convierte un
            "todavia no hay nada" en "algo fallo".
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              [IlustracionBusqueda, 'Busqueda'],
              [IlustracionPublicar, 'Publicar'],
              [IlustracionFavoritos, 'Favoritos'],
              [IlustracionAlertas, 'Alertas'],
              [IlustracionConexion, 'Conexion'],
            ].map(([Ilustracion, nombre]) => {
              const I = Ilustracion as (p: { className?: string }) => React.ReactElement;
              return (
                <div
                  key={nombre as string}
                  className="flex flex-col items-center rounded-lg border border-line bg-white p-4 shadow-sm"
                >
                  <I className="w-full" />
                  <p className="text-caption mt-2 text-stone">{nombre as string}</p>
                </div>
              );
            })}
          </div>
        </Seccion>

        <Seccion titulo="Estado base sin ilustracion">
          <Estado
            titulo="Un estado generico"
            detalle="Sirve cuando ninguno de los especificos encaja."
            acciones={
              <>
                <AccionPrimaria onClick={() => console.log('principal')}>Principal</AccionPrimaria>
                <AccionSecundaria onClick={() => console.log('secundaria')}>
                  Secundaria
                </AccionSecundaria>
              </>
            }
          />
        </Seccion>
      </main>
    </div>
  );
}
