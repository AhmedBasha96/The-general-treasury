(async () => {
  try {
    const response = await fetch('http://localhost:5000/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, date: '2023-01-01T00:00:00Z', company_id: 1, notes: 'test transfer' })
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
})();
(async () => {
  try {
    const response = await fetch('http://localhost:5000/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, date: '2023-01-01T00:00:00Z', company_id: 1, notes: 'test transfer' })
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
})();
