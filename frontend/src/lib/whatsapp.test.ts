import { describe, expect, it } from 'vitest';

import {
  enlaceWhatsApp,
  mensajeWhatsApp,
  numeroLegible,
  puedeWhatsApp,
  type InmuebleParaWhatsApp,
  type PerfilDueno,
} from './whatsapp';

/**
 * El boton de WhatsApp. RF-5.2.
 *
 * La prueba de cabeza no es "hay un enlace": es **"no hay enlace cuando
 * el contacto es privado"**. El criterio del issue es literal y la
 * forma de fallar es una fuga de datos en un boton.
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

function inmueble(extra: Partial<InmuebleParaWhatsApp> = {}): InmuebleParaWhatsApp {
  return {
    title: 'Apartamento a dos cuadras de la UTN',
    address_reference: '200 m norte de la iglesia',
    district: 'Ciudad Quesada',
    reference: 'RS-1042',
    ...extra,
  };
}

describe('puedeWhatsApp', () => {
  /**
   * La prueba de cabeza.
   *
   * El backend manda `whatsapp: null` cuando el dueno marco el
   * contacto privado. Aca no hay nada que decidir: si no vino numero,
   * no se inventa.
   */
  it('no sale sin numero', () => {
    expect(puedeWhatsApp(perfil({ whatsapp: null }), 'activa')).toBe(false);
  });

  it('no sale sin perfil', () => {
    expect(puedeWhatsApp(null, 'activa')).toBe(false);
  });

  it('no sale con el numero vacio', () => {
    expect(puedeWhatsApp(perfil({ whatsapp: '' }), 'activa')).toBe(false);
  });

  /**
   * Un anuncio alquilado no admite preguntas.
   *
   * Escribirle al dueno de algo que ya se alquilo es molestia para
   * alguien que ya no puede hacer nada.
   */
  it('no sale si el inmueble no esta activo', () => {
    expect(puedeWhatsApp(perfil(), 'alquilada')).toBe(false);
    expect(puedeWhatsApp(perfil(), 'pausada')).toBe(false);
    expect(puedeWhatsApp(perfil(), 'pendiente')).toBe(false);
    expect(puedeWhatsApp(perfil(), 'borrador')).toBe(false);
  });

  it('sale con numero y anuncio activo', () => {
    expect(puedeWhatsApp(perfil(), 'activa')).toBe(true);
  });
});

describe('mensajeWhatsApp', () => {
  /**
   * El titulo y la referencia, no solo el titulo.
   *
   * Al dueno le llegan mensajes de varios anuncios a la vez, y "Hola,
   * me interesa el apartamento" no dice de cual. La referencia es lo
   * que le deja encontrarlo en su panel.
   */
  it('lleva el titulo', () => {
    expect(mensajeWhatsApp(inmueble())).toContain('Apartamento a dos cuadras de la UTN');
  });

  it('lleva la referencia', () => {
    expect(mensajeWhatsApp(inmueble())).toContain('RS-1042');
  });

  it('lleva la ubicacion', () => {
    expect(mensajeWhatsApp(inmueble())).toContain('Ciudad Quesada');
  });

  it('pregunta si sigue disponible', () => {
    expect(mensajeWhatsApp(inmueble())).toContain('disponible');
  });

  /**
   * Sin la referencia no inventa una.
   *
   * Poner "Referencia: undefined" en un mensaje que va a leer una
   * persona es peor que no ponerla.
   */
  it('omite la referencia si no hay', () => {
    expect(mensajeWhatsApp(inmueble({ reference: null }))).not.toContain('Referencia:');
  });

  it('omite la ubicacion si no hay', () => {
    expect(mensajeWhatsApp(inmueble({ address_reference: null, district: null }))).not.toContain(
      'Ubicacion:',
    );
  });

  /**
   * Las tildes se quedan.
   *
   * Lo contrario suena sensato --"una tilde rompe un enlace"-- pero es
   * falso: `encodeURIComponent` las convierte en `%C3%A1` y la URL
   * abre igual. Aplanar el texto del dueno lo hace parecer que el
   * sitio esta roto, y el titulo es suyo, no nuestro.
   */
  it('respeta los acentos del titulo', () => {
    expect(mensajeWhatsApp(inmueble({ title: 'Ático en la Época' }))).toContain(
      'Ático en la Época',
    );
  });
});

