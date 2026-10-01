/* ============================================================================
 * nars.js — 叙事与排版层
 *   · 中西文自动混排（中文雅黑 / 拉丁与公式 Cambria / 代码等宽）
 *   · 行内公式：`...` 等宽，*...* 强调色
 *   · HUD、章节标记、转场、计数、能量核等宣传片组件
 * ==========================================================================*/
import {
  text, glow, glowLine, ring, rgba, clamp, mix, ease, FONT, TAU, mixColor, rgbStr, polyPath,
} from './core.js';

export const W = 1920, H = 1080;
export const SAFE_TOP = 150, SAFE_BOTTOM = 926;

/* --------------------------- 中西文混排内核 ------------------------------ */

function isMathGlyph(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0x30 && c <= 0x39) return true;
  if (c >= 0x41 && c <= 0x5a) return true;
  if (c >= 0x61 && c <= 0x7a) return true;
  if (c >= 0x370 && c <= 0x3ff) return true;   // 希腊字母
  if (c >= 0x1d400 && c <= 0x1d7ff) return true;
  if (c >= 0x2070 && c <= 0x209f) return true; // 上下标
  if (c >= 0x2100 && c <= 0x214f) return true; // ℤ ℚ ℝ ℂ ℕ
  if (c >= 0x2200 && c <= 0x22ff) return true; // 数学运算符
  if (c >= 0x2a00 && c <= 0x2aff) return true;
  return false;
}
const SLANTABLE = /[A-Za-z]$/;

/**
 * 富文本 → 文本段。`code` 等宽、*word* 强调色，其余按字符自动选择字体。
 */
export function runs(str, { size = 64, color = '#fff', weight = 700, font = null, accent = 'gold' } = {}) {
  const out = [];
  let cur = '';
  let kind = 'auto';
  const flush = () => {
    if (!cur) return;
    const k = kind;
    out.push({
      s: cur,
      kind: k,
      font: k === 'mono' ? FONT.mono : (font || (k === 'math' ? FONT.serif : FONT.cjk)),
      color: k === 'accent' ? rgba(accent, 1) : color,
      italic: false,
    });
    cur = '';
  };
  for (const ch of [...str]) {
    if (ch === '`') { flush(); kind = kind === 'mono' ? 'auto' : 'mono'; continue; }
    if (ch === '*') { flush(); kind = kind === 'accent' ? 'auto' : 'accent'; continue; }
    let want;
    if (kind === 'mono') want = 'mono';
    else if (kind === 'accent') want = 'accent';
    else want = isMathGlyph(ch) ? 'math' : 'text';
    if (want !== kind && kind !== 'mono' && kind !== 'accent') { flush(); kind = want; }
    else if ((kind === 'mono' || kind === 'accent') && want !== 'math' && want !== 'text') { /* 保持 */ }
    cur += ch;
  }
  flush();
  const merged = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && last.font === r.font && last.color === r.color && last.kind === r.kind) last.s += r.s;
    else merged.push(r);
  }
  for (const r of merged) {
    r.italic = r.kind === 'math' && SLANTABLE.test(r.s.slice(-1)) && /^[A-Za-z]/.test(r.s);
    r.fontStr = `${r.italic ? 'italic ' : ''}${weight} ${size}px ${r.font}`;
  }
  return merged;
}

function measureChars(ctx, parts, letter = 0) {
  const chars = [];
  let w = 0;
  for (const p of parts) {
    ctx.save();
    ctx.font = p.fontStr;
    if (letter) ctx.letterSpacing = `${letter}px`;
    for (const ch of [...p.s]) {
      const cw = ctx.measureText(ch).width + letter;
      chars.push({ ch, fontStr: p.fontStr, color: p.color, w: cw });
      w += cw;
    }
    ctx.restore();
  }
  return { w, chars };
}

