export const MAX_CALCULATIONS = 50
export const STORAGE_KEYS = {
  calculations: 'farmerCalculator.calculations.v1',
  observations: 'farmerCalculator.marketObservations.v1',
  options: 'farmerCalculator.sellingOptions.v1',
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

function isCalculation(record) {
  return isRecord(record)
    && typeof record.id === 'string'
    && typeof record.timestamp === 'string'
    && Number.isFinite(Date.parse(record.timestamp))
    && isRecord(record.inputs)
    && ['q', 'p', 'l', 'd', 'ct', 'ch', 'cp', 'cm', 'co'].every((key) => isFiniteNumber(record.inputs[key]))
    && isRecord(record.result)
    && isFiniteNumber(record.result.net_proceeds)
    && isFiniteNumber(record.result.gross)
    && isRecord(record.breakdown)
    && ['saleableQuantity', 'lostQuantity', 'qualityDeduction', 'adjustedSaleValue', 'totalCosts'].every((key) => isFiniteNumber(record.breakdown[key]))
    && ['online', 'offline'].includes(record.mode)
}

function isObservation(record) {
  return isRecord(record)
    && typeof record.id === 'string'
    && typeof record.market === 'string'
    && record.market.trim().length > 0
    && typeof record.commodity === 'string'
    && record.commodity.trim().length > 0
    && isFiniteNumber(record.price)
    && record.price > 0
    && typeof record.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    && Number.isFinite(Date.parse(`${record.date}T00:00:00Z`))
    && typeof record.source === 'string'
    && record.source.trim().length > 0
    && typeof record.unit === 'string'
    && record.unit.length > 0
    && typeof record.savedAt === 'string'
    && Number.isFinite(Date.parse(record.savedAt))
}

function isOption(record) {
  return isRecord(record)
    && typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.saved === 'boolean'
    && typeof record.price === 'string'
    && ['priceDate', 'source', 'distance', 'transportQuote', 'qualityRequirements', 'paymentCategory', 'paymentTerms', 'confirmation'].every((key) => typeof record[key] === 'string')
    && typeof record.qualityComparable === 'boolean'
    && (record.transportQuoteValidUntil === undefined || typeof record.transportQuoteValidUntil === 'string')
    && (record.transportChecklist === undefined || (
      isRecord(record.transportChecklist)
      && ['loading', 'unloading', 'waiting', 'toll'].every((key) => ['unknown', 'included', 'excluded'].includes(record.transportChecklist[key]))
    ))
}

function getStorage(storage) {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function readCollection(key, validator, storage) {
  const target = getStorage(storage)
  if (!target) return { records: [], ok: false, error: 'ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆ ಲಭ್ಯವಿಲ್ಲ (Local storage is unavailable).' }
  try {
    const raw = target.getItem(key)
    if (raw === null) return { records: [], ok: true, error: '' }
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.records)) {
      return { records: [], ok: false, error: 'ಸಂಗ್ರಹಿತ ಡೇಟಾ ರೂಪ ಮಾನ್ಯವಿಲ್ಲ; ಉಳಿಸಿದ ಡೇಟಾವನ್ನು ಬದಲಾಯಿಸಿಲ್ಲ (Stored data format is invalid; existing data was not overwritten).' }
    }
    const records = parsed.records.filter(validator)
    return {
      records,
      ok: true,
      error: records.length === parsed.records.length ? '' : 'ಕೆಲವು ಹಾನಿಗೊಂಡ ದಾಖಲೆಗಳನ್ನು ಮಾತ್ರ ತೆರೆಯಲಾಗಲಿಲ್ಲ (Some corrupted records could not be loaded).',
    }
  } catch {
    return { records: [], ok: false, error: 'ಸ್ಥಳೀಯ ಡೇಟಾವನ್ನು ಓದಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ; ಉಳಿಸಿದ ಡೇಟಾವನ್ನು ಬದಲಾಯಿಸಿಲ್ಲ (Could not read local data; existing data was not overwritten).' }
  }
}

