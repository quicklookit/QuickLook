import { NextResponse } from 'next/server';
import googleTrends from 'google-trends-api';

export async function GET() {
  // your trend-fetching logic here
  return NextResponse.json({ ok: true });
}
