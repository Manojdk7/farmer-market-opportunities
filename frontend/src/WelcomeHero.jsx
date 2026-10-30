import React from 'react';

export default function WelcomeHero({ language, currentUser }) {
  const userName = currentUser?.full_name || currentUser?.username || 'Farmer User';
  const greeting = language === 'kn' ? `ಸ್ವಾಗತ, ${userName}!` : `Welcome, ${userName}!`;
  const subtitle =
    language === 'kn'
      ? 'ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ತಿಳಿಯಲು, ದರಗಳನ್ನು ಹೋಲಿಸಲು ಮತ್ತು ಲಾಭದಾಯಕ ನಿರ್ಧಾರಗಳನ್ನು ಕೈಗೊಳ್ಳಲು ಕೆಳಗಿನ ಕಾರ್ಡ್‌ಗಳನ್ನು ಬಳಸಿ.'
      : 'Choose a feature below to get market information, compare prices and make better selling decisions.';
  const tagline = language === 'kn' ? 'ಉತ್ತಮ ಕೃಷಿ, ಸಮೃದ್ಧ ಬದುಕು' : 'Better Farming Together.';

  return (
    <section className="ref-welcome-banner" aria-label="Welcome banner">
      <div className="ref-banner-backdrop" aria-hidden="true">
        {/* Soft landscape hills SVG decoration */}
        <svg className="ref-landscape-svg" viewBox="0 0 1200 160" preserveAspectRatio="none">
          <path d="M0,160 L0,120 Q200,60 400,110 T800,90 Q1050,40 1200,100 L1200,160 Z" fill="#d1e8d4" opacity="0.6" />
          <path d="M0,160 L0,135 Q250,90 550,130 T1000,105 Q1150,90 1200,125 L1200,160 Z" fill="#21845a" opacity="0.12" />
        </svg>
      </div>

      <div className="ref-banner-content">
        <div className="ref-banner-text">
          <h2 className="ref-banner-greeting">{greeting}</h2>
          <p className="ref-banner-subtitle">{subtitle}</p>
        </div>
        <div className="ref-banner-callout">
          <span className="ref-callout-script">{tagline}</span>
        </div>
      </div>
    </section>
  );
}

