import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY = { name: '', email: '', position_id: '' };

export default function Employees() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';

  const [employees,  setEmployees]  = useState([]);
  const [positions,  setPositions]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [modal,      setModal]      = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [empRes, posRes] = await Promise.all([api.get('/employees'), api.get('/positions')]);
      setEmployees(empRes.data);
      setPositions(posRes.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (emp) => {
    setEditing(emp);
    setForm({ name: emp.name, email: emp.email || '', position_id: emp.position_id || '' });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setError(''); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/employees/${editing.id}`, form);
        setSuccess('Employee updated.');
      } else {
        await api.post('/employees', form);
        setSuccess('Employee created.');
      }
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(t('employee.deactivateConfirm', { name: emp.name }))) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      setSuccess('Employee deactivated.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
    }
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.position_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('employee.title')}</div>
          <div className="page-subtitle">{t('employee.subtitle')}</div>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>{t('employee.add')}</button>}
      </div>

      <div className="page-body">
        {error   && <div className="alert alert-error"   onClick={() => setError('')}>⚠️ {error}</div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess('')}>✓ {success}</div>}

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t('employee.all')} ({filtered.length})</div>
            <input
              type="search"
              placeholder={t('common.search') + '...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 260 }}
            />
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="page-spinner"><div className="spinner" /> {t('common.loading')}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('employee.name')}</th>
                    <th>{t('employee.email')}</th>
                    <th>{t('employee.position')}</th>
                    <th>{t('employee.hourlyRate')}</th>
                    <th>{t('employee.statusLabel')}</th>
                    {isAdmin && <th>{t('common.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 7 : 6} className="text-center text-muted" style={{ padding: 40 }}>{t('common.noData')}</td></tr>
                  ) : filtered.map((emp) => (
                    <tr key={emp.id}>
                      <td className="text-muted text-sm">{emp.id}</td>
                      <td className="fw-bold">{emp.name}</td>
                      <td className="text-muted">{emp.email || '—'}</td>
                      <td>{emp.position_name ? <span className="badge badge-primary">{emp.position_name}</span> : <span className="text-muted">—</span>}</td>
                      <td>{emp.hourly_rate ? `$${parseFloat(emp.hourly_rate).toFixed(2)}/hr` : '—'}</td>
                      <td><span className={`badge ${emp.active ? 'badge-success' : 'badge-gray'}`}>{emp.active ? t('status.active') : t('status.inactive')}</span></td>
                      {isAdmin && (
                        <td>
                          <div className="flex gap-8">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}>{t('common.edit')}</button>
                            {emp.active && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(emp)}>{t('employee.deactivate')}</button>
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
              <div className="modal-title">{editing ? t('employee.edit') : t('employee.add')}</div>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('employee.name')} *</label>
                    <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder={t('employee.namePh')} />
                  </div>
                  <div className="form-group">
                    <label>{t('employee.email')}</label>
                    <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder={t('employee.emailPh')} />
                  </div>
                  <div className="form-group">
                    <label>{t('employee.position')}</label>
                    <select value={form.position_id} onChange={e => setForm({...form, position_id: e.target.value})}>
                      <option value="">— {t('common.all')} —</option>
                      {positions.map(p => <option key={p.id} value={p.id}>{p.name} (${p.hourly_rate}/hr)</option>)}
                    </select>
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
