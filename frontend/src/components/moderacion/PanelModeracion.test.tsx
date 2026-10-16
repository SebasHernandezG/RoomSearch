import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PanelModeracion from './PanelModeracion';
import type { EnModeracion } from '../../lib/moderacion';

/**
 * El panel de moderacion. RF-7.1.
 *
 * Lo que se prueba es que la pantalla **informa bien**: el estado
 * concreto de cada anuncio, el historial del dueno y si su correo
 * esta confirmado. Un panel que aprueba sin mostrar nada de eso no
 * moderar, hace clic.
 */

/** Un anuncio en la cola, con lo que el backend devuelve de verdad. */
function enCola(extra: Partial<EnModeracion> = {}): EnModeracion {
  return {
    id: 1,
    title: 'Apartamento a dos cuadras de la UTN',
    description: 'Sala, cocina y dos habitaciones.',
    district: 'Ciudad Quesada',
    neighborhood: 'Centro',
    type: 'apartamento',
    monthly_rent: 280_000,
    currency: 'CRC',
    deposit: 280_000,
    bedrooms: 2,
    bathrooms: 1,
    parking_spaces: 1,
    furnished: true,
    pets_allowed: true,
    status: 'pendiente',
    includes_water: true,
    includes_electricity: false,
    includes_internet: true,
    available_from: null,
    rules: null,
    address_reference: '200 m norte de la iglesia',
    latitude: 10.3236,
    longitude: -84.4274,
    show_exact_location: true,
    landlord_verified: false,
    is_favorite: false,
    images: [],
    created_at: null,
    landlord: {
      id: 7,
      name: 'Ana Mora',
      email: 'ana@correo.test',
      email_verified: true,
      published_count: 3,
      approved_count: 2,
      created_at: '2025-01-01T10:00:00+00:00',
    },
    ...extra,
  };
}

function pintar(anuncios: EnModeracion[], props = {}) {
  return render(
    <PanelModeracion
      anuncios={anuncios}
      cargando={false}
      onAprobar={() => undefined}
      onRechazar={() => undefined}
      {...props}
    />,
  );
}

describe('el panel de moderacion', () => {
  it('muestra el anuncio que espera decision', () => {
    pintar([enCola()]);

    expect(
      screen.getByRole('heading', { name: 'Apartamento a dos cuadras de la UTN' }),
    ).toBeInTheDocument();
  });

  /**
   * De quien es.
   *
   * Sin el nombre del dueno el administrador aprueba a ciegas, y el
   * panel deja de ser un panel de moderacion.
   */
  it('dice de quien es el anuncio', () => {
    pintar([enCola()]);

    expect(screen.getByText('Ana Mora')).toBeInTheDocument();
    expect(screen.getByText('ana@correo.test')).toBeInTheDocument();
  });

  /**
   * Si el correo esta confirmado.
   *
   * El correo verificado decide la confianza: una cuenta sin confirmar
   * puede publicar un anuncio de estafa y desaparecer.
   */
  it('avisa cuando el correo del dueno no esta confirmado', () => {
    pintar([
      enCola({
        landlord: {
          id: 8,
          name: 'Buscador',
          email: 'buscador@correo.test',
          email_verified: false,
          published_count: 1,
          approved_count: 0,
          created_at: null,
        },
      }),
    ]);

    expect(screen.getByText(/correo sin confirmar/i)).toBeInTheDocument();
  });

  it('no avisa cuando el correo si esta confirmado', () => {
    pintar([enCola()]);

    expect(screen.queryByText(/correo sin confirmar/i)).toBeNull();
  });

  /**
   * El historial.
   *
   * "3 anuncios, 2 aceptados" es informacion; "3 anuncios, 0
   * aceptados" es la misma cantidad con el signo cambiado, y es un
   * dato distinto para decidir.
   */
  it('muestra el historial del dueno', () => {
    pintar([enCola()]);

    expect(screen.getByText(/3 anuncios/)).toBeInTheDocument();
    expect(screen.getByText(/2 aceptados/)).toBeInTheDocument();
  });

  it('pregunta antes de rechazar', () => {
    const rejecting = vi.fn();

    pintar([enCola()], { onRechazar: rejecting });

    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));

    /*
     * Rechazar devuelve el anuncio a 'borrador' y corta la
     * publicacion. Es la unica accion del panel que no se puede
     * deshacer, asi que necesita confirmacion; aprobar no, porque se
     * puede pausar.
     */
    expect(rejecting).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('rechaza solo despues de confirmar', () => {
    const rechazar = vi.fn();

    pintar([enCola()], { onRechazar: rechazar });

    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^sí, rechazar$/i }));

    expect(rechazar).toHaveBeenCalledWith(1);
  });

  it('aprobar no pide confirmacion', () => {
    const aprobar = vi.fn();

    pintar([enCola()], { onAprobar: aprobar });

    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }));

    expect(aprobar).toHaveBeenCalledWith(1);
  });

  it('no ofrece aprobar ni rechazar si no hay anuncios', () => {
    render(
      <PanelModeracion
        anuncios={[]}
        cargando={false}
        onAprobar={() => undefined}
        onRechazar={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: /aprobar/i })).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('el esqueleto avisa que esta cargando', () => {
    render(
      <PanelModeracion
        anuncios={[]}
        cargando
        onAprobar={() => undefined}
        onRechazar={() => undefined}
      />,
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('solo hay un h1', () => {
    pintar([enCola()]);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
