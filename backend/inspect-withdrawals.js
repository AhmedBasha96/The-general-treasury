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
    console.log('Connecting to database on localhost...');
    const pool = await sql.connect(config);
    console.log('Connected! Querying withdrawals...');
    
    const result = await pool.request().query(`
      SELECT t.id, t.type, t.amount, t.date, t.notes, t.status, 
             u1.username AS creator, u1.role AS creator_role,
             u2.username AS approver, u2.role AS approver_role
      FROM transactions t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      WHERE t.type = 'withdrawal'
      ORDER BY t.date DESC
    `);
    
    console.log('Withdrawals list:');
    console.log(result.recordset);
    
  } catch (error) {
    console.error('Inspection failed:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
