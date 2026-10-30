import test from 'node:test'
import assert from 'node:assert/strict'

import {
  numberToWordsEnglish,
  numberToWordsKannada,
  formatSpokenPrice,
  formatSpokenRupees,
} from './numberToWords.js'
import { buildRecommendationSpeechText } from './speechRecommendation.js'

test('formats spoken numbers and currency in English', () => {
  assert.equal(numberToWordsEnglish(0), 'zero')
  assert.equal(numberToWordsEnglish(2400), 'two thousand four hundred')
  assert.equal(numberToWordsEnglish(46800), 'forty-six thousand eight hundred')
  assert.equal(formatSpokenPrice(2400, 'INR/quintal', 'en'), 'two thousand four hundred rupees per quintal')
  assert.equal(formatSpokenRupees(46800, 'en'), 'forty-six thousand eight hundred rupees')
})

test('formats spoken numbers and currency in Kannada', () => {
  assert.equal(numberToWordsKannada(0), 'ಶೂನ್ಯ')
  assert.equal(numberToWordsKannada(100), 'ನೂರು')
  assert.equal(numberToWordsKannada(2400), 'ಎರಡು ಸಾವಿರದ ನಾಲ್ಕು ನೂರು')
  assert.match(numberToWordsKannada(46800), /ಸಾವಿರದ ಎಂಟು ನೂರು/)
  assert.equal(formatSpokenPrice(2400, 'INR/quintal', 'kn'), 'ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ ಎರಡು ಸಾವಿರದ ನಾಲ್ಕು ನೂರು ರೂಪಾಯಿಗಳು')
  assert.match(formatSpokenRupees(46800, 'kn'), /ಸಾವಿರದ ಎಂಟು ನೂರು ರೂಪಾಯಿಗಳು/)
})

test('buildRecommendationSpeechText generates truthful English speech for winner', () => {
  const speech = buildRecommendationSpeechText({
    lang: 'en',
    district: 'Davanagere',
    crop: 'Maize',
    decision: {
      status: 'winner',
      difference: 240,
      differencePercent: 1.18,
      ranked: [
        { option: { id: 'opt-b', name: 'Option B', price: 24, priceUnit: 'INR/kg' } },
        { option: { id: 'opt-a', name: 'Option A', price: 22, priceUnit: 'INR/kg' } },
      ],
    },
    options: [
      { id: 'opt-a', name: 'Option A', price: 22 },
      { id: 'opt-b', name: 'Option B', price: 24 },
    ],
    comparisonResults: {
      'opt-a': { netProceeds: 20380 },
      'opt-b': { netProceeds: 20620 },
    },
    comparisonBase: { q: 1000 },
    observations: [{ observation_date: '2026-10-28', freshness: 'recent' }],
  })

  assert.match(speech, /Agro Mitra market recommendation/)
  assert.match(speech, /Your selected crop is Maize in Davanagere district/)
  assert.match(speech, /Option B has a reported selling price of twenty-four rupees per kilogram/)
  assert.match(speech, /Option B may provide approximately two hundred forty rupees more than Option A/)
  assert.match(speech, /Your estimated net proceeds at the selected market are twenty thousand six hundred twenty rupees/)
  assert.match(speech, /Please confirm transport expenses/)
})

test('buildRecommendationSpeechText generates truthful Kannada speech for winner', () => {
  const speech = buildRecommendationSpeechText({
    lang: 'kn',
    district: 'Davanagere',
    crop: 'Maize',
    decision: {
      status: 'winner',
      difference: 240,
      ranked: [
        { option: { id: 'opt-b', name: 'ದಾವಣಗೆರೆ ಎಪಿಎಂಸಿ', price: 24, priceUnit: 'INR/kg' } },
        { option: { id: 'opt-a', name: 'ಹರಿಹರ ಎಪಿಎಂಸಿ', price: 22, priceUnit: 'INR/kg' } },
      ],
    },
    options: [
      { id: 'opt-a', name: 'ಹರಿಹರ ಎಪಿಎಂಸಿ', price: 22 },
      { id: 'opt-b', name: 'ದಾವಣಗೆರೆ ಎಪಿಎಂಸಿ', price: 24 },
    ],
    comparisonResults: {
      'opt-a': { netProceeds: 20380 },
      'opt-b': { netProceeds: 20620 },
    },
    comparisonBase: { q: 1000 },
    observations: [{ observation_date: '2026-10-28', freshness: 'recent' }],
  })

  assert.match(speech, /ಅಗ್ರೋ ಮಿತ್ರ ಮಾರುಕಟ್ಟೆ ಶಿಫಾರಸು/)
  assert.match(speech, /ಮೆಕ್ಕೆಜೋಳ/)
  assert.match(speech, /ದಾವಣಗೆರೆ/)
  assert.match(speech, /ಪ್ರತಿ ಕೆಜಿಗೆ ಇಪ್ಪತ್ತನಾಲ್ಕು ರೂಪಾಯಿಗಳು/)
  assert.match(speech, /ಹೆಚ್ಚಿನ ನಿವ್ವಳ ಆದಾಯವನ್ನು/)
  assert.match(speech, /ಮಾರಾಟ ಮಾಡುವ ಮೊದಲು ಸಾಗಣೆ ವೆಚ್ಚ/)
})

