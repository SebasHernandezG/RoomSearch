/**
 * Microcopy de la plataforma. DS-4.
 *
 * Español costarricense, en voz de "vos", claro y sin lenguaje
 * corporativo. El documento pide que la plataforma sea profesional,
 * rapida y confiable; el tono no va en "Estimado usuario" ni en
 * "No se encontraron resultados que coincidan con su solicitud".
 *
 * Todo el texto de cara al usuario sale de aqui. Asi se revisa de un
 * solo lugar y no queda copy suelto dentro de los componentes.
 */

export const MICROCOPY = {
  busqueda: {
    sinResultados: {
      titulo: 'No encontramos nada por acá',
      // Se completa con el filtro concreto que falló.
      conFiltros: (nombres: string[]) =>
        nombres.length === 1
          ? `No encontramos nada con ${nombres[0]}.`
          : `No encontramos nada con ${nombres.join(', ')}.`,
      consejoSinZona: 'Probá con un radio más grande, o quitá algún filtro.',
      consejoConZona: (metros: number) =>
        `Podés ampliar a ${metros >= 1000 ? `${metros / 1000} km` : `${metros} m`}.`,
      quitarFiltro: (nombre: string) => `Quitar ${nombre}`,
      quitarTodos: 'Quitar todos los filtros',
      buscarEnTodo: 'Buscar en toda la zona',
    },
    cargando: 'Buscando inmuebles…',
    errorConexion: {
      titulo: 'No pudimos cargar los inmuebles',
      detalle: 'Puede ser que la conexión esté lenta. Probá otra vez.',
      reintentar: 'Reintentar',
    },

    /*
     * RNF-05. El tono importa acá: no es un error, es un alto. Decir
     * "no pudimos cargar" haría pensar que la página está rota cuando
     * lo único que hay que hacer es esperar.
     */
    espera: {
      titulo: 'Vamos con calma',
      detalle: (segundos: number) =>
        segundos <= 1
          ? 'Ya podés seguir buscando.'
          : `Esperá ${segundos} segundos y seguí como siempre.`,
    },
  },

  publicaciones: {
    sinNinguna: {
      titulo: 'Todavía no publicás ningún inmueble',
      detalle:
        'Publicá el primero y te contactan los inquilinos interesados. Toma menos de dos minutos.',
      accion: 'Publicar mi primer inmueble',
      pasos: ['Poné el pin en el mapa', 'Subí las fotos', 'Elegí el precio'],
    },
    sinResultadosPropio: {
      titulo: 'No tenés publicaciones en pausa',
      detalle: 'Las que pausés aparecen acá y vuelven cuando querás.',
    },
    sinFavoritos: {
      titulo: 'Todavía no guardaste nada',
      detalle: 'Tocá el corazón en un inmueble para guardarlo acá.',
    },
    sinAlertas: {
      titulo: 'No tenés alertas activas',
      detalle:
        'Con una alerta te avisamos por correo cuando haya algo nuevo que coincida con tu búsqueda.',
      accion: 'Crear mi primera alerta',
    },
  },

  sesion: {
    sinSesion: {
      detalle: 'Iniciá sesión para guardar favoritos y recibir avisos.',
      accion: 'Iniciar sesión',
    },
    noAutorizado: 'Esta cuenta no puede hacer eso.',
  },

  general: {
    conexionPerdida: 'Sin conexión. Te mostramos lo último que cargamos.',
    reintentando: 'Volviendo a intentar…',
    errorInesperado: 'Algo salió mal de nuestro lado. Ya lo estamos revisando.',
  },
} as const;

/**
 * Convierte un filtro en el nombre corto que se usa en los chips y en
 * los mensajes de "no encontramos nada".
 *
 *   { tipo: 'apartamento' }  ->  'apartamentos'
 *   { currency: 'CRC', max: 350000 }  ->  'hasta ₡350.000'
 */
export function nombreFiltro(filtro: Record<string, unknown>): string {
  const TIPO: Record<string, string> = {
    apartamento: 'apartamentos',
    casa: 'casas',
    habitacion: 'habitaciones',
    estudio: 'estudios',
  };

  if (typeof filtro.tipo === 'string') {
    return TIPO[filtro.tipo] ?? filtro.tipo;
  }

  if (typeof filtro.max === 'number' && typeof filtro.moneda === 'string') {
    const simbolo = filtro.moneda === 'USD' ? 'US$' : '₡';
    const miles = Math.round(filtro.max)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `hasta ${simbolo}${miles}`;
  }

  if (typeof filtro.distancia === 'number') {
    return filtro.distancia >= 1000 ? `a ${filtro.distancia / 1000} km` : `a ${filtro.distancia} m`;
  }

  return 'esos filtros';
}
