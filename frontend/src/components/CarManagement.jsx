import React, { useEffect, useState } from 'react';

// Egyptian License Plate Component matching exact official layout
function EgyptianLicensePlate({ letters, numbers, vehicleType }) {
  const getHeaderColor = () => {
    if (vehicleType === 'ملاكي') return '#1d4ed8'; // Blue
    if (vehicleType === 'أجرة') return '#ea580c'; // Orange
    return '#dc2626'; // Red for نقل / freight and standard
  };

  const headerBg = getHeaderColor();

  return (
    <div style={{
      width: '160px',
      minWidth: '160px',
      height: '80px',
      borderRadius: '10px',
      backgroundColor: '#ffffff',
      border: '2px solid #0f172a',
      overflow: 'hidden',
      boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      userSelect: 'none'
    }}>
      {/* Screw bolt caps */}
      <div style={{ position: 'absolute', top: '3px', left: '6px', width: '5px', height: '5px', borderRadius: '50%', background: '#475569', zIndex: 3, border: '1px solid #1e293b' }} />
      <div style={{ position: 'absolute', top: '3px', right: '6px', width: '5px', height: '5px', borderRadius: '50%', background: '#475569', zIndex: 3, border: '1px solid #1e293b' }} />

      {/* Red/Blue/Orange Header Bar */}
      <div style={{
        backgroundColor: headerBg,
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        color: '#ffffff',
        fontWeight: '900',
        lineHeight: 1
      }}>
        <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.8rem', letterSpacing: '0.5px' }}>EGYPT</span>
        <span style={{ fontFamily: 'Cairo, Tahoma, sans-serif', fontSize: '0.95rem' }}>مصر</span>
      </div>

      {/* Main Plate Body */}
      <div style={{
        flex: 1,
        display: 'flex',
        direction: 'rtl',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '0 4px'
      }}>
        {/* Right Section: Numbers */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          fontWeight: '900',
          fontSize: '1.3rem',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          letterSpacing: '1px'
        }}>
          {numbers || '—'}
        </div>

        {/* Divider line */}
        <div style={{ width: '2px', height: '75%', backgroundColor: '#94a3b8' }} />

        {/* Left Section: Letters */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          fontWeight: '900',
          fontSize: '1.2rem',
          color: '#0f172a',
          fontFamily: 'Cairo, Tahoma, sans-serif',
          letterSpacing: '2px'
        }}>
          {letters || '—'}
        </div>
      </div>
    </div>
  );
}

function getLicenseAlert(expiryDateStr) {
  if (!expiryDateStr) return null;
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { type: 'expired', label: `منتهية منذ ${Math.abs(diffDays)} يوم`, bg: '#fef2f2', color: '#dc2626' };
  } else if (diffDays <= 30) {
    return { type: 'warning', label: `تنتهي خلال ${diffDays} يوم`, bg: '#fffbeb', color: '#d97706' };
  }
  return { type: 'ok', label: `رخصة صالحة (${expiryDateStr})`, bg: '#f0fdf4', color: '#16a34a' };
}

