/* ============================================================
 * Edge Function: ingest-news
 * SRS §31 — RF-001, RF-002, RF-023
 * RN-06: Rechaza noticias sin fuente o sin fecha verificable.
 * RN-08: Marca datos de prueba con is_test_data = true.
 * RNF-007: Modular — cambiar proveedor sin alterar el flujo.
 * RNF-009: Fallback a feed de prueba si NewsAPI falla.
 * ============================================================ */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NEWSAPI_KEY         = Deno.env.get('NEWSAPI_KEY');

// ─── Interfaz de noticia normalizada ─────────────────────────
interface NormalizedNews {
  title:        string;
  content:      string;
  source:       string;
  published_at: string;    // ISO 8601
  sector:       string | null;
  is_test_data: boolean;
}

// ─── Proveedor 1: NewsAPI (real) ──────────────────────────────
async function fetchFromNewsAPI(): Promise<NormalizedNews[]> {
  if (!NEWSAPI_KEY) throw new Error('NEWSAPI_KEY no configurada');

  const url = `https://newsapi.org/v2/top-headlines?category=business&language=es&pageSize=20&apiKey=${NEWSAPI_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

  if (!res.ok) throw new Error(`NewsAPI HTTP ${res.status}`);
  const json = await res.json();

  return (json.articles ?? [])
    .filter((a: any) =>
      a.source?.name &&     // RN-06: debe tener fuente
      a.publishedAt &&      // RN-06: debe tener fecha
      a.title
    )
    .map((a: any): NormalizedNews => ({
      title:        a.title,
      content:      a.description ?? a.content ?? a.title,
      source:       a.source.name,
      published_at: a.publishedAt,
      sector:       null,          // el Agente 1 clasifica el sector
      is_test_data: false,
    }));
}

// ─── Proveedor 2: Yahoo Finance RSS (real, simulado aquí) ─────
async function fetchFromYahooRSS(): Promise<NormalizedNews[]> {
  const url = 'https://finance.yahoo.com/news/rss/';
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Yahoo RSS HTTP ${res.status}`);

  const text = await res.text();
  const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  return items.slice(0, 10).map((match): NormalizedNews | null => {
    const raw   = match[1];
    const title = raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
                ?? raw.match(/<title>(.*?)<\/title>/)?.[1];
    const pubDate = raw.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
    if (!title || !pubDate) return null;   // RN-06
    return {
      title,
      content:      title,
      source:       'Yahoo Finance RSS',
      published_at: new Date(pubDate).toISOString(),
      sector:       null,
      is_test_data: false,
    };
  }).filter((n): n is NormalizedNews => n !== null);
}

// ─── Feed de prueba — fallback (RF-023, RNF-009) ─────────────
function getMockFeed(): NormalizedNews[] {
  const now = new Date();
  const h   = (n: number) => new Date(now.getTime() - n * 3600 * 1000).toISOString();

  return [
    { title:'La Fed mantiene tasas sin cambios en reunión de julio 2026', content:'La Reserva Federal mantuvo la tasa en 5.25%–5.50% y señaló que la inflación aún supera el objetivo del 2%.', source:'Feed de prueba — NewsAPI Mock', published_at: h(2),  sector:'Financiero',           is_test_data: true },
    { title:'Bitcoin supera los $75,000 tras aprobación de ETFs spot en Europa', content:'Reguladores europeos aprobaron tres ETFs spot, impulsando los flujos institucionales hacia BTC.', source:'Feed de prueba — NewsAPI Mock', published_at: h(5),  sector:'Criptoactivos',         is_test_data: true },
    { title:'Apple reporta ganancias trimestrales superiores a las expectativas', content:'AAPL reportó ingresos de $98.2B, un 4% por encima del consenso. El iPhone creció 8% interanual.', source:'Feed de prueba — NewsAPI Mock', published_at: h(24), sector:'Tecnología',            is_test_data: true },
    { title:'Tesla anuncia expansión de planta en México; acciones suben 4%', content:'Tesla invertirá $2,000M para ampliar la Gigafactory de Monterrey destinada al modelo Cybertruck.', source:'Feed de prueba — NewsAPI Mock', published_at: h(3),  sector:'Automotriz',            is_test_data: true },
    { title:'Petróleo WTI cae 3% por datos de inventarios en EE.UU.', content:'La EIA reportó un aumento de 4.2M de barriles, muy por encima de lo esperado.', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: h(6),  sector:'Energía',               is_test_data: true },
    { title:'JPMorgan eleva perspectivas del S&P 500 para cierre de 2026', content:'Los estrategas de JPM elevaron el objetivo del S&P 500 a 5,800 puntos citando resiliencia económica.', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: h(4),  sector:'Financiero',           is_test_data: true },
    { title:'El peso mexicano se fortalece ante expectativas de recorte de tasas Banxico', content:'USD/MXN cayó por debajo de 17.20 luego de señales dovish de funcionarios del Banco de México.', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: h(8),  sector:'Forex',                is_test_data: true },
    { title:'Ethereum completa actualización Pectra; mayor escalabilidad en L2', content:'La actualización Pectra reduce costos de transacción y aumenta el throughput de datos en L2.', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: h(12), sector:'Criptoactivos',         is_test_data: true },
    { title:'Microsoft integra Copilot en Office 365; analistas proyectan crecimiento cloud', content:'La integración de Copilot AI en Office 365 Enterprise impulsaría la retención de clientes.', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: h(48), sector:'Tecnología',            is_test_data: true },
    { title:'Oro alcanza $2,450 por onza ante debilidad del dólar y tensiones geopolíticas', content:'El DXY cedió 0.8% mientras que las tensiones en el Mar Rojo impulsaron la demanda de refugio.', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: h(18), sector:'Metales preciosos',     is_test_data: true },
  ];
}

