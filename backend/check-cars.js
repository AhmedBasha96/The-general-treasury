const { getPool, connectDB } = require('./db');
async function run() { 
  await connectDB(); 
  const pool = getPool(); 
  const res = await pool.request().query("SELECT * FROM cars"); 
  console.log(res.recordset); 
  process.exit(0); 
} 
run();
