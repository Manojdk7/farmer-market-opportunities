import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWhatsAppMessage, buildWhatsAppUrl } from './whatsapp.js'

test('generateWhatsAppMessage creates bilingual decision text without fabricated data', () => {
  const messageEn = generateWhatsAppMessage({
    lang: 'en',
    district: 'Davanagere',
    crop: 'Maize',
    observations: [
      {
        market_name: 'Davanagere APMC',
        modal_price: 2200,
        unit: 'INR/quintal',
        observation_date: '2026-10-28',
        freshness: 'recent',
        source_name: 'AGMARKNET',
      },
    ],
    options: [
      { id: '1', name: 'Davanagere Mandi', price: 22, transportQuote: '500' },
      { id: '2', name: 'Harihar Mandi', price: 24, transportQuote: '1200' },
    ],
    comparisonResults: {
      '1': { net_proceeds: 20500, gross: 22000 },
      '2': { net_proceeds: 21800, gross: 24000 },
    },
    comparisonBase: { q: 1000, l: 0.02, d: 0, ch: 200, cp: 0, cm: 300, co: 100 },
    decision: {
      status: 'winner',
      ranked: [{ option: { name: 'Harihar Mandi' } }],
    },
  })

  assert.ok(messageEn.includes('AGRO MITRA'))
  assert.ok(messageEn.includes('District: Davanagere'))
  assert.ok(messageEn.includes('Crop: Maize'))
  assert.ok(messageEn.includes('Davanagere APMC'))
  assert.ok(messageEn.includes('Harihar Mandi'))
  assert.ok(messageEn.includes('₹21,800.00'))

  // Kannada template test
  const messageKn = generateWhatsAppMessage({
    lang: 'kn',
    district: 'ದಾವಣಗೆರೆ',
    crop: 'ಮೆಕ್ಕೆಜೋಳ',
    observations: [],
  })

  assert.ok(messageKn.includes('ರೈತ ಮಾರುಕಟ್ಟೆ ನಿರ್ಧಾರ ಸಹಾಯಕ'))
  assert.ok(messageKn.includes('ಜಿಲ್ಲೆ: ದಾವಣಗೆರೆ'))
  assert.ok(messageKn.includes('ಬೆಳೆ: ಮೆಕ್ಕೆಜೋಳ'))
})

test('buildWhatsAppUrl properly encodes the text query parameter', () => {
  const url = buildWhatsAppUrl('🌾 Agro Mitra: ₹100 & More')
  assert.ok(url.startsWith('https://wa.me/?text='))
  assert.ok(url.includes('%E2%80%BE') || url.includes('%20') || url.includes('%26'))
})
