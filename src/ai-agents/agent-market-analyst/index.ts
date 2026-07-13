/* ============================================================
 * Edge Function: agent-market-analyst (Agente 1)
 * SRS §12.1, §19, §31
 * Entrada : noticia cruda (news.id o news object)
 * Salida  : noticia enriquecida (sector, activos relacionados)
 * Invoca  : agent-financial-advisor para cada activo detectado
 * ============================================================ */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.3.0';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY       = Deno.env.get('GEMINI_API_KEY')!;

// ─── Prompt del sistema (Agente 1) ───────────────────────────
const AGENT1_SYSTEM_PROMPT = `Eres el Analista de Coyuntura de Mercados IA del sistema Market Intelligence AI.
Tu función es analizar noticias financieras y económicas para:
1. Clasificar el sector económico de la noticia.
2. Identificar los instrumentos financieros mencionados o afectados (acciones, criptoactivos, ETFs, bonos, commodities, divisas).
3. Detectar el tipo de evento (resultado corporativo, decisión de política monetaria, evento macro, regulación, etc.).
4. Identificar riesgos u oportunidades preliminares.

RESTRICCIÓN ABSOLUTA: No recomiendes comprar ni vender ningún instrumento financiero.
No garantices rendimientos. Tu salida es un análisis para apoyo humano, no asesoría.

Responde ÚNICAMENTE con JSON válido, sin texto adicional.`;

const AGENT1_USER_TEMPLATE = (title: string, content: string) => `
Analiza esta noticia:
TÍTULO: ${title}
CONTENIDO: ${content}

Responde con este JSON exacto:
{
  "sector": "string (Tecnología|Financiero|Energía|Criptoactivos|Automotriz|Forex|Metales preciosos|Índices|Consumo|Otro)",
  "tipo_evento": "string (resultado_corporativo|politica_monetaria|macro_economico|regulacion|geopolitico|otro)",
  "activos_detectados": ["SYMBOL1", "SYMBOL2"],
  "riesgos_preliminares": "string (máx 100 chars)",
  "oportunidades_preliminares": "string (máx 100 chars)"
}`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { news_id } = await req.json();

    if (!news_id) {
      return new Response(JSON.stringify({ data: null, error: { message: 'news_id requerido' } }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Obtener la noticia
    const { data: newsData, error: newsError } = await supabase
      .from('news')
      .select('*')
      .eq('id', news_id)
      .single();

    if (newsError || !newsData) {
      return new Response(JSON.stringify({ data: null, error: { message: 'Noticia no encontrada' } }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Llamar a Gemini 2.5 Flash (Agente 1)
    let agent1Result: {
      sector: string;
      tipo_evento: string;
      activos_detectados: string[];
      riesgos_preliminares: string;
      oportunidades_preliminares: string;
    };

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const chat = model.startChat({
        systemInstruction: AGENT1_SYSTEM_PROMPT,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const result = await chat.sendMessage(
        AGENT1_USER_TEMPLATE(newsData.title, newsData.content),
        { signal: AbortSignal.timeout(15000) }
      );

      const raw = result.response.text();
      agent1Result = JSON.parse(raw);

    } catch (geminiErr) {
      // Fallback: "Incierto / confianza baja" (SRS §13, RNF-009)
      console.warn('[agent-market-analyst] Gemini falló, usando fallback:', geminiErr);
      agent1Result = {
        sector:                     newsData.sector ?? 'Otro',
        tipo_evento:                'otro',
        activos_detectados:         [],
        riesgos_preliminares:       'No determinado (fallo del agente IA)',
        oportunidades_preliminares: 'No determinado (fallo del agente IA)',
      };
    }

    // 3. Actualizar el sector de la noticia si se detectó
    if (agent1Result.sector && !newsData.sector) {
      await supabase
        .from('news')
        .update({ sector: agent1Result.sector })
        .eq('id', news_id);
    }

    // 4. Buscar activos en BD que coincidan con los detectados
    const symbols = agent1Result.activos_detectados;
    let assetIds: string[] = [];

    if (symbols.length > 0) {
      const { data: assetsData } = await supabase
        .from('assets')
        .select('id, symbol')
        .in('symbol', symbols);

      assetIds = (assetsData ?? []).map((a: any) => a.id);
    }

    // 5. Invocar agent-financial-advisor para cada activo detectado
    const signalResults = [];
    for (const assetId of assetIds) {
      const advisorRes = await supabase.functions.invoke('agent-financial-advisor', {
        body: { news_id, asset_id: assetId },
      });
      signalResults.push(advisorRes.data);
    }

    // 6. Registrar en audit_logs
    await supabase.from('audit_logs').insert({
      user_id:        null,    // acción del agente IA
      action:         'signal.create',
      entity:         'news',
      entity_id:      news_id,
      previous_state: null,
      new_state:      { sector: agent1Result.sector, activos_detectados: symbols, signals_generadas: signalResults.length },
    });

    return new Response(JSON.stringify({
      data: {
        news_id,
        sector:              agent1Result.sector,
        activos_detectados:  symbols,
        signals_generadas:   signalResults.length,
      },
      error: null,
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  } catch (err) {
    console.error('[agent-market-analyst] Error:', err);
    return new Response(JSON.stringify({ data: null, error: { message: String(err) } }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
