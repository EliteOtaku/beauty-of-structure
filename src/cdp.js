/* ============================================================================
 * cdp.js — 启动 Chromium 并用 CDP 驱动渲染页
 *   · 每帧：Runtime.evaluate 返回 base64 图像 → Buffer（零解码开销）
 *   · 支持多实例并行渲染
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_CHROME = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* 端口未就绪，重试 */ }
    await sleep(120);
  }
  throw new Error('CDP endpoint not ready: ' + url);
}

/** 由 base64 生成 Buffer（比 Buffer.from(s,'base64') 更省内存/更快） */
export function b64(buf64) {
  return Buffer.from(buf64, 'base64');
}

export class Chrome {
  constructor({ exe = DEFAULT_CHROME, gpu = true, w = 1920, h = 1080, tag = 'r' } = {}) {
    this.exe = exe;
    this.gpu = gpu;
    this.w = w;
    this.h = h;
    this.tag = tag;
    this.nextId = 1;
    this.pending = new Map();
    this.sessionId = null;
  }

  async launch() {
    const profile = path.join(os.tmpdir(), `aa-film-${this.tag}-${process.pid}`);
    fs.rmSync(profile, { recursive: true, force: true });
    const args = [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      `--window-size=${this.w},${this.h}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=CalculateNativeWinOcclusion,Translate,MediaRouter',
      '--force-device-scale-factor=1',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      'about:blank',
    ];
    if (this.gpu) {
      args.unshift(
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
      );
    } else {
      args.unshift('--disable-gpu');
    }
    this.proc = spawn(this.exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc.stderr.on('data', () => {});
    this.proc.stdout.on('data', () => {});

    // 从 DevToolsActivePort 读取端口
    const portFile = path.join(profile, 'DevToolsActivePort');
    let port = 0;
    for (let i = 0; i < 200; i++) {
      if (fs.existsSync(portFile)) {
        const txt = fs.readFileSync(portFile, 'utf8').split('\n');
        if (txt[0]) { port = parseInt(txt[0], 10); break; }
      }
      await sleep(100);
    }
    if (!port) throw new Error('Chrome 未启动（DevToolsActivePort 缺失）');

    const version = await getJSON(`http://127.0.0.1:${port}/json/version`);
    this.ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = (e) => rej(new Error('ws error ' + e.message));
    });
    this.ws.onmessage = (ev) => this._onMessage(ev.data);
    this.ws.onclose = () => { for (const p of this.pending.values()) p.reject(new Error('ws closed')); this.pending.clear(); };
    return this;
  }

  _onMessage(data) {
    const msg = JSON.parse(data);
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message + ' :: ' + JSON.stringify(msg.error.data ?? '')));
      else resolve(msg.result);
    }
  }

  send(method, params = {}, sessionId = this.sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }
      }, 120000);
    });
  }

  async openPage(url) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' }, null);
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true }, null);
    this.sessionId = sessionId;
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: this.w, height: this.h, deviceScaleFactor: 1, mobile: false,
    });
    const loaded = new Promise((resolve) => {
      const handler = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.method === 'Page.loadEventFired') { this.ws.removeEventListener('message', handler); resolve(); }
      };
      this.ws.addEventListener('message', handler);
    });
    await this.send('Page.navigate', { url });
    await loaded;
    for (let i = 0; i < 100; i++) {
      const r = await this.eval('!!window.__FILM_READY__');
      if (r === true) return this;
      await sleep(100);
    }
    throw new Error('渲染页未就绪');
  }

  /** 求值并取回 JSON 结果 */
  async eval(expression, { awaitPromise = false } = {}) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise, timeout: 60000,
    });
    if (r.exceptionDetails) {
      throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  }

  /** 渲染一帧并取回图像 Buffer 与元信息 */
  async frame(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: false, timeout: 60000,
    });
    if (r.exceptionDetails) {
      throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    const v = r.result.value;
    const i = v.indexOf('|');
    const j = v.indexOf('|', i + 1);
    const bytes = parseInt(v.slice(0, i), 10);
    const b64s = v.slice(i + 1, j);
    const mime = v.slice(j + 1);
    return { buf: Buffer.from(b64s, 'base64'), bytes, mime };
  }

  async close() {
    try { this.ws?.close(); } catch { /* ignore */ }
    try { this.proc?.kill(); } catch { /* ignore */ }
  }
}
