import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Payroll() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';

  const now = new Date();
  const [start, setStart] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
  const [end,   setEnd]   = useState(new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0]);
  const [empFilter, setEmpFilter] = useState('');
  const [posFilter, setPosFilter] = useState('');

  const [summary,   setSummary]   = useState(null);
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [locks,     setLocks]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const [lockModal,  setLockModal]  = useState(false);
  const [lockForm,   setLockForm]   = useState({ period_label: '', start_date: start, end_date: end });
  const [savingLock, setSavingLock] = useState(false);

  const loadFilters = async () => {
    try {
      const [empRes, posRes] = await Promise.all([api.get('/employees'), api.get('/positions')]);
      setEmployees(empRes.data);
      setPositions(posRes.data);
    } catch {}
  };

  const loadLocks = async () => {
    if (!isAdmin) return;
    try { const r = await api.get('/payroll/locks'); setLocks(r.data); } catch {}
  };

  useEffect(() => {
    if (['admin','hr','manager'].includes(user?.role)) loadFilters();
    loadLocks();
  }, []);

  const loadPayroll = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ start_date: start, end_date: end });
      if (empFilter) params.append('employee_id', empFilter);
      if (posFilter) params.append('position_id', posFilter);
      const r = await api.get(`/payroll?${params}`);
      setSummary(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to calculate payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleLockCreate = async (e) => {
    e.preventDefault();
    setSavingLock(true);
    try {
      await api.post('/payroll/locks', lockForm);
      setSuccess('Payroll period locked.');
      setLockModal(false);
      loadLocks();
    } catch (err) {
      setError(err.response?.data?.error || 'Lock failed.');
    } finally {
      setSavingLock(false);
    }
  };

  const handleToggleLock = async (id, isLocked) => {
    const action = isLocked ? t('payroll.unlock') : t('payroll.lock');
    if (!window.confirm(`${action}?`)) return;
    try {
      await api.put(`/payroll/locks/${id}`);
      setSuccess(`${action}.`);
      loadLocks();
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed.');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('payroll.title')}</div>
          <div className="page-subtitle">{t('payroll.subtitle')}</div>
        </div>
        {isAdmin && (
          <button className="btn btn-secondary" onClick={() => setLockModal(true)}>🔒 {t('payroll.lockPeriod')}</button>
        )}
      </div>

      <div className="page-body">
        {error   && <div className="alert alert-error"   onClick={() => setError('')}>⚠️ {error}</div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess('')}>✓ {success}</div>}

        <div className="card mb-16">
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div className="flex gap-8 items-center" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ marginBottom: 3 }}>{t('payroll.startDate')}</label>
                <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: 150 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ marginBottom: 3 }}>{t('payroll.endDate')}</label>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ width: 150 }} />
              </div>
              {['admin','hr','manager'].includes(user?.role) && (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ marginBottom: 3 }}>{t('payroll.employee')}</label>
                    <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ width: 180 }}>
                      <option value="">{t('payroll.allEmployees')}</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ marginBottom: 3 }}>{t('payroll.position')}</label>
                    <select value={posFilter} onChange={e => setPosFilter(e.target.value)} style={{ width: 180 }}>
                      <option value="">{t('payroll.allPositions')}</option>
                      {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div style={{ marginTop: 20 }}>
                <button className="btn btn-primary" onClick={loadPayroll} disabled={loading}>
                  {loading ? t('payroll.calculating') : `📊 ${t('payroll.calculate')}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {summary && (
          <>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
              <div className="stat-card primary">
                <div className="stat-label">{t('payroll.totalPayroll')}</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{fmt(summary.grand_total_salary)}</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">{t('payroll.totalHours')}</div>
                <div className="stat-value">{summary.grand_total_hours.toFixed(1)}h</div>
              </div>
              <div className="stat-card danger">
                <div className="stat-label">{t('payroll.totalOT')}</div>
                <div className="stat-value">{summary.grand_total_ot_hours.toFixed(1)}h</div>
              </div>
              <div className="stat-card success">
                <div className="stat-label">{t('payroll.employees')}</div>
                <div className="stat-value">{summary.total_employees}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">{t('payroll.details')} — {summary.start_date} {t('common.to')} {summary.end_date}</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('payroll.employee')}</th>
                      <th>{t('payroll.position')}</th>
                      <th className="text-right">{t('payroll.rate')}</th>
                      <th className="text-right">{t('payroll.daysPresent')}</th>
                      <th className="text-right">{t('payroll.regHours')}</th>
                      <th className="text-right">{t('payroll.otHours')}</th>
                      <th className="text-right">{t('payroll.regularPay')}</th>
                      <th className="text-right">{t('payroll.otPay')}</th>
                      <th className="text-right" style={{ color: 'var(--primary)' }}>{t('payroll.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.records.length === 0 ? (
                      <tr><td colSpan={9} className="text-center text-muted" style={{ padding: 40 }}>{t('payroll.noApproved')}</td></tr>
                    ) : summary.records.map((r) => (
                      <tr key={r.employee_id}>
                        <td className="fw-bold">{r.employee_name}</td>
                        <td><span className="badge badge-primary">{r.position_name}</span></td>
                        <td className="text-right">${r.hourly_rate.toFixed(2)}/hr</td>
                        <td className="text-right">{r.days_present}</td>
                        <td className="text-right">{r.total_hours.toFixed(1)}h</td>
                        <td className="text-right">{r.total_ot_hours > 0 ? <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{r.total_ot_hours.toFixed(1)}h</span> : '—'}</td>
                        <td className="text-right">{fmt(r.regular_pay)}</td>
                        <td className="text-right">{r.ot_pay > 0 ? <span style={{ color: 'var(--warning)' }}>{fmt(r.ot_pay)}</span> : '—'}</td>
                        <td className="text-right fw-bold" style={{ color: 'var(--primary)' }}>{fmt(r.total_salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {summary.records.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan={4}>{t('payroll.grandTotal')}</td>
                        <td className="text-right">{summary.grand_total_hours.toFixed(1)}h</td>
                        <td className="text-right" style={{ color: 'var(--warning)' }}>{summary.grand_total_ot_hours.toFixed(1)}h</td>
                        <td className="text-right">{fmt(summary.records.reduce((s,r) => s + r.regular_pay, 0))}</td>
                        <td className="text-right" style={{ color: 'var(--warning)' }}>{fmt(summary.records.reduce((s,r) => s + r.ot_pay, 0))}</td>
                        <td className="text-right" style={{ color: 'var(--primary)', fontSize: 16 }}>{fmt(summary.grand_total_salary)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {isAdmin && locks.length > 0 && (
          <div className="card mt-16">
            <div className="card-header">
              <div className="card-title">🔒 {t('payroll.lockPeriods')}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('payroll.period')}</th>
                    <th>{t('payroll.startDate')}</th>
                    <th>{t('payroll.endDate')}</th>
                    <th>{t('employee.statusLabel')}</th>
                    <th>{t('payroll.lockedBy')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {locks.map(l => (
                    <tr key={l.id}>
                      <td className="fw-bold">{l.period_label}</td>
                      <td>{l.start_date}</td>
                      <td>{l.end_date}</td>
                      <td><span className={`badge ${l.is_locked ? 'badge-danger' : 'badge-success'}`}>{l.is_locked ? `🔒 ${t('status.locked')}` : `🔓 ${t('status.unlocked')}`}</span></td>
                      <td className="text-muted">{l.locked_by_username}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${l.is_locked ? 'btn-success' : 'btn-secondary'}`}
                          onClick={() => handleToggleLock(l.id, l.is_locked)}
                        >
                          {l.is_locked ? t('payroll.unlock') : t('payroll.lock')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {lockModal && (
        <div className="modal-overlay" onClick={() => setLockModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🔒 {t('payroll.lockPeriod')}</div>
              <button className="modal-close" onClick={() => setLockModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLockCreate}>
              <div className="modal-body">
                <div className="alert alert-warning">{t('payroll.lockWarning')}</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('payroll.periodLabel')} *</label>
                    <input value={lockForm.period_label} onChange={e => setLockForm({...lockForm, period_label: e.target.value})} required placeholder={t('payroll.periodLabelPh')} />
                  </div>
                  <div className="form-group">
                    <label>{t('payroll.startDate')} *</label>
                    <input type="date" value={lockForm.start_date} onChange={e => setLockForm({...lockForm, start_date: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>{t('payroll.endDate')} *</label>
                    <input type="date" value={lockForm.end_date} onChange={e => setLockForm({...lockForm, end_date: e.target.value})} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setLockModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-danger" disabled={savingLock}>
                  {savingLock ? t('payroll.locking') : `🔒 ${t('payroll.lockPeriod')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
