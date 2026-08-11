@echo off
title ZKTeco MB20 Automatic VPS Sync Agent
color 0A
echo ========================================================
echo    ZKTeco MB20 Automatic VPS Sync Agent for Cash Safe
echo ========================================================
echo.
echo Syncing ZKTeco MB20 Attendance with VPS Cloud Server...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$VPS_URL='http://185.193.67.45:3008/api/attendance/sync-device/1'; Write-Host '====================================================' -ForegroundColor Green; Write-Host '   ZKTeco MB20 Automatic VPS Sync Agent Started!    ' -ForegroundColor Yellow; Write-Host '====================================================' -ForegroundColor Green; while ($true) { try { $date = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; $res = Invoke-RestMethod -Uri $VPS_URL -Method Post -TimeoutSec 5; Write-Host \"[$date] ✅ Connection & Sync OK: $($res.message)\" -ForegroundColor Green; } catch { $date = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; Write-Host \"[$date] ⏳ Connecting to VPS...\" -ForegroundColor Yellow; } Start-Sleep -Seconds 10; }"

pause
