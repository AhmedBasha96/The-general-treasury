const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { connectDB, getPool, sql } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// API Status endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'OK', message: 'Cash Safe API is running.' });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }
  
  try {
    const pool = getPool();
    
    // First, check if the username corresponds to a representative code
    const repResult = await pool.request()
      .input('username', sql.VarChar, username.trim())
      .query('SELECT * FROM representatives WHERE UPPER(code) = UPPER(@username)');
      
    if (repResult.recordset.length > 0) {
      const rep = repResult.recordset[0];
      if (!rep.password) {
        return res.status(401).json({ error: 'لم يتم تعيين كلمة مرور لهذا المندوب بعد' });
      }
      const isPasswordValid = bcrypt.compareSync(password, rep.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }
      return res.json({
        id: rep.id,
        username: rep.code,
        name: rep.name,
        role: 'representative',
        assigned_agency_id: rep.agency_id
      });
    }
    
    // Fallback to checking the users table
    const userResult = await pool.request()
      .input('username', sql.VarChar, username.trim())
      .query('SELECT * FROM users WHERE UPPER(username) = UPPER(@username)');
      
    if (userResult.recordset.length === 0) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    
    const user = userResult.recordset[0];
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      assigned_agency_id: user.assigned_agency_id
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// GET /api/users (List all users with assigned agency info) - Manager only
app.get('/api/users', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT u.id, u.username, u.role, u.assigned_agency_id, u.created_at,
             a.name AS agency_name, a.code AS agency_code
      FROM users u
      LEFT JOIN agencies a ON u.assigned_agency_id = a.id
      ORDER BY u.username
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات المستخدمين' });
  }
});

// POST /api/users (Add new user) - Manager only
app.post('/api/users', async (req, res) => {
  const { username, password, role, assigned_agency_id } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'اسم المستخدم، كلمة المرور، والدور مطلوبون' });
  }
  
  try {
    const pool = getPool();
    
    // Check if username exists
    const checkUser = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT id FROM users WHERE username = @username');
      
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, hashedPassword)
      .input('role', sql.VarChar, role)
      .input('assigned_agency_id', sql.Int, assigned_agency_id || null)
      .query(`
        INSERT INTO users (username, password, role, assigned_agency_id)
        VALUES (@username, @password, @role, @assigned_agency_id)
      `);
      
    res.status(201).json({ message: 'تم إضافة المستخدم بنجاح' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ المستخدم' });
  }
});

// PUT /api/users/:id (Update user details) - Manager only
app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { username, password, role, assigned_agency_id } = req.body;
  
  if (!username || !role) {
    return res.status(400).json({ error: 'اسم المستخدم والدور مطلوبان' });
  }
  
  try {
    const pool = getPool();
    
    // Check if username exists on another user
    const checkUser = await pool.request()
      .input('userId', sql.Int, userId)
      .input('username', sql.VarChar, username)
      .query('SELECT id FROM users WHERE username = @username AND id <> @userId');
      
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً لمستخدم آخر' });
    }
    
    let query = `
      UPDATE users 
      SET username = @username, 
          role = @role, 
          assigned_agency_id = @assigned_agency_id
    `;
    
    const request = pool.request()
      .input('userId', sql.Int, userId)
      .input('username', sql.VarChar, username)
      .input('role', sql.VarChar, role)
      .input('assigned_agency_id', sql.Int, assigned_agency_id || null);
      
    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query += `, password = @password `;
      request.input('password', sql.VarChar, hashedPassword);
    }
    
    query += ` WHERE id = @userId `;
    
    await request.query(query);
    res.json({ message: 'تم تعديل بيانات المستخدم بنجاح' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تعديل بيانات المستخدم' });
  }
});

