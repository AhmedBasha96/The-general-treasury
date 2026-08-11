/**
 * ZKTeco MB20 Automatic Sync Agent for Cash Safe App
 * Runs on any PC connected to the office local network where ZKTeco MB20 is located.
 * Reads attendance logs from ZKTeco MB20 and pushes them directly to VPS Cloud Server.
 */

const net = require('net');

// Configuration
const ZK_DEVICE_IP = process.env.ZK_IP || '192.168.1.201'; // IP of ZKTeco MB20 in office
const ZK_DEVICE_PORT = 4370;
const VPS_SERVER_URL = process.env.VPS_URL || 'http://185.193.67.45:3008/api/attendance/import-zk';
const SYNC_INTERVAL_MS = 10 * 1000; // Sync every 10 seconds

console.log('====================================================');
console.log('🚀 ZKTeco MB20 Automatic VPS Sync Agent Started!');
console.log(`📍 Device IP: ${ZK_DEVICE_IP}:${ZK_DEVICE_PORT}`);
console.log(`☁️ VPS Server Target: ${VPS_SERVER_URL}`);
console.log('====================================================\n');

async function syncAttendance() {
  try {
    const socket = new net.Socket();
    socket.setTimeout(3000);

    const isDeviceOnline = await new Promise((resolve) => {
      socket.connect(ZK_DEVICE_PORT, ZK_DEVICE_IP, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (!isDeviceOnline) {
      console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ⚠️ جهاز البصمة (${ZK_DEVICE_IP}) غير متصل بالشبكة المحلية حالياً.`);
      return;
    }

    console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 🟢 جهاز البصمة متصل. جلب حركات الحضور وتفريغها بالسيرفر السحابي...`);

    const res = await fetch('http://185.193.67.45:3008/api/attendance/sync-device/1', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      console.log(`[${new Date().toLocaleTimeString('ar-EG')}] ✅ تمت المزامنة بالسيرفر السحابي بنجاح: ${data.message || 'تم تحديث الحضور'}`);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString('ar-EG')}] ❌ حدث خطأ أثناء المزامنة:`, err.message);
  }
}

// Initial Sync
syncAttendance();

// Periodical Background Sync
setInterval(syncAttendance, SYNC_INTERVAL_MS);
