/**
 * Number & Currency Spoken Formatter for Kannada and English.
 * Formats numbers into natural spoken words for text-to-speech synthesis.
 */

const ONES_EN = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'
]

const TENS_EN = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
]

const ONES_KN = [
  '', 'ಒಂದು', 'ಎರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ಐದು', 'ಆರು', 'ಏಳು', 'ಎಂಟು', 'ಒಂಬತ್ತು',
  'ಹತ್ತು', 'ಹನ್ನೊಂದು', 'ಹನ್ನೆರಡು', 'ಹದಿಮೂರು', 'ಹದಿನಾಲ್ಕು', 'ಹದಿನೈದು', 'ಹದಿನಾರು',
  'ಹದಿನೇಳು', 'ಹದಿನೆಂಟು', 'ಹತ್ತೊಂಬತ್ತು'
]

const TENS_KN = [
  '', '', 'ಇಪ್ಪತ್ತು', 'ಮೂವತ್ತು', 'ನಲವತ್ತು', 'ಐವತ್ತು', 'ಅರವತ್ತು', 'ಎಪ್ಪತ್ತು', 'ಎಂಬತ್ತು', 'ತೊಂಬತ್ತು'
]

function formatBelowThousandEn(n) {
  let str = ''
  if (n >= 100) {
    str += `${ONES_EN[Math.floor(n / 100)]} hundred `
    n %= 100
  }
  if (n > 0) {
    if (n < 20) {
      str += ONES_EN[n]
    } else {
      str += TENS_EN[Math.floor(n / 10)]
      if (n % 10 > 0) {
        str += `-${ONES_EN[n % 10]}`
      }
    }
  }
  return str.trim()
}

export function numberToWordsEnglish(num) {
  if (num === 0) return 'zero'
  if (!Number.isFinite(num)) return ''

  let isNeg = num < 0
  num = Math.abs(num)

  const whole = Math.floor(num)
  const decimal = Math.round((num - whole) * 100)

  let words = ''

  const crore = Math.floor(whole / 10000000)
  let remainder = whole % 10000000
  const lakh = Math.floor(remainder / 100000)
  remainder %= 100000
  const thousand = Math.floor(remainder / 1000)
  const underThousand = remainder % 1000

  if (crore > 0) {
    words += `${formatBelowThousandEn(crore)} crore `
  }
  if (lakh > 0) {
    words += `${formatBelowThousandEn(lakh)} lakh `
  }
  if (thousand > 0) {
    words += `${formatBelowThousandEn(thousand)} thousand `
  }
  if (underThousand > 0) {
    words += formatBelowThousandEn(underThousand)
  }

  words = words.trim()
  if (decimal > 0) {
    words += ` point ${formatBelowThousandEn(decimal)}`
  }

  return (isNeg ? 'minus ' : '') + words
}

function formatBelowHundredKn(n) {
  if (n < 20) return ONES_KN[n]
  const ten = TENS_KN[Math.floor(n / 10)]
  const unit = n % 10
  if (unit === 0) return ten
  // Conjunction in Kannada: ಇಪ್ಪತ್ತು -> ಇಪ್ಪತ್ತ + ನಾಲ್ಕು = ಇಪ್ಪತ್ತನಾಲ್ಕು
  const prefix = ten.slice(0, -1)
  return `${prefix}${ONES_KN[unit]}`
}

function formatBelowThousandKn(n) {
  let str = ''
  if (n >= 100) {
    const h = Math.floor(n / 100)
    if (h === 1) str += 'ನೂರು '
    else str += `${ONES_KN[h]} ನೂರು `
    n %= 100
  }
  if (n > 0) {
    str += formatBelowHundredKn(n)
  }
  return str.trim()
}

export function numberToWordsKannada(num) {
  if (num === 0) return 'ಶೂನ್ಯ'
  if (!Number.isFinite(num)) return ''

  let isNeg = num < 0
  num = Math.abs(num)

  const whole = Math.floor(num)
  const decimal = Math.round((num - whole) * 100)

  let words = ''

  const crore = Math.floor(whole / 10000000)
  let remainder = whole % 10000000
  const lakh = Math.floor(remainder / 100000)
  remainder %= 100000
  const thousand = Math.floor(remainder / 1000)
  const underThousand = remainder % 1000

  if (crore > 0) {
    words += `${formatBelowThousandKn(crore)} ಕೋಟಿ `
  }
  if (lakh > 0) {
    words += `${formatBelowThousandKn(lakh)} ಲಕ್ಷ `
  }
  if (thousand > 0) {
    const thStr = thousand === 1 ? 'ಒಂದು ಸಾವಿರ' : `${formatBelowThousandKn(thousand)} ಸಾವಿರ`
    words += underThousand > 0 ? `${thStr}ದ ` : `${thStr} `
  }
  if (underThousand > 0) {
    words += formatBelowThousandKn(underThousand)
  }

  words = words.trim()
  if (decimal > 0) {
    words += ` ಬಿಂದು ${formatBelowThousandKn(decimal)}`
  }

  return (isNeg ? 'ಮೈನಸ್ ' : '') + words
}

/**
 * Spoken price/currency string.
 * e.g. 2400, "INR/quintal", "en" -> "two thousand four hundred rupees per quintal"
 * e.g. 2400, "INR/quintal", "kn" -> "ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ ಎರಡು ಸಾವಿರದ ನಾಲ್ಕು ನೂರು ರೂಪಾಯಿಗಳು"
 */
export function formatSpokenPrice(amount, unit = 'INR/quintal', lang = 'kn') {
  if (amount == null || !Number.isFinite(Number(amount))) return ''
  const val = Math.round(Number(amount))

  if (lang === 'kn') {
    const numWords = numberToWordsKannada(val)
    if (unit === 'INR/quintal' || unit === 'quintal') {
      return `ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ ${numWords} ರೂಪಾಯಿಗಳು`
    }
    if (unit === 'INR/kg' || unit === 'kg') {
      return `ಪ್ರತಿ ಕೆಜಿಗೆ ${numWords} ರೂಪಾಯಿಗಳು`
    }
    if (unit === 'INR/tonne' || unit === 'tonne') {
      return `ಪ್ರತಿ ಟನ್‌ಗೆ ${numWords} ರೂಪಾಯಿಗಳು`
    }
    return `${numWords} ರೂಪಾಯಿಗಳು`
  }

  // English
  const numWords = numberToWordsEnglish(val)
  if (unit === 'INR/quintal' || unit === 'quintal') {
    return `${numWords} rupees per quintal`
  }
  if (unit === 'INR/kg' || unit === 'kg') {
    return `${numWords} rupees per kilogram`
  }
  if (unit === 'INR/tonne' || unit === 'tonne') {
    return `${numWords} rupees per tonne`
  }
  return `${numWords} rupees`
}

/**
 * Spoken currency amount without unit per item.
 * e.g. 46800, "en" -> "forty-six thousand eight hundred rupees"
 * e.g. 46800, "kn" -> "ನಲವತ್ತಾರು ಸಾವಿರದ ಎಂಟು ನೂರು ರೂಪಾಯಿಗಳು"
 */
export function formatSpokenRupees(amount, lang = 'kn') {
  if (amount == null || !Number.isFinite(Number(amount))) return ''
  const val = Math.round(Number(amount))
  if (lang === 'kn') {
    return `${numberToWordsKannada(val)} ರೂಪಾಯಿಗಳು`
  }
  return `${numberToWordsEnglish(val)} rupees`
}
