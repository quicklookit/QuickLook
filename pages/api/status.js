// pages/api/status.js
import googleTrends from 'google-trends-api';

// Force Node runtime so google-trends-api works on Vercel
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    const { op } = req.query || {};

    if (op === 'probe') {
      // --- Google Trends probe: /api/status?op=probe&kw=lipstick&days=90
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
      return res.status(200).json({
        ok: true,
        mode: 'probe',
        kw,
        days,
        points: arr.length,
        first: arr[0] || null,
        last: arr[arr.length - 1] || null,
        signature: 'whoami-pages-v1',
        sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        builtAt: new Date().toISOString(),
      });
    }

    // --- default status
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Status-Signature', 'whoami-pages-v1');
    return res.status(200).json({
      ok: true,
      signature: 'whoami-pages-v1',
      sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      builtAt: new Date().toISOString(),
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
