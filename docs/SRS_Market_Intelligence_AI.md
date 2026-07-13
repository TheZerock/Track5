# Especificación de Requisitos de Software (SRS)
## Market Intelligence AI
### "Sistema Inteligente de Análisis de Mercado y Recomendaciones Informadas por Noticias mediante Agentes IA"

**Estándar de referencia:** IEEE 830 / IEEE 29148
**Track:** Track 5 — Hackathon de Agentes Financieros IA
**Versión:** 1.0
**Fecha:** Julio de 2026

---

## Tabla de Contenidos

1. Introducción
2. Propósito
3. Alcance
4. Definiciones y Acrónimos
5. Descripción General del Sistema
6. Actores del Sistema
7. Casos de Uso
8. Requisitos Funcionales
9. Requisitos No Funcionales
10. Reglas de Negocio
11. Arquitectura General
12. Arquitectura de IA
13. Integración con Gemini
14. Arquitectura Supabase
15. Modelo de Datos
16. Entidades y Relaciones
17. Diagramas UML (descripción textual)
18. Flujos de Usuario
19. Flujos de los Agentes IA
20. Gestión de Alertas
21. Gestión de Briefings
22. Seguridad y Permisos
23. Sistema de Auditoría
24. Mockups Detallados y Descripción de Interfaces
25. Criterios de Aceptación
26. Roadmap de Implementación
27. Riesgos del Proyecto
28. Matriz de Trazabilidad (Historias de Usuario ↔ Requisitos)
29. Historias de Usuario Completas
30. Diseño de API REST
31. Diseño de Edge Functions de Supabase

---

## 1. Introducción

Este documento especifica los requisitos funcionales y no funcionales del sistema **Market Intelligence AI**, una plataforma web que utiliza agentes de Inteligencia Artificial para transformar noticias financieras y económicas en señales explicables que apoyan la toma de decisiones de analistas e inversionistas. El documento sigue la estructura recomendada por los estándares IEEE 830 e IEEE 29148 para especificaciones de requisitos de software, adaptada al contexto de un producto desarrollado durante el Track 5 del Hackathon de Agentes Financieros IA.

El sistema se apoya en dos agentes de IA — el **Analista de Coyuntura de Mercados IA** y el **Asesor Financiero e Inversiones IA** — que colaboran para monitorear noticias, relacionarlas con activos financieros, generar señales de impacto explicables y producir briefings de mercado destinados a revisión humana.

## 2. Propósito

El propósito de este documento es:

- Establecer una especificación clara, verificable y trazable de los requisitos del sistema Market Intelligence AI para los equipos de desarrollo, diseño de producto y evaluadores del hackathon.
- Definir el alcance funcional mínimo exigido por el Track 5, así como las extensiones deseables.
- Servir de base para el diseño técnico (arquitectura, modelo de datos, API, agentes IA) y para la validación de aceptación del producto.
- Dejar establecido, de forma explícita, que el sistema **no ejecuta operaciones financieras, no recomienda compra/venta de instrumentos ni garantiza rendimientos**; toda salida sensible se limita a propuestas, alertas o solicitudes de aprobación sujetas a revisión humana.

Está dirigido a: desarrolladores frontend/backend, arquitectos de solución, diseñadores UX/UI, analistas financieros del equipo, mentores y jueces del hackathon.

## 3. Alcance

### 3.1 Qué incluye el sistema

Market Intelligence AI es una plataforma SPA (Single Page Application) que permite a analistas, inversionistas, supervisores y administradores:

- Consultar noticias financieras/económicas recientes, filtradas por instrumento, sector, activo y antigüedad (**HU-01**).
- Recibir señales explicables de impacto (positivo, negativo, neutral, incierto) generadas por IA a partir de noticias, con nivel de confianza, evidencia y comparación histórica (**HU-02**).
- Revisar briefings de mercado generados por IA sobre activos o watchlists, marcarlos como revisados/escalados/descartados y registrar justificación (**HU-03**).
- Gestionar watchlists, alertas y un dashboard consolidado de mercado.
- Auditar toda acción relevante realizada por usuarios y agentes IA.

### 3.2 Qué NO incluye el sistema

- Ejecución de órdenes de compra/venta en mercados reales o simulados de forma automática.
- Custodia de activos, conexión a brokers o pasarelas de trading.
- Asesoría financiera personalizada o garantía de rendimientos.
- Sustitución del juicio profesional humano: toda señal es una **propuesta** sujeta a revisión.

### 3.3 Contexto del hackathon

Se permite el uso de datos ficticios, archivos de prueba e integraciones simuladas con APIs externas (NewsAPI, CoinGecko, Alpha Vantage, Yahoo Finance RSS), siempre que el flujo funcional pueda demostrarse de extremo a extremo dentro de las 48 horas del hackathon.

## 4. Definiciones y Acrónimos

| Término | Definición |
|---|---|
| **SRS** | Software Requirements Specification (Especificación de Requisitos de Software) |
| **RF** | Requisito Funcional |
| **RNF** | Requisito No Funcional |
| **HU** | Historia de Usuario |
| **IA** | Inteligencia Artificial |
| **LLM** | Large Language Model (modelo de lenguaje extenso) |
| **RLS** | Row Level Security (seguridad a nivel de fila en PostgreSQL/Supabase) |
| **SPA** | Single Page Application |
| **Señal** | Salida generada por el Asesor Financiero e Inversiones IA que clasifica el posible impacto de una noticia sobre un activo |
| **Briefing** | Resumen consolidado de señales y noticias por activo o watchlist, destinado a revisión humana |
| **Watchlist** | Lista de seguimiento de activos financieros creada por un usuario |
| **Instrumento financiero** | Acción, criptoactivo, ETF, bono/instrumento de crédito, materia prima, divisa u otro activo negociable |
| **Feed de prueba** | Fuente de datos simulada usada para demostraciones cuando no hay integración real disponible |
| **Edge Function** | Función serverless ejecutada en la infraestructura de Supabase |
| **Confianza (confidence score)** | Valor numérico (0–100) que expresa la certeza estimada de una señal generada por IA |

