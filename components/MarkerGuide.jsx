// components/MarkerGuide.jsx
import { useMemo, useState } from "react";

/** Short explanations for each series key.
 *  Only items that exist in the incoming `keys` prop will be shown.
 */
const MARKER_INFO = {
  // your consumer/behavioral proxies
  cosmetics: {
    title: "Cosmetics / Lipstick",
    blurb:
      "Search/interest proxy for beauty and small luxury purchases. Often used as a consumer mood indicator.",
  },
  lipstick: {
    title: "Lipstick",
    blurb:
      "A classic 'affordable luxury' proxy — tends to rise when consumers cut back on big-ticket items.",
  },
  "male underwear": {
    title: "Male Underwear",
    blurb:
      "Long-standing quirky proxy for steady, non-cyclical household purchases; used as a baseline of consumer comfort.",
  },

  // financial/market anchors
  gold: {
    title: "Gold",
    blurb:
      "Safe-haven appetite. Higher readings suggest risk aversion and inflation hedge demand.",
  },
  bitcoin: {
    title: "Bitcoin",
    blurb:
      "Risk appetite / liquidity proxy in crypto markets. Can lead or lag broader sentiment.",
  },
  nasdaq: {
    title: "Nasdaq",
    blurb:
      "Growth/tech risk barometer. Often tracks rate expectations and risk-on/off swings.",
  },

  // (include any other keys your API may return)
  "PMI index": {
    title: "PMI (Purchasing Managers’ Index)",
    blurb:
      "Broad manufacturing/services activity gauge. >50 = expansion; <50 = contraction.",
  },
  "interest rates": {
    title: "Interest Rates",
    blurb:
      "Level/direction of benchmark yields — tighter financial conditions when rising.",
  },
  "mortgage lending": {
    title: "Mortgage Lending",
    blurb:
      "Housing credit pulse; tighter lending or higher rates can cool activity.",
  },
  "credit card debt": {
    title: "Credit Card Debt / Banks",
    blurb:
      "Household leverage & bank exposure; persistent increases can stress consumption later.",
  },
  "job openings": {
    title: "Job Openings",
    blurb:
      "Labor demand proxy; elevated openings imply tight labor markets and wage pressure.",
  },
  "house prices": {
    title: "House Prices / Homebuilders",
    blurb:
      "Housing cycle proxy, rate-sensitive and important for wealth effects.",
  },
  "European Central Bank": {
    title: "European Central Bank (ECB)",
    blurb:
      "European risk & policy sensitivity via broad Euro-area equities proxy.",
  },
  "Federal Reserve": {
    title: "Federal Reserve",
    blurb:
      "US policy/financials proxy; tracks rate path and regional banking conditions.",
  },
  "Bank for International Settlements": {
    title: "BIS / Global Financials",
    blurb:
      "Global banking/credit conditions signal via diversified financials proxy.",
  },
  XRP: {
    title: "XRP",
    blurb:
      "Alt-crypto liquidity/risk proxy; occasionally diverges from BTC/ETH cycles.",
  },
};

export default function MarkerGuide({ keys = [], labels = {} }) {
  const [open, setOpen] = useState(false);

  // Only show info for series that are actually present
  const items = useMemo(() => {
    return keys
      .map((k) => {
        const info = MARKER_INFO[k];
        if (!info) return null;
        return {
          key: k,
          title: info.title || labels[k] || k,
          blurb: info.blurb || "",
        };
      })
      .filter(Boolean);
  }, [keys]);

  if (!items.length) return null;

  return (
    <div
      style={{
        margin: "16px 18px",
        border: "1px solid #eee",
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 14px",
          fontSize: 16,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        aria-expanded={open}
      >
        <span style={{ marginRight: 8 }}>{open ? "▼" : "▶"}</span>
        Markers & Short Explanations
        <span style={{ color: "#666", marginLeft: 8 }}>({items.length})</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          {items.map((it) => (
            <div
              key={it.key}
              style={{
                padding: "10px 0",
                borderTop: "1px solid #f3f3f3",
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {labels[it.key] || it.title}
              </div>
              <div style={{ color: "#444", marginTop: 2 }}>{it.blurb}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
