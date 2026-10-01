/* ============================================================================
 * S2 · 循环 —— 单位根与模算术：反复施加同一个动作就长出群
 * 0-7s   轨道：转 45° 的八次幂铺满整圆（轨道-稳定子）
 * 7-15s  8 次单位根：ζᵏ 连线，k=8 首尾闭合
 * 15-23s 8×8 模乘表：可逆元 {1,3,5,7} 是一整个群 U(8)
 * 23-30s "多少个元素" = 群的阶；收束
 * ==========================================================================*/
import {
  clamp, inv, ease, mix, rgba, TAU, glow, glowLine, ring, text, flash, FONT, mixColor, rgbStr,
} from '../core.js';
import {
  W, H, caption, chapter, statBar, formula, drawRuns, runs, shakeOffset, glitchBars,
  core as energyCore, starfield, topGlow, roundedRect, ripple, SAFE_BOTTOM, chip,
} from '../nars.js';

export const DURATION = 30;

const CX = 620, CY = 545;        // 主圆
const R = 300;
const N = 8;
const ZETA = Array.from({ length: N }, (_, k) => {
  const a = -Math.PI / 2 + (TAU * k) / N;
  return [Math.cos(a) * R, Math.sin(a) * R];
});
const UNITS = [1, 3, 5, 7];

