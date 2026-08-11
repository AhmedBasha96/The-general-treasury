// backend/routes/cars.js
// Routes for managing cars (plate number + image)
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { getPool, sql } = require('../db');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'cars');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '_' + file.originalname.replace(/\s+/g, '_');
    cb(null, unique);
  }
});
const upload = multer({ storage: storage });

const fixUtf8String = (str) => {
  if (!str) return '';
  try {
    if (str.includes('%')) {
      return decodeURIComponent(str);
    }
    // If str is already valid Arabic text, keep it as is
    if (/[\u0600-\u06FF]/.test(str)) {
      return str;
    }
    const decoded = Buffer.from(str, 'latin1').toString('utf8');
    if (/[\u0600-\u06FF]/.test(decoded)) {
      return decoded;
    }
    return str;
  } catch (e) {
    return str;
  }
};

// GET /api/cars - list all cars with expense aggregations
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        c.id, 
        c.plate_number, 
        c.plate_letters, 
        c.plate_numbers, 
        c.driver_name,
        c.vehicle_type,
        c.model,
        c.image_path,
        ISNULL(c.odometer_km, 0) AS odometer_km,
        CONVERT(VARCHAR(10), c.license_expiry_date, 120) AS license_expiry_date,
        ISNULL(c.status, N'نشطة') AS status,
        ISNULL(c.fuel_type, N'سولار') AS fuel_type,
        c.notes,
        ISNULL(SUM(CASE WHEN t.type = 'withdrawal' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL) THEN t.amount ELSE 0 END), 0) AS total_expenses,
        ISNULL(SUM(CASE WHEN t.type = 'withdrawal' AND t.withdrawal_sub_type = 'car_gas' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL) THEN t.amount ELSE 0 END), 0) AS gas_total,
        ISNULL(SUM(CASE WHEN t.type = 'withdrawal' AND t.withdrawal_sub_type = 'car_oil' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL) THEN t.amount ELSE 0 END), 0) AS oil_total,
        ISNULL(SUM(CASE WHEN t.type = 'withdrawal' AND (t.withdrawal_sub_type NOT IN ('car_gas', 'car_oil') OR t.withdrawal_sub_type IS NULL) AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL) THEN t.amount ELSE 0 END), 0) AS other_total,
        COUNT(CASE WHEN t.type = 'withdrawal' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL) THEN t.id ELSE NULL END) AS transaction_count
      FROM cars c
      LEFT JOIN transactions t ON t.car_id = c.id
      GROUP BY c.id, c.plate_number, c.plate_letters, c.plate_numbers, c.driver_name, c.vehicle_type, c.model, c.image_path, c.odometer_km, c.license_expiry_date, c.status, c.fuel_type, c.notes
      ORDER BY c.id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'فشل جلب بيانات السيارات' });
  }
});

