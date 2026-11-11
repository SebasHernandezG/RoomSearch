# RoomSearch: plan de reestructuración

Fecha: 10 de noviembre de 2026. Estado: plan por etapas con la primera intervención de búsqueda y limpieza de ramas en curso. No equivale a una aplicación validada ni a una instalación de BMAD.

## 1. Producto y alcance

Confirmado por Jeff: habitaciones y apartamentos en alquiler; Ciudad Quesada, casco urbano y barrios cercanos; mobile first; extensible a otras ciudades; esta entrega es planificación y el código se hará después con Sol.

Objetivo del MVP: una persona encuentra una vivienda disponible dentro de su presupuesto, comprende su ubicación aproximada y contacta al anunciante; un anunciante publica y administra un anuncio que un moderador puede aprobar. La unidad de progreso es ese recorrido funcionando en un teléfono.

Incluye: búsqueda pública sin registro, precio y moneda, tipo, barrio, servicios esenciales, mapa/lista sincronizados, detalle con fotos, disponibilidad, contacto WhatsApp consentido por el anunciante, acceso, publicación guiada, mis anuncios, moderación y reporte de anuncio.

Fuera del MVP: pagos, reservas, contratos, matching de compañeros, chat interno, notificaciones de interés, rutas de navegación, aplicación nativa, mapas offline y expansión nacional. Se conserva el trabajo existente que corresponda, sin presentarlo como terminado ni borrarlo.

Éxito de piloto propuesto: cinco personas completan buscar → filtrar → abrir detalle → iniciar contacto sin ayuda; cuatro de cinco lo hacen en menos de tres minutos. Medir inicio de contacto, no afirmar que hubo conversación o alquiler. Datos ficticios identificados; anuncios reales solo con permiso del anunciante.

## 2. Decisiones de arquitectura

AD-01: conservar Laravel/PHP, React/TypeScript/Vite y MySQL 8.4. El historial ya contiene dominio, permisos, búsqueda espacial y pruebas. Cambiar simultáneamente stack, datos y UX aumentaría el trabajo sin demostrar mejora al usuario.

AD-02: monolito modular, una API y una base de datos. Mantener Properties, Identity y Platform; Interests queda fuera del MVP salvo el contacto existente. Reglas en backend/src, controladores/requests/resources en backend/app. No crear microservicios ni repositorios genéricos.

AD-03: reconstruir la experiencia de búsqueda por módulos y conservar el comportamiento comprobado del backend. Mantener la ruta actual mientras se construye /explorar con una bandera de configuración. Retirar la antigua únicamente después del gate de integración.

AD-04: nuestro mapa significa interfaz, marcadores, selección y reglas geográficas de RoomSearch. Mantener Leaflet para el primer MVP: cambiar el motor no resuelve por sí mismo las carreras de solicitudes, la cobertura ni la navegación. Encapsularlo en MapCanvas. Considerar un motor vectorial después si hay una necesidad concreta de estilo cartográfico o rendimiento demostrada por mediciones.

AD-05: separar territorio de lanzamiento de cámara y radio de búsqueda. Crear service_areas (slug, nombre, enabled, boundary_geojson, boundary_version) y relación property.service_area_id. La zona de lanzamiento requiere un polígono curado y revisado con barrios incluidos; no inventar que un radio de 1 km representa Ciudad Quesada. Ese radio aparece hoy en PantallaBusqueda.tsx y PropertyMap.tsx y debe dejar de definir cobertura.

AD-06: coordenada exacta privada; coordenada pública aproximada estable por anuncio. Lista, mapa, filtros espaciales públicos y distancias deben usar la misma representación pública para evitar inferir el punto exacto con consultas repetidas. La moderación y el dueño pueden consultar el punto exacto con autorización. No enviar dirección ni coordenadas privadas en respuestas públicas, telemetría o caché compartida.

AD-07: una aplicación web adaptable con despliegue del frontend y /api bajo el mismo origen. Documentar autenticación actual antes de modificarla. Si se adopta sesión Sanctum por cookie, migrar cliente y servidor juntos con CSRF, cookies seguras, expiración y pruebas; no mezclar dos modelos accidentalmente.

