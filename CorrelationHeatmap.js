import React, { useEffect, useState } from 'react';

export default function CorrelationHeatmap() {
  const [matrix, setMatrix] = useState({});
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    fetch('/correlation')
      .then(res => res.json())
      .then(json => {
        setMatrix(json);
        setLabels(Object.keys(json));
      });
  }, []);

  return (
    <div className="mt-8 p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">🔗 Correlation Heatmap</h2>
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
                  const bg = `rgba(0, 128, 255, ${Math.abs(val)})`;
                  return (
                    <td key={col} className="border p-1 text-center text-xs" style={{ backgroundColor: bg }}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
