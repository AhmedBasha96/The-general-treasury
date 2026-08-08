const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'CashSafePassword123!',
  server: 'localhost',
  database: 'cash_safe_db',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    
    const tables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
    console.log('Tables:', tables.recordset.map(t => t.TABLE_NAME));

    for (const t of tables.recordset) {
      const tableName = t.TABLE_NAME;
      console.log(`\n=== TABLE: ${tableName} ===`);
      const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${tableName}'`);
      const colNames = cols.recordset.map(c => c.COLUMN_NAME);
      console.log('Columns:', colNames.join(', '));
      
      const countRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM ${tableName}`);
      console.log('Rows count:', countRes.recordset[0].cnt);

      // Check numeric columns for values or sums
      for (const col of colNames) {
        if (['amount', 'balance', 'total', 'val', 'price', 'cost'].some(k => col.toLowerCase().includes(k))) {
          const sumRes = await pool.request().query(`SELECT SUM(TRY_CAST(${col} AS float)) AS sum_val, MAX(TRY_CAST(${col} AS float)) AS max_val FROM ${tableName}`);
          console.log(`  Col ${col}: sum=${sumRes.recordset[0].sum_val}, max=${sumRes.recordset[0].max_val}`);
        }
      }
    }

  } catch (error) {
    console.error('Inspection failed:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
