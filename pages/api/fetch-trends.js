// File: /pages/api/fetch-trends.js
import googleTrends from 'google-trends-api';

export default async function handler(req, res) {
  try {
    const keywords = [
      'lipstick',
      'cosmetics',
      'male underwear',
      'PMI index',
      'interest rates',
      'bitcoin',
      'nasdaq'
    ];

    const endTime = new Date();
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // past 24 hours

    // Fetch trends for each keyword
    const results = await Promise.all(
      keywords.map((kw) =>
        googleTrends
          .interestOverTime({ keyword: kw, startTime, endTime, geo: '' })
          .catch((err) => {
            console.error(`Trend fetch failed for ${kw}:`, err.message);
            return null;
          })
      )
    );

    // Normalize and merge
    const timelineMap = new Map();

    keywords.forEach((keyword, i) => {
      if (!results[i]) return;

      let trendData;
      try {
        trendData = JSON.parse(results[i]);
      } catch (err) {
        console.warn(`Failed to parse result for ${keyword}:`, err.message);
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

    const normalized = Array.from(timelineMap.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    console.log('Scheduled fetch executed at:', new Date().toISOString());

    res.status(200).json(normalized);
  } catch (error) {
    console.error('Error in fetch-trends:', error.message);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
}
