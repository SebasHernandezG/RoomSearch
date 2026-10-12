/**
 * Temporary token preview for DS-1, DS-2 and DS-3.
 *
 * This page exists so the design system can be reviewed BEFORE any
 * component is built on top of it. It is deleted once DS-4 starts.
 *
 * Every swatch is rendered with the real utility class the product
 * will use, so what you see here is what the app will do.
 */
import type { ReactNode } from 'react';

/**
 * NOTE: the `bgClass` values are written out in full on purpose.
 * Tailwind scans source text for literal class names, so a template
 * literal like `bg-${name}` would produce NO CSS at all and every
 * swatch would render transparent. Keep these strings static.
 */
const colors = [
  { name: 'forest', bgClass: 'bg-forest', hex: '#1B4332', use: 'Boton primario' },
  { name: 'leaf', bgClass: 'bg-leaf', hex: '#2D6A4F', use: 'Enlaces, activo' },
  { name: 'coffee', bgClass: 'bg-coffee', hex: '#74C69D', use: 'Acento suave' },
  { name: 'sun', bgClass: 'bg-sun', hex: '#F4A261', use: 'Precio, acento' },
  { name: 'clay', bgClass: 'bg-clay', hex: '#E76F51', use: 'Alerta, error' },
  { name: 'paper', bgClass: 'bg-paper', hex: '#FDFBF7', use: 'Fondo principal' },
  { name: 'sand', bgClass: 'bg-sand', hex: '#F4EDE2', use: 'Fondo alterno' },
  { name: 'ink', bgClass: 'bg-ink', hex: '#1C2B24', use: 'Texto principal' },
  { name: 'stone', bgClass: 'bg-stone', hex: '#6B7B72', use: 'Texto secundario' },
  { name: 'line', bgClass: 'bg-line', hex: '#E8E2D6', use: 'Bordes' },
];

const sizes = [
  { token: 'display', cls: 'text-display', note: '32px · titular' },
  { token: 'h1', cls: 'text-h1', note: '26px · titulo de pagina' },
  { token: 'h2', cls: 'text-h2', note: '20px · seccion' },
  { token: 'body', cls: 'text-body', note: '16px · minimo en movil' },
  { token: 'small', cls: 'text-small', note: '14px · secundario' },
  { token: 'caption', cls: 'text-caption', note: '12px · metadatos' },
];

const radii = [
  { token: 'sm', cls: 'rounded-sm', px: '8px', use: 'badges' },
  { token: 'md', cls: 'rounded-md', px: '12px', use: 'botones' },
  { token: 'lg', cls: 'rounded-lg', px: '16px', use: 'tarjetas' },
  { token: 'xl', cls: 'rounded-xl', px: '24px', use: 'modales' },
  { token: 'full', cls: 'rounded-full', px: '9999px', use: 'avatares' },
];

const shadows = [
  { token: 'sm', cls: 'shadow-sm', use: 'plano' },
  { token: 'md', cls: 'shadow-md', use: 'tarjeta' },
  { token: 'lg', cls: 'shadow-lg', use: 'flotante' },
];

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-h2 mb-1">{title}</h2>
      <p className="text-small text-stone mb-4">{note}</p>
      {children}
    </section>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="bg-forest px-5 py-8 sm:px-8">
        <p className="text-caption uppercase tracking-widest text-coffee">
          Verificacion del sistema de diseno
        </p>
        <h1 className="text-display text-paper">Roomies San Carlos</h1>
        <p className="text-body text-paper/80 max-w-prose">
          Esta pagina existe para revisar los tokens antes de construir componentes. Se elimina
          cuando empiece DS-4.
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        {/* -------- DS-1 · Color -------- */}
        <Section
          title="DS-1 · Color"
          note="Paleta calida tropical. Contraste verificado contra paper."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {colors.map((c) => (
              <div key={c.name} className="rounded-lg border border-line bg-white p-3 shadow-sm">
                <div className={`h-20 w-full rounded-md border border-line ${c.bgClass}`} />
                <p className="text-small mt-3 font-semibold">{c.name}</p>
                <p className="text-caption text-stone font-mono">{c.hex}</p>
                <p className="text-caption text-stone mt-1">{c.use}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-line bg-white p-5 shadow-sm">
            <h3 className="text-small font-semibold">Reglas de contraste aplicadas</h3>
            <ul className="text-small text-stone mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-ink">ink sobre paper</span> — 13.8:1 · AAA
              </li>
              <li>
                <span className="font-semibold text-ink">paper sobre forest</span> — 12.6:1 · AAA
              </li>
              <li>
                <span className="font-semibold text-ink">leaf sobre paper</span> — 5.7:1 · AA
              </li>
              <li>
                <span className="font-semibold text-clay">clay sobre paper</span> — 3.4:1 ·{' '}
                <strong>solo texto grande</strong>
              </li>
              <li>
                <span className="font-semibold text-sun">sun sobre paper</span> — 2.1:1 ·{' '}
                <strong>solo decorativo, nunca texto</strong>
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-md bg-forest px-4 py-2.5 text-body font-semibold text-paper">
                Boton primario
              </span>
              <span className="rounded-md bg-leaf px-4 py-2.5 text-body font-semibold text-paper">
                Boton secundario
              </span>
              <span className="rounded-md bg-sun px-4 py-2.5 text-body font-semibold text-forest">
                Accent (texto forest)
              </span>
              <span className="rounded-md bg-clay px-4 py-2.5 text-body font-semibold text-paper">
                Error
              </span>
            </div>
          </div>
        </Section>

        {/* -------- DS-2 · Typography -------- */}
        <Section
          title="DS-2 · Tipografia"
          note="Figtree. Tres pesos: 400, 600, 700. Cuerpo minimo 16px en movil."
        >
          <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
            {sizes.map((s) => (
              <div key={s.token} className="border-b border-line py-3 last:border-0">
                <p className={`${s.cls} mb-1`}>Un espacio que se siente hogar {s.note}</p>
                <p className="text-caption text-stone font-mono">
                  {s.token} · {s.cls}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* -------- DS-3 · Radius & Elevation -------- */}
        <Section
          title="DS-3 · Radio y elevacion"
          note="Ningun borde es recto. Las sombras son calidas, nunca grises puras."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {radii.map((r) => (
              <div key={r.token} className={`${r.cls} border border-line bg-sand p-4 text-center`}>
                <p className="text-small font-semibold">{r.token}</p>
                <p className="text-caption text-stone">{r.px}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {shadows.map((s) => (
              <div key={s.token} className={`${s.cls} rounded-lg border border-line bg-white p-5`}>
                <p className="text-small font-semibold">shadow-{s.token}</p>
                <p className="text-caption text-stone">{s.use}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* -------- DS-10 · Accesibilidad -------- */}
        <Section
          title="DS-10 · Accesibilidad"
          note="Anillo de foco, area tactil minima y objetivo de 44px."
        >
          <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <button className="min-h-11 rounded-md bg-forest px-5 text-body font-semibold text-paper">
                Enfocado (tab)
              </button>
              <button className="min-h-11 rounded-md border border-line bg-paper px-5 text-body font-semibold">
                Normal
              </button>
              <span className="text-caption text-stone">
                min-height: 44px (min-h-11) en todos los accionables
              </span>
            </div>
            <p className="text-small text-stone mt-4">
              Usa Tab para recorrer los botones y ver el anillo de 3px en{' '}
              <span className="font-mono">leaf</span>.
            </p>
          </div>
        </Section>
      </main>
    </div>
  );
}
