export default function StickyQuickNav({ activeTab, onSelectTab, language }) {
  const navItems = [
    { id: 'all', icon: '🏠', labelKn: 'ಅವಲೋಕನ', labelEn: 'Overview' },
    { id: 'card-apmc', icon: '🏛️', labelKn: 'ಎಪಿಎಂಸಿ ದತ್ತಾಂಶ', labelEn: 'APMC Markets' },
    { id: 'card-produce', icon: '🌾', labelKn: 'ಬೆಳೆ & ಪ್ರಮಾಣ', labelEn: 'Produce & Lot' },
    { id: 'card-comparison', icon: '⚖️', labelKn: 'ಮಾರುಕಟ್ಟೆ ತುಲನೆ', labelEn: 'Compare Markets' },
    { id: 'card-decision', icon: '📊', labelKn: 'ನಿರ್ಧಾರ ವಿಶ್ಲೇಷಣೆ', labelEn: 'Decision Analysis' },
    { id: 'card-analytics', icon: '📈', labelKn: 'ಐತಿಹಾಸಿಕ ಪ್ರವೃತ್ತಿ', labelEn: 'Historical Trends' },
    { id: 'card-saved-obs', icon: '💾', labelKn: 'ಉಳಿಸಿದ ಬೆಲೆಗಳು', labelEn: 'Saved Observations' },
    { id: 'card-recent-calcs', icon: '🕒', labelKn: 'ಲೆಕ್ಕಾಚಾರದ ಇತಿಹಾಸ', labelEn: 'Calculation History' },
  ];

  const handleClick = (id) => {
    onSelectTab(id);
    if (id === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <nav className="ref-sticky-nav" aria-label="Feature Quick Navigation">
      <div className="ref-nav-inner">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const label = language === 'kn' ? item.labelKn : item.labelEn;
          return (
            <button
              key={item.id}
              type="button"
              className={`ref-nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleClick(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="ref-nav-icon">{item.icon}</span>
              <span className="ref-nav-text">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