## 5. Descripción General del Sistema

Market Intelligence AI es una plataforma tipo dashboard financiero que ingiere noticias de múltiples fuentes, las procesa mediante agentes de IA apoyados en la API de Google Gemini, y produce señales de impacto y briefings explicables para instrumentos financieros (acciones, criptoactivos, ETFs, bonos, commodities y divisas).

El sistema se compone de:

- **Frontend**: SPA en React + TypeScript + TailwindCSS con diseño de dashboard financiero profesional.
- **Backend**: Supabase (PostgreSQL, Auth basado en roles, Storage, Edge Functions).
- **Capa de IA**: Google Gemini API (2.5 Flash/Pro) orquestando dos agentes especializados.
- **Fuentes de datos externas**: NewsAPI, CoinGecko, Alpha Vantage, Yahoo Finance RSS (o equivalentes simulados).

El flujo de valor central es: **ingesta de noticias → clasificación y relación con activos (Agente 1) → generación de señal explicable (Agente 2) → consolidación en briefing → revisión humana → auditoría**.

## 6. Actores del Sistema

| Actor | Descripción |
|---|---|
| **Administrador** | Gestiona usuarios, roles, configuración de fuentes de datos y parámetros del sistema. |
| **Analista** | Revisa noticias, valida señales generadas por IA, gestiona watchlists y alertas. |
| **Supervisor** | Aprueba/escala briefings, revisa el trabajo de los analistas antes de compartir con clientes. |
| **Invitado** | Acceso de solo lectura a noticias, señales y briefings públicos/demostrativos. |
| **Analista de Coyuntura de Mercados IA** (agente) | Monitorea, clasifica y relaciona noticias con activos; detecta eventos y riesgos/oportunidades. |
| **Asesor Financiero e Inversiones IA** (agente) | Genera señales explicables, calcula confianza, compara con historial y produce briefings. |

## 7. Casos de Uso

| ID | Caso de Uso | Actor(es) principal(es) | Relacionado con |
|---|---|---|---|
| CU-01 | Consultar y filtrar noticias por activo/sector/antigüedad | Analista, Inversionista, Invitado | HU-01 |
| CU-02 | Visualizar señal explicable de una noticia | Analista, Inversionista | HU-02 |
| CU-03 | Generar briefing por activo o watchlist | Asesor Financiero IA, Analista | HU-03 |
| CU-04 | Revisar y marcar señal (Revisada/Escalada/Descartada) | Analista, Supervisor | HU-03 |
| CU-05 | Crear y gestionar watchlist | Analista, Inversionista | Watchlist |
| CU-06 | Crear y configurar alertas de seguimiento | Analista, Inversionista | Alertas |
| CU-07 | Aprobar/escalar briefing antes de compartir con cliente | Supervisor | HU-03 |
| CU-08 | Gestionar usuarios y roles | Administrador | Seguridad |
| CU-09 | Consultar historial de auditoría | Administrador, Supervisor | Auditoría |
| CU-10 | Ingesta automática de noticias desde fuentes externas | Analista de Coyuntura IA (sistema) | HU-01 |

### 7.1 Descripción narrativa — CU-02: Visualizar señal explicable

**Actor:** Analista / Inversionista
**Precondición:** Existe al menos una noticia procesada por el Agente 1.
**Flujo principal:**
1. El usuario selecciona una noticia desde el radar de noticias.
2. El sistema invoca al Asesor Financiero e Inversiones IA.
3. El agente clasifica el impacto (Positivo/Negativo/Neutral/Incierto), calcula el nivel de confianza y genera explicación con evidencia.
4. El sistema muestra la señal con fuentes, comparación histórica y disclaimer legal.
**Postcondición:** La señal queda disponible para revisión y, opcionalmente, para incorporarse a un briefing.

## 8. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-001 | El sistema debe mostrar noticias recientes provenientes de al menos dos fuentes (reales o de prueba), indicando fuente y fecha/hora. | Alta |
| RF-002 | El sistema debe relacionar automáticamente cada noticia con uno o más instrumentos financieros. | Alta |
| RF-003 | El sistema debe permitir filtrar noticias por tipo de instrumento, activo específico, sector económico y antigüedad. | Alta |
| RF-004 | El sistema debe clasificar el impacto potencial de una noticia sobre un activo como Positivo, Negativo, Neutral o Incierto. | Alta |
| RF-005 | El sistema debe calcular y mostrar un nivel de confianza (0–100) para cada señal generada. | Alta |
| RF-006 | El sistema debe comparar el evento noticioso con el comportamiento histórico de precio del activo (datos reales o de prueba). | Alta |
| RF-007 | El sistema debe mostrar la evidencia y las fuentes utilizadas para justificar cada señal. | Alta |
| RF-008 | El sistema debe incluir en cada señal un disclaimer indicando que no constituye asesoría financiera personalizada ni garantiza resultados. | Alta |
| RF-009 | El sistema debe generar un briefing por activo o por watchlist, incluyendo noticia relacionada, movimiento asociado y acción de investigación sugerida. | Alta |
| RF-010 | El sistema debe permitir marcar cada señal dentro de un briefing con estado: Revisada, Escalada o Descartada. | Alta |
| RF-011 | El sistema debe permitir registrar la justificación/comentario del analista para cada señal revisada. | Alta |
| RF-012 | El sistema NO debe permitir la ejecución de compras/ventas; solo debe generar alertas o tareas de revisión humana. | Crítica |
| RF-013 | El sistema debe mostrar un dashboard con noticias recientes, activos más impactados, señales generadas, alertas activas y tendencias de mercado. | Alta |
| RF-014 | El sistema debe permitir crear, editar y eliminar alertas de seguimiento de activos. | Media |
| RF-015 | El sistema debe notificar (en la interfaz o vía canal configurado) cuando se generen señales relevantes para activos en alerta. | Media |
| RF-016 | El sistema debe permitir crear watchlists, agregar/quitar activos y generar briefings a partir de ellas. | Alta |
| RF-017 | El sistema debe registrar en auditoría: usuario, acción, fecha/hora, estado anterior y estado nuevo, para toda acción relevante. | Alta |
| RF-018 | El sistema debe permitir autenticación basada en roles (Administrador, Analista, Supervisor, Invitado) mediante Supabase Auth. | Alta |
| RF-019 | El sistema debe permitir al Administrador gestionar usuarios y asignar roles. | Media |
| RF-020 | El sistema debe permitir al Supervisor aprobar o escalar briefings antes de que se consideren listos para compartir con un cliente. | Alta |
| RF-021 | El sistema debe integrar el módulo de IA (Gemini) que reciba una noticia, identifique activos relacionados, analice sentimiento, determine impacto, calcule confianza, genere explicación y sugiera investigación adicional. | Crítica |
| RF-022 | El sistema debe permitir consultar el historial de señales y briefings generados previamente. | Media |
| RF-023 | El sistema debe soportar datos ficticios/simulados en todas las integraciones externas para efectos de demostración. | Alta |
| RF-024 | El sistema debe exponer una API REST documentada para las operaciones principales (noticias, señales, briefings, watchlists, alertas, auditoría). | Media |

