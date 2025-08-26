// pages/index.js
import { useEffect, useMemo, useState } from "react";
import CorrelationHeatmap from "../components/CorrelationHeatmap";

// Friendly labels for legend / UI
const LABELS = {
  cosmetics: "Cosmetics / Lipstick",
  lipstick: "Lipstick",
  "male underwear": "Male Underwear",
  gold: "Gold (search)",
  bitcoin: "Bitcoin (search)",
  nasdaq: "Nasdaq (search)",
};
import MarkerGuide from "../components/MarkerGuide";

// default 12 months
const DEFAULT_DAYS = 365;

// Simple moving average
function sma(arr, win = 1) {
  if (win <= 1) return arr.slice();
  const out = Array(arr.length).fill(null);
  let sum = 0,
    cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      sum += v;
      cnt++;
    }
    if (i >= win) {
      const old = arr[i - win];
      if (Number.isFinite(old)) {
        sum -= old;
        cnt--;
      }
    }
    out[i] = cnt > 0 ? sum / cnt : null;
  }
  return out;
}

// SVG helpers
function pathFromSeries(xScale, yScale, xs, ys) {
  let d = "";
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (!Number.isFinite(y)) continue;
    const cx = xScale(i),
      cy = yScale(y);
    d += (d ? " L " : "M ") + cx + " " + cy;
  }
  return d;
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [smooth, setSmooth] = useState(7); // 7-day smoothing default
  const [filter, setFilter] = useState("");

  // fetch 12 months (default) from our API
  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      try {
        const r = await fetch(`/api/fetch-trends?days=${days}`);
        const json = await r.json();
        if (!alive) return;
        setRows(json || []);
      } catch (e) {
        console.error("fetch error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [days]);

  // Build column keys and arrays per key
  const { dates, keys, seriesByKey } = useMemo(() => {
    if (!rows.length) return { dates: [], keys: [], seriesByKey: {} };
    const dates = rows.map((r) => r.date);
    const allKeys = Object.keys(rows[0] || {}).filter(
      (k) => k !== "date" && !k.endsWith("_raw")
    );
    const seriesByKey = {};
    for (const k of allKeys) {
      seriesByKey[k] = rows.map((r) =>
        Number.isFinite(r[k]) ? r[k] : null
      );
    }
    return { dates, keys: allKeys, seriesByKey };
  }, [rows]);

  // Smoothed data for plotting
  const smoothByKey = useMemo(() => {
    const out = {};
    for (const k of keys) out[k] = sma(seriesByKey[k], smooth);
    return out;
  }, [seriesByKey, keys, smooth]);

  // Filter visible series by search box
  const visibleKeys = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return keys;
    return keys.filter((k) => {
      const label = LABELS[k] || k;
      return label.toLowerCase().includes(f);
    });
  }, [keys, filter]);

  // Market Heat Index = average of latest values across visible series
  const heatIndex = useMemo(() => {
    if (!rows.length || !visibleKeys.length) return 0;
    const last = rows[rows.length - 1];
    const vals = visibleKeys
      .map((k) => last[k])
      .filter((v) => Number.isFinite(v));
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [rows, visibleKeys]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <header style={{ padding: "18px 18px 8px" }}>
        <h1 style={{ margin: 0 }}>
          <span role="img" aria-label="chart">
            📈
          </span>{" "}
          Quick Look Trends{" "}
          <a
            href="/multiples"
            style={{ fontSize: 18, marginLeft: 8, textDecoration: "underline" }}
          >
            View Small Multiples →
          </a>
        </h1>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label>
            Range:&nbsp;
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
            >
              <option value={180}>6 months</option>
              <option value={365}>12 months</option>
              <option value={730}>24 months</option>
            </select>
          </label>

          <label>
            Values:&nbsp;
            <span>Normalized (0–100)</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={smooth > 1}
              onChange={(e) => setSmooth(e.target.checked ? 7 : 1)}
            />{" "}
            7-day smoothing
          </label>

          <input
            placeholder="Search series…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "4px 6px", minWidth: 180 }}
          />
        </div>
      </header>

      <section style={{ padding: "0 18px 12px" }}>
        <h3 style={{ margin: "8px 0 6px" }}>
          <span role="img" aria-label="fire">
            🔥
          </span>{" "}
          Market Heat Index
        </h3>
        <div style={{ color: "#666", marginBottom: 8 }}>
          {heatIndex.toFixed(1)} / 100
        </div>

        <Chart
          dates={dates}
          keys={visibleKeys}
          valuesByKey={smoothByKey}
          labels={LABELS}
        />
      </section>

      <section style={{ padding: "0 18px 28px" }}>
        <h3 style={{ margin: "8px 0 10px" }}>
          <span role="img" aria-label="matrix">
            🧮
          </span>{" "}
        Correlation Heat Map (same selection)
        </h3>
        <CorrelationHeatmap
          dates={dates}
          valuesByKey={smoothByKey}
          keys={visibleKeys}
          labels={LABELS}
        />
      </section>

      {loading && (
        <div style={{ padding: 18, color: "#666" }}>Loading…</div>
      )}
    </div>
  );
}

