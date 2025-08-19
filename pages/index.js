import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import Thermometer from '../components/Thermometer';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import SubscribeForm from '../components/SubscribeForm';
import 'chart.js/auto';

export default function Home() {
  const [labels, setLabels] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useRaw, setUseRaw] = useState(false); // 👈 toggle
  const [allData, setAllData] = useState([]);

  useEffect(() => {
    fetch('/api/fetch-trends?days=180', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setAllData(json);
        buildDatasets(json, useRaw);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (allData.length) buildDatasets(allData, useRaw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRaw]);

  function buildDatasets(json, rawMode) {
    if (!Array.isArray(json) || json.length === 0) {
      setLoading(false);
      return;
    }

    const lbls = json.map(row => row.date);

    // keys for this mode
    const keys = Object.keys(json[0])
      .filter(k => k !== 'date' && (rawMode ? k.endsWith('_raw') : !k.endsWith('_raw')));

    const colors = [
      '#0072B2', '#D55E00', '#009E73', '#CC79A7',
      '#000000', '#F0E442', '#56B4E9', '#E69F00'
    ];

    const dsets = keys.map((key, i) => ({
      label: key.replace('_raw', ''),
      data: lbls.map(d => {
        const row = json.find(r => r.date === d);
        return row && typeof row[key] === 'number' ? row[key] : null;
      }),
      fill: false,
      borderColor: colors[i % colors.length],
      spanGaps: false,
    }));

    // Thermometer value
    const latest = json[json.length - 1] || {};
    const values = keys.map(k => Number(latest[k])).filter(v => Number.isFinite(v));

    let avg = 0;
    if (values.length) {
      const rawAvg = values.reduce((a, b) => a + b, 0) / values.length;
      if (rawMode) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        avg = min === max ? 50 : ((rawAvg - min) / (max - min)) * 100;
      } else {
        avg = rawAvg; // already 0–100
      }
    }

    setLabels(lbls);
    setDatasets(dsets);
    setAverage(avg);
    setLoading(false);
  }

  // ---------- CSV helpers ----------
  function toCSV(rows, columns) {
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map(escape).join(',');
    const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n');
    return `${header}\n${body}`;
  }

  function downloadCSV(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export only the current view (Raw or Normalized)
  function handleExportCurrent() {
    if (!allData.length) return;
    const cols = Object.keys(allData[0]).filter(
      k => k === 'date' || (useRaw ? k.endsWith('_raw') : !k.endsWith('_raw') && k !== 'date')
    );
    const csv = toCSV(allData, ['date', ...cols.filter(c => c !== 'date')]);
    const suffix = useRaw ? 'raw' : 'normalized';
    downloadCSV(`quicklook_${suffix}.csv`, csv);
  }

  // Export both raw + normalized in the same CSV (wide format)
  function handleExportBoth() {
    if (!allData.length) return;
    const cols = Object.keys(allData[0]).filter(k => k !== 'date');
    const ordered = [
      'date',
      // put normalized first, then raw
      ...cols.filter(k => !k.endsWith('_raw')),
      ...cols.filter(k => k.endsWith('_raw')),
    ];
    const csv = toCSV(allData, ordered);
    downloadCSV('quicklook_both.csv', csv);
  }
  // ---------- end CSV helpers ----------

  return (
    <main className="p-8 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">📈 Quick Look Trends</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseRaw(!useRaw)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            {useRaw ? 'Switch to Normalized' : 'Switch to Raw'}
          </button>
          <button
            onClick={handleExportCurrent}
            className="bg-gray-800 text-white px-3 py-1 rounded text-sm"
            title="Download the dataset you’re currently viewing"
          >
            Download (current)
          </button>
          <button
            onClick={handleExportBoth}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
            title="Download one CSV with both normalized + raw columns"
          >
            Download (both)
          </button>
        </div>
      </div>

      <Thermometer value={average} useRaw={useRaw} />

      <div className="bg-white p-4 rounded shadow mb-4" style={{ minHeight: 380 }}>
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <Line
            data={{ labels, datasets }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              interaction: { mode: 'nearest', intersect: false },
              scales: {
                y: useRaw
                  ? { beginAtZero: false }
                  : { beginAtZero: true, suggestedMax: 100 },
              },
            }}
          />
        )}
      </div>

      <CorrelationHeatmap useRaw={useRaw} />
      <SubscribeForm />
    </main>
  );
}
