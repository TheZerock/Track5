# Sprint 01 — Fase 0 + Fase 1: Setup + Ingesta y Radar de Noticias

**Estado:** 🟡 Pendiente  
**Duración estimada:** 8–11 horas  
**Fase del Roadmap:** Fase 0 (Setup) + Fase 1 (Ingesta y Radar — HU-01)

---

## Objetivo del Sprint

Establecer la base técnica del proyecto (repositorio, Supabase, esquema de base de datos, autenticación básica con RLS) e implementar la funcionalidad de **Radar de Noticias** (HU-01): ingesta de noticias desde fuentes externas o feeds de prueba, relación con instrumentos financieros y visualización con filtros en el frontend.

---

## Alcance

### ✅ Qué SE construye en este sprint

| Área | Entregable |
|---|---|
| **Setup (Fase 0)** | Proyecto Supabase configurado (Auth, Storage, Edge Functions activadas) |
| **Setup (Fase 0)** | Migración inicial: tablas `users`, `roles`, `news`, `assets` con RLS mínimo viable |
| **Setup (Fase 0)** | Autenticación básica (email/password) con roles Administrador, Analista, Supervisor, Invitado |
| **Backend (Fase 1)** | Edge Function `ingest-news`: obtiene noticias desde NewsAPI/Yahoo RSS o feed de prueba |
| **Backend (Fase 1)** | Seed de datos: activos financieros de prueba (acciones, criptoactivos, ETFs) |
| **Backend (Fase 1)** | Relación `news ↔ assets` (tabla intermedia o campo en `news`) |
| **Frontend (Fase 1)** | Vista **Radar de Noticias** con lista de tarjetas (título, fuente, fecha, activos, badge de impacto preliminar) |
| **Frontend (Fase 1)** | Barra de filtros: tipo de instrumento, activo específico, sector económico, antigüedad |
| **Frontend (Fase 1)** | Vista de detalle de noticia (contenido completo, activos relacionados) |
| **Tests** | Pruebas básicas del endpoint `ingest-news` y del filtrado de noticias |

### ❌ Qué NO se construye en este sprint

- Generación de señales de impacto (Agente 1 o Agente 2 con Gemini) → Sprint 02
- Briefings, revisión humana y flujo de aprobación → Sprint 03
- Watchlists y alertas → Sprint 04
- Dashboard consolidado completo → Sprint 04
- Gestión completa de usuarios/roles desde la UI → Sprint 05
- Vista de auditoría → Sprint 05

---

## Criterios de Aceptación — HU-01

> Copiados directamente de la sección 29 del SRS (fuente de verdad).

1. **Fuentes múltiples:** Mostrar noticias recientes provenientes de al menos **dos fuentes** confiables o feeds de prueba, con **fuente y fecha/hora** visibles en la tarjeta.

2. **Relación con instrumentos:** Relacionar cada noticia con uno o más **instrumentos financieros** (chips/tags visibles en la tarjeta de noticia y en el detalle).

3. **Filtros operativos:** Filtrar por:
   - Tipo de instrumento (Acción / Cripto / ETF / Bono / Commodity / Divisa)
   - Activo específico (símbolo/ticker)
   - Sector económico
   - Antigüedad de la noticia (ej. última hora, últimas 24 h, última semana)

4. **Datos de prueba identificados:** Si se usan feeds simulados, la interfaz debe mostrar un badge o indicador claro de "Datos de prueba" (RN-08).

---

## Restricciones del Sprint

> Estas restricciones son **INNEGOCIABLES** y deben cumplirse desde el primer commit.

| ID | Restricción | Origen |
|---|---|---|
| **RN-01** | Ningún código generado en este sprint puede ejecutar ni preparar operaciones financieras automáticas. | SRS §10 |
| **RNF-004** | Las tablas `news`, `assets`, `users` y `roles` deben tener políticas RLS activas desde la migración inicial. | SRS §9 |
| **RN-06** | La Edge Function `ingest-news` debe rechazar noticias sin fuente o sin fecha verificable. | SRS §10 |
| **RN-08** | Los datos de prueba deben marcarse con `is_test_data = true` en BD y mostrarse con indicador visual en la UI. | SRS §10 |
| **RNF-007** | La Edge Function debe ser modular: el proveedor de noticias (real vs. mock) debe poder cambiarse sin alterar el flujo. | SRS §9 |
| **RNF-009** | Si la fuente de noticias externa falla, el sistema debe hacer fallback automático al feed de prueba sin bloquear la UX. | SRS §9 |

---

## Definition of Done (DoD)

- [ ] Migraciones SQL ejecutadas sin errores en Supabase.
- [ ] RLS activo en todas las tablas creadas en este sprint.
- [ ] Edge Function `ingest-news` desplegada y ejecutable manualmente.
- [ ] Al menos 10 noticias de prueba cargadas en la BD con activos relacionados.
- [ ] Vista Radar de Noticias renderiza correctamente con datos reales o de prueba.
- [ ] Los 4 filtros (instrumento, activo, sector, antigüedad) funcionan de forma independiente y combinada.
- [ ] Datos de prueba identificados visualmente en la UI.
- [ ] Tests básicos pasando (backend + filtrado frontend).
- [ ] `context.md` actualizado con todos los archivos nuevos creados.
