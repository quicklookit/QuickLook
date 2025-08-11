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

  useEffect(() => {
    fetch('/api/fetch-trends')
      .then(res => res.json())
      .then(json => {
        if (!Array.isArray(json) || json.length === 0) {
          setLoading(false);
          return;
        }

        const keySet = new Set();
        json.forEach(row => {
          Object.keys(row).forEach(k => {
            if (k !== 'date') keySet.add(k);
          });
        });
        const keywords = Array.from(keySet);

  
        const lbls = json.map(row => row.date);

    
        const colors = [
          '#0072B2', // blue
          '#D55E00', // vermillion
          '#009E73', // green
          '#CC79A7', // purple/pink
          '#000000', // black
          '#F0E442', // yellow
          '#56B4E9', // sky blue
          '#E69F00'  // orange
        ];

   
        const dsets = keywords.map((keyword, i) => ({
          label: keyword,
          data: json.map(row => (row[keyword] ?? null)),
          fill: false,
          borderColor: colors[i % colors.length],
        }));

     
        const latest = json[json.length - 1] || {};
        const values = keywords
          .map(k => Number(latest[k]))
          .filter(v => Number.isFinite(v));
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

        setLabels(lbls);
        setDatasets(dsets);
        setAverage(avg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">📈 Quick Look Trends</h1>

      <Thermometer value={average} />

      <div className="bg-white p-4 rounded shadow mb-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <Line data={{ labels, datasets }} />
        )}
      </div>

      <CorrelationHeatmap />
      <SubscribeForm />
    </main>
  );
}
