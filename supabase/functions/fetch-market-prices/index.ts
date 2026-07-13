/* ============================================================
 * Edge Function: fetch-market-prices
 * SRS §3.1, RF-013 — Precios en tiempo real para el dashboard.
 *
 * Fuentes por tipo de instrumento:
 *   - Acción / ETF  -> Alpha Vantage TIME_SERIES_INTRADAY (5min)
 *   - Cripto        -> CoinGecko market_chart (days=1, ~5min de resolución)
 *   - Divisa        -> Alpha Vantage FX_INTRADAY (5min)
 *   - Commodity     -> proxy con el ETF GLD (ver docs/notas-fuera-de-alcance.md
 *                      — Metals-API no está integrada por defecto; si se
 *                      configura METALS_API_KEY, se usa en su lugar)
 *
 * RNF-009: si una fuente falla o se agota el límite, se cae a un precio
 * de prueba determinista marcado con is_test_data = true.
 *
 * Caché PERSISTENTE en la tabla `market_price_cache` (no en memoria):
 * sobrevive a los cold starts de la función y se comparte entre todos
 * los usuarios. TTL largo (6 horas) porque Alpha Vantage free es de
 * 25 requests/día EN TOTAL y cada ciclo de refresco usa ~9 (acciones+FX):
 * con eso solo alcanzan ~2-3 refrescos completos por día, así que un
 * caché corto no sirve de nada — hay que estirarlo.
 * ============================================================ */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALPHA_VANTAGE_KEY    = Deno.env.get('ALPHA_VANTAGE_API_KEY');
const METALS_API_KEY       = Deno.env.get('METALS_API_KEY'); // opcional

// 6 horas: con 25 requests/día y ~9 símbolos dependientes de Alpha Vantage
// por ciclo, esto deja margen para ~3-4 refrescos reales al día sin agotar
// el cupo (en vez de agotarlo con la segunda recarga de página del día).
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SPARKLINE_POINTS = 100;

interface AssetRow {
  id: string;
  symbol: string;
  type: 'Acción' | 'Cripto' | 'ETF' | 'Bono' | 'Commodity' | 'Divisa' | 'Otro';
}

interface NormalizedPrice {
  asset_id: string;
  symbol: string;
  price: number;
  change_pct: number;
  sparkline_data: number[];
  is_test_data: boolean;
  source: string;
}

// ─── Caché persistente (tabla market_price_cache, migración 007) ──
async function fromCache(supabase: any, symbol: string): Promise<NormalizedPrice | null> {
  const { data } = await supabase
    .from('market_price_cache')
    .select('*')
    .eq('symbol', symbol)
    .maybeSingle();

  if (!data) return null;
  const ageMs = Date.now() - new Date(data.updated_at).getTime();
  if (ageMs > CACHE_TTL_MS) return null;

  return {
    asset_id: data.asset_id,
    symbol: data.symbol,
    price: Number(data.price),
    change_pct: Number(data.change_pct),
    sparkline_data: data.sparkline_data ?? [],
    is_test_data: data.is_test_data,
    source: data.source,
  };
}

async function saveCache(supabase: any, data: NormalizedPrice) {
  await supabase.from('market_price_cache').upsert({
    symbol: data.symbol,
    asset_id: data.asset_id,
    price: data.price,
    change_pct: data.change_pct,
    sparkline_data: data.sparkline_data,
    is_test_data: data.is_test_data,
    source: data.source,
    updated_at: new Date().toISOString(),
  });
}

function downsample(points: number[], max: number): number[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const result: number[] = [];
  for (let i = 0; i < max; i++) result.push(points[Math.floor(i * step)]);
  return result;
}

// ─── Fallback determinista (RNF-009) ──────────────────────────
const FALLBACK_BASE: Record<string, number> = {
  AAPL: 196, MSFT: 421, GOOGL: 168, AMZN: 179, TSLA: 244, JPM: 206, XOM: 113,
  BTC: 74500, ETH: 3520, SOL: 172,
  SPY: 548, QQQ: 472, GLD: 226,
  GOLD: 2445, WTI: 76,
  EURUSD: 1.086, USDMXN: 17.14,
  TLT: 92,
};

