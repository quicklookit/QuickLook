import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import Thermometer from '../components/Thermometer';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import 'chart.js/auto';
import SubscribeForm from '../components/SubscribeForm';

export default function Home() {
  const [data, setData] = useState([]);
  const [labels, setLabels] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [average, setAverage] = useState(0);

  useEffect(() => {
    fetch('https://your-backend-url.com/weekly-data')
      .then(res => res.json())
      .then(json => {
        if (json.length === 0) return;
        const keywords = Object.keys(json[0]).filter(k => k !== 'date');
        const labels = json.map(row => row.date);
        const datasets = keywords.map(keyword => ({
          label: keyword,
          data: json.map(row => row[keyword]),
          fill: false,
          borderColor: '#' + Math.floor(Math.random()*16777215).toString(16),
        }));
        setLabels(labels);
        setDatasets(datasets);

        const latest = json[json.length - 1];
        const avg = keywords.reduce((sum, k) => sum + parseFloat(latest[k] || 0), 0) / keywords.length;
        setAverage(avg);
      });
  }, []);

  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">📈 Weekly Market Trends</h1>
      <Thermometer value={average} />
      <div className="bg-white p-4 rounded shadow">
        <Line data={{ labels, datasets }} />
      </div>
      <CorrelationHeatmap />
      <SubscribeForm />
</main>
  );
}
