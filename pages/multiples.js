// pages/multiples.js
// Small-multiples (sparklines) for all series with search, smoothing, raw/normalized toggle.

import { useEffect, useMemo, useState } from 'react';
import Sparkline from '../components/Sparkline';

const PALETTE = [
  '#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd',
  '#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf',
  '#393b79','#637939','#8c6d31','#843c39','#7b4173',
];

function normalizeArray(arr) {
  const vals = arr.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!vals.length) return arr.map(() => null);
  const min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) return arr.map(() => 50);
  return arr.map(v => (v == null ? null : ((v - min) / (max - min)) * 100));
}
function rollingMean(arr, k = 7) {
  if (k <= 1) return arr;
  const out = new Array(arr.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === 'number' && Number.isFinite(v)) { sum += v; cnt++; }
    if (i >= k) {
      const old = arr[i - k];
      if (typeof old === 'number' && Number.isFinite(old)) { sum -= old; cnt--; }
    }
    out[i] = cnt ? sum / cnt : null;
  }
  return out;
}

export default function MultiplesPage() {
  const [days, setDays] = useState(365);
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState('normalized'); // normalized | raw
  const [smooth, setSmooth] = useState(true);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/fetch-trends?days=${days}`)
      .then(r => r.json())
      .then(json => {
        const data = Array.isArray(json) ? json : (json.rows || []);
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [days]);

  const series = useMemo(() => {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]).filter(k => k !== 'date');
    const names = mode === 'normalized'
      ? keys.filter(k => !k.endsWith('_raw'))
      : keys.filter(k => k.endsWith('_raw')).map(k => k.replace(/_raw$/, ''));

    return names
      .filter(n => n.toLowerCase().includes(q.toLowerCase()))
      .map((name, idx) => {
        const key = mode === 'normalized' ? name : `${name}_raw`;
        let vals = rows.map(r => {
          const v = r[key];
          return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
        });
        // If viewing raw but the series looks like a constant (e.g., missing), normalize fallback
        if (mode === 'raw') {
          const finite = vals.filter(v => v != null);
          const uniq = new Set(finite.map(v => +v.toFixed(8))).size;
          if (uniq <= 1) {
            // likely missing real raw → compute normalized from whatever we have
            vals = rows.map(r => (typeof r[name] === 'number' ? r[name] : null));
          }
        } else if (mode === 'normalized') {
          // ensure normalized range is 0–100 if the source wasn’t
          vals = normalizeArray(vals);
        }
        if (smooth) vals = rollingMean(vals, 7);

        const last = vals.slice().reverse().find(v => typeof v === 'number');
        const first = vals.find(v => typeof v === 'number');
        const chg = (Number.isFinite(last) && Number.isFinite(first))
          ? ((last - first) / Math.abs(first || 1)) * 100
          : null;

        return { name, color: PALETTE[idx % PALETTE.length], vals, chg };
      });
  }, [rows, mode, smooth, q]);

  return (
    <main className="p-6 md:p-8 font-sans max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-3xl font-bold">📊 Small Multiples</h1>
        <a href="/" className="text-blue-600 underline text-sm">← Back to main chart</a>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <label className="text-sm">
          Range:&nbsp;
          <select
            className="border rounded px-2 py-1"
            value={days}
            onChange={e => setDays(parseInt(e.target.value, 10))}
          >
            <option value={180}>6 months</option>
            <option value={365}>12 months</option>
            <option value={730}>24 months</option>
          </select>
        </label>

        <label className="text-sm">
          Values:&nbsp;
          <select
            className="border rounded px-2 py-1"
            value={mode}
            onChange={e => setMode(e.target.value)}
          >
            <option value="normalized">Normalized (0–100)</option>
            <option value="raw">Raw (if available)</option>
          </select>
        </label>

        <label className="text-sm inline-flex items-center gap-2">
          <input type="checkbox" checked={smooth} onChange={e => setSmooth(e.target.checked)} />
          7-day smoothing
        </label>

        <input
          className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px]"
          placeholder="Search series…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {series.map(s => (
            <div key={s.name} className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="font-medium text-sm">{s.name}</div>
                <div
                  className={`text-xs font-semibold ${
                    s.chg == null ? 'text-gray-500'
                    : s.chg >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                  title="Percent change from first to last visible point"
                >
                  {s.chg == null ? '—' : `${s.chg >= 0 ? '▲' : '▼'} ${Math.abs(s.chg).toFixed(1)}%`}
                </div>
              </div>
              <div className="mt-2">
                <Sparkline data={s.vals} width={220} height={64} stroke={s.color} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
