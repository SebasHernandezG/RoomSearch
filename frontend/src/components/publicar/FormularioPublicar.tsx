/**
 * Formulario de publicación en pasos. DS-8.
 *
 * La API (`StorePropertyRequest`) y el backend ya existen. Faltaba esto.
 *
 * DS-8 pide **autoguardado del borrador**, y hay un detalle que hay
 * que decir de entrada: lo que se guarda es en `localStorage`, no en
 * el servidor. No hay endpoint que cree un borrador — `POST
 * /api/properties` nace siempre en `pendiente` porque publicar pasa
 * por moderación (RF-2.1). El criterio del issue se cumple entero
 * igual: el borrador sobrevive a recarga y cierre de navegador. El
 * borrador en servidor es RF-2.6.
 *
 * El paso 5 (Fotos) **no está** a propósito: RF-2.3 no existe y la API
 * devuelve `images: []`. Poner un paso que no deja avanzar es peor que
 * no ponerlo.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import SelectorPin from '../mapa/SelectorPin';
import { MICROCOPY } from '../../lib/microcopy';
import { borrarBorrador, guardarBorrador, leerBorrador, tieneContenido } from '../../lib/borrador';
import { indiceDePrincipal, nuevas, type FotoElegida } from '../../lib/fotos';
import { SubirFotos } from './SubirFotos';
import { useSesion } from '../SesionContexto';
import { useAvisos } from '../ProveedorAvisos';
import { DISTRITOS, DATOS_VACIOS, MONEDAS, PASOS, TIPOS, type DatosPublicacion } from './datos';

export default function FormularioPublicar({ alTerminar }: { alTerminar?: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();

  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<DatosPublicacion>(DATOS_VACIOS);
  const [enviando, setEnviando] = useState(false);
  const [recuperado, setRecuperado] = useState(false);
  const [fotos, setFotos] = useState<FotoElegida[]>([]);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [general, setGeneral] = useState<string | null>(null);

  /* Al abrir, recupera lo que quedo a medio llenar. */
  useEffect(() => {
    const guardado = leerBorrador();

    if (!guardado) return;

    setDatos((actual) => ({ ...actual, ...guardado.datos }));
    setPaso(guardado.paso);

    // Solo avisa si hay algo de verdad escrito: preguntar por un
    // borrador con el pin puesto molesta y no recupera nada.
    setRecuperado(tieneContenido(guardado.datos));
  }, []);

  function cambiar<K extends keyof DatosPublicacion>(campo: K, valor: DatosPublicacion[K]) {
    setDatos((actual) => {
      const siguiente = { ...actual, [campo]: valor };

      // Autoguardado en cada cambio, no solo al cambiar de paso: DS-8
      // pide "nunca se pierde lo escrito si el navegador se cierra",
      // y eso se cumple solo si se guarda en cada tecla.
      guardarBorrador(paso, siguiente);

      return siguiente;
    });
  }

  function irA(nuevo: number) {
    guardarBorrador(nuevo, datos);
    setPaso(nuevo);
  }

  async function enviar() {
    if (enviando) return;

    setEnviando(true);
    setErrores({});
    setGeneral(null);

    try {
      const respuesta = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('roomies.token')}`,
        },
        body: JSON.stringify(aEnviar(datos)),
      });

      if (!respuesta.ok) {
        const cuerpo = (await respuesta.json().catch(() => ({}))) as {
          message?: string;
          errors?: Record<string, string[]>;
        };

        setErrores(cuerpo.errors ?? {});
        setGeneral(
          cuerpo.message ??
            (respuesta.status === 422
              ? 'Revisá los campos marcados.'
              : 'No pudimos publicar. Probá otra vez.'),
        );

        /*
         * El 422 **no** emite toast.
         *
         * El aviso del formulario ya esta en la pagina, con un
         * role="alert" y junto a los campos. Un toast ademas seria el
         * mismo mensaje dos veces en el mismo instante, y con la
         * pantalla saltando al paso del error seria peor: el aviso sale
         * abajo y el campo con el problema aparece veinte lineas mas
         * arriba.
         */
        if (respuesta.status !== 422) {
          avisar.error(
            'No pudimos enviar tu publicación. Tu borrador quedó guardado: probá otra vez.',
          );
        }

        // Los errores del 422 llevan la pantalla al primer fallo: sin
        // esto, alguien en el paso 5 no ve el error del paso 1.
        if (cuerpo.errors && Object.keys(cuerpo.errors).length > 0) {
          const primero = Object.keys(cuerpo.errors)[0];

          const pasoDelCampo = PASO_DE[primero];

          if (pasoDelCampo) setPaso(pasoDelCampo);
        }

        return;
      }

      /*
       * Las fotos van en un segundo paso. RF-2.3.
       *
       * No se pueden mandar en el mismo POST: el endpoint de fotos
       * cuelga de `/properties/{id}/images`, y ese `id` solo existe
       * despues de que la publicacion se creo. Por eso son dos
       * peticiones y no un `FormData` con todo junto.
       *
       * Y el borrador se borra **despues** de las fotos, no antes: si
       * la subida falla, el texto escrito sigue guardado y solo se
       * pierden los archivos, que es lo menos malo. Al reves, un fallo
       * de red en la segunda peticion tiraria media hora de escritura
       * por un archivo que no subio.
       */
      const idPublicacion = (await respuesta.json()) as { data?: { id?: number } };
      const id = idPublicacion.data?.id;

      if (nuevas(fotos).length > 0 && typeof id === 'number') {
        const cuerpo = new FormData();

        for (const foto of nuevas(fotos)) {
          cuerpo.append('fotos[]', foto.archivo, foto.archivo.name);
        }

        cuerpo.append('principal', String(indiceDePrincipal(fotos)));

        const subida = await fetch(`/api/properties/${id}/images`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${localStorage.getItem('roomies.token')}`,
          },
          body: cuerpo,
        });

        if (!subida.ok) {
          /*
           * La publicacion **ya existe**. Avisarlo y no borrar el
           * borrador: quien intente de nuevo va a crear un anuncio
           * duplicado, y eso es peor que volver a subir las fotos.
           */
          avisar.error(
            'Tu publicación quedó creada, pero las fotos no se pudieron subir. Abrí "Mis publicaciones" para añadirlos.',
          );

          alTerminar?.();

          return;
        }
      }

      // Solo se borra cuando la publicacion **existe**. Si fallo,
      // borrar el borrador seria tirar el trabajo de la persona.
      borrarBorrador();
      /*
        DS-11: el exito se anuncia y no se deduce.
       *
        Sin aviso, el formulario desaparece y la persona no sabe si
        publico o si la red se comio el envio. Es el caso de uso
        clasico de un toast de exito.
      */
      avisar.exito('Tu publicación quedó en revisión. Te avisamos cuando esté visible.');

      alTerminar?.();
    } finally {
      setEnviando(false);
    }
  }

  const indicePaso = PASOS.findIndex((p) => p.numero === paso);
  const esUltimo = indicePaso === PASOS.length - 1;

  if (!usuario) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-body text-stone">Tenés que entrar para publicar.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-h1">{MICROCOPY.sesion.titulo}</h1>
      <p className="text-body mt-1 text-stone">Publicá tu inmueble</p>

      {/*
        El error general va arriba del todo, con `role="alert"`, y el
        scroll ya lo trae el paso del primer campo con error. DS-10 lo
        pide asi: el resumen es lo que interrumpe.
      */}
      {general && (
        <div
          role="alert"
          className="mt-6 rounded-md border border-alert bg-clay/10 px-4 py-3 text-body text-ink"
        >
          {general}
        </div>
      )}

      {recuperado && (
        <div
          role="status"
          className="mt-6 rounded-md border border-line bg-sand px-4 py-3 text-small text-ink"
        >
          Recuperamos lo que habías quedado de escribir.
          <button
            type="button"
            onClick={() => {
              borrarBorrador();
              setDatos(DATOS_VACIOS);
              setPaso(1);
              setRecuperado(false);
            }}
            className="ml-2 inline-flex min-h-11 items-center font-semibold text-leaf underline underline-offset-4"
          >
            Empezar de cero
          </button>
        </div>
      )}

      <ol className="mt-8 flex items-center gap-1" aria-label="Pasos de la publicación">
        {PASOS.map((p, i) => (
          <li key={p.numero} className="flex flex-1 flex-col gap-1">
            <span
              aria-hidden="true"
              className={`h-1.5 rounded-full ${i <= indicePaso ? 'bg-leaf' : 'bg-line'}`}
            />
            <span
              className={`text-caption ${i === indicePaso ? 'font-semibold text-ink' : 'text-stone'}`}
            >
              {p.nombre}
            </span>
          </li>
        ))}
      </ol>

      {/*
        El conteo va por indice y no por el numero del paso.

        `PASOS` salta del 4 al 6 porque el 5 (Fotos) no existe todavia,
        asi que "Paso 6 de 6" seria un numero que no existe y una
        pregunta sin responder. El indice da "Paso 5 de 5", que es lo
        que hay de verdad delante.
      */}
      <p aria-live="polite" className="text-small mt-3 text-stone">
        Paso {indicePaso + 1} de {PASOS.length}
      </p>

      <section className="mt-8 flex flex-col gap-6">
        {paso === 1 && <PasoBasico datos={datos} errores={errores} cambiar={cambiar} />}
        {paso === 2 && <PasoPrecio datos={datos} errores={errores} cambiar={cambiar} />}
        {paso === 3 && <PasoCaracteristicas datos={datos} errores={errores} cambiar={cambiar} />}
        {paso === 4 && <PasoServicios datos={datos} errores={errores} cambiar={cambiar} />}

        {paso === 5 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-h2">Fotos del inmueble</h2>

            <p className="text-small text-stone">
              La primera es la que sale en el mapa. Poné al menos una.
            </p>

            <SubirFotos fotos={fotos} onCambio={setFotos} enviando={enviando} />
          </div>
        )}
        {paso === 6 && <PasoUbicacion datos={datos} errores={errores} cambiar={cambiar} />}
      </section>

      <nav className="mt-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => irA(PASOS[Math.max(0, indicePaso - 1)].numero)}
          disabled={indicePaso === 0 || enviando}
          className="inline-flex min-h-11 items-center rounded-md border border-line bg-paper px-5 text-body font-semibold text-leaf transition-colors duration-200 hover:bg-sand disabled:opacity-50 motion-reduce:transition-none"
        >
          Atrás
        </button>

        {esUltimo ? (
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="inline-flex min-h-11 items-center rounded-md bg-forest px-5 text-body font-semibold text-paper transition-colors duration-200 hover:bg-leaf disabled:cursor-progress disabled:opacity-70 motion-reduce:transition-none"
          >
            {enviando ? 'Publicando…' : 'Enviar a revisión'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => irA(PASOS[indicePaso + 1].numero)}
            className="inline-flex min-h-11 items-center rounded-md bg-forest px-5 text-body font-semibold text-paper transition-colors duration-200 hover:bg-leaf motion-reduce:transition-none"
          >
            Siguiente
          </button>
        )}
      </nav>

      {/*
        El aviso de que falta confirmar el correo. Va **antes** de
        enviar, no como error despues: publicar exige el correo
        confirmado (RF-1.3) y descubrirlo en el 403 del envio es la
        forma mas cara de enterarse.
      */}
      {!usuario.email_verified && (
        <p role="status" className="mt-6 rounded-md bg-sun/25 px-4 py-3 text-small text-ink">
          {MICROCOPY.sesion.creado.sinConfirmar}
        </p>
      )}
    </main>
  );
}

