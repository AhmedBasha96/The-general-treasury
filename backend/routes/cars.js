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

// GET /api/cars - list all cars with expense aggregations and driver assignment
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
        c.driver_rep_id,
        r.name AS rep_driver_name,
        r.code AS rep_driver_code,
        c.vehicle_type,
        c.model,
        c.image_path,
        ISNULL(c.odometer_km, 0) AS odometer_km,
        ISNULL(c.last_odometer, ISNULL(c.odometer_km, 0)) AS last_odometer,
        ISNULL(c.last_oil_change_km, 0) AS last_oil_change_km,
        ISNULL(c.oil_change_interval_km, 10000) AS oil_change_interval_km,
        ISNULL(c.next_oil_change_km, ISNULL(c.last_oil_change_km, 0) + ISNULL(c.oil_change_interval_km, 10000)) AS next_oil_change_km,
        CONVERT(VARCHAR(10), c.last_oil_change_date, 120) AS last_oil_change_date,
        (ISNULL(c.next_oil_change_km, ISNULL(c.last_oil_change_km, 0) + ISNULL(c.oil_change_interval_km, 10000)) - ISNULL(c.last_odometer, ISNULL(c.odometer_km, 0))) AS remaining_oil_km,
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
      LEFT JOIN representatives r ON c.driver_rep_id = r.id
      LEFT JOIN transactions t ON t.car_id = c.id
      GROUP BY c.id, c.plate_number, c.plate_letters, c.plate_numbers, c.driver_name, c.driver_rep_id, r.name, r.code, c.vehicle_type, c.model, c.image_path, c.odometer_km, c.last_odometer, c.last_oil_change_km, c.oil_change_interval_km, c.next_oil_change_km, c.last_oil_change_date, c.license_expiry_date, c.status, c.fuel_type, c.notes
      ORDER BY c.id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'فشل جلب بيانات السيارات' });
  }
});

// GET /api/cars/fuel-prices - get official fuel prices
router.get('/fuel-prices', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`SELECT key_name, val FROM settings WHERE key_name LIKE 'fuel_price_%'`);
    const prices = {
      diesel: 20.50,
      gasoline80: 20.75,
      gasoline92: 22.25,
      gasoline95: 24.00,
      cng: 13.00
    };
    result.recordset.forEach(row => {
      if (row.key_name === 'fuel_price_diesel') prices.diesel = parseFloat(row.val);
      if (row.key_name === 'fuel_price_gasoline80') prices.gasoline80 = parseFloat(row.val);
      if (row.key_name === 'fuel_price_gasoline92') prices.gasoline92 = parseFloat(row.val);
      if (row.key_name === 'fuel_price_gasoline95') prices.gasoline95 = parseFloat(row.val);
      if (row.key_name === 'fuel_price_cng') prices.cng = parseFloat(row.val);
    });
    res.json(prices);
  } catch (error) {
    console.error('Error fetching fuel prices:', error);
    res.status(500).json({ error: 'فشل جلب أسعار الوقود' });
  }
});

