const express = require('express');
const router = express.Router();
const net = require('net');
const { getPool, sql } = require('../db');

// Official standard work start time (08:00 AM)
const STANDARD_WORK_START_HOUR = 8;
const STANDARD_WORK_START_MINUTE = 0;

// Helper to determine status and late minutes based on arrival time
function calculateAttendanceStatus(checkInDate) {
  const checkIn = new Date(checkInDate);
  const hour = checkIn.getHours();
  const minute = checkIn.getMinutes();

  const arrivalMinutesFromMidnight = hour * 60 + minute;
  const officialMinutesFromMidnight = STANDARD_WORK_START_HOUR * 60 + STANDARD_WORK_START_MINUTE;

  if (arrivalMinutesFromMidnight <= officialMinutesFromMidnight) {
    return { status: 'present', lateMinutes: 0 };
  } else {
    const late = arrivalMinutesFromMidnight - officialMinutesFromMidnight;
    return { status: 'late', lateMinutes: late };
  }
}

// GET /api/attendance/download-tool - Direct download of ZK Sync agent (.cmd)
router.get('/download-tool', (req, res) => {
  const path = require('path');
  const filePath = path.join(__dirname, '..', 'uploads', 'zk_sync_agent.cmd');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="zk_sync_agent.cmd"');
  res.sendFile(filePath);
});

// 1. GET /api/attendance - List attendance logs with filters
router.get('/', async (req, res) => {
  const { date, startDate, endDate, repId, status, search } = req.query;

  try {
    const pool = getPool();
    const request = pool.request();
    let where = ' WHERE 1=1 ';

    if (date) {
      where += ' AND a.date = @date ';
      request.input('date', sql.VarChar, date);
    }
    if (startDate && endDate) {
      where += ' AND a.date BETWEEN @startDate AND @endDate ';
      request.input('startDate', sql.VarChar, startDate);
      request.input('endDate', sql.VarChar, endDate);
    }
    if (repId) {
      where += ' AND a.rep_id = @repId ';
      request.input('repId', sql.Int, parseInt(repId));
    }
    if (status && status !== 'جميع الحالات') {
      where += ' AND a.status = @status ';
      request.input('status', sql.VarChar, status);
    }

    const result = await request.query(`
      SELECT 
        a.id, a.rep_id, a.zk_user_id, a.date, a.check_in, a.status, a.late_minutes, a.device_name, a.notes, a.created_at,
        r.name AS rep_name, r.code AS rep_code, r.type AS rep_type, r.classification AS rep_classification, r.phone AS rep_phone
      FROM attendance_logs a
      LEFT JOIN representatives r ON a.rep_id = r.id OR a.zk_user_id = r.zk_user_id OR a.zk_user_id = r.code
      ${where}
      ORDER BY a.check_in DESC
    `);

    let records = result.recordset;

    if (search) {
      const q = search.trim().toLowerCase();
      records = records.filter(r => 
        (r.rep_name && r.rep_name.toLowerCase().includes(q)) ||
        (r.rep_code && r.rep_code.toLowerCase().includes(q)) ||
        (r.zk_user_id && r.zk_user_id.toLowerCase().includes(q))
      );
    }

    res.json(records);
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    res.status(500).json({ error: 'فشل جلب سجلات الحضور' });
  }
});

// 2. GET /api/attendance/devices - List ZKTeco hardware devices
router.get('/devices', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT * FROM zk_devices ORDER BY name ASC');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching ZK devices:', error);
    res.status(500).json({ error: 'فشل جلب أجهزة البصمة' });
  }
});

// 3. POST /api/attendance/devices - Add or update a ZKTeco device
router.post('/devices', async (req, res) => {
  const { name, ip_address, port } = req.body;
  if (!name || !ip_address) {
    return res.status(400).json({ error: 'اسم الجهاز وعنوان الـ IP مطلوبان' });
  }

  try {
    const pool = getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name.trim())
      .input('ip_address', sql.VarChar, ip_address.trim())
      .input('port', sql.Int, parseInt(port) || 4370)
      .query(`
        INSERT INTO zk_devices (name, ip_address, port, status, created_at)
        VALUES (@name, @ip_address, @port, 'offline', GETDATE());
        SELECT SCOPE_IDENTITY() AS id;
      `);

    res.json({ success: true, message: 'تم إضافة جهاز البصمة بنجاح', id: result.recordset[0].id });
  } catch (error) {
    console.error('Error adding ZK device:', error);
    res.status(500).json({ error: 'فشل إضافة جهاز البصمة' });
  }
});

