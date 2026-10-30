import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateTransportSensitivity,
  calculateNetProceeds,
  calculatePooledTransport,
  generateSmsSummary,
  getComparisonDecision,
  getOptionIssues,
} from './comparison.js'

const today = new Date(2026, 9, 29)

function completeOption(id, overrides = {}) {
  return {
    id,
    name: `Option ${id}`,
    price: '22',
    priceDate: '2026-10-29',
    source: 'Seller quote',
    distance: '10',
    transportQuote: '50',
    transportQuoteValidUntil: '2026-10-29',
    transportChecklist: { loading: 'included', unloading: 'included', waiting: 'excluded', toll: 'excluded' },
    qualityRequirements: 'Grade A',
    qualityComparable: true,
    paymentCategory: 'cash',
    paymentTerms: '',
    confirmation: 'unconfirmed',
    saved: true,
    ...overrides,
  }
}

test('uses saleable quantity and includes an option transport quote once', () => {
  const result = calculateNetProceeds({
    q: 100,
    p: 22,
    l: 0.05,
    d: 0,
    ct: 50,
    ch: 10,
    cp: 20,
    cm: 5,
    co: 15,
  })

  assert.deepEqual(result, { gross: 2200, net_proceeds: 1990 })
})

test('matches the calculator parity example used in the dashboard', () => {
  const result = calculateNetProceeds({
    q: 1000,
    p: 22,
    l: 0.01,
    d: 0,
    ct: 600,
    ch: 300,
    cp: 0,
    cm: 400,
    co: 100,
  })

  assert.deepEqual(result, { gross: 22000, net_proceeds: 20380 })
})

test('caps the per-unit quality deduction at the selling price', () => {
  const result = calculateNetProceeds({
    q: 100, p: 22, l: 0.05, d: 30, ct: 0, ch: 0, cp: 0, cm: 0, co: 0,
  })

  assert.deepEqual(result, { gross: 2200, net_proceeds: 0 })
})

test('rejects stale, future, or incomplete price evidence for winner eligibility', () => {
  const stale = completeOption('stale', { priceDate: '2026-10-20' })
  const future = completeOption('future', { priceDate: '2026-10-30' })
  const missing = completeOption('missing', { source: '', transportQuote: '' })

  assert.ok(getOptionIssues(stale, today).some((issue) => issue.includes('Recent Price Date')))
  assert.ok(getOptionIssues(future, today).some((issue) => issue.includes('non-future Price Date')))
  assert.ok(getOptionIssues(missing, today).some((issue) => issue.includes('Price Source')))
  assert.ok(getOptionIssues(missing, today).some((issue) => issue.includes('Transport Quote')))
})

test('incomplete options cannot win and a close result has no definitive winner', () => {
  const options = [completeOption('a'), completeOption('b')]
  const results = { a: { net_proceeds: 1000 }, b: { net_proceeds: 990 } }
  const incompleteIssues = { b: ['missing source'] }
  const closeIssues = { a: [], b: [] }

  assert.equal(getComparisonDecision(options, results, incompleteIssues).status, 'incomplete')
  const close = getComparisonDecision(options, results, closeIssues)
  assert.equal(close.status, 'close')
  assert.equal(close.difference, 10)
  assert.equal(close.differencePercent, 1)
})

test('meaningfully higher estimates win while equal and negative values stay conservative', () => {
  const options = [completeOption('a'), completeOption('b')]
  const issues = { a: [], b: [] }

  assert.equal(getComparisonDecision(options, {
    a: { net_proceeds: 1200 }, b: { net_proceeds: 1000 },
  }, issues).status, 'winner')
  assert.equal(getComparisonDecision(options, {
    a: { net_proceeds: 1000 }, b: { net_proceeds: 1000 },
  }, issues).status, 'close')
  assert.equal(getComparisonDecision(options, {
    a: { net_proceeds: -20 }, b: { net_proceeds: -5 },
  }, issues).status, 'all-negative')
})

test('requires a current transport quote and complete charge coverage for a winner', () => {
  const missingChecklist = completeOption('missing', {
    transportChecklist: { loading: 'included', unloading: 'unknown', waiting: 'included', toll: 'included' },
  })
  const expiredQuote = completeOption('expired', { transportQuoteValidUntil: '2026-10-28' })

  assert.ok(getOptionIssues(missingChecklist, today).some((issue) => issue.includes('Confirm loading')))
  assert.ok(getOptionIssues(expiredQuote, today).some((issue) => issue.includes('expired')))
})

test('calculates break-even transport cost and recomputes what-if net proceeds', () => {
  const options = [
    completeOption('nearby', { transportQuote: '100' }),
    completeOption('alternative', { transportQuote: '100' }),
  ]
  const sensitivity = calculateTransportSensitivity(options, {
    nearby: { net_proceeds: 1100 },
    alternative: { net_proceeds: 1250 },
  })

  assert.deepEqual(sensitivity.scenarioResultsById, { nearby: 1100, alternative: 1250 })
  assert.deepEqual(sensitivity.breakEvenCostsById, { nearby: -50, alternative: 250 })

  const higherTransport = calculateTransportSensitivity(options, {
    nearby: { net_proceeds: 1100 },
    alternative: { net_proceeds: 1250 },
  }, { nearby: '100', alternative: '260' })
  assert.deepEqual(higherTransport.scenarioResultsById, { nearby: 1100, alternative: 1090 })
  assert.ok(higherTransport.scenarioResultsById.alternative < higherTransport.scenarioResultsById.nearby)

  const invalidCost = calculateTransportSensitivity(options, {
    nearby: { net_proceeds: 1100 },
    alternative: { net_proceeds: 1250 },
  }, { nearby: '100', alternative: '-1' })
  assert.equal(invalidCost.scenarioResultsById.alternative, undefined)
  assert.deepEqual(invalidCost.breakEvenCostsById, {})
})

test('calculates pooled-cost per quintal and individual farmer share correctly', () => {
  // e.g. Vehicle quote ₹2000, pooled 50 quintals, my share 10 quintals (1000kg)
  const pooled = calculatePooledTransport(2000, 50, 10)
  assert.deepEqual(pooled, {
    costPerQuintal: 40,
    myShare: 400,
  })

  // Invalid inputs return null
  assert.equal(calculatePooledTransport(0, 50, 10), null)
  assert.equal(calculatePooledTransport(2000, -10, 10), null)
})

test('generates pre-filled SMS summary string with disclaimer', () => {
  const summary = generateSmsSummary('Maize', 1000, [
    { id: 'opt1', name: 'Local Trader' },
    { id: 'opt2', name: 'APMC Davanagere' },
  ], {
    opt1: { net_proceeds: 20380 },
    opt2: { net_proceeds: 20620 },
  })

  assert.ok(summary.includes('1000 kg'))
  assert.ok(summary.includes('Local Trader: ₹20,380'))
  assert.ok(summary.includes('APMC Davanagere: ₹20,620'))
  assert.ok(summary.includes('ಅಂದಾಜು ಮಾತ್ರ'))
})