// POST /api/cars - add a new car
router.post('/', upload.single('image'), async (req, res) => {
  let plate_letters = fixUtf8String(req.body?.plate_letters).trim();
  let plate_numbers = fixUtf8String(req.body?.plate_numbers).trim();
  let plate_number = fixUtf8String(req.body?.plate_number).trim();
  let driver_name = fixUtf8String(req.body?.driver_name).trim();
  let vehicle_type = fixUtf8String(req.body?.vehicle_type).trim();
  let model = fixUtf8String(req.body?.model).trim();
  let odometer_km = req.body?.odometer_km !== undefined && req.body?.odometer_km !== '' ? parseInt(req.body.odometer_km, 10) : 0;
  let license_expiry_date = req.body?.license_expiry_date ? req.body.license_expiry_date.trim() : null;
  let status = fixUtf8String(req.body?.status).trim() || 'نشطة';
  let fuel_type = fixUtf8String(req.body?.fuel_type).trim() || 'سولار';
  let notes = fixUtf8String(req.body?.notes).trim();

  if (!plate_number && (plate_letters || plate_numbers)) {
    plate_number = [plate_letters, plate_numbers].filter(Boolean).join(' ');
  }

  if (!plate_number) {
    return res.status(400).json({ error: 'رقم اللوحة مطلوب' });
  }

  const imagePath = req.file ? `uploads/cars/${req.file.filename}` : null;
  try {
    const pool = getPool();
    // Check duplicate plate
    const dup = await pool.request()
      .input('plate', sql.NVarChar(255), plate_number)
      .query('SELECT id FROM cars WHERE plate_number = @plate');
    if (dup.recordset.length > 0) {
      return res.status(400).json({ error: 'رقم اللوحة مسجل مسبقاً' });
    }
    await pool.request()
      .input('plate', sql.NVarChar(255), plate_number)
      .input('letters', sql.NVarChar(50), plate_letters || null)
      .input('numbers', sql.NVarChar(50), plate_numbers || null)
      .input('driver', sql.NVarChar(255), driver_name || null)
      .input('vtype', sql.NVarChar(100), vehicle_type || 'نقل')
      .input('model', sql.NVarChar(100), model || 'سوزوكي')
      .input('img', sql.NVarChar(sql.MAX), imagePath)
      .input('odo', sql.Int, isNaN(odometer_km) ? 0 : odometer_km)
      .input('expiry', sql.Date, license_expiry_date || null)
      .input('status', sql.NVarChar(50), status)
      .input('ftype', sql.NVarChar(50), fuel_type)
      .input('notes', sql.NVarChar(sql.MAX), notes || null)
      .query(`INSERT INTO cars (plate_number, plate_letters, plate_numbers, driver_name, vehicle_type, model, image_path, odometer_km, license_expiry_date, status, fuel_type, notes) VALUES (@plate, @letters, @numbers, @driver, @vtype, @model, @img, @odo, @expiry, @status, @ftype, @notes)`);
    res.status(201).json({ message: 'تم إضافة السيارة بنجاح' });
  } catch (error) {
    console.error('Error adding car:', error);
    res.status(500).json({ error: 'فشل إضافة السيارة' });
  }
});

