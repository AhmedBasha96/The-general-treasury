import React, { useState, useEffect } from 'react';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      } else {
        setError('حدث خطأ أثناء جلب سجل الحركة');
      }
    } catch (err) {
      console.error('Audit logs error:', err);
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || log.user_role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getActionBadgeClass = (action) => {
    if ((action || '').includes('موافقة')) return 'badge-success';
    if ((action || '').includes('رفض')) return 'badge-danger';
    if ((action || '').includes('إيداع') || (action || '').includes('توريد')) return 'badge-deposit';
    if ((action || '').includes('صرف')) return 'badge-withdrawal';
    return 'badge-secondary';
  };

  return (
    <div className="panel audit-panel">
      <div className="panel-header">
        <h2 className="panel-title">📜 سجل حركة ونشاط النظام والتدقيق الإداري</h2>
        <button onClick={fetchAuditLogs} className="btn btn-secondary btn-sm">
          🔄 تحديث السجل
        </button>
      </div>

      {/* Search and Filters */}
      <div className="filter-bar">
        <div className="form-group">
          <label>بحث في السجل:</label>
          <input
            type="text"
            placeholder="ابحث باسم المستخدم، الإجراء، أو التفاصيل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>تصفية حسب الدور:</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">كل الأدوار</option>
            <option value="manager">المدير العام</option>
            <option value="accountant">أمين الخزينة / المحاسب</option>
            <option value="representative">المندوب</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="no-data-msg">جاري تحميل سجل النشاط والحركات...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : filteredLogs.length === 0 ? (
        <div className="no-data-msg">لا توجد سجلات تطابق خيارات البحث</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>رقم السجل</th>
                <th>التاريخ والوقت</th>
                <th>المستخدم</th>
                <th>الدور</th>
                <th>نوع الإجراء</th>
                <th>التفاصيل والقيم</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td><code>LOG-{String(log.id).padStart(5, '0')}</code></td>
                  <td>{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                  <td><strong>{log.user_name || 'غير محدد'}</strong></td>
                  <td>
                    <span className="user-role-pill">
                      {log.user_role === 'manager' ? '👑 مدير' : log.user_role === 'accountant' ? '💼 أمين خزينة' : '👤 مندوب'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getActionBadgeClass(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="log-details-cell">
                    <pre>{log.details || '—'}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
