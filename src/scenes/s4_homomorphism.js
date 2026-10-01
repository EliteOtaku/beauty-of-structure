/* ============================================================================
 * S4 · 同态 —— 把大群压成小群的"透镜"：核、像、商群
 * 0-9s    C₈→C₄：全表映射线，每根线保持乘法
 * 9-18s   压缩：染色圈从 8 个塌成 4 个，相邻两格合并
 * 18-27s  核 = 所有被压成单位元的元素；G/ker φ ≅ im φ
 * 27-36s  同态基本定理：|G| = |ker φ| · |im φ|
 * ==========================================================================*/
import {
  clamp, inv, ease, mix, rgba, TAU, glow, glowLine, ring, text, flash, FONT, rng,
} from '../core.js';
import {
  W, H, caption, chapter, statBar, formula, drawRuns, runs, shakeOffset, glitchBars,
  core as energyCore, starfield, topGlow, roundedRect, ripple, SAFE_BOTTOM,
} from '../nars.js';

export const DURATION = 36;

const CX = W / 2;
const R8 = 250, R4 = 150;
const C8 = [660, 470], C4 = [1420, 470];

/** 同态 φ: C₈ → C₄, φ(gᵏ) = g^(k mod 4) */
const phi = (k) => k % 4;
const P8 = Array.from({ length: 8 }, (_, k) => {
  const a = -Math.PI / 2 + (TAU * k) / 8;
  return [C8[0] + Math.cos(a) * R8, C8[1] + Math.sin(a) * R8];
});
const P4 = Array.from({ length: 4 }, (_, k) => {
  const a = -Math.PI / 2 + (TAU * k) / 4;
  return [C4[0] + Math.cos(a) * R4, C4[1] + Math.sin(a) * R4];
});
const SUPS = ['', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸'];
const el8 = (k) => (k === 0 ? 'e' : `r${SUPS[k]}`);
const el4 = (k) => (k === 0 ? 'e' : `s${SUPS[k]}`);

export default {
  title: '同态',
  duration: DURATION,
  draw({ ctx, t }) {
    const shake = shakeOffset(t, 18.0, 0.4, 11, 30);
    starfield(ctx, t, { n: 150, a: 0.35 });
    topGlow(ctx, 'gold', 0.16);

    /* 常驻：两个圆与元素（各段共享，形成连续感） */
    const drawCircles = (prog8, prog4, { label8 = true, label4 = true } = {}) => {
      // 大圆 C₈
      ring(ctx, C8[0], C8[1], R8, 'cyan', 1.4, 0.3 * prog8);
      for (let k = 0; k < 8; k++) {
        const [x, y] = P8[k];
        const g = clamp(prog8 - k * 0.06);
        if (g <= 0) continue;
        const col = k % 2 === 0 ? 'cyan' : 'gold';
        glow(ctx, x, y, 20 * g, col, 0.85 * g);
        if (label8) text(ctx, el8(k), x * 1.0 + (x - C8[0]) * 0.22, y + (y - C8[1]) * 0.22, {
          size: 32, color: rgba(col, 0.98 * g), font: FONT.serif, weight: 700,
        });
      }
      text(ctx, 'G = C₈', C8[0], C8[1] - 176, { size: 34, color: rgba('cyan', 0.9), font: FONT.serif, weight: 700, a: prog8, glowR: 12 });
      text(ctx, '8 个元素', C8[0], C8[1] + 196, { size: 26, color: 'rgba(206,220,244,.7)', a: prog8 });
      // 小圆 C₄
      ring(ctx, C4[0], C4[1], R4, 'magenta', 1.4, 0.3 * prog4);
      for (let k = 0; k < 4; k++) {
        const [x, y] = P4[k];
        const g = clamp(prog4 - k * 0.1);
        if (g <= 0) continue;
        glow(ctx, x, y, 20 * g, 'magenta', 0.9 * g);
        if (label4) text(ctx, el4(k), x + (x - C4[0]) * 0.3, y + (y - C4[1]) * 0.3, {
          size: 32, color: rgba('magenta', 0.98 * g), font: FONT.serif, weight: 700,
        });
      }
      text(ctx, 'H = C₄', C4[0], C4[1] - 100, { size: 34, color: rgba('magenta', 0.9), font: FONT.serif, weight: 700, a: prog4, glowR: 12 });
      text(ctx, '4 个元素', C4[0], C4[1] + 120, { size: 26, color: 'rgba(206,220,244,.7)', a: prog4 });
    };

    /* ============ SHOT A (0-9s)：保乘法的映射线 ==================== */
    const aA = clamp(inv(t, 0, 0.8)) * (1 - clamp(inv(t, 8.2, 9.0)));
    if (aA > 0.01) {
      ctx.save();
      ctx.globalAlpha = aA;
      drawCircles(clamp(inv(t, 0.4, 3.2)) * 1.5, clamp(inv(t, 1.6, 4.0)) * 1.5);
      // 映射曲线：φ(r^k) = s^(k mod 4)
      for (let k = 0; k < 8; k++) {
        const g = clamp((t - 3.0 - k * 0.1) / 0.7);
        if (g <= 0) continue;
        const [x1, y1] = P8[k];
        const [x2, y2] = P4[phi(k)];
        const col = k < 4 ? 'cyan' : 'gold';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= g;
        ctx.strokeStyle = rgba(col, 0.6);
        ctx.lineWidth = 1.8 + 1.2 * (k < 4 ? 1 : 0);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1 + (x2 - x1) * 0.35, y1, x2 - (x2 - x1) * 0.35, y2, x2, y2);
        ctx.stroke();
        // 流动的光点
        const flow = ((t * 0.55 + k * 0.13) % 1);
        const ft = flow;
        const bx = (1 - ft) ** 3 * x1 + 3 * (1 - ft) ** 2 * ft * (x1 + (x2 - x1) * 0.35) + 3 * (1 - ft) * ft * ft * (x2 - (x2 - x1) * 0.35) + ft ** 3 * x2;
        const by = (1 - ft) ** 3 * y1 + 3 * (1 - ft) ** 2 * ft * y1 + 3 * (1 - ft) * ft * ft * y2 + ft ** 3 * y2;
        glow(ctx, bx, by, 14, col, 0.75);
        ctx.restore();
      }
      if (t > 4.4) caption(ctx, '同态：保持乘法结构的*映射*', CX, 890, t - 4.4, { size: 50, maxWidth: 1300, glowR: 22, letter: 3 });
      if (t > 6.4) formula(ctx, 'φ(a · b) = φ(a) · φ(b)', CX, 990, { size: 38, color: rgba('gold', 1), glowR: 12 });
      ctx.restore();
    }

    /* ============ SHOT B (9-18s)：压缩 ============================= */
    const aB = clamp(inv(t, 9, 9.8)) * (1 - clamp(inv(t, 17.2, 18.0)));
    if (aB > 0.01) {
      ctx.save();
      ctx.globalAlpha = aB;
      const squeeze = ease.inOutCubic(clamp((t - 10.6) / 4.0));
      // 8 个元素先排成一行，再合并成 4 个
      const y = 470;
      const x0 = 360, step = 165;
      for (let k = 0; k < 8; k++) {
        const target = phi(k);
        const x = mix(x0 + k * step, x0 + 260 + target * step * 1.6, squeeze);
        const col = k % 2 === 0 ? 'cyan' : 'gold';
        const merged = squeeze > 0.02 && k % 2 === 1;
        ctx.save();
        ctx.globalAlpha *= merged ? (1 - squeeze * 0.9) : 1;
        glow(ctx, x, y, 26, col, 0.9);
        ring(ctx, x, y, 34, col, 2, 0.8);
        text(ctx, el8(k), x, y, { size: 34, color: '#fff', font: FONT.serif, weight: 700, glowR: 10 });
        ctx.restore();
      }
      // 合并后的小群
      for (let k = 0; k < 4; k++) {
        const p = clamp((squeeze - 0.55) / 0.45);
        if (p <= 0) continue;
        const x = x0 + 260 + k * step * 1.6;
        ctx.save();
        ctx.globalAlpha *= p;
        glow(ctx, x, y, 40 * p, 'magenta', 0.9);
        ring(ctx, x, y, 46, 'magenta', 2.6, 0.9);
        text(ctx, el4(k), x, y, { size: 40, color: '#fff', font: FONT.serif, weight: 700, glowR: 12 });
        ctx.restore();
      }
      // 箭头与说明
      if (t > 11.2) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 11.2) / 0.6);
        for (let i = 0; i < 5; i++) {
          const yy = 330 + i * 12;
          glowLine(ctx, CX - 300 + i * 30, yy, CX - 240 + i * 30, yy, 'cyan', 1.2, 0.4);
        }
        text(ctx, '相邻两个元素，被压到同一个像', CX, 300, { size: 34, color: 'rgba(220,232,250,.92)', glowR: 12 });
        ctx.restore();
      }
      if (t > 14.2) caption(ctx, '压下去，但*乘法关系没丢*', CX, 890, t - 14.2, { size: 50, maxWidth: 1300, glowR: 22, letter: 3 });
      ctx.restore();
    }

    /* ============ SHOT C (18-27s)：核 ============================== */
    const aC = clamp(inv(t, 18, 18.8)) * (1 - clamp(inv(t, 26.2, 27.0)));
    if (aC > 0.01) {
      ctx.save();
      ctx.globalAlpha = aC;
      ctx.translate(shake[0], shake[1]);
      drawCircles(1.4, 1.4);
      // 核：被压成 e 的元素 {e, r⁴} —— 用虚线连起来并高亮
      const ker = [0, 4];
      const pulse = 0.7 + 0.3 * Math.sin(t * 3);
      ker.forEach((k) => {
        const [x, y] = P8[k];
        glow(ctx, x, y, 46 * pulse, 'magenta', 0.9);
        ring(ctx, x, y, 30, 'magenta', 3, 0.95);
      });
      ctx.save();
      ctx.setLineDash([10, 12]);
      ctx.strokeStyle = rgba('magenta', 0.85);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(P8[0][0], P8[0][1]);
      ctx.lineTo(P8[4][0], P8[4][1]);
      ctx.stroke();
      ctx.restore();
      // 右侧同期：核元素被"压成"单位元
      const px = 1150;
      text(ctx, '核  ker φ', px, 220, { size: 44, color: rgba('magenta', 1), glowR: 18 });
      if (t > 19.4) drawRuns(ctx, runs('所有被压成*单位元*的元素\n放在一起 —— 它就是核。', { size: 27, color: 'rgba(212,226,248,.88)' }), px, 300, t - 19.4, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      ker.forEach((k, i) => {
        const p = clamp((t - 20.4 - i * 0.4) / 0.7);
        if (p <= 0) return;
        const e = ease.outBack(p);
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.4);
        ctx.translate(px - 170 + i * 340, 430);
        ctx.scale(e, e);
        ctx.fillStyle = rgba('magenta', 0.12);
        roundedRect(ctx, -120, -56, 240, 112, 16);
        ctx.fill();
        ctx.strokeStyle = rgba('magenta', 0.7);
        ctx.lineWidth = 1.8;
        roundedRect(ctx, -120, -56, 240, 112, 16);
        ctx.stroke();
        text(ctx, el8(k), 0, -6, { size: 46, color: '#fff', font: FONT.serif, weight: 700, glowR: 12 });
        text(ctx, '↓ φ', 0, 84, { size: 26, color: 'rgba(206,220,244,.7)' });
        text(ctx, 'e', 0, 140, { size: 40, color: rgba('magenta', 1), font: FONT.serif, weight: 700, glowR: 12 });
        ctx.restore();
      });
      if (t > 22.4) formula(ctx, 'ker φ = { g ∈ G | φ(g) = e }', px, 660, { size: 34, color: rgba('magenta', 1), glowR: 12 });
      // 商群
      if (t > 23.4) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 23.4) / 0.8);
        drawRuns(ctx, runs('把核"除掉"，得到的*商群*\n和 H 长得一模一样：', { size: 28, color: 'rgba(212,226,248,.9)' }), px, 780, t - 23.4, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
        formula(ctx, 'G / ker φ  ≅  im φ', px, 900, { size: 42, color: rgba('gold', 1), glowR: 16 });
        ctx.restore();
      }
      ctx.restore();
    }

    /* ============ SHOT D (27-36s)：基本定理 ======================== */
    const aD = clamp(inv(t, 27, 27.8));
    if (aD > 0.01) {
      ctx.save();
      ctx.globalAlpha = aD;
      // 元素方块阵列：8 个 = 2 × 4
      const bw = 96, bh = 96;
      const ox = 380, oy = 330;
      const groups = [0, 1];
      groups.forEach((gi) => {
        for (let j = 0; j < 4; j++) {
          const k = gi * 4 + j;
          const p = clamp((t - 27.6 - k * 0.12) / 0.6);
          if (p <= 0) continue;
          const e = ease.outBack(p);
          const x = ox + j * (bw + 16), y = oy + gi * (bh + 26);
          ctx.save();
          ctx.globalAlpha *= clamp(p * 1.4);
          ctx.translate(x + (1 - e) * -30, y);
          ctx.scale(e, e);
          const col = gi === 0 ? 'cyan' : 'gold';
          ctx.fillStyle = rgba(col, 0.14);
          roundedRect(ctx, 0, 0, bw, bh, 12);
          ctx.fill();
          ctx.strokeStyle = rgba(col, 0.7);
          ctx.lineWidth = 1.6;
          roundedRect(ctx, 0, 0, bw, bh, 12);
          ctx.stroke();
          text(ctx, el8(k), bw / 2, bh / 2, { size: 30, color: '#fff', font: FONT.serif, weight: 700, glowR: 8 });
          ctx.restore();
        }
      });
      // 括号与标注
      if (t > 29.4) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 29.4) / 0.7);
        ctx.strokeStyle = rgba('magenta', 0.85);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ox - 24, oy + 4);
        ctx.lineTo(ox - 24, oy + 2 * bh + 26 - 4);
        ctx.stroke();
        text(ctx, '核：2 个', ox - 150, oy + bh + 12, { size: 34, color: rgba('magenta', 1), weight: 700, glowR: 12 });
        ctx.restore();
      }
      // 右侧公式推导
      const px = 1080;
      text(ctx, '同态基本定理', px, 250, { size: 44, color: '#fff', glowR: 18 });
      if (t > 30.0) formula(ctx, '|G| = |ker φ| · |im φ|', px, 360, { size: 44, color: rgba('gold', 1), glowR: 16 });
      if (t > 30.8) formula(ctx, '8   =   2   ×   4', px, 448, { size: 44, color: rgba('cyan', 1), glowR: 16 });
      if (t > 31.8) drawRuns(ctx, runs('大群被透镜压成小群，\n但"大小"的关系必须对得上——\n这就是*结构的守恒律*。', { size: 28, color: 'rgba(214,226,248,.9)' }), px, 600, t - 31.8, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      if (t > 34.0) caption(ctx, '看不见的结构，能被*数出来*', CX, 900, t - 34.0, { size: 50, maxWidth: 1500, glowR: 24, letter: 3 });
      ctx.restore();
    }

    /* ------------------------------ HUD ---------------------------- */
    chapter(ctx, t, { index: '04', title: '同态 · 保结构的透镜', total: 6, life: [0.6, 35.4], progress: t / DURATION });
    statBar(ctx, 74, SAFE_BOTTOM + 4, [
      { k: 'MAP', v: 'φ : C₈ → C₄' }, { k: 'KERNEL', v: '2' }, { k: 'IMAGE', v: '4' },
    ], (1 - clamp(inv(t, 34.4, 36))) * clamp(inv(t, 1.6, 2.6)), { color: 'gold' });
    glitchBars(ctx, t, 9.02, 0.3, { n: 8, seed: 41 });
    glitchBars(ctx, t, 18.03, 0.3, { n: 7, seed: 17 });
    flash(ctx, W, H, t > 17.95 && t < 18.4 ? 0.2 * (1 - (t - 17.95) / 0.45) : 0);
    ripple(ctx, C4[0], C4[1], 460, t, { color: 'magenta', a: 0.14, n: 2, speed: 0.22 });
    if (t > 25.4 && t < 26.6) energyCore(ctx, C4[0], C4[1], 46, t, { color: 'gold', pulse: 0.7 });
    void rng;
    void energyCore;
  },
};