// 1. GET /api/dashboard
app.get('/api/dashboard', async (req, res) => {
  const userRole = req.headers['x-user-role'];
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);
  
  try {
    const pool = getPool();
    
    // Helper to generate a pool request with agencyId parameter if user is an accountant
    const createFilteredRequest = () => {
      const r = pool.request();
      if (userRole === 'accountant' && !isNaN(userAgencyId)) {
        r.input('agencyId', sql.Int, userAgencyId);
      }
      return r;
    };

    let agencyJoin = ' LEFT JOIN representatives r ON t.rep_id = r.id ';
    let agencyFilter = '';
    
    if (userRole === 'accountant' && !isNaN(userAgencyId)) {
      agencyFilter = ' AND (r.agency_id = @agencyId OR t.agency_id = @agencyId) ';
    }

    // Cash deposits only (enter the physical safe)
    const cashDepositsResult = await createFilteredRequest().query(`
      SELECT ISNULL(SUM(t.amount), 0) AS total 
      FROM transactions t
      ${agencyJoin}
      WHERE t.type = 'deposit' AND (t.payment_method = 'cash' OR t.payment_method IS NULL)
        AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL)
        ${agencyFilter}
    `);

    // Bank transfer deposits only (cash transfers going directly to bank)
    const bankTransferResult = await createFilteredRequest().query(`
      SELECT ISNULL(SUM(t.amount), 0) AS total 
      FROM transactions t
      ${agencyJoin}
      WHERE t.type = 'deposit' AND t.payment_method = 'bank_transfer'
        AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL)
        ${agencyFilter}
    `);
    
    // Total withdrawals (from physical safe)
    const withdrawalsResult = await createFilteredRequest().query(`
      SELECT ISNULL(SUM(t.amount), 0) AS total 
      FROM transactions t
      ${agencyJoin}
      WHERE t.type = 'withdrawal'
        AND (t.status = 'disbursed' OR t.status IS NULL)
        ${agencyFilter}
    `);
    
    const initialBalanceResult = await pool.request()
      .query("SELECT key_name, val FROM settings WHERE key_name LIKE 'safe_initial_%'");

    const initialDenoms = {
      denom_200: 0,
      denom_100: 0,
      denom_50: 0,
      denom_20: 0,
      denom_10: 0,
      denom_5: 0,
      denom_1: 0
    };
    let safeInitialBalance = 0;
    let safeInitialBalanceSet = false;

    initialBalanceResult.recordset.forEach(row => {
      if (row.key_name === 'safe_initial_balance') {
        safeInitialBalanceSet = true;
      }
      const match = row.key_name.match(/^safe_initial_denom_(\d+)$/);
      if (match) {
        const denom = parseInt(match[1]);
        const val = parseInt(row.val) || 0;
        initialDenoms[`denom_${denom}`] = val;
      }
    });

    if (safeInitialBalanceSet) {
      safeInitialBalance = 
        (initialDenoms.denom_200 * 200) +
        (initialDenoms.denom_100 * 100) +
        (initialDenoms.denom_50 * 50) +
        (initialDenoms.denom_20 * 20) +
        (initialDenoms.denom_10 * 10) +
        (initialDenoms.denom_5 * 5) +
        (initialDenoms.denom_1 * 1);
    }
    
    const cashDeposits = Number(cashDepositsResult.recordset[0].total);
    const bankTransferTotal = Number(bankTransferResult.recordset[0].total);
    const totalWithdrawals = Number(withdrawalsResult.recordset[0].total);
    const totalDeposits = cashDeposits + bankTransferTotal;
    const cashSafeBalance = safeInitialBalance + cashDeposits - totalWithdrawals;
    
    // Reps count
    let repsQuery = 'SELECT COUNT(*) AS count FROM representatives';
    if (userRole === 'accountant' && !isNaN(userAgencyId)) {
      repsQuery = 'SELECT COUNT(*) AS count FROM representatives WHERE agency_id = @agencyId';
    }
    const repsCountResult = await createFilteredRequest().query(repsQuery);
    
    // Recent transactions (top 10)
    const recentTxResult = await createFilteredRequest().query(`
      SELECT TOP 10 
        t.id, t.rep_id, t.bank_id, t.company_id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.withdrawal_sub_type, t.status,
        t.denom_200, t.denom_100, t.denom_50, t.denom_20, t.denom_10, t.denom_5, t.denom_1,
        r.name AS rep_name, r.code AS rep_code,
        b.name AS bank_name, b.code AS bank_code,
        c.name AS company_name, c.code AS company_code,
        u.username AS creator_name, u2.username AS approver_name
      FROM transactions t
      LEFT JOIN representatives r ON t.rep_id = r.id
      LEFT JOIN banks b ON t.bank_id = b.id
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      WHERE 1=1 ${agencyFilter}
      ORDER BY t.date DESC
    `);

    // Safe Denominations Breakdown
    const denomsResult = await createFilteredRequest().query(`
      SELECT 
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_200 WHEN t.type = 'withdrawal' THEN -t.denom_200 ELSE t.denom_200 END), 0) AS denom_200,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_100 WHEN t.type = 'withdrawal' THEN -t.denom_100 ELSE t.denom_100 END), 0) AS denom_100,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_50 WHEN t.type = 'withdrawal' THEN -t.denom_50 ELSE t.denom_50 END), 0) AS denom_50,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_20 WHEN t.type = 'withdrawal' THEN -t.denom_20 ELSE t.denom_20 END), 0) AS denom_20,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_10 WHEN t.type = 'withdrawal' THEN -t.denom_10 ELSE t.denom_10 END), 0) AS denom_10,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_5 WHEN t.type = 'withdrawal' THEN -t.denom_5 ELSE t.denom_5 END), 0) AS denom_5,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_1 WHEN t.type = 'withdrawal' THEN -t.denom_1 ELSE t.denom_1 END), 0) AS denom_1
      FROM transactions t
      ${agencyJoin}
      WHERE (
        (t.type = 'deposit' AND (t.payment_method = 'cash' OR t.payment_method IS NULL) AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL))
        OR 
        (t.type = 'withdrawal' AND (t.status = 'disbursed' OR t.status IS NULL))
        OR
        (t.type = 'exchange' AND (t.status = 'approved' OR t.status IS NULL))
      )
      ${agencyFilter}
    `);

    const safeDenominations = {
      denom_200: (Number(denomsResult.recordset[0].denom_200) || 0) + (initialDenoms?.denom_200 || 0),
      denom_100: (Number(denomsResult.recordset[0].denom_100) || 0) + (initialDenoms?.denom_100 || 0),
      denom_50: (Number(denomsResult.recordset[0].denom_50) || 0) + (initialDenoms?.denom_50 || 0),
      denom_20: (Number(denomsResult.recordset[0].denom_20) || 0) + (initialDenoms?.denom_20 || 0),
      denom_10: (Number(denomsResult.recordset[0].denom_10) || 0) + (initialDenoms?.denom_10 || 0),
      denom_5: (Number(denomsResult.recordset[0].denom_5) || 0) + (initialDenoms?.denom_5 || 0),
      denom_1: (Number(denomsResult.recordset[0].denom_1) || 0) + (initialDenoms?.denom_1 || 0),
    };
    
    res.json({
      summary: {
        totalDeposits,
        cashDeposits,
        bankTransferTotal,
        totalWithdrawals,
        cashSafeBalance,
        safeBalance: cashSafeBalance, // backward compat
        repsCount: repsCountResult.recordset[0].count,
        safeDenominations,
        safeInitialBalance,
        safeInitialBalanceSet
      },
      recentTransactions: recentTxResult.recordset
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات لوحة التحكم' });
  }
});

// 1.5 GET /api/agencies (List all agencies with accounts summary)
app.get('/api/agencies', async (req, res) => {
  const userRole = req.headers['x-user-role'];
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);
  
  try {
    const pool = getPool();
    const request = pool.request();
    let agencyFilter = '';
    
    if (userRole === 'accountant' && !isNaN(userAgencyId)) {
      agencyFilter = ' WHERE a.id = @agencyId ';
      request.input('agencyId', sql.Int, userAgencyId);
    }

    const result = await request.query(`
      SELECT 
        a.id, a.code, a.name, a.created_at,
        (SELECT COUNT(id) FROM representatives WHERE agency_id = a.id) AS reps_count,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' AND (t.payment_method = 'cash' OR t.payment_method IS NULL) THEN t.amount ELSE 0 END), 0) AS cash_deposits,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' AND t.payment_method = 'bank_transfer' THEN t.amount ELSE 0 END), 0) AS bank_transfer_deposits,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.amount ELSE 0 END), 0) AS total_deposits,
        ISNULL(SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount ELSE 0 END), 0) AS total_withdrawals,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' AND (t.payment_method = 'cash' OR t.payment_method IS NULL) THEN t.amount
                        WHEN t.type = 'withdrawal' THEN -t.amount ELSE 0 END), 0) AS cash_balance
      FROM agencies a
      LEFT JOIN transactions t ON (
         t.rep_id IN (SELECT id FROM representatives WHERE agency_id = a.id)
         OR t.agency_id = a.id
      ) AND (
         (t.type = 'deposit' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL))
         OR (t.type = 'withdrawal' AND (t.status = 'disbursed' OR t.status IS NULL))
      )
      ${agencyFilter}
      GROUP BY a.id, a.code, a.name, a.created_at
      ORDER BY a.name
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات التوكيلات' });
  }
});

// 1.6 POST /api/agencies (Add new agency)
app.post('/api/agencies', async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'كود التوكيل والاسم مطلوبان' });
  }
  try {
    const pool = getPool();
    
    // Check if code exists
    const checkCode = await pool.request()
      .input('code', sql.VarChar, code)
      .query('SELECT id FROM agencies WHERE code = @code');
      
    if (checkCode.recordset.length > 0) {
      return res.status(400).json({ error: 'كود التوكيل مسجل مسبقاً لتوكيل آخر' });
    }
    
    await pool.request()
      .input('code', sql.VarChar, code)
      .input('name', sql.NVarChar, name)
      .query('INSERT INTO agencies (code, name) VALUES (@code, @name)');
      
    res.status(201).json({ message: 'تم إضافة التوكيل بنجاح' });
  } catch (error) {
    console.error('Error creating agency:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ التوكيل' });
  }
});

// 1.7 DELETE /api/agencies/:id (Delete agency)
app.delete('/api/agencies/:id', async (req, res) => {
  const agencyId = req.params.id;
  try {
    const pool = getPool();
    
    // Check if exists
    const checkAgency = await pool.request()
      .input('agencyId', sql.Int, agencyId)
      .query('SELECT id FROM agencies WHERE id = @agencyId');
      
    if (checkAgency.recordset.length === 0) {
      return res.status(404).json({ error: 'التوكيل غير موجود' });
    }
    
    await pool.request()
      .input('agencyId', sql.Int, agencyId)
      .query('DELETE FROM agencies WHERE id = @agencyId');
      
    res.json({ message: 'تم حذف التوكيل بنجاح' });
  } catch (error) {
    console.error('Error deleting agency:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف التوكيل' });
  }
});

// 1.8 GET /api/agencies/:id/transactions (Ledger for a specific agency)
app.get('/api/agencies/:id/transactions', async (req, res) => {
  const agencyId = req.params.id;
  const userRole = req.headers['x-user-role'];
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);
  
  if (userRole === 'accountant' && !isNaN(userAgencyId) && Number(agencyId) !== userAgencyId) {
    return res.status(403).json({ error: 'غير مسموح لك بالاطلاع على حسابات هذا التوكيل' });
  }

  try {
    const pool = getPool();
    
    // Fetch agency details
    const agencyResult = await pool.request()
      .input('agencyId', sql.Int, agencyId)
      .query('SELECT * FROM agencies WHERE id = @agencyId');
      
    if (agencyResult.recordset.length === 0) {
      return res.status(404).json({ error: 'التوكيل غير موجود' });
    }
    
    const agency = agencyResult.recordset[0];
    
    // Fetch transactions of all representatives belonging to this agency, and direct agency transactions
    const txResult = await pool.request()
      .input('agencyId', sql.Int, agencyId)
      .query(`
        SELECT t.id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.withdrawal_sub_type, t.status,
               t.denom_200, t.denom_100, t.denom_50, t.denom_20, t.denom_10, t.denom_5, t.denom_1,
               r.name AS rep_name, r.code AS rep_code,
               b.name AS bank_name, b.code AS bank_code,
               u.username AS creator_name, u2.username AS approver_name
        FROM transactions t
        LEFT JOIN representatives r ON t.rep_id = r.id
        LEFT JOIN banks b ON t.bank_id = b.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users u2 ON t.approved_by = u2.id
        WHERE r.agency_id = @agencyId OR t.agency_id = @agencyId
        ORDER BY t.date DESC
      `);
      
    let cashDeposits = 0;
    let bankTransferDeposits = 0;
    let withdrawals = 0;
    
    txResult.recordset.forEach(tx => {
      if (tx.type === 'deposit' && (tx.status === 'approved' || tx.status === 'disbursed' || tx.status === null)) {
        if (tx.payment_method === 'bank_transfer') {
          bankTransferDeposits += Number(tx.amount);
        } else {
          cashDeposits += Number(tx.amount);
        }
      } else if (tx.type === 'withdrawal' && (tx.status === 'disbursed' || tx.status === null)) {
        withdrawals += Number(tx.amount);
      }
    });
    
    res.json({
      agency,
      summary: {
        cashDeposits,
        bankTransferDeposits,
        totalDeposits: cashDeposits + bankTransferDeposits,
        totalWithdrawals: withdrawals,
        cashBalance: cashDeposits - withdrawals,
        balance: cashDeposits + bankTransferDeposits - withdrawals
      },
      transactions: txResult.recordset
    });
  } catch (error) {
    console.error('Error fetching agency ledger:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كشف حساب التوكيل' });
  }
});

// ================= BANK ENDPOINTS =================

// 1.9 GET /api/banks (List all banks with accounts summary)
app.get('/api/banks', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        b.id, b.code, b.name, b.account_number, b.account_name, b.branch, b.initial_balance, b.created_at,
        ISNULL(SUM(CASE
          WHEN t.type = 'withdrawal' THEN t.amount
          WHEN t.type = 'deposit' AND t.payment_method = 'bank_transfer' THEN t.amount
          ELSE 0 END), 0) AS total_deposits,
        ISNULL(SUM(CASE 
          WHEN t.type = 'deposit' AND (t.payment_method = 'cash' OR t.payment_method IS NULL) THEN t.amount 
          WHEN t.type = 'company_transfer' THEN t.amount
          ELSE 0 END), 0) AS total_withdrawals,
        b.initial_balance + 
        ISNULL(SUM(CASE
          WHEN t.type = 'withdrawal' THEN t.amount
          WHEN t.type = 'deposit' AND t.payment_method = 'bank_transfer' THEN t.amount
          WHEN t.type = 'deposit' AND (t.payment_method = 'cash' OR t.payment_method IS NULL) THEN -t.amount
          WHEN t.type = 'company_transfer' THEN -t.amount
          ELSE 0 END), 0) AS balance
      FROM banks b
      LEFT JOIN transactions t ON b.id = t.bank_id AND (
         (t.type = 'deposit' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL))
         OR (t.type = 'withdrawal' AND (t.status = 'disbursed' OR t.status IS NULL))
         OR (t.type = 'company_transfer' AND (t.status = 'approved' OR t.status IS NULL))
      )
      GROUP BY b.id, b.code, b.name, b.account_number, b.account_name, b.branch, b.initial_balance, b.created_at
      ORDER BY b.name
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات البنوك' });
  }
});

// 1.91 POST /api/banks (Add new bank account)
app.post('/api/banks', async (req, res) => {
  const { code, name, account_number, account_name, branch, initial_balance } = req.body;
  if (!code || !name || !account_number) {
    return res.status(400).json({ error: 'كود البنك، اسم البنك، ورقم الحساب مطلوبان' });
  }
  const initBal = parseFloat(initial_balance) || 0;
  try {
    const pool = getPool();
    
    // Check if code exists
    const checkCode = await pool.request()
      .input('code', sql.VarChar, code)
      .query('SELECT id FROM banks WHERE code = @code');
      
    if (checkCode.recordset.length > 0) {
      return res.status(400).json({ error: 'كود البنك مسجل مسبقاً لبنك آخر' });
    }
    
    await pool.request()
      .input('code', sql.VarChar, code)
      .input('name', sql.NVarChar, name)
      .input('account_number', sql.VarChar, account_number)
      .input('account_name', sql.NVarChar, account_name || null)
      .input('branch', sql.NVarChar, branch || null)
      .input('initial_balance', sql.Decimal(18, 2), initBal)
      .query(`
        INSERT INTO banks (code, name, account_number, account_name, branch, initial_balance)
        VALUES (@code, @name, @account_number, @account_name, @branch, @initial_balance)
      `);
      
    res.status(201).json({ message: 'تم إضافة البنك بنجاح' });
  } catch (error) {
    console.error('Error creating bank:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ البنك' });
  }
});

// 1.92 DELETE /api/banks/:id (Delete bank account)
app.delete('/api/banks/:id', async (req, res) => {
  const bankId = req.params.id;
  try {
    const pool = getPool();
    
    // Check if exists
    const checkBank = await pool.request()
      .input('bankId', sql.Int, bankId)
      .query('SELECT id FROM banks WHERE id = @bankId');
      
    if (checkBank.recordset.length === 0) {
      return res.status(404).json({ error: 'الحساب البنكي غير موجود' });
    }
    
    await pool.request()
      .input('bankId', sql.Int, bankId)
      .query('DELETE FROM banks WHERE id = @bankId');
      
    res.json({ message: 'تم حذف الحساب البنكي بنجاح' });
  } catch (error) {
    console.error('Error deleting bank:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الحساب البنكي' });
  }
});

// POST /api/banks/initial-balances (Update initial balance for multiple banks in bulk)
app.post('/api/banks/initial-balances', async (req, res) => {
  const { balances } = req.body; // Map of { bankId: initial_balance }
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'manager') {
    return res.status(403).json({ error: 'غير مصرح لك بتعديل الأرصدة الافتتاحية' });
  }

  if (!balances || typeof balances !== 'object') {
    return res.status(400).json({ error: 'البيانات المرسلة غير صالحة' });
  }

  try {
    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const [bankIdStr, balanceVal] of Object.entries(balances)) {
        const bankId = parseInt(bankIdStr);
        const initBal = parseFloat(balanceVal) || 0;
        
        if (isNaN(bankId) || initBal < 0) continue;

        await transaction.request()
          .input('id', sql.Int, bankId)
          .input('initial_balance', sql.Decimal(18, 2), initBal)
          .query('UPDATE banks SET initial_balance = @initial_balance WHERE id = @id');
      }

      await transaction.commit();
      res.json({ message: 'تم حفظ الأرصدة الافتتاحية للبنوك بنجاح' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error saving bank initial balances:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الأرصدة الافتتاحية للبنوك' });
  }
});

// 1.93 GET /api/banks/:id/transactions (Ledger for a specific bank)
app.get('/api/banks/:id/transactions', async (req, res) => {
  const bankId = req.params.id;
  try {
    const pool = getPool();
    
    // Fetch bank details
    const bankResult = await pool.request()
      .input('bankId', sql.Int, bankId)
      .query('SELECT * FROM banks WHERE id = @bankId');
      
    if (bankResult.recordset.length === 0) {
      return res.status(404).json({ error: 'الحساب البنكي غير موجود' });
    }
    
    const bank = bankResult.recordset[0];
    
    // Fetch transactions mapped to this bank
    const txResult = await pool.request()
      .input('bankId', sql.Int, bankId)
      .query(`
        SELECT t.id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.status,
               t.denom_200, t.denom_100, t.denom_50, t.denom_20, t.denom_10, t.denom_5, t.denom_1,
               r.name AS rep_name, r.code AS rep_code,
               c.name AS company_name, c.code AS company_code,
               u.username AS creator_name, u2.username AS approver_name
        FROM transactions t
        LEFT JOIN representatives r ON t.rep_id = r.id
        LEFT JOIN companies c ON t.company_id = c.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users u2 ON t.approved_by = u2.id
        WHERE t.bank_id = @bankId
        ORDER BY t.date DESC
      `);
      
    // Calculate total bank deposits and withdrawals with correct logic
    let totalDeposits = 0; // inflows to bank (withdrawals from safe + bank_transfer deposits)
    let totalWithdrawals = 0; // outflows from bank (cash deposits coming from bank + transfers to companies)
    
    txResult.recordset.forEach(tx => {
      if (tx.type === 'withdrawal' && (tx.status === 'disbursed' || tx.status === null)) {
        totalDeposits += Number(tx.amount);
      } else if (tx.type === 'deposit') {
        if (tx.status === 'approved' || tx.status === 'disbursed' || tx.status === null) {
          if (tx.payment_method === 'bank_transfer') {
            totalDeposits += Number(tx.amount);
          } else if (tx.payment_method === 'cash' || !tx.payment_method) {
            totalWithdrawals += Number(tx.amount);
          }
        }
      } else if (tx.type === 'company_transfer' && (tx.status === 'approved' || tx.status === null)) {
        totalWithdrawals += Number(tx.amount);
      }
    });
    
    res.json({
      bank,
      summary: {
        totalDeposits,
        totalWithdrawals,
        balance: Number(bank.initial_balance) + totalDeposits - totalWithdrawals
      },
      transactions: txResult.recordset
    });
  } catch (error) {
    console.error('Error fetching bank ledger:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كشف حساب البنك' });
  }
});

// ================= COMPANY ENDPOINTS =================

// GET /api/companies (List all companies with total transfers)
app.get('/api/companies', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        c.id, c.code, c.name, c.bank_account_number, c.bank_name, c.created_at,
        ISNULL(SUM(CASE WHEN t.type = 'company_transfer' AND (t.status = 'approved' OR t.status = 'disbursed' OR t.status IS NULL) THEN t.amount ELSE 0 END), 0) AS total_transfers
      FROM companies c
      LEFT JOIN transactions t ON c.id = t.company_id
      GROUP BY c.id, c.code, c.name, c.bank_account_number, c.bank_name, c.created_at
      ORDER BY c.name
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات الشركات' });
  }
});

// POST /api/companies (Add new company)
app.post('/api/companies', async (req, res) => {
  const { code, name, bank_account_number, bank_name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'اسم الشركة مطلوب' });
  }

  let companyCode = code ? code.trim() : '';

  try {
    const pool = getPool();
    
    // Auto-generate code if not provided
    if (!companyCode) {
      const countResult = await pool.request().query('SELECT COUNT(*) AS total FROM companies');
      const total = countResult.recordset[0].total;
      let nextNum = total + 1;
      let generatedCode = `COM-${String(nextNum).padStart(4, '0')}`;
      
      // Ensure uniqueness
      let codeExists = true;
      while (codeExists) {
        const checkCode = await pool.request()
          .input('code', sql.VarChar, generatedCode)
          .query('SELECT id FROM companies WHERE code = @code');
        if (checkCode.recordset.length === 0) {
          codeExists = false;
        } else {
          nextNum++;
          generatedCode = `COM-${String(nextNum).padStart(4, '0')}`;
        }
      }
      companyCode = generatedCode;
    } else {
      // Check if manually provided code exists
      const checkCode = await pool.request()
        .input('code', sql.VarChar, companyCode)
        .query('SELECT id FROM companies WHERE code = @code');
        
      if (checkCode.recordset.length > 0) {
        return res.status(400).json({ error: 'كود الشركة مسجل مسبقاً لشركة أخرى' });
      }
    }
    
    await pool.request()
      .input('code', sql.VarChar, companyCode)
      .input('name', sql.NVarChar, name)
      .input('bank_account_number', sql.VarChar, bank_account_number || null)
      .input('bank_name', sql.NVarChar, bank_name || null)
      .query(`
        INSERT INTO companies (code, name, bank_account_number, bank_name)
        VALUES (@code, @name, @bank_account_number, @bank_name)
      `);
      
    res.status(201).json({ message: 'تم إضافة الشركة بنجاح', code: companyCode });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الشركة' });
  }
});

// DELETE /api/companies/:id (Delete company)
app.delete('/api/companies/:id', async (req, res) => {
  const companyId = req.params.id;
  try {
    const pool = getPool();
    
    // Check if company exists
    const checkCompany = await pool.request()
      .input('companyId', sql.Int, companyId)
      .query('SELECT id FROM companies WHERE id = @companyId');
      
    if (checkCompany.recordset.length === 0) {
      return res.status(404).json({ error: 'الشركة غير موجودة' });
    }
    
    // Check if there are transactions associated with this company
    const checkTx = await pool.request()
      .input('companyId', sql.Int, companyId)
      .query('SELECT TOP 1 id FROM transactions WHERE company_id = @companyId');
      
    if (checkTx.recordset.length > 0) {
      return res.status(400).json({ error: 'لا يمكن حذف الشركة لوجود معاملات مالية مرتبطة بها' });
    }
    
    await pool.request()
      .input('companyId', sql.Int, companyId)
      .query('DELETE FROM companies WHERE id = @companyId');
      
    res.json({ message: 'تم حذف الشركة بنجاح' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الشركة' });
  }
});

// GET /api/companies/:id/transactions (Ledger for a specific company)
app.get('/api/companies/:id/transactions', async (req, res) => {
  const companyId = req.params.id;
  try {
    const pool = getPool();
    
    // Fetch company details
    const companyResult = await pool.request()
      .input('companyId', sql.Int, companyId)
      .query('SELECT * FROM companies WHERE id = @companyId');
      
    if (companyResult.recordset.length === 0) {
      return res.status(404).json({ error: 'الشركة غير موجودة' });
    }
    
    const company = companyResult.recordset[0];
    
    // Fetch transactions mapped to this company
    const txResult = await pool.request()
      .input('companyId', sql.Int, companyId)
      .query(`
        SELECT t.id, t.type, t.payment_method, t.amount, t.date, t.notes, t.status,
               b.name AS bank_name, b.code AS bank_code, b.account_number AS bank_account_number,
               u.username AS creator_name, u2.username AS approver_name
        FROM transactions t
        LEFT JOIN banks b ON t.bank_id = b.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users u2 ON t.approved_by = u2.id
        WHERE t.company_id = @companyId AND (t.status = 'approved' OR t.status = 'disbursed' OR t.status IS NULL)
        ORDER BY t.date DESC
      `);
      
    res.json({
      company,
      summary: {
        totalTransfers: txResult.recordset.reduce((sum, tx) => sum + Number(tx.amount), 0)
      },
      transactions: txResult.recordset
    });
  } catch (error) {
    console.error('Error fetching company ledger:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كشف حساب الشركة' });
  }
});

// ================= SUPERVISOR ENDPOINTS =================

// 1.94 GET /api/supervisors (List all supervisors with reps count)
app.get('/api/supervisors', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        s.id, s.code, s.name, s.created_at,
        COUNT(DISTINCT r.id) AS reps_count
      FROM supervisors s
      LEFT JOIN representatives r ON s.id = r.supervisor_id
      GROUP BY s.id, s.code, s.name, s.created_at
      ORDER BY s.name
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات المشرفين' });
  }
});

// 1.95 POST /api/supervisors (Add new supervisor)
app.post('/api/supervisors', async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'كود المشرف واسمه مطلوبان' });
  }
  try {
    const pool = getPool();
    
    // Check if code exists
    const checkCode = await pool.request()
      .input('code', sql.VarChar, code)
      .query('SELECT id FROM supervisors WHERE code = @code');
      
    if (checkCode.recordset.length > 0) {
      return res.status(400).json({ error: 'كود المشرف مسجل مسبقاً لمشرف آخر' });
    }
    
    // Use a transaction to ensure atomic insert in both supervisors and representatives tables
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await transaction.request()
        .input('code', sql.VarChar, code)
        .input('name', sql.NVarChar, name)
        .query('INSERT INTO supervisors (code, name) VALUES (@code, @name); SELECT SCOPE_IDENTITY() as id;');
        
      const supervisorId = result.recordset[0].id;
      
      // Auto-create a financial representative account if code doesn't exist in representatives
      const checkRepCode = await transaction.request()
        .input('code', sql.VarChar, code)
        .query('SELECT id FROM representatives WHERE code = @code');
        
      if (checkRepCode.recordset.length === 0) {
        await transaction.request()
          .input('code', sql.VarChar, code)
          .input('name', sql.NVarChar, name)
          .input('supervisor_id', sql.Int, supervisorId)
          .query(`
            INSERT INTO representatives (code, name, type, classification, supervisor_id) 
            VALUES (@code, @name, 'retail', 'supervisor_staff', @supervisor_id)
          `);
      }
      
      await transaction.commit();
      res.status(201).json({ message: 'تم إضافة المشرف وحسابه المالي بنجاح' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error creating supervisor:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ المشرف' });
  }
});

// 1.96 DELETE /api/supervisors/:id (Delete supervisor)
app.delete('/api/supervisors/:id', async (req, res) => {
  const supervisorId = req.params.id;
  try {
    const pool = getPool();
    
    // Check if exists
    const checkSup = await pool.request()
      .input('supervisorId', sql.Int, supervisorId)
      .query('SELECT id FROM supervisors WHERE id = @supervisorId');
      
    if (checkSup.recordset.length === 0) {
      return res.status(404).json({ error: 'المشرف غير موجود' });
    }
    
    await pool.request()
      .input('supervisorId', sql.Int, supervisorId)
      .query('DELETE FROM supervisors WHERE id = @supervisorId');
      
    res.json({ message: 'تم حذف المشرف بنجاح' });
  } catch (error) {
    console.error('Error deleting supervisor:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المشرف' });
  }
});

// 1.97 GET /api/supervisors/:id/reps (List of representatives linked to a supervisor)
app.get('/api/supervisors/:id/reps', async (req, res) => {
  const supervisorId = req.params.id;
  const userRole = req.headers['x-user-role'];
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);
  
  try {
    const pool = getPool();
    
    // Fetch supervisor details
    const supResult = await pool.request()
      .input('supervisorId', sql.Int, supervisorId)
      .query('SELECT * FROM supervisors WHERE id = @supervisorId');
      
    if (supResult.recordset.length === 0) {
      return res.status(404).json({ error: 'المشرف غير موجود' });
    }
    
    const supervisor = supResult.recordset[0];
    
    let agencyFilter = '';
    const request = pool.request().input('supervisorId', sql.Int, supervisorId);
    
    if (userRole === 'accountant' && !isNaN(userAgencyId)) {
      agencyFilter = ' AND r.agency_id = @agencyId ';
      request.input('agencyId', sql.Int, userAgencyId);
    }

    // Fetch representatives linked to this supervisor
    const repsResult = await request.query(`
      SELECT r.id, r.code, r.name, r.phone, r.type,
             a.name AS agency_name, a.code AS agency_code,
             ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.amount WHEN t.type = 'withdrawal' THEN -t.amount ELSE 0 END), 0) AS balance
      LEFT JOIN agencies a ON r.agency_id = a.id
      LEFT JOIN transactions t ON r.id = t.rep_id AND (
         (t.type = 'deposit' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL))
         OR (t.type = 'withdrawal' AND (t.status = 'disbursed' OR t.status IS NULL))
      )
      WHERE r.supervisor_id = @supervisorId ${agencyFilter}
      GROUP BY r.id, r.code, r.name, r.phone, r.type, a.name, a.code
      ORDER BY r.name
    `);
      
    res.json({
      supervisor,
      representatives: repsResult.recordset
    });
  } catch (error) {
    console.error('Error fetching supervisor reps:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب مناديب المشرف' });
  }
});

// 2. GET /api/reps (List all representatives with balances and agency info)
app.get('/api/reps', async (req, res) => {
  const userRole = req.headers['x-user-role'];
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);
  
  try {
    const pool = getPool();
    const request = pool.request();
    let agencyFilter = ' WHERE 1=1 ';
    
    if (userRole === 'accountant' && !isNaN(userAgencyId)) {
      agencyFilter = ' WHERE r.agency_id = @agencyId ';
      request.input('agencyId', sql.Int, userAgencyId);
    }

    const result = await request.query(`
      SELECT 
        r.id, r.code, r.name, r.phone, r.type, r.classification, r.agency_id, r.supervisor_id, r.created_at,
        a.name AS agency_name, a.code AS agency_code,
        s.name AS supervisor_name, s.code AS supervisor_code,
        ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.amount WHEN t.type = 'withdrawal' THEN -t.amount ELSE 0 END), 0) AS balance
      FROM representatives r
      LEFT JOIN agencies a ON r.agency_id = a.id
      LEFT JOIN supervisors s ON r.supervisor_id = s.id
      LEFT JOIN transactions t ON r.id = t.rep_id AND (
         (t.type = 'deposit' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL))
         OR (t.type = 'withdrawal' AND (t.status = 'disbursed' OR t.status IS NULL))
      )
      ${agencyFilter}
      GROUP BY r.id, r.code, r.name, r.phone, r.type, r.classification, r.agency_id, r.supervisor_id, r.created_at, a.name, a.code, s.name, s.code
      ORDER BY r.name
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching representatives:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات المناديب' });
  }
});

