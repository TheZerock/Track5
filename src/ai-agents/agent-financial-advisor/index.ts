/* ============================================================
 * Edge Function: agent-financial-advisor (Agente 2)
 * SRS §12.2, §13, §19, §31
 * Entrada : news_id + asset_id
 * Salida  : señal persistida en tabla signals
 * Formato JSON exacto (SRS §13):
 *   { activo, impacto, confianza, explicacion, riesgos, investigacion_sugerida }
 * RESTRICCIÓN DURA (RN-01, RF-012): NUNCA genera instrucciones de compra/venta
 * ============================================================ */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.3.0';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY       = Deno.env.get('GEMINI_API_KEY')!;

// ─── Prompt del sistema (Agente 2) ───────────────────────────
const AGENT2_SYSTEM_PROMPT = `Eres el Asesor Financiero e Inversiones IA del sistema Market Intelligence AI.
Tu función es generar señales explicables sobre el posible impacto de una noticia en un activo financiero.

REGLAS ABSOLUTAS — VIOLACIÓN IMPLICA INVALIDACIÓN DE LA RESPUESTA:
1. NUNCA uses lenguaje que implique "comprar", "vender", "invertir", "adquirir", "deshacerse de" ningún activo.
2. NUNCA garantices rendimientos, ganancias ni pérdidas futuras.
3. Tu salida es ÚNICAMENTE una clasificación de impacto potencial para apoyo al análisis humano.
4. El campo "impacto" SOLO puede tomar uno de estos 4 valores exactos: Positivo, Negativo, Neutral, Incierto.
5. El campo "confianza" debe ser un entero entre 0 y 100.
6. Si no puedes determinar el impacto con seguridad razonable, usa "Incierto" con confianza < 40.

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.`;

const AGENT2_USER_TEMPLATE = (
  newsTitle: string,
  newsContent: string,
  assetSymbol: string,
  assetName: string,
  assetType: string,
  sector: string,
) => `
Analiza el impacto de esta noticia sobre el activo especificado:

NOTICIA:
Título: ${newsTitle}
Contenido: ${newsContent}

ACTIVO A ANALIZAR:
Símbolo: ${assetSymbol}
Nombre: ${assetName}
Tipo: ${assetType}
Sector: ${sector}

Genera una señal de impacto con este JSON exacto (sección 13 del SRS):
{
  "activo": "${assetSymbol}",
  "impacto": "Positivo|Negativo|Neutral|Incierto",
  "confianza": <entero 0-100>,
  "explicacion": "<explicación basada en evidencia de la noticia, máx 400 chars>",
  "riesgos": "<riesgos identificados, máx 200 chars>",
  "investigacion_sugerida": "<acciones de análisis adicional sugeridas al analista, máx 200 chars>"
}`;

