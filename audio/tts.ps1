# tts.ps1 — 用 Windows SAPI 生成中文旁白，导出 16bit/48kHz 单声道 WAV
# 语速略慢（Rate=-1），并统一做轻压缩与去齿音由 ffmpeg 在混音阶段处理。

param(
  [string]$Voice = "Microsoft Huihui Desktop",
  [string]$OutDir = "build/narration",
  [int]$Rate = -1
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

# 台词表：文件名, 文本, 出现时间（秒）
$lines = @(
  @{ id = 'n1'; text = '对称，是结构最初的样子。';             at = 3.0 },
  @{ id = 'n2'; text = '同一个动作反复施加，就长成了一个群。'; at = 10.0 },
  @{ id = 'n3'; text = '置换，是重新编号的艺术。';             at = 39.0 },
  @{ id = 'n4'; text = '魔方的每一次转动，都是一次置换。';     at = 78.0 },
  @{ id = 'n5'; text = '同态，是一面保住结构的透镜。';         at = 117.0 },
  @{ id = 'n6'; text = '而核，藏着这面透镜的全部秘密。';       at = 126.0 },
  @{ id = 'n7'; text = '对称的东西，可以被数清楚。';           at = 156.0 },
  @{ id = 'n8'; text = '这是结构。它一直都在。';               at = 180.0 }
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
$synth.Volume = 100

$rows = @()
foreach ($l in $lines) {
  $path = Join-Path $OutDir "$($l.id).wav"
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $synth.SetOutputToWaveFile($path, $fmt)
  $synth.Speak($l.text)
  $synth.SetOutputToNull()
  $rows += [pscustomobject]@{ id = $l.id; at = $l.at; text = $l.text; file = $path }
}
$synth.Dispose()

# 用 ffprobe 量出每句时长，写到 manifest.json 供混音脚本使用
$manifest = @()
foreach ($r in $rows) {
  $dur = & D:\ffmpeg\bin\ffprobe.exe -v error -show_entries format=duration -of csv=p=0 $r.file
  $manifest += [pscustomobject]@{ id = $r.id; start = $r.at; dur = [double]$dur; text = $r.text; file = (Resolve-Path $r.file).Path }
  "{0}  start={1,6:N1}s  dur={2,5:N2}s  {3}" -f $r.id, $r.at, [double]$dur, $r.text
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $OutDir 'manifest.json') -Encoding UTF8
"manifest: $OutDir/manifest.json"
