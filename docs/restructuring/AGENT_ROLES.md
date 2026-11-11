# Equipo mínimo de RoomSearch

Definido el 10-11-2026. El producto, arquitectura y aceptación funcional pertenecen a [PLAN.md](PLAN.md); este archivo define quién ejecuta y cómo entrega. Cuatro roles bajo demanda, no cuatro agentes ejecutándose permanentemente. No se necesita un agente separado para desktop, mapas visuales, DevOps o gestión de proyecto.

## Roles y modelos

Las asignaciones usan los modelos disponibles en esta sesión de Codex y son decisiones operativas, no afirmaciones de tarifas ni configuración automática. Seleccionar el modelo al iniciar/delegar el encargo; si no está disponible, informar la limitación sin sustituirlo silenciosamente.

| Rol | Modelo inicial | Propiedad y salida | Cuándo escalar |
| --- | --- | --- | --- |
| `architect` — producto y arquitectura | Astra (`gpt-6-astra`), razonamiento medio | Resolver únicamente decisiones que cambian alcance, contratos o seguridad. Entregar decisión breve, alternativa descartada, consecuencias y criterios comprobables; mantener PLAN como fuente única. | Alto solo si hay conflicto demostrado entre requisitos o riesgos de privacidad/migración. Jeff decide prioridades o hechos de negocio que faltan; no inventarlos. |
| `frontend` — móvil, desktop y mapa visual | Sol (`gpt-6.1-sol`), medio | Una interfaz adaptable y un estado compartido; búsqueda, detalle, publicación, moderación, accesibilidad, MapCanvas/Leaflet, selección y errores de red. Entregar código, pruebas pertinentes y evidencia responsive. | Sol alto para fallo reproducible complejo; Astra si exige alterar contrato, producto o representación pública de ubicación. |
| `backend_geo` — API, dominio y geodatos | Sol (`gpt-6.1-sol`), medio | Laravel/MySQL, permisos, publicación, moderación, OpenAPI, service_area, consultas espaciales y privacidad. Entregar contrato, implementación, migración reversible y pruebas MySQL. | Astra antes de cambiar privacidad, autenticación o política de migración, o si la cobertura carece de fuente verificable. No decide unilateralmente el polígono real. |
| `qa_release` — verificación y preparación de entrega | Luna (`gpt-6-luna`), medio | Ejecutar checks definidos, reproducir defectos, capturar evidencia y preparar checklist de release. Lectura/verificación por defecto; no reescribir el código que evalúa. | Sol en sesión separada para revisión semántica del diff, permisos, carreras, SQL y diagnóstico no mecánico. Astra solo ante conflicto arquitectónico. Un informe de Luna no sustituye esa revisión cuando el cambio toca esos riesgos. |

Frontend posee la cámara, marcadores y selección; backend_geo posee la cobertura, filtros espaciales y datos públicos. Ambos consumen el mismo contrato por id, moneda, filtros y ubicación pública. El modelo del rol puede cambiar entre encargos; no hace falta crear otro rol para escalar.

## Entrada y salida obligatorias

Cada encargo incluye: historia/subtarea y resultado buscado; commit y rama de partida; rutas que puede editar; contrato/decisión relevante; aceptación; comandos conocidos; límites (solo lectura o implementación). Pasar referencias y un resumen de hasta 15 líneas, no todo el historial del chat. Si faltan rutas, el agente localiza únicamente las necesarias antes de editar.

Cada entrega incluye: commit/base y archivos; qué criterio quedó satisfecho; comandos con resultado y entorno; evidencias o rutas de capturas; fallos previos separados de regresiones; bloqueos y siguiente encargo. Máximo orientativo 20 líneas, con logs extensos en artefactos solo cuando aporten diagnóstico. No crear un documento de estado por cada mensaje.

Estado por criterio: `verificado`, `falló`, `no ejecutado` o `bloqueado`. Un CI verde anterior solo vale para su commit. Una captura no demuestra teclado, privacidad, navegación ni comportamiento con red lenta.

## Secuencia y control de gasto

1. `backend_geo` ejecuta S00, incluyendo el arranque frontend y los checks existentes; `qa_release` verifica evidencia faltante. No convocar a Astra para repetir el plan.
2. `backend_geo` conduce S01 y S02. `architect` interviene solo en decisiones pendientes de cobertura/privacidad. Revisar el contrato antes de consumirlo en UI; fuentes geográficas sin validar quedan explícitamente bloqueadas.
3. `frontend` conduce S03 y S04 con mobile y desktop en el mismo PR. `backend_geo` interviene únicamente si falta una parte concreta del contrato.
4. S05 y S06 se dividen en entregas backend y frontend sucesivas con contratos acordados; un único escritor por ruta. `qa_release` verifica el recorrido integrado, no solo las partes.
5. `qa_release` conduce S07 y prepara S08; Sol revisa los riesgos técnicos del diff. Astra resuelve únicamente excepciones. Preparar staging, restauración y rollback no equivale a autorizar despliegue o merge.

