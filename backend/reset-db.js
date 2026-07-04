const { connectDB } = require('./db');

async function resetDB() {
  try {
    const pool = await connectDB();
    console.log('Resetting database tables...');
    
    // Delete in order of dependencies to avoid foreign key constraint violations
    await pool.request().query('DELETE FROM transactions');
    await pool.request().query('DELETE FROM representatives');
    await pool.request().query('DELETE FROM banks');
    await pool.request().query('DELETE FROM supervisors');
    await pool.request().query('DELETE FROM agencies');
    await pool.request().query('DELETE FROM users');
    
    console.log('All data wiped successfully! Default user, bank, and supervisor seeds will be automatically recreated on server restart (agencies and representatives must be entered manually).');
  } catch (error) {
    console.error('Reset failed:', error);
  } finally {
    process.exit(0);
  }
}

resetDB();
