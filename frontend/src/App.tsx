/**
 * Entrada de la aplicacion. RF-1.1.
 *
 * Antes era un componente fijo que siempre pintaba la pantalla de
 * busqueda. Con las rutas de sesion, `App` pasa a decidir: hay que
 * saber quien entro antes de mostrar la pantalla de buscar, porque
 * el encabezado cambia segun haya sesion.
 *
 * El proveedor va **aqui** y no en `main.tsx`: vive justo por encima
 * del router, para que un cambio de ruta no pueda dejar una pagina
 * sin sesion que leer.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import PantallaBusqueda from './components/PantallaBusqueda';
import PantallaIngreso from './components/PantallaIngreso';
import PantallaDetalle from './components/detalle/PantallaDetalle';
import FormularioPublicar from './components/publicar/FormularioPublicar';
import PantallaModeracion from './components/moderacion/PantallaModeracion';
import { ProveedorAvisos } from './components/ProveedorAvisos';
import { ProveedorSesion, useSesion } from './components/SesionContexto';

export default function App() {
  return (
    /*
     * El orden de los dos proveedores importa.
     *
     * `ProveedorAvisos` va **encima** de `ProveedorSesion` para que
     * cualquier pantalla que use `useSesion` pueda avisar sin que
     * falte el contexto de avisos. Al reves, un `useAvisos` dentro de
     * un hijo de la sesion lanzaria.
     */
    <ProveedorAvisos>
      <ProveedorSesion>
        <BrowserRouter>
          <Rutas />
        </BrowserRouter>
      </ProveedorSesion>
    </ProveedorAvisos>
  );
}

function Rutas() {
  const { estado } = useSesion();

  /*
   * Mientras se comprueba el token guardado no se decide nada.
   *
   * Redirigir a "entrar" durante la comprobacion produce el fallo
   * clasico de acceso: se ve la pantalla de ingreso un instante y
   * despues desaparece sola cuando llega el token. Es un parpadeo que
   * parece un error, y en una pantalla lenta dura segundos.
   */
  if (estado.fase === 'cargando') {
    return <EsqueletoArranque />;
  }

  return (
    <Routes>
      <Route path="/" element={<PantallaBusqueda />} />
      <Route path="/entrar" element={<PantallaIngreso modo="entrar" />} />
      <Route path="/crear-cuenta" element={<PantallaIngreso modo="registro" />} />
      <Route path="/publicar" element={<FormularioPublicar />} />

      {/*
        La moderacion no se protege por ruta.

        El backend responde 403 y la pantalla lo dice, porque el rol
        vive en el token y no en la navegacion: protegerla aqui exigiria
        una peticion extra para nada, y durante la comprobacion del
        token se veria un "no tenes permiso" a alguien que si lo tiene.
      */}
      <Route path="/moderacion" element={<PantallaModeracion />} />

      {/*
        El `slug` del distrito se acepta pero no se usa.
        `PropertyCard` ya enlaza a `/inmuebles/ciudad-quesada/12`: el
        distrito va en la ruta porque un enlace se lee mejor asi, y
        porque ignorarlo no rompe los enlaces que ya estaban escritos.
      */}
      <Route path="/inmuebles/:slug/:id" element={<PantallaDetalle />} />

      {/*
        `*` y no una ruta 404: cualquier ruta desconocida vuelve a la
        pantalla de buscar. Un 404 propio obliga a escribir el destino
        a mano, y en el movil se llega por enlaces viejos con
        facilidad.
      */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * While the session is being checked.
 *
 * `aria-busy` y no un spinner: DS-10 pide que el esqueleto no
 * parpadee, y una animacion infinita con lector de pantalla anuncia
 * "cargando" cada pocos segundos sin decir nada nuevo.
 */
function EsqueletoArranque() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4"
    >
      <div className="h-8 w-48 animate-pulse rounded-md bg-sand motion-reduce:animate-none" />
      <div className="h-12 w-full animate-pulse rounded-md bg-sand motion-reduce:animate-none" />
      <div className="h-12 w-full animate-pulse rounded-md bg-sand motion-reduce:animate-none" />
    </div>
  );
}
