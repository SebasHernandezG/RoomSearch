/**
 * Lo que se decide sobre un inmueble sin pintarlo. DS-12.
 *
 * Misma idea que `lib/filtros.ts`: la pagina de detalle decide el
 * cintillo, el texto del boton, la referencia de ubicacion y los
 * datos estructurados de SEO. Si cada uno de esos decidiera por su
 * cuenta, el boton podria decir "Me interesa" en una publicacion
 * alquilada y los datos de SEO podrian prometer fotos que no hay.
 *
 * ## Lo que se fue a otras librerias
 *
 * `puedeWhatsApp` vivio aqui con un `return false` y el motivo
 * escrito, porque no habia numero de donde sacarlo. Ya lo hay, pero no
 * es una decision de este archivo: depende del perfil del dueno, que
 * viene de `/landlords/{id}` y no del inmueble. Vive en
 * `lib/whatsapp.ts` junto al enlace y al mensaje.
 *
 * `images` ya no viene `[]` (RF-2.3) y `imagenes()` devuelve la
 * galeria de verdad, con el placeholder solo cuando no hay ninguna.
 */

import { formatPrice, TIPO_LABEL } from './format';
import type { Currency, Property, PropertyImage, PropertyStatus } from '../types/property';

/**
 * El cintillo de arriba, si va alguno.
 *
 * No es decoracion: una publicacion pausada o alquilada **pide** lo
 * mismo que antes y no lo cumple. Sin el aviso, alguien llega, pide
 * informacion y se entera tres dias despues de que hace semanas que
 * no hay.
 */
export type Cintillo = {
  tono: 'aviso' | 'alerta';
  titulo: string;
  detalle: string;
};

export function cintillo(status: PropertyStatus): Cintillo | null {
  switch (status) {
    case 'pausada':
      return {
        tono: 'aviso',
        titulo: 'Esta publicación está pausada',
        detalle: 'El arrendador la suspendió. Podés mirarla, pero no está disponible.',
      };

    case 'alquilada':
      return {
        tono: 'alerta',
        titulo: 'Ya está alquilada',
        detalle:
          'Esta casa encontró inquilino. Podés dejarnos tu correo y te avisamos si sale algo parecido.',
      };

    case 'pendiente':
      return {
        tono: 'aviso',
        titulo: 'En revisión',
        detalle: 'Todavía no la estamos publicando. Es normal: la revisamos a mano.',
      };

    case 'borrador':
      return {
        tono: 'aviso',
        titulo: 'Borrador',
        detalle: 'Esta publicación está a medio hacer.',
      };

    // `activa` es el estado normal y no lleva cintillo: un aviso de
    // "todo bien" en cada ficha es ruido que entrena a la gente a
    // ignorar los avisos.
    case 'activa':
      return null;

    default:
      return null;
  }
}

/**
 * Que dice el boton principal.
 *
 * Cambia con el estado porque la accion cambia: pedir informacion de
 * una casa alquilada no tiene sentido, y el boton que lo ofrece sin
 * contexto es el que hace que alguien se sienta timedelta.
 */
export function textoPrincipal(status: PropertyStatus): string {
  return status === 'alquilada' ? 'Avísame cuando haya algo similar' : 'Me interesa';
}

/** Si el boton principal sirve para pedir informacion. */
export function puedeContactar(status: PropertyStatus): boolean {
  return status !== 'alquilada';
}

/**
 * La referencia de donde queda. RF-2.5.
 *
 * Es **texto**, no un pin: cuando el arrendador no autoriza mostrar
 * la ubicacion exacta, el mapa ya devuelve un punto desplazado
 * (`PropertyLocation`), y lo unico honesto que queda es describir el
 * lugar con palabras. Por eso aqui nunca se escribe una coordenada.
 */
export function referencia(
  property: Pick<Property, 'address_reference' | 'district' | 'neighborhood'>,
): string {
  const partes = [
    property.address_reference?.trim() || null,
    property.neighborhood?.trim() || null,
    property.district?.trim() || null,
  ].filter((p): p is string => Boolean(p));

  if (partes.length === 0) {
    return 'El arrendador no indicó la ubicación.';
  }

  return partes.join(' · ');
}

/**
 * La referencia corta del anuncio, del tipo `RS-1042`.
 *
 * ## Para que existe
 *
 * Para que el dueno sepa **de cual** de sus anuncios le escriben. Sin
 * ella, el mensaje de WhatsApp es "Hola, me interesa el apartamento" y
 * con ocho anuncios activos es indistinguible de los otros siete.
 *
 * Va en el mensaje prellenado, no en la pantalla: un `RS-1042` en
 * pantalla es ruido para quien busca y no aporta nada.
 */
