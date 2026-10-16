/**
 * Tipos que reflejan el dominio de Properties.
 *
 * Espejan lo que devuelve la API, no lo que hay en la base de datos.
 * `currency` y `type` usan los mismos valores que los enums del backend
 * (Modules\Properties\Enums).
 */

export type PropertyType = 'apartamento' | 'casa' | 'habitacion' | 'estudio';

export type Currency = 'CRC' | 'USD';

export type PropertyStatus = 'borrador' | 'pendiente' | 'activa' | 'pausada' | 'alquilada';

export interface PropertyImage {
  id: number;
  url: string;
  /** Alt describe el inmueble, no el archivo: DS-10 exige textos utiles. */
  alt: string;
  /** RF-2.3: la que sale primero en la galeria. */
  is_primary: boolean;
}

export interface Property {
  id: number;
  title: string;

  /** RF-2.2. Puede venir `null`: la descripcion es opcional. */
  description: string | null;

  district: string | null;
  neighborhood: string | null;
  type: PropertyType;
  monthly_rent: number;
  currency: Currency;
  deposit: number | null;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  furnished: boolean;
  pets_allowed: boolean;
  status: PropertyStatus;

  /** RF-2.4: servicios incluidos en el alquiler. */
  includes_water: boolean;
  includes_electricity: boolean;
  includes_internet: boolean;

  /** RF-2.6: desde cuando se puede entrar. `null` = "ya". */
  available_from: string | null;

  /** RF-2.2: reglas de la casa, texto libre. */
  rules: string | null;

  /**
   * RF-2.4: la referencia escrita por el arrendador.
   *
   * Es lo que se ve cuando no se muestra la ubicacion exacta, asi
   * que es obligatoria en el backend aunque `latitude` sea `null` en
   * un borrador.
   */
  address_reference: string | null;

  /** RF-2.4: el pin lo elige el arrendador. Puede faltar en un borrador. */
  latitude: number | null;
  longitude: number | null;

  /** RF-2.5: si es false, el mapa muestra un area aproximada. */
  show_exact_location: boolean;

  /** RF-8.1: insignia de arrendador verificado. */
  landlord_verified: boolean;

  /** Solo llega si el usuario inicio sesion y marco la propiedad. */
  is_favorite?: boolean;

  /**
   * Distancia en metros al punto de referencia activo (RF-3.7).
   * Viene del servidor, nunca se calcula en el cliente.
   */
  distance_meters?: number | null;

  images: PropertyImage[];

  created_at?: string | null;
}
