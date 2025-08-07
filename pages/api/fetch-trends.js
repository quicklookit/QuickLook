// pages/api/fetch-trends.js
import { NextResponse } from 'next/server';

export default async function handler(req, res) {
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
  res.status(200).json({ success: true });
}
