// pages/index.js
import React, { useEffect, useMemo, useState } from "react";
import Head from 'next/head';
import CorrelationHeatmap from "../components/CorrelationHeatmap.jsx";

// ---------- helpers ----------
function parseDate(d) {
  return new Date(d + "T00:00:00");
}

function movingAvg(values, win = 7) {
  if (!win || win <= 1) return values.slice();
  const out = Array(values.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v; cnt += 1;
    }
    if (i >= win) {
      const old = values[i - win];
      if (typeof old === "number" && Number.isFinite(old)) {
        sum -= old; cnt -= 1;
      }
    }
    out[i] = cnt > 0 ? sum / cnt : null;
  }
  return out;
}

function pearson(x, y) {
  // compute on overlapping non-null indices
  const xs = [], ys = [];
  for (let i = 0; i < x.length && i < y.length; i++) {
    const a = x[i], b = y[i];
    if (typeof a === "number" && Number.isFinite(a) &&
        typeof b === "number" && Number.isFinite(b)) {
      xs.push(a); ys.push(b);
    }
  }
  const n = xs.length;
  if (n < 3) return 0;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let num = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  const den = Math.sqrt(vx) * Math.sqrt(vy);
  return den > 0 ? num / den : 0;
}

function toSeriesTable(rows) {
  // rows: [{date, <series>...}]
  const dates = rows.map(r => r.date);
  const keys = Object.keys(rows[0] || {}).filter(k => k !== "date" && !k.endsWith("_raw"));
  const table = {};
  for (const k of keys) {
    table[k] = rows.map(r => (typeof r[k] === "number" ? r[k] : null));
  }
  return { dates, keys, table };
}

// ---------- explanations ----------
const SERIES_EXPLANATIONS = {
  "Gold (search)":
    "Daily close of GLD (SPDR Gold Shares) normalized within the selected range.",
  "Bitcoin (search)":
    "Bitcoin USD price (CoinGecko), normalized within the selected range.",
  "Nasdaq (search)":
    "NASDAQ Composite index (^IXIC) daily close, normalized.",
  "Cosmetics / Lipstick":
    "Google Trends daily interest for 'lipstick' (global), normalized to 0–100 within the selected range.",
  "Male Underwear":
    "Google Trends daily interest for 'male underwear' (global), normalized to 0–100 within the selected range.",

  "Cardboard Boxes":
    "Google Trends interest for 'cardboard boxes' (global). Proxy for e-commerce, moving activity, and packaging demand.",
  "Moving Boxes":
    "Google Trends interest for 'moving boxes' (global). Seasonal/mobility-sensitive signal complementing cardboard boxes.",
  "Packaging: International Paper (IP)":
    "Stock proxy for packaging demand (International Paper). Normalized price in your selected window.",
  "Packaging: Packaging Corp (PKG)":
    "Stock proxy for corrugated packaging demand (Packaging Corp of America). Normalized price.",
};

const HEATMAP_EXPLANATION =
  "The heat map shows the Pearson correlation of the selected, smoothed series (rows vs. columns). " +
  "Green indicates positive co-movement; red indicates inverse co-movement. The diagonal is 1.0 by definition.";

// ---------- page ----------
export default function Home() {
  const [days, setDays] = useState(365);
  const [smooth, setSmooth] = useState(true);
  const [data, setData] = useState(null); // merged rows from API
  const [loading, setLoading] = useState(false);

  // ✅ Responsive: Track window width for heatmap sizing
  const [windowWidth, setWindowWidth] = useState(820);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/fetch-trends?days=${days}`);
        const json = await r.json();
        if (!stop) setData(json);
      } catch (e) {
        console.error(e);
        if (!stop) setData(null);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [days]);

  const prepared = useMemo(() => {
    if (!data?.length) return null;
    // sort by date just in case
    const rows = data.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date));
    const { keys, table } = toSeriesTable(rows);

    // smoothing
    const smoothed = {};
    for (const k of keys) {
      smoothed[k] = smooth ? movingAvg(table[k], 7) : table[k];
    }

    // build NxN correlation matrix
    const n = keys.length;
    const M = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        M[i][j] = pearson(smoothed[keys[i]], smoothed[keys[j]]);
      }
    }
    return { keys, matrix: M };
  }, [data, smooth]);

  return (
    <>
      {/* ✅ Critical for mobile responsiveness */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Quick Look Trends</title>
      </Head>

      {/* ✅ Fluid container for all screen sizes */}
      <div style={{
        maxWidth: '100%',
        width: '100%',
        margin: '0 auto',
        padding: '16px',
        boxSizing: 'border-box',
      }}>
        <header style={{
          display: "flex",
          alignItems: "baseline",
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          {/* ✅ Responsive font size */}
          <h1 style={{
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            margin: 0,
            lineHeight: 1.2
          }}>
            📈 Quick Look Trends
          </h1>
          <a
            href="/multiples"
            style={{
              fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
              textDecoration: 'none',
              color: '#0066cc'
            }}
          >
            View Small Multiples →
          </a>
        </header>

        <section style={{
          marginTop: '1rem',
          display: "flex",
          gap: '0.75rem',
          alignItems: "center",
          flexWrap: "wrap",
          fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
        }}>
          <div>
            <label style={{ marginRight: 8 }}>Range:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ fontSize: 'inherit', padding: '0.25rem 0.5rem' }}
            >
              <option value={180}>6 months</option>
              <option value={365}>12 months</option>
              <option value={730}>24 months</option>
            </select>
          </div>

          <div>
            <label style={{ marginRight: 8 }}>Values:</label>
            <span>Normalized (0–100)</span>
          </div>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={smooth}
              onChange={(e) => setSmooth(e.target.checked)}
            />
            7-day smoothing
          </label>
        </section>

        <h3 style={{ marginTop: '1.5rem', fontSize: 'clamp(1.125rem, 3vw, 1.5rem)' }}>
          🔥 Market Heat Index
        </h3>
        {loading && <p style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>Loading…</p>}

        {/* ✅ Responsive Heatmap — scales with screen */}
        <div style={{ marginTop: '2rem', overflowX: 'auto' }}>
          <CorrelationHeatmap
            matrix={prepared?.matrix || []}
            labels={prepared?.keys || []}
            size={Math.min(windowWidth - 32, 820)} // Auto-scale, max 820px
            showLegend={true}
            title="Correlation Heat Map (same selection)"
          />
        </div>

        {/* Explanations */}
        <section style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: 'clamp(1.125rem, 3vw, 1.5rem)' }}>🧭 What you’re seeing</h3>
          <p style={{
            maxWidth: '100%',
            lineHeight: 1.6,
            fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
          }}>
            {HEATMAP_EXPLANATION}
          </p>
          <ul style={{
            marginTop: '0.5rem',
            lineHeight: 1.6,
            fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
            paddingLeft: '1.25rem'
          }}>
            {Object.entries(SERIES_EXPLANATIONS).map(([k, v]) => (
              <li key={k}>
                <strong>{k}:</strong> {v}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
