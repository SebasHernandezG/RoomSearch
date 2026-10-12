/**
 * Ilustraciones para estados vacios. DS-4.
 *
 * Linea de 2 px en coffee y sand, sin texto dentro. No son iconos de
 * sistema: una cruz roja o un icono de alerta convierte un "todavia no
 * hay nada" en "algo fallo".
 *
 * Todas decorativas, con aria-hidden: el titulo y el detalle ya
 * explican la situacion.
 */

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

type Props = { className?: string };

/** Casa con lupa: no encontramos nada. */
export function IlustracionBusqueda({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} {...trazo} role="presentation">
      <path d="M28 62 68 30l40 32" className="text-coffee" />
      <path d="M36 58v38a4 4 0 0 0 4 4h56a4 4 0 0 0 4-4V58" className="text-coffee" />
      <rect x="60" y="78" width="24" height="22" rx="2" className="text-sand" />
      <circle cx="106" cy="76" r="20" className="text-coffee" />
      <path d="m121 91 14 14" className="text-coffee" />
    </svg>
  );
}

/** Casa con puerta abierta y flecha: todavia no publicaste nada. */
export function IlustracionPublicar({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} {...trazo} role="presentation">
      <path d="M40 60 80 28l40 32" className="text-coffee" />
      <path d="M48 56v40a4 4 0 0 0 4 4h24V70H72V62H48" className="text-coffee" />
      <path d="M48 56v40a4 4 0 0 0 4 4h56a4 4 0 0 0 4-4V56" className="text-coffee" />
      <path d="M112 34h22m-8-8 8 8-8 8" className="text-coffee" />
    </svg>
  );
}

/** Corazon vacio: no guardaste nada. */
export function IlustracionFavoritos({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} {...trazo} role="presentation">
      <path
        d="M80 92s-32-20-32-42a16 16 0 0 1 32-6 16 16 0 0 1 32 6c0 22-32 42-32 42Z"
        className="text-coffee"
      />
      <path d="M60 50a12 12 0 0 1 12-4" className="text-sand" />
    </svg>
  );
}

/** Campana con ondas: no tenes alertas. */
export function IlustracionAlertas({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} {...trazo} role="presentation">
      <path d="M56 78V58a24 24 0 0 1 48 0v20l8 10H48l8-10Z" className="text-coffee" />
      <path d="M74 96a6 6 0 0 0 12 0" className="text-coffee" />
      <path d="M48 42a34 34 0 0 1 64 0" className="text-sand" />
    </svg>
  );
}

/**
 * Nube con corte: no pudimos cargar.
 *
 * No lleva rayado rojo de error a proposito. Es un aviso, no una falla
 * del usuario.
 */
export function IlustracionConexion({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} {...trazo} role="presentation">
      <path
        d="M48 84a20 20 0 0 1 2-40 28 28 0 0 1 53-6 20 20 0 0 1 9 46Z"
        className="text-coffee"
      />
      <path d="m58 96 44-44" className="text-clay" />
    </svg>
  );
}
