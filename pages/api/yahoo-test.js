export const config = { runtime: 'nodejs' };

const UA = 'Mozilla/5.0 (compatible; QuickLookBot/1.0; +https://quicklook.market)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  const symbol = (req.query.symbol || '^GSPC').toString();
  const days = Number.isFinite(parseInt(req.query.days,10)) ? parseInt(req.query.days,10) : 60;

  const end = Math.floor(Date.now()/1000);
  const start = end - days*86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=1d`;

  let status = 0, err = null, rows = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
      status = r.status;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const resu = j?.chart?.result?.[0];
      const ts = resu?.timestamp || [];
      const closes = resu?.indicators?.quote?.[0]?.close || [];
      rows = ts.map((t,i)=>({ date: new Date(t*1000).toISOString().slice(0,10), close: closes[i] }));
      return res.status(200).json({ ok: true, symbol, status, attempt, points: rows.length, sample: rows.slice(-3) });
    } catch (e) {
      err = String(e?.message || e);
      await sleep(400 * attempt);
    }
  }
  return res.status(200).json({ ok: false, symbol, status, error: err, points: rows.length });
}
