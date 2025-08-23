// pages/api/fetch-trends.js
import pLimit from 'p-limit';
import googleTrends from 'google-trends-api';

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
      if (row.value != null) obj[s.name] = row.value;
      if (row.raw != null)   obj[`${s.name}_raw`] = row.raw;
      byDate.set(key, obj);
    }
  }
  return [...byDate.values()].sort((a,b)=>new Date(a.date)-new Date(b.date));
}

async function fetchYahooDaily(symbol, days) {
  const end = Math.floor(Date.now()/1000), start = end - days*86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=1d`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  const ts = res?.timestamp || [];
  const closes = res?.indicators?.quote?.[0]?.close || [];
  return ts.map((t,i)=>({ date:new Date(t*1000).toISOString().slice(0,10), value: closes[i] }));
}

async function fetchCoinGeckoBTC(days) {
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`, { headers: { accept:'application/json' } });
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const j = await r.json();
  return (j.prices||[]).map(([t,price])=>({ date:new Date(t).toISOString().slice(0,10), value: price }));
}

// Small overlapping segments to coax daily points
async function fetchGT(keyword, startTime, endTime, segmentDays=30) {
  const segments = [];
  for (let t = new Date(startTime); t < endTime; ) {
    const s = new Date(t);
    const e = new Date(Math.min(s.getTime()+segmentDays*DAY, endTime.getTime()));
    segments.push({ s, e });
    t = new Date(e.getTime()+DAY);
  }
  const parts = await Promise.all(segments.map(async ({s,e})=>{
    const json = await googleTrends.interestOverTime({
      keyword, startTime:s, endTime:e, geo:'', hl:'en-US', timezone:0, granularTimeResolution:true
    });
    const parsed = JSON.parse(json);
    return parsed?.default?.timelineData ?? [];
  }));
  const byTs = new Map(); for (const arr of parts) for (const it of arr) byTs.set(it.time, it);
  const flat = [...byTs.values()].sort((a,b)=>Number(a.time)-Number(b.time));
  const rows = flat.map(t=>({ date:new Date(Number(t.time)*1000).toISOString().slice(0,10), raw:Array.isArray(t.value)?t.value[0]:t.value }));
  const norm = normalizeArray(rows.map(r=>r.raw));
  return rows.map((r,i)=>({ date:r.date, raw:r.raw, value:norm[i] }));
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const days = Number.isFinite(parseInt(req.query.days,10)) ? parseInt(req.query.days,10) : 180;
  const endTime = new Date();
  const startTime = new Date(Date.now()-days*DAY);

  // <-- add all the extra keywords here
  const trendKeywords = [
    'cosmetics','lipstick','male underwear','PMI index','interest rates',
    'mortgage lending','credit card debt','job openings','house prices',
    'European Central Bank','Federal Reserve','Bank for International Settlements'
  ];

  const limit = pLimit(3);

  try {
    // Markets (these are the 3 you already see)
    const [gold,nasdaq,bitcoin] = await Promise.allSettled([
      fetchYahooDaily('GC=F', days),
      fetchYahooDaily('^IXIC', days),
      fetchCoinGeckoBTC(days)
    ]);
    const ok = x => x.status === 'fulfilled' ? x.value : [];
    const g = ok(gold), n = ok(nasdaq), b = ok(bitcoin);
    const gNorm = normalizeArray(g.map(r=>r.value));
    const nNorm = normalizeArray(n.map(r=>r.value));
    const bNorm = normalizeArray(b.map(r=>r.value));
    const marketSeries = [
      { name:'gold',    data:g.map((r,i)=>({date:r.date, raw:r.value, value:gNorm[i]})) },
      { name:'nasdaq',  data:n.map((r,i)=>({date:r.date, raw:r.value, value:nNorm[i]})) },
      { name:'bitcoin', data:b.map((r,i)=>({date:r.date, raw:r.value, value:bNorm[i]})) }
    ];

    // Trends (all in the same file)
    const googleSeries = await Promise.all(
      trendKeywords.map(kw => limit(async () => {
        try {
          const rows = await fetchGT(kw, startTime, endTime, 30);
          return { name: kw, data: rows };
        } catch (e) {
          console.error(`GT failed ${kw}:`, e.message);
          return { name: kw, data: [] };
        }
      }))
    );

    const merged = mergeSeries([...marketSeries, ...googleSeries]);

    if (req.query.debug === '1') {
      const keys = Object.keys(merged[0]||{}).filter(k=>k!=='date');
      const counts = {}; for (const k of keys) counts[k] = merged.filter(r=>r[k]!=null).length;
      return res.status(200).json({
        signature: 'fetch-trends-pages-v3',
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
    return res.status(500).json({ error:'Failed to fetch trends', detail:String(err) });
  }
}

// Force Node runtime for google-trends-api
export const config = { runtime: 'nodejs' };
