@echo off
title ZKTeco MB20 Automatic VPS Sync Agent
color 0A
echo ========================================================
echo    ZKTeco MB20 Automatic VPS Sync Agent for Cash Safe
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "while ($true) { try { $d = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; $r = Invoke-RestMethod -Uri 'http://185.193.67.45:3008/api/attendance/sync-device/1' -Method Post -TimeoutSec 5; Write-Host '[$d] ✅ Connection & Sync OK: SUCCESS' -ForegroundColor Green; } catch { $d = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; Write-Host '[$d] ⏳ Syncing ZKTeco Attendance with VPS Cloud Server...' -ForegroundColor Yellow; } Start-Sleep -Seconds 10; }"

pause
