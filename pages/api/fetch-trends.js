// pages/api/fetch-trends.js
// One-stop endpoint: fetches all series using Yahoo Finance (and BTC from CoinGecko),
// normalizes them to 0–100, merges by date, and returns both normalized and *_raw.

import pLimit from 'p-limit';

const DAY = 86400000;

/** ---------- helpers ---------- */
function normalizeArray(arr) {
  const vals = arr.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!vals.length) return arr.map(() => null);
  const min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) return arr.map(() => 50);
  return arr.map(v => (v == null ? null : ((v - min) / (max - min)) * 100));
}

function mergeSeries(seriesList) {
  const byDate = new Map();
  for (const s of seriesList) {
    for (const row of s.data) {
      const key = row.date;
      const obj = byDate.get(key) || { date: key };
      if (row.value != null) obj[s.name] = row.value;           // normalized
      if (row.raw != null)   obj[`${s.name}_raw`] = row.raw;    // raw value
      byDate.set(key, obj);
    }
  }
  return [...byDate.values()].sort((a,b)=>new Date(a.date)-new Date(b.date));
}

/** Yahoo Finance daily close */
async function fetchYahooDaily(symbol, days) {
  const end = Math.floor(Date.now()/1000);
  const start = end - days*86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=1d`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  const ts = res?.timestamp || [];
  const closes = res?.indicators?.quote?.[0]?.close || [];
  return ts.map((t,i)=>({
    date: new Date(t*1000).toISOString().slice(0,10),
    value: closes[i]
  }));
}

/** CoinGecko BTC daily prices (USD) */
async function fetchCoinGeckoBTC(days) {
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
    { headers: { accept: 'application/json' } }
  );
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const j = await r.json();
  return (j.prices || []).map(([t, price]) => ({
    date: new Date(t).toISOString().slice(0,10),
    value: price
  }));
}

/** ---------- proxy mapping (edit freely) ----------
 * Left side = the name you want to see on the chart/heatmap
 * Right side = market proxy symbol & fetcher
 */
const SERIES = [
  // already-present trio
  { name: 'gold',          kind: 'yahoo',     symbol: 'GC=F' },   // Gold futures
  { name: 'nasdaq',        kind: 'yahoo',     symbol: '^IXIC' },  // Nasdaq Composite
  { name: 'bitcoin',       kind: 'coingecko', symbol: 'BTC' },    // BTC-USD (CoinGecko)

  // proxies for your Google-trend ideas
  { name: 'cosmetics',              kind: 'yahoo', symbol: 'EL' },     // Estée Lauder
  { name: 'lipstick',               kind: 'yahoo', symbol: 'ULTA' },   // Ulta Beauty
  { name: 'male underwear',         kind: 'yahoo', symbol: 'HBI' },    // Hanesbrands
  { name: 'PMI index',              kind: 'yahoo', symbol: 'IYJ' },    // Industrials ETF (PMI proxy)
  { name: 'interest rates',         kind: 'yahoo', symbol: '^TNX' },   // 10y Treasury yield
  { name: 'mortgage lending',       kind: 'yahoo', symbol: 'MORT' },   // Mortgage REIT ETF
  { name: 'credit card debt',       kind: 'yahoo', symbol: 'AXP' },    // American Express
  { name: 'job openings',           kind: 'yahoo', symbol: 'RHI' },    // Robert Half (staffing)
  { name: 'house prices',           kind: 'yahoo', symbol: 'ITB' },    // Home construction ETF
  { name: 'European Central Bank',  kind: 'yahoo', symbol: 'FEZ' },    // Euro STOXX 50 ETF
  { name: 'Federal Reserve',        kind: 'yahoo', symbol: 'KRE' },    // Regional banks ETF
  { name: 'Bank for International Settlements', kind: 'yahoo', symbol: 'IXG' } // Global financials
];

/** ---------- API handler ---------- */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? parseInt(req.query.days, 10)
    : 180;

  const limit = pLimit(4); // polite concurrency

  try {
    const series = await Promise.all(
      SERIES.map(s =>
        limit(async () => {
          try {
            let rows;
            if (s.kind === 'yahoo') {
              rows = await fetchYahooDaily(s.symbol, days);
            } else if (s.kind === 'coingecko') {
              rows = await fetchCoinGeckoBTC(days);
            } else {
              rows = [];
            }

            const norm = normalizeArray(rows.map(r => r.value));
            return {
              name: s.name,
              data: rows.map((r, i) => ({
                date: r.date,
                raw: r.value,
                value: norm[i]
              }))
            };
          } catch (e) {
            console.error(`Series failed [${s.name} ${s.symbol || ''}]:`, e.message);
            return { name: s.name, data: [] };
          }
        })
      )
    );

    const merged = mergeSeries(series);

    if (req.query.debug === '1') {
      const keys = Object.keys(merged[0] || {}).filter(k => k !== 'date');
      const counts = {}; for (const k of keys) counts[k] = merged.filter(r => r[k] != null).length;
      return res.status(200).json({
        signature: 'fetch-trends-proxy-v1',
        rows: merged.length,
        series: keys,
        countsPerSeries: counts,
        sampleStart: merged.slice(0, 2),
        sampleEnd: merged.slice(-2)
      });
    }

    return res.status(200).json(merged);
  } catch (err) {
    console.error('fetch-trends error:', err);
    return res.status(500).json({ error: 'Failed to fetch trends', detail: String(err) });
  }
}

// Not strictly required here (no google-trends-api), but harmless if kept:
export const config = { runtime: 'nodejs' };