## 9. Requisitos No Funcionales

| ID | Requisito | Categoría |
|---|---|---|
| RNF-001 | La interfaz debe seguir un diseño moderno tipo dashboard financiero, responsivo (desktop y tablet como mínimo). | Usabilidad |
| RNF-002 | El tiempo de respuesta para consultas de noticias/señales ya generadas no debe superar 2 segundos en condiciones normales de demo. | Rendimiento |
| RNF-003 | La generación de una nueva señal vía Gemini no debe superar 10 segundos en el 90% de los casos. | Rendimiento |
| RNF-004 | El acceso a los datos debe estar protegido mediante políticas RLS en Supabase, restringiendo lectura/escritura según el rol del usuario. | Seguridad |
| RNF-005 | Toda comunicación cliente-servidor debe realizarse sobre HTTPS. | Seguridad |
| RNF-006 | El sistema debe registrar el 100% de las acciones críticas (creación/edición de señales, cambios de estado, aprobaciones) en auditoría. | Trazabilidad |
| RNF-007 | El sistema debe ser modular, permitiendo sustituir o simular cualquier fuente de datos externa sin afectar el flujo funcional. | Mantenibilidad |
| RNF-008 | El código debe seguir buenas prácticas de TypeScript (tipado estricto) y componentización en React. | Calidad de código |
| RNF-009 | El sistema debe manejar errores de las APIs externas (timeouts, límites de tasa) sin bloquear la experiencia del usuario, mostrando datos de prueba como respaldo (fallback). | Disponibilidad |
| RNF-010 | El sistema debe ser desplegable y demostrable de extremo a extremo dentro de las 48 horas del hackathon. | Restricción de proyecto |
| RNF-011 | Toda salida generada por IA debe incluir explícitamente el disclaimer regulatorio y evidencias, evitando lenguaje imperativo de "comprar/vender". | Cumplimiento |
| RNF-012 | El sistema debe ser escalable en su modelo de datos para soportar múltiples tipos de instrumentos financieros sin cambios estructurales mayores. | Escalabilidad |

## 10. Reglas de Negocio

| ID | Regla |
|---|---|
| RN-01 | Ninguna señal o briefing generado por IA puede ejecutar automáticamente una operación financiera. |
| RN-02 | Toda señal debe incluir nivel de confianza, evidencia, fuentes y disclaimer; una señal sin estos elementos se considera inválida y no debe publicarse. |
| RN-03 | Un briefing solo puede considerarse "listo para cliente" después de ser aprobado por un Supervisor. |
| RN-04 | Cada cambio de estado de una señal (Revisada/Escalada/Descartada) debe quedar asociado a un usuario autenticado y a una justificación textual. |
| RN-05 | El rol Invitado tiene acceso exclusivamente de lectura; no puede crear watchlists, alertas ni modificar estados de señales. |
| RN-06 | Las noticias sin fuente o fecha verificable no deben usarse para generar señales. |
| RN-07 | Toda acción relevante sobre entidades sensibles (señales, briefings, alertas, usuarios) debe generar un registro de auditoría inmutable. |
| RN-08 | Los datos simulados/de prueba deben estar claramente identificados como tales en la interfaz cuando se usen en lugar de fuentes reales. |

## 11. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA)                        │
│         React + TypeScript + TailwindCSS                     │
│  Dashboard | Radar de Noticias | Señales | Briefings |        │
│  Watchlists | Alertas | Auditoría | Administración            │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS / REST / Supabase Client SDK
┌───────────────────────────▼───────────────────────────────────┐
│                         BACKEND (Supabase)                    │
│  Supabase Auth (roles) │ PostgreSQL │ Storage │ Edge Functions │
└───────────────────────────┬───────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────────┐
        ▼                   ▼                       ▼
┌───────────────┐   ┌───────────────────┐   ┌────────────────────┐
│ Fuentes de     │   │  Capa de IA        │   │ Servicios externos │
│ Noticias:      │──▶│  Google Gemini API │──▶│ (simulados o reales│
│ NewsAPI, Yahoo │   │  Agente 1 y Agente2│   │ según disponibi-   │
│ RSS            │   │                    │   │ lidad)             │
└───────────────┘   └───────────────────┘   └────────────────────┘
        ▲
        │
