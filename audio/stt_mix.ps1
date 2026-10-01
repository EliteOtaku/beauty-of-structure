Add-Type -AssemblyName System.Speech
foreach ($f in @('mix_n1','mix_n7','mix_n8')) {
  $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $r.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $r.SetInputToWaveFile("D:\AI\AA\abstract-algebra-film\build\$f.wav")
  $txt = ""
  try { while ($true) { $res = $r.Recognize(); if ($null -eq $res) { break }; $txt += $res.Text + " " } } catch {}
  $r.Dispose()
  "$f -> $txt"
}