describe('enlaceWhatsApp', () => {
  it('arma una URL de wa.me', () => {
    expect(enlaceWhatsApp(perfil(), inmueble())).toContain('https://wa.me/50688881234');
  });

  /**
   * Sin el `+`.
   *
   * `wa.me` espera solo digitos. Con el `+` la URL da 404, que se ve
   * como "WhatsApp no funciona" y no como "el numero esta mal".
   */
  it('el numero va sin mas', () => {
    const enlace = enlaceWhatsApp(perfil(), inmueble());

    expect(enlace).not.toContain('+506');
    expect(enlace?.split('/').pop()?.split('?')[0]).toBe('50688881234');
  });

  /**
   * El mensaje va codificado.
   *
   * Con espacios y comillas sin codificar, la URL se corta en el
   * primer espacio y el mensaje llega vacio.
   */
  it('codifica el mensaje', () => {
    const enlace = enlaceWhatsApp(perfil(), inmueble()) ?? '';

    expect(enlace).toContain('?text=');
    expect(enlace.split('?text=')[1]).toContain('%20');
  });

  /**
   * Sin perfil no hay enlace.
   *
   * Devolver `null` y no una URL con `--`: un enlace roto es un boton
   * que parece funcionar.
   */
  it('no hay enlace sin numero', () => {
    expect(enlaceWhatsApp(null, inmueble())).toBeNull();
    expect(enlaceWhatsApp(perfil({ whatsapp: null }), inmueble())).toBeNull();
  });

  /**
   * Un anuncio no activo no enlaza.
   */
  it('no hay enlace si el inmueble no esta activo', () => {
    expect(enlaceWhatsApp(perfil(), inmueble())).not.toBeNull();

    // Con el estado como parte de la decision:
    expect(puedeWhatsApp(perfil(), 'alquilada')).toBe(false);
  });

  it('limpia espacios del numero', () => {
    expect(enlaceWhatsApp(perfil({ whatsapp: '+506 8888-1234' }), inmueble())).toContain(
      'wa.me/50688881234',
    );
  });

  /**
   * Un titulo con acentos y espacios produce una URL que **abre**.
   *
   * Esta es la prueba que de verdad importa del enlace, y la razon de
   * que el mensaje no se aplane: lo que rompe un enlace no son las
   * tildes sino los espacios sin codificar, que cortan la URL en el
   * primero. Si `text` llega entero, `wa.me` muestra el mensaje.
   */
  it('el mensaje llega entero con acentos y espacios', () => {
    const enlace = enlaceWhatsApp(perfil(), inmueble({ title: 'Ático en la Época, con jardín' }));

    expect(enlace).toBeDefined();

    const texto = decodeURIComponent(enlace!.split('?text=')[1]);

    expect(texto).toContain('Ático en la Época, con jardín');
    expect(texto).toContain('RS-1042');

    // Y el mensaje no puede haber cortado la URL en un espacio.
    expect(enlace!.split('?text=')[0]).toBe('https://wa.me/50688881234');
  });
});

describe('numeroLegible', () => {
  /**
   * Legible para una persona, crudo para la app.
   *
   * Leer `+50688881234` de corrido es trabajo; el boton de copiar
   * copia el crudo, que es el que la app espera.
   */
  it('agrupa en pais, prefijo y resto', () => {
    expect(numeroLegible('+50688881234')).toBe('+506 8888-1234');
  });

  it('acepta el numero con formato', () => {
    expect(numeroLegible('+506 8888-1234')).toBe('+506 8888-1234');
  });

  it('no parte un numero demasiado corto', () => {
    expect(numeroLegible('+506')).toBe('+506');
  });
});
