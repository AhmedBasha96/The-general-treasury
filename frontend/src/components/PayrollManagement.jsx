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
    <div className="payroll-management" style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>💼</span> نظام الرواتب والأجور ومسيرات الشهر
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            احتساب الرواتب والعمولات والبدلات والربط مع الحضور والبصمة والسُّلف والصرف المباشر
          </p>
        </div>

        {/* Sub-tabs Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className={`btn ${subTab === 'runs' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setSubTab('runs')}
          >
            💸 مسير الرواتب الحالي
          </button>
          <button
            type="button"
            className={`btn ${subTab === 'profiles' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setSubTab('profiles')}
          >
            ⚙️ إعدادات رواتب الموظفين ({profiles.length})
          </button>
          <button
            type="button"
            className={`btn ${subTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setSubTab('history')}
          >
            📂 أرشيف المسيرات السابقة
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PAYROLL RUNS */}
      {subTab === 'runs' && (
        <div>
          {/* Generator Banner */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <form onSubmit={handleGeneratePayroll} style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block', color: 'var(--text-secondary)' }}>اختر السنة</label>
                <select value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} required>
                  {[2024, 2025, 2026, 2027, 2028].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block', color: 'var(--text-secondary)' }}>اختر الشهر</label>
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
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {genLoading ? 'جاري الحساب والربط...' : '⚡ احتساب وتوليد المسير الشهري'}
              </button>
            </form>

            {genError && <div style={{ color: 'var(--danger)', marginTop: '0.75rem', fontSize: '0.85rem' }}>⚠️ {genError}</div>}
            {genSuccess && <div style={{ color: 'var(--success)', marginTop: '0.75rem', fontSize: '0.85rem' }}>✅ {genSuccess}</div>}
          </div>

          {/* Active Run Header Metrics & Disburse Bar */}
          {selectedRun ? (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedRun.title}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    تم التوليد بواسطة: {selectedRun.creator_name || 'المدير'} • {new Date(selectedRun.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className={`badge ${selectedRun.status === 'disbursed' ? 'badge-deposit' : 'badge-pending'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                    {selectedRun.status === 'disbursed' ? '✅ تم الصرف الفعلي' : '📝 مسودة - قيد المراجعة'}
                  </span>

                  {selectedRun.status !== 'disbursed' && currentUser?.role === 'manager' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ background: 'var(--success)', color: '#fff', borderColor: 'var(--success)', padding: '0.5rem 1.25rem', fontWeight: 'bold' }}
                      onClick={() => setShowDisburseModal(true)}
                    >
                      🏧 صرف المسير الآن
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

              {/* Summary Numbers Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>الراتب الأساسي</span>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-color)' }}>{Number(selectedRun.total_basic).toLocaleString()} ج.م</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>إجمالي البدلات</span>
                  <strong style={{ fontSize: '1rem', color: '#06b6d4' }}>+{Number(selectedRun.total_allowances).toLocaleString()} ج.م</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>عمولات التوريدات</span>
                  <strong style={{ fontSize: '1rem', color: '#10b981' }}>+{Number(selectedRun.total_commissions).toLocaleString()} ج.م</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>الاستقطاعات والغياب</span>
                  <strong style={{ fontSize: '1rem', color: '#f43f5e' }}>-{Number(selectedRun.total_deductions).toLocaleString()} ج.م</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>أقساط السُّلف الخصمة</span>
                  <strong style={{ fontSize: '1rem', color: '#eab308' }}>-{Number(selectedRun.total_loan_deductions).toLocaleString()} ج.م</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>إجمالي صافي الرواتب</span>
                  <strong style={{ fontSize: '1.15rem', color: 'var(--success)', fontWeight: '800' }}>{Number(selectedRun.total_net_salary).toLocaleString()} ج.م</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data-msg">لا يوجد مسير رواتب محدد حالياً. يرجى احتساب مسير جديد أعلاه.</div>
          )}

          {/* Items Table */}
          {selectedRun && (
            <div className="table-container">
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: 0 }}>📋 كشف مفردات مرتبات الموظفين والمناديب ({runItems.length})</h4>
              </div>

              {loadingItems ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>جاري تحميل مفردات المسير...</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>كود الموظف</th>
                      <th>الاسم والصفة</th>
                      <th>الأساسي</th>
                      <th>البدلات</th>
                      <th>العمولة</th>
                      <th>الغياب/التأخير</th>
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
                          <div style={{ fontWeight: 600 }}>{item.rep_name}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.classification || 'موظف'}</span>
                        </td>
                        <td>{Number(item.basic_salary).toLocaleString()} ج.م</td>
                        <td><span style={{ color: '#06b6d4' }}>+{Number(item.allowances).toLocaleString()}</span></td>
                        <td><span style={{ color: '#10b981' }}>+{Number(item.commission_amount).toLocaleString()}</span></td>
                        <td>
                          {Number(item.absence_deduction + item.late_deduction) > 0 ? (
                            <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                              -{Number(item.absence_deduction + item.late_deduction).toLocaleString()}
                              <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>({item.absence_days} يوم غياب)</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {Number(item.loan_deduction) > 0 ? (
                            <span style={{ color: '#eab308' }}>-{Number(item.loan_deduction).toLocaleString()}</span>
                          ) : '—'}
                        </td>
                        <td>
                          {Number(item.bonus_amount) > 0 ? (
                            <span style={{ color: 'var(--success)' }}>+{Number(item.bonus_amount).toLocaleString()}</span>
                          ) : '0'}
                        </td>
                        <td>
                          {Number(item.other_deduction) > 0 ? (
                            <span style={{ color: 'var(--danger)' }}>-{Number(item.other_deduction).toLocaleString()}</span>
                          ) : '0'}
                        </td>
                        <td>
                          <strong style={{ fontSize: '1rem', color: 'var(--success)' }}>
                            {Number(item.net_salary).toLocaleString()} ج.م
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {selectedRun.status !== 'disbursed' && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
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
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#06b6d4', borderColor: 'rgba(6,182,212,0.3)' }}
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
          )}
        </div>
      )}

      {/* SUB-TAB 2: SALARY PROFILES SETUP */}
      {subTab === 'profiles' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <input
              type="text"
              placeholder="🔍 بحث باسم الموظف أو الكود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: '300px', width: '100%' }}
            />
            {profileMsg.success && <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>{profileMsg.success}</span>}
            {profileMsg.error && <span style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{profileMsg.error}</span>}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>اسم الموظف / المندوب</th>
                  <th>الصفة والتصنيف</th>
                  <th>الراتب الأساسي</th>
                  <th>إجمالي البدلات</th>
                  <th>نسبة العمولة (%)</th>
                  <th>ملاحظات</th>
                  <th>تعديل</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map(p => (
                  <tr key={p.rep_id}>
                    <td><strong>{p.rep_code}</strong></td>
                    <td>{p.rep_name}</td>
                    <td><span className="badge badge-secondary">{p.classification || 'موظف'}</span></td>
                    <td><strong>{Number(p.basic_salary).toLocaleString()} ج.م</strong></td>
                    <td>
                      {(Number(p.transport_allowance) + Number(p.housing_allowance) + Number(p.other_allowance)).toLocaleString()} ج.م
                    </td>
                    <td>
                      {Number(p.commission_rate) > 0 ? <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{p.commission_rate}%</span> : '—'}
                    </td>
                    <td>{p.notes || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => setEditingProfile(p)}
                      >
                        ⚙️ إعداد الراتب
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
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>رقم المسير</th>
                <th>عنوان المسير</th>
                <th>التاريخ</th>
                <th>إجمالي الصافي</th>
                <th>طريقة الصرف</th>
                <th>الحالة</th>
                <th>المحاسب/المدير</th>
                <th>عرض الكشف</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id}>
                  <td><strong>PAY-{String(r.id).padStart(4, '0')}</strong></td>
                  <td>{r.title}</td>
                  <td>{r.month} / {r.year}</td>
                  <td><strong style={{ color: 'var(--success)' }}>{Number(r.total_net_salary).toLocaleString()} ج.م</strong></td>
                  <td>
                    {r.payment_method === 'bank_transfer' ? `🏦 ${r.bank_name || 'تحويل بنكي'}` : '💵 نقداً بالخزينة'}
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'disbursed' ? 'badge-deposit' : 'badge-pending'}`}>
                      {r.status === 'disbursed' ? 'تم الصرف' : 'مسودة'}
                    </span>
                  </td>
                  <td>{r.creator_name || 'المدير'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '600px', width: '100%', padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              ⚙️ ضبط ملف راتب الموظف: {editingProfile.rep_name} ({editingProfile.rep_code})
            </h3>

            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>💵 الراتب الأساسي (ج.م)</label>
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
                  <label>⏰ خصم اليوم للغياب (تلقائي إن تُرك فارغاً)</label>
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
                <label>ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="ملاحظات العقد أو تفاصيل إضافية..."
                  value={editingProfile.notes || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(null)}>إلغاء</button>
                <button type="submit" className="btn btn-primary">حفظ وتحديث الملف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT PAYROLL ITEM (BONUS/PENALTY) */}
      {editingItem && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              ✏️ تعديل مكافأة / جزاء: {editingItem.rep_name}
            </h3>

            <form onSubmit={handleUpdateItem}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>🎁 مكافأة أو حافز استثنائي (+)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editBonus}
                  onChange={(e) => setEditBonus(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>⚠️ خصم أو جزاء استثنائي (-)</label>
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
                  placeholder="سبب المكافأة أو الخصم..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingItem(null)}>إلغاء</button>
                <button type="submit" className="btn btn-primary">تحديث الصافي والحفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BULK DISBURSEMENT */}
      {showDisburseModal && selectedRun && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%', padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              🏧 تأكيد وإتمام صرف {selectedRun.title}
            </h3>

            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '1.25rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>إجمالي المبلغ المطلوب صرفه للموظفين:</span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--success)', marginTop: '0.25rem' }}>
                {Number(selectedRun.total_net_salary).toLocaleString()} ج.م
              </div>
            </div>

            <form onSubmit={handleDisbursePayroll}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>وسيلة الدفع والصرف <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${disburseMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setDisburseMethod('cash')}
                  >
                    💵 نقداً بالخزينة العامة
                  </button>
                  <button
                    type="button"
                    className={`btn ${disburseMethod === 'bank_transfer' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setDisburseMethod('bank_transfer')}
                  >
                    🏦 تحويل بنكي
                  </button>
                </div>
              </div>

              {disburseMethod === 'bank_transfer' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>اختر الحساب البنكي المصدر للصرف <span style={{ color: 'var(--danger)' }}>*</span></label>
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
                <label>ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="ملاحظات الصرف والتحويل..."
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                />
              </div>

              {disburseError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem' }}>⚠️ {disburseError}</div>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDisburseModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={disburseLoading}>
                  {disburseLoading ? 'جاري الصرف والتسجيل...' : 'تأكيد وصرف المسير'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PAYSLIP PRINT */}
      {printingPayslip && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '550px', width: '100%', padding: '1.75rem', background: '#fff', color: '#0f172a', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>قسيمة راتب ومستحقات شهرية (Payslip)</h3>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>الاحلام للتوكيلات التجاريه • {selectedRun?.title}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <div><strong>اسم الموظف:</strong> {printingPayslip.rep_name}</div>
              <div><strong>كود الموظف:</strong> {printingPayslip.rep_code}</div>
              <div><strong>التصنيف:</strong> {printingPayslip.classification || 'موظف'}</div>
              <div><strong>حالة الراتب:</strong> {printingPayslip.status === 'paid' ? 'تم الصرف' : 'مستحق'}</div>
            </div>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.85rem', borderColor: '#cbd5e1' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#0f172a' }}>
                  <th style={{ padding: '6px' }}>البند</th>
                  <th style={{ padding: '6px' }}>القيمة (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: '6px' }}>الراتب الأساسي</td><td style={{ padding: '6px' }}>+{Number(printingPayslip.basic_salary).toLocaleString()}</td></tr>
                <tr><td style={{ padding: '6px' }}>إجمالي البدلات</td><td style={{ padding: '6px' }}>+{Number(printingPayslip.allowances).toLocaleString()}</td></tr>
                <tr><td style={{ padding: '6px' }}>عمولة التوريدات والمبيعات</td><td style={{ padding: '6px' }}>+{Number(printingPayslip.commission_amount).toLocaleString()}</td></tr>
                {Number(printingPayslip.bonus_amount) > 0 && (
                  <tr><td style={{ padding: '6px' }}>مكافأة وحوافز (+)</td><td style={{ padding: '6px' }}>+{Number(printingPayslip.bonus_amount).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.absence_deduction) > 0 && (
                  <tr style={{ color: '#dc2626' }}><td style={{ padding: '6px' }}>خصم الغياب ({printingPayslip.absence_days} يوم)</td><td style={{ padding: '6px' }}>-{Number(printingPayslip.absence_deduction).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.late_deduction) > 0 && (
                  <tr style={{ color: '#dc2626' }}><td style={{ padding: '6px' }}>خصم التأخيرات ({printingPayslip.late_minutes} دقيقة)</td><td style={{ padding: '6px' }}>-{Number(printingPayslip.late_deduction).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.loan_deduction) > 0 && (
                  <tr style={{ color: '#d97706' }}><td style={{ padding: '6px' }}>خصم قسط السلفة الشهري</td><td style={{ padding: '6px' }}>-{Number(printingPayslip.loan_deduction).toLocaleString()}</td></tr>
                )}
                {Number(printingPayslip.other_deduction) > 0 && (
                  <tr style={{ color: '#dc2626' }}><td style={{ padding: '6px' }}>خصومات أخرى (-)</td><td style={{ padding: '6px' }}>-{Number(printingPayslip.other_deduction).toLocaleString()}</td></tr>
                )}
                <tr style={{ fontWeight: 'bold', background: '#e2e8f0', fontSize: '1rem' }}>
                  <td style={{ padding: '8px' }}>صافي الراتب المستحق</td>
                  <td style={{ padding: '8px', color: '#16a34a' }}>{Number(printingPayslip.net_salary).toLocaleString()} ج.م</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
              <div>توقيع الموظف المستلم: ....................</div>
              <div>اعتماد الحسابات والمدير: ....................</div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPrintingPayslip(null)}>إغلاق</button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨️ طباعة القسيمة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
