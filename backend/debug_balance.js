try { require('dotenv').config(); } catch (e) {}
const sql = require('mssql');

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'CashSafePassword123!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'cash_safe_db',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  const pool = await sql.connect(config);
  console.log('Connected to DB:', config.database, 'on', config.server);

  // إجمالي الإيداعات النقدية
  const dep = await pool.request().query(`
    SELECT COUNT(*) AS cnt, ISNULL(SUM(amount),0) AS total 
    FROM transactions 
    WHERE type='deposit' AND (payment_method='cash' OR payment_method IS NULL)
      AND (status IN ('approved','disbursed') OR status IS NULL)
  `);
  console.log('Cash Deposits:', dep.recordset[0]);

  // إجمالي المسحوبات
  const with1 = await pool.request().query(`
    SELECT COUNT(*) AS cnt, ISNULL(SUM(amount),0) AS total 
    FROM transactions 
    WHERE (type='withdrawal' AND (status='disbursed' OR status IS NULL))
       OR (type='company_transfer' AND (payment_method='cash' OR payment_method IS NULL) AND (status='approved' OR status IS NULL))
  `);
  console.log('Withdrawals:', with1.recordset[0]);

  // الرصيد الافتتاحي
  const s = await pool.request().query(`SELECT key_name, val FROM settings WHERE key_name='safe_initial_balance'`);
  console.log('safe_initial_balance setting:', s.recordset[0] || 'NOT FOUND');

  // عدد الحركات الكلي
  const total = await pool.request().query(`SELECT COUNT(*) AS cnt FROM transactions`);
  console.log('Total transactions in DB:', total.recordset[0].cnt);

  // الرصيد المتوقع
  const cashDep = Number(dep.recordset[0].total);
  const totalWith = Number(with1.recordset[0].total);
  const initBal = s.recordset[0] ? Number(s.recordset[0].val) : 0;
  
  console.log('\n--- BALANCE ---');
  console.log('initial:', initBal, '+ deposits:', cashDep, '- withdrawals:', totalWith);
  console.log('= ', initBal + cashDep - totalWith);
  console.log('User says correct: 131,980');

  await sql.close();
}

main().catch(console.error);
