export default function CorrelationHeatmap({ useRaw = false }) {
  // ... rest unchanged

  useEffect(() => {
    fetch('/api/fetch-trends?days=180', { cache: 'no-store' })
      .then(res => res.json())
      .then(rows => {
        if (!Array.isArray(rows) || rows.length === 0) return;

        const keys = Object.keys(rows[0]).filter(
          k => k !== 'date' && (useRaw ? k.endsWith('_raw') : !k.endsWith('_raw'))
        );

        setLabels(keys.map(k => k.replace('_raw', '')));

        const series = {};
        keys.forEach(k => {
          series[k] = rows.map(r => (r[k] != null ? Number(r[k]) : null));
        });

        const m = keys.map(iKey =>
          keys.map(jKey => pearsonCorrelation(series[iKey], series[jKey]))
        );

        setMatrix(m);
      })
      .catch(err => console.error('Heatmap fetch error:', err));
  }, [useRaw]);
