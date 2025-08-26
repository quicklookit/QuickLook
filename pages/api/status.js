// pages/api/status.js
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    route: '/api/status',
    runtime: process.env.VERCEL ? 'vercel' : 'local',
    ts: new Date().toISOString(),
  });
}