/* ---------------- SVG Chart (no deps) ---------------- */

function Chart({ dates, keys, valuesByKey, labels }) {
  const W = Math.min(1100, typeof window !== "undefined" ? window.innerWidth - 40 : 1100);
  const H = 420;
  const PAD = { l: 50, r: 20, t: 20, b: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const n = dates.length;

  const xScale = (i) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yScale = (v) => PAD.t + innerH - (v / 100) * innerH;

  // gridlines + axes ticks (quarterly-ish)
  const xTicks = 6;
  const tickIdx = Array.from({ length: xTicks + 1 }, (_, i) =>
    Math.round((i / xTicks) * (n - 1))
  );

  // palette (stable)
  const palette = [
    "#2563eb", "#16a34a", "#ea580c", "#a855f7", "#0891b2", "#f43f5e",
    "#7c3aed", "#0ea5e9", "#ef4444", "#22c55e", "#eab308", "#64748b",
    "#db2777", "#10b981", "#9333ea", "#f97316",
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ background: "#fff", borderRadius: 8, boxShadow: "0 0 0 1px #eee inset" }}>
        {/* Y gridlines */}
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="#eee"
            />
            <text x={PAD.l - 8} y={yScale(v) + 4} fontSize="11" textAnchor="end" fill="#777">
              {v}
            </text>
          </g>
        ))}

        {/* X ticks */}
        {tickIdx.map((i) => (
          <g key={i}>
            <line
              x1={xScale(i)}
              x2={xScale(i)}
              y1={PAD.t}
              y2={PAD.t + innerH}
              stroke="#f8f8f8"
            />
            <text
              x={xScale(i)}
              y={H - 10}
              fontSize="11"
              textAnchor="middle"
              fill="#777"
            >
              {dates[i]?.slice(0, 10)}
            </text>
          </g>
        ))}

        {/* Series paths */}
        {keys.map((k, idx) => {
          const ys = valuesByKey[k] || [];
          const col = palette[idx % palette.length];
          return (
            <path
              key={k}
              d={pathFromSeries(xScale, yScale, dates, ys)}
              fill="none"
              stroke={col}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Legend */}
        <Legend keys={keys} labels={labels} palette={palette} x={PAD.l} y={8} />
      </svg>
    </div>
  );
}

function Legend({ keys, labels, palette, x, y }) {
  // wrap legend into rows
  const gapX = 14, gapY = 18;
  let cx = x, cy = y;
  const items = [];
  keys.forEach((k, i) => {
    const name = labels[k] || k;
    const w = name.length * 6 + 28;
    if (cx + w > (typeof window !== "undefined" ? window.innerWidth - 40 : 1100)) {
      cx = x;
      cy += gapY;
    }
    items.push({ k, name, x: cx, y: cy, color: palette[i % palette.length] });
    cx += w + gapX;
  });
  return (
    <g>
      {items.map((it) => (
        <g key={it.k} transform={`translate(${it.x}, ${it.y})`}>
          <rect width="14" height="4" y="8" rx="2" fill={it.color} />
          <text x="22" y="12" fontSize="12" fill="#222">
            {it.name}
          </text>
        </g>
      ))}
    </g>
  );
}
