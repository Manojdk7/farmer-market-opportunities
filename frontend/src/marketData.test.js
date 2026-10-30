import test from 'node:test'
import assert from 'node:assert/strict'
import { getLatestMarketObservations, pricePerKilogram } from './marketData.js'

test('converts only supported INR units to price per kilogram', () => {
  assert.equal(pricePerKilogram(22, 'INR/kg'), 22)
  assert.equal(pricePerKilogram(2200, 'INR/quintal'), 22)
  assert.equal(pricePerKilogram(22000, 'INR/tonne'), 22)
})

test('does not convert unsupported or invalid market prices', () => {
  assert.equal(pricePerKilogram(5, 'kg'), null)
  assert.equal(pricePerKilogram(0, 'INR/kg'), null)
  assert.equal(pricePerKilogram(Number.NaN, 'INR/kg'), null)
})

test('getLatestMarketObservations returns only the latest record per market and variety', () => {
  const records = [
    { id: 1, market_id: 106, market_name: 'Davangere APMC', commodity: 'Maize', variety: 'Local', price: 2796, observation_date: '2026-10-22' },
    { id: 2, market_id: 106, market_name: 'Davangere APMC', commodity: 'Maize', variety: 'Local', price: 3031, observation_date: '2026-10-27' },
    { id: 3, market_id: 106, market_name: 'Davangere APMC', commodity: 'Maize', variety: 'Local', price: 3161, observation_date: '2026-10-28' }, // latest
    { id: 4, market_id: 106, market_name: 'Davangere APMC', commodity: 'Maize', variety: 'Local', price: 2792, observation_date: '2026-10-23' },
    // HarappanaHalli has two varieties:
    { id: 5, market_id: 484, market_name: 'HarappanaHalli APMC', commodity: 'Maize', variety: 'Hybrid/Local', price: 2603, observation_date: '2026-10-22' },
    { id: 6, market_id: 484, market_name: 'HarappanaHalli APMC', commodity: 'Maize', variety: 'Hybrid/Local', price: 2860, observation_date: '2026-10-28' }, // latest
    { id: 7, market_id: 484, market_name: 'HarappanaHalli APMC', commodity: 'Maize', variety: 'Popcorn', price: 5300, observation_date: '2026-10-24' },
    { id: 8, market_id: 484, market_name: 'HarappanaHalli APMC', commodity: 'Maize', variety: 'Popcorn', price: 4700, observation_date: '2026-10-28' }, // latest, lower price but latest date!
  ]

  const latest = getLatestMarketObservations(records)
  assert.equal(latest.length, 3)

  const davangere = latest.find((r) => r.market_id === 106)
  assert.equal(davangere.id, 3)
  assert.equal(davangere.observation_date, '2026-10-28')
  assert.equal(davangere.price, 3161)

  const popcorn = latest.find((r) => r.market_id === 484 && r.variety === 'Popcorn')
  assert.equal(popcorn.id, 8)
  assert.equal(popcorn.observation_date, '2026-10-28')
  assert.equal(popcorn.price, 4700) // Selected by date, not by highest price!
})
