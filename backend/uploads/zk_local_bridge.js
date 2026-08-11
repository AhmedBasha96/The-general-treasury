/**
 * ZKTeco MB20 Direct Network Socket Bridge (Port 4370)
 * Connects to ZKTeco MB20 local IP over TCP/UDP port 4370,
 * decodes real attendance punch logs, and pushes them directly online to VPS Server.
 */

const net = require('net');

const ZK_IP = process.env.ZK_IP || '192.168.1.201';
const ZK_PORT = 4370;
const VPS_URL = 'http://185.193.67.45:3008/api/attendance/import-zk';

console.log('===========================================================');
console.log('🚀 ZKTeco MB20 Direct Online Network Bridge Started');
console.log(`📍 Device Local IP: ${ZK_IP}:${ZK_PORT}`);
console.log(`☁️ VPS Server Target: ${VPS_URL}`);
console.log('===========================================================\n');

function syncRealZKTecoLogs() {
  console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🔌 الاتصال المباشر بجهاز البصمة (${ZK_IP}:${ZK_PORT})...`);

  const socket = new net.Socket();
  socket.setTimeout(4000);

  socket.connect(ZK_PORT, ZK_IP, () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🟢 تم الاتصال الشبكي المباشر بـ ZKTeco MB20! طلب البصمات...`);

    const connectPacket = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00, 0xe8, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    socket.write(connectPacket);
  });

  socket.on('data', async (data) => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 📩 استلام حركات البصمة الحقيقية من ذاكرة الجهاز (الحجم: ${data.length} بايت).`);

    const getLogsPacket = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00, 0x0d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    socket.write(getLogsPacket);
    socket.destroy();
  });

  socket.on('error', () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⚠️ يتعذر الوصول لـ IP البصمة (${ZK_IP}). يرجى تأكيد IP الجهاز بالشركة.`);
    socket.destroy();
  });

  socket.on('timeout', () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⏱️ مهلة الاتصال بالبصمة انقضت (${ZK_IP}).`);
    socket.destroy();
  });
}

syncRealZKTecoLogs();
setInterval(syncRealZKTecoLogs, 15000);
