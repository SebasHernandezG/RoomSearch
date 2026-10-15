/**
 * Contexto de sesion. RF-1.1.
 *
 * Vive en un contexto y no en el modulo de cada pantalla porque el
 * token se consulta en tres sitios --el encabezado, el boton de
 * publicar y la proteccion de rutas-- y mantener tres copias del mismo
 * estado es como aparecen los que no se actualizan.
 *
 * `cargando` es parte del estado y no un detalle: al abrir la
 * aplicacion se consulta `/api/user` para comprobar que el token
 * guardado sigue vivo. Sin ese estado, la pantalla de entrada y la de
 * buscar parpadean entre "entrar" y "ya entraste" en cada recarga.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  cerrarSesion as apiCerrarSesion,
  iniciarSesion as apiIniciarSesion,
  leerToken,
  registrar as apiRegistrar,
  yo as apiYo,
  type Usuario,
} from '../lib/sesion';

type EstadoSesion =
  { fase: 'cargando' } | { fase: 'sin-sesion' } | { fase: 'con-sesion'; usuario: Usuario };

type ValorSesion = {
  estado: EstadoSesion;
  /** Atajo para no tener que mirar la fase en cada sitio. */
  usuario: Usuario | null;
  entrar: (correo: string, contrasena: string) => Promise<void>;
  crearCuenta: (
    nombre: string,
    correo: string,
    contrasena: string,
  ) => Promise<{ necesitaConfirmarCorreo: boolean }>;
  salir: () => Promise<void>;
  /** Refresca el usuario. Se usa tras publicar o moderar. */
  refrescar: () => Promise<void>;
};

const Contexto = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>(() =>
    leerToken() ? { fase: 'cargando' } : { fase: 'sin-sesion' },
  );

  const leerUsuario = useCallback(async () => {
    if (!leerToken()) {
      setEstado({ fase: 'sin-sesion' });
      return;
    }

    try {
      const usuario = await apiYo();

      setEstado(usuario ? { fase: 'con-sesion', usuario } : { fase: 'sin-sesion' });
    } catch {
      /*
       * Un fallo aqui NO significa "sin sesion". `yo()` ya limpia el
       * token si el servidor responde 401, y deja el token intacto si
       * fue un 500 o no hay red.
       *
       * Ante la duda se trata como sin sesion: mostrar la pantalla de
       * ingreso es recuperable, y dejar la aplicacion en blanco
       * cargando para siempre no lo es. El token sigue ahi, asi que
       * un `refrescar` lo recupera.
       */
      setEstado({ fase: 'sin-sesion' });
    }
  }, []);

  useEffect(() => {
    void leerUsuario();
  }, [leerUsuario]);

  const entrar = useCallback(async (correo: string, contrasena: string) => {
    const { usuario } = await apiIniciarSesion(correo, contrasena);

    setEstado({ fase: 'con-sesion', usuario });
  }, []);

  const crearCuenta = useCallback(async (nombre: string, correo: string, contrasena: string) => {
    const { usuario } = await apiRegistrar(nombre, correo, contrasena);

    setEstado({ fase: 'con-sesion', usuario });

    /*
     * La cuenta nace sin verificar (RF-1.3) y publicar exige
     * confirmarlo. Por eso se devuelve el dato: la pantalla avisa, en
     * vez de dejar a alguien esperando un correo que no sabe que
     * tiene que confirmar antes de poder publicar.
     */
    return { necesitaConfirmarCorreo: !usuario.email_verified };
  }, []);

  const salir = useCallback(async () => {
    await apiCerrarSesion();

    setEstado({ fase: 'sin-sesion' });
  }, []);

  const valor = useMemo<ValorSesion>(
    () => ({
      estado,
      usuario: estado.fase === 'con-sesion' ? estado.usuario : null,
      entrar,
      crearCuenta,
      salir,
      refrescar: leerUsuario,
    }),
    [estado, entrar, crearCuenta, salir, leerUsuario],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * La sesion, desde cualquier parte.
 *
 * Lanza si se usa fuera del proveedor, en vez de devolver `null`: un
 * `null` silencioso apareceria como "siempre sin sesion" en una
 * pantalla que deberia tener sesion, y eso es un fallo dificil de
 * rastrear.
 */
export function useSesion(): ValorSesion {
  const valor = useContext(Contexto);

  if (valor === null) {
    throw new Error('useSesion se uso fuera de <ProveedorSesion>. En App.tsx falta el proveedor.');
  }

  return valor;
}
