import React, { useState, useEffect } from 'react';

export default function PayrollManagement({ currentUser, banks = [], onRefreshDashboard }) {
  const [subTab, setSubTab] = useState('runs'); // 'runs' | 'profiles' | 'history'

  // Salary Profiles State
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [profileMsg, setProfileMsg] = useState({ error: '', success: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Payroll Runs State
  const [runs, setRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runItems, setRunItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Generate Run State
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [genSuccess, setGenSuccess] = useState('');

  // Item Editing Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editBonus, setEditBonus] = useState('');
  const [editOtherDed, setEditOtherDed] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Disburse Modal State
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [disburseMethod, setDisburseMethod] = useState('cash');
  const [disburseBankId, setDisburseBankId] = useState('');
  const [disburseNotes, setDisburseNotes] = useState('');
  const [disburseLoading, setDisburseLoading] = useState(false);
  const [disburseError, setDisburseError] = useState('');

  // Payslip Print Modal State
  const [printingPayslip, setPrintingPayslip] = useState(null);

  useEffect(() => {
    loadProfiles();
    loadRuns();
  }, []);

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const res = await fetch('/api/payroll/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (err) {
      console.error('Failed to load salary profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const loadRuns = async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch('/api/payroll/runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        if (data.length > 0 && !selectedRun) {
          handleSelectRun(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load payroll runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleSelectRun = async (runId) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data.run);
        setRunItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load payroll run details:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editingProfile) return;
    setProfileMsg({ error: '', success: '' });

    try {
      const res = await fetch('/api/payroll/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProfile)
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMsg({ error: '', success: 'تم حفظ وتحديث ملف راتب الموظف بنجاح! ✔️' });
        setEditingProfile(null);
        loadProfiles();
      } else {
        setProfileMsg({ error: data.error || 'حدث خطأ أثناء حفظ ملف الراتب', success: '' });
      }
    } catch (err) {
      setProfileMsg({ error: 'تعذر الاتصال بالسيرفر', success: '' });
    }
  };

  const handleGeneratePayroll = async (e) => {
    e.preventDefault();
    setGenError('');
    setGenSuccess('');
    setGenLoading(true);

    try {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id
        },
        body: JSON.stringify({ year: genYear, month: genMonth })
      });
      const data = await res.json();
      if (res.ok) {
        setGenSuccess('تم حساب وتوليد مسير الرواتب بنجاح! 🎉');
        await loadRuns();
        if (data.runId) {
          handleSelectRun(data.runId);
        }
      } else {
        setGenError(data.error || 'حدث خطأ أثناء احتساب المسير');
      }
    } catch (err) {
      setGenError('تعذر الاتصال بالسيرفر');
    } finally {
      setGenLoading(false);
    }
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/payroll/items/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bonus_amount: parseFloat(editBonus) || 0,
          other_deduction: parseFloat(editOtherDed) || 0,
          notes: editNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingItem(null);
        if (selectedRun) {
          handleSelectRun(selectedRun.id);
        }
        loadRuns();
      } else {
        alert(data.error || 'حدث خطأ أثناء تحديث المفردات');
      }
    } catch (err) {
      alert('تعذر الاتصال بالسيرفر');
    }
  };

  const handleDisbursePayroll = async (e) => {
    e.preventDefault();
    if (!selectedRun) return;
    setDisburseError('');
    setDisburseLoading(true);

    try {
      const res = await fetch(`/api/payroll/runs/${selectedRun.id}/disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id,
          'x-user-role': currentUser?.role
        },
        body: JSON.stringify({
          payment_method: disburseMethod,
          bank_id: disburseMethod === 'bank_transfer' ? Number(disburseBankId) : null,
          notes: disburseNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert('تم إتمام صرف مسير الرواتب وتسجيل حركات الصرف بنجاح! 💸');
        setShowDisburseModal(false);
        handleSelectRun(selectedRun.id);
        loadRuns();
        if (onRefreshDashboard) onRefreshDashboard();
      } else {
        setDisburseError(data.error || 'حدث خطأ أثناء صرف المسير');
      }
    } catch (err) {
      setDisburseError('تعذر الاتصال بالسيرفر');
    } finally {
      setDisburseLoading(false);
    }
  };

  const handleDeleteRun = async (runId, title) => {
    if (!window.confirm(`هل أنت متأكد من حذف ${title}؟`)) return;

    try {
      const res = await fetch(`/api/payroll/runs/${runId}`, {
        method: 'DELETE',
        headers: { 'x-user-role': currentUser?.role }
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم حذف مسير الرواتب بنجاح');
        setSelectedRun(null);
        loadRuns();
      } else {
        alert(data.error || 'حدث خطأ أثناء الحذف');
      }
    } catch (err) {
      alert('تعذر الاتصال بالسيرفر');
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.rep_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.rep_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const monthNames = [
    'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)', 'مايو (5)', 'يونيو (6)',
    'يوليو (7)', 'أغسطس (8)', 'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER HERO SECTION */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            color: '#fff',
            boxShadow: '0 8px 20px rgba(6, 182, 212, 0.3)'
          }}>
            💼
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(135deg, #f8fafc, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              نظام إدارة الرواتب ومسيرات المستحقات
            </h2>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              إدارة رواتب المناديب والموظفين، حساب العمولات والبدلات، والربط التلقائي للبصمة والسُّلف
            </p>
          </div>
        </div>

        {/* MODERN SEGMENTED CONTROLS */}
        <div style={{
          display: 'inline-flex',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '0.35rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          gap: '0.4rem'
        }}>
          <button
            type="button"
            className={`tab-btn ${subTab === 'runs' ? 'active' : ''}`}
            style={{ borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.9rem', fontWeight: 700 }}
            onClick={() => setSubTab('runs')}
          >
            💸 مسير الرواتب الحالي
          </button>
          <button
            type="button"
            className={`tab-btn ${subTab === 'profiles' ? 'active' : ''}`}
            style={{ borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.9rem', fontWeight: 700 }}
            onClick={() => setSubTab('profiles')}
          >
            ⚙️ إعدادات رواتب الموظفين ({profiles.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${subTab === 'history' ? 'active' : ''}`}
            style={{ borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.9rem', fontWeight: 700 }}
            onClick={() => setSubTab('history')}
          >
            📂 أرشيف المسيرات السابقة
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PAYROLL RUNS */}
      {subTab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* CONTROL PANEL FOR GENERATING NEW MONTHLY PAYROLL */}
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(16px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>احتساب وتوليد مسير شهري جديد</h3>
            </div>

            <form onSubmit={handleGeneratePayroll} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
              <div className="form-group">
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>السنة المالية</label>
                <select value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} required>
                  {[2024, 2025, 2026, 2027, 2028].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>الشهر المستحق</label>
                <select value={genMonth} onChange={(e) => setGenMonth(Number(e.target.value))} required>
                  {monthNames.map((name, i) => (
                    <option key={i+1} value={i+1}>{name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={genLoading}
                style={{
                  height: '45px',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 15px rgba(14, 165, 233, 0.3)'
                }}
              >
                {genLoading ? '⏳ جاري الحساب والربط التلقائي...' : '⚡ احتساب وتوليد المسير الشهري'}
              </button>
            </form>

            {genError && <div className="alert alert-error" style={{ marginTop: '1rem', marginBottom: 0 }}>⚠️ {genError}</div>}
            {genSuccess && <div className="alert alert-success" style={{ marginTop: '1rem', marginBottom: 0 }}>✅ {genSuccess}</div>}
          </div>

          {/* ACTIVE RUN SUMMARY STAT CARDS & ACTIONS */}
          {selectedRun ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* HEADER BAR FOR SELECTED RUN */}
              <div style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{selectedRun.title}</h3>
                    <span className={`badge ${selectedRun.status === 'disbursed' ? 'badge-deposit' : 'badge-pending'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem' }}>
                      {selectedRun.status === 'disbursed' ? '✅ تم الصرف المالي الفعلي' : '📝 مسودة - جاهز للمراجعة والصرف'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    تاريخ التوليد: {new Date(selectedRun.created_at).toLocaleString('ar-EG')} • المنشئ: {selectedRun.creator_name || 'المدير'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {selectedRun.status !== 'disbursed' && currentUser?.role === 'manager' && (
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        fontWeight: 800,
                        padding: '0.65rem 1.5rem',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                      }}
                      onClick={() => setShowDisburseModal(true)}
                    >
                      🏧 صرف المسير المالي الآن
                    </button>
                  )}

                  {selectedRun.status !== 'disbursed' && currentUser?.role === 'manager' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.1)' }}
                      onClick={() => handleDeleteRun(selectedRun.id, selectedRun.title)}
                    >
                      🗑️ حذف المسير
                    </button>
                  )}
                </div>
              </div>

              {/* HIGH VISUAL IMPACT STAT CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
                
                <div className="metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #0ea5e9' }}>
                  <span className="metric-title">إجمالي الراتب الأساسي</span>
                  <div className="metric-value" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
                    {Number(selectedRun.total_basic).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ج.م</span>
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #06b6d4' }}>
                  <span className="metric-title">إجمالي البدلات الفردية</span>
                  <div className="metric-value" style={{ color: '#06b6d4', fontSize: '1.5rem' }}>
                    +{Number(selectedRun.total_allowances).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ج.م</span>
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                  <span className="metric-title">عمولات التوريدات</span>
                  <div className="metric-value" style={{ color: '#10b981', fontSize: '1.5rem' }}>
                    +{Number(selectedRun.total_commissions).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ج.م</span>
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f43f5e' }}>
                  <span className="metric-title">خصومات البصمة والغياب</span>
                  <div className="metric-value" style={{ color: '#f43f5e', fontSize: '1.5rem' }}>
                    -{Number(selectedRun.total_deductions).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ج.م</span>
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #eab308' }}>
                  <span className="metric-title">أقساط السُّلف الخصمة</span>
                  <div className="metric-value" style={{ color: '#eab308', fontSize: '1.5rem' }}>
                    -{Number(selectedRun.total_loan_deductions).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ج.م</span>
                  </div>
                </div>

                <div className="metric-card" style={{
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderLeft: '4px solid #10b981'
                }}>
                  <span className="metric-title" style={{ color: '#10b981', fontWeight: 800 }}>إجمالي صافي المسير</span>
                  <div className="metric-value" style={{ color: 'var(--success)', fontSize: '1.75rem', fontWeight: 900 }}>
                    {Number(selectedRun.total_net_salary).toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--success)' }}>ج.م</span>
                  </div>
                </div>

              </div>

              {/* DETAILED ITEMS TABLE */}
              <div className="table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                    📋 كشف مفردات مرتبات الموظفين والمناديب ({runItems.length})
                  </h4>
                </div>

                {loadingItems ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>جاري جلب وتحميل البيانات المفصلة...</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>الكود</th>
                        <th>اسم الموظف / المندوب</th>
                        <th>الأساسي</th>
                        <th>البدلات</th>
                        <th>العمولة</th>
                        <th>خصم البصمة/الغياب</th>
                        <th>قسط السلفة</th>
                        <th>مكافأة (+)</th>
                        <th>خصم آخر (-)</th>
                        <th>صافي الراتب</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runItems.map(item => (
                        <tr key={item.id}>
                          <td><strong>{item.rep_code}</strong></td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{item.rep_name}</div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.classification || 'موظف'}</span>
                          </td>
                          <td>{Number(item.basic_salary).toLocaleString()} ج.م</td>
                          <td><span style={{ color: '#06b6d4', fontWeight: 600 }}>+{Number(item.allowances).toLocaleString()}</span></td>
                          <td><span style={{ color: '#10b981', fontWeight: 600 }}>+{Number(item.commission_amount).toLocaleString()}</span></td>
                          <td>
                            {Number(item.absence_deduction + item.late_deduction) > 0 ? (
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                -{Number(item.absence_deduction + item.late_deduction).toLocaleString()}
                                <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>({item.absence_days} يوم غياب)</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            {Number(item.loan_deduction) > 0 ? (
                              <span style={{ color: '#eab308', fontWeight: 600 }}>-{Number(item.loan_deduction).toLocaleString()}</span>
                            ) : '—'}
                          </td>
                          <td>
                            {Number(item.bonus_amount) > 0 ? (
                              <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{Number(item.bonus_amount).toLocaleString()}</span>
                            ) : '0'}
                          </td>
                          <td>
                            {Number(item.other_deduction) > 0 ? (
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{Number(item.other_deduction).toLocaleString()}</span>
                            ) : '0'}
                          </td>
                          <td>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--success)', fontWeight: 800 }}>
                              {Number(item.net_salary).toLocaleString()} ج.م
                            </strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {selectedRun.status !== 'disbursed' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    setEditingItem(item);
                                    setEditBonus(item.bonus_amount || '');
                                    setEditOtherDed(item.other_deduction || '');
                                    setEditNotes(item.notes || '');
                                  }}
                                >
                                  ✏️ تعديل
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', color: '#06b6d4', borderColor: 'rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.08)' }}
                                onClick={() => setPrintingPayslip(item)}
                              >
                                📄 قسيمة الراتب
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          ) : (
            <div className="no-data-msg" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '4rem 1rem' }}>
              لا يوجد مسير رواتب محدد حالياً. يرجى اختيار شهر وسنة وتوليد مسير جديد من الأعلى.
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 2: SALARY PROFILES SETUP */}
      {subTab === 'profiles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ position: 'relative', maxWidth: '350px', width: '100%' }}>
              <input
                type="text"
                placeholder="🔍 بحث باسم الموظف أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingRight: '1rem' }}
              />
            </div>

            {profileMsg.success && <div className="alert alert-success" style={{ margin: 0, padding: '0.5rem 1rem' }}>{profileMsg.success}</div>}
            {profileMsg.error && <div className="alert alert-error" style={{ margin: 0, padding: '0.5rem 1rem' }}>{profileMsg.error}</div>}
          </div>

          <div className="table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <table>
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>اسم الموظف / المندوب</th>
                  <th>التصنيف والوظيفة</th>
                  <th>الراتب الأساسي</th>
                  <th>إجمالي البدلات</th>
                  <th>نسبة العمولة (%)</th>
                  <th>ملاحظات العقد</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map(p => (
                  <tr key={p.rep_id}>
                    <td><strong>{p.rep_code}</strong></td>
                    <td><div style={{ fontWeight: 700 }}>{p.rep_name}</div></td>
                    <td><span className="badge badge-secondary">{p.classification || 'موظف'}</span></td>
                    <td><strong>{Number(p.basic_salary).toLocaleString()} ج.م</strong></td>
                    <td>
                      <span style={{ color: '#06b6d4', fontWeight: 600 }}>
                        {(Number(p.transport_allowance) + Number(p.housing_allowance) + Number(p.other_allowance)).toLocaleString()} ج.م
                      </span>
                    </td>
                    <td>
                      {Number(p.commission_rate) > 0 ? (
                        <span style={{ color: 'var(--success)', fontWeight: 800, background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                          {p.commission_rate}%
                        </span>
                      ) : '—'}
                    </td>
                    <td><span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.notes || '—'}</span></td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', color: 'var(--primary)', borderColor: 'rgba(14,165,233,0.3)' }}
                        onClick={() => setEditingProfile(p)}
                      >
                        ⚙️ إعداد الراتب والبدلات
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* SUB-TAB 3: PAYROLL RUNS HISTORY */}
      {subTab === 'history' && (
        <div className="table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <table>
            <thead>
              <tr>
                <th>رقم المسير</th>
                <th>عنوان وتاريخ المسير</th>
                <th>إجمالي المبلغ الصافي</th>
                <th>طريقة الدفع والصرف</th>
                <th>الحالة</th>
                <th>المنشئ</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id}>
                  <td><strong>PAY-{String(r.id).padStart(4, '0')}</strong></td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.title}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>تاريخ التوليد: {new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                  </td>
                  <td><strong style={{ color: 'var(--success)', fontSize: '1.05rem' }}>{Number(r.total_net_salary).toLocaleString()} ج.م</strong></td>
                  <td>
                    {r.payment_method === 'bank_transfer' ? `🏦 ${r.bank_name || 'تحويل بنكي'}` : '💵 نقداً بالخزينة العامة'}
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'disbursed' ? 'badge-deposit' : 'badge-pending'}`}>
                      {r.status === 'disbursed' ? 'تم الصرف الفعلي' : 'مسودة'}
                    </span>
                  </td>
                  <td>{r.creator_name || 'المدير'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                      onClick={() => {
                        setSelectedRun(r);
                        handleSelectRun(r.id);
                        setSubTab('runs');
                      }}
                    >
                      📂 فتح المسير
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: EDIT SALARY PROFILE */}
      {editingProfile && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '650px', width: '100%', padding: '1.75rem', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                ⚙️ ضبط ملف راتب الموظف: {editingProfile.rep_name} ({editingProfile.rep_code})
              </h3>
              <button type="button" className="action-icon-btn" onClick={() => setEditingProfile(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label>💵 الراتب الأساسي الشهري (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.basic_salary}
                    onChange={(e) => setEditingProfile({ ...editingProfile, basic_salary: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>🚗 بدل الانتقال / التوقعات (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.transport_allowance}
                    onChange={(e) => setEditingProfile({ ...editingProfile, transport_allowance: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>🏠 بدل السكن (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.housing_allowance}
                    onChange={(e) => setEditingProfile({ ...editingProfile, housing_allowance: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>📦 بدلات أخرى (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.other_allowance}
                    onChange={(e) => setEditingProfile({ ...editingProfile, other_allowance: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>📈 نسبة عمولة المبيعات والتوريدات (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="مثال: 1.5"
                    value={editingProfile.commission_rate}
                    onChange={(e) => setEditingProfile({ ...editingProfile, commission_rate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>⏰ خصم اليوم للغياب (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="تلقائي: الأساسي/30"
                    value={editingProfile.absence_day_rate}
                    onChange={(e) => setEditingProfile({ ...editingProfile, absence_day_rate: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>ملاحظات وتفاصيل العقد</label>
                <input
                  type="text"
                  placeholder="أدخل أي ملاحظات إضافية حول الراتب..."
                  value={editingProfile.notes || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, notes: e.target.value })}
                />
              </div>

              {/* LIVE PREVIEW TOTAL ALLOWANCES */}
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(14, 165, 233, 0.08)', borderRadius: '10px', border: '1px solid rgba(14, 165, 233, 0.2)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>إجمالي الراتب الأولي + البدلات ثابتة:</span>
                <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>
                  {(parseFloat(editingProfile.basic_salary || 0) + parseFloat(editingProfile.transport_allowance || 0) + parseFloat(editingProfile.housing_allowance || 0) + parseFloat(editingProfile.other_allowance || 0)).toLocaleString()} ج.م
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(null)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontWeight: 800 }}>حفظ وتحديث ملف الراتب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT PAYROLL ITEM (BONUS/PENALTY) */}
      {editingItem && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%', padding: '1.75rem', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                ✏️ تعديل مكافأة / جزاء: {editingItem.rep_name}
              </h3>
              <button type="button" className="action-icon-btn" onClick={() => setEditingItem(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateItem}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ color: 'var(--success)' }}>🎁 مكافأة أو حافز استثنائي (+)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editBonus}
                  onChange={(e) => setEditBonus(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ color: 'var(--danger)' }}>⚠️ خصم أو جزاء استثنائي (-)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editOtherDed}
                  onChange={(e) => setEditOtherDed(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>السبب / ملاحظات</label>
                <input
                  type="text"
                  placeholder="سبب إضافة المكافأة أو الخصم..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingItem(null)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontWeight: 800 }}>تحديث الصافي والحفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BULK DISBURSEMENT */}
      {showDisburseModal && selectedRun && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '540px', width: '100%', padding: '1.75rem', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                🏧 تأكيد وإتمام صرف {selectedRun.title}
              </h3>
              <button type="button" className="action-icon-btn" onClick={() => setShowDisburseModal(false)}>✕</button>
            </div>

            <div style={{ padding: '1.25rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '1.25rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>إجمالي مبلغ الرواتب الصافي المطلوبة:</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--success)', marginTop: '0.25rem' }}>
                {Number(selectedRun.total_net_salary).toLocaleString()} ج.م
              </div>
            </div>

            <form onSubmit={handleDisbursePayroll}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 700 }}>طريقة الصرف والخصم <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${disburseMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '0.75rem' }}
                    onClick={() => setDisburseMethod('cash')}
                  >
                    💵 نقداً بالخزينة العامة
                  </button>
                  <button
                    type="button"
                    className={`btn ${disburseMethod === 'bank_transfer' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '0.75rem' }}
                    onClick={() => setDisburseMethod('bank_transfer')}
                  >
                    🏦 تحويل بنكي
                  </button>
                </div>
              </div>

              {disburseMethod === 'bank_transfer' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>الحساب البنكي المصدر للصرف <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select
                    value={disburseBankId}
                    onChange={(e) => setDisburseBankId(e.target.value)}
                    required
                  >
                    <option value="">اختر الحساب البنكي...</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code}) — {b.account_number}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>ملاحظات عملية الصرف</label>
                <input
                  type="text"
                  placeholder="ملاحظات الصرف والتحويل..."
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                />
              </div>

              {disburseError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {disburseError}</div>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDisburseModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={disburseLoading} style={{ padding: '0.75rem 1.5rem', fontWeight: 800, background: 'var(--success)', borderColor: 'var(--success)' }}>
                  {disburseLoading ? 'جاري الصرف والتسجيل...' : 'تأكيد وصرف المسير'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PAYSLIP PRINT */}
      {printingPayslip && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '580px', width: '100%', padding: '2rem', background: '#fff', color: '#0f172a', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: 900 }}>قسيمة راتب ومستحقات شهرية (Payslip)</h3>
              <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>الاحلام للتوكيلات التجاريه • {selectedRun?.title}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.95rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div><strong>اسم الموظف:</strong> {printingPayslip.rep_name}</div>
              <div><strong>كود الموظف:</strong> {printingPayslip.rep_code}</div>
              <div><strong>التصنيف والوظيفة:</strong> {printingPayslip.classification || 'موظف'}</div>
              <div><strong>حالة الراتب:</strong> <span style={{ color: printingPayslip.status === 'paid' ? '#16a34a' : '#d97706', fontWeight: 800 }}>{printingPayslip.status === 'paid' ? 'تم الصرف الفعلي' : 'مستحق'}</span></div>
            </div>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem', fontSize: '0.9rem', borderColor: '#cbd5e1' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#fff' }}>
                  <th style={{ padding: '8px', textAlign: 'right' }}>الـبـنـد</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>القيمة (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: '8px' }}>الراتب الأساسي الشهري</td><td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>+{Number(printingPayslip.basic_salary).toLocaleString()}</td></tr>
                <tr><td style={{ padding: '8px' }}>إجمالي البدلات الثابتة</td><td style={{ padding: '8px', textAlign: 'center', color: '#0284c7', fontWeight: 'bold' }}>+{Number(printingPayslip.allowances).toLocaleString()}</td></tr>
                <tr><td style={{ padding: '8px' }}>عمولة المبيعات والتوريدات</td><td style={{ padding: '8px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>+{Number(printingPayslip.commission_amount).toLocaleString()}</td></tr>
                {Number(printingPayslip.bonus_amount) > 0 && (
                  <tr><td style={{ padding: '8px' }}>مكافأة وحوافز (+)</td><td style={{ padding: '8px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>+{Number(printingPayslip.bonus_amount).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.absence_deduction) > 0 && (
                  <tr style={{ color: '#dc2626' }}><td style={{ padding: '8px' }}>خصم الغياب ({printingPayslip.absence_days} يوم)</td><td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>-{Number(printingPayslip.absence_deduction).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.late_deduction) > 0 && (
                  <tr style={{ color: '#dc2626' }}><td style={{ padding: '8px' }}>خصم التأخيرات ({printingPayslip.late_minutes} دقيقة)</td><td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>-{Number(printingPayslip.late_deduction).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.loan_deduction) > 0 && (
                  <tr style={{ color: '#d97706' }}><td style={{ padding: '8px' }}>خصم قسط السلفة الشهري</td><td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>-{Number(printingPayslip.loan_deduction).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.other_deduction) > 0 && (
                  <tr style={{ color: '#dc2626' }}><td style={{ padding: '8px' }}>خصومات أخرى (-)</td><td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>-{Number(printingPayslip.other_deduction).toLocaleString()}</td></tr>
                )}
                <tr style={{ fontWeight: 'bold', background: '#f1f5f9', fontSize: '1.1rem' }}>
                  <td style={{ padding: '10px' }}>صافي الراتب المستحق للصرف</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#16a34a', fontSize: '1.2rem', fontWeight: 900 }}>{Number(printingPayslip.net_salary).toLocaleString()} ج.م</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
              <div>توقيع الموظف المستلم: ....................</div>
              <div>اعتماد الحسابات والمدير: ....................</div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPrintingPayslip(null)}>إلغاء</button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()} style={{ padding: '0.65rem 1.25rem', fontWeight: 800 }}>🖨️ طباعة القسيمة</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
