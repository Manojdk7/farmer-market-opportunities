/**
 * Text-to-Speech Hook for Agro Mitra.
 * Implements browser-native SpeechSynthesis with:
 * - Proper kn-IN and en-IN voice matching.
 * - Missing-voice detection and explicit user alerts.
 * - Lifecycle cleanup on unmount and navigation.
 * - Start, Stop, Pause, and Resume controls.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export function useSpeechSynthesis({ language = 'kn' } = {}) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [voiceAvailable, setVoiceAvailable] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [voices, setVoices] = useState([])

  const utteranceRef = useRef(null)

  // Initialize and load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false)
      return
    }

    setIsSupported(true)

    const updateVoices = () => {
      try {
        const available = window.speechSynthesis.getVoices()
        if (available && available.length > 0) {
          setVoices(available)
        }
      } catch {
        // Speech synthesis access failure handled gracefully
      }
    }

    updateVoices()

    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Find suitable voice for target language
  const selectVoiceForLanguage = useCallback((targetLang, voiceList) => {
    const list = voiceList && voiceList.length > 0 ? voiceList : (typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : [])

    if (targetLang === 'kn') {
      // 1. Look for exact kn-IN or kn_IN
      const knIn = list.find((v) => v.lang && (v.lang.toLowerCase() === 'kn-in' || v.lang.toLowerCase() === 'kn_in'))
      if (knIn) return knIn

      // 2. Look for any kn-* locale
      const knAny = list.find((v) => v.lang && v.lang.toLowerCase().startsWith('kn'))
      if (knAny) return knAny

      // 3. Look for Kannada in voice name or language description
      const knByName = list.find((v) => v.name && v.name.toLowerCase().includes('kannada'))
      if (knByName) return knByName

      // No Kannada voice found
      return null
    }

    // English: prefer en-IN, then en-US, en-GB, then any English
    const enIn = list.find((v) => v.lang && (v.lang === 'en-IN' || v.lang === 'en_IN'))
    if (enIn) return enIn

    const enUs = list.find((v) => v.lang && (v.lang === 'en-US' || v.lang === 'en_US'))
    if (enUs) return enUs

    const enAny = list.find((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
    if (enAny) return enAny

    // Fallback to default voice if available
    return list[0] || null
  }, [])

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
    setIsPaused(false)
    setErrorMessage(null)
  }, [])

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause()
      setIsPaused(true)
    }
  }, [])

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
    }
  }, [])

  const speak = useCallback((text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setErrorMessage(language === 'kn' ? 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ವೈಶಿಷ್ಟ್ಯ ಲಭ್ಯವಿಲ್ಲ.' : 'Speech synthesis is not supported on this browser.')
      return
    }

    if (!text || text.trim() === '') {
      return
    }

    // Stop previous utterance
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
    setErrorMessage(null)

    // Select voice
    const currentVoices = window.speechSynthesis.getVoices()
    const voice = selectVoiceForLanguage(language, currentVoices.length > 0 ? currentVoices : voices)

    if (language === 'kn' && !voice) {
      setVoiceAvailable(false)
      setIsSpeaking(false)
      setErrorMessage(
        'ಈ ಸಾಧನದಲ್ಲಿ ಕನ್ನಡ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ. ಶಿಫಾರಸನ್ನು ಪರದೆಯಲ್ಲಿ ಓದಬಹುದು.'
      )
      return
    }

    setVoiceAvailable(true)

    const utterance = new window.SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance

    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang || (language === 'kn' ? 'kn-IN' : 'en-IN')
    } else {
      utterance.lang = language === 'kn' ? 'kn-IN' : 'en-IN'
    }

    utterance.rate = 0.95 // Slightly relaxed pace for agricultural numbers & terms
    utterance.pitch = 1.0

    utterance.onstart = () => {
      setIsSpeaking(true)
      setIsPaused(false)
      setErrorMessage(null)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }

    utterance.onerror = (e) => {
      // If error is canceled by user, don't show error banner
      if (e.error === 'canceled' || e.error === 'interrupted') {
        setIsSpeaking(false)
        setIsPaused(false)
        return
      }
      setIsSpeaking(false)
      setIsPaused(false)
      setErrorMessage(language === 'kn' ? 'ಧ್ವನಿ ಪ್ಲೇಬ್ಯಾಕ್ ಸಮಯದಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ.' : 'An error occurred during speech playback.')
    }

    window.speechSynthesis.speak(utterance)
  }, [language, selectVoiceForLanguage, voices])

  return {
    isSupported,
    isSpeaking,
    isPaused,
    voiceAvailable,
    errorMessage,
    speak,
    stop,
    pause,
    resume,
  }
}

