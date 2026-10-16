/**
 * El boton de WhatsApp y su alternativa de escritorio. RF-5.2.
 *
 * ## Por que son dos cosas y no un boton con dos textos
 *
 * En un celular, `wa.me` abre la app o el chat de la web: un solo
 * clic y se escribio. En un escritorio sin WhatsApp instalado, el
 * mismo enlace abre la web --que funciona-- pero obligaria a dejar
 * la pagina, y ahi hay gente mirando tres anuncios en tres pestanas.
 *
 * Por eso el escritorio ofrece **copiar el numero**: el dueno lo
 * recibe igual por el canal que tenga abierto, y quien queria hablar
 * ahora con el sigue en la pagina que estaba leyendo.
 *
 * El boton de WhatsApp **no desaparece** en escritorio. Es el canal mas
 * usado en la zona y hidinglo poriez de escritorio --donde se ve
 * primero-- seria ocultarlo justo donde se decide.
 */

import { useState } from 'react';

import { numeroLegible, type PerfilDueno } from '../../lib/whatsapp';

type Props = {
  perfil: PerfilDueno | null;
  /** El enlace ya armado, o `null` si no hay contacto. */
  enlace: string | null;
};

/**
 * Copia al portapapeles.
 *
 * `navigator.clipboard` no existe en http plano y **lanza** en un
 * contexto sin permiso en algunos navegadores: sin el `try`, el
 * fallo llega como una excepcion no capturada y el boton parece
 * roto sin explicar por que.
 *
 * El respaldo es el campo oculto: `document.execCommand('copy')` esta
 * obsoleto pero es lo unico que funciona en el navegador viejo, y el
 * numero es corto.
 */
async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(texto);

      return true;
    }
  } catch {
    // Sin permiso o sin contexto seguro: se intenta el respaldo.
  }

  try {
    const campo = document.createElement('textarea');

    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';

    document.body.appendChild(campo);
    campo.select();

    const copiado = document.execCommand('copy');

    document.body.removeChild(campo);

    return copiado;
  } catch {
    return false;
  }
}

export default function BotonWhatsApp({ perfil, enlace }: Props) {
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null);

  if (!enlace || !perfil?.whatsapp) {
    return null;
  }

  const crudo = perfil.whatsapp.replace(/\D/g, '');

  /**
   * Copiar **el crudo**, no el legible.
   *
   * `+506 8888-1234` no lo acepta la app de la otra persona: espera
   * digitos. El legible es para leer, el crudo para pegar.
   */
  const alCopiar = async () => {
    const ok = await copiar(crudo);

    setCopiado(ok ? 'si' : 'no');

    /*
     * El aviso se va solo a los **dos segundos**.
     *
     * Es excepcion a la regla de `avisos.ts`, donde los errores nunca
     * se descartan solos: copiar no es una accion de la aplicacion,
     * es un gesto del navegador que la persona puede no ver. Y a los
     * dos segundos el portapapeles ya quedo escrito, de modo que
     * dejar el cartel ahi solo estorba.
     */
    window.setTimeout(() => setCopiado(null), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      {/*
       * `rel="noopener noreferrer"` va **siempre**, no solo en el
       * externo. `target="_blank"` sin `noopener` deja que la pagina
       * de destino lea `window.opener` y navegue esta pestana: es un
       * fallo de seguridad conocido, no una buena practica opcional.
       */}
      <a
        href={enlace}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sun px-5 text-body font-semibold text-ink transition-colors duration-200 hover:bg-sun/80 motion-reduce:transition-none"
      >
        Contactar por WhatsApp
      </a>

      {/*
       * La alternativa de escritorio va **oculta en movil a proposito**
       * --no solo pequena--: en un celular copiar un numero es un
       * rodeo de cuatro toques para nada, porque la app ya se abre
       * sola con el boton de arriba.
       */}
      <button
        type="button"
        onClick={() => void alCopiar()}
        className="hidden min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-paper px-5 text-small font-semibold text-leaf transition-colors duration-200 hover:bg-sand md:inline-flex motion-reduce:transition-none"
      >
        {copiado === 'si' ? 'Número copiado' : `Copiar ${numeroLegible(perfil.whatsapp)}`}
      </button>

      {/*
       * El resultado de copiar se anuncia con `role="status"`.
       *
       * Sin esto, quien usa lector de pantalla pulsa "copiar", no ve
       * nada cambiar de color y no sabe si funciono. Y el mensaje va
       * en vivo en vez de en un toast: el toast desaparece y el
       * lector lo anuncia igual de tarde.
       */}
      <p role="status" className="text-caption min-h-4 text-center text-stone">
        {copiado === 'si' && 'Pegalo donde quieras escribirle.'}
        {copiado === 'no' &&
          'No pudimos copiar. El número es ' + numeroLegible(perfil.whatsapp) + '.'}
      </p>

      {/*
       * El numero en texto plano, siempre visible.
       *
       * Si el portapapeles falla, si el navegador no soporta
       * `clipboard`, o si la persona simplemente quiere anotarlo, el
       * numero esta ahi. Sin esto el boton "copiar" es la unica via y
       * cuando falla no queda ninguna.
       */}
      <p className="text-caption text-center text-stone">
        ¿Prefieres escribirle? {numeroLegible(perfil.whatsapp)}
      </p>
    </div>
  );
}
