export const PRICE_FRESHNESS_DAYS = 7
export const CLOSE_THRESHOLD_PERCENT = 2
export const TRANSPORT_CHECKLIST_ITEMS = ['loading', 'unloading', 'waiting', 'toll']

export function calculateNetProceeds(inputs) {
  const saleableQuantity = inputs.q * (1 - inputs.l)
  const effectivePrice = Math.max(0, inputs.p - inputs.d)
  const totalCosts = inputs.ct + inputs.ch + inputs.cp + inputs.cm + inputs.co
  const netProceeds = saleableQuantity * effectivePrice - totalCosts

  return {
    gross: Math.round((inputs.q * inputs.p + Number.EPSILON) * 100) / 100,
    net_proceeds: Math.round((netProceeds + Number.EPSILON) * 100) / 100,
  }
}

export function createOption(name = '') {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `option-${Date.now()}-${Math.random()}`,
    name,
    price: '',
    priceDate: '',
    source: '',
    distance: '',
    transportQuote: '',
    transportQuoteValidUntil: '',
    transportChecklist: Object.fromEntries(TRANSPORT_CHECKLIST_ITEMS.map((item) => [item, 'unknown'])),
    qualityRequirements: '',
    qualityComparable: false,
    paymentCategory: '',
    paymentTerms: '',
    confirmation: 'unconfirmed',
    saved: false,
  }
}

export function getOptionIssues(option, today = new Date()) {
  const issues = []
  const price = option.price.trim() ? Number(option.price) : NaN
  const distance = option.distance.trim() ? Number(option.distance) : NaN
  const transport = option.transportQuote.trim() ? Number(option.transportQuote) : NaN

  if (!option.saved) issues.push('ಆಯ್ಕೆಯನ್ನು ಮೊದಲು ಉಳಿಸಿ (Save this option first).')
  if (!option.name.trim()) issues.push('ಮಾರುಕಟ್ಟೆ / ಖರೀದಿದಾರರ ಹೆಸರು (Market / Buyer Name)')
  if (!Number.isFinite(price) || price <= 0) issues.push('ಮಾನ್ಯ ಮಾರಾಟದ ಬೆಲೆ (Valid Selling Price)')

  if (!option.priceDate) {
    issues.push('ಬೆಲೆ ಪರಿಶೀಲಿಸಿದ ದಿನಾಂಕ (Price Date)')
  } else {
    const observed = new Date(`${option.priceDate}T00:00:00Z`)
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    const ageDays = (todayDate - observed) / 86_400_000
    if (!Number.isFinite(observed.getTime()) || observed.toISOString().slice(0, 10) !== option.priceDate || ageDays < 0) {
      issues.push('ಭವಿಷ್ಯದ ದಿನಾಂಕವಲ್ಲದ ಮಾನ್ಯ ಬೆಲೆ ದಿನಾಂಕ (Valid non-future Price Date)')
    } else if (ageDays > PRICE_FRESHNESS_DAYS) {
      issues.push(`ಇತ್ತೀಚಿನ ಬೆಲೆ ದಿನಾಂಕ — ${PRICE_FRESHNESS_DAYS} ದಿನಗಳ ಒಳಗೆ (Recent Price Date — within ${PRICE_FRESHNESS_DAYS} days)`)
    }
  }

  if (!option.source.trim()) issues.push('ಬೆಲೆಯ ಮೂಲ (Price Source)')
  if (!Number.isFinite(distance) || distance < 0) issues.push('ಮಾನ್ಯ ದೂರ (Valid Distance)')
  if (!Number.isFinite(transport) || transport < 0) issues.push('ಮಾನ್ಯ ಸಾರಿಗೆ ಉಲ್ಲೇಖ (Valid Transport Quote)')
  const checklistComplete = TRANSPORT_CHECKLIST_ITEMS.every((item) => ['included', 'excluded'].includes(option.transportChecklist?.[item]))
  if (!checklistComplete) issues.push('ಲೋಡ್, ಅನ್‌ಲೋಡ್, ಕಾಯುವಿಕೆ ಮತ್ತು ಟೋಲ್ ಶುಲ್ಕಗಳನ್ನು ದೃಢೀಕರಿಸಿ (Confirm loading, unloading, waiting, and toll charges)')
  if (!option.transportQuoteValidUntil) {
    issues.push('ಸಾರಿಗೆ ಉಲ್ಲೇಖದ ಮಾನ್ಯತಾ ದಿನಾಂಕ (Transport Quote Validity Date)')
  } else {
    const validityDate = new Date(`${option.transportQuoteValidUntil}T00:00:00Z`)
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    if (!Number.isFinite(validityDate.getTime()) || validityDate.toISOString().slice(0, 10) !== option.transportQuoteValidUntil) {
      issues.push('ಮಾನ್ಯ ಸಾರಿಗೆ ಉಲ್ಲೇಖದ ದಿನಾಂಕ (Valid Transport Quote Date)')
    } else if (validityDate < todayDate) {
      issues.push('ಸಾರಿಗೆ ಉಲ್ಲೇಖದ ದಿನಾಂಕ ಮುಗಿದಿದೆ (Transport quote has expired)')
    }
  }
  if (!option.qualityRequirements.trim()) issues.push('ಗುಣಮಟ್ಟದ ಅವಶ್ಯಕತೆಗಳು (Quality Requirements)')
  if (!option.qualityComparable) issues.push('ಹೋಲಿಸಬಹುದಾದ ಗುಣಮಟ್ಟದ ದೃಢೀಕರಣ (Comparable Quality Confirmation)')
  if (!option.paymentCategory) issues.push('ಪಾವತಿ ನಿಯಮಗಳು (Payment Terms)')
  if (['credit', 'other'].includes(option.paymentCategory) && !option.paymentTerms.trim()) {
    issues.push(option.paymentCategory === 'credit' ? 'ಸಾಲದ ಅವಧಿ (Credit Period)' : 'ಪಾವತಿ ವಿವರಗಳು (Payment Details)')
  }

  return issues
}

