import React, { useState } from 'react';
import { t } from './translations';

export default function DashboardHeader({
  language,
  onLanguageChange,
  currentUser,
  onLogout,
  browserOnline,
  isOffline,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="ref-header">
      <div className="ref-header-brand">
        <div className="ref-logo-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12c0 3.84 2.16 7.18 5.34 8.87.27-.4.57-.8.9-1.19 1.83-2.18 4.31-3.68 7.08-4.22-.05-.48-.08-.96-.08-1.46 0-3.31 2.69-6 6-6 .5 0 .98.03 1.46.08C22.16 4.84 17.5 2 12 2z"
              fill="#21845A"
            />
            <path
              d="M21.7 8.08C20.65 8.03 19.6 8.35 18.73 9.04 17.61 9.94 17 11.3 17 12.75c0 .5.08 1 .23 1.47-2.77.54-5.25 2.04-7.08 4.22-.33.39-.63.79-.9 1.19C10.15 20.35 11.06 20.8 12 20.94V22c5.52 0 10-4.48 10-10 0-1.39-.29-2.71-.8-3.92h-.5z"
              fill="#075B46"
            />
          </svg>
        </div>
        <div className="ref-brand-text">
          <h1 className="ref-brand-title">Agro Mitra</h1>
          <p className="ref-brand-tagline">Smart Decisions. Better Farming.</p>
        </div>
      </div>

      <div className="ref-header-actions">
        {/* Language Pill Switcher */}
        <div className="ref-lang-switcher" role="radiogroup" aria-label="Language">
          <button
            type="button"
            className={`ref-lang-btn ${language === 'kn' ? 'active' : ''}`}
            onClick={() => onLanguageChange('kn')}
          >
            <span className="globe-icon">🌐</span> ಕನ್ನಡ
          </button>
          <button
            type="button"
            className={`ref-lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => onLanguageChange('en')}
          >
            <span className="globe-icon">🌐</span> English
          </button>
        </div>

        {/* User Profile Area */}
        {currentUser && (
          <div className="ref-user-profile-menu">
            <button
              type="button"
              className="ref-user-pill"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
            >
              <div className="ref-avatar">👤</div>
              <span className="ref-username">{currentUser.username || 'Farmer User'}</span>
              <span className="ref-chevron">▾</span>
            </button>

            {dropdownOpen && (
              <div className="ref-user-dropdown">
                <div className="ref-dropdown-user-info">
                  <strong>{currentUser.full_name || currentUser.username}</strong>
                  <span className="ref-dropdown-role">{currentUser.role || 'farmer'}</span>
                  {currentUser.district && <span className="ref-dropdown-dist">📍 {currentUser.district}</span>}
                </div>
                <hr className="ref-dropdown-divider" />
                <button
                  type="button"
                  className="ref-dropdown-logout-btn"
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                >
                  <span className="ref-logout-icon">↪</span> {t('logout', language)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Direct Logout Icon Button */}
        {currentUser && (
          <button
            type="button"
            className="ref-header-logout"
            onClick={onLogout}
            title={t('logout', language)}
          >
            <span className="ref-logout-arrow">↪</span> {t('logout', language)}
          </button>
        )}

        {/* Offline Badges */}
        {!browserOnline ? (
          <span className="ref-offline-badge">{t('browser_offline', language)}</span>
        ) : isOffline ? (
          <span className="ref-offline-badge">{t('offline_calc_badge', language)}</span>
        ) : null}
      </div>
    </header>
  );
}

