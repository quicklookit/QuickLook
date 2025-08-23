// pages/index.js
import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import Thermometer from '../components/Thermometer';
import CorrelationHeatmap from '../components/CorrelationHeatmap';

const PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173',
  '#3182bd', '#e6550d', '#31a354', '#756bb1', '#636363',
];

function rollingMean(arr, k = 7) {
  if (k <= 1) return arr;
  const out = new Array(arr.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v; cnt += 1;
    }
    if (i >= k) {
      const old = arr[i - k];
      if (typeof old === 'number' && Number.isFinite(old)) {
        sum -= old; cnt -= 1;
      }
    }
    out[i] = cnt ? sum / cnt : null;
  }
  return out;
}

export default function Home() {
  const [days, setDays] = useState(365);
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState('normalized'); // 'normalized' | 'raw'
  const [smooth, setSmooth] = useState(true);     // 7-day smoothing
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState({});     // series visibility map
  const [query, setQuery] = useState('');         // search filter

  // fetch 12 months by default
  useEffect(() => {
    setLoading(true);
    fetch(`/api/fetch-trends?days=${days}`)
      .then(r => r.json())
      .then(json => {
        // accept either array (prod) or {rows:[]} (debug)
        const data = Array.isArray(json) ? json : (json.rows || []);
        setRows(data);
        setLoading(false);
        // initialize visibility (on by default)
        const keys = Object.keys(data[0] || {}).filter(k => k !== 'date' && !k.endsWith('_raw'));
        const vis = {};
        keys.forEach(k => vis[k] = true);
        setVisible(vis);
      })
      .catch(() => setLoading(false));
  }, [days]);

  // compute chart datasets
  const { labels, datasets, avg } = useMemo(() => {
    if (!rows.length) return { labels: [], datasets: [], avg: 0 };
    const labels = rows.map(r => r.date?.slice(0, 10) ?? '');

    // choose value accessor
    const baseKeys = Object.keys(rows[0]).filter(k => k !== 'date');
    const valueKeys = baseKeys.filter(k =>
      mode === 'normalized' ? !k.endsWith('_raw') : k.endsWith('_raw')
    ).map(k => (mode === 'normalized' ? k : k.replace(/_raw$/, '')));

    // build datasets
    const datasets = valueKeys
      .filter(name => visible[name])
      .filter(name => name.toLowerCase().includes(query.toLowerCase()))
      .map((name, i) => {
        const key = mode === 'normalized' ? name : `${name}_raw`;
        let data = rows.map(r => {
          const v = r[key];
          return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
        });
        if (smooth) data = rollingMean(data, 7);
        return {
          label: name,
          data,
          spanGaps: true,
          borderColor: PALETTE[i % PALETTE.length],
          pointRadius: 0,
          borderWidth: 1.8,
          tension: 0.2,
        };
      });

    // average of last day across visible normalized series (for your thermometer)
    const last = rows[rows.length - 1] || {};
    const values = valueKeys
      .filter(name => visible[name])
      .map(name => Number(mode === 'normalized' ? last[name] : last[`${name}_raw`]))
      .filter(v => Number.isFinite(v));
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    return { labels, datasets, avg };
  }, [rows, mode, smooth, visible, query]);

  return (
    <main className="p-6 md:p-8 font-sans max-w-[1200px] mx-auto">
      <h1 className="text-3xl font-bold mb-4">📈 Quick Look Trends</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <label className="text-sm">
          Range:&nbsp;
          <select
            className="border rounded px-2 py-1"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
          >
            <option value={90}>90 days</option>
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
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="normalized">Normalized (0–100)</option>
            <option value="raw">Raw (if available)</option>
          </select>
        </label>

        <label className="text-sm inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={smooth}
            onChange={(e) => setSmooth(e.target.checked)}
          />
          7-day smoothing
        </label>

        <input
          placeholder="Search series…"
          className="border rounded px-2 py-1 text-sm flex-1 min-w-[180px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Small legend with toggles */}
      <Legend rows={rows} mode={mode} visible={visible} setVisible={setVisible} query={query} />

      {/* Thermometer / Heat Index */}
      <div className="mb-3">
        <h2 className="text-xl font-semibold mb-1">🔥 Market Heat Index</h2>
        <div className="text-sm text-gray-600 mb-2">{avg.toFixed(1)} / 100</div>
        <Thermometer value={avg} />
      </div>

      {/* Chart */}
      <div className="bg-white p-4 rounded shadow mb-6">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <Line
            data={{ labels, datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}`,
                  },
                },
                decimation: { enabled: true, algorithm: 'min-max' },
              },
              scales: {
                x: { ticks: { maxTicksLimit: 10 } },
                y: { beginAtZero: mode === 'normalized' },
              },
              elements: { line: { cubicInterpolationMode: 'default' } },
            }}
            height={420}
          />
        )}
      </div>

      {/* Correlation heatmap stays below */}
      <CorrelationHeatmap />
    </main>
  );
}

function Legend({ rows, mode, visible, setVisible, query }) {
  const keys = useMemo(() => {
    const r0 = rows[0] || {};
    const base = Object.keys(r0).filter(k => k !== 'date');
    const names = mode === 'normalized'
      ? base.filter(k => !k.endsWith('_raw'))
      : base.filter(k => k.endsWith('_raw')).map(k => k.replace(/_raw$/, ''));
    return names.filter(n => n.toLowerCase().includes(query.toLowerCase()));
  }, [rows, mode, query]);

  if (!keys.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {keys.map((name) => (
        <button
          key={name}
          onClick={() => setVisible(v => ({ ...v, [name]: !v[name] }))}
          className={`px-2 py-1 rounded text-xs border ${
            visible[name] ? 'bg-blue-50 border-blue-300' : 'bg-gray-100 border-gray-300 line-through'
          }`}
          title={visible[name] ? 'Hide' : 'Show'}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
