/* ============================================================================
 * render.js — 全片渲染与合成
 *   1) 按场次分片并行渲染（每个 worker 一个 Chrome 实例，帧直接喂给 ffmpeg）
 *   2) concat 拼接为无声母版
 *   3) 复用已渲染好的母版 + 音轨（build/master.wav）合成最终 MP4
 *
 * 用法:
 *   node src/render.js                      # 渲染全部 + 合成
 *   node src/render.js --only s1,s3         # 只渲染指定场次（调试）
 *   node src/render.js --workers 4 --fps 30
 *   node src/render.js --mux-only           # 只做拼接与音画合成（不重渲染）
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';
import { Chrome } from './cdp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = 'D:/ffmpeg/bin/ffmpeg.exe';
const FFPROBE = 'D:/ffmpeg/bin/ffprobe.exe';
const BUILD = path.join(ROOT, 'build');
const SEG = path.join(BUILD, 'segments');
const FINAL = path.join(ROOT, 'out', 'abstract-algebra-film_1080p.mp4');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FPS = parseInt(arg('fps', '30'), 10);
const WORKERS = parseInt(arg('workers', '4'), 10);
const ONLY = arg('only', '');
const MUX_ONLY = argv.includes('--mux-only');
const JPEG_Q = '0.95';

function run(bin, args, { onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => { err += d; if (err.length > 8000) err = err.slice(-8000); });
    p.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(bin)} exit ${code}\n${err.slice(-2500)}`))));
    void onStderr;
  });
}
const probe = async (args) => JSON.parse(await run(FFPROBE, ['-v', 'error', '-of', 'json', ...args]));

/* ------------------------------ 场次表 --------------------------------- */
const SCENES = [
  { key: 's1', name: '对称' },
  { key: 's2', name: '循环' },
  { key: 's3', name: '置换' },
  { key: 's4', name: '同态' },
  { key: 's5', name: '计数' },
  { key: 's6', name: '终章' },
];

async function main() {
  fs.mkdirSync(SEG, { recursive: true });
  fs.mkdirSync(path.dirname(FINAL), { recursive: true });

  if (MUX_ONLY) return concatAndMux();

  const { server, port } = await createServer(ROOT);
  const url = `http://127.0.0.1:${port}/render.html`;

  /* 1) 启动 worker：各自一个 Chrome */
  const workers = [];
  for (let i = 0; i < WORKERS; i++) {
    const c = await new Chrome({ gpu: true, tag: `w${i}` }).launch();
    await c.openPage(url);
    workers.push({ id: i, chrome: c, sceneList: null });
    console.log(`[worker ${i}] Chrome ready`);
  }
  const durations = {};
  (await workers[0].chrome.eval('window.__FILM__.scenes()')).forEach((s) => { durations[s.key] = s.duration; });
  console.log('场景时长:', JSON.stringify(durations));

  /* 2) 任务队列：每场按帧范围均分给 workers */
  const plan = [];
  const wanted = ONLY ? new Set(ONLY.split(',').map((s) => s.trim())) : null;
  let tOffset = 0;
  const sceneRanges = [];
  for (const s of SCENES) {
    const d = durations[s.key];
    sceneRanges.push({ ...s, start: tOffset, dur: d, nFrames: Math.round(d * FPS) });
    tOffset += d;
  }
  const TOTAL = tOffset;
  console.log(`全片总长 ${TOTAL.toFixed(2)}s / ${Math.round(TOTAL * FPS)} 帧 @ ${FPS}fps`);

  for (const sr of sceneRanges) {
    if (wanted && !wanted.has(sr.key)) continue;
    const per = Math.ceil(sr.nFrames / WORKERS);
    for (let w = 0; w < WORKERS; w++) {
      const f0 = w * per;
      const f1 = Math.min((w + 1) * per, sr.nFrames);
      if (f0 >= f1) continue;
      plan.push({ scene: sr.key, start: sr.start, f0, f1, nFrames: f1 - f0, out: path.join(SEG, `${sr.key}_w${w}.mp4`) });
    }
  }
  console.log(`分片任务: ${plan.length} 个，共 ${plan.reduce((s, p) => s + p.nFrames, 0)} 帧`);

  /* 3) 并行执行 */
  const t0 = Date.now();
  let doneFrames = 0;
  const totalFrames = plan.reduce((s, p) => s + p.nFrames, 0);
  const queue = [...plan];
  let lastLog = 0;
  await Promise.all(workers.map(async (w) => {
    for (;;) {
      const job = queue.shift();
      if (!job) break;
      const ff = spawn(FFMPEG, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(FPS), '-i', 'pipe:0',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p',
        '-r', String(FPS), '-movflags', '+faststart', job.out,
      ], { stdio: ['pipe', 'ignore', 'pipe'] });
      let ffErr = '';
      ff.stderr.on('data', (d) => { ffErr += d; });
      const encDone = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg: ' + ffErr.slice(-800))))));
      for (let f = job.f0; f < job.f1; f++) {
        const t = job.start + f / FPS;
        const meta = await w.chrome.frame(
          `window.__FILM__.render('jpeg','${job.scene}',${t.toFixed(5)},{q:${JPEG_Q}})`,
        );
        if (!ff.stdin.write(meta.buf)) await new Promise((r) => ff.stdin.once('drain', r));
        doneFrames++;
        const now = Date.now();
        if (now - lastLog > 15000) {
          lastLog = now;
          const el = (now - t0) / 1000;
          const rate = doneFrames / el;
          console.log(`  ${doneFrames}/${totalFrames} 帧  ${rate.toFixed(1)} fps  ETA ${((totalFrames - doneFrames) / rate / 60).toFixed(1)} min`);
        }
      }
      ff.stdin.end();
      await encDone;
      console.log(`  [worker ${w.id}] ${path.basename(job.out)} 完成 (${job.nFrames} 帧)`);
    }
  }));

  const el = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  console.log(`渲染完成：${totalFrames} 帧 / ${el} 分钟`);

  for (const w of workers) await w.chrome.close();
  server.close();

  await concatAndMux();
}

/* ------------------------ 拼接与音画合成 ------------------------------- */
async function concatAndMux() {
  const segFiles = fs.readdirSync(SEG).filter((f) => f.endsWith('.mp4'));
  // 按场次顺序、worker 顺序排列
  const order = [];
  for (const s of SCENES) {
    const list = segFiles.filter((f) => f.startsWith(s.key + '_')).sort();
    list.forEach((f) => order.push(f));
  }
  const listPath = path.join(SEG, 'concat.txt');
  fs.writeFileSync(listPath, order.map((f) => `file '${path.join(SEG, f).replace(/\\/g, '/')}'`).join('\n') + '\n');

  const silent = path.join(BUILD, 'video_silent.mp4');
  console.log(`拼接 ${order.length} 个分片 → ${silent}`);
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c', 'copy', '-movflags', '+faststart', silent]);

  const audio = path.join(BUILD, 'master.wav');
  if (!fs.existsSync(audio)) throw new Error('缺少音轨 build/master.wav，请先运行 node audio/build_audio.mjs');
  console.log('音画合成 →', FINAL);
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', silent, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    '-shortest', '-movflags', '+faststart', FINAL]);

  const info = await probe(['-show_entries', 'format=duration,size,bit_rate',
    '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,channels,sample_rate',
    '-i', FINAL]);
  console.log('最终产物:', JSON.stringify(info, null, 1));
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
