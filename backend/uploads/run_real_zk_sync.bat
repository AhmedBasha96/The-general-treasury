@echo off
title ZKTeco Real Socket Reader & Cloud Sync
color 0A
echo ========================================================
echo   ZKTeco Real Socket Reader & Cloud Sync for Cash Safe
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ZK_IP='192.168.1.201'; Write-Host 'Connecting to local ZKTeco Socket on 192.168.1.201:4370...' -ForegroundColor Green; while ($true) { try { $socket = New-Object System.Net.Sockets.TcpClient; $socket.Connect($ZK_IP, 4370); if ($socket.Connected) { Write-Host '[' (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') '] Connected to local ZKTeco Socket (192.168.1.201:4370)! Syncing logs...' -ForegroundColor Green; $socket.Close(); } $r = Invoke-RestMethod -Uri 'http://185.193.67.45:3008/api/attendance/sync-device/1' -Method Post -TimeoutSec 5; } catch { Write-Host '[' (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') '] Connecting to local ZKTeco MB20...' -ForegroundColor Yellow; } Start-Sleep -Seconds 10; }"

pause
