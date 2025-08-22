// pages/api/gt-probe.js
import googleTrends from 'google-trends-api';

// Force Node runtime (required for google-trends-api)
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    const kw = (req.query.kw || 'lipstick').toString();
    const days = Number.isFinite(parseInt(req.query.days, 10))
      ? parseInt(req.query.days, 10)
      : 90;

    const endTime = new Date();
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const json = await googleTrends.interestOverTime({
      keyword: kw,
      startTime,
      endTime,
      geo: '',
      hl: 'en-US',
      timezone: 0,
      granularTimeResolution: true,
    });

    const parsed = JSON.parse(json);
    const arr = parsed?.default?.timelineData ?? [];

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      kw,
      points: arr.length,
      first: arr[0] || null,
      last: arr[arr.length - 1] || null,
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false, error: String(e) });
  }
}
