res.setHeader('X-Route-Impl', 'pages');
// pages/api/fetch-trends.js
import googleTrends from 'google-trends-api';
import pLimit from 'p-limit';
import fetch from 'node-fetch';

// Utility: normalize an array of numbers to 0–100
function normalizeArray(arr) {
  const vals = arr.filter(v => typeof v === 'number' && !isNaN(v));
  if (!vals.length) return arr.map(() => null);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return arr.map(() => 50); // flat line
  return arr.map(v => (v != null ? ((v - min) / (max - min)) * 100 : null));
}

// Utility: merge multiple series by date
function mergeSeries(seriesList) {
  const byDate = new Map();
  for (const s of seriesList) {
    for (const row of s.data) {
      const key = row.date;
      const existing = byDate.get(key) || { date: key };
      existing[s.name] = row.value;
      byDate.set(key, existing);
    }
  }
  return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Fetch Google Trends daily interest for a keyword
async function fetchGoogleTrend(keyword, startTime, endTime) {
  const json = await googleTrends.interestOverTime({
    keyword,
    startTime,
    endTime,
    geo: '',
    hl: 'en-US',
    timezone: 0,
  });
  const parsed = JSON.parse(json);
  const timeline = parsed?.default?.timelineData ?? [];
  return timeline.map(t => ({
    date: new Date(Number(t.time) * 1000).toISOString().slice(0, 10),
    value: t.value[0],
  }));
}

// Fetch Yahoo Finance daily close (symbol like GC=F or ^IXIC)
async function fetchYahooFinance(symbol, days) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${start}&period2=${end}&interval=1d`;
  const res = await fetch(url);
  const json = await res.json();
  const ts = json.chart.result[0].timestamp;
  const closes = json.chart.result[0].indicators.quote[0].close;
  return ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    value: closes[i],
  }));
}

// Fetch Bitcoin daily price from CoinGecko
async function fetchCoinGecko(days) {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.prices.map(([t, price]) => ({
    date: new Date(t).toISOString().slice(0, 10),
    value: price,
  }));
}

export default async function handler(req, res) {
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

  // ---- fetch Google + Markets exactly like in your hybrid version ----
  // (keep your existing helpers; only the end of the handler changes)
  try {
    // GOOGLE
    const gResults = []; // push {name, data:[{date,value}]} per keyword
    // (reuse your code that fills gResults)

    // MARKETS
    const mResults = []; // push gold/nasdaq/bitcoin with raw + value
    // (reuse your code that fills mResults)

    const merged = mergeSeries([...gResults, ...mResults]);

    // >>>>>>>>>>> ADD THIS DEBUG SECTION <<<<<<<<<<<
    if (req.query.debug === '1') {
      // count points per series
      const counts = {};
      const keys = Object.keys(merged[0] || {}).filter(k => k !== 'date');
      for (const k of keys) counts[k] = merged.filter(r => r[k] != null).length;

      return res.status(200).json({
        rows: merged.length,
        keys,
        countsPerSeries: counts,
        first3: merged.slice(0, 3),
        last3: merged.slice(-3),
      });
    }
  const limit = pLimit(3);

  try {
    // Google Trends series
    const googleSeries = await Promise.all(
      searchKeywords.map(kw =>
        limit(async () => {
          const rows = await fetchGoogleTrend(kw, startTime, endTime);
          const values = normalizeArray(rows.map(r => r.value));
          return {
            name: kw,
            data: rows.map((r, i) => ({ date: r.date, value: values[i] })),
          };
        })
      )
    );

    // Market data series
    const [gold, nasdaq, bitcoin] = await Promise.all([
      fetchYahooFinance('GC=F', days), // Gold futures
      fetchYahooFinance('^IXIC', days), // Nasdaq index
      fetchCoinGecko(days), // Bitcoin
    ]);

    const goldNorm = normalizeArray(gold.map(r => r.value));
    const nasdaqNorm = normalizeArray(nasdaq.map(r => r.value));
    const bitcoinNorm = normalizeArray(bitcoin.map(r => r.value));

    const marketSeries = [
      {
        name: 'gold',
        data: gold.map((r, i) => ({ date: r.date, value: goldNorm[i] })),
      },
      {
        name: 'nasdaq',
        data: nasdaq.map((r, i) => ({ date: r.date, value: nasdaqNorm[i] })),
      },
      {
        name: 'bitcoin',
        data: bitcoin.map((r, i) => ({ date: r.date, value: bitcoinNorm[i] })),
      },
    ];
// DEBUG: quick probe
if (req.query.debug === '1') {
  const keys = Object.keys(merged[0] || {}).filter(k => k !== 'date');
  const counts = {};
  for (const k of keys) counts[k] = merged.filter(r => r[k] != null).length;
  return res.status(200).json({
    rows: merged.length,
    keys,
    countsPerSeries: counts,
    first3: merged.slice(0, 3),
    last3: merged.slice(-3),
  });
}

    // Merge all series
    const merged = mergeSeries([...googleSeries, ...marketSeries]);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(merged);
  } catch (err) {
    console.error('🔴 Error in /api/fetch-trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends', detail: String(err) });
  }
}
res.setHeader('X-Route-Impl', 'pages');