// POST /api/cars - add a new car
router.post('/', upload.single('image'), async (req, res) => {
  let plate_letters = fixUtf8String(req.body?.plate_letters).trim();
  let plate_numbers = fixUtf8String(req.body?.plate_numbers).trim();
  let plate_number = fixUtf8String(req.body?.plate_number).trim();
  let driver_name = fixUtf8String(req.body?.driver_name).trim();
  let driver_rep_id = req.body?.driver_rep_id ? parseInt(req.body.driver_rep_id, 10) : null;
  let vehicle_type = fixUtf8String(req.body?.vehicle_type).trim();
  let model = fixUtf8String(req.body?.model).trim();
  let odometer_km = req.body?.odometer_km !== undefined && req.body?.odometer_km !== '' ? parseInt(req.body.odometer_km, 10) : 0;
  let license_expiry_date = req.body?.license_expiry_date ? req.body.license_expiry_date.trim() : null;
  let status = fixUtf8String(req.body?.status).trim() || 'نشطة';
  let fuel_type = fixUtf8String(req.body?.fuel_type).trim() || 'سولار';
  let notes = fixUtf8String(req.body?.notes).trim();
  let oil_change_interval_km = req.body?.oil_change_interval_km ? parseInt(req.body.oil_change_interval_km, 10) : 10000;

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
    const odoVal = isNaN(odometer_km) ? 0 : odometer_km;
    await pool.request()
      .input('plate', sql.NVarChar(255), plate_number)
      .input('letters', sql.NVarChar(50), plate_letters || null)
      .input('numbers', sql.NVarChar(50), plate_numbers || null)
      .input('driver', sql.NVarChar(255), driver_name || null)
      .input('driver_rep', sql.Int, isNaN(driver_rep_id) ? null : driver_rep_id)
      .input('vtype', sql.NVarChar(100), vehicle_type || 'نقل')
      .input('model', sql.NVarChar(100), model || 'سوزوكي')
      .input('img', sql.NVarChar(sql.MAX), imagePath)
      .input('odo', sql.Int, odoVal)
      .input('expiry', sql.Date, license_expiry_date || null)
      .input('status', sql.NVarChar(50), status)
      .input('ftype', sql.NVarChar(50), fuel_type)
      .input('notes', sql.NVarChar(sql.MAX), notes || null)
      .input('oil_interval', sql.Int, oil_change_interval_km)
      .input('next_oil', sql.Int, odoVal + oil_change_interval_km)
      .query(`
        INSERT INTO cars 
        (plate_number, plate_letters, plate_numbers, driver_name, driver_rep_id, vehicle_type, model, image_path, odometer_km, last_odometer, license_expiry_date, status, fuel_type, notes, oil_change_interval_km, next_oil_change_km) 
        VALUES 
        (@plate, @letters, @numbers, @driver, @driver_rep, @vtype, @model, @img, @odo, @odo, @expiry, @status, @ftype, @notes, @oil_interval, @next_oil)
      `);
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

// GET /api/cars/:id/fuel-logs - get fuel refueling logs for a car
router.get('/:id/fuel-logs', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('car_id', sql.Int, id)
      .query(`
        SELECT fl.*, r.name AS driver_name, r.code AS driver_code
        FROM car_fuel_logs fl
        LEFT JOIN representatives r ON fl.driver_rep_id = r.id
        WHERE fl.car_id = @car_id
        ORDER BY fl.date DESC
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching car fuel logs:', error);
    res.status(500).json({ error: 'فشل جلب سجل المحروقات' });
  }
});

// GET /api/cars/:id/maintenance-logs - get maintenance logs for a car
router.get('/:id/maintenance-logs', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('car_id', sql.Int, id)
      .query(`
        SELECT ml.*, r.name AS driver_name, r.code AS driver_code
        FROM car_maintenance_logs ml
        LEFT JOIN representatives r ON ml.driver_rep_id = r.id
        WHERE ml.car_id = @car_id
        ORDER BY ml.date DESC
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching car maintenance logs:', error);
    res.status(500).json({ error: 'فشل جلب سجل الصيانة والزيوت' });
  }
});

// PUT /api/cars/:id - update a car (multipart/form-data)
router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let plate_letters = fixUtf8String(req.body?.plate_letters).trim();
  let plate_numbers = fixUtf8String(req.body?.plate_numbers).trim();
  let plate_number = fixUtf8String(req.body?.plate_number).trim();
  let driver_name = fixUtf8String(req.body?.driver_name).trim();
  let driver_rep_id = req.body?.driver_rep_id ? parseInt(req.body.driver_rep_id, 10) : null;
  let vehicle_type = fixUtf8String(req.body?.vehicle_type).trim();
  let model = fixUtf8String(req.body?.model).trim();
  let odometer_km = req.body?.odometer_km !== undefined && req.body?.odometer_km !== '' ? parseInt(req.body.odometer_km, 10) : 0;
  let license_expiry_date = req.body?.license_expiry_date ? req.body.license_expiry_date.trim() : null;
  let status = fixUtf8String(req.body?.status).trim() || 'نشطة';
  let fuel_type = fixUtf8String(req.body?.fuel_type).trim() || 'سولار';
  let notes = fixUtf8String(req.body?.notes).trim();
  let oil_change_interval_km = req.body?.oil_change_interval_km ? parseInt(req.body.oil_change_interval_km, 10) : 10000;

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

    const odoVal = isNaN(odometer_km) ? 0 : odometer_km;

    if (imagePath) {
      await pool.request()
        .input('id', sql.Int, id)
        .input('plate', sql.NVarChar(255), plate_number)
        .input('letters', sql.NVarChar(50), plate_letters || null)
        .input('numbers', sql.NVarChar(50), plate_numbers || null)
        .input('driver', sql.NVarChar(255), driver_name || null)
        .input('driver_rep', sql.Int, isNaN(driver_rep_id) ? null : driver_rep_id)
        .input('vtype', sql.NVarChar(100), vehicle_type || 'نقل')
        .input('model', sql.NVarChar(100), model || 'سوزوكي')
        .input('img', sql.NVarChar(sql.MAX), imagePath)
        .input('odo', sql.Int, odoVal)
        .input('expiry', sql.Date, license_expiry_date || null)
        .input('status', sql.NVarChar(50), status)
        .input('ftype', sql.NVarChar(50), fuel_type)
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .input('oil_interval', sql.Int, oil_change_interval_km)
        .query(`
          UPDATE cars 
          SET plate_number = @plate, plate_letters = @letters, plate_numbers = @numbers, 
              driver_name = @driver, driver_rep_id = @driver_rep, vehicle_type = @vtype, 
              model = @model, image_path = @img, odometer_km = @odo, 
              last_odometer = CASE WHEN @odo > ISNULL(last_odometer, 0) THEN @odo ELSE last_odometer END,
              license_expiry_date = @expiry, status = @status, fuel_type = @ftype, notes = @notes,
              oil_change_interval_km = @oil_interval,
              next_oil_change_km = ISNULL(last_oil_change_km, 0) + @oil_interval
          WHERE id = @id
        `);
    } else {
      await pool.request()
        .input('id', sql.Int, id)
        .input('plate', sql.NVarChar(255), plate_number)
        .input('letters', sql.NVarChar(50), plate_letters || null)
        .input('numbers', sql.NVarChar(50), plate_numbers || null)
        .input('driver', sql.NVarChar(255), driver_name || null)
        .input('driver_rep', sql.Int, isNaN(driver_rep_id) ? null : driver_rep_id)
        .input('vtype', sql.NVarChar(100), vehicle_type || 'نقل')
        .input('model', sql.NVarChar(100), model || 'سوزوكي')
        .input('odo', sql.Int, odoVal)
        .input('expiry', sql.Date, license_expiry_date || null)
        .input('status', sql.NVarChar(50), status)
        .input('ftype', sql.NVarChar(50), fuel_type)
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .input('oil_interval', sql.Int, oil_change_interval_km)
        .query(`
          UPDATE cars 
          SET plate_number = @plate, plate_letters = @letters, plate_numbers = @numbers, 
              driver_name = @driver, driver_rep_id = @driver_rep, vehicle_type = @vtype, 
              model = @model, odometer_km = @odo, 
              last_odometer = CASE WHEN @odo > ISNULL(last_odometer, 0) THEN @odo ELSE last_odometer END,
              license_expiry_date = @expiry, status = @status, fuel_type = @ftype, notes = @notes,
              oil_change_interval_km = @oil_interval,
              next_oil_change_km = ISNULL(last_oil_change_km, 0) + @oil_interval
          WHERE id = @id
        `);
    }
    res.json({ message: 'تم تحديث بيانات السيارة بنجاح' });
  } catch (error) {
    console.error('Error updating car:', error);
    res.status(500).json({ error: 'فشل تحديث بيانات السيارة' });
  }
});

