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
    fetch('/api/cron')
      .then(res => res.json())
      .then(json => {
        if (json.length === 0) return;

        const keywords = Object.keys(json[0]).filter(k => k !== 'date');
        const labels = json.map(row => row.date);
        const colors = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#000000'];

        const datasets = keywords.map((keyword, i) => ({
          label: keyword,
          data: json.map(row => row[keyword]),
          fill: false,
          borderColor: colors[i % colors.length]
        }));

        setLabels(labels);
        setDatasets(datasets);

        const latest = json[json.length - 1];
        const avg = keywords.reduce((sum, k) => sum + parseFloat(latest[k] || 0), 0) / keywords.length;
        setAverage(avg);
        setLoading(false);
      });
  }, []);

  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">📈 Quick Look Trends</h1>
      <Thermometer value={average} />
      <div className="bg-white p-4 rounded shadow mb-4">
        <Line data={{ labels, datasets }} />
      </div>
      <CorrelationHeatmap />
      <SubscribeForm />
    </main>
  );
}
