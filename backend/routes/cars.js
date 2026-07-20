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

// GET /api/cars - list all cars
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`SELECT id, plate_number, plate_letters, plate_numbers, image_path FROM cars ORDER BY id DESC`);
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
      .input('img', sql.NVarChar(sql.MAX), imagePath)
      .query(`INSERT INTO cars (plate_number, plate_letters, plate_numbers, image_path) VALUES (@plate, @letters, @numbers, @img)`);
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
        SELECT t.*, u.name as creator_name, c.plate_number, c.plate_letters, c.plate_numbers
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN cars c ON t.car_id = c.id
        WHERE t.car_id = @car_id
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
        .input('img', sql.NVarChar(sql.MAX), imagePath)
        .query(`UPDATE cars SET plate_number = @plate, plate_letters = @letters, plate_numbers = @numbers, image_path = @img WHERE id = @id`);
    } else {
      await pool.request()
        .input('id', sql.Int, id)
        .input('plate', sql.NVarChar(255), plate_number)
        .input('letters', sql.NVarChar(50), plate_letters || null)
        .input('numbers', sql.NVarChar(50), plate_numbers || null)
        .query(`UPDATE cars SET plate_number = @plate, plate_letters = @letters, plate_numbers = @numbers WHERE id = @id`);
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