function writeCollection(key, records, validator, storage) {
  const target = getStorage(storage)
  if (!target) return { ok: false, error: 'ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆ ಲಭ್ಯವಿಲ್ಲ (Local storage is unavailable).' }
  const current = readCollection(key, validator, target)
  if (!current.ok) return current
  try {
    target.setItem(key, JSON.stringify({ version: 1, records }))
    return { ok: true, error: '' }
  } catch {
    return { ok: false, error: 'ಸಂಗ್ರಹಣೆ ತುಂಬಿದೆ ಅಥವಾ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ; ಡೇಟಾವನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ (Storage is full or blocked; data was not saved).' }
  }
}

export function loadCalculations(storage) {
  return readCollection(STORAGE_KEYS.calculations, isCalculation, storage)
}

export function saveCalculation(calculation, storage) {
  if (!isCalculation(calculation)) return { ok: false, error: 'ಲೆಕ್ಕಾಚಾರದ ದಾಖಲೆ ಮಾನ್ಯವಿಲ್ಲ (Calculation record is invalid).' }
  const existing = loadCalculations(storage)
  if (!existing.ok) return existing
  if (existing.records.some((record) => record.id === calculation.id)) return { ok: true, error: '' }
  const records = [calculation, ...existing.records]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_CALCULATIONS)
  return writeCollection(STORAGE_KEYS.calculations, records, isCalculation, storage)
}

export function deleteCalculation(id, storage) {
  const existing = loadCalculations(storage)
  if (!existing.ok) return existing
  return writeCollection(STORAGE_KEYS.calculations, existing.records.filter((record) => record.id !== id), isCalculation, storage)
}

export function clearCalculationHistory(storage) {
  return clearCollection(STORAGE_KEYS.calculations, storage)
}

export function loadMarketObservations(storage) {
  return readCollection(STORAGE_KEYS.observations, isObservation, storage)
}

export function saveMarketObservation(observation, storage) {
  if (!isObservation(observation)) return { ok: false, error: 'ಬೆಲೆ ದಾಖಲೆಯು ಮಾನ್ಯವಿಲ್ಲ (Price observation is invalid).' }
  const existing = loadMarketObservations(storage)
  if (!existing.ok) return existing
  const records = [observation, ...existing.records.filter((record) => record.id !== observation.id)]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return writeCollection(STORAGE_KEYS.observations, records, isObservation, storage)
}

export function deleteMarketObservation(id, storage) {
  const existing = loadMarketObservations(storage)
  if (!existing.ok) return existing
  return writeCollection(STORAGE_KEYS.observations, existing.records.filter((record) => record.id !== id), isObservation, storage)
}

export function clearMarketObservations(storage) {
  return clearCollection(STORAGE_KEYS.observations, storage)
}

export function loadSellingOptions(storage) {
  return readCollection(STORAGE_KEYS.options, isOption, storage)
}

export function saveSellingOptions(options, storage) {
  if (!Array.isArray(options) || !options.every(isOption)) {
    return { ok: false, error: 'ಮಾರಾಟದ ಆಯ್ಕೆಗಳು ಮಾನ್ಯವಿಲ್ಲ (Selling options are invalid).' }
  }
  return writeCollection(STORAGE_KEYS.options, options, isOption, storage)
}

function clearCollection(key, storage) {
  const target = getStorage(storage)
  if (!target) return { ok: false, error: 'ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆ ಲಭ್ಯವಿಲ್ಲ (Local storage is unavailable).' }
  try {
    target.setItem(key, JSON.stringify({ version: 1, records: [] }))
    return { ok: true, error: '' }
  } catch {
    return { ok: false, error: 'ಸ್ಥಳೀಯ ಡೇಟಾವನ್ನು ತೆರವುಗೊಳಿಸಲಾಗಲಿಲ್ಲ (Could not clear local data).' }
  }
}
