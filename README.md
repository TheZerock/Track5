# Market Intelligence AI

> **Sistema Inteligente de Análisis de Mercado y Recomendaciones Informadas por Noticias mediante Agentes IA**  
> Track 5 — Hackathon de Agentes Financieros IA | Julio 2026

[![Estado](https://img.shields.io/badge/estado-En%20desarrollo-yellow)](#estado-de-sprints)
[![Stack](https://img.shields.io/badge/stack-React%20%2B%20Supabase%20%2B%20Gemini-blue)](#stack-tecnológico)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green)](#)

---

## ¿Qué es Market Intelligence AI?

Market Intelligence AI es una plataforma web tipo **dashboard financiero** que utiliza agentes de Inteligencia Artificial para transformar noticias financieras y económicas en señales explicables que apoyan la toma de decisiones de analistas e inversionistas.

El sistema orquesta dos agentes IA especializados:
- **Agente 1 — Analista de Coyuntura de Mercados IA:** monitorea y clasifica noticias, relacionándolas con activos financieros.
- **Agente 2 — Asesor Financiero e Inversiones IA:** genera señales de impacto explicables con nivel de confianza, evidencia y comparación histórica.

> ⚠️ **Aviso legal:** Este sistema **no ejecuta operaciones financieras, no recomienda compra/venta de instrumentos ni garantiza rendimientos.** Toda señal es una propuesta sujeta a revisión humana.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React + TypeScript + TailwindCSS (SPA) |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **IA** | Google Gemini API (2.5 Flash / 2.5 Pro) |
| **Fuentes de datos** | NewsAPI, CoinGecko, Alpha Vantage, Yahoo Finance RSS (o mocks) |
| **Auth** | Supabase Auth (email/password + roles RLS) |
| **Tests** | Vitest / Jest (TypeScript) |

---

## Estructura de Carpetas

```
market-intelligence-ai/
├── README.md                          # Este archivo
├── docs/
│   ├── SRS_Market_Intelligence_AI.md  # Especificación de requisitos (fuente de verdad)
│   ├── 03-requisitos.md               # Resumen RF, RNF y RN en tablas
│   └── 04-arquitectura.md             # Resumen de arquitectura general, IA, Gemini y Supabase
├── src/
│   ├── frontend/                      # SPA React + TypeScript
│   │   └── radar-noticias/            # [Sprint 01] Vista Radar de Noticias
│   ├── backend/                       # Edge Functions de Supabase (Deno/TypeScript)
│   │   └── ingest-news/               # [Sprint 01] Ingesta de noticias
│   └── ai-agents/                     # Lógica de agentes IA (Agente 1 y Agente 2)
├── tests/                             # Tests por funcionalidad
│   └── radar-noticias/                # [Sprint 01] Tests de ingesta y filtrado
├── supabase/
│   └── migrations/                    # Migraciones SQL (orden cronológico)
└── sprints/
    └── sprint-01/
        ├── sprint.md                  # Objetivo, alcance, criterios de aceptación
        └── context.md                 # Archivos relevantes para el sprint
```

---

## Metodología de Desarrollo (SDD por Sprints)

Este proyecto sigue **Spec-Driven Development (SDD)** por sprints:

1. Cada sprint carga **únicamente el contexto que necesita** (definido en `context.md`), nunca el repositorio completo.
2. El **SRS es la fuente de verdad** para requisitos, modelo de datos, arquitectura, API y agentes IA.
3. Al iniciar un sprint: leer `sprints/sprint-N/sprint.md` y `context.md`, confirmar objetivo y restricciones, luego implementar.
4. Al terminar un sprint: actualizar `context.md` con los archivos nuevos creados.

---

## Cómo Correr el Proyecto Localmente

### Pre-requisitos

- Node.js ≥ 18
- npm ≥ 9
- Supabase CLI (`npm install -g supabase`)
- Cuenta en [Supabase](https://supabase.com) y [Google AI Studio](https://aistudio.google.com)

### 1. Clonar y configurar variables de entorno

```bash
git clone <repo-url>
cd market-intelligence-ai
cp .env.example .env
```

Completar en `.env`:
```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
GEMINI_API_KEY=<tu-api-key>
NEWSAPI_KEY=<tu-newsapi-key>          # Opcional — usa mock si no está configurada
```

### 2. Supabase local (opcional)

```bash
supabase start
supabase db push
```

### 3. Frontend

```bash
cd src/frontend
npm install
npm run dev
```

El servidor de desarrollo estará disponible en `http://localhost:5173`.

### 4. Edge Functions (local)

```bash
supabase functions serve ingest-news
```

---

## Estado de Sprints

| Sprint | Objetivo | Fases del Roadmap | Estado |
|---|---|---|---|
| **Sprint 01** | Setup inicial + Radar de Noticias (HU-01) | Fase 0 + Fase 1 | 🟡 Pendiente |
| **Sprint 02** | Integración Gemini + Señales explicables (HU-02) | Fase 2 | ⬜ Sin iniciar |
| **Sprint 03** | Briefings y revisión humana (HU-03) | Fase 3 | ⬜ Sin iniciar |
| **Sprint 04** | Watchlists, alertas y dashboard consolidado | Fase 4 | ⬜ Sin iniciar |
| **Sprint 05** | Seguridad completa, auditoría y gestión de roles | Fase 5 | ⬜ Sin iniciar |
| **Sprint 06** | Pulido, datos de prueba completos y demo | Fase 6 | ⬜ Sin iniciar |

---

## Documentación Adicional

- 📋 [Especificación de Requisitos (SRS)](docs/SRS_Market_Intelligence_AI.md)
- 📊 [Requisitos funcionales, no funcionales y reglas de negocio](docs/03-requisitos.md)
- 🏗️ [Arquitectura del sistema](docs/04-arquitectura.md)
- 🏃 [Sprint 01 — Definición y criterios de aceptación](sprints/sprint-01/sprint.md)

---

## Contribución

Este proyecto sigue la metodología SDD por sprints. Antes de contribuir:
1. Lee el SRS completo en `docs/SRS_Market_Intelligence_AI.md`.
2. Revisa el sprint activo en `sprints/sprint-N/sprint.md`.
3. Trabaja **únicamente** dentro del alcance del sprint activo.
4. Cumple las restricciones de RN-01 (sin operaciones financieras automáticas) en cada línea de código.