// 3. POST /api/reps (Add new representative mapped to agency)
app.post('/api/reps', async (req, res) => {
  const { code, name, phone, type, classification, agency_id, supervisor_id, password } = req.body;
  
  const repClassification = classification || 'retail_rep';
  const isRep = (repClassification === 'retail_rep' || repClassification === 'wholesale_rep');

  if (!code || !name) {
    return res.status(400).json({ error: 'كود الموظف واسمه مطلوبان' });
  }
  
  if (isRep && !agency_id) {
    return res.status(400).json({ error: 'التوكيل مطلوب للمناديب' });
  }

  const repType = type || 'retail';
  if (isRep && repType !== 'retail' && repType !== 'wholesale') {
    return res.status(400).json({ error: 'نوع المندوب غير صالح' });
  }
  
  try {
    const pool = getPool();
    
    // Verify agency exists if provided
    if (isRep && agency_id) {
      const checkAgency = await pool.request()
        .input('agencyId', sql.Int, agency_id)
        .query('SELECT id FROM agencies WHERE id = @agencyId');
      if (checkAgency.recordset.length === 0) {
        return res.status(400).json({ error: 'التوكيل المحدد غير موجود' });
      }
    }

    // Verify supervisor exists if provided
    if (isRep && supervisor_id) {
      const checkSup = await pool.request()
        .input('supervisorId', sql.Int, supervisor_id)
        .query('SELECT id FROM supervisors WHERE id = @supervisorId');
      if (checkSup.recordset.length === 0) {
        return res.status(400).json({ error: 'المشرف المحدد غير موجود' });
      }
    }

    // Check if code exists
    const checkCode = await pool.request()
      .input('code', sql.VarChar, code)
      .query('SELECT id FROM representatives WHERE code = @code');
      
    if (checkCode.recordset.length > 0) {
      return res.status(400).json({ error: 'كود الموظف/المندوب مسجل مسبقاً لشخص آخر' });
    }
    
    // Hash password if provided
    let hashedPassword = null;
    if (password && password.trim() !== '') {
      hashedPassword = bcrypt.hashSync(password, 10);
    }
    
    // Insert rep
    await pool.request()
      .input('code', sql.VarChar, code)
      .input('name', sql.NVarChar, name)
      .input('phone', sql.VarChar, phone || null)
      .input('type', sql.VarChar, isRep ? repType : 'retail')
      .input('classification', sql.VarChar, repClassification)
      .input('agency_id', sql.Int, isRep ? agency_id : null)
      .input('supervisor_id', sql.Int, isRep ? supervisor_id || null : null)
      .input('password', sql.VarChar, hashedPassword)
      .query(`
        INSERT INTO representatives (code, name, phone, type, classification, agency_id, supervisor_id, password)
        VALUES (@code, @name, @phone, @type, @classification, @agency_id, @supervisor_id, @password)
      `);
      
    res.status(201).json({ message: 'تم إضافة الموظف/المندوب بنجاح' });
  } catch (error) {
    console.error('Error creating representative:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الموظف/المندوب' });
  }
});

