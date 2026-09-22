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
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Edit State
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    source_type: 'external_owner',
    from_bank_id: '',
    target_bank_id: '',
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
    source_type: 'external_owner',
    from_bank_id: '',
    target_bank_id: '',
    payment_method: 'bank_transfer',
    purpose_type: 'loan_installment',
    purpose_notes: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    receipt_image: ''
  });

  const [repayForm, setRepayForm] = useState({
    amount: '',
    source_bank_id: '',
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
        const sumData = await sumRes.json();
        const txData = await txRes.json();
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

    const bank_id = depositForm.target_bank_id || null;

    setSubmitting(true);
    try {
      const res = await fetch('/api/owner-account/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole
        },
        body: JSON.stringify({
          ...depositForm,
          bank_id: bank_id,
          payment_method: bank_id ? 'bank_transfer' : 'cash'
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'تم تسجيل إيداع التمويل بنجاح!');
        setShowDepositModal(false);
        setDepositForm({
          amount: '',
          source_type: 'external_owner',
          from_bank_id: '',
          target_bank_id: '',
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

    if (userRole === 'manager' && amt > summary.net_owed) {
      setFormError(`المبلغ المطلوب سداده (${amt.toLocaleString('ar-EG')} ج.م) يتجاوز إجمالي مستحقات المالك الحالية (${summary.net_owed.toLocaleString('ar-EG')} ج.م)`);
      return;
    }

    const bank_id = repayForm.source_bank_id || null;

    setSubmitting(true);
    try {
      const res = await fetch('/api/owner-account/repay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole
        },
        body: JSON.stringify({
          ...repayForm,
          bank_id: bank_id,
          payment_method: bank_id ? 'bank_transfer' : 'cash'
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'تم تسجيل سداد مستحقات صاحب الشركة بنجاح!');
        setShowRepayModal(false);
        setRepayForm({
          amount: '',
          source_bank_id: '',
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

  const handleApproveOwnerTx = async (txId) => {
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/owner-account/transactions/${txId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'تمت الموافقة على الطلب بنجاح!');
        fetchData();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setError(data.error || 'حدث خطأ أثناء اعتماد الطلب');
      }
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectOwnerTx = async (txId) => {
    if (!window.confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/owner-account/transactions/${txId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'تم رفض الطلب بنجاح');
        fetchData();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setError(data.error || 'حدث خطأ أثناء رفض الطلب');
      }
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisburseOwnerTx = async (txId) => {
    if (!window.confirm('هل قمت بتسليم المبلغ للمالك وتسديده بالفعل؟ اضغط موافقة لإتمام التسليم.')) return;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/owner-account/transactions/${txId}/disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'تم إتمام التسليم بنجاح! 🤝✅');
        fetchData();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setError(data.error || 'حدث خطأ أثناء إتمام تسليم العملية');
      }
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (tx) => {
    setEditingTx(tx);
    setEditForm({
      amount: tx.amount,
      source_type: 'external_owner',
      target_bank_id: tx.bank_id ? String(tx.bank_id) : '',
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

    const bank_id = editForm.target_bank_id || null;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/owner-account/transactions/${editingTx.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole
        },
        body: JSON.stringify({
          ...editForm,
          bank_id: bank_id,
          payment_method: bank_id ? 'bank_transfer' : 'cash'
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

  const handleDeleteOwnerTx = async (tx) => {
    const typeText = tx.withdrawal_sub_type === 'owner_funding' ? 'إيداع التمويل' : 'عملية السداد';
    if (window.confirm(`هل أنت متأكد من حذف ${typeText} بقيمة ${Number(tx.amount).toLocaleString('ar-EG')} ج.م من حساب جاري المالك؟`)) {
      setError('');
      setSuccessMsg('');
      try {
        const res = await fetch(`/api/owner-account/transactions/${tx.id}`, {
          method: 'DELETE',
          headers: { 'x-user-role': userRole }
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg('تم حذف العملية من حساب جاري المالك بنجاح!');
          fetchData();
          if (onRefreshDashboard) onRefreshDashboard();
        } else {
          setError(data.error || 'حدث خطأ أثناء حذف العملية');
        }
      } catch (err) {
        setError('تعذر الاتصال بالسيرفر');
      }
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
        return { label: '🏦 سداد قسط قرض / التزام بنكي', bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.3)', color: '#38bdf8' };
      case 'supplier_payment':
        return { label: '🚚 سداد فواتير موردين / شركات', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', color: '#c084fc' };
      case 'payroll':
        return { label: '💵 مسير رواتب موظفين', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', color: '#facc15' };
      case 'general_liquidity':
        return { label: '🔄 تغطية سيولة عامة', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399' };
      default:
        return { label: notes || '📌 غرض مخصص', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', color: '#cbd5e1' };
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'pending') {
      return { label: '⏳ بانتظار موافقة المدير', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' };
    } else if (status === 'approved') {
      return { label: '👍 موافق عليه (بانتظار التسليم)', bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.35)', color: '#38bdf8' };
    } else if (status === 'rejected') {
      return { label: '❌ مرفوض من المدير', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', color: '#ef4444' };
    } else {
      return { label: '✅ تم التسليم وإتمام السداد', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', color: '#10b981' };
    }
  };

  const pendingRequests = transactions.filter(tx => tx.status === 'pending');

  const filteredTransactions = transactions.filter(tx => {
    if (filterType !== 'all' && tx.withdrawal_sub_type !== filterType) return false;
    if (filterBank !== 'all') {
      if (filterBank === 'safe' && tx.bank_id) return false;
      if (filterBank !== 'safe' && String(tx.bank_id) !== filterBank) return false;
    }
    if (filterPurpose !== 'all') {
      if (filterPurpose === 'custom' && ['loan_installment', 'supplier_payment', 'payroll', 'general_liquidity'].includes(tx.purpose_type)) return false;
      if (filterPurpose !== 'custom' && tx.purpose_type !== filterPurpose) return false;
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'pending' && tx.status !== 'pending') return false;
      if (filterStatus === 'approved' && tx.status !== 'approved') return false;
      if (filterStatus === 'disbursed' && tx.status !== 'disbursed') return false;
      if (filterStatus === 'rejected' && tx.status !== 'rejected') return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const notesMatch = tx.notes?.toLowerCase().includes(term);
      const purposeMatch = tx.purpose_notes?.toLowerCase().includes(term);
      const bankMatch = tx.bank_name?.toLowerCase().includes(term);
      const amountMatch = String(tx.amount).includes(term);
      const creatorMatch = tx.creator_name?.toLowerCase().includes(term);
      return notesMatch || purposeMatch || bankMatch || amountMatch || creatorMatch;
    }
    return true;
  });

  const resetFilters = () => {
    setFilterType('all');
    setFilterBank('all');
    setFilterPurpose('all');
    setFilterStatus('all');
    setSearchTerm('');
  };

  const hasActiveFilters = filterType !== 'all' || filterBank !== 'all' || filterPurpose !== 'all' || filterStatus !== 'all' || searchTerm.trim() !== '';

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <div className="panel owner-account-panel" style={{ padding: '1.75rem', borderRadius: '24px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
      
      {/* 1. ELEGANT HERO HEADER BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85))',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-color)',
        borderRadius: '22px',
        padding: '1.75rem 2rem',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: '0 12px 36px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{
            width: '62px',
            height: '62px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 8px 24px rgba(14, 165, 233, 0.35)',
            flexShrink: 0
          }}>
            🏛️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '20px', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                الحسابات المركزية 🏛️
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>تخصيص التمويلات الشخصية والتوجيه المالي</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, lineHeight: 1.25 }}>
              حساب جاري المالك (التمويلات الشخصية والسدادات)
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.4rem', margin: 0 }}>
              سجل منظم ودقيق لمتابعة أموال المالك الضخمة، توجيهها للالتزامات والبنوك، واسترداد المستحقات بسهولة
            </p>
          </div>
        </div>

        {/* Action Buttons Header Group */}
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={() => { setShowDepositModal(true); setFormError(''); }}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              padding: '0.75rem 1.35rem',
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📥</span> تسجيل تمويل جديد
          </button>

          <button
            className="btn"
            onClick={() => { setShowRepayModal(true); setFormError(''); }}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#ffffff',
              padding: '0.75rem 1.35rem',
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.35)',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📤</span> سداد لصاحب الشركة
          </button>

          <button
            className="btn btn-secondary"
            onClick={handlePrintLedger}
            style={{
              borderRadius: '14px',
              padding: '0.75rem 1.15rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>🖨️</span> طباعة الكشف
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="alert alert-success" style={{ borderRadius: '14px', marginBottom: '1.5rem', padding: '1rem 1.25rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ borderRadius: '14px', marginBottom: '1.5rem', padding: '1rem 1.25rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* 2. MANAGER PENDING APPROVAL REQUESTS SECTION */}
      {userRole === 'manager' && pendingRequests.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.9))',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(245, 158, 11, 0.45)',
          borderRadius: '20px',
          padding: '1.5rem 1.75rem',
          marginBottom: '2rem',
          boxShadow: '0 8px 30px rgba(245, 158, 11, 0.18)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.25)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem'
              }}>
                📩
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b', margin: 0 }}>
                  طلبات التمويل والسداد المعلقة بانتظار موافقتك ({pendingRequests.length} طلب)
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, marginTop: '0.2rem' }}>
                  قدم المحاسب الطلبات التالية وهي بانتظار موافقتك لتصريح الصرف وتحديث رصيد البنوك والخزينة
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {pendingRequests.map(tx => {
              const isFunding = tx.withdrawal_sub_type === 'owner_funding';
              const purposeInfo = getPurposeLabel(tx.purpose_type, tx.purpose_notes);

              return (
                <div key={tx.id} style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <span style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: isFunding ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                        color: isFunding ? '#10b981' : '#ef4444'
                      }}>
                        {isFunding ? '📥 طلب إيداع تمويل' : '📤 طلب سداد للمالك'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        📅 {new Date(tx.date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: isFunding ? '#10b981' : '#ef4444', marginBottom: '0.5rem' }}>
                      {Number(tx.amount).toLocaleString('ar-EG')} <span style={{ fontSize: '0.85rem' }}>ج.م</span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.35rem', fontWeight: 700 }}>
                      {tx.bank_name ? `🏦 ${tx.bank_name}` : '💵 الخزينة النقدية الرئيسية'}
                    </div>

                    {isFunding && (
                      <div style={{ fontSize: '0.8rem', color: purposeInfo.color, marginBottom: '0.35rem' }}>
                        {purposeInfo.label} {tx.purpose_notes ? `(${tx.purpose_notes})` : ''}
                      </div>
                    )}

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      👤 مقدم الطلب: <strong>{tx.creator_name || 'المحاسب'}</strong>
                    </div>

                    {tx.notes && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                        💬 البيان: {tx.notes}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                    <button
                      disabled={submitting}
                      onClick={() => handleApproveOwnerTx(tx.id)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        border: 'none',
                        padding: '0.55rem',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ موافقة وتصريح بالصرف
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => handleRejectOwnerTx(tx.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '0.55rem 0.9rem',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      ❌ رفض
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. KPI SUMMARY DASHBOARD CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Card 1: Total Deposited */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.7))',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '20px',
          padding: '1.5rem 1.75rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}>
          <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '80px', height: '80px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '50%', filter: 'blur(20px)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)' }}>إجمالي التمويلات المودعة</span>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.18)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
            }}>
              📥
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#10b981', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {summary.total_deposited.toLocaleString('ar-EG')} <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>ج.م</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>💰</span> إجمالي ما ضخه صاحب الشركة (المعتمد)
          </div>
        </div>

        {/* Card 2: Total Repaid */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.08), rgba(15, 23, 42, 0.7))',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '20px',
          padding: '1.5rem 1.75rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}>
          <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '80px', height: '80px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%', filter: 'blur(20px)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)' }}>إجمالي المسدادات للمالك</span>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.18)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
            }}>
              📤
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#ef4444', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {summary.total_repaid.toLocaleString('ar-EG')} <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>ج.م</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🔄</span> إجمالي المبالغ المستردة للمالك (المعتمدة)
          </div>
        </div>

        {/* Card 3: Net Outstanding Balance */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.85))',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(245, 158, 11, 0.45)',
          borderRadius: '20px',
          padding: '1.5rem 1.75rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(245, 158, 11, 0.18)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}>
          <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '90px', height: '90px', background: 'rgba(245, 158, 11, 0.25)', borderRadius: '50%', filter: 'blur(25px)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#f59e0b' }}>⚖️ صافي الدين المستحق للمالك</span>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.25)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
            }}>
              👑
            </div>
          </div>
          <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {summary.net_owed.toLocaleString('ar-EG')} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>ج.م</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.6rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⭐</span> الرصيد القائم المتبقي المستحق لصاحب الشركة
          </div>
        </div>
      </div>

      {/* 4. STRUCTURED TOOLBAR & SEARCH / FILTER SECTION */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔎</span>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>تصفية واستعلام كشف الحساب</span>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '0.2rem 0.65rem',
              borderRadius: '12px',
              background: 'rgba(14, 165, 233, 0.15)',
              color: '#38bdf8'
            }}>
              {filteredTransactions.length} من أصل {transactions.length} معاملة
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.35rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>✕</span> إعادة ضبط الفلاتر
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {/* Search Box */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              كلمة البحث:
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 ابحث بملاحظة، غرض، أو مُدخل..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', borderRadius: '12px', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
            />
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              نوع المعاملة:
            </label>
            <select
              className="form-control"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ width: '100%', borderRadius: '12px', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
            >
              <option value="all">📊 جميع المعاملات (إيداعات وسدادات)</option>
              <option value="owner_funding">📥 إيداعات التمويل فقط</option>
              <option value="owner_repayment">📤 المسدادات للمالك فقط</option>
            </select>
          </div>

          {/* Approval Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              حالة الاعتماد والتسليم:
            </label>
            <select
              className="form-control"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', borderRadius: '12px', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
            >
              <option value="all">🌐 جميع الحالات</option>
              <option value="pending">⏳ بانتظار موافقة المدير</option>
              <option value="approved">👍 موافق عليه (بانتظار التسليم)</option>
              <option value="disbursed">✅ تم التسليم وإتمام السداد</option>
              <option value="rejected">❌ مرفوضة فقط</option>
            </select>
          </div>

          {/* Account / Bank Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              الحساب المستهدف / الخزنة:
            </label>
            <select
              className="form-control"
              value={filterBank}
              onChange={e => setFilterBank(e.target.value)}
              style={{ width: '100%', borderRadius: '12px', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
            >
              <option value="all">🏦 جميع الحسابات والخزن</option>
              <option value="safe">💵 الخزينة النقدية الرئيسية</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>🏦 {b.name} ({b.account_number})</option>
              ))}
            </select>
          </div>

          {/* Purpose Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              أوجه الصرف والغرض:
            </label>
            <select
              className="form-control"
              value={filterPurpose}
              onChange={e => setFilterPurpose(e.target.value)}
              style={{ width: '100%', borderRadius: '12px', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
            >
              <option value="all">🎯 جميع أوجه الصرف</option>
              <option value="loan_installment">🏦 أقساط قروض والتزامات</option>
              <option value="supplier_payment">🚚 فواتير موردين وشركات</option>
              <option value="payroll">💵 مسير رواتب الموظفين</option>
              <option value="general_liquidity">🔄 تغطية سيولة عامة</option>
              <option value="custom">📌 أغراض مخصصة أخرى</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. TRANSACTIONS LEDGER TABLE */}
      {loading ? (
        <div className="no-data-msg" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '20px', border: '1px dashed var(--border-color)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔄</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>جاري جلب كشف حساب جاري المالك وتدقيق البيانات...</div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="no-data-msg" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '20px', border: '1px dashed var(--border-color)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            لا توجد معاملات مسجلة في هذا الكشف
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            {hasActiveFilters
              ? 'لم نجد أي معاملات تطابق معايير البحث والفلترة المختارة. جرب تغيير الفلاتر أو إعادة ضبطها.'
              : 'لم يتم تسجيل أي عمليات تمويل شخصي أو سدادات للمالك بعد.'}
          </p>
          {hasActiveFilters ? (
            <button className="btn btn-secondary" onClick={resetFilters} style={{ borderRadius: '12px' }}>
              إعادة ضبط الفلاتر
            </button>
          ) : (
            <button className="btn" onClick={() => setShowDepositModal(true)} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: '12px', fontWeight: 700 }}>
              📥 تسجيل أول إيداع تمويل الآن
            </button>
          )}
        </div>
      ) : (
        <div className="table-container" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>التاريخ والوقت</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>نوع الحركة</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>حالة الاعتماد والتسليم</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>الحساب المستهدف / الخزنة</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>المبلغ</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>أوجه الصرف / الغرض المستهدف</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>التفاصيل والملاحظات</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>المستند والإيصال</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>المُدخل والمُعتمد</th>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx, index) => {
                const isFunding = tx.withdrawal_sub_type === 'owner_funding';
                const purposeInfo = getPurposeLabel(tx.purpose_type, tx.purpose_notes);
                const statusInfo = getStatusBadge(tx.status);

                return (
                  <tr
                    key={tx.id}
                    style={{
                      background: index % 2 === 0 ? 'rgba(30, 41, 59, 0.35)' : 'rgba(15, 23, 42, 0.45)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      opacity: tx.status === 'rejected' ? 0.6 : 1,
                      transition: 'background 0.2s ease'
                    }}
                  >
                    {/* Date & Time */}
                    <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                        📅 {new Date(tx.date).toLocaleDateString('ar-EG')}
                      </div>
                      <div className="sub-text" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        ⏱️ {new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Transaction Type Badge */}
                    <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '10px',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          background: isFunding ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isFunding ? '#10b981' : '#ef4444',
                          border: `1px solid ${isFunding ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        <span>{isFunding ? '📥' : '📤'}</span>
                        <span>{isFunding ? 'إيداع تمويل' : 'سداد للمالك'}</span>
                      </span>
                    </td>

                    {/* Approval Status Badge */}
                    <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          background: statusInfo.bg,
                          color: statusInfo.color,
                          border: `1px solid ${statusInfo.border}`
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Target Bank / Safe */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{tx.bank_name ? '🏦' : '💵'}</span>
                        <span>{tx.bank_name ? tx.bank_name : 'الخزينة النقدية الرئيسية'}</span>
                      </div>
                      {tx.bank_account_number && (
                        <div className="sub-text" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          حساب: {tx.bank_account_number}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: 900,
                          color: isFunding ? '#10b981' : '#ef4444',
                          letterSpacing: '-0.3px',
                          textDecoration: tx.status === 'rejected' ? 'line-through' : 'none'
                        }}
                      >
                        {isFunding ? '+' : '-'}{Number(tx.amount).toLocaleString('ar-EG')}{' '}
                        <span style={{ fontSize: '0.8rem', fontStyle: 'normal', fontWeight: 700 }}>ج.م</span>
                      </div>
                    </td>

                    {/* Purpose / Target Allocation */}
                    <td style={{ padding: '1rem 1.25rem', minWidth: '200px' }}>
                      {isFunding ? (
                        <div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '8px',
                            background: purposeInfo.bg,
                            border: `1px solid ${purposeInfo.border}`,
                            color: purposeInfo.color,
                            fontSize: '0.82rem',
                            fontWeight: 800
                          }}>
                            {purposeInfo.label}
                          </div>
                          {tx.purpose_notes && (
                            <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                              📍 {tx.purpose_notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                          استرداد مبالغ مستحقة لصاحب الشركة
                        </span>
                      )}
                    </td>

                    {/* Details / Notes */}
                    <td style={{ padding: '1rem 1.25rem', maxWidth: '240px', wordBreak: 'break-word', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {tx.notes ? tx.notes : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>

                    {/* Receipt Image Button */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {tx.receipt_image ? (
                        <button
                          className="btn btn-xs btn-secondary"
                          onClick={() => setPreviewImage(tx.receipt_image)}
                          style={{ borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}
                        >
                          🖼️ معاينة الإيصال
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>لا يوجد</span>
                      )}
                    </td>

                    {/* Creator & Approver */}
                    <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        👤 {tx.creator_name || 'المستخدم'}
                      </div>
                      {tx.approver_name && (
                        <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>
                          ✓ اعتمده: {tx.approver_name}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                        {/* Complete Disbursement Button for Repayments approved by Manager */}
                        {tx.withdrawal_sub_type === 'owner_repayment' && tx.status === 'approved' && (
                          <button
                            className="btn btn-xs"
                            disabled={submitting}
                            onClick={() => handleDisburseOwnerTx(tx.id)}
                            title="إتمام السداد وتسليم المبلغ للمالك"
                            style={{
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: '#ffffff',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            🤝 إتمام السداد وتسليم الفلوس
                          </button>
                        )}

                        {userRole === 'manager' && tx.status === 'pending' && (
                          <>
                            <button
                              className="btn btn-xs"
                              onClick={() => handleApproveOwnerTx(tx.id)}
                              title="موافقة وتصريح الصرف"
                              style={{ background: '#10b981', color: '#fff', padding: '0.4rem 0.7rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}
                            >
                              ✅ موافقة
                            </button>
                            <button
                              className="btn btn-xs btn-secondary"
                              onClick={() => handleRejectOwnerTx(tx.id)}
                              title="رفض الطلب"
                              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.7rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem' }}
                            >
                              ❌ رفض
                            </button>
                          </>
                        )}

                        {userRole === 'manager' && (
                          <>
                            <button
                              className="btn btn-xs btn-secondary"
                              onClick={() => handleOpenEditModal(tx)}
                              title="تعديل المعاملة"
                              style={{ padding: '0.4rem 0.7rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem' }}
                            >
                              ✏️ تعديل
                            </button>
                            <button
                              className="btn btn-xs btn-secondary"
                              onClick={() => handleDeleteOwnerTx(tx)}
                              title="حذف المعاملة"
                              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.7rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem' }}
                            >
                              🗑️ حذف
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. MODAL: EDIT OWNER TRANSACTION */}
      {editingTx && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '640px', borderRadius: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div className="panel-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="panel-title" style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ✏️ تعديل عملية بحساب المالك <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(#{editingTx.id})</span>
              </h2>
              <button className="btn btn-secondary" onClick={() => setEditingTx(null)} style={{ borderRadius: '10px' }}>✕ إغلاق</button>
            </div>

            {formError && <div className="alert alert-error" style={{ borderRadius: '12px', marginTop: '1rem' }}>{formError}</div>}

            <form onSubmit={handleEditSubmit} style={{ marginTop: '1.25rem' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label style={{ fontWeight: 800 }}>نوع المعاملة:</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={editingTx.withdrawal_sub_type === 'owner_funding' ? '📥 إيداع تمويل شخصي' : '📤 سداد مستحقات للمالك'}
                    style={{ borderRadius: '10px', background: 'rgba(15, 23, 42, 0.5)', opacity: 0.8 }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800 }}>المبلغ المعدل (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>الحساب المستلم / البنك (يُودع فيه ويزيد رصيده):*</label>
                  <select
                    value={editForm.target_bank_id}
                    onChange={e => setEditForm({ ...editForm, target_bank_id: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  >
                    <option value="">💵 الخزينة النقدية الرئيسية</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>🏦 {b.name} ({b.account_number})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>تاريخ الحركة:*</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                {editingTx.withdrawal_sub_type === 'owner_funding' && (
                  <>
                    <div className="form-group full-width">
                      <label style={{ fontWeight: 800, color: '#38bdf8' }}>🔍 وجهة الصرف / الغرض المستهدف:*</label>
                      <select
                        value={editForm.purpose_type}
                        onChange={e => setEditForm({ ...editForm, purpose_type: e.target.value })}
                        style={{ borderRadius: '10px' }}
                      >
                        <option value="loan_installment">🏦 سداد قسط قرض / التزام بنكي</option>
                        <option value="supplier_payment">🚚 سداد فواتير موردين / شركات</option>
                        <option value="payroll">💵 مسير رواتب الموظفين</option>
                        <option value="general_liquidity">🔄 تغطية سيولة عامة للبنك/الخزينة</option>
                        <option value="custom">✍️ غرض مخصص آخر</option>
                      </select>
                    </div>

                    <div className="form-group full-width">
                      <label style={{ fontWeight: 800 }}>تفاصيل جهة الصرف:</label>
                      <input
                        type="text"
                        placeholder="تفاصيل التوجيه المستهدف..."
                        value={editForm.purpose_notes}
                        onChange={e => setEditForm({ ...editForm, purpose_notes: e.target.value })}
                        style={{ borderRadius: '10px' }}
                      />
                    </div>
                  </>
                )}

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>ملاحظات الحركة:</label>
                  <textarea
                    rows="2"
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>تحديث صورة الإيصال (اختياري):</label>
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
                      style={{ maxHeight: '120px', borderRadius: '10px', objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', borderRadius: '12px', padding: '0.8rem', fontWeight: 800 }}>
                {submitting ? 'جاري حفظ التعديل...' : 'تأكيد التعديل وحفظ الحركة 💾'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: ADD OWNER FUNDING DEPOSIT */}
      {showDepositModal && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '660px', borderRadius: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div className="panel-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="panel-title" style={{ fontSize: '1.25rem', color: '#10b981', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📥 تسجيل إيداع تمويل شخصي من صاحب الشركة
              </h2>
              <button className="btn btn-secondary" onClick={() => setShowDepositModal(false)} style={{ borderRadius: '10px' }}>✕ إغلاق</button>
            </div>

            {userRole === 'accountant' && (
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#f59e0b', padding: '0.8rem 1rem', borderRadius: '12px', marginTop: '1rem', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>ℹ️</span>
                <span>بصفتك محاسباً، سيتم تسليم طلب التمويل بحالة <strong>"معلقة بانتظار موافقة المدير"</strong> ولن يزيد رصيد البنك حتى يوافق المدير.</span>
              </div>
            )}

            {formError && <div className="alert alert-error" style={{ borderRadius: '12px', marginTop: '1rem' }}>{formError}</div>}

            <form onSubmit={handleDepositSubmit} style={{ marginTop: '1.25rem' }}>
              <div className="form-grid">
                {/* Step 1: Source */}
                <div className="form-group full-width" style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <label style={{ fontWeight: 900, color: '#10b981', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🎯 1. مصدر التمويل (يتخصم منين؟):*</span>
                  </label>
                  <select
                    value={depositForm.source_type}
                    onChange={e => setDepositForm({ ...depositForm, source_type: e.target.value })}
                    style={{ background: 'rgba(15, 23, 42, 0.8)', borderColor: '#10b981', fontWeight: 800, borderRadius: '10px', marginTop: '0.4rem' }}
                  >
                    <option value="external_owner">💳 حساب شخصي خارجي للمالك (تمويل خارجي - لا يخصم من أي حساب بالشركة)</option>
                    <option value="safe">💵 الخزينة النقدية الرئيسية للشركة (خصم من الخزنة لتمويل البنك)</option>
                  </select>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.4 }}>
                    ℹ️ اختر <strong>"حساب شخصي خارجي للمالك"</strong> لإيداع تمويل جديد يدخل لحساب الشركة مباشرة ويُسجل كدين للمالك دون خصمه من خزن التطبيق.
                  </div>
                </div>

                {/* Step 2: Target */}
                <div className="form-group full-width" style={{ background: 'rgba(14, 165, 233, 0.08)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(14, 165, 233, 0.25)' }}>
                  <label style={{ fontWeight: 900, color: '#38bdf8', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🏦 2. الحساب المستلم بالشركة (يُودع فيه ويزيد رصيده):*</span>
                  </label>
                  <select
                    value={depositForm.target_bank_id}
                    onChange={e => setDepositForm({ ...depositForm, target_bank_id: e.target.value })}
                    style={{ borderRadius: '10px', marginTop: '0.4rem' }}
                  >
                    <option value="">💵 الخزينة النقدية الرئيسية</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>🏦 {b.name} ({b.account_number})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800 }}>مبلغ التمويل (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="مثال: 50000"
                    value={depositForm.amount}
                    onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800 }}>تاريخ الإيداع:*</label>
                  <input
                    type="date"
                    value={depositForm.date}
                    onChange={e => setDepositForm({ ...depositForm, date: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                {/* Step 3: Purpose */}
                <div className="form-group full-width">
                  <label style={{ fontWeight: 800, color: '#f59e0b' }}>🔍 3. وجهة الصرف / الغرض المستهدف من هذا التمويل:*</label>
                  <select
                    value={depositForm.purpose_type}
                    onChange={e => setDepositForm({ ...depositForm, purpose_type: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  >
                    <option value="loan_installment">🏦 سداد قسط قرض / التزام بنكي</option>
                    <option value="supplier_payment">🚚 سداد فواتير موردين / شركات</option>
                    <option value="payroll">💵 مسير رواتب الموظفين</option>
                    <option value="general_liquidity">🔄 تغطية سيولة عامة للبنك/الخزينة</option>
                    <option value="custom">✍️ غرض مخصص آخر</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>تفاصيل جهة الصرف الصريحة:</label>
                  <input
                    type="text"
                    placeholder="مثال: قسط البنك الأهلي رقم 5 / شركة السكر..."
                    value={depositForm.purpose_notes}
                    onChange={e => setDepositForm({ ...depositForm, purpose_notes: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>صورة إيصال التحويل / الإيداع:</label>
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
                      style={{ maxHeight: '120px', borderRadius: '10px', objectFit: 'contain' }}
                    />
                  </div>
                )}

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>ملاحظات إضافية:</label>
                  <textarea
                    rows="2"
                    placeholder="أي ملاحظات إضافية عن التحويل..."
                    value={depositForm.notes}
                    onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn"
                style={{
                  width: '100%',
                  marginTop: '1.25rem',
                  padding: '0.85rem',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1rem',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)'
                }}
              >
                {submitting ? 'جاري إرسال التمويل...' : userRole === 'accountant' ? 'إرسال طلب التمويل للمدير للإعتماد ⏳' : 'تأكيد وحفظ التمويل وزيادة رصيد الحساب المستلم 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: REPAY OWNER */}
      {showRepayModal && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '600px', borderRadius: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div className="panel-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="panel-title" style={{ fontSize: '1.25rem', color: '#f59e0b', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📤 تسجيل سداد لصاحب الشركة (استرداد)
              </h2>
              <button className="btn btn-secondary" onClick={() => setShowRepayModal(false)} style={{ borderRadius: '10px' }}>✕ إغلاق</button>
            </div>

            {userRole === 'accountant' && (
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#f59e0b', padding: '0.8rem 1rem', borderRadius: '12px', marginTop: '1rem', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>ℹ️</span>
                <span>بصفتك محاسباً، سيتم تسليم طلب السداد بحالة <strong>"معلقة بانتظار موافقة المدير"</strong> ولن يخصم من الحساب حتى يوافق المدير.</span>
              </div>
            )}

            {formError && <div className="alert alert-error" style={{ borderRadius: '12px', marginTop: '1rem' }}>{formError}</div>}

            <div style={{ background: 'rgba(245, 158, 11, 0.12)', padding: '0.9rem 1.25rem', borderRadius: '14px', marginTop: '1rem', border: '1px solid rgba(245, 158, 11, 0.35)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>إجمالي مستحقات المالك القائمة:</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>
                  {summary.net_owed.toLocaleString('ar-EG')} ج.م
                </div>
              </div>
              <div style={{ fontSize: '1.8rem' }}>👑</div>
            </div>

            <form onSubmit={handleRepaySubmit} style={{ marginTop: '1.25rem' }}>
              <div className="form-grid">
                <div className="form-group full-width" style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <label style={{ fontWeight: 900, color: '#ef4444', fontSize: '0.95rem' }}>🎯 مصدر الخصم بالشركة (يتخصم منين؟):*</label>
                  <select
                    value={repayForm.source_bank_id}
                    onChange={e => setRepayForm({ ...repayForm, source_bank_id: e.target.value })}
                    style={{ background: 'rgba(15, 23, 42, 0.8)', borderColor: '#ef4444', fontWeight: 800, borderRadius: '10px', marginTop: '0.4rem' }}
                  >
                    <option value="">💵 الخزينة النقدية الرئيسية للشركة</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>🏦 {b.name} ({b.account_number})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800 }}>مبلغ السداد (ج.م):*</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="مثال: 20000"
                    value={repayForm.amount}
                    onChange={e => setRepayForm({ ...repayForm, amount: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800 }}>تاريخ السداد:*</label>
                  <input
                    type="date"
                    value={repayForm.date}
                    onChange={e => setRepayForm({ ...repayForm, date: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>صورة إيصال التحويل / السداد:</label>
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
                      style={{ maxHeight: '120px', borderRadius: '10px', objectFit: 'contain' }}
                    />
                  </div>
                )}

                <div className="form-group full-width">
                  <label style={{ fontWeight: 800 }}>ملاحظات السداد:</label>
                  <textarea
                    rows="2"
                    placeholder="ملاحظات أو رقم التحويل البنكي..."
                    value={repayForm.notes}
                    onChange={e => setRepayForm({ ...repayForm, notes: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn"
                style={{
                  width: '100%',
                  marginTop: '1.25rem',
                  padding: '0.85rem',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1rem',
                  boxShadow: '0 6px 20px rgba(245, 158, 11, 0.35)'
                }}
              >
                {submitting ? 'جاري التنفيذ...' : userRole === 'accountant' ? 'إرسال طلب السداد للمدير للإعتماد ⏳' : 'تأكيد السداد والخصم من الحساب المحدد ✅'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: IMAGE PREVIEW */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="panel modal-content" style={{ maxWidth: '720px', textAlign: 'center', borderRadius: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>🖼️ معاينة إيصال المعاملة</h3>
              <button className="btn btn-secondary" onClick={() => setPreviewImage(null)} style={{ borderRadius: '10px' }}>✕ إغلاق</button>
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <img src={previewImage} alt="إيصال المعاملة" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
