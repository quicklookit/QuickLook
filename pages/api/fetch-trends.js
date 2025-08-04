// File: /pages/api/fetch-trends.js

import { TrendReq } from 'pytrends-api';

export default async function handler(req, res) {
  try {
    // Set keywords and time window (past 24 hours)
    const keywords = ['gold', 'bitcoin', 'nasdaq'];
    const timeframe = 'now 1-d';

    const pytrends = new TrendReq();
    await pytrends.buildPayload(keywords, timeframe);
    const data = await pytrends.interestOverTime();

    // You could log this or store it in a DB here
    console.log('Fetched trends:', data);

    res.status(200).json({ status: 'ok', fetchedAt: new Date().toISOString(), data });
  } catch (err) {
    console.error('Error fetching trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
}

