import React, { useState, useEffect } from 'react';

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
      <div style={{ position: 'absolute', top: '3px', left: '6px', width: '5px', height: '5px', borderRadius: '50%', background: '#475569', zIndex: 3, border: '1px solid #1e293b' }} />
      <div style={{ position: 'absolute', top: '3px', right: '6px', width: '5px', height: '5px', borderRadius: '50%', background: '#475569', zIndex: 3, border: '1px solid #1e293b' }} />

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

      <div style={{
        flex: 1,
        display: 'flex',
        direction: 'rtl',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '0 4px'
      }}>
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
        <div style={{ width: '2px', height: '75%', backgroundColor: '#94a3b8' }} />
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

// Compress client-side camera images to fast-uploading JPG (< 300KB)
const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) => {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressedFile = new File([blob], file.name || 'odometer.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

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

export default function DriverPortal({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showOilModal, setShowOilModal] = useState(false);
  const [activeImageModal, setActiveImageModal] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  // Fuel Form state
  const [fuelType, setFuelType] = useState('سولار');
  const [officialPrice, setOfficialPrice] = useState(20.50);
  const [liters, setLiters] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [stationName, setStationName] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');
  const [fuelImage, setFuelImage] = useState(null);
  const [compressingImage, setCompressingImage] = useState(false);

  // Oil/Maintenance Form state
  const [maintenanceType, setMaintenanceType] = useState('تغيير زيت موتور وفلاتر (10,000 كم)');
  const [selectedDriverOilKm, setSelectedDriverOilKm] = useState(10000);
  const [oilOdometer, setOilOdometer] = useState('');
  const [nextKm, setNextKm] = useState('');
  const [oilCost, setOilCost] = useState('');
  const [centerName, setCenterName] = useState('');
  const [oilNotes, setOilNotes] = useState('');

  // Fuel price mapping
  const fuelPriceMap = {
    'سولار': 20.50,
    'بنزين 80': 20.75,
    'بنزين 92': 22.25,
    'بنزين 95': 24.00,
    'غاز': 13.00
  };

  const loadDriverCar = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cars/driver/my-car/${user.id}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        if (result.car) {
          setOdometerReading(result.car.odometer_km ? String(result.car.odometer_km) : '');
          setOilOdometer(result.car.odometer_km ? String(result.car.odometer_km) : '');
          if (result.car.fuel_type && fuelPriceMap[result.car.fuel_type]) {
            setFuelType(result.car.fuel_type);
            setOfficialPrice(fuelPriceMap[result.car.fuel_type]);
          }
        }
      } else {
        const err = await res.json();
        setError(err.error || 'لم يتم العثور على سيارة مسندة بحسابك');
      }
    } catch (e) {
      console.error(e);
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriverCar();
  }, [user]);

  // Open refuel modal prefilled with car's assigned fuel type
  const handleOpenFuelModal = () => {
    const assignedFuel = car?.fuel_type || 'سولار';
    setFuelType(assignedFuel);
    const p = fuelPriceMap[assignedFuel] || 20.50;
    setOfficialPrice(p);
    setLiters('');
    setTotalCost('');
    setOdometerReading('');
    setStationName('');
    setFuelNotes('');
    setFuelImage(null);
    setShowFuelModal(true);
  };

  // Open oil change modal prefilled using car's exact assigned oil interval (e.g. 2000, 5000 km)
  const handleOpenOilModal = () => {
    const currentOdoVal = car?.last_odometer || car?.odometer_km || '';
    const assignedInterval = Number(car?.oil_change_interval_km || 10000);
    setOilOdometer(currentOdoVal ? String(currentOdoVal) : '');
    if (currentOdoVal && !isNaN(currentOdoVal)) {
      setNextKm(String(Number(currentOdoVal) + assignedInterval));
    } else {
      setNextKm('');
    }
    setOilCost('');
    setCenterName('');
    setOilNotes('');
    setShowOilModal(true);
  };

  // When fuel type changes, update official fixed price per liter
  const handleFuelTypeChange = (type) => {
    setFuelType(type);
    const p = fuelPriceMap[type] || 20.50;
    setOfficialPrice(p);
    if (liters) {
      setTotalCost((parseFloat(liters) * p).toFixed(2));
    }
  };

  // When liters change, auto calculate total cost
  const handleLitersChange = (val) => {
    setLiters(val);
    if (val && !isNaN(val)) {
      setTotalCost((parseFloat(val) * officialPrice).toFixed(2));
    } else {
      setTotalCost('');
    }
  };

  // When total cost changes, auto calculate liters
  const handleTotalCostChange = (val) => {
    setTotalCost(val);
    if (val && !isNaN(val) && officialPrice > 0) {
      setLiters((parseFloat(val) / officialPrice).toFixed(2));
    } else {
      setLiters('');
    }
  };

  // Handle camera photo selection with automatic client-side compression
  const handleImageSelect = async (e) => {
    const rawFile = e.target.files[0];
    if (!rawFile) {
      setFuelImage(null);
      return;
    }
    setCompressingImage(true);
    try {
      const compressed = await compressImage(rawFile);
      setFuelImage(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
      setFuelImage(rawFile);
    } finally {
      setCompressingImage(false);
    }
  };

  // Submit Refuel Entry (with mandatory photo)
  const handleFuelSubmit = async (e) => {
    e.preventDefault();
    if (!data?.car?.id) return;
    if (!odometerReading || !liters) {
      return alert('يرجى إدخال قراءة العداد وعدد اللترات');
    }
    if (!fuelImage) {
      return alert('⚠️ إلزامية التقاط صورة حية لعداد المحطة بالكاميرا للتمكن من حفظ عملية التفويل!');
    }

    setFormLoading(true);
    try {
      let imageToUpload = fuelImage;
      if (imageToUpload && imageToUpload.size > 1024 * 1024) {
        setFormMessage('⚡ جاري تجهيز وضغط صورة العداد لتسريع الرفع...');
        imageToUpload = await compressImage(imageToUpload);
      }

      const formData = new FormData();
      formData.append('car_id', data.car.id);
      formData.append('driver_rep_id', user.id);
      formData.append('odometer_reading', odometerReading);
      formData.append('fuel_type', fuelType);
      formData.append('price_per_liter', officialPrice);
      formData.append('liters', liters);
      formData.append('total_cost', totalCost);
      formData.append('station_name', stationName);
      formData.append('notes', fuelNotes);
      formData.append('image', imageToUpload);

      const res = await fetch('/api/cars/driver/refuel', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (res.ok) {
        setFormMessage('✅ تم تسجيل تفويل الوقود وصورة العداد بنجاح!');
        setTimeout(() => { setFormMessage(''); setShowFuelModal(false); setFuelImage(null); }, 1500);
        loadDriverCar();
      } else {
        alert(result.error || 'فشل حفظ عملية الوقود');
      }
    } catch (err) {
      console.error('Refuel upload error:', err);
      alert('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو المحاولة مرة أخرى.');
    } finally {
      setFormLoading(false);
    }
  };

  // Submit Oil Change Entry
  const handleOilSubmit = async (e) => {
    e.preventDefault();
    if (!data?.car?.id) return;
    if (!oilOdometer) return alert('يرجى إدخال عداد السيارة الحالي عند غيار الزيت');

    const assignedInterval = Number(car?.oil_change_interval_km || 10000);
    const calculatedNextKm = nextKm || String(parseInt(oilOdometer, 10) + assignedInterval);

    setFormLoading(true);
    try {
      const res = await fetch('/api/cars/driver/oil-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          car_id: data.car.id,
          driver_rep_id: user.id,
          odometer_reading: oilOdometer,
          next_service_km: calculatedNextKm,
          cost: oilCost || 0,
          center_name: centerName,
          notes: oilNotes
        })
      });

      const result = await res.json();
      if (res.ok) {
        setFormMessage('✅ تم تسجيل غيار الزيت وتحديث العداد القادم بنجاح!');
        setTimeout(() => { setFormMessage(''); setShowOilModal(false); }, 1500);
        loadDriverCar();
      } else {
        alert(result.error || 'فشل حفظ عملية غيار الزيت');
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', direction: 'rtl', color: 'var(--text-muted, #64748b)' }}>
        <h3>⏳ جاري جلب بيانات سيارتك…</h3>
      </div>
    );
  }

  if (error || !data?.car) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '2rem auto', direction: 'rtl', background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚗</div>
        <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>بوابة السائق - تنبيه</h3>
        <p style={{ color: '#475569', marginBottom: '1.5rem' }}>{error || 'لم يتم العثور على سيارة مسندة باسمك في النظام.'}</p>
        <button onClick={onLogout} className="btn btn-secondary">تسجيل الخروج</button>
      </div>
    );
  }

  const { car, recentFuelLogs, recentMaintenanceLogs } = data;

  // Calculate Oil Remaining KM for Driver (Only active after first recorded oil change)
  const hasOilHistory = Boolean(car.next_oil_change_km && car.next_oil_change_km > 0);
  const currentOdo = Number(car.last_odometer || car.odometer_km || 0);
  const nextOilKm = hasOilHistory ? Number(car.next_oil_change_km) : 0;
  const remainingOilKm = hasOilHistory ? (nextOilKm - currentOdo) : null;
  const isOilOverdue = hasOilHistory && remainingOilKm <= 0;
  const isOilWarning = hasOilHistory && remainingOilKm > 0 && remainingOilKm <= 500;

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto', direction: 'rtl' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '1rem 1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a', fontWeight: '800' }}>مرحباً يا قائد المركبة، {user?.name || user?.username} 👋</h3>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>بوابة متابعة السيارة والتفويل وغيار الزيت وتصوير العدادات</span>
        </div>
        <button onClick={onLogout} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
          🔒 خروج
        </button>
      </div>

      {/* PROMINENT DRIVER OIL CHANGE ALERT BANNER */}
      {(isOilOverdue || isOilWarning) && (
        <div style={{
          background: isOilOverdue ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#ffffff',
          padding: '1.25rem 1.5rem',
          borderRadius: '20px',
          marginBottom: '1.5rem',
          boxShadow: isOilOverdue ? '0 10px 25px rgba(239, 68, 68, 0.4)' : '0 10px 25px rgba(245, 158, 11, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '2.5rem', animation: 'bellRing 1s infinite alternate' }}>🛢️</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>
              {isOilOverdue ? '🚨 تنبيه عاجل جداً: سيارتك وصلت لموعد غيار الزيت المستحق!' : '🟡 تنبيه هاب: اقترب موعد غيار الزيت لسيارتك!'}
            </h3>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', lineHeight: '1.5', opacity: 0.95 }}>
              سيارتك ({car.plate_number}) وصل عدادها إلى <strong>{currentOdo.toLocaleString()} كم</strong> والعداد المستحق لغيار الزيت هو <strong>{nextOilKm.toLocaleString()} كم</strong>.
              {isOilOverdue ? ` (تجاوزت العداد بـ ${Math.abs(remainingOilKm).toLocaleString()} كم - يرجى التوجه لمركز الخدمة لغيار الزيت فوراً!)` : ` (متبقي ${remainingOilKm.toLocaleString()} كم فقط).`}
            </p>
          </div>
          <button 
            onClick={() => setShowOilModal(true)}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#ffffff',
              color: isOilOverdue ? '#dc2626' : '#d97706',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            🛢️ تسجيل غيار الزيت الآن
          </button>
        </div>
      )}

      {/* Main Car Card */}
      <div style={{ background: '#ffffff', borderRadius: '24px', border: '2px solid #3b82f6', padding: '1.5rem', boxShadow: '0 10px 30px rgba(59, 130, 246, 0.08)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', fontWeight: '800', fontSize: '0.85rem' }}>
              {car.status === 'صيانة' ? '🟠 في الصيانة' : '🟢 سيارتك النشطة'}
            </span>
            <h2 style={{ margin: '0.75rem 0 0.25rem 0', color: '#0f172a', fontSize: '1.5rem', fontWeight: '900' }}>
              {car.vehicle_type || 'مركبة'} - {car.model || 'سوزوكي'}
            </h2>
            <div style={{ color: '#64748b', fontSize: '0.95rem' }}>
              السائق المسجل: <strong style={{ color: '#1e1b4b' }}>{car.driver_name || user?.name}</strong>
            </div>
          </div>
          <div>
            <EgyptianLicensePlate 
              letters={car.plate_letters}
              numbers={car.plate_numbers}
              vehicleType={car.vehicle_type}
            />
          </div>
        </div>

        {/* Big Odometer Card & Oil Status */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px dashed #e2e8f0' }}>
          <div style={{ flex: 1, minWidth: '200px', background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>🛣️ قراءة العداد الحالية</span>
            <h2 style={{ margin: '0.25rem 0 0 0', color: '#1e293b', fontSize: '1.8rem', fontWeight: '900' }}>
              {currentOdo ? `${currentOdo.toLocaleString('en-US')} كم` : '0 كم'}
            </h2>
          </div>

          <div style={{ flex: 1, minWidth: '200px', background: isOilOverdue ? '#fef2f2' : isOilWarning ? '#fffbe6' : '#f0fdf4', padding: '1rem 1.25rem', borderRadius: '16px', border: `1px solid ${isOilOverdue ? '#fca5a5' : isOilWarning ? '#fde047' : '#bbf7d0'}` }}>
            <span style={{ fontSize: '0.85rem', color: isOilOverdue ? '#dc2626' : isOilWarning ? '#d97706' : '#16a34a', fontWeight: 'bold' }}>🛢️ حالة زيت المحرك</span>
            <h3 style={{ margin: '0.25rem 0 0 0', color: isOilOverdue ? '#dc2626' : isOilWarning ? '#d97706' : '#16a34a', fontSize: '1.2rem', fontWeight: '900' }}>
              {isOilOverdue ? `🚨 مستحق الغيار (تجاوز ${Math.abs(remainingOilKm).toLocaleString()} كم)` : isOilWarning ? `🟡 باقي ${remainingOilKm.toLocaleString()} كم` : `🟢 ممتاز (متبقي ${remainingOilKm.toLocaleString()} كم)`}
            </h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
          <button 
            onClick={handleOpenFuelModal}
            style={{ padding: '0.9rem 1rem', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '14px', fontSize: '1.05rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            📷 ⛽ تفويل وتصوير العداد
          </button>
          <button 
            onClick={handleOpenOilModal}
            style={{ padding: '0.9rem 1rem', background: '#ea580c', color: '#ffffff', border: 'none', borderRadius: '14px', fontSize: '1.05rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            🛢️ تسجيل غيار زيت المحرك
          </button>
        </div>
      </div>

      {/* Logs Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* Recent Refueling Logs */}
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontWeight: 'bold' }}>⛽ أحدث عمليات التفويل المسجلة</h4>
          {recentFuelLogs?.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>لا توجد عمليات تفويل مسجلة بعد.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentFuelLogs.map(log => (
                <div key={log.id} style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', borderRight: '4px solid #2563eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: '#0f172a' }}>
                    <span>{log.liters} لتر ({log.fuel_type})</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {log.image_path && (
                        <button 
                          className="btn btn-xs btn-secondary" 
                          onClick={() => setActiveImageModal(log.image_path)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          📷 صورة العداد
                        </button>
                      )}
                      <span style={{ color: '#16a34a' }}>{Number(log.total_cost).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    <span>🛣️ العداد: {Number(log.odometer_reading).toLocaleString()} كم</span>
                    <span>📅 {new Date(log.date).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Maintenance Logs */}
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontWeight: 'bold' }}>🛢️ أحدث عمليات غيار الزيت والصيانة</h4>
          {recentMaintenanceLogs?.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>لا توجد عمليات صيانة مسجلة بعد.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentMaintenanceLogs.map(log => (
                <div key={log.id} style={{ background: '#fff7ed', padding: '0.75rem 1rem', borderRadius: '12px', borderRight: '4px solid #ea580c' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.9rem', color: '#0f172a' }}>
                    <span>{log.maintenance_type}</span>
                    <span style={{ color: '#ea580c' }}>{Number(log.cost).toLocaleString()} ج.م</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    <span>🛣️ العداد: {Number(log.odometer_reading).toLocaleString()} كم</span>
                    <span>🎯 القادم: {Number(log.next_service_km).toLocaleString()} كم</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Refuel Modal */}
      {showFuelModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '1.75rem', direction: 'rtl', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontWeight: 'bold' }}>📷 ⛽ تفويل وقود جديد وتصوير عداد المحطة</h3>
            
            <form onSubmit={handleFuelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Read-Only Assigned Fuel Type set by Management */}
              <div style={{ background: '#f0f9ff', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #bae6fd', color: '#0369a1' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0284c7' }}>⛽ نوع الوقود المعتمد لسيارتك من الإدارة:</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#0369a1', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⛽ {car?.fuel_type || 'سولار'}</span>
                  <span style={{ fontSize: '0.85rem', background: '#e0f2fe', padding: '0.2rem 0.6rem', borderRadius: '8px', color: '#0369a1', fontWeight: 'bold' }}>
                    السعر الرسمي: {officialPrice} ج.م / لتر
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem' }}>قراءة العداد الحالية وقت التفويل (كم):*</label>
                <input 
                  type="number" 
                  className="input-field"
                  placeholder="أدخل قراءة عداد السيارة وقت التفويل..."
                  value={odometerReading}
                  onChange={(e) => setOdometerReading(e.target.value)}
                  required
                />
              </div>

              {/* Photo Input (Mandatory Live Camera Capture Button with Auto-Compression) */}
              <div style={{ background: fuelImage ? '#f0fdf4' : '#fff1f2', padding: '1rem', borderRadius: '16px', border: fuelImage ? '2px solid #22c55e' : '2px dashed #f43f5e', textAlign: 'center' }}>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: '900', fontSize: '0.9rem', color: fuelImage ? '#15803d' : '#be123c' }}>
                  📸 تصوير عداد شاشة البنزين بالمحطة (إجباري بالكاميرا 📷)*
                </label>
                
                <label 
                  htmlFor="liveCameraInput" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem', 
                    padding: '0.85rem 1.25rem', 
                    background: fuelImage ? '#16a34a' : '#e11d48', 
                    color: '#ffffff', 
                    borderRadius: '14px', 
                    fontWeight: '800', 
                    fontSize: '0.95rem', 
                    cursor: 'pointer', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    width: '100%'
                  }}
                >
                  {compressingImage 
                    ? '⏳ جاري ضغط ومعالجة صورة العداد...' 
                    : fuelImage 
                    ? '📸 إعادة تصوير العداد بالكاميرا' 
                    : '📷 اضغط هنا لفتح كاميرا الموبايل وتصوير العداد حياً'}
                </label>

                <input 
                  id="liveCameraInput"
                  type="file" 
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />

                <div style={{ color: fuelImage ? '#16a34a' : '#e11d48', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: '800' }}>
                  {compressingImage ? (
                    '⏳ جاري تحسين جودة الصورة وضغط الحجم للرفع السريع...'
                  ) : fuelImage ? (
                    `✅ تم التقاط صورة العداد جاهزة للرفع السريع (${Math.round(fuelImage.size / 1024)} كيلوبايت)`
                  ) : (
                    '⚠️ اضغط الزر الأحمر أعلاه لفتح الكاميرا والتقاط صورة حية لعداد المحطة'
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem' }}>عدد اللترات المعبأة:*</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    placeholder="عدد اللترات"
                    value={liters}
                    onChange={(e) => handleLitersChange(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem' }}>إجمالي المبلغ (ج.م):*</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    placeholder="يحسب تلقائياً"
                    value={totalCost}
                    onChange={(e) => handleTotalCostChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem' }}>اسم محطة البنزين (اختياري):</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="مثال: وطنية / إمارت مصر / موبيل..."
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                />
              </div>

              {formMessage && <div style={{ color: '#16a34a', fontWeight: 'bold', textAlign: 'center', padding: '0.5rem', background: '#f0fdf4', borderRadius: '10px' }}>{formMessage}</div>}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ flex: 1 }}>
                  {formLoading ? 'جاري الحفظ…' : 'حفظ التفويل وصورة العداد 📷'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFuelModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {activeImageModal && (
        <div 
          onClick={() => setActiveImageModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img 
              src={getCleanImageUrl(activeImageModal)} 
              alt="صورة عداد المحطة" 
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '16px', border: '2px solid #ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
            />
            <button 
              onClick={() => setActiveImageModal(null)}
              style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Oil Change Modal */}
      {showOilModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '1.75rem', direction: 'rtl', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontWeight: 'bold' }}>🛢️ تسجيل غيار زيت المحرك</h3>
            
            <div style={{ background: '#eff6ff', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #bfdbfe', marginBottom: '1rem', color: '#1e3a8a', fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 'bold' }}>🛢️ دورة غيار الزيت المحددة للسيارة من الإدارة:</div>
              <div style={{ marginTop: '0.2rem', color: '#2563eb', fontWeight: 900, fontSize: '1rem' }}>
                تغيير زيت موتور وفلاتر ({Number(car.oil_change_interval_km || 10000).toLocaleString()} كم)
              </div>
            </div>

            <form onSubmit={handleOilSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b' }}>
                  عداد السيارة الحالي عند غيار الزيت (كم):*
                </label>
                <input 
                  type="number" 
                  className="input-field"
                  placeholder="أدخل قراءة عداد السيارة الحالي..."
                  value={oilOdometer}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOilOdometer(val);
                    if (val && !isNaN(val)) {
                      const assignedInterval = Number(car.oil_change_interval_km || 10000);
                      setNextKm(String(parseInt(val, 10) + assignedInterval));
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b' }}>
                  العداد المفروض يغير عنده الزيت في المرة القادمة (كم):*
                </label>
                <input 
                  type="number" 
                  className="input-field"
                  placeholder="أدخل العداد المستهدف للغيار القادم..."
                  value={nextKm}
                  onChange={(e) => setNextKm(e.target.value)}
                  required
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  💡 محتسب تلقائياً بناءً على دورة الزيت ({Number(car.oil_change_interval_km || 10000).toLocaleString()} كم) ويمكنك تعديله عند اللزوم
                </small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem' }}>التكلفة (ج.م - اختياري):</label>
                  <input 
                    type="number" 
                    className="input-field"
                    placeholder="المبلغ المدفوع (اختياري)"
                    value={oilCost}
                    onChange={(e) => setOilCost(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem' }}>اسم الورشة / المركز (اختياري):</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="اسم الورشة أو المركز..."
                    value={centerName}
                    onChange={(e) => setCenterName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 'bold', fontSize: '0.85rem' }}>ملاحظات إضافية:</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="نوع الفلتر، الماركة..."
                  value={oilNotes}
                  onChange={(e) => setOilNotes(e.target.value)}
                />
              </div>

              {formMessage && <div style={{ color: '#16a34a', fontWeight: 'bold', textAlign: 'center', padding: '0.5rem', background: '#f0fdf4', borderRadius: '10px' }}>{formMessage}</div>}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ flex: 1, background: '#ea580c' }}>
                  {formLoading ? 'جاري الحفظ…' : 'حفظ عملية غيار الزيت وتحديث العداد 🛢️'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOilModal(false)}>
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
