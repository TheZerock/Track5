# Requisitos del Sistema — Market Intelligence AI
> Extraído de las secciones 8, 9 y 10 del SRS v1.0  
> Fuente de verdad: [`docs/SRS_Market_Intelligence_AI.md`](./SRS_Market_Intelligence_AI.md)

---

## Requisitos Funcionales (RF)

| ID | Requisito | Prioridad | HU Relacionada |
|---|---|---|---|
| RF-001 | Mostrar noticias recientes de al menos dos fuentes (reales o de prueba), indicando fuente y fecha/hora. | Alta | HU-01 |
| RF-002 | Relacionar automáticamente cada noticia con uno o más instrumentos financieros. | Alta | HU-01 |
| RF-003 | Permitir filtrar noticias por tipo de instrumento, activo específico, sector económico y antigüedad. | Alta | HU-01 |
| RF-004 | Clasificar el impacto potencial de una noticia sobre un activo: Positivo / Negativo / Neutral / Incierto. | Alta | HU-02 |
| RF-005 | Calcular y mostrar un nivel de confianza (0–100) para cada señal generada. | Alta | HU-02 |
| RF-006 | Comparar el evento noticioso con el comportamiento histórico de precio del activo (datos reales o de prueba). | Alta | HU-02 |
| RF-007 | Mostrar la evidencia y las fuentes utilizadas para justificar cada señal. | Alta | HU-02 |
| RF-008 | Incluir en cada señal un disclaimer indicando que no constituye asesoría financiera ni garantiza resultados. | Alta | HU-02 |
| RF-009 | Generar un briefing por activo o watchlist, con noticia relacionada, movimiento asociado y acción de investigación sugerida. | Alta | HU-03 |
| RF-010 | Permitir marcar cada señal dentro de un briefing con estado: Revisada / Escalada / Descartada. | Alta | HU-03 |
| RF-011 | Permitir registrar la justificación/comentario del analista para cada señal revisada. | Alta | HU-03 |
| RF-012 | **NO** permitir la ejecución de compras/ventas; solo generar alertas o tareas de revisión humana. | **Crítica** | HU-03 |
| RF-013 | Mostrar un dashboard con noticias recientes, activos más impactados, señales generadas, alertas activas y tendencias de mercado. | Alta | Dashboard |
| RF-014 | Permitir crear, editar y eliminar alertas de seguimiento de activos. | Media | Alertas |
| RF-015 | Notificar en la interfaz cuando se generen señales relevantes para activos en alerta. | Media | Alertas |
| RF-016 | Permitir crear watchlists, agregar/quitar activos y generar briefings a partir de ellas. | Alta | Watchlists |
| RF-017 | Registrar en auditoría: usuario, acción, fecha/hora, estado anterior y estado nuevo, para toda acción relevante. | Alta | Transversal |
| RF-018 | Permitir autenticación basada en roles (Administrador, Analista, Supervisor, Invitado) mediante Supabase Auth. | Alta | Seguridad |
| RF-019 | Permitir al Administrador gestionar usuarios y asignar roles. | Media | Seguridad |
| RF-020 | Permitir al Supervisor aprobar o escalar briefings antes de que se compartan con un cliente. | Alta | HU-03 |
| RF-021 | Integrar módulo Gemini que reciba una noticia, identifique activos, analice sentimiento, determine impacto, calcule confianza, genere explicación y sugiera investigación. | **Crítica** | HU-02 / IA |
| RF-022 | Permitir consultar el historial de señales y briefings generados previamente. | Media | Transversal |
| RF-023 | Soportar datos ficticios/simulados en todas las integraciones externas para efectos de demostración. | Alta | HU-01 |
| RF-024 | Exponer una API REST documentada para las operaciones principales (noticias, señales, briefings, watchlists, alertas, auditoría). | Media | Transversal |

---

## Requisitos No Funcionales (RNF)