/**
 * A donde va cada campo cuando el backend responde 422.
 *
 * Sin esto, alguien en el paso 5 ve "Revisá los campos marcados" y
 * no tiene forma de saber cual. Es el error que hace que un formulario
 * largo parezca roto.
 */
export const PASO_DE: Record<string, number> = {
  type: 1,
  title: 1,
  description: 1,
  monthly_rent: 2,
  currency: 2,
  deposit: 2,
  bedrooms: 3,
  bathrooms: 3,
  parking_spaces: 3,
  furnished: 3,
  includes_water: 4,
  includes_electricity: 4,
  includes_internet: 4,
  pets_allowed: 4,
  available_from: 4,
  rules: 4,
  latitude: 6,
  longitude: 6,
  address_reference: 6,
  district: 6,
  neighborhood: 6,
  show_exact_location: 6,
};

type PropsPaso = {
  datos: DatosPublicacion;
  errores: Record<string, string[]>;
  cambiar: <K extends keyof DatosPublicacion>(campo: K, valor: DatosPublicacion[K]) => void;
};

/* Los cinco pasos. */

function PasoBasico({ datos, errores, cambiar }: PropsPaso) {
  return (
    <>
      <Campo etiqueta="Tipo de inmueble" id="type" error={errores.type?.[0]}>
        <select
          id="type"
          value={datos.type}
          onChange={(e) => cambiar('type', e.target.value as DatosPublicacion['type'])}
          className={inputClase(errores.type)}
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Título" id="title" error={errores.title?.[0]} ayuda="Al menos 10 letras.">
        <input
          id="title"
          value={datos.title}
          onChange={(e) => cambiar('title', e.target.value)}
          className={inputClase(errores.title)}
        />
      </Campo>

      <Campo etiqueta="Descripción" id="description" error={errores.description?.[0]}>
        <textarea
          id="description"
          rows={5}
          value={datos.description}
          onChange={(e) => cambiar('description', e.target.value)}
          className={inputClase(errores.description)}
        />
      </Campo>
    </>
  );
}