Por defecto trabajar secuencialmente con un implementador. Abrir un segundo agente solo si tiene una tarea independiente, medible y sin archivos en conflicto; cerrarlo al entregar. Reutilizar el agente de la misma especialidad cuando conserve contexto útil. No lanzar rondas de opiniones ni hacer que todos lean todo el repositorio.

Después de dos intentos distintos sin resolver el mismo fallo, entregar reproducción, hipótesis descartadas y error concreto al nivel siguiente; no reiniciar una auditoría. Tras una corrección, repetir el check afectado y los gates obligatorios, sin ciclos redundantes de suites completas sobre un diff sin cambios.

## Aceptación por especialidad

- **Producto/arquitectura:** decisión compatible con PLAN o cambio explícito a él; alcance, dependencias y aceptación claros. Incertidumbre geográfica/comercial identificada y asignada.
- **Frontend:** recorridos afectados probados a 360, 390, 430, 1280 y 1440 px. Registrar navegador y qué anchos se ejecutaron; los pendientes no pasan. Sin overflow accidental; desktop tiene composición deliberada (lista y mapa simultáneos cuando corresponda), filtros y acciones legibles. Teclado/foco y vuelta desde detalle conservan estado. En móvil probar orientación y teclado virtual en flujos de entrada. Emulación no se presenta como prueba en teléfono real.
- **Mapa integrado:** filtros, conteo y selección coherentes entre lista/mapa; panning requiere confirmar nueva zona; no recentrado en bucle ni respuestas antiguas; fallo de teselas conserva lista; sin ubicación privada en URL, payload público o telemetría. Respetar los límites y truncamiento definidos en PLAN.
- **Backend/geodatos:** contrato documentado y consumidor compatible; autorización/estados, dentro-fuera-borde, paginación y privacidad probados en MySQL real. Migraciones/backfill con tratamiento explícito de datos antiguos y reversión documentada. No fabricar barrios ni geometrías de producción.
- **QA/release:** checks pertinentes de `.github/workflows/ci.yml`, aceptación de historia y defectos bloqueantes comprobados. Para S08: evidencia de staging, restore/rollback y responsables pendientes resueltos según PLAN. El responsable humano autoriza lanzamiento; no se sustituye por un “aprobado” del agente.

## Primer encargo listo para ejecutar

Asignar a `backend_geo` / Sol:

> Ejecuta solo S00 de docs/restructuring/PLAN.md. Lee AGENTS.md, README.md, backend/AGENTS.md y las reglas aplicables. Comprueba rama, HEAD y cambios locales; no sobrescribas trabajo ajeno ni cambies main. Usa un checkout aislado del commit de trabajo cuando haga falta demostrar instalación limpia. Identifica los comandos actuales en CI/manifiestos, instala desde lockfiles y levanta MySQL 8.4 en un entorno aislado sin tocar bases compartidas. Ejecuta checks backend/frontend y demuestra arranque del cliente y API. Registra en docs/restructuring/S00_EVIDENCE.md commit, versiones, comandos/resultados, fallos previos y pasos reproducibles sin secretos. Si Docker sigue sin responder, documenta el diagnóstico y completa las verificaciones independientes; no marques S00 cerrado ni sustituyas MySQL por SQLite. Limita cambios a documentación y correcciones mínimas de arranque necesarias para S00; no implementes S01, rediseño, nueva autenticación ni dependencias sin autorización aplicable. Entrega la evidencia a qa_release. Sin push, merge ni despliegue.

Después asignar a `qa_release` / Luna: contrastar esa evidencia con la aceptación S00 y verificar únicamente los huecos. Si requiere corregir código o diagnosticar un fallo complejo, devolver reproducción a Sol. No reejecutar todo si commit, entorno y evidencia siguen vigentes.

## Compatibilidad y fuente

[OpenAI Docs: Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex), consultado el 10-11-2026, confirma `AGENTS.md` como instrucciones persistentes reconocidas y distingue los documentos de workflow como convenciones opcionales. Por eso la entrada es el `AGENTS.md` de la raíz y este playbook se lee por referencia. No se creó una configuración TOML, skill, agente registrado ni proceso permanente; estos roles son encargos reutilizables compatibles con el flujo de Codex. No se instaló BMAD.
