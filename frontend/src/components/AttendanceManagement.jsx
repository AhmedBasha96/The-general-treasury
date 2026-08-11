import React, { useState, useEffect } from 'react';

export default function AttendanceManagement() {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [representatives, setRepresentatives] = useState([]);

  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('جميع الحالات');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // Manual Check-in Form
  const [manualRepId, setManualRepId] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState(new Date().toISOString().slice(0, 16));
  const [manualNotes, setManualNotes] = useState('');

  // Device Form
  const [deviceName, setDeviceName] = useState('جهاز بصمة مقر الشركة');
  const [deviceIp, setDeviceIp] = useState('192.168.1.201');
  const [devicePort, setDevicePort] = useState('4370');

  const loadAttendance = async () => {
    setLoading(true);
    try {
      let url = `/api/attendance?t=${new Date().getTime()}`;
      if (dateFilter) url += `&date=${dateFilter}`;
      if (statusFilter !== 'جميع الحالات') url += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAttendanceLogs(data);
      }
    } catch (err) {
      console.error('Error fetching attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await fetch('/api/attendance/devices');
      if (res.ok) {
        setDevices(await res.json());
      }
    } catch (e) {
      console.error('Error fetching devices', e);
    }
  };

  const loadReps = async () => {
    try {
      const res = await fetch('/api/reps');
      if (res.ok) {
        setRepresentatives(await res.json());
      }
    } catch (e) {
      console.error('Error fetching reps', e);
    }
  };

  useEffect(() => {
    loadAttendance();
    loadDevices();
    loadReps();
  }, [dateFilter, statusFilter]);

  // Handle direct ZKTeco IP sync
  const handleSyncDevice = async (deviceId) => {
    setSyncing(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/attendance/sync-device/${deviceId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'تمت المزامنة بنجاح');
        loadAttendance();
        loadDevices();
      } else {
        setError(data.error || 'فشلت المزامنة مع جهاز البصمة');
      }
    } catch (e) {
      setError('تعذر الاتصال بالخادم لمزامنة البصمة');
    } finally {
      setSyncing(false);
    }
  };

  // Handle manual attendance submission
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCheckIn) return setError('وقت الحضور مطلوب');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rep_id: manualRepId || null,
          check_in: manualCheckIn,
          notes: manualNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowManualModal(false);
        setManualNotes('');
        setManualRepId('');
        loadAttendance();
        setSuccessMsg('تم تسجيل الحضور اليدوي بنجاح');
      } else {
        setError(data.error || 'فشل تسجيل الحضور');
      }
    } catch (e) {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  // Handle adding ZK Device
  const handleAddDevice = async (e) => {
    e.preventDefault();
    if (!deviceName || !deviceIp) return setError('اسم الجهاز وعنوان الـ IP مطلوبان');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/attendance/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deviceName,
          ip_address: deviceIp,
          port: devicePort
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowDeviceModal(false);
        loadDevices();
        setSuccessMsg('تم إضافة جهاز بصمة ZKTeco جديد بنجاح');
      } else {
        setError(data.error || 'فشل إضافة الجهاز');
      }
    } catch (e) {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  // Handle file import
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').filter(Boolean);
        const records = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/,|\t/).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 2) {
            const zkCode = cols[0];
            const timeStr = cols[1] || cols[2];
            if (zkCode && timeStr) {
              records.push({ zk_user_id: zkCode, check_in: timeStr });
            }
          }
        }

        if (records.length === 0) {
          return alert('لم يتم العثور على حركات بصمة صحيحة بالملف');
        }

        const res = await fetch('/api/attendance/import-zk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records })
        });

        const data = await res.json();
        if (res.ok) {
          alert(data.message || 'تم استيراد الملف بنجاح');
          loadAttendance();
        } else {
          alert(data.error || 'فشل استيراد الملف');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف البصمة');
      }
    };
    reader.readAsText(file);
  };

  // Export to Excel
  const handleExportToExcel = () => {
    if (attendanceLogs.length === 0) return alert('لا توجد سجلات حضور للتصدير');

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>تقرير الحضور والغياب</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
          th { background-color: #1e293b; color: #ffffff; }
        </style>
      </head>
      <body>
        <h2>📋 تقرير سجلات حضور أجهزة ZKTeco (${dateFilter || 'شامل'})</h2>
        <table>
          <thead>
            <tr>
              <th>كود البصمة ZK</th>
              <th>اسم الموظف / السائق</th>
              <th>الفئة</th>
              <th>التاريخ</th>
              <th>وقت الحضور</th>
              <th>دقائق التأخير</th>
              <th>حالة الحضور</th>
              <th>جهاز البصمة</th>
              <th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${attendanceLogs.map(a => `
              <tr>
                <td>${a.zk_user_id}</td>
                <td>${a.rep_name || 'غير مسجل'}</td>
                <td>${a.rep_classification === 'driver' ? 'سائق' : 'مندوب/موظف'}</td>
                <td>${a.date}</td>
                <td>${new Date(a.check_in).toLocaleTimeString('ar-EG')}</td>
                <td>${a.late_minutes || 0} دقيقة</td>
                <td>${a.status === 'present' ? 'حاضر' : a.status === 'late' ? 'متأخر' : 'غائب'}</td>
                <td>${a.device_name || '—'}</td>
                <td>${a.notes || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_حضور_بصمة_ZKTeco_${dateFilter || 'شامل'}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Print Report A4
  const handlePrintReport = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');

    const content = `
      <html dir="rtl">
        <head>
          <title>تقرير حضور بصمة ZKTeco - ${dateFilter}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; direction: rtl; }
            h2 { text-align: center; color: #0f172a; margin-bottom: 5px; }
            p { text-align: center; color: #64748b; font-size: 0.9rem; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-size: 0.85rem; }
            th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>📋 كشف بصمة الحضور المعتمد (ZKTeco)</h2>
          <p>التاريخ: ${dateFilter || 'كافة السجلات'} | عدد الحركات: ${attendanceLogs.length}</p>
          <table>
            <thead>
              <tr>
                <th>كود ZK</th>
                <th>اسم السائق / الموظف</th>
                <th>الفئة</th>
                <th>التاريخ</th>
                <th>وقت الحضور</th>
                <th>التأخير</th>
                <th>الحالة</th>
                <th>جهاز البصمة</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceLogs.map(a => `
                <tr>
                  <td><strong>${a.zk_user_id}</strong></td>
                  <td>${a.rep_name || '—'}</td>
                  <td>${a.rep_classification === 'driver' ? '🚚 سائق' : '👤 مندوب'}</td>
                  <td>${a.date}</td>
                  <td><strong>${new Date(a.check_in).toLocaleTimeString('ar-EG')}</strong></td>
                  <td style="color: ${a.late_minutes > 0 ? '#dc2626' : '#16a34a'};">${a.late_minutes > 0 ? `${a.late_minutes} دقيقة` : 'في الموعد'}</td>
                  <td>${a.status === 'present' ? '🟢 حاضر' : a.status === 'late' ? '🟠 متأخر' : '🔴 غائب'}</td>
                  <td>${a.device_name || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWin.document.write(content);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  };

  const filteredLogs = attendanceLogs.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.rep_name && a.rep_name.toLowerCase().includes(q)) ||
      (a.zk_user_id && a.zk_user_id.toLowerCase().includes(q))
    );
  });

  const presentCount = attendanceLogs.filter(a => a.status === 'present').length;
  const lateCount = attendanceLogs.filter(a => a.status === 'late').length;
  const totalLateMins = attendanceLogs.reduce((sum, a) => sum + (Number(a.late_minutes) || 0), 0);

  return (
    <div style={{ padding: '1rem', direction: 'rtl' }}>
      
      {/* Top ZKTeco Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary, #1e293b)', padding: '1.15rem 1.5rem', borderRadius: '20px', border: '1px solid var(--border-color, #334155)' }}>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🕒 نظام بصمة الحضور والربط المباشر بـ ZKTeco
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>تتبع وقت حضور السائقين والموظفين، الربط الشبكي المباشر، وتحديد دقائق التأخير</span>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {devices.map(dev => (
            <button 
              key={dev.id}
              onClick={() => handleSyncDevice(dev.id)}
              disabled={syncing}
              style={{ padding: '0.65rem 1rem', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
            >
              🔄 مزامنة {dev.name} ({dev.ip_address})
            </button>
          ))}
          
          <button 
            onClick={() => setShowDeviceModal(true)}
            style={{ padding: '0.65rem 1rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer' }}
          >
            ➕ إضافة جهاز ZK
          </button>

          <label style={{ padding: '0.65rem 1rem', background: '#059669', color: '#ffffff', borderRadius: '12px', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            📁 استيراد ملف ZK
            <input type="file" accept=".csv,.txt,.dat" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <button 
            onClick={() => setShowManualModal(true)}
            style={{ padding: '0.65rem 1rem', background: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer' }}
          >
            ➕ تسجيل يدوي
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1.25rem', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1.25rem' }}>
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#86efac', padding: '0.75rem 1.25rem', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1.25rem' }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Analytics Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'bold' }}>📋 إجمالي تسجيلات الحضور اليوم</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#f8fafc', fontSize: '1.75rem', fontWeight: '800' }}>{attendanceLogs.length}</h3>
        </div>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 'bold' }}>🟢 الحاضرون في الموعد</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#4ade80', fontSize: '1.75rem', fontWeight: '800' }}>{presentCount}</h3>
        </div>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: '#fb923c', fontSize: '0.85rem', fontWeight: 'bold' }}>🟠 الحضور المتأخر</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#fb923c', fontSize: '1.75rem', fontWeight: '800' }}>{lateCount}</h3>
        </div>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 'bold' }}>⏱️ مجموع دقائق التأخير</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#f87171', fontSize: '1.4rem', fontWeight: '800' }}>{totalLateMins} دقيقة</h3>
        </div>
      </div>

      {/* Main Filter & Attendance Table Panel */}
      <div style={{ background: 'var(--bg-primary, #0f172a)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color, #334155)' }}>
        
        {/* Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
            <input 
              type="date"
              className="input-field"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: '170px' }}
            />
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="جميع الحالات">جميع الحالات</option>
              <option value="present">🟢 حاضر في الموعد</option>
              <option value="late">🟠 متأخر</option>
            </select>
            <input 
              type="text"
              className="input-field"
              placeholder="🔍 ابحث بالاسم أو كود البصمة ZK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button 
              onClick={handleExportToExcel}
              style={{ padding: '0.6rem 1.1rem', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer' }}
            >
              📊 حفظ Excel
            </button>
            <button 
              onClick={handlePrintReport}
              style={{ padding: '0.6rem 1.1rem', background: '#475569', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer' }}
            >
              🖨️ طباعة التقرير
            </button>
          </div>
        </div>

        {/* Attendance Table */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '1.1rem' }}>جاري تحميل سجلات البصمة... ⏳</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🕒</div>
            <h4>لا توجد سجلات حضور مسجلة لهذا التاريخ.</h4>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid #334155' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#f8fafc', borderBottom: '2px solid #334155' }}>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>كود ZK</th>
                  <th style={{ padding: '0.85rem', textAlign: 'right' }}>اسم الموظف / السائق</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>الفئة</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>التاريخ</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>وقت الحضور</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>التأخير (بالدقيقة)</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>حالة الحضور</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>جهاز البصمة</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((a, idx) => (
                  <tr key={a.id || idx} style={{ borderBottom: '1px solid #334155', background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: 'bold', color: '#60a5fa' }}>{a.zk_user_id}</td>
                    <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: '700', color: '#f8fafc' }}>
                      {a.rep_name || 'غير مسجل بقائمة الحسابات'}
                    </td>
                    <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 'bold', background: a.rep_classification === 'driver' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: a.rep_classification === 'driver' ? '#fb923c' : '#60a5fa' }}>
                        {a.rep_classification === 'driver' ? '🚚 سائق' : '👤 مندوب'}
                      </span>
                    </td>
                    <td style={{ padding: '0.8rem', textAlign: 'center', color: '#cbd5e1' }}>{a.date}</td>
                    <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: '900', color: '#f8fafc', fontSize: '1rem' }}>
                      {new Date(a.check_in).toLocaleTimeString('ar-EG')}
                    </td>
                    <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: 'bold', color: a.late_minutes > 0 ? '#f87171' : '#4ade80' }}>
                      {a.late_minutes > 0 ? `${a.late_minutes} دقيقة` : 'في الموعد'}
                    </td>
                    <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        backgroundColor: a.status === 'present' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: a.status === 'present' ? '#4ade80' : '#fb923c',
                        border: `1px solid ${a.status === 'present' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                      }}>
                        {a.status === 'present' ? '🟢 حاضر في الموعد' : '🟠 متأخر'}
                      </span>
                    </td>
                    <td style={{ padding: '0.8rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{a.device_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Manual Attendance Entry */}
      {showManualModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '1.75rem', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', direction: 'rtl', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontWeight: '800' }}>➕ تسجيل حضور يدوي (استثنائي)</h3>
              <button onClick={() => setShowManualModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>تحديد الموظف / السائق:</label>
                <select className="input-field" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', padding: '0.65rem' }} value={manualRepId} onChange={(e) => setManualRepId(e.target.value)} required>
                  <option value="">-- اختار الموظف أو السائق --</option>
                  {representatives.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.classification === 'driver' ? '🚚 ' : '👤 '}{r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>تاريخ ووقت الحضور:</label>
                <input type="datetime-local" className="input-field" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', padding: '0.65rem' }} value={manualCheckIn} onChange={(e) => setManualCheckIn(e.target.value)} required />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>ملاحظات أو عذر الحضور اليدوي:</label>
                <textarea className="input-field" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', padding: '0.65rem' }} rows="2" placeholder="ملاحظات سبب التغاضي عن البصمة اليدوية..." value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', fontWeight: 'bold', background: '#2563eb' }}>حفظ تسجيل الحضور</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowManualModal(false)} style={{ padding: '0.75rem 1.25rem' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add ZKTeco Device */}
      {showDeviceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '1.75rem', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', direction: 'rtl', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontWeight: '800' }}>➕ إضافة جهاز بصمة ZKTeco شبكي</h3>
              <button onClick={() => setShowDeviceModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddDevice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>اسم الجهاز:</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', padding: '0.65rem' }} placeholder="مثال: جهاز بصمة مقر الشركة" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} required />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>عنوان IP الجهاز بالشبكة (IP Address):</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', padding: '0.65rem', direction: 'ltr', textAlign: 'center' }} placeholder="192.168.1.201" value={deviceIp} onChange={(e) => setDeviceIp(e.target.value)} required />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>منفذ الاتصال الشبكي (Port):</label>
                <input type="number" className="input-field" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', padding: '0.65rem', direction: 'ltr', textAlign: 'center' }} value={devicePort} onChange={(e) => setDevicePort(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', fontWeight: 'bold', background: '#0284c7' }}>إضافة الجهاز بالشبكة</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeviceModal(false)} style={{ padding: '0.75rem 1.25rem' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
