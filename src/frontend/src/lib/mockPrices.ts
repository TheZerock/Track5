/* ============================================================
 * mockPrices.ts
 * Generador de precios SIMULADOS y deterministas por activo.
 * No hay ninguna API de precios de mercado conectada al proyecto
 * (NewsAPI/Yahoo RSS son de noticias, no de cotizaciones) — estos
 * valores son ilustrativos, no datos financieros reales, y deben
 * mostrarse siempre junto con un aviso claro para el usuario.
 * ============================================================ */
import type { AssetType } from '../types/database';

export interface PricePoint {
  time: string; // ISO
  price: number;
}

// Precio base aproximado por símbolo (referencia julio 2026, solo para que
// las cifras se vean plausibles — no se actualiza con el mercado real).
const BASE_PRICES: Record<string, number> = {
  AAPL: 196, MSFT: 421, GOOGL: 168, AMZN: 179, TSLA: 244, JPM: 206, XOM: 113,
  BTC: 74500, ETH: 3520, SOL: 172,
  SPY: 548, QQQ: 472, GLD: 226,
  GOLD: 2445, WTI: 76,
  EURUSD: 1.086, USDMXN: 17.14,
  TLT: 92,
};

const VOLATILITY: Record<AssetType, number> = {
  'Acción': 0.011,
  'Cripto': 0.028,
  'ETF': 0.007,
  'Bono': 0.004,
  'Commodity': 0.013,
  'Divisa': 0.003,
  'Otro': 0.014,
};

// Rango de variación total del período (tendencia general, no ruido) por tipo de activo.
const TREND_RANGE: Record<AssetType, number> = {
  'Acción': 0.09,
  'Cripto': 0.20,
  'ETF': 0.06,
  'Bono': 0.03,
  'Commodity': 0.10,
  'Divisa': 0.035,
  'Otro': 0.09,
};

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// PRNG determinista (mulberry32) — misma semilla = misma serie siempre.
function mulberry32(seed: number) {
  let s = seed;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function basePriceFor(symbol: string): number {
  return BASE_PRICES[symbol] ?? 100;
}

export function decimalsFor(price: number): number {
  return price < 10 ? 4 : 2;
}

/**
 * Genera una serie de precios determinista y creíble para un símbolo:
 * una tendencia general clara para el período (alcista o bajista, según
 * el símbolo y el rango) más ruido realista en cada paso. Así una caída
 * se ve como una caída de verdad, no como ruido centrado sin dirección.
 * `points` puntos distribuidos uniformemente en las últimas `hoursSpan` horas.
 */
export function generatePriceSeries(symbol: string, type: AssetType, points: number, hoursSpan: number): PricePoint[] {
  const base = basePriceFor(symbol);
  const vol = VOLATILITY[type] ?? 0.015;
  const trendRange = TREND_RANGE[type] ?? 0.09;
  const rand = mulberry32(hashSeed(`${symbol}:${points}:${hoursSpan}`));
  const now = Date.now();
  const stepMs = (hoursSpan * 3600 * 1000) / Math.max(points - 1, 1);

  // Tendencia objetivo del período completo (puede ser negativa: una caída real).
  const targetChange = (rand() * 2 - 1) * trendRange;
  const startPrice = base * (0.97 + rand() * 0.06);

  const series: PricePoint[] = [];
  for (let i = 0; i < points; i++) {
    const progress = i / Math.max(points - 1, 1);
    // Trayectoria suave hacia la tendencia objetivo (curva, no lineal, para verse más orgánica)
    const eased = 1 - Math.pow(1 - progress, 1.6);
    const trendPrice = startPrice * (1 + targetChange * eased);
    // Ruido de mercado por paso, alrededor de la trayectoria de tendencia
    const noise = (rand() - 0.5) * vol * 2;
    const price = Math.max(trendPrice * (1 + noise), base * 0.25);
    const decimals = decimalsFor(price);
    series.push({
      time: new Date(now - (points - 1 - i) * stepMs).toISOString(),
      price: Number(price.toFixed(decimals)),
    });
  }
  return series;
}

export function formatPrice(price: number): string {
  const decimals = decimalsFor(price);
  return price.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
