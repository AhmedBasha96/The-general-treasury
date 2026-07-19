import React, { useEffect, useState } from 'react';

export default function CarManagement({ onClose, onCarAdded }) {
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
    <div className="car-modal">
      <div className="modal-content">
        <h2>إدارة السيارات</h2>

        {/* قائمة السيارات */}
        <ul className="car-list">
          {cars.map((c) => (
            <li key={c.id}>
              <strong>{c.plate_number}</strong>
              {c.image_path && (
                <img src={`/${c.image_path}`} alt={c.plate_number} className="car-thumb" />
              )}
            </li>
          ))}
        </ul>

        {/* نموذج الإضافة */}
        <form onSubmit={handleSubmit} className="car-form">
          <label>
            رقم اللوحة:
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              required
            />
          </label>

          <label>
            صورة (اختياري):
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'جاري الإضافة…' : 'إضافة سيارة'}
          </button>
          <button type="button" onClick={onClose} className="close-btn">
            إغلاق
          </button>
        </form>
      </div>
    </div>
  );
}
