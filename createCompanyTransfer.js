// Using native fetch available in Node 18+

const API_BASE = 'http://localhost:5000';

async function ensureCompany() {
  // Get existing companies
  const res = await fetch(`${API_BASE}/api/companies`);
  const companies = await res.ok ? await res.json() : [];
  if (companies.length > 0) {
    console.log('Existing companies:', companies.map(c => ({ id: c.id, name: c.name })));
    return companies[0]; // return first company
  }
  // Create a new company
  const newComp = {
    code: 'COMP001',
    name: 'شركة اختبار',
    bank_account_number: '1234567890',
    bank_name: 'بنك الاختبار'
  };
  const createRes = await fetch(`${API_BASE}/api/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newComp)
  });
  const created = await createRes.json();
  console.log('Created company response:', created);
  // After creation, fetch the list to obtain the new company's id
  const listRes = await fetch(`${API_BASE}/api/companies`);
  const list = await listRes.ok ? await listRes.json() : [];
  console.log('Companies after creation:', list.map(c => ({ id: c.id, name: c.name })));
  return list[0];
}
async function createTransfer(companyId) {
  const payload = {
    amount: 1000,
    date: new Date().toISOString(),
    notes: 'تحويل اختبار',
    company_id: companyId
  };
  const res = await fetch(`${API_BASE}/api/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('Transfer response:', res.status, data);
}

(async () => {
  try {
    const company = await ensureCompany();
    await createTransfer(company.id);
  } catch (err) {
    console.error('Error:', err);
  }
})();
