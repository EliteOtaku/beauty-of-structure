#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
score.py — 程序化配乐（抽象代数宣传片）
不用采样库：全部由正弦/锯齿/噪声 + 包络合成，音高取自纯律与十二平均律，
与影片"结构之美"的主题呼应。
输出: build/score.wav (48kHz 立体声)
"""
import math
import os
import struct
import wave

import numpy as np
from scipy.signal import lfilter

SR = 48000
DUR = 210.0          # 与视频等长
N = int(SR * DUR)
rng = np.random.default_rng(20241001)

L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)


def onepole(x, alpha):
    """一阶低通（向量化）"""
    return lfilter([alpha], [1.0, -(1.0 - alpha)], x)


def add(buf_l, buf_r, t0, idx=None):
    """把一段立体声片段叠加到总线上"""
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    n = min(len(buf_l), N - i0)
    if n <= 0:
        return
    L[i0:i0 + n] += buf_l[:n]
    R[i0:i0 + n] += buf_r[:n]


def env(n, a=0.01, d=0.2, s=0.6, r=0.3, sustain=1.0):
    """ADSR 包络"""
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(n - a_n - d_n - r_n, 1)
    parts = []
    if a_n:
        parts.append(np.linspace(0, 1, a_n, endpoint=False) ** 1.4)
    if d_n:
        parts.append(np.linspace(1, s, d_n, endpoint=False))
    parts.append(np.full(s_n, s * sustain))
    if r_n:
        parts.append(np.linspace(s * sustain, 0, r_n) ** 1.6)
    e = np.concatenate(parts)
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def note(name):
    """音名 → 频率（十二平均律，A4=440）"""
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    if isinstance(name, (int, float)):
        return float(name)
    p = names[name[:-1]]
    octv = int(name[-1])
    midi = 12 * (octv + 1) + p
    return 440.0 * 2 ** ((midi - 69) / 12)


def pad(freqs, dur, amp=0.16, detune=0.006, cutoff=0.35, pan=0.0, atk=1.2, rel=1.6, bright=0.5):
    """和声垫：多锯齿叠加 + 一阶低通 + 缓慢呼吸"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for dv in (-detune, 0.0, detune):
            ff = f * (1 + dv)
            ph = rng.random() * 2 * math.pi
            for h in range(1, 8):
                a = (bright ** (h - 1)) / h
                out += a * np.sin(2 * math.pi * ff * h * t + ph * h)
    out /= max(len(freqs) * 3, 1)
    y = onepole(out, min(max(cutoff, 0.01), 0.99))
    y = y / (np.max(np.abs(y)) + 1e-9)
    e = env(n, a=atk, d=0.4, s=0.85, r=rel, sustain=1.0)
    y = y * e * amp
    pl = np.clip(0.5 - pan * 0.5, 0, 1)
    pr = np.clip(0.5 + pan * 0.5, 0, 1)
    return y * pl * 2, y * pr * 2


def bell(f, dur, amp=0.3, pan=0.0, bright=0.55):
    """钟：基频 + 非谐分音，指数衰减"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    partials = [(1.0, 1.0, 2.6), (2.0, 0.5, 3.4), (2.76, 0.28, 4.6), (4.07, 0.16, 6.0), (5.43, 0.1, 8.0), (8.0, 0.06, 11.0)]
    for mult, a, dec in partials:
        y += a * bright ** (mult * 0.3) * np.sin(2 * math.pi * f * mult * t) * np.exp(-t * dec)
    y = y / (np.max(np.abs(y)) + 1e-9) * amp
    pl = np.clip(0.5 - pan * 0.5, 0, 1)
    pr = np.clip(0.5 + pan * 0.5, 0, 1)
    return y * pl * 2, y * pr * 2


def pluck(f, dur, amp=0.22, pan=0.0, decay=7.0):
    """拨弦：Karplus-Strong"""
    n = int(dur * SR)
    ln = max(int(SR / f), 2)
    buf = rng.uniform(-1, 1, ln).astype(np.float64)
    out = np.zeros(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = buf[idx]
        out[i] = cur
        nxt = 0.5 * (cur + prev) * 0.996
        prev = cur
        buf[idx] = nxt
        idx = (idx + 1) % ln
    out *= np.exp(-np.arange(n) / SR * decay)
    out = out / (np.max(np.abs(out)) + 1e-9) * amp
    pl = np.clip(0.5 - pan * 0.5, 0, 1)
    pr = np.clip(0.5 + pan * 0.5, 0, 1)
    return out * pl * 2, out * pr * 2


def sub_boom(dur, amp=0.5):
    """低频冲击"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 64 * np.exp(-t * 2.2) + 38
    ph = 2 * math.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 2.0)
    noise = rng.normal(0, 1, n) * np.exp(-t * 22) * 0.35
    y = (y + noise) / (np.max(np.abs(y)) + 1e-9) * amp
    return y, y.copy()