function fallbackPrice(asset: AssetRow): NormalizedPrice {
  const base = FALLBACK_BASE[asset.symbol] ?? 100;
  return {
    asset_id: asset.id,
    symbol: asset.symbol,
    price: base,
    change_pct: 0,
    sparkline_data: Array(12).fill(base),
    is_test_data: true,
    source: 'fallback',
  };
}

// ─── Alpha Vantage: acciones / ETFs (serie intradía completa) ──
async function fetchStockQuote(asset: AssetRow): Promise<NormalizedPrice> {
  if (!ALPHA_VANTAGE_KEY) throw new Error('ALPHA_VANTAGE_API_KEY no configurada');

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${asset.symbol}&interval=5min&outputsize=compact&apikey=${ALPHA_VANTAGE_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);

  const json = await res.json();
  const series = json['Time Series (5min)'];
  if (!series) {
    throw new Error(json['Note'] || json['Information'] || 'Respuesta vacía de Alpha Vantage (intraday)');
  }

  // Las claves vienen más reciente -> más antiguo; las invertimos para el sparkline.
  const timestamps = Object.keys(series).sort();
  const closes = timestamps.map(t => parseFloat(series[t]['4. close']));
  const price = closes[closes.length - 1];
  const first = closes[0];
  const changePct = first !== 0 ? ((price - first) / first) * 100 : 0;

  return {
    asset_id: asset.id,
    symbol: asset.symbol,
    price,
    change_pct: changePct,
    sparkline_data: downsample(closes, MAX_SPARKLINE_POINTS),
    is_test_data: false,
    source: 'alphavantage-intraday',
  };
}

// ─── Alpha Vantage: divisas (serie intradía completa) ─────────
async function fetchFxQuote(asset: AssetRow): Promise<NormalizedPrice> {
  if (!ALPHA_VANTAGE_KEY) throw new Error('ALPHA_VANTAGE_API_KEY no configurada');

  const [from, to] = splitFxPair(asset.symbol);
  const url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=5min&outputsize=compact&apikey=${ALPHA_VANTAGE_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);

  const json = await res.json();
  const series = json['Time Series FX (5min)'];
  if (!series) throw new Error(json['Note'] || json['Information'] || 'Respuesta vacía de Alpha Vantage FX (intraday)');

  const timestamps = Object.keys(series).sort();
  const closes = timestamps.map(t => parseFloat(series[t]['4. close']));
  const price = closes[closes.length - 1];
  const first = closes[0];
  const changePct = first !== 0 ? ((price - first) / first) * 100 : 0;

  return {
    asset_id: asset.id,
    symbol: asset.symbol,
    price,
    change_pct: changePct,
    sparkline_data: downsample(closes, MAX_SPARKLINE_POINTS),
    is_test_data: false,
    source: 'alphavantage-intraday',
  };
}

function splitFxPair(symbol: string): [string, string] {
  if (symbol.includes('/')) {
    const [a, b] = symbol.split('/');
    return [a.trim(), b.trim()];
  }
  return [symbol.slice(0, 3), symbol.slice(3, 6)];
}

// ─── CoinGecko: criptoactivos (no requiere API key) ───────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
};

