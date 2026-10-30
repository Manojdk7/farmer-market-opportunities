/**
 * SpeakerButton Component for Agro Mitra Recommendation Card.
 * Renders Start, Pause/Resume, and Stop controls with active speaking indicators
 * and accessible fallback banners when voice is missing.
 */

import React from 'react'
import { t } from './translations'
import { useSpeechSynthesis } from './useSpeechSynthesis'
import { buildRecommendationSpeechText } from './speechRecommendation'

export function RecommendationSpeakerButton({
  language = 'kn',
  district,
  crop,
  decision,
  options = [],
  comparisonResults,
  comparisonBase,
  transportScenarioCosts = {},
  observations = [],
}) {
  const {
    isSupported,
    isSpeaking,
    isPaused,
    errorMessage,
    speak,
    stop,
    pause,
    resume,
  } = useSpeechSynthesis({ language })

  const handleListen = () => {
    const text = buildRecommendationSpeechText({
      lang: language,
      district,
      crop,
      decision,
      options,
      comparisonResults,
      comparisonBase,
      transportScenarioCosts,
      observations,
    })
    speak(text)
  }

  if (!isSupported) {
    return (
      <div className="speech-unsupported-note" role="status">
        <small>ℹ️ {language === 'kn' ? 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ವೈಶಿಷ್ಟ್ಯ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ.' : 'Speech readout is not supported on this browser.'}</small>
      </div>
    )
  }

  return (
    <div className="recommendation-voice-controls" role="region" aria-label="Recommendation Voice Readout">
      <div className="voice-btn-cluster">
        {!isSpeaking ? (
          <button
            type="button"
            className="voice-action-btn play-btn"
            onClick={handleListen}
            aria-label={t('voice_listen_recommendation', language)}
          >
            <span className="voice-icon" aria-hidden="true">🔊</span>
            <span className="voice-btn-label">{t('voice_listen_recommendation', language)}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="voice-action-btn stop-btn"
              onClick={stop}
              aria-label={t('voice_stop', language)}
            >
              <span className="voice-icon" aria-hidden="true">⏹️</span>
              <span className="voice-btn-label">{t('voice_stop', language)}</span>
            </button>

            {!isPaused ? (
              <button
                type="button"
                className="voice-action-btn pause-btn"
                onClick={pause}
                aria-label={t('voice_pause', language)}
              >
                <span className="voice-icon" aria-hidden="true">⏸️</span>
                <span className="voice-btn-label">{t('voice_pause', language)}</span>
              </button>
            ) : (
              <button
                type="button"
                className="voice-action-btn resume-btn"
                onClick={resume}
                aria-label={t('voice_resume', language)}
              >
                <span className="voice-icon" aria-hidden="true">▶️</span>
                <span className="voice-btn-label">{t('voice_resume', language)}</span>
              </button>
            )}

            <div className="speaking-wave-indicator" aria-live="polite">
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="speaking-text">
                {isPaused
                  ? (language === 'kn' ? 'ವಿರಾಮಗೊಂಡಿದೆ…' : 'Paused…')
                  : (language === 'kn' ? 'ಓದಲಾಗುತ್ತಿದೆ…' : 'Reading aloud…')}
              </span>
            </div>
          </>
        )}
      </div>

      {errorMessage && (
        <div className="voice-error-alert" role="alert">
          <span className="alert-symbol">⚠️</span> {errorMessage}
        </div>
      )}
    </div>
  )
}

