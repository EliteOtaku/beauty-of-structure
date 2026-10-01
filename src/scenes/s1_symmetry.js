/* ============================================================================
 * S1 · 对称 —— 正方形的 8 种对称构成二面体群 D₄
 * 0-5.5s  粒子汇聚成方 + 主标题
 * 5.5-10s 旋转的正方形：对称 = 让图形看起来没变
 * 10-14s  8 个群元素环形展开（旋转 4 + 镜像 4 条轴）
 * 14-20s  凯莱表：8×8 全表断言（闭包）
 * 20-26s  群公理板 + 收束
 * ==========================================================================*/
import {
  clamp, inv, ease, mix, rgba, TAU, glow, glowLine, ring, text, flash, rng,
  FONT, mixColor, rgbStr,
} from '../core.js';
import {
  W, H, caption, chapter, statBar, formula, drawRuns, runs, shakeOffset, glitchBars,
  core as energyCore, starfield, topGlow, roundedRect, ripple, SAFE_BOTTOM,
} from '../nars.js';

export const DURATION = 38;

/* ------------------------------ 布局常量 -------------------------------- */
const CX = W / 2, CY = 560;
const SIDE = 300;
const EL_COLORS = ['gold', 'gold', 'gold', 'gold', 'cyan', 'cyan', 'cyan', 'cyan'];
const EL_NAMES = ['e', 'r', 'r²', 'r³', 's', 'sr', 'sr²', 'sr³'];

/** 正方形顶点（相对中心） */
const SQ = [[-SIDE, -SIDE], [SIDE, -SIDE], [SIDE, SIDE], [-SIDE, SIDE]];

/** D₄ 的 8 个元素 */
const ELS = [
  { name: 'e', rot: 0, mir: null },
  { name: 'r', rot: Math.PI / 2, mir: null },
  { name: 'r²', rot: Math.PI, mir: null },
  { name: 'r³', rot: -Math.PI / 2, mir: null },
  { name: 's', rot: 0, mir: 0 },
  { name: 'sr', rot: 0, mir: Math.PI / 4 },
  { name: 'sr²', rot: 0, mir: Math.PI / 2 },
  { name: 'sr³', rot: 0, mir: (3 * Math.PI) / 4 },
];

/** 顶点置换：把几何元素映射成置换，用于生成严格正确的凯莱表 */
function permOf(el) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    let [x, y] = SQ[k];
    if (el.mir !== null) {
      const c = Math.cos(2 * el.mir), s = Math.sin(2 * el.mir);
      const nx = x * c + y * s, ny = x * s - y * c;
      x = nx; y = ny;
    }
    const c = Math.cos(el.rot), s = Math.sin(el.rot);
    const rx = x * c - y * s, ry = x * s + y * c;
    let best = 0, bd = Infinity;
    SQ.forEach(([px, py], idx) => {
      const d = (px - rx) ** 2 + (py - ry) ** 2;
      if (d < bd) { bd = d; best = idx; }
    });
    out[k] = best;
  }
  return out;
}
const PERMS = ELS.map(permOf);
const CAYLEY = PERMS.map((p) => PERMS.map((q) => {
  const comp = q.map((k) => p[k]);
  return PERMS.findIndex((r) => r.every((v, i) => v === comp[i]));
}));

/* ------------------------- 背景粒子（汇聚成方） -------------------------- */
const P_N = 520;
const PARTICLES = (() => {
  const r = rng(20241001);
  return Array.from({ length: P_N }, (_, i) => {
    const per = Math.floor(i / (P_N / 4));
    const u = r();
    const edge = [
      [-SIDE, -SIDE + u * 2 * SIDE], [SIDE, -SIDE + u * 2 * SIDE],
      [-SIDE + u * 2 * SIDE, -SIDE], [-SIDE + u * 2 * SIDE, SIDE],
    ][per];
    const a = r() * TAU;
    const rad = 780 + r() * 900;
    return {
      tx: edge[0], ty: edge[1],
      sx: Math.cos(a) * rad, sy: Math.sin(a) * rad * 0.75,
      delay: 0.12 + r() * 1.5,
      spd: 0.8 + r() * 0.5,
      color: per < 2 ? 'gold' : 'cyan',
      pr: 6 + r() * 12,
    };
  });
})();

