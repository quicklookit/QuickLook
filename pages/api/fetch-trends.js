// File: /pages/api/fetch-trends.js

import googleTrends from 'google-trends-api';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const keywords = ['gold', 'bitcoin', 'nasdaq'];
    const endTime = new Date();
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // past 24 hours

    // Fetch interest over time
    const results = await Promise.all(
      keywords.map((kw) =>
        googleTrends.interestOverTime({
          keyword: kw,
          startTime,
          endTime,
          geo: '', // global
        })
      )
    );

    // Parse results
    const parsed = results.map((r, i) => ({
      keyword: keywords[i],
      data: JSON.parse(r)
    }));

    const payload = {
      status: 'ok',
      fetchedAt: new Date().toISOString(),
      trends: parsed
    };

    // Store result in a local JSON file (if writable in Vercel build or test env)
    const filePath = path.join(process.cwd(), 'trends-latest.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      console.log('Saved trends to trends-latest.json');
    } catch (fileErr) {
      console.warn('Could not write to trends-latest.json (may not be allowed on Vercel):', fileErr.message);
    }

    res.status(200).json(payload);
  } catch (err) {
    console.error('Error fetching trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
}