| ID | Requisito | Categoría |
|---|---|---|
| RNF-001 | Interfaz con diseño moderno tipo dashboard financiero, responsivo (desktop y tablet como mínimo). | Usabilidad |
| RNF-002 | Tiempo de respuesta para consultas de noticias/señales ya generadas ≤ 2 segundos en condiciones normales de demo. | Rendimiento |
| RNF-003 | Generación de una nueva señal vía Gemini ≤ 10 segundos en el 90% de los casos. | Rendimiento |
| RNF-004 | Acceso a datos protegido mediante políticas RLS en Supabase, restringiendo lectura/escritura por rol. | Seguridad |
| RNF-005 | Toda comunicación cliente-servidor debe realizarse sobre HTTPS. | Seguridad |
| RNF-006 | Registrar el 100% de las acciones críticas en auditoría (creación/edición de señales, cambios de estado, aprobaciones). | Trazabilidad |
| RNF-007 | Sistema modular: cualquier fuente de datos externa puede sustituirse o simularse sin afectar el flujo funcional. | Mantenibilidad |
| RNF-008 | Código con buenas prácticas de TypeScript (tipado estricto) y componentización en React. | Calidad de código |
| RNF-009 | Manejar errores de APIs externas (timeouts, límites de tasa) sin bloquear la UX; mostrar datos de prueba como fallback. | Disponibilidad |
| RNF-010 | Sistema desplegable y demostrable de extremo a extremo dentro de las 48 horas del hackathon. | Restricción de proyecto |
| RNF-011 | Toda salida de IA debe incluir disclaimer regulatorio y evidencias; evitar lenguaje imperativo de "comprar/vender". | Cumplimiento |
| RNF-012 | Modelo de datos escalable para soportar múltiples tipos de instrumentos financieros sin cambios estructurales mayores. | Escalabilidad |

---

## Reglas de Negocio (RN)

| ID | Regla | Impacto |
|---|---|---|
| RN-01 | **Ninguna señal o briefing generado por IA puede ejecutar automáticamente una operación financiera.** | Crítico — NUNCA violar |
| RN-02 | Toda señal debe incluir nivel de confianza, evidencia, fuentes y disclaimer; una señal sin estos elementos es **inválida** y no debe publicarse. | Alta |
| RN-03 | Un briefing solo puede considerarse "listo para cliente" después de ser aprobado por un Supervisor. | Alta |
| RN-04 | Cada cambio de estado de una señal (Revisada/Escalada/Descartada) debe quedar asociado a un usuario autenticado y a una justificación textual. | Alta |
| RN-05 | El rol Invitado tiene acceso exclusivamente de lectura; no puede crear watchlists, alertas ni modificar estados de señales. | Media |
| RN-06 | Las noticias sin fuente o fecha verificable no deben usarse para generar señales. | Alta |
| RN-07 | Toda acción relevante sobre entidades sensibles (señales, briefings, alertas, usuarios) debe generar un registro de auditoría **inmutable**. | Alta |
| RN-08 | Los datos simulados/de prueba deben estar claramente identificados como tales en la interfaz cuando se usen en lugar de fuentes reales. | Media |

---

## Matriz de Trazabilidad HU ↔ RF ↔ RNF ↔ RN

| Historia de Usuario | RF relacionados | RNF relacionados | RN relacionadas |
|---|---|---|---|
| **HU-01** — Radar de noticias y activos | RF-001, 002, 003, 023 | RNF-001, 002, 007, 009 | RN-06, RN-08 |
| **HU-02** — Señal explicable de impacto | RF-004, 005, 006, 007, 008, 021 | RNF-003, 011 | RN-01, RN-02 |
| **HU-03** — Briefing con revisión humana | RF-009, 010, 011, 012, 020 | RNF-006 | RN-01, 003, 004, 007 |
| Dashboard / Alertas / Watchlists | RF-013, 014, 015, 016 | RNF-001, 012 | RN-05 |
| Seguridad y Auditoría (transversal) | RF-017, 018, 019 | RNF-004, 005, 006 | RN-04, 005, 007 |
| Integración IA (transversal) | RF-021, 024 | RNF-003, 009, 011 | RN-01, 002, 006 |
