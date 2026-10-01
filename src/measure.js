/* measure.js — 用浏览器实际测量关键文案的像素宽度，核对是否超出安全区
 * 用法: node src/measure.js
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';
import { Chrome } from './cdp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await createServer(ROOT);
const chrome = await new Chrome({ gpu: true, tag: 'measure' }).launch();
await chrome.openPage(`http://127.0.0.1:${port}/render.html`);

/** 待测文案：[说明, 文本, 字号, 字距] */
const CASES = [
  ['s5-A 主字幕', '6 颗珠子，2 种颜色：*64* 个方案', 46, 2],
  ['s2-A 副文', '轨道 · 稳定子：', 26, 1],
  ['s2-A 副文行2', '转 45° 的八次幂，把一个点', 26, 1],
  ['s5-B 主字幕', '群作用把 64 个方案，粘成 *14 条轨道*', 46, 2],
  ['s5-A 右说明', '但把它们串起来转一转，', 28, 1],
  ['s5-A 右说明2', '很多方案看起来*完全一样*。', 28, 1],
  ['s6-B 右说明', '弦切作图 = 群运算：', 27, 1],
  ['s6-B 右说明2', '两点连线取第三交点，', 27, 1],
  ['s4-C 右说明', '所有被压成*单位元*的元素', 27, 1],
  ['s3-A 主字幕', '置换，就是*重新编号*', 54, 4],
  ['s1-G 结尾', '研究结构本身，', 58, 4],
  ['s6-D 结尾', '从一张正方形，到整个宇宙：', 62, 4],
  ['s6-D 结尾2', '*结构，是万物的语言*', 62, 4],
  ['s6-E 副标', '有解的东西可以被算出来，有结构的东西才能被理解', 26, 3],
  ['s3-E 大数字', '43,252,003,274,489,856,000', 52, 0],
  ['s3-E 大数字行', '43,252,003,274,489', 52, 0],
  ['s1-E 公理', 'a, b ∈ G  ⇒  a·b ∈ G', 34, 1],
];

const out = await chrome.eval(`(() => {
  const c = document.getElementById('stage');
  const g = c.getContext('2d');
  const cases = ${JSON.stringify(CASES)};
  return cases.map(([name, str, size, letter]) => {
    // 去掉强调标记
    const clean = str.replace(/[*\`]/g, '');
    g.save();
    g.font = '700 ' + size + 'px "Microsoft YaHei","Noto Sans SC","SimHei",sans-serif';
    if (letter) g.letterSpacing = letter + 'px';
    const w = g.measureText(clean).width + clean.length * (letter || 0) * 0;
    g.restore();
    return { name, str: clean, size, letter, w: Math.round(w), fits1500: w <= 1500, fits1700: w <= 1700 };
  });
})()`);
console.log('文案宽度实测（画面宽 1920，安全区建议 ≤1700）：');
for (const r of out) {
  const mark = r.w > 1700 ? '  ← 超出安全区!' : r.w > 1500 ? '  ← 偏宽' : '';
  console.log(`  ${r.name.padEnd(16)} size=${String(r.size).padStart(3)} letter=${r.letter}  width=${String(r.w).padStart(5)}${mark}   「${r.str}」`);
}
await chrome.close();
server.close();
process.exit(0);
