import React, { useEffect, useState } from 'react';
import { t } from './translations.js';

export default function WelcomeAnimation({ language, username, onComplete }) {
  const [animState, setAnimState] = useState('entering'); // entering -> visible -> exiting

  useEffect(() => {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const quickTimer = setTimeout(onComplete, 400);
      return () => clearTimeout(quickTimer);
    }

    const tVisible = setTimeout(() => setAnimState('visible'), 50);
    const tExit = setTimeout(() => setAnimState('exiting'), 2400);
    const tDone = setTimeout(onComplete, 2900);

    return () => {
      clearTimeout(tVisible);
      clearTimeout(tExit);
      clearTimeout(tDone);
    };
  }, [onComplete]);

  return (
    <div
      className={`welcome-overlay welcome-${animState}`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
    >
      <div className="welcome-backdrop-pattern" aria-hidden="true" />
      <div className="welcome-glow" aria-hidden="true" />

      <div className="welcome-modal">
        <div className="welcome-leaf-emblem">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            <path d="M12 2a9 9 0 0 1 9 9c0 5-9 11-9 11S3 16 3 11a9 9 0 0 1 9-9z" />
          </svg>
        </div>

        <p className="welcome-badge">ಅಗ್ರೋ ಮಿತ್ರ • Agro Mitra</p>

        <h1 className="welcome-headline">
          {t('welcome_greeting', language)}, <span className="welcome-user-highlight">{username || 'Farmer'}</span>!
        </h1>

        <p className="welcome-subline">
          {t('welcome_tagline', language)}
        </p>

        <div className="welcome-progress-track" aria-hidden="true">
          <div className="welcome-progress-fill" />
        </div>

        <button
          type="button"
          className="welcome-skip-btn"
          onClick={onComplete}
        >
          {t('welcome_skip', language)} &rarr;
        </button>
      </div>
    </div>
  );
}

