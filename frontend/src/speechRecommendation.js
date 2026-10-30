/**
 * Spoken recommendation generator for Agro Mitra.
 * Generates natural, concise text for speech synthesis from live application state.
 *
 * Rules:
 * - Only verified real data is included.
 * - Stale observations trigger an explicit spoken warning.
 * - Never announces ₹0 or fake numbers for missing data.
 * - Incomplete or invalid comparisons announce a helpful explanation.
 * - Kannada and English localized sentences.
 */

import {
  getLocalizedCropName,
  getLocalizedDistrictName,
  getLocalizedMarketName,
} from './translations.js'
import { formatSpokenPrice, formatSpokenRupees, numberToWordsKannada, numberToWordsEnglish } from './numberToWords.js'
import { calculateTransportSensitivity } from './comparison.js'

export function buildRecommendationSpeechText({
  lang = 'kn',
  district,
  crop,
  decision,
  options = [],
  comparisonResults,
  comparisonBase,
  transportScenarioCosts = {},
  observations = [],
}) {
  const isKn = lang === 'kn'
  const localizedCrop = getLocalizedCropName(crop, lang) || (isKn ? 'ಬೆಳೆ' : 'Crop')
  const localizedDistrict = getLocalizedDistrictName(district, lang) || (isKn ? 'ಜಿಲ್ಲೆ' : 'District')

  const parts = []

  // 1. Introduction
  if (isKn) {
    parts.push('ಅಗ್ರೋ ಮಿತ್ರ ಮಾರುಕಟ್ಟೆ ಶಿಫಾರಸು.')
    parts.push(`ನೀವು ಆಯ್ಕೆ ಮಾಡಿರುವ ಬೆಳೆ ${localizedCrop}. ಜಿಲ್ಲೆ ${localizedDistrict}.`)
  } else {
    parts.push('Agro Mitra market recommendation.')
    parts.push(`Your selected crop is ${localizedCrop} in ${localizedDistrict} district.`)
  }

  // 2. Observations Freshness Check
  const hasStale = observations.some((o) => {
    if (o.freshness === 'stale') return true
    if (!o.observation_date) return true
    const diffDays = (Date.now() - new Date(`${o.observation_date}T00:00:00Z`).getTime()) / 86_400_000
    return diffDays > 7
  })

  if (hasStale) {
    if (isKn) {
      parts.push('ಎಚ್ಚರಿಕೆ. ಈ ಮಾರುಕಟ್ಟೆಯ ಬೆಲೆ ಹಳೆಯದಾಗಿದೆ. ದಯವಿಟ್ಟು ಇತ್ತೀಚಿನ ಬೆಲೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.')
    } else {
      parts.push('Warning. This market price is outdated. Please verify the latest price.')
    }
  }

  // If no decision yet
  if (!decision) {
    if (isKn) {
      parts.push('ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ದಯವಿಟ್ಟು ಮಾರಾಟ ಆಯ್ಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.')
    } else {
      parts.push('Please review selling options to complete the market comparison.')
    }
    return parts.join(' ')
  }

  // 3. Handle Decision Statuses
  if (decision.status === 'incomplete') {
    if (isKn) {
      parts.push('ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿಯು ಅಪೂರ್ಣವಾಗಿರುವುದರಿಂದ ನಿರ್ಣಾಯಕ ಶಿಫಾರಸು ಲಭ್ಯವಿಲ್ಲ.')
      if (decision.issues && decision.issues.length > 0) {
        parts.push(decision.issues.join('. ') + '.')
      }
    } else {
      parts.push('A definitive market recommendation is unavailable because the comparison data is incomplete.')
      if (decision.issues && decision.issues.length > 0) {
        parts.push(decision.issues.join('. ') + '.')
      }
    }
    return parts.join(' ')
  }

  if (decision.status === 'all-negative') {
    if (isKn) {
      parts.push('ಎಚ್ಚರಿಕೆ. ಎಲ್ಲಾ ಮಾರಾಟ ಆಯ್ಕೆಗಳಲ್ಲಿ ಸಾಗಣೆ ಮತ್ತು ಕಡಿತಗಳ ನಂತರ ನಷ್ಟದ ಅಂದಾಜಿದೆ.')
      parts.push('ಮಾರಾಟ ಮಾಡುವ ಮುನ್ನ ವೆಚ್ಚಗಳನ್ನು ಪುನಃ ಪರಿಶೀಲಿಸಿ.')
    } else {
      parts.push('Warning. All selling options result in estimated negative proceeds after transport and deductions.')
      parts.push('Please re-examine your expenses before proceeding.')
    }
    return parts.join(' ')
  }

  // 4. Winner or Close decision
  if (decision.status === 'winner' && decision.ranked && decision.ranked.length >= 2) {
    const winner = decision.ranked[0].option
    const runnerUp = decision.ranked[1].option
    const winnerName = getLocalizedMarketName(winner.name, lang)
    const runnerUpName = getLocalizedMarketName(runnerUp.name, lang)

    // Mention winner price
    if (winner.price && Number(winner.price) > 0) {
      const pSpoken = formatSpokenPrice(winner.price, winner.priceUnit || 'INR/kg', lang)
      if (isKn) {
        parts.push(`${winnerName} ಮಾರುಕಟ್ಟೆಯ ಮಾರಾಟ ಬೆಲೆ ${pSpoken}.`)
      } else {
        parts.push(`${winnerName} has a reported selling price of ${pSpoken}.`)
      }
    }

    // Mention runner up price
    if (runnerUp.price && Number(runnerUp.price) > 0) {
      const pSpoken = formatSpokenPrice(runnerUp.price, runnerUp.priceUnit || 'INR/kg', lang)
      if (isKn) {
        parts.push(`${runnerUpName} ಮಾರುಕಟ್ಟೆಯ ಮಾರಾಟ ಬೆಲೆ ${pSpoken}.`)
      } else {
        parts.push(`${runnerUpName} has a reported selling price of ${pSpoken}.`)
      }
    }

    // Difference between markets
    if (decision.difference && decision.difference > 0) {
      const diffRupees = formatSpokenRupees(decision.difference, lang)
      if (isKn) {
        parts.push(`${winnerName} ಮಾರುಕಟ್ಟೆಯು ${runnerUpName} ಗಿಂತ ಅಂದಾಜು ${diffRupees} ಹೆಚ್ಚಿನ ನಿವ್ವಳ ಆದಾಯವನ್ನು ಒದಗಿಸಬಹುದು.`)
      } else {
        parts.push(`${winnerName} may provide approximately ${diffRupees} more than ${runnerUpName} after estimated expenses.`)
      }
    }

    // Winner Estimated Net Proceeds if available
    const winnerCalc = comparisonResults?.[winner.id]
    if (winnerCalc && Number.isFinite(winnerCalc.netProceeds) && winnerCalc.netProceeds > 0) {
      const netRupees = formatSpokenRupees(winnerCalc.netProceeds, lang)
      if (isKn) {
        parts.push(`ಆಯ್ದ ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ನಿಮ್ಮ ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ ${netRupees}.`)
      } else {
        parts.push(`Your estimated net proceeds at the selected market are ${netRupees}.`)
      }
    }

    // Break-even insight
    if (comparisonResults && comparisonBase) {
      try {
        const { breakEvenCostsById } = calculateTransportSensitivity(options, comparisonResults, transportScenarioCosts)
        const breakEven = breakEvenCostsById?.[runnerUp.id]
        if (breakEven && Number.isFinite(breakEven) && breakEven > 0) {
          const beRupees = formatSpokenRupees(breakEven, lang)
          if (isKn) {
            parts.push(`ಪರ್ಯಾಯ ಮಾರುಕಟ್ಟೆಯ ಸಾಗಣೆ ವೆಚ್ಚವು ${beRupees} ಕ್ಕಿಂತ ಕಡಿಮೆಯಿದ್ದಲ್ಲಿ ಮಾತ್ರ ಲಾಭದಾಯಕ.`)
          } else {
            parts.push(`The alternative market is financially advantageous only if transport cost stays below ${beRupees}.`)
          }
        }
      } catch {
        // Break-even calculation error, safely ignored in speech
      }
    }
  } else if (decision.status === 'close') {
    if (isKn) {
      parts.push('ಎರಡೂ ಮಾರುಕಟ್ಟೆಗಳಲ್ಲಿ ಅಂದಾಜು ಆದಾಯ ಬಹುತೇಕ ಸಮಾನವಾಗಿದೆ.')
      if (decision.difference != null && decision.difference > 0) {
        const diffRupees = formatSpokenRupees(decision.difference, lang)
        parts.push(`ವ್ಯತ್ಯಾಸ ಕೇವಲ ${diffRupees}.`)
      }
      parts.push('ನಿರ್ಧಾರಕ್ಕೂ ಮುನ್ನ ಇಂದಿನ ಮಂಡಿ ದರ ಮತ್ತು ಸಾರಿಗೆ ವೆಚ್ಚವನ್ನು ನೇರವಾಗಿ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.')
    } else {
      parts.push('Both markets have similar estimated returns.')
      if (decision.difference != null && decision.difference > 0) {
        const diffRupees = formatSpokenRupees(decision.difference, lang)
        parts.push(`The difference is only ${diffRupees}.`)
      }
      parts.push('Please confirm current prices and transport charges directly before deciding.')
    }
  }

  // 5. Final Key Selling Caution
  if (isKn) {
    parts.push('ಮಾರಾಟ ಮಾಡುವ ಮೊದಲು ಸಾಗಣೆ ವೆಚ್ಚ, ಉತ್ಪನ್ನದ ಗುಣಮಟ್ಟ, ಮಾರುಕಟ್ಟೆ ಕಡಿತಗಳು ಮತ್ತು ಖರೀದಿದಾರರ ಷರತ್ತುಗಳನ್ನು ನೇರವಾಗಿ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.')
  } else {
    parts.push('Please confirm transport expenses, produce quality, market deductions and buyer terms directly before making your selling decision.')
  }

  return parts.join(' ')
}