/** 富文本逐字排版（支持 \n 多行；time 动画） */
export function drawRuns(ctx, parts, x, y, t, {
  align = 'center', stagger = 0.03, dur = 0.4, rise = 24, a = 1, glowR = 20, letter = 0,
  baseline = 'middle', lineGap = 1.45,
} = {}) {
  // 按 \n 切行：同一段富文本里换行必须真的换行
  const lines = [];
  let cur = [];
  for (const p of parts) {
    const segs = p.s.split('\n');
    segs.forEach((seg, i) => {
      if (i > 0) { lines.push(cur); cur = []; }
      if (seg) cur.push({ ...p, s: seg });
    });
  }
  lines.push(cur);
  const firstSize = parseFloat(String(parts[0]?.fontStr || '').match(/(\d+(?:\.\d+)?)px/)?.[1] || '24');
  const lineStep = firstSize * lineGap;
  const totalH = (lines.length - 1) * lineStep;
  let idx = 0;
  let maxW = 0;
  lines.forEach((line, li) => {
    const { w, chars } = measureChars(ctx, line, letter);
    maxW = Math.max(maxW, w);
    const ly = y - totalH / 2 + li * lineStep;
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.save();
    ctx.textBaseline = baseline;
    ctx.textAlign = 'left';
    chars.forEach((c) => {
      const p = t > 900 ? 1 : clamp((t - idx * stagger) / dur);
      if (p > 0) {
        const e = ease.outExpo(p);
        ctx.save();
        ctx.globalAlpha = clamp(a) * e;
        ctx.font = c.fontStr;
        if (letter) ctx.letterSpacing = `${letter}px`;
        ctx.translate(cx, ly + (1 - e) * rise);
        ctx.fillStyle = c.color;
        if (glowR) { ctx.shadowColor = c.color; ctx.shadowBlur = glowR * e; }
        ctx.fillText(c.ch, 0, 0);
        ctx.restore();
      }
      cx += c.w;
      idx += 1;
    });
    ctx.restore();
  });
  return { width: maxW, count: idx, lines: lines.length };
}

export function measureRuns(ctx, str, opts = {}) {
  return measureChars(ctx, runs(str, opts), opts.letter || 0).w;
}

/** 单行公式（拉丁/希腊走衬线体，视觉上更像数学排版） */
export function formula(ctx, str, x, y, { size = 40, color = '#ffc861', a = 1, align = 'center', glowR = 12, weight = 600, letter = 1 } = {}) {
  const parts = runs(str, { size, color, weight, font: FONT.serif });
  parts.forEach((p) => { p.italic = false; p.fontStr = `${weight} ${size}px ${p.font}`; });
  return drawRuns(ctx, parts, x, y, 999, { align, a, glowR, stagger: 0, rise: 0, letter });
}

/**
 * 主字幕：自动断行 + 逐字浮现，支持 `公式` 与 *强调*。
 */
export function caption(ctx, str, x, y, t, opts = {}) {
  const {
    size = 64, color = '#ffffff', glowR = 26, lineGap = 1.42, stagger = 0.045, dur = 0.42,
    maxWidth = 1500, align = 'center', weight = 700, letter = 2, a = 1, rise = 26,
  } = opts;
  // 1) 逐字测量（宽度在字符级确定，避免按段均分造成叠印）
  const lines = [];
  for (const hl of str.split('\n')) {
    const parts = runs(hl, { size, color, weight });
    if (hl === '') { lines.push([]); continue; }
    let cur = [];
    let curW = 0;
    for (const p of parts) {
      for (const ch of [...p.s]) {
        ctx.save();
        ctx.font = p.fontStr;
        if (letter) ctx.letterSpacing = `${letter}px`;
        const wl = ctx.measureText(ch).width + letter;
        ctx.restore();
        if (curW + wl > maxWidth && curW > 0) { lines.push(cur); cur = []; curW = 0; }
        cur.push({ ch, fontStr: p.fontStr, color: p.color, w: wl });
        curW += wl;
      }
    }
    lines.push(cur);
  }
  const totalH = (lines.length - 1) * size * lineGap;
  let idx = 0;
  lines.forEach((line, li) => {
    const ly = y - totalH / 2 + li * size * lineGap;
    const lw = line.reduce((s, c) => s + c.w, 0);
    let cx = align === 'center' ? x - lw / 2 : align === 'right' ? x - lw : x;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    line.forEach((c) => {
      const p = t > 900 ? 1 : clamp((t - idx * stagger) / dur);
      if (p > 0) {
        const e = ease.outExpo(p);
        ctx.save();
        ctx.globalAlpha = clamp(a) * e;
        ctx.font = c.fontStr;
        if (letter) ctx.letterSpacing = `${letter}px`;
        ctx.translate(cx, ly + (1 - e) * rise);
        ctx.fillStyle = c.color;
        if (glowR) { ctx.shadowColor = c.color; ctx.shadowBlur = glowR * e; }
        ctx.fillText(c.ch, 0, 0);
        ctx.restore();
      }
      cx += c.w;
      idx += 1;
    });
    ctx.restore();
  });
  return { lines: lines.length };
}

