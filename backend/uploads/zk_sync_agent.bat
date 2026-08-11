@echo off
title ZKTeco MB20 Automatic VPS Sync Agent
color 0A
echo ========================================================
echo    ZKTeco MB20 Automatic VPS Sync Agent for Cash Safe
echo ========================================================
echo.

set ZK_IP=192.168.1.201

echo ZKTeco Local IP: %ZK_IP%
echo VPS Server Target: http://185.193.67.45:3008
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ZK_IP='192.168.1.201'; $VPS_URL='http://185.193.67.45:3008/api/attendance/sync-device/1'; Write-Host '====================================================' -ForegroundColor Green; Write-Host '   ZKTeco MB20 Automatic Sync Agent Started!        ' -ForegroundColor Yellow; Write-Host '   Device IP: ' $ZK_IP -ForegroundColor Cyan; Write-Host '====================================================' -ForegroundColor Green; while ($true) { try { $d = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; $body = @{ ip_address = $ZK_IP } | ConvertTo-Json; $r = Invoke-RestMethod -Uri $VPS_URL -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 5; Write-Host '[' $d '] ✅ Device IP (' $ZK_IP ') Connected & Synced: ' $r.message -ForegroundColor Green; } catch { $d = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; Write-Host '[' $d '] ⏳ Syncing ZKTeco Device (' $ZK_IP ') with VPS Cloud Server...' -ForegroundColor Yellow; } Start-Sleep -Seconds 10; }"

pause