// 3.2 PUT /api/reps/:id/password (Set/Change representative password) - Manager only
app.put('/api/reps/:id/password', async (req, res) => {
  const repId = req.params.id;
  const { password } = req.body;
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'manager') {
    return res.status(403).json({ error: 'غير مسموح لغير المدراء بتعديل كلمة المرور للمناديب' });
  }
  
  if (!password || password.trim() === '') {
    return res.status(400).json({ error: 'كلمة المرور مطلوبة' });
  }
  
  try {
    const pool = getPool();
    
    // Verify representative exists
    const checkRep = await pool.request()
      .input('repId', sql.Int, repId)
      .query('SELECT id FROM representatives WHERE id = @repId');
      
    if (checkRep.recordset.length === 0) {
      return res.status(404).json({ error: 'المندوب غير موجود' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await pool.request()
      .input('repId', sql.Int, repId)
      .input('password', sql.VarChar, hashedPassword)
      .query('UPDATE representatives SET password = @password WHERE id = @repId');
      
    res.json({ message: 'تم تحديث كلمة المرور للمندوب بنجاح' });
  } catch (error) {
    console.error('Error updating representative password:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث كلمة المرور' });
  }
});

// 3.5 DELETE /api/reps/:id (Delete representative)
app.delete('/api/reps/:id', async (req, res) => {
  const repId = req.params.id;
  try {
    const pool = getPool();
    
    // Verify representative exists
    const checkRep = await pool.request()
      .input('repId', sql.Int, repId)
      .query('SELECT id FROM representatives WHERE id = @repId');
      
    if (checkRep.recordset.length === 0) {
      return res.status(404).json({ error: 'المندوب غير موجود' });
    }
    
    // Delete representative
    await pool.request()
      .input('repId', sql.Int, repId)
      .query('DELETE FROM representatives WHERE id = @repId');
      
    res.json({ message: 'تم حذف المندوب بنجاح' });
  } catch (error) {
    console.error('Error deleting representative:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المندوب' });
  }
});

