import googleTrends from 'google-trends-api';

const KEYWORDS = [
  'cosmetics','lipstick','male underwear','PMI index','interest rates',
  'mortgage lending','credit card debt','job openings','house prices',
  'European Central Bank','Federal Reserve','Bank for International Settlements',
  'XRP','gold','bitcoin','nasdaq'
];

const END = () => new Date();
const START = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

export default async function handler(req, res) {
  try {
    // 1) Pull time series (same as /api/fetch-trends)
    const results = await Promise.all(
      KEYWORDS.map((kw) =>
        googleTrends
          .interestOverTime({ keyword: kw, startTime: START(), endTime: END(), geo: '' })
          .then((json) => ({ kw, data: JSON.parse(json) }))
          .catch(() => null)
      )
    );

    // 2) Normalize to a date → { series } table
    const rowMap = new Map(); // ts -> { date, ...series }
    results.forEach(item => {
      if (!item) return;
      const { kw, data } = item;
      const pts = data?.default?.timelineData || [];
      pts.forEach(({ time, value }) => {
        const ts = new Date(Number(time) * 1000).toISOString();
        if (!rowMap.has(ts)) rowMap.set(ts, { date: ts });
        rowMap.get(ts)[kw] = value?.[0] ?? null;
      });
    });
    const rows = Array.from(rowMap.values()).sort((a,b) => new Date(a.date) - new Date(b.date));

    // 3) Build aligned arrays per keyword
    const series = {};
    KEYWORDS.forEach(kw => {
      series[kw] = rows.map(r => (Number.isFinite(r[kw]) ? r[kw] : null));
    });

    // Helper: z-score arrays & pearson correlation ignoring nulls
    const pairCorr = (a, b) => {
      const xs = [];
      const ys = [];
      for (let i = 0; i < a.length; i++) {
        const va = a[i], vb = b[i];
        if (Number.isFinite(va) && Number.isFinite(vb)) {
          xs.push(va); ys.push(vb);
        }
      }
      const n = xs.length;
      if (n < 3) return 0;
      const mean = arr => arr.reduce((s,v)=>s+v,0)/arr.length;
      const mx = mean(xs), my = mean(ys);
      let num=0, dx2=0, dy2=0;
      for (let i=0;i<n;i++){
        const dx = xs[i]-mx, dy = ys[i]-my;
        num += dx*dy; dx2 += dx*dx; dy2 += dy*dy;
      }
      const den = Math.sqrt(dx2*dy2);
      return den ? (num/den) : 0;
    };

    // 4) Correlation matrix
    const labels = KEYWORDS.filter(k => series[k].some(v => Number.isFinite(v)));
    const matrix = {};
    labels.forEach(r => {
      matrix[r] = {};
      labels.forEach(c => {
        matrix[r][c] = pairCorr(series[r], series[c]);
      });
    });

    res.status(200).json(matrix);
  } catch (e) {
    res.status(500).json({ error: 'Correlation failed' });
  }
}

