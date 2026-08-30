import { useEffect, useState } from 'react';

type Property = { id: number; title: string; district: string; zone?: string; monthly_rent: number; bedrooms: number; bathrooms: number; description: string };

const samples: Property[] = [
  { id: 1, title: 'Apartamento luminoso en Ciudad Quesada', district: 'Ciudad Quesada', zone: 'Centro', monthly_rent: 280000, bedrooms: 2, bathrooms: 1, description: 'Datos ficticios para la demo inicial de Roomies.' },
  { id: 2, title: 'Casa tranquila cerca de La Fortuna', district: 'La Fortuna', zone: 'El Tanque', monthly_rent: 350000, bedrooms: 3, bathrooms: 2, description: 'Espacio de ejemplo para futuros anuncios verificados.' },
];

export default function App() {
  const [properties, setProperties] = useState<Property[]>(samples);
  const [query, setQuery] = useState('');
  useEffect(() => { fetch('http://localhost:8001/api/properties').then((r) => r.ok ? r.json() : []).then((data) => data.length && setProperties(data)).catch(() => undefined); }, []);
  const visible = properties.filter((property) => `${property.district} ${property.zone}`.toLowerCase().includes(query.toLowerCase()));
  return <main><nav><strong>Roomies</strong><span>San Carlos, Costa Rica</span><button>Iniciar sesión</button></nav><section className="hero"><p>VIVIENDA COMPARTIDA</p><h1>Encuentra un espacio<br /><mark>que se sienta hogar.</mark></h1><p>Explora alojamientos ficticios mientras iniciamos la comunidad.</p><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Distrito o zona: Ciudad Quesada, La Fortuna..." /></section><section className="content"><aside><b>FILTROS</b><hr />San Carlos y alrededores<br /><small>Datos de demostración</small></aside><div><p>RESULTADOS · {visible.length} alojamientos</p><h2>Espacios disponibles</h2><div className="grid">{visible.map((p) => <article key={p.id}><b>{p.title}</b><p>{p.district}{p.zone ? ` · ${p.zone}` : ''}</p><p>{p.description}</p><footer>₡{p.monthly_rent.toLocaleString('es-CR')} · {p.bedrooms} hab. · {p.bathrooms} baño</footer></article>)}</div></div></section></main>;
}
