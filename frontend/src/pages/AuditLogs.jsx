import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ACTION_COLORS = {
  LOGIN: 'badge-info',
  CREATE_EMPLOYEE: 'badge-success', UPDATE_EMPLOYEE: 'badge-warning', DELETE_EMPLOYEE: 'badge-danger',
  CREATE_POSITION: 'badge-success', UPDATE_POSITION: 'badge-warning',
  CREATE_ATTENDANCE: 'badge-success', UPDATE_ATTENDANCE: 'badge-warning', DELETE_ATTENDANCE: 'badge-danger',
  APPROVE_ATTENDANCE: 'badge-primary', BULK_APPROVE_ATTENDANCE: 'badge-primary',
  LOCK_PAYROLL: 'badge-danger', UNLOCK_PAYROLL: 'badge-success',
};

export default function AuditLogs() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [logs,    setLogs]    = useState([]);
  const [alerts,  setAlerts]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('logs');
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const [fAction,    setFAction]    = useState('');
  const [fTable,     setFTable]     = useState('');
  const [fStartDate, setFStartDate] = useState('');
  const [fEndDate,   setFEndDate]   = useState('');
  const [page,       setPage]       = useState(0);
  const PAGE_SIZE = 50;

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      if (fAction)    params.append('action', fAction);
      if (fTable)     params.append('table_name', fTable);
      if (fStartDate) params.append('start_date', fStartDate);
      if (fEndDate)   params.append('end_date', fEndDate);
      const r = await api.get(`/audit-logs?${params}`);
      setLogs(r.data.logs);
      setTotal(r.data.total);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const r = await api.get('/audit-logs/fraud-alerts');
      setAlerts(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load fraud alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'logs') loadLogs();
    else loadAlerts();
  }, [tab, page]);

  const handleFilter = () => { setPage(0); loadLogs(); };

  const handleResolve = async (id) => {
    try {
      await api.put(`/audit-logs/fraud-alerts/${id}/resolve`);
      setSuccess('Alert resolved.');
      loadAlerts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resolve.');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('audit.title')}</div>
          <div className="page-subtitle">{t('audit.subtitle')}</div>
        </div>
        <div className="flex gap-8">
          <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('logs')}>📋 {t('audit.auditLogs')}</button>
          <button className={`btn ${tab === 'fraud' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('fraud')}>🚨 {t('audit.fraudAlerts')}</button>
        </div>
      </div>

      <div className="page-body">
        {error   && <div className="alert alert-error"   onClick={() => setError('')}>⚠️ {error}</div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess('')}>✓ {success}</div>}

        {tab === 'logs' ? (
          <>
            <div className="card mb-16">
              <div className="card-body" style={{ padding: '14px 20px' }}>
                <div className="flex gap-8 items-center" style={{ flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ marginBottom: 3 }}>{t('audit.action')}</label>
                    <input value={fAction} onChange={e => setFAction(e.target.value)} placeholder={t('audit.actionPh')} style={{ width: 160 }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ marginBottom: 3 }}>{t('audit.table')}</label>
                    <select value={fTable} onChange={e => setFTable(e.target.value)} style={{ width: 160 }}>
                      <option value="">{t('audit.allTables')}</option>
                      <option value="users">users</option>
                      <option value="employees">employees</option>
                      <option value="positions">positions</option>
                      <option value="attendance">attendance</option>
                      <option value="payroll_locks">payroll_locks</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ marginBottom: 3 }}>{t('audit.fromDate')}</label>
                    <input type="date" value={fStartDate} onChange={e => setFStartDate(e.target.value)} style={{ width: 150 }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ marginBottom: 3 }}>{t('audit.toDate')}</label>
                    <input type="date" value={fEndDate} onChange={e => setFEndDate(e.target.value)} style={{ width: 150 }} />
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleFilter}>{t('common.filter')}</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">{t('audit.auditLogs')} ({total} {t('audit.total')})</div>
              </div>
              <div className="table-wrap">
                {loading ? (
                  <div className="page-spinner"><div className="spinner" /> {t('common.loading')}</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{t('audit.time')}</th>
                        <th>{t('audit.user')}</th>
                        <th>{t('audit.action')}</th>
                        <th>{t('audit.table')}</th>
                        <th>{t('audit.recordId')}</th>
                        <th>{t('audit.oldValue')}</th>
                        <th>{t('audit.newValue')}</th>
                        <th>{t('audit.ip')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr><td colSpan={8} className="text-center text-muted" style={{ padding: 40 }}>{t('audit.noLogs')}</td></tr>
                      ) : logs.map((log) => (
                        <tr key={log.id}>
                          <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="fw-bold">{log.username || `#${log.user_id}`}</td>
                          <td>
                            <span className={`badge ${ACTION_COLORS[log.action] || 'badge-gray'}`} style={{ fontSize: 10 }}>
                              {log.action}
                            </span>
                          </td>
                          <td className="text-muted text-sm">{log.table_name}</td>
                          <td className="text-muted text-sm">{log.record_id || '—'}</td>
                          <td>
                            {log.old_value ? (
                              <details>
                                <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}>{t('audit.view')}</summary>
                                <pre style={{ fontSize: 10, background: '#f8fafc', padding: 6, borderRadius: 4, maxWidth: 200, overflow: 'auto', marginTop: 4 }}>
                                  {JSON.stringify(log.old_value, null, 2)}
                                </pre>
                              </details>
                            ) : <span className="text-muted">—</span>}
                          </td>
                          <td>
                            {log.new_value ? (
                              <details>
                                <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}>{t('audit.view')}</summary>
                                <pre style={{ fontSize: 10, background: '#f8fafc', padding: 6, borderRadius: 4, maxWidth: 200, overflow: 'auto', marginTop: 4 }}>
                                  {JSON.stringify(log.new_value, null, 2)}
                                </pre>
                              </details>
                            ) : <span className="text-muted">—</span>}
                          </td>
                          <td className="text-muted text-sm">{log.ip_address || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {totalPages > 1 && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                  <div className="pagination">
                    <button className="page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                    <span className="text-muted text-sm">Page {page + 1} of {totalPages}</span>
                    <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card">
            <div className="card-header">
              <div className="card-title">🚨 {t('audit.fraudAlerts')}</div>
              <span className="badge badge-danger">{alerts.filter(a => !a.resolved).length} {t('dashboard.unresolved', { count: '' }).replace('{{count}} ', '')}</span>
            </div>
            <div className="table-wrap">
              {loading ? (
                <div className="page-spinner"><div className="spinner" /> {t('common.loading')}</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{t('audit.action')}</th>
                      <th>{t('audit.description')}</th>
                      <th>{t('dashboard.employee')}</th>
                      <th>{t('audit.triggeredBy')}</th>
                      <th>{t('audit.time')}</th>
                      <th>{t('employee.statusLabel')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>{t('audit.noAlerts')}</td></tr>
                    ) : alerts.map((a) => (
                      <tr key={a.id} style={a.resolved ? { opacity: .6 } : {}}>
                        <td><span className={`badge ${a.resolved ? 'badge-gray' : 'badge-danger'}`}>{a.alert_type}</span></td>
                        <td style={{ maxWidth: 300 }}>{a.description}</td>
                        <td>{a.employee_name || '—'}</td>
                        <td className="text-muted">{a.triggered_by_username || '—'}</td>
                        <td className="text-muted text-sm">{new Date(a.created_at).toLocaleString()}</td>
                        <td>
                          {a.resolved
                            ? <span className="badge badge-success">{t('status.resolved')}</span>
                            : <span className="badge badge-danger">{t('status.open')}</span>
                          }
                        </td>
                        <td>
                          {!a.resolved && ['admin','manager'].includes(user?.role) && (
                            <button className="btn btn-success btn-sm" onClick={() => handleResolve(a.id)}>
                              {t('common.resolve')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
