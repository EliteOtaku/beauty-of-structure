/* ============================================================================
 * core.js — 抽代宣传片 · 确定性绘制内核
 * 所有函数在同一时间 t（秒）下必须给出完全相同的像素结果：
 * 不使用 Math.random / Date，一切随机来自固定种子。
 * ==========================================================================*/

/* ----------------------------- 数学 / 时间 ------------------------------ */

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** 时间归一化：t 在 [t0, t1] 内的进度，自动夹到 [0,1]。签名 inv(t, t0, t1) */
export const inv = (t, t0, t1) => (t1 === t0 ? 0 : clamp((t - t0) / (t1 - t0)));
export const mix = (a, b, t) => lerp(a, b, clamp(t));
export const TAU = Math.PI * 2;

/** 时间段内的归一化进度，区间外自动夹紧 */
export const span = (t, a, b) => inv(t, a, b);

/** 在 [a,b] 内做"进入-保持-退出"的包络 */
export function envelope(t, a, b, fadeIn = 0.35, fadeOut = 0.35) {
  if (t <= a || t >= b) return 0;
  const i = clamp((t - a) / Math.max(fadeIn, 1e-6));
  const o = clamp((b - t) / Math.max(fadeOut, 1e-6));
  return Math.min(i, o, 1);
}

/* ------------------------------- 缓动 ---------------------------------- */

export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inQuart: (x) => x * x * x * x,
  inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) =>
    x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  inBack: (x) => 2.70158 * x * x * x - 1.70158 * x * x,
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  },
  /** 弹簧：从 0 冲到 1 后轻微回弹 */
  spring: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.cos(x * Math.PI * 4.5) * Math.exp(-x * 6)),
};

/* ------------------------------ 随机 ----------------------------------- */

