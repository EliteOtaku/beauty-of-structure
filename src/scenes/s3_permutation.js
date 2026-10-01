/* ============================================================================
 * S3 · 置换 —— 从 1..7 的重排，到魔方的 43,252,003,274,489,856,000 种状态
 * 0-6s    数字重排：置换就是"重新编号"
 * 6-14s   弧线图 + 循环分解：(1 3 5)(2 7)(4 6)
 * 14-22s  7! = 5040 的粒子云
 * 22-28s  复合 p ∘ q 仍是置换 —— 置换自己成群 S₇
 * 28-34s  魔方：几十亿亿种状态，一个群全管住
 * ==========================================================================*/
import {
  clamp, inv, ease, mix, rgba, TAU, glow, glowLine, ring, text, flash, FONT, rng,
} from '../core.js';
import {
  W, H, caption, chapter, statBar, formula, drawRuns, runs, shakeOffset, glitchBars,
  core as energyCore, starfield, topGlow, roundedRect, ripple, SAFE_BOTTOM, countUp,
} from '../nars.js';

export const DURATION = 34;

const N = 7;
const CX = W / 2, CY = 470;

/* --------------------------- 置换与弧线图 ------------------------------- */
const P1 = [3, 7, 5, 6, 1, 4, 2];   // (1 3 5)(2 7)(4 6)
const Q1 = [2, 1, 4, 3, 6, 5, 7];   // (1 2)(3 4)(5 6)
const compose = (p, q) => p.map((v) => q[v - 1]);   // (p∘q)(i) = q(p(i))
const COMP = compose(P1, Q1);
const CYCLE_COLORS = ['gold', 'cyan', 'magenta', 'violet', 'mint', 'white', 'blue'];

function cyclesOf(p) {
  const seen = new Array(p.length).fill(false);
  const out = [];
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    const c = [];
    let j = i;
    while (!seen[j]) { seen[j] = true; c.push(j); j = p[j] - 1; }
    out.push(c);
  }
  return out;
}
const CYCLES = cyclesOf(P1);
const CYCLE_OF = new Array(N).fill(-1);
CYCLES.forEach((c, ci) => c.forEach((i) => { CYCLE_OF[i] = ci; }));

/** 两行点 + 弧线：置换的标准可视化 */
function arcDiagram(ctx, arr, x, y, { w = 900, rowGap = 190, arcH = 140, phase = 1, a = 1, label = true } = {}) {
  const step = w / (N - 1);
  const xs = Array.from({ length: N }, (_, i) => x - w / 2 + i * step);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = rgba('white', 0.12);
  ctx.lineWidth = 1;
  for (let i = 0; i < N; i++) {
    ctx.beginPath();
    ctx.moveTo(xs[i], y - rowGap / 2 + 16);
    ctx.lineTo(xs[i], y + rowGap / 2 - 16);
    ctx.stroke();
  }
  for (let i = 0; i < N; i++) {
    glow(ctx, xs[i], y - rowGap / 2, 12, 'cyan', 0.8);
    glow(ctx, xs[i], y + rowGap / 2, 12, 'cyan', 0.8);
    if (label) {
      text(ctx, `${i + 1}`, xs[i], y - rowGap / 2 - 40, { size: 30, color: rgba('cyan', 0.95), font: FONT.serif, weight: 700 });
      text(ctx, `${arr[i]}`, xs[i], y + rowGap / 2 + 40, { size: 30, color: rgba('gold', 0.95), font: FONT.serif, weight: 700 });
    }
  }
  for (let i = 0; i < N; i++) {
    const p = clamp(phase - i * 0.06);
    if (p <= 0) continue;
    const e = ease.outCubic(p);
    const ci = CYCLE_OF[i];
    const col = ci < 0 ? 'white' : CYCLE_COLORS[ci % CYCLE_COLORS.length];
    const x1 = xs[i], x2 = xs[arr[i] - 1];
    const h = arcH * (0.7 + 0.3 * (Math.abs(arr[i] - 1 - i) / (N - 1)));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, 0.65);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x1, y - rowGap / 2);
    ctx.bezierCurveTo(x1, y - rowGap / 2 - h * e, x2, y - rowGap / 2 - h * e, x2, y - rowGap / 2);
    ctx.stroke();
    glow(ctx, x2, y - rowGap / 2, 16, col, 0.7 * e);
    ctx.restore();
  }
  ctx.restore();
  return xs;
}

