export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Status-Signature', 'whoami-pages-v1');
  res.status(200).json({
    ok: true,
    signature: 'whoami-pages-v1',
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    builtAt: new Date().toISOString(),
  });
}
