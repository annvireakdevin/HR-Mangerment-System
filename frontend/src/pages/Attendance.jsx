import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const today = () => new Date().toISOString().split('T')[0];
const EMPTY  = { employee_id: '', date: today(), hours_worked: '8', ot_hours: '0', status: 'present' };

export default function Attendance() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const canEdit    = ['admin', 'hr'].includes(user?.role);
  const canApprove = ['admin', 'manager'].includes(user?.role);

  const [records,   setRecords]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [selected,  setSelected]  = useState([]);

  const now = new Date();
  const [fStart, setFStart] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
  const [fEnd,   setFEnd]   = useState(today());
  const [fEmp,   setFEmp]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: fStart, end_date: fEnd });
      if (fEmp) params.append('employee_id', fEmp);
      const [attRes, empRes] = await Promise.all([
        api.get(`/attendance?${params}`),
        (canEdit || canApprove) ? api.get('/employees') : Promise.resolve({ data: [] }),
      ]);
      setRecords(attRes.data);
      setEmployees(empRes.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (r) => {
    setEditing(r);
    setForm({ employee_id: r.employee_id, date: r.date, hours_worked: r.hours_worked, ot_hours: r.ot_hours, status: r.status });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setError(''); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/attendance/${editing.id}`, form);
        setSuccess('Attendance updated.');
      } else {
        await api.post('/attendance', form);
        setSuccess('Attendance created.');
      }
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(t('attendance.deleteConfirm'))) return;
    try {
      await api.delete(`/attendance/${r.id}`);
      setSuccess('Record deleted.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/attendance/${id}/approve`);
      setSuccess('Approved.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Approve failed.');
    }
  };

  const handleBulkApprove = async () => {
    if (selected.length === 0) return;
    try {
      const res = await api.post('/attendance/bulk-approve', { ids: selected });
      setSuccess(`${res.data.approved} records approved.`);
      setSelected([]);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Bulk approve failed.');
    }
  };

  const toggleSelect = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () =>
    setSelected(selected.length === records.length ? [] : records.map(r => r.id));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('attendance.title')}</div>
          <div className="page-subtitle">{t('attendance.subtitle')}</div>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={openCreate}>{t('attendance.add')}</button>}
      </div>

      <div className="page-body">
        {error   && <div className="alert alert-error"   onClick={() => setError('')}>⚠️ {error}</div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess('')}>✓ {success}</div>}

        <div className="card mb-16">
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div className="flex gap-8 items-center" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '0 0 auto', marginBottom: 0 }}>
                <label style={{ marginBottom: 3 }}>{t('common.from')}</label>
                <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} style={{ width: 150 }} />
              </div>
              <div className="form-group" style={{ flex: '0 0 auto', marginBottom: 0 }}>
                <label style={{ marginBottom: 3 }}>{t('common.to')}</label>
                <input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} style={{ width: 150 }} />
              </div>
              {(canEdit || canApprove) && (
                <div className="form-group" style={{ flex: '0 0 auto', marginBottom: 0 }}>
                  <label style={{ marginBottom: 3 }}>{t('attendance.employee')}</label>
                  <select value={fEmp} onChange={e => setFEmp(e.target.value)} style={{ width: 200 }}>
                    <option value="">{t('attendance.allEmployees')}</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginTop: 20 }}>
                <button className="btn btn-primary btn-sm" onClick={load}>{t('common.filter')}</button>
              </div>
              {canApprove && selected.length > 0 && (
                <div style={{ marginTop: 20, marginLeft: 'auto' }}>
                  <button className="btn btn-success btn-sm" onClick={handleBulkApprove}>
                    ✓ {t('attendance.bulkApprove', { count: selected.length })}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t('attendance.records')} ({records.length})</div>
            <div className="flex gap-8 items-center">
              <span className="badge badge-success">✓ {t('status.approved')}</span>
              <span className="badge badge-warning">⏳ {t('status.pending')}</span>
            </div>
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="page-spinner"><div className="spinner" /> {t('common.loading')}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {canApprove && <th><input type="checkbox" checked={selected.length === records.length && records.length > 0} onChange={toggleAll} /></th>}
                    <th>{t('attendance.date')}</th>
                    <th>{t('attendance.employee')}</th>
                    <th>{t('employee.statusLabel')}</th>
                    <th>{t('attendance.hours')}</th>
                    <th>{t('attendance.otHours')}</th>
                    <th>{t('attendance.approval')}</th>
                    {(canEdit || canApprove) && <th>{t('common.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={canApprove ? 8 : 7} className="text-center text-muted" style={{ padding: 40 }}>{t('common.noData')}</td></tr>
                  ) : records.map((r) => (
                    <tr key={r.id}>
                      {canApprove && (
                        <td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} disabled={r.approved} /></td>
                      )}
                      <td className="fw-bold">{r.date}</td>
                      <td>{r.employee_name}</td>
                      <td><span className={`badge ${r.status === 'present' ? 'badge-success' : 'badge-danger'}`}>{r.status === 'present' ? t('status.present') : t('status.absent')}</span></td>
                      <td>{r.hours_worked}h</td>
                      <td>{parseFloat(r.ot_hours) > 0 ? <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{r.ot_hours}h</span> : <span className="text-muted">—</span>}</td>
                      <td>
                        {r.approved
                          ? <span className="badge badge-success">✓ {t('status.approved')}</span>
                          : <span className="badge badge-warning">{t('status.pending')}</span>
                        }
                      </td>
                      {(canEdit || canApprove) && (
                        <td>
                          <div className="flex gap-8">
                            {canApprove && !r.approved && (
                              <button className="btn btn-success btn-sm" onClick={() => handleApprove(r.id)}>{t('common.approve')}</button>
                            )}
                            {canEdit && !r.approved && (
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>{t('common.edit')}</button>
                            )}
                            {canEdit && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}>{t('common.delete')}</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing ? t('attendance.edit') : t('attendance.add')}</div>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                <div className="form-grid form-grid-2">
                  {!editing && (
                    <div className="form-group">
                      <label>{t('attendance.employee')} *</label>
                      <select value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} required>
                        <option value="">— {t('common.all')} —</option>
                        {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>{t('attendance.date')} *</label>
                    <input type="date" value={form.date} max={today()} onChange={e => setForm({...form, date: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>{t('employee.statusLabel')}</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                      <option value="present">{t('status.present')}</option>
                      <option value="absent">{t('status.absent')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('attendance.hoursMax')}</label>
                    <input type="number" min="0" max="24" step="0.5" value={form.hours_worked} onChange={e => setForm({...form, hours_worked: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>{t('attendance.otHoursMax')}</label>
                    <input type="number" min="0" max="16" step="0.5" value={form.ot_hours} onChange={e => setForm({...form, ot_hours: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common.saving') : (editing ? t('common.update') : t('common.create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
