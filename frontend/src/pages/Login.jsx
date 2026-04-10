import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LangSwitcher from '../components/LangSwitcher';

export default function Login() {
  const { user, login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form,    setForm]    = useState({ username: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(form.username, form.password);
      if (userData.role === 'employee') navigate('/attendance');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background blobs */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-blob login-blob-3" />
        <div className="login-blob login-blob-4" />
        <div className="login-grid" />
      </div>

      <div className="login-card">
        <LangSwitcher variant="login" />

        <div className="login-logo">
          <img
            src="/assets/logo.png"
            alt="Devinflow"
            className="login-logo-img"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling.style.display = 'block';
            }}
          />
          <div className="login-logo-fallback">
            <h1>HRMS</h1>
          </div>
          <p>{t('login.title')}</p>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label>{t('login.username')}</label>
              <input
                type="text"
                placeholder={t('login.usernamePh')}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>{t('login.password')}</label>
              <input
                type="password"
                placeholder={t('login.passwordPh')}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> {t('login.signingIn')}</>
              : t('login.signIn')
            }
          </button>
        </form>

        <p className="login-footer">© 2026 Devinflow. Built by Annvireak Devin.</p>
      </div>
    </div>
  );
}