// GET /api/driver/my-car/:repId - Driver Portal endpoint to fetch assigned car
router.get('/driver/my-car/:repId', async (req, res) => {
  const { repId } = req.params;
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('repId', sql.Int, repId)
      .query(`
        SELECT TOP 1
          c.id, c.plate_number, c.plate_letters, c.plate_numbers, c.driver_name, c.driver_rep_id,
          c.vehicle_type, c.model, c.image_path, ISNULL(c.odometer_km, 0) AS odometer_km,
          CONVERT(VARCHAR(10), c.license_expiry_date, 120) AS license_expiry_date,
          ISNULL(c.status, N'نشطة') AS status, ISNULL(c.fuel_type, N'سولار') AS fuel_type, c.notes
        FROM cars c
        WHERE c.driver_rep_id = @repId OR c.driver_name LIKE '%' + (SELECT name FROM representatives WHERE id = @repId) + '%'
        ORDER BY c.id DESC
      `);
      
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'لم يتم العثور على سيارة مسندة إليك حالياً' });
    }
    
    const car = result.recordset[0];
    
    // Also fetch last oil change and recent fuel logs
    const fuelLogs = await pool.request()
      .input('car_id', sql.Int, car.id)
      .query(`SELECT TOP 5 * FROM car_fuel_logs WHERE car_id = @car_id ORDER BY date DESC`);
      
    const maintLogs = await pool.request()
      .input('car_id', sql.Int, car.id)
      .query(`SELECT TOP 5 * FROM car_maintenance_logs WHERE car_id = @car_id ORDER BY date DESC`);
      
    res.json({
      car,
      recentFuelLogs: fuelLogs.recordset,
      recentMaintenanceLogs: maintLogs.recordset
    });
  } catch (error) {
    console.error('Error fetching driver car:', error);
    res.status(500).json({ error: 'فشل جلب بيانات سيارة السائق' });
  }
});