// 4. GET /api/reps/:id/transactions (Ledger/statement for a specific representative)
app.get('/api/reps/:id/transactions', async (req, res) => {
  const repId = req.params.id;
  const userRole = req.headers['x-user-role'];
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);
  
  try {
    const pool = getPool();
    
    // Check if representative belongs to accountant's assigned agency
    if (userRole === 'accountant' && !isNaN(userAgencyId)) {
      const repAgencyCheck = await pool.request()
        .input('repId', sql.Int, repId)
        .query('SELECT agency_id FROM representatives WHERE id = @repId');
        
      if (repAgencyCheck.recordset.length === 0 || repAgencyCheck.recordset[0].agency_id !== userAgencyId) {
        return res.status(403).json({ error: 'غير مسموح لك بالاطلاع على حسابات مندوب من توكيل آخر' });
      }
    }
    
    // Fetch representative details with agency and supervisor
    const repResult = await pool.request()
      .input('repId', sql.Int, repId)
      .query(`
        SELECT r.id, r.code, r.name, r.phone, r.type, r.classification, r.created_at,
               a.name AS agency_name, a.code AS agency_code,
               s.name AS supervisor_name, s.code AS supervisor_code
        FROM representatives r
        LEFT JOIN agencies a ON r.agency_id = a.id
        LEFT JOIN supervisors s ON r.supervisor_id = s.id
        WHERE r.id = @repId
      `);
      
    if (repResult.recordset.length === 0) {
      return res.status(404).json({ error: 'المندوب غير موجود' });
    }
    
    const rep = repResult.recordset[0];
    
    const txResult = await pool.request()
      .input('repId', sql.Int, repId)
      .query(`
        SELECT t.id, t.type, t.amount, t.date, t.notes, t.receipt_image, t.payment_method, t.withdrawal_sub_type, t.status,
               b.name AS bank_name,
               u.username AS creator_name, u2.username AS approver_name
        FROM transactions t
        LEFT JOIN banks b ON t.bank_id = b.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users u2 ON t.approved_by = u2.id
        WHERE t.rep_id = @repId
        ORDER BY t.date DESC
      `);

    let cashDeposits = 0;
    let bankTransferDeposits = 0;
    let totalWithdrawals = 0;
    
    txResult.recordset.forEach(tx => {
      if (tx.type === 'deposit' && (tx.status === 'approved' || tx.status === 'disbursed' || tx.status === null)) {
        if (tx.payment_method === 'bank_transfer') {
          bankTransferDeposits += Number(tx.amount);
        } else {
          cashDeposits += Number(tx.amount);
        }
      } else if (tx.type === 'withdrawal' && (tx.status === 'disbursed' || tx.status === null)) {
        totalWithdrawals += Number(tx.amount);
      }
    });
    
    const totalDeposits = cashDeposits + bankTransferDeposits;
    const cashBalance = cashDeposits - totalWithdrawals;
    const balance = totalDeposits - totalWithdrawals;

    res.json({
      representative: rep,
      summary: {
        cashDeposits,
        bankTransferDeposits,
        totalDeposits,
        totalWithdrawals,
        cashBalance,
        balance
      },
      transactions: txResult.recordset
    });
  } catch (error) {
    console.error('Error fetching rep ledger:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كشف حساب المندوب' });
  }
});
// GET /api/reports/daily (Detailed daily report for manager)
app.get('/api/reports/daily', async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  if (!date) {
    return res.status(400).json({ error: 'التاريخ مطلوب لتوليد التقرير اليومي' });
  }

  try {
    const pool = getPool();
    
    // 1. Fetch safe initial settings
    const initialSettings = await pool.request()
      .query("SELECT key_name, val FROM settings WHERE key_name LIKE 'safe_initial_%'");
    
    const initialDenoms = {
      denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0
    };
    let safeInitialBalance = 0;
    let safeInitialBalanceSet = false;

    initialSettings.recordset.forEach(row => {
      if (row.key_name === 'safe_initial_balance') {
        safeInitialBalanceSet = true;
      }
      const match = row.key_name.match(/^safe_initial_denom_(\d+)$/);
      if (match) {
        const denom = parseInt(match[1]);
        initialDenoms[`denom_${denom}`] = parseInt(row.val) || 0;
      }
    });

    if (safeInitialBalanceSet) {
      safeInitialBalance = 
        (initialDenoms.denom_200 * 200) +
        (initialDenoms.denom_100 * 100) +
        (initialDenoms.denom_50 * 50) +
        (initialDenoms.denom_20 * 20) +
        (initialDenoms.denom_10 * 10) +
        (initialDenoms.denom_5 * 5) +
        (initialDenoms.denom_1 * 1);
    }

    // 2. Calculate safe balance BEFORE this date (Opening Safe Cash Balance)
    const safeBefore = await pool.request()
      .input('date', sql.VarChar, date)
      .query(`
        SELECT 
          ISNULL(SUM(CASE WHEN type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) THEN amount ELSE 0 END), 0) AS total_deposits,
          ISNULL(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) AS total_withdrawals
        FROM transactions
        WHERE CAST(date AS DATE) < CAST(@date AS DATE) AND (
          (type = 'deposit' AND (status IN ('approved', 'disbursed') OR status IS NULL))
          OR (type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL))
        )
      `);
    const openingSafeBalance = safeInitialBalance + Number(safeBefore.recordset[0].total_deposits) - Number(safeBefore.recordset[0].total_withdrawals);

    // 3. Fetch all transaction operations of the selected day
    const dayTransactions = await pool.request()
      .input('date', sql.VarChar, date)
      .query(`
        SELECT 
          t.id, t.rep_id, t.bank_id, t.company_id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.withdrawal_sub_type, t.status,
          r.name AS rep_name, r.code AS rep_code,
          b.name AS bank_name, b.code AS bank_code,
          c.name AS company_name, c.code AS company_code,
          u.username AS creator_name, u2.username AS approver_name
        FROM transactions t
        LEFT JOIN representatives r ON t.rep_id = r.id
        LEFT JOIN banks b ON t.bank_id = b.id
        LEFT JOIN companies c ON t.company_id = c.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users u2 ON t.approved_by = u2.id
        WHERE CAST(t.date AS DATE) = CAST(@date AS DATE)
        ORDER BY t.date ASC
      `);

    // 4. Fetch list of banks and compute their opening and closing balances for this day
    const banksList = await pool.request().query('SELECT id, name, code, initial_balance, account_number FROM banks ORDER BY name');
    
    const banksSummary = [];
    for (const bank of banksList.recordset) {
      // Calculate bank balance BEFORE this date (Opening Bank Balance)
      const bankBeforeDep = await pool.request()
        .input('bankId', sql.Int, bank.id)
        .input('date', sql.VarChar, date)
        .query(`
          SELECT ISNULL(SUM(CASE
            WHEN type = 'withdrawal' THEN amount
            WHEN type = 'deposit' AND payment_method = 'bank_transfer' THEN amount
            ELSE 0 END), 0) AS total
          FROM transactions
          WHERE bank_id = @bankId AND CAST(date AS DATE) < CAST(@date AS DATE) AND (
            (type = 'deposit' AND (status IN ('approved', 'disbursed') OR status IS NULL))
            OR (type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL))
          )
        `);
      const bankBeforeWd = await pool.request()
        .input('bankId', sql.Int, bank.id)
        .input('date', sql.VarChar, date)
        .query(`
          SELECT ISNULL(SUM(CASE
            WHEN type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) THEN amount
            WHEN type = 'company_transfer' THEN amount
            ELSE 0 END), 0) AS total
          FROM transactions
          WHERE bank_id = @bankId AND CAST(date AS DATE) < CAST(@date AS DATE) AND (
            (type = 'deposit' AND (status IN ('approved', 'disbursed') OR status IS NULL))
            OR (type = 'company_transfer' AND (status = 'approved' OR status IS NULL))
          )
        `);
      const openingBankBalance = Number(bank.initial_balance) + Number(bankBeforeDep.recordset[0].total) - Number(bankBeforeWd.recordset[0].total);

      // Fetch transfers of this bank on this day
      const dayBankDep = dayTransactions.recordset
        .filter(t => t.bank_id === bank.id && t.type === 'deposit' && t.payment_method === 'bank_transfer' && (t.status === 'approved' || t.status === 'disbursed' || t.status === null))
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const dayBankWithdrawalFromSafe = dayTransactions.recordset
        .filter(t => t.bank_id === bank.id && t.type === 'withdrawal' && (t.status === 'disbursed' || t.status === null))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const dayBankCashedOut = dayTransactions.recordset
        .filter(t => t.bank_id === bank.id && t.type === 'deposit' && (t.payment_method === 'cash' || t.payment_method === null) && (t.status === 'approved' || t.status === 'disbursed' || t.status === null))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const dayBankCompanyTransfer = dayTransactions.recordset
        .filter(t => t.bank_id === bank.id && t.type === 'company_transfer' && (t.status === 'approved' || t.status === null))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalDepositsThisDay = dayBankDep + dayBankWithdrawalFromSafe;
      const totalWithdrawalsThisDay = dayBankCashedOut + dayBankCompanyTransfer;
      const closingBankBalance = openingBankBalance + totalDepositsThisDay - totalWithdrawalsThisDay;

      banksSummary.push({
        id: bank.id,
        name: bank.name,
        code: bank.code,
        account_number: bank.account_number,
        openingBalance: openingBankBalance,
        deposits: totalDepositsThisDay,
        withdrawals: totalWithdrawalsThisDay,
        closingBalance: closingBankBalance
      });
    }

    // 5. Calculate safe metrics during this day
    const dayCashDeposits = dayTransactions.recordset
      .filter(t => t.type === 'deposit' && (t.payment_method === 'cash' || t.payment_method === null) && (t.status === 'approved' || t.status === 'disbursed' || t.status === null))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const dayCashWithdrawals = dayTransactions.recordset
      .filter(t => t.type === 'withdrawal' && (t.status === 'disbursed' || t.status === null))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const closingSafeBalance = openingSafeBalance + dayCashDeposits - dayCashWithdrawals;

    res.json({
      date,
      safeSummary: {
        openingBalance: openingSafeBalance,
        deposits: dayCashDeposits,
        withdrawals: dayCashWithdrawals,
        closingBalance: closingSafeBalance
      },
      banksSummary,
      transactions: dayTransactions.recordset
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إعداد التقرير اليومي' });
  }
});

// 5. GET /api/transactions (All transactions with filters)
app.get('/api/transactions', async (req, res) => {
  const { type, rep_id, bank_id, start_date, end_date, withdrawal_sub_type, status } = req.query;
  const userRole = req.headers['x-user-role'];
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);
  
  try {
    const pool = getPool();
    let query = `
      SELECT t.id, t.rep_id, t.bank_id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.withdrawal_sub_type, t.status,
             t.denom_200, t.denom_100, t.denom_50, t.denom_20, t.denom_10, t.denom_5, t.denom_1,
             r.name AS rep_name, r.code AS rep_code,
             b.name AS bank_name, b.code AS bank_code,
             a.name AS agency_name, a.code AS agency_code,
             s.name AS supervisor_name, s.code AS supervisor_code,
             u.username AS creator_name, u2.username AS approver_name
      FROM transactions t
      LEFT JOIN representatives r ON t.rep_id = r.id
      LEFT JOIN banks b ON t.bank_id = b.id
      LEFT JOIN agencies a ON (r.agency_id = a.id OR t.agency_id = a.id)
      LEFT JOIN supervisors s ON r.supervisor_id = s.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      WHERE 1=1
    `;

    const request = pool.request();

    if (userRole === 'accountant' && !isNaN(userAgencyId)) {
      query += ` AND (r.agency_id = @userAgencyId OR t.agency_id = @userAgencyId) `;
      request.input('userAgencyId', sql.Int, userAgencyId);
    }

    if (type) {
      query += ` AND t.type = @type`;
      request.input('type', sql.VarChar, type);
    }

    if (rep_id) {
      query += ` AND t.rep_id = @rep_id`;
      request.input('rep_id', sql.Int, rep_id);
    }

    if (bank_id) {
      query += ` AND t.bank_id = @bank_id`;
      request.input('bank_id', sql.Int, bank_id);
    }

    if (status) {
      query += ` AND t.status = @status`;
      request.input('status', sql.VarChar, status);
    }

    if (withdrawal_sub_type) {
      if (withdrawal_sub_type === 'car') {
        query += ` AND (t.withdrawal_sub_type = 'car' OR t.withdrawal_sub_type LIKE 'car_%')`;
      } else {
        query += ` AND t.withdrawal_sub_type = @withdrawal_sub_type`;
        request.input('withdrawal_sub_type', sql.VarChar, withdrawal_sub_type);
      }
    }

    if (start_date) {
      query += ` AND t.date >= @start_date`;
      request.input('start_date', sql.VarChar, start_date + ' 00:00:00');
    }

    if (end_date) {
      query += ` AND t.date <= @end_date`;
      request.input('end_date', sql.VarChar, end_date + ' 23:59:59');
    }

    query += ` ORDER BY t.date DESC`;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المعاملات' });
  }
});
// 6. POST /api/transactions (Add deposit with denominations check or withdrawal)
app.post('/api/transactions', async (req, res) => {
  const { rep_id, bank_id, agency_id, company_id, type, amount, notes, denominations, payment_method, cash_amount, bank_transfer_amount, receipt_image_bank, withdrawal_sub_type, incomingDenominations, outgoingDenominations } = req.body;
  const userRole = req.headers['x-user-role'];
  const userId = parseInt(req.headers['x-user-id']);
  const userAgencyId = parseInt(req.headers['x-user-agency-id']);

  if (!type) {
    return res.status(400).json({ error: 'نوع العملية مطلوب' });
  }

  if (type !== 'deposit' && type !== 'withdrawal' && type !== 'exchange' && type !== 'company_transfer') {
    return res.status(400).json({ error: 'نوع العملية غير صالح. يجب أن يكون توريد، صرف، تسوية، أو تحويل لشركة' });
  }

  try {
    const pool = getPool();
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const targetRepId = (userRole === 'representative') ? userId : (rep_id || null);

    // 1. If targetRepId is provided, verify representative exists
    if (targetRepId) {
      const repCheck = await pool.request()
        .input('repId', sql.Int, targetRepId)
        .query('SELECT id FROM representatives WHERE id = @repId');

      if (repCheck.recordset.length === 0) {
        return res.status(404).json({ error: 'المندوب المحدد غير موجود' });
      }
    }

    // Resolve agency
    let resolvedAgencyId = agency_id || null;
    if (targetRepId) {
      const repCheck = await pool.request()
        .input('repId', sql.Int, targetRepId)
        .query('SELECT agency_id FROM representatives WHERE id = @repId');
      if (repCheck.recordset.length > 0) {
        resolvedAgencyId = repCheck.recordset[0].agency_id;
      }
    }

    // Determine status (all withdrawals start as 'pending' and require manager approval)
    let statusVal = 'approved';
    if (type === 'withdrawal') {
      statusVal = 'pending';
    } else if (type === 'deposit') {
      statusVal = (userRole === 'representative' ? 'pending_receipt' : 'approved');
    } else if (type === 'exchange') {
      statusVal = (userRole === 'manager' ? 'approved' : 'pending');
    } else if (type === 'company_transfer') {
      statusVal = (userRole === 'manager' ? 'approved' : 'pending');
    }

    // CHECK FOR EXCHANGE MODE
    if (type === 'exchange') {
      if (!incomingDenominations || !outgoingDenominations) {
        return res.status(400).json({ error: 'الفئات النقدية المستلمة والمسلمة مطلوبة لعملية التسوية' });
      }

      const i200 = Number(incomingDenominations.denom_200) || 0;
      const i100 = Number(incomingDenominations.denom_100) || 0;
      const i50  = Number(incomingDenominations.denom_50)  || 0;
      const i20  = Number(incomingDenominations.denom_20)  || 0;
      const i10  = Number(incomingDenominations.denom_10)  || 0;
      const i5   = Number(incomingDenominations.denom_5)   || 0;
      const i1   = Number(incomingDenominations.denom_1)   || 0;

      const o200 = Number(outgoingDenominations.denom_200) || 0;
      const o100 = Number(outgoingDenominations.denom_100) || 0;
      const o50  = Number(outgoingDenominations.denom_50)  || 0;
      const o20  = Number(outgoingDenominations.denom_20)  || 0;
      const o10  = Number(outgoingDenominations.denom_10)  || 0;
      const o5   = Number(outgoingDenominations.denom_5)   || 0;
      const o1   = Number(outgoingDenominations.denom_1)   || 0;

      if (i200 < 0 || i100 < 0 || i50 < 0 || i20 < 0 || i10 < 0 || i5 < 0 || i1 < 0 ||
          o200 < 0 || o100 < 0 || o50 < 0 || o20 < 0 || o10 < 0 || o5 < 0 || o1 < 0) {
        return res.status(400).json({ error: 'لا يمكن إدخال قيم سالبة لفئات العملات' });
      }

      const incomingTotal = (i200 * 200) + (i100 * 100) + (i50 * 50) + (i20 * 20) + (i10 * 10) + (i5 * 5) + (i1 * 1);
      const outgoingTotal = (o200 * 200) + (o100 * 100) + (o50 * 50) + (o20 * 20) + (o10 * 10) + (o5 * 5) + (o1 * 1);

      if (incomingTotal === 0) {
        return res.status(400).json({ error: 'يجب تحديد فئات نقدية صحيحة للتسوية' });
      }

      if (incomingTotal !== outgoingTotal) {
        return res.status(400).json({
          error: `قيمة الفئات المستلمة (${incomingTotal.toLocaleString('ar-EG')} ج.م) لا تطابق قيمة الفئات المسلمة (${outgoingTotal.toLocaleString('ar-EG')} ج.م).`
        });
      }

      // Calculate net change for denominations
      const net200 = i200 - o200;
      const net100 = i100 - o100;
      const net50  = i50  - o50;
      const net20  = i20  - o20;
      const net10  = i10  - o10;
      const net5   = i5   - o5;
      const net1   = i1   - o1;

      // Start transaction block to insert and check denominations
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        // If status is 'approved' (i.e. manager created it directly), we must check available denominations in safe
        if (statusVal === 'approved') {
          // Fetch safe initial balance settings
          const initialBalanceResult = await transaction.request()
            .query("SELECT key_name, val FROM settings WHERE key_name LIKE 'safe_initial_%'");

          const initialDenoms = {
            denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0
          };

          initialBalanceResult.recordset.forEach(row => {
            const match = row.key_name.match(/^safe_initial_denom_(\d+)$/);
            if (match) {
              const denom = parseInt(match[1]);
              initialDenoms[`denom_${denom}`] = parseInt(row.val) || 0;
            }
          });

          // Fetch sum of all approved denominations
          const denomsResult = await transaction.request().query(`
            SELECT 
              ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_200 WHEN t.type = 'withdrawal' THEN -t.denom_200 ELSE t.denom_200 END), 0) AS denom_200,
              ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_100 WHEN t.type = 'withdrawal' THEN -t.denom_100 ELSE t.denom_100 END), 0) AS denom_100,
              ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_50 WHEN t.type = 'withdrawal' THEN -t.denom_50 ELSE t.denom_50 END), 0) AS denom_50,
              ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_20 WHEN t.type = 'withdrawal' THEN -t.denom_20 ELSE t.denom_20 END), 0) AS denom_20,
              ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_10 WHEN t.type = 'withdrawal' THEN -t.denom_10 ELSE t.denom_10 END), 0) AS denom_10,
              ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_5 WHEN t.type = 'withdrawal' THEN -t.denom_5 ELSE t.denom_5 END), 0) AS denom_5,
              ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_1 WHEN t.type = 'withdrawal' THEN -t.denom_1 ELSE t.denom_1 END), 0) AS denom_1
            FROM transactions t WITH (UPDLOCK, TABLOCKX)
            WHERE (
              (t.type = 'deposit' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL))
              OR 
              (t.type = 'withdrawal' AND (t.status = 'disbursed' OR t.status IS NULL))
              OR
              (t.type = 'exchange' AND (t.status = 'approved' OR t.status IS NULL))
            )
          `);

          const denoms = [200, 100, 50, 20, 10, 5, 1];
          for (const denom of denoms) {
            const reqCount = outgoingDenominations[`denom_${denom}`] || 0;
            if (reqCount > 0) {
              const currentInDb = Number(denomsResult.recordset[0][`denom_${denom}`]) || 0;
              const currentInitial = initialDenoms[`denom_${denom}`] || 0;
              const totalAvailable = currentInDb + currentInitial;
              if (totalAvailable < reqCount) {
                await transaction.rollback();
                return res.status(400).json({
                  error: `رصيد فئة ${denom} ج.م بالخزينة الحالي هو ${totalAvailable} ورقة، وهو غير كافٍ لتسليم ${reqCount} ورقة المطلوب صرفها.`
                });
              }
            }
          }
        }

        // Insert exchange transaction
        const insertEx = await transaction.request()
          .input('rep_id', sql.Int, targetRepId)
          .input('bank_id', sql.Int, null)
          .input('agency_id', sql.Int, resolvedAgencyId)
          .input('type', sql.VarChar, 'exchange')
          .input('payment_method', sql.VarChar, 'cash')
          .input('amount', sql.Decimal(18, 2), incomingTotal)
          .input('date', sql.DateTime, date)
          .input('notes', sql.NVarChar, notes || 'تسوية فئات الخزينة')
          .input('denom_200', sql.Int, net200)
          .input('denom_100', sql.Int, net100)
          .input('denom_50', sql.Int, net50)
          .input('denom_20', sql.Int, net20)
          .input('denom_10', sql.Int, net10)
          .input('denom_5', sql.Int, net5)
          .input('denom_1', sql.Int, net1)
          .input('created_by', sql.Int, isNaN(userId) ? null : userId)
          .input('status', sql.VarChar, statusVal)
          .query(`
            INSERT INTO transactions (rep_id, bank_id, agency_id, type, payment_method, amount, date, notes, status, created_by, denom_200, denom_100, denom_50, denom_20, denom_10, denom_5, denom_1)
            OUTPUT INSERTED.id
            VALUES (@rep_id, @bank_id, @agency_id, @type, @payment_method, @amount, @date, @notes, @status, @created_by, @denom_200, @denom_100, @denom_50, @denom_20, @denom_10, @denom_5, @denom_1)
          `);

        const exchangeId = insertEx.recordset[0].id;
        await transaction.commit();

        const txDetailsResult = await pool.request()
          .input('id', sql.Int, exchangeId)
          .query(`
            SELECT t.id, t.rep_id, t.bank_id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.withdrawal_sub_type, t.status,
                   t.denom_200, t.denom_100, t.denom_50, t.denom_20, t.denom_10, t.denom_5, t.denom_1,
                   r.name AS rep_name, r.code AS rep_code,
                   b.name AS bank_name, b.code AS bank_code,
                   a.name AS agency_name, a.code AS agency_code,
                   s.name AS supervisor_name, s.code AS supervisor_code,
                   u.username AS creator_name, u2.username AS approver_name
            FROM transactions t
            LEFT JOIN representatives r ON t.rep_id = r.id
            LEFT JOIN banks b ON t.bank_id = b.id
            LEFT JOIN agencies a ON (r.agency_id = a.id OR t.agency_id = a.id)
            LEFT JOIN supervisors s ON r.supervisor_id = s.id
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN users u2 ON t.approved_by = u2.id
            WHERE t.id = @id
          `);

        return res.status(201).json({
          message: statusVal === 'approved' ? 'تم تسجيل التسوية بنجاح' : 'تم تقديم طلب التسوية بنجاح وبانتظار موافقة المدير',
          transaction: txDetailsResult.recordset[0]
        });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    // CHECK FOR SPLIT DEPOSIT MODE
    if (type === 'deposit' && (cash_amount !== undefined || bank_transfer_amount !== undefined)) {
      const cashAmt = Number(cash_amount) || 0;
      const bankAmt = Number(bank_transfer_amount) || 0;

      if (cashAmt < 0 || bankAmt < 0) {
        return res.status(400).json({ error: 'لا يمكن أن تكون قيمة المبالغ سالبة' });
      }

      if (cashAmt <= 0 && bankAmt <= 0) {
        return res.status(400).json({ error: 'يجب إدخال مبلغ صحيح للتوريد النقدي أو التحويل البنكي' });
      }

      // Validate bank account if there is a transfer portion
      if (bankAmt > 0) {
        if (!bank_id) {
          return res.status(400).json({ error: 'يجب تحديد الحساب البنكي للتوريد بالتحويل' });
        }
        const bankCheck = await pool.request()
          .input('bankId', sql.Int, bank_id)
          .query('SELECT id FROM banks WHERE id = @bankId');

        if (bankCheck.recordset.length === 0) {
          return res.status(404).json({ error: 'الحساب البنكي المحدد غير موجود' });
        }
      }

      // Validate cash denominations if there is a cash portion
      let d200 = 0, d100 = 0, d50 = 0, d20 = 0, d10 = 0, d5 = 0, d1 = 0;
      if (cashAmt > 0) {
        if (!denominations) {
          return res.status(400).json({ error: 'يجب تحديد الفئات النقدية للتوريد النقدي' });
        }
        d200 = Number(denominations.denom_200) || 0;
        d100 = Number(denominations.denom_100) || 0;
        d50 = Number(denominations.denom_50) || 0;
        d20 = Number(denominations.denom_20) || 0;
        d10 = Number(denominations.denom_10) || 0;
        d5 = Number(denominations.denom_5) || 0;
        d1 = Number(denominations.denom_1) || 0;

        if (d200 < 0 || d100 < 0 || d50 < 0 || d20 < 0 || d10 < 0 || d5 < 0 || d1 < 0) {
          return res.status(400).json({ error: 'لا يمكن إدخال قيم سالبة لفئات النقود' });
        }

        const calculatedTotal = (d200 * 200) + (d100 * 100) + (d50 * 50) + (d20 * 20) + (d10 * 10) + (d5 * 5) + (d1 * 1);
        if (Math.abs(calculatedTotal - cashAmt) > 0.01) {
          return res.status(400).json({
            error: `مجموع الفئات النقدية (${calculatedTotal.toLocaleString('ar-EG')} ج.م) لا يطابق قيمة المبلغ النقدي المراد توريده (${cashAmt.toLocaleString('ar-EG')} ج.م).`
          });
        }
      }

      // Execute Split Deposit within a Transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        let cashId = null;
        let bankId = null;

        // Insert Cash portion if any
        if (cashAmt > 0) {
          const cashNotes = notes ? `${notes} (نقدي)` : 'توريد نقدي بالخزينة';
          const insertCash = await transaction.request()
            .input('rep_id', sql.Int, targetRepId)
            .input('bank_id', sql.Int, null)
            .input('agency_id', sql.Int, resolvedAgencyId)
            .input('type', sql.VarChar, 'deposit')
            .input('payment_method', sql.VarChar, 'cash')
            .input('amount', sql.Decimal(18, 2), cashAmt)
            .input('date', sql.DateTime, date)
            .input('notes', sql.NVarChar, cashNotes)
            .input('denom_200', sql.Int, d200)
            .input('denom_100', sql.Int, d100)
            .input('denom_50', sql.Int, d50)
            .input('denom_20', sql.Int, d20)
            .input('denom_10', sql.Int, d10)
            .input('denom_5', sql.Int, d5)
            .input('denom_1', sql.Int, d1)
            .input('created_by', sql.Int, (userRole === 'representative' || isNaN(userId)) ? null : userId)
            .input('status', sql.VarChar, statusVal)
            .query(`
              INSERT INTO transactions (rep_id, bank_id, agency_id, type, payment_method, amount, date, notes, status, created_by, denom_200, denom_100, denom_50, denom_20, denom_10, denom_5, denom_1)
              OUTPUT INSERTED.id
              VALUES (@rep_id, @bank_id, @agency_id, @type, @payment_method, @amount, @date, @notes, @status, @created_by, @denom_200, @denom_100, @denom_50, @denom_20, @denom_10, @denom_5, @denom_1)
            `);
          cashId = insertCash.recordset[0].id;
        }

        // Insert Bank Transfer portion if any
        if (bankAmt > 0) {
          const bankNotes = notes ? `${notes} (تحويل كاش)` : 'تحويل كاش / بنكي مباشر';
          const insertBank = await transaction.request()
            .input('rep_id', sql.Int, targetRepId)
            .input('bank_id', sql.Int, bank_id)
            .input('agency_id', sql.Int, resolvedAgencyId)
            .input('type', sql.VarChar, 'deposit')
            .input('payment_method', sql.VarChar, 'bank_transfer')
            .input('amount', sql.Decimal(18, 2), bankAmt)
            .input('date', sql.DateTime, date)
            .input('notes', sql.NVarChar, bankNotes)
            .input('receipt_image', sql.NVarChar, receipt_image_bank || null)
            .input('denom_200', sql.Int, 0)
            .input('denom_100', sql.Int, 0)
            .input('denom_50', sql.Int, 0)
            .input('denom_20', sql.Int, 0)
            .input('denom_10', sql.Int, 0)
            .input('denom_5', sql.Int, 0)
            .input('denom_1', sql.Int, 0)
            .input('created_by', sql.Int, (userRole === 'representative' || isNaN(userId)) ? null : userId)
            .input('status', sql.VarChar, statusVal)
            .query(`
              INSERT INTO transactions (rep_id, bank_id, agency_id, type, payment_method, amount, date, notes, status, created_by, receipt_image, denom_200, denom_100, denom_50, denom_20, denom_10, denom_5, denom_1)
              OUTPUT INSERTED.id
              VALUES (@rep_id, @bank_id, @agency_id, @type, @payment_method, @amount, @date, @notes, @status, @created_by, @receipt_image, @denom_200, @denom_100, @denom_50, @denom_20, @denom_10, @denom_5, @denom_1)
            `);
          bankId = insertBank.recordset[0].id;
        }

        await transaction.commit();

        const createdTxs = [];
        const queryTxDetails = `
          SELECT t.id, t.rep_id, t.bank_id, t.type, t.payment_method, t.amount, t.date, t.notes, t.withdrawal_sub_type, t.status,
                 t.denom_200, t.denom_100, t.denom_50, t.denom_20, t.denom_10, t.denom_5, t.denom_1,
                 r.name AS rep_name, r.code AS rep_code,
                 b.name AS bank_name, b.code AS bank_code,
                 a.name AS agency_name, a.code AS agency_code,
                 s.name AS supervisor_name, s.code AS supervisor_code,
                 u.username AS creator_name, u2.username AS approver_name
          FROM transactions t
          LEFT JOIN representatives r ON t.rep_id = r.id
          LEFT JOIN banks b ON t.bank_id = b.id
          LEFT JOIN agencies a ON (r.agency_id = a.id OR t.agency_id = a.id)
          LEFT JOIN supervisors s ON r.supervisor_id = s.id
          LEFT JOIN users u ON t.created_by = u.id
          LEFT JOIN users u2 ON t.approved_by = u2.id
          WHERE t.id = @id
        `;

        if (cashId) {
          const cashTxResult = await pool.request()
            .input('id', sql.Int, cashId)
            .query(queryTxDetails);
          if (cashTxResult.recordset.length > 0) {
            createdTxs.push(cashTxResult.recordset[0]);
          }
        }
        if (bankId) {
          const bankTxResult = await pool.request()
            .input('id', sql.Int, bankId)
            .query(queryTxDetails);
          if (bankTxResult.recordset.length > 0) {
            createdTxs.push(bankTxResult.recordset[0]);
          }
        }

        return res.status(201).json({ 
          message: 'تم تسجيل التوريد بنجاح',
          transactions: createdTxs 
        });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    // FALLBACK TO SINGLE TRANSACTION MODE
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'المبلغ مطلوب وقيمة موجبة' });
    }

    const transactionAmount = Number(amount);
    const txPaymentMethod = (type === 'company_transfer' || (type === 'deposit' && payment_method === 'bank_transfer')) ? 'bank_transfer' : 'cash';
    let d200 = 0, d100 = 0, d50 = 0, d20 = 0, d10 = 0, d5 = 0, d1 = 0;
    if (txPaymentMethod === 'cash') {
      const isPendingWithdrawal = (type === 'withdrawal' && statusVal === 'pending');
      
      if (!isPendingWithdrawal) {
        if (!denominations) {
          return res.status(400).json({ error: 'يجب تحديد الفئات النقدية لهذه المعاملة' });
        }
        d200 = Number(denominations.denom_200) || 0;
        d100 = Number(denominations.denom_100) || 0;
        d50 = Number(denominations.denom_50) || 0;
        d20 = Number(denominations.denom_20) || 0;
        d10 = Number(denominations.denom_10) || 0;
        d5 = Number(denominations.denom_5) || 0;
        d1 = Number(denominations.denom_1) || 0;

        if (d200 < 0 || d100 < 0 || d50 < 0 || d20 < 0 || d10 < 0 || d5 < 0 || d1 < 0) {
          return res.status(400).json({ error: 'لا يمكن إدخال قيم سالبة لفئات النقود' });
        }

        const calculatedTotal = (d200 * 200) + (d100 * 100) + (d50 * 50) + (d20 * 20) + (d10 * 10) + (d5 * 5) + (d1 * 1);
        if (Math.abs(calculatedTotal - transactionAmount) > 0.01) {
          return res.status(400).json({
            error: `مجموع الفئات النقدية (${calculatedTotal.toLocaleString('ar-EG')} ج.م) لا يطابق قيمة المعاملة (${transactionAmount.toLocaleString('ar-EG')} ج.م).`
          });
        }
      }
    }

    // Execute single withdrawal or direct transaction inside a locked transaction block
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // 1.2. If bank_id is provided, verify bank exists inside transaction context
      if (bank_id) {
        const bankCheck = await transaction.request()
          .input('bankId', sql.Int, bank_id)
          .query('SELECT id FROM banks WHERE id = @bankId');

        if (bankCheck.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({ error: 'الحساب البنكي المحدد غير موجود' });
        }
      }

      // 1.3 If company_transfer, verify company exists and check bank balance if approved
      if (type === 'company_transfer') {
        if (!company_id) {
          await transaction.rollback();
          return res.status(400).json({ error: 'يجب تحديد الشركة المستلمة' });
        }
        if (!bank_id) {
          await transaction.rollback();
          return res.status(400).json({ error: 'يجب تحديد الحساب البنكي المصدر للتحويل' });
        }
        
        const companyCheck = await transaction.request()
          .input('companyId', sql.Int, company_id)
          .query('SELECT id FROM companies WHERE id = @companyId');

        if (companyCheck.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({ error: 'الشركة المحددة غير موجودة' });
        }

        // Calculate source bank account balance inside transaction with lock
        const depRes = await transaction.request()
          .input('bankId', sql.Int, bank_id)
          .query(`
            SELECT ISNULL(SUM(CASE
              WHEN type = 'withdrawal' THEN amount
              WHEN type = 'deposit' AND payment_method = 'bank_transfer' THEN amount
              ELSE 0 END), 0) AS total
            FROM transactions WITH (UPDLOCK, TABLOCKX)
            WHERE bank_id = @bankId AND (
              (type = 'deposit' AND (status IN ('approved', 'disbursed') OR status IS NULL))
              OR (type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL))
            )
          `);
        const wdRes = await transaction.request()
          .input('bankId', sql.Int, bank_id)
          .query(`
            SELECT ISNULL(SUM(CASE 
              WHEN type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) THEN amount 
              WHEN type = 'company_transfer' THEN amount
              ELSE 0 END), 0) AS total
            FROM transactions
            WHERE bank_id = @bankId AND (
              (type = 'deposit' AND (status IN ('approved', 'disbursed') OR status IS NULL))
              OR (type = 'company_transfer' AND (status = 'approved' OR status IS NULL))
            )
          `);
        const bankRes = await transaction.request()
          .input('bankId', sql.Int, bank_id)
          .query('SELECT initial_balance FROM banks WHERE id = @bankId');
        
        const initialBal = Number(bankRes.recordset[0].initial_balance) || 0;
        const totalDeposits = Number(depRes.recordset[0].total) || 0;
        const totalWithdrawals = Number(wdRes.recordset[0].total) || 0;
        const currentBankBalance = initialBal + totalDeposits - totalWithdrawals;

        if (currentBankBalance < transactionAmount) {
          await transaction.rollback();
          return res.status(400).json({
            error: `رصيد الحساب البنكي المتاح هو ${currentBankBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} جنيه مصري، وهو غير كافٍ لإتمام عملية التحويل للشركة بقيمة ${transactionAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} جنيه مصري.`
          });
        }
      }

      // 2. If withdrawal AND approved/disbursed, verify CASH safe balance (cash only) with table lock
      if (type === 'withdrawal' && (statusVal === 'approved' || statusVal === 'disbursed')) {
        const cashDepositsResult = await transaction.request().query(`
          SELECT ISNULL(SUM(amount), 0) AS total 
          FROM transactions WITH (UPDLOCK, TABLOCKX) 
          WHERE type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) AND (status IN ('approved', 'disbursed') OR status IS NULL)
        `);
        const withdrawalsResult = await transaction.request().query(`
          SELECT ISNULL(SUM(amount), 0) AS total 
          FROM transactions 
          WHERE type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL)
        `);

        const currentCashBalance = Number(cashDepositsResult.recordset[0].total) - Number(withdrawalsResult.recordset[0].total);

        if (currentCashBalance < transactionAmount) {
          await transaction.rollback();
          return res.status(400).json({
            error: `رصيد الخزينة النقدية الحالي هو ${currentCashBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} جنيه. الرصيد غير كافٍ لإتمام عملية الصرف بقيمة ${transactionAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} جنيه.`
          });
        }
      }

      // 3. Insert transaction
      const insertSingle = await transaction.request()
        .input('rep_id', sql.Int, targetRepId)
        .input('bank_id', sql.Int, bank_id || null)
        .input('company_id', sql.Int, company_id || null)
        .input('agency_id', sql.Int, resolvedAgencyId)
        .input('type', sql.VarChar, type)
        .input('payment_method', sql.VarChar, txPaymentMethod)
        .input('amount', sql.Decimal(18, 2), transactionAmount)
        .input('date', sql.DateTime, date)
        .input('notes', sql.NVarChar, notes || null)
        .input('withdrawal_sub_type', sql.NVarChar, withdrawal_sub_type || null)
        .input('denom_200', sql.Int, d200)
        .input('denom_100', sql.Int, d100)
        .input('denom_50', sql.Int, d50)
        .input('denom_20', sql.Int, d20)
        .input('denom_10', sql.Int, d10)
        .input('denom_5', sql.Int, d5)
        .input('denom_1', sql.Int, d1)
        .input('status', sql.VarChar, statusVal)
        .input('created_by', sql.Int, (userRole === 'representative' || isNaN(userId)) ? null : userId)
        .query(`
          INSERT INTO transactions (rep_id, bank_id, company_id, agency_id, type, payment_method, amount, date, notes, withdrawal_sub_type, denom_200, denom_100, denom_50, denom_20, denom_10, denom_5, denom_1, status, created_by)
          OUTPUT INSERTED.id
          VALUES (@rep_id, @bank_id, @company_id, @agency_id, @type, @payment_method, @amount, @date, @notes, @withdrawal_sub_type, @denom_200, @denom_100, @denom_50, @denom_20, @denom_10, @denom_5, @denom_1, @status, @created_by)
        `);
        
      const singleId = insertSingle.recordset[0].id;
      await transaction.commit();

      const txResult = await pool.request()
        .input('id', sql.Int, singleId)
        .query(`
          SELECT t.id, t.rep_id, t.bank_id, t.company_id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.withdrawal_sub_type, t.status,
                 t.denom_200, t.denom_100, t.denom_50, t.denom_20, t.denom_10, t.denom_5, t.denom_1,
                 r.name AS rep_name, r.code AS rep_code,
                 b.name AS bank_name, b.code AS bank_code,
                 c.name AS company_name, c.code AS company_code,
                 a.name AS agency_name, a.code AS agency_code,
                 s.name AS supervisor_name, s.code AS supervisor_code,
                 u.username AS creator_name, u2.username AS approver_name
          FROM transactions t
          LEFT JOIN representatives r ON t.rep_id = r.id
          LEFT JOIN banks b ON t.bank_id = b.id
          LEFT JOIN companies c ON t.company_id = c.id
          LEFT JOIN agencies a ON (r.agency_id = a.id OR t.agency_id = a.id)
          LEFT JOIN supervisors s ON r.supervisor_id = s.id
          LEFT JOIN users u ON t.created_by = u.id
          LEFT JOIN users u2 ON t.approved_by = u2.id
          WHERE t.id = @id
        `);

      res.status(201).json({ 
        message: statusVal === 'pending' 
          ? (type === 'company_transfer' ? 'تم تسجيل طلب التحويل للشركة وبانتظار موافقة المدير' : 'تم تسجيل طلب الصرف وبانتظار موافقة المدير') 
          : statusVal === 'pending_receipt' 
            ? 'تم تقديم طلب التوريد بنجاح وبانتظار استلام الحسابات' 
            : 'تم تسجيل العملية بنجاح',
        status: statusVal,
        transaction: txResult.recordset[0]
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ المعاملة' });
  }
});

// GET /api/transactions/pending (List all transactions with status 'pending') - Manager only
app.get('/api/transactions/pending', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT t.id, t.rep_id, t.bank_id, t.agency_id, t.type, t.payment_method, t.amount, t.date, t.notes, t.receipt_image, t.withdrawal_sub_type, t.status,
             r.name AS rep_name, r.code AS rep_code,
             b.name AS bank_name, b.code AS bank_code,
             a.name AS agency_name, a.code AS agency_code,
             u.username AS creator_name, u2.username AS approver_name
      FROM transactions t
      LEFT JOIN representatives r ON t.rep_id = r.id
      LEFT JOIN banks b ON t.bank_id = b.id
      LEFT JOIN agencies a ON (r.agency_id = a.id OR t.agency_id = a.id)
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      WHERE t.status = 'pending'
      ORDER BY t.date DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الطلبات المعلقة' });
  }
});

