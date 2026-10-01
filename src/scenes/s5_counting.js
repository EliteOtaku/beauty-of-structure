/* ============================================================================
 * S5 · 计数 —— Burnside 引理：用群把"看起来一样"的东西数清楚
 * 场景：6 颗珠子、2 种颜色的手串，旋转/翻转视为同一条
 * 0-8s    64 个染色方案铺满（每个方案 = 一个 6 位二进制）
 * 8-17s   旋转/翻转把它们粘成轨道：真枚举给出的答案 14
 * 17-26s  Burnside：12 个群元素各自的"不动染色数"求和再平均
 * 26-34s  公式 |X/G| = (1/|G|) Σ |X^g|，收束
 * ==========================================================================*/
import {
  clamp, inv, ease, mix, rgba, TAU, glow, glowLine, ring, text, flash, FONT, rng,
} from '../core.js';
import {
  W, H, caption, chapter, statBar, formula, drawRuns, runs, shakeOffset, glitchBars,
  core as energyCore, starfield, topGlow, roundedRect, ripple, SAFE_BOTTOM, countUp,
} from '../nars.js';

export const DURATION = 34;

const NBEAD = 6;
const NCOL = 2;
const GROUP_ORDER = 12;   // D₆
const CX = W / 2;
void GROUP_ORDER;

/* --------------------------- 真枚举：轨道分解 ---------------------------- */
const ALL = Array.from({ length: NCOL ** NBEAD }, (_, i) => {
  const bits = [];
  for (let k = 0; k < NBEAD; k++) bits.push((i >> k) & 1);
  return bits;
});
/** 二面体群 D₆ 在 6 个位置上的作用（旋转 k 格 + 翻转）
 *  翻转取 σ_r(i) = (r - i) mod n（顶点型反射），必须保证是置换 */
const GROUP = [];
for (let r = 0; r < NBEAD; r++) {
  GROUP.push({ rot: r, mir: false, perm: Array.from({ length: NBEAD }, (_, i) => (i + r) % NBEAD) });
  GROUP.push({ rot: r, mir: true, perm: Array.from({ length: NBEAD }, (_, i) => (((r - i) % NBEAD) + NBEAD) % NBEAD) });
}
const apply = (cfg, perm) => perm.map((p) => cfg[p]);
const key = (cfg) => cfg.join('');

const { orbits, orbitOf } = (() => {
  const seen = new Set();
  const orbits = [];
  const orbitOf = new Array(ALL.length).fill(-1);
  ALL.forEach((cfg, i) => {
    if (seen.has(i)) return;
    const idx = orbits.length;
    const orb = [];
    GROUP.forEach((g) => {
      const img = key(apply(cfg, g.perm));
      const j = parseInt(img.split('').reverse().join(''), 2);   // bits[0] 是低位
      if (!seen.has(j)) { seen.add(j); orb.push(j); orbitOf[j] = idx; }
    });
    orbits.push(orb);
  });
  return { orbits, orbitOf };
})();
/** Burnside 分解：每个群元素的不动染色数 */
const FIXED = GROUP.map((g) => {
  const perm = g.perm;
  // 置换的循环数 → 不动染色数 = 2^(循环数)
  const seen = new Array(NBEAD).fill(false);
  let cycles = 0;
  for (let i = 0; i < NBEAD; i++) {
    if (seen[i]) continue;
    cycles++;
    let j = i;
    while (!seen[j]) { seen[j] = true; j = perm[j]; }
  }
  return { cycles, fixed: NCOL ** cycles, g };
});
const BURNSIDE_SUM = FIXED.reduce((s, f) => s + f.fixed, 0);

/** 一条手串的绘制 */
function bracelet(ctx, cx, cy, r, cfg, { a = 1, scale = 1, ringCol = 'cyan', beadR = 10 } = {}) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ring(ctx, 0, 0, r, ringCol, 1.2, 0.35);
  for (let k = 0; k < NBEAD; k++) {
    const ang = -Math.PI / 2 + (TAU * k) / NBEAD;
    const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
    const on = cfg[k] === 1;
    glow(ctx, x, y, beadR * 1.9, on ? 'gold' : 'cyan', on ? 0.85 : 0.45);
    ctx.beginPath();
    ctx.arc(x, y, beadR, 0, TAU);
    ctx.fillStyle = on ? rgba('gold', 0.95) : 'rgba(12,20,36,.9)';
    ctx.fill();
    ctx.strokeStyle = on ? rgba('gold', 1) : rgba('cyan', 0.8);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}

