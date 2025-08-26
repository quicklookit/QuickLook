// pages/api/fetch-trends.js
// Daily Google Trends for your keywords, merged by date.
// Keywords include cosmetics/lipstick & male underwear, plus gold/bitcoin/nasdaq.
// Supports ?days=365 and ?debug=1

import googleTrends from 'google-trends-api';
import pLimit from 'p-limit';

const DAY = 24 * 60 * 60 * 1000;

/* -------- helpers -------- */

function normalize(arr) {
  const vals = arr.filter((v) => Number.isFinite(v));
  if (!vals.length) return arr.map(() => null);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return arr.map(() => 50); // flat series fallback
  return arr.map((v) => (v == null ? null : ((v - min) / (max - min)) * 100));
}

function mergeByDate(seriesList) {
  const byDate = new Map();
  for (const s of seriesList) {
    for (const row of s.data) {
      const obj = byDate.get(row.date) || { date: row.date };
      obj[s.name] = row.value;           // normalized
      obj[`${s.name}_raw`] = row.raw;    // raw score (0..100 google)
      byDate.set(row.date, obj);
    }
  }
  return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Fetch one keyword using short segments to force daily granularity.
async function fetchKeywordDaily(keyword, startTime, endTime) {
  // split into ~30 day segments with 1 day overlap
  const segments = [];
  for (let t = new Date(startTime); t < endTime; ) {
    const segStart = new Date(t);
    const segEnd = new Date(Math.min(segStart.getTime() + 30 * DAY, endTime.getTime()));
    segments.push([segStart, segEnd]);
    t = new Date(segEnd.getTime() + DAY);
  }

  const parts = await Promise.all(
    segments.map(async ([segStart, segEnd]) => {
      const json = await googleTrends.interestOverTime({
        keyword,
        startTime: segStart,
        endTime: segEnd,
        geo: '',              // global
        hl: 'en-US',
        timezone: 0,
        granularTimeResolution: true, // prefer daily
      });
      const parsed = JSON.parse(json);
      return parsed?.default?.timelineData ?? [];
    })
  );

  // dedupe by timestamp
  const byTs = new Map();
  for (const arr of parts) {
    for (const e of arr) byTs.set(e.time, e);
  }

  const rows = [...byTs.values()]
    .sort((a, b) => Number(a.time) - Number(b.time))
    .map((e) => ({
      date: new Date(Number(e.time) * 1000).toISOString().slice(0, 10), // YYYY-MM-DD
      raw: Array.isArray(e.value) ? e.value[0] : e.value,
    }));

  const norm = normalize(rows.map((r) => r.raw));
  return rows.map((r, i) => ({ date: r.date, raw: r.raw, value: norm[i] }));
}

/* -------- route -------- */

export default async function handler(req, res) {
  // how far back
  const days = Number.isFinite(parseInt(req.query.days, 10))
    ? parseInt(req.query.days, 10)
    : 365;

  const endTime = new Date();
  const startTime = new Date(Date.now() - days * DAY);

  // your keywords (search intent, NOT ETFs)
  const KEYWORDS = [
    'cosmetics',
    'lipstick',
    'male underwear',
    'gold',
    'bitcoin',
    'nasdaq',
  ];

  // keep Google happy: 1 concurrent (you can try 2–3 later)
  const limit = pLimit(1);

  try {
    const series = await Promise.all(
      KEYWORDS.map((kw) =>
        limit(async () => {
          try {
            const data = await fetchKeywordDaily(kw, startTime, endTime);
            return { name: kw, data };
          } catch (e) {
            console.error(`[fetch-trends] failed for "${kw}":`, e?.message || e);
            return { name: kw, data: [] };
          }
        })
      )
    );

    const merged = mergeByDate(series);

    // debug payload (helps confirm what deployed)
    if (req.query.debug === '1') {
      const keys = Object.keys(merged[0] || {}).filter((k) => k !== 'date');
      const counts = {};
      for (const k of keys) counts[k] = merged.filter((r) => r[k] != null).length;

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        signature: 'fetch-trends-google-daily-v1',
        rows: merged.length,
        series: keys,
        countsPerSeries: counts,
        sampleStart: merged.slice(0, 2),
        sampleEnd: merged.slice(-2),
      });
    }

    // keep it uncached while you iterate
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(merged);
  } catch (err) {
    console.error('[fetch-trends] route error:', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Failed to fetch trends', detail: String(err) });
  }
}