/** 群元素小图：带"标记角"的正方形 + 镜像轴 */
function elementGlyph(ctx, x, y, el, s, t, { active = false, color = 'cyan' } = {}) {
  const rot = el.rot + (active ? Math.sin(t * 2.4) * 0.05 : 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.rect(-s, -s, s * 2, s * 2);
  ctx.strokeStyle = rgba(color, active ? 0.95 : 0.5);
  ctx.lineWidth = active ? 3 : 1.6;
  ctx.stroke();
  ctx.fillStyle = rgba(color, active ? 0.1 : 0.05);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-s, -s, s * 0.26, 0, TAU);
  ctx.fillStyle = rgba('gold', active ? 1 : 0.75);
  ctx.fill();
  glow(ctx, -s, -s, s * 0.9, 'gold', active ? 0.7 : 0.4);
  [[-s, -s], [s, -s], [s, s], [-s, s]].forEach(([px, py], i) => {
    glow(ctx, px, py, active ? 12 : 8, i === 0 ? 'gold' : color, active ? 0.9 : 0.6);
  });
  ctx.restore();
  if (el.mir !== null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(el.mir);
    ctx.setLineDash([9, 12]);
    ctx.strokeStyle = rgba('magenta', active ? 0.9 : 0.42);
    ctx.lineWidth = active ? 2.4 : 1.3;
    ctx.beginPath();
    ctx.moveTo(-s * 1.75, 0);
    ctx.lineTo(s * 1.75, 0);
    ctx.stroke();
    ctx.restore();
  }
}

