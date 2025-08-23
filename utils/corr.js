// utils/corr.js

// Safe mean over numeric array
function mean(arr) {
  const n = arr.length;
  if (!n) return NaN;
  let s = 0;
  for (let i = 0; i < n; i++) s += arr[i];
  return s / n;
}

// Compute Pearson r for two numeric arrays (same length)
function pearson(x, y) {
  const n = x.length;
  if (n < 2) return NaN;
  const mx = mean(x), my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (!Number.isFinite(den) || den === 0) return NaN;
  return num / den;
}

/**
 * Build a correlation matrix from merged rows.
 * rows: [{ date, seriesA, seriesB, ... }]
 * - Ignores "date"
 * - Ignores any key that ends with "_raw"
 * - Uses only overlapping non-null values per pair
 *
 * Returns: { labels: string[], matrix: number[][] }
 */
export function buildCorrelationMatrix(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { labels: [], matrix: [] };
  }

  // All candidate keys except date and *_raw
  const labels = Object.keys(rows[0])
    .filter(k => k !== 'date' && !k.endsWith('_raw'));

  const matrix = labels.map(() => labels.map(() => NaN));

  for (let i = 0; i < labels.length; i++) {
    matrix[i][i] = 1; // self corr
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i];
      const b = labels[j];

      // collect overlapping numeric values
      const x = [];
      const y = [];
      for (const r of rows) {
        const va = r[a];
        const vb = r[b];
        if (Number.isFinite(va) && Number.isFinite(vb)) {
          x.push(va);
          y.push(vb);
        }
      }

      const r = pearson(x, y);
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }

  return { labels, matrix };
}
