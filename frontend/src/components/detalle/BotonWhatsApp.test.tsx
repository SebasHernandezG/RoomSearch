import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BotonWhatsApp from './BotonWhatsApp';
import type { PerfilDueno } from '../../lib/whatsapp';

/**
 * El boton de WhatsApp en la ficha. RF-5.2.
 *
 * Lo que se prueba es la promesa que hace el boton: **abre WhatsApp en
 * otra pestana** y **deja una alternativa si no funciona**. Un boton
 * que no abre nada es peor que no tenerlo, y uno que solo funciona en
 * el caso habitual deja fuera justo a quien tiene menos opciones.
 */

function perfil(extra: Partial<PerfilDueno> = {}): PerfilDueno {
  return {
    user_id: 7,
    name: 'Ana Mora',
    email_verified: true,
    phone: '+50688880000',
    phone_public: true,
    whatsapp: '+50688881234',
    photo_url: null,
    bio: null,
    years_experience: null,
    ...extra,
  };
}

const ENLACE = 'https://wa.me/50688881234?text=Hola';

function pintar(props: Partial<Parameters<typeof BotonWhatsApp>[0]> = {}) {
  return render(<BotonWhatsApp perfil={perfil()} enlace={ENLACE} {...props} />);
}

describe('el boton de WhatsApp', () => {
  it('enlaza a WhatsApp', () => {
    pintar();

    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', ENLACE);
  });

  /**
   * En pestana nueva, y con `noopener`.
   *
   * `target="_blank"` sin `noopener` deja que la pagina de destino lea
   * `window.opener` y navegue esta pestana. Es un fallo de seguridad
   * conocido, no una buena practica opcional, asi que `rel` va
   * siempre.
   */
  it('abre en pestana nueva sin darle acceso a esta', () => {
    pintar();

    const enlace = screen.getByRole('link', { name: /whatsapp/i });

    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace.getAttribute('rel')).toContain('noopener');
    expect(enlace.getAttribute('rel')).toContain('noreferrer');
  });

  /**
   * Sin numero no hay boton.
   *
   * El backend manda `whatsapp: null` cuando el dueno marco el
   * contacto privado. Un boton de WhatsApp que sale ahi es una fuga de
   * datos en un boton, y un boton deshabilitado seria una promesa que
   * el sitio no puede cumplir.
   */
  it('no aparece sin contacto', () => {
    pintar({ perfil: null, enlace: null });

    expect(screen.queryByRole('link', { name: /whatsapp/i })).toBeNull();
  });

  it('no aparece si el perfil no tiene numero', () => {
    pintar({ perfil: perfil({ whatsapp: null }), enlace: null });

    expect(screen.queryByRole('link', { name: /whatsapp/i })).toBeNull();
  });

  /*
  |----------------------------------------------------------------------
  | La alternativa de escritorio
  |----------------------------------------------------------------------
  */

  it('ofrece copiar el numero', () => {
    pintar();

    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
  });

  /**
   * El numero se muestra siempre, en texto.
   *
   * Si el portapapeles falla, si el navegador no soporta `clipboard`, o
   * si la persona solo quiere anotarlo, el numero esta ahi. Sin esto
   * "copiar" es la unica via y cuando falla no queda ninguna.
   */
  it('muestra el numero en texto', () => {
    pintar();

    /*
     * Dos elementos a proposito: la etiqueta del boton y el numero
     * suelto. El segundo es el que sobrevive cuando el portapapeles
     * falla, y por eso tiene que estar en el texto y no solo en el
     * `title` del boton.
     */
    expect(screen.getAllByText(/\+506 8888-1234/).length).toBeGreaterThanOrEqual(2);
  });

  it('confirma en el boton que copio', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    pintar();

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument(),
    );
  });

  /**
   * Copia el **crudo**, no el legible.
   *
   * `+506 8888-1234` no lo acepta la app de la otra persona: espera
   * digitos. El legible es para leer, el crudo para pegar.
   */
  it('copia solo digitos', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText: escribir } });

    pintar();

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    await vi.waitFor(() => expect(escribir).toHaveBeenCalledWith('50688881234'));
  });

  /**
   * Un portapapeles que lanza no rompe la pantalla.
   *
   * `navigator.clipboard` **lanza** cuando no hay contexto seguro y
   * `execCommand` esta obsoleto. Sin el `catch`, el fallo llega como
   * una excepcion no capturada y el boton parece roto sin decir por
   * que.
   */
  it('avisa si no pudo copiar en vez de romperse', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('sin permiso')),
      },
    });

    document.execCommand = vi.fn().mockReturnValue(false);

    pintar();

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    await vi.waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/No pudimos copiar/),
    );
  });

  /**
   * El mensaje de exito dice **que pegar y donde**, no solo "listo".
   *
   * "Numero copiado" deja a la persona pensando en donde pegar;
   * "pegalo donde quieras escribirle" es la accion siguiente.
   */
  it('dice que pegar el numero', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    pintar();

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Pegalo/));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });
});
