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
  const [useRaw, setUseRaw] = useState(false); // 👈 toggle state
  const [allData, setAllData] = useState([]);

  useEffect(() => {
    fetch('/api/fetch-trends?days=180', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setAllData(json); // save full response
        buildDatasets(json, useRaw);
      })
      .catch(() => setLoading(false));
  }, []);

  // rebuild datasets when toggle changes
  useEffect(() => {
    if (allData.length) buildDatasets(allData, useRaw);
  }, [useRaw]);

  function buildDatasets(json, rawMode) {
    if (!Array.isArray(json) || json.length === 0) {
      setLoading(false);
      return;
    }

    const lbls = json.map(row => row.date);

    // detect keys based on mode
    const keys = Object.keys(json[0])
      .filter(k => k !== 'date' && (rawMode ? k.endsWith('_raw') : !k.endsWith('_raw')));

    // color palette
    const colors = [
      '#0072B2', '#D55E00', '#009E73', '#CC79A7',
      '#000000', '#F0E442', '#56B4E9', '#E69F00'
    ];

    const dsets = keys.map((key, i) => ({
      label: key.replace('_raw', ''), // drop "_raw" suffix for labels
      data: lbls.map(d => {
        const row = json.find(r => r.date === d);
        return row && typeof row[key] === 'number' ? row[key] : null;
      }),
      fill: false,
      borderColor: colors[i % colors.length],
      spanGaps: false,
    }));

    // compute average of last row
    const latest = json[json.length - 1] || {};
    const values = keys.map(k => Number(latest[k])).filter(v => Number.isFinite(v));
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    setLabels(lbls);
    setDatasets(dsets);
    setAverage(avg);
    setLoading(false);
  }

  return (
    <main className="p-8 font-sans">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">📈 Quick Look Trends</h1>
        <button
          onClick={() => setUseRaw(!useRaw)}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          {useRaw ? 'Switch to Normalized' : 'Switch to Raw'}
        </button>
      </div>

      <Thermometer value={average} />

      <div className="bg-white p-4 rounded shadow mb-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <Line data={{ labels, datasets }} />
        )}
      </div>

      <CorrelationHeatmap useRaw={useRaw} />
      <SubscribeForm />
    </main>
  );
}