export function getComparisonDecision(savedOptions, resultsById, issuesById) {
  const issues = []
  if (savedOptions.length < 2) {
    issues.push('ವಿಶ್ವಾಸಾರ್ಹ ಹೋಲಿಕೆಗೆ ಕನಿಷ್ಠ ಎರಡು ಉಳಿಸಿದ ಆಯ್ಕೆಗಳು ಬೇಕು (Save at least two options for a reliable comparison).')
  }

  for (const option of savedOptions) {
    const optionIssues = issuesById[option.id] ?? []
    if (optionIssues.length) issues.push(`${option.name || 'ಹೆಸರಿಲ್ಲದ ಆಯ್ಕೆ (Unnamed option)'}: ${optionIssues.join(', ')}`)
    if (!resultsById[option.id]) {
      issues.push(`${option.name || 'ಹೆಸರಿಲ್ಲದ ಆಯ್ಕೆ (Unnamed option)'}: ಲೆಕ್ಕಾಚಾರ ಲಭ್ಯವಿಲ್ಲ (Calculation unavailable).`)
    }
  }

  if (issues.length) return { status: 'incomplete', issues }

  const ranked = savedOptions
    .map((option) => ({ option, net: resultsById[option.id].net_proceeds }))
    .sort((a, b) => b.net - a.net)

  if (ranked.every(({ net }) => net < 0)) return { status: 'all-negative', ranked }

  const [best, second] = ranked
  const difference = best.net - second.net
  const differencePercent = best.net > 0 ? (difference / best.net) * 100 : null
  if (best.net <= 0 || differencePercent <= CLOSE_THRESHOLD_PERCENT) {
    return { status: 'close', ranked, difference, differencePercent }
  }

  return { status: 'winner', ranked, difference, differencePercent }
}

export function calculateTransportSensitivity(options, resultsById, transportCostsById = {}) {
  const comparableOptions = options.filter((option) => (
    Number.isFinite(resultsById[option.id]?.net_proceeds)
    && Number.isFinite(Number(option.transportQuote))
    && Number(option.transportQuote) >= 0
  ))
  if (comparableOptions.length < 2) {
    return { scenarioResultsById: {}, breakEvenCostsById: {} }
  }

  const netBeforeTransportById = Object.fromEntries(comparableOptions.map((option) => [
    option.id,
    resultsById[option.id].net_proceeds + Number(option.transportQuote),
  ]))
  const scenarioResultsById = {}
  for (const option of comparableOptions) {
    const scenarioText = transportCostsById[option.id] ?? option.transportQuote
    const scenarioCost = typeof scenarioText === 'string' && scenarioText.trim() === ''
      ? NaN
      : Number(scenarioText)
    if (Number.isFinite(scenarioCost) && scenarioCost >= 0) {
      scenarioResultsById[option.id] = Math.round((netBeforeTransportById[option.id] - scenarioCost + Number.EPSILON) * 100) / 100
    }
  }

  const breakEvenCostsById = {}
  if (Object.keys(scenarioResultsById).length === comparableOptions.length) {
    for (const option of comparableOptions) {
      const competitorNets = comparableOptions
        .filter((competitor) => competitor.id !== option.id)
        .map((competitor) => scenarioResultsById[competitor.id])
      if (competitorNets.length) {
        breakEvenCostsById[option.id] = Math.round((netBeforeTransportById[option.id] - Math.max(...competitorNets) + Number.EPSILON) * 100) / 100
      }
    }
  }

  return { scenarioResultsById, breakEvenCostsById }
}

export function calculatePooledTransport(vehicleQuote, totalPooledQuintals, myQuintals) {
  const quote = Number(vehicleQuote)
  const totalQ = Number(totalPooledQuintals)
  const myQ = Number(myQuintals)

  if (!Number.isFinite(quote) || quote <= 0 || !Number.isFinite(totalQ) || totalQ <= 0 || !Number.isFinite(myQ) || myQ <= 0) {
    return null
  }

  const costPerQuintal = Math.round(((quote / totalQ) + Number.EPSILON) * 100) / 100
  const myShare = Math.round(((costPerQuintal * myQ) + Number.EPSILON) * 100) / 100

  return {
    costPerQuintal,
    myShare,
  }
}

export function generateSmsSummary(crop, quantityKg, options, resultsById) {
  const lines = [`[ಕಿಸಾನ್ ಮಾರಾಟ ನೆರವು / Farmer Sell Assist]`]
  lines.push(`ಬೆಳೆ (Crop): ${crop || 'Maize'}, ಪ್ರಮಾಣ (Qty): ${quantityKg} kg`)
  lines.push(`ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ (Est. Net Proceeds):`)

  for (const opt of options) {
    const net = resultsById[opt.id]?.net_proceeds
    const netFormatted = Number.isFinite(net) ? `₹${net.toLocaleString('en-IN')}` : 'N/A'
    lines.push(`- ${opt.name || 'Unnamed'}: ${netFormatted}`)
  }
  lines.push(`*ಅಂದಾಜು ಮಾತ್ರ; ಭರವಸೆ ಅಲ್ಲ (Estimate only, not guaranteed)*`)
  return lines.join('\n')
}
