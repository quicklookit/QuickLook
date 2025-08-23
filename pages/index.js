import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import Thermometer from '../components/Thermometer';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import SubscribeForm from '../components/SubscribeForm';
import 'chart.js/auto';

export default function Home() {
  const [labels, setLabels] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [average, setAverage] = useState(0);
  const [rows, setRows] = useState([]);             // all merged rows for heatmap
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState(false);        // UI toggle
  const [serverDebug, setServerDebug] = useState(null);
  const [fetchingServerDebug, setFetchingServerDebug] = useState(false);

  useEffect(() => {
    fetch('/api/fetch-trends')
      .then(res => res.json())
      .then(json => {
        if (!Array.isArray(json) || json.length === 0) {
          setRows([]);
          setLabels([]);
          setDatasets([]);
          setAverage(0);
          setLoading(false);
          return;
        }

        setRows(json); // keep full data for heatmap and debug

        // Collect series names (exclude date and *_raw fields)
        const sample = json[0];
        const series = Object.keys(sample).filter(
          k => k !== 'date' && !k.endsWith('_raw')
        );

        const lbls = json.map(row => row.date);

        const colors = [
          '#0072B2', '#D55E00', '#009E73', '#CC79A7',
          '#000000', '#F0E442', '#56B4E9', '#E69F00'
        ];

        const dsets = series.map((name, i) => ({
          label: name,
          data: json.map(row => (row[name] ?? null)),
          fill: false,
          borderColor: colors[i % colors.length],
        }));

        // compute latest average across all series
        const latest = json[json.length - 1] || {};
        const values = series
          .map(k => Number(latest[k]))
          .filter(v => Number.isFinite(v));
        const avg = values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

        setLabels(lbls);
        setDatasets(dsets);
        setAverage(avg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Client-side debug summary (ignores *_raw)
  const clientDebug = useMemo(() => {
    if (!rows.length) return null;
    const keys = Object.keys(rows[0]).filter(k => k !== 'date' && !k.endsWith('_raw'));
    const counts = {};
    for (const k of keys) counts[k] = rows.filter(r => Number.isFinite(r[k])).length;
    return {
      rows: rows.length,
      series: keys,
      countsPerSeries: counts,
      first2: rows.slice(0, 2),
      last2: rows.slice(-2),
    };
  }, [rows]);

  const fetchServerDebug = async () => {
    try {
      setFetchingServerDebug(true);
      setServerDebug(null);
      const res = await fetch('/api/fetch-trends?debug=1');
      const json = await res.json();
      setServerDebug(json);
    } catch (e) {
      setServerDebug({ error: String(e) });
    } finally {
      setFetchingServerDebug(false);
    }
  };

  return (
    <main className="p-8 font-sans">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">📈 Quick Look Trends</h1>

        {/* Debug toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={debug}
            onChange={e => setDebug(e.target.checked)}
          />
          Debug Mode
        </label>
      </div>

      <Thermometer value={average} />

      <div className="bg-white p-4 rounded shadow mb-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <Line data={{ labels, datasets }} />
        )}
      </div>

      {/* 🔗 correlation heatmap */}
      <CorrelationHeatmap rows={rows} />

      {/* Debug panel */}
      {debug && (
        <div className="mt-6 border rounded p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">🔍 Debug</h2>
            <button
              onClick={fetchServerDebug}
              disabled={fetchingServerDebug}
              className="px-3 py-1 rounded bg-black text-white text-sm disabled:opacity-60"
            >
              {fetchingServerDebug ? 'Fetching…' : 'Fetch server debug'}
            </button>
          </div>

          {/* Client-side summary */}
          <div className="text-sm mb-3">
            <div className="font-medium">Client summary</div>
            {clientDebug ? (
              <pre className="mt-1 p-2 bg-white border rounded overflow-auto">
{JSON.stringify(clientDebug, null, 2)}
              </pre>
            ) : (
              <div className="text-gray-600">No data loaded.</div>
            )}
          </div>

          {/* Server-side summary */}
          <div className="text-sm">
            <div className="font-medium">Server summary (/api/fetch-trends?debug=1)</div>
            {serverDebug ? (
              <pre className="mt-1 p-2 bg-white border rounded overflow-auto">
{JSON.stringify(serverDebug, null, 2)}
              </pre>
            ) : (
              <div className="text-gray-600">Click “Fetch server debug”.</div>
            )}
          </div>
        </div>
      )}

      <SubscribeForm />
    </main>
  );
}