## 3. Estructura objetivo

frontend/src/app: router, proveedores, configuración, shell.
frontend/src/features/search: SearchPage, SearchFilters, ResultsList, SearchState, API de búsqueda.
frontend/src/features/map: MapCanvas, PriceMarker, selección, adaptación Leaflet.
frontend/src/features/listings: detalle, publicación, mis anuncios.
frontend/src/features/auth: acceso y recuperación.
frontend/src/features/moderation: cola y decisión.
frontend/src/shared: controles accesibles, cliente HTTP, formatos y tipos comunes.

backend/src/Properties: anuncios, políticas, ubicación pública, consultas y transiciones.
backend/src/Identity: usuarios y acceso.
backend/src/Platform: áreas de servicio, integración de almacenamiento y configuración operativa, evitando convertirlo en un contenedor de reglas de negocio.
backend/app/Http: transporte, validación y serialización.

Mover archivos por funcionalidad cuando se trabaje en ella, con imports y pruebas actualizados en el mismo PR. Evitar un PR masivo de renombrado junto con cambios de comportamiento.

## 4. Experiencia móvil

Pantalla principal: título Ciudad Quesada, búsqueda por barrio, precio y tipo visibles; lista con resultados útiles como entrada predeterminada y botón persistente Ver mapa. La lista funciona aunque falle el proveedor cartográfico. Propuesta de interacción pendiente de validación con usuarios, no preferencia ya confirmada.

Mapa: ocupa el espacio disponible, muestra precios con moneda y selección inequívoca; tarjeta inferior compacta al tocar un marcador. Un botón abre la lista completa. No exigir arrastres para acceder a contenido. Al desplazar el mapa mostrar Buscar en esta zona; ejecutar la consulta solo al confirmar. No recentrarlo después de cada respuesta.

Filtros: hoja modal con Aplicar y Limpiar. Estado temporal separado del filtro confirmado; cancelar descarta el borrador. Volver desde detalle conserva consulta, vista y posición. URL almacena filtros compartibles, área y región pública consultada; nunca posición privada de la persona.

Detalle: precio mensual y moneda, gastos incluidos, tipo, disponibilidad, fotos, barrio, ubicación aproximada explicada y acción Contactar. No mostrar insignias de verificación inexistentes. WhatsApp comunica que abre un servicio externo; el contacto debe estar habilitado por el anunciante.

Publicar: cuatro pasos (datos, ubicación, fotos, revisión), validación por paso, borrador recuperable con versión y resumen antes del envío. Sesión vencida permite volver al borrador. El servidor fija pendiente; editar contenido moderado exige una política explícita de nueva revisión. Mis anuncios presenta estado y motivo de rechazo.

Moderación: lista de pendientes, revisar detalle, aprobar/rechazar con motivo y registro de actor/fecha. Un anuncio oculto, rechazado o alquilado desaparece de búsqueda pública.

Diseño funcional: jerarquía precio → fotografía → barrio → condiciones, texto español claro, CRC por defecto; no sumar ni comparar monedas como si fueran iguales. Objetivos táctiles de 44 px, controles visibles con teclado, foco restaurado al cerrar modal, contraste WCAG AA, reducción de movimiento. Probar 360, 390 y 430 px de ancho y escritorio; teclado virtual, safe areas y orientación horizontal. La identidad visual final y sus tokens se fijan en la primera historia de interfaz, sin bloquear arquitectura.

## 5. Estado y contratos de búsqueda

Una única fuente de filtros aplicados. Estados: inicial, cargando, resultados, vacío, error y resultados anteriores con aviso. Cancelar solicitudes anteriores con AbortController y descartar respuestas cuyo identificador no sea el vigente. Un error nunca se presenta como cero viviendas.

Contrato propuesto, a formalizar como OpenAPI antes de implementar: GET /api/v1/service-areas; GET /api/v1/properties?area=ciudad-quesada&type=habitacion&currency=CRC&max_rent=200000&page=1; GET /api/v1/properties/map con los mismos filtros y bbox; GET /api/v1/properties/{id}. Mantener /api actual mientras migra el cliente. Es una propuesta, no rutas existentes.

