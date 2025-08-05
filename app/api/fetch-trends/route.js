import { NextResponse } from 'next/server';
import googleTrends from 'google-trends-api';

export async function GET() {
  try {
    const keywords = ['gold', 'bitcoin', 'nasdaq']; // Customize your keywords here
    const endTime = new Date();
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // past 24 hours

    const results = await Promise.all(
      keywords.map((kw) =>
        googleTrends.interestOverTime({
          keyword: kw,
          startTime,
          endTime,
          geo: '',
        }).catch(err => {
          console.error(`Failed to fetch trend for ${kw}:`, err.message);
          return null;
        })
      )
    );

    const timelineMap = new Map();

    keywords.forEach((keyword, i) => {
      if (!results[i]) return;
      const data = JSON.parse(results[i]);
      const timeline = data?.default?.timelineData || [];

      timeline.forEach(({ time, value }) => {
        const timestamp = new Date(parseInt(time) * 1000).toISOString();
        if (!timelineMap.has(timestamp)) timelineMap.set(timestamp, { date: timestamp });
        timelineMap.get(timestamp)[keyword] = value[0];
      });
    });

    const normalized = Array.from(timelineMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log('Cron executed. Trend data collected.');
    return NextResponse.json({ success: true, data: normalized });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
