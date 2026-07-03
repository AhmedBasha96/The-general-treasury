const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'frontend', 'src', 'App.jsx');
let content = fs.readFileSync(file, 'utf8');

// Use a unique wider context that only exists in the rep ledger table
// From debug output we know the rep ledger map is at char 72694
// The notes column ends inside that block
// Use "tx.withdrawal_sub_type === 'commission' ? ' - عمولة' : ''}" as the unique preceding anchor
const target = "                                {tx.withdrawal_sub_type === 'car' ? ' - سيارة' : \n                                 tx.withdrawal_sub_type === 'salary' ? ' - راتب' : \n                                 tx.withdrawal_sub_type === 'commission' ? ' - عمولة' : ''}\n                              </span>\n                            </td>\n                            <td>\n                              <span className={`amount-${tx.type}`}>\n                                {tx.type === 'withdrawal' ? '-' : ''}\n                                {Number(tx.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م\n                              </span>\n                            </td>\n                            <td>\n                              {tx.notes || '—'}\n                              {tx.type === 'deposit' && (tx.denom_200 > 0 || tx.denom_100 > 0 || tx.denom_50 > 0 || tx.denom_20 > 0 || tx.denom_10 > 0 || tx.denom_5 > 0 || tx.denom_1 > 0) && (\n                                <div className=\"denoms-list-tag\" title=\"تفاصيل فئات المبلغ المورد\">\n                                  💵 الفئات: {[\n                                    tx.denom_200 > 0 && <span key=\"200\" className=\"denom-pill\">200×<span>{tx.denom_200}</span></span>,\n                                    tx.denom_100 > 0 && <span key=\"100\" className=\"denom-pill\">100×<span>{tx.denom_100}</span></span>,\n                                    tx.denom_50 > 0 && <span key=\"50\" className=\"denom-pill\">50×<span>{tx.denom_50}</span></span>,\n                                    tx.denom_20 > 0 && <span key=\"20\" className=\"denom-pill\">20×<span>{tx.denom_20}</span></span>,\n                                    tx.denom_10 > 0 && <span key=\"10\" className=\"denom-pill\">10×<span>{tx.denom_10}</span></span>,\n                                    tx.denom_5 > 0 && <span key=\"5\" className=\"denom-pill\">5×<span>{tx.denom_5}</span></span>,\n                                    tx.denom_1 > 0 && <span key=\"1\" className=\"denom-pill\">1×<span>{tx.denom_1}</span></span>\n                                  ].filter(Boolean)}\n                                </div>\n                              )}\n                            </td>\n                          </tr>\n                        ))}";

const count = (content.split(target).length - 1);
console.log('Exact target matches:', count);

if (count === 1) {
  const replacement = target.replace(
    "                            </td>\n                          </tr>\n                        ))}",
    `                            </td>
                            <td>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'rgba(14,165,233,0.08)', color: 'var(--primary)', borderColor: 'rgba(14,165,233,0.2)' }}
                                onClick={() => handlePrintReceipt({
                                  ...tx,
                                  rep_name: selectedRepLedger.representative.name,
                                  rep_code: selectedRepLedger.representative.code,
                                  agency_name: selectedRepLedger.representative.agency_name
                                })}
                              >
                                🖨️
                              </button>
                            </td>
                          </tr>
                        ))}`
  );
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Patch applied!');
} else {
  console.log('❌ target found', count, 'times');
}
