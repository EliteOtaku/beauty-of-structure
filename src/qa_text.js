/* qa_text.js — 逐帧扫描"文字互相重叠"与"超安全边"问题
 * 原理：hook CanvasRenderingContext2D.fillText，记录每一段文字的包围盒与透明度，
 *       对透明度足够高的文本框两两求交；同时检查是否越出画面安全边。
 * 用法: node src/qa_text.js [--step 0.5] [--scene s1,s2] [--minA 0.35]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';
import { Chrome } from './cdp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const STEP = parseFloat(arg('step', '0.5'));
const MIN_A = parseFloat(arg('minA', '0.35'));
const SCENES_FILTER = arg('scene', '');
const MARGIN = parseInt(arg('margin', '56'), 10);

const { server, port } = await createServer(ROOT);
const chrome = await new Chrome({ gpu: true, tag: 'qa' }).launch();
await chrome.openPage(`http://127.0.0.1:${port}/render.html`);
const scenes = await chrome.eval('window.__FILM__.scenes()');
const targets = scenes.filter((s) => ['s1', 's2', 's3', 's4', 's5', 's6'].includes(s.key))
  .filter((s) => !SCENES_FILTER || SCENES_FILTER.split(',').includes(s.key));

// 注入 hook：记录 fillText 的包围盒
await chrome.eval(`(() => {
  const proto = CanvasRenderingContext2D.prototype;
  if (proto.__qaPatched) return;
  const orig = proto.fillText;
  proto.fillText = function (str, x, y) {
    const s = String(str);
    if (window.__QA_ON__ && s.trim()) {
      const m = this.measureText(s);
      const w = m.width, size = parseFloat(String(this.font).match(/(\\d+(?:\\.\\d+)?)px/)?.[1] || '16');
      let x0 = x;
      if (this.textAlign === 'center') x0 = x - w / 2;
      else if (this.textAlign === 'right') x0 = x - w;
      let y0 = y - size / 2;
      if (this.textBaseline === 'alphabetic') y0 = y - size * 0.8;
      else if (this.textBaseline === 'top') y0 = y;
      else if (this.textBaseline === 'bottom') y0 = y - size;
      // 用"相对本帧基线变换"的缩放，避免场景内 ctx.scale 累加造成误报
      const t = this.getTransform();
      const base = window.__QA_BASE__ || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      // 本帧内的累积缩放 = 当前缩放 / 基线缩放
      const sx = Math.hypot(t.a, t.b) / (Math.hypot(base.a, base.b) || 1);
      const sy = Math.hypot(t.c, t.d) / (Math.hypot(base.c, base.d) || 1);
      const px = base.e + (t.a * x0 + t.c * y0 + t.e);
      const py = base.f + (t.b * x0 + t.d * y0 + t.f);
      const st = (new Error().stack || '').split('\\n').slice(2, 4).map((l) => l.trim()).join(' <- ');
      window.__QA_BOXES__.push({ s, x: px, y: py, w: w * sx, h: size * sy, a: this.globalAlpha, st });
    }
    return orig.call(this, str, x, y);
  };
  proto.__qaPatched = true;
})()`);

const results = [];
for (const sc of targets) {
  const boxes = [];
  for (let t = 0; t < sc.duration; t += STEP) {
    const res = await chrome.eval(`(() => {
      const g = document.getElementById('stage').getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      window.__QA_BASE__ = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      window.__QA_BOXES__ = [];
      window.__QA_ON__ = true;
      window.__FILM__.drawFrame('${sc.key}', ${t.toFixed(3)}, { watermark: false });
      window.__QA_ON__ = false;
      return window.__QA_BOXES__;
    })()`);
    const strong = res.filter((b) => b.a >= MIN_A && b.w > 2 && b.h > 4);
    // 两两求交（面积重叠 > 25% 视为互撞）
    const hits = [];
    for (let i = 0; i < strong.length; i++) {
      for (let j = i + 1; j < strong.length; j++) {
        const A = strong[i], B = strong[j];
        // 同一段文字被重复绘制（如同位置同内容）跳过
        if (A.s === B.s && Math.abs(A.x - B.x) < 1 && Math.abs(A.y - B.y) < 1) continue;
        const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
        if (ox <= 0 || oy <= 0) continue;
        const inter = ox * oy;
        const small = Math.min(A.w * A.h, B.w * B.h);
        if (inter / small > 0.25) hits.push({ a: A.s.slice(0, 18), b: B.s.slice(0, 18), t, ratio: +(inter / small).toFixed(2) });
      }
    }
    // 越界
    const out = strong.filter((b) => b.x < MARGIN || b.y < MARGIN || b.x + b.w > 1920 - MARGIN || b.y + b.h > 1080 - MARGIN);
    if (hits.length || out.length) {
      results.push({ scene: sc.key, t: +t.toFixed(2), hits: hits.slice(0, 4), out: out.slice(0, 3).map((b) => ({ s: b.s.slice(0, 16), x: Math.round(b.x), y: Math.round(b.y), st: (b.st || '').slice(0, 220) })) });
    }
  }
  process.stdout.write(`  扫描 ${sc.key} 完成 (${(sc.duration / STEP).toFixed(0)} 帧)\n`);
}

const byScene = {};
results.forEach((r) => { (byScene[r.scene] = byScene[r.scene] || []).push(r); });
let total = 0;
for (const [k, v] of Object.entries(byScene)) {
  console.log(`\n== ${k}: ${v.length} 个问题帧 ==`);
  v.slice(0, 8).forEach((r) => {
    total++;
    console.log(`  t=${r.t}s  重叠: ${r.hits.map((h) => `"${h.a}"×"${h.b}"(x${h.ratio})`).join(' ') || '-'}  越界: ${r.out.map((o) => `"${o.s}"@${o.x},${o.y}`).join(' ') || '-'}`);
  });
  const firstOut = v.find((r) => r.out.length);
  if (firstOut) console.log(`  首个越界调用栈: ${firstOut.out[0].st}`);
}
console.log(`\n合计问题帧 ${results.length}`);
await chrome.close();
server.close();
process.exit(0);
