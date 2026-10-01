// 独立校验（基数 k 正确展开）
const cfgOf = (i, n, k) => Array.from({ length: n }, (_, b) => Math.floor(i / k ** b) % k);
function groupOf(n) {
  const g = [];
  for (let r = 0; r < n; r++) {
    g.push(Array.from({ length: n }, (_, i) => (i + r) % n));
    g.push(Array.from({ length: n }, (_, i) => (((r - i) % n) + n) % n));
  }
  return g;
}
function orbits(n, k) {
  const all = Array.from({ length: k ** n }, (_, i) => cfgOf(i, n, k));
  const g = groupOf(n); const seen = new Set(); let c = 0;
  all.forEach((cfg) => { const key = cfg.join(''); if (seen.has(key)) return; c++; g.forEach((p) => seen.add(p.map((q) => cfg[q]).join(''))); });
  return c;
}
function burnside(n, k) {
  const all = Array.from({ length: k ** n }, (_, i) => cfgOf(i, n, k));
  const g = groupOf(n); let s = 0;
  g.forEach((p) => all.forEach((cfg) => { if (p.map((q) => cfg[q]).join('') === cfg.join('')) s++; }));
  return s / (2 * n);
}
for (const [n, k] of [[6, 2], [6, 3], [8, 2], [7, 2], [6, 4], [5, 3]]) {
  const o = orbits(n, k), b = burnside(n, k);
  console.log(`n=${n} k=${k}  轨道=${o}  Burnside=${b}  ${o === b ? 'OK' : 'MISMATCH'}`);
}
