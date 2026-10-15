import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PantallaIngreso from './PantallaIngreso';
import ChipsActivos from './filtros/ChipsActivos';
import PanelFiltros from './filtros/PanelFiltros';
import FormularioPublicar from './publicar/FormularioPublicar';
import { ProveedorAvisos } from './ProveedorAvisos';
import { ProveedorSesion } from './SesionContexto';
import { fallosDeAccesibilidad, resumen } from '../test/accesibilidad';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Accesibilidad de las pantallas. DS-10.
 *
 * Corre axe-core completo sobre cada pantalla montada. Lo que axe no
 * puede ver --area tactil, grosor del anillo de foco, mapa por
 * teclado-- esta en los archivos hermanos.
 */

/** El contexto de sesion va envuelto porque `PantallaIngreso` lo pide. */
function ConSesion({ children }: { children: ReactNode }) {
  return (
    <ProveedorAvisos>
      <ProveedorSesion>
        <MemoryRouter>{children}</MemoryRouter>
      </ProveedorSesion>
    </ProveedorAvisos>
  );
}

describe('la pantalla de acceso', () => {
  it('no tiene fallos de accesibilidad', async () => {
    const { container } = render(
      <ConSesion>
        <PantallaIngreso modo="entrar" />
      </ConSesion>,
    );

    const fallos = await fallosDeAccesibilidad(container);

    expect(resumen(fallos)).toBe('sin fallos');
  });

  /**
   * El formulario tiene que estar dentro de un `main`.
   *
   * Un `div` suelto obliga a recorrer la pagina entera con el
   * teclado porque no hay un punto de salto al contenido.
   */
  it('el formulario esta dentro de un landmark', () => {
    render(
      <ConSesion>
        <PantallaIngreso modo="entrar" />
      </ConSesion>,
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  /**
   * Un solo `h1` por pantalla.
   *
   * Dos `h1` hacen que un lector de pantalla anuncie el titulo dos
   * veces y no sepa cual es el de la pagina.
   */
  it('tiene un solo h1', () => {
    render(
      <ConSesion>
        <PantallaIngreso modo="entrar" />
      </ConSesion>,
    );

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('el registro', () => {
  it('no tiene fallos de accesibilidad', async () => {
    const { container } = render(
      <ConSesion>
        <PantallaIngreso modo="registro" />
      </ConSesion>,
    );

    expect(resumen(await fallosDeAccesibilidad(container))).toBe('sin fallos');
  });

  /**
   * Cada campo tiene etiqueta.
   *
   * Un `<input>` sin etiqueta es un campo anonimo: el lector anuncia
   * "campo de texto" y no se puede distinguir de los otros dos.
   */
  it('cada campo tiene etiqueta', () => {
    render(
      <ConSesion>
        <PantallaIngreso modo="registro" />
      </ConSesion>,
    );

    expect(screen.getByLabelText('Cómo te llamás')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });
});

describe('los chips de filtro', () => {
  it('no tienen fallos de accesibilidad', async () => {
    const { container } = render(
      <ChipsActivos filtros={{ type: 'casa' }} onCambio={() => undefined} />,
    );

    expect(resumen(await fallosDeAccesibilidad(container))).toBe('sin fallos');
  });

  /**
   * El nombre del boton dice lo que hace.
   *
   * Con solo el texto, el lector anuncia "Apartamento" y no hay forma
   * de saber que al tocarlo se **quita**.
   */
  it('el chip dice que se quita', () => {
    render(<ChipsActivos filtros={{ type: 'apartamento' }} onCambio={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Quitar filtro Apartamento' })).toBeInTheDocument();
  });

  it('no hay marca visible de la x para el lector de pantalla', () => {
    const { container } = render(
      <ChipsActivos filtros={{ type: 'apartamento' }} onCambio={() => undefined} />,
    );

    // La "x" lleva aria-hidden: leida en voz alta seria "Apartamento x".
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

describe('la hoja de filtros', () => {
  function pintar(abierto: boolean) {
    return render(
      <PanelFiltros
        variante="hoja"
        filtros={{ type: 'casa' }}
        onCambio={() => undefined}
        abierto={abierto}
        onCerrar={() => undefined}
        total={12}
        cargando={false}
      />,
    );
  }

  it('no tiene fallos de accesibilidad', async () => {
    const { container } = pintar(true);

    expect(resumen(await fallosDeAccesibilidad(container))).toBe('sin fallos');
  });

  /**
   * Un `dialog` con `aria-modal` es lo que le dice al lector de
   * pantalla que el resto de la pagina esta bloqueado. Sin
   * `aria-modal`, sigue leyendo el contenido de abajo como si la hoja
   * no existiera.
   */
  it('es un dialogo modal', () => {
    pintar(true);

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName('Filtros');
  });

  it('el boton de aplicar lleva el numero', () => {
    pintar(true);

    expect(screen.getByRole('button', { name: 'Ver 12 inmuebles' })).toBeInTheDocument();
  });

  it('el boton de aplicar es singular cuando hay uno', () => {
    render(
      <PanelFiltros
        variante="hoja"
        filtros={{}}
        onCambio={() => undefined}
        abierto
        onCerrar={() => undefined}
        total={1}
        cargando={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ver 1 inmueble' })).toBeInTheDocument();
  });
});

describe('la columna de filtros', () => {
  it('no tiene fallos de accesibilidad', async () => {
    const { container } = render(
      <PanelFiltros
        variante="columna"
        filtros={{ type: 'casa', max_rent: 300000 }}
        onCambio={() => undefined}
        abierto={false}
        onCerrar={() => undefined}
        total={4}
        cargando={false}
      />,
    );

    expect(resumen(await fallosDeAccesibilidad(container))).toBe('sin fallos');
  });

  /**
   * Los controles de seleccion tienen que decir si estan pulsados.
   *
   * Un boton que se ve distinto segun el estado y no lo dice es un
   * boton que no se puede usar sin ver.
   */
  it('los botones de seleccion dicen si estan pulsados', () => {
    render(
      <PanelFiltros
        variante="columna"
        filtros={{ type: 'casa' }}
        onCambio={() => undefined}
        abierto={false}
        onCerrar={() => undefined}
        total={4}
        cargando={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Casa' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Apartamento' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('el formulario de publicacion', () => {
  it('no tiene fallos de accesibilidad en el paso 1', async () => {
    /*
     * Sin sesion el componente sale antes de pintar los pasos, asi
     * que el render ahi no probaria nada. Por eso el caso util es el
     * `main` y los controles.
     */
    const { container } = render(
      <ConSesion>
        <FormularioPublicar />
      </ConSesion>,
    );

    expect(resumen(await fallosDeAccesibilidad(container))).toBe('sin fallos');
  });

  /**
   * Sin sesion el componente sale antes de pintar los pasos, asi que lo
   * que se puede comprobar ahi es la guarda: que avise y no muestre
   * un formulario vacio.
   *
   * `FormularioPublicar` sin sesion devuelve un `main` con un texto y
   * nada mas. Probar la barra de pasos exigiria montar con sesion
   * activa, que necesita un token valido contra la API -- y una prueba
   * de accesibilidad no puede depender de un servidor.
   */
  it('sin sesion avisa en vez de mostrar el formulario', () => {
    render(
      <ConSesion>
        <FormularioPublicar />
      </ConSesion>,
    );

    expect(screen.getByText('Tenés que entrar para publicar.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Pasos de la publicación' })).toBeNull();
  });
});
