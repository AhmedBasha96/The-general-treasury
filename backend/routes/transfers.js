const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// POST /api/transfers - Create a new company transfer (cash from treasury to company)
router.post('/', async (req, res) => {
  const { amount, date, notes, company_id } = req.body;
  if (!amount || !date || !company_id) {
    return res.status(400).json({ error: 'المبلغ، التاريخ، ومعرف الشركة مطلوبون' });
  }

  try {
    const pool = getPool();
    // Insert transaction with type 'company_transfer'
    const result = await pool.request()
      .input('companyId', sql.Int, company_id)
      .input('amount', sql.Decimal(18, 2), amount)
      .input('date', sql.DateTime, new Date(date))
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        INSERT INTO transactions (type, payment_method, amount, date, notes, company_id, status)
        VALUES ('company_transfer', 'cash', @amount, @date, @notes, @companyId, 'approved');
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const insertedId = result.recordset[0].id;
    res.status(201).json({ message: 'تم حفظ تحويل الشركة بنجاح', transferId: insertedId });
  } catch (error) {
    console.error('Error creating company transfer:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ تحويل الشركة' });
  }
});

module.exports = router;
