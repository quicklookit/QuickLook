// pages/api/fetch-trends.js
// Reliable market proxies + BTC, with diagnostics at ?debug=1

import pLimit from 'p-limit';

const UA = 'Mozilla/5.0 (compatible; QuickLookBot/1.0; +https://quicklook.market)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
      if (row.value != null) obj[s.name] = row.value;
      if (row.raw != null)   obj[`${s.name}_raw`] = row.raw;
      byDate.set(key, obj);
    }
  }
  return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function fetchYahooDaily(symbol, days, diag) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${start}&period2=${end}&interval=1d`;

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
      const rows = ts.map((t,i)=>({ date:new Date(t*1000).toISOString().slice(0,10), value: closes[i] }));
      diag.ok = true; diag.http = status; diag.points = rows.length; diag.attempt = attempt;
      return rows;
    } catch (e) {
      lastErr = e; diag.ok = false; diag.http = status; diag.error = String(e?.message || e); diag.attempt = attempt;
      await sleep(400 * attempt);
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
    diag.ok = true; diag.http = status; diag.points = rows.length;
    return rows;
  } catch (e) {
    diag.ok = false; diag.http = status; diag.error = String(e?.message || e);
    return [];
  }
}

/* ---- Reliable series set ---- */
const SERIES = [
  { name: 'gold',    kind: 'yahoo',     symbol: 'GC=F' },
  { name: 'nasdaq',  kind: 'yahoo',     symbol: '^IXIC' },
  { name: 'bitcoin', kind: 'coingecko', symbol: 'BTC' },

  { name: 'sp500',   kind: 'yahoo', symbol: '^GSPC' },
  { name: 'dow',     kind: 'yahoo', symbol: '^DJI' },
  { name: 'eurostoxx', kind: 'yahoo', symbol: '^STOXX50E' },
  { name: 'treasuries_7_10y', kind: 'yahoo', symbol: 'IEF' },
  { name: 'high_yield', kind: 'yahoo', symbol: 'HYG' },
  { name: 'investment_grade', kind: 'yahoo', symbol: 'LQD' },
  { name: 'financials', kind: 'yahoo', symbol: 'XLF' },
  { name: 'energy', kind: 'yahoo', symbol: 'XLE' },
  { name: 'industrials', kind: 'yahoo', symbol: 'XLI' },
  { name: 'consumer_disc', kind: 'yahoo', symbol: 'XLY' },
  { name: 'consumer_staples', kind: 'yahoo', symbol: 'XLP' },
  { name: 'homebuilders', kind: 'yahoo', symbol: 'XHB' }
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? parseInt(req.query.days, 10)
    : 180;

  const limit = pLimit(1); // serial to avoid Yahoo blocks
  const diagnostics = [];

  try {
    const series = await Promise.all(
      SERIES.map(s =>
        limit(async () => {
          const diag = { name: s.name, kind: s.kind, symbol: s.symbol };
          let rows = [];
          if (s.kind === 'yahoo') rows = await fetchYahooDaily(s.symbol, days, diag);
          else if (s.kind === 'coingecko') rows = await fetchCoinGeckoBTC(days, diag);

          diagnostics.push(diag);
          console.log(`[series] ${s.name} (${s.symbol||s.kind}) -> ok=${diag.ok} http=${diag.http} pts=${diag.points||0} ${diag.error? 'err='+diag.error : ''}`);

          const norm = normalizeArray(rows.map(r=>r.value));
          return { name: s.name, data: rows.map((r,i)=>({ date:r.date, raw:r.value, value:norm[i] })) };
        })
      )
    );

    const merged = mergeSeries(series);

    if (req.query.debug === '1') {
      const keys = Object.keys(merged[0]||{}).filter(k=>k!=='date');
      const counts = {}; for (const k of keys) counts[k] = merged.filter(r=>r[k]!=null).length;
      return res.status(200).json({
        signature: 'fetch-trends-reliable-v1',
        rows: merged.length,
        series: keys,
        countsPerSeries: counts,
        diagnostics,
        sampleStart: merged.slice(0,2),
        sampleEnd: merged.slice(-2)
      });
    }

    return res.status(200).json(merged);
  } catch (err) {
    console.error('fetch-trends error:', err);
    return res.status(500).json({ error: 'Failed to fetch trends', detail: String(err) });
  }
}

export const config = { runtime: 'nodejs' };
