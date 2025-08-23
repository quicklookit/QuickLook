// pages/api/fetch-trends.js
import googleTrends from 'google-trends-api';
import pLimit from 'p-limit';

// ---- helpers ----
const DAY = 86400000;

function normalizeArray(arr) {
  const vals = arr.filter(v => typeof v === 'number' && !Number.isNaN(v));
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
      if (row.raw != null)   obj[`${s.name}_raw`] = row.raw;    // raw
      byDate.set(key, obj);
    }
  }
  return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Google Trends in overlapping segments to avoid coarse weekly buckets
async function fetchGoogleTrendOverSegments(keyword, startTime, endTime, segmentDays = 30) {
  const segments = [];
  for (let t = new Date(startTime); t < endTime; ) {
    const segStart = new Date(t);
    const segEnd = new Date(Math.min(segStart.getTime() + segmentDays * DAY, endTime.getTime()));
    segments.push({ segStart, segEnd });
    t = new Date(segEnd.getTime() + DAY); // 1-day overlap
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

  const byTs = new Map();
  for (const arr of parts) for (const e of arr) byTs.set(e.time, e);
  const flat = [...byTs.values()].sort((a, b) => Number(a.time) - Number(b.time));

  const rows = flat.map(t => ({
    date: new Date(Number(t.time) * 1000).toISOString().slice(0, 10),
    raw: Array.isArray(t.value) ? t.value[0] : t.value,
  }));
  const norm = normalizeArray(rows.map(r => r.raw));
  return rows.map((r, i) => ({ date: r.date, raw: r.raw, value: norm[i] }));
}

// Yahoo Finance daily close (no extra deps)
async function fetchYahooDaily(symbol, days) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
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

// CoinGecko BTC (USD)
async function fetchCoinGeckoBTC(days) {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const json = await r.json();
  return (json.prices || []).map(([t, price]) => ({
    date: new Date(t).toISOString().slice(0, 10),
    value: price,
  }));
}

// ---- API handler ----
export default async function handler(req, res) {
  // Force no CDN cache while iterating
  res.setHeader('Cache-Control', 'no-store');
  // IMPORTANT: make sure this runs on Node (needed for google-trends-api)
  res.setHeader('X-Route-Impl', 'fetch-trends-pages');

  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? parseInt(req.query.days, 10)
    : 180;

  const endTime = new Date();
  const startTime = new Date(Date.now() - days * DAY);

  // 👉 This is the list you asked to “add to the same file”
  const trendKeywords = [
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
    // 1) Google Trends series (normalized + raw)
    const googleSeries = await Promise.all(
      trendKeywords.map(kw =>
        limit(async () => {
          try {
            const rows = await fetchGoogleTrendOverSegments(kw, startTime, endTime, 30);
            console.log(`GT ${kw}: ${rows.length} pts`);
            return { name: kw, data: rows };
          } catch (e) {
            console.error(`GT failed ${kw}:`, e.message);
            return { name: kw, data: [] };
          }
        })
      )
    );

    // 2) Market series (gold, nasdaq, bitcoin) — what you’re seeing now
    const [gold, nasdaq, bitcoin] = await Promise.allSettled([
      fetchYahooDaily('GC=F', days),
      fetchYahooDaily('^IXIC', days),
      fetchCoinGeckoBTC(days),
    ]);
    const ok = x => (x.status === 'fulfilled' ? x.value : []);

    const gRows = ok(gold);
    const nRows = ok(nasdaq);
    const bRows = ok(bitcoin);

    const gNorm = normalizeArray(gRows.map(r => r.value));
    const nNorm = normalizeArray(nRows.map(r => r.value));
    const bNorm = normalizeArray(bRows.map(r => r.value));

    const marketSeries = [
      { name: 'gold',    data: gRows.map((r, i) => ({ date: r.date, raw: r.value, value: gNorm[i] })) },
      { name: 'nasdaq',  data: nRows.map((r, i) => ({ date: r.date, raw: r.value, value: nNorm[i] })) },
      { name: 'bitcoin', data: bRows.map((r, i) => ({ date: r.date, raw: r.value, value: bNorm[i] })) },
    ];

    // 3) Merge everything by date (includes *_raw alongside normalized)
    const merged = mergeSeries([...googleSeries, ...marketSeries]);

    // 4) Debug mode to prove what’s returned
    if (req.query.debug === '1') {
      const keys = Object.keys(merged[0] || {}).filter(k => k !== 'date');
      const counts = {};
      for (const k of keys) counts[k] = merged.filter(r => r[k] != null).length;
      return res.status(200).json({
        signature: 'fetch-trends-pages-v2',
        rows: merged.length,
        series: keys,
        countsPerSeries: counts,
        sampleStart: merged.slice(0, 2),
        sampleEnd: merged.slice(-2),
      });
    }

    return res.status(200).json(merged);
  } catch (err) {
    console.error('fetch-trends error:', err);
    return res.status(500).json({ error: 'Failed to fetch trends', detail: String(err) });
  }
}

// Force Node runtime (required by google-trends-api on Vercel)
export const config = { runtime: 'nodejs' };
