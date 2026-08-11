const { getPool, connectDB } = require('./backend/db');

async function testInsert() {
  await connectDB();
  const pool = getPool();
  
  const reps = await pool.request().query('SELECT TOP 1 id, code, name, zk_user_id FROM representatives');
  if (reps.recordset.length > 0) {
    const r = reps.recordset[0];
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    
    await pool.request()
      .input('rep_id', r.id)
      .input('zk', String(r.zk_user_id || r.code || '5001'))
      .input('d', dateStr)
      .input('cin', now)
      .input('st', 'present')
      .input('late', 0)
      .input('dev', 'ZKTeco MB20 Direct')
      .query(`
        INSERT INTO attendance_logs (rep_id, zk_user_id, date, check_in, status, late_minutes, device_name, created_at)
        VALUES (@rep_id, @zk, @d, @cin, @st, @late, @dev, GETDATE());
      `);
    console.log(`✅ Success: Added real attendance record for representative: ${r.name}`);
  } else {
    console.log('⚠️ No representatives found in database');
  }
  process.exit(0);
}

testInsert().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
