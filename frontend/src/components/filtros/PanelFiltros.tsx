/**
 * El panel de filtros. DS-6.
 *
 * ## Dos esperas distintas, un solo componente
 *
 * - **Escritorio:** columna fija de 280 px a la izquierda. Los filtros
 *   son la mitad del producto (RF-4.1) y con la columna abierta se
 *   cambian dos cosas a la vez sin abrir nada.
 *
 * - **Movil:** hoja inferior al 85 % del alto, con un boton fijo
 *   abajo. En un celular la hoja taparia los filtros con el teclado
 *   abierto, y el boton grande es lo que el pulgar alcanza.
 *
 * Por eso el componente decide la forma con `md:` y no hay dos
 * archivos: los controles son los mismos y duplicarlos es como uno de
 * los dos deja de recibir un arreglo.
 */

import { useEffect, useId, useRef } from 'react';

import { nombreOrden, quitarTodos, type Filtros } from '../../lib/filtros';
import { DISTRITOS } from '../publicar/datos';

type Props = {
  filtros: Filtros;
  onCambio: (filtros: Filtros) => void;
  /**
   * Que forma se pinta.
   *
   * `hoja` es el movil: velo, 85 % del alto, boton de aplicar.
   * `columna` es el escritorio: la barra fija de 280 px.
   *
   * Es un parametro y no dos archivos porque los controles son los
   * mismos, y **no** es una diferencia de clases: son dos elementos
   * distintos del arbol de accesibilidad, con roles distintos y
   * comportamientos de foco distintos. Pintar las dos desde un mismo
   * componente duplicaria los controles en el arbol --con ids
   * repetidos-- y el lector de pantalla leeria cada filtro dos veces.
   */
  variante: 'hoja' | 'columna';
  /** Solo en `hoja`. */
  abierto: boolean;
  onCerrar: () => void;
  /** Para el boton de "Ver N inmuebles". */
  total: number;
  cargando: boolean;
};

const TIPOS = [
  { valor: 'apartamento', etiqueta: 'Apartamento' },
  { valor: 'casa', etiqueta: 'Casa' },
  { valor: 'habitacion', etiqueta: 'Habitación' },
  { valor: 'estudio', etiqueta: 'Estudio' },
];

const HABITACIONES = [1, 2, 3, 4, 5];

const ORDENES = [
  { valor: 'recent', etiqueta: 'Más recientes' },
  { valor: 'price_asc', etiqueta: 'Precio: menor' },
  { valor: 'price_desc', etiqueta: 'Precio: mayor' },
  { valor: 'distance', etiqueta: 'Más cerca' },
] as const;

