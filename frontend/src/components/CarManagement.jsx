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

export default function CarManagement({ onCarAdded, onCarClick }) {
  const [cars, setCars] = useState([]);
  const [plateL1, setPlateL1] = useState('');
  const [plateL2, setPlateL2] = useState('');
  const [plateL3, setPlateL3] = useState('');
  const [plateNum, setPlateNum] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleType, setVehicleType] = useState('نقل');
  const [model, setModel] = useState('سوزوكي');
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [failedImages, setFailedImages] = useState({});

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
        reqBody.append('image', image);
      } else {
        reqBody = JSON.stringify({ 
          plate_letters: lettersStr, 
          plate_numbers: numbersStr, 
          plate_number: combinedPlate, 
          driver_name: driverName.trim(),
          vehicle_type: vehicleType.trim(),
          model: model.trim()
        });
        headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch(url, { method, headers, body: reqBody });
      const data = await res.json();
      if (res.ok) {
        setPlateL1(''); setPlateL2(''); setPlateL3(''); setPlateNum(''); setDriverName('');
        setVehicleType('نقل'); setModel('سوزوكي');
        setImage(null);
        setEditingCar(null);
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
          setEditingCar(null);
          setPlateL1(''); setPlateL2(''); setPlateL3(''); setPlateNum(''); setDriverName('');
          setVehicleType('نقل'); setModel('سوزوكي');
          setImage(null);
          setError('');
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
    setImage(null);
    setError('');
  };

  return (
    <div style={{ padding: '1rem' }}>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Form Section */}
        <div style={{ flex: '1', minWidth: '320px', background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h4 style={{ marginBottom: '1.25rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{editingCar ? '✏️ تعديل سيارة' : '➕ إضافة سيارة جديدة'}</h4>
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
                <span style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>-</span>
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

            {/* Vehicle Type */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>نوع المركبة:</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="مثال: نقل / ملاكي / أجرة..." 
                value={vehicleType} 
                onChange={(e) => setVehicleType(e.target.value)} 
                required
              />
            </div>

            {/* Model */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>الطراز (الموديل/الماركة):</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="مثال: سوزوكي / شيفروليه / تويوتا..." 
                value={model} 
                onChange={(e) => setModel(e.target.value)} 
                required
              />
            </div>

            {/* Driver Name */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>قائد المركبة (اسم السائق):</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="أدخل اسم سائق السيارة..." 
                value={driverName} 
                onChange={(e) => setDriverName(e.target.value)} 
              />
            </div>

            {/* Image (Optional) */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>صورة السيارة (اختياري):</label>
              <input 
                type="file" 
                className="input-field"
                accept="image/*" 
                onChange={(e) => setImage(e.target.files[0])} 
              />
            </div>

            {error && <div style={{ color: 'var(--error)', background: 'var(--error-bg)', padding: '0.6rem', borderRadius: '10px', fontSize: '0.85rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'جاري الحفظ…' : (editingCar ? 'تحديث البيانات' : 'إضافة سيارة')}
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
          <h4 style={{ marginBottom: '1.25rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>السيارات المسجلة ({cars.length})</h4>
          {cars.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '20px', color: 'var(--text-muted)' }}>
              لا توجد سيارات مسجلة حتى الآن.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {cars.map((c) => {
                const totalExp = Number(c.total_expenses) || 0;

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
                    {/* Top Row: Details on left (RTL), License plate on right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      
                      {/* Specs */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        
                        {/* Vehicle Type */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <span style={{ color: '#64748b', fontSize: '1rem', fontWeight: '500', minWidth: '85px' }}>نوع المركبة</span>
                          <span style={{ color: '#1e1b4b', fontSize: '1.1rem', fontWeight: '700' }}>{c.vehicle_type || 'نقل'}</span>
                        </div>

                        {/* Model */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <span style={{ color: '#64748b', fontSize: '1rem', fontWeight: '500', minWidth: '85px' }}>الطراز</span>
                          <span style={{ color: '#1e1b4b', fontSize: '1.1rem', fontWeight: '700' }}>{c.model || 'سوزوكي'}</span>
                        </div>

                        {/* Balance */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <span style={{ color: '#64748b', fontSize: '1rem', fontWeight: '500', minWidth: '85px' }}>الرصيد</span>
                          <span style={{ color: '#16a34a', fontSize: '1.25rem', fontWeight: '800' }}>
                            {totalExp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                      </div>

                      {/* License Plate on Top-Right */}
                      <div>
                        <EgyptianLicensePlate 
                          letters={c.plate_letters} 
                          numbers={c.plate_numbers} 
                          vehicleType={c.vehicle_type || 'نقل'}
                        />
                      </div>

                    </div>

                    {/* Driver Section */}
                    <div style={{ 
                      marginTop: '1rem', 
                      paddingTop: '0.8rem', 
                      borderTop: '1px dashed #e2e8f0', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1.25rem' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '1rem', fontWeight: '500', minWidth: '125px' }}>
                        <span style={{ color: '#ea580c', fontSize: '1.25rem' }}>👤</span>
                        <span>قائد المركبة</span>
                      </div>
                      <span style={{ color: '#1e1b4b', fontSize: '1.1rem', fontWeight: '700' }}>
                        {c.driver_name || 'غير محدد'}
                      </span>
                    </div>

                    {/* Quick action bar at card footer */}
                    <div style={{
                      marginTop: '1rem',
                      paddingTop: '0.6rem',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                        {Number(c.transaction_count) || 0} عملية مسجلة
                      </span>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if (onCarClick) onCarClick(c); }}
                          style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                          title="عرض كشف المعاملات"
                        >
                          📂 كشف الحساب
                        </button>
                        <button 
                          onClick={(e) => handleEditClick(c, e)}
                          style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#d97706', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                          title="تعديل بيانات السيارة"
                        >
                          ✏️ تعديل
                        </button>
                        <button 
                          onClick={(e) => handleDeleteClick(c, e)}
                          style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
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