test('buildRecommendationSpeechText warns when market observation is stale', () => {
  const speechEn = buildRecommendationSpeechText({
    lang: 'en',
    district: 'Davanagere',
    crop: 'Maize',
    decision: { status: 'incomplete', issues: ['Missing transport quote'] },
    observations: [{ observation_date: '2026-10-01', freshness: 'stale' }],
  })
  assert.match(speechEn, /Warning\. This market price is outdated/)

  const speechKn = buildRecommendationSpeechText({
    lang: 'kn',
    district: 'Davanagere',
    crop: 'Maize',
    decision: { status: 'incomplete', issues: ['ಸಾರಿಗೆ ವೆಚ್ಚದ ವಿವರವಿಲ್ಲ'] },
    observations: [{ observation_date: '2026-10-01', freshness: 'stale' }],
  })
  assert.match(speechKn, /ಎಚ್ಚರಿಕೆ\. ಈ ಮಾರುಕಟ್ಟೆಯ ಬೆಲೆ ಹಳೆಯದಾಗಿದೆ/)
})

test('buildRecommendationSpeechText handles close decisions conservatively', () => {
  const speechEn = buildRecommendationSpeechText({
    lang: 'en',
    district: 'Davanagere',
    crop: 'Maize',
    decision: { status: 'close', difference: 50 },
    observations: [{ observation_date: '2026-10-28', freshness: 'recent' }],
  })
  assert.match(speechEn, /Both markets have similar estimated returns/)
  assert.match(speechEn, /The difference is only fifty rupees/)

  const speechKn = buildRecommendationSpeechText({
    lang: 'kn',
    district: 'Davanagere',
    crop: 'Maize',
    decision: { status: 'close', difference: 50 },
    observations: [{ observation_date: '2026-10-28', freshness: 'recent' }],
  })
  assert.match(speechKn, /ಎರಡೂ ಮಾರುಕಟ್ಟೆಗಳಲ್ಲಿ ಅಂದಾಜು ಆದಾಯ ಬಹುತೇಕ ಸಮಾನವಾಗಿದೆ/)
  assert.match(speechKn, /ವ್ಯತ್ಯಾಸ ಕೇವಲ ಐವತ್ತು ರೂಪಾಯಿಗಳು/)
})

test('buildRecommendationSpeechText handles all-negative proceeds safely', () => {
  const speechEn = buildRecommendationSpeechText({
    lang: 'en',
    district: 'Davanagere',
    crop: 'Maize',
    decision: { status: 'all-negative' },
    observations: [{ observation_date: '2026-10-28', freshness: 'recent' }],
  })
  assert.match(speechEn, /All selling options result in estimated negative proceeds/)

  const speechKn = buildRecommendationSpeechText({
    lang: 'kn',
    district: 'Davanagere',
    crop: 'Maize',
    decision: { status: 'all-negative' },
    observations: [{ observation_date: '2026-10-28', freshness: 'recent' }],
  })
  assert.match(speechKn, /ನಷ್ಟದ ಅಂದಾಜಿದೆ/)
})

test('buildRecommendationSpeechText does not fabricate net proceeds when expenses missing', () => {
  const speech = buildRecommendationSpeechText({
    lang: 'en',
    district: 'Davanagere',
    crop: 'Maize',
    decision: {
      status: 'winner',
      difference: 200,
      ranked: [
        { option: { id: 'opt-b', name: 'Market B', price: 24, priceUnit: 'INR/kg' } },
        { option: { id: 'opt-a', name: 'Market A', price: 22, priceUnit: 'INR/kg' } },
      ],
    },
    // No comparisonResults provided
    comparisonResults: null,
    comparisonBase: null,
    observations: [{ observation_date: '2026-10-28', freshness: 'recent' }],
  })
  assert.doesNotMatch(speech, /Your estimated net proceeds at the selected market are/)
})
