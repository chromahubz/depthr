# DEPTHR launcher. Extra args pass through, e.g.  .\run.ps1 --source clip.mp4 --device cuda:1
# Python: .venv next to this file, else DEPTHR_PYTHON, else the one on PATH.
# Data (models/clips/renders/shots): DEPTHR_HOME, else ./data.
$env:PYTHONUNBUFFERED = "1"
Set-Location $PSScriptRoot
if (-not $env:DEPTHR_HOME -and (Test-Path "I:\depthr\models")) { $env:DEPTHR_HOME = "I:\depthr" }   # the author's box
if (Test-Path "I:\tmp") { $env:TEMP = "I:\tmp"; $env:TMP = "I:\tmp" }
$py = if (Test-Path ".venv\Scripts\python.exe") { ".venv\Scripts\python.exe" }
      elseif ($env:DEPTHR_PYTHON) { $env:DEPTHR_PYTHON }
      elseif (Test-Path "I:\sdr-env\venv\Scripts\python.exe") { "I:\sdr-env\venv\Scripts\python.exe" }
      else { "python" }
Start-Job { Start-Sleep 25; Start-Process "http://localhost:8790" } | Out-Null
& $py app.py @args