/** mulberry32：小而快的确定性 PRNG */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 第 i 个 [0,1) 伪随机数（无状态，适合逐帧调用） */
export function hash1(i, seed = 1) {
  let t = (i * 374761393 + seed * 668265263) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

export const hash2 = (i, j, seed = 1) => hash1(i * 73856093 ^ (j * 19349663), seed);

/* ------------------------------ 颜色 ----------------------------------- */

function hex2rgb(hex) {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const RGB = {
  cyan: hex2rgb('#41e7ff'),
  magenta: hex2rgb('#ff3fa4'),
  gold: hex2rgb('#ffc861'),
  violet: hex2rgb('#a06bff'),
  mint: hex2rgb('#5cf2b6'),
  white: [255, 255, 255],
  blue: hex2rgb('#3a7bff'),
  ink: hex2rgb('#05060d'),
};

/** 带透明度的颜色：rgba('cyan', .5) 或 rgba([r,g,b], .5) */
export function rgba(c, a = 1) {
  const v = typeof c === 'string' ? RGB[c] || hex2rgb(c) : c;
  return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
}
export const colorOf = (c) => (typeof c === 'string' ? RGB[c] || hex2rgb(c) : c);

/** 两色插值，返回 [r,g,b] */
export function mixColor(a, b, t) {
  const A = colorOf(a), B = colorOf(b);
  return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
}
export const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/* --------------------------- 画布 / 变换 -------------------------------- */

export function clear(ctx, W, H, base = '#05060d') {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
}

/**
 * 以 (x,y) 为原点、缩放 s、旋转 r 绘制。
 * 返回还原句柄（restore 由调用方负责，见 withT）。
 */
export function T(ctx, { x = 0, y = 0, s = 1, r = 0, sx = null, sy = null } = {}) {
  ctx.translate(x, y);
  if (r) ctx.rotate(r);
  ctx.scale(sx === null ? s : sx, sy === null ? s : sy);
}

/** 自动成对 save/restore 的变换块 */
export function withT(ctx, tr, fn) {
  ctx.save();
  if (tr) T(ctx, tr);
  fn();
  ctx.restore();
}

/** 屏幕坐标下的点，绕 (cx,cy) 旋转 rot 并缩放 zoom（用于手写"镜头"） */
export function camPoint(x, y, cam) {
  const { cx = 960, cy = 540, zoom = 1, rot = 0 } = cam || {};
  const dx = (x - cx) * zoom, dy = (y - cy) * zoom;
  const c = Math.cos(rot), s = Math.sin(rot);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** 把"镜头"压进 ctx 变换（围绕屏幕中心缩放/旋转/平移） */
export function applyCam(ctx, W, H, cam = {}) {
  const { cx = W / 2, cy = H / 2, zoom = 1, rot = 0, panX = 0, panY = 0 } = cam;
  ctx.translate(cx + panX, cy + panY);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
}

/* ------------------------------- 光效 ---------------------------------- */

const spriteCache = new Map();
/** 预烘焙的径向光斑贴图（比每帧 createRadialGradient 快一个数量级） */
export function glowSprite(color = '#41e7ff', size = 128) {
  const key = color + '|' + size;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.25, rgba(color, 0.55));
  g.addColorStop(0.55, rgba(color, 0.14));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  spriteCache.set(key, cv);
  return cv;
}

/** 加色混合的柔光点 */
export function glow(ctx, x, y, r, color = '#41e7ff', a = 1) {
  const sp = glowSprite(color);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(a);
  ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** 加色混合的线段（自带光晕） */
export function glowLine(ctx, x1, y1, x2, y2, color = '#41e7ff', w = 2, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(a);
  ctx.strokeStyle = rgba(color, 0.28);
  ctx.lineWidth = w * 3.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** 霓虹圆环 */
export function ring(ctx, x, y, r, color = '#41e7ff', w = 2, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(a);
  ctx.strokeStyle = rgba(color, 0.25);
  ctx.lineWidth = w * 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** 多边形顶点 */
export function polyPoints(n, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export function polyPath(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/* ------------------------------- 文本 ---------------------------------- */

export const FONT = {
  cjk: '"Microsoft YaHei","Noto Sans SC","SimHei",sans-serif',
  cjkBold: '"Microsoft YaHei","Noto Sans SC","SimHei",sans-serif',
  serif: '"Cambria Math","Cambria",Georgia,serif',
  mono: '"Consolas","Cascadia Mono",monospace',
  latin: '"Segoe UI","Arial",sans-serif',
};

/**
 * 绘制文字（可选光晕），返回文字宽度。
 * 光晕用 shadowBlur 单次绘制实现：重复绘制会让字形发虚，务必不要再叠一遍。
 */
export function text(ctx, str, x, y, {
  size = 48, color = '#ffffff', font = FONT.cjk, weight = 700,
  align = 'center', baseline = 'middle', a = 1, glowR = 0, glowColor = null,
  letter = 0, shadow = 0, shadowColor = 'rgba(0,0,0,.55)',
} = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.globalAlpha = clamp(a);
  if (letter) ctx.letterSpacing = `${letter}px`;
  ctx.fillStyle = color;
  if (shadow) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.18;
  }
  if (glowR) {
    ctx.shadowColor = glowColor || color;
    ctx.shadowBlur = glowR;
  }
  ctx.fillText(str, x, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** 逐字打点式排版：每个字符独立淡入/位移（宣传片高频手法） */
export function textKinetic(ctx, str, x, y, t, {
  size = 64, color = '#ffffff', font = FONT.cjk, weight = 800, stagger = 0.06,
  dur = 0.5, dy = 46, align = 'center', a = 1, glowR = 18, letter = 0,
} = {}) {
  const chars = [...str];
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  if (letter) ctx.letterSpacing = `${letter}px`;
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w) => s + w, 0);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const base = ctx.textBaseline;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    const p = clamp((t - i * stagger) / dur);
    if (p <= 0) { cursor += widths[i]; return; }
    const e = ease.outExpo(p);
    ctx.save();
    ctx.globalAlpha = clamp(a) * e;
    ctx.translate(cursor, y + (1 - e) * dy);
    ctx.fillStyle = color;
    if (glowR) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glowR * e;
    }
    ctx.fillText(c, 0, 0);
    ctx.restore();
    cursor += widths[i];
  });
  ctx.restore();
  void base;
}

/** 等宽小标签（题注 / 公式注脚） */
export function label(ctx, str, x, y, {
  size = 20, color = '#8ea0c0', a = 1, align = 'center', baseline = 'middle', spacing = 3, weight = 500,
} = {}) {
  return text(ctx, str, x, y, {
    size, color, font: FONT.mono, weight, align, baseline, a, letter: spacing,
  });
}

/* ------------------------------ 背景层 ---------------------------------- */

/** 深空底 + 暗角 + 细颗粒（每帧确定性） */
export function backdrop(ctx, W, H, t, {
  base = '#05060d', vignette = 0.75, grain = 0.05, gridA = 0, gridSize = 90,
  gridColor = '#41e7ff', gridDrift = 0,
} = {}) {
  clear(ctx, W, H, base);
  if (gridA > 0) {
    ctx.save();
    ctx.globalAlpha = gridA;
    ctx.strokeStyle = rgba(gridColor, 0.5);
    ctx.lineWidth = 1;
    const off = (gridDrift * t) % gridSize;
    ctx.beginPath();
    for (let x = -gridSize + off; x < W + gridSize; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -gridSize + off; y < H + gridSize; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.restore();
  }
  if (vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H * 0.5, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (grain > 0) {
    ctx.save();
    ctx.globalAlpha = grain;
    const r = rng(1234);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 420; i++) {
      const x = r() * W, y = r() * H;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();
  }
}

/** 顶部/底部电影黑边 */
export function letterbox(ctx, W, H, h, a = 1) {
  if (h <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, h);
  ctx.fillRect(0, H - h, W, h);
  ctx.restore();
}

/** 画面闪白（节拍冲击） */
export function flash(ctx, W, H, a, color = '#ffffff') {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** 横向扫描光带（过场） */
export function sweep(ctx, W, H, x, w, color = '#41e7ff', a = 0.5) {
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - w, 0, w * 2, H);
  ctx.restore();
}

/* ------------------------------ 群论工具 -------------------------------- */

// 4 阶二面体群 D4：正方形对称（id, r90, r180, r270, 4 条镜像轴）
export const D4 = {
  names: ['e', 'r', 'r²', 'r³', 's', 'sr', 'sr²', 'sr³'],
  /** 每个元素把顶点 k 送到 perm[k] */
  perms: [
    [0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2],
    [0, 3, 2, 1], [1, 0, 3, 2], [2, 1, 0, 3], [3, 2, 1, 0],
  ],
  /** 旋转角度（弧度）—— 用于把"群作用"画成真实几何 */
  rots: [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0, 0, 0, 0],
  mirrors: [null, null, null, null, 0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4],
};

/** 把 D4 元素作用到正方形顶点（单位半径，角度 offset 可旋转整体） */
export function d4Act(idx, pts) {
  const p = D4.perms[idx];
  return p.map((k) => pts[k]);
}

/** 由角度生成旋转矩阵 */
export const rot2 = (a) => [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)];
export const applyM = ([a, b, c, d], [x, y]) => [a * x + b * y, c * x + d * y];

/** 模 n 乘法表：返回 n×n，表项为 (i*j)%n */
export function mulTable(n) {
  const T = [];
  for (let i = 0; i < n; i++) {
    T.push([]);
    for (let j = 0; j < n; j++) T[i].push((i * j) % n);
  }
  return T;
}

/** n 阶单位根（复平面点） */
export function rootsOfUnity(n, r = 1) {
  return Array.from({ length: n }, (_, k) => [Math.cos((TAU * k) / n) * r, Math.sin((TAU * k) / n) * r]);
}

/** 置换的循环分解，返回 [[..],[..]] */
export function cycles(perm) {
  const seen = new Array(perm.length).fill(false);
  const out = [];
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    const c = [];
    let j = i;
    while (!seen[j]) { seen[j] = true; c.push(j); j = perm[j]; }
    out.push(c);
  }
  return out;
}

/** 佩尔数：轨道数（Burnside）；weights 为每个群元素的不动点计数 */
export function burnside(fixCounts, groupOrder) {
  return fixCounts.reduce((s, v) => s + v, 0) / groupOrder;
}

/** 组合数 */
export function binom(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}
