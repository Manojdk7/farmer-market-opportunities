const INR_PER_KG_DIVISORS = {
  'INR/kg': 1,
  'INR/quintal': 100,
  'INR/tonne': 1000,
}

export function pricePerKilogram(price, unit) {
  const divisor = INR_PER_KG_DIVISORS[unit]
  if (!Number.isFinite(price) || price <= 0 || !divisor) return null
  return price / divisor
}

export function getLatestMarketObservations(observations) {
  if (!Array.isArray(observations)) return []
  const map = new Map()
  for (const obs of observations) {
    const key = `${obs.market_id ?? obs.market_name}|${obs.commodity}|${obs.variety ?? ''}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, obs)
    } else {
      const existingDate = existing.observation_date ? new Date(existing.observation_date).getTime() : -Infinity
      const obsDate = obs.observation_date ? new Date(obs.observation_date).getTime() : -Infinity
      if (obsDate > existingDate || (obsDate === existingDate && (obs.id ?? 0) > (existing.id ?? 0))) {
        map.set(key, obs)
      }
    }
  }
  return Array.from(map.values())
}
