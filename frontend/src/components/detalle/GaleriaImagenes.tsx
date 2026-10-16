/**
 * La galeria de la ficha. RF-2.3 y DS-12.
 *
 * ## Scroll nativo, no carrusel con JavaScript
 *
 * DS-12 pide "primera foto a pantalla completa, deslizable con el
 * dedo, contador 3 / 8". Se hace con `overflow-x: auto` y
 * `scroll-snap-type: x mandatory`:
 *
 * - El gesto lo hace el navegador, que es el unico que se siente bien
 *   en un celular: con un carrusel propio, el arrastre compite con el
 *   scroll vertical de la pagina y se siente pegajoso.
 * - El **lector de pantalla y el teclado funcionan sin codigo**. Con un
 *   carrusel propio hay que cablear flechas, foco y announcing a mano,
 *   y es la parte que siempre se olvida.
 *
 * El contador no se actualiza con `onScroll`: eso seria un render por
 * cada pixel de arrastre. Se actualiza con un `IntersectionObserver`
 * sobre cada foto, que dispara una vez al cruzar el centro y no en el
 * resto.
 */

import { useEffect, useRef, useState } from 'react';

import type { PropertyImage } from '../../types/property';

type Props = {
  imagenes: PropertyImage[];
  /** El titulo del inmueble, para el texto alternativo por defecto. */
  titulo: string;
};

/** Cuantas se ven a la vez en movil: "pantalla completa". */
const UNA = 'basis-[92%]';
const VARIAS = 'basis-[88%] sm:basis-[70%] lg:basis-[46%]';

export default function GaleriaImagenes({ imagenes, titulo }: Props) {
  const [indice, setIndice] = useState(0);

  const carrusel = useRef<HTMLDivElement>(null);
  const observers = useRef<IntersectionObserver[]>([]);

  useEffect(() => {
    observers.current.forEach((o) => o.disconnect());
    observers.current = [];

    const nodo = carrusel.current;

    if (!nodo || imagenes.length <= 1) {
      return;
    }

    /*
     * `threshold` en 0.6 y no en 0.5.
     *
     * Con 0.5, una foto que queda justo a mitad de pantalla cuenta
     * como visible y el contador cambia cuando todavia no se sabe cual
     * de las dos se esta viendo. Con 0.6 solo cuenta la que de verdad
     * esta en el centro.
     */
    const opciones: IntersectionObserverInit = {
      root: nodo,
      threshold: 0.6,
    };

    observers.current = Array.from(nodo.children).map((hijo, i) => {
      const observador = new IntersectionObserver((entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setIndice(i);
          }
        }
      }, opciones);

      observador.observe(hijo);

      return observador;
    });

    return () => {
      observers.current.forEach((o) => o.disconnect());
      observers.current = [];
    };
  }, [imagenes.length]);

  if (imagenes.length === 0) {
    return null;
  }

  const unaSola = imagenes.length === 1;

  return (
    <section aria-label="Fotos del inmueble">
      <div
        ref={carrusel}
        /*
         * El carrusel es una region con nombre y con `tabIndex`:
         * sin esto no hay forma de llegar a el con el teclado, porque
         * los `div` con scroll horizontal no son enfocables.
         */
        role="group"
        aria-label={`Galería: ${imagenes.length} fotos`}
        tabIndex={unaSola ? -1 : 0}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto scrollbar-none"
      >
        {imagenes.map((imagen, i) => (
          <img
            key={imagen.id}
            src={imagen.url}
            alt={imagen.alt || `${titulo}, foto ${i + 1}`}
            className={`aspect-[4/3] w-full shrink-0 snap-center rounded-lg object-cover ${unaSola ? UNA : VARIAS}`}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>

      {/*
        El contador va en `aria-live`, no solo a la vista.

        Al deslizar, el unico cambio perceptible con los ojos es el
        numero. Sin anunciarlo, alguien con lector de pantalla no sabe
        cuantas fotos tiene ni cual esta viendo.
      */}
      <p aria-live="polite" className="text-small mt-2 text-stone">
        {indice + 1} / {imagenes.length}
      </p>
    </section>
  );
}
