@ECHO OFF
TITLE ZKTeco MB20 Automatic VPS Sync Agent
COLOR 0A
ECHO ========================================================
ECHO    ZKTeco MB20 Automatic VPS Sync Agent for Cash Safe
ECHO ========================================================
ECHO.
ECHO Syncing ZKTeco MB20 Attendance with VPS Cloud Server...
ECHO.

POWERSHELL -NoProfile -ExecutionPolicy Bypass -Command "^
  Write-Host '====================================================' -ForegroundColor Green; ^
  Write-Host '   ZKTeco MB20 Automatic Sync Agent (Cash Safe)     ' -ForegroundColor Yellow; ^
  Write-Host '====================================================' -ForegroundColor Green; ^
  $VPS_URL = 'http://185.193.67.45:3008/api/attendance/sync-device/1'; ^
  while ($true) { ^
    try { ^
      $date = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; ^
      $res = Invoke-RestMethod -Uri $VPS_URL -Method Post -TimeoutSec 5; ^
      Write-Host \"[$date] ✅ Sync OK: $($res.message)\" -ForegroundColor Green; ^
    } catch { ^
      $date = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; ^
      Write-Host \"[$date] ⏳ Connecting to VPS...\" -ForegroundColor Yellow; ^
    } ^
    Start-Sleep -Seconds 10; ^
  } ^
"

PAUSE
