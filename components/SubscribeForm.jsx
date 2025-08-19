import { useState } from 'react';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        // Try to read error JSON, but guard against non-JSON
        let err = 'Subscription failed.';
        try {
          const data = await res.json();
          if (data?.error) err = data.error;
        } catch {}
        throw new Error(err);
      }

      const result = await res.json();
      setMessage(result.added ? '✅ Subscribed successfully!' : '📬 Already subscribed.');
      setEmail('');
    } catch (err) {
      setMessage(`⚠️ ${err.message || 'Network error.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-10 bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">📥 Get Weekly Email Updates</h2>
      <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="p-2 border border-gray-300 rounded flex-grow"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {submitting ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {message && <p className="mt-2 text-sm text-gray-700">{message}</p>}
    </div>
  );
}
