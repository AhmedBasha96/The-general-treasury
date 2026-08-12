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
    bank_id: '',
    car_id: '',
    total_amount: '',
    installment_amount: '',
    total_installments: '',
    start_date: new Date().toISOString().split('T')[0],
    frequency: 'monthly',
    notes: ''
  });

  // Installments Schedule Modal State
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  // Pay Installment Modal State
  const [payingInstallment, setPayingInstallment] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

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
        setSuccessMsg('تم إضافة القرض وجدولة الأقساط بنجاح!');
        setShowAddModal(false);
        setNewLoan({
          title: '',
          loan_type: 'bank_loan',
          entity_name: '',
          bank_id: '',
          car_id: '',
          total_amount: '',
          installment_amount: '',
          total_installments: '',
          start_date: new Date().toISOString().split('T')[0],
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
    setPayLoading(true);

    try {
      const res = await fetch(`/api/loans/installments/${payingInstallment.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: payMethod,
          bankId: payMethod === 'bank_transfer' ? payBankId : null,
          notes: payNotes
        })
      });
      const data = await res.json();

      if (res.ok) {
        alert('تم سداد القسط وخصم المبلغ وتوثيق حركة الصرف بنجاح! ✅');
        setPayingInstallment(null);
        setPayNotes('');
        fetchLoans();
        if (selectedLoan) {
          fetchInstallments(selectedLoan.id);
        }
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setPayError(data.error || 'حدث خطأ أثناء سداد القسط');
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
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  // Auto-calculate installment amount if total_amount and count change
  const handleAmountOrCountChange = (field, value) => {
    const updated = { ...newLoan, [field]: value };
    const tot = parseFloat(updated.total_amount);
    const cnt = parseInt(updated.total_installments, 10);
    if (tot > 0 && cnt > 0 && (field === 'total_amount' || field === 'total_installments')) {
      updated.installment_amount = (tot / cnt).toFixed(2);
    }
    setNewLoan(updated);
  };

  const getLoanTypeLabel = (type) => {
    switch (type) {
      case 'bank_loan': return '🏦 قرض / تسهيل بنكي';
      case 'car_installment': return '🚗 قسط سيارة / معدات';
      case 'external_loan': return '🏢 التزام / قسط خارجي';
      default: return '💳 التزام مالي';
    }
  };

  return (
    <div className="panel loans-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 className="panel-title">💳 إدارة الأقساط والقروض ومواعيد السداد</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ إضافة قرض / التزام جديد
        </button>
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
                        setPayError('');
                      }}
                    >
                      💸 سداد القسط الآن
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
              <tr>
                <th>اسم القرض / الالتزام</th>
                <th>النوع والجهة</th>
                <th>إجمالي القرض</th>
                <th>المسدد</th>
                <th>المتبقي</th>
                <th>نسبة السداد</th>
                <th>الأقساط</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loansData.loans.map(loan => {
                const total = Number(loan.total_amount) || 1;
                const paid = Number(loan.total_paid_amount) || 0;
                const remaining = Math.max(0, total - paid);
                const pct = Math.min(100, Math.round((paid / total) * 100));

                return (
                  <tr key={loan.id}>
                    <td>
                      <strong>{loan.title}</strong>
                      {loan.car_plate && <div className="sub-text">سيارة: {loan.car_plate}</div>}
                    </td>
                    <td>
                      <span className="badge badge-company-transfer">{getLoanTypeLabel(loan.loan_type)}</span>
                      <div className="sub-text">{loan.bank_name || loan.entity_name}</div>
                    </td>
                    <td><strong>{Number(loan.total_amount).toLocaleString('ar-EG')} ج.م</strong></td>
                    <td className="amount-deposit">{paid.toLocaleString('ar-EG')} ج.م</td>
                    <td className="amount-withdrawal">{remaining.toLocaleString('ar-EG')} ج.م</td>
                    <td>
                      <div className="progress-bar-wrapper">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                        <span className="progress-pct">{pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary">
                        {loan.paid_installments} / {loan.total_installments} قسط
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => handleOpenLoanSchedule(loan)}>
                          📋 جدول الأقساط
                        </button>
                        <button className="btn btn-secondary btn-xs" onClick={() => handleDeleteLoan(loan.id, loan.title)} style={{ color: 'var(--danger)' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: ADD NEW LOAN */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '600px' }}>
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
                    placeholder="مثال: قرض توسعات البنك الأهلي، قسط سيارة جامبو 2026..."
                    value={newLoan.title}
                    onChange={e => setNewLoan({ ...newLoan, title: e.target.value })}
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
                  <label>اسم الجهة المستحقة / البنك:*</label>
                  <input
                    type="text"
                    placeholder="مثال: البنك الأهلي المصري، شركة التيسير..."
                    value={newLoan.entity_name}
                    onChange={e => setNewLoan({ ...newLoan, entity_name: e.target.value })}
                    required
                  />
                </div>

                {newLoan.loan_type === 'bank_loan' && (
                  <div className="form-group">
                    <label>البنك المربوط (اختياري):</label>
                    <select value={newLoan.bank_id} onChange={e => setNewLoan({ ...newLoan, bank_id: e.target.value })}>
                      <option value="">اختر البنك...</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>
                )}

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

                <div className="form-group">
                  <label>إجمالي مبلغ القرض (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="100000"
                    value={newLoan.total_amount}
                    onChange={e => handleAmountOrCountChange('total_amount', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>عدد الأقساط:*</label>
                  <input
                    type="number"
                    placeholder="12"
                    value={newLoan.total_installments}
                    onChange={e => handleAmountOrCountChange('total_installments', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>قيمة القسط الواحد (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="8333.33"
                    value={newLoan.installment_amount}
                    onChange={e => setNewLoan({ ...newLoan, installment_amount: e.target.value })}
                    required
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

                <div className="form-group">
                  <label>تاريخ استحقاق أول قسط:*</label>
                  <input
                    type="date"
                    value={newLoan.start_date}
                    onChange={e => setNewLoan({ ...newLoan, start_date: e.target.value })}
                    required
                  />
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

      {/* MODAL: VIEW LOAN INSTALLMENTS SCHEDULE */}
      {selectedLoan && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">📋 جدول أقساط: {selectedLoan.title}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>الجهة: {selectedLoan.entity_name} | إجمالي القرض: {Number(selectedLoan.total_amount).toLocaleString('ar-EG')} ج.م</p>
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
                      <th>الحالة</th>
                      <th>طريقة السداد</th>
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
                            <span className={`badge ${isPaid ? 'badge-deposit' : isOverdue ? 'badge-withdrawal' : 'badge-secondary'}`}>
                              {isPaid ? 'مسدد ✅' : isOverdue ? 'مستحق / متأخر 🚨' : 'قادم ⏳'}
                            </span>
                          </td>
                          <td>
                            {isPaid ? (
                              inst.payment_method === 'bank_transfer' ? `بنك: ${inst.bank_name || 'تحويل بنكي'}` : 'نقداً من الخزنة'
                            ) : '—'}
                          </td>
                          <td>
                            {!isPaid ? (
                              <button
                                className="btn btn-xs btn-primary"
                                onClick={() => {
                                  setPayingInstallment({ id: inst.id, amount: inst.amount, installment_number: inst.installment_number, loan_title: selectedLoan.title });
                                  setPayError('');
                                }}
                              >
                                💸 سداد القسط الآن
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>تم السداد في {new Date(inst.paid_date).toLocaleDateString('ar-EG')}</span>
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

      {/* MODAL: PAY INSTALLMENT */}
      {payingInstallment && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '480px' }}>
            <div className="panel-header">
              <h2 className="panel-title">💸 سداد قسط رقم #{payingInstallment.installment_number}</h2>
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

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>طريقة سداد القسط:*</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="cash">💵 نقداً خصماً من الخزنة العامة</option>
                  <option value="bank_transfer">🏦 تحويل خصماً من حساب بنكي</option>
                </select>
              </div>

              {payMethod === 'bank_transfer' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>اختر الحساب البنكي الخاسم:*</label>
                  <select value={payBankId} onChange={e => setPayBankId(e.target.value)} required>
                    <option value="">اختر البنك...</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code}) - الرصيد: {Number(b.balance || 0).toLocaleString()} ج.م</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>ملاحظات السداد (اختياري):</label>
                <input
                  type="text"
                  placeholder="رقم الشيك أو رقم التحويل..."
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </div>

              <button type="submit" disabled={payLoading} className="btn btn-primary" style={{ width: '100%' }}>
                {payLoading ? 'جاري السداد وتأكيد الصرف...' : 'تأكيد سداد القسط وخصم المبلغ 💸'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
