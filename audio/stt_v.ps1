Add-Type -AssemblyName System.Speech
foreach ($f in @('v7','v8')) {
  $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $r.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $r.SetInputToWaveFile("D:\AI\AA\abstract-algebra-film\build\$f.wav")
  $txt = ""
  try { while ($true) { $res = $r.Recognize(); if ($null -eq $res) { break }; $txt += $res.Text + " " } } catch {}
  $r.Dispose()
  "$f -> $txt"
}