def kick(dur=0.55, amp=0.55):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 26) + 46
    ph = 2 * math.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 6.5)
    click = rng.normal(0, 1, n) * np.exp(-t * 120) * 0.25
    y = (y + click) / (np.max(np.abs(y)) + 1e-9) * amp
    return y, y.copy()


def hat(dur=0.09, amp=0.14, pan=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = rng.normal(0, 1, n) * np.exp(-t * 55)
    y = y / (np.max(np.abs(y)) + 1e-9) * amp
    return y * (1 - pan), y * (1 + pan)


def noise_wash(dur, amp=0.2, atk=2.0, rel=3.0, lp=0.06):
    n = int(dur * SR)
    x = rng.normal(0, 1, n)
    y = onepole(x, lp)
    y = y / (np.max(np.abs(y)) + 1e-9)
    e = env(n, a=atk, d=1.0, s=0.8, r=rel)
    y = y * e * amp
    return y, np.roll(y, 300)


def sine_tone(f, dur, amp=0.2, pan=0.0, atk=0.02, rel=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * math.pi * f * t) * env(n, a=atk, d=0.1, s=0.9, r=rel)
    y = y / (np.max(np.abs(y)) + 1e-9) * amp
    pl = np.clip(0.5 - pan * 0.5, 0, 1)
    pr = np.clip(0.5 + pan * 0.5, 0, 1)
    return y * pl * 2, y * pr * 2


# ============================ 编曲时间线 ============================
print('synthesizing score ...')

# --- 1) 全片低音底座（A1/A2）---
for i, t0 in enumerate(np.arange(0, DUR, 14.0)):
    amp = 0.10 if t0 < 30 else (0.13 if t0 < 120 else 0.15)
    l, r = pad([55.0, 82.5], min(16.0, DUR - t0), amp=amp, cutoff=0.06, atk=3.0, rel=4.0, bright=0.25)
    add(l, r, t0)
    if i % 2 == 1:
        l, r = pad([110.0, 164.8], min(12.0, DUR - t0), amp=amp * 0.5, cutoff=0.05, atk=3.0, rel=3.5, bright=0.2)
        add(l, r, t0)

# --- 2) 开场钟：A4 的标准音（432/440 的"调音叉"意象）---
l, r = sine_tone(440.0, 9.0, amp=0.16, atk=0.4, rel=4.0)
add(l, r, 0.4)
for k, t0 in enumerate([1.4, 3.2, 5.0]):
    f = [440.0, 554.37, 659.25][k]
    l, r = bell(f, 7.0, amp=0.16, pan=(-0.4 + 0.4 * k), bright=0.5)
    add(l, r, t0)
l, r = bell(880.0, 6.0, amp=0.1, pan=0.5, bright=0.35)
add(l, r, 9.0)

# --- 3) 第一场：D₄ 对称（0-26s）稀疏钢琴式拨弦 ---
PENTA = [220.0, 246.94, 277.18, 329.63, 369.99, 440.0]
for k in range(46):
    t0 = 4.0 + k * 0.46
    if t0 > 26.5:
        break
    f = PENTA[(k * 3) % len(PENTA)] * (2 if k % 7 == 5 else 1)
    l, r = pluck(f, 2.4, amp=0.10, pan=math.sin(k * 1.7) * 0.6, decay=5.0)
    add(l, r, t0)
for k, t0 in enumerate([11.2, 16.4, 21.6, 25.0]):
    l, r = pluck([329.63, 392.0, 440.0, 587.33][k], 3.0, amp=0.12, pan=0.2, decay=4.0)
    add(l, r, t0)
# 场末重音
l, r = sub_boom(1.6, amp=0.5)
add(l, r, 25.6)

# --- 4) 第二场：循环 / 单位根（26-56s）水晶音阶 + 八度琶音 ---
SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]
STEP = 0.24
for k in range(int(30.0 / STEP)):
    t0 = 27.0 + k * STEP
    f = SCALE[(k * 2) % len(SCALE)] * (2 if (k // 8) % 2 else 1)
    l, r = pluck(f, 1.6, amp=0.085, pan=math.sin(k * 0.9) * 0.7, decay=9.0)
    add(l, r, t0)
for t0 in [30.0, 36.0, 42.0, 48.0, 53.0]:
    l, r = bell(523.25, 5.0, amp=0.1, pan=-0.3, bright=0.45)
    add(l, r, t0)
    l, r = bell(659.25, 5.0, amp=0.07, pan=0.4, bright=0.4)
    add(l, r, t0 + 0.26)
for k, t0 in enumerate([33.0, 39.0, 45.0, 51.0]):
    l, r = pad([146.83, 220.0, 293.66], 6.5, amp=0.10, cutoff=0.10, atk=1.6, rel=2.4, bright=0.35, pan=(-1) ** k * 0.3)
    add(l, r, t0)
l, r = sub_boom(1.6, amp=0.45)
add(l, r, 54.6)

# --- 5) 第三场：置换 / 魔方（56-90s）机械驱动 ---
for k in range(int(34.0 / 0.5)):
    t0 = 56.0 + k * 0.5
    if k % 4 == 0:
        l, r = kick(amp=0.42)
        add(l, r, t0)
    if k % 2 == 1:
        l, r = hat(amp=0.10, pan=0.35 if k % 4 == 1 else -0.35)
        add(l, r, t0 + 0.25)
BASS_PAT = [110.0, 110.0, 130.81, 110.0, 98.0, 110.0, 146.83, 130.81]
for k in range(int(33.0 / 0.5)):
    t0 = 57.0 + k * 0.5
    f = BASS_PAT[k % len(BASS_PAT)]
    l, r = pluck(f, 0.9, amp=0.14, pan=-0.15, decay=11.0)
    add(l, r, t0)
for k, t0 in enumerate([58.0, 63.0, 68.0, 73.0, 78.0, 83.0]):
    l, r = pad([220.0, 277.18, 329.63, 440.0], 5.5, amp=0.085, cutoff=0.16, atk=1.2, rel=1.8, bright=0.45, pan=(-1) ** k * 0.4)
    add(l, r, t0)
for t0 in [66.0, 74.0, 82.0, 88.0]:
    l, r = sub_boom(1.4, amp=0.42)
    add(l, r, t0)
l, r = noise_wash(6.0, amp=0.16, atk=2.0, rel=3.0, lp=0.10)
add(l, r, 84.0)
l, r = sub_boom(2.2, amp=0.6)
add(l, r, 89.4)

# --- 6) 第四场：同态 / 核（90-128s）温暖木管 + 单音持续 ---
for k, t0 in enumerate([91.0, 99.0, 107.0, 115.0, 121.0]):
    l, r = pad([196.0, 233.08, 293.66, 349.23], 8.0, amp=0.10, cutoff=0.14, atk=2.4, rel=3.0, bright=0.4, pan=(-1) ** k * 0.35)
    add(l, r, t0)
for k in range(int(36.0 / 0.75)):
    t0 = 91.5 + k * 0.75
    f = [392.0, 349.23, 293.66, 261.63, 233.08, 196.0][(k // 3) % 6]
    l, r = pluck(f, 2.2, amp=0.075, pan=math.sin(k * 0.7) * 0.5, decay=4.0)
    add(l, r, t0)
for t0 in [96.0, 104.0, 112.0, 120.0, 126.0]:
    l, r = bell(329.63, 6.0, amp=0.09, pan=0.35, bright=0.4)
    add(l, r, t0)
l, r = sine_tone(440.0, 10.0, amp=0.09, atk=1.5, rel=4.0)
add(l, r, 118.0)

# --- 7) 第五场：Burnside（128-162s）民谣拨弦 + 计数感 ---
FOLK = [329.63, 392.0, 440.0, 493.88, 587.33, 659.25]
for k in range(int(32.0 / 0.28)):
    t0 = 129.0 + k * 0.28
    f = FOLK[(k * 5) % len(FOLK)] * (0.5 if k % 11 == 0 else 1)
    l, r = pluck(f, 1.4, amp=0.075, pan=math.sin(k * 1.3) * 0.65, decay=8.0)
    add(l, r, t0)
for k, t0 in enumerate([129.0, 137.0, 145.0, 153.0, 159.0]):
    l, r = pad([164.81, 220.0, 261.63, 329.63], 7.5, amp=0.09, cutoff=0.12, atk=1.8, rel=2.6, bright=0.38, pan=(-1) ** k * 0.3)
    add(l, r, t0)
for t0 in [134.0, 142.0, 150.0, 158.0]:
    l, r = kick(amp=0.3)
    add(l, r, t0)
    l, r = sub_boom(1.2, amp=0.32)
    add(l, r, t0)
l, r = bell(880.0, 4.0, amp=0.09, pan=-0.4, bright=0.5)
add(l, r, 144.0)

# --- 8) 第六场：终章（162-210s）宏大推进 ---
# 和弦推进：Am → F → C → G → Am（两次）
CHORDS = [
    ([220.0, 261.63, 329.63], 165.0, 6.0),
    ([174.61, 220.0, 261.63], 171.0, 6.0),
    ([261.63, 329.63, 392.0], 177.0, 6.0),
    ([196.0, 246.94, 293.66], 183.0, 6.0),
    ([220.0, 261.63, 329.63, 440.0], 189.0, 8.0),
    ([174.61, 220.0, 261.63, 349.23], 197.0, 8.0),
    ([261.63, 329.63, 392.0, 523.25], 205.0, 5.0),
]
for i, (freqs, t0, dur) in enumerate(CHORDS):
    amp = 0.10 + 0.02 * i
    l, r = pad(freqs + [f / 2 for f in freqs[:2]], dur, amp=amp, cutoff=0.16, atk=1.8, rel=2.6, bright=0.42, pan=(-1) ** i * 0.25)
    add(l, r, t0)
for k, t0 in enumerate([165.0, 171.0, 177.0, 183.0, 189.0, 195.0, 201.0, 207.0]):
    l, r = sub_boom(1.6, amp=0.42)
    add(l, r, t0)
for k in range(int(45.0 / 0.5)):
    t0 = 165.0 + k * 0.5
    if k % 2 == 0 and t0 < 200:
        l, r = kick(amp=0.28)
        add(l, r, t0)
SCALE2 = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]
for k in range(int(42.0 / 0.2)):
    t0 = 166.0 + k * 0.2
    if t0 > 207:
        break
    f = SCALE2[(k * 3) % len(SCALE2)]
    amp = 0.05 + 0.05 * min(k / 100.0, 1.0)
    l, r = pluck(f, 1.2, amp=amp, pan=math.sin(k * 0.5) * 0.8, decay=10.0)
    add(l, r, t0)
for k, t0 in enumerate([170.0, 180.0, 190.0, 199.0]):
    l, r = bell(1046.5, 6.0, amp=0.08, pan=(-1) ** k * 0.5, bright=0.45)
    add(l, r, t0)
l, r = noise_wash(24.0, amp=0.14, atk=6.0, rel=8.0, lp=0.05)
add(l, r, 186.0)
# 结尾：回到 440Hz 纯音
l, r = sine_tone(440.0, 12.0, amp=0.14, atk=1.0, rel=6.0)
add(l, r, 198.0)
l, r = bell(440.0, 10.0, amp=0.16, pan=0.0, bright=0.35)
add(l, r, 200.0)
l, r = sine_tone(220.0, 14.0, amp=0.10, atk=2.0, rel=6.0)
add(l, r, 196.0)

# --- 9) 全局动态：段落包络 ---
t = np.arange(N) / SR
def seg(t0, t1, a, b):
    return np.clip((t - t0) / max(t1 - t0, 1e-6), 0, 1) * (a + (b - a) * 0.0) + 0.0
# 简易：整体淡入淡出
master = np.ones(N)
fade_in = 3.0
fade_out = 6.0
master[: int(fade_in * SR)] = np.linspace(0, 1, int(fade_in * SR))
master[-int(fade_out * SR):] = np.linspace(1, 0, int(fade_out * SR))
# 段落音量（避免中段疲劳）
dyn = np.ones(N)
for (s0, s1, v) in [(0, 26, 0.92), (26, 56, 1.0), (56, 90, 1.06), (90, 128, 0.96), (128, 162, 1.0), (162, 210, 1.08)]:
    i0, i1 = int(s0 * SR), int(s1 * SR)
    dyn[i0:i1] = v
L *= master * dyn
R *= master * dyn

# --- 10) 简易混响（多抽头延迟 + 低通），无 scipy 依赖 ---
def reverb(x, mix=0.28, decay=0.45, taps=8, delay_ms=90):
    d = int(SR * delay_ms / 1000)
    out = x.copy()
    for i in range(1, taps):
        g = decay ** i * mix
        out[i * d:] += x[: len(x) - i * d] * g
    return onepole(out, 0.35)

# 混响作用于侧信号（mid/side 处理）
mid = (L + R) * 0.5
side = (R - L) * 0.5
side = reverb(side, mix=0.5, decay=0.5)
mid_r = reverb(mid, mix=0.16, decay=0.4)
mid = mid * 0.9 + mid_r * 0.25
L2 = mid - side
R2 = mid + side

# --- 11) 限幅 + 归一化 ---
peak = max(np.max(np.abs(L2)), np.max(np.abs(R2)))
L2 = L2 / peak * 0.92
R2 = R2 / peak * 0.92
# 软限幅
L2 = np.tanh(L2 * 1.1) * 0.9
R2 = np.tanh(R2 * 1.1) * 0.9

os.makedirs('build', exist_ok=True)
stereo = np.empty(N * 2, dtype=np.int16)
stereo[0::2] = np.clip(L2 * 32767, -32768, 32767).astype(np.int16)
stereo[1::2] = np.clip(R2 * 32767, -32768, 32767).astype(np.int16)
with wave.open('build/score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())
print('score written: build/score.wav', os.path.getsize('build/score.wav') // 1024, 'KB')
