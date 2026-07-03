const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'frontend', 'src', 'App.jsx');
let content = fs.readFileSync(file, 'utf8');

// Find the exact location of the reject button in pending approvals table
// Using a unique string that only exists in that specific context
const searchStr = "onClick={() => handleRejectTx(tx.id)}";
const positions = [];
let pos = 0;
while ((pos = content.indexOf(searchStr, pos)) !== -1) {
  positions.push(pos);
  pos++;
}
console.log('Found handleRejectTx at positions:', positions);

if (positions.length === 1) {
  const idx = positions[0];
  // Find the closing </button> after handleRejectTx
  const closingButtonEnd = content.indexOf('</button>', idx) + '</button>'.length;
  // Find the closing </div> after that
  const closingDivEnd = content.indexOf('</div>', closingButtonEnd) + '</div>'.length;
  
  // Print context around
  console.log('Context:', JSON.stringify(content.substring(closingButtonEnd, closingDivEnd + 5)));
  
  // Insert print button before the closing </div>
  const printBtn = `
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', backgroundColor: 'rgba(14,165,233,0.08)', color: 'var(--primary)', borderColor: 'rgba(14,165,233,0.2)' }}
                            onClick={() => handlePrintReceipt(tx)}
                            title="\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0625\u064a\u0635\u0627\u0644"
                          >
                            \uD83D\uDDB8\uFE0F
                          </button>`;
  
  content = content.substring(0, closingButtonEnd) + printBtn + content.substring(closingButtonEnd);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Print button added to pending approvals table!');
  console.log('New file size:', content.length);
} else {
  console.log('❌ Expected 1 match, found:', positions.length);
}
