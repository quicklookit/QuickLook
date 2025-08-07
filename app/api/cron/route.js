// File: app/api/cron/route.js

import { NextResponse } from 'next/server';
import googleTrends from 'google-trends-api';

export async function GET() {
  const keywords = [
    'cosmetics',
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
    'XRP'
  ];


  const endTime = new Date();
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours

  try {
    const results = await Promise.all(
      keywords.map((kw) =>
        googleTrends.interestOverTime({ keyword: kw, startTime, endTime })
          .catch(err => {
            console.error(`Trend fetch failed for ${kw}:`, err.message);
            return null;
          })
      )
    );

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

    const normalized = Array.from(timelineMap.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    console.log('Cron ran successfully at', new Date().toISOString());

    return NextResponse.json(normalized, { status: 200 });

  } catch (error) {
    console.error('Error in /api/cron:', error);
    return NextResponse.json({ error: 'Failed to fetch trends', detail: error.message }, { status: 500 });
  }
}
