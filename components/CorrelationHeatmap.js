import React, { useEffect, useState } from 'react';

export default function CorrelationHeatmap() {
  const [matrix, setMatrix] = useState({});
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    fetch('/api/correlation')
      .then(res => res.json())
      .then(json => {
        setMatrix(json);
        setLabels(Object.keys(json));
      })
      .catch(() => {
        setMatrix({});
        setLabels([]);
      });
  }, []);

  return (
    <div className="mt-8 p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">🔗 Correlation Heatmap</h2>
      {labels.length === 0 ? (
        <div className="text-sm text-gray-600">No correlation data yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-auto border-collapse">
            <thead>
              <tr>
                <th className="border p-2"></th>
                {labels.map(label => (
                  <th key={label} className="border p-2 text-xs">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map(row => (
                <tr key={row}>
                  <td className="border p-2 font-bold text-xs">{row}</td>
                  {labels.map(col => {
                    const val = matrix[row]?.[col] ?? 0;
                    const bg = `rgba(0, 128, 255, ${Math.min(1, Math.abs(val))})`;
                    return (
                      <td key={col} className="border p-1 text-center text-xs" style={{ backgroundColor: bg }}>
                        {val.toFixed ? val.toFixed(2) : val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