// POST /api/transactions/:id/approve - Approve a pending withdrawal - Manager only
app.post('/api/transactions/:id/approve', async (req, res) => {
  const txId = req.params.id;
  const userId = parseInt(req.headers['x-user-id']);
  
  try {
    const pool = getPool();
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Find transaction
      const txResult = await transaction.request()
        .input('txId', sql.Int, txId)
        .query('SELECT * FROM transactions WITH (UPDLOCK) WHERE id = @txId');
        
      if (txResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'العملية غير موجودة' });
      }
      
      const tx = txResult.recordset[0];
      if (tx.status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({ error: 'هذه العملية تم البت فيها بالفعل' });
      }
      
      // Balance check for cash safe withdrawals
      if (tx.type === 'withdrawal') {
        const cashDepositsResult = await transaction.request().query(`
          SELECT ISNULL(SUM(amount), 0) AS total 
          FROM transactions WITH (UPDLOCK, TABLOCKX) 
          WHERE type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) AND (status IN ('approved', 'disbursed') OR status IS NULL)
        `);
        const withdrawalsResult = await transaction.request().query(`
          SELECT ISNULL(SUM(amount), 0) AS total 
          FROM transactions 
          WHERE type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL)
        `);
        
        const currentCashBalance = Number(cashDepositsResult.recordset[0].total) - Number(withdrawalsResult.recordset[0].total);
        
        if (currentCashBalance < Number(tx.amount)) {
          await transaction.rollback();
          return res.status(400).json({ 
            error: `لا يمكن الموافقة. رصيد الخزينة الحالي (${currentCashBalance.toLocaleString('ar-EG')} ج.م) أقل من مبلغ الصرف (${Number(tx.amount).toLocaleString('ar-EG')} ج.م).`
          });
        }
      }

      // Balance check for cash safe exchanges
      if (tx.type === 'exchange') {
        // Fetch safe initial balance settings
        const initialBalanceResult = await transaction.request()
          .query("SELECT key_name, val FROM settings WHERE key_name LIKE 'safe_initial_%'");

        const initialDenoms = {
          denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0
        };

        initialBalanceResult.recordset.forEach(row => {
          const match = row.key_name.match(/^safe_initial_denom_(\d+)$/);
          if (match) {
            const denom = parseInt(match[1]);
            initialDenoms[`denom_${denom}`] = parseInt(row.val) || 0;
          }
        });

        // Fetch sum of all approved denominations
        const denomsResult = await transaction.request().query(`
          SELECT 
            ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_200 WHEN t.type = 'withdrawal' THEN -t.denom_200 ELSE t.denom_200 END), 0) AS denom_200,
            ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_100 WHEN t.type = 'withdrawal' THEN -t.denom_100 ELSE t.denom_100 END), 0) AS denom_100,
            ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_50 WHEN t.type = 'withdrawal' THEN -t.denom_50 ELSE t.denom_50 END), 0) AS denom_50,
            ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_20 WHEN t.type = 'withdrawal' THEN -t.denom_20 ELSE t.denom_20 END), 0) AS denom_20,
            ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_10 WHEN t.type = 'withdrawal' THEN -t.denom_10 ELSE t.denom_10 END), 0) AS denom_10,
            ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_5 WHEN t.type = 'withdrawal' THEN -t.denom_5 ELSE t.denom_5 END), 0) AS denom_5,
            ISNULL(SUM(CASE WHEN t.type = 'deposit' THEN t.denom_1 WHEN t.type = 'withdrawal' THEN -t.denom_1 ELSE t.denom_1 END), 0) AS denom_1
          FROM transactions t WITH (UPDLOCK, TABLOCKX)
          WHERE (
            (t.type = 'deposit' AND (t.status IN ('approved', 'disbursed') OR t.status IS NULL))
            OR 
            (t.type = 'withdrawal' AND (t.status = 'disbursed' OR t.status IS NULL))
            OR
            (t.type = 'exchange' AND (t.status = 'approved' OR t.status IS NULL))
          )
        `);

        // Outgoing denominations are negative values in tx
        const outgoingDenoms = {
          200: tx.denom_200 < 0 ? Math.abs(tx.denom_200) : 0,
          100: tx.denom_100 < 0 ? Math.abs(tx.denom_100) : 0,
          50:  tx.denom_50  < 0 ? Math.abs(tx.denom_50)  : 0,
          20:  tx.denom_20  < 0 ? Math.abs(tx.denom_20)  : 0,
          10:  tx.denom_10  < 0 ? Math.abs(tx.denom_10)  : 0,
          5:   tx.denom_5   < 0 ? Math.abs(tx.denom_5)   : 0,
          1:   tx.denom_1   < 0 ? Math.abs(tx.denom_1)   : 0,
        };

        const denoms = [200, 100, 50, 20, 10, 5, 1];
        for (const denom of denoms) {
          const reqCount = outgoingDenoms[denom];
          if (reqCount > 0) {
            const currentInDb = Number(denomsResult.recordset[0][`denom_${denom}`]) || 0;
            const currentInitial = initialDenoms[`denom_${denom}`] || 0;
            const totalAvailable = currentInDb + currentInitial;
            if (totalAvailable < reqCount) {
              await transaction.rollback();
              return res.status(400).json({
                error: `لا يمكن الموافقة على طلب الفك. رصيد فئة ${denom} ج.م بالخزينة الحالي هو ${totalAvailable} ورقة، وهو غير كافٍ لتسليم ${reqCount} ورقة المطلوب صرفها.`
              });
            }
          }
        }
      }

      // Balance check for bank-to-company transfers
      if (tx.type === 'company_transfer') {
        const bankId = tx.bank_id;
        if (!bankId) {
          await transaction.rollback();
          return res.status(400).json({ error: 'الحساب البنكي غير محدد لهذه المعاملة' });
        }
        
        // Calculate source bank account balance inside transaction with lock
        const depRes = await transaction.request()
          .input('bankId', sql.Int, bankId)
          .query(`
            SELECT ISNULL(SUM(CASE
              WHEN type = 'withdrawal' THEN amount
              WHEN type = 'deposit' AND payment_method = 'bank_transfer' THEN amount
              ELSE 0 END), 0) AS total
            FROM transactions WITH (UPDLOCK, TABLOCKX)
            WHERE bank_id = @bankId AND (
              (type = 'deposit' AND (status IN ('approved', 'disbursed') OR status IS NULL))
              OR (type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL))
            )
          `);
        const wdRes = await transaction.request()
          .input('bankId', sql.Int, bankId)
          .query(`
            SELECT ISNULL(SUM(CASE 
              WHEN type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) THEN amount 
              WHEN type = 'company_transfer' THEN amount
              ELSE 0 END), 0) AS total
            FROM transactions
            WHERE bank_id = @bankId AND (
              (type = 'deposit' AND (status IN ('approved', 'disbursed') OR status IS NULL))
              OR (type = 'company_transfer' AND (status = 'approved' OR status IS NULL))
            )
          `);
        const bankRes = await transaction.request()
          .input('bankId', sql.Int, bankId)
          .query('SELECT initial_balance FROM banks WHERE id = @bankId');
        
        const initialBal = Number(bankRes.recordset[0].initial_balance) || 0;
        const totalDeposits = Number(depRes.recordset[0].total) || 0;
        const totalWithdrawals = Number(wdRes.recordset[0].total) || 0;
        const currentBankBalance = initialBal + totalDeposits - totalWithdrawals;

        if (currentBankBalance < Number(tx.amount)) {
          await transaction.rollback();
          return res.status(400).json({
            error: `لا يمكن الموافقة. رصيد الحساب البنكي الحالي هو ${currentBankBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م وهو غير كافٍ لإتمام عملية التحويل للشركة بقيمة ${Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م.`
          });
        }
      }
      
      // Update status to approved
      await transaction.request()
        .input('txId', sql.Int, txId)
        .input('approvedBy', sql.Int, isNaN(userId) ? null : userId)
        .query(`
          UPDATE transactions 
          SET status = 'approved', approved_by = @approvedBy 
          WHERE id = @txId
        `);
        
      await transaction.commit();
      res.json({ message: 'تمت الموافقة على العملية بنجاح' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error approving transaction:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء الموافقة على العملية' });
  }
});

