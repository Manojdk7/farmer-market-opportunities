import React from 'react';
import FeatureCard from './FeatureCard';
import {
  APMCIllustration,
  ComparisonIllustration,
  ProduceIllustration,
  DecisionIllustration,
  AnalyticsIllustration,
  SavedObsIllustration,
  HistoryIllustration,
} from './CardIllustrations';
import { RecommendationSpeakerButton } from './SpeakerButton';

export default function SevenDashboardCards({
  language,
  selectedDistrict,
  selectedCrop,
  backendMarkets,
  backendObservations,
  syncInProgress,
  browserOnline,
  triggerMarketSync,
  decision,
  options,
  comparisonResults,
  comparisonBase,
  transportScenarioCosts,
  generateWhatsAppMessage,
  setWhatsAppPreviewText,
  setWhatsAppCopyFeedback,
  setWhatsAppPreviewOpen,
  calculations,
  observations,
  apmcContent,
  produceContent,
  comparisonContent,
  decisionContent,
  analyticsContent,
  savedObsContent,
  recentCalcsContent,
}) {
  return (
    <div className="ref-cards-grid">
      {/* =========================================================================
          CARD 1 — Official APMC Data
          ========================================================================= */}
      <FeatureCard
        id="card-apmc"
        number="1"
        icon="🏛️"
        titleKn="ಅಧಿಕೃತ ಎಪಿಎಂಸಿ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ"
        titleEn="Official APMC Data"
        description={
          language === 'kn'
            ? 'ನಿಮ್ಮ ಆಯ್ದ ಜಿಲ್ಲೆ ಮತ್ತು ಬೆಳೆಗೆ ಅಧಿಕೃತ ಮೂಲಗಳಿಂದ (AGMARKNET) ಇತ್ತೀಚಿನ ಮಂಡಿ ದರಗಳನ್ನು ಪಡೆಯಿರಿ.'
            : 'Get latest mandi rates from official sources (AGMARKNET) for your selected district and crop.'
        }
        features={[
          language === 'kn' ? 'AGMARKNET 2.0 ನೇರ ಸಂಪರ್ಕ' : 'Live AGMARKNET 2.0 sync',
          language === 'kn' ? 'ಕನಿಷ್ಠ, ಗರಿಷ್ಠ & ಮಾದರಿ ಬೆಲೆ' : 'Min, Max & Modal price',
          language === 'kn' ? 'ತಳಿ, ಗ್ರೇಡ್ ಮತ್ತು ಬೆಲೆ ಘಟಕ' : 'Variety, grade and unit',
          language === 'kn' ? 'ವರದಿ ದಿನಾಂಕ & ದತ್ತಾಂಶ ಮೂಲ' : 'Reporting date & source',
          language === 'kn' ? 'ತಾಜಾ / ವಿಳಂಬಿತ / ಹಳೆಯ ಸ್ಥಿತಿ' : 'Fresh / Delayed / Stale status',
        ]}
        illustration={<APMCIllustration />}
        actionButtons={[
          {
            label: language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ' : 'View Market Prices',
            showArrow: true,
            toggleExpand: true,
          },
        ]}
        language={language}
      >
        {apmcContent}
      </FeatureCard>

      {/* =========================================================================
          CARD 2 — Two-Market Comparison
          ========================================================================= */}
      <FeatureCard
        id="card-comparison"
        number="2"
        icon="⚖️"
        titleKn="ಎರಡು ಮಾರುಕಟ್ಟೆಗಳ ತುಲನೆ"
        titleEn="Two-Market Comparison"
        description={
          language === 'kn'
            ? 'ಎರಡು ಅಥವಾ ಹೆಚ್ಚಿನ ಮಾರಾಟ ಆಯ್ಕೆಗಳ ನಡುವಿನ ದರ ಮತ್ತು ನಿವ್ವಳ ಆದಾಯವನ್ನು ಹೋಲಿಕೆ ಮಾಡಿ.'
            : 'Compare prices and estimated net returns between two markets (or more).'
        }
        features={[
          language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಆಯ್ಕೆ (3 ಆಯ್ಕೆಗಳವರೆಗೆ)' : 'Select markets (up to 3)',
          language === 'kn' ? 'ಸಾರಿಗೆ ವಿವರಗಳ ನಮೂದು' : 'Set transport details',
          language === 'kn' ? 'ಅಪಾಯ ಮತ್ತು ದೂರ ಪರಿಶೀಲನೆ' : 'Check risks and distance',
          language === 'kn' ? 'ನಿವ್ವಳ ಆದಾಯದ ಹೋಲಿಕೆ' : 'Compare net proceeds',
        ]}
        illustration={<ComparisonIllustration />}
        actionButtons={[
          {
            label: language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ ಮಾಡಿ' : 'Compare Markets',
            showArrow: true,
            toggleExpand: true,
          },
        ]}
        language={language}
      >
        {comparisonContent}
      </FeatureCard>

      {/* =========================================================================
          CARD 3 — Produce & Quantity
          ========================================================================= */}
      <FeatureCard
        id="card-produce"
        number="3"
        icon="🌾"
        titleKn="ಬೆಳೆ ವಿವರ & ಪ್ರಮಾಣ"
        titleEn="Produce & Lot"
        description={
          language === 'kn'
            ? 'ನಿಮ್ಮ ಬೆಳೆ, ಪ್ರಮಾಣ ಮತ್ತು ವೆಚ್ಚದ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ. ಇದನ್ನು ಹೋಲಿಕೆಯಲ್ಲಿ ಮರುಬಳಸಲಾಗುತ್ತದೆ.'
            : 'Enter your crop, quantity and cost details. This data is used in comparison and analysis.'
        }
        features={[
          language === 'kn' ? 'ಬೆಳೆ ಮತ್ತು ತಳಿ' : 'Crop & variety',
          language === 'kn' ? 'ಪ್ರಮಾಣ ಮತ್ತು ಘಟಕ' : 'Quantity & unit',
          language === 'kn' ? 'ಕಡಿತಗಳು (ನಷ್ಟ & ಗುಣಮಟ್ಟ)' : 'Deductions (loss & quality cut)',
          language === 'kn' ? 'ವೆಚ್ಚಗಳ ಪೂರ್ಣ ವಿವರ' : 'Expense breakdown',
        ]}
        illustration={<ProduceIllustration />}
        actionButtons={[
          {
            label: language === 'kn' ? 'ಬೆಳೆ ವಿವರ ನವೀಕರಿಸಿ' : 'Update Produce Details',
            showArrow: true,
            toggleExpand: true,
          },
        ]}
        language={language}
      >
        {produceContent}
      </FeatureCard>

      {/* =========================================================================
          CARD 4 — Decision Analysis & Recommendation
          ========================================================================= */}
      <FeatureCard
        id="card-decision"
        number="4"
        icon="📊"
        titleKn="ನಿರ್ಧಾರ ವಿಶ್ಲೇಷಣೆ & ಶಿಫಾರಸು"
        titleEn="Decision Analysis & Recommendation"
        description={
          language === 'kn'
            ? 'ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ, ಬ್ರೇಕ್-ಈವನ್ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು AI-ಆಧಾರಿತ ಮಾರುಕಟ್ಟೆ ಶಿಫಾರಸು ನೋಡಿ.'
            : 'See estimated net proceeds, break-even analysis and AI recommendation.'
        }
        features={[
          language === 'kn' ? 'ಒಟ್ಟು ಮಾರಾಟ & ನಿವ್ವಳ ಆದಾಯ' : 'Gross & net proceeds',
          language === 'kn' ? 'ಬ್ರೇಕ್-ಈವನ್ ಸಾರಿಗೆ ವೆಚ್ಚ' : 'Break-even transport cost',
          language === 'kn' ? 'AI ವಿಜೇತ ಆಯ್ಕೆಯ ಶಿಫಾರಸು' : 'AI winner recommendation',
          language === 'kn' ? 'ಧ್ವನಿ ಓದುವಿಕೆ (ಕನ್ನಡ / English)' : 'Voice readout (Kannada / English)',
          language === 'kn' ? 'ವಾಟ್ಸಾಪ್ ಸಂದೇಶ ಹಂಚಿಕೆ' : 'WhatsApp sharing',
        ]}
        illustration={<DecisionIllustration />}
        actionButtons={[
          {
            label: language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ ವೀಕ್ಷಿಸಿ' : 'View Analysis',
            showArrow: true,
            toggleExpand: true,
          },
        ]}
        language={language}
      >
        {decisionContent}
      </FeatureCard>

      {/* =========================================================================
          CARD 5 — Market Historical Analytics
          ========================================================================= */}
      <FeatureCard
        id="card-analytics"
        number="5"
        icon="📈"
        titleKn="ಮಾರುಕಟ್ಟೆ ಐತಿಹಾಸಿಕ ವಿಶ್ಲೇಷಣೆ"
        titleEn="Market Historical Analytics"
        description={
          language === 'kn'
            ? 'ನೈಜ ಐತಿಹಾಸಿಕ ದಾಖಲೆಗಳೊಂದಿಗೆ ಬೆಲೆ ಪ್ರವೃತ್ತಿ, ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ ಮತ್ತು ದೈನಂದಿನ ಆವಕ ಪರಿಶೀಲಿಸಿ.'
            : 'View price trends, market comparison and daily arrivals using verified records.'
        }
        features={[
          language === 'kn' ? '7-ದಿನಗಳ ಬೆಲೆ ಪ್ರವೃತ್ತಿ' : '7-day price trend',
          language === 'kn' ? '30-ದಿನಗಳ ಬೆಲೆ ಪ್ರವೃತ್ತಿ' : '30-day price trend',
          language === 'kn' ? 'ಮಾರುಕಟ್ಟೆಗಳ ಐತಿಹಾಸಿಕ ಹೋಲಿಕೆ' : 'Market comparison',
          language === 'kn' ? 'ದೈನಂದಿನ ಆವಕ ಪ್ರಮಾಣ' : 'Arrival quantity (ಮಾರುಕಟ್ಟೆ ಆವಕ)',
        ]}
        illustration={<AnalyticsIllustration />}
        actionButtons={[
          {
            label: language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ ವೀಕ್ಷಿಸಿ' : 'View Analytics',
            showArrow: true,
            toggleExpand: true,
          },
        ]}
        language={language}
      >
        {analyticsContent}
      </FeatureCard>

      {/* =========================================================================
          CARD 6 — Saved Market Observations
          ========================================================================= */}
      <FeatureCard
        id="card-saved-obs"
        number="6"
        icon="💾"
        titleKn="ಉಳಿಸಿದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು"
        titleEn="Saved Market Observations"
        description={
          language === 'kn'
            ? 'ನಿಮ್ಮ ಸ್ವಂತ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಮತ್ತು ಟಿಪ್ಪಣಿಗಳನ್ನು ಸ್ಥಳೀಯವಾಗಿ ಸಂಗ್ರಹಿಸಿ ನಿರ್ವಹಿಸಿ.'
            : 'View and manage your saved market prices and notes (stored locally).'
        }
        features={[
          language === 'kn' ? 'ಉಳಿಸಿದ ದಾಖಲೆಗಳ ವೀಕ್ಷಣೆ' : 'View saved records',
          language === 'kn' ? 'ದಾಖಲೆ ತಿದ್ದುಪಡಿ ಅಥವಾ ಅಳಿಸುವಿಕೆ' : 'Edit or delete',
          language === 'kn' ? 'ಗ್ರಾಹಕೀಯ ಘಟಕಗಳು & ಟಿಪ್ಪಣಿ' : 'Custom units & notes',
          language === 'kn' ? 'ಆಫ್‌ಲೈನ್ ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆ' : 'Offline storage',
        ]}
        illustration={<SavedObsIllustration />}
        actionButtons={[
          {
            label: language === 'kn' ? 'ಉಳಿಸಿದ ಬೆಲೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ' : 'View Saved Data',
            showArrow: true,
            toggleExpand: true,
          },
        ]}
        language={language}
      >
        {savedObsContent}
      </FeatureCard>

      {/* =========================================================================
          CARD 7 — Recent Calculations History (Wide Card)
          ========================================================================= */}
      <FeatureCard
        id="card-recent-calcs"
        number="7"
        icon="🕒"
        titleKn="ಇತ್ತೀಚಿನ ಲೆಕ್ಕಾಚಾರಗಳು"
        titleEn="Recent Calculations History"
        description={
          language === 'kn'
            ? 'ನಿಮ್ಮ ಹಿಂದಿನ ಲೆಕ್ಕಾಚಾರಗಳನ್ನು ಪ್ರವೇಶಿಸಿ ಮತ್ತು ಇನ್‌ಪುಟ್‌ಗಳನ್ನು ಮರುಬಳಸಿ.'
            : 'Access your previous calculations and reuse inputs.'
        }
        features={[
          language === 'kn' ? 'ಹಿಂದಿನ ಲೆಕ್ಕಾಚಾರಗಳ ಸಂಗ್ರಹ (50 ರವರೆಗೆ)' : 'View past calculations (up to 50)',
          language === 'kn' ? 'ಒಟ್ಟು ಮತ್ತು ನಿವ್ವಳ ಆದಾಯ ಪರಿಶೀಲನೆ' : 'Check gross & net returns',
          language === 'kn' ? 'ಮಾಹಿತಿ ಮರುಬಳಕೆ' : 'Reuse inputs',
          language === 'kn' ? 'ಇತಿಹಾಸ ತೆರವುಗೊಳಿಸುವ ಆಯ್ಕೆ' : 'Clear history',
        ]}
        illustration={<HistoryIllustration />}
        actionButtons={[
          {
            label: language === 'kn' ? 'ಇತಿಹಾಸ ವೀಕ್ಷಿಸಿ' : 'View History',
            showArrow: true,
            toggleExpand: true,
          },
        ]}
        isWide={true}
        language={language}
      >
        {recentCalcsContent}
      </FeatureCard>
    </div>
  );
}

