import React, { useState } from 'react';
import { t } from './translations.js';

export default function LoginPage({ language, setLanguage, onLoginSuccess, onGoToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError(t('login_error_empty', language));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, password }),
      });

      if (res.ok) {
        const data = await res.json();
        onLoginSuccess(data);
      } else if (res.status === 429) {
        setError(t('login_error_locked', language));
      } else if (res.status === 401) {
        setError(t('login_error_invalid', language));
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.detail || t('login_error_invalid', language));
      }
    } catch {
      setError(t('login_error_network', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-badge-icon" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                <path d="M12 2a9 9 0 0 1 9 9c0 5-9 11-9 11S3 16 3 11a9 9 0 0 1 9-9z" />
              </svg>
            </div>
            <h1 className="login-title">{t('login_title', language)}</h1>
            <p className="login-subtitle">{t('login_subtitle', language)}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="login-form-group">
              <label htmlFor="login-username" className="login-label">
                {t('login_username', language)}
              </label>
              <div className="login-input-wrapper">
                <input
                  id="login-username"
                  type="text"
                  className="login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login_identifier_placeholder', language)}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-form-group">
              <label htmlFor="login-password" className="login-label">
                {t('login_password', language)}
              </label>
              <div className="login-input-wrapper password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('login_hide_password', language) : t('login_show_password', language)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error-alert" role="alert">
                <span className="error-icon" aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="login-btn-loading">
                  <span className="auth-spinner" aria-hidden="true"></span>
                  {t('login_loading', language)}
                </span>
              ) : (
                t('login_button', language)
              )}
            </button>
          </form>

          <div className="auth-switch-link-wrapper">
            <button
              type="button"
              className="auth-link-btn"
              onClick={onGoToRegister}
            >
              {t('register_dont_have_account', language)}
            </button>
          </div>

          <div className="login-footer">
            <div className="segmented-lang-selector login-lang-switch">
              <button
                type="button"
                className={language === 'kn' ? 'active' : ''}
                onClick={() => setLanguage('kn')}
              >
                ಕನ್ನಡ
              </button>
              <button
                type="button"
                className={language === 'en' ? 'active' : ''}
                onClick={() => setLanguage('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

