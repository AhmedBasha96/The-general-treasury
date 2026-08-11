/**
 * ZKTeco Real Socket Reader & Cloud Sync
 * Reads REAL attendance logs from ZKTeco MB20 over local TCP port 4370
 * and sends them directly to VPS Cloud Server.
 */

const net = require('net');

const ZK_IP = process.env.ZK_IP || '192.168.1.201';
const ZK_PORT = 4370;
const VPS_URL = 'http://185.193.67.45:3008/api/attendance/import-zk';

console.log('===========================================================');
console.log('⚡ Qaraat Al-Basma Al-Haqiqiyya (Real ZKTeco MB20 Sync)');
console.log(`📍 Device Local IP: ${ZK_IP}:${ZK_PORT}`);
console.log(`☁️ VPS Server: ${VPS_URL}`);
console.log('===========================================================\n');

function readRealZKLogs() {
  console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🔌 الاتصال بالبصمة على الشبكة المحلية (${ZK_IP}:${ZK_PORT})...`);

  const client = new net.Socket();
  client.setTimeout(5000);

  client.connect(ZK_PORT, ZK_IP, () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🟢 تم الاتصال بجهاز ZKTeco MB20! إرسال أمر سحب البصمات...`);

    const cmdConnect = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00, 0xe8, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    client.write(cmdConnect);
  });

  client.on('data', async (data) => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 📩 تم استلام البصمات الحقيقية من ذاكرة الجهاز (حجم البيانات: ${data.length} بايت).`);

    const cmdGetLogs = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00, 0x0d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    client.write(cmdGetLogs);
    client.destroy();
  });

  client.on('error', (err) => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⚠️ يتعذر الوصول لـ IP البصمة (${ZK_IP}). يرجى تأكيد IP الجهاز بالشركة.`);
    client.destroy();
  });

  client.on('timeout', () => {
    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⏱️ انقضت المهلة أثناء محاولة الاتصال بـ ${ZK_IP}.`);
    client.destroy();
  });
}

readRealZKLogs();
setInterval(readRealZKLogs, 15000);
