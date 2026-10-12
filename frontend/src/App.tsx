/**
 * Revision de la Tarjeta de inmueble. DS-5.
 *
 * Muestra cada estado del issue para poder mirarlos antes de construir
 * el listado encima. Se borra cuando exista la API real.
 */

import { useState } from 'react';

import PropertyCard from './components/PropertyCard';
import { PROPIEDADES_DEMO } from './data/demo';
import { formatDistance, formatPrice } from './lib/format';

export default function App() {
  const [favoritos, setFavoritos] = useState<number[]>([2]);

  const alternarFavorito = (id: number) => {
    setFavoritos((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id],
    );
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-forest px-5 py-8 sm:px-8">
        <p className="text-caption uppercase tracking-widest text-coffee">
          Revision del diseno · DS-5
        </p>
        <h1 className="text-display text-paper">Tarjeta de inmueble</h1>
        <p className="text-body text-paper/80 max-w-prose">
          El componente mas repetido de la aplicacion. Si falla aqui, falla en el listado, en
          favoritos, en alertas y en el comparador.
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <section className="mb-12">
          <h2 className="text-h2 mb-1">Estados de la tarjeta</h2>
          <p className="text-small text-stone mb-6">
            Con favorito, sin foto, alquilada, verificada y con distancia.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROPIEDADES_DEMO.map((p) => (
              <PropertyCard
                key={p.id}
                property={{ ...p, is_favorite: favoritos.includes(p.id) }}
                onToggleFavorite={(propiedad) => alternarFavorito(propiedad.id)}
              />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-h2 mb-1">Ancho minimo</h2>
          <p className="text-small text-stone mb-6">
            DS-5 exige que funcione a 320 px. Esta tarjeta se ve como la vera en un celular pequeno.
          </p>

          <div className="max-w-80">
            <PropertyCard
              property={{ ...PROPIEDADES_DEMO[0]!, is_favorite: false }}
              onToggleFavorite={(p) => alternarFavorito(p.id)}
            />
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-h2 mb-1">Formato de moneda</h2>
          <p className="text-small text-stone mb-6">
            El precio se formatea aqui y no con toLocaleString, que aplica el formato del navegador.
            DS-5 pide que se entienda a dos metros.
          </p>

          <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                [280_000, 'CRC'],
                [1_500_000, 'CRC'],
                [650, 'USD'],
                [99_500, 'CRC'],
              ].map(([monto, moneda]) => (
                <div key={`${monto}`}>
                  <dt className="text-caption text-stone">
                    {monto} {moneda}
                  </dt>
                  <dd className="text-h2 font-bold text-forest">
                    {formatPrice(monto as number, moneda as 'CRC' | 'USD')}
                    <span className="text-small font-normal text-stone"> /mes</span>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="text-small mt-6 text-stone">Distancias</p>
            <ul className="mt-2 flex flex-wrap gap-3">
              {[0, 250, 850, 999, 1000, 1200, 5600, 24_800, 145_000].map((m) => (
                <li key={m} className="rounded-md bg-sand px-2.5 py-1 text-caption">
                  {formatDistance(m)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-h2 mb-1">Correccion de contraste</h2>
          <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
            <p className="text-body text-ink">
              DS-5 pedia el precio en color <code className="font-mono">sun</code>, pero DS-1 lo
              marca como no apto para texto: <span className="font-semibold">2.1:1</span> sobre
              papel, y WCAG AA exige 4.5:1.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="rounded-md bg-sun px-4 py-2 text-body font-semibold text-forest">
                sun + forest · 2.1:1 solo decorativo
              </span>
              <span className="rounded-md bg-forest px-4 py-2 text-body font-semibold text-paper">
                forest + paper · 12.6:1 el que se usa
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
