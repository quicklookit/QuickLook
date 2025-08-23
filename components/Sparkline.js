// components/Sparkline.js
// Tiny, fast sparkline using plain SVG (no chart libs).
// Accepts numbers (nulls allowed). Draws min→max scaled to the viewBox.

export default function Sparkline({
  data = [],
  width = 220,
  height = 64,
  stroke = 'currentColor',
  strokeWidth = 2,
}) {
  // Filter to finite numbers but keep indexes for gaps
  const pts = data.map((v, i) =>
    (typeof v === 'number' && Number.isFinite(v)) ? { i, v } : null
  );

  const finite = pts.filter(Boolean);
  if (finite.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x="8" y={height / 2} fontSize="12" fill="#999">no data</text>
      </svg>
    );
  }

  const n = data.length || 1;
  const min = Math.min(...finite.map(p => p.v));
  const max = Math.max(...finite.map(p => p.v));
  const range = max - min || 1;

  const x = i => (i / Math.max(1, n - 1)) * (width - 2) + 1;
  const y = v => height - 1 - ((v - min) / range) * (height - 2);

  // Build a path that breaks on nulls to avoid connecting gaps
  let d = '';
  let penDown = false;
  for (let i = 0; i < n; i++) {
    const v = data[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const cmd = penDown ? 'L' : 'M';
      d += `${cmd}${x(i)},${y(v)} `;
      penDown = true;
    } else {
      penDown = false;
    }
  }

  // Last point marker (if last is valid)
  const lastIdx = [...data].map((v, i) => [v, i]).reverse()
    .find(([v]) => typeof v === 'number' && Number.isFinite(v))?.[1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d.trim()} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      {Number.isInteger(lastIdx) && (
        <circle cx={x(lastIdx)} cy={y(data[lastIdx])} r="2.5" fill={stroke} />
      )}
    </svg>
  );
}
