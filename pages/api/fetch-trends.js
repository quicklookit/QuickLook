// pages/api/fetch-trends.js
import googleTrends from 'google-trends-api';
import pLimit from 'p-limit';

/* -------------------- helpers -------------------- */

// Normalize an array to 0–100 (leaves nulls as null)
function normalizeArray(arr) {
  const vals = arr.filter(v => typeof v === 'number' && !Number.isNaN(v));
  if (!vals.length) return arr.map(() => null);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return arr.map(() => 50);
  return arr.map(v => (v == null ? null : ((v - min) / (max - min)) * 100));
}

// Merge series by date; keep both normalized and raw columns
function mergeSeries(seriesList) {
  const byDate = new Map();
  for (const s of seriesList) {
    for (const row of s.data) {
      const key = row.date;
      const obj = byDate.get(key) || { date: key };
      if (row.value != null) obj[s.name] = row.value;           // normalized
      if (row.raw != null)   obj[`${s.name}_raw`] = row.raw;    // raw
      byDate.set(key, obj);
    }
  }
  return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Fetch Google Trends for a keyword in small segments to avoid coarse aggregation
async function fetchGoogleTrendOverSegments(keyword, startTime, endTime, segmentDays = 30) {
  const segments = [];
  for (let t = new Date(startTime); t < endTime; ) {
    const segStart = new Date(t);
    const segEnd = new Date(
      Math.min(segStart.getTime() + segmentDays * 24 * 60 * 60 * 1000, endTime.getTime())
    );
    segments.push({ segStart, segEnd });
    // small overlap to avoid gaps
    t = new Date(segEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  const parts = await Promise.all(
    segments.map(async ({ segStart, segEnd }) => {
      const json = await googleTrends.interestOverTime({
        keyword,
        startTime: segStart,
        endTime: segEnd,
        geo: '',
        hl: 'en-US',
        timezone: 0,
        granularTimeResolution: true,
      });
      const parsed = JSON.parse(json);
      return parsed?.default?.timelineData ?? [];
    })
  );

  // Deduplicate by timestamp (Google returns unix seconds in .time)
  const byTs = new Map();
  for (const arr of parts) {
    for (const e of arr) byTs.set(e.time, e);
  }
  const flat = [...byTs.values()].sort((a, b) => Number(a.time) - Number(b.time));

  // Map to {date, raw, value}
  const rows = flat.map((t) => ({
    date: new Date(Number(t.time) * 1000).toISOString().slice(0, 10),
    raw: Array.isArray(t.value) ? t.value[0] : t.value,
  }));
  const norm = normalizeArray(rows.map(r => r.raw));
  return rows.map((r, i) => ({ date: r.date, raw: r.raw, value: norm[i] }));
}

// Yahoo Finance daily close (uses Next.js/Vercel built-in fetch — no extra deps)
async function fetchYahooDaily(symbol, days) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${start}&period2=${end}&interval=1d`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`);
  const json = await r.json();
  const res = json?.chart?.result?.[0];
  const ts = res?.timestamp || [];
  const closes = res?.indicators?.quote?.[0]?.close || [];
  return ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    value: closes[i],
  }));
}

// CoinGecko Bitcoin daily prices (USD)
async function fetchCoinGeckoBTC(days) {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;
  const r = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const json = await r.json();
  // json.prices: [ [timestamp_ms, price], ... ]
  return (json.prices || []).map(([t, price]) => ({
    date: new Date(t).toISOString().slice(0, 10),
    value: price,
  }));
}

/* -------------------- API route -------------------- */

export default async function handler(req, res) {
  // mark which implementation served the request
  res.setHeader('X-Route-Impl', 'pages');

  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? parseInt(req.query.days, 10)
    : 180;

  const endTime = new Date();
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const searchKeywords = [
    'cosmetics',
    'lipstick',
    'male underwear',
    'PMI index',
    'interest rates',
    'mortgage lending',
    'credit card debt',
    'job openings',
    'house prices',
    'European Central Bank',
    'Federal Reserve',
    'Bank for International Settlements',
  ];

  const limit = pLimit(3);

  try {
    // ----- Google Trends (normalized + raw) -----
    const googleSeries = await Promise.all(
      searchKeywords.map(kw =>
        limit(async () => {
          try {
            const rows = await fetchGoogleTrendOverSegments(kw, startTime, endTime, 30);
            return { name: kw, data: rows }; // rows have {date, raw, value}
          } catch (e) {
            console.error(`🔴 Google Trends failed for "${kw}":`, e.message);
            return { name: kw, data: [] };
          }
        })
      )
    );

    // ----- Market series (normalized + raw) -----
    const [gold, nasdaq, bitcoin] = await Promise.allSettled([
      fetchYahooDaily('GC=F', days),
      fetchYahooDaily('^IXIC', days),
      fetchCoinGeckoBTC(days),
    ]);

    function settledToRows(settled) {
      return settled.status === 'fulfilled' ? settled.value : [];
    }

    const goldRows = settledToRows(gold);
    const nasdaqRows = settledToRows(nasdaq);
    const btcRows = settledToRows(bitcoin);

    const goldNorm = normalizeArray(goldRows.map(r => r.value));
    const nasdaqNorm = normalizeArray(nasdaqRows.map(r => r.value));
    const btcNorm = normalizeArray(btcRows.map(r => r.value));

    const marketSeries = [
      { name: 'gold', data: goldRows.map((r, i) => ({ date: r.date, raw: r.value, value: goldNorm[i] })) },
      { name: 'nasdaq', data: nasdaqRows.map((r, i) => ({ date: r.date, raw: r.value, value: nasdaqNorm[i] })) },
      { name: 'bitcoin', data: btcRows.map((r, i) => ({ date: r.date, raw: r.value, value: btcNorm[i] })) },
    ];

    // ----- Merge everything by date -----
    const merged = mergeSeries([...googleSeries, ...marketSeries]);

    // DEBUG mode: quick summary if ?debug=1
    if (req.query.debug === '1') {
      const keys = Object.keys(merged[0] || {}).filter(k => k !== 'date');
      const counts = {};
      for (const k of keys) counts[k] = merged.filter(r => r[k] != null).length;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        rows: merged.length,
        keys,
        countsPerSeries: counts,
        first3: merged.slice(0, 3),
        last3: merged.slice(-3),
      });
    }

    // No CDN caching while validating
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(merged);
  } catch (err) {
    console.error('🔴 /api/fetch-trends error:', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Failed to fetch trends', detail: String(err) });
  }
}
