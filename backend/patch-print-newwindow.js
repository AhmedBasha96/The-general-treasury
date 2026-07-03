const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'frontend', 'src', 'App.jsx');
let content = fs.readFileSync(file, 'utf8');

// Replace the handlePrintReceipt function with a new window-based approach
const oldFn = `  const handlePrintReceipt = (tx) => {
    setPrintingTx(tx);
    setTimeout(() => {
      window.print();
    }, 150);
  };`;

const newFn = `  const handlePrintReceipt = (tx) => {
    const id = String(tx.id).padStart(6, '0');
    const date = new Date(tx.date).toLocaleString('ar-EG');
    const amount = Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 });
    const pounds = Math.floor(Number(tx.amount));
    const piasters = Math.round((Number(tx.amount) - pounds) * 100);
    const amountText = \`\${pounds.toLocaleString('ar-EG')} جنيه مصري\${piasters > 0 ? \` و\${piasters.toLocaleString('ar-EG')} قرشاً\` : ''} لا غير\`;

    const typeLabel = tx.type === 'deposit'
      ? (tx.payment_method === 'bank_transfer' ? 'إيصال إيداع تحويل بنكي' : 'إيصال توريد نقدية (وارد)')
      : 'إيصال صرف نقدية (منصرف)';

    const statusLabel = tx.status === 'disbursed' ? 'مكتمل - تم الصرف الفعلي'
      : tx.status === 'approved' ? 'معتمد'
      : tx.status === 'pending' ? 'قيد المراجعة'
      : 'مكتمل';

    const withdrawalSubType = tx.withdrawal_sub_type === 'car' ? 'مصاريف سيارات'
      : tx.withdrawal_sub_type === 'salary' ? 'رواتب وأجور'
      : tx.withdrawal_sub_type === 'commission' ? 'عمولات'
      : (tx.withdrawal_sub_type || '');

    // Build denominations table
    const denoms = [200, 100, 50, 20, 10, 5, 1];
    const hasDenoms = tx.type === 'deposit' && tx.payment_method !== 'bank_transfer'
      && denoms.some(d => (tx[\`denom_\${d}\`] || 0) > 0);

    let denomRows = '';
    let totalCount = 0;
    if (hasDenoms) {
      denoms.forEach(d => {
        const cnt = tx[\`denom_\${d}\`] || 0;
        if (cnt > 0) {
          totalCount += cnt;
          denomRows += \`<tr><td>\${d} ج.م</td><td>\${cnt}</td><td>\${(d * cnt).toLocaleString('ar-EG')} ج.م</td></tr>\`;
        }
      });
      denomRows += \`<tr style="border-top:2px solid #000;font-weight:900"><td>الإجمالي</td><td>\${totalCount}</td><td>\${amount} ج.م</td></tr>\`;
    }

    const html = \`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>إيصال TX-\${id}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 80mm auto; margin: 0; }
  body {
    font-family: 'Cairo', Arial, sans-serif;
    font-size: 9pt;
    color: #000;
    background: #fff;
    direction: rtl;
    width: 80mm;
    padding: 3mm 2mm;
    line-height: 1.5;
  }
  .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 3mm; margin-bottom: 3mm; }
  .title { font-size: 15pt; font-weight: 900; margin: 1mm 0; }
  .subtitle { font-size: 8pt; color: #444; margin-top: 1mm; }
  .type-label { font-size: 11pt; font-weight: 800; display: block; margin: 2mm 0; }
  .status-badge { display: inline-block; border: 1.5px solid #000; padding: 0.5mm 2mm; font-weight: 800; font-size: 8pt; margin: 1mm 0; }
  .divider { border-top: 1px dashed #000; margin: 2.5mm 0; }
  .meta-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 3mm; }
  .meta-table td { padding: 1mm 0; border-bottom: 1px dotted #ccc; vertical-align: top; }
  .meta-table td:first-child { font-weight: 800; white-space: nowrap; padding-left: 2mm; width: 35%; }
  .meta-table tr:last-child td { border-bottom: none; }
  .amount-box { text-align: center; background: #f0f0f0; border: 2px solid #000; padding: 3mm; margin: 3mm 0; }
  .amount-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; margin-bottom: 1mm; }
  .amount-value { font-size: 18pt; font-weight: 900; line-height: 1.2; }
  .amount-text { font-size: 7.5pt; font-style: italic; margin-top: 1.5mm; color: #333; }
  .denom-header { font-size: 8.5pt; font-weight: 800; margin-bottom: 1.5mm; }
  .denom-table { width: 100%; border-collapse: collapse; font-size: 8pt; margin: 2mm 0 4mm; }
  .denom-table th, .denom-table td { padding: 1mm 1.5mm; border: 1px solid #999; text-align: center; }
  .denom-table th { font-weight: 800; background: #e0e0e0; font-size: 7.5pt; }
  .notes-box { font-size: 8pt; border: 1px dashed #666; padding: 2mm; margin: 2mm 0 4mm; background: #fafafa; }
  .notes-box strong { display: block; margin-bottom: 1mm; font-size: 8.5pt; }
  .signatures { display: flex; justify-content: space-between; gap: 4mm; margin-top: 8mm; font-size: 8pt; text-align: center; }
  .sig-box { flex: 1; border-top: 1.5px solid #000; padding-top: 2mm; margin-top: 10mm; font-size: 7.5pt; }
  .footer { text-align: center; font-size: 7.5pt; margin-top: 5mm; border-top: 1px dashed #000; padding-top: 2.5mm; color: #444; line-height: 1.6; }
</style>
</head>
<body>
<div class="header">
  <div class="title">خزينة التوريد والصرف</div>
  <div class="subtitle">شركة سيف كاش للتجارة</div>
  <div class="divider"></div>
  <strong class="type-label">\${typeLabel}</strong>
  <span class="status-badge">\${statusLabel}</span>
</div>

<table class="meta-table">
  <tr><td>رقم الإيصال:</td><td>TX-\${id}</td></tr>
  <tr><td>التاريخ والوقت:</td><td>\${date}</td></tr>
  <tr><td>نوع العملية:</td><td>\${tx.type === 'deposit' ? 'توريد (دخول أموال)' : 'صرف (خروج أموال)'}</td></tr>
  <tr><td>طريقة الدفع:</td><td>\${tx.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقدي بالخزينة'}</td></tr>
  \${tx.rep_name ? \`<tr><td>المندوب:</td><td>\${tx.rep_name}\${tx.rep_code ? \` (\${tx.rep_code})\` : ''}</td></tr>\` : ''}
  \${tx.agency_name ? \`<tr><td>التوكيل:</td><td>\${tx.agency_name}\${tx.agency_code ? \` (\${tx.agency_code})\` : ''}</td></tr>\` : ''}
  \${tx.supervisor_name ? \`<tr><td>المشرف:</td><td>\${tx.supervisor_name}\${tx.supervisor_code ? \` (\${tx.supervisor_code})\` : ''}</td></tr>\` : ''}
  \${tx.bank_name ? \`<tr><td>الحساب البنكي:</td><td>\${tx.bank_name}\${tx.bank_code ? \` (\${tx.bank_code})\` : ''}</td></tr>\` : ''}
  \${withdrawalSubType ? \`<tr><td>بند الصرف:</td><td>\${withdrawalSubType}</td></tr>\` : ''}
</table>

<div class="amount-box">
  <div class="amount-title">إجمالي المبلغ</div>
  <div class="amount-value">\${amount} ج.م</div>
  <div class="amount-text">فقط وقدره: \${amountText}</div>
</div>

\${hasDenoms ? \`
<div class="denom-header">تفاصيل فئات الأوراق النقدية المودعة:</div>
<table class="denom-table">
  <thead><tr><th>الفئة</th><th>العدد</th><th>القيمة الإجمالية</th></tr></thead>
  <tbody>\${denomRows}</tbody>
</table>
\` : ''}

\${tx.notes ? \`<div class="notes-box"><strong>ملاحظات:</strong>\${tx.notes}</div>\` : ''}

<div class="signatures">
  <div class="sig-box">توقيع المندوب / المستلم</div>
  <div class="sig-box">توقيع أمين الخزينة</div>
</div>

<div class="footer">
  <p>شكراً لتعاملكم معنا</p>
  <p>نظام إدارة الخزينة الذكي — Cash Safe</p>
</div>
</body>
</html>\`;

    const printWindow = window.open('', '_blank', 'width=340,height=700,scrollbars=yes');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة في المتصفح لطباعة الإيصال');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for fonts to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 600);
    };
  };`;

const count = content.split(oldFn).length - 1;
console.log('Matches:', count);

if (count === 1) {
  content = content.replace(oldFn, newFn);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ handlePrintReceipt replaced with new-window approach!');
  console.log('New file size:', content.length);
} else {
  console.log('❌ Could not find unique target. Matches:', count);
  // Show lines 33-38 for debugging
  const lines = content.split('\n');
  for (let i = 32; i < 38; i++) {
    console.log((i+1)+':', JSON.stringify(lines[i]));
  }
}
