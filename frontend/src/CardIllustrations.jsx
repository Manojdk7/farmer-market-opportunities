import React from 'react';

export const APMCIllustration = () => (
  <svg width="100" height="70" viewBox="0 0 120 85" fill="none">
    <rect x="25" y="35" width="70" height="40" rx="4" fill="#E7F2E5" stroke="#21845A" strokeWidth="2" />
    <path d="M15 35 L60 10 L105 35 Z" fill="#075B46" />
    <rect x="35" y="48" width="16" height="27" fill="#064B3B" rx="2" />
    <rect x="69" y="48" width="16" height="18" fill="#A4D4B4" rx="2" stroke="#21845A" strokeWidth="1.5" />
    <circle cx="60" cy="24" r="5" fill="#F8F6EA" />
    <text x="60" y="44" textAnchor="middle" fill="#075B46" fontSize="7" fontWeight="bold">APMC</text>
  </svg>
);

export const ComparisonIllustration = () => (
  <svg width="100" height="70" viewBox="0 0 120 85" fill="none">
    <circle cx="28" cy="40" r="12" fill="#E7F2E5" stroke="#075B46" strokeWidth="2" />
    <text x="28" y="44" textAnchor="middle" fill="#075B46" fontSize="9" fontWeight="bold">A</text>
    <path d="M42 40 Q60 22 78 40" stroke="#21845A" strokeWidth="2" strokeDasharray="3 3" />
    <circle cx="92" cy="40" r="12" fill="#E7F2E5" stroke="#21845A" strokeWidth="2" />
    <text x="92" y="44" textAnchor="middle" fill="#21845A" fontSize="9" fontWeight="bold">B</text>
    {/* Small truck in middle */}
    <rect x="52" y="27" width="16" height="10" rx="2" fill="#075B46" />
    <circle cx="56" cy="38" r="2.5" fill="#143F35" />
    <circle cx="64" cy="38" r="2.5" fill="#143F35" />
  </svg>
);

export const ProduceIllustration = () => (
  <svg width="100" height="70" viewBox="0 0 120 85" fill="none">
    <path d="M40 70 C40 45 55 35 60 20 C65 35 80 45 80 70 Z" fill="#E8BD65" opacity="0.9" stroke="#C29438" strokeWidth="1.5" />
    <ellipse cx="60" cy="70" rx="20" ry="6" fill="#C29438" />
    <path d="M60 20 C60 10 50 5 45 8 C40 12 50 18 60 20 Z" fill="#21845A" />
    <path d="M60 20 C60 10 70 5 75 8 C80 12 70 18 60 20 Z" fill="#21845A" />
    <circle cx="52" cy="55" r="3" fill="#FFFDF5" opacity="0.6" />
    <circle cx="68" cy="50" r="2.5" fill="#FFFDF5" opacity="0.6" />
    <circle cx="60" cy="42" r="3" fill="#FFFDF5" opacity="0.6" />
  </svg>
);

export const DecisionIllustration = () => (
  <svg width="100" height="70" viewBox="0 0 120 85" fill="none">
    {/* Upward chart line with green Rupee coin */}
    <rect x="25" y="55" width="10" height="20" rx="2" fill="#D1E8D4" />
    <rect x="42" y="42" width="10" height="33" rx="2" fill="#A4D4B4" />
    <rect x="59" y="30" width="10" height="45" rx="2" fill="#21845A" />
    <path d="M22 55 L42 40 L64 25 L85 15" stroke="#075B46" strokeWidth="3" strokeLinecap="round" />
    <circle cx="90" cy="40" r="14" fill="#075B46" />
    <text x="90" y="46" textAnchor="middle" fill="#FFFDF5" fontSize="14" fontWeight="bold">₹</text>
  </svg>
);

export const AnalyticsIllustration = () => (
  <svg width="100" height="70" viewBox="0 0 120 85" fill="none">
    <rect x="15" y="15" width="90" height="55" rx="6" fill="#FFFDF5" stroke="#E7E3D2" strokeWidth="1.5" />
    <path d="M25 55 Q45 25 65 45 T100 25" stroke="#21845A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="100" cy="25" r="4" fill="#075B46" />
    <path d="M100 25 C102 18 108 18 108 24 Z" fill="#075B46" />
  </svg>
);

export const SavedObsIllustration = () => (
  <svg width="100" height="70" viewBox="0 0 120 85" fill="none">
    <rect x="35" y="15" width="50" height="60" rx="5" fill="#E8BD65" stroke="#C29438" strokeWidth="1.5" />
    <rect x="42" y="22" width="36" height="46" rx="3" fill="#FFFDF5" />
    <line x1="47" y1="32" x2="73" y2="32" stroke="#21845A" strokeWidth="2" strokeLinecap="round" />
    <line x1="47" y1="42" x2="68" y2="42" stroke="#64776D" strokeWidth="2" strokeLinecap="round" />
    <line x1="47" y1="52" x2="71" y2="52" stroke="#64776D" strokeWidth="2" strokeLinecap="round" />
    <path d="M68 15 L78 15 L73 26 Z" fill="#075B46" />
  </svg>
);

export const HistoryIllustration = () => (
  <svg width="120" height="70" viewBox="0 0 140 85" fill="none">
    <rect x="20" y="15" width="55" height="60" rx="5" fill="#FFFDF5" stroke="#E7E3D2" strokeWidth="1.5" />
    <circle cx="95" cy="45" r="22" fill="#075B46" />
    <circle cx="95" cy="45" r="18" fill="#FFFDF5" />
    <line x1="95" y1="45" x2="95" y2="34" stroke="#075B46" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="95" y1="45" x2="103" y2="45" stroke="#075B46" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="30" y1="28" x2="60" y2="28" stroke="#21845A" strokeWidth="2" />
    <line x1="30" y1="38" x2="52" y2="38" stroke="#64776D" strokeWidth="2" />
    <line x1="30" y1="48" x2="58" y2="48" stroke="#64776D" strokeWidth="2" />
  </svg>
);

