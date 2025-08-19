'use client'; // if using App Router
import { useEffect, useState } from 'react';
import { HeatMapGrid } from 'react-grid-heatmap'; // or whatever library you use

// Utility: compute Pearson correlation, skipping nulls
function pearsonCorrelation(xArr, yArr) {
  const x = [];
  const y = [];
  for (let i = 0; i < xArr.length; i++) {
    if (xArr[i] != null && yArr[i] != null) {
      x.push(xArr[i]);
      y.push(yArr[i]);
    }
  }
  const n = x.length;
  if (n < 2) return null;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? null : num / den;
}

export default function CorrelationHeatmap() {
  const [data, setData] = useState([]);
  const [labels, setLabels] = useState([]);
  const [matrix, setMatrix] = useState([]);

  useEffect(() => {
    fetch('/api/fetch-trends?days=180', { cache: 'no-store' })
      .then(res => res.json())
      .then(rows => {
        if (!Array.isArray(rows) || rows.length === 0) return;

        // collect all keywords/series
        const keys = Object.keys(rows[0]).filter(k => k !== 'date');
        setLabels(keys);

        // build arrays of values per key
        const series = {};
        keys.forEach(k => {
          series[k] = rows.map(r => (r[k] != null ? Number(r[k]) : null));
        });

        // build correlation matrix
        const m = keys.map(iKey =>
          keys.map(jKey => pearsonCorrelation(series[iKey], series[jKey]))
        );

        setMatrix(m);
      })
      .catch(err => console.error('Heatmap fetch error:', err));
  }, []);

  return (
    <div className="bg-white p-4 rounded shadow mt-6">
      <h2 className="text-lg font-semibold mb-4">📊 Correlation Heatmap</h2>
      {matrix.length > 0 ? (
        <HeatMapGrid
          data={matrix}
          xLabels={labels}
          yLabels={labels}
          cellRender={(x, y, value) => (
            <div className="text-xs font-mono">
              {value == null ? '—' : value.toFixed(2)}
            </div>
          )}
          cellStyle={(_x, _y, value) => ({
            background: value == null
              ? '#f0f0f0'
              : value > 0
              ? `rgba(0, 128, 0, ${Math.abs(value)})` // green for positive
              : `rgba(220, 20, 60, ${Math.abs(value)})`, // red for negative
            color: '#000',
          })}
        />
      ) : (
        <p className="text-sm text-gray-600">Loading correlations…</p>
      )}
    </div>
  );
}