/* --------------------- 7! = 5040 个排列的粒子云 -------------------------- */
const FACT_PTS = (() => {
  const r = rng(77);
  return Array.from({ length: 5040 }, (_, i) => {
    const a = i * 2.399963;                      // 黄金角 → 均匀铺开
    const rad = 40 + Math.sqrt(i) * 9.4;
    return [Math.cos(a) * rad * 1.25, Math.sin(a) * rad * 0.78, r()];
  });
})();

/* --------------------------- 魔方（规范投影） ---------------------------- */
const FACE_DEFS = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], col: 'cyan' },     // 前
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], col: 'magenta' },  // 上
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], col: 'gold' },     // 右
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], col: 'violet' },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1], col: 'mint' },
  { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, -1], col: 'blue' },
];
const STICKER_COLORS = ['gold', 'cyan', 'magenta', 'mint', 'violet', 'white'];

function rotY(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

/**
 * 画一个 N×N×N 的"魔方"：可见面用发光贴纸 + 面轮廓表示。
 * 返回最外层顶点以便继续动画。
 */
function drawRubik(ctx, cx, cy, S, ry, rx, t, { n = 3, alpha = 1 } = {}) {
  const proj = (p) => {
    const q = rotX(rotY(p, ry), rx);
    const persp = 340 / (340 + q[2]);
    return [cx + q[0] * S * persp, cy + q[1] * S * persp, q[2]];
  };
  const visible = [];
  FACE_DEFS.forEach((f) => {
    const nq = rotX(rotY(f.n, ry), rx);
    if (nq[2] > 0.02) visible.push(f);
  });
  ctx.save();
  ctx.globalAlpha *= alpha;
  visible.forEach((f) => {
    const cs = [
      [f.n[0] - f.u[0] - f.v[0], f.n[1] - f.u[1] - f.v[1], f.n[2] - f.u[2] - f.v[2]],
      [f.n[0] + f.u[0] - f.v[0], f.n[1] + f.u[1] - f.v[1], f.n[2] + f.u[2] - f.v[2]],
      [f.n[0] + f.u[0] + f.v[0], f.n[1] + f.u[1] + f.v[1], f.n[2] + f.u[2] + f.v[2]],
      [f.n[0] - f.u[0] + f.v[0], f.n[1] - f.u[1] + f.v[1], f.n[2] - f.u[2] + f.v[2]],
    ].map(proj);
    ctx.beginPath();
    cs.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = rgba(f.col, 0.1);
    ctx.fill();
    ctx.strokeStyle = rgba(f.col, 0.85);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // 贴纸
    const stepU = 2 / n, stepV = 2 / n;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const uu = -1 + stepU * (a + 0.5), vv = -1 + stepV * (b + 0.5);
        const p3 = [
          f.n[0] + f.u[0] * uu + f.v[0] * vv,
          f.n[1] + f.u[1] * uu + f.v[1] * vv,
          f.n[2] + f.u[2] * uu + f.v[2] * vv,
        ];
        const [x, y] = proj(p3);
        const ci = (a * 3 + b + (f.col.charCodeAt(0) % 5)) % STICKER_COLORS.length;
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.4 + a + b * 2 + f.col.length);
        glow(ctx, x, y, S * (0.42 / n), STICKER_COLORS[ci], 0.32 + 0.3 * pulse);
      }
    }
  });
  ctx.restore();
  return visible.length;
}

