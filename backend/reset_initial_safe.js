require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'CashSafePassword123!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'cash_safe_db',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to database...');

    const result = await pool.request().query("UPDATE settings SET val = '0' WHERE key_name LIKE 'safe_initial_%'");
    console.log('✅ Updated settings rows affected:', result.rowsAffected[0]);

    const updatedSettings = await pool.request().query("SELECT key_name, val FROM settings WHERE key_name LIKE 'safe_initial_%'");
    console.log('Current initial settings in DB:');
    console.log(updatedSettings.recordset);

    await sql.close();
    console.log('✅ Reset finished successfully.');
  } catch (error) {
    console.error('Error resetting initial safe values:', error);
  }
}

main();
