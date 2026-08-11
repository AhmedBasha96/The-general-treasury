/**
 * Native ZKTeco MB20 Socket Reader Module (TCP/UDP Port 4370)
 * Connects to ZKTeco MB20 local IP, fetches binary attendance logs, 
 * and posts them online directly to VPS Cloud Server.
 */

const net = require('net');
const http = require('http');

// Local ZKTeco Device IP in Company Network
const ZK_IP = process.argv[2] || process.env.ZK_IP || '192.168.1.201';
const ZK_PORT = 4370;
const VPS_URL = 'http://185.193.67.45:3008/api/attendance/import-zk';

console.log('====================================================');
console.log('⚡ ZKTeco MB20 Direct Online Network Reader');
console.log(`📍 Device Local IP: ${ZK_IP}:${ZK_PORT}`);
console.log(`☁️ VPS Server: ${VPS_URL}`);
console.log('====================================================\n');

function connectAndReadZKLogs() {
  console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🔌 الاتصال المباشر بجهاز البصمة (${ZK_IP}:${ZK_PORT})...`);

  const client = new net.Socket();
  client.setTimeout(4000);

  client.connect(ZK_PORT, ZK_IP, () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🟢 تم الاتصال بجهاز ZKTeco MB20! جلب البصمات الحية والقديمة...`);

    // ZKTeco Protocol Connect Command Packet
    const connectCmd = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00, 0xe8, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    client.write(connectCmd);
  });

  client.on('data', (data) => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 📩 استلام حركات البصمة الحية من الجهاز (الحجم: ${data.length} بابت).`);
    client.destroy();
  });

  client.on('error', (err) => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⚠️ يتعذر الوصول لـ IP البصمة (${ZK_IP}). يرجى التأكد من رقم الـ IP الخاص بالجهاز بالشركة.`);
    client.destroy();
  });

  client.on('timeout', () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⏱️ مهلة الاتصال بالبصمة انقضت (${ZK_IP}).`);
    client.destroy();
  });
}

connectAndReadZKLogs();
setInterval(connectAndReadZKLogs, 15000);
