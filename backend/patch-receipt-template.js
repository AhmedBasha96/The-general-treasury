const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'frontend', 'src', 'App.jsx');
let content = fs.readFileSync(file, 'utf8');

const startMarker = '      {/* PRINTABLE RECEIPT TEMPLATE */}';
const endMarker = '      )}\n    </div>\n  );\n}';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers!');
  console.log('startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const newReceipt = `      {/* PRINTABLE RECEIPT TEMPLATE */}
      {printingTx && (
        <div className="receipt-print-wrapper">
          {/* ===== HEADER ===== */}
          <div className="receipt-header">
            <h1 className="receipt-title">\u062e\u0632\u064a\u0646\u0629 \u0627\u0644\u062a\u0648\u0631\u064a\u062f \u0648\u0627\u0644\u0635\u0631\u0641</h1>
            <p className="receipt-subtitle">\u0634\u0631\u0643\u0629 \u0633\u064a\u0641 \u0643\u0627\u0634 \u0644\u0644\u062a\u062c\u0627\u0631\u0629</p>
            <div className="receipt-divider"></div>
            <strong style={{ fontSize: '11pt', display: 'block', margin: '2mm 0', textAlign: 'center' }}>
              {printingTx.type === 'deposit'
                ? (printingTx.payment_method === 'bank_transfer' ? '\u0625\u064a\u0635\u0627\u0644 \u0625\u064a\u062f\u0627\u0639 \u062a\u062d\u0648\u064a\u0644 \u0628\u0646\u0643\u064a' : '\u0625\u064a\u0635\u0627\u0644 \u062a\u0648\u0631\u064a\u062f \u0646\u0642\u062f\u064a\u0629 (\u0648\u0627\u0631\u062f)')
                : '\u0625\u064a\u0635\u0627\u0644 \u0635\u0631\u0641 \u0646\u0642\u062f\u064a\u0629 (\u0645\u0646\u0635\u0631\u0641)'}
            </strong>
            <div style={{ textAlign: 'center', marginTop: '1mm' }}>
              <span className="receipt-status-badge">
                {printingTx.status === 'disbursed' ? '\u2714 \u0645\u0643\u062a\u0645\u0644 - \u062a\u0645 \u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u0641\u0639\u0644\u064a'
                  : printingTx.status === 'approved' ? '\u2713 \u0645\u0639\u062a\u0645\u062f'
                  : printingTx.status === 'pending' ? '\u23f3 \u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629'
                  : '\u2714 \u0645\u0643\u062a\u0645\u0644'}
              </span>
            </div>
          </div>

          {/* ===== META INFO ===== */}
          <div className="receipt-meta">
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">\u0631\u0642\u0645 \u0627\u0644\u0625\u064a\u0635\u0627\u0644:</span>
              <span className="receipt-meta-value">TX-{String(printingTx.id).padStart(6, '0')}</span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648\u0627\u0644\u0648\u0642\u062a:</span>
              <span className="receipt-meta-value">{new Date(printingTx.date).toLocaleString('ar-EG')}</span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">\u0646\u0648\u0639 \u0627\u0644\u0639\u0645\u0644\u064a\u0629:</span>
              <span className="receipt-meta-value">
                {printingTx.type === 'deposit' ? '\u062a\u0648\u0631\u064a\u062f (\u062f\u062e\u0648\u0644 \u0623\u0645\u0648\u0627\u0644)' : '\u0635\u0631\u0641 (\u062e\u0631\u0648\u062c \u0623\u0645\u0648\u0627\u0644)'}
              </span>
            </div>
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639:</span>
              <span className="receipt-meta-value">
                {printingTx.payment_method === 'bank_transfer' ? '\u062a\u062d\u0648\u064a\u0644 \u0628\u0646\u0643\u064a' : '\u0646\u0642\u062f\u064a \u0628\u0627\u0644\u062e\u0632\u064a\u0646\u0629'}
              </span>
            </div>
            {printingTx.rep_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">\u0627\u0644\u0645\u0646\u062f\u0648\u0628:</span>
                <span className="receipt-meta-value">
                  {printingTx.rep_name}{printingTx.rep_code ? \` (\${printingTx.rep_code})\` : ''}
                </span>
              </div>
            )}
            {printingTx.agency_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">\u0627\u0644\u062a\u0648\u0643\u064a\u0644:</span>
                <span className="receipt-meta-value">
                  {printingTx.agency_name}{printingTx.agency_code ? \` (\${printingTx.agency_code})\` : ''}
                </span>
              </div>
            )}
            {printingTx.supervisor_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">\u0627\u0644\u0645\u0634\u0631\u0641:</span>
                <span className="receipt-meta-value">
                  {printingTx.supervisor_name}{printingTx.supervisor_code ? \` (\${printingTx.supervisor_code})\` : ''}
                </span>
              </div>
            )}
            {printingTx.bank_name && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0628\u0646\u0643\u064a:</span>
                <span className="receipt-meta-value">
                  {printingTx.bank_name}{printingTx.bank_code ? \` (\${printingTx.bank_code})\` : ''}
                </span>
              </div>
            )}
            {printingTx.type === 'withdrawal' && printingTx.withdrawal_sub_type && (
              <div className="receipt-meta-row">
                <span className="receipt-meta-label">\u0628\u0646\u062f \u0627\u0644\u0635\u0631\u0641:</span>
                <span className="receipt-meta-value">
                  {printingTx.withdrawal_sub_type === 'car' ? '\u0645\u0635\u0627\u0631\u064a\u0641 \u0633\u064a\u0627\u0631\u0627\u062a'
                    : printingTx.withdrawal_sub_type === 'salary' ? '\u0631\u0648\u0627\u062a\u0628 \u0648\u0623\u062c\u0648\u0631'
                    : printingTx.withdrawal_sub_type === 'commission' ? '\u0639\u0645\u0648\u0644\u0627\u062a'
                    : printingTx.withdrawal_sub_type}
                </span>
              </div>
            )}
          </div>

          {/* ===== AMOUNT BOX ===== */}
          <div className="receipt-amount-section">
            <div className="receipt-amount-title">\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u0644\u063a</div>
            <div className="receipt-amount-value">
              {Number(printingTx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} \u062c.\u0645
            </div>
            <div className="receipt-amount-text">
              \u0641\u0642\u0637 \u0648\u0642\u062f\u0631\u0647: {(() => {
                const pounds = Math.floor(Number(printingTx.amount));
                const piasters = Math.round((Number(printingTx.amount) - pounds) * 100);
                return \`\${pounds.toLocaleString('ar-EG')} \u062c\u0646\u064a\u0647 \u0645\u0635\u0631\u064a\${piasters > 0 ? \` \u0648\${piasters.toLocaleString('ar-EG')} \u0642\u0631\u0634\u0627\u064b\` : ''} \u0644\u0627 \u063a\u064a\u0631\`;
              })()}
            </div>
          </div>

          {/* ===== DENOMINATIONS TABLE ===== */}
          {printingTx.type === 'deposit' && printingTx.payment_method !== 'bank_transfer' &&
            [200, 100, 50, 20, 10, 5, 1].some(d => (printingTx[\`denom_\${d}\`] || 0) > 0) && (
            <div>
              <div style={{ fontSize: '8.5pt', fontWeight: 800, marginBottom: '1.5mm' }}>
                \u062a\u0641\u0627\u0635\u064a\u0644 \u0641\u0626\u0627\u062a \u0627\u0644\u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0646\u0642\u062f\u064a\u0629 \u0627\u0644\u0645\u0648\u062f\u0639\u0629:
              </div>
              <table className="receipt-table">
                <thead>
                  <tr>
                    <th>\u0627\u0644\u0641\u0626\u0629</th>
                    <th>\u0627\u0644\u0639\u062f\u062f</th>
                    <th>\u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0629</th>
                  </tr>
                </thead>
                <tbody>
                  {[200, 100, 50, 20, 10, 5, 1].map(denom => {
                    const count = printingTx[\`denom_\${denom}\`] || 0;
                    if (count > 0) {
                      return (
                        <tr key={denom}>
                          <td>{denom} \u062c.\u0645</td>
                          <td>{count.toLocaleString('ar-EG')}</td>
                          <td>{(denom * count).toLocaleString('ar-EG')} \u062c.\u0645</td>
                        </tr>
                      );
                    }
                    return null;
                  })}
                  <tr>
                    <td style={{ fontWeight: 900, borderTop: '2px solid #000' }}>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</td>
                    <td style={{ fontWeight: 900, borderTop: '2px solid #000' }}>
                      {[200, 100, 50, 20, 10, 5, 1]
                        .reduce((sum, d) => sum + (printingTx[\`denom_\${d}\`] || 0), 0)
                        .toLocaleString('ar-EG')}
                    </td>
                    <td style={{ fontWeight: 900, borderTop: '2px solid #000' }}>
                      {Number(printingTx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} \u062c.\u0645
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ===== NOTES ===== */}
          {printingTx.notes && (
            <div className="receipt-notes">
              <strong>\u0645\u0644\u0627\u062d\u0638\u0627\u062a:</strong>
              {printingTx.notes}
            </div>
          )}

          {/* ===== SIGNATURE LINES ===== */}
          <div className="receipt-signatures">
            <div className="signature-box">
              \u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0645\u0646\u062f\u0648\u0628 / \u0627\u0644\u0645\u0633\u062a\u0644\u0645
            </div>
            <div className="signature-box">
              \u062a\u0648\u0642\u064a\u0639 \u0623\u0645\u064a\u0646 \u0627\u0644\u062e\u0632\u064a\u0646\u0629
            </div>
          </div>

          {/* ===== FOOTER ===== */}
          <div className="receipt-footer">
            <p>\u0634\u0643\u0631\u0627\u064b \u0644\u062a\u0639\u0627\u0645\u0644\u0643\u0645 \u0645\u0639\u0646\u0627</p>
            <p style={{ marginTop: '0.5mm' }}>\u0646\u0638\u0627\u0645 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062e\u0632\u064a\u0646\u0629 \u0627\u0644\u0630\u0643\u064a \u2014 Cash Safe</p>
          </div>
        </div>
      )}`;

const before = content.substring(0, startIdx);
const after = content.substring(endIdx + endMarker.length);
const newContent = before + newReceipt + '\n' + endMarker;

fs.writeFileSync(file, newContent, 'utf8');
console.log('✅ Receipt template patched successfully!');
console.log('New file size:', newContent.length, 'bytes');
