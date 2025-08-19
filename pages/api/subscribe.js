export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // TODO: add your storage logic (DB, Google Sheet, etc.)
  // Example: pretend we added or found an existing
  const added = true; // or false if already exists

  // Cache control to avoid edge caching of responses
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ added });
}