Lista paginada, 20 por página, máximo 50. Mapa tiene contrato propio limitado, no representa solo la página visible de la lista. Si supera 200 puntos devolver agrupaciones o pedir acercar, indicando truncamiento; no omitir puntos silenciosamente. Selección une ambos por id. Validar bbox y área en servidor. Orden estable por criterio e id; conteo y mapa aplican el mismo conjunto de filtros.

Respuesta mínima: id, título, tipo, rent_amount, currency, neighborhood, availability, thumbnail, public_location y location_precision. Mapa usa solamente campos necesarios. Errores JSON con código, mensaje, errores por campo y request_id; 422 validación, 401 sesión, 403 permisos, 429 espera con Retry-After y 5xx reintento.

## 6. Proveedores y estabilidad

La cartografía de producción debe ser configurable por entorno y admitir sustitución. Antes de lanzamiento escoger un proveedor con condiciones, atribución, cobertura local y presupuesto comprobados. No hay proveedor contratado ni precio aprobado en esta entrega. El frontend debe poder mostrar lista cuando no cargan teselas.

No depender de un servicio público de geocodificación para autocompletar. MVP: catálogo curado de barrios y selección manual del pin por el anunciante. El servicio público de Nominatim prohíbe autocomplete y tiene límites específicos. Las teselas públicas OSM no ofrecen SLA ni permiten descarga masiva/offline. Fuentes consultadas: https://operations.osmfoundation.org/policies/tiles/ y https://operations.osmfoundation.org/policies/nominatim/ (10-11-2026).

Fotos: límites de cantidad/peso, validación de contenido, eliminación de EXIF, miniaturas, carga diferida y orden persistente. Almacenamiento privado para originales según necesidad y derivados públicos; contrato de borrado y copia de seguridad documentado.

Objetivos de validación, no métricas actuales: LCP <=2.5 s y CLS <=0.1 bajo perfil móvil acordado; API búsqueda p95 <=500 ms con 1,000 anuncios sintéticos y 20 usuarios concurrentes en staging, configuración registrada. Si fallan, medir SQL/payload/imágenes antes de añadir infraestructura. Evaluar INP con sesiones reales del piloto; una puntuación de laboratorio no demuestra el percentil de producción.

## 7. Ejecución y evidencia de progreso

Cada historia termina con demo reproducible, pruebas pertinentes y PR pequeño; no declarar un hito por cantidad de commits.

| Orden / historia | Trabajo | Dependencia | Aceptación / evidencia |
|---|---|---|---|
| S00 Base reproducible | Instalar desde lockfiles, levantar MySQL aislado, ejecutar CI y documentar arranque | Ninguna | Un clon limpio inicia; pruebas existentes y build pasan; fallos previos registrados |
| S01 Alcance geográfico | Curar barrios/polígono y service_area; estrategia de backfill | S00 | Dentro, fuera y borde probados; datos antiguos sin clasificación no se publican accidentalmente |
| S02 Contrato y privacidad | OpenAPI, consultas públicas, paginación y representación aproximada | S01 | JSON público sin coordenadas privadas; filtros coherentes; pruebas MySQL reales |
| S03 Flujo móvil de búsqueda | Shell, lista, filtros, URL y detalle mínimo con datos reales | S02 | Buscar/filtrar/volver a 360 px funciona con teclado y sin mapa |
| S04 Mapa propio de producto | MapCanvas, marcadores de precio, selección y Buscar en esta zona | S03 | Sin bucles ni respuestas antiguas; panning no borra selección sin explicación; fallo de tiles conserva lista |
| S05 Publicación completa | Acceso, borrador, fotos, validación y estados | S02, S03 | Anunciante crea desde teléfono, recupera borrador y no puede autoaprobar |
| S06 Moderación y contacto | Decisión auditada, reporte, WhatsApp consentido | S05, S04 | Publicar → aprobar → encontrar → contactar; rechazar/pausar elimina visibilidad |
| S07 Estabilidad | E2E, accesibilidad, rendimiento, fallos/red lenta, privacidad | S06 | Todos los recorridos críticos pasan; cero defectos bloqueantes abiertos |
| S08 Piloto y despliegue | Staging, backups/restauración, monitoreo, contenido consentido | S07 | Prueba de restauración y rollback; piloto de cinco personas; checklist firmado por responsable |