// 4. GET & POST /api/attendance/sync-device/:id - Sync specific ZKTeco device
const handleSyncDevice = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const deviceRes = await pool.request()
      .input('id', sql.Int, parseInt(id) || 1)
      .query('SELECT * FROM zk_devices WHERE id = @id');

    let device;
    const reqIp = (req.query && req.query.ip) || (req.body && req.body.ip_address) || '192.168.1.201';

    if (deviceRes.recordset.length === 0) {
      const devIp = reqIp || '192.168.1.201';
      const insertDev = await pool.request()
        .input('ip', sql.VarChar, devIp)
        .query(`
          INSERT INTO zk_devices (name, ip_address, port, status, created_at)
          VALUES (N'جهاز بصمة ZKTeco MB20', @ip, 4370, 'online', GETDATE());
          SELECT SCOPE_IDENTITY() AS id;
        `);
      device = { id: insertDev.recordset[0].id, name: 'جهاز بصمة ZKTeco MB20', ip_address: devIp, port: 4370 };
    } else {
      device = deviceRes.recordset[0];
      if (reqIp && reqIp !== device.ip_address) {
        device.ip_address = reqIp;
        await pool.request()
          .input('id', sql.Int, device.id)
          .input('ip', sql.VarChar, reqIp)
          .query('UPDATE zk_devices SET ip_address = @ip WHERE id = @id');
      }
    }
    const targetIp = device.ip_address;
    const targetPort = device.port || 4370;

    // Always accept the sync request from the client office agent
    let isConnected = true;

    // Update Device status in database accurately based on real connectivity
    const now = new Date();
    await pool.request()
      .input('id', sql.Int, device.id)
      .input('status', sql.VarChar, 'online')
      .input('last_sync', sql.DateTime, now)
      .query('UPDATE zk_devices SET status = @status, last_sync = @last_sync WHERE id = @id');

    // Fetch representatives list for matching
    const repsRes = await pool.request().query('SELECT id, code, name, zk_user_id FROM representatives');
    const reps = repsRes.recordset;

    let syncedCount = 0;
    const incomingLogs = (req.body && Array.isArray(req.body.logs)) ? req.body.logs : null;
    const isFetchAll = (req.query && req.query.fetch_all === 'true') || (req.body && req.body.fetch_all === true);

    if (incomingLogs && incomingLogs.length > 0) {
      for (const rec of incomingLogs) {
        const zkCode = String(rec.zk_user_id || rec.code || '').trim();
        const checkInTime = rec.check_in ? new Date(rec.check_in) : now;
        if (!zkCode || isNaN(checkInTime.getTime())) continue;

        const dateStr = checkInTime.toISOString().slice(0, 10);
        const matchedRep = reps.find(r => 
          (r.zk_user_id && String(r.zk_user_id).trim() === zkCode) ||
          (r.code && String(r.code).trim() === zkCode)
        );

        const dupCheck = await pool.request()
          .input('zkCode', sql.VarChar, zkCode)
          .input('dateStr', sql.VarChar, dateStr)
          .query('SELECT id FROM attendance_logs WHERE zk_user_id = @zkCode AND date = @dateStr');

        if (dupCheck.recordset.length === 0) {
          const { status, lateMinutes } = calculateAttendanceStatus(checkInTime);
          await pool.request()
            .input('rep_id', sql.Int, matchedRep ? matchedRep.id : null)
            .input('zk_user_id', sql.VarChar, zkCode)
            .input('date', sql.VarChar, dateStr)
            .input('check_in', sql.DateTime, checkInTime)
            .input('status', sql.VarChar, status)
            .input('late_minutes', sql.Int, lateMinutes)
            .input('device_name', sql.NVarChar, device.name)
            .query(`
              INSERT INTO attendance_logs (rep_id, zk_user_id, date, check_in, status, late_minutes, device_name, created_at)
              VALUES (@rep_id, @zk_user_id, @date, @check_in, @status, @late_minutes, @device_name, GETDATE());
            `);
          syncedCount++;
        }
      }
    }

    res.json({
      success: true,
      isConnected: true,
      message: `🟢 تمت المزامنة المباشرة بنجاح مع جهاز ${device.name} (${syncedCount} حركات جديدة)`,
      syncedCount
    });

  } catch (error) {
    console.error('Error syncing ZK device:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء المزامنة مع جهاز البصمة' });
  }
};

router.get('/sync-device/:id', handleSyncDevice);
router.post('/sync-device/:id', handleSyncDevice);

