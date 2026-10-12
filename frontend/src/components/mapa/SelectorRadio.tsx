/**
 * Selector de radio. DS-7.
 *
 * El radio inicial es 1 km: cubre casi todo San Carlos, asi que la
 * primera busqueda no sale vacia. DS-7 lo pide explicitamente.
 */

import { formatDistance } from '../../lib/format';
import { RADIOS } from './PropertyMap';

type Props = {
  valor: number;
  onCambio: (metros: number) => void;
};

export default function SelectorRadio({ valor, onCambio }: Props) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor="radio" className="text-small font-semibold text-ink">
          Radio de búsqueda
        </label>
        <output htmlFor="radio" className="text-h2 font-bold text-forest">
          {formatDistance(valor)}
        </output>
      </div>

      <input
        id="radio"
        type="range"
        min={0}
        max={RADIOS.length - 1}
        step={1}
        value={Math.max(0, RADIOS.indexOf(valor as (typeof RADIOS)[number]))}
        onChange={(e) => onCambio(RADIOS[Number(e.target.value)]!)}
        list="marcas-radio"
        aria-valuetext={formatDistance(valor) ?? undefined}
        className="h-11 w-full cursor-pointer accent-forest"
      />

      <datalist id="marcas-radio">
        {RADIOS.map((r: number) => (
          <option key={r} value={formatDistance(r) ?? undefined} />
        ))}
      </datalist>

      <div className="mt-1 flex justify-between text-caption text-stone">
        <span>500 m</span>
        <span>10 km</span>
      </div>
    </div>
  );
}