export default {
  title: '循环',
  duration: DURATION,
  draw({ ctx, t }) {
    const shake = shakeOffset(t, 15.0, 0.42, 12, 32);
    starfield(ctx, t, { n: 170, a: 0.45 });
    topGlow(ctx, 'cyan', 0.22);

    /* ================= SHOT A (0-7s)：轨道 ======================== */
    const aA = clamp(inv(t, 0, 0.7)) * (1 - clamp(inv(t, 6.4, 7.2)));
    if (aA > 0.01) {
      ctx.save();
      ctx.globalAlpha = aA;
      ctx.translate(CX, CY);
      // 圆 + 刻度
      ring(ctx, 0, 0, R, 'cyan', 1.2, 0.35);
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * TAU;
        const o = k % 8 === 0 ? 14 : 7;
        glowLine(ctx, Math.cos(a) * (R - o), Math.sin(a) * (R - o), Math.cos(a) * R, Math.sin(a) * R, 'cyan', k % 8 === 0 ? 1.4 : 0.7, 0.5);
      }
      // 8 个落点（轨道上的像）
      const step = clamp((t - 0.5) / 3.4) * 8.2;
      const pts = [];
      for (let k = 0; k < N; k++) {
        const p = clamp(step - k);
        if (p <= 0) continue;
        const e = ease.outBack(p);
        const x = ZETA[k][0] * e, y = ZETA[k][1] * e;
        pts.push([x, y]);
        glow(ctx, x, y, 26, 'gold', 0.9);
        ring(ctx, x, y, 12, 'gold', 2, 0.85);
        text(ctx, `${k + 1}`, x * 1.13, y * 1.13, { size: 34, color: rgba('gold', 0.95), font: FONT.serif, weight: 700 });
      }
      // 轨迹折线
      if (pts.length > 1) {
        ctx.save();
        ctx.setLineDash([8, 10]);
        ctx.strokeStyle = rgba('magenta', 0.55);
        ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.restore();
      }
      // 转动的矢量
      const vecA = -Math.PI / 2 + (TAU * Math.min(step, 8)) / N;
      glowLine(ctx, 0, 0, Math.cos(vecA) * R, Math.sin(vecA) * R, 'white', 2.4, 0.95);
      energyCore(ctx, 0, 0, 16, t, { color: 'cyan' });
      ctx.restore();
      // 右侧解说
      if (t > 1.2) caption(ctx, '反复施加同一个动作，\n就长出了*整个群*', 1420, 250, t - 1.2, { size: 50, maxWidth: 820, glowR: 20, letter: 2 });
      if (t > 3.0) drawRuns(ctx, runs('轨道 · 稳定子：\n转 45° 的八次幂，把一个点\n送遍圆上的每个位置。', { size: 26, color: 'rgba(206,220,244,.8)' }), 1420, 470, t - 3.0, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      if (t > 4.6) formula(ctx, 'C₈ = ⟨ r | r⁸ = e ⟩', 1420, 660, { size: 42, color: rgba('gold', 1), glowR: 14 });
      const orb = Math.min(8, Math.max(1, Math.floor(step)));
      if (t > 1.4) {
        statBar(ctx, 1420 - 240, 780, [
          { k: 'ORBIT', v: `${orb}` }, { k: 'STABILIZER', v: '1' }, { k: 'ORDER', v: '8' },
        ], clamp(inv(t, 1.4, 2.2)), { color: 'gold', size: 22, gap: 20 });
      }
    }

    /* ================= SHOT B (7-15s)：单位根 ζᵏ ================== */
    const aB = clamp(inv(t, 7, 7.8)) * (1 - clamp(inv(t, 14.2, 15.0)));
    if (aB > 0.01) {
      ctx.save();
      ctx.globalAlpha = aB;
      ctx.translate(CX, CY);
      const k = Math.min(8, 1 + Math.floor(clamp((t - 8.0) / 6.2) * 8));
      // 圆与根
      ring(ctx, 0, 0, R, 'cyan', 1.4, 0.4);
      ring(ctx, 0, 0, R * 0.5, 'violet', 1, 0.18);
      ZETA.forEach(([x, y], i) => {
        glow(ctx, x, y, 13, UNITS.includes(i) ? 'gold' : 'cyan', 0.8);
      });
      // ζ^k 的连线：k 越大越亮
      for (let kk = 1; kk <= k; kk++) {
        const alpha = kk === k ? 0.95 : 0.16 + 0.06 * kk;
        const fresh = kk === k ? 1 : 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(kk === 8 ? 'gold' : kk === k ? 'magenta' : 'cyan', alpha);
        ctx.lineWidth = kk === k ? 3.4 : 1.5;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const idx = ((i * kk) % N + N) % N;
          const [x, y] = ZETA[idx];
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        if (fresh) {
          // 顶点脉冲
          for (let i = 0; i <= N; i++) {
            const idx = (i * kk) % N;
            const [x, y] = ZETA[idx];
            glow(ctx, x, y, 22, 'magenta', 0.5);
          }
        }
      }
      // 顶点标签（整数读数）
      ZETA.forEach(([x, y], i) => {
        text(ctx, `${i}`, x * 1.16, y * 1.16, {
          size: 30, color: rgba(UNITS.includes(i) ? 'gold' : 'cyan', 0.9), font: FONT.serif, weight: 700,
        });
      });
      // 中心读数
      text(ctx, k === 1 ? 'ζ' : `ζ${toSup(k)}`, 0, -14, { size: 52, color: '#fff', font: FONT.serif, weight: 700, glowR: 20 });
      text(ctx, k === 8 ? '= 1   闭合' : `${k} / 8`, 0, 46, { size: 28, color: rgba(k === 8 ? 'gold' : 'cyan', 0.95), font: FONT.mono, weight: 600, letter: 2 });
      ctx.restore();
      // 右侧说明
      if (t > 7.6) caption(ctx, '*8* 个根，正好是\n一次完整的循环', 1430, 300, t - 7.6, { size: 50, maxWidth: 820, glowR: 20, letter: 2 });
      if (t > 9.0) drawRuns(ctx, runs('把 k 从 1 数到 8，\n连线第 8 次回到起点——\n这是一次*周期*。', { size: 26, color: 'rgba(206,220,244,.82)' }), 1430, 510, t - 9.0, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      if (t > 11.0) formula(ctx, 'ζ = e^(2πi/8)', 1430, 706, { size: 38, color: rgba('cyan', 1), glowR: 12 });
      if (t > 11.6) formula(ctx, 'ζ⁸ = 1', 1430, 766, { size: 38, color: rgba('gold', 1), glowR: 12 });
    }

    /* ================= SHOT C (15-23s)：模 8 乘法表 ================ */
    const aC = clamp(inv(t, 15, 15.8)) * (1 - clamp(inv(t, 22.2, 23.0)));
    if (aC > 0.01) {
      ctx.save();
      ctx.globalAlpha = aC;
      ctx.translate(shake[0], shake[1]);
      const cell = 62;
      const ox = 300, oy = 250;
      // 表头
      for (let i = 0; i < N; i++) {
        text(ctx, `${i}`, ox + i * cell + cell / 2, oy - 26, { size: 26, color: rgba(UNITS.includes(i) ? 'gold' : 'cyan', 0.9), font: FONT.serif, weight: 700 });
        text(ctx, `${i}`, ox - 26, oy + i * cell + cell / 2, { size: 26, color: rgba(UNITS.includes(i) ? 'gold' : 'cyan', 0.9), font: FONT.serif, weight: 700, align: 'right' });
      }
      // 逐行点亮
      const prog = clamp((t - 15.9) / 5.0) * (N * N);
      let unitsSeen = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const idx = i * N + j;
          if (idx > prog) continue;
          const fresh = clamp(1 - (prog - idx) / 3.2);
          const v = (i * j) % N;
          const inv2 = UNITS.includes(v) && UNITS.includes(i) && UNITS.includes(j);
          if (inv2) unitsSeen = Math.max(unitsSeen, idx);
          const col = inv2 ? 'gold' : 'cyan';
          const x = ox + j * cell, y = oy + i * cell;
          ctx.fillStyle = rgba(col, 0.06 + 0.3 * (inv2 ? 0.5 : 0.16) + 0.14 * fresh);
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          ctx.strokeStyle = rgba(col, 0.16 + 0.7 * fresh);
          ctx.lineWidth = 1 + fresh * 1.6;
          ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
          text(ctx, `${v}`, x + cell / 2, y + cell / 2, {
            size: 26, color: rgba(col, 0.62 + 0.38 * (1 - fresh * 0.5)), font: FONT.serif, weight: 700,
          });
        }
      }
      // 单位元对角线
      for (let i = 0; i < N; i++) {
        if ((i * i) % N !== 1) continue;
        ctx.strokeStyle = rgba('magenta', 0.85);
        ctx.lineWidth = 2.4;
        ctx.strokeRect(ox + i * cell + 1, oy + i * cell + 1, cell - 2, cell - 2);
      }
      // 右侧：可逆元高亮
      const ax = ox + N * cell + 110;
      text(ctx, '可逆元', ax, oy + 46, { size: 44, color: '#fff', align: 'left', glowR: 16 });
      UNITS.forEach((u, i) => {
        chip(ctx, `${u}`, ax + 60 + i * 110, oy + 156, t - 17.4 - i * 0.16, { color: 'gold', size: 34 });
      });
      if (t > 18.3) formula(ctx, '3 × 3 = 9 ≡ 1 (mod 8)', ax, oy + 280, { size: 34, align: 'left', color: rgba('gold', 1), glowR: 12 });
      if (t > 19.2) drawRuns(ctx, runs('{ 1, 3, 5, 7 } 自己构成\n一个小群：*U(8)*', { size: 27, color: 'rgba(210,224,248,.86)' }), ax, oy + 380, t - 19.2, { align: 'left', glowR: 0, letter: 1, stagger: 0.02 });
      // 顶部进度
      const p = clamp((t - 15.9) / 5.0);
      text(ctx, 'i · j mod 8', W / 2 - 120, 176, { size: 28, color: rgba('cyan', 0.7), font: FONT.mono, weight: 600, letter: 2 });
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(W / 2 - 120, 200, 620, 3);
      ctx.fillStyle = rgba('gold', 0.95);
      ctx.fillRect(W / 2 - 120, 200, 620 * p, 3);
      ctx.restore();
    }

    /* ================= SHOT D (23-30s)：阶 + 收束 ================== */
    const aD = clamp(inv(t, 23, 23.8));
    if (aD > 0.01) {
      ctx.save();
      ctx.globalAlpha = aD;
      // 三个小圆盘：C2 C3 C4 的阶
      const specs = [
        { n: 2, name: 'C₂', col: 'cyan' },
        { n: 3, name: 'C₃', col: 'gold' },
        { n: 6, name: 'C₆', col: 'magenta' },
      ];
      specs.forEach((sp, i) => {
        const gx = 480 + i * 480, gy = 400;
        const p = clamp((t - 23.3 - i * 0.22) / 0.7);
        if (p <= 0) return;
        const e = ease.outBack(p);
        ctx.save();
        ctx.translate(gx, gy);
        ctx.scale(e, e);
        // 旋转 n 次正好一圈的动画
        const spin = (t - 23.3 - i * 0.22) * (TAU / sp.n) * 0.8;
        const rad = 120;
        ring(ctx, 0, 0, rad, sp.col, 1.4, 0.4);
        for (let k = 0; k < sp.n; k++) {
          const a = -Math.PI / 2 + (k / sp.n) * TAU + spin;
          glow(ctx, Math.cos(a) * rad, Math.sin(a) * rad, 18, sp.col, 0.85);
        }
        const a0 = -Math.PI / 2 + spin;
        glowLine(ctx, 0, 0, Math.cos(a0) * rad, Math.sin(a0) * rad, 'white', 2.4, 0.9);
        energyCore(ctx, 0, 0, 10, t, { color: sp.col });
        text(ctx, sp.name, 0, rad + 74, { size: 44, color: rgba(sp.col, 1), font: FONT.serif, weight: 700, glowR: 14 });
        text(ctx, `|G| = ${sp.n}`, 0, rad + 130, { size: 28, color: 'rgba(214,226,246,.85)', font: FONT.mono, weight: 600 });
        ctx.restore();
      });
      if (t > 24.6) caption(ctx, '群的*大小*，是它的第一个指纹', W / 2, 720, t - 24.6, { size: 52, maxWidth: 1500, glowR: 22, letter: 3 });
      if (t > 25.8) formula(ctx, '|Cₙ| = n        gᵏ = e  ⇒  g 的阶整除 n', W / 2, 830, { size: 36, color: rgba('cyan', 0.95), glowR: 10 });
      ctx.restore();
    }

    /* ------------------------------ HUD ---------------------------- */
    chapter(ctx, t, { index: '02', title: '循环 · 反复一次动作', total: 6, life: [0.6, 29.4], progress: t / DURATION });
    statBar(ctx, 74, SAFE_BOTTOM + 4, [
      { k: 'GROUP', v: 'C₈ / U(8)' }, { k: 'ORDER', v: '8 / 4' }, { k: 'IDEA', v: 'gᵏ = e' },
    ], (1 - clamp(inv(t, 28.2, 30))) * clamp(inv(t, 1.6, 2.6)), { color: 'cyan' });
    glitchBars(ctx, t, 15.02, 0.3, { n: 8, seed: 21 });
    glitchBars(ctx, t, 7.02, 0.26, { n: 6, seed: 5 });
    flash(ctx, W, H, t > 14.9 && t < 15.4 ? 0.18 * (1 - (t - 14.9) / 0.5) : 0);
    ripple(ctx, CX, CY, 480, t, { color: 'cyan', a: 0.12, n: 2, speed: 0.24 });
  },
};

function toSup(k) {
  const map = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  return [...String(k)].map((d) => map[d] || d).join('');
}
