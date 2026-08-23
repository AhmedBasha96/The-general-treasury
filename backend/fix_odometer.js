const { connectDB, getPool } = require('./db');

async function fixCarOdometer() {
  await connectDB();
  const pool = getPool();
  
  const cars = await pool.request().query('SELECT id, plate_number, odometer_km, last_odometer FROM cars');
  console.log('Current cars in DB:', cars.recordset);

  // If any car has last_odometer > 10000000 (like 413256789), reset last_odometer = odometer_km
  for (const car of cars.recordset) {
    if (car.last_odometer > 10000000 || car.odometer_km > 10000000) {
      console.log(`Resetting erroneous odometer for car ID ${car.id} (${car.plate_number})...`);
      await pool.request()
        .input('id', car.id)
        .query('UPDATE cars SET last_odometer = 0, odometer_km = 0 WHERE id = @id');
    }
  }

  const updatedCars = await pool.request().query('SELECT id, plate_number, odometer_km, last_odometer FROM cars');
  console.log('Updated cars in DB:', updatedCars.recordset);

  process.exit(0);
}

fixCarOdometer();
