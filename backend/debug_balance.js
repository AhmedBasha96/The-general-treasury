require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  const pool = await sql.connect(config);

  // الرصيد الافتتاحي الصحيح = 131980 + صرف - إيداع
  // 131980 + 6000 (withdrawals disbursed) + 2000 (company transfers) - 7123 (deposits) = 132857
  const correctInitialBalance = 132857;

  // نصفّر الفئات الافتتاحية حتى تُستخدم القيمة المباشرة (safe_initial_balance)
  const updates = [
    { key: 'safe_initial_balance', val: String(correctInitialBalance) },
    { key: 'safe_initial_denom_200', val: '0' },
    { key: 'safe_initial_denom_100', val: '0' },
    { key: 'safe_initial_denom_50',  val: '0' },
    { key: 'safe_initial_denom_20',  val: '0' },
    { key: 'safe_initial_denom_10',  val: '0' },
    { key: 'safe_initial_denom_5',   val: '0' },
    { key: 'safe_initial_denom_1',   val: '0' },
  ];

  for (const u of updates) {
    const check = await pool.request()
      .input('k', sql.NVarChar, u.key)
      .query('SELECT COUNT(*) AS cnt FROM settings WHERE key_name = @k');
    if (check.recordset[0].cnt > 0) {
      await pool.request()
        .input('k', sql.NVarChar, u.key)
        .input('v', sql.NVarChar, u.val)
        .query('UPDATE settings SET val = @v WHERE key_name = @k');
      console.log(`UPDATED ${u.key} = ${u.val}`);
    } else {
      await pool.request()
        .input('k', sql.NVarChar, u.key)
        .input('v', sql.NVarChar, u.val)
        .query('INSERT INTO settings (key_name, val) VALUES (@k, @v)');
      console.log(`INSERTED ${u.key} = ${u.val}`);
    }
  }

  // تحقق من الرصيد النهائي
  const dep = await pool.request().query(`
    SELECT ISNULL(SUM(amount), 0) AS total FROM transactions
    WHERE type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL)
      AND (status IN ('approved', 'disbursed') OR status IS NULL)
  `);
  const with1 = await pool.request().query(`
    SELECT ISNULL(SUM(amount), 0) AS total FROM transactions
    WHERE (type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL))
       OR (type = 'company_transfer' AND (payment_method = 'cash' OR payment_method IS NULL) AND (status = 'approved' OR status IS NULL))
  `);

  const cashDep = Number(dep.recordset[0].total);
  const totalWith = Number(with1.recordset[0].total);
  const finalBalance = correctInitialBalance + cashDep - totalWith;

  console.log('\n=== VERIFICATION ===');
  console.log('Initial Balance:', correctInitialBalance.toLocaleString());
  console.log('Cash Deposits:', cashDep.toLocaleString());
  console.log('Total Withdrawals:', totalWith.toLocaleString());
  console.log('Final Balance:', finalBalance.toLocaleString());
  console.log(finalBalance === 131980 ? '✅ CORRECT! = 131,980' : `❌ Expected 131,980 but got ${finalBalance}`);

  await sql.close();
}

main().catch(console.error);
