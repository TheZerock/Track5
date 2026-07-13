# Documento de Presentación — Market Intelligence AI

> Track 5 — Hackathon de Agentes Financieros IA | Julio 2026

---

## 1. Resumen ejecutivo

**Market Intelligence AI** es una plataforma web tipo dashboard financiero que usa dos agentes de Inteligencia Artificial (sobre Google Gemini) para transformar noticias financieras y económicas en **señales de impacto explicables**, ayudando a analistas e inversionistas a decidir qué investigar antes de tomar una decisión.

El sistema **no ejecuta operaciones de compra/venta ni sustituye el juicio humano**: toda señal generada por IA es una propuesta sujeta a revisión de un analista o supervisor.

---

## 2. El problema

Los analistas e inversionistas enfrentan tres fricciones al usar noticias para tomar decisiones de mercado:

1. **Sobrecarga de información:** cientos de noticias financieras se publican cada día, de fuentes dispersas (NewsAPI, RSS, feeds de mercado), sin relación explícita con los activos que le interesan a cada usuario.
2. **Falta de contexto accionable:** una noticia por sí sola no dice si su impacto es positivo, negativo o irrelevante para un activo concreto, ni con qué nivel de confianza se puede afirmar eso.
3. **Decisiones sin trazabilidad ni control:** las herramientas de "señales automáticas" existentes suelen actuar como cajas negras — no muestran evidencia, no dejan rastro de quién revisó qué, y en el peor caso automatizan órdenes de compra/venta sin supervisión humana, algo inaceptable en un contexto regulado.

**Reto concreto del hackathon:** construir, en 48 horas, un sistema que conecte noticias → activos financieros → señales explicables → revisión humana, sin cruzar nunca la línea de ejecutar operaciones reales.

---

## 3. La solución

Market Intelligence AI resuelve esto con un pipeline de dos agentes IA que colaboran de forma secuencial, y un flujo de revisión humana obligatorio antes de que cualquier señal se considere lista para un cliente.

### 3.1 Flujo de valor

```
Ingesta de noticias → Agente 1 (clasifica y relaciona con activos)
                    → Agente 2 (genera señal explicable)
                    → Briefing consolidado
                    → Revisión humana (Analista → Supervisor)
                    → Auditoría inmutable
```

### 3.2 Los dos agentes IA

| Agente | Rol | Entrada | Salida |
|---|---|---|---|
| **Agente 1 — Analista de Coyuntura de Mercados** | Vigía del mercado | Noticias crudas (reales o de prueba) | Noticia enriquecida: sector, activos relacionados, tipo de evento |
| **Agente 2 — Asesor Financiero e Inversiones** | Generador de señales | Noticia enriquecida + histórico de precio | Señal estructurada: impacto, confianza (0–100), evidencia, riesgos, investigación sugerida |

**Restricción dura (regla de negocio RN-01):** ningún agente puede generar ni ejecutar instrucciones de compra/venta. Esto está reforzado en el *system prompt* de Gemini, en la base de datos y en la interfaz.

### 3.3 Funcionalidades entregadas

- **Radar de Noticias**: noticias de al menos dos fuentes, filtrables por instrumento, activo, sector y antigüedad.
- **Señal explicable de impacto**: clasificación (Positivo/Negativo/Neutral/Incierto), nivel de confianza, comparación histórica de precio, evidencia y disclaimer legal obligatorio.
- **Briefings con revisión humana**: resumen por activo o watchlist; cada señal se marca como Revisada, Escalada o Descartada con justificación; solo un Supervisor puede aprobar un briefing para cliente.
- **Watchlists y alertas**: seguimiento personalizado de activos con notificación cuando aparece una señal relevante.
- **Precios de mercado en caché** (`fetch-market-prices`) con *fallback* a datos de prueba si la fuente externa falla.
- **Seguridad por roles** (Administrador, Analista, Supervisor, Invitado) con políticas RLS en cada tabla sensible.
- **Auditoría inmutable**: toda acción crítica (cambio de estado de señal, aprobación de briefing) queda registrada con usuario, fecha, estado anterior y nuevo.

### 3.4 Arquitectura técnica

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + TailwindCSS (SPA) |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| IA | Google Gemini API (2.5 Flash / 2.5 Pro) |
| Fuentes de datos | NewsAPI, CoinGecko, Alpha Vantage, Yahoo Finance RSS (con mocks de respaldo) |

```
FRONTEND (React/TS)  ── HTTPS/REST ──▶  BACKEND (Supabase: Auth, PostgreSQL, Edge Functions)
                                              │
                        ┌─────────────────────┼───────────────────────┐
                        ▼                     ▼                       ▼
                  Fuentes de noticias   Google Gemini API      Datos de mercado
                  (NewsAPI, Yahoo RSS)  (Agente 1 + Agente 2)  (CoinGecko, Alpha Vantage)
```

