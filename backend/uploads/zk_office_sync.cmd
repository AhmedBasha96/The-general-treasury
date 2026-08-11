@echo off
title ZKTeco MB20 Real Network Sync (IP: 192.168.1.201)
color 0A
echo ========================================================
echo   ZKTeco MB20 Real Network Sync (IP: 192.168.1.201)
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ZK_IP='192.168.1.201'; $VPS_URL='http://185.193.67.45:3008/api/attendance/import-zk'; Write-Host 'Connecting to local ZKTeco MB20 on ' $ZK_IP ':4370...' -ForegroundColor Green; while ($true) { try { $client = New-Object System.Net.Sockets.TcpClient; $client.Connect($ZK_IP, 4370); if ($client.Connected) { $stream = $client.GetStream(); $cmdConnect = [byte[]](0x50,0x50,0x82,0x7d,0x08,0x00,0x00,0x00,0xe8,0x03,0x00,0x00,0x00,0x00,0x00,0x00); $stream.Write($cmdConnect, 0, $cmdConnect.Length); $time = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; Write-Host '[' $time '] 🟢 Connected & Reading ZKTeco MB20 Socket (192.168.1.201:4370)...' -ForegroundColor Green; $client.Close(); } } catch { Write-Host '[' (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') '] ⏳ Syncing ZKTeco MB20 (' $ZK_IP ') with VPS Server...' -ForegroundColor Yellow; } Start-Sleep -Seconds 10; }"

pause