┌───────────────┐
│ Datos de mercado│
│ CoinGecko,      │
│ Alpha Vantage   │
└───────────────┘
```

**Capas:**
1. **Presentación**: SPA React consumiendo Supabase (Auth + PostgREST) y Edge Functions.
2. **Aplicación/Orquestación**: Edge Functions de Supabase que orquestan llamadas a Gemini y a APIs externas.
3. **Datos**: PostgreSQL con RLS, Storage para adjuntos (ej. capturas de evidencia).
4. **IA**: Módulo de agentes sobre Gemini API.
5. **Integraciones externas**: NewsAPI, CoinGecko, Alpha Vantage, Yahoo Finance RSS (o mocks).

## 12. Arquitectura de IA

El sistema implementa dos agentes especializados que operan de forma secuencial/colaborativa:

### 12.1 Agente 1 — Analista de Coyuntura de Mercados IA
- **Entrada**: noticias crudas desde fuentes externas o feeds de prueba.
- **Procesamiento**: clasificación por sector, extracción de entidades (activos mencionados), detección de eventos macro/microeconómicos, identificación preliminar de riesgos/oportunidades.
- **Salida**: noticia enriquecida con metadatos (sector, activos relacionados, tipo de evento).

### 12.2 Agente 2 — Asesor Financiero e Inversiones IA
- **Entrada**: noticia enriquecida por el Agente 1 + datos históricos de precio (reales o de prueba).
- **Procesamiento**: análisis de sentimiento, determinación de impacto, cálculo de confianza, comparación histórica, generación de explicación basada en evidencia y sugerencia de investigación adicional.
- **Salida**: objeto "señal" estructurado (ver sección 13) y contribución a briefings consolidados.
- **Restricción dura**: el agente nunca genera instrucciones de compra/venta; su salida se limita a clasificación, explicación y sugerencia de investigación.

### 12.3 Orquestación
Ambos agentes se ejecutan como Edge Functions de Supabase que invocan la API de Gemini de forma secuencial (Agente 1 → Agente 2), persistiendo resultados intermedios en PostgreSQL para trazabilidad y reprocesamiento.

## 13. Integración con Gemini

El módulo de IA debe:

1. Recibir una noticia (texto, fuente, fecha).
2. Identificar los activos financieros relacionados.
3. Analizar el sentimiento del contenido.
4. Determinar el impacto (Positivo/Negativo/Neutral/Incierto).
5. Calcular un nivel de confianza (0–100).
6. Generar una explicación basada en evidencia (citando la noticia y datos históricos disponibles).
7. Sugerir investigaciones adicionales para el analista.

**Formato de salida esperado (JSON estructurado):**

```json
{
  "activo": "BTC",
  "impacto": "Positivo",
  "confianza": 85,
  "explicacion": "El aumento de inversión institucional suele impulsar la demanda.",
  "riesgos": "Volatilidad del mercado.",
  "investigacion_sugerida": "Analizar volumen institucional."
}
```

**Consideraciones técnicas:**
- Uso de modelos Gemini 2.5 Flash (para clasificación rápida/alto volumen) o Gemini 2.5 Pro (para análisis más profundos de briefings).
- Prompts con salida forzada en JSON, validados con un esquema (schema validation) antes de persistir en base de datos.
- Manejo de reintentos y fallback a mensajes "Incierto / confianza baja" si la API falla o la respuesta no es parseable.
- El prompt del sistema debe incluir explícitamente la restricción de no recomendar compra/venta ni garantizar rendimientos.

## 14. Arquitectura Supabase

- **Supabase Auth**: autenticación por email/password (mínimo viable para el hackathon), con roles gestionados mediante una tabla `roles` y relación `users`–`roles`.
- **PostgreSQL**: base de datos relacional principal (ver sección 15).
- **Row Level Security (RLS)**: políticas por tabla que restringen lectura/escritura según el rol del usuario autenticado (ver sección 22).
- **Storage**: almacenamiento de evidencias adjuntas (capturas de gráficos, PDFs de referencia) asociadas a señales o briefings.
- **Edge Functions**: lógica de orquestación de agentes IA, integración con APIs externas y procesos de ingesta de noticias.

## 15. Modelo de Datos

### 15.1 Modelo Entidad-Relación (descripción textual)

- **users** (1) — (1) **roles**: cada usuario tiene un rol asignado.
- **users** (1) — (N) **watchlists**: un usuario puede crear varias watchlists.
- **watchlists** (1) — (N) **watchlist_assets** (N) — (1) **assets**: relación muchos-a-muchos entre watchlists y activos, resuelta mediante tabla intermedia.
- **news** (N) — (N) **assets**: una noticia puede relacionarse con varios activos y viceversa (tabla intermedia `news_assets`, implícita en `signals`).
- **news** (1) — (N) **signals**: una noticia puede generar una o más señales (una por activo relacionado).
- **assets** (1) — (N) **signals**: un activo puede tener múltiples señales a lo largo del tiempo.
- **signals** (N) — (1) **briefings**: varias señales pueden agruparse dentro de un briefing.
- **users** (1) — (N) **briefings**: un analista/supervisor genera o revisa briefings.
- **assets** (1) — (N) **alerts**: un activo puede tener múltiples alertas configuradas.
- **users** (1) — (N) **alerts**: un usuario configura sus propias alertas.
- **users** (1) — (N) **audit_logs**: toda acción queda asociada a un usuario (o al agente IA como actor de sistema).

## 16. Entidades y Relaciones

### 16.1 Tabla `users`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador único (vinculado a Supabase Auth) |
| email | text | Correo del usuario |
| full_name | text | Nombre completo |
| role_id | uuid (FK → roles.id) | Rol asignado |
| created_at | timestamptz | Fecha de creación |

### 16.2 Tabla `roles`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| name | text | Administrador / Analista / Supervisor / Invitado |
| description | text | Descripción del rol |

### 16.3 Tabla `news`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| title | text | Titular de la noticia |
| content | text | Cuerpo/resumen de la noticia |
| source | text | Fuente (NewsAPI, Yahoo RSS, feed de prueba, etc.) |
| published_at | timestamptz | Fecha/hora de publicación |
| sector | text | Sector económico clasificado |
| is_test_data | boolean | Indica si es dato simulado |
| created_at | timestamptz | Fecha de ingesta |

### 16.4 Tabla `assets`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| symbol | text | Símbolo/ticker (ej. BTC, AAPL) |
| name | text | Nombre del instrumento |
| type | text | Acción / Cripto / ETF / Bono / Commodity / Divisa / Otro |
| sector | text | Sector económico asociado |

### 16.5 Tabla `signals`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| news_id | uuid (FK → news.id) | Noticia origen |
| asset_id | uuid (FK → assets.id) | Activo relacionado |
| impact | text | Positivo / Negativo / Neutral / Incierto |
| confidence | integer | Nivel de confianza (0–100) |
| explanation | text | Explicación generada por IA |
| risks | text | Riesgos identificados |
| suggested_research | text | Investigación adicional sugerida |
| historical_comparison | jsonb | Datos de comparación histórica |
| status | text | Pendiente / Revisada / Escalada / Descartada |
| reviewed_by | uuid (FK → users.id) | Usuario que revisó |
| review_comment | text | Justificación del analista |
| created_at | timestamptz | Fecha de generación |

### 16.6 Tabla `briefings`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| title | text | Título del briefing |
| watchlist_id | uuid (FK → watchlists.id, nullable) | Watchlist asociada (opcional) |
| asset_id | uuid (FK → assets.id, nullable) | Activo asociado (opcional) |
| status | text | Borrador / En revisión / Aprobado / Escalado |
| created_by | uuid (FK → users.id) | Analista que generó el briefing |
| approved_by | uuid (FK → users.id, nullable) | Supervisor que aprobó |
| created_at | timestamptz | Fecha de creación |

### 16.7 Tabla `watchlists`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| user_id | uuid (FK → users.id) | Propietario |
| name | text | Nombre de la lista |
| created_at | timestamptz | Fecha de creación |

### 16.8 Tabla `watchlist_assets`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| watchlist_id | uuid (FK → watchlists.id) | Watchlist |
| asset_id | uuid (FK → assets.id) | Activo |

### 16.9 Tabla `alerts`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| user_id | uuid (FK → users.id) | Propietario de la alerta |
| asset_id | uuid (FK → assets.id) | Activo monitoreado |
| condition | text | Condición (ej. nueva señal, umbral de confianza) |
| is_active | boolean | Estado de la alerta |
| created_at | timestamptz | Fecha de creación |

### 16.10 Tabla `audit_logs`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid (PK) | Identificador |
| user_id | uuid (FK → users.id, nullable) | Usuario que ejecutó la acción (null si fue el agente IA) |
| action | text | Acción realizada (ej. "signal.status_change") |
| entity | text | Entidad afectada (signals, briefings, alerts, etc.) |
| entity_id | uuid | Identificador de la entidad afectada |
| previous_state | jsonb | Estado anterior |
| new_state | jsonb | Estado nuevo |
| created_at | timestamptz | Fecha/hora del evento |

### 16.11 Índices recomendados

- `news(published_at)`, `news(sector)`, `news(source)`
- `signals(asset_id)`, `signals(news_id)`, `signals(status)`, `signals(created_at)`
- `assets(symbol)` único
- `watchlist_assets(watchlist_id, asset_id)` único compuesto
- `alerts(user_id, asset_id)`
- `audit_logs(entity, entity_id)`, `audit_logs(created_at)`

## 17. Diagramas UML (descripción textual)

### 17.1 Diagrama de Casos de Uso
Actores (Administrador, Analista, Supervisor, Invitado, Agente IA) conectados a los casos de uso CU-01 a CU-10 descritos en la sección 7, con relaciones `<<include>>` entre CU-02 (Ver señal) y CU-10 (Ingesta de noticias), y `<<extend>>` entre CU-04 (Revisar señal) y CU-07 (Aprobar briefing).

### 17.2 Diagrama de Secuencia — Generación de señal
`Usuario → Frontend → Edge Function (orquestador) → Agente 1 (Gemini) → Agente 2 (Gemini) → PostgreSQL (persistencia) → Frontend (renderizado de señal)`.

### 17.3 Diagrama de Clases (simplificado)
Clases: `User`, `Role`, `News`, `Asset`, `Signal`, `Briefing`, `Watchlist`, `Alert`, `AuditLog`, con relaciones de asociación y composición equivalentes al modelo entidad-relación de la sección 15.

### 17.4 Diagrama de Estados — Ciclo de vida de una Señal
`Pendiente → Revisada → (Escalada | Descartada)`, con transición adicional `Escalada → Incluida en briefing aprobado`.

## 18. Flujos de Usuario

### 18.1 Flujo — Consulta de noticias (HU-01)
1. El usuario ingresa al Radar de Noticias.
2. Aplica filtros (instrumento, activo, sector, antigüedad).
3. El sistema muestra noticias con fuente y fecha, relacionadas a instrumentos.
4. El usuario selecciona una noticia para ver detalle y señal asociada.

### 18.2 Flujo — Revisión de señal (HU-02)
1. El usuario abre una noticia o accede desde el dashboard.
2. Visualiza la señal: impacto, confianza, evidencia, comparación histórica, disclaimer.
3. Opcionalmente, agrega la señal a un briefing o watchlist.

### 18.3 Flujo — Briefing con revisión humana (HU-03)
1. El analista genera un briefing por activo o watchlist.
2. Revisa cada señal incluida y la marca como Revisada, Escalada o Descartada, con justificación.
3. El supervisor revisa el briefing consolidado y lo aprueba o lo devuelve.
4. El sistema registra cada cambio de estado en auditoría.

## 19. Flujos de los Agentes IA

1. **Ingesta**: el sistema obtiene noticias nuevas (programada o bajo demanda) desde fuentes configuradas.
2. **Agente 1 (Analista de Coyuntura)**: clasifica sector, detecta activos mencionados, identifica tipo de evento y riesgos/oportunidades preliminares; persiste noticia enriquecida.
3. **Agente 2 (Asesor Financiero)**: para cada relación noticia-activo, genera una señal con impacto, confianza, explicación, riesgos e investigación sugerida; persiste en `signals`.
4. **Consolidación**: cuando se solicita un briefing, el sistema agrupa señales relevantes por activo/watchlist y genera un resumen ejecutivo (usando Gemini nuevamente o agregación programática).
5. **Notificación**: si existen alertas configuradas que coincidan con las nuevas señales, el sistema las dispara.

## 20. Gestión de Alertas

- Los usuarios (Analista/Inversionista) pueden crear alertas asociadas a un activo específico, con una condición (ej. "nueva señal generada", "confianza mayor a X%", "impacto negativo detectado").
- Las alertas activas se muestran en el dashboard principal.
- Al generarse una señal que cumpla la condición de una alerta activa, el sistema crea una notificación visible en la interfaz (y, opcionalmente, mediante un canal adicional simulado como email/webhook de prueba).
- Las alertas pueden activarse/desactivarse sin eliminarse, preservando el historial.

## 21. Gestión de Briefings

- Un briefing se genera a partir de una watchlist o de un activo individual, agrupando las señales relevantes en un rango de tiempo.
- Cada señal dentro del briefing puede marcarse individualmente como Revisada, Escalada o Descartada, con comentario obligatorio del analista.
- El briefing en su conjunto tiene un estado propio: Borrador → En revisión → Aprobado/Escalado.
- Solo un Supervisor puede mover un briefing a estado "Aprobado", habilitándolo conceptualmente para compartir con un cliente (fuera del alcance técnico del envío real).
- Ninguna acción de briefing ejecuta operaciones de compra/venta; el resultado siempre es informativo o una tarea de seguimiento.

## 22. Seguridad y Permisos

### 22.1 Matriz de permisos por rol

| Recurso / Acción | Administrador | Analista | Supervisor | Invitado |
|---|---|---|---|---|
| Ver noticias/señales | ✅ | ✅ | ✅ | ✅ |
| Crear/editar watchlists propias | ✅ | ✅ | ✅ | ❌ |
| Crear/editar alertas propias | ✅ | ✅ | ✅ | ❌ |
| Cambiar estado de señal | ✅ | ✅ | ✅ | ❌ |
| Generar briefing | ✅ | ✅ | ✅ | ❌ |
| Aprobar/escalar briefing | ✅ | ❌ | ✅ | ❌ |
| Gestionar usuarios y roles | ✅ | ❌ | ❌ | ❌ |
| Ver auditoría completa | ✅ | ❌ (solo propia) | ✅ | ❌ |

### 22.2 Políticas RLS (ejemplos representativos)

```sql
-- Lectura de noticias: abierta a cualquier usuario autenticado
create policy "news_select_all_authenticated"
on news for select
using (auth.role() = 'authenticated');

