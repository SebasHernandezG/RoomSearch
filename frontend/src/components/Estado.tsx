/**
 * Base de los estados vacios y de error. DS-4.
 *
 * Todos ofrecen una accion. Un estado vacio sin salida deja a la
 * persona frente a una pantalla muerta: el criterio de aceptacion del
 * issue es que nunca exista uno asi.
 *
 * aria-live="polite" en el contenedor: cuando la lista se reemplaza por
 * un estado vacio, un lector de pantalla lo anuncia sin interrumpir lo
 * que este leyendo.
 */

import type { ReactNode } from 'react';

type EstadoProps = {
  titulo: string;
  /** Acepta JSX para poder encadenar varias lineas de mensaje. */
  detalle?: ReactNode;
  /** Ilustracion decorativa. El titulo ya explica la situacion. */
  ilustracion?: ReactNode;
  acciones?: ReactNode;
  /** Contenido opcional entre el detalle y las acciones. */
  children?: ReactNode;
  className?: string;
};

export default function Estado({
  titulo,
  detalle,
  ilustracion,
  acciones,
  children,
  className = '',
}: EstadoProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center rounded-lg border border-line bg-white px-6 py-12 text-center shadow-sm ${className}`}
    >
      {ilustracion && <div className="mb-4 w-40 max-w-full">{ilustracion}</div>}

      <h2 className="text-h2 max-w-prose">{titulo}</h2>

      {detalle && <div className="text-body mt-2 max-w-prose text-stone">{detalle}</div>}

      {children && <div className="mt-6 w-full">{children}</div>}

      {acciones && <div className="mt-6 flex flex-wrap justify-center gap-3">{acciones}</div>}
    </div>
  );
}

/**
 * Acciones de los estados. Se separan del Estado para que el marcado de
 * los botones sea identico en todos los estados vacios.
 *
 * La primaria va en forest, que da 12.6:1 de contraste sobre paper.
 * `sun` no se usa para texto: da 2.1:1 y AA exige 4.5:1 (DS-1).
 */

export function AccionPrimaria({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const clases =
    'inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-5 text-body font-semibold text-paper transition-colors duration-200 hover:bg-leaf motion-reduce:transition-none';

  return href ? (
    <a href={href} className={clases}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={clases}>
      {children}
    </button>
  );
}

export function AccionSecundaria({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const clases =
    'inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-paper px-5 text-body font-semibold text-leaf transition-colors duration-200 hover:bg-sand motion-reduce:transition-none';

  return href ? (
    <a href={href} className={clases}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={clases}>
      {children}
    </button>
  );
}
