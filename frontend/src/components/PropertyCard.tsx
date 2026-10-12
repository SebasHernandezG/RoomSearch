/**
 * Tarjeta de inmueble. DS-5.
 *
 * Es el componente mas repetido de la aplicacion: aparece en el listado,
 * en favoritos, en alertas y en el comparador. Si el diseno falla aqui,
 * falla en todas partes.
 *
 * Mobile first. La foto va en relacion 16:10 fija para que la cuadricula
 * no baile al cargar imagenes de distinta altura.
 */

import type { ReactElement } from 'react';

import { TIPO_LABEL, formatDistance, formatPrice } from '../lib/format';
import type { Property } from '../types/property';
import { BathIcon, BedIcon, HeartIcon, ParkingIcon, PhotoIcon, VerifiedIcon } from './icons';

type PropertyCardProps = {
  property: Property;
  /** Al_CALLBACK del corazon. Si no se pasa, no se muestra. */
  onToggleFavorite?: (property: Property) => void;
  /** El anillo del mapa se resalta al pasar sobre la tarjeta (RF-3.5). */
  onHover?: (propertyId: number | null) => void;
};

const RELACION_FOTO = 'aspect-[16/10]';

export default function PropertyCard({ property, onToggleFavorite, onHover }: PropertyCardProps) {
  const {
    id,
    title,
    district,
    neighborhood,
    type,
    monthly_rent,
    currency,
    bedrooms,
    bathrooms,
    parking_spaces,
    status,
    landlord_verified,
    is_favorite,
    distance_meters,
    images,
  } = property;

  const portada = images[0];
  const extra = Math.max(0, images.length - 1);
  const alquilada = status === 'alquilada';
  const distancia = formatDistance(distance_meters);
  const ubicacion = [district, neighborhood].filter(Boolean).join(' · ');

  /*
   * Un estudio no tiene habitaciones. Mostrar "0 hab." queda raro y
   * hace dudar de si el dato fallo al cargar. Se omite la fila entera.
   */
  type ClaveIcono = keyof typeof claseIcono;

  const caracteristicas = [
    type === 'estudio' ? null : { icono: 'cama' as ClaveIcono, texto: `${bedrooms} hab.` },
    { icono: 'bano' as ClaveIcono, texto: `${bathrooms} baño${bathrooms === 1 ? '' : 's'}` },
    parking_spaces > 0 ? { icono: 'parqueo' as ClaveIcono, texto: `${parking_spaces}` } : null,
  ].filter((c) => c !== null) as { icono: ClaveIcono; texto: string }[];

  const claseIcono = {
    cama: BedIcon,
    bano: BathIcon,
    parqueo: ParkingIcon,
  } satisfies Record<string, (props: { className?: string }) => ReactElement>;

  /*
   * El texto alternativo describe el inmueble, no el archivo. Un
   * "foto-1.jpg" no le sirve de nada a quien usa lector de pantalla.
   */
  const altFoto =
    portada?.alt ??
    `${TIPO_LABEL[type] ?? 'Inmueble'}${district ? ` en ${district}` : ''}, ${formatPrice(monthly_rent, currency)}`;

  return (
    <article
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      className="group relative overflow-hidden rounded-lg border border-line bg-white shadow-sm transition-shadow duration-200 ease-out hover:shadow-md focus-within:shadow-md motion-reduce:transition-none"
    >
      <div className={`relative ${RELACION_FOTO} overflow-hidden bg-sand`}>
        {portada ? (
          <img
            src={portada.url}
            alt={altFoto}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-opacity duration-200 motion-reduce:transition-none ${
              alquilada ? 'opacity-60' : ''
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-stone">
            <PhotoIcon className="h-8 w-8" />
            <span className="text-caption">Sin fotos</span>
          </div>
        )}

        {alquilada && (
          <span className="absolute inset-x-0 top-0 z-10 bg-forest/90 py-1.5 text-center text-caption font-semibold uppercase tracking-wide text-paper">
            Alquilada
          </span>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => onToggleFavorite(property)}
            aria-pressed={Boolean(is_favorite)}
            aria-label={is_favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-paper/90 text-ink transition-colors duration-200 hover:bg-paper motion-reduce:transition-none"
          >
            <HeartIcon className="h-5 w-5" filled={Boolean(is_favorite)} />
          </button>
        )}

        {extra > 0 && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-ink/75 px-2 py-1 text-caption text-paper">
            <PhotoIcon className="h-3.5 w-3.5" />
            {extra + 1}
          </span>
        )}
      </div>

      <div className="p-4">
        {/*
         * DS-5 dice que el precio va en `sun`, pero DS-1 lo marca como
         * no apto para texto: `sun` sobre `paper` da 2.1:1 y AA exige
         * 4.5:1. Va en `forest`, que da 12.6:1. El ambar queda para
         * acentos decorativos.
         */}
        <p className="text-h2 font-bold text-forest">
          {formatPrice(monthly_rent, currency)}
          <span className="text-small font-normal text-stone"> /mes</span>
        </p>

        <h3 className="mt-1 line-clamp-2 text-body font-semibold text-ink">{title}</h3>

        {ubicacion && <p className="text-small text-stone">{ubicacion}</p>}

        <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-stone">
          {caracteristicas.map((c) => {
            const Icono = claseIcono[c.icono]!;
            return (
              <li key={c.icono} className="flex items-center gap-1">
                <Icono className="h-4 w-4" />
                {c.texto}
              </li>
            );
          })}
        </ul>

        {(landlord_verified || distancia) && (
          <div className="mt-3 flex items-center gap-3">
            {landlord_verified && (
              <span className="flex items-center gap-1 text-caption font-medium text-leaf">
                <VerifiedIcon className="h-4 w-4" />
                Verificado
              </span>
            )}
            {distancia && <span className="text-caption text-stone">{distancia}</span>}
          </div>
        )}
      </div>

      {/*
       * Toda la tarjeta es un solo enlace. Si el titulo, la foto y el
       * boton de favorito fueran enlaces separados, un lector de
       * pantalla anunciaria la misma tarjeta cinco veces.
       */}
      <LinkOverlay
        href={`/inmuebles/${district ? slugify(district) : 'san-carlos'}/${id}`}
        label={`Ver ${TIPO_LABEL[type] ?? 'inmueble'} en ${district ?? 'San Carlos'}, ${formatPrice(monthly_rent, currency)}`}
      />
    </article>
  );
}

/**
 * Enlace que cubre la tarjeta sin interceptar los controles internos.
 *
 * Va en z-0, debajo del contenido, y sube a z-20 al recibir foco para
 * que el anillo se vea completo. El boton de favorito esta en z-10,
 * por encima del enlace: si no, el enlace se comeria el clic.
 */
function LinkOverlay({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="absolute inset-0 z-0 rounded-lg focus-visible:z-20"
    >
      <span className="absolute inset-0" />
    </a>
  );
}

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
