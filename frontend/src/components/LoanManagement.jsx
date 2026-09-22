import React, { useState, useEffect } from 'react';

export default function LoanManagement({ banks = [], carsList = [], onRefreshDashboard }) {
  const [loansData, setLoansData] = useState({ loans: [], dueAlerts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New Loan Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLoan, setNewLoan] = useState({
    title: '',
    loan_type: 'bank_loan',
    entity_name: '',
    account_number: '',
    account_holder_name: '',
    bank_id: '',
    car_id: '',
    total_amount: '',
    installment_amount: '',
    total_installments: '',
    initial_paid_amount: '',
    start_date: new Date().toISOString().split('T')[0],
    interest_rate: '',
    due_day_text: '15 من كل شهر',
    frequency: 'monthly',
    notes: ''
  });

  // Installments Schedule Modal State
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  // Edit Loan Modal State
  const [editingLoan, setEditingLoan] = useState(null);
  const [editLoanForm, setEditLoanForm] = useState({
    title: '',
    loan_type: 'bank_loan',
    entity_name: '',
    account_number: '',
    account_holder_name: '',
    bank_id: '',
    car_id: '',
    total_amount: '',
    installment_amount: '',
    total_installments: '',
    start_date: '',
    interest_rate: '',
    due_day_text: '15 من كل شهر',
    frequency: 'monthly',
    notes: ''
  });

  // Pay Installment Modal State
  const [payingInstallment, setPayingInstallment] = useState(null);
  const [payPaymentMethod, setPayPaymentMethod] = useState('cash'); // 'cash' | 'bank' | 'external'
  const [payBankId, setPayBankId] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  const handleOpenEditModal = (loan) => {
    setEditingLoan(loan);
    setEditLoanForm({
      title: loan.title || '',
      loan_type: loan.loan_type || 'bank_loan',
      entity_name: loan.entity_name || '',
      account_number: loan.account_number || '',
      account_holder_name: loan.account_holder_name || '',
      bank_id: loan.bank_id || '',
      car_id: loan.car_id || '',
      total_amount: loan.total_amount || '',
      installment_amount: loan.installment_amount || '',
      total_installments: loan.total_installments || '',
      start_date: loan.start_date ? new Date(loan.start_date).toISOString().split('T')[0] : '',
      interest_rate: loan.interest_rate || '',
      due_day_text: loan.due_day_text || '15 من كل شهر',
      frequency: loan.frequency || 'monthly',
      notes: loan.notes || ''
    });
  };

  const handleEditLoanSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!editLoanForm.title || !editLoanForm.entity_name || !editLoanForm.total_amount || !editLoanForm.installment_amount || !editLoanForm.total_installments || !editLoanForm.start_date) {
      setError('يرجى ملء كافة البيانات المطلوبة للقرض');
      return;
    }

    try {
      const res = await fetch(`/api/loans/${editingLoan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editLoanForm)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('تم تعديل بيانات القرض بنجاح!');
        setEditingLoan(null);
        fetchLoans();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setError(data.error || 'حدث خطأ أثناء تعديل القرض');
      }
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر');
    }
  };

  const fetchLoans = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/loans');
      if (res.ok) {
        const data = await res.json();
        setLoansData(data);
      } else {
        setError('حدث خطأ أثناء جلب بيانات القروض والأقساط');
      }
    } catch (err) {
      console.error('Error loading loans:', err);
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchInstallments = async (loanId) => {
    setLoadingInstallments(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/installments`);
      if (res.ok) {
        const data = await res.json();
        setInstallments(data);
      }
    } catch (err) {
      console.error('Error fetching installments:', err);
    } finally {
      setLoadingInstallments(false);
    }
  };

  const handleOpenLoanSchedule = (loan) => {
    setSelectedLoan(loan);
    fetchInstallments(loan.id);
  };

  const handleAddLoanSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newLoan.title || !newLoan.entity_name || !newLoan.total_amount || !newLoan.installment_amount || !newLoan.total_installments || !newLoan.start_date) {
      setError('يرجى ملء كافة البيانات المطلوبة للقرض');
      return;
    }

    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLoan)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('تم إضافة القرض وتوليد جدول الأقساط بنجاح!');
        setShowAddModal(false);
        setNewLoan({
          title: '',
          loan_type: 'bank_loan',
          entity_name: '',
          account_number: '',
          account_holder_name: '',
          bank_id: '',
          car_id: '',
          total_amount: '',
          installment_amount: '',
          total_installments: '',
          initial_paid_amount: '',
          start_date: new Date().toISOString().split('T')[0],
          interest_rate: '',
          due_day_text: '15 من كل شهر',
          frequency: 'monthly',
          notes: ''
        });
        fetchLoans();
      } else {
        setError(data.error || 'حدث خطأ أثناء حفظ القرض');
      }
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر');
    }
  };

  const handlePayInstallmentSubmit = async (e) => {
    e.preventDefault();
    setPayError('');

    if (payPaymentMethod === 'bank' && !payBankId) {
      setPayError('يرجى اختيار الحساب البنكي المراد الخصم منه');
      return;
    }

    setPayLoading(true);

    try {
      const res = await fetch(`/api/loans/installments/${payingInstallment.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: payPaymentMethod,
          bank_id: payPaymentMethod === 'bank' ? payBankId : null,
          notes: payNotes
        })
      });
      const data = await res.json();

      if (res.ok) {
        setPayingInstallment(null);
        setPayNotes('');
        setPayPaymentMethod('cash');
        setPayBankId('');
        fetchLoans();
        if (selectedLoan) {
          fetchInstallments(selectedLoan.id);
        }
        if (onRefreshDashboard) {
          onRefreshDashboard();
        }
      } else {
        setPayError(data.error || 'حدث خطأ أثناء تسجيل سداد القسط');
      }
    } catch (err) {
      setPayError('تعذر الاتصال بالسيرفر');
    } finally {
      setPayLoading(false);
    }
  };

  const handleDeleteLoan = async (loanId, title) => {
    if (window.confirm(`هل أنت متأكد من حذف القرض "${title}" وكافة الأقساط التابعة له؟`)) {
      try {
        const res = await fetch(`/api/loans/${loanId}`, { method: 'DELETE' });
        if (res.ok) {
          fetchLoans();
          if (selectedLoan && selectedLoan.id === loanId) {
            setSelectedLoan(null);
          }
          if (onRefreshDashboard) {
            onRefreshDashboard();
          }
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  // Auto-calculate installment amount or total amount dynamically
  const handleAmountOrCountChange = (field, value) => {
    const updated = { ...newLoan, [field]: value };
    const tot = parseFloat(updated.total_amount) || 0;
    const cnt = parseInt(updated.total_installments, 10) || 0;
    const inst = parseFloat(updated.installment_amount) || 0;

    if (field === 'total_amount' || field === 'total_installments') {
      if (tot > 0 && cnt > 0) {
        updated.installment_amount = (tot / cnt).toFixed(2);
      }
    } else if (field === 'installment_amount') {
      if (inst > 0 && cnt > 0 && (!updated.total_amount || parseFloat(updated.total_amount) === 0)) {
        updated.total_amount = (inst * cnt).toFixed(2);
      }
    }
    setNewLoan(updated);
  };

  const getLoanTypeLabel = (type) => {
    switch (type) {
      case 'bank_loan': return '🏦 قرض بنكي';
      case 'car_installment': return '🚗 قسط سيارات';
      case 'external_loan': return '🏢 التزام خارجي';
      default: return '💳 التزام مالي';
    }
  };

  const totalLoanAmountSum = loansData.loans.reduce((acc, l) => acc + (Number(l.total_amount) || 0), 0);
  const totalPaidAmountSum = loansData.loans.reduce((acc, l) => acc + (Number(l.total_paid_amount) || 0), 0);
  const totalRemainingAmountSum = loansData.loans.reduce((acc, l) => acc + Math.max(0, (Number(l.total_amount) || 0) - (Number(l.total_paid_amount) || 0)), 0);

  return (
    <div className="panel loans-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 className="panel-title">💳 إشعارات الأقساط والقروض ومواعيد السداد</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ إضافة قرض / التزام جديد
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(96, 165, 250, 0.25)', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>💳 إجمالي التزامات القروض</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa', marginTop: '0.3rem' }}>
            {totalLoanAmountSum.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>🟩 إجمالي المدفوع حتى الآن</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', marginTop: '0.3rem' }}>
            {totalPaidAmountSum.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>🟥 إجمالي المتبقي للسداد</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444', marginTop: '0.3rem' }}>
            {totalRemainingAmountSum.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Due Date Alerts Banner */}
      {loansData.dueAlerts && loansData.dueAlerts.length > 0 && (
        <div className="due-alerts-box">
          <div className="due-alerts-header">
            <span className="due-bell">⏰</span>
            <h3>تنبيهات مواعيد السداد المستحقة والقادمة (خلال 7 أيام)</h3>
          </div>
          <div className="due-alerts-list">
            {loansData.dueAlerts.map(alert => {
              const isOverdue = new Date(alert.due_date) <= new Date();
              return (
                <div key={alert.installment_id} className={`due-alert-item ${isOverdue ? 'overdue' : 'upcoming'}`}>
                  <div className="due-info">
                    <span className="due-title">
                      {isOverdue ? '🚨 قسط مستحق السداد / متأخر' : '🟡 قسط قادم قريبًا'}: {alert.loan_title} (قسط #{alert.installment_number})
                    </span>
                    <span className="due-date">تاريخ الاستحقاق: {new Date(alert.due_date).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div className="due-actions">
                    <span className="due-amount">{Number(alert.amount).toLocaleString('ar-EG')} ج.م</span>
                    <button 
                      className="btn btn-xs btn-primary"
                      onClick={() => {
                        setPayingInstallment({ id: alert.installment_id, amount: alert.amount, installment_number: alert.installment_number, loan_title: alert.loan_title });
                        setPayPaymentMethod('cash');
                        setPayBankId('');
                        setPayError('');
                      }}
                    >
                      💳 تسجيل السداد
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loans Table Section */}
      {loading ? (
        <div className="no-data-msg">جاري تحميل بيانات القروض والأقساط...</div>
      ) : loansData.loans.length === 0 ? (
        <div className="no-data-msg">لا توجد قروض أو أقساط مسجلة حالياً</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                <th>اسم البنك</th>
                <th>قيمة القرض</th>
                <th>المدفوع</th>
                <th>الباقي</th>
                <th>اسم الحساب</th>
                <th>رقم الحساب</th>
                <th>مبلغ القسط الشهري</th>
                <th>بداية المدة</th>
                <th>الفائدة</th>
                <th>عدد الشهور</th>
                <th>مواعيد الأقساط</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loansData.loans.map(loan => {
                const total = Number(loan.total_amount) || 0;
                const paid = Number(loan.total_paid_amount) || 0;
                const remaining = Math.max(0, total - paid);

                return (
                  <tr key={loan.id}>
                    <td>
                      <strong style={{ fontSize: '0.95rem', color: '#60a5fa' }}>{loan.entity_name || loan.title}</strong>
                      {loan.title && loan.title !== loan.entity_name && <div className="sub-text">{loan.title}</div>}
                    </td>
                    <td><strong>{Number(loan.total_amount).toLocaleString('ar-EG')} ج.م</strong></td>
                    <td className="amount-deposit"><strong>{paid.toLocaleString('ar-EG')} ج.م</strong></td>
                    <td className="amount-withdrawal"><strong>{remaining.toLocaleString('ar-EG')} ج.م</strong></td>
                    <td><span className="badge badge-secondary">{loan.account_holder_name || '—'}</span></td>
                    <td><code style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{loan.account_number || '—'}</code></td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>{Number(loan.installment_amount).toLocaleString('ar-EG')} ج.م</td>
                    <td>{loan.start_date ? new Date(loan.start_date).toLocaleDateString('ar-EG') : '—'}</td>
                    <td>{loan.interest_rate ? `${loan.interest_rate}%` : '—'}</td>
                    <td><strong>{loan.total_installments} شهر</strong></td>
                    <td><span className="badge badge-company-transfer">{loan.due_day_text || '15 من كل شهر'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => handleOpenLoanSchedule(loan)} title="جدول الأقساط">
                          📋 الأقساط
                        </button>
                        <button className="btn btn-secondary btn-xs" onClick={() => handleOpenEditModal(loan)} title="تعديل القرض" style={{ color: '#60a5fa' }}>
                          ✏️ تعديل
                        </button>
                        <button className="btn btn-secondary btn-xs" onClick={() => handleDeleteLoan(loan.id, loan.title)} title="حذف القرض" style={{ color: 'var(--danger)' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(30, 41, 59, 0.9)', fontWeight: 'bold', borderTop: '2px solid rgba(255, 255, 255, 0.1)' }}>
                <td style={{ color: '#f8fafc' }}>الإجمالي الكلي</td>
                <td style={{ color: '#60a5fa' }}>{totalLoanAmountSum.toLocaleString('ar-EG')} ج.م</td>
                <td style={{ color: '#10b981' }}>{totalPaidAmountSum.toLocaleString('ar-EG')} ج.م</td>
                <td style={{ color: '#ef4444' }}>{totalRemainingAmountSum.toLocaleString('ar-EG')} ج.م</td>
                <td colSpan="8"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* MODAL: ADD NEW LOAN */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '650px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="panel-header">
              <h2 className="panel-title">➕ إضافة قرض / التزام مالي جديد</h2>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>✕ إغلاق</button>
            </div>

            <form onSubmit={handleAddLoanSubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>اسم / عنوان القرض والالتزام:*</label>
                  <input
                    type="text"
                    placeholder="مثال: قرض ابوظبي الاسلامي، قرض بنك مصر..."
                    value={newLoan.title}
                    onChange={e => setNewLoan({ ...newLoan, title: e.target.value, entity_name: newLoan.entity_name || e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>نوع الالتزام:*</label>
                  <select value={newLoan.loan_type} onChange={e => setNewLoan({ ...newLoan, loan_type: e.target.value })}>
                    <option value="bank_loan">🏦 قرض / تسهيل بنكي</option>
                    <option value="car_installment">🚗 قسط سيارة / معدات</option>
                    <option value="external_loan">🏢 التزام / قسط خارجي</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>اسم البنك / الجهة المقرضة:*</label>
                  <input
                    type="text"
                    placeholder="اسم البنك (مثال: ابوظبي الاسلامي، CIB، فاب مصر...)"
                    value={newLoan.entity_name}
                    onChange={e => setNewLoan({ ...newLoan, entity_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>اسم صاحب الحساب:</label>
                  <input
                    type="text"
                    placeholder="الاسم المدون بالحساب (مثال: ابراهيم، اسامه...)"
                    value={newLoan.account_holder_name}
                    onChange={e => setNewLoan({ ...newLoan, account_holder_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>رقم الحساب لدى البنك/الجهة:</label>
                  <input
                    type="text"
                    placeholder="رقم حساب القرض بالبنك (مثال: 100000861748)"
                    value={newLoan.account_number}
                    onChange={e => setNewLoan({ ...newLoan, account_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>إجمالي مبلغ القرض (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="632640"
                    value={newLoan.total_amount}
                    onChange={e => handleAmountOrCountChange('total_amount', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>عدد الشهور / الأقساط:*</label>
                  <input
                    type="number"
                    placeholder="60"
                    value={newLoan.total_installments}
                    onChange={e => handleAmountOrCountChange('total_installments', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>مبلغ القسط الشهري (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="10600"
                    value={newLoan.installment_amount}
                    onChange={e => handleAmountOrCountChange('installment_amount', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>المبلغ المدفوع سابقاً / سلفاً (ج.م):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={newLoan.initial_paid_amount}
                    onChange={e => setNewLoan({ ...newLoan, initial_paid_amount: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>ميعاد / يوم السداد من كل شهر:*</label>
                  <input
                    type="text"
                    placeholder="مثال: 5 من كل شهر، 15 من كل شهر، يوم 17..."
                    value={newLoan.due_day_text}
                    onChange={e => setNewLoan({ ...newLoan, due_day_text: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>تاريخ بداية القرض / أول قسط:*</label>
                  <input
                    type="date"
                    value={newLoan.start_date}
                    onChange={e => setNewLoan({ ...newLoan, start_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>نسبة الفائدة (%):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="16.40 أو 15"
                    value={newLoan.interest_rate}
                    onChange={e => setNewLoan({ ...newLoan, interest_rate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>تكرار السداد:*</label>
                  <select value={newLoan.frequency} onChange={e => setNewLoan({ ...newLoan, frequency: e.target.value })}>
                    <option value="monthly">شهري</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="quarterly">ربع سنوي (كل 3 شهور)</option>
                  </select>
                </div>

                {newLoan.loan_type === 'car_installment' && (
                  <div className="form-group">
                    <label>السيارة المربوطة (اختياري):</label>
                    <select value={newLoan.car_id} onChange={e => setNewLoan({ ...newLoan, car_id: e.target.value })}>
                      <option value="">اختر السيارة...</option>
                      {carsList.map(c => (
                        <option key={c.id} value={c.id}>{c.plate_number} {c.driver_name ? `(${c.driver_name})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Live Dynamic Auto-Calculation Preview */}
                <div className="form-group full-width" style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.9rem 1.1rem', borderRadius: '12px', border: '1px dashed rgba(96, 165, 250, 0.35)', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.4rem' }}>
                    ⚡ الحساب التلقائي المباشر (المدفوع والمتبقي):
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.92rem', flexWrap: 'wrap' }}>
                    <div>إجمالي القرض: <strong style={{ color: '#f8fafc' }}>{(parseFloat(newLoan.total_amount) || 0).toLocaleString('ar-EG')} ج.م</strong></div>
                    <div>المدفوع (تلقائي): <strong style={{ color: '#10b981' }}>{(parseFloat(newLoan.initial_paid_amount) || 0).toLocaleString('ar-EG')} ج.م</strong></div>
                    <div>المتبقي (تلقائي): <strong style={{ color: '#ef4444' }}>{Math.max(0, (parseFloat(newLoan.total_amount) || 0) - (parseFloat(newLoan.initial_paid_amount) || 0)).toLocaleString('ar-EG')} ج.م</strong></div>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>ملاحظات إضافية:</label>
                  <textarea
                    rows="2"
                    placeholder="تفاصيل العقد أو الشروط..."
                    value={newLoan.notes}
                    onChange={e => setNewLoan({ ...newLoan, notes: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                حفظ القرض وتوليد جدول الأقساط تلقائياً 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT LOAN */}
      {editingLoan && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '650px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="panel-header">
              <h2 className="panel-title">✏️ تعديل بيانات القرض / الالتزام المالي</h2>
              <button className="btn btn-secondary" onClick={() => setEditingLoan(null)}>✕ إغلاق</button>
            </div>

            <form onSubmit={handleEditLoanSubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>اسم / عنوان القرض والالتزام:*</label>
                  <input
                    type="text"
                    value={editLoanForm.title}
                    onChange={e => setEditLoanForm({ ...editLoanForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>نوع الالتزام:*</label>
                  <select value={editLoanForm.loan_type} onChange={e => setEditLoanForm({ ...editLoanForm, loan_type: e.target.value })}>
                    <option value="bank_loan">🏦 قرض / تسهيل بنكي</option>
                    <option value="car_installment">🚗 قسط سيارة / معدات</option>
                    <option value="external_loan">🏢 التزام / قسط خارجي</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>اسم البنك / الجهة المقرضة:*</label>
                  <input
                    type="text"
                    value={editLoanForm.entity_name}
                    onChange={e => setEditLoanForm({ ...editLoanForm, entity_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>اسم صاحب الحساب:</label>
                  <input
                    type="text"
                    value={editLoanForm.account_holder_name}
                    onChange={e => setEditLoanForm({ ...editLoanForm, account_holder_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>رقم الحساب لدى البنك/الجهة:</label>
                  <input
                    type="text"
                    value={editLoanForm.account_number}
                    onChange={e => setEditLoanForm({ ...editLoanForm, account_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>إجمالي مبلغ القرض (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    value={editLoanForm.total_amount}
                    onChange={e => {
                      const tot = parseFloat(e.target.value) || 0;
                      const cnt = parseInt(editLoanForm.total_installments, 10) || 0;
                      const inst = cnt > 0 && tot > 0 ? (tot / cnt).toFixed(2) : editLoanForm.installment_amount;
                      setEditLoanForm({ ...editLoanForm, total_amount: e.target.value, installment_amount: inst });
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>عدد الشهور / الأقساط:*</label>
                  <input
                    type="number"
                    value={editLoanForm.total_installments}
                    onChange={e => {
                      const cnt = parseInt(e.target.value, 10) || 0;
                      const tot = parseFloat(editLoanForm.total_amount) || 0;
                      const inst = cnt > 0 && tot > 0 ? (tot / cnt).toFixed(2) : editLoanForm.installment_amount;
                      setEditLoanForm({ ...editLoanForm, total_installments: e.target.value, installment_amount: inst });
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>مبلغ القسط الشهري (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    value={editLoanForm.installment_amount}
                    onChange={e => setEditLoanForm({ ...editLoanForm, installment_amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>ميعاد / يوم السداد من كل شهر:*</label>
                  <input
                    type="text"
                    value={editLoanForm.due_day_text}
                    onChange={e => setEditLoanForm({ ...editLoanForm, due_day_text: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>تاريخ بداية القرض / أول قسط:*</label>
                  <input
                    type="date"
                    value={editLoanForm.start_date}
                    onChange={e => setEditLoanForm({ ...editLoanForm, start_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>نسبة الفائدة (%):</label>
                  <input
                    type="number"
                    step="any"
                    value={editLoanForm.interest_rate}
                    onChange={e => setEditLoanForm({ ...editLoanForm, interest_rate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>تكرار السداد:*</label>
                  <select value={editLoanForm.frequency} onChange={e => setEditLoanForm({ ...editLoanForm, frequency: e.target.value })}>
                    <option value="monthly">شهري</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="quarterly">ربع سنوي (كل 3 شهور)</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>ملاحظات إضافية:</label>
                  <textarea
                    rows="2"
                    value={editLoanForm.notes}
                    onChange={e => setEditLoanForm({ ...editLoanForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                💾 حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW LOAN INSTALLMENTS SCHEDULE */}
      {selectedLoan && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">📋 جدول أقساط: {selectedLoan.title}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  البنك/الجهة: <strong>{selectedLoan.entity_name}</strong>
                  {selectedLoan.account_number && ` | رقم الحساب: ${selectedLoan.account_number}`}
                  {selectedLoan.account_holder_name && ` (${selectedLoan.account_holder_name})`}
                  {` | إجمالي القرض: ${Number(selectedLoan.total_amount).toLocaleString('ar-EG')} ج.م`}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setSelectedLoan(null)}>✕ إغلاق</button>
            </div>

            {loadingInstallments ? (
              <div className="no-data-msg">جاري تحميل جدول الأقساط...</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>رقم القسط</th>
                      <th>تاريخ الاستحقاق</th>
                      <th>مبلغ القسط</th>
                      <th>طريقة السداد / الحالة</th>
                      <th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map(inst => {
                      const isPaid = inst.status === 'paid';
                      const isOverdue = !isPaid && new Date(inst.due_date) <= new Date();

                      return (
                        <tr key={inst.id}>
                          <td><strong>قسط #{inst.installment_number}</strong></td>
                          <td>{new Date(inst.due_date).toLocaleDateString('ar-EG')}</td>
                          <td><strong>{Number(inst.amount).toLocaleString('ar-EG')} ج.م</strong></td>
                          <td>
                            {isPaid ? (
                              <span className="badge badge-deposit">
                                {inst.payment_method === 'cash' ? '💵 نقداً (خزينة)' : inst.payment_method === 'bank' ? `🏦 بنكي (${inst.bank_name || ''})` : '🌐 خارجي'} ✅
                              </span>
                            ) : (
                              <span className={`badge ${isOverdue ? 'badge-withdrawal' : 'badge-secondary'}`}>
                                {isOverdue ? 'مستحق / متأخر 🚨' : 'قادم ⏳'}
                              </span>
                            )}
                          </td>
                          <td>
                            {!isPaid ? (
                              <button
                                className="btn btn-xs btn-primary"
                                onClick={() => {
                                  setPayingInstallment({ id: inst.id, amount: inst.amount, installment_number: inst.installment_number, loan_title: selectedLoan.title });
                                  setPayPaymentMethod('cash');
                                  setPayBankId('');
                                  setPayError('');
                                }}
                              >
                                💳 سداد القسط
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                                تم السداد في {new Date(inst.paid_date).toLocaleDateString('ar-EG')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MARK INSTALLMENT AS PAID */}
      {payingInstallment && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '520px' }}>
            <div className="panel-header">
              <h2 className="panel-title">💳 تسجيل سداد قسط رقم #{payingInstallment.installment_number}</h2>
              <button className="btn btn-secondary" onClick={() => setPayingInstallment(null)}>✕ إغلاق</button>
            </div>

            {payError && <div className="alert alert-error">{payError}</div>}

            <form onSubmit={handlePayInstallmentSubmit}>
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>الالتزام: <strong>{payingInstallment.loan_title}</strong></div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
                  مبلغ القسط: {Number(payingInstallment.amount).toLocaleString('ar-EG')} ج.م
                </div>
              </div>

              {/* PAYMENT SOURCE SELECTION */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'block' }}>اختر مصدر السداد:*</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  
                  {/* CASH SAFE OPTION */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.75rem', 
                      padding: '0.85rem', 
                      borderRadius: '10px', 
                      border: `1.5px solid ${payPaymentMethod === 'cash' ? 'var(--primary)' : 'var(--border-color)'}`,
                      background: payPaymentMethod === 'cash' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      cursor: 'pointer' 
                    }}
                  >
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="cash" 
                      checked={payPaymentMethod === 'cash'} 
                      onChange={() => setPayPaymentMethod('cash')} 
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>💵 نقداً من الخزينة الرئيسية</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>يخصم القسط تلقائياً من رصيد الخزينة الرئيسية وتسجل حركة سحب.</div>
                    </div>
                  </label>

                  {/* BANK OPTION */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.75rem', 
                      padding: '0.85rem', 
                      borderRadius: '10px', 
                      border: `1.5px solid ${payPaymentMethod === 'bank' ? 'var(--primary)' : 'var(--border-color)'}`,
                      background: payPaymentMethod === 'bank' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      cursor: 'pointer' 
                    }}
                  >
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="bank" 
                      checked={payPaymentMethod === 'bank'} 
                      onChange={() => setPayPaymentMethod('bank')} 
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div style={{ width: '100%' }}>
                      <div style={{ fontWeight: 700 }}>🏦 تحويل / خصم من حساب بنكي</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: payPaymentMethod === 'bank' ? '0.5rem' : '0' }}>
                        يخصم القسط من رصيد الحساب البنكي المحدد بالنظام.
                      </div>
                      
                      {payPaymentMethod === 'bank' && (
                        <select 
                          value={payBankId} 
                          onChange={e => setPayBankId(e.target.value)}
                          required
                          style={{ width: '100%', marginTop: '0.4rem', padding: '0.5rem' }}
                        >
                          <option value="">-- اختر الحساب البنكي المراد الخصم منه --</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.code}) - {b.account_number}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>

                  {/* EXTERNAL OPTION */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.75rem', 
                      padding: '0.85rem', 
                      borderRadius: '10px', 
                      border: `1.5px solid ${payPaymentMethod === 'external' ? 'var(--primary)' : 'var(--border-color)'}`,
                      background: payPaymentMethod === 'external' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      cursor: 'pointer' 
                    }}
                  >
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="external" 
                      checked={payPaymentMethod === 'external'} 
                      onChange={() => setPayPaymentMethod('external')} 
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>🌐 سداد خارجي (متابعة وإشعارات فقط)</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>تسجيل القسط كمسدد للتتبع والمواعيد بدون خصم من رصيد الخزينة أو البنوك.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>ملاحظات السداد (اختياري):</label>
                <input
                  type="text"
                  placeholder="رقم الشيك، إيصال البنك، أو ملاحظات..."
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </div>

              <button type="submit" disabled={payLoading} className="btn btn-primary" style={{ width: '100%' }}>
                {payLoading ? 'جاري السداد وتحديث الأرصدة...' : 'تأكيد السداد وتحديث الأرصدة ✅'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

