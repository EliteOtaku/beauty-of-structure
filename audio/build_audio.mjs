/* build_audio.mjs — 合成最终音轨：
 *   程序化配乐（build/score.wav）
 *   + 8 句中文旁白（build/narration/n*.wav，按 manifest 定时插入）
 *   + sidechain 闪避（旁白处音乐自动让位）+ 母带 EQ/限幅
 * 输出 build/mix.wav（48kHz 立体声，与视频等长）
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = 'D:/ffmpeg/bin/ffmpeg.exe';
const FFPROBE = 'D:/ffmpeg/bin/ffprobe.exe';
const BUILD = path.join(ROOT, 'build');

const run = (bin, args) => new Promise((resolve, reject) => {
  const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (err += d));
  p.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`${bin} exit ${code}\n${err.slice(-1800)}`))));
});
const probeDur = async (f) => parseFloat(await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

const manifest = JSON.parse(fs.readFileSync(path.join(BUILD, 'narration', 'manifest.json'), 'utf8'));
const duration = await probeDur(path.join(BUILD, 'score.wav'));
console.log(`配乐时长 ${duration.toFixed(2)}s；旁白 ${manifest.length} 句`);

/* ---------- 1) 旁白轨：按绝对时间 adelay 定位（不做拼接，避免累积误差） ---------- */
const sorted = [...manifest].sort((a, b) => a.start - b.start);
const voiceRaw = path.join(BUILD, 'voice_raw.wav');
const inputs = [];
sorted.forEach((n) => inputs.push('-i', n.file.replace(/\\/g, '/')));
const parts = sorted.map((n, i) => {
  const ms = Math.round(n.start * 1000);
  // 每句：单声道 48k → 延迟到绝对时间点；apad 保证尾部足够长
  return `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms}|${ms},apad[na${i}]`;
});
const mixInputs = sorted.map((_, i) => `[na${i}]`).join('');
const filterVoice = [
  ...parts,
  `${mixInputs}amix=inputs=${sorted.length}:normalize=0:duration=longest,apad,atrim=0:${duration.toFixed(3)}[vo]`,
].join(';');
await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
  ...inputs, '-filter_complex', filterVoice, '-map', '[vo]',
  '-ac', '1', '-c:a', 'pcm_s16le', voiceRaw,
]);
console.log(`旁白轨: ${voiceRaw}  ${(await probeDur(voiceRaw)).toFixed(2)}s（${sorted.length} 句，绝对时间定位）`);

/* ---------- 2) 旁白塑形：EQ 提清晰度 + 压缩 + 短混响 ---------- */
const voice = path.join(BUILD, 'voice.wav');
await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', voiceRaw,
  '-af', [
    'highpass=f=90',
    'equalizer=f=220:t=q:w=1.0:g=-3',      // 去掉闷声
    'equalizer=f=3200:t=q:w=1.2:g=3.5',    // 提升清晰度
    'equalizer=f=7500:t=q:w=1.5:g=2',      // 齿音区轻微增强
    'acompressor=threshold=-20dB:ratio=3.2:attack=6:release=180:makeup=4',
    'aecho=0.85:0.5:38:0.18',
    'volume=1.5',
    'alimiter=limit=0.92',
  ].join(','),
  '-ac', '1', '-c:a', 'pcm_s16le', voice,
]);

/* ---------- 3) 混音：音乐在旁白处闪避 + 母带 ---------- */
const mix = path.join(BUILD, 'mix.wav');
const filter = [
  // 把旁白当侧链，压住音乐中的中频（人声区），保留低频与高频的空气感
  '[0:a]volume=0.95[music]',
  '[1:a]volume=1.0,asplit=2[voice][sc]',
  '[music][sc]sidechaincompress=threshold=0.035:ratio=9:attack=12:release=420:makeup=1[ducked]',
  '[ducked]equalizer=f=120:t=q:w=0.8:g=1.5,equalizer=f=9000:t=h:w=0.6:g=1.5[bed]',
  '[bed][voice]amix=inputs=2:duration=first:weights=1 1.25,alimiter=limit=0.95,volume=1.02[out]',
].join(';');
await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
  '-i', path.join(BUILD, 'score.wav'),
  '-i', voice,
  '-filter_complex', filter,
  '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', mix,
]);
console.log(`混音输出: ${mix}  ${(await probeDur(mix)).toFixed(2)}s`);

/* ---------- 4) 母带：峰值归一（留 2.5dB 余量，避免 AAC 编码后削顶） ---------- */
// mix 的真实峰值 -8.7dBFS → 提到 -2.5dBFS，约 +6.2dB；目标响度约 -20 LUFS
const master = path.join(BUILD, 'master.wav');
await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', mix,
  '-af', 'volume=6.2dB,alimiter=limit=0.80:level=false,aresample=48000',
  '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', master,
]);
console.log(`母带输出: ${master}  ${(await probeDur(master)).toFixed(2)}s`);