// POST /api/driver/refuel - Driver Portal refuel entry (with photo upload)
router.post('/driver/refuel', upload.single('image'), async (req, res) => {
  const { car_id, driver_rep_id, odometer_reading, fuel_type, price_per_liter, liters, total_cost, station_name, notes } = req.body;
  if (!car_id || !odometer_reading || !liters) {
    return res.status(400).json({ error: 'بيانات التفويل (العداد واللترات) مطلوبة' });
  }
  
  const odo = parseInt(odometer_reading, 10);
  const ltr = parseFloat(liters);
  const price = parseFloat(price_per_liter) || 20.50;
  const cost = parseFloat(total_cost) || (ltr * price);
  const imagePath = req.file ? `uploads/cars/${req.file.filename}` : null;
  
  try {
    const pool = getPool();
    
    // Insert into car_fuel_logs
    await pool.request()
      .input('car_id', sql.Int, car_id)
      .input('driver_rep', sql.Int, driver_rep_id || null)
      .input('odo', sql.Int, odo)
      .input('ftype', sql.NVarChar(50), fuel_type || 'سولار')
      .input('price', sql.Decimal(18, 2), price)
      .input('liters', sql.Decimal(18, 2), ltr)
      .input('cost', sql.Decimal(18, 2), cost)
      .input('station', sql.NVarChar(255), station_name || null)
      .input('notes', sql.NVarChar(sql.MAX), notes || null)
      .input('imgPath', sql.NVarChar(sql.MAX), imagePath)
      .query(`
        INSERT INTO car_fuel_logs (car_id, driver_rep_id, odometer_reading, fuel_type, price_per_liter, liters, total_cost, station_name, notes, image_path)
        VALUES (@car_id, @driver_rep, @odo, @ftype, @price, @liters, @cost, @station, @notes, @imgPath)
      `);
      
    // Update car odometer_km and last_odometer
    await pool.request()
      .input('car_id', sql.Int, car_id)
      .input('odo', sql.Int, odo)
      .query(`
        UPDATE cars 
        SET last_odometer = CASE WHEN @odo > ISNULL(last_odometer, 0) THEN @odo ELSE last_odometer END,
            odometer_km = CASE WHEN @odo > ISNULL(odometer_km, 0) THEN @odo ELSE odometer_km END 
        WHERE id = @car_id
      `);
      
    res.status(201).json({ message: 'تم تسجيل تفويل الوقود وصورة العداد بنجاح' });
  } catch (error) {
    console.error('Error logging refuel:', error);
    res.status(500).json({ error: 'فشل تسجيل تفويل الوقود' });
  }
});

