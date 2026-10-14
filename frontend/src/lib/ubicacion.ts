/**
 * Ubicación actual. RF-3.4.
 *
 * Vive en `lib/` y no adentro del mapa porque es lógica comprobable:
 * los tres casos de error del navegador se distinguen por un código, y
 * cada uno necesita un mensaje distinto. Si esto estuviera dentro del
 * componente, los tres caminos se prueban a mano con el navegador
 * denying permisos uno por uno.
 */

export type CodigoError = 1 | 2 | 3;

/** Lo que el mapa necesita para moverse. */
export type Ubicacion = {
  latitud: number;
  longitud: number;
  /** Qué tan precisa es, en metros. `null` si el navegador no la da. */
  exactitud: number | null;
};

/**
 * Cuánto esperamos antes de rendirnos.
 *
 * Diez segundos: de menos, en un teléfono con señal floja falla cuando
 * la ubicación sí iba a llegar; de más, alguien pensando que el botón
 * no funciona lo deja ahí clavado.
 */
export const TIEMPO_MAXIMO = 10_000;

/**
 * Si el navegador puede dar la ubicación.
 *
 * Se comprueba **antes** de pintar el botón, no al pulsarlo: un botón
 * que aparece y falla es peor que un botón que nunca aparece.
 */
export function haySoporte(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Pide la ubicación. Promesa, porque el callback de la API es de 2012.
 */
export function pedirUbicacion(): Promise<Ubicacion> {
  return new Promise((resolver, rechazar) => {
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        resolver({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          exactitud: posicion.coords.accuracy ?? null,
        });
      },
      (error) => rechazar(error.code as CodigoError),
      {
        /*
         * `enableHighAccuracy` pide el GPS y no la torre de celular.
         * Para "buscá cerca de mí" el error de 200 m de la torre es
         * tolerable y no consume batería; para señalar una casa, no.
         *
         * Aquí la búsqueda es por radio de 500 m o más, así que la
         * torre alcanzaría, pero la dejamos precisa: es el mismo botón
         * el que van a usar los arrendadores para señalar el inmueble.
         */
        enableHighAccuracy: true,
        timeout: TIEMPO_MAXIMO,
        // Con `false`, el navegador sigue pidiendo posición mientras la
        // persona se mueve y el resultado llega por `watchPosition`. No
        // lo queremos: el mapa se movería solo y entramos en el bucle
        // que `.ai/rules/mapa-frontend.md` describe.
        maximumAge: 0,
      },
    );
  });
}

/**
 * El mensaje de cada error.
 *
 * Los tres se dicen distinto porque la accion es distinta, y una
 * persona que no entiende qué hacer no va a pulsar "reintentar" con la
 * misma fe:
 *
 * - Permiso denegado: hay que ir a cambiarlo en el navegador. Ningún
 *   reintento lo arregla.
 * - No disponible: el dispositivo no tiene forma de saber dónde está.
 * - Timeout: sí puede funcionar después.
 *
 * Y ninguno dice "falló": el documento pide que la plataforma se sienta
 * confiable, y "no pudimos obtener tu ubicación" suena a caída del
 * servidor.
 */
export function mensajeDeError(codigo: CodigoError | number | null): string {
  switch (codigo) {
    case 1:
      return 'Tu navegador no nos dejó usar la ubicación. Podés activarla en los permisos del sitio.';
    case 2:
      return 'Tu dispositivo no sabe dónde estás en este momento.';
    case 3:
      return 'Tardamos demasiado en encontrarte. Probá otra vez o escribí el distrito.';
    default:
      return 'No pudimos saber dónde estás. Podés mover el mapa con el dedo.';
  }
}

/**
 * El mensaje mientras se espera.
 *
 * Va dicho porque en Chrome y Safari la petición abre una ventana del
 * navegador que puede quedarse esperando: sin esto, la persona cree que
 * la página se congeló.
 */
export const ESPERANDO = 'Buscando dónde estás…';

/**
 * Lo que se le avisa al navegador.
 *
 * No se pide la ubicación al cargar la página, nunca. El permiso se
 * pide después de un clic, y un permiso que aparece sin que la persona
 * haya pedido algo se deniega solo —y queda denegado para siempre.
 */
export const MOTIVO = 'Para buscar los inmuebles que tenés cerca';
