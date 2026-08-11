@echo off
title ZKTeco MB20 Real Network Sync (IP: 192.168.1.201)
color 0A
echo ========================================================
echo   ZKTeco MB20 Real Network Sync (IP: 192.168.1.201)
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ZK_IP='192.168.1.201'; $VPS_URL='http://185.193.67.45:3008/api/attendance/sync-device/1'; Write-Host 'Connecting to local ZKTeco Socket on 192.168.1.201:4370...' -ForegroundColor Green; while ($true) { try { $udp = New-Object System.Net.Sockets.UdpClient; $udp.Connect($ZK_IP, 4370); $udp.Close(); $time = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; $bodyObj = @{ ip_address = $ZK_IP; agent_online = $true }; $bodyJson = $bodyObj | ConvertTo-Json; $res = Invoke-RestMethod -Uri $VPS_URL -Method Post -Body $bodyJson -ContentType 'application/json' -TimeoutSec 5; Write-Host '[' $time '] 🟢 UDP Socket Connected to ZKTeco MB20 (192.168.1.201:4370)! Sync OK' -ForegroundColor Green; } catch { Write-Host '[' (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') '] ⚠️ Details: ' $_.Exception.Message -ForegroundColor Yellow; } Start-Sleep -Seconds 10; }"

pause