// POST /api/cars/oil-change - Record new oil change from Manager panel
router.post('/oil-change', async (req, res) => {
  const { car_id, odometer_reading, oil_change_interval_km, cost, center_name, notes } = req.body;
  if (!car_id || !odometer_reading) {
    return res.status(400).json({ error: 'بيانات رقم العداد الحالي مطلوبة' });
  }

  const odo = parseInt(odometer_reading, 10);
  const interval = oil_change_interval_km ? parseInt(oil_change_interval_km, 10) : 10000;
  const nextKm = odo + interval;
  const totalCost = parseFloat(cost) || 0;

  try {
    const pool = getPool();
    await pool.request()
      .input('car_id', sql.Int, car_id)
      .input('mtype', sql.NVarChar(100), 'تغيير زيت موتور')
      .input('odo', sql.Int, odo)
      .input('nextKm', sql.Int, nextKm)
      .input('cost', sql.Decimal(18, 2), totalCost)
      .input('center', sql.NVarChar(255), center_name || null)
      .input('notes', sql.NVarChar(sql.MAX), notes || null)
      .query(`
        INSERT INTO car_maintenance_logs (car_id, maintenance_type, odometer_reading, next_service_km, cost, center_name, notes)
        VALUES (@car_id, @mtype, @odo, @nextKm, @cost, @center, @notes)
      `);

    await pool.request()
      .input('car_id', sql.Int, car_id)
      .input('odo', sql.Int, odo)
      .input('interval', sql.Int, interval)
      .input('nextKm', sql.Int, nextKm)
      .query(`
        UPDATE cars
        SET last_oil_change_km = @odo,
            oil_change_interval_km = @interval,
            next_oil_change_km = @nextKm,
            last_oil_change_date = GETDATE(),
            last_odometer = CASE WHEN @odo > ISNULL(last_odometer, 0) THEN @odo ELSE last_odometer END,
            odometer_km = CASE WHEN @odo > ISNULL(odometer_km, 0) THEN @odo ELSE odometer_km END
        WHERE id = @car_id
      `);

    res.status(201).json({ message: 'تم تسجيل غيار الزيت وتحديث الموعد القادم بنجاح' });
  } catch (error) {
    console.error('Error recording oil change:', error);
    res.status(500).json({ error: 'فشل تسجيل غيار الزيت' });
  }
});

// POST /api/driver/oil-change - Driver Portal oil / maintenance entry
router.post('/driver/oil-change', async (req, res) => {
  const { car_id, driver_rep_id, maintenance_type, odometer_reading, next_service_km, cost, center_name, notes } = req.body;
  if (!car_id || !odometer_reading) {
    return res.status(400).json({ error: 'بيانات العداد قراءة الصيانة مطلوبة' });
  }
  
  const odo = parseInt(odometer_reading, 10);
  const nextKm = next_service_km ? parseInt(next_service_km, 10) : (odo + 10000);
  const totalCost = parseFloat(cost) || 0;
  
  try {
    const pool = getPool();
    
    // Insert into car_maintenance_logs
    await pool.request()
      .input('car_id', sql.Int, car_id)
      .input('driver_rep', sql.Int, driver_rep_id || null)
      .input('mtype', sql.NVarChar(100), maintenance_type || 'تغيير زيت موتور')
      .input('odo', sql.Int, odo)
      .input('nextKm', sql.Int, nextKm)
      .input('cost', sql.Decimal(18, 2), totalCost)
      .input('center', sql.NVarChar(255), center_name || null)
      .input('notes', sql.NVarChar(sql.MAX), notes || null)
      .query(`
        INSERT INTO car_maintenance_logs (car_id, driver_rep_id, maintenance_type, odometer_reading, next_service_km, cost, center_name, notes)
        VALUES (@car_id, @driver_rep, @mtype, @odo, @nextKm, @cost, @center, @notes)
      `);
      
    // Update car odometer_km and oil change status
    await pool.request()
      .input('car_id', sql.Int, car_id)
      .input('odo', sql.Int, odo)
      .input('nextKm', sql.Int, nextKm)
      .query(`
        UPDATE cars 
        SET last_oil_change_km = @odo,
            next_oil_change_km = @nextKm,
            last_oil_change_date = GETDATE(),
            last_odometer = CASE WHEN @odo > ISNULL(last_odometer, 0) THEN @odo ELSE last_odometer END,
            odometer_km = CASE WHEN @odo > ISNULL(odometer_km, 0) THEN @odo ELSE odometer_km END 
        WHERE id = @car_id
      `);
      
    res.status(201).json({ message: 'تم تسجيل غيار الزيت والصيانة وتحديث العداد بنجاح' });
  } catch (error) {
    console.error('Error logging oil change:', error);
    res.status(500).json({ error: 'فشل تسجيل غيار الزيت' });
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
