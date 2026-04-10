import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const EMPTY = { name: '', hourly_rate: '', ot_multiplier: '1.5' };

export default function Positions() {
  const { t } = useTranslation();
  const [positions, setPositions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/positions')
      .then(r => setPositions(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load positions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (pos) => {
    setEditing(pos);
    setForm({ name: pos.name, hourly_rate: pos.hourly_rate, ot_multiplier: pos.ot_multiplier });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setError(''); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/positions/${editing.id}`, form);
        setSuccess('Position updated.');
      } else {
        await api.post('/positions', form);
        setSuccess('Position created.');
      }
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('position.title')}</div>
          <div className="page-subtitle">{t('position.subtitle')}</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>{t('position.add')}</button>
      </div>

      <div className="page-body">
        {error   && <div className="alert alert-error"   onClick={() => setError('')}>⚠️ {error}</div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess('')}>✓ {success}</div>}

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t('position.all')} ({positions.length})</div>
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="page-spinner"><div className="spinner" /> {t('common.loading')}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('position.name')}</th>
                    <th>{t('position.hourlyRate')}</th>
                    <th>{t('position.otMultiplier')}</th>
                    <th>{t('position.otRate')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>{t('common.noData')}</td></tr>
                  ) : positions.map((pos) => {
                    const rate = parseFloat(pos.hourly_rate);
                    const mult = parseFloat(pos.ot_multiplier);
                    return (
                      <tr key={pos.id}>
                        <td className="text-muted text-sm">{pos.id}</td>
                        <td className="fw-bold">{pos.name}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>${rate.toFixed(2)}/hr</td>
                        <td><span className="badge badge-info">×{mult.toFixed(1)}</span></td>
                        <td style={{ color: 'var(--warning)', fontWeight: 700 }}>${(rate * mult).toFixed(2)}/hr</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(pos)}>{t('common.edit')}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="alert alert-warning mt-16">
          🔐 {t('position.warning')}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing ? t('position.edit') : t('position.add')}</div>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('position.name')} *</label>
                    <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder={t('position.namePh')} />
                  </div>
                  <div className="form-group">
                    <label>{t('position.hourlyRate')} *</label>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={form.hourly_rate}
                      onChange={e => setForm({...form, hourly_rate: e.target.value})}
                      required placeholder={t('position.hourlyRatePh')}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('position.otMultiplier')}</label>
                    <input
                      type="number" min="1.0" step="0.1"
                      value={form.ot_multiplier}
                      onChange={e => setForm({...form, ot_multiplier: e.target.value})}
                      placeholder="Default: 1.5"
                    />
                  </div>
                  {form.hourly_rate && form.ot_multiplier && (
                    <div className="form-group">
                      <label>{t('position.otRate')}</label>
                      <div style={{ padding: '8px 12px', background: 'var(--warning-light)', borderRadius: 'var(--radius)', fontWeight: 700, color: 'var(--warning)' }}>
                        ${(parseFloat(form.hourly_rate || 0) * parseFloat(form.ot_multiplier || 1.5)).toFixed(2)}/hr
                      </div>
                    </div>
                  )}
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
