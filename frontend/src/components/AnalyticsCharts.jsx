import React, { useState, useEffect } from 'react';

export default function AnalyticsCharts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeHoverPoint, setActiveHoverPoint] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analytics/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError('تعذر تحميل بيانات التحليلات');
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('فشل الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="analytics-loading-box">
        <div className="spinner"></div>
        <p>جاري تحميل تحليلات ومخططات النظام...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="analytics-error-box">
        <p>{error || 'لا توجد بيانات متاحة حالياً'}</p>
        <button onClick={fetchAnalytics} className="btn btn-secondary btn-sm">إعادة المحاولة</button>
      </div>
    );
  }

  const { monthlyFlow, expensesByCategory, topRep, topCar, avgDailyExpense, activeDays } = data;

  // Render SVG Line Chart logic
  const flowDays = monthlyFlow || [];
  const maxVal = Math.max(
    ...flowDays.map(d => Math.max(Number(d.total_deposits) || 0, Number(d.total_withdrawals) || 0)),
    1000
  );

  const chartWidth = 700;
  const chartHeight = 220;
  const padding = 30;
  const graphWidth = chartWidth - padding * 2;
  const graphHeight = chartHeight - padding * 2;

  const pointsDeposits = flowDays.map((d, i) => {
    const x = padding + (i / Math.max(flowDays.length - 1, 1)) * graphWidth;
    const y = chartHeight - padding - ((Number(d.total_deposits) || 0) / maxVal) * graphHeight;
    return { x, y, day: d.day_date, val: d.total_deposits };
  });

  const pointsWithdrawals = flowDays.map((d, i) => {
    const x = padding + (i / Math.max(flowDays.length - 1, 1)) * graphWidth;
    const y = chartHeight - padding - ((Number(d.total_withdrawals) || 0) / maxVal) * graphHeight;
    return { x, y, day: d.day_date, val: d.total_withdrawals };
  });

  const dPathDeposits = pointsDeposits.length > 0 
    ? pointsDeposits.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
    : '';

  const dPathWithdrawals = pointsWithdrawals.length > 0 
    ? pointsWithdrawals.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
    : '';

  // Donut Chart logic
  const categoryColors = [
    '#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4', '#64748b'
  ];

  const totalExpenseSum = (expensesByCategory || []).reduce((acc, c) => acc + (Number(c.total_amount) || 0), 0);

  const subTypeLabels = {
    car: '🚗 مصاريف سيارات',
    car_gas: '⛽ جاز سيارات',
    car_oil: '🛢️ زيت وصيانة سيارات',
    salary: '💵 رواتب وأجور',
    commission: '💰 عمولات ومكافآت',
    loan: '💸 سلف وتسهيلات',
    direct_rent: '🏢 إيجارات',
    direct_operational: '🔧 مصاريف تشغيلية',
    other: '📝 أخرى'
  };

  let cumulativeAngle = 0;
  const donutSlices = (expensesByCategory || []).map((cat, i) => {
    const amount = Number(cat.total_amount) || 0;
    const percentage = totalExpenseSum > 0 ? (amount / totalExpenseSum) * 100 : 0;
    const angle = totalExpenseSum > 0 ? (amount / totalExpenseSum) * 360 : 0;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;

    return {
      ...cat,
      percentage: percentage.toFixed(1),
      color: categoryColors[i % categoryColors.length],
      label: subTypeLabels[cat.sub_type] || cat.sub_type
    };
  });

  return (
    <div className="analytics-section">
      {/* 3 Smart KPI Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card top-rep">
          <div className="kpi-icon">🏆</div>
          <div className="kpi-content">
            <span className="kpi-title">أعلى مندوب توريداً (هذا الشهر)</span>
            <div className="kpi-value">{topRep ? `${Number(topRep.total_deposited).toLocaleString('ar-EG')} ج.م` : 'لا توجد بيانات'}</div>
            <span className="kpi-subtext">
              {topRep ? `المندوب: ${topRep.rep_name} (${topRep.rep_code})` : 'لم يتم تسجيل توريدات هذا الشهر'}
            </span>
          </div>
        </div>

        <div className="kpi-card top-car">
          <div className="kpi-icon">🚚</div>
          <div className="kpi-content">
            <span className="kpi-title">أعلى سيارة استهلاكاً (وقود وصيانة)</span>
            <div className="kpi-value">{topCar ? `${Number(topCar.total_expense).toLocaleString('ar-EG')} ج.م` : 'لا توجد بيانات'}</div>
            <span className="kpi-subtext">
              {topCar ? `السيارة: ${topCar.plate_number} ${topCar.driver_name ? `(${topCar.driver_name})` : ''}` : 'لم تسجل مصاريف للسيارات'}
            </span>
          </div>
        </div>

        <div className="kpi-card avg-expense">
          <div className="kpi-icon">📊</div>
          <div className="kpi-content">
            <span className="kpi-title">متوسط الصرف اليومي للخزنة</span>
            <div className="kpi-value">{avgDailyExpense ? `${avgDailyExpense.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</div>
            <span className="kpi-subtext">
              معدل الخروج اليومي خلال {activeDays} يوم نشاط هذا الشهر
            </span>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="charts-grid">
        {/* Line Chart Card */}
        <div className="chart-card line-chart-card">
          <div className="chart-header">
            <h3>📈 حركة التوريد والصرف اليومية (الشهر الحالي)</h3>
            <div className="chart-legend">
              <span className="legend-item deposits"><span className="legend-dot"></span> توريد (وارد)</span>
              <span className="legend-item withdrawals"><span className="legend-dot"></span> صرف (منصرف)</span>
            </div>
          </div>

          <div className="svg-container">
            {flowDays.length === 0 ? (
              <p className="no-chart-data">لا توجد حركات مسجلة خلال الشهر الحالي</p>
            ) : (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="flow-svg">
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = chartHeight - padding - ratio * graphHeight;
                  const valLabel = Math.round(ratio * maxVal);
                  return (
                    <g key={idx}>
                      <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                      <text x={padding - 5} y={y + 4} fill="#64748b" fontSize="9" textAnchor="end">{valLabel >= 1000 ? `${(valLabel/1000).toFixed(0)}k` : valLabel}</text>
                    </g>
                  );
                })}

                {/* Deposits Line */}
                {dPathDeposits && (
                  <path d={dPathDeposits} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Withdrawals Line */}
                {dPathWithdrawals && (
                  <path d={dPathWithdrawals} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Data Points Hover */}
                {pointsDeposits.map((p, i) => (
                  <circle
                    key={`dep-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#10b981"
                    className="chart-point"
                    onMouseEnter={() => setActiveHoverPoint({ ...p, type: 'وارد' })}
                    onMouseLeave={() => setActiveHoverPoint(null)}
                  />
                ))}

                {pointsWithdrawals.map((p, i) => (
                  <circle
                    key={`with-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#f43f5e"
                    className="chart-point"
                    onMouseEnter={() => setActiveHoverPoint({ ...p, type: 'منصرف' })}
                    onMouseLeave={() => setActiveHoverPoint(null)}
                  />
                ))}
              </svg>
            )}

            {activeHoverPoint && (
              <div className="chart-tooltip">
                <strong>{activeHoverPoint.day}</strong>
                <div>{activeHoverPoint.type}: {Number(activeHoverPoint.val).toLocaleString('ar-EG')} ج.م</div>
              </div>
            )}
          </div>
        </div>

        {/* Expenses Distribution Donut / Breakdown Card */}
        <div className="chart-card category-chart-card">
          <div className="chart-header">
            <h3>🍩 توزيع المصاريف حسب البند</h3>
            <span className="total-expenses-badge">إجمالي: {totalExpenseSum.toLocaleString('ar-EG')} ج.م</span>
          </div>

          <div className="donut-body">
            {donutSlices.length === 0 ? (
              <p className="no-chart-data">لا توجد مصاريف مسجلة هذا الشهر</p>
            ) : (
              <div className="slices-list">
                {donutSlices.map((slice, idx) => (
                  <div key={idx} className="slice-row">
                    <div className="slice-info">
                      <span className="slice-dot" style={{ backgroundColor: slice.color }}></span>
                      <span className="slice-name">{slice.label}</span>
                    </div>
                    <div className="slice-values">
                      <span className="slice-amount">{Number(slice.total_amount).toLocaleString('ar-EG')} ج.م</span>
                      <span className="slice-pct">({slice.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
