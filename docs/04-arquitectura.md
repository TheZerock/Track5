# Arquitectura del Sistema — Market Intelligence AI
> Extraído de las secciones 11, 12, 13 y 14 del SRS v1.0  
> Fuente de verdad: [`docs/SRS_Market_Intelligence_AI.md`](./SRS_Market_Intelligence_AI.md)

---

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
│ NewsAPI, Yahoo │   │  Agente 1 y Agente2│   │ según disponibili- │
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

### Capas del sistema

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| **Presentación** | React + TypeScript + TailwindCSS (SPA) | UI/UX, consumo de Supabase Auth + PostgREST + Edge Functions |
| **Aplicación/Orquestación** | Supabase Edge Functions (Deno/TypeScript) | Orquestar llamadas a Gemini, APIs externas e ingesta de noticias |
| **Datos** | PostgreSQL con RLS + Supabase Storage | Persistencia relacional y almacenamiento de adjuntos (evidencias) |
| **IA** | Google Gemini API (2.5 Flash / 2.5 Pro) | Agentes especializados de análisis de mercado y generación de señales |
| **Integraciones externas** | NewsAPI, CoinGecko, Alpha Vantage, Yahoo Finance RSS | Fuentes de noticias y datos de mercado (con fallback a mocks) |

---

## 12. Arquitectura de IA

El sistema implementa **dos agentes especializados** que operan de forma secuencial/colaborativa.

### 12.1 Agente 1 — Analista de Coyuntura de Mercados IA

| Aspecto | Detalle |
|---|---|
| **Entrada** | Noticias crudas desde fuentes externas o feeds de prueba |
| **Procesamiento** | Clasificación por sector, extracción de entidades (activos mencionados), detección de eventos macro/microeconómicos, identificación preliminar de riesgos/oportunidades |
| **Salida** | Noticia enriquecida con metadatos: `{ sector, activos_relacionados, tipo_de_evento }` |
| **Trigger** | Invocado tras `ingest-news` o bajo demanda |

### 12.2 Agente 2 — Asesor Financiero e Inversiones IA

| Aspecto | Detalle |
|---|---|
| **Entrada** | Noticia enriquecida por Agente 1 + datos históricos de precio (reales o de prueba) |
| **Procesamiento** | Análisis de sentimiento, determinación de impacto, cálculo de confianza (0–100), comparación histórica, generación de explicación con evidencia, sugerencia de investigación |
| **Salida** | Objeto `signal` estructurado (ver sección 13) + contribución a briefings consolidados |
| **Restricción dura** | ❌ **NUNCA** genera instrucciones de compra/venta; salida limitada a clasificación, explicación e investigación sugerida (RN-01) |
| **Trigger** | Invocado tras `agent-market-analyst` |

### 12.3 Orquestación

```
ingest-news  ──►  agent-market-analyst (Agente 1)  ──►  agent-financial-advisor (Agente 2)
                           │                                        │
                    persiste en news                       persiste en signals
                    (PostgreSQL)                           (PostgreSQL)
                                                                    │
                                                         generate-briefing (bajo demanda)
                                                                    │
                                                         notify-alerts
```

- Ejecución **secuencial**: Agente 1 → Agente 2.
- Resultados intermedios persistidos en PostgreSQL para trazabilidad y reprocesamiento.
- Edge Functions en Supabase como runtime de orquestación.

---

## 13. Integración con Gemini

### Flujo de procesamiento por noticia

```
1. Recibir noticia (texto, fuente, fecha)
2. Identificar activos financieros relacionados
3. Analizar sentimiento del contenido
4. Determinar impacto (Positivo / Negativo / Neutral / Incierto)
5. Calcular nivel de confianza (0–100)
6. Generar explicación basada en evidencia (noticia + datos históricos)
7. Sugerir investigaciones adicionales para el analista
```

### Formato de salida esperado (JSON estructurado)

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

### Consideraciones técnicas

| Tema | Decisión |
|---|---|
| **Modelos** | Gemini 2.5 Flash para clasificación rápida/alto volumen; Gemini 2.5 Pro para briefings profundos |
| **Formato de salida** | Prompts con salida forzada en JSON; validación con schema antes de persistir en BD |
| **Manejo de errores** | Reintentos automáticos; fallback a `{ impacto: "Incierto", confianza: 0 }` si la API falla o la respuesta no es parseable |
| **Restricción en prompt** | El system prompt incluye explícitamente la prohibición de recomendar compra/venta ni garantizar rendimientos (RN-01, RNF-011) |

---

## 14. Arquitectura Supabase

### Componentes principales

| Componente | Uso en el proyecto |
|---|---|
| **Supabase Auth** | Autenticación por email/password; roles gestionados mediante tabla `roles` + relación `users → roles` |
| **PostgreSQL** | Base de datos relacional principal con todas las entidades del sistema (ver secciones 15–16 del SRS) |
| **Row Level Security (RLS)** | Políticas por tabla que restringen lectura/escritura según el rol del usuario autenticado (ver sección 22 del SRS) |
| **Storage** | Almacenamiento de evidencias adjuntas (capturas de gráficos, PDFs) asociadas a señales o briefings |
| **Edge Functions** | Lógica de orquestación de agentes IA, integración con APIs externas y procesos de ingesta de noticias |

### Edge Functions definidas

| Función | Trigger | Responsabilidad |
|---|---|---|
| `ingest-news` | Cron programado o manual | Obtiene noticias desde NewsAPI/Yahoo RSS (o feed de prueba) y las persiste en `news` |
| `agent-market-analyst` | Tras `ingest-news` o bajo demanda | Ejecuta Agente 1: clasifica sector, extrae activos, detecta eventos |
| `agent-financial-advisor` | Tras `agent-market-analyst` | Ejecuta Agente 2 vía Gemini: genera señal completa y persiste en `signals` |
| `generate-briefing` | Invocada por el usuario (Analista) | Consolida señales por activo/watchlist y genera resumen ejecutivo |
| `notify-alerts` | Tras `agent-financial-advisor` | Compara señales nuevas con alertas activas; dispara notificaciones |

### Ejemplos de políticas RLS

```sql
-- Lectura de noticias: abierta a cualquier usuario autenticado
CREATE POLICY "news_select_all_authenticated"
ON news FOR SELECT
USING (auth.role() = 'authenticated');

-- Watchlists: solo el propietario puede leer/escribir
CREATE POLICY "watchlists_owner_only"
ON watchlists FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Señales: escritura de estado solo para Analista/Supervisor/Administrador
CREATE POLICY "signals_update_review_roles"
ON signals FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND r.name IN ('Administrador','Analista','Supervisor')
  )
);

-- Auditoría: solo lectura para Administrador y Supervisor
CREATE POLICY "audit_logs_select_admin_supervisor"
ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND r.name IN ('Administrador','Supervisor')
  )
);
```

### Principio clave

> **RLS debe activarse desde la Fase 0 (Setup).** Toda tabla nueva debe tener al menos una política mínima viable antes de salir a producción/demo (ver R-04 en la tabla de riesgos del SRS).

---

## Diagrama de secuencia — Generación de señal

```
Usuario ──► Frontend ──► Edge Function (orquestador)
                               │
                    ┌──────────┴───────────┐
                    ▼                      ▼
             Agente 1 (Gemini)      PostgreSQL (news)
                    │
                    ▼
             Agente 2 (Gemini)
                    │
                    ▼
             PostgreSQL (signals)
                    │
                    ▼
             Frontend (renderizado de señal con disclaimer)
```
