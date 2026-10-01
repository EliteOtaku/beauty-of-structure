/* 文本渲染对照测试：定位"重影"来源（不进入成片） */
import { text, FONT, TAU, glow } from '../core.js';

const SAMPLES = [
  ['A 默认(glow26)', { size: 36, color: '#fff', glowR: 26 }],
  ['B 无光晕', { size: 36, color: '#fff' }],
  ['C 无字距', { size: 36, color: '#fff', glowR: 26, letter: 0 }],
  ['D 无阴影偏移', { size: 36, color: '#fff', glowR: 26, shadow: 0 }],
  ['E 缩放1.0', { size: 36, color: '#fff', glowR: 26 }],
  ['F 缩放0.98', { size: 36, color: '#fff', glowR: 26 }],
];

export default {
  title: '文本对照',
  duration: 3,
  draw({ ctx, W, H, t }) {
    text(ctx, 'TEXT RENDER COMPARISON', W / 2, 70, { size: 30, color: '#41e7ff', font: FONT.mono, weight: 700, letter: 6 });
    let y = 190;
    for (const [name, opts] of SAMPLES) {
      text(ctx, name, 60, y, { size: 24, color: '#ff3fa4', font: FONT.mono, align: 'left', weight: 700 });
      const s = name.startsWith('F') ? 0.98 : 1;
      ctx.save();
      ctx.translate(420, y);
      ctx.scale(s, s);
      text(ctx, '封闭性 结合律 单位元 逆元 · 结构之美', 0, 0, { ...opts, align: 'left' });
      ctx.restore();
      y += 90;
    }
    // 对照组：drawRuns（逐字绘制）
    text(ctx, 'G drawRuns逐字', 60, y, { size: 24, color: '#ff3fa4', font: FONT.mono, align: 'left', weight: 700 });
    ctx.save();
    ctx.font = `700 36px ${FONT.cjk}`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 26;
    [...'封闭性 结合律 单位元 逆元 · 结构之美'].forEach((ch, i) => {
      ctx.fillText(ch, 420 + i * 36, y);
    });
    ctx.restore();
    // 对照组：不同 alpha
    text(ctx, 'H alpha=1', 60, y + 90, { size: 24, color: '#ff3fa4', font: FONT.mono, align: 'left', weight: 700 });
    text(ctx, '封闭性 结合律 单位元 逆元', 420, y + 90, { size: 36, color: '#fff', glowR: 26, align: 'left', a: 1 });
    glow(ctx, W - 120, 120, 70, 'cyan', 0.5 + 0.5 * Math.sin(t * 3));
    void TAU;
  },
};
