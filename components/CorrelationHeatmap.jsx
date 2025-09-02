// components/CorrelationHeatmap.jsx
// Pure-React SVG heatmap (no d3). Supports larger sizing & a diverging palette.
// Props:
//   matrix: number[][]  // NxN correlations in [-1, 1]
//   labels: string[]    // length N
//   size?: number       // outer square size (default 640)
//   cell?: number       // cell size in px (default auto from size / N)
//   showLegend?: boolean
//   title?: string

import React from "react";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// A nice diverging 9-color palette (red->white->green)
const PALETTE = [
  "#7f0000",
  "#b30000",
  "#d7301f",
  "#ef6548",
  "#fdbb84",
  "#fee8c8",
  "#e0f3db",
  "#a8ddb5",
  "#43a2ca",
].reverse(); // we’ll map -1→red, +1→green (so reverse for intuitive look)

// Map correlation r∈[-1,1] to a color in PALETTE
function colorFor(r) {
  const t = (r + 1) / 2; // [-1,1] -> [0,1]
  const i = clamp(Math.round(t * (PALETTE.length - 1)), 0, PALETTE.length - 1);
  return PALETTE[i];
}

export default function CorrelationHeatmap({
  matrix,
  labels,
  size = 720,
  cell, // optional
  showLegend = true,
  title = "Correlation Heat Map",
}) {
  if (!matrix?.length || !labels?.length) {
    return <p>No data for correlation yet.</p>;
  }
  const n = matrix.length;
  const margin = { top: 60, right: 24, bottom: 140, left: 180 };
  const innerW = Math.max(size - margin.left - margin.right, 120);
  const innerH = Math.max(size - margin.top - margin.bottom, 120);
  const cellSize = cell || Math.floor(Math.min(innerW, innerH) / n);
  const width = margin.left + margin.right + cellSize * n;
  const height = margin.top + margin.bottom + cellSize * n;

  // Legend ticks
  const legendStops = [-1, -0.5, 0, 0.5, 1];

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Title */}
        <text
          x={margin.left}
          y={32}
          fontSize="20"
          fontWeight="700"
          fill="#111"
        >
          {title}
        </text>

        {/* Row labels */}
        {labels.map((lab, i) => (
          <text
            key={`rowlab-${i}`}
            x={margin.left - 12}
            y={margin.top + i * cellSize + cellSize * 0.65}
            fontSize="12"
            textAnchor="end"
            fill="#333"
          >
            {lab}
          </text>
        ))}

        {/* Column labels */}
        {labels.map((lab, j) => (
          <text
            key={`collab-${j}`}
            x={margin.left + j * cellSize + cellSize * 0.5}
            y={margin.top - 10}
            fontSize="12"
            textAnchor="middle"
            fill="#333"
            transform={`rotate(-35, ${margin.left + j * cellSize + cellSize * 0.5}, ${
              margin.top - 10
            })`}
          >
            {lab}
          </text>
        ))}

        {/* Cells */}
        {matrix.flatMap((row, i) =>
          row.map((r, j) => {
            const x = margin.left + j * cellSize;
            const y = margin.top + i * cellSize;
            const fill = colorFor(r ?? 0);
            return (
              <g key={`cell-${i}-${j}`}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize - 1}
                  height={cellSize - 1}
                  fill={fill}
                  rx="2"
                />
                {/* numbers inside big maps look busy; enable if desired
                <text
                  x={x + (cellSize - 1) / 2}
                  y={y + (cellSize - 1) / 2 + 4}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#111"
                >
                  {r?.toFixed(2)}
                </text>
                */}
              </g>
            );
          })
        )}

        {/* Legend */}
        {showLegend && (
          <>
            <text
              x={margin.left}
              y={height - margin.bottom + 36}
              fontSize="12"
              fill="#333"
            >
              Correlation (Pearson, smoothed series)
            </text>
            {PALETTE.map((c, k) => {
              const x0 =
                margin.left +
                k * ((cellSize * n) / PALETTE.length);
              return (
                <rect
                  key={`leg-${k}`}
                  x={x0}
                  y={height - margin.bottom + 44}
                  width={(cellSize * n) / PALETTE.length}
                  height={12}
                  fill={c}
                />
              );
            })}
            {/* Legend ticks */}
            {legendStops.map((v, idx) => {
              const xPos =
                margin.left + ((v + 1) / 2) * (cellSize * n);
              return (
                <g key={`tick-${idx}`}>
                  <line
                    x1={xPos}
                    x2={xPos}
                    y1={height - margin.bottom + 44}
                    y2={height - margin.bottom + 60}
                    stroke="#555"
                  />
                  <text
                    x={xPos}
                    y={height - margin.bottom + 74}
                    fontSize="11"
                    textAnchor="middle"
                    fill="#333"
                  >
                    {v.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}

             
           
