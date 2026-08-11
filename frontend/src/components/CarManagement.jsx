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

      {/* Header Bar */}
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
    return { type: 'expired', label: `منتهية منذ ${Math.abs(diffDays)} يوم`, bg: 'rgba(239,68,68,0.15)', color: '#fca5a5' };
  } else if (diffDays <= 30) {
    return { type: 'warning', label: `تنتهي خلال ${diffDays} يوم`, bg: 'rgba(245,158,11,0.15)', color: '#fde047' };
  }
  return { type: 'ok', label: `رخصة صالحة (${expiryDateStr})`, bg: 'rgba(16,185,129,0.15)', color: '#86efac' };
}

export default function CarManagement({ onCarAdded, onCarClick }) {
  const [cars, setCars] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Form inputs state
  const [plateL1, setPlateL1] = useState('');
  const [plateL2, setPlateL2] = useState('');
  const [plateL3, setPlateL3] = useState('');
  const [plateNum, setPlateNum] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverRepId, setDriverRepId] = useState('');
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

  const loadReps = async () => {
    try {
      const res = await fetch('/api/reps');
      if (res.ok) {
        const data = await res.json();
        setRepresentatives(data);
      }
    } catch (e) {
      console.error('Error fetching reps', e);
    }
  };

  useEffect(() => {
    loadCars();
    loadReps();
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
        reqBody.append('driver_rep_id', driverRepId || '');
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
          driver_rep_id: driverRepId || null,
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
        setShowModal(false);
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
    setDriverRepId(c.driver_rep_id ? String(c.driver_rep_id) : '');
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
    setShowModal(true);
  };

  const handleDeleteClick = async (c, e) => {
    e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف السيارة ${c.plate_number}؟`)) return;
    
    try {
      const res = await fetch(`/api/cars/${c.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (editingCar && editingCar.id === c.id) {
          resetForm();
          setShowModal(false);
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
    setPlateL1(''); setPlateL2(''); setPlateL3(''); setPlateNum(''); setDriverName(''); setDriverRepId('');
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
      (c.rep_driver_name && c.rep_driver_name.includes(searchQuery)) ||
      (c.model && c.model.includes(searchQuery));
    
    const matchesStatus = statusFilter === 'جميع الحالات' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter representatives to only drivers if available
  const driversOnly = representatives.filter(r => r.classification === 'driver' || r.type === 'driver');
  const displayDrivers = driversOnly.length > 0 ? driversOnly : representatives;

  return (
    <div style={{ padding: '1rem', direction: 'rtl' }}>
      
      {/* Top Action Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary, #1e293b)', padding: '1rem 1.25rem', borderRadius: '20px', border: '1px solid var(--border-color, #334155)' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary, #f8fafc)', fontWeight: '800' }}>🚗 أسطول السيارات والمركبات</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>إدارة وتتبع سيارات الشركة، السائقين، العدادات والمصاريف</span>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{ padding: '0.7rem 1.25rem', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '14px', fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          ➕ إضافة سيارة جديدة للأسطول
        </button>
      </div>

      {/* Top Fleet Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', fontWeight: 'bold' }}>🚗 إجمالي السيارات</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: 'var(--text-primary, #f8fafc)', fontSize: '1.75rem', fontWeight: '800' }}>{cars.length}</h3>
        </div>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 'bold' }}>🟢 السيارات النشطة</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#4ade80', fontSize: '1.75rem', fontWeight: '800' }}>{activeCount}</h3>
        </div>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: '#fb923c', fontSize: '0.85rem', fontWeight: 'bold' }}>🔧 السيارات في الصيانة</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#fb923c', fontSize: '1.75rem', fontWeight: '800' }}>{maintenanceCount}</h3>
        </div>
        <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 'bold' }}>💰 إجمالي مصاريف الأسطول</span>
          <h3 style={{ margin: '0.4rem 0 0 0', color: '#60a5fa', fontSize: '1.4rem', fontWeight: '800' }}>
            {totalFleetExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
          </h3>
        </div>
      </div>

      {/* Fleet Filter Bar & Cars Grid */}
      <div style={{ background: 'var(--bg-primary, #0f172a)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color, #334155)' }}>
        
        {/* Search & Filter Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="🔍 ابحث برقم اللوحة، الموديل أو اسم السائق..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <select 
              className="input-field" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '160px' }}
            >
              <option value="جميع الحالات">جميع الحالات</option>
              <option value="نشطة">🟢 نشطة</option>
              <option value="صيانة">🟠 صيانة</option>
              <option value="خارج الخدمة">🔴 خارج الخدمة</option>
            </select>
          </div>
        </div>

        {/* Cars Cards Grid */}
        {filteredCars.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #94a3b8)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚘</div>
            <h4>لا توجد سيارات مطابقة لشروط البحث.</h4>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {filteredCars.map(c => {
              const totalExp = Number(c.total_expenses) || 0;
              const licAlert = getLicenseAlert(c.license_expiry_date);
              
              return (
                <div 
                  key={c.id} 
                  style={{
                    background: 'var(--bg-secondary, #1e293b)',
                    borderRadius: '18px',
                    border: '1px solid var(--border-color, #334155)',
                    padding: '1.15rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    transition: 'transform 0.2s, boxShadow 0.2s',
                    position: 'relative'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
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
                          backgroundColor: c.status === 'صيانة' ? 'rgba(245,158,11,0.15)' : c.status === 'خارج الخدمة' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                          color: c.status === 'صيانة' ? '#fb923c' : c.status === 'خارج الخدمة' ? '#fca5a5' : '#4ade80',
                          border: `1px solid ${c.status === 'صيانة' ? 'rgba(245,158,11,0.3)' : c.status === 'خارج الخدمة' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
                        }}>
                          {c.status === 'صيانة' ? '🟠 في الصيانة' : c.status === 'خارج الخدمة' ? '🔴 خارج الخدمة' : '🟢 نشطة'}
                        </span>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary, #cbd5e1)' }}>
                          ⛽ {c.fuel_type || 'سولار'}
                        </span>
                      </div>

                      {/* Vehicle Type & Model */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', fontWeight: '500' }}>نوع المركبة:</span>
                        <span style={{ color: 'var(--text-primary, #f8fafc)', fontSize: '1rem', fontWeight: '700' }}>{c.vehicle_type || 'نقل'} ({c.model || 'سوزوكي'})</span>
                      </div>

                      {/* Odometer */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', fontWeight: '500' }}>🛣️ العداد:</span>
                        <span style={{ color: 'var(--text-primary, #f8fafc)', fontSize: '0.95rem', fontWeight: '700' }}>
                          {c.odometer_km ? `${Number(c.odometer_km).toLocaleString('en-US')} كم` : 'غير مسجل'}
                        </span>
                      </div>

                      {/* Balance / Total expenses */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', fontWeight: '500' }}>مجموع المصاريف:</span>
                        <span style={{ color: '#4ade80', fontSize: '1.15rem', fontWeight: '800' }}>
                          {totalExp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                        </span>
                      </div>

                    </div>

                    {/* License Plate on Top-Left */}
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
                    borderTop: '1px dashed var(--border-color, #334155)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem', fontWeight: '500' }}>
                        <span style={{ color: '#f59e0b', fontSize: '1.1rem' }}>👤</span>
                        <span>قائد المركبة (السائق):</span>
                        <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{c.driver_name || 'غير محدد'}</strong>
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
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '0.35rem 0.6rem', borderRadius: '8px' }}>
                        📝 {c.notes}
                      </div>
                    )}
                  </div>

                  {/* Quick action bar at card footer */}
                  <div style={{
                    marginTop: '0.85rem',
                    paddingTop: '0.6rem',
                    borderTop: '1px solid var(--border-color, #334155)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: '600' }}>
                      {Number(c.transaction_count) || 0} عملية مسجلة
                    </span>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (onCarClick) onCarClick(c); }}
                        style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                        title="عرض كشف المعاملات"
                      >
                        📂 كشف الحساب
                      </button>
                      <button 
                        onClick={(e) => handleEditClick(c, e)}
                        style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fb923c', border: '1px solid rgba(245,158,11,0.3)', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                        title="تعديل بيانات السيارة"
                      >
                        ✏️ تعديل
                      </button>
                      <button 
                        onClick={(e) => handleDeleteClick(c, e)}
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
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

      {/* SEPARATE MODAL POPUP FORM (Dark Theme Glassmorphism) */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            direction: 'rtl',
            color: '#f8fafc'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontWeight: '800', fontSize: '1.25rem' }}>
                {editingCar ? '✏️ تعديل بيانات السيارة' : '➕ إضافة سيارة جديدة للأسطول'}
              </h3>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 1rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Plate inputs */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>رقم اللوحة المعدنية:</label>
                <div style={{ display: 'flex', gap: '0.5rem', direction: 'ltr', justifyContent: 'center' }}>
                  <input
                    type="text"
                    style={{ width: '90px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px' }}
                    value={plateNum}
                    onChange={(e) => setPlateNum(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="أرقام"
                    required
                  />
                  <span style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', color: '#64748b' }}>-</span>
                  <input
                    type="text"
                    style={{ width: '50px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px' }}
                    value={plateL3}
                    onChange={(e) => setPlateL3(e.target.value.slice(0, 1))}
                    placeholder="ح٣"
                  />
                  <input
                    type="text"
                    style={{ width: '50px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px' }}
                    value={plateL2}
                    onChange={(e) => setPlateL2(e.target.value.slice(0, 1))}
                    placeholder="ح٢"
                  />
                  <input
                    type="text"
                    style={{ width: '50px', textAlign: 'center', fontSize: '1.2rem', padding: '0.5rem', fontWeight: 'bold', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px' }}
                    value={plateL1}
                    onChange={(e) => setPlateL1(e.target.value.slice(0, 1))}
                    placeholder="ح١"
                    required
                  />
                </div>
              </div>

              {/* Vehicle Type & Model */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>نوع المركبة:</label>
                  <select 
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }} 
                    value={vehicleType} 
                    onChange={(e) => setVehicleType(e.target.value)}
                  >
                    <option value="نقل">🚚 نقل / شاحنة</option>
                    <option value="ملاكي">🚗 ملاكي / قيادي</option>
                    <option value="أجرة">🚕 أجرة / سرفيس</option>
                    <option value="فان">🚐 فان / ميكروباص</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>الطراز (الموديل):</label>
                  <input 
                    type="text" 
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }}
                    placeholder="سوزوكي / شيفروليه..." 
                    value={model} 
                    onChange={(e) => setModel(e.target.value)} 
                    required
                  />
                </div>
              </div>

              {/* Driver Account Selector (Strictly Drivers Only) */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>تحديد قائد المركبة (السائق المسجل):</label>
                <select 
                  style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }}
                  value={driverRepId}
                  onChange={(e) => {
                    setDriverRepId(e.target.value);
                    const found = representatives.find(r => String(r.id) === e.target.value);
                    setDriverName(found ? found.name : '');
                  }}
                  required
                >
                  <option value="">-- اختار السائق من قائمة السائقين المعتمدين --</option>
                  {displayDrivers.map(r => (
                    <option key={r.id} value={r.id}>
                      🚚 {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Odometer & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>قراءة العداد الحالية (كم):</label>
                  <input 
                    type="number" 
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }}
                    placeholder="مثال: 54000" 
                    value={odometerKm} 
                    onChange={(e) => setOdometerKm(e.target.value)} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>حالة السيارة:</label>
                  <select 
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }} 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="نشطة">🟢 نشطة</option>
                    <option value="صيانة">🟠 في الصيانة</option>
                    <option value="خارج الخدمة">🔴 خارج الخدمة</option>
                  </select>
                </div>
              </div>

              {/* Fuel Type & License Expiry Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>نوع الوقود المعتمد:</label>
                  <select 
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }} 
                    value={fuelType} 
                    onChange={(e) => setFuelType(e.target.value)}
                  >
                    <option value="سولار">⛽ سولار (20.50 ج.م)</option>
                    <option value="بنزين 80">⛽ بنزين 80 (20.75 ج.م)</option>
                    <option value="بنزين 92">⛽ بنزين 92 (22.25 ج.م)</option>
                    <option value="بنزين 95">⛽ بنزين 95 (24.00 ج.م)</option>
                    <option value="غاز">⛽ غاز (13.00 ج.م)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>تاريخ انتهاء الرخصة:</label>
                  <input 
                    type="date" 
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }}
                    value={licenseExpiryDate} 
                    onChange={(e) => setLicenseExpiryDate(e.target.value)} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>ملاحظات ومواصفات إضافية:</label>
                <textarea 
                  style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }}
                  rows="2"
                  placeholder="أي ملاحظات حول حالة المركبة أو الترخيص..." 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loading}
                  style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', fontWeight: '800', background: '#2563eb' }}
                >
                  {loading ? 'جاري الحفظ…' : (editingCar ? 'تحديث بيانات السيارة' : 'حفظ السيارة الجديدة')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setShowModal(false); resetForm(); }}
                  style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem' }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
