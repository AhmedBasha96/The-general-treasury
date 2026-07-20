const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const baseConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

let pool;

async function connectDB() {
  const dbName = process.env.DB_NAME || 'cash_safe_db';
  const masterConfig = { ...baseConfig, database: 'master' };
  const maxRetries = 15;
  const retryInterval = 5000; // 5 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Connecting to SQL Server at ${baseConfig.server} (master database) to verify existence of "${dbName}" (Attempt ${attempt}/${maxRetries})...`);
      const masterPool = await sql.connect(masterConfig);
      
      // Check if database exists
      const checkDbResult = await masterPool.request()
        .input('dbName', sql.VarChar, dbName)
        .query(`SELECT database_id FROM sys.databases WHERE name = @dbName`);
        
      if (checkDbResult.recordset.length === 0) {
        console.log(`Database "${dbName}" does not exist. Creating database...`);
        await masterPool.request().query(`CREATE DATABASE [${dbName}]`);
        console.log(`Database "${dbName}" created successfully!`);
      } else {
        console.log(`Database "${dbName}" already exists.`);
      }
      
      await masterPool.close();
      
      // 2. Connect to the target database
      const dbConfig = { ...baseConfig, database: dbName };
      pool = await sql.connect(dbConfig);
      console.log(`Connected to MS SQL Server database "${dbName}" successfully.`);
      
      // 3. Create tables if they do not exist
      await createTables();
      
      // 4. Seed representatives if empty
      await seedData();
      
      return pool;
    } catch (error) {
      console.error(`Database connection / initialization failed (Attempt ${attempt}/${maxRetries}):`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Retrying in ${retryInterval / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
}

async function createTables() {
  try {
    console.log('Initializing database tables...');
    
    // 1. Create agencies table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'agencies')
      BEGIN
        CREATE TABLE agencies (
          id INT IDENTITY(1,1) PRIMARY KEY,
          code NVARCHAR(50) UNIQUE NOT NULL,
          name NVARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT GETDATE()
        );
      END
    `);

    // 1.5. Create banks table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'banks')
      BEGIN
        CREATE TABLE banks (
          id INT IDENTITY(1,1) PRIMARY KEY,
          code NVARCHAR(50) UNIQUE NOT NULL,
          name NVARCHAR(255) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          account_name NVARCHAR(255),
          branch NVARCHAR(255),
          initial_balance DECIMAL(18,2) DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE()
        );
      END
    `);

    // Create index on banks code if table was created
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_banks_code' AND object_id = OBJECT_ID('banks'))
      BEGIN
        CREATE INDEX idx_banks_code ON banks(code);
      END
    `);

    // 1.8. Create supervisors table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'supervisors')
      BEGIN
        CREATE TABLE supervisors (
          id INT IDENTITY(1,1) PRIMARY KEY,
          code NVARCHAR(50) UNIQUE NOT NULL,
          name NVARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT GETDATE()
        );
      END
    `);

    // Create index on supervisors code if table was created
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_supervisors_code' AND object_id = OBJECT_ID('supervisors'))
      BEGIN
        CREATE INDEX idx_supervisors_code ON supervisors(code);
      END
    `);

    // 2. Create representatives table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'representatives')
      BEGIN
        CREATE TABLE representatives (
          id INT IDENTITY(1,1) PRIMARY KEY,
          code NVARCHAR(50) UNIQUE NOT NULL,
          name NVARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          type VARCHAR(20) DEFAULT 'retail',
          classification VARCHAR(50) DEFAULT 'retail_rep',
          password VARCHAR(255) NULL,
          agency_id INT,
          supervisor_id INT,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL,
          FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL
        );
      END
      ELSE
      BEGIN
        -- Add type column if missing
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('representatives') AND name = 'type')
        BEGIN
          ALTER TABLE representatives ADD type VARCHAR(20) DEFAULT 'retail';
          EXEC('UPDATE representatives SET type = ''retail'' WHERE type IS NULL');
        END

        -- Add classification column if missing
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('representatives') AND name = 'classification')
        BEGIN
          ALTER TABLE representatives ADD classification VARCHAR(50) DEFAULT 'retail_rep';
          EXEC('UPDATE representatives SET classification = CASE WHEN type = ''wholesale'' THEN ''wholesale_rep'' ELSE ''retail_rep'' END WHERE classification IS NULL');
        END

        -- Add password column if missing
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('representatives') AND name = 'password')
        BEGIN
          ALTER TABLE representatives ADD password VARCHAR(255) NULL;
        END

        -- Add agency_id column if missing
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('representatives') AND name = 'agency_id')
        BEGIN
          ALTER TABLE representatives ADD agency_id INT;
          ALTER TABLE representatives ADD CONSTRAINT FK_reps_agencies FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
        END

        -- Add supervisor_id column if missing
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('representatives') AND name = 'supervisor_id')
        BEGIN
          ALTER TABLE representatives ADD supervisor_id INT;
          ALTER TABLE representatives ADD CONSTRAINT FK_reps_supervisors FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL;
        END
      END
    `);
    
    // Create index on code if table was created
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_reps_code' AND object_id = OBJECT_ID('representatives'))
      BEGIN
        CREATE INDEX idx_reps_code ON representatives(code);
      END
    `);
    
    // 2.85. Create companies table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'companies')
      BEGIN
        CREATE TABLE companies (
          id INT IDENTITY(1,1) PRIMARY KEY,
          code NVARCHAR(50) UNIQUE NOT NULL,
          name NVARCHAR(255) NOT NULL,
          bank_account_number VARCHAR(100) NULL,
          bank_name NVARCHAR(255) NULL,
          created_at DATETIME DEFAULT GETDATE()
        );
      END
    `);
    
    // Create index on companies code if table was created
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_companies_code' AND object_id = OBJECT_ID('companies'))
      BEGIN
        CREATE INDEX idx_companies_code ON companies(code);
      END
    `);

    // 2.9. Create users table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
      BEGIN
        CREATE TABLE users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK(role IN ('accountant', 'manager')),
          assigned_agency_id INT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (assigned_agency_id) REFERENCES agencies(id) ON DELETE SET NULL
        );
      END
    `);

    // 3. Create transactions table with denomination columns and status/user links
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'transactions')
      BEGIN
         CREATE TABLE transactions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          rep_id INT,
          bank_id INT,
          agency_id INT,
          company_id INT,
          type VARCHAR(20) NOT NULL CHECK(type IN ('deposit', 'withdrawal', 'exchange', 'company_transfer')),
          payment_method VARCHAR(20) DEFAULT 'cash',
          withdrawal_sub_type NVARCHAR(50),
          amount DECIMAL(18, 2) NOT NULL,
          date DATETIME NOT NULL,
          notes NVARCHAR(MAX),
          receipt_image NVARCHAR(MAX),
          denom_200 INT DEFAULT 0,
          denom_100 INT DEFAULT 0,
          denom_50 INT DEFAULT 0,
          denom_20 INT DEFAULT 0,
          denom_10 INT DEFAULT 0,
          denom_5 INT DEFAULT 0,
          denom_1 INT DEFAULT 0,
          status VARCHAR(20) DEFAULT 'approved',
          created_by INT NULL,
          approved_by INT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (rep_id) REFERENCES representatives(id) ON DELETE SET NULL,
          FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE SET NULL,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE NO ACTION,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE NO ACTION
        );
      END
      ELSE
      BEGIN
        -- Add denomination columns if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'denom_200')
        BEGIN
          ALTER TABLE transactions ADD denom_200 INT DEFAULT 0;
          ALTER TABLE transactions ADD denom_100 INT DEFAULT 0;
          ALTER TABLE transactions ADD denom_50 INT DEFAULT 0;
          ALTER TABLE transactions ADD denom_20 INT DEFAULT 0;
          ALTER TABLE transactions ADD denom_10 INT DEFAULT 0;
          ALTER TABLE transactions ADD denom_5 INT DEFAULT 0;
          ALTER TABLE transactions ADD denom_1 INT DEFAULT 0;
        END

        -- Add bank_id column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'bank_id')
        BEGIN
          ALTER TABLE transactions ADD bank_id INT;
          ALTER TABLE transactions ADD CONSTRAINT FK_transactions_banks FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE SET NULL;
        END

        -- Add payment_method column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'payment_method')
        BEGIN
          ALTER TABLE transactions ADD payment_method VARCHAR(20) DEFAULT 'cash';
          EXEC('UPDATE transactions SET payment_method = ''cash'' WHERE payment_method IS NULL');
        END

        -- Add receipt_image column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'receipt_image')
        BEGIN
          ALTER TABLE transactions ADD receipt_image NVARCHAR(MAX);
        END

        -- Add agency_id column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'agency_id')
        BEGIN
          ALTER TABLE transactions ADD agency_id INT;
          ALTER TABLE transactions ADD CONSTRAINT FK_transactions_agencies FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE NO ACTION;
        END

        -- Add withdrawal_sub_type column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'withdrawal_sub_type')
        BEGIN
          ALTER TABLE transactions ADD withdrawal_sub_type NVARCHAR(50);
        END

        -- Add status column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'status')
        BEGIN
          ALTER TABLE transactions ADD status VARCHAR(20) DEFAULT 'approved';
          EXEC('UPDATE transactions SET status = ''approved'' WHERE status IS NULL');
        END

        -- Add created_by column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'created_by')
        BEGIN
          ALTER TABLE transactions ADD created_by INT NULL;
        END

        -- Add created_by foreign key constraint if missing
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_transactions_created_by')
        BEGIN
          ALTER TABLE transactions ADD CONSTRAINT FK_transactions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION;
        END

        -- Add approved_by column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'approved_by')
        BEGIN
          ALTER TABLE transactions ADD approved_by INT NULL;
        END

        -- Add approved_by foreign key constraint if missing
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_transactions_approved_by')
        BEGIN
          ALTER TABLE transactions ADD CONSTRAINT FK_transactions_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE NO ACTION;
        END

        -- Add company_id column if missing in existing table
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'company_id')
        BEGIN
          ALTER TABLE transactions ADD company_id INT;
          ALTER TABLE transactions ADD CONSTRAINT FK_transactions_companies FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
        END

        -- Update type constraint to allow 'exchange' and 'company_transfer'
        DECLARE @ConstraintName NVARCHAR(200)
        SELECT @ConstraintName = dc.name
        FROM sys.check_constraints dc
        JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE dc.parent_object_id = OBJECT_ID('transactions') AND c.name = 'type'

        IF @ConstraintName IS NOT NULL
        BEGIN
            DECLARE @Definition NVARCHAR(MAX)
            SELECT @Definition = definition FROM sys.check_constraints WHERE name = @ConstraintName
            
            IF CHARINDEX('company_transfer', @Definition) = 0
            BEGIN
                EXEC('ALTER TABLE transactions DROP CONSTRAINT ' + @ConstraintName)
                ALTER TABLE transactions ADD CONSTRAINT CK_transactions_type CHECK (type IN ('deposit', 'withdrawal', 'exchange', 'company_transfer'))
            END
        END
        ELSE
        BEGIN
            IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('transactions') AND name = 'CK_transactions_type')
            BEGIN
                ALTER TABLE transactions ADD CONSTRAINT CK_transactions_type CHECK (type IN ('deposit', 'withdrawal', 'exchange', 'company_transfer'))
            END
        END
      END
    `);

    // 4. Create settings table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'settings')
      BEGIN
        CREATE TABLE settings (
          key_name VARCHAR(100) PRIMARY KEY,
          val NVARCHAR(MAX) NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        );
      END
    `);

    // Create cars table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'cars')
      BEGIN
        CREATE TABLE cars (
          id INT IDENTITY(1,1) PRIMARY KEY,
          plate_number NVARCHAR(50) COLLATE Arabic_100_CI_AS UNIQUE NOT NULL,
          image_path NVARCHAR(MAX) NULL,
          created_at DATETIME DEFAULT GETDATE()
        );
      END
    `);

    // Ensure plate_letters and plate_numbers columns exist in cars table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('cars') AND name = 'plate_letters')
      BEGIN
        ALTER TABLE cars ADD plate_letters NVARCHAR(50) NULL;
      END
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('cars') AND name = 'plate_numbers')
      BEGIN
        ALTER TABLE cars ADD plate_numbers NVARCHAR(50) NULL;
      END
    `);

    // Add car_id column to transactions if missing
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'car_id')
      BEGIN
        ALTER TABLE transactions ADD car_id INT NULL;
        ALTER TABLE transactions ADD CONSTRAINT FK_transactions_cars FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE SET NULL;
      END
    `);
    
    console.log('Database tables verified/created.');
  } catch (error) {
    console.error('Failed to create tables:', error);
    throw error;
  }
}

async function seedData() {
  try {
    // Agencies and Representatives seeding has been removed to respect user's real data entry.


    // 3. Seed initial banks if empty
    const banksCount = await pool.request().query(`SELECT COUNT(*) as count FROM banks`);
    if (banksCount.recordset[0].count === 0) {
      console.log('Seeding initial banks data...');
      await pool.request().query(`
        INSERT INTO banks (code, name, account_number, account_name, branch, initial_balance) VALUES 
        ('CIB-01', N'البنك التجاري الدولي CIB', '100020003000', N'الاحلام للتوكيلات التجاريه', N'فرع الدقي', 150000.00),
        ('NBE-01', N'البنك الأهلي المصري', '500060007000', N'الاحلام للتوكيلات التجاريه', N'فرع قصر النيل', 250000.00);
      `);
      console.log('Banks seeding completed.');
    }

    // 4. Seed initial supervisors if empty
    const supervisorsCount = await pool.request().query(`SELECT COUNT(*) as count FROM supervisors`);
    if (supervisorsCount.recordset[0].count === 0) {
      console.log('Seeding initial supervisors data...');
      await pool.request().query(`
        INSERT INTO supervisors (code, name) VALUES 
        ('SUP001', N'أحمد علي حسن'),
        ('SUP002', N'محمد عبد الرحمن محمود'),
        ('SUP003', N'إبراهيم مصطفى كمال');
      `);
      console.log('Supervisors seeding completed.');
      
      // Link seeded representatives to default supervisor SUP001
      const repsCountResult = await pool.request().query(`SELECT COUNT(*) as count FROM representatives`);
      if (repsCountResult.recordset[0].count > 0) {
        console.log('Linking representatives to default supervisor SUP001...');
        const firstSupervisorResult = await pool.request().query(`SELECT TOP 1 id FROM supervisors ORDER BY id ASC`);
        const defaultSupervisorId = firstSupervisorResult.recordset[0].id;
        await pool.request()
          .input('defaultSupervisorId', sql.Int, defaultSupervisorId)
          .query(`UPDATE representatives SET supervisor_id = @defaultSupervisorId WHERE supervisor_id IS NULL`);
        console.log('Representatives link completed.');
      }
    }

    // 5. Seed initial users if empty
    const usersCount = await pool.request().query(`SELECT COUNT(*) as count FROM users`);
    if (usersCount.recordset[0].count === 0) {
      console.log('Seeding initial users data...');
      
      const hashPassword = (plainText) => {
        return bcrypt.hashSync(plainText, 10);
      };
      
      const adminPass = hashPassword('Ahmed3300@@');

      await pool.request()
        .input('adminPass', sql.VarChar, adminPass)
        .query(`
          INSERT INTO users (username, password, role, assigned_agency_id) VALUES 
          ('Ahmed', @adminPass, 'manager', NULL)
        `);
      console.log('Users seeding completed.');
    }

    // 6. Migrate existing driver codes from 3xxx range to 1xxx range if classification column exists
    const checkColumns = await pool.request()
      .query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'representatives' AND COLUMN_NAME = 'classification'");
    
    if (checkColumns.recordset.length > 0) {
      console.log('Migrating driver codes starting with 3 to start with 1...');
      const migrateResult = await pool.request().query(`
        UPDATE representatives
        SET code = '1' + SUBSTRING(code, 2, LEN(code))
        WHERE classification = 'driver' 
          AND code LIKE '3%'
          AND NOT EXISTS (
            SELECT 1 FROM representatives r2 
            WHERE r2.code = '1' + SUBSTRING(representatives.code, 2, LEN(representatives.code))
          )
      `);
      console.log(`Driver codes migration completed. Rows affected: ${migrateResult.rowsAffected[0]}`);
    }

    // 7. Ensure every supervisor has a financial representative account if classification column exists
    if (checkColumns.recordset.length > 0) {
      console.log('Ensuring all supervisors have financial representative accounts...');
      const allSupervisors = await pool.request().query("SELECT id, code, name FROM supervisors");
      for (const sup of allSupervisors.recordset) {
        const checkRep = await pool.request()
          .input('code', sql.VarChar, sup.code)
          .query("SELECT id FROM representatives WHERE code = @code");
        
        if (checkRep.recordset.length === 0) {
          console.log(`Auto-creating financial representative account for supervisor: ${sup.name} (${sup.code})`);
          await pool.request()
            .input('code', sql.VarChar, sup.code)
            .input('name', sql.NVarChar, sup.name)
            .input('supervisor_id', sql.Int, sup.id)
            .query(`
              INSERT INTO representatives (code, name, type, classification, supervisor_id)
              VALUES (@code, @name, 'retail', 'supervisor_staff', @supervisor_id)
            `);
        }
      }
      console.log('Supervisor financial accounts check completed.');
    }
  } catch (error) {
    console.error('Failed to seed data:', error);
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB() first.');
  }
  return pool;
}

module.exports = {
  connectDB,
  getPool,
  sql
};
