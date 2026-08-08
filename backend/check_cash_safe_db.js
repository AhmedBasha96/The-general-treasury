const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'CashSafePassword123!',
  server: 'localhost',
  database: 'cash_safe_db',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('Connected to cash_safe_db');

    const settings = await pool.request().query("SELECT key_name, val FROM settings");
    console.log('Settings:', settings.recordset);

    const dep = await pool.request().query("SELECT SUM(amount) AS sum_dep FROM transactions WHERE type='deposit'");
    console.log('Deposits sum:', dep.recordset[0].sum_dep);

    const with1 = await pool.request().query("SELECT SUM(amount) AS sum_with FROM transactions WHERE type='withdrawal'");
    console.log('Withdrawals sum:', with1.recordset[0].sum_with);

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
