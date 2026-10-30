/**
 * Phase 1: WhatsApp message generator for Agro Mitra.
 *
 * Generates a fully dynamic bilingual sharing message from live app state.
 * Rules:
 *   - Never fabricate prices, quantities, or net-proceeds figures.
 *   - STALE observations must be flagged explicitly.
 *   - Missing values must be labelled "unavailable", never substituted with 0.
 *   - Net proceeds and break-even included only when valid and calculated.
 *   - Units are preserved from source; no cross-unit comparison without conversion.
 */

import { calculateTransportSensitivity } from './comparison.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inr(value) {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function freshnessLabel(freshness, lang) {
  if (freshness === 'stale') return lang === 'kn' ? 'ಹಳೆಯದು (STALE)' : 'STALE'
  if (freshness === 'recent') return lang === 'kn' ? 'ಇತ್ತೀಚಿನ (FRESH)' : 'FRESH'
  return lang === 'kn' ? 'ಅಜ್ಞಾತ' : 'Unknown'
}

function isFreshObs(obs) {
  return obs && obs.freshness === 'recent'
}

function isStaleObs(obs) {
  if (!obs) return false
  if (obs.freshness === 'stale') return true
  if (!obs.observation_date) return true
  const diffDays = (Date.now() - new Date(`${obs.observation_date}T00:00:00Z`).getTime()) / 86_400_000
  return diffDays > 7
}

function formatObsDate(dateStr, lang) {
  if (!dateStr) return lang === 'kn' ? 'ಲಭ್ಯವಿಲ್ಲ' : 'Unavailable'
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (!Number.isFinite(d.getTime())) return lang === 'kn' ? 'ಲಭ್ಯವಿಲ್ಲ' : 'Unavailable'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(d)
}

function formatUnit(unit, lang) {
  if (!unit) return ''
  if (unit === 'INR/quintal' || unit === 'quintal') return lang === 'kn' ? 'ಕ್ವಿಂಟಾಲ್' : 'quintal'
  if (unit === 'INR/tonne' || unit === 'tonne') return lang === 'kn' ? 'ಟನ್' : 'tonne'
  if (unit === 'INR/kg' || unit === 'kg') return lang === 'kn' ? 'ಕೆ.ಜಿ.' : 'kg'
  return unit
}

// ---------------------------------------------------------------------------
// Main message generator
// ---------------------------------------------------------------------------

/**
 * @param {object} params
 * @param {string} params.lang                - 'kn' or 'en'
 * @param {string} params.district            - selected district name
 * @param {string} params.crop                - selected crop name
 * @param {Array}  params.observations        - latest APMC backend observations
 * @param {string} params.rankingMessage      - backend ranking message
 * @param {object|null} params.result         - single calc result {gross, net_proceeds} or null
 * @param {object|null} params.calcInputs     - {q, p, l, d, ct, ch, cp, cm, co} or null
 * @param {Array}  params.options             - seller comparison options
 * @param {object|null} params.comparisonResults - {[optionId]: {net_proceeds, gross}} or null
 * @param {object|null} params.comparisonBase - {q, p, l, d, ch, cp, cm, co} or null
 * @param {object|null} params.decision       - getComparisonDecision result
 */