export default {
  title: '对称',
  duration: DURATION,
  draw({ ctx, t }) {
    const zoom = 1 + 0.42 * (1 - ease.outExpo(inv(t, 0, 4.2))) + 0.1 * Math.sin(t * 0.5) * inv(t, 6, 10) * (1 - inv(t, 14, 18));
    const shake = shakeOffset(t, 5.55, 0.5, 15, 30);
    const shake2 = shakeOffset(t, 13.9, 0.45, 11, 34);

    /* ------------------------------ 背景 ---------------------------- */
    // 粒子方框只在开场镜头存在，之后完全退场（避免与后续构图抢画面）
    const boxA = clamp(inv(t, 0, 0.7)) * (1 - clamp(inv(t, 4.4, 5.3)));
    if (boxA > 0.01) {
      ctx.save();
      ctx.globalAlpha = boxA;
      ctx.translate(CX + shake[0], CY + shake[1]);
      ctx.scale(zoom, zoom);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < P_N; i++) {
        const p = PARTICLES[i];
        const lp = ease.outQuart(clamp((t - p.delay) / (2.1 * p.spd)));
        if (lp <= 0) continue;
        const x = mix(p.sx, p.tx, lp), y = mix(p.sy, p.ty, lp);
        const tw = 0.6 + 0.4 * Math.sin(t * 3 + i);
        glow(ctx, x, y, p.pr * (1 - 0.4 * lp) * tw, p.color, 0.22 + 0.4 * lp);
      }
      const lp = ease.outExpo(inv(t, 0.9, 3.0));
      if (lp > 0) {
        ctx.strokeStyle = rgba('cyan', 0.9 * lp);
        ctx.lineWidth = 3 * lp;
        ctx.beginPath();
        SQ.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.stroke();
        SQ.forEach(([x, y], i) => {
          const pp = clamp((t - 1.1 - i * 0.14) / 0.5);
          glow(ctx, x, y, 26 * pp, 'gold', pp * 0.9);
          if (pp > 0 && pp < 1) ring(ctx, x, y, 18 + 34 * (1 - pp), 'gold', 2, (1 - pp) * 0.8);
        });
      }
      ctx.restore();
    }
    starfield(ctx, t, { n: 200, a: 0.5 });
    topGlow(ctx, 'violet', 0.26);
    ctx.save();
    ctx.globalAlpha = 0.09 * clamp(inv(t, 0.5, 3));
    ctx.strokeStyle = rgba('cyan', 0.55);
    ctx.lineWidth = 1;
    const gs = 96, off = (t * 18) % gs;
    ctx.beginPath();
    for (let x = -gs + off; x < W + gs; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -gs + off; y < H + gs; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.restore();

    /* ============ SHOT B (5.5-10s)：旋转 = 图形看起来没变 ========== */
    const aB = clamp(inv(t, 5.5, 6.1)) * (1 - clamp(inv(t, 9.5, 10.2)));
    if (aB > 0.01) {
      const seg = clamp((t - 5.6) / 3.4);
      const rot = ease.inOutCubic(seg) * TAU;
      ctx.save();
      ctx.globalAlpha = aB;
      ctx.translate(CX + shake2[0], CY + shake2[1]);
      ctx.scale(1.16, 1.16);
      for (let i = 7; i >= 0; i--) {
        const rr = rot - (i / 8) * TAU * 0.8;
        ctx.save();
        ctx.rotate(rr);
        ctx.beginPath();
        SQ.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        if (i === 0) {
          ctx.strokeStyle = rgba('gold', 0.96);
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.fillStyle = rgba('gold', 0.08);
          ctx.fill();
          SQ.forEach(([x, y]) => glow(ctx, x, y, 20, 'gold', 0.85));
        } else {
          ctx.strokeStyle = rgba('cyan', 0.22 * (1 - i / 8));
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        ctx.restore();
      }
      const deg = ((rot * 180) / Math.PI) % 360;
      const col = rgbStr(mixColor('cyan', 'gold', Math.sin(t * 2) * 0.5 + 0.5), 1);
      // 读数：在镜头（translate+scale 1.16）内的局部坐标，落在正方形下方
      formula(ctx, `${deg.toFixed(0)}°`, 0, SIDE + 190, { size: 42, color: col, glowR: 16 });
      ctx.setLineDash([6, 10]);
      ctx.strokeStyle = rgba('white', 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, SIDE * 1.55, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* ============ SHOT C (10-14s)：8 个群元素环形展开 ============== */
    const aC = clamp(inv(t, 10, 10.7)) * (1 - clamp(inv(t, 13.5, 14.2)));
    if (aC > 0.01) {
      const R = 380;
      const edgeR = SIDE * 1.42; // 从中心正方形外侧起笔
      ctx.save();
      ctx.globalAlpha = aC;
      ctx.translate(CX, CY + 10);
      ctx.beginPath();
      SQ.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = rgba('white', 0.85);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = rgba('cyan', 0.06);
      ctx.fill();
      // 中心标记角
      glow(ctx, -SIDE, -SIDE, 26, 'gold', 0.9);
      for (let i = 0; i < 8; i++) {
        const ang = -Math.PI / 2 + (i / 8) * TAU;
        const x = Math.cos(ang) * R, y = Math.sin(ang) * R;
        const g = clamp((t - 10.3 - i * 0.07) / 0.6);
        if (g <= 0) continue;
        ctx.save();
        ctx.globalAlpha *= g;
        glowLine(ctx, Math.cos(ang) * edgeR, Math.sin(ang) * edgeR, x * 0.78, y * 0.78, EL_COLORS[i], 1.3, 0.5);
        elementGlyph(ctx, x, y, ELS[i], 38, t, { active: true, color: EL_COLORS[i] });
        text(ctx, EL_NAMES[i], x, y - 74, { size: 38, color: rgba(EL_COLORS[i], 1), font: FONT.serif, weight: 700, glowR: 14 });
        ctx.restore();
      }
      // 环上缓慢游走的光点
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + (i / 3) * TAU;
        glow(ctx, Math.cos(a) * R, Math.sin(a) * R, 26, 'white', 0.5);
      }
      ctx.restore();
    }

    /* ============ SHOT D (14-20s)：凯莱表 ========================== */
    const aD = clamp(inv(t, 14, 14.8)) * (1 - clamp(inv(t, 19.6, 20.2)));
    if (aD > 0.01) {
      const cell = 74;
      const ox = CX - (cell * 8) / 2 - 150;
      const oy = CY - (cell * 8) / 2 + 20;
      ctx.save();
      ctx.globalAlpha = aD;
      ELS.forEach((el, i) => {
        text(ctx, el.name, ox + i * cell + cell / 2, oy - 32, { size: 29, color: rgba(EL_COLORS[i], 0.95), font: FONT.serif, weight: 700 });
        text(ctx, el.name, ox - 30, oy + i * cell + cell / 2, { size: 29, color: rgba(EL_COLORS[i], 0.95), font: FONT.serif, weight: 700, align: 'right' });
      });
      const prog = clamp((t - 14.9) / 3.2) * 64;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const idx = i * 8 + j;
          if (idx > prog) continue;
          const fresh = clamp(1 - (prog - idx) / 2.4);
          const k = CAYLEY[i][j];
          const col = k < 4 ? 'gold' : 'cyan';
          const x = ox + j * cell, y = oy + i * cell;
          ctx.fillStyle = rgba(col, 0.08 + 0.18 * (1 - fresh) + 0.16 * fresh);
          ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
          ctx.strokeStyle = rgba(col, 0.22 + 0.62 * fresh);
          ctx.lineWidth = 1 + fresh * 2;
          ctx.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
          text(ctx, ELS[k].name, x + cell / 2, y + cell / 2, { size: 30, color: rgba(col, 0.6 + 0.4 * (1 - fresh * 0.6)), font: FONT.serif, weight: 700 });
        }
      }
      for (let i = 0; i < 8; i++) {
        if (CAYLEY[i][i] !== 0) continue;
        ctx.strokeStyle = rgba('magenta', 0.55);
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + i * cell + 1, oy + i * cell + 1, cell - 2, cell - 2);
      }
      const ax = ox + cell * 8 + 76;
      text(ctx, '闭包', ax, CY - 96, { size: 46, color: '#fff', align: 'left', glowR: 18 });
      if (t > 15.6) drawRuns(ctx, runs('任意两个元素复合，\n结果永远还在群里。', { size: 27, color: 'rgba(206,220,244,.86)' }), ax, CY - 8, t - 15.6, { align: 'left', glowR: 0, letter: 1, stagger: 0.03 });
      if (t > 17.0) formula(ctx, '|D₄| = 8', ax, CY + 128, { size: 40, align: 'left' });
      if (t > 17.6) formula(ctx, 'r⁴ = e', ax, CY + 190, { size: 40, align: 'left', color: rgba('cyan', 1) });
      ctx.restore();
    }

    /* ============ SHOT E (20-26s)：群公理板 ======================== */
    const aE = clamp(inv(t, 20, 20.8)) * (1 - clamp(inv(t, 25.6, 26.4)));
    if (aE > 0.01) {
      ctx.save();
      ctx.globalAlpha = aE;
      const axioms = [
        ['封闭性', '(G1)', 'a, b ∈ G  ⇒  a·b ∈ G', 'gold'],
        ['结合律', '(G2)', '(a·b)·c = a·(b·c)', 'cyan'],
        ['单位元', '(G3)', 'e·a = a·e = a', 'violet'],
        ['逆元', '(G4)', 'a·a⁻¹ = e', 'magenta'],
      ];
      axioms.forEach(([name, tag, f, col], i) => {
        const p = clamp((t - 20.2 - i * 0.26) / 0.7);
        if (p <= 0) return;
        const e = ease.outBack(p);
        const x = 230 + (i % 2) * 740;
        const y = 252 + Math.floor(i / 2) * 236;
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.4);
        ctx.translate(x + (1 - e) * -50, y);
        ctx.scale(e, e);
        ctx.fillStyle = rgba(col, 0.09);
        roundedRect(ctx, 0, 0, 660, 182, 16);
        ctx.fill();
        ctx.strokeStyle = rgba(col, 0.55);
        ctx.lineWidth = 1.6;
        roundedRect(ctx, 0, 0, 660, 182, 16);
        ctx.stroke();
        ctx.fillStyle = rgba(col, 0.95);
        ctx.fillRect(0, 24, 4, 134);
        text(ctx, tag, 40, 50, { size: 24, color: rgba(col, 0.85), font: FONT.mono, align: 'left', weight: 700, letter: 2 });
        text(ctx, name, 130, 50, { size: 36, color: '#fff', align: 'left', weight: 700, glowR: 12 });
        formula(ctx, f, 40, 126, { size: 34, color: 'rgba(226,236,252,.95)', align: 'left', glowR: 6 });
        ctx.restore();
      });
      ctx.restore();
    }

    /* ============ SHOT F (26-33s)：不止一种对称 ==================== */
    const aF = clamp(inv(t, 26, 26.9)) * (1 - clamp(inv(t, 32.4, 33.2)));
    if (aF > 0.01) {
      ctx.save();
      ctx.globalAlpha = aF;
      const shapes = [
        { n: 3, name: '正三角形', group: 'D₃', order: 6, col: 'cyan' },
        { n: 5, name: '正五边形', group: 'D₅', order: 10, col: 'gold' },
        { n: 12, name: '正十二边形', group: 'D₁₂', order: 24, col: 'magenta' },
      ];
      shapes.forEach((sh, i) => {
        const p = clamp((t - 26.3 - i * 0.3) / 0.8);
        if (p <= 0) return;
        const e = ease.outBack(p);
        const x = 420 + i * 540, y = 480;
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.4);
        ctx.translate(x, y);
        ctx.scale(e, e);
        // 形状轮廓 + 旋转残影
        for (let g = 5; g >= 0; g--) {
          const rr = (t - 26.3) * 0.5 - g * 0.16;
          ctx.save();
          ctx.rotate(rr);
          const pts = Array.from({ length: sh.n }, (_, k) => {
            const ang = -Math.PI / 2 + (TAU * k) / sh.n;
            return [Math.cos(ang) * 118, Math.sin(ang) * 118];
          });
          ctx.beginPath();
          pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.closePath();
          ctx.strokeStyle = rgba(sh.col, g === 0 ? 0.95 : 0.2 * (1 - g / 5));
          ctx.lineWidth = g === 0 ? 3 : 1.2;
          ctx.stroke();
          ctx.restore();
        }
        // 顶点
        const spin = (t - 26.3) * 0.5;
        for (let k = 0; k < sh.n; k++) {
          const ang = -Math.PI / 2 + (TAU * k) / sh.n + spin;
          glow(ctx, Math.cos(ang) * 118, Math.sin(ang) * 118, 13, 'gold', 0.8);
        }
        text(ctx, sh.name, 0, 200, { size: 32, color: 'rgba(222,232,250,.92)', weight: 700 });
        text(ctx, `${sh.group}   阶 ${sh.order}`, 0, 254, { size: 30, color: rgba(sh.col, 1), font: FONT.serif, weight: 700, glowR: 12 });
        ctx.restore();
      });
      if (t > 29.4) caption(ctx, '形状千变万化，*群只有几个*', CX, 880, t - 29.4, { size: 50, maxWidth: 1500, glowR: 22, letter: 3 });
      ctx.restore();
    }

    /* ============ 收束字幕 (33-38s) ================================ */
    const aG = clamp(inv(t, 33.2, 34.2));
    if (aG > 0.01) {
      ctx.save();
      ctx.globalAlpha = aG;
      caption(ctx, '研究结构本身，\n而不是某一张图', CX, 470, t - 33.4, { size: 58, maxWidth: 1500, glowR: 26, letter: 4, lineGap: 1.5 });
      if (t > 35.8) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 35.8) / 0.9);
        formula(ctx, '对称  ⊂  群  ⊂  结构', CX, 700, { size: 38, color: rgba('gold', 1), glowR: 14 });
        ctx.restore();
      }
      ctx.restore();
    }

    /* ------------------------------ HUD ---------------------------- */
    chapter(ctx, t, { index: '01', title: '对称 · 从一张正方形开始', total: 6, life: [0.6, 37.4], progress: t / DURATION });
    statBar(ctx, 74, SAFE_BOTTOM + 4, [
      { k: 'GROUP', v: 'D₄' }, { k: 'ORDER', v: '8' }, { k: 'ACTION', v: '正方形' },
    ], (1 - clamp(inv(t, 32.2, 34.0))) * clamp(inv(t, 1.6, 2.6)), { color: 'cyan' });

    if (t > 1.5 && t < 4.8) {
      const out = 1 - clamp(inv(t, 4.0, 4.8));
      ctx.save();
      ctx.globalAlpha = out;
      caption(ctx, '*抽 象 代 数*', CX, 168, t - 1.5, { size: 104, maxWidth: 1600, glowR: 34, stagger: 0.07, letter: 8, rise: 40 });
      caption(ctx, '结构之美 · 第一场：对称', CX, 268, t - 2.6, { size: 32, maxWidth: 1600, glowR: 10, stagger: 0.03, letter: 6, color: 'rgba(206,222,250,.9)' });
      ctx.restore();
    }
    flash(ctx, W, H, t > 24.2 ? 0.2 * clamp(1 - (t - 24.2) / 0.5) : 0);
    glitchBars(ctx, t, 13.95, 0.32, { n: 8 });
    glitchBars(ctx, t, 5.58, 0.28, { n: 7, seed: 13 });
    if (t > 6.5 && t < 9.6) energyCore(ctx, CX, CY, 58, t, { color: 'violet', pulse: 0.6 });
    ripple(ctx, CX, CY, 520, t, { color: 'cyan', a: 0.14, n: 2, speed: 0.26 });
  },
};
