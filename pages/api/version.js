export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    msg: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    builtAt: new Date().toISOString(),
  });
}