// ─── Orquestador de proveedores (RNF-007) ────────────────────
async function fetchNewsFromSources(): Promise<{ news: NormalizedNews[]; usingMock: boolean }> {
  const results: NormalizedNews[] = [];
  let usingMock = false;

  // Proveedor 1: NewsAPI
  try {
    const items = await fetchFromNewsAPI();
    results.push(...items);
    console.log(`[ingest-news] NewsAPI: ${items.length} noticias`);
  } catch (err) {
    console.warn(`[ingest-news] NewsAPI falló: ${err}. Fallback a mock (RNF-009).`);
    usingMock = true;
  }

  // Proveedor 2: Yahoo RSS
  try {
    const items = await fetchFromYahooRSS();
    results.push(...items);
    console.log(`[ingest-news] Yahoo RSS: ${items.length} noticias`);
  } catch (err) {
    console.warn(`[ingest-news] Yahoo RSS falló: ${err}. Fallback a mock (RNF-009).`);
    usingMock = true;
  }

  // Si ambos fallaron: usar mock completo
  if (results.length === 0) {
    console.warn('[ingest-news] Ambas fuentes fallaron. Usando feed de prueba completo (RF-023).');
    return { news: getMockFeed(), usingMock: true };
  }

  // Si solo un proveedor funcionó: complementar con mock del otro
  if (usingMock) {
    const mockItems = getMockFeed().slice(0, 5);
    results.push(...mockItems);
  }

  return { news: results, usingMock };
}

// ─── Validación RN-06 ─────────────────────────────────────────
function isValid(item: NormalizedNews): boolean {
  if (!item.source?.trim()) {
    console.warn(`[ingest-news] Rechazada (sin fuente): "${item.title}"`);
    return false;
  }
  if (!item.published_at || isNaN(Date.parse(item.published_at))) {
    console.warn(`[ingest-news] Rechazada (sin fecha válida): "${item.title}"`);
    return false;
  }
  if (!item.title?.trim()) {
    console.warn('[ingest-news] Rechazada (sin título)');
    return false;
  }
  return true;
}

// ─── Handler principal ────────────────────────────────────────
serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Obtener noticias de fuentes (con fallback)
    const { news, usingMock } = await fetchNewsFromSources();

    // 2. Filtrar: RN-06 (sin fuente ni fecha) + deduplicar por título
    const valid   = news.filter(isValid);
    const unique  = valid.filter((n, i, arr) => arr.findIndex(x => x.title === n.title) === i);

    console.log(`[ingest-news] ${unique.length} noticias válidas para insertar (usando mock: ${usingMock})`);

    // 3. Insertar en Supabase (upsert por título+fuente para evitar duplicados)
    const { data, error } = await supabase
      .from('news')
      .upsert(
        unique.map(n => ({
          title:        n.title,
          content:      n.content,
          source:       n.source,
          published_at: n.published_at,
          sector:       n.sector,
          is_test_data: n.is_test_data,
        })),
        { onConflict: 'title', ignoreDuplicates: true }
      )
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({
      data: {
        inserted:   data?.length ?? 0,
        total:      unique.length,
        using_mock: usingMock,
      },
      error: null,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.error('[ingest-news] Error:', err);
    return new Response(JSON.stringify({
      data: null,
      error: { message: String(err) },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
