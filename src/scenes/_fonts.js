/* 字形/排版自检：确认特殊符号在中文字体下是否可用（不进入成片） */
import { text, label, FONT, TAU, ring, glow } from '../core.js';

const SAMPLES = [
  ['数学符号', '≈ ≅ ⊂ ∈ ∉ ∀ ∃ → ↦ ⇒ ⟹ ∑ ∏ √ ∞ ± × ÷ ≤ ≥ ≠ · ∙ ° ∠ ⊥ ∥ ∪ ∩ ∅ ℤ ℚ ℝ ℂ ℕ ℍ 𝔽'],
  ['上标下标', 'r⁰ r¹ r² r³ r⁴ r⁵ r⁶ r⁷ r⁸ rⁿ r⁻¹ rᵏ x₁ x₂ x₃ aₙ aᵢ ⱼ G₄ D₄ S₃ A₅ GL₂ Z₁₂'],
  ['粗体斜体', '𝐞 𝐫 𝐬 𝐆 𝐇 𝐊 𝜑 𝜓 𝜙 𝜋 𝜎 𝜏 𝜆 𝜇 Σ Π Δ'],
  ['希腊字母', 'α β γ δ ε ζ η θ ι κ λ μ ν ξ π ρ σ τ υ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω'],
  ['中文', '抽象代数 · 群 环 域 同态 同构 核 陪集 轨道 对称 不变 结构 之美'],
  ['数字与拉丁', '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz'],
];

export default {
  title: '字形自检',
  duration: 4,
  draw({ ctx, W, H, t }) {
    let y = 150;
    text(ctx, 'FONT RENDER CHECK', W / 2, 92, { size: 34, color: '#41e7ff', font: FONT.mono, weight: 700, letter: 6 });
    for (const [k, v] of SAMPLES) {
      text(ctx, k, 90, y, { size: 26, color: '#ff3fa4', font: FONT.mono, align: 'left', weight: 700 });
      text(ctx, v, 90, y + 52, { size: 42, color: '#ffffff', font: FONT.cjk, align: 'left', weight: 700, letter: 1 });
      y += 136;
    }
    // 三种字体对比同一串数学式
    const formulas = [
      ['cjk/yahei', FONT.cjk, '|G| = |ker φ| · |im φ|  (G : H) = [G : H]'],
      ['serif/cambria', FONT.serif, '|G| = |ker φ| · |im φ|  (G : H) = [G : H]'],
      ['mono/consolas', FONT.mono, '|G| = |ker φ| · |im φ|  (G : H) = [G : H]'],
    ];
    let fy = 1000;
    for (const [nm, f, s] of formulas) {
      text(ctx, nm, 90, fy, { size: 20, color: '#8ea0c0', font: FONT.mono, align: 'left' });
      text(ctx, s, 300, fy, { size: 34, color: '#ffc861', font: f, align: 'left', weight: 600 });
      fy -= 0;
      fy += 0;
    }
    // 小字可读性
    label(ctx, 'label(): 26px mono — 群作用 / group action / 轨道-稳定子定理', W / 2, 880, { size: 26, color: '#8ea0c0' });
    ring(ctx, W - 200, 200, 60 + 8 * Math.sin(t * 2), 'cyan', 2, 0.8);
    glow(ctx, 200, 950, 90, 'magenta', 0.6);
  },
};
