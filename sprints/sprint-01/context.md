# Context — Sprint 01

> Este archivo lista ÚNICAMENTE los archivos relevantes para el Sprint 01.
> Al iniciar el sprint, cargar SOLO estos archivos (más los que se creen dentro del sprint).
> Al finalizar el sprint, actualizar este archivo con los nuevos archivos creados.

---

## Archivos de contexto inicial

```
docs/03-requisitos.md
docs/04-arquitectura.md
sprints/sprint-01/sprint.md
```

## Archivos a crear / modificar en este sprint

```
# Base de datos / Supabase
supabase/migrations/001_initial_schema.sql      # Tablas: users, roles, news, assets + RLS
supabase/migrations/002_seed_assets.sql         # Seed de activos financieros de prueba
supabase/migrations/003_seed_news.sql           # Seed de noticias de prueba

# Backend — Edge Functions
src/backend/ingest-news/index.ts                # Edge Function principal
src/backend/ingest-news/providers/newsapi.ts    # Adaptador NewsAPI
src/backend/ingest-news/providers/yahoo-rss.ts  # Adaptador Yahoo Finance RSS
src/backend/ingest-news/providers/mock.ts       # Feed de prueba (fallback)
src/backend/ingest-news/schema.ts               # Validación del esquema de noticia
src/backend/ingest-news/README.md               # Documentación de la Edge Function

# Frontend — Radar de Noticias
src/frontend/radar-noticias/RadarPage.tsx        # Vista principal del radar
src/frontend/radar-noticias/NewsCard.tsx         # Tarjeta de noticia
src/frontend/radar-noticias/NewsDetail.tsx       # Vista de detalle de noticia
src/frontend/radar-noticias/NewsFilters.tsx      # Barra de filtros
src/frontend/radar-noticias/useNews.ts           # Hook de datos (fetch + filtros)
src/frontend/radar-noticias/types.ts             # Tipos TypeScript para noticias y activos

# Tests
tests/radar-noticias/ingest-news.test.ts         # Tests de la Edge Function
tests/radar-noticias/filters.test.ts             # Tests de lógica de filtrado
```

---

## Archivos creados al finalizar el sprint

> ⬇️ Completar aquí al cerrar el Sprint 01 (antes de iniciar el Sprint 02).

```
# (vacío — se completa al finalizar el sprint)
```

---

## Notas para sprints futuros

- El **Sprint 02** necesitará: `supabase/migrations/001_initial_schema.sql` (para agregar tabla `signals`), `src/backend/ingest-news/` (para encadenar con `agent-market-analyst`).
- El **Sprint 03** necesitará: tabla `briefings` en migraciones, `src/frontend/radar-noticias/NewsDetail.tsx` (para agregar señal al briefing desde el detalle de noticia).