Estimación de planificación: 4–6 semanas con una persona de dedicación sostenida, recalibrar tras S00 y S03; no es promesa ni tiempo de ejecución de un agente. Dependencias externas y horas disponibles no están confirmadas. Cada historia puede dividirse en PRs de 0.5–2 jornadas, manteniendo una demo final del recorrido.

## 8. Estrategia de ramas y migración

Base: origin/main; nueva rama codex/roomsearch-mobile-plan para documentación y ramas cortas codex/<historia> al implementar. No fusionar todo el trabajo pendiente como requisito para empezar.

El 10 de noviembre de 2026 se cerraron #101–#105 y se eliminaron sus ramas remotas, además de `archivo/produccion`. GitHub quedó con `main` como única rama remota y ningún PR abierto. Sus commits están en el bundle local `../RoomSearch-branches-2026-11-10.bundle`, verificado con `git bundle verify`; copiarlo fuera de este equipo para respaldo duradero. Las funciones de interés/correo quedan fuera del MVP propuesto y solo se recuperarían mediante revisión selectiva.

Migraciones aditivas primero: área y ubicación pública inicialmente compatibles, backfill por lotes verificables, comparación de conteos, luego restricciones. No hacer migrate:fresh contra datos compartidos. Activar nueva búsqueda mediante bandera; volver al cliente anterior si aparece regresión. Cambios destructivos se posponen hasta respaldo y verificación del nuevo flujo.

## 9. Gate de calidad

Conservar CI existente: PHP 8.4, MySQL real, Pint, PHPUnit, auditoría Composer; frontend typecheck, Vitest, ESLint, Prettier y build. Añadir E2E solo a recorridos reales y comprobar también que el pipeline los ejecuta. Pruebas críticas: filtros por precio máximo únicamente, cero resultados, coordenadas invertidas, área límite, acceso de otro dueño, estado pendiente, respuesta tardía, 429, offline, login expirado y subida fallida.

Staging debe usar HTTPS, proxy configurado, secretos fuera del repo, storage persistente y base separada. Registrar errores con request_id sin mensajes privados ni direcciones exactas. Backup diario propuesto y restauración probada antes de piloto. Responsable de moderación, proveedor cartográfico, presupuesto, dominio y hosting siguen por asignar; bloquean lanzamiento, no las primeras historias.

## 10. BMAD y entrega a Sol

Esta carpeta es el paquete de planificación del proyecto existente: alcance → decisiones → historias → verificación. BMAD no está instalado y no se ejecutó un workflow oficial en esta sesión. Al integrarlo, fijar versión y mapear estos documentos a su formato; no generar un PRD paralelo contradictorio. Fuente del método: https://bmadcode.com/method.

Instrucción para Sol: leer este plan, README, backend/AGENTS.md completo y reglas aplicables. Empezar solo por S00. Confirmar estado Git y preservar cambios de terceros. Entregar una historia por vez con archivos cambiados, comandos ejecutados, resultado y limitaciones. No inventar barrios/polígonos, credenciales, precios ni resultados de pruebas. No contratar, desplegar o fusionar sin autorización correspondiente. Después de S00, implementar S01 y S02 antes de rediseñar la búsqueda.

## 11. Límites de esta evaluación

Se inspeccionaron fuentes de búsqueda/mapa, convenciones de API y módulos, workflow CI y el historial remoto descrito en la conversación. La ejecución CI 42958439856 pasó frontend (TypeScript, pruebas, lint, formato y build) y backend (Pint, pruebas sobre MySQL y auditoría Composer) tras actualizar el lockfile de Symfony. Docker Desktop local no respondió, pero la prueba nueva de backend sí corrió en CI. No se hizo una auditoría visual en dispositivo ni se validó el polígono de cobertura. No afirmar estabilidad, cobertura total, aprobación visual ni cumplimiento legal basándose en este documento.