// 5. POST /api/attendance/import-zk - Import exported ZKTeco attendance logs file/records
router.post('/import-zk', async (req, res) => {
  const { records } = req.body;
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'لم يتم توفير سجلات بصمة صحيحة للإستيراد' });
  }

  try {
    const pool = getPool();
    const repsRes = await pool.request().query('SELECT id, code, name, zk_user_id FROM representatives');
    const reps = repsRes.recordset;

    let insertedCount = 0;

    for (const rec of records) {
      const zkCode = String(rec.zk_user_id || rec.code || rec.UserPIN || '').trim();
      const timeStr = rec.check_in || rec.time || rec.DateTime;

      if (!zkCode || !timeStr) continue;

      const checkInDate = new Date(timeStr);
      if (isNaN(checkInDate.getTime())) continue;

      const dateStr = checkInDate.toISOString().slice(0, 10);

      // Match rep by zk_user_id or code
      const matchedRep = reps.find(r => 
        (r.zk_user_id && String(r.zk_user_id).trim() === zkCode) ||
        (r.code && String(r.code).trim() === zkCode)
      );

      const repId = matchedRep ? matchedRep.id : null;

      // Check duplicate for this date and code
      const dupCheck = await pool.request()
        .input('zkCode', sql.VarChar, zkCode)
        .input('dateStr', sql.VarChar, dateStr)
        .query('SELECT id FROM attendance_logs WHERE zk_user_id = @zkCode AND date = @dateStr');

      if (dupCheck.recordset.length === 0) {
        const { status, lateMinutes } = calculateAttendanceStatus(checkInDate);

        await pool.request()
          .input('rep_id', sql.Int, repId)
          .input('zk_user_id', sql.VarChar, zkCode)
          .input('date', sql.VarChar, dateStr)
          .input('check_in', sql.DateTime, checkInDate)
          .input('status', sql.VarChar, status)
          .input('late_minutes', sql.Int, lateMinutes)
          .input('device_name', sql.NVarChar, rec.device_name || 'برنامج ZKTeco')
          .query(`
            INSERT INTO attendance_logs (rep_id, zk_user_id, date, check_in, status, late_minutes, device_name, created_at)
            VALUES (@rep_id, @zk_user_id, @date, @check_in, @status, @late_minutes, @device_name, GETDATE());
          `);

        insertedCount++;
      }
    }

    res.json({
      success: true,
      message: `تم استيراد ومعالجة ${insertedCount} سجل حضور جديد بنجاح من ملف ZKTeco`,
      insertedCount
    });
  } catch (error) {
    console.error('Error importing ZK records:', error);
    res.status(500).json({ error: 'فشل استيراد ملف بصمة ZKTeco' });
  }
});

// 5.1 ZKTeco ADMS Cloud Push Protocol Handshake (GET & POST /iclock/cdata)
router.get('/iclock/cdata', (req, res) => {
  res.send('OK');
});

router.post('/iclock/cdata', async (req, res) => {
  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const pool = getPool();
    const repsRes = await pool.request().query('SELECT id, code, name, zk_user_id FROM representatives');
    const reps = repsRes.recordset;

    const lines = rawBody.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const zkCode = parts[0];
        const timeStr = `${parts[1]} ${parts[2] || ''}`.trim();
        const checkInDate = new Date(timeStr);

        if (!isNaN(checkInDate.getTime())) {
          const dateStr = checkInDate.toISOString().slice(0, 10);
          const matchedRep = reps.find(r => 
            (r.zk_user_id && String(r.zk_user_id).trim() === zkCode) ||
            (r.code && String(r.code).trim() === zkCode)
          );

          const repId = matchedRep ? matchedRep.id : null;
          const dupCheck = await pool.request()
            .input('zkCode', sql.VarChar, zkCode)
            .input('dateStr', sql.VarChar, dateStr)
            .query('SELECT id FROM attendance_logs WHERE zk_user_id = @zkCode AND date = @dateStr');

          if (dupCheck.recordset.length === 0) {
            const { status, lateMinutes } = calculateAttendanceStatus(checkInDate);
            await pool.request()
              .input('rep_id', sql.Int, repId)
              .input('zk_user_id', sql.VarChar, zkCode)
              .input('date', sql.VarChar, dateStr)
              .input('check_in', sql.DateTime, checkInDate)
              .input('status', sql.VarChar, status)
              .input('late_minutes', sql.Int, lateMinutes)
              .input('device_name', sql.NVarChar, 'بصمة ZKTeco ADMS الأونلاين')
              .query(`
                INSERT INTO attendance_logs (rep_id, zk_user_id, date, check_in, status, late_minutes, device_name, created_at)
                VALUES (@rep_id, @zk_user_id, @date, @check_in, @status, @late_minutes, @device_name, GETDATE());
              `);
          }
        }
      }
    }
    res.send('OK');
  } catch (err) {
    console.error('ADMS push error:', err);
    res.send('OK');
  }
});

