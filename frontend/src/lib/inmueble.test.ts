import { describe, expect, it } from 'vitest';

import {
  cintillo,
  datosEstructurados,
  imagenes,
  puedeContactar,
  puedeWhatsApp,
  pinVisible,
  plural,
  referencia,
  servicios,
  textoPrincipal,
  tipoTexto,
} from './inmueble';
import type { Property } from '../types/property';

/**
 * Lo que decide la ficha del inmueble. DS-12.
 *
 * Aqui no se prueba el pixel sino las decisiones que, si se toman en
 * dos sitios, dan dos respuestas distintas: el cintillo, el texto del
 * boton, si se puede ver el pin y que se le dice a Google.
 */

/** Lo que devuelve la API con lo que hoy existe. */
function inmueble(extra: Partial<Property> = {}): Property {
  return {
    id: 1,
    title: 'Apartamento en Ciudad Quesada',
    description: 'Dos habitaciones con terraza.',
    district: 'Ciudad Quesada',
    neighborhood: 'Barrio San Rafael',
    type: 'apartamento',
    monthly_rent: 250_000,
    currency: 'CRC',
    deposit: 250_000,
    bedrooms: 2,
    bathrooms: 1,
    parking_spaces: 1,
    furnished: false,
    pets_allowed: true,
    status: 'activa',
    includes_water: true,
    includes_electricity: false,
    includes_internet: true,
    available_from: null,
    rules: null,
    address_reference: '200 m norte de la iglesia',
    latitude: 10.3166,
    longitude: -84.3166,
    show_exact_location: true,
    landlord_verified: false,
    is_favorite: false,
    images: [],
    created_at: '2026-01-15T10:00:00+00:00',
    ...extra,
  };
}

describe('cintillo', () => {
  /**
   * Una activa no lleva cintillo. Un aviso de "todo bien" en cada
   * ficha entrena a la gente a ignorar los avisos que si importan.
   */
  it('una activa no lleva cintillo', () => {
    expect(cintillo('activa')).toBeNull();
  });

  /**
   * Pausada y alquilada piden aviso por motivos distintos y con
   * distinto tono: pausada es "todavia podria", alquilada es "ya no".
   */
  it('avisa distinto una pausada que una alquilada', () => {
    const pausada = cintillo('pausada');
    const alquilada = cintillo('alquilada');

    expect(pausada?.titulo).toContain('pausada');
    expect(alquilada?.titulo).toContain('alquilada');
    expect(pausada?.tono).not.toBe(alquilada?.tono);
  });

  it('avisa tambien una pendiente y un borrador', () => {
    expect(cintillo('pendiente')).not.toBeNull();
    expect(cintillo('borrador')).not.toBeNull();
  });

  /**
   * El cintillo sin detalle es un titulo suelto. El detalle es lo
   * que dice que se puede hacer: seguir mirando, o dejar el correo.
   */
  it('el cintillo siempre explica', () => {
    for (const estado of ['pausada', 'alquilada', 'pendiente', 'borrador'] as const) {
      const c = cintillo(estado);

      expect(c?.detalle.length ?? 0).toBeGreaterThan(10);
    }
  });

  it('un estado desconocido no rompe', () => {
    expect(cintillo('raro' as never)).toBeNull();
  });
});

describe('textoPrincipal', () => {
  /**
   * Pedir informacion de una casa ya alquilada no tiene sentido, y el
   * boton que lo ofrece sin contexto hace que alguien se sienta
   * timedelta.
   */
  it('cambia cuando ya esta alquilada', () => {
    expect(textoPrincipal('activa')).toBe('Me interesa');
    expect(textoPrincipal('alquilada')).toContain('similar');
  });

  it('no puede contactar con una alquilada', () => {
    expect(puedeContactar('activa')).toBe(true);
    expect(puedeContactar('alquilada')).toBe(false);
  });

  it('una pausada todavia se puede contactar', () => {
    expect(puedeContactar('pausada')).toBe(true);
  });
});

describe('puedeWhatsApp', () => {
  /**
   * La API no manda telefono: `Property` ni tiene el campo. El boton
   * sale solo cuando exista, y no antes.
   *
   * Un boton de WhatsApp que aparece cuando el contacto es privado es
   * una fuga de datos en un boton. La condicion de privacidad va
   * **antes** que esta; esta funcion solo documenta el estado.
   */
  it('es falso mientras la API no mande telefono', () => {
    expect(puedeWhatsApp(inmueble())).toBe(false);
  });
});

describe('referencia', () => {
  it('junta los tres datos', () => {
    expect(referencia(inmueble())).toBe(
      '200 m norte de la iglesia · Barrio San Rafael · Ciudad Quesada',
    );
  });

  /**
   * Las direcciones de Costa Rica no sirven para geolocalizar, asi que
   * la referencia escrita es lo que realmente orienta (RF-2.5).
   */
  it('la referencia va antes que el barrio', () => {
    expect(referencia(inmueble()).startsWith('200 m norte')).toBe(true);
  });

  it('aguanta que falten partes', () => {
    expect(
      referencia({
        address_reference: 'Frente al parque',
        district: null,
        neighborhood: null,
      }),
    ).toBe('Frente al parque');
  });

  it('ignora los espacios en blanco', () => {
    expect(
      referencia({
        address_reference: '   ',
        district: 'Zarcero',
        neighborhood: null,
      }),
    ).toBe('Zarcero');
  });

  /**
   * Sin nada que decir, se dice. Un lugar en blanco donde deberia ir
   * la direccion parece un fallo de la pagina, no una publicacion
   * incompleta.
   */
  it('avisa cuando no hay nada', () => {
    expect(referencia({ address_reference: null, district: null, neighborhood: null })).toBe(
      'El arrendador no indicó la ubicación.',
    );
  });
});