// GET /api/cars/:id/transactions - get ledger for a specific car
router.get('/:id/transactions', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('car_id', sql.Int, id)
      .query(`
        SELECT 
          t.id, t.type, t.payment_method, t.amount, t.date, t.notes, t.withdrawal_sub_type, t.status,
          u.username as creator_name,
          r.name as rep_name, r.code as rep_code,
          a.name as agency_name, a.code as agency_code,
          s.name as supervisor_name, s.code as supervisor_code,
          c.plate_number, c.plate_letters, c.plate_numbers, c.driver_name, c.vehicle_type, c.model
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN representatives r ON t.rep_id = r.id
        LEFT JOIN agencies a ON (r.agency_id = a.id OR t.agency_id = a.id)
        LEFT JOIN supervisors s ON r.supervisor_id = s.id
        LEFT JOIN cars c ON t.car_id = c.id
        WHERE t.car_id = @car_id AND (t.type = 'withdrawal')
        ORDER BY t.date DESC
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching car transactions:', error);
    res.status(500).json({ error: 'فشل جلب مصاريف السيارة' });
  }
});

// PUT /api/cars/:id - update a car (multipart/form-data)
router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let plate_letters = fixUtf8String(req.body?.plate_letters).trim();
  let plate_numbers = fixUtf8String(req.body?.plate_numbers).trim();
  let plate_number = fixUtf8String(req.body?.plate_number).trim();
  let driver_name = fixUtf8String(req.body?.driver_name).trim();
  let vehicle_type = fixUtf8String(req.body?.vehicle_type).trim();
  let model = fixUtf8String(req.body?.model).trim();
  let odometer_km = req.body?.odometer_km !== undefined && req.body?.odometer_km !== '' ? parseInt(req.body.odometer_km, 10) : 0;
  let license_expiry_date = req.body?.license_expiry_date ? req.body.license_expiry_date.trim() : null;
  let status = fixUtf8String(req.body?.status).trim() || 'نشطة';
  let fuel_type = fixUtf8String(req.body?.fuel_type).trim() || 'سولار';
  let notes = fixUtf8String(req.body?.notes).trim();

  if (!plate_number && (plate_letters || plate_numbers)) {
    plate_number = [plate_letters, plate_numbers].filter(Boolean).join(' ');
  }

  if (!plate_number) {
    return res.status(400).json({ error: 'رقم اللوحة مطلوب' });
  }

  const imagePath = req.file ? `uploads/cars/${req.file.filename}` : null;
  
  try {
    const pool = getPool();
    // Check duplicate plate for other cars
    const dup = await pool.request()
      .input('plate', sql.NVarChar(255), plate_number)
      .input('id', sql.Int, id)
      .query('SELECT id FROM cars WHERE plate_number = @plate AND id != @id');
    if (dup.recordset.length > 0) {
      return res.status(400).json({ error: 'رقم اللوحة مسجل لسيارة أخرى' });
    }

    if (imagePath) {
      await pool.request()
        .input('id', sql.Int, id)
        .input('plate', sql.NVarChar(255), plate_number)
        .input('letters', sql.NVarChar(50), plate_letters || null)
        .input('numbers', sql.NVarChar(50), plate_numbers || null)
        .input('driver', sql.NVarChar(255), driver_name || null)
        .input('vtype', sql.NVarChar(100), vehicle_type || 'نقل')
        .input('model', sql.NVarChar(100), model || 'سوزوكي')
        .input('img', sql.NVarChar(sql.MAX), imagePath)
        .input('odo', sql.Int, isNaN(odometer_km) ? 0 : odometer_km)
        .input('expiry', sql.Date, license_expiry_date || null)
        .input('status', sql.NVarChar(50), status)
        .input('ftype', sql.NVarChar(50), fuel_type)
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .query(`UPDATE cars SET plate_number = @plate, plate_letters = @letters, plate_numbers = @numbers, driver_name = @driver, vehicle_type = @vtype, model = @model, image_path = @img, odometer_km = @odo, license_expiry_date = @expiry, status = @status, fuel_type = @ftype, notes = @notes WHERE id = @id`);
    } else {
      await pool.request()
        .input('id', sql.Int, id)
        .input('plate', sql.NVarChar(255), plate_number)
        .input('letters', sql.NVarChar(50), plate_letters || null)
        .input('numbers', sql.NVarChar(50), plate_numbers || null)
        .input('driver', sql.NVarChar(255), driver_name || null)
        .input('vtype', sql.NVarChar(100), vehicle_type || 'نقل')
        .input('model', sql.NVarChar(100), model || 'سوزوكي')
        .input('odo', sql.Int, isNaN(odometer_km) ? 0 : odometer_km)
        .input('expiry', sql.Date, license_expiry_date || null)
        .input('status', sql.NVarChar(50), status)
        .input('ftype', sql.NVarChar(50), fuel_type)
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .query(`UPDATE cars SET plate_number = @plate, plate_letters = @letters, plate_numbers = @numbers, driver_name = @driver, vehicle_type = @vtype, model = @model, odometer_km = @odo, license_expiry_date = @expiry, status = @status, fuel_type = @ftype, notes = @notes WHERE id = @id`);
    }
    res.json({ message: 'تم تحديث بيانات السيارة بنجاح' });
  } catch (error) {
    console.error('Error updating car:', error);
    res.status(500).json({ error: 'فشل تحديث بيانات السيارة' });
  }
});

// DELETE /api/cars/:id - delete a car
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM cars WHERE id = @id`);
    res.json({ message: 'تم حذف السيارة بنجاح' });
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ error: 'فشل حذف السيارة' });
  }
});

module.exports = router;
