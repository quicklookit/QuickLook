// pages/api/fetch-trends.js
// Gold & Nasdaq from Yahoo, BTC from CoinGecko,
// Cosmetics/Lipstick + Male Underwear from Google Trends (distinct keywords).
// Includes retries, normalization, and ?debug=1 diagnostics.

import googleTrends from 'google-trends-api';
import pLimit from 'p-limit';

/* ===================== helpers ===================== */

const DAY = 24 * 60 * 60 * 1000;
const UA =
  'Mozilla/5.0 (compatible; QuickLookBot/1.0; +https://quicklook.market)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeArray(arr) {
  const vals = arr.filter((v) => typeof v === 'number' && Number.isFinite(v));
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
      const key = row.date; // YYYY-MM-DD
      const obj = byDate.get(key) || { date: key };
      if (row.value != null) obj[s.name] = row.value;
      if (row.raw != null) obj[`${s.name}_raw`] = row.raw;
      byDate.set(key, obj);
    }
  }
  return [...byDate.values()].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
}

/* ===================== fetchers ===================== */

// Yahoo Finance daily close
async function fetchYahooDaily(symbol, days, diag) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${start}&period2=${end}&interval=1d`;

  diag.http = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': UA },
      });
      diag.http = r.status;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      const ts = res?.timestamp || [];
      const closes = res?.indicators?.quote?.[0]?.close || [];
      const rows = ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        value: closes[i],
      }));
      diag.ok = true;
      diag.points = rows.length;
      diag.attempt = attempt;
      return rows;
    } catch (e) {
      diag.ok = false;
      diag.error = String(e?.message || e);
      diag.attempt = attempt;
      await sleep(350 * attempt);
    }
  }
  return [];
}

// CoinGecko BTC daily USD
async function fetchCoinGeckoBTC(days, diag) {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;
  try {
    const r = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': UA },
    });
    diag.http = r.status;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const rows = (j.prices || []).map(([t, price]) => ({
      date: new Date(t).toISOString().slice(0, 10),
      value: price,
    }));
    diag.ok = true;
    diag.points = rows.length;
    return rows;
  } catch (e) {
    diag.ok = false;
    diag.error = String(e?.message || e);
    return [];
  }
}

// Google Trends keyword — segmented (30-day windows) to get daily resolution
async function fetchGoogleKeyword(keyword, days, diag) {
  const endTime = new Date();
  const startTime = new Date(Date.now() - days * DAY);

  // Build 30-day segments (with 1-day overlap)
  const segments = [];
  for (let t = new Date(startTime); t < endTime; ) {
    const segStart = new Date(t);
    const segEnd = new Date(Math.min(segStart.getTime() + 30 * DAY, endTime));
    segments.push({ segStart, segEnd });
    t = new Date(segEnd.getTime() + 1 * DAY);
  }

  const parts = [];
  for (const { segStart, segEnd } of segments) {
    try {
      const json = await googleTrends.interestOverTime({
        keyword,
        startTime: segStart,
        endTime: segEnd,
        geo: '', // global
        hl: 'en-US',
        timezone: 0,
        granularTimeResolution: true,
      });
      const parsed = JSON.parse(json);
      const arr = parsed?.default?.timelineData ?? [];
      parts.push(...arr);
    } catch (e) {
      // keep going; a missing segment just reduces points
      diag.errors = [...(diag.errors || []), String(e?.message || e)];
    }
    await sleep(150); // be polite
  }

  // Deduplicate by unix seconds
  const byTs = new Map();
  for (const e of parts) byTs.set(String(e.time), e);
  const flat = [...byTs.values()].sort(
    (a, b) => Number(a.time) - Number(b.time)
  );

  const rawRows = flat.map((t) => ({
    date: new Date(Number(t.time) * 1000).toISOString().slice(0, 10),
    raw: Array.isArray(t.value) ? t.value[0] : t.value,
  }));
  const norm = normalizeArray(rawRows.map((r) => r.raw));
  const rows = rawRows.map((r, i) => ({
    date: r.date,
    raw: r.raw,
    value: norm[i],
  }));

  diag.ok = rows.length > 0;
  diag.points = rows.length;
  return rows;
}

/* ===================== API ===================== */

export default async function handler(req, res) {
  // don’t cache while you iterate
  res.setHeader('Cache-Control', 'no-store');

  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? parseInt(req.query.days, 10)
    : 365;

  // Define distinct sources (no extra bracket below!)
  const SOURCES = [
    { name: 'Gold (search)', kind: 'yahoo', symbol: 'GLD' },
    { name: 'Bitcoin (search)', kind: 'coingecko', symbol: 'BTC' },
    { name: 'Nasdaq (search)', kind: 'yahoo', symbol: '^IXIC' },

    // Google Trends keywords (distinct)
    { name: 'Cosmetics / Lipstick', kind: 'google', keyword: 'lipstick' },
    { name: 'Male Underwear', kind: 'google', keyword: 'male underwear' },
  ];

  // Keep concurrency low to avoid throttling
  const limit = pLimit(2);
  const diagnostics = [];

  try {
    const series = await Promise.all(
      SOURCES.map((src) =>
        limit(async () => {
          const diag = {
            name: src.name,
            kind: src.kind,
            symbol: src.symbol,
            keyword: src.keyword,
          };

          let rows = [];
          if (src.kind === 'yahoo') {
            rows = await fetchYahooDaily(src.symbol, days, diag);
          } else if (src.kind === 'coingecko') {
            rows = await fetchCoinGeckoBTC(days, diag);
          } else if (src.kind === 'google') {
            rows = await fetchGoogleKeyword(src.keyword, days, diag);
          }

          diagnostics.push(diag);

          // Normalize market rows (google rows already normalized inside)
          if (src.kind !== 'google') {
            const norm = normalizeArray(rows.map((r) => r.value));
            rows = rows.map((r, i) => ({
              date: r.date,
              raw: r.value,
              value: norm[i],
            }));
          }

          return { name: src.name, data: rows };
        })
      )
    );

    const merged = mergeSeries(series);

    if (req.query.debug === '1') {
      const keys = Object.keys(merged[0] || {}).filter((k) => k !== 'date');
      const counts = {};
      for (const k of keys) counts[k] = merged.filter((r) => r[k] != null).length;
      return res.status(200).json({
        signature: 'fetch-trends-v4-lipstick-underwear-separated',
        rows: merged.length,
        series: keys,
        countsPerSeries: counts,
        diagnostics,
        sampleStart: merged.slice(0, 2),
        sampleEnd: merged.slice(-2),
      });
    }

    return res.status(200).json(merged);
  } catch (err) {
    console.error('fetch-trends error:', err);
    return res
      .status(500)
      .json({ error: 'Failed to fetch trends', detail: String(err) });
  }
}