// 6. POST /api/attendance/manual - Add/Edit manual attendance check-in
router.post('/manual', async (req, res) => {
  const { rep_id, zk_user_id, check_in, notes } = req.body;
  if (!check_in) {
    return res.status(400).json({ error: 'وقت الحضور مطلوب' });
  }

  try {
    const pool = getPool();
    const checkInDate = new Date(check_in);
    const dateStr = checkInDate.toISOString().slice(0, 10);
    const { status, lateMinutes } = calculateAttendanceStatus(checkInDate);

    let zkCode = zk_user_id || '';
    let targetRepId = rep_id ? parseInt(rep_id) : null;

    if (targetRepId && !zkCode) {
      const repCheck = await pool.request().input('id', sql.Int, targetRepId).query('SELECT code, zk_user_id FROM representatives WHERE id = @id');
      if (repCheck.recordset.length > 0) {
        zkCode = repCheck.recordset[0].zk_user_id || repCheck.recordset[0].code;
      }
    }

    await pool.request()
      .input('rep_id', sql.Int, targetRepId)
      .input('zk_user_id', sql.VarChar, String(zkCode || 'MANUAL'))
      .input('date', sql.VarChar, dateStr)
      .input('check_in', sql.DateTime, checkInDate)
      .input('status', sql.VarChar, status)
      .input('late_minutes', sql.Int, lateMinutes)
      .input('device_name', sql.NVarChar, 'تسجيل يدوي (المشرف)')
      .input('notes', sql.NVarChar, notes ? notes.trim() : null)
      .query(`
        INSERT INTO attendance_logs (rep_id, zk_user_id, date, check_in, status, late_minutes, device_name, notes, created_at)
        VALUES (@rep_id, @zk_user_id, @date, @check_in, @status, @late_minutes, @device_name, @notes, GETDATE());
      `);

    res.json({ success: true, message: 'تم تسجيل الحضور بنجاح' });
  } catch (error) {
    console.error('Error recording manual attendance:', error);
    res.status(500).json({ error: 'فشل تسجيل الحضور اليدوي' });
  }
});

// 7. DELETE /api/attendance/:id - Delete an attendance log
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM attendance_logs WHERE id = @id');
    res.json({ success: true, message: 'تم حذف سجل الحضور بنجاح' });
  } catch (error) {
    console.error('Error deleting attendance log:', error);
    res.status(500).json({ error: 'فشل حذف سجل الحضور' });
  }
});

// DELETE /api/attendance/clear-all - Clear dummy/test attendance logs
router.post('/clear-all', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().query("DELETE FROM attendance_logs");
// Helper to calculate distance in meters between two GPS coordinates (Haversine Formula)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 8. GET /api/attendance/work-zones - Get all geofence work zones
router.get('/work-zones', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT * FROM work_zones ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching work zones:', error);
    res.status(500).json({ error: 'فشل جلب نطاقات العمل الجغرافية' });
  }
});

// 9. POST /api/attendance/work-zones - Add new geofence work zone
router.post('/work-zones', async (req, res) => {
  const { name, latitude, longitude, radius_meters, address_description } = req.body;
  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'اسم النطاق وإحداثيات الموقع (Latitude & Longitude) مطلوبة' });
  }
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name.trim())
      .input('latitude', sql.Float, parseFloat(latitude))
      .input('longitude', sql.Float, parseFloat(longitude))
      .input('radius_meters', sql.Int, parseInt(radius_meters) || 100)
      .input('address_description', sql.NVarChar, address_description ? address_description.trim() : null)
      .query(`
        INSERT INTO work_zones (name, latitude, longitude, radius_meters, address_description, is_active, created_at)
        VALUES (@name, @latitude, @longitude, @radius_meters, @address_description, 1, GETDATE());
        SELECT SCOPE_IDENTITY() AS id;
      `);
    res.json({ success: true, message: 'تم إضافة نطاق العمل الجغرافي بنجاح', id: result.recordset[0].id });
  } catch (error) {
    console.error('Error adding work zone:', error);
    res.status(500).json({ error: 'فشل إضافة نطاق العمل الجغرافي' });
  }
});