function PasoPrecio({ datos, errores, cambiar }: PropsPaso) {
  return (
    <>
      <Campo etiqueta="Moneda" id="currency" error={errores.currency?.[0]}>
        <select
          id="currency"
          value={datos.currency}
          onChange={(e) => cambiar('currency', e.target.value as DatosPublicacion['currency'])}
          className={inputClase(errores.currency)}
        >
          {MONEDAS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Alquiler mensual" id="monthly_rent" error={errores.monthly_rent?.[0]}>
        <input
          id="monthly_rent"
          type="number"
          inputMode="numeric"
          value={datos.monthly_rent ?? ''}
          onChange={(e) =>
            cambiar('monthly_rent', e.target.value === '' ? null : Number(e.target.value))
          }
          className={inputClase(errores.monthly_rent)}
        />
      </Campo>

      <Campo etiqueta="Depósito (opcional)" id="deposit" error={errores.deposit?.[0]}>
        <input
          id="deposit"
          type="number"
          inputMode="numeric"
          value={datos.deposit ?? ''}
          onChange={(e) =>
            cambiar('deposit', e.target.value === '' ? null : Number(e.target.value))
          }
          className={inputClase(errores.deposit)}
        />
      </Campo>
    </>
  );
}

function PasoCaracteristicas({ datos, errores, cambiar }: PropsPaso) {
  return (
    <>
      <Campo etiqueta="Habitaciones" id="bedrooms" error={errores.bedrooms?.[0]}>
        <Contador
          id="bedrooms"
          valor={datos.bedrooms}
          etiqueta="habitaciones"
          onChange={(v) => cambiar('bedrooms', v)}
        />
      </Campo>

      <Campo etiqueta="Baños" id="bathrooms" error={errores.bathrooms?.[0]}>
        <Contador
          id="bathrooms"
          valor={datos.bathrooms}
          etiqueta="baños"
          onChange={(v) => cambiar('bathrooms', v)}
        />
      </Campo>

      <Campo etiqueta="Parqueo" id="parking_spaces" error={errores.parking_spaces?.[0]}>
        <Contador
          id="parking_spaces"
          valor={datos.parking_spaces}
          etiqueta="espacios"
          onChange={(v) => cambiar('parking_spaces', v)}
        />
      </Campo>

      <Interruptor
        id="furnished"
        etiqueta="Amueblado"
        valor={datos.furnished}
        onChange={(v) => cambiar('furnished', v)}
      />
    </>
  );
}

function PasoServicios({ datos, errores, cambiar }: PropsPaso) {
  return (
    <>
      <Interruptor
        id="includes_water"
        etiqueta="Agua"
        valor={datos.includes_water}
        onChange={(v) => cambiar('includes_water', v)}
      />
      <Interruptor
        id="includes_electricity"
        etiqueta="Luz"
        valor={datos.includes_electricity}
        onChange={(v) => cambiar('includes_electricity', v)}
      />
      <Interruptor
        id="includes_internet"
        etiqueta="Internet"
        valor={datos.includes_internet}
        onChange={(v) => cambiar('includes_internet', v)}
      />
      <Interruptor
        id="pets_allowed"
        etiqueta="Mascotas"
        valor={datos.pets_allowed}
        onChange={(v) => cambiar('pets_allowed', v)}
      />

      <Campo
        etiqueta="Disponible desde (opcional)"
        id="available_from"
        error={errores.available_from?.[0]}
      >
        <input
          id="available_from"
          type="date"
          value={datos.available_from ?? ''}
          onChange={(e) => cambiar('available_from', e.target.value || null)}
          className={inputClase(errores.available_from)}
        />
      </Campo>

      <Campo etiqueta="Reglas de la casa (opcional)" id="rules" error={errores.rules?.[0]}>
        <textarea
          id="rules"
          rows={4}
          value={datos.rules}
          onChange={(e) => cambiar('rules', e.target.value)}
          className={inputClase(errores.rules)}
        />
      </Campo>
    </>
  );
}

function PasoUbicacion({ datos, errores, cambiar }: PropsPaso) {
  return (
    <>
      <Campo etiqueta="Pino en el mapa" id="latitude" error={errores.latitude?.[0]}>
        <SelectorPin
          value={
            datos.latitude !== null && datos.longitude !== null
              ? { latitude: datos.latitude, longitude: datos.longitude }
              : null
          }
          onChange={(c) => {
            cambiar('latitude', c.latitude);
            cambiar('longitude', c.longitude);
          }}
          onClear={() => {
            cambiar('latitude', null);
            cambiar('longitude', null);
          }}
        />
      </Campo>

      <Campo
        etiqueta="Referencia de dónde está"
        id="address_reference"
        error={errores.address_reference?.[0]}
        ayuda='Las direcciones de Costa Rica no sirven para geolocalizar. Escribí algo como "200 m norte de la iglesia". Esto es lo que se ve cuando alguien elige no mostrar la ubicación exacta.'
      >
        <input
          id="address_reference"
          value={datos.address_reference}
          onChange={(e) => cambiar('address_reference', e.target.value)}
          className={inputClase(errores.address_reference)}
        />
      </Campo>

      <Campo etiqueta="Distrito" id="district" error={errores.district?.[0]}>
        <select
          id="district"
          value={datos.district}
          onChange={(e) => cambiar('district', e.target.value)}
          className={inputClase(errores.district)}
        >
          <option value="">Elegí un distrito</option>
          {DISTRITOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Barrio (opcional)" id="neighborhood" error={errores.neighborhood?.[0]}>
        <input
          id="neighborhood"
          value={datos.neighborhood}
          onChange={(e) => cambiar('neighborhood', e.target.value)}
          className={inputClase(errores.neighborhood)}
        />
      </Campo>

      <Interruptor
        id="show_exact_location"
        etiqueta="Mostrar la ubicación exacta en el mapa"
        ayuda="Si lo apagás, se ve un punto aproximado alrededor de donde está."
        valor={datos.show_exact_location}
        onChange={(v) => cambiar('show_exact_location', v)}
      />
    </>
  );
}

/* Las piezas de campo, compartidas por los cinco pasos. */

function Campo({
  etiqueta,
  id,
  error,
  ayuda,
  children,
}: {
  etiqueta: string;
  id: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-semibold text-ink">
        {etiqueta}
      </label>

      {children}

      {ayuda && (
        <p id={idAyuda} className="text-caption text-stone">
          {ayuda}
        </p>
      )}

      {error && (
        <p id={idError} className="text-caption text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

function Contador({
  id,
  valor,
  etiqueta,
  onChange,
}: {
  id: string;
  valor: number;
  etiqueta: string;
  onChange: (valor: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, valor - 1))}
        aria-label={`Menos ${etiqueta}`}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-paper text-lg font-semibold text-leaf"
      >
        −
      </button>

      <span id={id} className="min-w-8 text-center text-body text-ink">
        {valor}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(20, valor + 1))}
        aria-label={`Más ${etiqueta}`}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-paper text-lg font-semibold text-leaf"
      >
        +
      </button>
    </div>
  );
}

function Interruptor({
  id,
  etiqueta,
  ayuda,
  valor,
  onChange,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-[var(--color-leaf)]"
      />
      <label htmlFor={id} className="text-small text-ink">
        {etiqueta}
        {ayuda && <span className="mt-1 block text-caption text-stone">{ayuda}</span>}
      </label>
    </div>
  );
}

/**
 * El borde del campo, rojo si el backend marco ese campo.
 *
 * Recibe el array entero y no `errores.campo?.[0]`: el texto va en el
 * `Campo` y aqui solo hace falta saber si hay. Menos indices
 * repetidos, y es imposible que uno se quede sin actualizar.
 */
function inputClase(error?: string[]): string {
  return `min-h-11 rounded-md border bg-paper px-3 text-body text-ink transition-colors duration-200 ${
    error?.length ? 'border-alert' : 'border-edge'
  }`;
}

/**
 * Lo que se manda al backend.
 *
 * Los numeros vacios viajan como `null`, no como `0`: `0` es un
 * precio valido (intercambio, ayudada) y mandarlo donde la persona no
 * escribio nada seria inventar un dato.
 */
export function aEnviar(datos: DatosPublicacion): Record<string, unknown> {
  return {
    type: datos.type,
    title: datos.title,
    description: datos.description || null,

    monthly_rent: datos.monthly_rent,
    currency: datos.currency,
    deposit: datos.deposit,

    bedrooms: datos.bedrooms,
    bathrooms: datos.bathrooms,
    parking_spaces: datos.parking_spaces,
    furnished: datos.furnished,

    includes_water: datos.includes_water,
    includes_electricity: datos.includes_electricity,
    includes_internet: datos.includes_internet,
    pets_allowed: datos.pets_allowed,
    available_from: datos.available_from,
    rules: datos.rules || null,

    latitude: datos.latitude,
    longitude: datos.longitude,
    address_reference: datos.address_reference,
    district: datos.district,
    neighborhood: datos.neighborhood || null,
    show_exact_location: datos.show_exact_location,
  };
}