export function generateWhatsAppMessage({
  lang = 'en',
  district,
  crop,
  observations = [],
  rankingMessage = '',
  result = null,
  calcInputs = null,
  options = [],
  comparisonResults = null,
  comparisonBase = null,
  decision = null,
}) {
  const kn = lang === 'kn'
  const lines = []
  const line = (text) => lines.push(text)
  const blank = () => lines.push('')

  // ── Header ────────────────────────────────────────────────────────────────
  line('🌾 AGRO MITRA — ' + (kn ? 'ರೈತ ಮಾರುಕಟ್ಟೆ ನಿರ್ಧಾರ ಸಹಾಯಕ' : 'Farmer Market Decision Assistant'))
  blank()

  // ── Location & Crop ───────────────────────────────────────────────────────
  line(`📍 ${kn ? 'ಜಿಲ್ಲೆ' : 'District'}: ${district || (kn ? 'ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ' : 'Not selected')}`)
  line(`🌱 ${kn ? 'ಬೆಳೆ' : 'Crop'}: ${crop || (kn ? 'ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ' : 'Not selected')}`)
  blank()

  // ── APMC Market Observations ──────────────────────────────────────────────
  line('📊 ' + (kn ? 'ಎಪಿಎಂಸಿ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು' : 'APMC MARKET PRICES'))
  line('─'.repeat(30))

  const hasAnyObs = Array.isArray(observations) && observations.length > 0

  if (!hasAnyObs) {
    line(kn ? '⚠️ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಲಭ್ಯವಿಲ್ಲ.' : '⚠️ No market price observations available.')
  } else {
    let hasStale = false
    observations.forEach((obs, idx) => {
      const name = obs.market_name || (kn ? 'ಮಾರುಕಟ್ಟೆ' : 'Market')
      const price = obs.modal_price || obs.price
      const unit = obs.unit
      const stale = isStaleObs(obs)
      if (stale) hasStale = true

      const priceStr = (Number.isFinite(price) && unit)
        ? `${inr(price)} / ${formatUnit(unit, lang)}`
        : (kn ? 'ಬೆಲೆ ಲಭ್ಯವಿಲ್ಲ' : 'Price unavailable')

      line(`${idx + 1}. ${name}`)
      line(`   ${kn ? 'ಮಾದರಿ ಬೆಲೆ' : 'Modal Price'}: ${priceStr}`)
      line(`   ${kn ? 'ವರದಿ ದಿನಾಂಕ' : 'Reporting Date'}: ${formatObsDate(obs.observation_date, lang)}`)
      line(`   ${kn ? 'ಸ್ಥಿತಿ' : 'Status'}: ${freshnessLabel(obs.freshness || (stale ? 'stale' : 'recent'), lang)}`)
      if (obs.source_name) {
        line(`   ${kn ? 'ಮೂಲ' : 'Source'}: ${obs.source_name}`)
      }
      if (obs.min_price != null && obs.max_price != null) {
        line(`   ${kn ? 'ವ್ಯಾಪ್ತಿ' : 'Range'}: ${inr(obs.min_price)} – ${inr(obs.max_price)}`)
      }
      if (stale) {
        line(`   ⚠️ ${kn ? 'ಹಳೆಯ ದತ್ತಾಂಶ — ನಿರ್ಧಾರಕ್ಕೂ ಮುನ್ನ ಪ್ರಸ್ತುತ ಮಂಡಿ ಬೆಲೆ ಪರಿಶೀಲಿಸಿ.' : 'STALE DATA — Verify the latest price at the mandi before deciding.'}`)
      }
      blank()
    })

    // Ranking availability note
    if (rankingMessage && rankingMessage.includes('insufficient')) {
      line(`ℹ️ ${kn ? 'ವಿಶ್ವಾಸಾರ್ಹ ಶ್ರೇಯಾಂಕಕ್ಕೆ ಸಾಕಷ್ಟು ಹೋಲಿಸಬಹುದಾದ ಡೇಟಾ ಇಲ್ಲ.' : 'Insufficient comparable data for a reliable market ranking.'}`)
      blank()
    }
  }

  // ── Single Net-Proceeds Calculation ───────────────────────────────────────
  if (result && calcInputs) {
    const q = calcInputs.q
    const hasQ = Number.isFinite(q) && q > 0
    const hasResult = Number.isFinite(result.net_proceeds)
    const totalCosts = calcInputs.ct + calcInputs.ch + calcInputs.cp + calcInputs.cm + calcInputs.co

    line('💰 ' + (kn ? 'ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ' : 'ESTIMATED NET PROCEEDS'))
    line('─'.repeat(30))

    if (!hasQ) {
      line(kn ? 'ಪ್ರಮಾಣ ನಮೂದಿಸಿಲ್ಲ — ನಿವ್ವಳ ಆದಾಯ ಲೆಕ್ಕ ಮಾಡಲಾಗಿಲ್ಲ.' : 'Quantity not entered — net proceeds not calculated.')
    } else if (!hasResult) {
      line(kn ? 'ಖರ್ಚು ನಮೂದಿಸಿಲ್ಲ — ನಿವ್ವಳ ಆದಾಯ ಲೆಕ್ಕ ಮಾಡಲಾಗಿಲ್ಲ.' : 'Expenses not entered — net proceeds not calculated.')
    } else {
      line(`${kn ? 'ಪ್ರಮಾಣ' : 'Quantity'}: ${Number(q).toLocaleString('en-IN')} kg`)
      line(`${kn ? 'ಒಟ್ಟು ಮಾರಾಟ ಮೌಲ್ಯ' : 'Gross Sale Value'}: ${inr(result.gross)} (${kn ? 'ಅಂದಾಜು' : 'estimate'})`)
      line(`${kn ? 'ಒಟ್ಟು ಖರ್ಚು' : 'Total Expenses'}: ${inr(totalCosts)}`)
      line(`${kn ? 'ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ' : 'Estimated Net Proceeds'}: ${inr(result.net_proceeds)}`)
    }
    blank()
  }

  // ── Multi-Market Comparison ────────────────────────────────────────────────
  if (comparisonResults && comparisonBase && options.length >= 2) {
    const hasAnyCalc = options.some((opt) => Number.isFinite(comparisonResults[opt.id]?.net_proceeds))

    if (hasAnyCalc) {
      line('📋 ' + (kn ? 'ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ (ಅಂದಾಜು)' : 'MARKET COMPARISON (Estimate)'))
      line('─'.repeat(30))

      options.forEach((opt, idx) => {
        const calc = comparisonResults[opt.id]
        const hasCalc = calc && Number.isFinite(calc.net_proceeds)
        line(`${idx + 1}. ${opt.name || (kn ? 'ಮಾರುಕಟ್ಟೆ' : 'Market')}`)
        if (opt.price && Number.isFinite(Number(opt.price))) {
          line(`   ${kn ? 'ಬೆಲೆ' : 'Price'}: ${inr(Number(opt.price))} / kg`)
        }
        if (opt.priceDate) {
          line(`   ${kn ? 'ಬೆಲೆ ದಿನಾಂಕ' : 'Price Date'}: ${formatObsDate(opt.priceDate, lang)}`)
        }
        if (opt.source) {
          line(`   ${kn ? 'ಮೂಲ' : 'Source'}: ${opt.source}`)
        }
        if (opt.transportQuote && Number.isFinite(Number(opt.transportQuote))) {
          line(`   ${kn ? 'ಸಾರಿಗೆ ವೆಚ್ಚ' : 'Transport Cost'}: ${inr(Number(opt.transportQuote))}`)
        }
        if (hasCalc) {
          line(`   ${kn ? 'ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ' : 'Est. Net Proceeds'}: ${inr(calc.net_proceeds)}`)
        } else {
          line(`   ${kn ? 'ನಿವ್ವಳ ಆದಾಯ ಲೆಕ್ಕ ಮಾಡಲಾಗಿಲ್ಲ.' : 'Net proceeds not calculated — expenses not entered.'}`)
        }
        blank()
      })

      // Decision insight
      if (decision) {
        line('📌 ' + (kn ? 'ನಿರ್ಧಾರ ಒಳನೋಟ' : 'DECISION INSIGHT'))
        line('─'.repeat(30))
        if (decision.status === 'winner' && decision.ranked?.length >= 2) {
          line(kn
            ? `${decision.ranked[0].option.name} ಮಾರುಕಟ್ಟೆಯು ${decision.ranked[1].option.name} ಗಿಂತ ಸುಮಾರು ${inr(decision.difference)} ಹೆಚ್ಚಿನ ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ ನೀಡಬಹುದು.`
            : `${decision.ranked[0].option.name} may provide approximately ${inr(decision.difference)} more than ${decision.ranked[1].option.name} after estimated expenses.`)
        } else if (decision.status === 'close' && decision.ranked?.length >= 2) {
          line(kn
            ? `ಎರಡೂ ಮಾರುಕಟ್ಟೆಗಳಲ್ಲಿ ಅಂದಾಜು ಆದಾಯ ಬಹಳ ಹತ್ತಿರದಲ್ಲಿದೆ — ವ್ಯತ್ಯಾಸ ಕೇವಲ ${inr(decision.difference)}.`
            : `Both markets give very similar estimated returns — difference is only ${inr(decision.difference)}.`)
        } else if (decision.status === 'all-negative') {
          line(kn
            ? '⚠️ ಎಲ್ಲ ಆಯ್ಕೆಗಳ ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ ಋಣಾತ್ಮಕ. ಖರ್ಚುಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ಮರುಪರಿಶೀಲಿಸಿ.'
            : '⚠️ All options show negative estimated net proceeds. Review expenses and prices.')
        } else if (decision.status === 'incomplete') {
          line(kn
            ? 'ℹ️ ಹೋಲಿಕೆ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ — ಎಲ್ಲ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ನಮೂದಿಸಿ.'
            : 'ℹ️ Comparison is incomplete — enter all market details to enable ranking.')
        }
        blank()
      }

      // Break-even transport insight
      const { breakEvenCostsById } = calculateTransportSensitivity(options, comparisonResults)
      const breakEvenEntries = options
        .map((opt) => ({ opt, be: breakEvenCostsById[opt.id] }))
        .filter(({ be }) => Number.isFinite(be) && be > 0)

      if (breakEvenEntries.length > 0) {
        line('🚛 ' + (kn ? 'ಸಾರಿಗೆ ಸಮತೋಲನ ಮಿತಿ' : 'TRANSPORT BREAK-EVEN'))
        line('─'.repeat(30))
        breakEvenEntries.forEach(({ opt, be }) => {
          line(kn
            ? `${opt.name}: ಸಾರಿಗೆ ₹${be.toLocaleString('en-IN')} ಗಿಂತ ಕಡಿಮೆ ಇದ್ದರೆ ಮಾತ್ರ ಇದು ಉತ್ತಮ ಆಯ್ಕೆ.`
            : `${opt.name}: Advantageous only if total transport stays below ${inr(be)}.`)
        })
        blank()
      }
    } else {
      // comparison triggered but no results calculable
      line(kn
        ? 'ℹ️ ಖರ್ಚುಗಳು ನಮೂದಿಸಿಲ್ಲದ ಕಾರಣ ನಿವ್ವಳ ಆದಾಯ ಲೆಕ್ಕ ಮಾಡಲಾಗಿಲ್ಲ.'
        : 'ℹ️ Net proceeds not calculated — expenses have not been entered.')
      blank()
    }
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  line('─'.repeat(30))
  line(`⚠️ ${kn
    ? 'ಮೇಲಿನ ಮೌಲ್ಯಗಳು ಅಂದಾಜು ಮಾತ್ರ. ಸಾಗಾಟ, ಗುಣಮಟ್ಟ ಕಡಿತ ಮತ್ತು ಖರೀದಿದಾರರ ನಿಯಮಗಳನ್ನು ಸ್ವತಃ ಖರೀದಿದಾರರೊಂದಿಗೆ ದೃಢೀಕರಿಸಿ. ಇದು ಖಚಿತ ಲಾಭದ ಭರವಸೆ ಅಲ್ಲ.'
    : 'These are estimates only. Confirm transport, quality deductions and buyer terms directly before deciding. This is not a guaranteed profit figure.'}`)
  line(kn
    ? `📅 ಮಾಹಿತಿ ದಿನಾಂಕ: ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date())}`
    : `📅 Generated: ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date())}`)
  line(kn ? '🌾 Agro Mitra ಮೂಲಕ ರಚಿಸಲಾಗಿದೆ.' : '🌾 Generated using Agro Mitra.')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// WhatsApp URL builder
// ---------------------------------------------------------------------------

export function buildWhatsAppUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

// ---------------------------------------------------------------------------
// Clipboard copy
// ---------------------------------------------------------------------------

export async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text)
    return true
  }
  // Fallback for older browsers
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
  if (!ok) throw new Error('Copy failed')
  return true
}
