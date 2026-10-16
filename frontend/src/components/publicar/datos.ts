/**
 * Los datos del formulario de publicación. DS-8.
 *
 * Refleja **exactamente** lo que acepta `StorePropertyRequest` en el
 * backend. Cada campo que este aqui y no alla es un 422; cada campo
 * que alla y no este es un requisito que la persona no puede cumplir
 * y no se le avisa.
 *
 * Los enums vienen del backend y estan duplicados a proposito:
 * `PropertyType` y `Currency` viven en `src/Properties/Enums/`, y el
 * frontend no puede leer PHP. Lo que hay que mantener sincronizado es
 * la lista, y `PropertyTextSearchTest` y las pruebas de aqui son las
 * que avisan si divergen.
 */

import type { Currency, PropertyType } from '../../types/property';

export type { Currency, PropertyType };

/**
 * Lo que hay al empezar. Todos vacios, sin `as const` para que cada
 * campo sea opcional de verdad.
 */
export type DatosPublicacion = {
  // Paso 1 · basico
  type: PropertyType;
  title: string;
  description: string;

  // Paso 2 · precio
  monthly_rent: number | null;
  currency: Currency;
  deposit: number | null;

  // Paso 3 · caracteristicas
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  furnished: boolean;

  // Paso 4 · servicios
  includes_water: boolean;
  includes_electricity: boolean;
  includes_internet: boolean;
  pets_allowed: boolean;
  available_from: string | null;
  rules: string;

  // Paso 6 · ubicacion
  latitude: number | null;
  longitude: number | null;
  address_reference: string;
  district: string;
  neighborhood: string;
  show_exact_location: boolean;
};

export const DATOS_VACIOS: DatosPublicacion = {
  type: 'apartamento',
  title: '',
  description: '',

  monthly_rent: null,
  currency: 'CRC',
  deposit: null,

  bedrooms: 1,
  bathrooms: 1,
  parking_spaces: 0,
  furnished: false,

  includes_water: false,
  includes_electricity: false,
  includes_internet: false,
  pets_allowed: false,
  available_from: null,
  rules: '',

  latitude: null,
  longitude: null,
  address_reference: '',
  district: '',
  neighborhood: '',
  show_exact_location: true,
};

/**
 * Los seis pasos de DS-8.
 *
 * El paso 5 es Fotos y **ya tiene endpoint** (RF-2.3). La API devuelve
 * `images` de verdad y la subida va contra
 * `/properties/{id}/images`.
 *
 * Las fotos **no** viajan en el mismo POST que el inmueble: se suben
 * despues, y el `id` solo existe cuando la publicacion se creo. Por
 * eso el envio son dos pasos y por eso el borrador guarda los archivos
 * aparte del resto del formulario.
 */
export const PASOS = [
  { numero: 1, nombre: 'Básico' },
  { numero: 2, nombre: 'Precio' },
  { numero: 3, nombre: 'Características' },
  { numero: 4, nombre: 'Servicios' },
  { numero: 5, nombre: 'Fotos' },
  { numero: 6, nombre: 'Ubicación' },
] as const;

/**
 * Los distritos de San Carlos.
 *
 * Catalogo y no campo libre, que es lo que pide DS-8: "las direcciones
 * de Costa Rica no sirven para geolocalizar" y un distrito mal escrito
 * se cuela en el filtro de RF-4.1 sin que nadie lo note.
 *
 * Es la misma lista que `PropertyFactory` usa para los datos de prueba.
 */
export const DISTRITOS = [
  'Ciudad Quesada',
  'San Carlos',
  'Zarcero',
  'Grecia',
  'Aguas Zarcas',
  'Pital',
  'La Fortuna',
  'Florencia',
] as const;

export const TIPOS: { valor: PropertyType; etiqueta: string }[] = [
  { valor: 'apartamento', etiqueta: 'Apartamento' },
  { valor: 'casa', etiqueta: 'Casa' },
  { valor: 'habitacion', etiqueta: 'Habitación' },
  { valor: 'estudio', etiqueta: 'Estudio' },
];

export const MONEDAS: { valor: Currency; etiqueta: string }[] = [
  { valor: 'CRC', etiqueta: 'Colones ₡' },
  { valor: 'USD', etiqueta: 'Dólares US$' },
];
