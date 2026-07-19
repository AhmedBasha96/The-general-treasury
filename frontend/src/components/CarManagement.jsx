import React, { useEffect, useState } from 'react';

export default function CarManagement({ onCarAdded, onCarClick }) {
  const [cars, setCars] = useState([]);
  const [plate, setPlate] = useState('');
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCars = async () => {
    try {
      const res = await fetch('/api/cars');
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
    if (!plate) return setError('رقم اللوحة مطلوب');
    setLoading(true);
    setError('');

    const form = new FormData();
    form.append('plate_number', plate);
    if (image) form.append('image', image);

    try {
      const res = await fetch('/api/cars', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        setPlate('');
        setImage(null);
        loadCars();
        if (onCarAdded) onCarAdded();
      } else {
        setError(data.error || 'فشل إضافة السيارة');
      }
    } catch (err) {
      console.error(err);
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Form Section */}
        <div style={{ flex: '1', minWidth: '300px', background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>إضافة سيارة جديدة</h4>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>رقم اللوحة:</label>
              <input
                type="text"
                className="input-field"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="أ ب ج 1234"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>صورة السيارة (اختياري):</label>
              <input 
                type="file" 
                className="input-field"
                accept="image/*" 
                onChange={(e) => setImage(e.target.files[0])} 
              />
            </div>

            {error && <div style={{ color: 'var(--error)', background: 'var(--error-bg)', padding: '0.5rem', borderRadius: '8px' }}>{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'جاري الإضافة…' : 'إضافة سيارة'}
            </button>
          </form>
        </div>

        {/* List Section */}
        <div style={{ flex: '2', minWidth: '300px' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>السيارات المسجلة ({cars.length})</h4>
          {cars.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '15px', color: 'var(--text-muted)' }}>
              لا توجد سيارات مسجلة حتى الآن.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {cars.map((c) => (
                <div 
                  key={c.id} 
                  style={{ 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '12px', 
                    overflow: 'hidden',
                    textAlign: 'center',
                    cursor: onCarClick ? 'pointer' : 'default',
                    transition: 'transform 0.2s'
                  }}
                  onClick={() => onCarClick && onCarClick(c)}
                  onMouseOver={(e) => { if (onCarClick) e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseOut={(e) => { if (onCarClick) e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {c.image_path ? (
                    <div style={{ height: '120px', width: '100%', overflow: 'hidden', background: '#e2e8f0' }}>
                      <img src={`/${c.image_path}`} alt={c.plate_number} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ height: '120px', width: '100%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                      🚗
                    </div>
                  )}
                  <div style={{ padding: '1rem', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                    {c.plate_number}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