// ─── Datos históricos simulados por defecto (RF-006, R-07) ───
function getMockHistoricalData(symbol: string) {
  const now   = Date.now();
  const dates = [...Array(7)].map((_, i) =>
    new Date(now - (6 - i) * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const basePrice: Record<string, number> = {
    BTC: 70000, ETH: 3200, AAPL: 190, MSFT: 420,
    TSLA: 230, GOLD: 2380, WTI: 80, SPY: 520,
    USDMXN: 17.5, JPM: 220,
  };
  const base = basePrice[symbol] ?? 100;
  const prices = dates.map((_, i) => parseFloat((base * (1 + (Math.random() - 0.48) * 0.01 * i)).toFixed(2)));

  return { dates, prices, annotation: 'Datos históricos simulados (is_test_data)' };
}

// ─── Señal de fallback (SRS §13, RNF-009) ────────────────────
function getFallbackSignal(assetSymbol: string) {
  return {
    activo:                  assetSymbol,
    impacto:                 'Incierto' as const,
    confianza:               20,
    explicacion:             'No fue posible analizar el impacto de la noticia (servicio de IA no disponible).',
    riesgos:                 'Resultado no determinado por fallo del agente IA.',
    investigacion_sugerida:  'Revisar manualmente la noticia y el impacto sobre el activo.',
  };
}

// ─── Validador de esquema JSON (SRS §13) ──────────────────────
function validateGeminiOutput(raw: any): boolean {
  const validImpacts = ['Positivo', 'Negativo', 'Neutral', 'Incierto'];
  return (
    typeof raw === 'object' &&
    typeof raw.activo === 'string' &&
    validImpacts.includes(raw.impacto) &&
    typeof raw.confianza === 'number' &&
    raw.confianza >= 0 && raw.confianza <= 100 &&
    typeof raw.explicacion === 'string' &&
    typeof raw.riesgos === 'string' &&
    typeof raw.investigacion_sugerida === 'string'
  );
}

// ─── Handler principal ────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { news_id, asset_id } = await req.json();

    if (!news_id || !asset_id) {
      return new Response(JSON.stringify({ data: null, error: { message: 'news_id y asset_id son requeridos' } }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Cargar noticia y activo
    const [newsRes, assetRes] = await Promise.all([
      supabase.from('news').select('*').eq('id', news_id).single(),
      supabase.from('assets').select('*').eq('id', asset_id).single(),
    ]);

    if (newsRes.error || !newsRes.data) {
      return new Response(JSON.stringify({ data: null, error: { message: 'Noticia no encontrada' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    if (assetRes.error || !assetRes.data) {
      return new Response(JSON.stringify({ data: null, error: { message: 'Activo no encontrado' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const news  = newsRes.data;
    const asset = assetRes.data;

    // 2. Llamar a Gemini 2.5 Pro (análisis más profundo para señales)
    let geminiOutput: ReturnType<typeof getFallbackSignal>;
    let geminiSuccess = false;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const chat = model.startChat({
        systemInstruction: AGENT2_SYSTEM_PROMPT,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const result = await chat.sendMessage(
        AGENT2_USER_TEMPLATE(
          news.title,
          news.content,
          asset.symbol,
          asset.name,
          asset.type,
          asset.sector ?? 'Desconocido',
        ),
        { signal: AbortSignal.timeout(15000) }
      );

      const raw = JSON.parse(result.response.text());

      if (!validateGeminiOutput(raw)) {
        throw new Error('Respuesta de Gemini no conforme al esquema SRS §13');
      }

      geminiOutput  = raw;
      geminiSuccess = true;

    } catch (geminiErr) {
      // Fallback a Incierto/confianza baja (SRS §13, RNF-009)
      console.warn('[agent-financial-advisor] Gemini falló:', geminiErr);
      geminiOutput = getFallbackSignal(asset.symbol);
    }

    // 3. Obtener datos históricos (reales o simulados — R-07, RF-006)
    const historicalComparison = getMockHistoricalData(asset.symbol);
    if (!geminiSuccess) {
      historicalComparison.annotation = 'Datos simulados (fallo del agente IA)';
    }

    // 4. Persistir señal en tabla signals (SRS §16.5)
    const { data: signalData, error: signalError } = await supabase
      .from('signals')
      .insert({
        news_id,
        asset_id,
        impact:               geminiOutput.impacto,           // valor exacto del SRS
        confidence:           geminiOutput.confianza,
        explanation:          geminiOutput.explicacion,
        risks:                geminiOutput.riesgos,
        suggested_research:   geminiOutput.investigacion_sugerida,
        historical_comparison: historicalComparison,
        status:               'Pendiente',                    // estado inicial (SRS §16.5)
      })
      .select()
      .single();

    if (signalError) throw signalError;

    // 5. Registrar en audit_logs (RF-017, RN-07)
    await supabase.from('audit_logs').insert({
      user_id:        null,   // acción del agente IA (SRS §16.10)
      action:         'signal.create',
      entity:         'signals',
      entity_id:      signalData.id,
      previous_state: null,
      new_state: {
        impact:     geminiOutput.impacto,
        confidence: geminiOutput.confianza,
        status:     'Pendiente',
        gemini_ok:  geminiSuccess,
      },
    });

    // 6. Verificar alertas activas para este activo (RF-015)
    await supabase.functions.invoke('evaluate-alerts', {
      body: { signal_id: signalData.id, asset_id, impact: geminiOutput.impacto, confidence: geminiOutput.confianza },
    }).catch(err => console.warn('[agent-financial-advisor] evaluate-alerts:', err));

    return new Response(JSON.stringify({
      data: {
        signal_id:    signalData.id,
        activo:       geminiOutput.activo,
        impacto:      geminiOutput.impacto,
        confianza:    geminiOutput.confianza,
        gemini_used:  geminiSuccess,
      },
      error: null,
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  } catch (err) {
    console.error('[agent-financial-advisor] Error:', err);
    return new Response(JSON.stringify({ data: null, error: { message: String(err) } }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
