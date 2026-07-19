const { sql, getPool } = require('./db');

async function fixCarsTable() {
  try {
    await require('./db').connectDB();
    const pool = require('./db').getPool();
    const result = await pool.request().query(`
      SELECT tc.CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'cars' AND ccu.COLUMN_NAME = 'plate_number' AND tc.CONSTRAINT_TYPE = 'UNIQUE'
    `);
    
    if (result.recordset.length > 0) {
      const constraintName = result.recordset[0].CONSTRAINT_NAME;
      console.log('Found constraint:', constraintName);
      
      // 2. Drop the constraint
      await pool.request().query(`ALTER TABLE cars DROP CONSTRAINT ${constraintName}`);
      console.log('Constraint dropped.');
    }

    // 3. Alter the column to NVARCHAR(50)
    await pool.request().query(`ALTER TABLE cars ALTER COLUMN plate_number NVARCHAR(50) NOT NULL`);
    console.log('Column altered to NVARCHAR(50).');

    // 4. Re-add the UNIQUE constraint
    await pool.request().query(`ALTER TABLE cars ADD CONSTRAINT UQ_cars_plate_number UNIQUE (plate_number)`);
    console.log('Constraint re-added.');

    console.log('Cars table encoding fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing cars table:', error);
    process.exit(1);
  }
}

fixCarsTable();