/* ------------------------------- 组件 ---------------------------------- */

export function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 章节标记：左上序号+标题，右上进度 */
export function chapter(ctx, t, { index = '01', title = '', total = 6, life = [0, 999], progress = null } = {}) {
  const a = clamp((t - life[0]) / 0.9) * clamp((life[1] - t) / 0.9);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  text(ctx, index, 74, 108, { size: 26, color: rgba('cyan', 0.9), font: FONT.mono, align: 'left', weight: 700, letter: 3 });
  ctx.fillStyle = rgba('cyan', 0.5);
  ctx.fillRect(74, 126, 34, 2);
  const parts = runs(title, { size: 30, color: 'rgba(232,240,255,.92)', weight: 700 });
  drawRuns(ctx, parts, 74, 158, 999, { align: 'left', stagger: 0, glowR: 8, letter: 5 });
  const w = 260, x = W - 74 - w, y = 112;
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.fillRect(x, y, w, 3);
  const p = progress === null ? clamp(t / Math.max(life[1], 1)) : clamp(progress);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, rgba('cyan', 0.95));
  g.addColorStop(1, rgba('magenta', 0.95));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * p, 3);
  text(ctx, `${index} / 0${total}`, W - 74, 150, { size: 20, color: 'rgba(200,214,235,.45)', font: FONT.mono, align: 'right', letter: 2 });
  ctx.restore();
}

/** 信息板：解释性画面用（左竖条 + 标题 + 说明 + 公式） */
export function infoCard(ctx, x, y, w, h, a = 1, { accent = 'cyan', title = '', body = '', formula: f = '', bodySize = 25 } = {}) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  const g = ctx.createLinearGradient(x, y, x + w * 0.2, y + h);
  g.addColorStop(0, rgba(accent, 0.16));
  g.addColorStop(1, rgba(accent, 0.02));
  ctx.fillStyle = g;
  roundedRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.45);
  ctx.lineWidth = 1.5;
  roundedRect(ctx, x, y, w, h, 18);
  ctx.stroke();
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.fillRect(x, y + 20, 4, h - 40);
  if (title) drawRuns(ctx, runs(title, { size: 40, weight: 700 }), x + 34, y + 58, 999, { align: 'left', glowR: 12, stagger: 0 });
  if (body) {
    let by = y + 118;
    for (const line of body.split('\n')) {
      drawRuns(ctx, runs(line, { size: bodySize, color: 'rgba(214,226,246,.88)', weight: 500 }), x + 34, by, 999, { align: 'left', glowR: 0, stagger: 0, letter: 1 });
      by += bodySize * 1.55;
    }
  }
  if (f) formula(ctx, f, x + 34, y + h - 64, { size: 38, color: rgba(accent, 1), align: 'left' });
  ctx.restore();
}

/** 数据条（实时数值 HUD） */
export function statBar(ctx, x, y, items, a = 1, { size = 24, gap = 26, color = 'cyan' } = {}) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  let cx = x;
  items.forEach((it, i) => {
    if (i) {
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(cx, y - 13, 1, 26);
      cx += gap;
    }
    const w1 = text(ctx, it.k, cx, y, { size: size * 0.76, color: 'rgba(180,198,224,.72)', font: FONT.mono, align: 'left', weight: 500, letter: 2 });
    cx += w1 + 12;
    const w2 = text(ctx, it.v, cx, y, { size, color: rgba(color, 1), font: FONT.mono, align: 'left', weight: 700, letter: 1 });
    cx += w2 + gap;
  });
  ctx.restore();
}

/** 群元素胶囊标签 */
export function chip(ctx, str, x, y, t, { color = 'cyan', size = 32, a = 1, dur = 0.5, from = [0, 24] } = {}) {
  const p = clamp(t / dur);
  if (p <= 0) return;
  const e = ease.outBack(p);
  const wpx = size * (str.length > 2 ? 2.6 : 2.0), h = size * 1.6;
  ctx.save();
  ctx.globalAlpha = clamp(a) * clamp(p * 1.5);
  ctx.translate(x + (1 - e) * from[0], y + (1 - e) * from[1]);
  ctx.scale(e, e);
  ctx.fillStyle = rgba(color, 0.15);
  roundedRect(ctx, -wpx / 2, -h / 2, wpx, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.7);
  ctx.lineWidth = 1.6;
  roundedRect(ctx, -wpx / 2, -h / 2, wpx, h, h / 2);
  ctx.stroke();
  text(ctx, str, 0, 2, { size, color: '#fff', font: FONT.serif, weight: 700, glowR: 10 });
  ctx.restore();
}

