const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'CashSafePassword123!',
  server: 'localhost',
  database: 'master',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  try {
    const pool = await sql.connect(config);
    const dbs = await pool.request().query("SELECT name FROM sys.databases");
    console.log('Databases on SQL Server:', dbs.recordset.map(d => d.name));

    for (const db of dbs.recordset) {
      if (['master', 'tempdb', 'model', 'msdb'].includes(db.name)) continue;
      console.log(`\n--- DATABASE: ${db.name} ---`);
      try {
        const dbPool = await sql.connect({ ...config, database: db.name });
        const settings = await dbPool.request().query("SELECT * FROM settings WHERE key_name LIKE 'safe_initial_%'");
        console.log(`Settings in ${db.name}:`, settings.recordset);
        await dbPool.close();
      } catch (err) {
        console.log(`Could not query ${db.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit(0);
  }
}

main();
