import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Dashboard() {
  const { t } = useTranslation();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const now = new Date();
  const [start, setStart] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
  const [end,   setEnd]   = useState(new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0]);

  const load = () => {
    setLoading(true);
    api.get(`/dashboard?start_date=${start}&end_date=${end}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const maxSalary = data ? Math.max(...data.salary_by_position.map(p => parseFloat(p.total_salary)), 1) : 1;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('dashboard.title')}</div>
          <div className="page-subtitle">{t('dashboard.subtitle')}</div>
        </div>
        <div className="flex gap-8 items-center">
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: 140 }} />
          <span style={{ color: '#64748b' }}>{t('common.to')}</span>
          <input type="date" value={end}   onChange={e => setEnd(e.target.value)}   style={{ width: 140 }} />
          <button className="btn btn-primary btn-sm" onClick={load}>{t('common.apply')}</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="page-spinner"><div className="spinner" /> {t('common.loading')}</div>
        ) : data && (
          <>
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-icon">💰</div>
                <div className="stat-label">{t('dashboard.totalPayroll')}</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{fmt(data.total_salary)}</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-icon">⏰</div>
                <div className="stat-label">{t('dashboard.totalOTCost')}</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{fmt(data.total_ot_cost)}</div>
              </div>
              <div className="stat-card success">
                <div className="stat-icon">👥</div>
                <div className="stat-label">{t('dashboard.activeEmployees')}</div>
                <div className="stat-value">{data.total_employees}</div>
              </div>
              <div className="stat-card danger">
                <div className="stat-icon">🚨</div>
                <div className="stat-label">{t('dashboard.fraudAlerts')}</div>
                <div className="stat-value">{data.active_fraud_alerts}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <div className="card-header"><div className="card-title">{t('dashboard.salaryByPos')}</div></div>
                <div className="card-body">
                  {data.salary_by_position.length === 0 ? (
                    <div className="text-muted text-center">{t('dashboard.noData')}</div>
                  ) : (
                    <div className="bar-chart">
                      {data.salary_by_position.map((pos) => (
                        <div key={pos.position_name} className="bar-row">
                          <div className="bar-label">{pos.position_name}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(pos.total_salary / maxSalary) * 100}%` }} />
                          </div>
                          <div className="bar-value">{fmt(pos.total_salary)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">{t('dashboard.topOT')}</div></div>
                <div className="card-body">
                  {data.top_ot_employees.length === 0 ? (
                    <div className="text-muted text-center">{t('dashboard.noOT')}</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>{t('dashboard.rank')}</th>
                          <th>{t('dashboard.employee')}</th>
                          <th>{t('dashboard.position')}</th>
                          <th className="text-right">{t('dashboard.otHours')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_ot_employees.map((e, i) => (
                          <tr key={e.employee_name}>
                            <td><span className="badge badge-primary">{i + 1}</span></td>
                            <td className="fw-bold">{e.employee_name}</td>
                            <td className="text-muted">{e.position_name}</td>
                            <td className="text-right fw-bold">{e.total_ot}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {data.recent_fraud_alerts.length > 0 && (
              <div className="card mt-16">
                <div className="card-header">
                  <div className="card-title">🚨 {t('dashboard.recentAlerts')}</div>
                  <span className="badge badge-danger">{t('dashboard.unresolved', { count: data.active_fraud_alerts })}</span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('audit.action')}</th>
                          <th>{t('audit.description')}</th>
                          <th>{t('dashboard.employee')}</th>
                          <th>{t('audit.time')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent_fraud_alerts.map((a) => (
                          <tr key={a.id}>
                            <td><span className="badge badge-danger">{a.alert_type}</span></td>
                            <td>{a.description}</td>
                            <td>{a.employee_name || '—'}</td>
                            <td className="text-muted text-sm">{new Date(a.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
