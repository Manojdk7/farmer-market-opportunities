import React, { useState } from 'react';

export default function FeatureCard({
  id,
  number,
  icon,
  titleKn,
  titleEn,
  description,
  features = [],
  actionButtons = [],
  illustration,
  children,
  defaultExpanded = false,
  isWide = false,
  language = 'en',
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <article className={`ref-feature-card ${isWide ? 'wide-card' : ''} ${isExpanded ? 'expanded' : ''}`} id={id}>
      <div className="ref-card-header">
        <div className="ref-card-badge-row">
          <span className="ref-card-num-circle">{number}</span>
          <div className="ref-card-icon-pill">{icon}</div>
        </div>

        <div className="ref-card-headings">
          <h2 className="ref-card-title-kn">{titleKn}</h2>
          <h3 className="ref-card-title-en">{titleEn}</h3>
          <p className="ref-card-desc">{description}</p>
        </div>
      </div>

      <div className="ref-card-body-summary">
        {/* Features Checklist */}
        {features.length > 0 && (
          <ul className="ref-feature-checklist">
            {features.map((feat, idx) => (
              <li key={idx} className="ref-checklist-item">
                <span className="ref-check-icon">✔</span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Thumbnail / Graphic on right side if provided */}
        {illustration && (
          <div className="ref-card-illustration-box">
            {illustration}
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="ref-card-actions-bar">
        {actionButtons.map((btn, idx) => (
          <button
            key={idx}
            type="button"
            className={`ref-card-btn ${btn.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => {
              if (btn.toggleExpand) {
                setIsExpanded((prev) => !prev);
              }
              if (btn.onClick) {
                btn.onClick();
              }
            }}
          >
            {btn.icon && <span className="btn-icon">{btn.icon}</span>}
            <span>{btn.label}</span>
            {btn.showArrow && <span className="btn-arrow">→</span>}
          </button>
        ))}

        {children && !actionButtons.some((b) => b.toggleExpand) && (
          <button
            type="button"
            className="ref-card-toggle-details-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            {isExpanded
              ? (language === 'kn' ? 'ವಿವರಗಳನ್ನು ಮರೆಮಾಡಿ ▲' : 'Collapse Details ▲')
              : (language === 'kn' ? 'ಪೂರ್ಣ ಮಾಹಿತಿ ತೆರೆಯಿರಿ ▼' : 'Expand Details ▼')}
          </button>
        )}
      </div>

      {/* Expandable Interactive Working Area */}
      {children && (
        <div className={`ref-card-interactive-drawer ${isExpanded ? 'open' : ''}`}>
          <div className="ref-card-drawer-inner">
            {children}
          </div>
        </div>
      )}
    </article>
  );
}

