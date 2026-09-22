import React, { useState, useEffect } from 'react';

export default function OwnerAccountManagement({ banks = [], userRole = 'manager', onRefreshDashboard }) {
  const [summary, setSummary] = useState({ total_deposited: 0, total_repaid: 0, net_owed: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search and Filters
  const [filterType, setFilterType] = useState('all'); // all, owner_funding, owner_repayment
  const [filterBank, setFilterBank] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Edit State
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    bank_id: '',
    payment_method: 'bank_transfer',
    purpose_type: 'loan_installment',
    purpose_notes: '',
    notes: '',
    date: '',
    receipt_image: ''
  });

  // Form states
  const [depositForm, setDepositForm] = useState({
    amount: '',
    bank_id: '', // empty means safe (cash)
    payment_method: 'bank_transfer',
    purpose_type: 'loan_installment',
    purpose_notes: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    receipt_image: ''
  });

  const [repayForm, setRepayForm] = useState({
    amount: '',
    bank_id: '', // empty means safe (cash)
    payment_method: 'bank_transfer',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    receipt_image: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sumRes, txRes] = await Promise.all([
        fetch('/api/owner-account/summary'),
        fetch('/api/owner-account/transactions')
      ]);

      if (sumRes.ok && txRes.ok) {
        const sumData = await sumRes.ok ? await sumRes.json() : { total_deposited: 0, total_repaid: 0, net_owed: 0 };
        const txData = await txRes.ok ? await txRes.json() : [];
        setSummary(sumData);
        setTransactions(txData);
      } else {
        setError('حدث خطأ أثناء جلب بيانات حساب جاري المالك');
      }
    } catch (err) {
      console.error('Error fetching owner account data:', err);
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    const amt = parseFloat(depositForm.amount);
    if (!amt || amt <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/owner-account/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...depositForm,
          payment_method: depositForm.bank_id ? 'bank_transfer' : 'cash'
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('تم تسجيل إيداع التمويل الشخصي بنجاح!');
        setShowDepositModal(false);
        setDepositForm({
          amount: '',
          bank_id: '',
          payment_method: 'bank_transfer',
          purpose_type: 'loan_installment',
          purpose_notes: '',
          notes: '',
          date: new Date().toISOString().split('T')[0],
          receipt_image: ''
        });
        fetchData();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setFormError(data.error || 'حدث خطأ أثناء تسجيل التمويل');
      }
    } catch (err) {
      setFormError('تعذر الاتصال بالسيرفر');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepaySubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    const amt = parseFloat(repayForm.amount);
    if (!amt || amt <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    if (amt > summary.net_owed) {
      setFormError(`المبلغ المطلوب سداده (${amt.toLocaleString('ar-EG')} ج.م) يتجاوز إجمالي مستحقات المالك الحالية (${summary.net_owed.toLocaleString('ar-EG')} ج.م)`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/owner-account/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...repayForm,
          payment_method: repayForm.bank_id ? 'bank_transfer' : 'cash'
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('تم تسجيل سداد مستحقات صاحب الشركة بنجاح!');
        setShowRepayModal(false);
        setRepayForm({
          amount: '',
          bank_id: '',
          payment_method: 'bank_transfer',
          notes: '',
          date: new Date().toISOString().split('T')[0],
          receipt_image: ''
        });
        fetchData();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setFormError(data.error || 'حدث خطأ أثناء تسجيل عملية السداد');
      }
    } catch (err) {
      setFormError('تعذر الاتصال بالسيرفر');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (tx) => {
    setEditingTx(tx);
    setEditForm({
      amount: tx.amount,
      bank_id: tx.bank_id ? String(tx.bank_id) : '',
      payment_method: tx.payment_method || (tx.bank_id ? 'bank_transfer' : 'cash'),
      purpose_type: tx.purpose_type || 'loan_installment',
      purpose_notes: tx.purpose_notes || '',
      notes: tx.notes || '',
      date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      receipt_image: tx.receipt_image || ''
    });
    setFormError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;
    setFormError('');
    setSuccessMsg('');

    const amt = parseFloat(editForm.amount);
    if (!amt || amt <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/owner-account/transactions/${editingTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          payment_method: editForm.bank_id ? 'bank_transfer' : 'cash'
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('تم تعديل العملية وتحديث حساب جاري المالك بنجاح!');
        setEditingTx(null);
        fetchData();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setFormError(data.error || 'حدث خطأ أثناء تعديل العملية');
      }
    } catch (err) {
      setFormError('تعذر الاتصال بالسيرفر');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = (e, formType) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (formType === 'deposit') {
        setDepositForm(prev => ({ ...prev, receipt_image: reader.result }));
      } else if (formType === 'repay') {
        setRepayForm(prev => ({ ...prev, receipt_image: reader.result }));
      } else if (formType === 'edit') {
        setEditForm(prev => ({ ...prev, receipt_image: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const getPurposeLabel = (type, notes) => {
    switch (type) {
      case 'loan_installment':
        return { label: '🏦 سداد قسط قرض / التزام بنكي', color: 'badge-company-transfer' };
      case 'supplier_payment':
        return { label: '🚚 سداد فواتير موردين / شركات', color: 'badge-secondary' };
      case 'payroll':
        return { label: '💵 مسير رواتب موظفين', color: 'badge-primary' };
      case 'general_liquidity':
        return { label: '🔄 تغطية سيولة عامة', color: 'badge-info' };
      default:
        return { label: notes || '📌 غرض مخصص', color: 'badge-secondary' };
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filterType !== 'all' && tx.withdrawal_sub_type !== filterType) return false;
    if (filterBank !== 'all') {
      if (filterBank === 'safe' && tx.bank_id) return false;
      if (filterBank !== 'safe' && String(tx.bank_id) !== filterBank) return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const notesMatch = tx.notes?.toLowerCase().includes(term);
      const purposeMatch = tx.purpose_notes?.toLowerCase().includes(term);
      const bankMatch = tx.bank_name?.toLowerCase().includes(term);
      const amountMatch = String(tx.amount).includes(term);
      return notesMatch || purposeMatch || bankMatch || amountMatch;
    }
    return true;
  });

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <div className="panel owner-account-panel">
      {/* Header */}
      <div className="panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="panel-title">🏛️ حساب جاري المالك (التمويلات الشخصية والسدادات)</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            تتبع ودراسة المبالغ الشخصية الضخها صاحب الشركة لتغطية البنوك والخزينة واستردادها بدقة
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => { setShowDepositModal(true); setFormError(''); }}>
            📥 تسجيل تمويل شخصي (إيداع)
          </button>
          {userRole === 'manager' && (
            <button className="btn btn-secondary" onClick={() => { setShowRepayModal(true); setFormError(''); }}>
              📤 سداد لصاحب الشركة
            </button>
          )}
          <button className="btn btn-secondary" onClick={handlePrintLedger}>
            🖨️ طباعة كشف الحساب
          </button>
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Summary KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderRight: '4px solid #10b981' }}>
          <div className="stat-header">
            <span className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>💰</span>
            <span className="stat-title">إجمالي التمويلات المودعة</span>
          </div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            {summary.total_deposited.toLocaleString('ar-EG')} <span className="stat-unit">ج.م</span>
          </div>
          <div className="stat-desc">مجموع ما ضخه المالك لحسابات الشركة</div>
        </div>

        <div className="stat-card" style={{ borderRight: '4px solid #ef4444' }}>
          <div className="stat-header">
            <span className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>🔄</span>
            <span className="stat-title">إجمالي المسدادات للمالك</span>
          </div>
          <div className="stat-value" style={{ color: '#ef4444' }}>
            {summary.total_repaid.toLocaleString('ar-EG')} <span className="stat-unit">ج.م</span>
          </div>
          <div className="stat-desc">مجموع المبالغ المستردة لصاحب الشركة</div>
        </div>

        <div className="stat-card" style={{ borderRight: '4px solid #f59e0b', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(15, 23, 42, 0.6))' }}>
          <div className="stat-header">
            <span className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>⚖️</span>
            <span className="stat-title">صافي المستحق لصاحب الشركة</span>
          </div>
          <div className="stat-value" style={{ color: '#f59e0b', fontSize: '1.8rem' }}>
            {summary.net_owed.toLocaleString('ar-EG')} <span className="stat-unit">ج.م</span>
          </div>
          <div className="stat-desc">الديون المتبقية القائمة لصالح المالك على الشركة</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1.2rem', background: 'rgba(15, 23, 42, 0.4)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 بحث بالملاحظات، الغرض، المبلغ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ minWidth: '160px' }}>
          <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">كل أنواع الحركات</option>
            <option value="owner_funding">📥 إيداعات التمويل فقط</option>
            <option value="owner_repayment">📤 المسدادات للمالك فقط</option>
          </select>
        </div>
        <div style={{ minWidth: '160px' }}>
          <select className="form-control" value={filterBank} onChange={e => setFilterBank(e.target.value)}>
            <option value="all">جميع الحسابات والبنوك</option>
            <option value="safe">💵 الخزينة النقدية الرئيسية</option>
            {banks.map(b => (
              <option key={b.id} value={b.id}>🏦 {b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      {loading ? (
        <div className="no-data-msg">جاري تحميل كشف حساب جاري المالك...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="no-data-msg">لا توجد معاملات مسجلة بحساب المالك تطابق الفلتر</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>نوع الحركة</th>
                <th>الجهة / البنك</th>
                <th>المبلغ</th>
                <th>أوجه الصرف / الغرض المستهدف 🔍</th>
                <th>الملاحظات والتفاصيل</th>
                <th>المستند / الإيصال</th>
                <th>المُدخل</th>
                {userRole === 'manager' && <th>الإجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => {
                const isFunding = tx.withdrawal_sub_type === 'owner_funding';
                const purposeInfo = getPurposeLabel(tx.purpose_type, tx.purpose_notes);

                return (
                  <tr key={tx.id}>
                    <td>
                      <div>{new Date(tx.date).toLocaleDateString('ar-EG')}</div>
                      <div className="sub-text">{new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <span className={`badge ${isFunding ? 'badge-deposit' : 'badge-withdrawal'}`}>
                        {isFunding ? '📥 إيداع تمويل' : '📤 سداد للمالك'}
                      </span>
                    </td>
                    <td>
                      <strong>{tx.bank_name ? `🏦 ${tx.bank_name}` : '💵 الخزينة النقدية'}</strong>
                    </td>
                    <td>
                      <strong className={isFunding ? 'amount-deposit' : 'amount-withdrawal'} style={{ fontSize: '1.05rem' }}>
                        {isFunding ? '+' : '-'}{Number(tx.amount).toLocaleString('ar-EG')} ج.م
                      </strong>
                    </td>
                    <td>
                      {isFunding ? (
                        <div>
                          <span className={`badge ${purposeInfo.color}`}>{purposeInfo.label}</span>
                          {tx.purpose_notes && <div className="sub-text" style={{ marginTop: '0.2rem' }}>{tx.purpose_notes}</div>}
                        </div>
                      ) : (
                        <span className="sub-text">استرداد من سيولة الشريكة</span>
                      )}
                    </td>
                    <td>{tx.notes || '—'}</td>
                    <td>
                      {tx.receipt_image ? (
                        <button className="btn btn-xs btn-secondary" onClick={() => setPreviewImage(tx.receipt_image)}>
                          🖼️ عرض الإيصال
                        </button>
                      ) : (
                        <span className="sub-text">بدون إيصال</span>
                      )}
                    </td>
                    <td>
                      <span className="sub-text">{tx.creator_name || 'المدير'}</span>
                    </td>
                    {userRole === 'manager' && (
                      <td>
                        <button className="btn btn-xs btn-secondary" onClick={() => handleOpenEditModal(tx)}>
                          ✏️ تعديل
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: EDIT OWNER TRANSACTION */}
      {editingTx && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '600px' }}>
            <div className="panel-header">
              <h2 className="panel-title">✏️ تعديل عملية بحساب المالك (#{editingTx.id})</h2>
              <button className="btn btn-secondary" onClick={() => setEditingTx(null)}>✕ إغلاق</button>
            </div>

            {formError && <div className="alert alert-error">{formError}</div>}

            <form onSubmit={handleEditSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>نوع المعاملة:</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={editingTx.withdrawal_sub_type === 'owner_funding' ? '📥 إيداع تمويل شخصي' : '📤 سداد مستحقات للمالك'}
                  />
                </div>

                <div className="form-group">
                  <label>المبلغ المعدل (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>الحساب / البنك:*</label>
                  <select
                    value={editForm.bank_id}
                    onChange={e => setEditForm({ ...editForm, bank_id: e.target.value })}
                  >
                    <option value="">💵 الخزينة النقدية الرئيسية</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>🏦 {b.name} ({b.account_number})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>تاريخ الحركة:*</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    required
                  />
                </div>

                {editingTx.withdrawal_sub_type === 'owner_funding' && (
                  <>
                    <div className="form-group full-width">
                      <label>وجهة الصرف / الغرض المستهدف 🔍:*</label>
                      <select
                        value={editForm.purpose_type}
                        onChange={e => setEditForm({ ...editForm, purpose_type: e.target.value })}
                      >
                        <option value="loan_installment">🏦 سداد قسط قرض / التزام بنكي</option>
                        <option value="supplier_payment">🚚 سداد فواتير موردين / شركات</option>
                        <option value="payroll">💵 مسير رواتب الموظفين</option>
                        <option value="general_liquidity">🔄 تغطية سيولة عامة للبنك/الخزينة</option>
                        <option value="custom">✍️ غرض مخصص آخر</option>
                      </select>
                    </div>

                    <div className="form-group full-width">
                      <label>تفاصيل جهة الصرف:</label>
                      <input
                        type="text"
                        placeholder="تفاصيل التوجيه المستهدف..."
                        value={editForm.purpose_notes}
                        onChange={e => setEditForm({ ...editForm, purpose_notes: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <div className="form-group full-width">
                  <label>ملاحظات الحركة:</label>
                  <textarea
                    rows="2"
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>تحديث صورة الإيصال (اختياري):</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'edit')}
                  />
                </div>

                {editForm.receipt_image && (
                  <div className="form-group full-width">
                    <img
                      src={editForm.receipt_image}
                      alt="معاينة الإيصال"
                      style={{ maxHeight: '120px', borderRadius: '8px', objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {submitting ? 'جاري حفظ التعديل...' : 'تأكيد التعديل وحفظ الحركة 💾'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD OWNER FUNDING DEPOSIT */}
      {showDepositModal && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '600px' }}>
            <div className="panel-header">
              <h2 className="panel-title">📥 تسجيل إيداع تمويل شخصي من صاحب الشركة</h2>
              <button className="btn btn-secondary" onClick={() => setShowDepositModal(false)}>✕ إغلاق</button>
            </div>

            {formError && <div className="alert alert-error">{formError}</div>}

            <form onSubmit={handleDepositSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>مبلغ التمويل (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="مثال: 50000"
                    value={depositForm.amount}
                    onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>إلى حساب / بنك:*</label>
                  <select
                    value={depositForm.bank_id}
                    onChange={e => setDepositForm({ ...depositForm, bank_id: e.target.value })}
                  >
                    <option value="">💵 الخزينة النقدية الرئيسية</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>🏦 {b.name} ({b.account_number})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>وجهة الصرف / الغرض المستهدف من هذا التمويل 🔍:*</label>
                  <select
                    value={depositForm.purpose_type}
                    onChange={e => setDepositForm({ ...depositForm, purpose_type: e.target.value })}
                  >
                    <option value="loan_installment">🏦 سداد قسط قرض / التزام بنكي</option>
                    <option value="supplier_payment">🚚 سداد فواتير موردين / شركات</option>
                    <option value="payroll">💵 مسير رواتب الموظفين</option>
                    <option value="general_liquidity">🔄 تغطية سيولة عامة للبنك/الخزينة</option>
                    <option value="custom">✍️ غرض مخصص آخر</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>تفاصيل جهة الصرف (مثال: قسط البنك الأهلي رقم 5 / شركة السكر...):</label>
                  <input
                    type="text"
                    placeholder="اكتب التوجيه الصريح للمبلغ أين صُرِف..."
                    value={depositForm.purpose_notes}
                    onChange={e => setDepositForm({ ...depositForm, purpose_notes: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>تاريخ الإيداع:*</label>
                  <input
                    type="date"
                    value={depositForm.date}
                    onChange={e => setDepositForm({ ...depositForm, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>صورة إيصال التحويل / الإيداع:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'deposit')}
                  />
                </div>

                {depositForm.receipt_image && (
                  <div className="form-group full-width">
                    <img
                      src={depositForm.receipt_image}
                      alt="معاينة الإيصال"
                      style={{ maxHeight: '120px', borderRadius: '8px', objectFit: 'contain' }}
                    />
                  </div>
                )}

                <div className="form-group full-width">
                  <label>ملاحظات إضافية:</label>
                  <textarea
                    rows="2"
                    placeholder="أي ملاحظات إضافية عن التحويل..."
                    value={depositForm.notes}
                    onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {submitting ? 'جاري تسجيل التمويل...' : 'تأكيد وحفظ التمويل في الحسابات 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REPAY OWNER */}
      {showRepayModal && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '550px' }}>
            <div className="panel-header">
              <h2 className="panel-title">📤 تسجيل سداد لصاحب الشركة (استرداد)</h2>
              <button className="btn btn-secondary" onClick={() => setShowRepayModal(false)}>✕ إغلاق</button>
            </div>

            {formError && <div className="alert alert-error">{formError}</div>}

            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.8rem 1rem', borderRadius: '10px', marginBottom: '1.2rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>إجمالي مستحقات المالك القائمة:</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>
                {summary.net_owed.toLocaleString('ar-EG')} ج.م
              </div>
            </div>

            <form onSubmit={handleRepaySubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>مبلغ السداد (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="مثال: 20000"
                    value={repayForm.amount}
                    onChange={e => setRepayForm({ ...repayForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>من حساب / بنك:*</label>
                  <select
                    value={repayForm.bank_id}
                    onChange={e => setRepayForm({ ...repayForm, bank_id: e.target.value })}
                  >
                    <option value="">💵 الخزينة النقدية الرئيسية</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>🏦 {b.name} ({b.account_number})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>تاريخ السداد:*</label>
                  <input
                    type="date"
                    value={repayForm.date}
                    onChange={e => setRepayForm({ ...repayForm, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>صورة إيصال التحويل / السداد:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'repay')}
                  />
                </div>

                {repayForm.receipt_image && (
                  <div className="form-group full-width">
                    <img
                      src={repayForm.receipt_image}
                      alt="معاينة الإيصال"
                      style={{ maxHeight: '120px', borderRadius: '8px', objectFit: 'contain' }}
                    />
                  </div>
                )}

                <div className="form-group full-width">
                  <label>ملاحظات السداد:</label>
                  <textarea
                    rows="2"
                    placeholder="ملاحظات أو رقم التحويل البنكي..."
                    value={repayForm.notes}
                    onChange={e => setRepayForm({ ...repayForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {submitting ? 'جاري تنفيذ السداد...' : 'تأكيد السداد وتخفيض رصيد المالك ✅'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMAGE PREVIEW */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="panel modal-content" style={{ maxWidth: '700px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <h3 className="panel-title">🖼️ معاينة إيصال المعاملة</h3>
              <button className="btn btn-secondary" onClick={() => setPreviewImage(null)}>✕ إغلاق</button>
            </div>
            <img src={previewImage} alt="إيصال المعاملة" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px' }} />
          </div>
        </div>
      )}
    </div>
  );
}