**Edge Functions clave:** `ingest-news` → `agent-market-analyst` → `agent-financial-advisor` → `generate-briefing` / `notify-alerts`, todas escribiendo en `audit_logs` para trazabilidad completa.

### 3.5 Por qué esta solución es defendible

- **Cumplimiento por diseño:** la restricción de "no ejecutar operaciones" no es solo un aviso en pantalla — está en la regla de negocio, en el prompt de IA y en la capa de datos.
- **Explicabilidad real:** cada señal muestra su evidencia, fuente y comparación histórica, no solo una etiqueta de "comprar/vender".
- **Resiliencia:** si una API externa falla (noticias o precios), el sistema cae automáticamente a datos de prueba marcados como tales, sin romper la demo ni la experiencia de usuario.
- **Trazabilidad total:** cada decisión humana sobre una señal queda auditada e inmutable, algo exigido en cualquier entorno financiero regulado.

---

## 4. Guion para video de presentación (3 minutos)

Estructura pensada para una demo de hackathon: problema → solución → demo en vivo → cierre. Tiempos aproximados, ajustables ±5 segundos.

| Tiempo | Sección | Contenido a decir / mostrar |
|---|---|---|
| **0:00–0:25** (25s) | **Gancho + problema** | "Cada día se publican cientos de noticias financieras. Un analista no puede leerlas todas ni saber, noticia por noticia, qué activos afecta y con qué confianza." Mostrar pantalla con un feed saturado de noticias. |
| **0:25–0:45** (20s) | **Presentación del proyecto** | "Por eso creamos Market Intelligence AI: una plataforma que usa dos agentes de IA sobre Gemini para convertir noticias en señales explicables, siempre con revisión humana antes de actuar." Mostrar logo/dashboard principal. |
| **0:45–1:15** (30s) | **Demo — Radar de Noticias** | Abrir la app, mostrar el Radar de Noticias, aplicar un filtro (ej. "Cripto"), abrir una noticia y señalar fuente/fecha y los activos relacionados (chips). |
| **1:15–1:55** (40s) | **Demo — Señal explicable** | Hacer clic en la señal generada: mostrar impacto (Positivo/Negativo/Neutral), medidor de confianza, evidencia/fuentes, comparación histórica y el disclaimer legal. Explicar en 1 frase cómo colaboran Agente 1 y Agente 2. |
| **1:55–2:30** (35s) | **Demo — Briefing y revisión humana** | Mostrar un briefing generado, marcar una señal como "Revisada" con comentario, y mostrar cómo el Supervisor aprueba el briefing. Enfatizar: "ninguna señal ejecuta una operación, solo genera tareas de revisión." |
| **2:30–2:50** (20s) | **Arquitectura (rápido)** | Un slide con el diagrama: React + Supabase + Gemini + auditoría. "Todo corre sobre Supabase con seguridad por roles y auditoría inmutable de cada acción." |
| **2:50–3:00** (10s) | **Cierre** | "Market Intelligence AI: información accionable, explicable y siempre bajo supervisión humana. Gracias." Mostrar pantalla final con nombre del equipo/proyecto. |

**Notas de producción:**
- Grabar la demo en vivo sobre datos de prueba (`is_test_data = true`) para evitar depender de APIs externas el día de la grabación.
- Tener el dashboard precargado con al menos una señal de cada tipo de impacto (Positivo/Negativo/Neutral/Incierto) antes de grabar.
- Practicar el guion en voz alta cronometrado — el tramo de demo (0:45–2:30, ~105s) es el que más se suele alargar; recortar ahí primero si sobra tiempo.

---

## 5. Estado actual del proyecto

> Nota: `sprints/sprint-01/sprint.md` marca el Sprint 01 como "🟡 Pendiente", pero el repositorio ya contiene 7 migraciones SQL (hasta señales, briefings, watchlists, auditoría, notificaciones y caché de precios de mercado) y Edge Functions de ambos agentes IA implementadas. Verificar el estado real antes de la presentación y actualizar `README.md` / `sprint.md` si corresponde, para que la demo y la documentación no se contradigan.

| Componente | Estado en el repositorio |
|---|---|
| Esquema de base de datos | 7 migraciones aplicadas (usuarios/roles, noticias/activos/señales, briefings/watchlists, auditoría, emails únicos, permisos de analista, notificaciones, caché de precios) |
| Edge Function `ingest-news` | Implementada (`src/backend/ingest-news`) |
| Agente 1 (`agent-market-analyst`) | Implementado (`src/ai-agents/agent-market-analyst`) |
| Agente 2 (`agent-financial-advisor`) | Implementado (`src/ai-agents/agent-financial-advisor`) |
| Precios de mercado (`fetch-market-prices`) | Implementada, con proxy GLD para oro y fallback a datos de prueba |
| Frontend (Radar de Noticias y vistas asociadas) | En desarrollo (`src/frontend`) |
