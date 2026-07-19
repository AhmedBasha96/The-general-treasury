import React, { useState, useEffect } from 'react';

const compressImage = (file, maxWidth = 1000, maxHeight = 1000, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Manager Pending Approvals, Editing, and User Management State
  const [pendingTx, setPendingTx] = useState([]);
  const [editingTx, setEditingTx] = useState(null);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [disbursingTx, setDisbursingTx] = useState(null);
  const [disburseDenominations, setDisburseDenominations] = useState({ denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 });
  const [disburseError, setDisburseError] = useState('');
  const [activeImageModal, setActiveImageModal] = useState(null);
  const [prevTab, setPrevTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [prevPendingCount, setPrevPendingCount] = useState(0);
  
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'accountant', assigned_agency_id: '' });
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  
  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editUserError, setEditUserError] = useState('');
  const [editUserSuccess, setEditUserSuccess] = useState('');
  
  // Printing State
  const [printingTx, setPrintingTx] = useState(null);

  // Representative States
  const [repLedgerData, setRepLedgerData] = useState(null);
  const [repLedgerLoading, setRepLedgerLoading] = useState(false);

  // Company States
  const [companies, setCompanies] = useState([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [newCompany, setNewCompany] = useState({ code: '', name: '', bank_account_number: '', bank_name: '' });
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');
  const [companyLedgerData, setCompanyLedgerData] = useState(null);
  const [companyLedgerLoading, setCompanyLedgerLoading] = useState(false);
  const [selectedCompanyForLedger, setSelectedCompanyForLedger] = useState(null);

  // Daily Report States
  const [dailyReportDate, setDailyReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReportData, setDailyReportData] = useState(null);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [dailyReportError, setDailyReportError] = useState('');

  const handleFetchDailyReport = async (targetDate = dailyReportDate) => {
    if (!targetDate) return;
    setDailyReportLoading(true);
    setDailyReportError('');
    try {
      const res = await fetch(`/api/reports/daily?date=${targetDate}`);
      const data = await res.json();
      if (res.ok) {
        setDailyReportData(data);
      } else {
        setDailyReportError(data.error || 'حدث خطأ أثناء تحميل التقرير اليومي');
      }
    } catch (err) {
      console.error('Failed to load daily report:', err);
      setDailyReportError('فشل الاتصال بالخادم');
    } finally {
      setDailyReportLoading(false);
    }
  };

  const loadRepLedger = async () => {
    const saved = localStorage.getItem('currentUser');
    const user = saved ? JSON.parse(saved) : null;
    if (!user || user.role !== 'representative') return;
    setRepLedgerLoading(true);
    try {
      const res = await fetch(`/api/reps/${user.id}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setRepLedgerData(data);
      }
    } catch (err) {
      console.error('Failed to load representative ledger:', err);
    } finally {
      setRepLedgerLoading(false);
    }
  };

  const handlePrintReceipt = (tx) => {
    const id = String(tx.id).padStart(6, '0');
    const date = new Date(tx.date).toLocaleString('ar-EG');
    const amount = Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 });
    const pounds = Math.floor(Number(tx.amount));
    const piasters = Math.round((Number(tx.amount) - pounds) * 100);
    const amountText = `${pounds.toLocaleString('ar-EG')} جنيه مصري${piasters > 0 ? ` و${piasters.toLocaleString('ar-EG')} قرشاً` : ''} لا غير`;

    const typeLabel = tx.type === 'exchange'
      ? 'إيصال تسوية فئات الخزينة (فك عملة)'
      : tx.type === 'deposit'
        ? (tx.payment_method === 'bank_transfer' ? 'إيصال إيداع تحويل بنكي' : 'إيصال توريد نقدية (وارد)')
        : 'إيصال صرف نقدية (منصرف)';

    const statusLabel = tx.type === 'exchange'
      ? (tx.status === 'pending' ? 'قيد المراجعة والموافقة' : 'مكتمل - تم التبديل')
      : tx.type === 'deposit'
        ? 'مكتمل'
        : (tx.status === 'disbursed' ? 'مكتمل - تم الصرف الفعلي'
           : tx.status === 'approved' ? 'معتمد - بانتظار التسليم'
           : tx.status === 'pending' ? 'قيد المراجعة'
           : 'مكتمل');

    const withdrawalSubType = tx.withdrawal_sub_type === 'car' ? 'مصاريف سيارات'
      : tx.withdrawal_sub_type === 'car_gas' ? 'مصاريف سيارات (جاز)'
      : tx.withdrawal_sub_type === 'car_oil' ? 'مصاريف سيارات (زيت)'
      : tx.withdrawal_sub_type === 'car_other' ? 'مصاريف سيارات (مصاريف أخرى)'
      : tx.withdrawal_sub_type === 'salary' ? 'رواتب وأجور'
      : tx.withdrawal_sub_type === 'commission' ? 'عمولات'
      : (tx.withdrawal_sub_type || '');

    // Build denominations table
    const denoms = [200, 100, 50, 20, 10, 5, 1];
    
    let isExchange = tx.type === 'exchange';
    let denomRowsExchangeIncoming = '';
    let denomRowsExchangeOutgoing = '';
    let hasExchangeDenoms = false;
    let totalCountExchangeIncoming = 0;
    let totalCountExchangeOutgoing = 0;
    let totalValueExchangeIncoming = 0;
    let totalValueExchangeOutgoing = 0;

    if (isExchange) {
      denoms.forEach(d => {
        const val = tx[`denom_${d}`] || 0;
        if (val > 0) {
          totalCountExchangeIncoming += val;
          totalValueExchangeIncoming += (d * val);
          denomRowsExchangeIncoming += `<tr><td>${d} ج.م</td><td>${val}</td><td>${(d * val).toLocaleString('ar-EG')} ج.م</td></tr>`;
          hasExchangeDenoms = true;
        } else if (val < 0) {
          const absVal = Math.abs(val);
          totalCountExchangeOutgoing += absVal;
          totalValueExchangeOutgoing += (d * absVal);
          denomRowsExchangeOutgoing += `<tr><td>${d} ج.م</td><td>${absVal}</td><td>${(d * absVal).toLocaleString('ar-EG')} ج.م</td></tr>`;
          hasExchangeDenoms = true;
        }
      });
      denomRowsExchangeIncoming += `<tr style="border-top:2px solid #000;font-weight:900"><td>المجموع الوارد</td><td>${totalCountExchangeIncoming}</td><td>${totalValueExchangeIncoming.toLocaleString('ar-EG')} ج.م</td></tr>`;
      denomRowsExchangeOutgoing += `<tr style="border-top:2px solid #000;font-weight:900"><td>المجموع المنصرف</td><td>${totalCountExchangeOutgoing}</td><td>${totalValueExchangeOutgoing.toLocaleString('ar-EG')} ج.م</td></tr>`;
    }

    const hasDenoms = !isExchange && tx.payment_method !== 'bank_transfer'
      && denoms.some(d => (tx[`denom_${d}`] || 0) > 0);

    let denomRows = '';
    let totalCount = 0;
    if (hasDenoms) {
      denoms.forEach(d => {
        const cnt = tx[`denom_${d}`] || 0;
        if (cnt > 0) {
          totalCount += cnt;
          denomRows += `<tr><td>${d} ج.م</td><td>${cnt}</td><td>${(d * cnt).toLocaleString('ar-EG')} ج.م</td></tr>`;
        }
      });
      denomRows += `<tr style="border-top:2px solid #000;font-weight:900"><td>الإجمالي</td><td>${totalCount}</td><td>${amount} ج.م</td></tr>`;
    }

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>إيصال TX-${id}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 80mm auto; margin: 0; }
  body {
    font-family: 'Cairo', Arial, sans-serif;
    font-size: 8pt;
    color: #000;
    background: #fff;
    direction: rtl;
    width: 80mm;
    padding: 1.5mm 1mm;
    line-height: 1.4;
  }
  .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 1.5mm; margin-bottom: 2mm; }
  .title { font-size: 13pt; font-weight: 900; margin: 0.5mm 0; }
  .subtitle { font-size: 8pt; color: #444; margin-top: 0.5mm; }
  .type-label { font-size: 10pt; font-weight: 800; display: block; margin: 1mm 0; }
  .status-badge { display: inline-block; border: 1.5px solid #000; padding: 0.2mm 1.5mm; font-weight: 800; font-size: 7.5pt; margin: 0.5mm 0; }
  .divider { border-top: 1px dashed #000; margin: 1.5mm 0; }
  .meta-table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 1.5mm; }
  .meta-table td { padding: 0.5mm 0; border-bottom: 1px dotted #ccc; vertical-align: top; }
  .meta-table td:first-child { font-weight: 800; white-space: nowrap; padding-left: 2mm; width: 35%; }
  .meta-table tr:last-child td { border-bottom: none; }
  .amount-box { text-align: center; background: #f0f0f0; border: 1.5px solid #000; padding: 1.5mm; margin: 2mm 0; }
  .amount-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5mm; }
  .amount-value { font-size: 14pt; font-weight: 900; line-height: 1.1; }
  .amount-text { font-size: 7pt; font-style: italic; margin-top: 1mm; color: #333; }
  .denom-header { font-size: 8pt; font-weight: 800; margin-bottom: 1.5mm; }
  .denom-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin: 1.5mm 0 3mm; }
  .denom-table th, .denom-table td { padding: 0.8mm 1mm; border: 1px solid #999; text-align: center; }
  .denom-table th { font-weight: 800; background: #e0e0e0; font-size: 7.5pt; }
  .notes-box { font-size: 7.5pt; border: 1px dashed #666; padding: 1.5mm; margin: 1.5mm 0 2mm; background: #fafafa; }
  .notes-box strong { display: block; margin-bottom: 0.5mm; font-size: 8pt; }
  .signatures { display: flex; justify-content: space-between; gap: 4mm; margin-top: 4mm; font-size: 7.5pt; text-align: center; }
  .sig-box { flex: 1; border-top: 1.5px solid #000; padding-top: 1mm; margin-top: 6mm; font-size: 7.5pt; }
  .footer { text-align: center; font-size: 7pt; margin-top: 3mm; border-top: 1px dashed #000; padding-top: 1.5mm; color: #444; line-height: 1.4; }
</style>
</head>
<body>
<div class="header">
  <div class="title">خزينة التوريد والصرف</div>
  <div class="subtitle">الاحلام للتوكيلات التجاريه</div>
  <div class="divider"></div>
  <strong class="type-label">${typeLabel}</strong>
  <span class="status-badge">${statusLabel}</span>
</div>

<table class="meta-table">
  <tr><td>رقم الإيصال:</td><td>TX-${id}</td></tr>
  <tr><td>التاريخ والوقت:</td><td>${date}</td></tr>
  <tr><td>نوع العملية:</td><td>${tx.type === 'exchange' ? 'تسوية فئات الخزينة (فك)' : tx.type === 'deposit' ? 'توريد (دخول أموال)' : 'صرف (خروج أموال)'}</td></tr>
  <tr><td>طريقة الدفع:</td><td>${tx.type === 'exchange' ? 'تبديل فئات نقدية' : tx.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقدي بالخزينة'}</td></tr>
  ${tx.rep_name ? `<tr><td>المندوب:</td><td>${tx.rep_name}${tx.rep_code ? ` (${tx.rep_code})` : ''}</td></tr>` : ''}
  ${tx.agency_name ? `<tr><td>التوكيل:</td><td>${tx.agency_name}${tx.agency_code ? ` (${tx.agency_code})` : ''}</td></tr>` : ''}
  ${tx.supervisor_name ? `<tr><td>المشرف:</td><td>${tx.supervisor_name}${tx.supervisor_code ? ` (${tx.supervisor_code})` : ''}</td></tr>` : ''}
  ${tx.bank_name ? `<tr><td>الحساب البنكي:</td><td>${tx.bank_name}${tx.bank_code ? ` (${tx.bank_code})` : ''}</td></tr>` : ''}
  ${withdrawalSubType ? `<tr><td>بند الصرف:</td><td>${withdrawalSubType}</td></tr>` : ''}
  <tr><td>المحاسب المسؤول:</td><td><strong>${tx.creator_name || 'أمين الخزينة'}</strong></td></tr>
</table>

<div class="amount-box">
  <div class="amount-title">${isExchange ? 'القيمة الإجمالية للتبديل' : 'إجمالي المبلغ'}</div>
  <div class="amount-value">${amount} ج.م</div>
  <div class="amount-text">فقط وقدره: ${amountText}</div>
</div>

${isExchange && hasExchangeDenoms ? `
<div class="denom-header" style="color: #10b981; font-weight: 800;">📥 الفئات المستلمة (وارد للجرار/الخزنة):</div>
<table class="denom-table">
  <thead><tr><th>الفئة</th><th>العدد</th><th>القيمة الإجمالية</th></tr></thead>
  <tbody>${denomRowsExchangeIncoming}</tbody>
</table>

<div class="denom-header" style="color: #f43f5e; font-weight: 800;">📤 الفئات المسلمة (منصرف من الخزنة):</div>
<table class="denom-table">
  <thead><tr><th>الفئة</th><th>العدد</th><th>القيمة الإجمالية</th></tr></thead>
  <tbody>${denomRowsExchangeOutgoing}</tbody>
</table>
` : ''}

${hasDenoms ? `
<div class="denom-header">تفاصيل فئات الأوراق النقدية المودعة:</div>
<table class="denom-table">
  <thead><tr><th>الفئة</th><th>العدد</th><th>القيمة الإجمالية</th></tr></thead>
  <tbody>${denomRows}</tbody>
</table>
` : ''}

${tx.notes ? `<div class="notes-box"><strong>ملاحظات:</strong>${tx.notes}</div>` : ''}

<div class="signatures">
  <div class="sig-box">توقيع المندوب / المستلم</div>
  <div class="sig-box">توقيع أمين الخزينة</div>
</div>

<div class="footer">
  <p>شكراً لتعاملكم معنا</p>
  <p>نظام إدارة الخزينة الذكي — Cash Safe</p>
</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=340,height=700,scrollbars=yes');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة في المتصفح لطباعة الإيصال');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for fonts to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 600);
    };
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingTx(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');
    
    if (!newUser.username || !newUser.password || !newUser.role) {
      setUserError('يرجى ملء اسم المستخدم وكلمة المرور واختيار الدور');
      return;
    }
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          assigned_agency_id: newUser.role === 'accountant' ? (newUser.assigned_agency_id || null) : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUserSuccess('تم إضافة المستخدم الجديد بنجاح!');
        setNewUser({ username: '', password: '', role: 'accountant', assigned_agency_id: '' });
        loadUsers();
      } else {
        setUserError(data.error || 'حدث خطأ أثناء حفظ المستخدم');
      }
    } catch (err) {
      setUserError('تعذر الاتصال بالسيرفر');
    }
  };

  // Intercept fetch calls to inject role headers
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      const saved = localStorage.getItem('currentUser');
      const user = saved ? JSON.parse(saved) : null;
      
      if (user) {
        options.headers = options.headers || {};
        options.headers['x-user-role'] = user.role;
        options.headers['x-user-id'] = user.id.toString();
        if (user.assigned_agency_id) {
          options.headers['x-user-agency-id'] = user.assigned_agency_id.toString();
        }
      }
      return originalFetch(url, options);
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('currentUser', JSON.stringify(data));
        setCurrentUser(data);
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setLoginError(data.error || 'خطأ في تسجيل الدخول');
      }
    } catch (err) {
      setLoginError('تعذر الاتصال بالسيرفر');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeTab');
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const loadPendingTx = async () => {
    try {
      const res = await fetch('/api/transactions/pending');
      if (res.ok) {
        const data = await res.json();
        setPendingTx(data);
      }
    } catch (err) {
      console.error('Failed to load pending transactions:', err);
    }
  };

  const handleApproveTx = async (id) => {
    if (window.confirm('هل أنت متأكد من الموافقة على طلب الصرف هذا؟')) {
      try {
        const res = await fetch(`/api/transactions/${id}/approve`, {
          method: 'POST'
        });
        const data = await res.json();
        if (res.ok) {
          alert('تمت الموافقة بنجاح!');
          loadPendingTx();
          loadDashboard();
          loadTransactions();
          loadCarExpenses();
        } else {
          alert(data.error || 'حدث خطأ أثناء الموافقة');
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const handleRejectTx = async (id) => {
    if (window.confirm('هل أنت متأكد من رفض طلب الصرف هذا؟')) {
      try {
        const res = await fetch(`/api/transactions/${id}/reject`, {
          method: 'POST'
        });
        const data = await res.json();
        if (res.ok) {
          alert('تم رفض الطلب بنجاح!');
          loadPendingTx();
          loadDashboard();
          loadTransactions();
        } else {
          alert(data.error || 'حدث خطأ أثناء الرفض');
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [repsSubTab, setRepsSubTab] = useState('delegates');

  const getClassificationLabel = (cls) => {
    switch(cls) {
      case 'retail_rep': return '🛍️ مندوب تجزئة';
      case 'wholesale_rep': return '💼 مندوب جملة';
      case 'supervisor_staff': return '👔 مشرف';
      case 'accountant_staff': return '💼 محاسب';
      case 'admin_staff': return '👑 موظف إداري';
      case 'warehouse_staff': return '📦 أمين/عامل مخزن';
      case 'driver': return '🚚 سائق';
      case 'worker': return '🔧 عامل';
      default: return '👤 موظف';
    }
  };

  const getClassificationBadgeStyle = (cls) => {
    switch(cls) {
      case 'retail_rep':
        return { background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid rgba(14, 165, 233, 0.2)' };
      case 'wholesale_rep':
        return { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)' };
      case 'supervisor_staff':
        return { background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.2)' };
      case 'accountant_staff':
        return { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'admin_staff':
        return { background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.2)' };
      case 'warehouse_staff':
        return { background: 'rgba(14, 116, 144, 0.1)', color: '#0e7490', border: '1px solid rgba(14, 116, 144, 0.2)' };
      case 'driver':
        return { background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.2)' };
      case 'worker':
        return { background: 'rgba(100, 116, 139, 0.1)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.2)' };
      default:
        return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' };
    }
  };

  const getWithdrawalSubTypes = () => {
    if (txSourceType === 'direct') {
      return [
        { value: 'car', label: '🚗 مصاريف سيارات' },
        { value: 'direct_rent', label: '🏢 الإيجار' },
        { value: 'direct_operational', label: '🔧 مصاريف تشغيل عامة' },
        { value: 'direct_other', label: '📝 أخرى' }
      ];
    }
    
    const selectedRep = reps.find(r => r.id === Number(newTx.repId));
    if (selectedRep) {
      const cls = selectedRep.classification;
      if (cls === 'retail_rep' || cls === 'wholesale_rep') {
        return [
          { value: 'car', label: '🚗 مصاريف سيارات' },
          { value: 'salary', label: '💵 راتب' },
          { value: 'commission', label: '💰 عمولة' },
          { value: 'loan', label: '💸 سلفة' },
          { value: 'other', label: '📝 أخرى' }
        ];
      } else {
        return [
          { value: 'salary', label: '💵 راتب' },
          { value: 'loan', label: '💸 سلفة' },
          { value: 'commission', label: '💰 عمولة / مكافآت' },
          { value: 'other', label: '📝 صرف عام' }
        ];
      }
    }
    
    return [
      { value: 'car', label: '🚗 مصاريف سيارات' },
      { value: 'salary', label: '💵 راتب' },
      { value: 'commission', label: '💰 عمولة' },
      { value: 'loan', label: '💸 سلفة' },
      { value: 'other', label: '📝 أخرى' }
    ];
  };

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [dashboardData, setDashboardData] = useState({
    summary: { totalDeposits: 0, totalWithdrawals: 0, safeBalance: 0, repsCount: 0, safeInitialBalance: 0, safeInitialBalanceSet: true },
    recentTransactions: []
  });

  const [initialDenominations, setInitialDenominations] = useState({
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
    denom_5: 0,
    denom_1: 0
  });
  const [initialBalanceLoading, setInitialBalanceLoading] = useState(false);
  const [initialBalanceError, setInitialBalanceError] = useState('');

  const totalInitialBalance = 
    (Number(initialDenominations.denom_200 || 0) * 200) +
    (Number(initialDenominations.denom_100 || 0) * 100) +
    (Number(initialDenominations.denom_50 || 0) * 50) +
    (Number(initialDenominations.denom_20 || 0) * 20) +
    (Number(initialDenominations.denom_10 || 0) * 10) +
    (Number(initialDenominations.denom_5 || 0) * 5) +
    (Number(initialDenominations.denom_1 || 0) * 1);

  const handleSaveInitialBalance = async (e) => {
    e.preventDefault();
    setInitialBalanceError('');
    setInitialBalanceLoading(true);
    
    const settingsPayload = [
      { key: 'safe_initial_balance', value: totalInitialBalance },
      { key: 'safe_initial_denom_200', value: Number(initialDenominations.denom_200 || 0) },
      { key: 'safe_initial_denom_100', value: Number(initialDenominations.denom_100 || 0) },
      { key: 'safe_initial_denom_50', value: Number(initialDenominations.denom_50 || 0) },
      { key: 'safe_initial_denom_20', value: Number(initialDenominations.denom_20 || 0) },
      { key: 'safe_initial_denom_10', value: Number(initialDenominations.denom_10 || 0) },
      { key: 'safe_initial_denom_5', value: Number(initialDenominations.denom_5 || 0) },
      { key: 'safe_initial_denom_1', value: Number(initialDenominations.denom_1 || 0) }
    ];

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsPayload })
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم حفظ رصيد أول المدة بالفئات بنجاح!');
        loadDashboard();
      } else {
        setInitialBalanceError(data.error || 'حدث خطأ أثناء حفظ رصيد أول المدة');
      }
    } catch (err) {
      setInitialBalanceError('تعذر الاتصال بالسيرفر');
    } finally {
      setInitialBalanceLoading(false);
    }
  };
  const [reps, setReps] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [banks, setBanks] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [repsLoaded, setRepsLoaded] = useState(false);
  const [agenciesLoaded, setAgenciesLoaded] = useState(false);
  const [banksLoaded, setBanksLoaded] = useState(false);
  const [supervisorsLoaded, setSupervisorsLoaded] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [selectedRepLedger, setSelectedRepLedger] = useState(null); // Detailed statement modal/view
  const [selectedAgencyLedger, setSelectedAgencyLedger] = useState(null); // Detailed agency ledger view
  const [selectedBankLedger, setSelectedBankLedger] = useState(null); // Detailed bank ledger view
  const [selectedSupervisorReps, setSelectedSupervisorReps] = useState(null); // Detailed supervisor reps view
  
  // New Agency Form State
  const [newAgency, setNewAgency] = useState({ code: '', name: '' });
  const [agencyError, setAgencyError] = useState('');
  const [agencySuccess, setAgencySuccess] = useState('');

  // New Bank Form State
  const [newBank, setNewBank] = useState({ code: '', name: '', account_number: '', account_name: '', branch: '', initial_balance: '' });
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');

  // Bank Initial Balance Config States
  const [bankInitBalances, setBankInitBalances] = useState({});
  const [bankInitError, setBankInitError] = useState('');
  const [bankInitSuccess, setBankInitSuccess] = useState('');

  // New Supervisor Form State
  const [newSupervisor, setNewSupervisor] = useState({ code: '', name: '' });
  const [supervisorError, setSupervisorError] = useState('');
  const [supervisorSuccess, setSupervisorSuccess] = useState('');

  // New Representative Form State
  const [newRep, setNewRep] = useState({ code: '', name: '', phone: '', type: 'retail', classification: 'retail_rep', agency_id: '', supervisor_id: '', password: '' });
  const [repError, setRepError] = useState('');
  const [repSuccess, setRepSuccess] = useState('');

  // Helper to compute next sequential numeric code
  const getNextCode = (list, defaultCode = '1001', checkUniqueList = null) => {
    const numericCodes = (list || [])
      .map(item => parseInt(item.code))
      .filter(num => !isNaN(num));
    
    let proposedNum = numericCodes.length === 0 ? parseInt(defaultCode) : Math.max(...numericCodes) + 1;
    
    // Resolve any global code collisions if checkUniqueList is provided
    if (checkUniqueList && checkUniqueList.length > 0) {
      const allUsedCodes = new Set(checkUniqueList.map(item => item.code ? item.code.toString().trim() : ''));
      while (allUsedCodes.has(proposedNum.toString())) {
        proposedNum++;
      }
    }
    
    return proposedNum.toString();
  };

  // Auto-generate codes for forms
  useEffect(() => {
    if (repsLoaded) {
      const cls = newRep.classification || 'retail_rep';
      const defaults = {
        retail_rep: '5001',
        wholesale_rep: '6001',
        supervisor_staff: '7001',
        accountant_staff: '8001',
        admin_staff: '9001',
        warehouse_staff: '4001',
        driver: '1001',
        worker: '2001'
      };
      const defaultCode = defaults[cls] || '5001';
      const filteredReps = reps.filter(r => r.classification === cls);
      const nextCode = getNextCode(filteredReps, defaultCode, reps);
      
      if (newRep.code !== nextCode) {
        setNewRep(prev => ({ ...prev, code: nextCode }));
      }
    }
  }, [reps, repsLoaded, newRep.classification, newRep.code]);

  useEffect(() => {
    if (agenciesLoaded && !newAgency.code) {
      setNewAgency(prev => ({ ...prev, code: getNextCode(agencies, '1001') }));
    }
  }, [agencies, agenciesLoaded, newAgency.code]);

  useEffect(() => {
    if (banksLoaded && !newBank.code) {
      setNewBank(prev => ({ ...prev, code: getNextCode(banks, '8001') }));
    }
  }, [banks, banksLoaded, newBank.code]);

  useEffect(() => {
    if (supervisorsLoaded && !newSupervisor.code) {
      setNewSupervisor(prev => ({ ...prev, code: getNextCode(supervisors, '3001') }));
    }
  }, [supervisors, supervisorsLoaded, newSupervisor.code]);
  
  // New Transaction Form State
  const [newTx, setNewTx] = useState({ type: 'deposit', repId: '', bankId: '', amount: '', cashAmount: '', bankTransferAmount: '', notes: '', payment_method: 'cash' });
  const [txSourceType, setTxSourceType] = useState('rep'); // 'rep' | 'bank' | 'direct'
  const [denominations, setDenominations] = useState({
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
    denom_5: 0,
    denom_1: 0
  });
  const [incomingDenominations, setIncomingDenominations] = useState({
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
    denom_5: 0,
    denom_1: 0
  });
  const [outgoingDenominations, setOutgoingDenominations] = useState({
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
    denom_5: 0,
    denom_1: 0
  });
  const [searchRepQuery, setSearchRepQuery] = useState('');
  const [showRepSuggestions, setShowRepSuggestions] = useState(false);
  const [txError, setTxError] = useState('');
  const [txSuccess, setTxSuccess] = useState(null);
  const [receiptImageBank, setReceiptImageBank] = useState(null); // base64 string for bank transfer receipt
  
  // Transaction Filters State
  const [filters, setFilters] = useState({ type: '', repId: '', bankId: '', startDate: '', endDate: '' });

  // Car Expenses State
  const [carExpenses, setCarExpenses] = useState([]);
  const [carFilters, setCarFilters] = useState({ repId: '', supervisorId: '', agencyId: '', startDate: '', endDate: '', subType: '' });

  // Load Initial Data
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'representative') {
        loadRepLedger();
      } else {
        loadDashboard();
        loadReps();
        loadAgencies();
        loadBanks();
        loadCompanies();
        loadSupervisors();
        loadTransactions();
        loadCarExpenses();
        if (currentUser.role === 'manager') {
          loadPendingTx();
          loadUsers();
        }

        // Restore persisted ledger state on refresh
        const savedBankId = localStorage.getItem('selectedBankLedgerId');
        const savedRepId = localStorage.getItem('selectedRepLedgerId');
        const savedAgencyId = localStorage.getItem('selectedAgencyLedgerId');
        const savedSupId = localStorage.getItem('selectedSupervisorRepsId');
        const savedCompany = localStorage.getItem('selectedCompanyForLedger');
        
        const currentTab = localStorage.getItem('activeTab') || 'dashboard';
        if (currentTab === 'banks' && savedBankId) {
          handleViewBankLedger(savedBankId);
        } else if (currentTab === 'reps' && savedRepId) {
          handleViewLedger(savedRepId);
        } else if (currentTab === 'agencies' && savedAgencyId) {
          handleViewAgencyLedger(savedAgencyId);
        } else if (currentTab === 'reps' && savedSupId) {
          handleViewSupervisorReps(savedSupId);
        } else if (currentTab === 'companies' && savedCompany) {
          loadCompanyLedger(JSON.parse(savedCompany));
        }
      }
    }
  }, [currentUser]);

  // Manager notification permissions only
  useEffect(() => {
    if (currentUser && currentUser.role === 'manager') {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [currentUser]);

  // Periodic polling for ALL users to keep client state synchronized in real-time
  useEffect(() => {
    if (!currentUser) return;

    const pollData = () => {
      if (currentUser.role === 'representative') {
        loadRepLedger();
      } else {
        loadDashboard();
        loadTransactions();
        loadCarExpenses();
        loadBanks();
        loadAgencies();
        loadReps();
        loadSupervisors();
        loadCompanies();
        
        if (currentUser.role === 'manager') {
          loadPendingTx();
        }
      }
    };

    const interval = setInterval(pollData, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Monitor pending transactions count for sound and desktop notifications
  useEffect(() => {
    if (currentUser && currentUser.role === 'manager') {
      const currentCount = pendingTx.length;
      if (currentCount > prevPendingCount) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const playTone = (freq, time, duration) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, time);
              gain.gain.setValueAtTime(0.15, time);
              gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(time);
              osc.stop(time + duration);
            };
            const now = ctx.currentTime;
            playTone(587.33, now, 0.15); // D5
            playTone(880.00, now + 0.1, 0.3); // A5
          }
        } catch (e) {
          console.warn('Audio notification failed:', e);
        }
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('طلبات معلقة بالخزينة ⚠️', {
            body: `يوجد حالياً ${currentCount} من طلبات الصرف بانتظار موافقتك المباشرة.`,
            dir: 'rtl'
          });
        }
      }
      setPrevPendingCount(currentCount);
    }
  }, [pendingTx, currentUser, prevPendingCount]);

  useEffect(() => {
    if (activeTab !== prevTab) {
      // Clear ledger views when user explicitly switches tabs
      setSelectedRepLedger(null);
      setSelectedAgencyLedger(null);
      setSelectedBankLedger(null);
      setSelectedSupervisorReps(null);
      setSelectedCompanyForLedger(null);
      setCompanyLedgerData(null);
      
      localStorage.removeItem('selectedBankLedgerId');
      localStorage.removeItem('selectedRepLedgerId');
      localStorage.removeItem('selectedAgencyLedgerId');
      localStorage.removeItem('selectedSupervisorRepsId');
      localStorage.removeItem('selectedCompanyForLedger');
      
      setPrevTab(activeTab);
    }
  }, [activeTab, prevTab]);

  // Force active tab for representatives
  useEffect(() => {
    if (currentUser && currentUser.role === 'representative') {
      setActiveTab('rep-dashboard');
    }
  }, [currentUser]);

  // Populate bank initial balance inputs when banks list loads
  useEffect(() => {
    if (banks.length > 0) {
      const initialMap = {};
      banks.filter(b => Number(b.initial_balance) === 0).forEach(bank => {
        initialMap[bank.id] = '';
      });
      setBankInitBalances(initialMap);
    }
  }, [banks]);

  const loadCarExpenses = async () => {
    try {
      const res = await fetch('/api/transactions?type=withdrawal&withdrawal_sub_type=car');
      if (res.ok) {
        const data = await res.json();
        setCarExpenses(data);
      }
    } catch (err) {
      console.error('Failed to load car expenses:', err);
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const loadReps = async () => {
    setRepsLoaded(false);
    try {
      const res = await fetch('/api/reps');
      if (res.ok) {
        const data = await res.json();
        setReps(data);
        setRepsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load representatives:', err);
    }
  };

  const loadAgencies = async () => {
    setAgenciesLoaded(false);
    try {
      const res = await fetch('/api/agencies');
      if (res.ok) {
        const data = await res.json();
        setAgencies(data);
        setAgenciesLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load agencies:', err);
    }
  };

  const loadBanks = async () => {
    setBanksLoaded(false);
    try {
      const res = await fetch('/api/banks');
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
        setBanksLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load banks:', err);
    }
  };

  const loadSupervisors = async () => {
    setSupervisorsLoaded(false);
    try {
      const res = await fetch('/api/supervisors');
      if (res.ok) {
        const data = await res.json();
        setSupervisors(data);
        setSupervisorsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load supervisors:', err);
    }
  };

  const loadCompanies = async () => {
    setCompaniesLoaded(false);
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
        setCompaniesLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setCompanyError('');
    setCompanySuccess('');
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      const data = await res.json();
      if (res.ok) {
        setCompanySuccess('تم إضافة الشركة بنجاح');
        setNewCompany({ code: '', name: '', bank_account_number: '', bank_name: '' });
        loadCompanies();
      } else {
        setCompanyError(data.error || 'حدث خطأ أثناء إضافة الشركة');
      }
    } catch (err) {
      console.error('Failed to create company:', err);
      setCompanyError('فشل الاتصال بالخادم الخلفي');
    }
  };

  const handleDeleteCompany = async (id) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه الشركة؟')) return;
    setCompanyError('');
    setCompanySuccess('');
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setCompanySuccess('تم حذف الشركة بنجاح');
        loadCompanies();
        if (selectedCompanyForLedger && selectedCompanyForLedger.id === id) {
          setSelectedCompanyForLedger(null);
          setCompanyLedgerData(null);
        }
      } else {
        setCompanyError(data.error || 'حدث خطأ أثناء حذف الشركة');
      }
    } catch (err) {
      console.error('Failed to delete company:', err);
      setCompanyError('فشل الاتصال بالخادم الخلفي');
    }
  };

  const loadCompanyLedger = async (company) => {
    setCompanyLedgerLoading(true);
    setSelectedCompanyForLedger(company);
    localStorage.setItem('selectedCompanyForLedger', JSON.stringify(company));
    try {
      const res = await fetch(`/api/companies/${company.id}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setCompanyLedgerData(data);
      }
    } catch (err) {
      console.error('Failed to load company ledger:', err);
    } finally {
      setCompanyLedgerLoading(false);
    }
  };

  const loadTransactions = async (appliedFilters = filters) => {
    try {
      let queryParams = new URLSearchParams();
      if (appliedFilters.type) queryParams.append('type', appliedFilters.type);
      if (appliedFilters.repId) queryParams.append('rep_id', appliedFilters.repId);
      if (appliedFilters.bankId) queryParams.append('bank_id', appliedFilters.bankId);
      if (appliedFilters.startDate) queryParams.append('start_date', appliedFilters.startDate);
      if (appliedFilters.endDate) queryParams.append('end_date', appliedFilters.endDate);
      
      const res = await fetch(`/api/transactions?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const handleAddAgency = async (e) => {
    e.preventDefault();
    setAgencyError('');
    setAgencySuccess('');
    
    if (!newAgency.code || !newAgency.name) {
      setAgencyError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    try {
      const res = await fetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgency)
      });
      
      const data = await res.json();
      if (res.ok) {
        setAgencySuccess('تم إضافة التوكيل بنجاح!');
        setNewAgency({ code: '', name: '' });
        loadAgencies();
        loadDashboard();
      } else {
        setAgencyError(data.error || 'حدث خطأ أثناء حفظ التوكيل');
      }
    } catch (err) {
      setAgencyError('تعذر الاتصال بالسيرفر');
    }
  };

  const handleDeleteAgency = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف التوكيل "${name}"؟ المناديب التابعين له سيصبحون بدون توكيل.`)) {
      try {
        const res = await fetch(`/api/agencies/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok) {
          loadAgencies();
          loadReps();
          loadDashboard();
          if (selectedAgencyLedger && selectedAgencyLedger.agency.id === id) {
            setSelectedAgencyLedger(null);
          }
        } else {
          alert(data.error || 'حدث خطأ أثناء حذف التوكيل');
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const handleViewAgencyLedger = async (agencyId) => {
    try {
      const res = await fetch(`/api/agencies/${agencyId}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAgencyLedger(data);
        localStorage.setItem('selectedAgencyLedgerId', agencyId);
      }
    } catch (err) {
      console.error('Failed to load agency ledger:', err);
    }
  };

  const handleAddBank = async (e) => {
    e.preventDefault();
    setBankError('');
    setBankSuccess('');
    
    if (!newBank.code || !newBank.name || !newBank.account_number) {
      setBankError('يرجى ملء جميع الحقول المطلوبة (الكود والاسم ورقم الحساب)');
      return;
    }
    
    try {
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBank)
      });
      
      const data = await res.json();
      if (res.ok) {
        setBankSuccess('تم إضافة الحساب البنكي بنجاح!');
        setNewBank({ code: '', name: '', account_number: '', account_name: '', branch: '', initial_balance: '' });
        loadBanks();
        loadDashboard();
      } else {
        setBankError(data.error || 'حدث خطأ أثناء حفظ البنك');
      }
    } catch (err) {
      setBankError('تعذر الاتصال بالسيرفر');
    }
  };

  const handleDeleteBank = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف الحساب البنكي "${name}"؟ جميع المعاملات البنكية المرتبطة به ستصبح غير مرتبطة بأي حساب بنكي.`)) {
      try {
        const res = await fetch(`/api/banks/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok) {
          loadBanks();
          loadDashboard();
          loadTransactions();
          if (selectedBankLedger && selectedBankLedger.bank.id === id) {
            setSelectedBankLedger(null);
          }
        } else {
          alert(data.error || 'حدث خطأ أثناء حذف الحساب البنكي');
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const handleViewBankLedger = async (bankId) => {
    try {
      const res = await fetch(`/api/banks/${bankId}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setSelectedBankLedger(data);
        localStorage.setItem('selectedBankLedgerId', bankId);
      }
    } catch (err) {
      console.error('Failed to load bank ledger:', err);
    }
  };

  const handleAddSupervisor = async (e) => {
    e.preventDefault();
    setSupervisorError('');
    setSupervisorSuccess('');
    
    if (!newSupervisor.code || !newSupervisor.name) {
      setSupervisorError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    try {
      const res = await fetch('/api/supervisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupervisor)
      });
      
      const data = await res.json();
      if (res.ok) {
        setSupervisorSuccess('تم إضافة المشرف بنجاح!');
        setNewSupervisor({ code: '', name: '' });
        loadSupervisors();
      } else {
        setSupervisorError(data.error || 'حدث خطأ أثناء حفظ المشرف');
      }
    } catch (err) {
      setSupervisorError('تعذر الاتصال بالسيرفر');
    }
  };

  const handleDeleteSupervisor = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف المشرف "${name}"؟ المناديب التابعين له سيصبحون بدون مشرف.`)) {
      try {
        const res = await fetch(`/api/supervisors/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok) {
          loadSupervisors();
          loadReps();
          if (selectedSupervisorReps && selectedSupervisorReps.supervisor.id === id) {
            setSelectedSupervisorReps(null);
          }
        } else {
          alert(data.error || 'حدث خطأ أثناء حذف المشرف');
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const handleViewSupervisorReps = async (supervisorId) => {
    try {
      const res = await fetch(`/api/supervisors/${supervisorId}/reps`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSupervisorReps(data);
        localStorage.setItem('selectedSupervisorRepsId', supervisorId);
      }
    } catch (err) {
      console.error('Failed to load supervisor representatives:', err);
    }
  };

  const handleAddRep = async (e) => {
    e.preventDefault();
    setRepError('');
    setRepSuccess('');
    
    const isRep = (newRep.classification === 'retail_rep' || newRep.classification === 'wholesale_rep');
    
    if (!newRep.code || !newRep.name) {
      setRepError('يرجى ملء جميع الحقول المطلوبة (الكود والاسم)');
      return;
    }
    
    if (isRep && !newRep.agency_id) {
      setRepError('يرجى اختيار التوكيل التابع له المندوب');
      return;
    }
    
    try {
      const res = await fetch('/api/reps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRep)
      });
      
      const data = await res.json();
      if (res.ok) {
        setRepSuccess('تم إضافة المندوب بنجاح!');
        setNewRep({ code: '', name: '', phone: '', type: 'retail', agency_id: '', supervisor_id: '', password: '' });
        loadReps();
        loadDashboard();
        loadAgencies();
        loadSupervisors();
      } else {
        setRepError(data.error || 'حدث خطأ أثناء حفظ المندوب');
      }
    } catch (err) {
      setRepError('تعذر الاتصال بالسيرفر');
    }
  };

  const handleDeleteRep = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف المندوب "${name}"؟ معاملات المندوب السابقة ستتحول إلى معاملات مباشرة بالخزينة.`)) {
      try {
        const res = await fetch(`/api/reps/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok) {
          loadReps();
          loadSupervisors();
          loadDashboard();
          loadTransactions();
          if (selectedRepLedger && selectedRepLedger.representative.id === id) {
            setSelectedRepLedger(null);
          }
        } else {
          alert(data.error || 'حدث خطأ أثناء حذف المندوب');
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (window.confirm(`هل أنت متأكد من حذف هذه العملية نهائياً؟ رقم العملية: TX-${String(id).padStart(6, '0')}`)) {
      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok) {
          alert('تم حذف العملية بنجاح!');
          loadDashboard();
          loadTransactions();
          loadCarExpenses();
          loadBanks();
          loadAgencies();
          loadReps();
          if (currentUser.role === 'manager') {
            loadPendingTx();
          }
        } else {
          alert(data.error || 'حدث خطأ أثناء حذف العملية');
        }
      } catch (err) {
        alert('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const handleUpdateRepPassword = async (repId, repName) => {
    const password = window.prompt(`أدخل كلمة المرور الجديدة للمندوب "${repName}":`);
    if (password === null) return;
    if (password.trim() === '') {
      alert('لا يمكن أن تكون كلمة المرور فارغة');
      return;
    }
    try {
      const res = await fetch(`/api/reps/${repId}/password`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم تعيين كلمة المرور بنجاح! ✔️');
      } else {
        alert(data.error || 'حدث خطأ أثناء تعيين كلمة المرور');
      }
    } catch (err) {
      alert('تعذر الاتصال بالسيرفر');
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setTxError('');
    
    if (!window.confirm('هل أنت متأكد من تسجيل هذه العملية؟')) {
      return;
    }

    // Check if we are doing a company transfer
    if (newTx.type === 'company_transfer') {
      const amountNum = parseFloat(newTx.amount);
      if (!newTx.amount || isNaN(amountNum) || amountNum <= 0) {
        const msg = 'يرجى إدخال مبلغ صحيح أكبر من الصفر';
        setTxError(msg);
        alert(msg);
        return;
      }
      if (txSourceType === 'bank' && !newTx.bankId) {
        setTxError('يرجى اختيار الحساب البنكي المصدر للتحويل');
        return;
      }
      if (!newTx.companyId) {
        setTxError('يرجى اختيار الشركة المستلمة للحوالة');
        return;
      }

      try {
        const requestBody = {
          type: 'company_transfer',
          amount: amountNum,
          notes: newTx.notes,
          payment_method: txSourceType === 'bank' ? 'bank_transfer' : 'cash',
          bank_id: txSourceType === 'bank' ? Number(newTx.bankId) : null,
          company_id: Number(newTx.companyId)
        };

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        if (res.ok) {
          const selectedBankName = txSourceType === 'bank' 
            ? (banks.find(b => b.id === Number(newTx.bankId))?.name || 'البنك المصدر')
            : 'الخزينة المباشرة';
          const selectedCompanyName = companies.find(c => c.id === Number(newTx.companyId))?.name || 'الشركة المستلمة';
          
          setTxSuccess({
            type: 'company_transfer',
            amount: amountNum,
            bankName: selectedBankName,
            companyName: selectedCompanyName,
            notes: newTx.notes || 'حوالة لشركة'
          });

          if (data.transaction) {
            handlePrintReceipt(data.transaction);
          }
          
          // Reset Form
          setNewTx({ type: 'deposit', repId: '', bankId: '', amount: '', cashAmount: '', bankTransferAmount: '', notes: '', payment_method: 'cash' });
          setTxSourceType('rep');
          setSearchRepQuery('');
          
          // Refresh Lists
          loadDashboard();
          loadReps();
          loadAgencies();
          loadBanks();
          loadCompanies();
          loadTransactions();
          loadCarExpenses();
        } else {
          setTxError(data.error || 'حدث خطأ أثناء إرسال الحوالة');
        }
      } catch (err) {
        setTxError('تعذر الاتصال بالسيرفر');
      }
      return;
    }
    
    // Check if we are doing an exchange
    if (newTx.type === 'exchange') {
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

      const incomingTotal = (i200 * 200) + (i100 * 100) + (i50 * 50) + (i20 * 20) + (i10 * 10) + (i5 * 5) + (i1 * 1);
      const outgoingTotal = (o200 * 200) + (o100 * 100) + (o50 * 50) + (o20 * 20) + (o10 * 10) + (o5 * 5) + (o1 * 1);

      if (incomingTotal <= 0) {
        const msg = 'يرجى إدخال فئات صحيحة للتسوية والتبديل';
        setTxError(msg);
        alert(msg);
        return;
      }

      if (incomingTotal !== outgoingTotal) {
        const msg = `قيمة الفئات المستلمة (${incomingTotal.toLocaleString()} ج.م) لا تطابق قيمة الفئات المسلمة (${outgoingTotal.toLocaleString()} ج.م)!`;
        setTxError(msg);
        alert(msg);
        return;
      }

      try {
        const requestBody = {
          type: 'exchange',
          amount: incomingTotal,
          notes: newTx.notes || 'تسوية فئات الخزينة',
          rep_id: newTx.repId || null,
          incomingDenominations,
          outgoingDenominations
        };

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        if (res.ok) {
          setTxSuccess({
            type: 'exchange',
            amount: incomingTotal,
            repName: newTx.repId ? (searchRepQuery || 'مندوب') : 'خزينة مباشرة',
            notes: newTx.notes || 'تسوية فئات الخزينة'
          });

          if (data.transaction) {
            handlePrintReceipt(data.transaction);
          }
          
          // Reset Form
          setNewTx({ type: 'deposit', repId: '', bankId: '', amount: '', cashAmount: '', bankTransferAmount: '', notes: '', payment_method: 'cash' });
          setIncomingDenominations({ denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 });
          setOutgoingDenominations({ denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 });
          setSearchRepQuery('');
          setTxSourceType('rep');
          
          // Refresh Lists
          loadDashboard();
          loadReps();
          loadAgencies();
          loadBanks();
          loadTransactions();
          loadCarExpenses();
        } else {
          setTxError(data.error || 'حدث خطأ أثناء إتمام عملية التسوية');
        }
      } catch (err) {
        setTxError('تعذر الاتصال بالسيرفر');
      }
      return;
    }

    // Check if we are doing a deposit or withdrawal
    if (newTx.type === 'withdrawal' || txSourceType === 'bank') {
      const amountNum = parseFloat(newTx.amount);
      if (!newTx.amount || isNaN(amountNum) || amountNum <= 0) {
        const msg = 'يرجى إدخال مبلغ صحيح أكبر من الصفر';
        setTxError(msg);
        alert(msg);
        return;
      }

      if (newTx.type === 'withdrawal' && amountNum > dashboardData.summary.safeBalance) {
        const msg = `رصيد الخزينة الحالي (${dashboardData.summary.safeBalance.toLocaleString()} ج.م) غير كافٍ لإتمام عملية الصرف!`;
        setTxError(msg);
        alert(msg);
        return;
      }

      // If we are doing a deposit from the bank, we need bankId
      if (newTx.type === 'deposit' && txSourceType === 'bank' && !newTx.bankId) {
        setTxError('يرجى اختيار الحساب البنكي المورِّد منه أولاً');
        return;
      }

      // Validate denominations for safe withdrawals and bank deposits
      if (newTx.type === 'withdrawal' || (newTx.type === 'deposit' && txSourceType === 'bank')) {
        const calculatedTotal = 
          (Number(denominations.denom_200 || 0) * 200) + 
          (Number(denominations.denom_100 || 0) * 100) + 
          (Number(denominations.denom_50 || 0) * 50) + 
          (Number(denominations.denom_20 || 0) * 20) + 
          (Number(denominations.denom_10 || 0) * 10) + 
          (Number(denominations.denom_5 || 0) * 5) + 
          (Number(denominations.denom_1 || 0) * 1);
        if (isNaN(calculatedTotal) || Math.abs(calculatedTotal - amountNum) > 0.01) {
          const msg = `مجموع الفئات النقدية المحددة هو (${(calculatedTotal || 0).toLocaleString()} ج.م) ولكنه لا يطابق قيمة المبلغ المطلوب (${amountNum.toLocaleString()} ج.م)!`;
          setTxError(msg);
          alert(msg);
          return;
        }
      }

      try {
        const requestBody = {
          type: newTx.type,
          amount: amountNum,
          notes: newTx.notes,
          payment_method: 'cash'
        };
        
        if (txSourceType === 'rep') {
          requestBody.rep_id = newTx.repId || null;
          requestBody.withdrawal_sub_type = newTx.withdrawal_sub_type || null;
        } else if (txSourceType === 'bank') {
          requestBody.bank_id = newTx.bankId || null;
          requestBody.agency_id = newTx.agencyId || null;
        }

        // Include denominations for cash transactions (deposits and withdrawals)
        requestBody.denominations = denominations;

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        if (res.ok) {
          let partyName = 'خزينة مباشرة';
          if (txSourceType === 'rep') {
            partyName = searchRepQuery || 'خزينة مباشرة';
          } else if (txSourceType === 'bank') {
            const selectedBankName = banks.find(b => b.id === Number(newTx.bankId))?.name || 'حساب بنكي';
            partyName = selectedBankName;
          }

          setTxSuccess({
            type: newTx.type,
            amount: amountNum,
            repName: partyName,
            notes: newTx.notes
          });

          if (data.transaction) {
            handlePrintReceipt(data.transaction);
          }
          
          // Reset Form
          setNewTx({ type: 'deposit', repId: '', bankId: '', amount: '', cashAmount: '', bankTransferAmount: '', notes: '', payment_method: 'cash' });
          setTxSourceType('rep');
          setDenominations({
            denom_200: 0,
            denom_100: 0,
            denom_50: 0,
            denom_20: 0,
            denom_10: 0,
            denom_5: 0,
            denom_1: 0
          });
          setSearchRepQuery('');
          setReceiptImageBank(null);
          
          // Refresh Lists
          loadDashboard();
          loadReps();
          loadAgencies();
          loadBanks();
          loadTransactions();
          loadCarExpenses();
        } else {
          setTxError(data.error || 'حدث خطأ أثناء إتمام العملية');
        }
      } catch (err) {
        setTxError('تعذر الاتصال بالسيرفر');
      }
    } else {
      // DEPOSIT WITH POTENTIAL SPLIT (CASH + BANK TRANSFER)
      const cashAmt = parseFloat(newTx.cashAmount) || 0;
      const bankAmt = parseFloat(newTx.bankTransferAmount) || 0;
      const totalAmt = cashAmt + bankAmt;

      if (totalAmt <= 0) {
        setTxError('يرجى إدخال مبلغ صحيح للتوريد النقدي أو التحويل البنكي');
        return;
      }

      // If rep source type, require representative selection
      if (txSourceType === 'rep' && !newTx.repId) {
        setTxError('يرجى اختيار المندوب أولاً');
        return;
      }

      // If bank transfer amount is filled, require bank ID
      if (bankAmt > 0 && !newTx.bankId) {
        setTxError('يرجى اختيار الحساب البنكي للتوريد بالتحويل');
        return;
      }

      // If cash amount is filled, validate denominations match
      if (cashAmt > 0) {
        const calculatedTotal = 
          (Number(denominations.denom_200 || 0) * 200) + 
          (Number(denominations.denom_100 || 0) * 100) + 
          (Number(denominations.denom_50 || 0) * 50) + 
          (Number(denominations.denom_20 || 0) * 20) + 
          (Number(denominations.denom_10 || 0) * 10) + 
          (Number(denominations.denom_5 || 0) * 5) + 
          (Number(denominations.denom_1 || 0) * 1);
        if (isNaN(calculatedTotal) || Math.abs(calculatedTotal - cashAmt) > 0.01) {
          const msg = `مجموع الفئات النقدية المحددة هو (${(calculatedTotal || 0).toLocaleString()} ج.م) ولكنه لا يطابق قيمة المبلغ النقدي المطلوب توريده (${cashAmt.toLocaleString()} ج.م)!`;
          setTxError(msg);
          alert(msg);
          return;
        }
      }

      try {
        const requestBody = {
          type: 'deposit',
          rep_id: txSourceType === 'rep' ? (newTx.repId || null) : null,
          bank_id: bankAmt > 0 ? (newTx.bankId || null) : null,
          cash_amount: cashAmt,
          bank_transfer_amount: bankAmt,
          notes: newTx.notes,
          denominations: cashAmt > 0 ? denominations : null,
          receipt_image_bank: bankAmt > 0 ? receiptImageBank : null
        };

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        if (res.ok) {
          let partyName = 'خزينة مباشرة';
          if (txSourceType === 'rep') {
            partyName = searchRepQuery || 'خزينة مباشرة';
          }

          setTxSuccess({
            type: 'deposit',
            amount: totalAmt,
            cashAmount: cashAmt,
            bankTransferAmount: bankAmt,
            repName: partyName,
            notes: newTx.notes
          });

          if (data.transactions && data.transactions.length > 0) {
            data.transactions.forEach(tx => {
              handlePrintReceipt(tx);
            });
          }
          
          // Reset Form
          setNewTx({ type: 'deposit', repId: '', bankId: '', amount: '', cashAmount: '', bankTransferAmount: '', notes: '', payment_method: 'cash' });
          setTxSourceType('rep');
          setDenominations({
            denom_200: 0,
            denom_100: 0,
            denom_50: 0,
            denom_20: 0,
            denom_10: 0,
            denom_5: 0,
            denom_1: 0
          });
          setSearchRepQuery('');
          setReceiptImageBank(null);
          
          // Refresh Lists
          loadDashboard();
          loadReps();
          loadAgencies();
          loadBanks();
          loadTransactions();
          loadCarExpenses();
        } else {
          setTxError(data.error || 'حدث خطأ أثناء إتمام العملية');
        }
      } catch (err) {
        setTxError('تعذر الاتصال بالسيرفر');
      }
    }
  };

  const handleViewLedger = async (repId) => {
    try {
      const res = await fetch(`/api/reps/${repId}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRepLedger(data);
        localStorage.setItem('selectedRepLedgerId', repId);
      }
    } catch (err) {
      console.error('Failed to load rep ledger:', err);
    }
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    loadTransactions();
  };

  const handleClearFilters = () => {
    const cleared = { type: '', repId: '', bankId: '', startDate: '', endDate: '' };
    setFilters(cleared);
    loadTransactions(cleared);
  };

  // Filtered Car Expenses
  const filteredCarExpenses = carExpenses.filter(tx => {
    if (carFilters.repId && tx.rep_id !== Number(carFilters.repId)) return false;
    const rep = reps.find(r => r.id === tx.rep_id);
    if (carFilters.agencyId && rep?.agency_id !== Number(carFilters.agencyId)) return false;
    if (carFilters.supervisorId && rep?.supervisor_id !== Number(carFilters.supervisorId)) return false;
    if (carFilters.startDate && new Date(tx.date) < new Date(carFilters.startDate + ' 00:00:00')) return false;
    if (carFilters.endDate && new Date(tx.date) > new Date(carFilters.endDate + ' 23:59:59')) return false;
    if (carFilters.subType && tx.withdrawal_sub_type !== carFilters.subType) return false;
    return true;
  });

  const totalCarExpenses = filteredCarExpenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const carExpensesCount = filteredCarExpenses.length;
  const averageCarExpense = carExpensesCount > 0 ? (totalCarExpenses / carExpensesCount) : 0;

  // Breakdown by Car Expense Sub-type (gas, oil, other, general)
  const gasTotal = filteredCarExpenses.filter(tx => tx.withdrawal_sub_type === 'car_gas').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const oilTotal = filteredCarExpenses.filter(tx => tx.withdrawal_sub_type === 'car_oil').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const otherTotal = filteredCarExpenses.filter(tx => tx.withdrawal_sub_type === 'car_other').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const legacyTotal = filteredCarExpenses.filter(tx => tx.withdrawal_sub_type === 'car' || !tx.withdrawal_sub_type).reduce((sum, tx) => sum + Number(tx.amount), 0);

  const subTypeBreakdown = [
    { name: '⛽ جاز', total: gasTotal },
    { name: '🛢️ زيت', total: oilTotal },
    { name: '🔧 مصاريف أخرى', total: otherTotal },
    { name: '🚗 مصاريف سيارات عامة', total: legacyTotal }
  ].filter(item => item.total > 0).sort((a, b) => b.total - a.total);

  // Breakdown by Agency
  const agencyBreakdown = agencies.map(agency => {
    const total = filteredCarExpenses
      .filter(tx => {
        const rep = reps.find(r => r.id === tx.rep_id);
        return rep?.agency_id === agency.id;
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    return { ...agency, total };
  }).filter(a => a.total > 0).sort((a, b) => b.total - a.total);

  // Breakdown by Supervisor
  const supervisorBreakdown = supervisors.map(sup => {
    const total = filteredCarExpenses
      .filter(tx => {
        const rep = reps.find(r => r.id === tx.rep_id);
        return rep?.supervisor_id === sup.id;
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    return { ...sup, total };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  // Breakdown by Representative
  const repBreakdown = reps.map(rep => {
    const total = filteredCarExpenses
      .filter(tx => tx.rep_id === rep.id)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    return { ...rep, total };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

  // Group reps by agency for display
  const repsByAgency = agencies.map(agency => {
    return {
      agency,
      repsList: reps.filter(r => r.agency_id === agency.id)
    };
  }).filter(group => group.repsList.length > 0);

  const uncategorizedReps = reps.filter(r => !r.agency_id);

  // Helper: render a table of representatives by classification
  const renderClassTable = (classification, label) => {
    const filtered = reps.filter(r => r.classification === classification);
    if (filtered.length === 0) {
      return <div className="no-data-msg">لا يوجد {label} مسجلين بالنظام حالياً.</div>;
    }
    return (
      <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>الاسم</th>
              <th>الهاتف</th>
              <th>الرصيد الحالي</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(rep => (
              <tr key={rep.id}>
                <td><strong>{rep.code}</strong></td>
                <td>{rep.name}</td>
                <td>{rep.phone || '—'}</td>
                <td>
                  <span style={{ fontWeight: 800, color: Number(rep.balance) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {Number(rep.balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => handleViewLedger(rep.id)}
                    >
                      📂 كشف حساب
                    </button>
                    {currentUser.role === 'manager' && (
                      <>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.2)' }}
                          onClick={() => handleUpdateRepPassword(rep.id, rep.name)}
                        >
                          🔑 كلمة مرور
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                          onClick={() => handleDeleteRep(rep.id, rep.name)}
                        >
                          🗑️ حذف
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const selectedRepName = reps.find(r => r.id === Number(newTx.repId))?.name || '';

  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0f172a',
        backgroundImage: 'radial-gradient(circle at center, rgba(14, 165, 233, 0.15) 0%, transparent 60%)',
        padding: '1.5rem',
        direction: 'rtl'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(30, 41, 59, 0.65)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '2.5rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 12px var(--primary-glow))' }}>💰</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-cairo)' }}>خزينة التوريد والصرف</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', fontFamily: 'var(--font-cairo)' }}>تسجيل الدخول للنظام المالي</p>
          
          {loginError && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              color: 'var(--danger)',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
              textAlign: 'right',
              fontFamily: 'var(--font-cairo)'
            }}>
              ⚠️ {loginError}
            </div>
          )}
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.25rem', textAlign: 'right' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'var(--font-cairo)' }}>اسم المستخدم</label>
              <input
                type="text"
                placeholder="أدخل اسم المستخدم..."
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-cairo)',
                  outline: 'none',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '2rem', textAlign: 'right' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'var(--font-cairo)' }}>كلمة المرور</label>
              <input
                type="password"
                placeholder="أدخل كلمة المرور..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-cairo)',
                  outline: 'none',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s'
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: '100%',
                padding: '0.9rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                border: 'none',
                color: '#fff',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px var(--primary-glow)',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-cairo)'
              }}
            >
              {loginLoading ? 'جاري التحقق...' : 'تسجيل الدخول 🔑'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="brand">
          <span className="brand-logo">💰</span>
          <div className="brand-text">
            <h1>خزينة التوريد والصرف</h1>
            <p>نظام ذكي متكامل للمناديب والمعاملات النقدية</p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', direction: 'rtl' }}>
          <div style={{ textAlign: 'left', marginLeft: '1rem' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {currentUser.role === 'manager' 
                ? '👑 مدير النظام' 
                : currentUser.role === 'representative' 
                  ? `👤 مندوب: ${currentUser.name || currentUser.username}` 
                  : `👤 محاسب: ${currentUser.username}`}
            </div>
            {currentUser.assigned_agency_id && (
              <div style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>
                {agencies.find(a => a.id === currentUser.assigned_agency_id)?.name || 'توكيل محدد'}
              </div>
            )}
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={handleLogout}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.2)' }}
          >
            تسجيل الخروج 🚪
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tabs-nav" style={{ marginBottom: '2rem' }}>
        {currentUser.role === 'representative' ? (
          <>
            <button 
              className={`tab-btn ${activeTab === 'rep-dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('rep-dashboard'); loadRepLedger(); }}
            >
              📊 كشف حسابي ورصيدي
            </button>
            <button 
              className={`tab-btn ${activeTab === 'rep-new-tx' ? 'active' : ''}`}
              onClick={() => { setActiveTab('rep-new-tx'); setTxSuccess(null); setTxError(''); }}
            >
              💸 طلب توريد أو صرف جديد
            </button>
          </>
        ) : (
          <>
            <button 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
            >
              📊 الرئيسية
            </button>

            {currentUser.role === 'manager' && (
              <button 
                className={`tab-btn ${activeTab === 'pending-approvals' ? 'active' : ''}`}
                onClick={() => { setActiveTab('pending-approvals'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                📥 طلبات الصرف المعلقة
                {pendingTx.length > 0 && (
                  <span style={{ 
                    background: 'var(--danger)', color: '#fff', 
                    fontSize: '0.75rem', fontWeight: 'bold', 
                    padding: '0.15rem 0.45rem', borderRadius: '50px',
                    boxShadow: '0 0 10px rgba(239,68,68,0.5)',
                    animation: 'pulse 1.5s infinite' 
                  }}>
                    {pendingTx.length}
                  </span>
                )}
              </button>
            )}

            <button 
              className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => { setActiveTab('transactions'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
            >
              📃 المعاملات
            </button>

            {currentUser.role === 'manager' ? (
              <button 
                className={`tab-btn ${activeTab === 'agencies' ? 'active' : ''}`}
                onClick={() => { setActiveTab('agencies'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
              >
                🏢 التوكيلات
              </button>
            ) : (
              <button 
                className={`tab-btn ${activeTab === 'agencies' ? 'active' : ''}`}
                onClick={() => { setActiveTab('agencies'); setSelectedRepLedger(null); handleViewAgencyLedger(currentUser.assigned_agency_id); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
              >
                🏢 التوكيل الخاص بي
              </button>
            )}

            {(currentUser.role === 'manager' || currentUser.role === 'accountant') && (
              <button 
                className={`tab-btn ${activeTab === 'banks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('banks'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
              >
                🏦 البنوك
              </button>
            )}

            {(currentUser.role === 'manager' || currentUser.role === 'accountant') && (
              <button 
                className={`tab-btn ${activeTab === 'companies' ? 'active' : ''}`}
                onClick={() => { setActiveTab('companies'); loadCompanies(); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
              >
                🏢 الشركات
              </button>
            )}


            {currentUser.role === 'manager' && (
              <button 
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => { setActiveTab('users'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
              >
                👥 المستخدمين
              </button>
            )}

            {currentUser.role === 'manager' && (
              <button 
                className={`tab-btn ${activeTab === 'daily-report' ? 'active' : ''}`}
                onClick={() => { setActiveTab('daily-report'); handleFetchDailyReport(); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
              >
                📋 التقرير اليومي
              </button>
            )}

            <button 
              className={`tab-btn ${activeTab === 'reps' ? 'active' : ''}`}
              onClick={() => { setActiveTab('reps'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
            >
              👥 الموظفين والمناديب
            </button>

            <button 
              className={`tab-btn ${activeTab === 'car-expenses' ? 'active' : ''}`}
              onClick={() => { setActiveTab('car-expenses'); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
            >
              🚗 مصاريف السيارات
            </button>

            <button 
              className={`tab-btn ${activeTab === 'new-tx' ? 'active' : ''}`}
              onClick={() => { setActiveTab('new-tx'); setTxSuccess(null); setTxError(''); setSelectedRepLedger(null); setSelectedAgencyLedger(null); setSelectedBankLedger(null); setSelectedSupervisorReps(null); }}
            >
              💸 حركة جديدة
            </button>
          </>
        )}
      </nav>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <>
          {/* INITIAL BALANCE BANNER */}
          {currentUser.role === 'manager' && !dashboardData.summary.safeInitialBalanceSet && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
              border: '2px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '20px',
              padding: '1.75rem 2rem',
              marginBottom: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.8rem' }}>💰</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', margin: 0 }}>تحديد فئات رصيد أول المدة للخزنة العامة</h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
                  يرجى إدخال الرصيد الافتتاحي (رصيد أول المدة) مفصلاً بالفئات النقدية المتوفرة بالخزينة. سيظهر هذا الإجراء مرة واحدة فقط ولن تتمكن من تعديله لاحقاً.
                </p>

                <form onSubmit={handleSaveInitialBalance}>
                  <div className="denom-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                      <div className="denom-input-group" key={denom} style={{ border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        <span className="denom-label" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#fbbf24', borderBottom: '1px solid rgba(245, 158, 11, 0.25)' }}>{denom} ج.م</span>
                        <div className="denom-input-row">
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={initialDenominations[`denom_${denom}`] || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setInitialDenominations(prev => ({ ...prev, [`denom_${denom}`]: val }));
                            }}
                            style={{ color: '#fff', textAlign: 'center', padding: '0.5rem' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(245, 158, 11, 0.2)' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
                      إجمالي رصيد أول المدة: <span style={{ color: '#fff', fontSize: '1.4rem' }}>{totalInitialBalance.toLocaleString()}</span> ج.م
                    </div>
                    
                    <button
                      type="submit"
                      disabled={initialBalanceLoading || totalInitialBalance <= 0}
                      className="btn btn-primary"
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0.75rem 1.5rem',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s ease',
                        opacity: (initialBalanceLoading || totalInitialBalance <= 0) ? 0.6 : 1
                      }}
                    >
                      {initialBalanceLoading ? 'جاري الحفظ...' : 'حفظ الرصيد الافتتاحي'}
                    </button>
                  </div>
                </form>
              </div>
              {initialBalanceError && (
                <div style={{ marginTop: '0.75rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ {initialBalanceError}
                </div>
              )}
            </div>
          )}
          {/* ===== TWO MAIN BALANCE HEROES ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* CASH SAFE BALANCE */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.08) 100%)',
              border: '2px solid rgba(16,185,129,0.35)',
              borderRadius: '20px', padding: '2rem',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '120px', height: '120px', background: 'rgba(16,185,129,0.08)', borderRadius: '50%' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.8rem' }}>🏦</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>الخزنة العامة (رصيد الخزينة النقدي الحالي)</span>
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#10b981', letterSpacing: '-1px', lineHeight: 1, marginBottom: '0.5rem' }}>
                  {(dashboardData.summary.cashSafeBalance ?? dashboardData.summary.safeBalance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                  <span style={{ fontSize: '1rem', fontWeight: 400, color: '#6ee7b7', marginRight: '0.4rem' }}>ج.م</span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#6ee7b7', marginBottom: '0.2rem' }}>إجمالي الوارد نقدي</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{(dashboardData.summary.cashDeposits ?? dashboardData.summary.totalDeposits).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(16,185,129,0.25)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginBottom: '0.2rem' }}>إجمالي المصروف</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f43f5e' }}>{dashboardData.summary.totalWithdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
                  </div>
                </div>
                {dashboardData.summary.safeDenominations && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed rgba(16,185,129,0.25)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6ee7b7', marginBottom: '0.6rem' }}>💵 تفاصيل الفئات النقدية بالخزينة:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {[200, 100, 50, 20, 10, 5, 1].map(denom => {
                        const count = dashboardData.summary.safeDenominations[`denom_${denom}`] || 0;
                        return (
                          <div key={denom} style={{
                            background: 'rgba(16,185,129,0.12)',
                            border: count > 0 ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            opacity: count > 0 ? 1 : 0.45
                          }}>
                            <span style={{ fontWeight: 600, color: '#34d399' }}>{denom} ج.م</span>
                            <span style={{ color: 'var(--text-secondary)' }}>×</span>
                            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{count.toLocaleString()}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BANKS TOTAL BALANCE */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(3,105,161,0.08) 100%)',
              border: '2px solid rgba(14,165,233,0.35)',
              borderRadius: '20px', padding: '2rem',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '120px', height: '120px', background: 'rgba(14,165,233,0.08)', borderRadius: '50%' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.8rem' }}>🏦</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>إجمالي أرصدة البنوك الحالية</span>
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#0ea5e9', letterSpacing: '-1px', lineHeight: 1, marginBottom: '0.5rem' }}>
                  {banks.reduce((sum, b) => sum + (Number(b.balance) || 0), 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                  <span style={{ fontSize: '1rem', fontWeight: 400, color: '#7dd3fc', marginRight: '0.4rem' }}>ج.م</span>
                </div>
                {banks.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: '#7dd3fc', lineHeight: 1.5, marginTop: '1rem' }}>لا توجد حسابات بنكية مسجلة</div>
                ) : (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(14,165,233,0.25)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7dd3fc', marginBottom: '0.6rem' }}>💳 تفصيل الأرصدة لكل حساب:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                      {banks.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(14,165,233,0.08)', borderRadius: '8px', padding: '0.35rem 0.7rem', border: '1px solid rgba(14,165,233,0.15)' }}>
                          <span style={{ fontSize: '0.8rem', color: '#bae6fd', fontWeight: 600 }}>🏦 {b.name} <span style={{ color: '#7dd3fc', fontWeight: 400 }}>({b.code})</span></span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: Number(b.balance) >= 0 ? '#34d399' : '#f87171' }}>
                            {Number(b.balance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📥</span>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>إجمالي الوارد (نقدي + تحويل)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>{dashboardData.summary.totalDeposits.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📤</span>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>إجمالي الصرف من الخزينة</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger)' }}>{dashboardData.summary.totalWithdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '1.5rem' }}>👥</span>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>عدد المناديب المسجلين</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>{dashboardData.summary.repsCount} مندوب</div>
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">🕒 آخر 10 عمليات تسجيل بالخزينة</h2>
            </div>
            <div className="table-container">
              {dashboardData.recentTransactions.length === 0 ? (
                <div className="no-data-msg">لا توجد عمليات مسجلة بالخزينة حالياً.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>التاريخ والوقت</th>
                      <th>المندوب / الجهة</th>
                      <th>نوع العملية</th>
                      <th>طريقة الدفع</th>
                      <th>بواسطة</th>
                      <th>المبلغ</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.recentTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                        <td>
                          {tx.bank_name ? (
                            <span>🏦 {tx.bank_name} <small style={{ color: 'var(--text-muted)' }}>({tx.bank_code})</small></span>
                          ) : (
                            tx.rep_name ? <span>👤 {tx.rep_name} <small style={{ color: 'var(--text-muted)' }}>({tx.rep_code})</small></span> : <span style={{ color: 'var(--text-muted)' }}>خزينة مباشرة</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${tx.type}`}>
                            {tx.type === 'deposit' ? '📥 توريد' : '📤 صرف'}
                          </span>
                        </td>
                        <td>
                          {tx.payment_method === 'bank_transfer' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' }}>🏧 تحويل بنكي</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>💵 نقدي</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.creator_name || '—'}</div>
                          {tx.approver_name && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              🔑 اعتماد: {tx.approver_name}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`amount-${tx.type}`}>
                            {tx.type === 'withdrawal' ? '-' : ''}
                            {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                          </span>
                        </td>
                        <td style={{ maxWidth: '200px', fontSize: '0.82rem' }}>
                          <div>{tx.notes || 'لا يوجد'}</div>
                          {tx.receipt_image && (
                            <div style={{ marginTop: '0.3rem' }}>
                              <a 
                                href="#" 
                                onClick={(e) => { e.preventDefault(); setActiveImageModal(tx.receipt_image); }} 
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.78rem', color: '#a78bfa', textDecoration: 'underline', fontWeight: 600 }}
                              >
                                📎 عرض الإيصال
                              </a>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">📃 كشف المعاملات العام</h2>
          </div>

          {/* Section for Unconfirmed Transactions */}
          {(() => {
            const unconfirmedTx = transactions.filter(tx => {
              if (tx.type === 'deposit') {
                return tx.status === 'pending_receipt';
              } else if (tx.type === 'withdrawal') {
                return tx.status === 'pending' || tx.status === 'approved';
              }
              return false;
            });
            if (unconfirmedTx.length === 0) return null;
            
            return (
              <div className="panel" style={{ background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '2rem', marginTop: '1rem', boxShadow: 'none' }}>
                <div className="panel-header" style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem' }}>
                  <h3 className="panel-title" style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.15rem' }}>
                    ⚠️ معاملات قيد المراجعة وبانتظار التأكيد ({unconfirmedTx.length})
                  </h3>
                  <span style={{ fontSize: '0.8rem', background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 'bold' }}>
                    تتطلب إجراءً
                  </span>
                </div>
                
                <div className="table-container" style={{ margin: 0, borderRadius: 0, border: 'none', background: 'transparent' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>التاريخ والوقت</th>
                        <th>الجهة المعنية</th>
                        <th>النوع</th>
                        <th>المبلغ</th>
                        <th>الملاحظات</th>
                        <th>الحالة / الإجراء المطلوب</th>
                        <th>الإجراءات السريعة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unconfirmedTx.map((tx) => (
                        <tr key={tx.id} style={{ background: 'rgba(245, 158, 11, 0.02)' }}>
                          <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                          <td>
                            {tx.bank_name ? (
                              <span>🏦 {tx.bank_name}</span>
                            ) : (
                              tx.rep_name || 'خزينة مباشرة'
                            )}
                            {tx.rep_code && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.4rem' }}>({tx.rep_code})</span>}
                          </td>
                          <td>
                            <span className={`badge badge-${tx.type}`}>
                              {tx.type === 'deposit' ? '📥 توريد' : '📤 صرف'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 'bold', color: tx.type === 'deposit' ? 'var(--success)' : 'var(--danger)' }}>
                            {tx.amount.toLocaleString()} ج.م
                          </td>
                          <td style={{ fontSize: '0.85rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.notes}>
                            <div>{tx.notes || '—'}</div>
                            {tx.receipt_image && (
                              <div style={{ marginTop: '0.3rem' }}>
                                <a 
                                  href="#" 
                                  onClick={(e) => { e.preventDefault(); setActiveImageModal(tx.receipt_image); }} 
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.78rem', color: '#a78bfa', textDecoration: 'underline', fontWeight: 600 }}
                                >
                                  📎 عرض الإيصال
                                </a>
                              </div>
                            )}
                          </td>
                          <td>
                            {tx.status === 'pending' && (
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 'bold' }}>
                                ⏳ بانتظار موافقة المدير
                              </span>
                            )}
                            {tx.status === 'pending_receipt' && (
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', fontWeight: 'bold' }}>
                                📥 بانتظار تأكيد استلام الخزينة
                              </span>
                            )}
                            {tx.status === 'approved' && (
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', fontWeight: 'bold' }}>
                                💵 معتمد - بانتظار الصرف الفعلي
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {tx.status === 'pending_receipt' && tx.type === 'deposit' && (
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, var(--success), var(--success-hover))', border: 'none' }}
                                  onClick={async () => {
                                    if (window.confirm('هل تؤكد استلام هذا المبلغ نقداً وإضافته للخزينة ورصيد المندوب؟')) {
                                      try {
                                        const res = await fetch(`/api/transactions/${tx.id}/receive`, { method: 'POST' });
                                        if (res.ok) {
                                          loadDashboard();
                                          loadTransactions();
                                          loadCarExpenses();
                                        } else {
                                          const err = await res.json();
                                          alert(err.error || 'حدث خطأ أثناء تأكيد الاستلام');
                                        }
                                      } catch (e) {
                                        alert('تعذر الاتصال بالسيرفر');
                                      }
                                    }
                                  }}
                                >
                                  📥 تأكيد الاستلام
                                </button>
                              )}
                              {tx.status === 'approved' && tx.type === 'withdrawal' && (
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, var(--success), var(--success-hover))', border: 'none' }}
                                  onClick={() => {
                                    setDisbursingTx(tx);
                                    setDisburseError('');
                                    setDisburseDenominations({ denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 });
                                  }}
                                >
                                  💵 إتمام الصرف
                                </button>
                              )}
                              {tx.status === 'pending' && currentUser.role === 'manager' && (
                                <>
                                  <button
                                    className="btn btn-primary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, var(--success), var(--success-hover))', border: 'none' }}
                                    onClick={() => handleApproveTx(tx.id)}
                                  >
                                    ✔️ موافقة
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                                    onClick={() => handleRejectTx(tx.id)}
                                  >
                                    ❌ رفض
                                  </button>
                                </>
                              )}
                              {tx.status === 'pending' && currentUser.role !== 'manager' && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>طلب معلق</span>
                              )}
                              {currentUser.role === 'manager' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                >
                                  🗑️ حذف
                                </button>
                              )}
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => handlePrintReceipt(tx)}
                              >
                                🖨️ طباعة
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Filters Form */}
          <form className="filter-bar" onSubmit={handleApplyFilters}>
            <div className="form-group">
              <label>نوع العملية</label>
              <select 
                value={filters.type} 
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              >
                <option value="">الكل</option>
                <option value="deposit">توريد فقط</option>
                <option value="withdrawal">صرف فقط</option>
              </select>
            </div>
            <div className="form-group">
              <label>المندوب</label>
              <select 
                value={filters.repId} 
                onChange={(e) => setFilters({ ...filters, repId: e.target.value, bankId: '' })}
              >
                <option value="">كل المناديب</option>
                {reps.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>الحساب البنكي</label>
              <select 
                value={filters.bankId} 
                onChange={(e) => setFilters({ ...filters, bankId: e.target.value, repId: '' })}
              >
                <option value="">كل البنوك</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>من تاريخ</label>
              <input 
                type="date" 
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>إلى تاريخ</label>
              <input 
                type="date" 
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">تطبيق الفلترة</button>
              <button type="button" className="btn btn-secondary" onClick={handleClearFilters}>إعادة تعيين</button>
            </div>
          </form>

          {/* Filtered Data Table */}
          <div className="table-container">
            {transactions.length === 0 ? (
              <div className="no-data-msg">لم يتم العثور على أي عمليات مطابقة للفلاتر المحددة.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>التاريخ والوقت</th>
                    <th>كود الجهة</th>
                    <th>الجهة المعنية</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th>بواسطة</th>
                    <th>المبلغ</th>
                    <th>ملاحظات</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                      <td>
                        {tx.type === 'company_transfer' && tx.company_code ? (
                          <strong style={{ color: '#22d3ee' }}>{tx.company_code}</strong>
                        ) : tx.bank_code ? (
                          <strong style={{ color: 'var(--primary)' }}>{tx.bank_code}</strong>
                        ) : (
                          tx.rep_code || '—'
                        )}
                      </td>
                      <td>
                        {tx.type === 'company_transfer' ? (
                          <div>
                            <div>{tx.payment_method === 'cash' ? '💵 الخزينة المباشرة' : `🏦 ${tx.bank_name || 'البنك'}`} ➔ 🏢 {tx.company_name}</div>
                          </div>
                        ) : tx.bank_name ? (
                          <span>🏦 {tx.bank_name}</span>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 600 }}>{tx.rep_name || 'خزينة مباشرة'}</div>
                            {tx.rep_name && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                {tx.agency_name && <span>🏢 {tx.agency_name}</span>}
                                {tx.agency_name && tx.supervisor_name && <span> | </span>}
                                {tx.supervisor_name && <span>👤 مشرف: {tx.supervisor_name}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${tx.type}`}>
                          {tx.type === 'deposit' ? '📥 توريد' : tx.type === 'withdrawal' ? '📤 صرف' : tx.type === 'company_transfer' ? '🏢 حوالة' : '🔄 تسوية'}
                        </span>
                      </td>
                      <td>
                        {tx.status === 'pending' ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 'bold' }}>⏳ قيد المراجعة</span>
                        ) : tx.status === 'rejected' ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: 'bold' }}>❌ مرفوض</span>
                        ) : tx.type === 'exchange' ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.25)', fontWeight: 'bold' }}>🔄 تسوية فئات</span>
                        ) : tx.type === 'company_transfer' ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)', fontWeight: 'bold' }}>🏢 تم التحويل</span>
                        ) : tx.type === 'deposit' ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--success-bg)', color: 'var(--success)', fontWeight: 'bold' }}>✔️ مكتمل - تم التوريد</span>
                        ) : tx.status === 'approved' ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.25)', fontWeight: 'bold' }}>✓ معتمد - بانتظار التسليم</span>
                        ) : (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--success-bg)', color: 'var(--success)', fontWeight: 'bold' }}>✔️ مكتمل - تم الصرف</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{tx.creator_name || '—'}</div>
                        {tx.approver_name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            🔑 اعتماد: {tx.approver_name}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`amount-${tx.type}`}>
                          {(tx.type === 'withdrawal' || tx.type === 'company_transfer') ? '-' : ''}
                          {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                        </span>
                      </td>
                      <td>
                        {tx.notes || 'لا يوجد'}
                        {tx.type === 'exchange' ? (
                          <div className="denoms-list-tag" title="تفاصيل فئات التبديل والتسوية">
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>📥 استلام:</span> {[
                              tx.denom_200 > 0 && <span key="inc-200" className="denom-pill">200×<span>{tx.denom_200}</span></span>,
                              tx.denom_100 > 0 && <span key="inc-100" className="denom-pill">100×<span>{tx.denom_100}</span></span>,
                              tx.denom_50 > 0 && <span key="inc-50" className="denom-pill">50×<span>{tx.denom_50}</span></span>,
                              tx.denom_20 > 0 && <span key="inc-20" className="denom-pill">20×<span>{tx.denom_20}</span></span>,
                              tx.denom_10 > 0 && <span key="inc-10" className="denom-pill">10×<span>{tx.denom_10}</span></span>,
                              tx.denom_5 > 0 && <span key="inc-5" className="denom-pill">5×<span>{tx.denom_5}</span></span>,
                              tx.denom_1 > 0 && <span key="inc-1" className="denom-pill">1×<span>{tx.denom_1}</span></span>
                            ].filter(Boolean)}
                            <span style={{ color: 'var(--danger)', fontWeight: 'bold', marginRight: '0.5rem' }}>📤 تسليم:</span> {[
                              tx.denom_200 < 0 && <span key="out-200" className="denom-pill">200×<span>{Math.abs(tx.denom_200)}</span></span>,
                              tx.denom_100 < 0 && <span key="out-100" className="denom-pill">100×<span>{Math.abs(tx.denom_100)}</span></span>,
                              tx.denom_50 < 0 && <span key="out-50" className="denom-pill">50×<span>{Math.abs(tx.denom_50)}</span></span>,
                              tx.denom_20 < 0 && <span key="out-20" className="denom-pill">20×<span>{Math.abs(tx.denom_20)}</span></span>,
                              tx.denom_10 < 0 && <span key="out-10" className="denom-pill">10×<span>{Math.abs(tx.denom_10)}</span></span>,
                              tx.denom_5 < 0 && <span key="out-5" className="denom-pill">5×<span>{Math.abs(tx.denom_5)}</span></span>,
                              tx.denom_1 < 0 && <span key="out-1" className="denom-pill">1×<span>{Math.abs(tx.denom_1)}</span></span>
                            ].filter(Boolean)}
                          </div>
                        ) : (
                          (tx.denom_200 > 0 || tx.denom_100 > 0 || tx.denom_50 > 0 || tx.denom_20 > 0 || tx.denom_10 > 0 || tx.denom_5 > 0 || tx.denom_1 > 0) && (
                            <div className="denoms-list-tag" title="تفاصيل فئات المبلغ النقدية">
                              💵 الفئات: {[
                                tx.denom_200 > 0 && <span key="200" className="denom-pill">200×<span>{tx.denom_200}</span></span>,
                                tx.denom_100 > 0 && <span key="100" className="denom-pill">100×<span>{tx.denom_100}</span></span>,
                                tx.denom_50 > 0 && <span key="50" className="denom-pill">50×<span>{tx.denom_50}</span></span>,
                                tx.denom_20 > 0 && <span key="20" className="denom-pill">20×<span>{tx.denom_20}</span></span>,
                                tx.denom_10 > 0 && <span key="10" className="denom-pill">10×<span>{tx.denom_10}</span></span>,
                                tx.denom_5 > 0 && <span key="5" className="denom-pill">5×<span>{tx.denom_5}</span></span>,
                                tx.denom_1 > 0 && <span key="1" className="denom-pill">1×<span>{tx.denom_1}</span></span>
                              ].filter(Boolean)}
                            </div>
                          )
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {(tx.status === 'approved' || tx.status === 'disbursed' || tx.status === null) && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'rgba(14,165,233,0.1)', color: 'var(--primary)', borderColor: 'rgba(14,165,233,0.25)' }}
                              onClick={() => handlePrintReceipt(tx)}
                            >
                              🖨️ طباعة
                            </button>
                          )}
                          {tx.status === 'pending_receipt' && tx.type === 'deposit' && (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--success), var(--success-hover))', boxShadow: 'none' }}
                              onClick={async () => {
                                if (window.confirm('هل تؤكد استلام هذا المبلغ نقداً وإضافته للخزينة ورصيد المندوب؟')) {
                                  try {
                                    const res = await fetch(`/api/transactions/${tx.id}/receive`, {
                                      method: 'POST'
                                    });
                                    if (res.ok) {
                                      loadDashboard();
                                      loadTransactions();
                                      loadCarExpenses();
                                    } else {
                                      const err = await res.json();
                                      alert(err.error || 'حدث خطأ أثناء تأكيد الاستلام');
                                    }
                                  } catch (e) {
                                    alert('تعذر الاتصال بالسيرفر');
                                  }
                                }
                              }}
                            >
                              📥 تأكيد الاستلام
                            </button>
                          )}
                          {tx.status === 'approved' && tx.type === 'withdrawal' && (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--success), var(--success-hover))', boxShadow: 'none' }}
                              onClick={() => {
                                setDisbursingTx(tx);
                                setDisburseError('');
                                setDisburseDenominations({ denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 });
                              }}
                            >
                              💵 إتمام الصرف
                            </button>
                          )}
                          {currentUser.role === 'manager' && (
                            <>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setEditingTx({
                                    ...tx,
                                    denominations: {
                                      denom_200: tx.denom_200 || 0,
                                      denom_100: tx.denom_100 || 0,
                                      denom_50: tx.denom_50 || 0,
                                      denom_20: tx.denom_20 || 0,
                                      denom_10: tx.denom_10 || 0,
                                      denom_5: tx.denom_5 || 0,
                                      denom_1: tx.denom_1 || 0
                                    }
                                  });
                                  setEditError('');
                                  setEditSuccess('');
                                }}
                              >
                                ✏️ تعديل
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                                onClick={() => handleDeleteTransaction(tx.id)}
                              >
                                🗑️ حذف
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* REPRESENTATIVES / EMPLOYEES TAB */}
      {activeTab === 'reps' && (
        <div className="grid-2col" style={{ gridTemplateColumns: currentUser.role === 'manager' ? '2fr 1fr' : '1fr' }}>
          {/* Main list panel */}
          <div className="panel" style={{ width: '100%' }}>
            <div className="panel-header">
              <h2 className="panel-title">👥 دليل الموظفين والمناديب</h2>
            </div>

            {/* Sub-tabs - only show when not in a detail view */}
            {!selectedRepLedger && !selectedSupervisorReps && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                {[
                  { id: 'delegates', label: '🛍️ المناديب' },
                  { id: 'supervisors', label: '👔 المشرفين' },
                  { id: 'accountants', label: '💼 المحاسبين' },
                  { id: 'admin', label: '👑 الإدارة' },
                  { id: 'warehouse', label: '📦 المخازن' },
                  { id: 'drivers', label: '🚚 السائقين' },
                  { id: 'workers', label: '🔧 العمال' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    className={`tab-btn ${repsSubTab === tab.id ? 'active' : ''}`}
                    onClick={() => setRepsSubTab(tab.id)}
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {selectedRepLedger ? (
              /* INDIVIDUAL REP LEDGER */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ color: 'var(--primary)', fontWeight: 800 }}>{selectedRepLedger.representative.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      كود الحساب: {selectedRepLedger.representative.code} | هاتف: {selectedRepLedger.representative.phone || 'غير مسجل'} | التوكيل: {selectedRepLedger.representative.agency_name ? `${selectedRepLedger.representative.agency_name} (${selectedRepLedger.representative.agency_code})` : 'بدون توكيل'}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => { setSelectedRepLedger(null); localStorage.removeItem('selectedRepLedgerId'); }}>العودة للقائمة ⬅</button>
                </div>
                
                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="metric-card deposits" style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#34d399' }}>📥 توريدات الخزينة (نقدي)</span>
                    <span className="metric-value currency" style={{ fontSize: '1.2rem', color: '#10b981' }}>{(selectedRepLedger.summary.cashDeposits ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card withdrawals" style={{ padding: '1rem', background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#fca5a5' }}>📤 إجمالي الصرف (نقدي)</span>
                    <span className="metric-value currency" style={{ fontSize: '1.2rem', color: '#f43f5e' }}>{(selectedRepLedger.summary.totalWithdrawals ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card balance" style={{ padding: '1rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 'bold' }}>💵 رصيد خزينة الحساب</span>
                    <span className="metric-value currency" style={{ fontSize: '1.25rem', color: '#10b981', fontWeight: 800 }}>{(selectedRepLedger.summary.cashBalance ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card deposits" style={{ padding: '1rem', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#c4b5fd' }}>🏧 تحويلات كاش (بنك)</span>
                    <span className="metric-value currency" style={{ fontSize: '1.2rem', color: '#a78bfa' }}>{(selectedRepLedger.summary.bankTransferDeposits ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card balance" style={{ padding: '1rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(124,58,237,0.1) 100%)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>📈 الرصيد الإجمالي</span>
                    <span className="metric-value currency" style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 900 }}>{(selectedRepLedger.summary.balance ?? 0).toLocaleString()} ج.م</span>
                  </div>
                </div>

                <div className="table-container">
                  {selectedRepLedger.transactions.length === 0 ? (
                    <div className="no-data-msg">لم يسجل هذا الحساب أي عمليات مالية بعد.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>التاريخ والوقت</th>
                          <th>العملية</th>
                          <th>المبلغ</th>
                          <th>ملاحظات</th>
                          <th>طباعة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRepLedger.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                            <td>
                              <span className={`badge badge-${tx.type}`}>
                                {tx.type === 'exchange' ? '🔄 تسوية فئات' : tx.type === 'deposit' ? '📥 توريد' : '📤 صرف'}
                                {tx.type !== 'exchange' && (
                                  tx.withdrawal_sub_type === 'car' ? ' - سيارة' : 
                                  tx.withdrawal_sub_type === 'car_gas' ? ' - سيارة (جاز)' : 
                                  tx.withdrawal_sub_type === 'car_oil' ? ' - سيارة (زيت)' : 
                                  tx.withdrawal_sub_type === 'car_other' ? ' - سيارة (مصاريف أخرى)' : 
                                  tx.withdrawal_sub_type === 'salary' ? ' - راتب' : 
                                  tx.withdrawal_sub_type === 'commission' ? ' - عمولة' : ''
                                )}
                              </span>
                            </td>
                            <td>
                              <span className={`amount-${tx.type}`}>
                                {tx.type === 'withdrawal' ? '-' : ''}
                                {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                              </span>
                            </td>
                            <td>
                              {tx.notes || '—'}
                              {tx.type === 'exchange' ? (
                                <div className="denoms-list-tag" title="تفاصيل فئات التبديل والتسوية">
                                  <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>📥 استلام:</span> {[
                                    tx.denom_200 > 0 && <span key="inc-200" className="denom-pill">200×<span>{tx.denom_200}</span></span>,
                                    tx.denom_100 > 0 && <span key="inc-100" className="denom-pill">100×<span>{tx.denom_100}</span></span>,
                                    tx.denom_50 > 0 && <span key="inc-50" className="denom-pill">50×<span>{tx.denom_50}</span></span>,
                                    tx.denom_20 > 0 && <span key="inc-20" className="denom-pill">20×<span>{tx.denom_20}</span></span>,
                                    tx.denom_10 > 0 && <span key="inc-10" className="denom-pill">10×<span>{tx.denom_10}</span></span>,
                                    tx.denom_5 > 0 && <span key="inc-5" className="denom-pill">5×<span>{tx.denom_5}</span></span>,
                                    tx.denom_1 > 0 && <span key="inc-1" className="denom-pill">1×<span>{tx.denom_1}</span></span>
                                  ].filter(Boolean)}
                                  <span style={{ color: 'var(--danger)', fontWeight: 'bold', marginRight: '0.5rem' }}>📤 تسليم:</span> {[
                                    tx.denom_200 < 0 && <span key="out-200" className="denom-pill">200×<span>{Math.abs(tx.denom_200)}</span></span>,
                                    tx.denom_100 < 0 && <span key="out-100" className="denom-pill">100×<span>{Math.abs(tx.denom_100)}</span></span>,
                                    tx.denom_50 < 0 && <span key="out-50" className="denom-pill">50×<span>{Math.abs(tx.denom_50)}</span></span>,
                                    tx.denom_20 < 0 && <span key="out-20" className="denom-pill">20×<span>{Math.abs(tx.denom_20)}</span></span>,
                                    tx.denom_10 < 0 && <span key="out-10" className="denom-pill">10×<span>{Math.abs(tx.denom_10)}</span></span>,
                                    tx.denom_5 < 0 && <span key="out-5" className="denom-pill">5×<span>{Math.abs(tx.denom_5)}</span></span>,
                                    tx.denom_1 < 0 && <span key="out-1" className="denom-pill">1×<span>{Math.abs(tx.denom_1)}</span></span>
                                  ].filter(Boolean)}
                                </div>
                              ) : (
                                (tx.denom_200 > 0 || tx.denom_100 > 0 || tx.denom_50 > 0 || tx.denom_20 > 0 || tx.denom_10 > 0 || tx.denom_5 > 0 || tx.denom_1 > 0) && (
                                  <div className="denoms-list-tag" title="تفاصيل فئات المبلغ النقدية">
                                    💵 الفئات: {[
                                      tx.denom_200 > 0 && <span key="200" className="denom-pill">200×<span>{tx.denom_200}</span></span>,
                                      tx.denom_100 > 0 && <span key="100" className="denom-pill">100×<span>{tx.denom_100}</span></span>,
                                      tx.denom_50 > 0 && <span key="50" className="denom-pill">50×<span>{tx.denom_50}</span></span>,
                                      tx.denom_20 > 0 && <span key="20" className="denom-pill">20×<span>{tx.denom_20}</span></span>,
                                      tx.denom_10 > 0 && <span key="10" className="denom-pill">10×<span>{tx.denom_10}</span></span>,
                                      tx.denom_5 > 0 && <span key="5" className="denom-pill">5×<span>{tx.denom_5}</span></span>,
                                      tx.denom_1 > 0 && <span key="1" className="denom-pill">1×<span>{tx.denom_1}</span></span>
                                    ].filter(Boolean)}
                                  </div>
                                )
                              )}
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'rgba(14,165,233,0.08)', color: 'var(--primary)', borderColor: 'rgba(14,165,233,0.2)' }}
                                onClick={() => handlePrintReceipt({
                                  ...tx,
                                  rep_name: selectedRepLedger.representative.name,
                                  rep_code: selectedRepLedger.representative.code,
                                  agency_name: selectedRepLedger.representative.agency_name
                                })}
                              >
                                🖨️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            ) : selectedSupervisorReps ? (
              /* SUPERVISOR DETAIL VIEW */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ color: 'var(--primary)', fontWeight: 800 }}>{selectedSupervisorReps.supervisor.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      كود المشرف: {selectedSupervisorReps.supervisor.code} | عدد المناديب التابعين: {selectedSupervisorReps.representatives.length}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => { setSelectedSupervisorReps(null); localStorage.removeItem('selectedSupervisorRepsId'); }}>العودة للقائمة ⬅</button>
                </div>
                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>👤 المناديب التابعين للمشرف:</h4>
                <div className="table-container">
                  {selectedSupervisorReps.representatives.length === 0 ? (
                    <div className="no-data-msg">لا يوجد مناديب مسجلين تحت إشراف هذا المشرف حالياً.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>كود المندوب</th><th>اسم المندوب</th><th>التوكيل</th><th>النوع</th><th>الرصيد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisorReps.representatives.map(r => (
                          <tr key={r.id}>
                            <td><strong>{r.code}</strong></td>
                            <td>{r.name}</td>
                            <td>{r.agency_name ? `${r.agency_name} (${r.agency_code})` : '—'}</td>
                            <td><span className={`badge badge-${r.type}`}>{r.type === 'wholesale' ? '💼 جملة' : '🛍️ تجزئة'}</span></td>
                            <td>
                              <span style={{ fontWeight: 800, color: Number(r.balance) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {Number(r.balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            ) : (
              /* SUB-TAB CONTENT */
              <div>
                {/* ── DELEGATES ── */}
                {repsSubTab === 'delegates' && (
                  <div>
                    {reps.filter(r => r.classification === 'retail_rep' || r.classification === 'wholesale_rep' || !r.classification).length === 0 ? (
                      <div className="no-data-msg">لا يوجد مناديب مسجلين بالنظام حالياً.</div>
                    ) : (
                      <>
                        {repsByAgency.map(group => (
                          <div className="panel" key={group.agency.id} style={{ marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="panel-header" style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)', fontWeight: 700 }}>
                                🏢 {group.agency.name} <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '0.5rem' }}>({group.agency.code})</small>
                              </h3>
                              <span className="badge badge-retail" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)' }}>{group.repsList.length} مندوب</span>
                            </div>
                            <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                              <table>
                                <thead>
                                  <tr>
                                    <th>كود المندوب</th><th>الاسم</th><th>المشرف</th><th>الهاتف</th><th>التصنيف</th><th>الرصيد</th><th>الإجراءات</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.repsList.map(rep => (
                                    <tr key={rep.id}>
                                      <td><strong>{rep.code}</strong></td>
                                      <td>{rep.name}</td>
                                      <td>{rep.supervisor_name ? `${rep.supervisor_name} (${rep.supervisor_code})` : <em style={{ color: 'var(--text-secondary)' }}>لا يوجد</em>}</td>
                                      <td>{rep.phone || '—'}</td>
                                      <td><span className="badge" style={getClassificationBadgeStyle(rep.classification)}>{getClassificationLabel(rep.classification)}</span></td>
                                      <td><span style={{ fontWeight: 800, color: Number(rep.balance) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{Number(rep.balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span></td>
                                      <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleViewLedger(rep.id)}>📂 كشف حساب</button>
                                          {currentUser.role === 'manager' && (<>
                                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'rgba(234,179,8,0.1)', color: '#eab308', borderColor: 'rgba(234,179,8,0.2)' }} onClick={() => handleUpdateRepPassword(rep.id, rep.name)}>🔑</button>
                                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.2)' }} onClick={() => handleDeleteRep(rep.id, rep.name)}>🗑️</button>
                                          </>)}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                        {uncategorizedReps.filter(r => r.classification === 'retail_rep' || r.classification === 'wholesale_rep' || !r.classification).length > 0 && (
                          <div className="panel" style={{ marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="panel-header" style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>👥 مناديب بدون توكيل</h3>
                            </div>
                            <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                              <table>
                                <thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الرصيد</th><th>الإجراءات</th></tr></thead>
                                <tbody>
                                  {uncategorizedReps.filter(r => r.classification === 'retail_rep' || r.classification === 'wholesale_rep' || !r.classification).map(rep => (
                                    <tr key={rep.id}>
                                      <td><strong>{rep.code}</strong></td><td>{rep.name}</td><td>{rep.phone || '—'}</td>
                                      <td><span style={{ fontWeight: 800, color: Number(rep.balance) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{Number(rep.balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span></td>
                                      <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleViewLedger(rep.id)}>📂 كشف حساب</button>
                                          {currentUser.role === 'manager' && (<>
                                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'rgba(234,179,8,0.1)', color: '#eab308', borderColor: 'rgba(234,179,8,0.2)' }} onClick={() => handleUpdateRepPassword(rep.id, rep.name)}>🔑</button>
                                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.2)' }} onClick={() => handleDeleteRep(rep.id, rep.name)}>🗑️</button>
                                          </>)}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── SUPERVISORS ── */}
                {repsSubTab === 'supervisors' && (
                  <div>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: 700 }}>📋 الهيكل الإشرافي</h4>
                    <div className="table-container" style={{ marginBottom: '2rem' }}>
                      {supervisors.length === 0 ? (
                        <div className="no-data-msg">لا يوجد مشرفين مسجلين بالنظام حالياً.</div>
                      ) : (
                        <table>
                          <thead><tr><th>الكود</th><th>الاسم</th><th>عدد المناديب</th><th>الإجراءات</th></tr></thead>
                          <tbody>
                            {supervisors.map(sup => (
                              <tr key={sup.id}>
                                <td><strong>{sup.code}</strong></td>
                                <td>{sup.name}</td>
                                <td><span className="badge badge-retail" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}>{sup.reps_count} مندوب</span></td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleViewSupervisorReps(sup.id)}>👥 عرض المناديب</button>
                                    {currentUser.role === 'manager' && (
                                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.2)' }} onClick={() => handleDeleteSupervisor(sup.id, sup.name)}>🗑️ حذف</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: 700 }}>💵 الحسابات المالية للمشرفين</h4>
                    {renderClassTable('supervisor_staff', 'مشرفين')}
                  </div>
                )}

                {/* ── OTHER CLASSIFICATIONS ── */}
                {repsSubTab === 'accountants' && renderClassTable('accountant_staff', 'محاسبين')}
                {repsSubTab === 'admin' && renderClassTable('admin_staff', 'موظفي الإدارة')}
                {repsSubTab === 'warehouse' && renderClassTable('warehouse_staff', 'أمناء/عمال المخازن')}
                {repsSubTab === 'drivers' && renderClassTable('driver', 'سائقين')}
                {repsSubTab === 'workers' && renderClassTable('worker', 'عمال')}
              </div>
            )}
          </div>

          {/* Right panel: Add Supervisor (supervisors tab) or Add Rep/Employee (other tabs) */}
          {currentUser.role === 'manager' && (
            <div>
              {repsSubTab === 'supervisors' && !selectedRepLedger && !selectedSupervisorReps ? (
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">➕ إضافة مشرف جديد</h2>
                  </div>
                  {supervisorError && <div className="alert alert-error">⚠️ {supervisorError}</div>}
                  {supervisorSuccess && <div className="alert alert-success">✔️ {supervisorSuccess}</div>}
                  <form onSubmit={handleAddSupervisor}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>كود المشرف <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" value={newSupervisor.code} readOnly disabled style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>اسم المشرف بالكامل <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" placeholder="مثال: أحمد عبد الله محمد" value={newSupervisor.name} onChange={(e) => setNewSupervisor({ ...newSupervisor, name: e.target.value })} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>حفظ المشرف الجديد</button>
                  </form>
                </div>
              ) : (
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">➕ إضافة موظف / مندوب جديد</h2>
                  </div>
                  {repError && <div className="alert alert-error">⚠️ {repError}</div>}
                  {repSuccess && <div className="alert alert-success">✔️ {repSuccess}</div>}
                  <form onSubmit={handleAddRep}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>كود الحساب <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" value={newRep.code} readOnly disabled style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>تصنيف الحساب الوظيفي <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <select
                        value={newRep.classification || 'retail_rep'}
                        onChange={(e) => {
                          const cls = e.target.value;
                          const isRep = (cls === 'retail_rep' || cls === 'wholesale_rep');
                          setNewRep({ ...newRep, classification: cls, type: cls === 'wholesale_rep' ? 'wholesale' : 'retail', agency_id: isRep ? newRep.agency_id : '', supervisor_id: isRep ? newRep.supervisor_id : '', password: isRep ? newRep.password : '' });
                        }}
                        required
                      >
                        <option value="retail_rep">🛍️ مندوب تجزئة</option>
                        <option value="wholesale_rep">💼 مندوب جملة</option>
                        <option value="supervisor_staff">👔 مشرف</option>
                        <option value="accountant_staff">💼 محاسب</option>
                        <option value="admin_staff">👑 موظف إداري</option>
                        <option value="warehouse_staff">📦 أمين/عامل مخزن</option>
                        <option value="driver">🚚 سائق</option>
                        <option value="worker">🔧 عامل</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>الاسم بالكامل <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="text" placeholder="مثال: محمد السيد أحمد" value={newRep.name} onChange={(e) => setNewRep({ ...newRep, name: e.target.value })} required />
                    </div>
                    {(newRep.classification === 'retail_rep' || newRep.classification === 'wholesale_rep') && (
                      <>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                          <label>التوكيل التابع له المندوب <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <select value={newRep.agency_id} onChange={(e) => setNewRep({ ...newRep, agency_id: e.target.value })} required>
                            <option value="">اختر التوكيل...</option>
                            {agencies.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                          <label>المشرف المسؤول</label>
                          <select value={newRep.supervisor_id} onChange={(e) => setNewRep({ ...newRep, supervisor_id: e.target.value })}>
                            <option value="">اختر المشرف (اختياري)...</option>
                            {supervisors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                          <label>كلمة مرور المندوب <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <input type="password" placeholder="أدخل كلمة مرور قوية لتسجيل الدخول" value={newRep.password || ''} onChange={(e) => setNewRep({ ...newRep, password: e.target.value })} required />
                        </div>
                      </>
                    )}
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>رقم الهاتف</label>
                      <input type="text" placeholder="مثال: 010xxxxxxxx" value={newRep.phone} onChange={(e) => setNewRep({ ...newRep, phone: e.target.value })} />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>حفظ الموظف الجديد</button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}



            

      {/* CAR EXPENSES TAB */}
      {activeTab === 'car-expenses' && (
        <div className="car-expenses-container">
          
          {/* Metrics Summary Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.08) 100%)',
              border: '2px solid rgba(239,68,68,0.35)',
              borderRadius: '20px', padding: '1.5rem',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🚗</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>إجمالي مصاريف السيارات</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ef4444' }}>
                {totalCarExpenses.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                <span style={{ fontSize: '1rem', fontWeight: 400, color: '#fca5a5', marginRight: '0.3rem' }}>ج.م</span>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.08) 100%)',
              border: '2px solid rgba(245,158,11,0.35)',
              borderRadius: '20px', padding: '1.5rem',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📊</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>عدد العمليات المسجلة</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b' }}>
                {carExpensesCount.toLocaleString('ar-EG')}
                <span style={{ fontSize: '1rem', fontWeight: 400, color: '#fde68a', marginRight: '0.3rem' }}>حركة</span>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.08) 100%)',
              border: '2px solid rgba(59,130,246,0.35)',
              borderRadius: '20px', padding: '1.5rem',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📈</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa' }}>متوسط الحركة الواحدة</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#3b82f6' }}>
                {averageCarExpense.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                <span style={{ fontSize: '1rem', fontWeight: 400, color: '#93c5fd', marginRight: '0.3rem' }}>ج.م</span>
              </div>
            </div>
          </div>

          {/* Analytical Breakdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* By Expense Sub-type */}
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">⛽ التوزيع حسب بند المصروف</h3>
              </div>
              <div style={{ padding: '1rem 0' }}>
                {subTypeBreakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>لا توجد بيانات للبنود الفرعية</div>
                ) : (
                  subTypeBreakdown.map(item => {
                    const max = Math.max(...subTypeBreakdown.map(i => i.total), 1);
                    const pct = (item.total / max) * 100;
                    return (
                      <div key={item.name} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                          <span>{item.name}</span>
                          <strong style={{ color: '#ec4899' }}>{item.total.toLocaleString()} ج.م</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginTop: '0.4rem', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ec4899, #f472b6)', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* By Agency */}
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">🏢 التوزيع حسب التوكيلات</h3>
              </div>
              <div style={{ padding: '1rem 0' }}>
                {agencyBreakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>لا توجد بيانات للتوكيلات</div>
                ) : (
                  agencyBreakdown.map(agency => {
                    const max = Math.max(...agencyBreakdown.map(a => a.total), 1);
                    const pct = (agency.total / max) * 100;
                    return (
                      <div key={agency.id} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                          <span>{agency.name}</span>
                          <strong style={{ color: '#ef4444' }}>{agency.total.toLocaleString()} ج.م</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginTop: '0.4rem', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* By Supervisor */}
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">👔 التوزيع حسب المشرفين</h3>
              </div>
              <div style={{ padding: '1rem 0' }}>
                {supervisorBreakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>لا توجد بيانات للمشرفين</div>
                ) : (
                  supervisorBreakdown.map(sup => {
                    const max = Math.max(...supervisorBreakdown.map(s => s.total), 1);
                    const pct = (sup.total / max) * 100;
                    return (
                      <div key={sup.id} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                          <span>{sup.name}</span>
                          <strong style={{ color: '#f59e0b' }}>{sup.total.toLocaleString()} ج.م</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginTop: '0.4rem', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top Representatives */}
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">👥 المناديب الأكثر صرفاً</h3>
              </div>
              <div style={{ padding: '1rem 0' }}>
                {repBreakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>لا توجد بيانات للمناديب</div>
                ) : (
                  repBreakdown.slice(0, 5).map(rep => {
                    const max = Math.max(...repBreakdown.map(r => r.total), 1);
                    const pct = (rep.total / max) * 100;
                    return (
                      <div key={rep.id} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                          <span>{rep.name} <small style={{ color: 'var(--text-muted)' }}>({rep.code})</small></span>
                          <strong style={{ color: '#3b82f6' }}>{rep.total.toLocaleString()} ج.م</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginTop: '0.4rem', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div className="panel-header">
              <h3 className="panel-title">🔍 فلترة مصاريف السيارات</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label>بند الصرف الفرعي</label>
                <select 
                  value={carFilters.subType || ''}
                  onChange={(e) => setCarFilters({ ...carFilters, subType: e.target.value })}
                >
                  <option value="">كل البنود الفرعية</option>
                  <option value="car_gas">⛽ جاز</option>
                  <option value="car_oil">🛢️ زيت</option>
                  <option value="car_other">🔧 مصاريف أخرى</option>
                  <option value="car">🚗 عام (غير مصنف)</option>
                </select>
              </div>

              <div className="form-group">
                <label>التوكيل</label>
                <select 
                  value={carFilters.agencyId}
                  onChange={(e) => setCarFilters({ ...carFilters, agencyId: e.target.value })}
                >
                  <option value="">كل التوكيلات</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>المشرف</label>
                <select 
                  value={carFilters.supervisorId}
                  onChange={(e) => setCarFilters({ ...carFilters, supervisorId: e.target.value })}
                >
                  <option value="">كل المشرفين</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>المندوب</label>
                <select 
                  value={carFilters.repId}
                  onChange={(e) => setCarFilters({ ...carFilters, repId: e.target.value })}
                >
                  <option value="">كل المناديب</option>
                  {reps.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>من تاريخ</label>
                <input 
                  type="date"
                  value={carFilters.startDate}
                  onChange={(e) => setCarFilters({ ...carFilters, startDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>إلى تاريخ</label>
                <input 
                  type="date"
                  value={carFilters.endDate}
                  onChange={(e) => setCarFilters({ ...carFilters, endDate: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setCarFilters({ repId: '', supervisorId: '', agencyId: '', startDate: '', endDate: '', subType: '' })}
              >
                إعادة تعيين الفلاتر
              </button>
            </div>
          </div>

          {/* Table Log */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">📃 سجل مصاريف السيارات التفصيلي</h3>
            </div>
            <div className="table-container" style={{ marginTop: '1rem' }}>
              {filteredCarExpenses.length === 0 ? (
                <div className="no-data-msg">لا توجد عمليات صرف للسيارات مطابقة للفلاتر حالياً.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>التاريخ والوقت</th>
                      <th>المندوب</th>
                      <th>المشرف</th>
                      <th>التوكيل</th>
                      <th>بند الصرف</th>
                      <th>المبلغ</th>
                      <th>ملاحظات الصرف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCarExpenses.map(tx => {
                      const rep = reps.find(r => r.id === tx.rep_id);
                      const agency = agencies.find(a => a.id === rep?.agency_id);
                      const supervisor = supervisors.find(s => s.id === rep?.supervisor_id);
                      return (
                        <tr key={tx.id}>
                          <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                          <td><strong>{rep ? `${rep.name} (${rep.code})` : '—'}</strong></td>
                          <td>{supervisor ? supervisor.name : '—'}</td>
                          <td>{agency ? agency.name : '—'}</td>
                          <td>
                            <span style={{ fontWeight: 'bold', color: 'var(--warning)' }}>
                              {tx.withdrawal_sub_type === 'car_gas' ? '⛽ جاز'
                               : tx.withdrawal_sub_type === 'car_oil' ? '🛢️ زيت'
                               : tx.withdrawal_sub_type === 'car_other' ? '🔧 مصاريف أخرى'
                               : '🚗 عام'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--danger)', fontWeight: 800 }}>
                            -{Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                          </td>
                          <td style={{ maxWidth: '300px', fontSize: '0.85rem' }}>{tx.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {/* NEW TRANSACTION TAB */}
      {activeTab === 'new-tx' && (
        <div className="panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="panel-header">
            <h2 className="panel-title">💸 تسجيل حركة توريد أو صرف نقدية</h2>
          </div>

          {txSuccess ? (
            /* SUCCESS STATE DISPLAY */
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div className="success-checkmark">✓</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>تم تسجيل العملية بنجاح!</h3>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '1.5rem 0', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>نوع الحركة:</span>
                  <span className={`badge badge-${txSuccess.type}`} style={{ fontSize: '0.85rem' }}>
                    {txSuccess.type === 'deposit' 
                      ? '📥 توريد نقدي / كاش' 
                      : txSuccess.type === 'withdrawal' 
                        ? '📤 صرف نقدي' 
                        : txSuccess.type === 'company_transfer' 
                          ? '🏢 حوالة لشركة' 
                          : '🔄 تسوية وفك فئات'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>قيمة المبلغ:</span>
                  <strong style={{ fontSize: '1.2rem', color: txSuccess.type === 'deposit' ? 'var(--success)' : txSuccess.type === 'company_transfer' ? '#22d3ee' : 'var(--danger)' }}>
                    {txSuccess.amount.toLocaleString()} ج.م
                  </strong>
                </div>
                {txSuccess.type === 'deposit' && (
                  <>
                    {txSuccess.cashAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', paddingRight: '1rem', borderRight: '2px solid var(--success)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>منها نقدي بالخزينة:</span>
                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{txSuccess.cashAmount.toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {txSuccess.bankTransferAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', paddingRight: '1rem', borderRight: '2px solid #7c3aed', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>منها تحويل كاش / بنك:</span>
                        <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{txSuccess.bankTransferAmount.toLocaleString()} ج.م</span>
                      </div>
                    )}
                  </>
                )}
                {txSuccess.type === 'company_transfer' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>البنك المصدر:</span>
                      <strong>{txSuccess.bankName || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>الشركة المستلمة:</span>
                      <strong>{txSuccess.companyName || '—'}</strong>
                    </div>
                  </>
                )}
                {txSuccess.type !== 'company_transfer' && txSuccess.type !== 'exchange' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>الجهة المعنية:</span>
                    <strong>{txSuccess.repName || 'خزينة مباشرة'}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ملاحظات:</span>
                  <span>{txSuccess.notes || 'لا يوجد'}</span>
                </div>
              </div>

              <button className="btn btn-primary" onClick={() => setTxSuccess(null)}>تسجيل حركة أخرى</button>
            </div>
          ) : (
            /* FORM DISPLAY */
            <form onSubmit={handleAddTransaction}>
              {txError && <div className="alert alert-error">⚠️ {txError}</div>}
              
              {/* Type Switcher */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>نوع المعاملة</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className={`btn ${newTx.type === 'deposit' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minWidth: '120px', background: newTx.type === 'deposit' ? 'var(--success)' : '', boxShadow: newTx.type === 'deposit' ? '0 4px 12px var(--success-glow)' : '' }}
                    onClick={() => setNewTx(prev => ({ ...prev, type: 'deposit' }))}
                  >
                    📥 توريد (دخول)
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${newTx.type === 'withdrawal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minWidth: '120px', background: newTx.type === 'withdrawal' ? 'var(--danger)' : '', boxShadow: newTx.type === 'withdrawal' ? '0 4px 12px var(--danger-glow)' : '' }}
                    onClick={() => setNewTx(prev => ({ ...prev, type: 'withdrawal' }))}
                  >
                    📤 صرف (خروج)
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${newTx.type === 'exchange' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minWidth: '120px', background: newTx.type === 'exchange' ? '#7c3aed' : '', boxShadow: newTx.type === 'exchange' ? '0 4px 12px rgba(124, 58, 237, 0.2)' : '' }}
                    onClick={() => { setNewTx(prev => ({ ...prev, type: 'exchange', repId: '', bankId: '', amount: '', cashAmount: '', bankTransferAmount: '' })); setTxSourceType('rep'); setSearchRepQuery(''); }}
                  >
                    🔄 فك / تسوية
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${newTx.type === 'company_transfer' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minWidth: '120px', background: newTx.type === 'company_transfer' ? '#06b6d4' : '', color: newTx.type === 'company_transfer' ? '#fff' : '', boxShadow: newTx.type === 'company_transfer' ? '0 4px 12px rgba(6, 182, 212, 0.3)' : '' }}
                    onClick={() => { setNewTx(prev => ({ ...prev, type: 'company_transfer', repId: '', bankId: '', companyId: '', amount: '', cashAmount: '', bankTransferAmount: '', notes: '' })); setTxSourceType('bank'); setSearchRepQuery(''); }}
                  >
                    🏢 حوالة لشركة
                  </button>
                </div>
              </div>

              {/* Party Type Switcher */}
              {newTx.type !== 'exchange' && newTx.type !== 'company_transfer' && (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>{newTx.type === 'withdrawal' ? 'جهة الصرف' : 'الجهة المعنية بالعملية'}</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      className={`btn ${txSourceType === 'rep' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => { setTxSourceType('rep'); setNewTx(prev => ({ ...prev, repId: '', bankId: '', agencyId: '', withdrawal_sub_type: '' })); setSearchRepQuery(''); }}
                    >
                      {newTx.type === 'withdrawal' ? '👥 صرف لموظف/مندوب' : '👥 مندوب توريد'}
                    </button>
                    {newTx.type === 'withdrawal' && (
                      <>
                        <button 
                          type="button" 
                          className={`btn ${txSourceType === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1 }}
                          onClick={() => { setTxSourceType('bank'); setNewTx(prev => ({ ...prev, repId: '', bankId: '', agencyId: '', withdrawal_sub_type: '' })); setSearchRepQuery(''); }}
                        >
                          🏦 صرف لبنك
                        </button>
                        <button 
                          type="button" 
                          className={`btn ${txSourceType === 'direct' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1 }}
                          onClick={() => { setTxSourceType('direct'); setNewTx(prev => ({ ...prev, repId: '', bankId: '', agencyId: '', withdrawal_sub_type: '' })); setSearchRepQuery(''); }}
                        >
                          💸 صرف مباشر (نثريات)
                        </button>
                      </>
                    )}
                    {newTx.type === 'deposit' && (
                      <>
                        <button 
                          type="button" 
                          className={`btn ${txSourceType === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1 }}
                          onClick={() => { setTxSourceType('bank'); setNewTx(prev => ({ ...prev, repId: '', bankId: '', agencyId: '', withdrawal_sub_type: '' })); setSearchRepQuery(''); }}
                        >
                          🏦 توريد من بنك
                        </button>
                        <button 
                          type="button" 
                          className={`btn ${txSourceType === 'direct' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1 }}
                          onClick={() => { setTxSourceType('direct'); setNewTx(prev => ({ ...prev, repId: '', bankId: '', agencyId: '', withdrawal_sub_type: '' })); setSearchRepQuery(''); }}
                        >
                          💼 خزينة مباشرة
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Company Transfer Source Switcher */}
              {newTx.type === 'company_transfer' && (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>مصدر التحويل للشركة</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      className={`btn ${txSourceType === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => { setTxSourceType('bank'); setNewTx(prev => ({ ...prev, bankId: '' })); }}
                    >
                      🏦 من البنك (حوالة بنكية)
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${txSourceType === 'safe' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => { setTxSourceType('safe'); setNewTx(prev => ({ ...prev, bankId: '' })); }}
                    >
                      💸 من الخزينة المباشرة (نقدي)
                    </button>
                  </div>
                </div>
              )}

              {/* Representative search input with suggestions */}
              {newTx.type !== 'exchange' && newTx.type !== 'company_transfer' && txSourceType === 'rep' && (
                <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <label>المندوب المعني بالعملية <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="text"
                    placeholder="ابحث بكتابة اسم المندوب أو كوده..."
                    value={searchRepQuery}
                    onChange={(e) => {
                      setSearchRepQuery(e.target.value);
                      setShowRepSuggestions(true);
                      if (!e.target.value) {
                        setNewTx(prev => ({ ...prev, repId: '' }));
                      }
                    }}
                    onFocus={() => setShowRepSuggestions(true)}
                    required
                  />
                  
                  {/* Suggestions List */}
                  {showRepSuggestions && searchRepQuery && (
                    <div className="suggestions-box">
                      {reps
                        .filter(r => 
                          r.name.toLowerCase().includes(searchRepQuery.toLowerCase()) || 
                          r.code.toLowerCase().includes(searchRepQuery.toLowerCase())
                        )
                        .map(rep => (
                          <div 
                            key={rep.id} 
                            className="suggestion-item"
                            onClick={() => {
                              setNewTx(prev => ({ ...prev, repId: rep.id }));
                              setSearchRepQuery(`${rep.name} (${rep.code})`);
                              setShowRepSuggestions(false);
                            }}
                          >
                            <strong>{rep.code}</strong> — {rep.name}
                          </div>
                        ))
                      }
                      {reps.filter(r => 
                        r.name.toLowerCase().includes(searchRepQuery.toLowerCase()) || 
                        r.code.toLowerCase().includes(searchRepQuery.toLowerCase())
                      ).length === 0 && (
                        <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة</div>
                      )}
                    </div>
                  )}
                  
                  {newTx.repId && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                      ✓ تم اختيار المندوب: {selectedRepName}
                    </div>
                  )}
                </div>
              )}

              {/* Direct Safe Info Notice */}
              {txSourceType === 'direct' && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {newTx.type === 'withdrawal' 
                    ? 'ℹ️ سيتم تسجيل العملية كحركة صرف نثريات ومصاريف عامة مباشرة دون ربطها بموظف.'
                    : 'ℹ️ سيتم تسجيل العملية كحركة توريد مباشرة بالخزينة دون ربطها بمندوب.'
                  }
                </div>
              )}

              {/* DEPOSIT FROM BANK OR SPLIT DEPOSIT FIELDS */}
              {newTx.type === 'deposit' && txSourceType === 'bank' ? (
                <>
                  {/* Bank selection */}
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>البنك المورِّد منه <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select 
                      value={newTx.bankId || ''}
                      onChange={(e) => setNewTx(prev => ({ ...prev, bankId: e.target.value }))}
                      required
                    >
                      <option value="">اختر الحساب البنكي...</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code}) — {b.account_number}</option>
                      ))}
                    </select>
                  </div>

                  {/* Agency selection */}
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>التوكيل التابع له</label>
                    <select 
                      value={newTx.agencyId || ''}
                      onChange={(e) => setNewTx(prev => ({ ...prev, agencyId: e.target.value }))}
                    >
                      <option value="">🏛️ الخزنة العامة (بدون توكيل)</option>
                      {agencies.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Amount input field */}
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>قيمة المبلغ المورد من البنك <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0.01"
                        placeholder="0.00"
                        value={newTx.amount}
                        onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        style={{ width: '100%', paddingLeft: '3.5rem' }}
                      />
                      <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 'bold' }}>ج.م</span>
                    </div>
                  </div>
                </>
              ) : newTx.type === 'deposit' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    {/* Cash portion */}
                    <div className="form-group">
                      <label>💵 المبلغ النقدي (الخزينة)</label>
                      <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00"
                          value={newTx.cashAmount}
                          onChange={(e) => setNewTx(prev => ({ ...prev, cashAmount: e.target.value }))}
                          style={{ width: '100%', paddingLeft: '3rem' }}
                        />
                        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>ج.م</span>
                      </div>
                    </div>
                    
                    {/* Bank transfer portion */}
                    <div className="form-group">
                      <label>🏦 تحويل بنكي / كاش (محفظة)</label>
                      <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00"
                          value={newTx.bankTransferAmount}
                          onChange={(e) => setNewTx(prev => ({ ...prev, bankTransferAmount: e.target.value }))}
                          style={{ width: '100%', paddingLeft: '3rem' }}
                        />
                        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>ج.م</span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Account Selection - show if bankTransferAmount > 0 */}
                  {(parseFloat(newTx.bankTransferAmount) > 0) && (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>الحساب البنكي / المحفظة المستلمة <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <select 
                        value={newTx.bankId}
                        onChange={(e) => setNewTx(prev => ({ ...prev, bankId: e.target.value }))}
                        required
                      >
                        <option value="">اختر الحساب البنكي / المحفظة...</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.code}) — {b.account_number}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Receipt Image Upload - for bank transfer */}
                  {(parseFloat(newTx.bankTransferAmount) > 0) && (
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>📎 صورة إيصال / فاتورة التحويل (اختياري)</label>
                      <div style={{ marginTop: '0.4rem' }}>
                        <input
                          type="file"
                          accept="image/*"
                          id="receipt-upload"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            try {
                              const compressed = await compressImage(file);
                              setReceiptImageBank(compressed);
                            } catch (err) {
                              console.error('Image compression failed, using fallback reader:', err);
                              const reader = new FileReader();
                              reader.onloadend = () => setReceiptImageBank(reader.result);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label
                          htmlFor="receipt-upload"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                            background: receiptImageBank ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                            border: receiptImageBank ? '1px solid rgba(16,185,129,0.4)' : '1px dashed rgba(255,255,255,0.2)',
                            color: receiptImageBank ? 'var(--success)' : 'var(--text-secondary)',
                            fontSize: '0.9rem', transition: 'all 0.2s'
                          }}
                        >
                          {receiptImageBank ? '✅ تم رفع الصورة' : '📷 اختر صورة الإيصال'}
                        </label>
                        {receiptImageBank && (
                          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <img
                              src={receiptImageBank}
                              alt="Receipt preview"
                              style={{ maxWidth: '180px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--border-color)', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger)' }}
                              onClick={() => { setReceiptImageBank(null); document.getElementById('receipt-upload').value = ''; }}
                            >
                              ✕ إزالة الصورة
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Display Total Deposit Amount */}
                  {((parseFloat(newTx.cashAmount) || 0) + (parseFloat(newTx.bankTransferAmount) || 0)) > 0 && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>إجمالي مبلغ التوريد:</span>
                      <strong style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
                        {((parseFloat(newTx.cashAmount) || 0) + (parseFloat(newTx.bankTransferAmount) || 0)).toLocaleString()} ج.م
                      </strong>
                    </div>
                  )}
                </>
              ) : newTx.type === 'withdrawal' ? (
                /* WITHDRAWAL SINGLE AMOUNT FIELD */
                <>
                  {/* Bank/Agency Selection - only for bank source type withdrawals */}
                  {txSourceType === 'bank' && (
                    <>
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>التوكيل المنصرف منه</label>
                        <select 
                          value={newTx.agencyId || ''}
                          onChange={(e) => setNewTx(prev => ({ ...prev, agencyId: e.target.value }))}
                        >
                          <option value="">🏛️ الخزنة العامة (بدون توكيل)</option>
                          {agencies.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>البنك المحول إليه <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <select 
                          value={newTx.bankId || ''}
                          onChange={(e) => setNewTx(prev => ({ ...prev, bankId: e.target.value }))}
                          required
                        >
                          <option value="">اختر الحساب البنكي...</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.code}) — {b.account_number}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Withdrawal Sub Type Selection */}
                  {(txSourceType === 'rep' || txSourceType === 'direct') && (
                    <>
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>نوع الصرف <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <select 
                          value={newTx.withdrawal_sub_type && newTx.withdrawal_sub_type.startsWith('car') ? 'car' : (newTx.withdrawal_sub_type || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'car') {
                              setNewTx(prev => ({ ...prev, withdrawal_sub_type: 'car_gas' })); // Default to car_gas
                            } else {
                              setNewTx(prev => ({ ...prev, withdrawal_sub_type: val }));
                            }
                          }}
                          required
                        >
                          <option value="">اختر نوع الصرف...</option>
                          {getWithdrawalSubTypes().map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {newTx.withdrawal_sub_type && newTx.withdrawal_sub_type.startsWith('car') && (
                        <div className="form-group" style={{ marginBottom: '1.5rem', paddingRight: '1rem', borderRight: '3px solid var(--primary)' }}>
                          <label>بند مصروفات السيارة <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <select 
                            value={newTx.withdrawal_sub_type}
                            onChange={(e) => setNewTx(prev => ({ ...prev, withdrawal_sub_type: e.target.value }))}
                            required
                          >
                            <option value="car_gas">جاز</option>
                            <option value="car_oil">زيت</option>
                            <option value="car_other">مصاريف أخرى</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>قيمة المبلغ المطلوب صرفه <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0.01"
                        placeholder="0.00"
                        value={newTx.amount}
                        onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        style={{ width: '100%', paddingLeft: '3.5rem' }}
                      />
                      <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 'bold' }}>ج.م</span>
                    </div>
                  </div>
                </>
              ) : newTx.type === 'company_transfer' ? (
                <>
                  {txSourceType === 'bank' && (
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>الحساب البنكي المصدر للتحويل <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <select 
                        value={newTx.bankId || ''}
                        onChange={(e) => setNewTx(prev => ({ ...prev, bankId: e.target.value }))}
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
                    <label>الشركة أو المورد المستلم <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select 
                      value={newTx.companyId || ''}
                      onChange={(e) => setNewTx(prev => ({ ...prev, companyId: e.target.value }))}
                      required
                    >
                      <option value="">اختر الشركة...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>قيمة المبلغ المراد تحويله <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0.01"
                        placeholder="0.00"
                        value={newTx.amount}
                        onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        style={{ width: '100%', paddingLeft: '3.5rem' }}
                      />
                      <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 'bold' }}>ج.م</span>
                    </div>
                  </div>
                </>
              ) : null}

              {/* Exchange Representative and Denomination Fields */}
              {newTx.type === 'exchange' && (
                <>
                  <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }}>
                    <label>المندوب طالب الفك (اختياري)</label>
                    <input 
                      type="text"
                      placeholder="ابحث باسم المندوب أو كوده (اتركه فارغاً لخزينة مباشرة)..."
                      value={searchRepQuery}
                      onChange={(e) => {
                        setSearchRepQuery(e.target.value);
                        setShowRepSuggestions(true);
                        if (!e.target.value) {
                          setNewTx(prev => ({ ...prev, repId: '' }));
                        }
                      }}
                      onFocus={() => setShowRepSuggestions(true)}
                    />
                    {showRepSuggestions && searchRepQuery && (
                      <div className="suggestions-box">
                        {reps
                          .filter(r => 
                            r.name.toLowerCase().includes(searchRepQuery.toLowerCase()) || 
                            r.code.toLowerCase().includes(searchRepQuery.toLowerCase())
                          )
                          .map(rep => (
                            <div 
                              key={rep.id} 
                              className="suggestion-item"
                              onClick={() => {
                                setNewTx(prev => ({ ...prev, repId: rep.id }));
                                setSearchRepQuery(`${rep.name} (${rep.code})`);
                                setShowRepSuggestions(false);
                              }}
                            >
                              <strong>{rep.code}</strong> — {rep.name}
                            </div>
                          ))}
                        {reps.filter(r => 
                          r.name.toLowerCase().includes(searchRepQuery.toLowerCase()) || 
                          r.code.toLowerCase().includes(searchRepQuery.toLowerCase())
                        ).length === 0 && (
                          <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة</div>
                        )}
                      </div>
                    )}
                    {newTx.repId && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                        ✓ تم اختيار المندوب: {selectedRepName}
                      </div>
                    )}
                  </div>

                  <div className="denom-section" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      {/* Incoming Column */}
                      <div>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}>
                          <span>📥 فئات مستلمة (واردة)</span>
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                            <div className="denom-input-group" key={`inc-${denom}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{denom} ج.م</span>
                              <input 
                                type="number" 
                                min="0"
                                placeholder="0"
                                value={incomingDenominations[`denom_${denom}`] || ''}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setIncomingDenominations(prev => ({ ...prev, [`denom_${denom}`]: val }));
                                }}
                                style={{ width: '60px', border: 'none', background: 'transparent', textAlign: 'center', padding: '0.2rem', fontWeight: 'bold', color: '#fff' }}
                              />
                            </div>
                          ))}
                        </div>
                        {/* Incoming Total */}
                        {(() => {
                          const total = [200, 100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (Number(incomingDenominations[`denom_${d}`] || 0) * d), 0);
                          return (
                            <div style={{ marginTop: '1rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--success)', fontSize: '0.95rem' }}>
                              المجموع: {total.toLocaleString()} ج.م
                            </div>
                          );
                        })()}
                      </div>

                      {/* Outgoing Column */}
                      <div>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}>
                          <span>📤 فئات مسلمة (صادرة)</span>
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                            <div className="denom-input-group" key={`out-${denom}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{denom} ج.م</span>
                              <input 
                                type="number" 
                                min="0"
                                placeholder="0"
                                value={outgoingDenominations[`denom_${denom}`] || ''}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setOutgoingDenominations(prev => ({ ...prev, [`denom_${denom}`]: val }));
                                }}
                                style={{ width: '60px', border: 'none', background: 'transparent', textAlign: 'center', padding: '0.2rem', fontWeight: 'bold', color: '#fff' }}
                              />
                            </div>
                          ))}
                        </div>
                        {/* Outgoing Total */}
                        {(() => {
                          const total = [200, 100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (Number(outgoingDenominations[`denom_${d}`] || 0) * d), 0);
                          return (
                            <div style={{ marginTop: '1rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--danger)', fontSize: '0.95rem' }}>
                              المجموع: {total.toLocaleString()} ج.م
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Summary & Match Validation */}
                    {(() => {
                      const incTotal = [200, 100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (Number(incomingDenominations[`denom_${d}`] || 0) * d), 0);
                      const outTotal = [200, 100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (Number(outgoingDenominations[`denom_${d}`] || 0) * d), 0);
                      const diff = incTotal - outTotal;
                      const isMatch = incTotal > 0 && Math.abs(diff) < 0.01;

                      return (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                          {incTotal === 0 && outTotal === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>قم بإدخال الفئات للتبديل والتسوية</span>
                          ) : isMatch ? (
                            <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1rem' }}>
                              ✓ متطابق ({incTotal.toLocaleString()} ج.م)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                              ⚠️ غير متطابق! الفارق: {diff.toLocaleString()} ج.م
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* Cash Denominations Calculator - FOR DEPOSITS WITH CASH & FOR ALL WITHDRAWALS */}
              {newTx.type !== 'exchange' && ((newTx.type === 'deposit' && (txSourceType === 'bank' ? (parseFloat(newTx.amount) || 0) > 0 : (parseFloat(newTx.cashAmount) || 0) > 0)) ||
                (newTx.type === 'withdrawal' && (parseFloat(newTx.amount) || 0) > 0)) && (
                <div className="denom-section">
                  <div className="denom-section-title">
                    <span>💵 فئات المبالغ النقدية</span>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        const amt = newTx.type === 'withdrawal'
                          ? (parseFloat(newTx.amount) || 0)
                          : (txSourceType === 'bank' ? (parseFloat(newTx.amount) || 0) : (parseFloat(newTx.cashAmount) || 0));
                        let remaining = amt;
                        const breakdown = { denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 };
                        
                        breakdown.denom_200 = Math.floor(remaining / 200); remaining %= 200;
                        breakdown.denom_100 = Math.floor(remaining / 100); remaining %= 100;
                        breakdown.denom_50 = Math.floor(remaining / 50); remaining %= 50;
                        breakdown.denom_20 = Math.floor(remaining / 20); remaining %= 20;
                        breakdown.denom_10 = Math.floor(remaining / 10); remaining %= 10;
                        breakdown.denom_5 = Math.floor(remaining / 5); remaining %= 5;
                        breakdown.denom_1 = Math.floor(remaining);
                        
                        setDenominations(breakdown);
                      }}
                    >
                      💡 ملء تلقائي للفئات
                    </button>
                  </div>
                  
                  <div className="denom-grid">
                    {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                      <div className="denom-input-group" key={denom}>
                        <span className="denom-label">{denom} ج.م</span>
                        <div className="denom-input-row">
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={denominations[`denom_${denom}`] || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDenominations(prev => ({ ...prev, [`denom_${denom}`]: val }));
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calculator Summary */}
                  {(() => {
                    const totalCalculated = 
                      (Number(denominations.denom_200 || 0) * 200) + 
                      (Number(denominations.denom_100 || 0) * 100) + 
                      (Number(denominations.denom_50 || 0) * 50) + 
                      (Number(denominations.denom_20 || 0) * 20) + 
                      (Number(denominations.denom_10 || 0) * 10) + 
                      (Number(denominations.denom_5 || 0) * 5) + 
                      (Number(denominations.denom_1 || 0) * 1);
                    const expectedAmount = newTx.type === 'withdrawal'
                      ? (parseFloat(newTx.amount) || 0)
                      : (txSourceType === 'bank' ? (parseFloat(newTx.amount) || 0) : (parseFloat(newTx.cashAmount) || 0));
                    const diff = expectedAmount - totalCalculated;
                    const isMatch = Math.abs(diff) < 0.01;
                    
                    return (
                      <div className="denom-calc-summary">
                        <span className="denom-total-label">إجمالي الفئات:</span>
                        <span className={`denom-total-value ${isMatch ? 'match' : 'mismatch'}`}>
                          {totalCalculated.toLocaleString()} ج.م
                          {expectedAmount > 0 && (
                            <span style={{ fontSize: '0.8rem', marginRight: '0.5rem', fontWeight: 500 }}>
                              {isMatch ? '✓ متطابق' : `(المتبقي: ${diff.toLocaleString()} ج.م)`}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label>ملاحظات إضافية</label>
                <textarea 
                  rows="3" 
                  placeholder="اكتب أي ملاحظات أو تفاصيل عن الحركة..."
                  value={newTx.notes}
                  onChange={(e) => setNewTx(prev => ({ ...prev, notes: e.target.value }))}
                ></textarea>
              </div>

              {/* Submit */}
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ 
                  width: '100%', 
                  background: newTx.type === 'deposit' ? 'var(--success)' : newTx.type === 'withdrawal' ? 'var(--danger)' : newTx.type === 'company_transfer' ? '#06b6d4' : '#7c3aed', 
                  fontSize: '1.1rem', 
                  padding: '0.9rem',
                  boxShadow: newTx.type === 'exchange' ? '0 4px 12px rgba(124, 58, 237, 0.2)' : newTx.type === 'company_transfer' ? '0 4px 12px rgba(6, 182, 212, 0.2)' : ''
                }}
                disabled={(() => {
                  if (newTx.type !== 'exchange') return false;
                  const incTotal = [200, 100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (Number(incomingDenominations[`denom_${d}`] || 0) * d), 0);
                  const outTotal = [200, 100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (Number(outgoingDenominations[`denom_${d}`] || 0) * d), 0);
                  return incTotal === 0 || Math.abs(incTotal - outTotal) > 0.01;
                })()}
              >
                {newTx.type === 'deposit' 
                  ? '📥 تأكيد عملية التوريد' 
                  : newTx.type === 'withdrawal' 
                    ? '📤 تأكيد عملية الصرف' 
                    : newTx.type === 'company_transfer'
                      ? (currentUser.role === 'manager' ? '🏢 تنفيذ الحوالة للشركة' : '🏢 طلب إذن تحويل للشركة')
                      : currentUser.role === 'manager' 
                        ? '🔄 تنفيذ عملية التسوية والفك' 
                        : '🔄 طلب إذن تسوية وفك فئات'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* REPRESENTATIVE DASHBOARD TAB */}
      {activeTab === 'rep-dashboard' && (
        <div className="rep-dashboard-container" style={{ direction: 'rtl' }}>
          {repLedgerLoading && !repLedgerData ? (
            <div className="no-data-msg">جاري تحميل البيانات... ⏳</div>
          ) : !repLedgerData ? (
            <div className="no-data-msg">لا توجد بيانات متاحة لحسابك حالياً.</div>
          ) : (
            <>
              {/* Rep Balance Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(3,105,161,0.08) 100%)',
                border: '2px solid rgba(14,165,233,0.35)',
                borderRadius: '20px', padding: '2rem',
                position: 'relative', overflow: 'hidden',
                marginBottom: '2rem'
              }}>
                <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '120px', height: '120px', background: 'rgba(14,165,233,0.08)', borderRadius: '50%' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.8rem' }}>👤</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                      المندوب: {repLedgerData.representative.name} ({repLedgerData.representative.code})
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>الرصيد الإجمالي الحالي</div>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0ea5e9', letterSpacing: '-1px', lineHeight: 1 }}>
                        {(repLedgerData.summary.balance ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                        <span style={{ fontSize: '1rem', fontWeight: 400, color: '#7dd3fc', marginRight: '0.4rem' }}>ج.م</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '2rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>الهاتف: {repLedgerData.representative.phone || 'غير مسجل'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>التوكيل: {repLedgerData.representative.agency_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>المشرف: {repLedgerData.representative.supervisor_name || 'بدون مشرف'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                    <div style={{ background: 'rgba(16,185,129,0.05)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '0.1rem' }}>إجمالي التوريدات النقدية</div>
                      <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{(repLedgerData.summary.cashDeposits ?? 0).toLocaleString('ar-EG')} ج.م</strong>
                    </div>
                    <div style={{ background: 'rgba(124,58,237,0.05)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(124,58,237,0.15)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#c4b5fd', marginBottom: '0.1rem' }}>إجمالي تحويلات البنك</div>
                      <strong style={{ color: '#a78bfa', fontSize: '1.1rem' }}>{(repLedgerData.summary.bankTransferDeposits ?? 0).toLocaleString('ar-EG')} ج.م</strong>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.05)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#f87171', marginBottom: '0.1rem' }}>إجمالي الصرف الفعلي</div>
                      <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{(repLedgerData.summary.totalWithdrawals ?? 0).toLocaleString('ar-EG')} ج.م</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions History Table */}
              <div className="panel">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className="panel-title">📃 طلبات العمليات وكشف حسابي</h2>
                  <button className="btn btn-secondary" onClick={loadRepLedger} disabled={repLedgerLoading} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    🔄 تحديث البيانات
                  </button>
                </div>
                
                <div className="table-container" style={{ margin: 0 }}>
                  {repLedgerData.transactions.length === 0 ? (
                    <div className="no-data-msg" style={{ padding: '2rem' }}>لا توجد عمليات مسجلة لحسابك بعد.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>رقم الإيصال</th>
                          <th>التاريخ والوقت</th>
                          <th>النوع</th>
                          <th>طريقة الدفع / بند الصرف</th>
                          <th>المبلغ</th>
                          <th>حالة الطلب</th>
                          <th>ملاحظات</th>
                          <th>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repLedgerData.transactions.map((tx) => {
                          const idStr = String(tx.id).padStart(6, '0');
                          const txDate = new Date(tx.date).toLocaleString('ar-EG');
                          
                          let statusLabel = 'مكتمل';
                          let statusClass = 'approved';
                          
                          if (tx.status === 'pending_receipt') {
                            statusLabel = '⏳ بانتظار استلام الحسابات';
                            statusClass = 'pending';
                          } else if (tx.status === 'pending') {
                            statusLabel = '⏳ بانتظار موافقة المدير';
                            statusClass = 'pending';
                          } else if (tx.status === 'approved') {
                            statusLabel = tx.type === 'deposit' ? '✔️ تم الاستلام' : '🔑 معتمد - بانتظار الصرف';
                            statusClass = 'approved';
                          } else if (tx.status === 'disbursed') {
                            statusLabel = '💵 تم الصرف والاستلام';
                            statusClass = 'approved';
                          } else if (tx.status === 'rejected') {
                            statusLabel = '❌ مرفوض';
                            statusClass = 'rejected';
                          }

                          const displayPaymentOrSubType = tx.type === 'deposit' 
                            ? (tx.payment_method === 'bank_transfer' ? '🏧 تحويل بنكي' : '💵 نقدي بالخزينة')
                            : (tx.withdrawal_sub_type === 'salary' ? '💸 راتب' : tx.withdrawal_sub_type === 'commission' ? '💼 عمولة' : tx.withdrawal_sub_type === 'car' ? '🚗 مصاريف سيارة' : `📤 صرف: ${tx.withdrawal_sub_type || 'عام'}`);

                          return (
                            <tr key={tx.id}>
                              <td><strong>TX-{idStr}</strong></td>
                              <td>{txDate}</td>
                              <td>
                                <span className={`badge badge-${tx.type === 'deposit' ? 'wholesale' : 'retail'}`}>
                                  {tx.type === 'deposit' ? '📥 توريد إيداع' : '📤 إذن صرف'}
                                </span>
                              </td>
                              <td>{displayPaymentOrSubType}</td>
                              <td>
                                <span className={`amount-${tx.type}`} style={{ fontWeight: 'bold' }}>
                                  {tx.type === 'withdrawal' ? '-' : ''}
                                  {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge-inline status-${tx.status || 'approved'}`} style={{
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  background: tx.status === 'pending_receipt' ? 'rgba(245,158,11,0.15)' : tx.status === 'pending' ? 'rgba(234,179,8,0.15)' : tx.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                                  color: tx.status === 'pending_receipt' ? '#fbbf24' : tx.status === 'pending' ? '#eab308' : tx.status === 'rejected' ? '#f87171' : '#34d399'
                                }}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.notes}>
                                {tx.notes || '—'}
                              </td>
                              <td>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'rgba(14,165,233,0.08)', color: 'var(--primary)', borderColor: 'rgba(14,165,233,0.2)' }}
                                  onClick={() => handlePrintReceipt({
                                    ...tx,
                                    rep_name: repLedgerData.representative.name,
                                    rep_code: repLedgerData.representative.code,
                                    agency_name: repLedgerData.representative.agency_name
                                  })}
                                >
                                  🖨️ طباعة الإيصال
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* REPRESENTATIVE REQUEST NEW TRANSACTION TAB */}
      {activeTab === 'rep-new-tx' && (
        <div className="panel" style={{ maxWidth: '600px', margin: '0 auto', direction: 'rtl' }}>
          <div className="panel-header">
            <h2 className="panel-title">💸 طلب حركة جديدة (توريد / إذن صرف)</h2>
          </div>
          
          {txError && <div className="alert alert-error">⚠️ {txError}</div>}
          {txSuccess && <div className="alert alert-success">✔️ {txSuccess}</div>}

          <form onSubmit={async (e) => {
            e.preventDefault();
            setTxError('');
            setTxSuccess(null);

            // Build request body
            let body = {
              type: newTx.type,
              notes: newTx.notes
            };

            if (newTx.type === 'deposit') {
              const cashAmt = parseFloat(newTx.cashAmount) || 0;
              const bankAmt = parseFloat(newTx.bankTransferAmount) || 0;

              if (cashAmt <= 0 && bankAmt <= 0) {
                setTxError('يرجى إدخال مبلغ توريد نقدي أو تحويل بنكي');
                return;
              }

              body.cash_amount = cashAmt;
              body.bank_transfer_amount = bankAmt;

              if (cashAmt > 0) {
                body.denominations = denominations;
              }

              if (bankAmt > 0) {
                if (!newTx.bankId) {
                  setTxError('يرجى اختيار الحساب البنكي للتوريد بالتحويل');
                  return;
                }
                body.bank_id = newTx.bankId;
                body.receipt_image_bank = receiptImageBank;
              }
            } else {
              const amountVal = parseFloat(newTx.amount) || 0;
              if (amountVal <= 0) {
                setTxError('يرجى إدخال مبلغ الصرف المطلوب');
                return;
              }
              body.amount = amountVal;
              body.withdrawal_sub_type = newTx.withdrawal_sub_type || 'loan';
            }

            try {
              const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });
              const data = await res.json();
              if (res.ok) {
                setTxSuccess(data.message || 'تم تقديم طلبك بنجاح!');
                setNewTx({ type: 'deposit', repId: '', bankId: '', amount: '', cashAmount: '', bankTransferAmount: '', notes: '', payment_method: 'cash', withdrawal_sub_type: '' });
                setDenominations({ denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 });
                setReceiptImageBank(null);
                loadRepLedger();
                setTimeout(() => setActiveTab('rep-dashboard'), 1500);
              } else {
                setTxError(data.error || 'حدث خطأ أثناء حفظ المعاملة');
              }
            } catch (err) {
              setTxError('تعذر الاتصال بالسيرفر');
            }
          }}>
            {/* Request Type */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>نوع الطلب <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'deposit', withdrawal_sub_type: '' })}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 'bold', border: '2px solid',
                    borderColor: newTx.type === 'deposit' ? 'var(--success)' : 'transparent',
                    background: newTx.type === 'deposit' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                    color: newTx.type === 'deposit' ? '#10b981' : 'var(--text-secondary)',
                    transition: 'all 0.2s', cursor: 'pointer'
                  }}
                >
                  📥 طلب توريد نقدية
                </button>
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'withdrawal', withdrawal_sub_type: 'loan' })}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 'bold', border: '2px solid',
                    borderColor: newTx.type === 'withdrawal' ? 'var(--danger)' : 'transparent',
                    background: newTx.type === 'withdrawal' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                    color: newTx.type === 'withdrawal' ? '#ef4444' : 'var(--text-secondary)',
                    transition: 'all 0.2s', cursor: 'pointer'
                  }}
                >
                  📤 طلب إذن صرف نقدية
                </button>
              </div>
            </div>

            {/* Deposit-specific Fields */}
            {newTx.type === 'deposit' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {/* Cash portion */}
                  <div className="form-group">
                    <label>💵 توريد نقدي بالخزينة (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={newTx.cashAmount}
                      onChange={(e) => setNewTx({ ...newTx, cashAmount: e.target.value })}
                    />
                  </div>

                  {/* Bank transfer portion */}
                  <div className="form-group">
                    <label>🏦 تحويل بنكي مباشر (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={newTx.bankTransferAmount}
                      onChange={(e) => setNewTx({ ...newTx, bankTransferAmount: e.target.value })}
                    />
                  </div>
                </div>

                {/* Bank Account Selection - show if bankTransferAmount > 0 */}
                {parseFloat(newTx.bankTransferAmount) > 0 && (
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>الحساب البنكي / المحفظة المستلمة <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select
                      value={newTx.bankId}
                      onChange={(e) => setNewTx({ ...newTx, bankId: e.target.value })}
                      required
                    >
                      <option value="">اختر الحساب البنكي / المحفظة...</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code}) — {b.account_number}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Receipt Image Upload - show if bankTransferAmount > 0 */}
                {parseFloat(newTx.bankTransferAmount) > 0 && (
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>📎 صورة إيصال / فاتورة التحويل (اختياري)</label>
                    <div style={{ marginTop: '0.4rem' }}>
                      <input
                        type="file"
                        accept="image/*"
                        id="rep-receipt-upload"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          try {
                            const compressed = await compressImage(file);
                            setReceiptImageBank(compressed);
                          } catch (err) {
                            console.error('Image compression failed, using fallback reader:', err);
                            const reader = new FileReader();
                            reader.onloadend = () => setReceiptImageBank(reader.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="rep-receipt-upload"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                          background: receiptImageBank ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                          border: receiptImageBank ? '1px solid rgba(16,185,129,0.4)' : '1px dashed rgba(255,255,255,0.2)',
                          color: receiptImageBank ? 'var(--success)' : 'var(--text-secondary)',
                          fontSize: '0.9rem', transition: 'all 0.2s'
                        }}
                      >
                        {receiptImageBank ? '✅ تم رفع الصورة' : '📷 اختر صورة الإيصال'}
                      </label>
                      {receiptImageBank && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <img
                            src={receiptImageBank}
                            alt="Receipt preview"
                            style={{ maxWidth: '180px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--border-color)', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger)' }}
                            onClick={() => { setReceiptImageBank(null); document.getElementById('rep-receipt-upload').value = ''; }}
                          >
                            ✕ إزالة الصورة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Denominations Calculator - show if cashAmount > 0 */}
                {parseFloat(newTx.cashAmount) > 0 && (
                  <div className="denom-section" style={{ marginBottom: '1.5rem' }}>
                    <div className="denom-section-title">
                      <span>💵 فئات المبلغ النقدي المودع بالخزينة</span>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          const amt = parseFloat(newTx.cashAmount) || 0;
                          let remaining = amt;
                          const breakdown = { denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 };
                          breakdown.denom_200 = Math.floor(remaining / 200); remaining %= 200;
                          breakdown.denom_100 = Math.floor(remaining / 100); remaining %= 100;
                          breakdown.denom_50 = Math.floor(remaining / 50); remaining %= 50;
                          breakdown.denom_20 = Math.floor(remaining / 20); remaining %= 20;
                          breakdown.denom_10 = Math.floor(remaining / 10); remaining %= 10;
                          breakdown.denom_5 = Math.floor(remaining / 5); remaining %= 5;
                          breakdown.denom_1 = Math.floor(remaining);
                          setDenominations(breakdown);
                        }}
                      >
                        💡 ملء تلقائي للفئات
                      </button>
                    </div>
                    <div className="denom-grid">
                      {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                        <div className="denom-input-group" key={denom}>
                          <span className="denom-label">{denom} ج.م</span>
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={denominations[`denom_${denom}`] || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDenominations(prev => ({ ...prev, [`denom_${denom}`]: val }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Withdrawal-specific Fields */}
            {newTx.type === 'withdrawal' && (
              <>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>بند الصرف (إذن صرف) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select
                    value={newTx.withdrawal_sub_type || 'loan'}
                    onChange={(e) => setNewTx({ ...newTx, withdrawal_sub_type: e.target.value })}
                    required
                  >
                    <option value="loan">💵 طلب سلفة</option>
                    <option value="car_gas">⛽ مصاريف سيارة (جاز)</option>
                    <option value="car_oil">🛢️ مصاريف سيارة (زيت/صيانة)</option>
                    <option value="car_other">🚗 مصاريف سيارة (مصاريف أخرى)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>قيمة مبلغ الصرف المطلوبة (ج.م) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="number"
                    min="1"
                    placeholder="أدخل مبلغ الصرف المطلوب"
                    value={newTx.amount}
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                    required
                  />
                </div>
              </>
            )}

            {/* Common Notes */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label>بيان الملاحظات / التفاصيل</label>
              <textarea
                rows="3"
                placeholder="اكتب تفاصيل أو بيان إضافي عن العملية..."
                value={newTx.notes}
                onChange={(e) => setNewTx({ ...newTx, notes: e.target.value })}
              ></textarea>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', background: newTx.type === 'deposit' ? 'var(--success)' : 'var(--danger)', fontSize: '1.1rem', padding: '0.9rem' }}
            >
              {newTx.type === 'deposit' ? '📥 تقديم طلب التوريد' : '📤 تقديم طلب إذن الصرف'}
            </button>
          </form>
        </div>
      )}

      {/* AGENCIES TAB */}
      {activeTab === 'agencies' && (
        <div className="grid-2col" style={{ gridTemplateColumns: currentUser.role === 'manager' ? '2fr 1fr' : '1fr' }}>
          {/* Agencies list */}
          <div className="panel" style={{ width: '100%' }}>
            <div className="panel-header">
              <h2 className="panel-title">🏢 دليل التوكيلات والحسابات المشتركة</h2>
            </div>
            
            {selectedAgencyLedger ? (
              /* INDIVIDUAL AGENCY LEDGER */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ color: 'var(--primary)', fontWeight: 800 }}>{selectedAgencyLedger.agency.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>كود التوكيل: {selectedAgencyLedger.agency.code} | تاريخ التأسيس: {new Date(selectedAgencyLedger.agency.created_at).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => { setSelectedAgencyLedger(null); localStorage.removeItem('selectedAgencyLedgerId'); }}>العودة للقائمة ⬅</button>
                </div>
                
                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="metric-card deposits" style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#34d399' }}>📥 توريدات الخزينة (نقدي)</span>
                    <span className="metric-value currency" style={{ fontSize: '1.25rem', color: '#10b981' }}>{(selectedAgencyLedger.summary.cashDeposits ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card withdrawals" style={{ padding: '1rem', background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#fca5a5' }}>📤 إجمالي الصرف (نقدي)</span>
                    <span className="metric-value currency" style={{ fontSize: '1.25rem', color: '#f43f5e' }}>{(selectedAgencyLedger.summary.totalWithdrawals ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card balance" style={{ padding: '1rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 'bold' }}>💵 رصيد خزينة التوكيل</span>
                    <span className="metric-value currency" style={{ fontSize: '1.35rem', color: '#10b981', fontWeight: 800 }}>{(selectedAgencyLedger.summary.cashBalance ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card deposits" style={{ padding: '1rem', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: '#c4b5fd' }}>🏧 تحويلات كاش (بنك)</span>
                    <span className="metric-value currency" style={{ fontSize: '1.25rem', color: '#a78bfa' }}>{(selectedAgencyLedger.summary.bankTransferDeposits ?? 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card balance" style={{ padding: '1rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(124,58,237,0.1) 100%)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>📈 الرصيد الإجمالي للتوكيل</span>
                    <span className="metric-value currency" style={{ fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: 900 }}>{(selectedAgencyLedger.summary.balance ?? 0).toLocaleString()} ج.م</span>
                  </div>
                </div>

                <div className="table-container">
                  {selectedAgencyLedger.transactions.length === 0 ? (
                    <div className="no-data-msg">لم يتم تسجيل أي عمليات نقدية لمناديب هذا التوكيل بعد.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>التاريخ والوقت</th>
                          <th>اسم المندوب (كوده)</th>
                          <th>العملية</th>
                          <th>طريقة الدفع</th>
                          <th>المبلغ</th>
                          <th>ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAgencyLedger.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                            <td>{tx.rep_name ? `${tx.rep_name} (${tx.rep_code})` : (tx.bank_name ? `إلى بنك: ${tx.bank_name}` : '—')}</td>
                            <td>
                              <span className={`badge badge-${tx.type}`}>
                                {tx.type === 'deposit' ? '📥 توريد' : '📤 صرف'}
                                {tx.withdrawal_sub_type === 'car' ? ' - سيارة' : 
                                 tx.withdrawal_sub_type === 'car_gas' ? ' - سيارة (جاز)' : 
                                 tx.withdrawal_sub_type === 'car_oil' ? ' - سيارة (زيت)' : 
                                 tx.withdrawal_sub_type === 'car_other' ? ' - سيارة (مصاريف أخرى)' : 
                                 tx.withdrawal_sub_type === 'salary' ? ' - راتب' : 
                                 tx.withdrawal_sub_type === 'commission' ? ' - عمولة' : ''}
                              </span>
                            </td>
                            <td>
                              {tx.payment_method === 'bank_transfer' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' }}>🏧 تحويل بنكي</span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>💵 نقدي</span>
                              )}
                            </td>
                            <td>
                              <span className={`amount-${tx.type}`}>
                                {tx.type === 'withdrawal' ? '-' : ''}
                                {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                              </span>
                            </td>
                            <td>
                              {tx.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              /* ALL AGENCIES TABLE */
              <div className="table-container">
                {agencies.length === 0 ? (
                  <div className="no-data-msg">لا يوجد توكيلات مسجلة بالنظام حالياً.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>كود التوكيل</th>
                        <th>اسم التوكيل</th>
                        <th>عدد المناديب</th>
                        <th style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>💵 رصيد خزينة التوكيل (نقدي)</th>
                        <th style={{ backgroundColor: 'rgba(124, 58, 237, 0.05)' }}>🏧 رصيد تحويلات الكاش</th>
                        <th style={{ fontWeight: 'bold' }}>📈 الرصيد الإجمالي للتوكيل</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agencies.map((agency) => (
                        <tr key={agency.id}>
                          <td><strong>{agency.code}</strong></td>
                          <td>{agency.name}</td>
                          <td>{agency.reps_count} مناديب</td>
                          <td style={{ color: '#10b981', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
                            {Number(agency.cash_balance ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                          </td>
                          <td style={{ color: '#a78bfa', fontWeight: 700, backgroundColor: 'rgba(124, 58, 237, 0.02)' }}>
                            {Number(agency.bank_transfer_deposits ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                          </td>
                          <td>
                            <span style={{ fontWeight: 800, color: Number(agency.balance ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {Number(agency.balance ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                onClick={() => handleViewAgencyLedger(agency.id)}
                              >
                                📂 كشف حساب
                              </button>
                              {currentUser.role === 'manager' && (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                                  onClick={() => handleDeleteAgency(agency.id, agency.name)}
                                >
                                  🗑️ حذف
                                </button>
                              )}
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
          
          {/* Add Agency Panel */}
          {currentUser.role === 'manager' && !selectedAgencyLedger && (
            <div className="panel" style={{ width: '100%', marginTop: '1.5rem' }}>
              <div className="panel-header">
                <h2 className="panel-title">➕ إضافة توكيل جديد</h2>
              </div>
              
              {agencyError && <div className="alert alert-error">⚠️ {agencyError}</div>}
              {agencySuccess && <div className="alert alert-success">✔️ {agencySuccess}</div>}

              <form onSubmit={handleAddAgency} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>كود التوكيل <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="text" 
                    value={newAgency.code}
                    readOnly
                    disabled
                    style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>اسم التوكيل بالكامل <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="text" 
                    placeholder="مثال: توكيل الجيزة والفيوم"
                    value={newAgency.name}
                    onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '0 2rem' }}>حفظ التوكيل الجديد</button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* COMPANIES TAB */}
      {activeTab === 'companies' && (currentUser.role === 'manager' || currentUser.role === 'accountant') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
          
          {companyError && <div className="alert alert-error">⚠️ {companyError}</div>}
          {companySuccess && <div className="alert alert-success">✔️ {companySuccess}</div>}

          {selectedCompanyForLedger && companyLedgerData ? (
            /* INDIVIDUAL COMPANY LEDGER VIEW */
            <div className="panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="panel-title">🏢 كشف حساب الشركة: {selectedCompanyForLedger.name}</h2>
                <button className="btn btn-secondary" onClick={() => { setSelectedCompanyForLedger(null); setCompanyLedgerData(null); localStorage.removeItem('selectedCompanyForLedger'); }}>العودة للقائمة ⬅</button>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ color: 'var(--primary)', fontWeight: 800 }}>{selectedCompanyForLedger.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    كود الشركة: {selectedCompanyForLedger.code}
                    {selectedCompanyForLedger.bank_account_number && ` | رقم حساب الشركة: ${selectedCompanyForLedger.bank_account_number}`}
                    {selectedCompanyForLedger.bank_name && ` | بنك الشركة المستلم: ${selectedCompanyForLedger.bank_name}`}
                  </p>
                </div>
                <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>إجمالي المبالغ المحولة</span>
                  <strong style={{ fontSize: '1.3rem', color: '#22d3ee' }}>{Number(companyLedgerData.summary.totalTransfers).toLocaleString()} ج.م</strong>
                </div>
              </div>

              <div className="table-container">
                {companyLedgerData.transactions.length === 0 ? (
                  <div className="no-data-msg">لم يتم تسجيل أي حوالات صادرة لهذه الشركة بعد.</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>رقم الحركة</th>
                        <th>التاريخ</th>
                        <th>البنك المورَّد منه</th>
                        <th>المبلغ</th>
                        <th>الملاحظات</th>
                        <th>بواسطة</th>
                        <th>الحالة</th>
                        <th>الطباعة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyLedgerData.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>#{String(tx.id).padStart(6, '0')}</td>
                          <td>{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                          <td>
                            {tx.bank_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({tx.bank_code})</span>
                          </td>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{Number(tx.amount).toLocaleString()} ج.م</td>
                          <td>{tx.notes || '—'}</td>
                          <td>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tx.creator_name || 'System'}</span>
                          </td>
                          <td>
                            <span className="badge badge-deposit">مكتمل</span>
                          </td>
                          <td>
                            <button className="action-icon-btn" title="طباعة الإيصال" onClick={() => handlePrintReceipt(tx)}>
                              🖨️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            /* COMPANIES DIRECTORY & ADD FORM */
            <div className="grid-2col">
              {/* Companies list */}
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">🏢 دليل الشركات والموردين</h2>
                </div>
                
                {companies.length === 0 ? (
                  <div className="no-data-msg">لا يوجد أي شركات مسجلة في النظام حالياً. يمكنك إضافة شركة من النموذج الجانبي.</div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الكود</th>
                          <th>اسم الشركة</th>
                          <th>الحساب البنكي للشركة</th>
                          <th>إجمالي المحولات</th>
                          <th>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map(company => (
                          <tr key={company.id}>
                            <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{company.code}</td>
                            <td>{company.name}</td>
                            <td>
                              {company.bank_account_number ? (
                                <div>
                                  <div>{company.bank_account_number}</div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{company.bank_name}</span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 'bold', color: '#22d3ee' }}>{Number(company.total_transfers).toLocaleString()} ج.م</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => loadCompanyLedger(company)}>
                                  📃 كشف حساب
                                </button>
                                {currentUser.role === 'manager' && (
                                  <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => handleDeleteCompany(company.id)}>
                                    🗑️ حذف
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add company form */}
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">➕ إضافة شركة جديدة</h2>
                </div>
                <form onSubmit={handleCreateCompany}>
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label>كود الشركة (سيتم توليده تلقائياً إذا ترك فارغاً)</label>
                    <input 
                      type="text" 
                      placeholder="مثال: COCA, PEPSI (أو اتركه فارغاً للتوليد التلقائي)..." 
                      value={newCompany.code}
                      onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value.toUpperCase() })}
                      style={{ marginTop: '0.25rem' }}
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label>اسم الشركة التجاري <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input 
                      type="text" 
                      placeholder="مثال: شركة الأهرم للمشروبات..." 
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      required
                      style={{ marginTop: '0.25rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label>رقم الحساب البنكي للشركة (اختياري)</label>
                    <input 
                      type="text" 
                      placeholder="أدخل رقم الحساب البنكي للشركة المستلمة..." 
                      value={newCompany.bank_account_number}
                      onChange={(e) => setNewCompany({ ...newCompany, bank_account_number: e.target.value })}
                      style={{ marginTop: '0.25rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>اسم بنك الشركة المستلم (اختياري)</label>
                    <input 
                      type="text" 
                      placeholder="مثال: البنك الأهلي المصري..." 
                      value={newCompany.bank_name}
                      onChange={(e) => setNewCompany({ ...newCompany, bank_name: e.target.value })}
                      style={{ marginTop: '0.25rem' }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontWeight: 'bold' }}>
                    💾 حفظ الشركة
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BANKS TAB */}
      {activeTab === 'banks' && (currentUser.role === 'manager' || currentUser.role === 'accountant') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
          {/* Bank Initial Balance Setup Banner (only if there are banks with 0 initial balance) */}
          {currentUser.role === 'manager' && banks.filter(b => Number(b.initial_balance) === 0).length > 0 && (
            <div className="panel" style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(29, 78, 216, 0.05) 100%)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '5rem', opacity: 0.05, pointerEvents: 'none' }}>🏦</div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚙️ ضبط الأرصدة الافتتاحية للحسابات البنكية (رصيد أول المدة)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                يرجى إدخال الرصيد الافتتاحي للحسابات البنكية التالية لتأسيس رصيد بداية المدة لها. ستختفي هذه اللوحة بمجرد تعيين الأرصدة.
              </p>
              
              {bankInitError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {bankInitError}</div>}
              {bankInitSuccess && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✔️ {bankInitSuccess}</div>}

              <form onSubmit={async (e) => {
                e.preventDefault();
                setBankInitError('');
                setBankInitSuccess('');
                
                try {
                  const res = await fetch('/api/banks/initial-balances', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ balances: bankInitBalances })
                  });
                  
                  const data = await res.json();
                  if (res.ok) {
                    setBankInitSuccess('تم حفظ الأرصدة الافتتاحية بنجاح!');
                    loadBanks();
                  } else {
                    setBankInitError(data.error || 'حدث خطأ أثناء حفظ الأرصدة');
                  }
                } catch (err) {
                  setBankInitError('تعذر الاتصال بالسيرفر');
                }
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  {banks.filter(b => Number(b.initial_balance) === 0).map(bank => (
                    <div key={bank.id} className="form-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 0 }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                        🏦 {bank.name} ({bank.code})
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00 ج.م"
                        value={bankInitBalances[bank.id] || ''}
                        onChange={(e) => setBankInitBalances({ ...bankInitBalances, [bank.id]: e.target.value })}
                        required
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', width: '100%', padding: '0.5rem', borderRadius: '8px', color: 'var(--text-primary)' }}
                      />
                    </div>
                  ))}
                </div>
                <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem' }}>
                  💾 حفظ الأرصدة الافتتاحية
                </button>
              </form>
            </div>
          )}

          <div className={currentUser.role === 'manager' ? "grid-2col" : ""} style={{ display: currentUser.role !== 'manager' ? 'block' : undefined }}>
            {/* Banks list */}
            <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">🏦 دليل الحسابات البنكية</h2>
            </div>
            
            {selectedBankLedger ? (
              /* INDIVIDUAL BANK LEDGER */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ color: 'var(--primary)', fontWeight: 800 }}>{selectedBankLedger.bank.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      كود الحساب: {selectedBankLedger.bank.code} | رقم الحساب: {selectedBankLedger.bank.account_number}
                      {selectedBankLedger.bank.account_name && ` | اسم الحساب: ${selectedBankLedger.bank.account_name}`}
                      {selectedBankLedger.bank.branch && ` | الفرع: ${selectedBankLedger.bank.branch}`}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => { setSelectedBankLedger(null); localStorage.removeItem('selectedBankLedgerId'); }}>العودة للقائمة ⬅</button>
                </div>
                
                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="metric-card balance" style={{ padding: '1rem' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem' }}>الرصيد الافتتاحي</span>
                    <span className="metric-value currency" style={{ fontSize: '1.3rem' }}>{Number(selectedBankLedger.bank.initial_balance).toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card deposits" style={{ padding: '1rem' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem' }}>إجمالي الإيداعات</span>
                    <span className="metric-value currency" style={{ fontSize: '1.3rem' }}>{selectedBankLedger.summary.totalDeposits.toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card withdrawals" style={{ padding: '1rem' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem' }}>إجمالي السحوبات</span>
                    <span className="metric-value currency" style={{ fontSize: '1.3rem' }}>{selectedBankLedger.summary.totalWithdrawals.toLocaleString()} ج.م</span>
                  </div>
                  <div className="metric-card balance" style={{ padding: '1rem', background: 'var(--success-bg)' }}>
                    <span className="metric-title" style={{ fontSize: '0.8rem' }}>الرصيد الحالي</span>
                    <span className="metric-value currency" style={{ fontSize: '1.3rem', color: 'var(--success)' }}>{selectedBankLedger.summary.balance.toLocaleString()} ج.م</span>
                  </div>
                </div>

                <div className="table-container">
                  {selectedBankLedger.transactions.length === 0 ? (
                    <div className="no-data-msg">لم يتم تسجيل أي تحويلات نقدية لهذا الحساب البنكي بعد.</div>
                  ) : (
                    <div>
                      {/* BANK TRANSFER (CASH) transactions - highlighted section */}
                      {selectedBankLedger.transactions.filter(tx => tx.payment_method === 'bank_transfer').length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(124,58,237,0.08)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
                            <span style={{ fontSize: '1.1rem' }}>🏦</span>
                            <strong style={{ color: '#a78bfa' }}>تحويلات الكاش البنكية</strong>
                            <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {selectedBankLedger.transactions.filter(tx => tx.payment_method === 'bank_transfer').length} عملية
                            </span>
                          </div>
                          <div style={{ display: 'grid', gap: '1rem' }}>
                            {selectedBankLedger.transactions.filter(tx => tx.payment_method === 'bank_transfer').map(tx => (
                              <div key={tx.id} style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                {/* Receipt image */}
                                {tx.receipt_image ? (
                                  <div style={{ flexShrink: 0 }}>
                                    <img
                                      src={tx.receipt_image}
                                      alt="إيصال التحويل"
                                      style={{ width: '90px', height: '70px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(124,58,237,0.3)', cursor: 'pointer' }}
                                      onClick={() => setActiveImageModal(tx.receipt_image)}
                                      title="اضغط لعرض الصورة بالحجم الكامل"
                                    />
                                  </div>
                                ) : (
                                  <div style={{ flexShrink: 0, width: '90px', height: '70px', borderRadius: '8px', border: '1px dashed rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1.5rem' }}>📄</div>
                                )}
                                {/* Details */}
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                    <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '1rem' }}>
                                      {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(tx.date).toLocaleString('ar-EG')}</span>
                                  </div>
                                  {tx.rep_name && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                      👤 المندوب: <strong>{tx.rep_name}</strong> ({tx.rep_code})
                                    </div>
                                  )}
                                  {tx.notes && (
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                                      📝 {tx.notes}
                                    </div>
                                  )}
                                  {!tx.receipt_image && (
                                    <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'rgba(124,58,237,0.5)', fontStyle: 'italic' }}>لا يوجد إيصال مرفق</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other transactions table */}
                      {selectedBankLedger.transactions.filter(tx => tx.payment_method !== 'bank_transfer').length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '1.1rem' }}>💵</span>
                            <strong style={{ color: 'var(--text-secondary)' }}>حركات التحويل النقدي (صرف/إيداع)</strong>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>التاريخ والوقت</th>
                                <th>العملية</th>
                                <th>أثر الرصيد البنكي</th>
                                <th>المبلغ</th>
                                <th>المندوب</th>
                                <th>ملاحظات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedBankLedger.transactions.filter(tx => tx.payment_method !== 'bank_transfer').map((tx) => (
                                <tr key={tx.id}>
                                  <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                                  <td>
                                    <span className={`badge badge-${tx.type}`}>
                                      {tx.type === 'deposit' ? '📥 توريد من البنك' : '📤 صرف للبنك'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge badge-${tx.type === 'withdrawal' ? 'deposit' : 'withdrawal'}`}>
                                      {tx.type === 'withdrawal' ? '📈 زيادة رصيد البنك' : '📉 نقص رصيد البنك'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={tx.type === 'withdrawal' ? 'amount-deposit' : 'amount-withdrawal'}>
                                      {tx.type === 'deposit' ? '-' : ''}
                                      {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                                    </span>
                                  </td>
                                  <td>{tx.rep_name ? `${tx.rep_name} (${tx.rep_code})` : '—'}</td>
                                  <td>{tx.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ALL BANKS TABLE */
              <div className="table-container">
                {banks.length === 0 ? (
                  <div className="no-data-msg">لا يوجد حسابات بنكية مسجلة بالنظام حالياً.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>كود البنك</th>
                        <th>اسم البنك</th>
                        <th>رقم الحساب</th>
                        <th>الرصيد الافتتاحي</th>
                        <th>إجمالي الإيداعات</th>
                        <th>إجمالي السحوبات</th>
                        <th>الرصيد الحالي</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {banks.map((bank) => (
                        <tr key={bank.id}>
                          <td><strong>{bank.code}</strong></td>
                          <td>{bank.name}</td>
                          <td><code>{bank.account_number}</code></td>
                          <td>{Number(bank.initial_balance).toLocaleString()} ج.م</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{Number(bank.total_deposits).toLocaleString()} ج.م</td>
                          <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{Number(bank.total_withdrawals).toLocaleString()} ج.م</td>
                          <td>
                            <span style={{ fontWeight: 800, color: Number(bank.balance) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {Number(bank.balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                onClick={() => handleViewBankLedger(bank.id)}
                              >
                                📂 كشف حساب
                              </button>
                              {currentUser.role === 'manager' && (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                                  onClick={() => handleDeleteBank(bank.id, bank.name)}
                                >
                                  🗑️ حذف
                                </button>
                              )}
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
          
          {/* Add Bank Panel */}
          {currentUser.role === 'manager' && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">➕ إضافة حساب بنكي جديد</h2>
              </div>
            
            {bankError && <div className="alert alert-error">⚠️ {bankError}</div>}
            {bankSuccess && <div className="alert alert-success">✔️ {bankSuccess}</div>}

            <form onSubmit={handleAddBank}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>كود الحساب (مختصر) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" 
                  value={newBank.code}
                  readOnly
                  disabled
                  style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>اسم البنك <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: البنك التجاري الدولي (CIB)"
                  value={newBank.name}
                  onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>رقم الحساب <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: 100055998877"
                  value={newBank.account_number}
                  onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>اسم صاحب الحساب <span style={{ color: 'var(--text-muted)' }}>(اختياري)</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: شركة النور للتجارة"
                  value={newBank.account_name}
                  onChange={(e) => setNewBank({ ...newBank, account_name: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>الفرع <span style={{ color: 'var(--text-muted)' }}>(اختياري)</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: فرع الدقي الرئيسي"
                  value={newBank.branch}
                  onChange={(e) => setNewBank({ ...newBank, branch: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>الرصيد الافتتاحي (ج.م)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  value={newBank.initial_balance}
                  onChange={(e) => setNewBank({ ...newBank, initial_balance: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>حفظ الحساب الجديد</button>
            </form>
            </div>
          )}
        </div>
        </div>
      )}

      {/* PENDING APPROVALS TAB */}
      {activeTab === 'pending-approvals' && currentUser.role === 'manager' && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">📥 طلبات الصرف المعلقة (تحتاج موافقة المدير)</h2>
          </div>
          
          <div className="table-container" style={{ marginTop: '1.5rem' }}>
            {pendingTx.length === 0 ? (
              <div className="no-data-msg">لا توجد طلبات صرف معلقة حالياً.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>تاريخ الطلب</th>
                    <th>اسم المندوب</th>
                    <th>التوكيل</th>
                    <th>نوع الصرف</th>
                    <th>المبلغ المطلوب</th>
                    <th>ملاحظات</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTx.map((tx) => (
                    <tr key={tx.id}>
                      <td>{new Date(tx.date).toLocaleString('ar-EG')}</td>
                      <td>
                        {tx.type === 'company_transfer' ? (
                          <span>🏦 {tx.bank_name} ➔ 🏢 {tx.company_name}</span>
                        ) : tx.rep_name ? (
                          <span>👤 {tx.rep_name} <small style={{ color: 'var(--text-muted)' }}>({tx.rep_code})</small></span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>خزينة مباشرة</span>
                        )}
                      </td>
                      <td>{tx.agency_name ? (<span>🏢 {tx.agency_name} <small style={{ color: 'var(--text-muted)' }}>({tx.agency_code})</small></span>) : '—'}</td>
                      <td>
                        {tx.type === 'exchange' ? (
                          <span className="badge badge-exchange">🔄 تسوية / فك فئات</span>
                        ) : tx.type === 'company_transfer' ? (
                          <span className="badge badge-company-transfer">🏢 حوالة لشركة</span>
                        ) : (
                          <span className="badge badge-withdrawal">
                            {tx.withdrawal_sub_type === 'car' ? '🚗 سيارة' : 
                             tx.withdrawal_sub_type === 'car_gas' ? '⛽ سيارة (جاز)' : 
                             tx.withdrawal_sub_type === 'car_oil' ? '🛢️ سيارة (زيت)' : 
                             tx.withdrawal_sub_type === 'car_other' ? '🔧 سيارة (أخرى)' : 
                             tx.withdrawal_sub_type === 'salary' ? '💼 راتب' : 
                             tx.withdrawal_sub_type === 'commission' ? '💰 عمولة' : 
                             tx.withdrawal_sub_type === 'loan' ? '💸 سلفة' : 
                             tx.withdrawal_sub_type === 'direct_rent' ? '🏢 إيجار' : 
                             tx.withdrawal_sub_type === 'direct_operational' ? '🔧 تشغيل عامة' : 
                             tx.withdrawal_sub_type === 'direct_other' ? '📝 عامة أخرى' : 
                             tx.withdrawal_sub_type === 'other' ? 'صرف عام' : 'صرف'}
                          </span>
                        )}
                      </td>
                      <td className={tx.type === 'exchange' ? 'amount-exchange' : tx.type === 'company_transfer' ? 'amount-company-transfer' : 'amount-withdrawal'}>
                        {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                      </td>
                      <td>{tx.notes || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', background: 'var(--success)', border: 'none', boxShadow: 'none' }}
                            onClick={() => handleApproveTx(tx.id)}
                          >
                            ✅ موافقة
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.2)' }}
                            onClick={() => handleRejectTx(tx.id)}
                          >
                            ❌ رفض
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', backgroundColor: 'rgba(14,165,233,0.08)', color: 'var(--primary)', borderColor: 'rgba(14,165,233,0.2)' }}
                            onClick={() => handlePrintReceipt(tx)}
                            title="طباعة الإيصال"
                          >
                            🖸️
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
      )}

      {/* EDIT TRANSACTION OVERLAY MODAL */}
      {editingTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          direction: 'rtl', padding: '1.5rem'
        }}>
          <div className="panel" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="panel-title">✏️ تعديل حركة مالية</h2>
              <button className="btn btn-secondary" onClick={() => setEditingTx(null)} style={{ padding: '0.3rem 0.6rem' }}>✕ إغلاق</button>
            </div>
            
            {editError && <div className="alert alert-error">⚠️ {editError}</div>}
            {editSuccess && <div className="alert alert-success">✔️ {editSuccess}</div>}
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setEditError('');
              setEditSuccess('');
              
              if ((editingTx.type === 'deposit' || editingTx.type === 'withdrawal') && editingTx.payment_method === 'cash') {
                const d = editingTx.denominations;
                const calc = 
                  (Number(d.denom_200 || 0) * 200) + 
                  (Number(d.denom_100 || 0) * 100) + 
                  (Number(d.denom_50 || 0) * 50) + 
                  (Number(d.denom_20 || 0) * 20) + 
                  (Number(d.denom_10 || 0) * 10) + 
                  (Number(d.denom_5 || 0) * 5) + 
                  (Number(d.denom_1 || 0) * 1);
                if (isNaN(calc) || Math.abs(calc - Number(editingTx.amount)) > 0.01) {
                  const msg = `مجموع الفئات (${(calc || 0).toLocaleString()} ج.م) لا يطابق قيمة المبلغ (${Number(editingTx.amount).toLocaleString()} ج.م)!`;
                  setEditError(msg);
                  alert(msg);
                  return;
                }
              }
              
              try {
                const res = await fetch(`/api/transactions/${editingTx.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    amount: Number(editingTx.amount),
                    notes: editingTx.notes,
                    withdrawal_sub_type: editingTx.withdrawal_sub_type,
                    rep_id: editingTx.rep_id,
                    bank_id: editingTx.bank_id,
                    agency_id: editingTx.agency_id,
                    denominations: editingTx.type === 'deposit' && editingTx.payment_method === 'cash' ? editingTx.denominations : null
                  })
                });
                const data = await res.json();
                if (res.ok) {
                  setEditSuccess('تم تعديل العملية بنجاح!');
                  setTimeout(() => {
                    setEditingTx(null);
                    loadDashboard();
                    loadTransactions();
                    loadCarExpenses();
                    loadBanks();
                    loadAgencies();
                    loadReps();
                  }, 1000);
                } else {
                  setEditError(data.error || 'حدث خطأ أثناء تعديل العملية');
                }
              } catch (err) {
                setEditError('تعذر الاتصال بالسيرفر');
              }
            }}>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>المبلغ (ج.م) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingTx.amount}
                  onChange={(e) => setEditingTx({ ...editingTx, amount: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              {editingTx.type === 'withdrawal' && (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>نوع الصرف <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select
                      value={editingTx.withdrawal_sub_type && editingTx.withdrawal_sub_type.startsWith('car') ? 'car' : (editingTx.withdrawal_sub_type || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'car') {
                          setEditingTx({ ...editingTx, withdrawal_sub_type: 'car_gas' });
                        } else {
                          setEditingTx({ ...editingTx, withdrawal_sub_type: val });
                        }
                      }}
                      required
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">اختر نوع الصرف...</option>
                      {(() => {
                        if (!editingTx.rep_id) {
                          return [
                            { value: 'direct_rent', label: '🏢 الإيجار' },
                            { value: 'direct_operational', label: '🔧 مصاريف تشغيل عامة' },
                            { value: 'direct_other', label: '📝 مصاريف عامة أخرى' }
                          ];
                        }
                        const rep = reps.find(r => r.id === editingTx.rep_id);
                        if (rep && (rep.classification === 'retail_rep' || rep.classification === 'wholesale_rep')) {
                          return [
                            { value: 'car', label: '🚗 مصاريف سيارات' },
                            { value: 'salary', label: '💵 راتب' },
                            { value: 'commission', label: '💰 عمولة' },
                            { value: 'loan', label: '💸 سلفة' },
                            { value: 'other', label: '📝 أخرى' }
                          ];
                        }
                        return [
                          { value: 'salary', label: '💵 راتب' },
                          { value: 'loan', label: '💸 سلفة' },
                          { value: 'commission', label: '💰 عمولة / مكافآت' },
                          { value: 'other', label: '📝 صرف عام / أخرى' }
                        ];
                      })().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {editingTx.withdrawal_sub_type && editingTx.withdrawal_sub_type.startsWith('car') && (
                    <div className="form-group" style={{ marginBottom: '1rem', paddingRight: '1rem', borderRight: '3px solid var(--primary)' }}>
                      <label>بند مصروفات السيارة <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <select
                        value={editingTx.withdrawal_sub_type}
                        onChange={(e) => setEditingTx({ ...editingTx, withdrawal_sub_type: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      >
                        <option value="car_gas">جاز</option>
                        <option value="car_oil">زيت</option>
                        <option value="car_other">مصاريف أخرى</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>ملاحظات</label>
                <textarea
                  rows="3"
                  value={editingTx.notes || ''}
                  onChange={(e) => setEditingTx({ ...editingTx, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              {(editingTx.type === 'deposit' || editingTx.type === 'withdrawal') && editingTx.payment_method === 'cash' && (
                <div className="denom-section" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="denom-section-title">💵 فئات المبالغ النقدية</div>
                  <div className="denom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[200, 100, 50, 20, 10, 5, 1].map(denom => (
                      <div className="denom-input-group" key={denom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span className="denom-label" style={{ minWidth: '50px' }}>{denom} ج.م</span>
                        <input
                          type="number"
                          min="0"
                          value={editingTx.denominations[`denom_${denom}`] || 0}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setEditingTx({
                              ...editingTx,
                              denominations: {
                                ...editingTx.denominations,
                                [`denom_${denom}`]: val
                              }
                            });
                          }}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>💾 حفظ التعديلات</button>
            </form>
          </div>
        </div>
      )}

      {/* DISBURSE TRANSACTION OVERLAY MODAL */}
      {disbursingTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          direction: 'rtl', padding: '1.5rem'
        }}>
          <div className="panel" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="panel-title">💵 إتمام عملية الصرف الفعلي</h2>
              <button className="btn btn-secondary" onClick={() => setDisbursingTx(null)} style={{ padding: '0.3rem 0.6rem' }}>✕ إغلاق</button>
            </div>
            
            {disburseError && <div className="alert alert-error">⚠️ {disburseError}</div>}
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                <div><strong>المستلم:</strong> {disbursingTx.rep_name || 'خزينة مباشرة'} ({disbursingTx.rep_code || '-'})</div>
                <div><strong>المبلغ المطلوب:</strong> <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{Number(disbursingTx.amount).toLocaleString()} ج.م</span></div>
                <div style={{ gridColumn: 'span 2' }}><strong>بند الصرف:</strong> {getWithdrawalSubTypes().find(o => o.value === disbursingTx.withdrawal_sub_type)?.label || disbursingTx.withdrawal_sub_type || 'عام'}</div>
                {disbursingTx.notes && <div style={{ gridColumn: 'span 2' }}><strong>الملاحظات:</strong> {disbursingTx.notes}</div>}
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setDisburseError('');
              
              const calc = 
                (Number(disburseDenominations.denom_200 || 0) * 200) + 
                (Number(disburseDenominations.denom_100 || 0) * 100) + 
                (Number(disburseDenominations.denom_50 || 0) * 50) + 
                (Number(disburseDenominations.denom_20 || 0) * 20) + 
                (Number(disburseDenominations.denom_10 || 0) * 10) + 
                (Number(disburseDenominations.denom_5 || 0) * 5) + 
                (Number(disburseDenominations.denom_1 || 0) * 1);
              if (isNaN(calc) || Math.abs(calc - Number(disbursingTx.amount)) > 0.01) {
                const msg = `مجموع الفئات (${(calc || 0).toLocaleString()} ج.م) لا يطابق قيمة المبلغ المطلوبة (${Number(disbursingTx.amount).toLocaleString()} ج.م)!`;
                setDisburseError(msg);
                return;
              }
              
              try {
                const res = await fetch(`/api/transactions/${disbursingTx.id}/disburse`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ denominations: disburseDenominations })
                });
                const data = await res.json();
                if (res.ok) {
                  setDisbursingTx(null);
                  loadDashboard();
                  loadTransactions();
                  loadCarExpenses();
                } else {
                  setDisburseError(data.error || 'حدث خطأ أثناء إتمام الصرف');
                }
              } catch (err) {
                setDisburseError('تعذر الاتصال بالسيرفر');
              }
            }}>
              
              <div className="denom-section" style={{ marginBottom: '1.5rem', background: 'transparent', border: 'none', padding: 0 }}>
                <div className="denom-section-title" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>💵 توزيع الفئات النقدية للتسليم</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => {
                      let remaining = parseFloat(disbursingTx.amount) || 0;
                      const breakdown = { denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, denom_10: 0, denom_5: 0, denom_1: 0 };
                      breakdown.denom_200 = Math.floor(remaining / 200); remaining %= 200;
                      breakdown.denom_100 = Math.floor(remaining / 100); remaining %= 100;
                      breakdown.denom_50 = Math.floor(remaining / 50); remaining %= 50;
                      breakdown.denom_20 = Math.floor(remaining / 20); remaining %= 20;
                      breakdown.denom_10 = Math.floor(remaining / 10); remaining %= 10;
                      breakdown.denom_5 = Math.floor(remaining / 5); remaining %= 5;
                      breakdown.denom_1 = Math.floor(remaining);
                      setDisburseDenominations(breakdown);
                    }}
                  >
                    💡 ملء تلقائي للفئات
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                    <div key={denom} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{denom} ج.م</span>
                      <input 
                        type="number" 
                        min="0"
                        value={disburseDenominations[`denom_${denom}`] || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setDisburseDenominations(prev => ({
                            ...prev,
                            [`denom_${denom}`]: val
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculator Summary */}
              {(() => {
                const totalCalculated = 
                  (Number(disburseDenominations.denom_200 || 0) * 200) + 
                  (Number(disburseDenominations.denom_100 || 0) * 100) + 
                  (Number(disburseDenominations.denom_50 || 0) * 50) + 
                  (Number(disburseDenominations.denom_20 || 0) * 20) + 
                  (Number(disburseDenominations.denom_10 || 0) * 10) + 
                  (Number(disburseDenominations.denom_5 || 0) * 5) + 
                  (Number(disburseDenominations.denom_1 || 0) * 1);
                const diff = Number(disbursingTx.amount) - totalCalculated;
                const isMatch = Math.abs(diff) < 0.01;
                
                return (
                  <div style={{
                    padding: '1rem', borderRadius: '8px', 
                    background: isMatch ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                    border: '1px solid',
                    borderColor: isMatch ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                    fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>إجمالي الفئات المدخلة:</span>
                      <strong style={{ color: isMatch ? 'var(--success)' : 'var(--danger)' }}>
                        {totalCalculated.toLocaleString()} ج.م
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>المتبقي:</span>
                      <strong style={{ color: isMatch ? 'var(--success)' : 'var(--danger)' }}>
                        {diff.toLocaleString()} ج.م
                      </strong>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '0.4rem', fontWeight: 'bold', color: isMatch ? '#10b981' : '#ef4444' }}>
                      {isMatch ? '✅ الفئات مطابقة تماماً للمبلغ المطلوب' : '❌ الفئات لا تطابق المبلغ المطلوب'}
                    </div>
                  </div>
                );
              })()}
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: 'linear-gradient(135deg, var(--success), var(--success-hover))' }}>
                💵 تأكيد صرف المبلغ الفعلي وتسليمه
              </button>
            </form>
          </div>
        </div>
      )}

      {/* USERS MANAGEMENT TAB */}
      {activeTab === 'users' && currentUser.role === 'manager' && (
        <div className="grid-2col" style={{ gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Users List Panel */}
          <div className="panel" style={{ width: '100%' }}>
            <div className="panel-header">
              <h2 className="panel-title">👥 إدارة مستخدمي النظام</h2>
            </div>
            
            <div className="table-container" style={{ marginTop: '1.5rem' }}>
              {usersList.length === 0 ? (
                <div className="no-data-msg">لا يوجد مستخدمين مسجلين حالياً.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>اسم المستخدم</th>
                      <th>الدور</th>
                      <th>التوكيل المخصص</th>
                      <th>تاريخ الإنشاء</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((usr) => (
                      <tr key={usr.id}>
                        <td><strong>{usr.username}</strong></td>
                        <td>
                          <span className={`badge badge-${usr.role === 'manager' ? 'deposit' : 'wholesale'}`}>
                            {usr.role === 'manager' ? '👑 مدير' : '👤 محاسب'}
                          </span>
                        </td>
                        <td>
                          {usr.role === 'accountant' ? (
                            usr.agency_name ? (
                              <span>🏢 {usr.agency_name} <small style={{ color: 'var(--text-muted)' }}>({usr.agency_code})</small></span>
                            ) : (
                              <em style={{ color: 'var(--danger)' }}>كل التوكيلات (صلاحية عامة)</em>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>{new Date(usr.created_at || new Date()).toLocaleDateString('ar-EG')}</td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setEditingUser({
                                id: usr.id,
                                username: usr.username,
                                password: '', // Clear so we don't display password hash, leaving it optional
                                role: usr.role,
                                assigned_agency_id: usr.assigned_agency_id || ''
                              });
                              setEditUserError('');
                              setEditUserSuccess('');
                            }}
                          >
                            ✏️ تعديل
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
          {/* Add User Panel */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">➕ إضافة مستخدم جديد</h2>
            </div>
            
            {userError && <div className="alert alert-error">⚠️ {userError}</div>}
            {userSuccess && <div className="alert alert-success">✔️ {userSuccess}</div>}
            
            <form onSubmit={handleAddUser}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>اسم المستخدم <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" 
                  placeholder="مثال: acc_cairo"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>كلمة المرور <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="password" 
                  placeholder="أدخل كلمة مرور قوية..."
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>الدور <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'var(--font-cairo)' }}
                >
                  <option value="accountant">👤 محاسب (صلاحيات محدودة)</option>
                  <option value="manager">👑 مدير (صلاحيات كاملة)</option>
                </select>
              </div>
              
              {newUser.role === 'accountant' && (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>التوكيل المسؤول عنه المحاسب</label>
                  <select 
                    value={newUser.assigned_agency_id}
                    onChange={(e) => setNewUser({ ...newUser, assigned_agency_id: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'var(--font-cairo)' }}
                  >
                    <option value="">كل التوكيلات (صلاحية عامة)</option>
                    {agencies.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                    سيتم تصفية المعاملات والتقارير والمناديب وتوريدات هذا المحاسب للتوكيل المختار فقط.
                  </small>
                </div>
              )}
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>حفظ المستخدم الجديد</button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER OVERLAY MODAL */}
      {editingUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          direction: 'rtl', padding: '1.5rem'
        }}>
          <div className="panel" style={{ width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="panel-title">✏️ تعديل بيانات المستخدم</h2>
              <button className="btn btn-secondary" onClick={() => setEditingUser(null)} style={{ padding: '0.3rem 0.6rem' }}>✕ إغلاق</button>
            </div>
            
            {editUserError && <div className="alert alert-error">⚠️ {editUserError}</div>}
            {editUserSuccess && <div className="alert alert-success">✔️ {editUserSuccess}</div>}
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setEditUserError('');
              setEditUserSuccess('');
              
              if (!editingUser.username || !editingUser.role) {
                setEditUserError('اسم المستخدم والدور مطلوبان');
                return;
              }
              
              try {
                const res = await fetch(`/api/users/${editingUser.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username: editingUser.username,
                    password: editingUser.password,
                    role: editingUser.role,
                    assigned_agency_id: editingUser.role === 'accountant' ? (editingUser.assigned_agency_id || null) : null
                  })
                });
                const data = await res.json();
                if (res.ok) {
                  setEditUserSuccess('تم تعديل بيانات المستخدم بنجاح!');
                  setTimeout(() => {
                    setEditingUser(null);
                    loadUsers();
                  }, 1000);
                } else {
                  setEditUserError(data.error || 'حدث خطأ أثناء تعديل بيانات المستخدم');
                }
              } catch (err) {
                setEditUserError('تعذر الاتصال بالسيرفر');
              }
            }}>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>اسم المستخدم <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" 
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>كلمة المرور الجديدة <span style={{ color: 'var(--text-muted)' }}>(اختياري)</span></label>
                <input 
                  type="password" 
                  placeholder="اتركها فارغة للاحتفاظ بكلمة المرور الحالية"
                  value={editingUser.password}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>الدور <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select 
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'var(--font-cairo)' }}
                >
                  <option value="accountant">👤 محاسب (صلاحيات محدودة)</option>
                  <option value="manager">👑 مدير (صلاحيات كاملة)</option>
                </select>
              </div>
              
              {editingUser.role === 'accountant' && (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>التوكيل المسؤول عنه المحاسب</label>
                  <select 
                    value={editingUser.assigned_agency_id}
                    onChange={(e) => setEditingUser({ ...editingUser, assigned_agency_id: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'var(--font-cairo)' }}
                  >
                    <option value="">كل التوكيلات (صلاحية عامة)</option>
                    {agencies.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                    ))}
                  </select>
                </div>
              )}
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>💾 حفظ التعديلات</button>
            </form>
          </div>
        </div>
      )}

      {/* DAILY REPORT TAB */}
      {activeTab === 'daily-report' && currentUser.role === 'manager' && (
        <div className="panel" style={{ width: '100%' }}>
          <div className="panel-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h2 className="panel-title">📋 تقرير حركة الخزينة والمصارف اليومي</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ whiteSpace: 'nowrap' }}>اختر التاريخ:</label>
                <input 
                  type="date" 
                  value={dailyReportDate} 
                  onChange={(e) => {
                    setDailyReportDate(e.target.value);
                    handleFetchDailyReport(e.target.value);
                  }}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'var(--font-cairo)' }}
                />
              </div>
              <button className="btn btn-secondary" onClick={() => handleFetchDailyReport()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🔄 تحديث</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (!dailyReportData) return;
                  const d = dailyReportData;
                  const reportDate = new Date(d.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                  const safeSummaryRows = `
                    <tr>
                      <td>${d.safeSummary.openingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                      <td style="color:green;font-weight:bold">+${d.safeSummary.deposits.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                      <td style="color:red;font-weight:bold">-${d.safeSummary.withdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                      <td style="font-weight:bold">${d.safeSummary.closingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                    </tr>`;

                  const bankRows = d.banksSummary.map(bank => `
                    <tr>
                      <td style="font-weight:bold">${bank.code}</td>
                      <td>${bank.name}</td>
                      <td>${bank.account_number}</td>
                      <td>${bank.openingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                      <td style="color:green">+${bank.deposits.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                      <td style="color:red">-${bank.withdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                      <td style="font-weight:bold">${bank.closingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                    </tr>`).join('');

                  const txRows = d.transactions.length === 0
                    ? `<tr><td colspan="7" style="text-align:center;padding:8px">لا توجد عمليات مسجلة في هذا اليوم.</td></tr>`
                    : d.transactions.map(tx => {
                        const subTypeLabel = tx.withdrawal_sub_type === 'car' ? 'مصاريف سيارات'
                          : tx.withdrawal_sub_type === 'car_gas' ? 'جاز سيارات'
                          : tx.withdrawal_sub_type === 'car_oil' ? 'زيت/صيانة'
                          : tx.withdrawal_sub_type === 'salary' ? 'رواتب'
                          : tx.withdrawal_sub_type === 'commission' ? 'عمولات'
                          : tx.withdrawal_sub_type === 'loan' ? 'سلفة'
                          : tx.withdrawal_sub_type === 'direct_rent' ? 'إيجار'
                          : tx.withdrawal_sub_type === 'direct_operational' ? 'تشغيل عامة'
                          : tx.withdrawal_sub_type ? 'أخرى' : '';
                        const typeLabel = tx.type === 'deposit' ? 'وارد' : tx.type === 'company_transfer' ? 'حوالة لشركة' : 'منصرف';
                        const details = [
                          tx.type === 'company_transfer' && tx.company_name ? `تحويل لشركة: ${tx.company_name}` : '',
                          tx.rep_name ? `المندوب: ${tx.rep_name}` : '',
                          subTypeLabel ? `(بند: ${subTypeLabel})` : '',
                          tx.notes ? `- ${tx.notes}` : ''
                        ].filter(Boolean).join(' ');
                        const payMethod = tx.bank_name ? `بنك: ${tx.bank_name}` : 'نقدي بالخزينة';
                        const txTime = new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                        const txColor = tx.type === 'deposit' ? 'color:#166534' : tx.type === 'company_transfer' ? 'color:#0369a1' : 'color:#991b1b';
                        return `<tr>
                          <td>TX-${String(tx.id).padStart(6, '0')}</td>
                          <td>${txTime}</td>
                          <td style="${txColor};font-weight:bold">${typeLabel}</td>
                          <td style="text-align:right">${details || '—'}</td>
                          <td>${payMethod}</td>
                          <td style="font-weight:bold">${Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                          <td>${tx.creator_name || 'أمين الخزينة'}</td>
                        </tr>`;
                      }).join('');

                  const tableStyle = `width:100%;border-collapse:collapse;margin-bottom:8mm;font-size:9pt`;
                  const thStyle = `border:1px solid #333;padding:3mm;background:#e8e8e8;font-weight:bold;text-align:center`;
                  const tdStyle = `border:1px solid #555;padding:2.5mm;text-align:center`;

                  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<title>التقرير اليومي - ${reportDate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', 'Tahoma', sans-serif; direction: rtl; background: #fff; color: #000; padding: 12mm 15mm; font-size: 10pt; line-height: 1.6; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 2mm; }
  h3 { font-size: 11pt; border-right: 4px solid #333; padding-right: 3mm; margin-bottom: 4mm; margin-top: 8mm; }
  table { ${tableStyle} }
  th { ${thStyle} }
  td { ${tdStyle} }
  .header { text-align:center; border-bottom: 3px double #000; padding-bottom: 5mm; margin-bottom: 8mm; }
  .sigs { display:flex; gap: 20mm; margin-top: 20mm; }
  .sig { flex: 1; text-align: center; font-weight: bold; font-size: 10pt; }
  .sig-line { border-bottom: 1px solid #000; margin-top: 15mm; width: 80%; margin-inline: auto; }
  @media print { @page { size: A4 portrait; margin: 10mm 15mm; } }
</style>
</head>
<body>
<div class="header">
  <h1>تقرير حركة الخزينة والمصارف اليومي التفصيلي</h1>
  <p style="font-size:11pt">تاريخ التقرير: <strong>${reportDate}</strong></p>
</div>

<h3>أولاً: ملخص حركة الخزينة النقدية (الخزنة الفعلية)</h3>
<table>
  <thead><tr><th>الرصيد الافتتاحي (بداية اليوم)</th><th>إجمالي الإيداعات (الوارد)</th><th>إجمالي الصرفيات (المنصرف)</th><th>الرصيد الختامي (نهاية اليوم)</th></tr></thead>
  <tbody>${safeSummaryRows}</tbody>
</table>

<h3>ثانياً: ملخص حركة الحسابات البنكية والمصارف</h3>
<table>
  <thead><tr><th>كود البنك</th><th>اسم البنك</th><th>رقم الحساب</th><th>الرصيد الافتتاحي</th><th>إجمالي الوارد</th><th>إجمالي المنصرف</th><th>الرصيد الختامي</th></tr></thead>
  <tbody>${bankRows}</tbody>
</table>

<h3>ثالثاً: كشف العمليات اليومي المفصل</h3>
<table>
  <thead><tr><th>رقم الحركة</th><th>الوقت</th><th>النوع</th><th>التفاصيل والمستفيد</th><th>طريقة الدفع / الحساب</th><th>المبلغ</th><th>المحاسب</th></tr></thead>
  <tbody>${txRows}</tbody>
</table>

<div class="sigs">
  <div class="sig"><p>توقيع المحاسب المستلم</p><div class="sig-line"></div></div>
  <div class="sig"><p>توقيع المراجع المالي</p><div class="sig-line"></div></div>
  <div class="sig"><p>توقيع المدير العام</p><div class="sig-line"></div></div>
</div>
</body>
</html>`;

                  const win = window.open('', '_blank', 'width=900,height=700');
                  win.document.write(html);
                  win.document.close();
                  win.focus();
                  setTimeout(() => { win.print(); }, 500);
                }} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))' }}
              >
                🖨️ طباعة التقرير (A4)
              </button>
            </div>
          </div>

          {dailyReportLoading && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ display: 'inline-block', width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>جاري جلب البيانات وتوليد التقرير المالي...</p>
            </div>
          )}

          {dailyReportError && (
            <div className="alert alert-error" style={{ margin: '1.5rem 0' }}>⚠️ {dailyReportError}</div>
          )}

          {!dailyReportLoading && !dailyReportError && dailyReportData && (
            <div className="report-preview-container" style={{ marginTop: '1.5rem', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px double var(--border-color)', paddingBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.5rem 0' }}>تقرير حركة الخزينة والمصارف اليومي التفصيلي</h1>
                <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>تاريخ التقرير: <strong>{new Date(dailyReportData.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
              </div>

              <div className="report-section" style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderRight: '4px solid var(--primary)', paddingRight: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>💵 ملخص الخزينة النقدية (الخزنة الفعلية)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>الرصيد الافتتاحي (بداية اليوم):</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem' }}>{dailyReportData.safeSummary.openingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>إجمالي الوارد (الإيداعات النقدية):</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.25rem' }}>+{dailyReportData.safeSummary.deposits.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>إجمالي المنصرف (الصرفيات النقدية):</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.25rem' }}>-{dailyReportData.safeSummary.withdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>الرصيد الختامي (نهاية اليوم):</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>{dailyReportData.safeSummary.closingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</div>
                  </div>
                </div>
              </div>

              <div className="report-section" style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderRight: '4px solid var(--info)', paddingRight: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>🏦 ملخص الحسابات البنكية والمصارف</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>كود البنك</th>
                        <th>اسم الحساب البنكي</th>
                        <th>رقم الحساب</th>
                        <th>الرصيد الافتتاحي</th>
                        <th>إجمالي الوارد</th>
                        <th>إجمالي المنصرف</th>
                        <th>الرصيد الختامي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReportData.banksSummary.map(bank => (
                        <tr key={bank.id}>
                          <td><strong>{bank.code}</strong></td>
                          <td>{bank.name}</td>
                          <td>{bank.account_number}</td>
                          <td>{bank.openingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                          <td style={{ color: 'var(--success)' }}>+{bank.deposits.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                          <td style={{ color: 'var(--danger)' }}>-{bank.withdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                          <td><strong style={{ color: 'var(--info)' }}>{bank.closingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="report-section" style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderRight: '4px solid var(--warning)', paddingRight: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>📝 كشف العمليات التفصيلي خلال اليوم</h3>
                <div className="table-container">
                  {dailyReportData.transactions.length === 0 ? (
                    <div className="no-data-msg">لا توجد عمليات مسجلة في هذا اليوم.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>رقم الحركة</th>
                          <th>الوقت</th>
                          <th>نوع العملية</th>
                          <th>التفاصيل والمستفيد</th>
                          <th>طريقة الدفع / الحساب</th>
                          <th>المبلغ</th>
                          <th>المحاسب</th>
                          <th>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyReportData.transactions.map(tx => (
                          <tr key={tx.id}>
                            <td><code>TX-{String(tx.id).padStart(6, '0')}</code></td>
                            <td>{new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>
                              <span className={`badge ${
                                tx.type === 'deposit' ? 'badge-success' : tx.type === 'company_transfer' ? 'badge-company-transfer' : 'badge-danger'
                              }`}>
                                {tx.type === 'deposit' ? 'وارد' : tx.type === 'company_transfer' ? 'حوالة شركة' : 'منصرف'}
                              </span>
                            </td>
                            <td>
                              {tx.type === 'company_transfer' && (
                                <div>تحويل لشركة: <strong>{tx.company_name}</strong></div>
                              )}
                              {tx.rep_name && (
                                <div>المندوب: <strong>{tx.rep_name}</strong></div>
                              )}
                              {tx.withdrawal_sub_type && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  بند: {tx.withdrawal_sub_type === 'car' ? 'مصاريف سيارات'
                                    : tx.withdrawal_sub_type === 'car_gas' ? 'مصاريف سيارات (جاز)'
                                    : tx.withdrawal_sub_type === 'salary' ? 'رواتب وأجور'
                                    : tx.withdrawal_sub_type === 'commission' ? 'عمولات'
                                    : tx.withdrawal_sub_type === 'loan' ? 'سلفة'
                                    : 'أخرى'}
                                </div>
                              )}
                              {tx.notes && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>({tx.notes})</div>}
                            </td>
                            <td>
                              {tx.bank_name ? `🏦 ${tx.bank_name}` : '💵 نقدي بالخزينة'}
                            </td>
                            <td>
                              <strong className={tx.type === 'deposit' ? 'amount-deposit' : tx.type === 'company_transfer' ? 'amount-company-transfer' : 'amount-withdrawal'}>
                                {tx.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.m
                              </strong>
                            </td>
                            <td>{tx.creator_name || 'أمين الخزينة'}</td>
                            <td>
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: tx.status === 'disbursed' || tx.status === 'approved' || tx.status === null ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                color: tx.status === 'disbursed' || tx.status === 'approved' || tx.status === null ? '#22c55e' : '#eab308'
                              }}>
                                {tx.status === 'disbursed' || tx.status === 'approved' || tx.status === null ? 'مكتمل' : 'قيد الانتظار'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', marginTop: '4rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }} className="no-print">
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>توقيع المحاسب المستلم:</p>
                  <p style={{ marginTop: '3rem', borderBottom: '1px dashed var(--text-secondary)', width: '70%', marginInline: 'auto' }}></p>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>توقيع المراجع المالي:</p>
                  <p style={{ marginTop: '3rem', borderBottom: '1px dashed var(--text-secondary)', width: '70%', marginInline: 'auto' }}></p>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>توقيع المدير العام:</p>
                  <p style={{ marginTop: '3rem', borderBottom: '1px dashed var(--text-secondary)', width: '70%', marginInline: 'auto' }}></p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRINTABLE RECEIPT TEMPLATE */}
      {printingTx && (
        <div className="receipt-print-wrapper">
          {/* ===== HEADER ===== */}
          <div className="receipt-header">
            <h1 className="receipt-title">خزينة التوريد والصرف</h1>
            <p className="receipt-subtitle">الاحلام للتوكيلات التجاريه</p>
            <div className="receipt-divider"></div>
            <strong style={{ fontSize: '11pt', display: 'block', margin: '2mm 0', textAlign: 'center' }}>
              {printingTx.type === 'deposit'
                ? (printingTx.payment_method === 'bank_transfer' ? 'إيصال إيداع تحويل بنكي' : 'إيصال توريد نقدية (وارد)')
                : printingTx.type === 'company_transfer'
                  ? 'إيصال تحويل بنكي لشركة (حوالة)'
                  : 'إيصال صرف نقدية (منصرف)'}
            </strong>
            <div style={{ textAlign: 'center', marginTop: '1mm' }}>
              <span className="receipt-status-badge">
                {printingTx.type === 'deposit' ? '✔ مكتمل'
                  : printingTx.type === 'company_transfer' ? (printingTx.status === 'approved' ? '✔ مكتمل - تم التحويل' : '⏳ قيد المراجعة')
                  : (printingTx.status === 'disbursed' ? '✔ مكتمل - تم الصرف الفعلي'
                     : printingTx.status === 'approved' ? '✓ معتمد - بانتظار التسليم'
                     : printingTx.status === 'pending' ? '⏳ قيد المراجعة'
                     : '✔ مكتمل')}
              </span>
            </div>
          </div>

          {/* ===== META INFO ===== */}
          <div className="receipt-meta">
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">رقم الإيصال:</span>
              <span className="receipt-meta-value">TX-{String(printingTx.id).padStart(6, '0')}</span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">التاريخ والوقت:</span>
              <span className="receipt-meta-value">{new Date(printingTx.date).toLocaleString('ar-EG')}</span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">نوع العملية:</span>
              <span className="receipt-meta-value">
                {printingTx.type === 'deposit' ? 'توريد (دخول أموال)' : printingTx.type === 'company_transfer' ? 'تحويل لشركة (حوالة)' : 'صرف (خروج أموال)'}
              </span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">طريقة الدفع:</span>
              <span className="receipt-meta-value">
                {printingTx.type === 'company_transfer' || printingTx.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقدي بالخزينة'}
              </span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">المحاسب:</span>
              <span className="receipt-meta-value">{printingTx.creator_name || 'أمين الخزينة'}</span>
            </div>
            {printingTx.approver_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">اعتماد (المدير):</span>
                <span className="receipt-meta-value">{printingTx.approver_name}</span>
              </div>
            )}
            {printingTx.rep_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">المندوب:</span>
                <span className="receipt-meta-value">
                  {printingTx.rep_name}{printingTx.rep_code ? ` (${printingTx.rep_code})` : ''}
                </span>
              </div>
            )}
            {printingTx.agency_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">التوكيل:</span>
                <span className="receipt-meta-value">
                  {printingTx.agency_name}{printingTx.agency_code ? ` (${printingTx.agency_code})` : ''}
                </span>
              </div>
            )}
            {printingTx.supervisor_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">المشرف:</span>
                <span className="receipt-meta-value">
                  {printingTx.supervisor_name}{printingTx.supervisor_code ? ` (${printingTx.supervisor_code})` : ''}
                </span>
              </div>
            )}
            {printingTx.bank_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">الحساب البنكي:</span>
                <span className="receipt-meta-value">
                  {printingTx.bank_name}{printingTx.bank_code ? ` (${printingTx.bank_code})` : ''}
                </span>
              </div>
            )}
            {printingTx.type === 'company_transfer' && printingTx.company_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">الشركة المستلمة:</span>
                <span className="receipt-meta-value">
                  {printingTx.company_name}{printingTx.company_code ? ` (${printingTx.company_code})` : ''}
                </span>
              </div>
            )}
            {printingTx.type === 'withdrawal' && printingTx.withdrawal_sub_type && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">بند الصرف:</span>
                <span className="receipt-meta-value">
                  {printingTx.withdrawal_sub_type === 'car' ? 'مصاريف سيارات'
                    : printingTx.withdrawal_sub_type === 'car_gas' ? 'مصاريف سيارات (جاز)'
                    : printingTx.withdrawal_sub_type === 'car_oil' ? 'مصاريف سيارات (زيت)'
                    : printingTx.withdrawal_sub_type === 'car_other' ? 'مصاريف سيارات (مصاريف أخرى)'
                    : printingTx.withdrawal_sub_type === 'salary' ? 'رواتب وأجور'
                    : printingTx.withdrawal_sub_type === 'commission' ? 'عمولات / مكافآت'
                    : printingTx.withdrawal_sub_type === 'loan' ? 'سلفة'
                    : printingTx.withdrawal_sub_type === 'direct_rent' ? 'إيجار'
                    : printingTx.withdrawal_sub_type === 'direct_operational' ? 'مصاريف تشغيل عامة'
                    : printingTx.withdrawal_sub_type === 'direct_other' ? 'مصاريف عامة أخرى'
                    : printingTx.withdrawal_sub_type === 'other' ? 'صرف عام / أخرى'
                    : printingTx.withdrawal_sub_type}
                </span>
              </div>
            )}
          </div>

          {/* ===== AMOUNT BOX ===== */}
          <div className="receipt-amount-section">
            <div className="receipt-amount-title">إجمالي المبلغ</div>
            <div className="receipt-amount-value">
              {Number(printingTx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
            </div>
            <div className="receipt-amount-text">
              فقط وقدره: {(() => {
                const pounds = Math.floor(Number(printingTx.amount));
                const piasters = Math.round((Number(printingTx.amount) - pounds) * 100);
                return `${pounds.toLocaleString('ar-EG')} جنيه مصري${piasters > 0 ? ` و${piasters.toLocaleString('ar-EG')} قرشاً` : ''} لا غير`;
              })()}
            </div>
          </div>

          {/* ===== DENOMINATIONS TABLE ===== */}
          {printingTx.type === 'deposit' && printingTx.payment_method !== 'bank_transfer' &&
            [200, 100, 50, 20, 10, 5, 1].some(d => (printingTx[`denom_${d}`] || 0) > 0) && (
            <div>
              <div style={{ fontSize: '8.5pt', fontWeight: 800, marginBottom: '1.5mm' }}>
                تفاصيل فئات الأوراق النقدية المودعة:
              </div>
              <table className="receipt-table">
                <thead>
                  <tr>
                    <th>الفئة</th>
                    <th>العدد</th>
                    <th>القيمة الإجمالية</th>
                  </tr>
                </thead>
                <tbody>
                  {[200, 100, 50, 20, 10, 5, 1].map(denom => {
                    const count = printingTx[`denom_${denom}`] || 0;
                    if (count > 0) {
                      return (
                        <tr key={denom}>
                          <td>{denom} ج.م</td>
                          <td>{count.toLocaleString('ar-EG')}</td>
                          <td>{(denom * count).toLocaleString('ar-EG')} ج.م</td>
                        </tr>
                      );
                    }
                    return null;
                  })}
                  <tr>
                    <td style={{ fontWeight: 900, borderTop: '2px solid #000' }}>الإجمالي</td>
                    <td style={{ fontWeight: 900, borderTop: '2px solid #000' }}>
                      {[200, 100, 50, 20, 10, 5, 1]
                        .reduce((sum, d) => sum + (printingTx[`denom_${d}`] || 0), 0)
                        .toLocaleString('ar-EG')}
                    </td>
                    <td style={{ fontWeight: 900, borderTop: '2px solid #000' }}>
                      {Number(printingTx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ===== NOTES ===== */}
          {printingTx.notes && (
            <div className="receipt-notes">
              <strong>ملاحظات:</strong>
              {printingTx.notes}
            </div>
          )}

          {/* ===== SIGNATURE LINES ===== */}
          <div className="receipt-signatures">
            <div className="signature-box">
              توقيع المندوب / المستلم
            </div>
            <div className="signature-box">
              توقيع أمين الخزينة
            </div>
          </div>

          {/* ===== FOOTER ===== */}
          <div className="receipt-footer">
            <p>شكراً لتعاملكم معنا</p>
            <p style={{ marginTop: '0.5mm' }}>نظام إدارة الخزينة الذكي — Cash Safe</p>
          </div>
        </div>
      )}

      {/* A4 DAILY REPORT PRINTABLE */}
      {dailyReportData && (
        <div className="daily-report-print-wrapper">
          <div style={{ textAlign: 'center', marginBottom: '15mm', borderBottom: '3px double #000', paddingBottom: '5mm' }}>
            <h1 style={{ fontSize: '20pt', fontWeight: 900, margin: '2mm 0' }}>تقرير حركة الخزينة والمصارف اليومي التفصيلي</h1>
            <p style={{ fontSize: '11pt', margin: 0 }}>تاريخ التقرير: <strong>{new Date(dailyReportData.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
          </div>

          <div style={{ marginBottom: '10mm' }}>
            <h3 style={{ borderRight: '4px solid #000', paddingRight: '2mm', marginBottom: '3mm', fontSize: '12pt', fontWeight: 800 }}>💵 أولاً: ملخص حركة الخزينة النقدية (الخزنة الفعلية)</h3>
            <table className="report-print-table">
              <thead>
                <tr>
                  <th>الرصيد الافتتاحي (بداية اليوم)</th>
                  <th>إجمالي الإيداعات (الوارد)</th>
                  <th>إجمالي الصرفيات (المنصرف)</th>
                  <th>الرصيد الختامي (نهاية اليوم)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ textAlign: 'center' }}>
                  <td>{dailyReportData.safeSummary.openingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                  <td style={{ fontWeight: 'bold' }}>+{dailyReportData.safeSummary.deposits.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                  <td style={{ fontWeight: 'bold' }}>-{dailyReportData.safeSummary.withdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                  <td style={{ fontWeight: 'bold' }}>{dailyReportData.safeSummary.closingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '10mm' }}>
            <h3 style={{ borderRight: '4px solid #000', paddingRight: '2mm', marginBottom: '3mm', fontSize: '12pt', fontWeight: 800 }}>🏦 ثانياً: ملخص حركة الحسابات البنكية والمصارف</h3>
            <table className="report-print-table">
              <thead>
                <tr>
                  <th>كود البنك</th>
                  <th>اسم البنك</th>
                  <th>رقم الحساب</th>
                  <th>الرصيد الافتتاحي</th>
                  <th>إجمالي الوارد</th>
                  <th>إجمالي المنصرف</th>
                  <th>الرصيد الختامي</th>
                </tr>
              </thead>
              <tbody>
                {dailyReportData.banksSummary.map(bank => (
                  <tr key={bank.id} style={{ textAlign: 'center' }}>
                    <td style={{ fontWeight: 'bold' }}>{bank.code}</td>
                    <td>{bank.name}</td>
                    <td>{bank.account_number}</td>
                    <td>{bank.openingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                    <td>+{bank.deposits.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                    <td>-{bank.withdrawals.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                    <td style={{ fontWeight: 'bold' }}>{bank.closingBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '10mm' }}>
            <h3 style={{ borderRight: '4px solid #000', paddingRight: '2mm', marginBottom: '3mm', fontSize: '12pt', fontWeight: 800 }}>📝 ثالثاً: كشف العمليات اليومي المفصل</h3>
            <table className="report-print-table">
              <thead>
                <tr>
                  <th>رقم الحركة</th>
                  <th>الوقت</th>
                  <th>النوع</th>
                  <th>التفاصيل والمستفيد</th>
                  <th>طريقة الدفع / الحساب</th>
                  <th>المبلغ</th>
                  <th>المحاسب</th>
                </tr>
              </thead>
              <tbody>
                {dailyReportData.transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '4mm', textAlign: 'center' }}>لا توجد عمليات مسجلة في هذا اليوم.</td>
                  </tr>
                ) : (
                  dailyReportData.transactions.map(tx => (
                    <tr key={tx.id} style={{ textAlign: 'center' }}>
                      <td>TX-{String(tx.id).padStart(6, '0')}</td>
                      <td>{new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ fontWeight: 'bold' }}>
                        {tx.type === 'deposit' ? 'وارد' : tx.type === 'company_transfer' ? 'حوالة لشركة' : 'منصرف'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {tx.type === 'company_transfer' && `تحويل لشركة: ${tx.company_name}`}
                        {tx.rep_name && `المندوب: ${tx.rep_name}`}
                        {tx.withdrawal_sub_type && ` (بند: ${
                          tx.withdrawal_sub_type === 'car' ? 'مصاريف سيارات' : tx.withdrawal_sub_type === 'car_gas' ? 'جاز سيارات' : tx.withdrawal_sub_type === 'salary' ? 'رواتب' : tx.withdrawal_sub_type === 'commission' ? 'عمولات' : tx.withdrawal_sub_type === 'loan' ? 'سلفة' : 'أخرى'
                        })`}
                        {tx.notes && ` - ${tx.notes}`}
                      </td>
                      <td>
                        {tx.bank_name ? `🏦 ${tx.bank_name}` : '💵 نقدي بالخزينة'}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>
                        {tx.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                      </td>
                      <td>{tx.creator_name || 'أمين الخزينة'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20mm', marginTop: '20mm' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>توقيع المحاسب المستلم</p>
              <p style={{ marginTop: '15mm', borderBottom: '1px solid #000', width: '80%', marginInline: 'auto' }}></p>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>توقيع المراجع المالي</p>
              <p style={{ marginTop: '15mm', borderBottom: '1px solid #000', width: '80%', marginInline: 'auto' }}></p>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>توقيع المدير العام</p>
              <p style={{ marginTop: '15mm', borderBottom: '1px solid #000', width: '80%', marginInline: 'auto' }}></p>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE VIEWER MODAL */}
      {activeImageModal && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, direction: 'rtl', padding: '1.5rem'
          }}
          onClick={() => setActiveImageModal(null)}
        >
          <div 
            style={{
              position: 'relative', width: '100%', maxWidth: '800px', 
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setActiveImageModal(null)}
              style={{
                position: 'absolute', top: '-40px', left: '0', 
                background: 'rgba(255,255,255,0.1)', color: '#fff', 
                border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                fontSize: '1.2rem', cursor: 'pointer', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
              }}
            >
              ✕
            </button>
            <img 
              src={activeImageModal} 
              alt="إيصال التحويل بالحجم الكامل" 
              style={{ 
                maxWidth: '100%', maxHeight: '80vh', 
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)', objectFit: 'contain'
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
