// File: /pages/api/fetch-trends.js

import googleTrends from 'google-trends-api';

export default async function handler(req, res) {
  try {
    const keywords = ['gold', 'bitcoin', 'nasdaq', 'xrp','cosmetics',
      'lipstick',
      'male underwear',
      'PMI index',
      'interest rates',
      'mortgage lending',
      'credit card debt',
      'job openings',
      'house prices',
      'European Central Bank',
      'Federal Reserve',
      'Bank for International Settlements',
      'XRP', ];
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
        }).catch(err => {
          console.error(`Trend fetch failed for ${kw}:`, err.message);
          return null;
        })
      )
    );

    // Parse and normalize
    const timelineMap = new Map();

    keywords.forEach((keyword, i) => {
      if (!results[i]) return;
      let trendData;
      try {
        trendData = JSON.parse(results[i]);
      } catch (err) {
        console.warn(`Failed to parse result for ${keyword}`, err.message);
        return;
      }

      const timeline = trendData?.default?.timelineData || [];
      timeline.forEach(({ time, value }) => {
        const timestamp = new Date(parseInt(time) * 1000).toISOString();
        if (!timelineMap.has(timestamp)) {
          timelineMap.set(timestamp, { date: timestamp });
        }
        timelineMap.get(timestamp)[keyword] = value[0];
      });
    });

    const normalized = Array.from(timelineMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(normalized);
  } catch (err) {
    console.error('Error fetching trends:', err.message);
    res.status(500).json({ error: 'Failed to fetch trends', detail: err.message });
  }
}
