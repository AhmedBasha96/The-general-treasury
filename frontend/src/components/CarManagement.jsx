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

const getCleanImageUrl = (pathStr) => {
  if (!pathStr) return '';
  let cleanPath = String(pathStr).replace(/\\/g, '/');
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://') || cleanPath.startsWith('data:')) {
    return cleanPath;
  }
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  return cleanPath;
};

export default function CarManagement({ user, onCarClick, onCarAdded }) {
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
  const [oilIntervalKm, setOilIntervalKm] = useState('10000');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('جميع الحالات');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingCar, setEditingCar] = useState(null);

  // Oil Change Modal State
  const [showOilModal, setShowOilModal] = useState(false);
  const [oilCar, setOilCar] = useState(null);
  const [oilOdometer, setOilOdometer] = useState('');
  const [oilInterval, setOilInterval] = useState('10000');
  const [oilCost, setOilCost] = useState('');
  const [oilCenter, setOilCenter] = useState('');
  const [oilNotes, setOilNotes] = useState('');
  const [oilLoading, setOilLoading] = useState(false);

  // Fuel Logs Modal State
  const [showFuelLogsModal, setShowFuelLogsModal] = useState(false);
  const [fuelLogsCar, setFuelLogsCar] = useState(null);
  const [selectedCarFuelLogs, setSelectedCarFuelLogs] = useState([]);
  const [activeImageModal, setActiveImageModal] = useState(null);

  // Fuel Log Edit & Delete State
  const [editingFuelLog, setEditingFuelLog] = useState(null);
  const [editFuelOdo, setEditFuelOdo] = useState('');
  const [editFuelLiters, setEditFuelLiters] = useState('');
  const [editFuelType, setEditFuelType] = useState('سولار');
  const [editFuelPrice, setEditFuelPrice] = useState('');
  const [editFuelCost, setEditFuelCost] = useState('');
  const [editFuelStation, setEditFuelStation] = useState('');
  const [editFuelNotes, setEditFuelNotes] = useState('');

  // Maintenance / Oil Logs Modal State
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintLogsCar, setMaintLogsCar] = useState(null);
  const [selectedCarMaintLogs, setSelectedCarMaintLogs] = useState([]);
  const [editingMaintLog, setEditingMaintLog] = useState(null);
  const [editMaintType, setEditMaintType] = useState('تغيير زيت موتور وفلاتر');
  const [editMaintOdo, setEditMaintOdo] = useState('');
  const [editMaintNextKm, setEditMaintNextKm] = useState('');
  const [editMaintCost, setEditMaintCost] = useState('');
  const [editMaintCenter, setEditMaintCenter] = useState('');
  const [editMaintNotes, setEditMaintNotes] = useState('');

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

  const reloadFuelLogs = async (carId) => {
    try {
      const res = await fetch(`/api/cars/${carId}/fuel-logs?t=${new Date().getTime()}`);
      if (res.ok) setSelectedCarFuelLogs(await res.json());
      loadCars();
    } catch (e) {
      console.error(e);
    }
  };

  const reloadMaintLogs = async (carId) => {
    try {
      const res = await fetch(`/api/cars/${carId}/maintenance-logs?t=${new Date().getTime()}`);
      if (res.ok) setSelectedCarMaintLogs(await res.json());
      loadCars();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenFuelLogs = async (c, e) => {
    if (e) e.stopPropagation();
    setFuelLogsCar(c);
    setShowFuelLogsModal(true);
    setSelectedCarFuelLogs([]);
    setEditingFuelLog(null);
    try {
      const res = await fetch(`/api/cars/${c.id}/fuel-logs?t=${new Date().getTime()}`);
      if (res.ok) {
        setSelectedCarFuelLogs(await res.json());
      }
    } catch (err) {
      console.error('Error fetching fuel logs:', err);
    }
  };

  const handleOpenMaintLogs = async (c, e) => {
    if (e) e.stopPropagation();
    setMaintLogsCar(c);
    setShowMaintModal(true);
    setSelectedCarMaintLogs([]);
    setEditingMaintLog(null);
    try {
      const res = await fetch(`/api/cars/${c.id}/maintenance-logs?t=${new Date().getTime()}`);
      if (res.ok) {
        setSelectedCarMaintLogs(await res.json());
      }
    } catch (err) {
      console.error('Error fetching maintenance logs:', err);
    }
  };

  const handleDeleteFuelLog = async (logId) => {
    if (!window.confirm('⚠️ هل أنت محدد لحذف سجل التفويل هذا نهائياً من السيستم؟')) return;
    try {
      const res = await fetch(`/api/cars/fuel-logs/${logId}`, { method: 'DELETE' });
      if (res.ok) {
        if (fuelLogsCar) reloadFuelLogs(fuelLogsCar.id);
      } else {
        const d = await res.json();
        alert(d.error || 'فشل حذف السجل');
      }
    } catch (e) {
      alert('خطأ في الاتصال بالسيرفر');
    }
  };

  const handleSaveFuelLogEdit = async (e) => {
    e.preventDefault();
    if (!editingFuelLog) return;
    try {
      const res = await fetch(`/api/cars/fuel-logs/${editingFuelLog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odometer_reading: editFuelOdo,
          fuel_type: editFuelType,
          price_per_liter: editFuelPrice,
          liters: editFuelLiters,
          total_cost: editFuelCost,
          station_name: editFuelStation,
          notes: editFuelNotes
        })
      });
      if (res.ok) {
        setEditingFuelLog(null);
        if (fuelLogsCar) reloadFuelLogs(fuelLogsCar.id);
      } else {
        const d = await res.json();
        alert(d.error || 'فشل تعديل سجل التفويل');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالسيرفر');
    }
  };

  const handleDeleteMaintLog = async (logId) => {
    if (!window.confirm('⚠️ هل أنت محدد لحذف سجل الصيانة/الزيت هذا نهائياً؟')) return;
    try {
      const res = await fetch(`/api/cars/maintenance-logs/${logId}`, { method: 'DELETE' });
      if (res.ok) {
        if (maintLogsCar) reloadMaintLogs(maintLogsCar.id);
      } else {
        const d = await res.json();
        alert(d.error || 'فشل حذف سجل الصيانة');
      }
    } catch (e) {
      alert('خطأ في الاتصال بالسيرفر');
    }
  };

  const handleSaveMaintLogEdit = async (e) => {
    e.preventDefault();
    if (!editingMaintLog) return;
    try {
      const res = await fetch(`/api/cars/maintenance-logs/${editingMaintLog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenance_type: editMaintType,
          odometer_reading: editMaintOdo,
          next_service_km: editMaintNextKm,
          cost: editMaintCost,
          center_name: editMaintCenter,
          notes: editMaintNotes
        })
      });
      if (res.ok) {
        setEditingMaintLog(null);
        if (maintLogsCar) reloadMaintLogs(maintLogsCar.id);
      } else {
        const d = await res.json();
        alert(d.error || 'فشل تعديل سجل الصيانة');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالسيرفر');
    }
  };

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
        reqBody.append('oil_change_interval_km', oilIntervalKm);
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
          oil_change_interval_km: oilIntervalKm,
          notes: notes.trim()
        });
        headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch(url, { method, headers, body: reqBody });
      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
      }
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

  const handleOilSubmit = async (e) => {
    e.preventDefault();
    if (!oilCar || !oilOdometer) return alert('يرجى كتابة رقم العداد الحالي للسيارة');
    setOilLoading(true);

    try {
      const res = await fetch('/api/cars/oil-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          car_id: oilCar.id,
          odometer_reading: oilOdometer,
          oil_change_interval_km: oilInterval,
          cost: oilCost,
          center_name: oilCenter,
          notes: oilNotes
        })
      });

      if (res.ok) {
        alert(`تم تسجيل غيار الزيت للسيارة (${oilCar.plate_number}) وحساب العداد المستحق القادم بنجاح! 🛢️✅`);
        setShowOilModal(false);
        setOilCar(null);
        loadCars();
      } else {
        const d = await res.json();
        alert(d.error || 'فشل تسجيل غيار الزيت');
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم');
    } finally {
      setOilLoading(false);
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
    setOilIntervalKm(c.oil_change_interval_km ? String(c.oil_change_interval_km) : '10000');
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
    setOdometerKm(''); setLicenseExpiryDate(''); setStatus('نشطة'); setFuelType('سولار'); setOilIntervalKm('10000'); setNotes('');
    setImage(null);
    setError('');
  };

  const totalFleetExpenses = cars.reduce((acc, c) => acc + (Number(c.total_expenses) || 0), 0);
  const activeCount = cars.filter(c => c.status === 'نشطة' || !c.status).length;
  const maintenanceCount = cars.filter(c => c.status === 'صيانة').length;

  // Filter cars needing oil change (only for cars with recorded oil change history)
  const oilAlertCars = cars.filter(c => {
    if (c.remaining_oil_km === null || c.remaining_oil_km === undefined || !c.next_oil_change_km) return false;
    const rem = Number(c.remaining_oil_km);
    return !isNaN(rem) && rem <= 500;
  });

  const filteredCars = cars.filter(c => {
    const matchesSearch = !searchQuery || 
      (c.plate_number && c.plate_number.includes(searchQuery)) ||
      (c.driver_name && c.driver_name.includes(searchQuery)) ||
      (c.rep_driver_name && c.rep_driver_name.includes(searchQuery)) ||
      (c.model && c.model.includes(searchQuery));
    
    const matchesStatus = statusFilter === 'جميع الحالات' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Display all representatives (مناديب وسائقين) for car assignment
  const displayDrivers = representatives;

  return (
    <div style={{ padding: '1rem', direction: 'rtl' }}>
      
      {/* Top Action Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary, #1e293b)', padding: '1rem 1.25rem', borderRadius: '20px', border: '1px solid var(--border-color, #334155)' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary, #f8fafc)', fontWeight: '800' }}>🚗 أسطول السيارات والمركبات</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>إدارة وتتبع سيارات الشركة، السائقين، العدادات، المحروقات وصور العدادات بالمحطة</span>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{ padding: '0.7rem 1.25rem', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '14px', fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          ➕ إضافة سيارة جديدة للأسطول
        </button>
      </div>

      {/* OIL CHANGE ALERTS BOX FROM REFUEL LOGS */}
      {oilAlertCars.length > 0 && (
        <div className="due-alerts-box" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
          <div className="due-alerts-header">
            <span className="due-bell" style={{ fontSize: '1.8rem' }}>🛢️</span>
            <div>
              <h3 style={{ margin: 0, color: '#f87171', fontSize: '1.05rem', fontWeight: 800 }}>تنبيهات غيار زيت المحرك (متابعة قراءات التفويل والعدادات الحالية)</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>تم اكتشاف سيارات وصلت لعداد غيار الزيت المستحق من واقع قراءات التفويل الأخيرة:</p>
            </div>
          </div>
          <div className="due-alerts-list">
            {oilAlertCars.map(c => {
              const rem = Number(c.remaining_oil_km);
              const isOverdue = rem <= 0;
              return (
                <div key={c.id} className={`due-alert-item ${isOverdue ? 'overdue' : 'upcoming'}`}>
                  <div className="due-info">
                    <span className="due-title" style={{ fontSize: '0.95rem' }}>
                      {isOverdue ? '🚨 مستحق غيار الزيت فوراً!' : '🟡 اقترب موعد غيار الزيت'}: السيارة ({c.plate_number}) - السائق: {c.driver_name || 'غير محدد'}
                    </span>
                    <span className="due-date">
                      آخر عداد تفويل: <strong>{Number(c.last_odometer || c.odometer_km || 0).toLocaleString()} كم</strong> | العداد المستحق: <strong>{Number(c.next_oil_change_km || 10000).toLocaleString()} كم</strong>
                    </span>
                  </div>
                  <div className="due-actions">
                    <span className="due-amount" style={{ fontSize: '0.95rem', color: isOverdue ? '#f43f5e' : '#f59e0b' }}>
                      {isOverdue ? `تجاوز الموعد بـ ${Math.abs(rem).toLocaleString()} كم` : `متبقي ${rem.toLocaleString()} كم`}
                    </span>
                    <button 
                      className="btn btn-xs btn-primary"
                      onClick={() => {
                        setOilCar(c);
                        setOilOdometer(String(c.last_odometer || c.odometer_km || ''));
                        setShowOilModal(true);
                      }}
                    >
                      🛢️ تسجيل غيار زيت
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              const remOil = Number(c.remaining_oil_km);
              const isOilOverdue = !isNaN(remOil) && remOil <= 0;
              const isOilWarning = !isNaN(remOil) && remOil > 0 && remOil <= 500;
              
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', fontWeight: '500' }}>🛣️ العداد الحالي:</span>
                        <span style={{ color: 'var(--text-primary, #f8fafc)', fontSize: '0.95rem', fontWeight: '700' }}>
                          {Number(c.last_odometer || c.odometer_km || 0).toLocaleString('en-US')} كم
                        </span>
                      </div>

                      {/* Engine Oil Status Badge */}
                      {c.remaining_oil_km === null || c.remaining_oil_km === undefined || !c.next_oil_change_km ? (
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '10px',
                          background: 'rgba(148, 163, 184, 0.15)',
                          color: '#94a3b8',
                          border: '1px solid rgba(148, 163, 184, 0.3)'
                        }}>
                          ⏳ لم يتم تسجيل غيار زيت بعد (في انتظار الغيار الأول)
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '10px',
                          background: isOilOverdue ? 'rgba(244,63,94,0.15)' : isOilWarning ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)',
                          color: isOilOverdue ? '#f43f5e' : isOilWarning ? '#f59e0b' : '#10b981',
                          border: `1px solid ${isOilOverdue ? 'rgba(244,63,94,0.35)' : isOilWarning ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.3)'}`
                        }}>
                          🛢️ زيت المحرك: {isOilOverdue ? `🚨 مستحق غيار الآن (تجاوز بـ ${Math.abs(remOil).toLocaleString()} كم)` : isOilWarning ? `🟡 باقي ${remOil.toLocaleString()} كم على الغيار` : `🟢 ممتاز (متبقي ${remOil.toLocaleString()} كم)`}
                        </div>
                      )}

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
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button 
                        onClick={(e) => handleOpenFuelLogs(c, e)}
                        style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                        title="عرض صور عداد التفويل المسجلة بالمحطة"
                      >
                        📷 سجل التفويل
                      </button>

                      <button 
                        onClick={(e) => handleOpenMaintLogs(c, e)}
                        style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                        title="عرض وإدارة سجلات الزيت والصيانة"
                      >
                        📋 سجل الزيت
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOilCar(c);
                          setOilOdometer(String(c.last_odometer || c.odometer_km || ''));
                          setShowOilModal(true);
                        }}
                        style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                        title="تسجيل تغيير زيت جديد للمحرك"
                      >
                        🛢️ + غيار زيت
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
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

      {/* MODAL FORM: FUEL LOGS & METER PHOTOS VIEW (FOR MANAGER) WITH EDIT & DELETE */}
      {showFuelLogsModal && fuelLogsCar && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '920px', background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)', color: '#f8fafc', borderRadius: '24px', border: '1px solid #334155', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', padding: '1.5rem' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="panel-title" style={{ color: '#60a5fa', margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                  📷 سجل تفويل الوقود وصور العدادات
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  السيارة: <strong style={{ color: '#f8fafc' }}>{fuelLogsCar.plate_number}</strong> | السائق: {fuelLogsCar.driver_name || 'غير محدد'}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowFuelLogsModal(false)} style={{ borderRadius: '12px' }}>✕ إغلاق</button>
            </div>

            {/* Summary Stat Cards Header */}
            {selectedCarFuelLogs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px', padding: '0.85rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#93c5fd' }}>⛽ إجمالي التفويلات</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#38bdf8' }}>
                    {selectedCarFuelLogs.reduce((sum, l) => sum + (parseFloat(l.liters) || 0), 0).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>لتر</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '16px', padding: '0.85rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#86efac' }}>💰 إجمالي التكلفة</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#4ade80' }}>
                    {selectedCarFuelLogs.reduce((sum, l) => sum + (parseFloat(l.total_cost) || 0), 0).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>ج.م</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '16px', padding: '0.85rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#d8b4fe' }}>🛣️ أحدث قراءة عداد</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#c084fc' }}>
                    {Math.max(...selectedCarFuelLogs.map(l => parseInt(l.odometer_reading, 10) || 0), 0).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>كم</span>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Edit Form Overlay if editing a log */}
            {editingFuelLog && (
              <form onSubmit={handleSaveFuelLogEdit} style={{ background: '#1e293b', border: '2px solid #3b82f6', borderRadius: '16px', padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#60a5fa', fontSize: '0.95rem' }}>✏️ تعديل سجل التفويل (رقم #{editingFuelLog.id})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>العداد (كم):</label>
                    <input type="number" className="form-input" value={editFuelOdo} onChange={e=>setEditFuelOdo(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>عدد اللترات:</label>
                    <input type="number" step="0.1" className="form-input" value={editFuelLiters} onChange={e=>setEditFuelLiters(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>نوع الوقود:</label>
                    <select className="form-input" value={editFuelType} onChange={e=>setEditFuelType(e.target.value)}>
                      <option value="سولار">سولار</option>
                      <option value="بنزين 92">بنزين 92</option>
                      <option value="بنزين 95">بنزين 95</option>
                      <option value="بنزين 80">بنزين 80</option>
                      <option value="غاز">غاز طبيعي</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>سعر اللتر (ج.م):</label>
                    <input type="number" step="0.1" className="form-input" value={editFuelPrice} onChange={e=>{
                      setEditFuelPrice(e.target.value);
                      if (editFuelLiters && e.target.value) setEditFuelCost(parseFloat(editFuelLiters) * parseFloat(e.target.value));
                    }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>إجمالي التكلفة (ج.م):</label>
                    <input type="number" step="0.1" className="form-input" value={editFuelCost} onChange={e=>setEditFuelCost(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>اسم المحطة:</label>
                    <input type="text" className="form-input" value={editFuelStation} onChange={e=>setEditFuelStation(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setEditingFuelLog(null)}>إلغاء</button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ background: '#16a34a' }}>حفظ التعديلات ✅</button>
                </div>
              </form>
            )}

            {/* Main Logs Table */}
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {selectedCarFuelLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⛽</div>
                  لا توجد عمليات تفويل مسجلة لهذه السيارة حتى الآن.
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#94a3b8' }}>
                      <th>التاريخ والوقت</th>
                      <th>العداد</th>
                      <th>نوع الوقود واللترات</th>
                      <th>المبلغ الإجمالي</th>
                      <th>المحطة</th>
                      <th>صورة العداد</th>
                      <th style={{ textAlign: 'center' }}>العمليات (أدمن)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCarFuelLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.date).toLocaleString('ar-EG')}</td>
                        <td><strong style={{ color: '#38bdf8' }}>{Number(log.odometer_reading).toLocaleString()} كم</strong></td>
                        <td>
                          <span style={{ 
                            background: log.fuel_type === 'سولار' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                            color: log.fuel_type === 'سولار' ? '#fde047' : '#93c5fd',
                            padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' 
                          }}>
                            {log.fuel_type || 'سولار'}
                          </span>
                          <span style={{ marginRight: '0.4rem', fontWeight: 'bold' }}>{log.liters} لتر</span>
                        </td>
                        <td><strong style={{ color: '#4ade80' }}>{Number(log.total_cost).toLocaleString()} ج.م</strong></td>
                        <td>{log.station_name || '—'}</td>
                        <td>
                          {log.image_path ? (
                            <button 
                              className="btn btn-xs btn-primary"
                              onClick={() => setActiveImageModal(log.image_path)}
                              style={{ background: '#7c3aed', color: '#fff', padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              🔍 معاينة الصورة 📷
                            </button>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>بدون صورة</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button 
                              onClick={() => {
                                setEditingFuelLog(log);
                                setEditFuelOdo(log.odometer_reading || '');
                                setEditFuelLiters(log.liters || '');
                                setEditFuelType(log.fuel_type || 'سولار');
                                setEditFuelPrice(log.price_per_liter || '');
                                setEditFuelCost(log.total_cost || '');
                                setEditFuelStation(log.station_name || '');
                                setEditFuelNotes(log.notes || '');
                              }}
                              style={{ background: 'rgba(245,158,11,0.2)', color: '#fde047', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                              title="تعديل تفويل"
                            >
                              ✏️ تعديل
                            </button>
                            <button 
                              onClick={() => handleDeleteFuelLog(log.id)}
                              style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                              title="حذف تفويل"
                            >
                              🗑️ حذف
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
        </div>
      )}

      {/* MODAL FORM: MAINTENANCE & OIL LOGS VIEW (FOR MANAGER) WITH EDIT & DELETE */}
      {showMaintModal && maintLogsCar && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '920px', background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)', color: '#f8fafc', borderRadius: '24px', border: '1px solid #334155', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', padding: '1.5rem' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="panel-title" style={{ color: '#34d399', margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                  🛢️ سجل غيار الزيت والصيانة الدورية
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  السيارة: <strong style={{ color: '#f8fafc' }}>{maintLogsCar.plate_number}</strong> | السائق: {maintLogsCar.driver_name || 'غير محدد'}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowMaintModal(false)} style={{ borderRadius: '12px' }}>✕ إغلاق</button>
            </div>

            {/* Oil Progress Bar Card Header */}
            {(() => {
              const currentOdo = maintLogsCar.last_odometer || maintLogsCar.odometer_km || 0;
              const lastOilKm = maintLogsCar.last_oil_change_km || currentOdo;
              const interval = maintLogsCar.oil_change_interval_km || 10000;
              const nextOilKm = maintLogsCar.next_oil_change_km || (lastOilKm + interval);
              const remaining = nextOilKm - currentOdo;
              const isOverdue = remaining <= 0;
              const progressPct = Math.min(100, Math.max(0, ((currentOdo - lastOilKm) / interval) * 100));

              return (
                <div style={{ background: isOverdue ? 'rgba(239,68,68,0.12)' : remaining <= 2000 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', border: `1px solid ${isOverdue ? '#ef4444' : remaining <= 2000 ? '#f59e0b' : '#10b981'}`, borderRadius: '16px', padding: '1rem', margin: '1rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: '800', color: isOverdue ? '#fca5a5' : remaining <= 2000 ? '#fde047' : '#6ee7b7' }}>
                      {isOverdue ? '⚠️ تنبيه: موعد غيار الزيت متأخر ويحتاج تغيير فوراً!' : remaining <= 2000 ? '⚠️ تنبيه: اقترب موعد تغيير الزيت' : '✅ حالة الزيت صالحة'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      متبقي: <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{remaining.toLocaleString()} كم</strong> (كل {interval.toLocaleString()} كم)
                    </div>
                  </div>
                  <div style={{ background: '#334155', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, background: isOverdue ? '#ef4444' : remaining <= 2000 ? '#f59e0b' : '#10b981', height: '100%', borderRadius: '10px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                    <span>آخر غيار: {lastOilKm.toLocaleString()} كم</span>
                    <span>العداد الحالي: {currentOdo.toLocaleString()} كم</span>
                    <span>الموعد القادم: {nextOilKm.toLocaleString()} كم</span>
                  </div>
                </div>
              );
            })()}

            {/* Inline Edit Form Overlay if editing maintenance log */}
            {editingMaintLog && (
              <form onSubmit={handleSaveMaintLogEdit} style={{ background: '#1e293b', border: '2px solid #10b981', borderRadius: '16px', padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#34d399', fontSize: '0.95rem' }}>✏️ تعديل سجل الصيانة/الزيت (رقم #{editingMaintLog.id})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>نوع الصيانة:</label>
                    <input type="text" className="form-input" value={editMaintType} onChange={e=>setEditMaintType(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>العداد وقت الصيانة:</label>
                    <input type="number" className="form-input" value={editMaintOdo} onChange={e=>setEditMaintOdo(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>العداد المستهدف القادم:</label>
                    <input type="number" className="form-input" value={editMaintNextKm} onChange={e=>setEditMaintNextKm(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>التكلفة (ج.م):</label>
                    <input type="number" step="0.1" className="form-input" value={editMaintCost} onChange={e=>setEditMaintCost(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>مركز الصيانة / الورشة:</label>
                    <input type="text" className="form-input" value={editMaintCenter} onChange={e=>setEditMaintCenter(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setEditingMaintLog(null)}>إلغاء</button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ background: '#16a34a' }}>حفظ التعديلات ✅</button>
                </div>
              </form>
            )}

            {/* Main Maintenance Logs Table */}
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {selectedCarMaintLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛢️</div>
                  لا توجد عمليات صيانة أو غيار زيت مسجلة لهذه السيارة حتى الآن.
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#94a3b8' }}>
                      <th>التاريخ والوقت</th>
                      <th>نوع الصيانة</th>
                      <th>العداد وقت الصيانة</th>
                      <th>العداد القادم</th>
                      <th>التكلفة</th>
                      <th>مركز الصيانة</th>
                      <th style={{ textAlign: 'center' }}>العمليات (أدمن)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCarMaintLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.date).toLocaleString('ar-EG')}</td>
                        <td><strong style={{ color: '#34d399' }}>{log.maintenance_type || 'غيار زيت'}</strong></td>
                        <td><strong>{Number(log.odometer_reading).toLocaleString()} كم</strong></td>
                        <td><strong style={{ color: '#fb923c' }}>{Number(log.next_service_km).toLocaleString()} كم</strong></td>
                        <td><strong style={{ color: '#4ade80' }}>{Number(log.cost || 0).toLocaleString()} ج.م</strong></td>
                        <td>{log.center_name || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button 
                              onClick={() => {
                                setEditingMaintLog(log);
                                setEditMaintType(log.maintenance_type || 'تغيير زيت موتور وفلاتر');
                                setEditMaintOdo(log.odometer_reading || '');
                                setEditMaintNextKm(log.next_service_km || '');
                                setEditMaintCost(log.cost || '');
                                setEditMaintCenter(log.center_name || '');
                                setEditMaintNotes(log.notes || '');
                              }}
                              style={{ background: 'rgba(245,158,11,0.2)', color: '#fde047', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                              title="تعديل صيانة"
                            >
                              ✏️ تعديل
                            </button>
                            <button 
                              onClick={() => handleDeleteMaintLog(log.id)}
                              style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                              title="حذف صيانة"
                            >
                              🗑️ حذف
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
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {activeImageModal && (
        <div 
          onClick={() => setActiveImageModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '1rem' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img 
              src={getCleanImageUrl(activeImageModal)} 
              alt="صورة عداد المحطة" 
              onError={(e) => {
                if (!e.target.dataset.fallbackTried) {
                  e.target.dataset.fallbackTried = 'true';
                  const clean = getCleanImageUrl(activeImageModal);
                  const origin = window.location.origin || '';
                  e.target.src = `${origin}${clean}?t=${Date.now()}`;
                } else {
                  e.target.style.display = 'none';
                  const errBox = document.getElementById('car-image-error-box');
                  if (errBox) errBox.style.display = 'block';
                }
              }}
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '16px', border: '2px solid #ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'block' }} 
            />
            <div id="car-image-error-box" style={{ display: 'none', background: '#1e293b', padding: '2rem 2.5rem', borderRadius: '20px', color: '#f8fafc', textAlign: 'center', border: '2px solid #334155', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#f43f5e', fontWeight: 'bold' }}>تعذر فتح ملف صورة العداد</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>ملف الصورة غير متوفر بالسيرفر لهذه العملية.</p>
            </div>
            <button 
              onClick={() => setActiveImageModal(null)}
              style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* MODAL FORM: OIL CHANGE REGISTRATION */}
      {showOilModal && oilCar && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: '500px' }}>
            <div className="panel-header">
              <h3 className="panel-title">🛢️ تسجيل غيار زيت جديد للسيارة ({oilCar.plate_number})</h3>
              <button className="btn btn-secondary" onClick={() => setShowOilModal(false)}>✕ إغلاق</button>
            </div>

            <form onSubmit={handleOilSubmit}>
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>السائق: <strong>{oilCar.driver_name || 'غير محدد'}</strong></div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  آخر عداد مسجل من التفويل: <strong>{Number(oilCar.last_odometer || oilCar.odometer_km || 0).toLocaleString()} كم</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>قراءة العداد الحالية عند تغيير الزيت (كم):*</label>
                <input
                  type="number"
                  placeholder="مثال: 125000"
                  value={oilOdometer}
                  onChange={e => setOilOdometer(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>نوع/عمر الزيت الجديد (الكيلومترات المسموحة):*</label>
                <select value={oilInterval} onChange={e => setOilInterval(e.target.value)}>
                  <option value="10000">🛢️ زيت 10,000 كم (تخليقي كامل)</option>
                  <option value="7000">🛢️ زيت 7,000 كم (7 آلاف)</option>
                  <option value="5000">🛢️ زيت 5,000 كم (نصف تخليقي)</option>
                  <option value="3000">🛢️ زيت 3,000 كم (معدني)</option>
                  <option value="2000">🛢️ زيت 2,000 كم (2 ألف)</option>
                  <option value="1000">🛢️ زيت 1,000 كم (تشغيل / تلين)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>تكلفة تغيير الزيت (ج.م - اختياري):</label>
                <input
                  type="number"
                  step="any"
                  placeholder="مثال: 1500"
                  value={oilCost}
                  onChange={e => setOilCost(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>مركز الصيانة / المورّد (اختياري):</label>
                <input
                  type="text"
                  placeholder="اسم المحل أو التوكيل..."
                  value={oilCenter}
                  onChange={e => setOilCenter(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>ملاحظات إضافية:</label>
                <input
                  type="text"
                  placeholder="نوع الفلتر، الماركة..."
                  value={oilNotes}
                  onChange={e => setOilNotes(e.target.value)}
                />
              </div>

              <button type="submit" disabled={oilLoading} className="btn btn-primary" style={{ width: '100%' }}>
                {oilLoading ? 'جاري الحفظ...' : 'تأكيد تسجيل غيار الزيت وتحديث العداد القادم 🛢️✅'}
              </button>
            </form>
          </div>
        </div>
      )}

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

              {/* Driver / Delegate Account Selector */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>تحديد قائد المركبة (المندوب أو السائق المسجل):</label>
                <select 
                  style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }}
                  value={driverRepId}
                  onChange={(e) => {
                    setDriverRepId(e.target.value);
                    const found = representatives.find(r => String(r.id) === e.target.value);
                    setDriverName(found ? found.name : '');
                  }}
                >
                  <option value="">-- اختر قائد المركبة من قائمة المناديب والسائقين --</option>
                  {displayDrivers.map(r => {
                    const isDriver = r.classification === 'driver' || r.type === 'driver';
                    return (
                      <option key={r.id} value={r.id}>
                        {isDriver ? '🚚' : '👤'} {r.name} ({r.code}) {isDriver ? '[سائق]' : '[مندوب]'}
                      </option>
                    );
                  })}
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

              {/* Fuel Type & Oil Interval & License Expiry */}
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
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#cbd5e1' }}>دورة غيار الزيت المعتمدة (كم):</label>
                  <select 
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '0.65rem' }} 
                    value={oilIntervalKm} 
                    onChange={(e) => setOilIntervalKm(e.target.value)}
                  >
                    <option value="10000">🛢️ زيت 10,000 كم (تخليقي كامل)</option>
                    <option value="7000">🛢️ زيت 7,000 كم (7 آلاف)</option>
                    <option value="5000">🛢️ زيت 5,000 كم (نصف تخليقي)</option>
                    <option value="3000">🛢️ زيت 3,000 كم (معدني)</option>
                    <option value="2000">🛢️ زيت 2,000 كم (2 ألف)</option>
                    <option value="1000">🛢️ زيت 1,000 كم (تشغيل / تلين)</option>
                  </select>
                </div>
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