export function referenciaCorta(property: Pick<Property, 'id'>): string {
  return `RS-${property.id}`;
}

/**
 * Si el mapa puede mostrar el pin exacto.
 *
 * Doble condicion: que la publicacion lo autorice **y** que tenga
 * coordenadas. Mostrar el pin sin avisar seria el fallo de privacidad
 * que RF-2.5 existe para evitar.
 */
export function pinVisible(
  property: Pick<Property, 'show_exact_location' | 'latitude' | 'longitude'>,
): boolean {
  return property.show_exact_location && property.latitude !== null && property.longitude !== null;
}

/** Un servicio incluido, o la falta de el. */
export type Servicio = {
  clave: string;
  etiqueta: string;
  incluido: boolean;
};

/**
 * Los servicios, para pintar iconos y no una lista de texto.
 *
 * Los tres que existen en la API van siempre,hire los que no esten
 * marcados. Ocultarlos cuando son `false` seria mentir: alguien
 * asume que lo que no aparece es lo que no hay, cuando en realidad
 * es lo que el arrendador no respondio.
 */
export function servicios(property: Property): Servicio[] {
  return [
    { clave: 'agua', etiqueta: 'Agua', incluido: property.includes_water === true },
    { clave: 'luz', etiqueta: 'Luz', incluido: property.includes_electricity === true },
    { clave: 'internet', etiqueta: 'Internet', incluido: property.includes_internet === true },
    { clave: 'amueblado', etiqueta: 'Amueblado', incluido: property.furnished === true },
    { clave: 'mascotas', etiqueta: 'Admite mascotas', incluido: property.pets_allowed === true },
  ];
}

/** Como se leen los contadores. "1 habitación", no "1 habitaciones". */
export function plural(cantidad: number, singular: string, plural_: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural_}`;
}

/**
 * Los datos estructurados de RNF-13.
 *
 * `RealEstateListing` es el tipo correcto para una alquiler. El
 * `url` y el `name` los pone quien llama porque dependen de la
 * pagina.
 *
 * **No se inventa `image`.** Schema.org lo marca como recomendado, no
 * obligatorio, y un `image` que apunta a una foto que no existe es
 * peor que ninguno: Google lo indexa y el resultado en busqueda
 * muestra un hueco.
 */
export function datosEstructurados(property: Property, url: string): Record<string, unknown> {
  const datos: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    url,
    name: property.title,
    description: property.description ?? undefined,
    datePosted: property.created_at ?? undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.district ?? undefined,
      addressRegion: 'San Carlos',
      addressCountry: 'CR',
      streetAddress: property.address_reference ?? undefined,
    },
    numberOfRooms: property.bedrooms,
    offers: {
      '@type': 'Offer',
      price: property.monthly_rent,
      priceCurrency: property.currency,
      availability: property.status === 'activa' ? 'https://schema.org/InStock' : undefined,
    },
  };

  /*
   * Se limpian las claves vacias al final, no una por una.
   *
   * Un `undefined` en un objeto que va a `JSON.stringify` desaparece
   * solo, pero un `null` se serializa y Google lo lee como "este dato
   * es null", que es una afirmacion distinta de "no lo sé".
   */
  for (const clave of Object.keys(datos)) {
    if (datos[clave] === undefined) delete datos[clave];
  }

  return datos;
}

/** El precio como lo muestra el SEO, con el simbolo. */
export function precioTexto(property: Pick<Property, 'monthly_rent' | 'currency'>): string {
  return formatPrice(property.monthly_rent, property.currency as Currency);
}

/**
 * La etiqueta del tipo, con el nombre que usa la gente.
 *
 * `TIPO_LABEL` vive en `format.ts` porque lo usan la tarjeta y la
 * ficha. Duplicar el mapa es como uno de los dos deja de recibir el
 * nombre nuevo.
 */
export function tipoTexto(property: Pick<Property, 'type'>): string {
  return TIPO_LABEL[property.type] ?? property.type;
}

/**
 * Las imagenes que hay, o un aviso de que todavia no hay ninguna.
 *
 * RF-2.3 no existe y la API devuelve `[]`. Devolver el texto y no un
 * array vacio obliga a la galeria a decidir el placeholder en un solo
 * sitio.
 */
export function imagenes(property: Pick<Property, 'images'>): PropertyImage[] | 'sin-fotos' {
  return property.images.length > 0 ? property.images : 'sin-fotos';
}
