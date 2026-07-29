(async () => {
  try {
    // Create company
    const companyRes = await fetch('http://localhost:5000/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'COMP01', name: 'Test Company' })
    });
    const companyData = await companyRes.json();
    console.log('Create company status:', companyRes.status, companyData);
    const companyId = companyData.id || companyData.insertId || 1; // fallback

    // Create transfer
    const transferRes = await fetch('http://localhost:5000/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, date: '2023-01-01T00:00:00Z', company_id: companyId, notes: 'test transfer' })
    });
    const transferData = await transferRes.json();
    console.log('Transfer status:', transferRes.status, transferData);
  } catch (err) {
    console.error('Error:', err);
  }
})();
