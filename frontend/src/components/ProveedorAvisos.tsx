/**
 * El proveedor de avisos. DS-11.
 *
 * Todo lo que pasa en la aplicacion necesita decir algo: "guardado",
 * "no pudimos conectar", "ya estás en favoritos". Cada pantalla tiene
 * su propio `role="alert"` para los errores de formulario, que son de
 * *esa* pantalla; los avisos que no pertenecen a un formulario van
 * aqui, en una region unica que el lector de pantalla anuncia sin
 * tener que adivinar de donde salio.
 *
 * ## Por que `contexto` y no una funcion importada
 *
 * Un `emitirAviso()` a nivel de modulo necesita un almacen global, y
 * el estado global sobrevive al desmontaje de la pantalla: el aviso de
 * "guardado" que se emitio en la ficha aparece en la de buscar. Con
 * un contexto, la region de avisos se desmonta con la aplicacion y el
 * aviso se va con ella.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  DURACION_AVISO,
  agregar,
  announcedPoliteness,
  quitar,
  seDescarta,
  type Aviso,
} from '../lib/avisos';

type ValorAvisos = {
  avisos: Aviso[];
  exito: (texto: string) => void;
  info: (texto: string) => void;
  error: (texto: string) => void;
  cerrar: (id: number) => void;
};

const Contexto = createContext<ValorAvisos | null>(null);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  /*
   * El reloj de los descartes.
   *
   * Vive en un ref y no en un `useEffect` por aviso porque un efecto
   * por aviso es un efecto mas por cada render mientras el aviso
   * exista: el temporizador se crea, se limpia y se vuelve a crear.
   * Con una sola lista, cada aviso nace con su reloj y lo suelta al
   * morir.
   */
  const relojes = useRef(new Map<number, number>());

  const idRef = useRef(0);

  const soltar = useCallback((id: number) => {
    const reloj = relojes.current.get(id);

    if (reloj !== undefined) {
      window.clearTimeout(reloj);
      relojes.current.delete(id);
    }
  }, []);

  const quitarAviso = useCallback(
    (id: number) => {
      soltar(id);
      setAvisos((actuales) => quitar(actuales, id));
    },
    [soltar],
  );

  const emitir = useCallback(
    (texto: string, tono: Aviso['tono']) => {
      /*
       * Un id que sube y no `Date.now()`.
       *
       * Dos avisos en el mismo milisegundo --"guardado" y "en
       * favoritos" al tocar una vez-- colisionarian con la hora y el
       * segundo no se veria nunca: los dos tendrian el mismo id y el
       * primero en llegar se llevaria los dos.
       */
      idRef.current += 1;

      const aviso: Aviso = {
        id: idRef.current,
        texto,
        tono,
        persiste: tono === 'error',
      };

      setAvisos((actuales) => agregar(actuales, aviso));

      if (seDescarta(aviso)) {
        relojes.current.set(
          aviso.id,
          window.setTimeout(() => quitarAviso(aviso.id), DURACION_AVISO),
        );
      }
    },
    [quitarAviso],
  );

  /*
   * Al desmontar se limpian todos los relojes.
   *
   * Sin esto, un aviso que vivia 4 segundos sigue con su `setTimeout`
   * despues de que la pantalla se fue, y el primer render de la
   * siguiente recibe un `setAvisos` sobre un componente desmontado.
   */
  useEffect(() => {
    const pendientes = relojes.current;

    return () => {
      for (const reloj of pendientes.values()) {
        window.clearTimeout(reloj);
      }

      pendientes.clear();
    };
  }, []);

  const valor = useMemo<ValorAvisos>(
    () => ({
      avisos,
      exito: (texto: string) => emitir(texto, 'exito'),
      info: (texto: string) => emitir(texto, 'info'),
      error: (texto: string) => emitir(texto, 'error'),
      cerrar: quitarAviso,
    }),
    [avisos, emitir, quitarAviso],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}

      {/*
        Abajo y a la derecha, no arriba: arriba esta el encabezado y la
        barra de pestanas, y el aviso aparece justo cuando alguien
        esta tocando la barra.
      */}
      <div
        role="region"
        aria-label="Avisos"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
      >
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            role={aviso.tono === 'error' ? 'alert' : 'status'}
            aria-live={announcedPoliteness(aviso) ?? undefined}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              aviso.tono === 'error'
                ? 'border-clay bg-white'
                : aviso.tono === 'exito'
                  ? 'border-line bg-white'
                  : 'border-line bg-white'
            }`}
          >
            <span aria-hidden="true" className="mt-0.5 text-leaf">
              {aviso.tono === 'error' ? '⚠' : aviso.tono === 'exito' ? '✓' : 'ℹ'}
            </span>

            <p className="text-small flex-1 text-ink">{aviso.texto}</p>

            {/*
              El cierre manual esta **siempre**, incluso en los avisos
              que se van solos. Un aviso de cuatro segundos con solo
              temporizador no se puede apartar: si esta tapando algo y
              uno quiere seguir, tiene que esperar.
            */}
            <button
              type="button"
              onClick={() => quitarAviso(aviso.id)}
              aria-label="Cerrar aviso"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-stone transition-colors duration-200 hover:bg-sand motion-reduce:transition-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

/**
 * Los avisos, desde cualquier parte.
 *
 * Lanza fuera del proveedor, como `useSesion`: un `null` silencioso
 * apareceria como "esta aplicacion no avisa de nada" en una pantalla
 * que deberia estar avisando, y eso no se rastrea.
 */
export function useAvisos(): ValorAvisos {
  const valor = useContext(Contexto);

  if (valor === null) {
    throw new Error('useAvisos se uso fuera de <ProveedorAvisos>. En App.tsx falta el proveedor.');
  }

  return valor;
}