export default {
  title: '计数',
  duration: DURATION,
  draw({ ctx, t }) {
    const shake = shakeOffset(t, 17.0, 0.4, 11, 30);
    starfield(ctx, t, { n: 140, a: 0.35 });
    topGlow(ctx, 'violet', 0.18);

    /* ============ SHOT A (0-8s)：64 个方案 ======================== */
    const aA = clamp(inv(t, 0, 0.7)) * (1 - clamp(inv(t, 7.2, 8.0)));
    if (aA > 0.01) {
      ctx.save();
      ctx.globalAlpha = aA;
      const cols = 8, rows = 8, cw = 96, ch = 92;
      const ox = 400, oy = 196;
      for (let i = 0; i < 64; i++) {
        const gx = ox + (i % cols) * cw, gy = oy + Math.floor(i / cols) * ch;
        const p = clamp((t - 0.3 - i * 0.022) / 0.5);
        if (p <= 0) continue;
        const e = ease.outBack(p);
        bracelet(ctx, gx, gy, 30 * e, ALL[i], { a: clamp(p * 1.5), scale: e, ringCol: 'cyan', beadR: 6.5 });
      }
      // 右侧说明（网格右方空白区）
      const px = 1560;
      if (t > 2.6) drawRuns(ctx, runs('但把它们串起来转一转，\n很多方案看起来*完全一样*。', { size: 27, color: 'rgba(212,226,248,.88)' }), px, 330, t - 2.6, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      if (t > 4.2) formula(ctx, '2⁶ = 64', px, 490, { size: 44, color: rgba('cyan', 1), glowR: 14 });
      if (t > 5.0) formula(ctx, '真的只有 64 种？', px, 580, { size: 32, color: rgba('magenta', 1), glowR: 12 });
      if (t > 2.0) caption(ctx, '6 颗珠子，2 种颜色：*64* 个方案', W / 2 + 60, 996, t - 2.0, { size: 44, maxWidth: 1500, glowR: 20, letter: 2 });
      ctx.restore();
    }

    /* ============ SHOT B (8-17s)：轨道 ============================ */
    const aB = clamp(inv(t, 8, 8.8)) * (1 - clamp(inv(t, 16.2, 17.0)));
    if (aB > 0.01) {
      ctx.save();
      ctx.globalAlpha = aB;
      // 左：选中一个方案并展示它的 12 个像
      const sel = 0b010101; // 交替色
      const orb = orbits[orbitOf[sel]];
      const cx = 420, cy = 470;
      bracelet(ctx, cx, cy, 96, ALL[sel], { ringCol: 'gold', beadR: 22 });
      const spin = t * 0.9;
      for (let i = 0; i < orb.length; i++) {
        const ang = -Math.PI / 2 + (i / orb.length) * TAU;
        const g = clamp((t - 9.0 - i * 0.08) / 0.6);
        if (g <= 0) continue;
        const rr = 230;
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        ctx.save();
        ctx.globalAlpha *= g;
        glowLine(ctx, cx + Math.cos(ang) * 120, cy + Math.sin(ang) * 120, x * 0.94 + cx * 0.06, y * 0.94 + cy * 0.06, 'gold', 1, 0.35);
        bracelet(ctx, x, y, 44, ALL[orb[i]], { ringCol: 'gold', beadR: 9, a: g });
        ctx.restore();
      }
      // 旋转的指示
      ctx.save();
      ctx.setLineDash([8, 12]);
      ctx.strokeStyle = rgba('cyan', 0.4);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 300, spin, spin + 1.4);
      ctx.stroke();
      ctx.restore();
      text(ctx, `这一个方案的 ${orb.length} 个"样子"`, cx, cy + 360, { size: 30, color: 'rgba(212,226,248,.85)' });
      // 中：压缩成一条
      if (t > 11.6) {
        const p = clamp((t - 11.6) / 1.0);
        ctx.save();
        ctx.globalAlpha *= p;
        glowLine(ctx, cx + 340, cy, cx + 460, cy, 'magenta', 2.6, 0.9);
        text(ctx, '视为同一条', cx + 400, cy - 44, { size: 26, color: rgba('magenta', 1) });
        ctx.restore();
      }
      // 右：14 条不同的手串
      const gx0 = 1080;
      if (t > 12.4) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 12.4) / 0.9);
        text(ctx, '不同的手串', gx0 + 190, 232, { size: 40, color: '#fff', glowR: 16 });
        orbits.forEach((o, i) => {
          const p = clamp((t - 12.8 - i * 0.09) / 0.5);
          if (p <= 0) return;
          const x = gx0 + (i % 7) * 118, y = 340 + Math.floor(i / 7) * 150;
          bracelet(ctx, x, y, 42, ALL[o[0]], { a: clamp(p * 1.4), scale: ease.outBack(p), ringCol: 'magenta', beadR: 9 });
        });
        const cu = countUp(t, 13.4, 1.6, orbits.length);
        text(ctx, cu.text, gx0 + 190, 700, { size: 78, color: rgba('gold', 1), font: FONT.mono, weight: 700, glowR: 22 });
        text(ctx, '条本质不同的手串', gx0 + 190, 780, { size: 30, color: 'rgba(212,226,248,.85)' });
        ctx.restore();
      }
      if (t > 15.0) caption(ctx, '群作用把 64 个方案，粘成 *14 条轨道*', CX, 1000, t - 15.0, { size: 46, maxWidth: 1500, glowR: 22, letter: 2 });
      ctx.restore();
    }

    /* ============ SHOT C (17-26s)：Burnside ======================= */
    const aC = clamp(inv(t, 17, 17.8)) * (1 - clamp(inv(t, 25.2, 26.0)));
    if (aC > 0.01) {
      ctx.save();
      ctx.globalAlpha = aC;
      ctx.translate(shake[0], shake[1]);
      // 12 个群元素方块：每个显示"不动染色数"
      const cellW = 138, cellH = 128;
      const ox = 210, oy = 250;
      const reveal = clamp((t - 18.2) / 4.6) * 12;
      FIXED.forEach((f, i) => {
        const p = clamp(reveal - i);
        if (p <= 0) return;
        const e = ease.outBack(p);
        const x = ox + (i % 4) * (cellW + 14), y = oy + Math.floor(i / 4) * (cellH + 16);
        const isId = i === 0;
        const col = isId ? 'gold' : (i % 2 === 0 ? 'cyan' : 'magenta');
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.4);
        ctx.translate(x + (1 - e) * 24, y);
        ctx.scale(e, e);
        ctx.fillStyle = rgba(col, 0.1);
        roundedRect(ctx, 0, 0, cellW, cellH, 14);
        ctx.fill();
        ctx.strokeStyle = rgba(col, 0.55);
        ctx.lineWidth = 1.4;
        roundedRect(ctx, 0, 0, cellW, cellH, 14);
        ctx.stroke();
        const label = isId ? 'e（不动）' : (f.g.mir ? `翻转 ${f.g.rot}` : `旋转 ${f.g.rot}`);
        text(ctx, label, cellW / 2, 30, { size: 20, color: 'rgba(206,220,244,.85)', font: FONT.mono, weight: 600 });
        text(ctx, `${f.fixed}`, cellW / 2, 74, { size: 40, color: '#fff', font: FONT.mono, weight: 700, glowR: 12 });
        text(ctx, `2^${f.cycles}`, cellW / 2, 108, { size: 20, color: rgba(col, 0.9), font: FONT.mono, weight: 600 });
        ctx.restore();
      });
      // 右侧求和
      const px = 1080;
      text(ctx, 'Burnside 引理', px, 230, { size: 44, color: '#fff', glowR: 18 });
      if (t > 20.4) {
        const sum = countUp(t, 20.4, 2.4, BURNSIDE_SUM);
        formula(ctx, `Σ |Xᵍ| = ${sum.text}`, px, 330, { size: 42, color: rgba('gold', 1), glowR: 14 });
      }
      if (t > 22.6) formula(ctx, '÷  12  =  14', px, 420, { size: 42, color: rgba('cyan', 1), glowR: 14 });
      if (t > 23.6) drawRuns(ctx, runs('把每个群元素的"不动方案数"\n加起来，再除以群的阶——\n*答案自己跳出来*。', { size: 28, color: 'rgba(214,226,248,.9)' }), px, 560, t - 23.6, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      ctx.restore();
    }

    /* ============ SHOT D (26-34s)：公式与收束 ===================== */
    const aD = clamp(inv(t, 26, 26.8));
    if (aD > 0.01) {
      ctx.save();
      ctx.globalAlpha = aD;
      // 大公式
      if (t > 27.0) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 27.0) / 0.8);
        formula(ctx, '|X / G|  =  (1 / |G|) · Σ  |Xᵍ|', CX, 300, { size: 62, color: rgba('gold', 1), glowR: 22 });
        ctx.restore();
      }
      if (t > 28.2) {
        drawRuns(ctx, runs('群作用在集合上，\n轨道数 = 各元素不动点数的平均。', { size: 30, color: 'rgba(214,226,248,.9)' }), CX, 430, t - 28.2, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      }
      // 三例并行
      const cases = [
        { label: '6 颗珠子 2 色', val: orbits.length, col: 'gold' },
        { label: '6 颗珠子 3 色', val: BURNSIDE_6_3, col: 'cyan' },
        { label: '8 颗珠子 2 色', val: BURNSIDE_8_2, col: 'magenta' },
      ];
      cases.forEach((c, i) => {
        const p = clamp((t - 29.4 - i * 0.35) / 0.7);
        if (p <= 0) return;
        const e = ease.outBack(p);
        const x = 300 + i * 440, y = 660;
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.4);
        ctx.translate(x + (1 - e) * 30, y);
        ctx.scale(e, e);
        ctx.fillStyle = rgba(c.col, 0.1);
        roundedRect(ctx, -190, -110, 380, 220, 18);
        ctx.fill();
        ctx.strokeStyle = rgba(c.col, 0.5);
        ctx.lineWidth = 1.5;
        roundedRect(ctx, -190, -110, 380, 220, 18);
        ctx.stroke();
        bracelet(ctx, 0, -30, 48, ALL[(i * 37) % 64], { ringCol: c.col, beadR: 10, a: 0.95 });
        text(ctx, c.label, 0, 46, { size: 26, color: 'rgba(212,226,248,.9)' });
        text(ctx, `${c.val}`, 0, 92, { size: 40, color: rgba(c.col, 1), font: FONT.mono, weight: 700, glowR: 12 });
        ctx.restore();
      });
      if (t > 31.8) caption(ctx, '抽象的群，是*数东西*的机器', CX, 990, t - 31.8, { size: 48, maxWidth: 1500, glowR: 22, letter: 3 });
      ctx.restore();
    }

    /* ------------------------------ HUD ---------------------------- */
    chapter(ctx, t, { index: '05', title: '计数 · 把"一样"说清楚', total: 6, life: [0.6, 33.4], progress: t / DURATION });
    statBar(ctx, 74, SAFE_BOTTOM + 4, [
      { k: 'SET', v: '2⁶ = 64' }, { k: 'GROUP', v: 'D₆ (12)' }, { k: 'ORBITS', v: `${orbits.length}` },
    ], (1 - clamp(inv(t, 32.4, 34))) * clamp(inv(t, 1.6, 2.6)), { color: 'violet' });
    glitchBars(ctx, t, 8.02, 0.3, { n: 8, seed: 51 });
    glitchBars(ctx, t, 17.02, 0.3, { n: 7, seed: 23 });
    flash(ctx, W, H, t > 16.95 && t < 17.4 ? 0.18 * (1 - (t - 16.95) / 0.45) : 0);
    ripple(ctx, 420, 470, 460, t, { color: 'gold', a: 0.12, n: 2, speed: 0.22 });
    void energyCore;
    void rng;
  },
};

/** Burnside 通用计算：n 颗珠子、k 色、二面体群 Dₙ —— 直接枚举，保证数字正确 */
function burnsideN(n, k) {
  const cfgOf = (i) => Array.from({ length: n }, (_, b) => Math.floor(i / k ** b) % k);
  const all = Array.from({ length: k ** n }, (_, i) => cfgOf(i));
  const group = [];
  for (let r = 0; r < n; r++) {
    group.push(Array.from({ length: n }, (_, i) => (i + r) % n));
    group.push(Array.from({ length: n }, (_, i) => (((r - i) % n) + n) % n));
  }
  let sum = 0;
  group.forEach((perm) => {
    all.forEach((cfg) => {
      if (perm.map((p) => cfg[p]).join('') === cfg.join('')) sum++;
    });
  });
  return Math.round(sum / (2 * n));
}
const BURNSIDE_6_3 = burnsideN(6, 3);   // 92 条
const BURNSIDE_8_2 = burnsideN(8, 2);   // 30 条
