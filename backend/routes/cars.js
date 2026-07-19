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

// GET /api/cars - list all cars
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`SELECT id, plate_number, image_path FROM cars ORDER BY plate_number`);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'فشل جلب بيانات السيارات' });
  }
});

// POST /api/cars - add a new car (multipart/form-data)
router.post('/', upload.single('image'), async (req, res) => {
  const { plate_number } = req.body;
  if (!plate_number) {
    return res.status(400).json({ error: 'رقم اللوحة مطلوب' });
  }
  const imagePath = req.file ? path.join('uploads', 'cars', req.file.filename) : null;
  try {
    const pool = getPool();
    // Check duplicate plate
    const dup = await pool.request()
      .input('plate', sql.NVarChar, plate_number.trim())
      .query('SELECT id FROM cars WHERE plate_number = @plate');
    if (dup.recordset.length > 0) {
      return res.status(400).json({ error: 'رقم اللوحة مسجل مسبقاً' });
    }
    await pool.request()
      .input('plate', sql.NVarChar, plate_number.trim())
      .input('img', sql.NVarChar, imagePath)
      .query(`INSERT INTO cars (plate_number, image_path) VALUES (@plate, @img)`);
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
        SELECT t.*, u.name as creator_name, c.plate_number
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

module.exports = router;