export default {
  title: '置换',
  duration: DURATION,
  draw({ ctx, t }) {
    const shake = shakeOffset(t, 22.0, 0.4, 12, 30);
    starfield(ctx, t, { n: 160, a: 0.4 });
    topGlow(ctx, 'magenta', 0.18);

    /* ============ SHOT A (0-6s)：重排 ============================= */
    const aA = clamp(inv(t, 0, 0.6)) * (1 - clamp(inv(t, 5.4, 6.1)));
    if (aA > 0.01) {
      ctx.save();
      ctx.globalAlpha = aA * 0.5;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 12; c++) {
          text(ctx, `${(r * 12 + c) % 7 + 1}`, 150 + c * 145, 196 + r * 92, {
            size: 26, color: rgba('white', 0.14 + 0.1 * Math.sin(t * 2 + r + c)), font: FONT.mono, weight: 600,
          });
        }
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = aA;
      const w = 980, step = w / (N - 1);
      const xs = Array.from({ length: N }, (_, i) => CX - w / 2 + i * step);
      for (let i = 0; i < N; i++) {
        glow(ctx, xs[i], 330, 16, 'cyan', 0.75);
        text(ctx, `${i + 1}`, xs[i], 330, { size: 44, color: rgba('cyan', 1), font: FONT.serif, weight: 700 });
        ctx.strokeStyle = rgba('white', 0.1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xs[i], 356);
        ctx.lineTo(xs[i], 674);
        ctx.stroke();
      }
      for (let i = 0; i < N; i++) {
        const p = clamp((t - 1.0 - i * 0.09) / 0.9);
        if (p <= 0) continue;
        const e = ease.outBack(p);
        const x = mix(xs[i], xs[P1[i] - 1], e), y = mix(330, 700, ease.inOutCubic(p));
        glow(ctx, x, y, 26, 'gold', 0.5 + 0.45 * e);
        ring(ctx, x, y, 30, 'gold', 1.6, 0.5 * (1 - p) + 0.2);
        text(ctx, `${i + 1}`, x, y, { size: 44, color: rgba('gold', 1), font: FONT.serif, weight: 700, glowR: 14 });
      }
      if (t > 1.4) caption(ctx, '置换，就是*重新编号*', CX, 900, t - 1.4, { size: 54, maxWidth: 1200, glowR: 22, letter: 4 });
      ctx.restore();
    }

    /* ============ SHOT B (6-14s)：弧线图 + 循环分解 ================= */
    const aB = clamp(inv(t, 6, 6.8)) * (1 - clamp(inv(t, 13.2, 14.0)));
    if (aB > 0.01) {
      ctx.save();
      ctx.globalAlpha = aB;
      const phase = clamp((t - 6.8) / 4.6) * (N + 2);
      arcDiagram(ctx, P1, CX - 250, 470, { w: 780, rowGap: 210, arcH: 150, phase });
      const px = 1330;
      text(ctx, '循环分解', px - 300, 240, { size: 40, color: '#fff', glowR: 16 });
      const cycStr = CYCLES.map((c) => `(${c.map((i) => i + 1).join(' ')})`).join('  ');
      if (t > 8.6) formula(ctx, cycStr, px, 336, { size: 40, color: rgba('gold', 1), glowR: 16 });
      CYCLES.forEach((c, ci) => {
        const col = CYCLE_COLORS[ci % CYCLE_COLORS.length];
        const p = clamp((t - 9.2 - ci * 0.5) / 0.7);
        if (p <= 0) return;
        const e = ease.outBack(p);
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.5);
        ctx.translate(px - 300 + (1 - e) * -40, 420 + ci * 128);
        ctx.scale(e, e);
        ctx.fillStyle = rgba(col, 0.1);
        roundedRect(ctx, 0, 0, 600, 104, 14);
        ctx.fill();
        ctx.strokeStyle = rgba(col, 0.6);
        ctx.lineWidth = 1.5;
        roundedRect(ctx, 0, 0, 600, 104, 14);
        ctx.stroke();
        ctx.fillStyle = rgba(col, 0.95);
        ctx.fillRect(0, 16, 4, 72);
        text(ctx, `${c.length}-循环`, 34, 52, { size: 34, color: rgba(col, 1), align: 'left', weight: 700 });
        const desc = c.length === 1 ? `不动点：${c[0] + 1} 保持原位`
          : c.length === 2 ? `对换：${c.map((i) => i + 1).join(' ↔ ')}`
            : `轮换：${c.map((i) => i + 1).join(' → ')} → ${c[0] + 1}`;
        text(ctx, desc, 215, 52, { size: 24, color: 'rgba(212,226,248,.85)', align: 'left', weight: 500 });
        ctx.restore();
      });
      if (t > 11.6) caption(ctx, '任何置换，都能拆成*互不相交的循环*', CX - 250, 890, t - 11.6, { size: 46, maxWidth: 1100, glowR: 20, letter: 2 });
      ctx.restore();
    }

    /* ============ SHOT C (14-22s)：7! 的粒子云 ===================== */
    const aC = clamp(inv(t, 14, 14.8)) * (1 - clamp(inv(t, 21.4, 22.2)));
    if (aC > 0.01) {
      ctx.save();
      ctx.globalAlpha = aC;
      const shown = Math.floor(5040 * ease.outCubic(clamp((t - 14.8) / 5.4)));
      ctx.save();
      ctx.translate(CX - 420, 480);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < shown; i++) {
        const [x, y, rr] = FACT_PTS[i];
        glow(ctx, x, y, 5 + rr * 5, i % 97 === 0 ? 'gold' : 'cyan', 0.38);
      }
      ctx.restore();
      const cu = countUp(t, 15.2, 4.2, 5040);
      text(ctx, cu.text, CX - 420, 760, { size: 96, color: '#fff', font: FONT.mono, weight: 700, glowR: 26 });
      if (t > 15.2) text(ctx, '7!  =  5040   全部排列', CX - 420, 990, { size: 34, color: rgba('gold', 1), font: FONT.serif, weight: 700 });
      // 右侧对比
      const p = clamp((t - 17.6) / 0.9);
      if (p > 0) {
        const e = ease.outBack(p);
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.4);
        ctx.translate(1380, 480);
        ctx.scale(e, e);
        ctx.fillStyle = rgba('magenta', 0.08);
        roundedRect(ctx, -250, -180, 500, 360, 18);
        ctx.fill();
        ctx.strokeStyle = rgba('magenta', 0.5);
        ctx.lineWidth = 1.6;
        roundedRect(ctx, -250, -180, 500, 360, 18);
        ctx.stroke();
        text(ctx, 'n!  vs  nⁿ', 0, -118, { size: 34, color: 'rgba(214,226,246,.92)', weight: 700 });
        formula(ctx, '7! = 5040', 0, -40, { size: 40, color: rgba('gold', 1), glowR: 14 });
        formula(ctx, '7⁷ = 823543', 0, 30, { size: 40, color: rgba('magenta', 1), glowR: 14 });
        text(ctx, '要"不重不漏"，比随便放\n少得多，也多得吓人。', 0, 130, { size: 26, color: 'rgba(206,220,244,.85)', lineGap: 1.5 });
        ctx.restore();
      }
      ctx.restore();
    }

    /* ============ SHOT D (22-28s)：复合 ============================ */
    const aD = clamp(inv(t, 22, 22.8)) * (1 - clamp(inv(t, 27.2, 28.0)));
    if (aD > 0.01) {
      ctx.save();
      ctx.globalAlpha = aD;
      ctx.translate(shake[0], shake[1]);
      const y = 420;
      const w = 380;
      const drawPerm = (arr, x, title, col, phase) => {
        const step = w / (N - 1);
        const xs = Array.from({ length: N }, (_, i) => x - w / 2 + i * step);
        text(ctx, title, x, y - 210, { size: 38, color: rgba(col, 1), font: FONT.serif, weight: 700, glowR: 14 });
        for (let i = 0; i < N; i++) {
          glow(ctx, xs[i], y, 9, col, 0.7);
          text(ctx, `${arr[i]}`, xs[i], y - 52, { size: 30, color: rgba(col, 0.95), font: FONT.serif, weight: 700 });
        }
        const g = clamp((t - phase) / 1.1);
        if (g <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N; i++) {
          const gg = clamp(g * 1.6 - i * 0.05);
          if (gg <= 0) continue;
          const x2 = xs[arr[i] - 1];
          ctx.strokeStyle = rgba(col, 0.8 * gg);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(xs[i], y - 30);
          ctx.lineTo(x2, y + 74);
          ctx.stroke();
          glow(ctx, mix(xs[i], x2, gg), y + 22, 10, col, 0.65 * gg);
        }
        ctx.restore();
        for (let i = 0; i < N; i++) {
          const gg = clamp(g * 1.5 - i * 0.05);
          if (gg <= 0) continue;
          text(ctx, `${arr[i]}`, xs[i], y + 112, { size: 30, color: rgba(col, 0.9 * gg), font: FONT.serif, weight: 700 });
        }
      };
      drawPerm(P1, 330, 'p', 'gold', 22.4);
      drawPerm(Q1, 960, 'q', 'cyan', 23.2);
      ctx.save();
      ctx.globalAlpha *= clamp((t - 24.4) / 0.8);
      drawPerm(COMP, 1560, 'p ∘ q', 'magenta', 24.6);
      ctx.restore();
      text(ctx, '∘', 645, y + 20, { size: 64, color: rgba('white', 0.85), font: FONT.serif, weight: 700, glowR: 16 });
      text(ctx, '=', 1260, y + 20, { size: 60, color: rgba('white', 0.85), font: FONT.serif, weight: 700, glowR: 16 });
      if (t > 25.6) caption(ctx, '复合之后，还是*一个置换*：\n置换自己构成群 S₇', CX, 880, t - 25.6, { size: 46, maxWidth: 1400, glowR: 22, letter: 2 });
      ctx.restore();
    }

    /* ============ SHOT E (28-34s)：魔方 ============================ */
    const aE = clamp(inv(t, 28, 28.9));
    if (aE > 0.01) {
      ctx.save();
      ctx.globalAlpha = aE;
      const rotate = (t - 28) * 0.5;
      const p1 = clamp((t - 28.2) / 0.9);
      if (p1 > 0) {
        const e = ease.outBack(p1);
        drawRubik(ctx, 700, 520, 170 * e, rotate, 0.52 + 0.1 * Math.sin(t * 0.8), t, { n: 3, alpha: clamp(p1 * 1.4) });
      }
      const p2 = clamp((t - 29.1) / 0.9);
      if (p2 > 0) {
        const e = ease.outBack(p2);
        drawRubik(ctx, 300, 560, 96 * e, -rotate * 1.3 + 0.6, 0.62, t, { n: 2, alpha: clamp(p2 * 1.3) });
      }
      const p3 = clamp((t - 29.8) / 0.9);
      if (p3 > 0) {
        const e = ease.outBack(p3);
        drawRubik(ctx, 1010, 640, 62 * e, rotate * 1.6 + 1.2, 0.5, t, { n: 4, alpha: clamp(p3 * 1.2) });
      }
      // 右侧大数字（分两行，避免超出安全边）
      const cu = countUp(t, 28.8, 3.6, 43252003274489856000, { sep: ',' });
      text(ctx, '合法状态数', 1160, 212, { size: 34, color: 'rgba(206,220,244,.85)', align: 'left' });
      const parts = cu.text.split(',');
      const line1 = parts.slice(0, 5).join(','), line2 = parts.slice(5).join(',');
      text(ctx, line1, 1160, 288, { size: 52, color: '#fff', font: FONT.mono, weight: 700, align: 'left', glowR: 18 });
      text(ctx, line2, 1160, 356, { size: 52, color: '#fff', font: FONT.mono, weight: 700, align: 'left', glowR: 18 });
      if (t > 31.4) formula(ctx, '= 8! · 3⁷ · 12! · 2¹⁰ / 2', 1160, 440, { size: 34, color: rgba('gold', 1), align: 'left', glowR: 14 });
      if (t > 32.2) drawRuns(ctx, runs('每个转动都是置换，\n所有转动合成一个群——\n所以*一定能复原*。', { size: 27, color: 'rgba(212,226,248,.9)' }), 1160, 570, t - 32.2, { align: 'left', glowR: 0, letter: 1, stagger: 0.03 });
      ctx.restore();
    }

    /* ------------------------------ HUD ---------------------------- */
    chapter(ctx, t, { index: '03', title: '置换 · 重新编号', total: 6, life: [0.6, 33.4], progress: t / DURATION });
    statBar(ctx, 74, SAFE_BOTTOM + 4, [
      { k: 'GROUP', v: 'S₇' }, { k: 'ORDER', v: '5040' }, { k: 'CUBE', v: '4.3×10¹⁹' },
    ], (1 - clamp(inv(t, 32.4, 34))) * clamp(inv(t, 1.6, 2.6)), { color: 'magenta' });
    glitchBars(ctx, t, 14.02, 0.3, { n: 8, seed: 31 });
    glitchBars(ctx, t, 22.04, 0.3, { n: 7, seed: 11 });
    flash(ctx, W, H, t > 28.05 && t < 28.5 ? 0.22 * (1 - (t - 28.05) / 0.45) : 0);
    if (t > 26.2 && t < 27.8) energyCore(ctx, CX, 470, 60, t, { color: 'magenta', pulse: 0.8 });
    ripple(ctx, CX - 420, 480, 620, t, { color: 'cyan', a: 0.1, n: 2, speed: 0.2 });
  },
};