// POST /api/transactions/:id/reject - Reject a pending withdrawal - Manager only
app.post('/api/transactions/:id/reject', async (req, res) => {
  const txId = req.params.id;
  try {
    const pool = getPool();
    const checkTx = await pool.request()
      .input('txId', sql.Int, txId)
      .query('SELECT status FROM transactions WHERE id = @txId');
      
    if (checkTx.recordset.length === 0) {
      return res.status(404).json({ error: 'العملية غير موجودة' });
    }
    
    if (checkTx.recordset[0].status !== 'pending') {
      return res.status(400).json({ error: 'هذه العملية تم البت فيها بالفعل' });
    }
    
    await pool.request()
      .input('txId', sql.Int, txId)
      .query("UPDATE transactions SET status = 'rejected' WHERE id = @txId");
      
    res.json({ message: 'تم رفض العملية بنجاح' });
  } catch (error) {
    console.error('Error rejecting transaction:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء رفض العملية' });
  }
});

// POST /api/transactions/:id/receive - Confirm receipt of a pending deposit - Accountant/Manager only
app.post('/api/transactions/:id/receive', async (req, res) => {
  const txId = req.params.id;
  const userId = parseInt(req.headers['x-user-id']);
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'accountant' && userRole !== 'manager') {
    return res.status(403).json({ error: 'غير مسموح لغير المحاسبين والمديرين بتأكيد استلام التوريدات' });
  }
  
  try {
    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Find transaction
      const txResult = await transaction.request()
        .input('txId', sql.Int, txId)
        .query('SELECT * FROM transactions WITH (UPDLOCK) WHERE id = @txId');
        
      if (txResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'العملية غير موجودة' });
      }
      
      const tx = txResult.recordset[0];
      if (tx.type !== 'deposit') {
        await transaction.rollback();
        return res.status(400).json({ error: 'تأكيد الاستلام متاح لعمليات الإيداع والتوريد فقط' });
      }
      
      if (tx.status !== 'pending_receipt') {
        await transaction.rollback();
        return res.status(400).json({ error: 'هذه العملية تم استلامها أو البت فيها بالفعل' });
      }
      
      // Update status to approved
      await transaction.request()
        .input('txId', sql.Int, txId)
        .input('approvedBy', sql.Int, isNaN(userId) ? null : userId)
        .query(`
          UPDATE transactions 
          SET status = 'approved', approved_by = @approvedBy 
          WHERE id = @txId
        `);
        
      await transaction.commit();
      res.json({ message: 'تم تأكيد استلام المبلغ بنجاح وإضافته إلى رصيد المندوب والخزينة' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error receiving transaction:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تأكيد استلام العملية' });
  }
});