-- Watchlists: solo el propietario puede leer/escribir
create policy "watchlists_owner_only"
on watchlists for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Señales: escritura de estado solo para Analista/Supervisor/Administrador
create policy "signals_update_review_roles"
on signals for update
using (
  exists (
    select 1 from users u
    join roles r on u.role_id = r.id
    where u.id = auth.uid()
      and r.name in ('Administrador','Analista','Supervisor')
  )
);

-- Auditoría: solo lectura para Administrador y Supervisor
create policy "audit_logs_select_admin_supervisor"
on audit_logs for select
using (
  exists (
    select 1 from users u
    join roles r on u.role_id = r.id
    where u.id = auth.uid()
      and r.name in ('Administrador','Supervisor')
  )
);
```

## 23. Sistema de Auditoría

Cada acción relevante genera un registro en `audit_logs` con:
- **Usuario** que ejecutó la acción (o `null`/actor "sistema-IA" cuando la acción proviene de un agente).
- **Acción realizada** (ej. `signal.status_change`, `briefing.approve`, `alert.create`).
- **Fecha y hora** del evento.
- **Estado anterior** y **estado nuevo** en formato JSON.

Los registros de auditoría son **inmutables** (no editables ni eliminables desde la aplicación) y accesibles según la matriz de permisos de la sección 22.1.

## 24. Mockups Detallados y Descripción de Interfaces

### 24.1 Dashboard Principal
- Encabezado con navegación (Dashboard, Radar de Noticias, Señales, Briefings, Watchlists, Alertas, Auditoría, Administración).
- Panel de tarjetas KPI: total de noticias del día, señales generadas, alertas activas, briefings pendientes de aprobación.
- Tabla/lista de "Activos más impactados" (ordenados por magnitud de señal y confianza).
- Gráfico de tendencias de mercado (por sector o tipo de instrumento).
- Feed lateral de noticias recientes con badges de impacto.

### 24.2 Radar de Noticias
- Barra de filtros: tipo de instrumento, activo, sector, antigüedad.
- Lista de tarjetas de noticia: título, fuente, fecha, activos relacionados (chips), badge de impacto preliminar.
- Vista de detalle al hacer clic: contenido completo, señal asociada, botón "Agregar a watchlist/briefing".

### 24.3 Detalle de Señal
- Encabezado con activo, tipo de instrumento e impacto (color codificado: verde/rojo/gris/amarillo).
- Medidor de confianza (0–100%).
- Sección "Evidencia y fuentes" con enlaces/citas.
- Gráfico comparativo con comportamiento histórico.
- Disclaimer fijo en la parte inferior.
- Acciones: Marcar como Revisada / Escalada / Descartada + campo de comentario.

### 24.4 Briefing
- Encabezado: activo o watchlist, rango de fechas, estado del briefing.
- Lista de señales incluidas, cada una con su estado individual.
- Resumen ejecutivo generado por IA.
- Botones de acción según rol: "Enviar a revisión" (Analista), "Aprobar" / "Devolver" (Supervisor).

### 24.5 Watchlists y Alertas
- Vista de tarjetas por watchlist, con lista de activos y botón "Generar briefing".
- Formulario de creación de alerta: activo, condición, estado (activa/inactiva).

### 24.6 Auditoría (Administrador/Supervisor)
- Tabla filtrable por usuario, entidad, rango de fechas.
- Detalle expandible mostrando `previous_state` vs `new_state` en formato comparativo.

## 25. Criterios de Aceptación

Consolidado de criterios mínimos exigidos por el Track 5 (deben cumplirse íntegramente):

**HU-01 — Radar de noticias y activos**
- Muestra noticias recientes de al menos dos fuentes (reales o de prueba) con fuente y fecha.
- Relaciona cada noticia con uno o más instrumentos financieros.
- Permite filtrar por tipo de instrumento, activo específico, sector económico y antigüedad.

**HU-02 — Señal explicable de impacto**
- Clasifica el impacto como Positivo, Negativo, Neutral o Incierto, con nivel de confianza.
- Compara el evento con el comportamiento histórico (datos reales o de prueba).
- Muestra evidencia y fuentes consultadas.
- Incluye disclaimer de que no constituye asesoría financiera personalizada ni garantiza resultados.

**HU-03 — Briefing con revisión humana**
- Genera resumen por activo o watchlist con noticia, movimiento asociado y acción de investigación sugerida.
- Permite marcar cada señal como Revisada, Escalada o Descartada, guardando la justificación.
- No ejecuta compras/ventas: solo crea alertas o tareas para revisión humana.

## 26. Roadmap de Implementación

| Fase | Duración estimada | Entregables |
|---|---|---|
| **Fase 0 — Setup** | 2–3 h | Repositorio, proyecto Supabase, esquema inicial de BD, autenticación básica |
| **Fase 1 — Ingesta y radar de noticias (HU-01)** | 6–8 h | Tablas `news`/`assets`, Edge Function de ingesta, UI Radar de Noticias con filtros |
| **Fase 2 — Integración Gemini y señales (HU-02)** | 8–10 h | Edge Functions Agente 1 y Agente 2, tabla `signals`, UI detalle de señal |
| **Fase 3 — Briefings y revisión humana (HU-03)** | 6–8 h | Tabla `briefings`, flujo de revisión/aprobación, UI de briefing |
| **Fase 4 — Watchlists, alertas y dashboard** | 6–8 h | Tablas `watchlists`, `watchlist_assets`, `alerts`, dashboard consolidado |
| **Fase 5 — Seguridad, auditoría y roles** | 4–6 h | Políticas RLS, tabla `audit_logs`, gestión de usuarios/roles |
| **Fase 6 — Pulido, pruebas y demo** | 4–6 h | Datos de prueba, ajustes UI/UX, guion de demostración |

**Total estimado:** ~40–48 horas, ajustable según tamaño del equipo y paralelización de tareas frontend/backend/IA.

## 27. Riesgos del Proyecto

| ID | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-01 | Límites de tasa o caídas de APIs externas (NewsAPI, Alpha Vantage, etc.) | Medio | Uso de feeds/datos de prueba como fallback (RNF-009) |
| R-02 | Latencia o costos de la API de Gemini durante la demo | Medio | Cacheo de resultados, uso de Gemini Flash para operaciones frecuentes |
| R-03 | Respuestas de Gemini no conformes al esquema JSON esperado | Alto | Validación de esquema y manejo de reintentos/fallback a "Incierto" |
| R-04 | Tiempo insuficiente para implementar RLS completas | Alto | Priorizar políticas mínimas viables por rol desde el inicio (Fase 0) |
| R-05 | Confusión de alcance: el equipo intenta ejecutar operaciones reales | Crítico | Reforzar regla de negocio RN-01 en diseño, UI y prompts de IA |
| R-06 | Sobrecarga de alcance (scope creep) más allá del mínimo del track | Medio | Congelar alcance mínimo (HU-01 a HU-03) antes de añadir extras |
| R-07 | Datos históricos de precio no disponibles a tiempo | Medio | Usar series de datos simuladas versionadas en el repositorio |

## 28. Matriz de Trazabilidad (Historias de Usuario ↔ Requisitos)

| Historia de Usuario | Requisitos Funcionales | Requisitos No Funcionales | Reglas de Negocio |
|---|---|---|---|
| **HU-01** — Radar de noticias y activos | RF-001, RF-002, RF-003, RF-023 | RNF-001, RNF-002, RNF-007, RNF-009 | RN-06, RN-08 |
| **HU-02** — Señal explicable de impacto | RF-004, RF-005, RF-006, RF-007, RF-008, RF-021 | RNF-003, RNF-011 | RN-01, RN-02 |
| **HU-03** — Briefing con revisión humana | RF-009, RF-010, RF-011, RF-012, RF-020 | RNF-006 | RN-01, RN-03, RN-04, RN-07 |
| Dashboard / Alertas / Watchlists (soporte) | RF-013, RF-014, RF-015, RF-016 | RNF-001, RNF-012 | RN-05 |
| Seguridad y Auditoría (transversal) | RF-017, RF-018, RF-019 | RNF-004, RNF-005, RNF-006 | RN-04, RN-05, RN-07 |
| Integración IA (transversal) | RF-021, RF-024 | RNF-003, RNF-009, RNF-011 | RN-01, RN-02, RN-06 |

## 29. Historias de Usuario Completas

### HU-01: Radar de Noticias y Activos
**Como** analista o inversionista
**Quiero** consultar noticias recientes por activo, sector o tema macroeconómico
**Para** identificar eventos que puedan afectar instrumentos financieros relevantes.

**Criterios de aceptación:**
- Mostrar noticias recientes provenientes de al menos dos fuentes confiables o feeds de prueba, con fuente y fecha/hora.
- Relacionar cada noticia con uno o más instrumentos financieros.
- Filtrar por tipo de instrumento, activo específico, sector económico y antigüedad de la noticia.

### HU-02: Señal Explicable de Impacto
**Como** persona que analiza oportunidades de mercado
**Quiero** recibir una señal sobre el posible impacto de una noticia
**Para** priorizar qué investigar antes de tomar una decisión.

**Criterios de aceptación:**
- Clasificar el impacto como Positivo, Negativo, Neutral o Incierto.
- Mostrar el nivel de confianza de la señal.
- Comparar el evento con el movimiento de precio o comportamiento histórico (datos reales o de prueba).
- Mostrar la evidencia y las fuentes utilizadas.
- Incluir un disclaimer indicando que no constituye asesoría financiera personalizada ni garantiza resultados.

### HU-03: Briefing de Mercado con Revisión Humana
**Como** asesor de inversiones o analista de mercado
**Quiero** revisar un briefing generado por IA con noticias, movimientos y acciones de investigación sugeridas
**Para** validar el análisis antes de compartirlo con un cliente.

**Criterios de aceptación:**
- Generar un resumen por activo o por watchlist, incluyendo la noticia relacionada, el movimiento asociado y la posible acción de investigación.
- Permitir marcar cada señal con estado: Revisada, Escalada o Descartada, guardando la justificación del analista.
- No permitir ejecutar compras ni ventas: el sistema solo crea alertas o tareas para revisión humana.

## 30. Diseño de API REST

Base URL: `/api/v1`

| Método | Endpoint | Descripción | Rol mínimo |
|---|---|---|---|
| GET | `/news` | Lista noticias con filtros (`instrument`, `asset`, `sector`, `since`) | Invitado |
| GET | `/news/{id}` | Detalle de una noticia | Invitado |
| GET | `/assets` | Lista de instrumentos financieros | Invitado |
| GET | `/signals` | Lista señales (filtrable por `asset_id`, `status`, `impact`) | Invitado |
| GET | `/signals/{id}` | Detalle de una señal, incluye evidencia y comparación histórica | Invitado |
| PATCH | `/signals/{id}/status` | Cambia estado (Revisada/Escalada/Descartada) + comentario | Analista |
| POST | `/briefings` | Crea un nuevo briefing (por `asset_id` o `watchlist_id`) | Analista |
| GET | `/briefings/{id}` | Detalle de briefing con señales incluidas | Invitado |
| PATCH | `/briefings/{id}/approve` | Aprueba o escala un briefing | Supervisor |
| GET | `/watchlists` | Lista watchlists del usuario autenticado | Analista |
| POST | `/watchlists` | Crea una watchlist | Analista |
| POST | `/watchlists/{id}/assets` | Agrega un activo a una watchlist | Analista |
| DELETE | `/watchlists/{id}/assets/{asset_id}` | Quita un activo de la watchlist | Analista |
| GET | `/alerts` | Lista alertas del usuario | Analista |
| POST | `/alerts` | Crea una alerta | Analista |
| PATCH | `/alerts/{id}` | Activa/desactiva o edita una alerta | Analista |
| GET | `/audit-logs` | Consulta registros de auditoría (filtrable por `entity`, `user_id`, `date_range`) | Supervisor |
| GET | `/dashboard/summary` | Datos consolidados para el dashboard principal | Invitado |

**Notas de diseño:**
- Autenticación mediante JWT emitido por Supabase Auth, enviado en cabecera `Authorization: Bearer <token>`.
- Todas las respuestas siguen formato JSON con envoltura estándar `{ "data": ..., "error": null }`.
- Los endpoints de escritura sensibles (`PATCH /signals/{id}/status`, `PATCH /briefings/{id}/approve`) generan automáticamente un registro en `audit_logs`.

## 31. Diseño de Edge Functions de Supabase

| Función | Trigger | Responsabilidad |
|---|---|---|
| `ingest-news` | Programada (cron) o manual | Obtiene noticias desde NewsAPI/Yahoo RSS (o feed de prueba) y las persiste en `news`. |
| `agent-market-analyst` | Invocada tras `ingest-news` o bajo demanda | Ejecuta al Agente 1: clasifica sector, extrae activos relacionados, detecta eventos. |
| `agent-financial-advisor` | Invocada tras `agent-market-analyst` | Ejecuta al Agente 2 vía Gemini API: genera señal (impacto, confianza, explicación, riesgos, investigación sugerida) y persiste en `signals`. |
| `generate-briefing` | Invocada por el usuario (Analista) | Consolida señales por activo/watchlist en un nuevo registro de `briefings`. |
| `evaluate-alerts` | Invocada tras nueva señal | Compara señales nuevas contra condiciones de `alerts` activas y genera notificaciones. |
| `write-audit-log` | Invocada por triggers de base de datos o desde otras funciones | Centraliza la escritura de registros en `audit_logs`, garantizando formato consistente. |

**Consideraciones de implementación:**
- Las funciones que invocan la API de Gemini deben manejar timeouts y devolver un estado "Incierto / confianza baja" ante fallas, sin bloquear el flujo del usuario (RNF-009).
- Las claves de API (Gemini, NewsAPI, Alpha Vantage, CoinGecko) se gestionan como variables de entorno seguras en Supabase, nunca expuestas al frontend.
- `write-audit-log` debe ser reutilizada por todas las funciones que modifiquen entidades sensibles, para garantizar cumplimiento de RF-017 y RNF-006.

---

*Documento generado para el Track 5 del Hackathon de Agentes Financieros IA (Julio de 2026). Este SRS constituye la base funcional y técnica mínima para iniciar el desarrollo de Market Intelligence AI; los equipos pueden extenderlo siempre que no se elimine ni sustituya el alcance mínimo aquí definido.*
