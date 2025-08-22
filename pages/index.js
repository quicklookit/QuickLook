export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>📈 Quick Look – Minimal</h1>
      <p>This build includes API routes (Pages Router).</p>
      <ul>
        <li><a href="/api/status" target="_blank">/api/status</a></li>
        <li><a href="/api/gt-probe?kw=lipstick&days=90" target="_blank">/api/gt-probe?kw=lipstick&days=90</a></li>
        <li><a href="/api/fetch-trends?debug=1" target="_blank">/api/fetch-trends?debug=1</a></li>
      </ul>
      <p>Once these work, plug the endpoint into your real UI.</p>
    </main>
  );
}