/** 相机抖动 */
export function shakeOffset(t, start, dur, amp = 14, freq = 34) {
  const p = clamp((t - start) / dur);
  if (p <= 0 || p >= 1) return [0, 0];
  const d = (1 - p) * amp;
  return [Math.sin(t * freq) * d, Math.cos(t * freq * 1.31) * d * 0.8];
}

/** 故障撕裂条 */
export function glitchBars(ctx, t, start, dur, { color = 'cyan', n = 10, seed = 7 } = {}) {
  const p = clamp((t - start) / dur);
  if (p <= 0 || p >= 1) return;
  const a = 1 - p;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const h = 8 + ((i * 37 + seed) % 5) * 9;
    const y = (i * 131 + seed * 17) % H;
    const w = W * (0.25 + (0.7 * ((i * 61) % 100)) / 100);
    const x = (Math.sin(t * 9 + i) * 0.5 + 0.5) * (W - w);
    ctx.globalAlpha = a * 0.32;
    ctx.fillStyle = rgba(i % 2 ? 'magenta' : color, 0.5);
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** 能量核：脉冲光球 + 同心环 */
export function core(ctx, x, y, r, t, { color = 'cyan', hue = 'white', pulse = 1 } = {}) {
  const pr = r * (1 + 0.05 * Math.sin(t * 3.1) * pulse);
  glow(ctx, x, y, pr * 2.6, color, 0.5);
  glow(ctx, x, y, pr * 1.1, hue, 0.4);
  ring(ctx, x, y, pr, color, 2.2, 0.9);
  ring(ctx, x, y, pr * 1.55, color, 1, 0.35);
  ring(ctx, x, y, pr * 2.15, color, 0.8, 0.16);
}

/** 数字滚动 */
export function countUp(t, start, dur, target, { decimals = 0, sep = ',' } = {}) {
  const p = ease.outExpo(clamp((t - start) / dur));
  const v = target * p;
  const s = decimals ? v.toFixed(decimals) : Math.round(v).toString();
  const [ip, dp] = s.split('.');
  const withSep = ip.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return { text: dp ? `${withSep}.${dp}` : withSep, value: v, p };
}

export function topGlow(ctx, color = 'cyan', a = 0.5) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  g.addColorStop(0, rgba(color, 0.2 * a));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.6);
  ctx.restore();
}

export const P = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

export function growLine(ctx, x1, y1, x2, y2, p, color = 'cyan', w = 2, a = 1) {
  const q = clamp(p);
  if (q <= 0) return;
  glowLine(ctx, x1, y1, mix(x1, x2, q), mix(y1, y2, q), color, w, a * Math.min(1, q * 3));
}

export function ripple(ctx, x, y, r, t, { color = 'cyan', n = 3, speed = 0.6, a = 0.5, w = 1.4 } = {}) {
  for (let i = 0; i < n; i++) {
    const p = (t * speed + i / n) % 1;
    ring(ctx, x, y, r * (0.2 + p), color, w, a * (1 - p));
  }
}

/** 星尘粒子场（确定性，随镜头视差） */
export function starfield(ctx, t, { n = 260, seed = 91, spread = 1.25, speed = 6, a = 1, color = 'white' } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const s1 = ((i * 2654435761) % 100000) / 100000;
    const s2 = ((i * 40503 + 12345) % 100000) / 100000;
    const x = ((s1 * W * spread - t * speed * (0.3 + s2)) % (W * spread) + W * spread) % (W * spread) - W * 0.12;
    const y = s2 * H;
    const r = 0.6 + s2 * 2.1;
    ctx.globalAlpha = a * (0.25 + 0.75 * ((Math.sin(t * 1.3 + i) * 0.5 + 0.5)));
    ctx.fillStyle = i % 7 === 0 ? rgba('cyan', 0.9) : rgba(color, 0.75);
    ctx.fillRect(x, y, r, r);
  }
  ctx.restore();
  void seed;
}

export { text, glow, glowLine, ring, rgba, clamp, mix, mixColor, rgbStr, TAU, FONT, ease, polyPath };