export default function CarManagement({ onCarAdded, onCarClick }) {
  const [cars, setCars] = useState([]);
  const [plateL1, setPlateL1] = useState('');
  const [plateL2, setPlateL2] = useState('');
  const [plateL3, setPlateL3] = useState('');
  const [plateNum, setPlateNum] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleType, setVehicleType] = useState('نقل');
  const [model, setModel] = useState('سوزوكي');
  const [odometerKm, setOdometerKm] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [status, setStatus] = useState('نشطة');
  const [fuelType, setFuelType] = useState('سولار');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('جميع الحالات');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingCar, setEditingCar] = useState(null);

  const loadCars = async () => {
    try {
      const res = await fetch(`/api/cars?t=${new Date().getTime()}`);
      if (res.ok) setCars(await res.json());
    } catch (e) {
      console.error('Error fetching cars', e);
    }
  };

  useEffect(() => {
    loadCars();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lettersStr = [plateL1.trim(), plateL2.trim(), plateL3.trim()].filter(Boolean).join(' ');
    const numbersStr = plateNum.trim();
    const combinedPlate = [lettersStr, numbersStr].filter(Boolean).join(' ');

    if (!combinedPlate || !plateNum) return setError('أرقام اللوحة مطلوبة على الأقل');
    setLoading(true);
    setError('');

    try {
      const url = editingCar ? `/api/cars/${editingCar.id}` : '/api/cars';
      const method = editingCar ? 'PUT' : 'POST';
      let reqBody, headers = {};

      if (image) {
        reqBody = new FormData();
        reqBody.append('plate_letters', lettersStr);
        reqBody.append('plate_numbers', numbersStr);
        reqBody.append('plate_number', combinedPlate);
        reqBody.append('driver_name', driverName.trim());
        reqBody.append('vehicle_type', vehicleType.trim());
        reqBody.append('model', model.trim());
        reqBody.append('odometer_km', odometerKm);
        reqBody.append('license_expiry_date', licenseExpiryDate);
        reqBody.append('status', status);
        reqBody.append('fuel_type', fuelType);
        reqBody.append('notes', notes.trim());
        reqBody.append('image', image);
      } else {
        reqBody = JSON.stringify({ 
          plate_letters: lettersStr, 
          plate_numbers: numbersStr, 
          plate_number: combinedPlate, 
          driver_name: driverName.trim(),
          vehicle_type: vehicleType.trim(),
          model: model.trim(),
          odometer_km: odometerKm,
          license_expiry_date: licenseExpiryDate,
          status,
          fuel_type: fuelType,
          notes: notes.trim()
        });
        headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch(url, { method, headers, body: reqBody });
      const data = await res.json();
      if (res.ok) {
        resetForm();
        loadCars();
        if (onCarAdded) onCarAdded();
      } else {
        setError(data.error || (editingCar ? 'فشل تعديل السيارة' : 'فشل إضافة السيارة'));
      }
    } catch (err) {
      console.error(err);
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (c, e) => {
    e.stopPropagation();
    setEditingCar(c);
    setDriverName(c.driver_name || '');
    setVehicleType(c.vehicle_type || 'نقل');
    setModel(c.model || 'سوزوكي');
    setOdometerKm(c.odometer_km ? String(c.odometer_km) : '');
    setLicenseExpiryDate(c.license_expiry_date || '');
    setStatus(c.status || 'نشطة');
    setFuelType(c.fuel_type || 'سولار');
    setNotes(c.notes || '');
    
    if (c.plate_letters || c.plate_numbers) {
      const letters = (c.plate_letters || '').split(' ');
      setPlateL1(letters[0] || '');
      setPlateL2(letters[1] || '');
      setPlateL3(letters[2] || '');
      setPlateNum(c.plate_numbers || '');
    } else {
      const parts = (c.plate_number || '').split(' ');
      if (parts.length > 1) {
        setPlateNum(parts.pop());
        setPlateL1(parts[0] || '');
        setPlateL2(parts[1] || '');
        setPlateL3(parts[2] || '');
      } else {
        setPlateL1(''); setPlateL2(''); setPlateL3('');
        setPlateNum(c.plate_number || '');
      }
    }
    
    setImage(null);
    setError('');
  };

  const handleDeleteClick = async (c, e) => {
    e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف السيارة ${c.plate_number}؟`)) return;
    
    try {
      const res = await fetch(`/api/cars/${c.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (editingCar && editingCar.id === c.id) {
          resetForm();
        }
        loadCars();
        if (onCarAdded) onCarAdded();
      } else {
        const data = await res.json();
        alert(data.error || 'فشل حذف السيارة');
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم');
    }
  };

  const resetForm = () => {
    setEditingCar(null);
    setPlateL1(''); setPlateL2(''); setPlateL3(''); setPlateNum(''); setDriverName('');
    setVehicleType('نقل'); setModel('سوزوكي');
    setOdometerKm(''); setLicenseExpiryDate(''); setStatus('نشطة'); setFuelType('سولار'); setNotes('');
    setImage(null);
    setError('');
  };

  const totalFleetExpenses = cars.reduce((acc, c) => acc + (Number(c.total_expenses) || 0), 0);
  const activeCount = cars.filter(c => c.status === 'نشطة' || !c.status).length;
  const maintenanceCount = cars.filter(c => c.status === 'صيانة').length;

  const filteredCars = cars.filter(c => {
    const matchesSearch = !searchQuery || 
      (c.plate_number && c.plate_number.includes(searchQuery)) ||
      (c.driver_name && c.driver_name.includes(searchQuery)) ||
      (c.model && c.model.includes(searchQuery));
    
    const matchesStatus = statusFilter === 'جميع الحالات' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ padding: '1rem', direction: 'rtl' }}>
      
      {/* Top Fleet Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold' }}>🚗 إجمالي السيارات</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#0f172a', fontSize: '1.75rem', fontWeight: '800' }}>{cars.length}</h3>
        </div>
        <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#16a34a', fontSize: '0.85rem', fontWeight: 'bold' }}>🟢 السيارات النشطة</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#16a34a', fontSize: '1.75rem', fontWeight: '800' }}>{activeCount}</h3>
        </div>
        <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#ea580c', fontSize: '0.85rem', fontWeight: 'bold' }}>🔧 السيارات في الصيانة</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#ea580c', fontSize: '1.75rem', fontWeight: '800' }}>{maintenanceCount}</h3>
        </div>
        <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 'bold' }}>💰 إجمالي مصاريف الأسطول</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#2563eb', fontSize: '1.4rem', fontWeight: '800' }}>
            {totalFleetExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
          </h3>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Form Section */}
        <div style={{ flex: '1', minWidth: '320px', background: 'var(--bg-primary, #ffffff)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h4 style={{ marginBottom: '1.25rem', color: 'var(--text-primary, #0f172a)', fontWeight: 'bold' }}>
            {editingCar ? '✏️ تعديل سيارات والأسطول' : '➕ إضافة سيارة جديدة للأسطول'}
          </h4>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Plate inputs */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>رقم اللوحة المعدنية:</label>
              <div style={{ display: 'flex', gap: '0.5rem', direction: 'ltr', justifyContent: 'center' }}>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '90px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold' }}
                  value={plateNum}
                  onChange={(e) => setPlateNum(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="أرقام"
                  required
                />
                <span style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted, #94a3b8)' }}>-</span>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '50px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold' }}
                  value={plateL3}
                  onChange={(e) => setPlateL3(e.target.value.slice(0, 1))}
                  placeholder="ح٣"
                />
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '50px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold' }}
                  value={plateL2}
                  onChange={(e) => setPlateL2(e.target.value.slice(0, 1))}
                  placeholder="ح٢"
                />
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '50px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold' }}
                  value={plateL1}
                  onChange={(e) => setPlateL1(e.target.value.slice(0, 1))}
                  placeholder="ح١"
                  required
                />
              </div>
            </div>

            {/* Vehicle Type & Model in 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>نوع المركبة:</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="مثال: نقل / ملاكي..." 
                  value={vehicleType} 
                  onChange={(e) => setVehicleType(e.target.value)} 
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>الطراز (الموديل):</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="سوزوكي / شيفروليه..." 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)} 
                  required
                />
              </div>
            </div>

            {/* Driver Name */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>قائد المركبة (السائق):</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="أدخل اسم السائق المسند إليه السيارة..." 
                value={driverName} 
                onChange={(e) => setDriverName(e.target.value)} 
              />
            </div>

            {/* Odometer & License Expiry Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>قراءة العداد (كم):</label>
                <input 
                  type="number" 
                  className="input-field"
                  placeholder="مثال: 54000" 
                  value={odometerKm} 
                  onChange={(e) => setOdometerKm(e.target.value)} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>تاريخ انتهاء الرخصة:</label>
                <input 
                  type="date" 
                  className="input-field"
                  value={licenseExpiryDate} 
                  onChange={(e) => setLicenseExpiryDate(e.target.value)} 
                />
              </div>
            </div>

            {/* Status & Fuel Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>حالة السيارة:</label>
                <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="نشطة">🟢 نشطة</option>
                  <option value="صيانة">🟠 في الصيانة</option>
                  <option value="خارج الخدمة">🔴 خارج الخدمة</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>نوع الوقود:</label>
                <select className="input-field" value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
                  <option value="سولار">⛽ سولار</option>
                  <option value="بنزين 80">⛽ بنزين 80</option>
                  <option value="بنزين 92">⛽ بنزين 92</option>
                  <option value="غاز">⛽ غاز طبيعي</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>ملاحظات ومواصفات:</label>
              <textarea 
                className="input-field"
                rows="2"
                placeholder="أدخل أي ملاحظات إضافية بخصوص السيارة..." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
              />
            </div>

            {/* Image (Optional) */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem' }}>صورة السيارة (اختياري):</label>
              <input 
                type="file" 
                className="input-field"
                accept="image/*" 
                onChange={(e) => setImage(e.target.files[0])} 
              />
            </div>

            {error && <div style={{ color: 'var(--error, #dc2626)', background: 'var(--error-bg, #fef2f2)', padding: '0.6rem', borderRadius: '10px', fontSize: '0.85rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'جاري الحفظ…' : (editingCar ? 'تحديث بيانات السيارة' : 'حفظ السيارة جديدة')}
              </button>
              {editingCar && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={resetForm}
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Section */}
        <div style={{ flex: '2', minWidth: '340px' }}>
          
          {/* Search & Filter Header */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary, #0f172a)', fontWeight: 'bold' }}>
              السيارات المسجلة ({filteredCars.length})
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="input-field" 
                style={{ width: '180px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} 
                placeholder="🔍 بحث برقم أو اسم..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select 
                className="input-field" 
                style={{ width: '140px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="جميع الحالات">جميع الحالات</option>
                <option value="نشطة">🟢 نشطة</option>
                <option value="صيانة">🟠 في الصيانة</option>
                <option value="خارج الخدمة">🔴 خارج الخدمة</option>
              </select>
            </div>
          </div>

          {filteredCars.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '20px', color: 'var(--text-muted, #64748b)' }}>
              لا توجد سيارات مطابقة لشروط البحث.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {filteredCars.map((c) => {
                const totalExp = Number(c.total_expenses) || 0;
                const licAlert = getLicenseAlert(c.license_expiry_date);

                return (
                  <div 
                    key={c.id} 
                    style={{ 
                      background: '#ffffff', 
                      border: '1.5px solid #e2e8f0', 
                      borderRadius: '24px', 
                      padding: '1.25rem 1.5rem',
                      direction: 'rtl',
                      position: 'relative',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                      transition: 'all 0.25s ease',
                      cursor: onCarClick ? 'pointer' : 'default'
                    }}
                    onClick={() => onCarClick && onCarClick(c)}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)'; }}
                  >
                    {/* Top Row: Status badge & License Plate */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      
                      {/* Specs & Badges */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        
                        {/* Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            backgroundColor: c.status === 'صيانة' ? '#fff7ed' : c.status === 'خارج الخدمة' ? '#fef2f2' : '#f0fdf4',
                            color: c.status === 'صيانة' ? '#ea580c' : c.status === 'خارج الخدمة' ? '#dc2626' : '#16a34a',
                            border: `1px solid ${c.status === 'صيانة' ? '#ffedd5' : c.status === 'خارج الخدمة' ? '#fecaca' : '#dcfce7'}`
                          }}>
                            {c.status === 'صيانة' ? '🟠 في الصيانة' : c.status === 'خارج الخدمة' ? '🔴 خارج الخدمة' : '🟢 نشطة'}
                          </span>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f1f5f9', color: '#475569' }}>
                            ⛽ {c.fuel_type || 'سولار'}
                          </span>
                        </div>

                        {/* Vehicle Type & Model */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>نوع المركبة:</span>
                          <span style={{ color: '#1e1b4b', fontSize: '1rem', fontWeight: '700' }}>{c.vehicle_type || 'نقل'} ({c.model || 'سوزوكي'})</span>
                        </div>

                        {/* Odometer */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>🛣️ العداد:</span>
                          <span style={{ color: '#0f172a', fontSize: '0.95rem', fontWeight: '700' }}>
                            {c.odometer_km ? `${Number(c.odometer_km).toLocaleString('en-US')} كم` : 'غير مسجل'}
                          </span>
                        </div>

                        {/* Balance / Total expenses */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>مجموع المصاريف:</span>
                          <span style={{ color: '#16a34a', fontSize: '1.15rem', fontWeight: '800' }}>
                            {totalExp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                          </span>
                        </div>

                      </div>

                      {/* License Plate on Top-Left (RTL layout) */}
                      <div>
                        <EgyptianLicensePlate 
                          letters={c.plate_letters} 
                          numbers={c.plate_numbers} 
                          vehicleType={c.vehicle_type || 'نقل'}
                        />
                      </div>

                    </div>

                    {/* Driver & License Alerts Section */}
                    <div style={{ 
                      marginTop: '0.85rem', 
                      paddingTop: '0.65rem', 
                      borderTop: '1px dashed #e2e8f0', 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
                          <span style={{ color: '#ea580c', fontSize: '1.1rem' }}>👤</span>
                          <span>قائد المركبة:</span>
                          <strong style={{ color: '#1e1b4b' }}>{c.driver_name || 'غير محدد'}</strong>
                        </div>
                      </div>

                      {licAlert && (
                        <div style={{ 
                          fontSize: '0.78rem', 
                          fontWeight: '700', 
                          padding: '0.3rem 0.6rem', 
                          borderRadius: '8px', 
                          backgroundColor: licAlert.bg, 
                          color: licAlert.color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}>
                          📌 {licAlert.label}
                        </div>
                      )}

                      {c.notes && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '0.35rem 0.6rem', borderRadius: '8px' }}>
                          📝 {c.notes}
                        </div>
                      )}
                    </div>

                    {/* Quick action bar at card footer */}
                    <div style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.6rem',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                        {Number(c.transaction_count) || 0} عملية مسجلة
                      </span>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if (onCarClick) onCarClick(c); }}
                          style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                          title="عرض كشف المعاملات"
                        >
                          📂 كشف الحساب
                        </button>
                        <button 
                          onClick={(e) => handleEditClick(c, e)}
                          style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#d97706', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                          title="تعديل بيانات السيارة"
                        >
                          ✏️ تعديل
                        </button>
                        <button 
                          onClick={(e) => handleDeleteClick(c, e)}
                          style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                          title="حذف السيارة"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

