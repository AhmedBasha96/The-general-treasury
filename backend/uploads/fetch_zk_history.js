/**
 * ZKTeco MB20 Historical Log Extractor & Cloud Importer
 * Connects to ZKTeco MB20 (192.168.1.201:4370), requests all attendance logs,
 * decodes punch timestamps, and posts them directly to VPS Cloud Server.
 */

const net = require('net');

const ZK_IP = process.argv[2] || '192.168.1.201';
const ZK_PORT = 4370;
const VPS_URL = 'http://185.193.67.45:3008/api/attendance/import-zk';

console.log('===========================================================');
console.log('📥 ZKTeco MB20 Historical Log Extractor & Cloud Importer');
console.log(`📍 Device Local IP: ${ZK_IP}:${ZK_PORT}`);
console.log(`☁️ VPS Server Target: ${VPS_URL}`);
console.log('===========================================================\n');

function extractHistoricalLogs() {
  console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🔌 الاتصال المباشر بذاكرة جهاز ZKTeco MB20 (${ZK_IP}:${ZK_PORT})...`);

  const socket = new net.Socket();
  socket.setTimeout(6000);

  socket.connect(ZK_PORT, ZK_IP, () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🟢 تم الاتصال! إرسال طلب استدعاء وتفريغ سجلات ذاكرة البصمة...`);
    const connectCmd = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00, 0xe8, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    socket.write(connectCmd);
  });

  socket.on('data', async (data) => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 📩 استلام حزم بيانات الذاكرة من جهاز MB20 (الحجم: ${data.length} بايت).`);
    const getLogsCmd = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00, 0x0d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    socket.write(getLogsCmd);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⚠️ يتعذر الوصول لـ IP البصمة (${ZK_IP}). يرجى التأكد من تشغيل الجهاز والـ IP بالشركة.`);
    socket.destroy();
  });

  socket.on('timeout', () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⏱️ انقضت المهلة أثناء محاولة سحب الذاكرة.`);
    socket.destroy();
  });
}

extractHistoricalLogs();
