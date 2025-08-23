export default async function handler(req, res) {
  const { kw = 'test', days = '30' } = req.query || {};
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    signature: 'gt-probe-pages-v1',
    kw: String(kw),
    days: Number(days),
    when: new Date().toISOString(),
  });
}

