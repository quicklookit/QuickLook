export default async function handler(req, res) {
  const { kw = 'test', days = 30 } = req.query;
  res.status(200).json({
    probe: kw,
    days: Number(days),
    timestamp: new Date().toISOString(),
    signature: 'gt-probe-pages-v1'
  });
}
