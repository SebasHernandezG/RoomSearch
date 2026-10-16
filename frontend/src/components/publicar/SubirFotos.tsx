/**
 * La galeria de fotos. RF-2.3.
 *
 * DS-12 pide "primera foto a pantalla completa, deslizable con el
 * dedo, contador 3 / 8". En el formulario lo que hace falta es la
 * subida; la ficha usa `GaleriaImagenes`, que es solo lectura.
 */

import { useRef, useState } from 'react';

import { formatoPeso, MAXIMO_FOTOS, problemasDe, type FotoElegida } from '../../lib/fotos';

type Props = {
  fotos: FotoElegida[];
  onCambio: (fotos: FotoElegida[]) => void;
  /** Enviando. Bloquea elegir mas para no competir con el envio. */
  enviando?: boolean;
};

/**
 * Como se elige.
 *
 * **Solo al terminar de soltar**, no en cada `change`. Elegir veinte
 * fotos hace veinte previsualizaciones y veinte `createObjectURL` de
 * una vez; en un celular con cuatro fotos de 4 MB eso es memoria que
 * no vuelve.
 */
export function SubirFotos({ fotos, onCambio, enviando = false }: Props) {
  const [problema, setProblema] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const entrada = useRef<HTMLInputElement>(null);

  async function alElegir(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return;

    setProcesando(true);

    try {
      const problemas: string[] = [];

      if (fotos.length + archivos.length > MAXIMO_FOTOS) {
        problemas.push(`Máximo ${MAXIMO_FOTOS} fotos por anuncio.`);
      }

      const elegidas: FotoElegida[] = [];

      for (const archivo of Array.from(archivos)) {
        const malos = problemasDe(archivo);

        if (malos.length > 0) {
          problemas.push(...malos);

          continue;
        }

        elegidas.push({
          id: null,
          archivo,
          vista: URL.createObjectURL(archivo),

          /*
           * La primera que se elige es la principal, y solo si no hay
           * ninguna. La condicion importa: subir una nueva no tiene que
           * quitarle el puesto a la que ya era principal.
           */
          esPrincipal: fotos.length === 0 && elegidas.length === 0,
        });
      }

      setProblema(problemas.length > 0 ? problemas.join(' ') : null);

      if (elegidas.length > 0) {
        onCambio([...fotos, ...elegidas]);
      }
    } finally {
      setProcesando(false);

      /*
       * La entrada se limpia despues de cada eleccion.
       *
       * Sin esto, volver a elegir **el mismo** archivo no dispara el
       * `change` --el valor no cambio-- y el boton parece roto. Es el
       * fallo clasico de un input de archivos.
       */
      if (entrada.current) {
        entrada.current.value = '';
      }
    }
  }

  function quitar(indice: number) {
    const quitada = fotos[indice];
    const quedan = fotos.filter((_, i) => i !== indice);

    // Libera la URL de la vista previa: `createObjectURL` no se
    // libera sola y cada foto sin liberar retiene sus bytes.
    if (quitada && quitada.id === null) {
      URL.revokeObjectURL(quitada.vista);
    }

    /*
     * Si se quita la principal, otra toma el puesto.
     *
     * Sin esto la galeria se queda sin principal, y el backend --que
     * espera un indice-- pondria por defecto la primera. Que aqui y
     * alla coincidan no es casualidad.
     */
    if (quitada?.esPrincipal && quedan.length > 0) {
      quedan[0] = { ...quedan[0], esPrincipal: true };
    }

    onCambio(quedan);
  }

  function marcarPrincipal(indice: number) {
    onCambio(fotos.map((foto, i) => ({ ...foto, esPrincipal: i === indice })));
  }

  const pesoTotal = fotos.reduce((total, foto) => total + foto.archivo.size, 0);

  return (
    <div className="flex flex-col gap-4">
      {fotos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fotos.map((foto, indice) => (
            <li key={foto.id ?? foto.vista} className="relative">
              <img
                src={foto.vista}
                alt={`Foto ${indice + 1} del inmueble`}
                className="aspect-[4/3] w-full rounded-md object-cover"
              />

              {foto.esPrincipal && (
                <span className="absolute top-1 left-1 rounded-full bg-forest px-2 py-0.5 text-caption font-semibold text-paper">
                  Principal
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex gap-1 rounded-b-md bg-ink/70 p-1">
                {!foto.esPrincipal && (
                  <button
                    type="button"
                    onClick={() => marcarPrincipal(indice)}
                    className="flex-1 rounded px-2 py-1 text-caption text-paper"
                  >
                    Principal
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => quitar(indice)}
                  aria-label={`Quitar la foto ${indice + 1}`}
                  className="rounded px-2 py-1 text-caption text-paper"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="fotos" className="text-small font-semibold text-ink">
          Fotos del inmueble ({fotos.length} de {MAXIMO_FOTOS})
        </label>

        <input
          ref={entrada}
          id="fotos"
          type="file"
          accept="image/jpeg,image/webp"
          multiple
          disabled={enviando || procesando || fotos.length >= MAXIMO_FOTOS}
          onChange={(e) => void alElegir(e.target.files)}
          aria-describedby="ayuda-fotos"
          className="mt-2 block w-full text-small text-ink file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-sand file:px-4 file:text-body file:font-semibold file:text-leaf"
        />

        <p id="ayuda-fotos" className="text-caption mt-1 text-stone">
          JPG o WebP, hasta 8 MB cada una. La primera que subas es la principal.
        </p>
      </div>

      {/*
        El error va con `role="alert"`: es el aviso que interrumpe. Un
        error de archivo anunciado con `polite` se pierde detras de lo
        que el lector estaba leyendo.
      */}
      {problema && (
        <p role="alert" className="text-small text-ink">
          {problema}
        </p>
      )}

      {fotos.length > 0 && (
        <p className="text-caption text-stone">Peso total: {formatoPeso(pesoTotal)}</p>
      )}

      {/*
        El numero de fotos elegidas se anuncia con `sr-only`: elegir
        una foto no cambia la pantalla de forma que un lector de
        pantalla lo note, y sin esto nadie sabe si la foto se tomo.
      */}
      <p className="sr-only" aria-live="polite">
        {fotos.length > 0 ? `${fotos.length} fotos elegidas.` : ''}
      </p>
    </div>
  );
}
