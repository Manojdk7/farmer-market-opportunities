import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearCalculationHistory,
  deleteCalculation,
  deleteMarketObservation,
  loadCalculations,
  loadMarketObservations,
  loadSellingOptions,
  saveCalculation,
  saveMarketObservation,
  STORAGE_KEYS,
  saveSellingOptions,
} from './storage.js'

class MemoryStorage {
  values = new Map()
  failWrites = false

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error('quota exceeded')
    this.values.set(key, value)
  }
}

function calculation(id, timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, Number(id) || 0)).toISOString()) {
  return {
    id,
    timestamp,
    inputs: { q: 100, p: 22, l: 0.05, d: 0, ct: 50, ch: 10, cp: 20, cm: 5, co: 15 },
    result: { gross: 2200, net_proceeds: 1990 },
    breakdown: { saleableQuantity: 95, lostQuantity: 5, qualityDeduction: 0, adjustedSaleValue: 2090, totalCosts: 100 },
    mode: 'offline',
    assumptions: { quantityUnit: 'kg', priceUnit: 'INR/kg' },
  }
}

function observation(id, date = '2026-01-01') {
  return { id, market: 'Local APMC', commodity: 'Maize', price: 22, date, source: 'Board', unit: 'kg', savedAt: new Date().toISOString() }
}

test('stores calculation history and keeps only the newest fifty', () => {
  const storage = new MemoryStorage()
  for (let id = 1; id <= 52; id += 1) {
    assert.equal(saveCalculation(calculation(String(id)), storage).ok, true)
  }
  const loaded = loadCalculations(storage)
  assert.equal(loaded.records.length, 50)
  assert.equal(loaded.records[0].id, '52')
  assert.equal(loaded.records.at(-1).id, '3')
})

test('deleting one calculation and clearing history leaves observations intact', () => {
  const storage = new MemoryStorage()
  saveCalculation(calculation('1'), storage)
  saveCalculation(calculation('2'), storage)
  saveMarketObservation(observation('price-1'), storage)

  assert.equal(deleteCalculation('1', storage).ok, true)
  assert.deepEqual(loadCalculations(storage).records.map(({ id }) => id), ['2'])
  assert.equal(clearCalculationHistory(storage).ok, true)
  assert.deepEqual(loadCalculations(storage).records, [])
  assert.deepEqual(loadMarketObservations(storage).records.map(({ id }) => id), ['price-1'])
})

test('saves, updates, and deletes market observations by stable ID', () => {
  const storage = new MemoryStorage()
  saveMarketObservation(observation('price-1'), storage)
  const updated = { ...observation('price-1', '2026-01-02'), price: 25, savedAt: loadMarketObservations(storage).records[0].savedAt }
  assert.equal(saveMarketObservation(updated, storage).ok, true)
  assert.equal(loadMarketObservations(storage).records.length, 1)
  assert.equal(loadMarketObservations(storage).records[0].price, 25)
  assert.equal(deleteMarketObservation('price-1', storage).ok, true)
  assert.deepEqual(loadMarketObservations(storage).records, [])
})

test('loads legacy selling options and accepts transport quote checklist metadata', () => {
  const storage = new MemoryStorage()
  const legacyOption = {
    id: 'legacy',
    name: 'Local APMC',
    price: '22',
    priceDate: '2026-01-01',
    source: 'Seller quote',
    distance: '10',
    transportQuote: '50',
    qualityRequirements: 'Grade A',
    qualityComparable: true,
    paymentCategory: 'cash',
    paymentTerms: '',
    confirmation: 'unconfirmed',
    saved: true,
  }
  storage.values.set(STORAGE_KEYS.options, JSON.stringify({ version: 1, records: [legacyOption] }))

  assert.deepEqual(loadSellingOptions(storage).records, [legacyOption])
  const updatedOption = {
    ...legacyOption,
    transportQuoteValidUntil: '2026-01-05',
    transportChecklist: { loading: 'included', unloading: 'excluded', waiting: 'included', toll: 'excluded' },
  }
  assert.equal(saveSellingOptions([updatedOption], storage).ok, true)
  assert.deepEqual(loadSellingOptions(storage).records, [updatedOption])
})

test('preserves malformed collection data instead of overwriting it', () => {
  const storage = new MemoryStorage()
  storage.values.set(STORAGE_KEYS.calculations, '{bad-json')
  const result = saveCalculation(calculation('1'), storage)

  assert.equal(result.ok, false)
  assert.equal(storage.getItem(STORAGE_KEYS.calculations), '{bad-json')
})

test('preserves unsupported schema versions until an explicit user clear', () => {
  const storage = new MemoryStorage()
  const original = JSON.stringify({ version: 99, records: [calculation('old')] })
  storage.values.set(STORAGE_KEYS.calculations, original)
  const saved = saveCalculation(calculation('new'), storage)
  assert.equal(saved.ok, false)
  assert.equal(storage.getItem(STORAGE_KEYS.calculations), original)
})

test('filters corrupted records while retaining valid records and reports unavailable writes', () => {
  const storage = new MemoryStorage()
  storage.values.set(STORAGE_KEYS.calculations, JSON.stringify({
    version: 1,
    records: [calculation('valid'), { id: 'broken' }],
  }))
  const loaded = loadCalculations(storage)
  assert.equal(loaded.records.length, 1)
  assert.ok(loaded.error)

  storage.failWrites = true
  const saved = saveCalculation(calculation('another'), storage)
  assert.equal(saved.ok, false)
  assert.match(saved.error, /Storage is full or blocked/)
})

test('handles browser storage access exceptions without throwing', () => {
  const blockedStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
  }
  const loaded = loadCalculations(blockedStorage)
  const saved = saveCalculation(calculation('blocked'), blockedStorage)
  assert.equal(loaded.ok, false)
  assert.equal(saved.ok, false)
  assert.match(saved.error, /Could not read local data/)
})
