// pages/api/fetch-trends.js
// Gold & Nasdaq from Yahoo, BTC from CoinGecko,
// Regional Google Trends: Cardboard Boxes, Lipstick, Male Underwear
// Regional Mock Trends: Credit Card Debt, Delinquencies — NOW WITH UNIQUE REGIONAL NOISE
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
// ⚠️ NOTE: As of Nov 1, 2021, Yahoo Finance is BLOCKED in mainland China.
// If your server or users are in China, these requests will fail.
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

// Google Trends keyword — segmented (30-day windows) to get daily resolution — WITH GEO
async function fetchGoogleKeyword(keyword, days, geo = '', diag) {
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
        geo, // <-- GEO FILTER
        hl: 'en-US',
        timezone: 0,
        granularTimeResolution: true,
      });

      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch (parseError) {
        throw new Error(`Failed to parse Google Trends response: ${parseError.message}. Raw: ${json?.substring(0, 200)}`);
      }

      const arr = parsed?.default?.timelineData ?? [];
      parts.push(...arr);
    } catch (e) {
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

// 🚨 FIXED: Mock function for Credit Card Debt — REGION-SPECIFIC NOISE
async function fetchCreditCardDebt(region, days, diag) {
  await sleep(200);

  const mockData = {
    'America': { trend: 85, seed: 0.12, amplitude: 8, insight: 'High consumer debt, rising interest rates' },
    'Asia':    { trend: 45, seed: 0.25, amplitude: 3, insight: 'Lower credit reliance, cash-preference culture' },
    'Europe':  { trend: 60, seed: 0.18, amplitude: 5, insight: 'Moderate debt, varies by country' }
  };

  const config = mockData[region] || { trend: 50, seed: 0.15, amplitude: 4 };
  const { trend: baseValue, seed, amplitude } = config;

  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    // ✅ Unique noise per region using seed + region name
    const noise = (Math.sin((i * seed) + (region.charCodeAt(0) * 0.01)) * amplitude) | 0;
    rows.push({
      date,
      raw: baseValue + noise,
      value: baseValue + noise,
    });
  }

  diag.ok = true;
  diag.points = rows.length;
  return rows;
}

// 🚨 FIXED: Mock function for Delinquencies — REGION-SPECIFIC NOISE
async function fetchDelinquencies(region, days, diag) {
  await sleep(200);

  const mockData = {
    'America': { trend: 70, seed: 0.1, amplitude: 6, insight: 'Rising delinquencies among Gen Z' },
    'Asia':    { trend: 20, seed: 0.3, amplitude: 2, insight: 'Strict lending, low default rates' },
    'Europe':  { trend: 35, seed: 0.2, amplitude: 4, insight: 'Stable, but rising in Southern Europe' }
  };

  const config = mockData[region] || { trend: 30, seed: 0.15, amplitude: 3 };
  const { trend: baseValue, seed, amplitude } = config;

  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    // ✅ Unique noise per region using seed + region name
    const noise = (Math.sin((i * seed) + (region.charCodeAt(0) * 0.01)) * amplitude) | 0;
    rows.push({
      date,
      raw: baseValue + noise,
      value: baseValue + noise,
    });
  }

  diag.ok = true;
  diag.points = rows.length;
  return rows;
}

/* ===================== API ===================== */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? parseInt(req.query.days, 10)
    : 365;

  // Define regions and their Google Trends geo codes
  const regions = {
    America: 'US',
    Asia: 'CN,KR,JP,IN',
    Europe: 'DE,FR,GB,IT'
  };

  // Base SOURCES (unchanged)
  const BASE_SOURCES = [
    { name: 'Gold (search)',     kind: 'yahoo',     symbol: 'GLD'  },
    { name: 'Bitcoin (search)',  kind: 'coingecko', symbol: 'BTC'  },
    { name: 'Nasdaq (search)',   kind: 'yahoo',     symbol: '^IXIC'},
  ];

  // Regional Google Trends Topics
  const REGIONAL_TOPICS = [
    { name: 'Cardboard Boxes', keyword: 'cardboard boxes' },
    { name: 'Lipstick Sales',  keyword: 'lipstick' },
    { name: 'Male Underwear',  keyword: 'male underwear' },
  ];

  // Regional Credit Topics (mocked)
  const CREDIT_TOPICS = [
    { name: 'Credit Card Debt Level', fetcher: fetchCreditCardDebt },
    { name: 'Credit Card Delinquencies', fetcher: fetchDelinquencies },
  ];

  // Build full source list
  const SOURCES = [...BASE_SOURCES];

  // Add Google Trends regional sources
  for (const [regionName, geoCode] of Object.entries(regions)) {
    for (const topic of REGIONAL_TOPICS) {
      SOURCES.push({
        name: `${topic.name} (${regionName})`,
        kind: 'google',
        keyword: topic.keyword,
        geo: geoCode,
        region: regionName,
      });
    }
  }

  // Add Credit regional sources
  for (const [regionName] of Object.entries(regions)) {
    for (const topic of CREDIT_TOPICS) {
      SOURCES.push({
        name: `${topic.name} (${regionName})`,
        kind: 'credit',
        fetcher: topic.fetcher,
        region: regionName,
      });
    }
  }

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
            geo: src.geo,
            region: src.region,
          };

          let rows = [];
          if (src.kind === 'yahoo') {
            rows = await fetchYahooDaily(src.symbol, days, diag);
          } else if (src.kind === 'coingecko') {
            rows = await fetchCoinGeckoBTC(days, diag);
          } else if (src.kind === 'google') {
            rows = await fetchGoogleKeyword(src.keyword, days, src.geo, diag);
          } else if (src.kind === 'credit') {
            rows = await src.fetcher(src.region, days, diag);
          }

          diagnostics.push(diag);

          // Normalize market rows (google & credit already normalized inside or mocked)
          if (src.kind !== 'google' && src.kind !== 'credit') {
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
        signature: 'fetch-trends-v5-regional-credit-cardboard-lipstick',
        rows: merged.length,
        series: keys,
        countsPerSeries: counts,
        diagnostics,
        sampleStart: merged.slice(0, 2) || [],
        sampleEnd: merged.slice(-2) || [],
      });
    }

    // ✅ Normal response (non-debug)
    res.status(200).json({
      signature: 'fetch-trends-v5-regional-credit-cardboard-lipstick',
      rows: merged.length,
      data: merged,
    });

  } catch (error) { // ✅ Close try block
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
} // ✅ Close handler function