async function fetchCryptoQuote(asset: AssetRow): Promise<NormalizedPrice> {
  const coinId = COINGECKO_IDS[asset.symbol];
  if (!coinId) throw new Error(`Símbolo cripto no mapeado a CoinGecko: ${asset.symbol}`);

  const [priceRes, chartRes] = await Promise.all([
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(8000) }),
    fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`, { signal: AbortSignal.timeout(8000) }),
  ]);

  if (!priceRes.ok) throw new Error(`CoinGecko HTTP ${priceRes.status}`);
  const priceJson = await priceRes.json();
  const entry = priceJson[coinId];
  if (!entry) throw new Error('CoinGecko no devolvió precio para ' + coinId);

  // market_chart?days=1 da ~5 min de resolución (~288 puntos) — antes se
  // recortaba a 12 y por eso se veía plano. Ahora conservamos hasta 100.
  let sparkline: number[] = [entry.usd];
  if (chartRes.ok) {
    const chartJson = await chartRes.json();
    const prices: [number, number][] = chartJson.prices ?? [];
    if (prices.length > 0) sparkline = downsample(prices.map(p => p[1]), MAX_SPARKLINE_POINTS);
  }

  return {
    asset_id: asset.id,
    symbol: asset.symbol,
    price: entry.usd,
    change_pct: entry.usd_24h_change ?? 0,
    sparkline_data: sparkline,
    is_test_data: false,
    source: 'coingecko',
  };
}

// ─── Commodities: proxy con GLD, o Metals-API si hay key ──────
async function fetchCommodityQuote(asset: AssetRow, allAssets: AssetRow[]): Promise<NormalizedPrice> {
  if (METALS_API_KEY) {
    const symbolMap: Record<string, string> = { GOLD: 'XAU', SILVER: 'XAG' };
    const metalSymbol = symbolMap[asset.symbol];
    if (metalSymbol) {
      const url = `https://metals-api.com/api/latest?access_key=${METALS_API_KEY}&base=USD&symbols=${metalSymbol}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = await res.json();
        const rate = json?.rates?.[metalSymbol];
        if (rate) {
          const price = 1 / rate;
          return {
            asset_id: asset.id, symbol: asset.symbol, price, change_pct: 0,
            sparkline_data: [price], is_test_data: false, source: 'metals-api',
          };
        }
      }
    }
  }

  // Proxy: precio del ETF GLD (documentado en docs/notas-fuera-de-alcance.md).
  const gld = allAssets.find(a => a.symbol === 'GLD');
  if (gld) {
    const gldPrice = await fetchStockQuote(gld);
    return { ...gldPrice, asset_id: asset.id, symbol: asset.symbol, source: 'proxy-gld' };
  }

  throw new Error('Sin fuente disponible para commodity ' + asset.symbol);
}

// ─── Orquestador por tipo de activo ───────────────────────────
async function fetchPriceFor(supabase: any, asset: AssetRow, allAssets: AssetRow[]): Promise<NormalizedPrice> {
  const cached = await fromCache(supabase, asset.symbol);
  if (cached) return cached;

  let result: NormalizedPrice;
  try {
    switch (asset.type) {
      case 'Acción':
      case 'ETF':
        result = await fetchStockQuote(asset);
        break;
      case 'Cripto':
        result = await fetchCryptoQuote(asset);
        break;
      case 'Divisa':
        result = await fetchFxQuote(asset);
        break;
      case 'Commodity':
        result = await fetchCommodityQuote(asset, allAssets);
        break;
      default:
        result = fallbackPrice(asset);
    }
  } catch (err) {
    console.warn(`[fetch-market-prices] ${asset.symbol} falló (${asset.type}): ${err}. Usando fallback (RNF-009).`);
    result = fallbackPrice(asset);
  }

  await saveCache(supabase, result);
  return result;
}

// ─── CORS ────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Handler principal ─────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const requestedIds: string[] | undefined = body.asset_ids;

    let query = supabase.from('assets').select('id, symbol, type');
    if (requestedIds && requestedIds.length > 0) query = query.in('id', requestedIds);
    const { data: assets, error } = await query;
    if (error) throw error;
    if (!assets || assets.length === 0) {
      return new Response(JSON.stringify({ data: [], error: null }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Se resuelven en serie (no en paralelo) para no ráfaguear el límite
    // diario de Alpha Vantage con múltiples requests simultáneos.
    const results: NormalizedPrice[] = [];
    for (const asset of assets as AssetRow[]) {
      results.push(await fetchPriceFor(supabase, asset, assets as AssetRow[]));
    }

    return new Response(JSON.stringify({ data: results, error: null }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('[fetch-market-prices] Error:', err);
    return new Response(JSON.stringify({ data: null, error: { message: String(err) } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
