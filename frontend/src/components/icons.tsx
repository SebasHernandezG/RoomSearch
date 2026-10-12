/**
 * Iconos de la tarjeta, en SVG inline.
 *
 * Se hacen a mano en vez de agregar una libreria porque son cinco y
 * todos usan trazo de 2 px con `currentColor`. Una dependencia mas por
 * eso no vale la pena.
 *
 * Todos son decorativos: el texto que los acompaña ya dice lo que
 * significan, asi que van con aria-hidden.
 */

type IconProps = {
  className?: string;
};

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export function BedIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 7v11M2 12h20v6M22 12V9a2 2 0 0 0-2-2h-8v5" />
      <circle cx="6.5" cy="10.5" r="1.5" />
    </svg>
  );
}

export function BathIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 11h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3Z" />
      <path d="M6 11V5a2 2 0 0 1 4 0" />
      <path d="M7 21l-1 2M17 21l1 2" />
    </svg>
  );
}

export function ParkingIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9.5 17V7h3a3 3 0 0 1 0 6h-3" />
    </svg>
  );
}

export function HeartIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 7a4 4 0 0 1 7 3.8C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

export function VerifiedIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 12 2 2 4-4" />
      <path d="M12 3 4.5 6v5c0 4.5 3.1 8.4 7.5 9.6 4.4-1.2 7.5-5.1 7.5-9.6V6L12 3Z" />
    </svg>
  );
}

export function PhotoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-4.5-4.5L8 20" />
    </svg>
  );
}
