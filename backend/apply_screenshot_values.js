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

  const CORRECT_INITIAL_BALANCE = 0;
  const CORRECT_DENOMS = {
    'safe_initial_denom_200': '0',
    'safe_initial_denom_100': '0',
    'safe_initial_denom_50':  '0',
    'safe_initial_denom_20':  '0',
    'safe_initial_denom_10':  '0',
    'safe_initial_denom_5':   '0',
    'safe_initial_denom_1':   '0',
  };

  const allKeys = [
    { key: 'safe_initial_balance', val: String(CORRECT_INITIAL_BALANCE) },
    ...Object.entries(CORRECT_DENOMS).map(([k, v]) => ({ key: k, val: v }))
  ];

  for (const k of allKeys) {
    const exists = await pool.request()
      .input('kk', sql.NVarChar, k.key)
      .query('SELECT COUNT(*) AS cnt FROM settings WHERE key_name = @kk');
    if (exists.recordset[0].cnt > 0) {
      await pool.request()
        .input('kk', sql.NVarChar, k.key)
        .input('vv', sql.NVarChar, k.val)
        .query('UPDATE settings SET val = @vv WHERE key_name = @kk');
    } else {
      await pool.request()
        .input('kk', sql.NVarChar, k.key)
        .input('vv', sql.NVarChar, k.val)
        .query('INSERT INTO settings (key_name, val) VALUES (@kk, @vv)');
    }
  }

  console.log('✅ Local DB settings updated successfully to match exact screenshot numbers.');
  await sql.close();
}

main().catch(console.error);
