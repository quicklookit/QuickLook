// components/CorrelationHeatmap.jsx
import { useMemo } from 'react';
import { buildCorrelationMatrix } from '../utils/corr';

// Color scale: -1 (blue) → 0 (white) → +1 (red)
function corrColor(v) {
  if (!Number.isFinite(v)) return '#eee';
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) {
    // white → red
    const r = 255;
    const g = Math.round(255 * (1 - t));
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  } else {
    // blue → white
    const tt = Math.abs(t);
    const r = Math.round(255 * (1 - tt));
    const g = Math.round(255 * (1 - tt));
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}

export default function CorrelationHeatmap({ rows, height = 22 }) {
  const { labels, matrix } = useMemo(() => buildCorrelationMatrix(rows || []), [rows]);

  if (!labels.length) {
    return (
      <div className="text-sm text-gray-600">
        No data for correlation yet.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="text-lg font-semibold mb-2">🔗 Correlation Heatmap</div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left p-2">Series</th>
              {labels.map((lab) => (
                <th key={lab} className="p-2 text-left whitespace-nowrap">{lab}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, i) => (
              <tr key={rowLabel}>
                <th className="sticky left-0 bg-white z-10 p-2 text-left whitespace-nowrap">
                  {rowLabel}
                </th>
                {labels.map((colLabel, j) => {
                  const v = matrix[i]?.[j];
                  const bg = corrColor(v);
                  const title = Number.isFinite(v) ? v.toFixed(2) : 'N/A';
                  return (
                    <td
                      key={colLabel}
                      title={title}
                      style={{ background: bg, height }}
                      className="text-center align-middle px-2"
                    >
                      <span className="opacity-80">{Number.isFinite(v) ? v.toFixed(2) : '—'}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-gray-600">
        Uses normalized 0–100 series, ignores <code>*_raw</code> columns. Values are Pearson r (−1..+1).
      </div>
    </div>
  );
}
