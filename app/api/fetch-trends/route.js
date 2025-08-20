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
    'XRP',
    'gold',
    'bitcoin',
    'nasdaq'
  ];

  const endTime = new Date();
const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days


  const results = await Promise.all(
    keywords.map((kw) =>
      googleTrends
        .interestOverTime({ keyword: kw, startTime, endTime, geo: '' })
        .then((res) => ({ kw, data: JSON.parse(res) }))
        .catch((err) => {
          console.error(`Failed to fetch ${kw}:`, err.message);
          return null;
        })
    )
  );

  const timelineMap = new Map();

  results.forEach((item) => {
    if (!item) return;
    const { kw, data } = item;
    const timeline = data?.default?.timelineData || [];

    timeline.forEach(({ time, value }) => {
      const timestamp = new Date(parseInt(time) * 1000).toISOString();
      if (!timelineMap.has(timestamp)) {
        timelineMap.set(timestamp, { date: timestamp });
      }
      timelineMap.get(timestamp)[kw] = value[0];
    });
  });

  const finalData = Array.from(timelineMap.values()).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return NextResponse.json(finalData);
}
return new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json', 'X-Route-Impl': 'app' }
});
