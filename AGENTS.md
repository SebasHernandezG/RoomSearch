# RoomSearch: instrucciones para agentes

- El alcance y las dependencias vigentes están en `docs/restructuring/PLAN.md`. Para ejecutar una historia, leerla y usar el rol correspondiente de `docs/restructuring/AGENT_ROLES.md`; no rehacer la auditoría completa.
- Leer `README.md`, los `AGENTS.md` aplicables y `backend/.ai/rules/index.md`. Cargar solo las reglas y skills pertinentes a los archivos de la tarea; las reglas de mapa también aplican al frontend.
- Una historia y un escritor de código a la vez. Preservar cambios ajenos, comprobar rama y diff antes de editar; no trabajar en `main`. Delegar solo tareas acotadas autorizadas, sin duplicar implementación ni revisión.
- Mobile y desktop son responsabilidad del mismo agente frontend y forman parte de la aceptación de cada historia de interfaz. No cerrar una historia solo con capturas móviles o build exitoso.
- Reutilizar evidencia válida para el mismo commit y entorno. Entregar archivos, comandos/resultados, limitaciones y siguiente paso; nunca presentar una prueba no ejecutada como aprobada.
- No cambiar alcance, autenticación o privacidad por comodidad. Escalar decisiones concretas según `AGENT_ROLES.md`. No instalar BMAD, contratar servicios, desplegar, hacer push o merge salvo autorización del usuario que cubra esa acción.

Estas son instrucciones reconocidas por Codex, no una configuración que cree agentes o seleccione modelos automáticamente. Los roles se activan con un encargo explícito.