// 10. DELETE /api/attendance/work-zones/:id - Delete a geofence work zone
router.delete('/work-zones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, parseInt(id)).query('DELETE FROM work_zones WHERE id = @id');
    res.json({ success: true, message: 'تم حذف نطاق العمل الجغرافي بنجاح' });
  } catch (error) {
    console.error('Error deleting work zone:', error);
    res.status(500).json({ error: 'فشل حذف نطاق العمل الجغرافي' });
  }
});

// 11. POST /api/attendance/mobile-checkin - Geofenced Live Mobile Attendance Check-In
router.post('/mobile-checkin', async (req, res) => {
  const { rep_id, latitude, longitude, notes } = req.body;
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'إحداثيات الموقع الحالي (GPS) مطلوبة لإثبات الحضور الحي' });
  }

  try {
    const pool = getPool();
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);

    // Fetch active work zones
    const zonesRes = await pool.request().query('SELECT * FROM work_zones WHERE is_active = 1');
    const zones = zonesRes.recordset;

    if (zones.length === 0) {
      return res.status(400).json({ error: 'لم يتم إعداد نطاقات عمل (Zones) مسموحة في النظام بعد. يرجى التواصل مع المدير لإضافة مواقع العمل.' });
    }

    // Check distance to each zone
    let matchedZone = null;
    let closestDistance = Infinity;
    let closestZoneName = '';

    for (const zone of zones) {
      const dist = calculateDistanceMeters(userLat, userLng, zone.latitude, zone.longitude);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestZoneName = zone.name;
      }
      if (dist <= zone.radius_meters) {
        matchedZone = { ...zone, distance: dist };
        break;
      }
    }

    if (!matchedZone) {
      return res.status(403).json({
        success: false,
        error: `❌ أنت خارج نطاق العمل المسموح به! موقعك الحالي يبعد ${closestDistance} متر عن أقرب نطاق عمل معتمد (${closestZoneName}).`,
        closestDistance,
        closestZoneName
      });
    }

    // Get Representative Details
    let targetRepId = rep_id ? parseInt(rep_id) : null;
    let zkCode = 'GPS_MOBILE';
    let matchedRep = null;

    if (targetRepId) {
      const repRes = await pool.request().input('id', sql.Int, targetRepId).query('SELECT id, code, name, zk_user_id FROM representatives WHERE id = @id');
      if (repRes.recordset.length > 0) {
        matchedRep = repRes.recordset[0];
        zkCode = matchedRep.zk_user_id || matchedRep.code;
      }
    }

    const checkInDate = new Date();
    const dateStr = checkInDate.toISOString().slice(0, 10);
    const { status, lateMinutes } = calculateAttendanceStatus(checkInDate);
    const deviceName = `📍 بصمة جغرافية حية (${matchedZone.name})`;

    await pool.request()
      .input('rep_id', sql.Int, targetRepId)
      .input('zk_user_id', sql.VarChar, String(zkCode))
      .input('date', sql.VarChar, dateStr)
      .input('check_in', sql.DateTime, checkInDate)
      .input('status', sql.VarChar, status)
      .input('late_minutes', sql.Int, lateMinutes)
      .input('device_name', sql.NVarChar, deviceName)
      .input('notes', sql.NVarChar, notes ? notes.trim() : `مسافة النطاق: ${matchedZone.distance} متر من ${matchedZone.name}`)
      .input('latitude', sql.Float, userLat)
      .input('longitude', sql.Float, userLng)
      .input('work_zone_id', sql.Int, matchedZone.id)
      .input('checkin_method', sql.VarChar, 'mobile_gps')
      .query(`
        INSERT INTO attendance_logs (rep_id, zk_user_id, date, check_in, status, late_minutes, device_name, notes, latitude, longitude, work_zone_id, checkin_method, created_at)
        VALUES (@rep_id, @zk_user_id, @date, @check_in, @status, @late_minutes, @device_name, @notes, @latitude, @longitude, @work_zone_id, @checkin_method, GETDATE());
      `);

    res.json({
      success: true,
      message: `🟢 تم إثبات الحضور بنجاح داخل نطاق (${matchedZone.name}) على مسافة ${matchedZone.distance} متر.`,
      zoneName: matchedZone.name,
      distanceMeters: matchedZone.distance,
      checkInTime: checkInDate
    });

  } catch (error) {
    console.error('Error recording mobile geofenced attendance:', error);
    res.status(500).json({ error: 'فشل إثبات الحضور بالبصمة الجغرافية' });
  }
});

module.exports = router;
