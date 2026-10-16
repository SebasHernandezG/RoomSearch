/**
 * El boton de WhatsApp. RF-5.2.
 *
 * ## Por que vive aqui y no en `inmueble.ts`
 *
 * Porque `inmueble.ts` decide **como se ve** un inmueble --el cintillo,
 * el CTA, la referencia-- y esto no es del inmueble: es del dueno, y
 * depende de un endpoint aparte (`/landlords/{id}`) que puede no existir
 * todavia. Mezclarlos hacia que la ficha tuviera que esperar al perfil
 * para pintar el resto.
 *
 * ## El numero nunca se inventa
 *
 * La funcion recibe el perfil **que devolvio el backend**, o `null`. No
 * recibe un telefono suelto ni lo deduce de nada: si el dueno lo marco
 * privado, el backend manda `whatsapp: null` y aqui no hay nada que
 * inventar. Un boton de WhatsApp que sale cuando el contacto es privado
 * es una fuga de datos en un boton.
 */

/** El perfil publico del dueno. Es un subconjunto del Resource. */
export type PerfilDueno = {
  user_id: number;
  name: string | null;
  email_verified: boolean;
  phone: string | null;
  phone_public: boolean;
  whatsapp: string | null;
  photo_url: string | null;
  bio: string | null;
  years_experience: number | null;
};

export type InmuebleParaWhatsApp = {
  title: string;
  address_reference: string | null;
  district: string | null;
  /** La referencia corta del anuncio, del tipo `RS-1042`. */
  reference?: string | null;
};

/**
 * Si se puede mostrar el boton.
 *
 * Tres condiciones, y la segunda es la que no se negocia:
 *
 * 1. Hay perfil con numero de WhatsApp.
 * 2. El backend **no lo filtro**. Un `whatsapp` no nulo significa que
 *    el dueno no lo marco privado y que su correo esta confirmado.
 *    Aca no se reevalua: si el backend lo dejo pasar, sale.
 * 3. El anuncio esta activo. Escribirle a alguien por un inmueble
 *    alquilado o pausado es molestia para alguien que ya no puede
 *    hacer nada.
 */
export function puedeWhatsApp(perfil: PerfilDueno | null, estado: PropertyStatusLike): boolean {
  if (perfil?.whatsapp == null || perfil.whatsapp === '') return false;

  return estado === 'activa';
}

/** El estado, tal y como lo nombra el backend. */
type PropertyStatusLike = 'pendiente' | 'activa' | 'borrador' | 'pausada' | 'alquilada';

/**
 * El mensaje prellenado.
 *
 * Lleva el **titulo y la referencia**, no solo el titulo: al dueno le
 * llegan mensajes de varios anuncios a la vez y "Hola, me interesa el
 * apartamento" no dice de cual. La referencia es lo que le permite
 * encontrar el anuncio en su panel.
 *
 * ## El texto va tal cual lo escribio el dueno
 *
 * Sin tildes, sin "normalizar", sin quitar acentos. Parecia que si,
 * por la razon de siempre --que una tilde rompe un enlace-- pero es
 * falso: `encodeURIComponent` convierte `á` en `%C3%A1`, que es una
 * URL perfectamente valida, y quien escribio asi lo quiere ver.
 * Aplanar el texto del dueno lo hace parecer que el sitio esta roto.
 *
 * Lo que si rompe un enlace son los **espacios**, y por eso
 * `enlaceWhatsApp()` codifica.
 */
export function mensajeWhatsApp(inmueble: InmuebleParaWhatsApp): string {
  const partes = [`Hola, me interesa el inmueble "${inmueble.title}".`];

  if (inmueble.reference) {
    partes.push(`Referencia: ${inmueble.reference}.`);
  }

  const donde = [inmueble.address_reference, inmueble.district].filter(Boolean).join(', ');

  if (donde) {
    partes.push(`Ubicacion: ${donde}.`);
  }

  partes.push('¿Sigue disponible?');

  return partes.join(' ');
}

/**
 * La URL de `wa.me`, o `null` si no hay numero.
 *
 * El numero va **crudo**, sin `+` ni espacios: `wa.me` espera solo
 * digitos, y el `+` produce un 404 que se ve como "WhatsApp no
 * funciona" en lugar de como "el numero esta mal".
 */
export function enlaceWhatsApp(
  perfil: PerfilDueno | null,
  inmueble: InmuebleParaWhatsApp,
): string | null {
  if (!puedeWhatsApp(perfil, 'activa')) {
    return null;
  }

  const numero = perfil!.whatsapp!.replace(/\D/g, '');

  if (numero === '') {
    return null;
  }

  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp(inmueble))}`;
}

/**
 * Como se lee el numero para una persona.
 *
 * `+506 8888-1234`, no `+50688881234`. El numero crudo se puede marcar
 * igual, pero leerlo de corrido es trabajo; y el boton de "copiar"
 * copia el crudo, que es el que la app espera.
 */
export function numeroLegible(numero: string): string {
  const digitos = numero.replace(/\D/g, '');

  if (digitos.length < 4) {
    return numero;
  }

  const pais = digitos.slice(0, 3);
  const resto = digitos.slice(3);

  return `+${pais} ${resto.slice(0, 4)}-${resto.slice(4)}`;
}
