// pages/api/fetch-trends.js
// Robust fetcher (Yahoo + CoinGecko) with clear diagnostics.
// If nothing is usable, responds with 503 (never returns []).
// Use ?debug=1 for a detailed payload, or ?sig=1 for a quick signature.

import pLimit from 'p-limit';

const UA = 'Mozilla/5.0 (compatible; QuickLookBot/1.0; +https://quicklook.market)';
const DAY = 86400000;

// ---------- utils ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeArray(arr) {
  const vals = arr.filter((v) => Number.isFinite(v));
  if (!vals.length) return arr.map(() => null);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return arr.map(() => 50);
  return arr.map((v) => (v == null ? null : ((v - min) / (max - min)) * 100));
}

function mergeSeries(seriesList) {
  const byDate = new Map();
  for (const s of seriesList) {
    for (const row of s.data) {
      const key = row.date;
      const obj = byDate.get(key) || { date: key };
      if (row.value != null) obj[s.name] = row.value;
      if (row.raw != null)   obj[`${s.name}_raw`] = row.raw;
      byDate.set(key, obj);
    }
  }
  return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ---------- fetchers ----------
async function fetchYahooDaily(symbol, days, diag) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=1d`;

  let status = 0, lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
      status = r.status;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      const ts = res?.timestamp || [];
      const closes = res?.indicators?.quote?.[0]?.close || [];
      const rows = ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        value: closes[i],
      }));
      Object.assign(diag, { ok: true, http: status, points: rows.length, attempt });
      return rows;
    } catch (e) {
      lastErr = e;
      Object.assign(diag, { ok: false, http: status, error: String(e?.message || e), attempt });
      await sleep(300 * attempt);
    }
  }
  return [];
}

async function fetchCoinGeckoBTC(days, diag) {
  let status = 0;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
      { headers: { accept: 'application/json', 'user-agent': UA } }
    );
    status = r.status;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const rows = (j.prices || []).map(([t, price]) => ({
      date: new Date(t).toISOString().slice(0, 10),
      value: price,
    }));
    Object.assign(diag, { ok: true, http: status, points: rows.length });
    return rows;
  } catch (e) {
    Object.assign(diag, { ok: false, http: status, error: String(e?.message || e) });
    return [];
  }
}

// “labels” you want on the chart → data sources we fetch

const series = [
  { name: "Gold (search)", kind: "yahoo", symbol: "GLD" },
  { name: "Bitcoin (search)", kind: "coingecko", symbol: "BTC" },
  { name: "Nasdaq (search)", kind: "yahoo", symbol: "^IXIC" },

  // Cosmetics/Lipstick via Google Trends keyword
  { name: "Cosmetics / Lipstick", kind: "google", keyword: "lipstick" },

  // Male Underwear via Google Trends keyword
  { name: "Male Underwear", kind: "google", keyword: "male underwear" }
];

  // feel free to add more here later…
];

export default async function handler(req, res) {
  // quick signature ping
  if (req.query.sig === '1') {
    return res.status(200).json({
      signature: 'fetch-trends-v3-robust-2025-08-26',
      ts: new Date().toISOString(),
      note: 'Use ?debug=1 to see diagnostics.',
    });
  }

  res.setHeader('Cache-Control', 'no-store');

  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? Math.max(30, parseInt(req.query.days, 10))
    : 365; // default 12 months

  const limit = pLimit(1); // serial keeps Yahoo happy
  const diagnostics = [];
  const assembled = [];

  try {
    const results = await Promise.all(
      SERIES.map((s) =>
        limit(async () => {
          const diag = { name: s.name, kind: s.kind, symbol: s.symbol };
          let rows = [];
          if (s.kind === 'yahoo') rows = await fetchYahooDaily(s.symbol, days, diag);
          else if (s.kind === 'coingecko') rows = await fetchCoinGeckoBTC(days, diag);

          diagnostics.push(diag);

          if (rows.length) {
            const norm = normalizeArray(rows.map((r) => r.value));
            assembled.push({
              name: s.name,
              data: rows.map((r, i) => ({ date: r.date, raw: r.value, value: norm[i] })),
            });
          }
        })
      )
    );

    const merged = mergeSeries(assembled);
    const seriesKeys = Object.keys(merged[0] || {}).filter((k) => k !== 'date');

    // Always return a rich object in debug mode
    if (req.query.debug === '1') {
      const counts = {};
      for (const k of seriesKeys) counts[k] = merged.filter((r) => r[k] != null).length;
      return res.status(200).json({
        signature: 'fetch-trends-v3-robust-2025-08-26',
        rows: merged.length,
        series: seriesKeys,
        countsPerSeries: counts,
        diagnostics,
        sampleStart: merged.slice(0, 2),
        sampleEnd: merged.slice(-2),
      });
    }

    // If nothing usable, report clearly (don’t return [])
    if (!merged.length) {
      return res.status(503).json({
        error: 'No usable data from upstream sources.',
        hint: 'Open this endpoint with ?debug=1 to see per-series diagnostics.',
        diagnostics,
      });
    }

    // Normal OK response (array of rows)
    return res.status(200).json(merged);
  } catch (err) {
    console.error('fetch-trends fatal error:', err);
    return res.status(500).json({
      error: 'Failed to build trends',
      detail: String(err),
      diagnostics,
    });
  }
}

export const config = { runtime: 'nodejs' };