describe('pinVisible', () => {
  it('se ve cuando esta autorizado y hay coordenadas', () => {
    expect(pinVisible(inmueble())).toBe(true);
  });

  /**
   * El nucleo de RF-2.5. Con `show_exact_location: false` el mapa ya
   * devuelve un punto desplazado, pero el pin tampoco puede pintarse
   * como si fuera el real.
   */
  it('NO se ve cuando el arrendador no lo autoriza', () => {
    expect(pinVisible(inmueble({ show_exact_location: false }))).toBe(false);
  });

  it('tampoco sin coordenadas', () => {
    expect(pinVisible(inmueble({ latitude: null, longitude: null }))).toBe(false);
  });

  it('faltan las dos o no se ve ninguna', () => {
    expect(pinVisible(inmueble({ longitude: null }))).toBe(false);
    expect(pinVisible(inmueble({ latitude: null }))).toBe(false);
  });
});

describe('servicios', () => {
  /**
   * Ocultar los que no estan marcados seria mentir: alguien asume que
   * lo que no aparece es lo que no hay, cuando en realidad es lo que
   * el arrendador no respondio.
   */
  it('lista los cinco, marcados y sin marcar', () => {
    const lista = servicios(inmueble());

    expect(lista).toHaveLength(5);
    expect(lista.find((s) => s.clave === 'agua')?.incluido).toBe(true);
    expect(lista.find((s) => s.clave === 'luz')?.incluido).toBe(false);
  });

  it('todos con texto para el icono', () => {
    for (const servicio of servicios(inmueble())) {
      expect(servicio.etiqueta.length).toBeGreaterThan(0);
    }
  });
});

describe('plural', () => {
  it('una habitacion, no una habitaciones', () => {
    expect(plural(1, 'habitación', 'habitaciones')).toBe('1 habitación');
  });

  it('cero habitaciones en plural', () => {
    expect(plural(0, 'habitación', 'habitaciones')).toBe('0 habitaciones');
  });

  it('cinco habitaciones', () => {
    expect(plural(5, 'habitación', 'habitaciones')).toBe('5 habitaciones');
  });
});

describe('tipoTexto', () => {
  it('usa el nombre que la gente entiende', () => {
    expect(tipoTexto({ type: 'habitacion' })).toBe('Habitación');
  });

  it('un tipo desconocido no deja el texto vacio', () => {
    expect(tipoTexto({ type: 'naufragio' as never })).toBe('naufragio');
  });
});

describe('imagenes', () => {
  /**
   * RF-2.3 no existe: la API devuelve `[]` siempre. Devolver el texto
   * en vez de un array vacio obliga a la galeria a decidir el
   * placeholder en un solo sitio.
   */
  it('avisa que no hay fotos', () => {
    expect(imagenes(inmueble())).toBe('sin-fotos');
  });

  it('devuelve las fotos cuando existen', () => {
    const lista = [{ id: 1, url: '/a.jpg', alt: 'Sala' }];

    expect(imagenes(inmueble({ images: lista }))).toEqual(lista);
  });
});

describe('datosEstructurados (RNF-13)', () => {
  const datos = datosEstructurados(inmueble(), 'https://roomies.example/inmuebles/1');

  it('es un RealEstateListing con el contexto', () => {
    expect(datos['@type']).toBe('RealEstateListing');
    expect(datos['@context']).toBe('https://schema.org');
  });

  it('lleva la oferta con precio y moneda', () => {
    expect(datos.offers).toMatchObject({ price: 250_000, priceCurrency: 'CRC' });
  });

  it('lleva la direccion con el distrito', () => {
    expect(datos.address).toMatchObject({
      addressLocality: 'Ciudad Quesada',
      addressCountry: 'CR',
    });
  });

  /**
   * Sin `undefined` en ninguna parte.
   *
   * `JSON.stringify` los borra, pero si alguien mete `null` despues
   * Google lee "este dato es null", que es una afirmacion distinta de
   * "no lo sé". Las claves vacias se limpian antes de devolver.
   */
  it('no deja ninguna clave sin valor', () => {
    for (const valor of Object.values(datos)) {
      expect(valor).not.toBeUndefined();
    }
  });

  it('una pausada no se anuncia como disponible', () => {
    const pausada = datosEstructurados(inmueble({ status: 'pausada' }), 'https://x.test/1');

    expect(JSON.stringify(pausada)).not.toContain('InStock');
  });

  it('una activa si se anuncia como disponible', () => {
    expect(JSON.stringify(datos)).toContain('InStock');
  });

  /**
   * No se inventa `image`.
   *
   * Schema.org lo marca como recomendado, no obligatorio. Un `image`
   * que apunta a una foto que no existe es peor que ninguno: Google
   * lo indexa y el resultado en busqueda muestra un hueco.
   */
  it('no inventa una imagen que no existe', () => {
    expect(datos).not.toHaveProperty('image');
  });

  it('sobrevive sin descripcion ni barrio', () => {
    const vacio = datosEstructurados(
      inmueble({ description: null, address_reference: null, created_at: null }),
      'https://x.test/1',
    );

    expect(vacio).not.toHaveProperty('description');
    expect(vacio).not.toHaveProperty('datePosted');
    expect(JSON.stringify(vacio)).not.toContain('null');
  });
});
