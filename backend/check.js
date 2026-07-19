const { getPool, connectDB } = require('./db');
async function run() { 
  await connectDB(); 
  const pool = getPool(); 
  const res = await pool.request().query("SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='cars' AND COLUMN_NAME='plate_number'"); 
  console.log(res.recordset); 
  process.exit(0); 
} 
run();
