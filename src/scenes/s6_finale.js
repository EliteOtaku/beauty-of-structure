/* ============================================================================
 * S6 · 终章 —— 从素数到椭圆曲线，从伽罗瓦到整个宇宙
 * 0-7s    两个素数相乘：走进群论的密码世界
 * 7-15s   椭圆曲线上的点：弦切作图 = 群运算
 * 15-23s  五次方程的根：S₅ 不可解 —— 伽罗瓦的天才
 * 23-30s  收束：结构是宇宙的语言
 * ==========================================================================*/
import {
  clamp, inv, ease, mix, rgba, TAU, glow, glowLine, ring, text, flash, FONT, rng, mixColor, rgbStr,
} from '../core.js';
import {
  W, H, caption, chapter, statBar, formula, drawRuns, runs, shakeOffset, glitchBars,
  core as energyCore, starfield, topGlow, roundedRect, ripple, SAFE_BOTTOM,
} from '../nars.js';

export const DURATION = 38;

const CX = W / 2;

/** 椭圆曲线 y² = x³ - x + 1 上的实数点（用于弦切作图） */
const CURVE = (() => {
  const pts = [];
  for (let x = -1.2; x <= 2.4; x += 0.01) {
    const y2 = x ** 3 - x + 1;
    if (y2 >= 0) {
      const y = Math.sqrt(y2);
      pts.push([x, y]);
      if (y > 0.02) pts.push([x, -y]);
    }
  }
  return pts;
})();
/** 曲线上的三个"整点"（用于演示 P + Q = R） */
const P0 = [-1, 1], Q0 = [0, 1];
/** 弦 PQ 与曲线第三交点 */
const R0 = (() => {
  const s = (Q0[1] - P0[1]) / (Q0[0] - P0[0]);      // 斜率 0
  // 交点为解 x³ - x + 1 = (x+1)(x-0)... 直接用数值求第三根
  // y = 1（水平线）→ x³ - x + 1 = 1 → x(x²-1)=0 → x = -1, 0, 1
  const x = 1, y = -(s * (x - P0[0]) + P0[1]);
  return [x, y];
})();

