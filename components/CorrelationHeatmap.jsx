// components/CorrelationHeatmap.jsx
import { useMemo } from "react";

// Pearson correlation; ignores nulls and requires aligned pairs
function pearson(a, b) {
  const xs = [], ys = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x); ys.push(y);
    }
  }
  const n = xs.length;
  if (n < 3) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = sxy / n - (sx / n) * (sy / n);
  const vx = sxx / n - (sx / n) ** 2;
  const vy = syy / n - (sy / n) ** 2;
  const denom = Math.sqrt(vx) * Math.sqrt(vy);
  return denom > 0 ? cov / denom : 0;
}

// nice diverging palette from negative→positive
function colorFor(r) {
  // clamp [-1, 1]
  const t = Math.max(-1, Math.min(1, r));
  // map to 0..1
  const u = (t + 1) / 2;
  // simple blue→white→red
  const rC = Math.round(255 * u);
  const gC = Math.round(255 * (1 - Math.abs(t)));
  const bC = Math.round(255 * (1 - u));
  return `rgb(${rC},${gC},${bC})`;
}

export default function CorrelationHeatmap({ dates, valuesByKey, keys, labels }) {
  const matrix = useMemo(() => {
    const m = [];
    for (let i = 0; i < keys.length; i++) {
      m[i] = [];
      for (let j = 0; j < keys.length; j++) {
        const a = valuesByKey[keys[i]] || [];
        const b = valuesByKey[keys[j]] || [];
        m[i][j] = pearson(a, b);
      }
    }
    return m;
  }, [keys, valuesByKey]);

  if (!keys.length) return <div style={{ color: "#777" }}>No data for correlation yet.</div>;

  const cell = 26;
  const padL = 160;
  const padT = 26;
  const W = padL + cell * keys.length + 10;
  const H = padT + cell * keys.length + 10;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ background: "#fff", borderRadius: 8, boxShadow: "0 0 0 1px #eee inset" }}>
        {/* row labels */}
        {keys.map((k, i) => (
          <text
            key={`row-${k}`}
            x={padL - 8}
            y={padT + i * cell + cell * 0.65}
            textAnchor="end"
            fontSize="12"
            fill="#333"
          >
            {labels[k] || k}
          </text>
        ))}

        {/* col labels */}
        {keys.map((k, j) => (
          <text
            key={`col-${k}`}
            x={padL + j * cell + cell * 0.5}
            y={padT - 8}
            textAnchor="middle"
            fontSize="12"
            transform={`rotate(-45 ${padL + j * cell + cell * 0.5} ${padT - 8})`}
            fill="#333"
          >
            {labels[k] || k}
          </text>
        ))}

        {/* cells */}
        {matrix.map((row, i) =>
          row.map((r, j) => (
            <g key={`${i}-${j}`}>
              <rect
                x={padL + j * cell}
                y={padT + i * cell}
                width={cell - 1}
                height={cell - 1}
                fill={colorFor(r)}
                stroke="white"
                strokeWidth="0.5"
              />
              {i === j ? (
                <text
                  x={padL + j * cell + cell * 0.5}
                  y={padT + i * cell + cell * 0.65}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#000"
                  opacity="0.85"
                >
                  1.00
                </text>
              ) : null}
            </g>
          ))
        )}

        {/* legend scale */}
        <g transform={`translate(${padL}, ${H - 16})`}>
          {Array.from({ length: 50 }, (_, i) => {
            const t = i / 49;
            const r = t * 2 - 1; // -1..1
            return (
              <rect
                key={i}
                x={i * 4}
                y={0}
                width={4}
                height={10}
                fill={colorFor(r)}
              />
            );
          })}
          <text x={0} y={22} fontSize="11" fill="#555">-1</text>
          <text x={50 * 4 / 2} y={22} fontSize="11" textAnchor="middle" fill="#555">0</text>
          <text x={50 * 4} y={22} fontSize="11" textAnchor="end" fill="#555">+1</text>
        </g>
      </svg>
    </div>
  );
}
