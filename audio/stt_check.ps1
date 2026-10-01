Add-Type -AssemblyName System.Speech
$r = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$r.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$r.SetInputToWaveFile("D:\AI\AA\abstract-algebra-film\build\voice.wav")
$txt = ""
try { while ($true) { $res = $r.Recognize(); if ($null -eq $res) { break }; $txt += $res.Text + " " } } catch {}
$r.Dispose()
"识别结果: $txt"
