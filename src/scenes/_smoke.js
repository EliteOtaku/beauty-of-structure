/* 冒烟测试场景（仅用于验证渲染管线，不进入成片） */
import { text, TAU, glow, FONT } from '../core.js';
export default {
  title: 'smoke',
  duration: 6,
  draw({ ctx, W, H, t }) {
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 400; i++) {
      const a = (i / 400) * TAU + t * 0.8;
      const r = 120 + 300 * Math.sin(i * 0.13 + t * 1.7);
      glow(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62, 16, ['cyan', 'magenta', 'gold'][i % 3], 0.7);
    }
    text(ctx, '抽象代数 · 冒烟测试 0123', cx, cy, { size: 92, color: '#fff', glowR: 30 });
    text(ctx, `t=${t.toFixed(3)}`, cx, cy + 110, { size: 34, color: '#41e7ff', font: FONT.mono });
  },
};