export default {
  title: '终章',
  duration: DURATION,
  draw({ ctx, t }) {
    const shake = shakeOffset(t, 6.9, 0.4, 12, 30);
    starfield(ctx, t, { n: 220, a: 0.5, speed: 9 });
    topGlow(ctx, 'cyan', 0.24);

    /* ============ SHOT A (0-7s)：素数 → 密码 ====================== */
    const aA = clamp(inv(t, 0, 0.7)) * (1 - clamp(inv(t, 6.2, 7.0)));
    if (aA > 0.01) {
      ctx.save();
      ctx.globalAlpha = aA;
      // 两个素数相乘
      text(ctx, '611,953,073,776,169,552,977', CX, 330, { size: 56, color: rgba('cyan', 1), font: FONT.mono, weight: 700, glowR: 18 });
      text(ctx, '×', CX, 412, { size: 40, color: 'rgba(220,232,250,.8)', font: FONT.serif, weight: 700 });
      text(ctx, '3,179,347,141,073,317,447', CX, 494, { size: 56, color: rgba('magenta', 1), font: FONT.mono, weight: 700, glowR: 18 });
      const p = clamp((t - 1.4) / 0.5);
      if (p > 0) {
        glowLine(ctx, CX - 520, 556, CX + 520, 556, 'white', 2.4, p * 0.9);
        text(ctx, '=', CX, 610, { size: 40, color: 'rgba(220,232,250,.85)', font: FONT.serif, weight: 700, a: p });
      }
      // 617 位大数滚动
      if (t > 2.2) {
        const digits = '1796117755939528648571990316300809249580295620758137441898497737122225408750131993305519608785857475222851886282190004903063858467057839345496616044981211558972911840793984484428378680843768476677736548752745138738273711476268564909513647097693648616989139708547661788492042861377294589947759769470601362795642191391054202359380657247101356912690896452011726706372569174651275811957392832795027857767119148685816439733385565749369070871335173557503596043394537105895299471626940839458663854961667057936043363516652811781064628241273387664329175314925127299929552183';
        const reveal = Math.floor(clamp((t - 2.4) / 2.6) * 12);   // 12 行
        const per = Math.ceil(digits.length / 12);
        ctx.save();
        ctx.globalAlpha *= clamp((t - 2.4) / 0.7);
        for (let i = 0; i < reveal; i++) {
          const str = digits.slice(i * per, (i + 1) * per);
          text(ctx, str, CX, 720 + i * 22, { size: 17, color: rgba('cyan', 0.5 + 0.03 * i), font: FONT.mono, weight: 500, letter: 1 });
        }
        ctx.restore();
      }
      if (t > 4.4) caption(ctx, '把两个大素数乘起来很容易，\n*拆回去*，难到让宇宙等一万年', CX, 186, t - 4.4, { size: 44, maxWidth: 1700, glowR: 20, letter: 2 });
      ctx.restore();
    }

    /* ============ SHOT B (7-15s)：椭圆曲线群 ====================== */
    const aB = clamp(inv(t, 7, 7.8)) * (1 - clamp(inv(t, 14.2, 15.0)));
    if (aB > 0.01) {
      ctx.save();
      ctx.globalAlpha = aB;
      ctx.translate(shake[0], shake[1]);
      const ox = 620, oy = 560, sc = 210;
      const map = ([x, y]) => [ox + x * sc, oy - y * sc];
      // 坐标轴
      ctx.strokeStyle = rgba('white', 0.16);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ox - 2.1 * sc, oy);
      ctx.lineTo(ox + 2.4 * sc, oy);
      ctx.moveTo(ox, oy - 2.2 * sc);
      ctx.lineTo(ox, oy + 1.8 * sc);
      ctx.stroke();
      // 曲线
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y] of CURVE) {
        const [px, py] = map([x, y]);
        glow(ctx, px, py, 9, 'cyan', 0.35);
      }
      ctx.restore();
      // 弦切作图：P + Q = −R（R 为连线与曲线的第三交点，翻折后得到 P+Q）
      const pLine = clamp((t - 8.2) / 0.8);
      const pChord = clamp((t - 9.4) / 0.9);
      const pRefl = clamp((t - 10.6) / 0.9);
      const [Px, Py] = map(P0);
      const [Qx, Qy] = map(Q0);
      [[Px, Py, 'P'], [Qx, Qy, 'Q']].forEach(([x, y, nm], i) => {
        const p = clamp((t - 7.8 - i * 0.4) / 0.6);
        if (p <= 0) return;
        glow(ctx, x, y, 24, 'gold', 0.9);
        ring(ctx, x, y, 14, 'gold', 2, 0.9);
        text(ctx, nm, x, y - 44, { size: 34, color: rgba('gold', 1), font: FONT.serif, weight: 700, glowR: 12 });
      });
      if (pChord > 0) {
        // y = 1 的弦（穿过 P 与 Q）
        const yl = oy - 1 * sc;
        glowLine(ctx, ox - 1.9 * sc, yl, ox + 2.1 * sc, yl, 'white', 1.6, pChord * 0.7);
      }
      if (pRefl > 0) {
        const [rvx, rvy] = map(R0);
        glow(ctx, rvx, rvy, 24 * pRefl, 'magenta', 0.95 * pRefl);
        ring(ctx, rvx, rvy, 15, 'magenta', 2.2, pRefl);
        text(ctx, 'R', rvx + 44, rvy - 24, { size: 30, color: rgba('magenta', 1), font: FONT.serif, weight: 700, a: pRefl, glowR: 10 });
        // 关于 x 轴翻折 → P+Q
        const sum = [R0[0], -R0[1]];
        const [sx, sy] = map(sum);
        ctx.save();
        ctx.setLineDash([8, 10]);
        ctx.strokeStyle = rgba('magenta', 0.75 * pRefl);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(rvx, rvy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.restore();
        glow(ctx, sx, sy, 28, 'gold', 0.95);
        ring(ctx, sx, sy, 16, 'gold', 2.4, 0.95);
        text(ctx, 'P + Q', sx + 96, sy + 4, { size: 30, color: rgba('gold', 1), font: FONT.serif, weight: 700, glowR: 10 });
      }
      // 右侧说明
      const px = 1500;
      text(ctx, '椭圆曲线群', px, 300, { size: 44, color: '#fff', glowR: 18 });
      if (t > 8.8) formula(ctx, 'y² = x³ - x + 1', px, 400, { size: 40, color: rgba('cyan', 1), glowR: 14 });
      if (t > 10.0) drawRuns(ctx, runs('弦切作图 = 群运算：\n两点连线取第三交点，\n再翻折，就得到"和"。', { size: 27, color: 'rgba(214,226,248,.9)' }), px, 530, t - 10.0, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      if (t > 12.2) formula(ctx, 'P + Q = -R', px, 700, { size: 40, color: rgba('gold', 1), glowR: 14 });
      if (t > 13.0) text(ctx, '几何里长出来的群，保护着你每一次支付', px, 800, { size: 26, color: 'rgba(206,220,244,.8)' });
      ctx.restore();
      void pLine;
    }

    /* ============ SHOT C (15-23s)：五次方程与伽罗瓦 ================ */
    const aC = clamp(inv(t, 15, 15.8)) * (1 - clamp(inv(t, 22.2, 23.0)));
    if (aC > 0.01) {
      ctx.save();
      ctx.globalAlpha = aC;
      const ccx = 660, ccy = 520, R = 250;
      // 复平面圆 + 5 个根
      ring(ctx, ccx, ccy, R, 'violet', 1.6, 0.5);
      const roots = Array.from({ length: 5 }, (_, k) => {
        const a = -Math.PI / 2 + (TAU * k) / 5 + 0.3 * Math.sin(t * 0.6);
        return [ccx + Math.cos(a) * R, ccy + Math.sin(a) * R, a];
      });
      // S₅ 的作用：连线展示所有置换
      const permIdx = Math.floor((t - 16.2) * 0.9) % 5;
      roots.forEach(([x, y], i) => {
        const g = clamp((t - 15.8 - i * 0.12) / 0.5);
        if (g <= 0) return;
        glow(ctx, x, y, 28 * g, 'violet', 0.9 * g);
        text(ctx, `x${['₁', '₂', '₃', '₄', '₅'][i]}`, x + (x - ccx) * 0.2, y + (y - ccy) * 0.2, {
          size: 34, color: 'rgba(230,238,255,.95)', font: FONT.serif, weight: 700, a: g,
        });
      });
      // 置换箭头
      if (t > 16.2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const j = (i + 1 + permIdx) % 5;
          const [x1, y1] = roots[i];
          const [x2, y2] = roots[j];
          ctx.strokeStyle = rgba('cyan', 0.5);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          glow(ctx, mix(x1, x2, (t * 0.7) % 1), mix(y1, y2, (t * 0.7) % 1), 12, 'cyan', 0.7);
        }
        ctx.restore();
      }
      // 中间方程
      formula(ctx, 'x⁵ - x - 1 = 0', ccx, 190, { size: 48, color: rgba('gold', 1), glowR: 18 });
      text(ctx, '它的根挤在复平面上', ccx, 880, { size: 28, color: 'rgba(206,220,244,.8)' });
      // 右侧：S₅ 与不可解
      const px = 1330;
      text(ctx, '伽罗瓦群', px, 250, { size: 42, color: '#fff', glowR: 16 });
      if (t > 17.4) formula(ctx, 'Gal(f) = S₅', px, 350, { size: 42, color: rgba('violet', 1), glowR: 14 });
      if (t > 18.4) drawRuns(ctx, runs('S₅ 不是"可解群"：\n它的换位子群链\n永远走不到单位元。', { size: 27, color: 'rgba(214,226,248,.9)' }), px, 480, t - 18.4, { align: 'center', glowR: 0, letter: 1, stagger: 0.02 });
      if (t > 20.4) {
        // 换位子链塌缩动画
        const chain = ['S₅', 'A₅', 'A₅', 'A₅'];
        chain.forEach((c, i) => {
          const p = clamp((t - 20.4 - i * 0.4) / 0.5);
          if (p <= 0) return;
          const e = ease.outBack(p);
          ctx.save();
          ctx.globalAlpha *= clamp(p * 1.4);
          ctx.translate(px, 650 + i * 78);
          ctx.scale(e, e);
          ctx.fillStyle = rgba('magenta', 0.12);
          roundedRect(ctx, -110, -28, 220, 56, 12);
          ctx.fill();
          ctx.strokeStyle = rgba('magenta', 0.7);
          ctx.lineWidth = 1.6;
          roundedRect(ctx, -110, -28, 220, 56, 12);
          ctx.stroke();
          text(ctx, c, 0, 0, { size: 32, color: '#fff', font: FONT.serif, weight: 700, glowR: 10 });
          if (i < 3) text(ctx, '↓', 0, 58, { size: 24, color: 'rgba(206,220,244,.6)' });
          ctx.restore();
        });
      }
      if (t > 21.6) caption(ctx, '*五次方程没有求根公式*', CX, 990, t - 21.6, { size: 48, maxWidth: 1500, glowR: 24, letter: 4 });
      ctx.restore();
    }

    /* ============ SHOT D (23-32s)：汇聚 =========================== */
    const aD = clamp(inv(t, 23, 23.9));
    if (aD > 0.01) {
      ctx.save();
      ctx.globalAlpha = aD;
      const spread = 1 - ease.inOutCubic(clamp((t - 23.4) / 3.2));
      const labels = ['对称', '循环', '置换', '同态', '计数', '密码', '伽罗瓦'];
      const colors = ['gold', 'cyan', 'magenta', 'violet', 'mint', 'blue', 'white'];
      const fadeOut = 1 - clamp(inv(t, 30.2, 31.4));
      labels.forEach((lb, i) => {
        const ang = -Math.PI / 2 + (i / labels.length) * TAU + t * 0.06;
        const rr = 120 + spread * 520;
        const x = CX + Math.cos(ang) * rr, y = 520 + Math.sin(ang) * rr * 0.72;
        glow(ctx, x, y, 26 * fadeOut, colors[i], 0.75 * fadeOut);
        text(ctx, lb, x, y, { size: 34, color: rgba(colors[i], 0.95), weight: 700, glowR: 12, a: fadeOut });
        glowLine(ctx, x, y, CX, 520, colors[i], 1.1, 0.25 * fadeOut);
      });
      energyCore(ctx, CX, 520, 34 + 8 * Math.sin(t * 2), t, { color: 'cyan' });
      if (t > 25.6) {
        caption(ctx, '从一张正方形，到整个宇宙：\n*结构，是万物的语言*', CX, 300, t - 25.6, {
          size: 62, maxWidth: 1600, glowR: 30, letter: 4, lineGap: 1.5,
          a: 1 - clamp(inv(t, 31.0, 32.2)),
        });
      }
      ctx.restore();
    }

    /* ============ SHOT E (32-38s)：结语 ============================ */
    const aE = clamp(inv(t, 31.8, 32.8));
    if (aE > 0.01) {
      ctx.save();
      ctx.globalAlpha = aE;
      // 伽罗瓦的一句精神旁白 + 结构汇聚成星
      const nStar = 220;
      for (let i = 0; i < nStar; i++) {
        const a = i * 2.399963;
        const rr = 60 + Math.sqrt(i) * 26;
        const ph = t * 0.4 + i * 0.05;
        const x = CX + Math.cos(a) * rr * (1 + 0.06 * Math.sin(ph));
        const y = 520 + Math.sin(a) * rr * 0.62 * (1 + 0.06 * Math.cos(ph));
        glow(ctx, x, y, 5 + (i % 5), i % 7 === 0 ? 'gold' : 'cyan', 0.35 * aE);
      }
      if (t > 32.8) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 32.8) / 1.0);
        text(ctx, '抽象代数 · 结构之美', CX, 220, { size: 54, color: '#fff', weight: 700, glowR: 24, letter: 10 });
        text(ctx, '有解的东西可以被算出来，有结构的东西才能被理解', CX, 312, { size: 26, color: 'rgba(196,212,238,.82)', letter: 3 });
        ctx.restore();
      }
      if (t > 34.4) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - 34.4) / 1.0);
        drawRuns(ctx, runs('结构，是*理解*的乐谱', { size: 34, color: 'rgba(226,238,255,.9)' }), CX, 700, t - 34.4, { align: 'center', glowR: 14, letter: 4, stagger: 0.03 });
        text(ctx, '[ 第一部 · 群论 ]', CX, 800, { size: 22, color: rgba('cyan', 0.55), font: FONT.mono, letter: 6 });
        ctx.restore();
      }
      ctx.restore();
    }

    /* ------------------------------ HUD ---------------------------- */
    chapter(ctx, t, { index: '06', title: '终章 · 结构是万物的语言', total: 6, life: [0.6, 31.6], progress: t / DURATION });
    statBar(ctx, 74, SAFE_BOTTOM + 4, [
      { k: 'CRYPTO', v: 'RSA / ECC' }, { k: 'GALOIS', v: 'S₅ 不可解' }, { k: 'IDEA', v: '结构' },
    ], (1 - clamp(inv(t, 31.0, 32.6))) * clamp(inv(t, 1.6, 2.6)), { color: 'cyan' });
    glitchBars(ctx, t, 7.02, 0.3, { n: 8, seed: 61 });
    glitchBars(ctx, t, 15.02, 0.3, { n: 7, seed: 29 });
    flash(ctx, W, H, t > 6.95 && t < 7.4 ? 0.2 * (1 - (t - 6.95) / 0.45) : 0);
    ripple(ctx, CX, 520, 560, t, { color: 'cyan', a: 0.12 * (1 - clamp(inv(t, 31.4, 32.4))), n: 2, speed: 0.24 });
    // 全片最后一帧渐白
    if (t > 36.6) flash(ctx, W, H, 0.55 * clamp((t - 36.6) / 1.4), '#cfe6ff');
    void rng;
    void mixColor;
    void rgbStr;
  },
};
