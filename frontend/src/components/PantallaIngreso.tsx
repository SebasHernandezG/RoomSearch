/**
 * Entrar y crear cuenta. RF-1.1.
 *
 * Es la pantalla que faltaba: la API de registro, login y
 * verificacion existe desde RF-1.1, pero no habia forma de usarla
 * desde el navegador. Sin esta pantalla, publicar es imposible --
 * el formulario de DS-8 va detras de una sesion.
 *
 * Son dos modos en un solo componente porque comparten la mitad de la
 * pantalla: los mismos campos, el mismo manejo de errores y el mismo
 * marco. Separarlas duplicaria las tres cosas para cambiar un boton.
 */

import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { MICROCOPY } from '../lib/microcopy';
import { erroresPorCampo } from '../lib/sesion';
import { useSesion } from './SesionContexto';

type Modo = 'entrar' | 'registro';

export default function PantallaIngreso({ modo: inicial }: { modo: Modo }) {
  const { entrar, crearCuenta } = useSesion();

  const [modo, setModo] = useState<Modo>(inicial);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [general, setGeneral] = useState<string | null>(null);
  const [creado, setCreado] = useState(false);
  const [sinConfirmar, setSinConfirmar] = useState(false);

  /*
   * El ultimo error va en un ref y no en estado.
   *
   * Los errores por campo del 422 hay que leerlos **despues** de que
   * la peticion fallo, y guardarlos en estado provocaria un render por
   * si solo... y ese render es justamente el que dispara la lectura,
   * asi que el propio render tendria que volver a pedirlo. Un ref
   * guarda el valor sin ese rodeo.
   */
  const ultimoError = useRef<unknown>(null);

  const errores = erroresPorCampo(ultimoError.current);

  const ids = {
    nombre: useId(),
    correo: useId(),
    contrasena: useId(),
  };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (enviando) return;

    setEnviando(true);
    setGeneral(null);
    ultimoError.current = null;

    try {
      if (modo === 'entrar') {
        await entrar(correo, contrasena);
        return;
      }

      const resultado = await crearCuenta(nombre, correo, contrasena);

      setCreado(true);
      setSinConfirmar(resultado.necesitaConfirmarCorreo);
    } catch (error) {
      ultimoError.current = error;

      const porCampo = erroresPorCampo(error);

      // Si el backend no marco ningun campo, el problema es general.
      if (Object.keys(porCampo).length === 0) {
        setGeneral((error as Error).message || MICROCOPY.sesion.errores.generico);
      }
    } finally {
      setEnviando(false);
    }
  }

  /*
   * El texto del modo actual, aplanado.
   *
   * `MICROCOPY.sesion.entrar` y `.registro` unionados dan un tipo que
   * no tiene las claves de los dos, y `copy.nombre` no compila. Aplanar
   * aqui deja una sola forma de leer el texto y hace imposible el error
   * de usar una clave del modo contrario.
   */
  const copy = {
    titulo: modo === 'entrar' ? MICROCOPY.sesion.entrar.titulo : MICROCOPY.sesion.registro.titulo,
    accion: modo === 'entrar' ? MICROCOPY.sesion.entrar.accion : MICROCOPY.sesion.registro.accion,
    nombre: MICROCOPY.sesion.registro.nombre,
    correo: MICROCOPY.sesion.registro.correo,
    contrasena:
      modo === 'entrar' ? MICROCOPY.sesion.entrar.contrasena : MICROCOPY.sesion.registro.contrasena,
    ayudaContrasena: MICROCOPY.sesion.registro.ayudaContrasena,
    pregunta:
      modo === 'entrar' ? MICROCOPY.sesion.entrar.noTengo : MICROCOPY.sesion.registro.yaTengo,
    alterno: modo === 'entrar' ? MICROCOPY.sesion.entrar.crear : MICROCOPY.sesion.registro.entrar,
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-h1">{MICROCOPY.sesion.titulo}</h1>
        <p className="text-body mt-1 text-stone">{MICROCOPY.sesion.subtitulo}</p>
      </header>

      {creado ? (
        <section
          role="status"
          aria-live="polite"
          className="flex flex-col gap-4 rounded-lg border border-line bg-white p-6 shadow-sm"
        >
          <h2 className="text-h2">{MICROCOPY.sesion.creado.titulo}</h2>

          <p className="text-body text-stone">{MICROCOPY.sesion.creado.cuerpo}</p>

          {sinConfirmar && (
            <p className="rounded-md bg-sun/25 px-3 py-2 text-small text-ink">
              {MICROCOPY.sesion.creado.sinConfirmar}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setCreado(false);
              setModo('entrar');
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-paper px-5 text-body font-semibold text-leaf transition-colors duration-200 hover:bg-sand motion-reduce:transition-none"
          >
            {MICROCOPY.sesion.entrar.accion}
          </button>
        </section>
      ) : (
        <form
          onSubmit={enviar}
          noValidate
          className="flex flex-col gap-4 rounded-lg border border-line bg-white p-6 shadow-sm"
        >
          <h2 className="text-h2">{copy.titulo}</h2>

          {/*
            `role="alert"` y no `aria-live`: este resumen aparece al
            enviar, y es justo el aviso que debe interrumpir. DS-10 lo
            pide asi.
          */}
          {general && (
            <div
              role="alert"
              className="rounded-md border border-clay bg-clay/10 px-3 py-2 text-small text-ink"
            >
              {general}
            </div>
          )}

          {modo === 'registro' && (
            <Campo
              id={ids.nombre}
              etiqueta={copy.nombre}
              tipo="text"
              autoComplete="name"
              valor={nombre}
              errores={errores.name}
              onChange={setNombre}
            />
          )}

          <Campo
            id={ids.correo}
            etiqueta={copy.correo}
            tipo="email"
            autoComplete="email"
            valor={correo}
            errores={errores.email}
            onChange={setCorreo}
          />

          <Campo
            id={ids.contrasena}
            etiqueta={copy.contrasena}
            tipo="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            valor={contrasena}
            errores={errores.password}
            ayuda={modo === 'registro' ? copy.ayudaContrasena : undefined}
            onChange={setContrasena}
          />

          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-5 text-body font-semibold text-paper transition-colors duration-200 hover:bg-leaf disabled:cursor-progress disabled:opacity-70 motion-reduce:transition-none"
          >
            {enviando ? 'Un momento…' : copy.accion}
          </button>

          <p className="text-center text-small text-stone">
            {copy.pregunta}{' '}
            <button
              type="button"
              onClick={() => {
                setModo(modo === 'entrar' ? 'registro' : 'entrar');
                setGeneral(null);
                ultimoError.current = null;
              }}
              className="inline-flex min-h-11 items-center font-semibold text-leaf underline underline-offset-4"
            >
              {copy.alterno}
            </button>
          </p>
        </form>
      )}
    </main>
  );
}

/**
 * Un campo con su error debajo y enlazado por `aria-describedby`.
 *
 * DS-10 lo pide explicito: el error tiene que estar **asociado** al
 * campo, no ser un color al lado. Un lector de pantalla lee la
 * etiqueta y el valor; si el error no esta enlazado, no lo lee nunca.
 *
 * El texto del error va en `ink`, NO en `clay`. `clay` da 2,6:1 sobre
 * `paper` y AA pide 4,5:1 para texto normal -- la propia regla de
 * `Estado.tsx` dice que `clay` es para superficies grandes o
 * decorativas, no para texto. El aviso se marca por el fondo y el
 * borde, que si pueden ser `clay`.
 *
 * Y **no** se quita el `outline`: `base.css` ya define el anillo de
 * foco de 3 px con `outline`, y un `outline-none` con un anillo
 * propio lo reemplazaria por uno que no cumple el criterio.
 */
function Campo({
  id,
  etiqueta,
  tipo,
  autoComplete,
  valor,
  errores,
  ayuda,
  onChange,
}: {
  id: string;
  etiqueta: string;
  tipo: 'text' | 'email' | 'password';
  autoComplete: string;
  valor: string;
  errores?: string[];
  ayuda?: string;
  onChange: (valor: string) => void;
}) {
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const error = errores?.[0];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-semibold text-ink">
        {etiqueta}
      </label>

      <input
        id={id}
        name={id}
        type={tipo}
        autoComplete={autoComplete}
        value={valor}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(' ') || undefined
        }
        onChange={(evento) => onChange(evento.target.value)}
        className={`min-h-11 rounded-md border bg-paper px-3 text-body text-ink transition-colors duration-200 ${
          error ? 'border-clay' : 'border-line'
        }`}
      />

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
