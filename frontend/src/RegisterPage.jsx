import React, { useState } from 'react';
import { t, KARNATAKA_DISTRICTS } from './translations.js';

export default function RegisterPage({ language, setLanguage, onRegisterSuccess, onGoToLogin }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState(KARNATAKA_DISTRICTS[0]?.name || 'Bagalkote');
  const [preferredLang, setPreferredLang] = useState(language);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 1, label: t('register_password_strength_weak', language), color: '#e53e3e' };
    if (score === 2) return { score: 2, label: t('register_password_strength_fair', language), color: '#dd6b20' };
    if (score === 3 || score === 4) return { score: 3, label: t('register_password_strength_good', language), color: '#319795' };
    return { score: 4, label: t('register_password_strength_strong', language), color: '#2f8551' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = fullName.trim();
    const cleanUser = username.trim();
    const cleanMobile = mobileNumber.trim().replace(/\s+/g, '');

    if (!cleanName) {
      setError(t('register_err_name_required', language));
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setError(t('register_err_username_len', language));
      return;
    }
    const cleanEmail = email.trim();
    if (cleanEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setError(t('register_err_email_invalid', language));
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setError(t('register_err_mobile_invalid', language));
      return;
    }
    if (!password || password.length < 6) {
      setError(t('register_err_password_len', language));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('register_err_password_match', language));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: cleanName,
          username: cleanUser,
          mobile_number: cleanMobile,
          email: email.trim() || null,
          district: district,
          preferred_language: preferredLang,
          password: password,
          confirm_password: confirmPassword,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update language if farmer selected a different preference
        if (preferredLang && preferredLang !== language) {
          setLanguage(preferredLang);
        }
        onRegisterSuccess(data);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.detail || t('login_error_network', language));
      }
    } catch {
      setError(t('login_error_network', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card-container registration-card-container">
        <div className="login-card registration-card">
          <div className="login-header">
            <div className="login-badge-icon" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <h1 className="login-title">{t('register_title', language)}</h1>
            <p className="login-subtitle">{t('register_subtitle', language)}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form registration-form" noValidate>
            <div className="form-grid-two-col">
              {/* Full Name */}
              <div className="login-form-group">
                <label htmlFor="reg-fullname" className="login-label">
                  {t('register_full_name', language)} <span className="required-star">*</span>
                </label>
                <div className="login-input-wrapper">
                  <input
                    id="reg-fullname"
                    type="text"
                    className="login-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={language === 'kn' ? 'ಬಸವರಾಜ್ ಪಾಟೀಲ್' : 'Basavaraj Patil'}
                    autoComplete="name"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Username */}
              <div className="login-form-group">
                <label htmlFor="reg-username" className="login-label">
                  {t('login_username', language)} <span className="required-star">*</span>
                </label>
                <div className="login-input-wrapper">
                  <input
                    id="reg-username"
                    type="text"
                    className="login-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="basavaraj2026"
                    autoComplete="username"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="form-grid-two-col">
              {/* Mobile Number */}
              <div className="login-form-group">
                <label htmlFor="reg-mobile" className="login-label">
                  {t('register_mobile', language)} <span className="required-star">*</span>
                </label>
                <div className="login-input-wrapper">
                  <input
                    id="reg-mobile"
                    type="tel"
                    className="login-input"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="9876543210"
                    autoComplete="tel"
                    maxLength={10}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email (Optional) */}
              <div className="login-form-group">
                <label htmlFor="reg-email" className="login-label">
                  {t('register_email', language)}
                </label>
                <div className="login-input-wrapper">
                  <input
                    id="reg-email"
                    type="email"
                    className="login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="farmer@example.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="form-grid-two-col">
              {/* District */}
              <div className="login-form-group">
                <label htmlFor="reg-district" className="login-label">
                  {t('register_district', language)}
                </label>
                <div className="login-input-wrapper">
                  <select
                    id="reg-district"
                    className="login-input login-select"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    disabled={loading}
                  >
                    {KARNATAKA_DISTRICTS.map((d) => (
                      <option key={d.id} value={d.name}>
                        {language === 'kn' ? d.name_kn : d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preferred Language */}
              <div className="login-form-group">
                <label htmlFor="reg-lang" className="login-label">
                  {t('register_preferred_lang', language)}
                </label>
                <div className="login-input-wrapper">
                  <select
                    id="reg-lang"
                    className="login-input login-select"
                    value={preferredLang}
                    onChange={(e) => setPreferredLang(e.target.value)}
                    disabled={loading}
                  >
                    <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-grid-two-col">
              {/* Password */}
              <div className="login-form-group">
                <label htmlFor="reg-password" className="login-label">
                  {t('login_password', language)} <span className="required-star">*</span>
                </label>
                <div className="login-input-wrapper password-wrapper">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
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
                {/* Password Strength Indicator */}
                {password && (
                  <div className="password-strength-container">
                    <div className="password-strength-bars">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className="strength-bar-segment"
                          style={{
                            backgroundColor: level <= strength.score ? strength.color : '#e2e8f0',
                          }}
                        />
                      ))}
                    </div>
                    <span className="strength-label" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="login-form-group">
                <label htmlFor="reg-confirm-password" className="login-label">
                  {t('register_confirm_password', language)} <span className="required-star">*</span>
                </label>
                <div className="login-input-wrapper password-wrapper">
                  <input
                    id="reg-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input password-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
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
                  {t('register_loading', language)}
                </span>
              ) : (
                t('register_button', language)
              )}
            </button>
          </form>

          <div className="auth-switch-link-wrapper">
            <button
              type="button"
              className="auth-link-btn"
              onClick={onGoToLogin}
            >
              {t('register_have_account', language)}
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