// POST /api/transactions/:id/disburse - Finalize a withdrawal - Manager/Accountant
app.post('/api/transactions/:id/disburse', async (req, res) => {
  const txId = req.params.id;
  const { denominations } = req.body;
  try {
    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const txResult = await transaction.request()
        .input('txId', sql.Int, txId)
        .query('SELECT * FROM transactions WITH (UPDLOCK) WHERE id = @txId');
        
      if (txResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'العملية غير موجودة' });
      }
      
      const tx = txResult.recordset[0];
      if (tx.type !== 'withdrawal') {
        await transaction.rollback();
        return res.status(400).json({ error: 'تأكيد التسليم متاح لحركات الصرف فقط' });
      }
      
      if (tx.status !== 'approved') {
        await transaction.rollback();
        return res.status(400).json({ error: 'يجب أن تكون العملية معتمدة من المدير أولاً لإتمام صرفها' });
      }

      if (!denominations) {
        await transaction.rollback();
        return res.status(400).json({ error: 'يجب تحديد الفئات النقدية لإتمام عملية الصرف' });
      }

      const d200 = Number(denominations.denom_200) || 0;
      const d100 = Number(denominations.denom_100) || 0;
      const d50 = Number(denominations.denom_50) || 0;
      const d20 = Number(denominations.denom_20) || 0;
      const d10 = Number(denominations.denom_10) || 0;
      const d5 = Number(denominations.denom_5) || 0;
      const d1 = Number(denominations.denom_1) || 0;

      if (d200 < 0 || d100 < 0 || d50 < 0 || d20 < 0 || d10 < 0 || d5 < 0 || d1 < 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'لا يمكن إدخال قيم سالبة لفئات النقود' });
      }
      
      // Perform balance check at the time of final disbursement (only disbursed withdrawals reduce balance)
      const cashDepositsResult = await transaction.request().query(`
        SELECT ISNULL(SUM(amount), 0) AS total 
        FROM transactions WITH (UPDLOCK, TABLOCKX) 
        WHERE type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) AND (status IN ('approved', 'disbursed') OR status IS NULL)
      `);
      const withdrawalsResult = await transaction.request().query(`
        SELECT ISNULL(SUM(amount), 0) AS total 
        FROM transactions 
        WHERE type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL)
      `);
      
      const currentCashBalance = Number(cashDepositsResult.recordset[0].total) - Number(withdrawalsResult.recordset[0].total);
      const txAmount = Number(tx.amount);

      const calculatedTotal = (d200 * 200) + (d100 * 100) + (d50 * 50) + (d20 * 20) + (d10 * 10) + (d5 * 5) + (d1 * 1);
      if (Math.abs(calculatedTotal - txAmount) > 0.01) {
        await transaction.rollback();
        return res.status(400).json({
          error: `مجموع الفئات النقدية (${calculatedTotal.toLocaleString('ar-EG')} ج.م) لا يطابق قيمة المبلغ المراد صرفه (${txAmount.toLocaleString('ar-EG')} ج.م).`
        });
      }
      
      if (currentCashBalance < txAmount) {
        await transaction.rollback();
        return res.status(400).json({
          error: `تعذر إتمام الصرف. رصيد الخزينة الحالي (${currentCashBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م) أقل من قيمة المبلغ المطلوب تسليمه (${txAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م).`
        });
      }
      
      // Update status to disbursed and save the denominations
      await transaction.request()
        .input('txId', sql.Int, txId)
        .input('denom_200', sql.Int, d200)
        .input('denom_100', sql.Int, d100)
        .input('denom_50', sql.Int, d50)
        .input('denom_20', sql.Int, d20)
        .input('denom_10', sql.Int, d10)
        .input('denom_5', sql.Int, d5)
        .input('denom_1', sql.Int, d1)
        .query(`
          UPDATE transactions 
          SET status = 'disbursed',
              denom_200 = @denom_200,
              denom_100 = @denom_100,
              denom_50 = @denom_50,
              denom_20 = @denom_20,
              denom_10 = @denom_10,
              denom_5 = @denom_5,
              denom_1 = @denom_1
          WHERE id = @txId
        `);
        
      await transaction.commit();
      res.json({ message: 'تم إتمام عملية الصرف الفعلي وتسليم المبالغ بنجاح' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error disbursing transaction:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إتمام عملية الصرف' });
  }
});

// PUT /api/transactions/:id - Edit transaction details - Manager only
app.put('/api/transactions/:id', async (req, res) => {
  const txId = req.params.id;
  const { amount, notes, denominations, rep_id, bank_id, agency_id, withdrawal_sub_type } = req.body;
  
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'المبلغ يجب أن يكون قيمة موجبة' });
  }
  
  try {
    const pool = getPool();
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Fetch current transaction
      const txResult = await transaction.request()
        .input('txId', sql.Int, txId)
        .query('SELECT * FROM transactions WITH (UPDLOCK) WHERE id = @txId');
        
      if (txResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'العملية غير موجودة' });
      }
      
      const tx = txResult.recordset[0];
      
      if (tx.type === 'exchange') {
        if (Number(amount) !== Number(tx.amount)) {
          await transaction.rollback();
          return res.status(400).json({ error: 'لا يمكن تعديل قيمة مبلغ عملية تسوية الخزينة' });
        }
      }
      
      // Resolve agency
      let resolvedAgencyId = agency_id || tx.agency_id;
      if (rep_id) {
        const repCheck = await transaction.request()
          .input('repId', sql.Int, rep_id)
          .query('SELECT agency_id FROM representatives WHERE id = @repId');
        if (repCheck.recordset.length > 0) {
          resolvedAgencyId = repCheck.recordset[0].agency_id;
        }
      }
      
      // Validate denominations if it's a cash deposit
      let d200 = tx.denom_200, d100 = tx.denom_100, d50 = tx.denom_50, d20 = tx.denom_20, d10 = tx.denom_10, d5 = tx.denom_5, d1 = tx.denom_1;
      if ((tx.type === 'deposit' || tx.type === 'withdrawal') && (tx.payment_method === 'cash' || !tx.payment_method)) {
        if (denominations) {
          d200 = Number(denominations.denom_200) || 0;
          d100 = Number(denominations.denom_100) || 0;
          d50 = Number(denominations.denom_50) || 0;
          d20 = Number(denominations.denom_20) || 0;
          d10 = Number(denominations.denom_10) || 0;
          d5 = Number(denominations.denom_5) || 0;
          d1 = Number(denominations.denom_1) || 0;
          
          if (d200 < 0 || d100 < 0 || d50 < 0 || d20 < 0 || d10 < 0 || d5 < 0 || d1 < 0) {
            await transaction.rollback();
            return res.status(400).json({ error: 'لا يمكن إدخال قيم سالبة لفئات النقود' });
          }
          
          const calculatedTotal = (d200 * 200) + (d100 * 100) + (d50 * 50) + (d20 * 20) + (d10 * 10) + (d5 * 5) + (d1 * 1);
          if (Math.abs(calculatedTotal - Number(amount)) > 0.01) {
            await transaction.rollback();
            return res.status(400).json({
              error: `مجموع الفئات النقدية (${calculatedTotal.toLocaleString('ar-EG')} ج.م) لا يطابق قيمة المبلغ المعدل (${Number(amount).toLocaleString('ar-EG')} ج.م).`
            });
          }
        }
      }
      
      // If it's an approved withdrawal and amount changes, verify balance
      if (tx.type === 'withdrawal' && (tx.status === 'approved' || tx.status === 'disbursed')) {
        const cashDepositsResult = await transaction.request().query(`
          SELECT ISNULL(SUM(amount), 0) AS total 
          FROM transactions WITH (UPDLOCK, TABLOCKX) 
          WHERE type = 'deposit' AND (payment_method = 'cash' OR payment_method IS NULL) AND (status IN ('approved', 'disbursed') OR status IS NULL)
        `);
        const withdrawalsResult = await transaction.request().query(`
          SELECT ISNULL(SUM(amount), 0) AS total 
          FROM transactions 
          WHERE type = 'withdrawal' AND (status = 'disbursed' OR status IS NULL) AND id <> @txId
        `);
        
        const currentCashBalance = Number(cashDepositsResult.recordset[0].total) - Number(withdrawalsResult.recordset[0].total);
        
        if (currentCashBalance < Number(amount)) {
          await transaction.rollback();
          return res.status(400).json({
            error: `رصيد الخزينة الحالي (${currentCashBalance.toLocaleString('ar-EG')} ج.م) غير كافٍ لتعديل مبلغ الصرف إلى (${Number(amount).toLocaleString('ar-EG')} ج.م).`
          });
        }
      }
      
      // Update transaction
      await transaction.request()
        .input('txId', sql.Int, txId)
        .input('amount', sql.Decimal(18, 2), Number(amount))
        .input('notes', sql.NVarChar, notes || null)
        .input('rep_id', sql.Int, rep_id || null)
        .input('bank_id', sql.Int, bank_id || null)
        .input('agency_id', sql.Int, resolvedAgencyId)
        .input('withdrawal_sub_type', sql.NVarChar, withdrawal_sub_type || null)
        .input('denom_200', sql.Int, d200)
        .input('denom_100', sql.Int, d100)
        .input('denom_50', sql.Int, d50)
        .input('denom_20', sql.Int, d20)
        .input('denom_10', sql.Int, d10)
        .input('denom_5', sql.Int, d5)
        .input('denom_1', sql.Int, d1)
        .query(`
          UPDATE transactions
          SET amount = @amount,
              notes = @notes,
              rep_id = @rep_id,
              bank_id = @bank_id,
              agency_id = @agency_id,
              withdrawal_sub_type = @withdrawal_sub_type,
              denom_200 = @denom_200,
              denom_100 = @denom_100,
              denom_50 = @denom_50,
              denom_20 = @denom_20,
              denom_10 = @denom_10,
              denom_5 = @denom_5,
              denom_1 = @denom_1
          WHERE id = @txId
        `);
        
      await transaction.commit();
      res.json({ message: 'تم تعديل العملية بنجاح' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تعديل العملية' });
  }
});

// POST /api/settings - Save or update settings - Manager only
app.post('/api/settings', async (req, res) => {
  const { settings } = req.body;
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'manager') {
    return res.status(403).json({ error: 'غير مسموح لغير المدراء بتعديل الإعدادات العامة' });
  }
  
  if (!settings || !Array.isArray(settings)) {
    return res.status(400).json({ error: 'بيانات الإعدادات غير صالحة' });
  }
  
  try {
    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      for (const s of settings) {
        const { key, value } = s;
        if (!key || value === undefined) {
          throw new Error('مفتاح الإعداد أو القيمة مفقودة');
        }
        
        // Check if key exists
        const checkKey = await transaction.request()
          .input('key', sql.VarChar, key)
          .query('SELECT key_name FROM settings WHERE key_name = @key');
          
        if (checkKey.recordset.length > 0) {
          await transaction.request()
            .input('key', sql.VarChar, key)
            .input('val', sql.NVarChar, String(value))
            .query('UPDATE settings SET val = @val, updated_at = GETDATE() WHERE key_name = @key');
        } else {
          await transaction.request()
            .input('key', sql.VarChar, key)
            .input('val', sql.NVarChar, String(value))
            .query('INSERT INTO settings (key_name, val) VALUES (@key, @val)');
        }
      }
      
      await transaction.commit();
      res.json({ message: 'تم حفظ الإعدادات بنجاح' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الإعدادات' });
  }
});

// DELETE /api/transactions/:id - Delete transaction - Manager only
app.delete('/api/transactions/:id', async (req, res) => {
  const txId = req.params.id;
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'manager') {
    return res.status(403).json({ error: 'غير مسموح لغير المدراء بحذف العمليات' });
  }
  
  try {
    const pool = getPool();
    
    // Check if transaction exists
    const checkTx = await pool.request()
      .input('txId', sql.Int, txId)
      .query('SELECT id FROM transactions WHERE id = @txId');
      
    if (checkTx.recordset.length === 0) {
      return res.status(404).json({ error: 'العملية غير موجودة' });
    }
    
    // Delete transaction
    await pool.request()
      .input('txId', sql.Int, txId)
      .query('DELETE FROM transactions WHERE id = @txId');
      
    res.json({ message: 'تم حذف العملية بنجاح' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف العملية' });
  }
});

// Start Database connection and then Express server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed. Exiting server...');
    process.exit(1);
  });
