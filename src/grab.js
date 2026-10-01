/* 抓帧工具：把指定场景/时间点渲染成 PNG/JPEG 文件，便于人工与模型目视验收
 * 用法: node src/grab.js --scene s1 --times 1,6,12,18 [--out out/frames] [--kind png]
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';
import { Chrome } from './cdp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 ? argv[i + 1] : d;
};
const scene = arg('scene', 's1');
const times = arg('times', '1,5,10').split(',').map(Number);
const kind = arg('kind', 'png');
const outDir = path.resolve(ROOT, arg('out', path.join('out', 'frames')));
const watermark = arg('watermark', 'on') !== 'off';

const { server, port } = await createServer(ROOT);
const chrome = await new Chrome({ gpu: true, tag: 'grab' }).launch();
await chrome.openPage(`http://127.0.0.1:${port}/render.html`);
const gpu = await chrome.eval(`(() => { const c=document.createElement('canvas'); const gl=c.getContext('webgl2'); if(!gl) return 'no-webgl2'; const d=gl.getExtension('WEBGL_debug_renderer_info'); return d? gl.getParameter(d.UNMASKED_RENDERER_WEBGL): 'webgl2 ok'; })()`);
console.log('GPU renderer:', gpu);
console.log('scene list:', JSON.stringify(await chrome.eval('window.__FILM__.scenes()')));

fs.mkdirSync(outDir, { recursive: true });
for (const t of times) {
  const meta = await chrome.frame(`window.__FILM__.render('${kind}','${scene}',${t},{watermark:${watermark},q:0.95})`);
  const ext = kind === 'jpeg' ? 'jpg' : 'png';
  const f = path.join(outDir, `${scene}_t${String(t).replace('.', 'p')}.${ext}`);
  fs.writeFileSync(f, meta.buf);
  console.log(`  ${f}  ${(meta.bytes / 1024).toFixed(0)}KB`);
}
await chrome.close();
server.close();
process.exit(0);