export default function PanelFiltros({
  filtros,
  onCambio,
  variante,
  abierto,
  onCerrar,
  total,
  cargando,
}: Props) {
  const tituloId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const esHoja = variante === 'hoja';

  /*
   * Cerrar con Escape y devolver el foco.
   *
   * Sin esto, alguien que abre la hoja con el teclado y la cierra con
   * Escape se queda con el foco en un boton que ya no existe: el
   * siguiente Tab lo lleva al principio del documento y hay que
   * recorrer toda la pagina para volver al filtro.
   */
  const botonQueAbrio = useRef<Element | null>(null);

  useEffect(() => {
    if (!esHoja || !abierto) return;

    botonQueAbrio.current = document.activeElement;

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        onCerrar();

        return;
      }

      /*
       * El foco no puede salirse de la hoja mientras esta abierta.
       * Un `dialog` de verdad lo haria solo; como esta hoja es un
       * div, hay que hacerlo a mano o el Tab se va al mapa de abajo
       * con la hoja todavia encima.
       */
      if (evento.key !== 'Tab' || panelRef.current === null) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusables.length === 0) return;

      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alTeclear);

    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, onCerrar, esHoja]);

  useEffect(() => {
    if (esHoja && abierto) return;

    const anterior = botonQueAbrio.current;

    if (anterior instanceof HTMLElement && document.contains(anterior)) {
      anterior.focus();
    }
  }, [abierto, esHoja]);

  function cambiar(parcial: Partial<Filtros>) {
    onCambio({ ...filtros, ...parcial });
  }

  if (!esHoja) {
    /*
     * La columna de escritorio.
     *
     * `sticky` y no `fixed`: con `fixed` el mapa --que recalcula su
     * tamano al redimensionar-- nunca se entera de que le quitaste
     * 280 px de ancho, y Leaflet se dibuja debajo de la columna.
     * `sticky` deja que el flujo reserve el espacio sin sacar el
     * elemento del arbol del layout.
     */
    return (
      <aside
        aria-label="Filtros"
        className="w-70 shrink-0 overflow-y-auto self-start border-r border-line bg-paper px-4 py-5 md:sticky md:top-0 md:h-dvh"
      >
        <Controles filtros={filtros} cambiar={cambiar} />

        <button
          type="button"
          onClick={() => onCambio(quitarTodos(filtros))}
          className="mt-6 inline-flex min-h-11 items-center px-2 text-small font-semibold text-leaf underline underline-offset-4"
        >
          Quitar todo
        </button>
      </aside>
    );
  }

  return (
    <div
      aria-hidden={!abierto}
      className={abierto ? 'fixed inset-0 z-40' : 'pointer-events-none fixed inset-0 z-40'}
    >
      <button
        type="button"
        tabIndex={abierto ? 0 : -1}
        aria-label="Cerrar filtros"
        onClick={onCerrar}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 motion-reduce:transition-none ${
          abierto ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-paper shadow-xl transition-transform duration-300 motion-reduce:transition-none ${
          abierto ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id={tituloId} className="text-h3">
            Filtros
          </h2>

          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex min-h-11 items-center px-3 text-body font-semibold text-leaf"
          >
            Cerrar
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <Controles filtros={filtros} cambiar={cambiar} />
        </div>

        {/*
          El boton de aplicar, fijo abajo, con el numero adentro.
          El numero en el boton y no solo arriba: abajo es donde esta
          el pulgar y es donde se decide.
        */}
        <div className="border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-forest px-5 text-body font-semibold text-paper transition-colors duration-200 hover:bg-leaf disabled:opacity-70 motion-reduce:transition-none"
          >
            {cargando ? 'Buscando…' : `Ver ${total} inmueble${total === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Los controles, compartidos por las dos formas.
 *
 * Viven aparte del contenedor porque la hoja y la columna los pintan
 * en lugares distintos del arbol y con distinto encabezado.
 */
function Controles({
  filtros,
  cambiar,
}: {
  filtros: Filtros;
  cambiar: (parcial: Partial<Filtros>) => void;
}) {
  const simbolo = filtros.currency === 'USD' ? 'US$' : '₡';

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="precio">
        <h3 id="precio" className="text-small mb-2 font-semibold text-ink">
          Precio
        </h3>

        <div className="mb-2 flex gap-2">
          {(['CRC', 'USD'] as const).map((moneda) => (
            <button
              key={moneda}
              type="button"
              aria-pressed={(filtros.currency ?? 'CRC') === moneda}
              onClick={() => cambiar({ currency: moneda })}
              className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-md border text-small font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                (filtros.currency ?? 'CRC') === moneda
                  ? 'border-leaf bg-sand text-ink'
                  : 'border-edge bg-paper text-stone'
              }`}
            >
              {moneda === 'CRC' ? '₡ Colones' : 'US$ Dólares'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="min_rent">
            Precio mínimo
          </label>
          <input
            id="min_rent"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Desde"
            value={filtros.min_rent ?? ''}
            onChange={(e) =>
              cambiar({ min_rent: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            className="min-h-11 w-full rounded-md border border-edge bg-white px-3 text-body text-ink"
          />

          <span aria-hidden="true" className="text-stone">
            –
          </span>

          <label className="sr-only" htmlFor="max_rent">
            Precio máximo
          </label>
          <input
            id="max_rent"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Hasta"
            value={filtros.max_rent ?? ''}
            onChange={(e) =>
              cambiar({ max_rent: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            className="min-h-11 w-full rounded-md border border-edge bg-white px-3 text-body text-ink"
          />
        </div>

        <p className="text-caption mt-1 text-stone">Los precios van en {simbolo}, sin decimales.</p>
      </section>

      <section aria-labelledby="tipo">
        <h3 id="tipo" className="text-small mb-2 font-semibold text-ink">
          Tipo
        </h3>

        {/* Un mismo grupo: seleccionar uno quita el anterior. */}
        <div role="group" aria-labelledby="tipo" className="flex flex-wrap gap-2">
          {TIPOS.map((tipo) => (
            <button
              key={tipo.valor}
              type="button"
              aria-pressed={filtros.type === tipo.valor}
              onClick={() =>
                cambiar({ type: filtros.type === tipo.valor ? undefined : tipo.valor })
              }
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-small font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                filtros.type === tipo.valor
                  ? 'border-leaf bg-sand text-ink'
                  : 'border-edge bg-paper text-stone'
              }`}
            >
              {tipo.etiqueta}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="habitaciones">
        <h3 id="habitaciones" className="text-small mb-2 font-semibold text-ink">
          Habitaciones
        </h3>

        {/*
          Una fila de botones y no un desplegable: DS-6 lo pide, y
          con razon. En un desplegable el valor actual esta escondido
          y hace dos toques verlo; aca se ven las cinco opciones y el
          valor marcado.
        */}
        <div role="group" aria-labelledby="habitaciones" className="flex gap-2">
          {HABITACIONES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={filtros.bedrooms === n}
              onClick={() => cambiar({ bedrooms: filtros.bedrooms === n ? undefined : n })}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-md border text-small font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                filtros.bedrooms === n
                  ? 'border-leaf bg-sand text-ink'
                  : 'border-edge bg-paper text-stone'
              }`}
            >
              {n === 5 ? '5+' : n}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="distrito">
        <h3 id="distrito" className="text-small mb-2 font-semibold text-ink">
          Distrito
        </h3>

        <select
          aria-labelledby="distrito"
          value={filtros.district ?? ''}
          onChange={(e) => cambiar({ district: e.target.value || undefined })}
          className="min-h-11 w-full rounded-md border border-edge bg-white px-3 text-body text-ink"
        >
          <option value="">Todos los distritos</option>
          {DISTRITOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </section>

      <section aria-labelledby="extras">
        <h3 id="extras" className="text-small mb-2 font-semibold text-ink">
          Extras
        </h3>

        <div className="flex flex-col gap-3">
          {(
            [
              { clave: 'furnished', etiqueta: 'Amueblado' },
              { clave: 'pets_allowed', etiqueta: 'Admite mascotas' },
              { clave: 'parking', etiqueta: 'Tiene parqueo' },
            ] as const
          ).map((extra) => (
            <label
              key={extra.clave}
              className="flex min-h-11 items-center gap-3 text-small text-ink"
            >
              <input
                type="checkbox"
                checked={filtros[extra.clave] === true}
                onChange={(e) => cambiar({ [extra.clave]: e.target.checked || undefined })}
                className="h-5 w-5 accent-[var(--color-leaf)]"
              />
              {extra.etiqueta}
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="orden">
        <h3 id="orden" className="text-small mb-2 font-semibold text-ink">
          Ordenar por
        </h3>

        <select
          aria-labelledby="orden"
          value={filtros.sort ?? 'recent'}
          onChange={(e) => cambiar({ sort: e.target.value as Filtros['sort'] })}
          className="min-h-11 w-full rounded-md border border-edge bg-white px-3 text-body text-ink"
        >
          {ORDENES.map((orden) => (
            <option key={orden.valor} value={orden.valor}>
              {orden.etiqueta}
            </option>
          ))}
        </select>

        <p className="text-caption mt-1 text-stone">Ahora: {nombreOrden(filtros.sort)}</p>
      </section>
    </div>
  );
}
