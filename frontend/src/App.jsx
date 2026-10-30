import { useEffect, useState } from 'react'
import {
  calculateNetProceeds,
  calculatePooledTransport,
  calculateTransportSensitivity,
  CLOSE_THRESHOLD_PERCENT,
  createOption,
  generateSmsSummary,
  getComparisonDecision,
  getOptionIssues,
  PRICE_FRESHNESS_DAYS,
  TRANSPORT_CHECKLIST_ITEMS,
} from './comparison'
import { generateWhatsAppMessage, buildWhatsAppUrl, copyToClipboard } from './whatsapp'
import {
  clearCalculationHistory,
  clearMarketObservations,
  deleteCalculation,
  deleteMarketObservation,
  loadCalculations,
  loadMarketObservations,
  loadSellingOptions,
  MAX_CALCULATIONS,
  saveCalculation,
  saveMarketObservation,
  saveSellingOptions,
} from './storage'
import { getLatestMarketObservations, pricePerKilogram } from './marketData'
import {
  KARNATAKA_DISTRICTS,
  KARNATAKA_CROPS,
  getLocalizedDistrictName,
  getLocalizedCropName,
  getLocalizedMarketName,
  t,
} from './translations'
import { HistoricalAnalytics } from './HistoricalAnalytics'
import { RecommendationSpeakerButton } from './SpeakerButton'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import WelcomeAnimation from './WelcomeAnimation'
import DashboardHeader from './DashboardHeader'
import WelcomeHero from './WelcomeHero'
import StickyQuickNav from './StickyQuickNav'
import FeatureCard from './FeatureCard'
import {
  APMCIllustration,
  ComparisonIllustration,
  ProduceIllustration,
  DecisionIllustration,
  AnalyticsIllustration,
  SavedObsIllustration,
  HistoryIllustration,
} from './CardIllustrations'
import SevenDashboardCards from './SevenDashboardCards'

const initialData = { q: '1000', p: '22', l: '1', d: '0', ct: '600', ch: '300', cp: '0', cm: '400', co: '100' }
const costFields = ['ct', 'ch', 'cp', 'cm', 'co']

function getLabels(lang) {
  return {
    q: lang === 'kn' ? 'ಪ್ರಮಾಣ' : 'Quantity',
    p: lang === 'kn' ? 'ಮಾರಾಟ ಬೆಲೆ' : 'Selling Price',
    l: lang === 'kn' ? 'ಭೌತಿಕ ನಷ್ಟ (%)' : 'Physical Loss (%)',
    d: lang === 'kn' ? 'ಗುಣಮಟ್ಟದ ಕಡಿತ' : 'Quality Deduction',
    ct: lang === 'kn' ? 'ಸಾರಿಗೆ ವೆಚ್ಚ' : 'Transport Cost',
    ch: lang === 'kn' ? 'ನಿರ್ವಹಣೆ ವೆಚ್ಚ (ಹ್ಯಾಂಡ್ಲಿಂಗ್)' : 'Handling Cost',
    cp: lang === 'kn' ? 'ಪ್ಯಾಕಿಂಗ್ ವೆಚ್ಚ' : 'Packaging Cost',
    cm: lang === 'kn' ? 'ಕಮಿಷನ್ ವೆಚ್ಚ' : 'Commission Cost',
    co: lang === 'kn' ? 'ಇತರೆ ವೆಚ್ಚಗಳು' : 'Other Costs',
  }
}

function getStatusLabels(lang) {
  return {
    unconfirmed: lang === 'kn' ? 'ದೃಢೀಕರಿಸಿಲ್ಲ' : 'Unconfirmed',
    contacted: lang === 'kn' ? 'ಸಂಪರ್ಕಿಸಲಾಗಿದೆ' : 'Contacted',
    confirmed: lang === 'kn' ? 'ಖರೀದಿದಾರರಿಂದ ದೃಢೀಕರಿಸಲಾಗಿದೆ' : 'Buyer Confirmed',
  }
}

function getPaymentLabels(lang) {
  return {
    cash: lang === 'kn' ? 'ನಗದು' : 'Cash',
    upi: lang === 'kn' ? 'ತಕ್ಷಣದ ಯುಪಿಐ' : 'Immediate UPI',
    credit: lang === 'kn' ? 'ಸಾಲದ ಅವಧಿ' : 'Credit Period',
    other: lang === 'kn' ? 'ಇತರೆ' : 'Other',
  }
}

function getTransportChecklistLabels(lang) {
  return {
    loading: lang === 'kn' ? 'ಲೋಡ್ ಶುಲ್ಕ' : 'Loading charge',
    unloading: lang === 'kn' ? 'ಅನ್‌ಲೋಡ್ ಶುಲ್ಕ' : 'Unloading charge',
    waiting: lang === 'kn' ? 'ಕಾಯುವಿಕೆ ಶುಲ್ಕ' : 'Waiting charge',
    toll: lang === 'kn' ? 'ಟೋಲ್ ಶುಲ್ಕ' : 'Toll charge',
  }
}

function getTransportChecklistStatusLabels(lang) {
  return {
    unknown: lang === 'kn' ? 'ದೃಢೀಕರಿಸಿಲ್ಲ' : 'Not confirmed',
    included: lang === 'kn' ? 'ಉಲ್ಲೇಖದಲ್ಲಿ ಸೇರಿದೆ' : 'Included in quote',
    excluded: lang === 'kn' ? 'ಉಲ್ಲೇಖದಲ್ಲಿ ಸೇರಿಲ್ಲ' : 'Not included',
  }
}

function getObservationUnits(lang) {
  return {
    kg: lang === 'kn' ? '₹ / ಕೆ.ಜಿ.' : '₹ / kg',
    quintal: lang === 'kn' ? '₹ / ಕ್ವಿಂಟಾಲ್' : '₹ / quintal',
    tonne: lang === 'kn' ? '₹ / ಟನ್' : '₹ / tonne',
    other: lang === 'kn' ? 'ಇತರೆ ಘಟಕ' : 'Other unit',
  }
}

function getDataSourceLabels(lang) {
  return {
    'AGMARKNET (Official)': lang === 'kn' ? 'ಅಧಿಕೃತ ಎಪಿಎಂಸಿ (AGMARKNET)' : 'Official APMC (AGMARKNET)',
    'Direct Quote / Mandi Trader': lang === 'kn' ? 'ನೇರ ಉಲ್ಲೇಖ / ಮಂಡಿ ವ್ಯಾಪಾರಿ' : 'Direct Quote / Mandi Trader',
    'Mandi Notice Board': lang === 'kn' ? 'ಮಂಡಿ ಸೂಚನಾ ಫಲಕ' : 'Mandi Notice Board',
    'Fellow Farmer / Phone Inquiry': lang === 'kn' ? 'ಸಹ ರೈತರು / ದೂರವಾಣಿ ವಿಚಾರಣೆ' : 'Fellow Farmer / Phone Inquiry',
    'Local Village Commission Agent': lang === 'kn' ? 'ಸ್ಥಳೀಯ ದಲ್ಲಾಳಿ / ಕಮಿಷನ್ ಏಜೆಂಟ್' : 'Local Village Commission Agent',
    'Private Buyer / Processor': lang === 'kn' ? 'ಖಾಸಗಿ ಖರೀದಿದಾರರು / ಸಂಸ್ಕರಣಾ ಘಟಕ' : 'Private Buyer / Processor',
  }
}

function formatUnitString(unit, lang) {
  if (!unit) return ''
  if (unit === 'INR/kg' || unit === 'kg') return lang === 'kn' ? '₹ / ಕೆ.ಜಿ.' : '₹ / kg'
  if (unit === 'INR/quintal' || unit === 'quintal') return lang === 'kn' ? '₹ / ಕ್ವಿಂಟಾಲ್' : '₹ / quintal'
  if (unit === 'INR/tonne' || unit === 'tonne') return lang === 'kn' ? '₹ / ಟನ್' : '₹ / tonne'
  return unit
}

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
const OBSERVATION_FRESHNESS_HOURS = 24
const timeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })

async function fetchMarketDashboardData(filters, lang = 'kn') {
  const observationParams = new URLSearchParams({ limit: '100' })
  if (filters.district) observationParams.set('district', filters.district)
  if (filters.marketId) observationParams.set('market_id', filters.marketId)
  if (filters.commodity && filters.commodity.trim()) observationParams.set('commodity', filters.commodity.trim())
  if (filters.fromDate) observationParams.set('from_date', filters.fromDate)
  if (filters.toDate) observationParams.set('to_date', filters.toDate)
  if (filters.dataType) observationParams.set('data_type', filters.dataType)
  if (filters.freshness) observationParams.set('freshness', filters.freshness)

  const marketParams = new URLSearchParams()
  if (filters.district) marketParams.set('district', filters.district)

  const [marketsResponse, observationsResponse] = await Promise.all([
    fetch(`/api/markets?${marketParams}`),
    fetch(`/api/price-observations?${observationParams}`),
  ])
  if (!marketsResponse.ok || !observationsResponse.ok) {
    throw new Error(lang === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಪ್ರಸ್ತುತ ಲಭ್ಯವಿಲ್ಲ.' : 'Market price currently unavailable.')
  }
  const [marketsData, observationsData] = await Promise.all([
    marketsResponse.json(),
    observationsResponse.json(),
  ])
  if (!Array.isArray(marketsData.items) || !Array.isArray(observationsData.items)
    || typeof observationsData.ranking_message !== 'string') {
    throw new Error(lang === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಪ್ರಸ್ತುತ ಲಭ್ಯವಿಲ್ಲ.' : 'Market price currently unavailable.')
  }
  return {
    markets: marketsData.items,
    observations: observationsData.items,
    rankingMessage: observationsData.ranking_message,
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `record-${Date.now()}-${Math.random()}`
}

function getSafeHttpUrl(value) {
  if (!value) return 'https://agmarknet.gov.in/'
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return 'https://agmarknet.gov.in/'
    // If the URL points to raw internal REST API endpoints, open the public AGMARKNET portal
    if (url.hostname.includes('api.agmarknet.gov.in') || url.pathname.includes('/v1')) {
      return 'https://agmarknet.gov.in/'
    }
    return url.href
  } catch {
    return 'https://agmarknet.gov.in/'
  }
}

function formatTimestamp(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? timeFormat.format(parsed) : null
}

function isObservationStale(observation) {
  if (!observation) return false
  if (observation.freshness === 'stale') return true
  if (!observation.observation_date) return true
  const obsDate = new Date(`${observation.observation_date}T00:00:00Z`).getTime()
  if (Number.isNaN(obsDate)) return true
  const diffDays = (Date.now() - obsDate) / (1000 * 60 * 60 * 24)
  return diffDays > 7
}

function localizeEligibilityReason(reason, lang = 'kn') {
  const dict = {
    'Demo data cannot be used as a real market-price ranking.': {
      kn: 'ಪ್ರದರ್ಶನದ ದತ್ತಾಂಶವನ್ನು ನೈಜ ಮಾರುಕಟ್ಟೆ ಶ್ರೇಯಾಂಕಕ್ಕೆ ಬಳಸಲಾಗುವುದಿಲ್ಲ.',
      en: 'Demo data cannot be used as a real market-price ranking.',
    },
    'Observation date unavailable.': {
      kn: 'ಗಮನಿಕೆ ದಿನಾಂಕ ಲಭ್ಯವಿಲ್ಲ.',
      en: 'Observation date unavailable.',
    },
    'Stale price; verify before deciding.': {
      kn: 'ಹಳೆಯ ಬೆಲೆ; ನಿರ್ಧಾರಕ್ಕೂ ಮೊದಲು ಪರಿಶೀಲಿಸಿ.',
      en: 'Stale price; verify before deciding.',
    },
    'Observation date is invalid or in the future.': {
      kn: 'ಗಮನಿಕೆ ದಿನಾಂಕ ಅಮಾನ್ಯ ಅಥವಾ ಭವಿಷ್ಯದದು.',
      en: 'Observation date is invalid or in the future.',
    },
    'Source unavailable.': {
      kn: 'ಮೂಲ ಲಭ್ಯವಿಲ್ಲ.',
      en: 'Source unavailable.',
    },
    'Price unit unavailable.': {
      kn: 'ಬೆಲೆ ಘಟಕ ಲಭ್ಯವಿಲ್ಲ.',
      en: 'Price unit unavailable.',
    },
    'Price unit is unsupported for comparable market ranking.': {
      kn: 'ಹೋಲಿಕೆಗೆ ಬೆಲೆ ಘಟಕ ಬೆಂಬಲಿತವಲ್ಲ.',
      en: 'Price unit is unsupported for comparable market ranking.',
    },
    'Commodity unavailable.': {
      kn: 'ಬೆಳೆ / ಸರಕು ಲಭ್ಯವಿಲ್ಲ.',
      en: 'Commodity unavailable.',
    },
    'Market unavailable.': {
      kn: 'ಮಾರುಕಟ್ಟೆ ಲಭ್ಯವಿಲ್ಲ.',
      en: 'Market unavailable.',
    },
    'Price is invalid.': {
      kn: 'ಬೆಲೆ ಅಮಾನ್ಯವಾಗಿದೆ.',
      en: 'Price is invalid.',
    },
  }
  return dict[reason]?.[lang] ?? reason
}

function localizeRankingMessage(message, lang = 'kn') {
  if (message.includes('Insufficient reliable data for ranking')) {
    return lang === 'kn'
      ? 'ವಿಶ್ವಾಸಾರ್ಹ ಶ್ರೇಯಾಂಕಕ್ಕೆ ಸಾಕಷ್ಟು ದತ್ತಾಂಶವಿಲ್ಲ.'
      : 'Insufficient reliable data for ranking.'
  }
  return lang === 'kn'
    ? 'ಹೋಲಿಸಬಹುದಾದ ಗಮನಿಕೆಗಳಿವೆ; ಮೂಲ ಮತ್ತು ಷರತ್ತುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.'
    : `Comparable observations are available; review sources and conditions. (${message})`
}

function loadInitialCollection(loader) {
  const loaded = loader()
  return { records: loaded.records, error: loaded.error }
}

function getCalculationBreakdown(inputs) {
  const saleableQuantity = inputs.q * (1 - inputs.l)
  const effectivePrice = Math.max(0, inputs.p - inputs.d)
  return {
    saleableQuantity,
    lostQuantity: inputs.q - saleableQuantity,
    qualityDeduction: saleableQuantity * (inputs.p - effectivePrice),
    adjustedSaleValue: saleableQuantity * effectivePrice,
    totalCosts: inputs.ct + inputs.ch + inputs.cp + inputs.cm + inputs.co,
  }
}

function getOptionFieldErrors(option, today = new Date(), lang = 'kn') {
  const errors = {}
  const price = option.price.trim() ? Number(option.price) : NaN
  const distance = option.distance.trim() ? Number(option.distance) : NaN
  const transport = option.transportQuote.trim() ? Number(option.transportQuote) : NaN

  if (!option.name.trim()) errors.name = lang === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಅಥವಾ ಖರೀದಿದಾರರ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.' : 'Enter a market or buyer name.'
  if (!Number.isFinite(price) || price <= 0) errors.price = lang === 'kn' ? 'ಸೊನ್ನೆಗಿಂತ ಹೆಚ್ಚಿನ ಮಾನ್ಯ ಬೆಲೆ ನಮೂದಿಸಿ.' : 'Enter a valid price greater than zero.'
  if (!option.priceDate) errors.priceDate = lang === 'kn' ? 'ಬೆಲೆ ದಿನಾಂಕವನ್ನು ನಮೂದಿಸಿ.' : 'Enter the price date.'
  else {
    const observed = new Date(`${option.priceDate}T00:00:00Z`)
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    const ageDays = (todayDate - observed) / 86_400_000
    if (!Number.isFinite(observed.getTime()) || observed.toISOString().slice(0, 10) !== option.priceDate || ageDays < 0) {
      errors.priceDate = lang === 'kn' ? 'ಭವಿಷ್ಯದ ದಿನಾಂಕವಲ್ಲದ ಮಾನ್ಯ ದಿನಾಂಕ ನಮೂದಿಸಿ.' : 'Enter a valid non-future date.'
    } else if (ageDays > PRICE_FRESHNESS_DAYS) {
      errors.priceDate = lang === 'kn' ? `ಬೆಲೆ ${PRICE_FRESHNESS_DAYS} ದಿನಗಳಿಗಿಂತ ಹಳೆಯದು.` : `Price is older than ${PRICE_FRESHNESS_DAYS} days.`
    }
  }
  if (!option.source.trim()) errors.source = lang === 'kn' ? 'ಬೆಲೆಯ ಮೂಲವನ್ನು ನಮೂದಿಸಿ.' : 'Enter the price source.'
  if (!Number.isFinite(distance) || distance < 0) errors.distance = lang === 'kn' ? 'ಸೊನ್ನೆ ಅಥವಾ ಧನಾತ್ಮಕ ದೂರ ನಮೂದಿಸಿ.' : 'Enter zero or a positive distance.'
  if (!Number.isFinite(transport) || transport < 0) errors.transportQuote = lang === 'kn' ? 'ಸೊನ್ನೆ ಅಥವಾ ಧನಾತ್ಮಕ ಸಾರಿಗೆ ವೆಚ್ಚ ನಮೂದಿಸಿ.' : 'Enter zero or a positive transport quote.'
  if (!option.transportQuoteValidUntil) errors.transportQuoteValidUntil = lang === 'kn' ? 'ಉಲ್ಲೇಖದ ಮಾನ್ಯತಾ ದಿನಾಂಕ ನಮೂದಿಸಿ.' : 'Enter the quote validity date.'
  else {
    const validityDate = new Date(`${option.transportQuoteValidUntil}T00:00:00Z`)
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    if (!Number.isFinite(validityDate.getTime()) || validityDate.toISOString().slice(0, 10) !== option.transportQuoteValidUntil) {
      errors.transportQuoteValidUntil = lang === 'kn' ? 'ಮಾನ್ಯ ಉಲ್ಲೇಖದ ದಿನಾಂಕ ನಮೂದಿಸಿ.' : 'Enter a valid quote date.'
    } else if (validityDate < todayDate) {
      errors.transportQuoteValidUntil = lang === 'kn' ? 'ಸಾರಿಗೆ ಉಲ್ಲೇಖದ ದಿನಾಂಕ ಮುಗಿದಿದೆ.' : 'Transport quote has expired.'
    }
  }
  if (!TRANSPORT_CHECKLIST_ITEMS.every((item) => ['included', 'excluded'].includes(option.transportChecklist?.[item]))) {
    errors.transportChecklist = lang === 'kn' ? 'ಪ್ರತಿ ಶುಲ್ಕವು ಉಲ್ಲೇಖದಲ್ಲಿ ಸೇರಿದೆಯೇ ದೃಢೀಕರಿಸಿ.' : 'Confirm whether each charge is included in the quote.'
  }
  if (!option.qualityRequirements.trim()) errors.qualityRequirements = lang === 'kn' ? 'ಗುಣಮಟ್ಟದ ಅವಶ್ಯಕತೆಗಳನ್ನು ನಮೂದಿಸಿ.' : 'Enter quality requirements.'
  if (!option.paymentCategory) errors.paymentCategory = lang === 'kn' ? 'ಪಾವತಿ ನಿಯಮಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ.' : 'Select payment terms.'
  if (['credit', 'other'].includes(option.paymentCategory) && !option.paymentTerms.trim()) {
    errors.paymentTerms = option.paymentCategory === 'credit'
      ? (lang === 'kn' ? 'ಸಾಲದ ಅವಧಿಯನ್ನು ನಮೂದಿಸಿ.' : 'Enter the credit period.')
      : (lang === 'kn' ? 'ಪಾವತಿ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ.' : 'Enter payment details.')
  }
  return errors
}

function calculateLocally(inputs) {
  return calculateNetProceeds(inputs)
}

export default function App() {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('farmer_app_lang') || 'kn'
    } catch {
      return 'kn'
    }
  })

  const [loadedCollections] = useState(() => ({
    calculations: loadInitialCollection(loadCalculations),
    observations: loadInitialCollection(loadMarketObservations),
    options: loadInitialCollection(loadSellingOptions),
  }))
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'apmc' | 'comparison' | 'produce' | 'decision' | 'analytics' | 'saved'
  const [authState, setAuthState] = useState('checking') // 'checking' | 'login' | 'register' | 'welcome' | 'dashboard'
  const [currentUser, setCurrentUser] = useState(null)
  const [sessionTime] = useState(() => new Date())
  const [data, setData] = useState(initialData)
  const [comparisonCommodity, setComparisonCommodity] = useState('')
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null)
  const [isOffline, setIsOffline] = useState(false)
  const [browserOnline, setBrowserOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculations, setCalculations] = useState(loadedCollections.calculations.records)
  const [observations, setObservations] = useState(loadedCollections.observations.records)
  const [backendMarkets, setBackendMarkets] = useState([])
  const [backendObservations, setBackendObservations] = useState([])
  const [isCachedData, setIsCachedData] = useState(false)
  const [showLatestOnly, setShowLatestOnly] = useState(true)
  const [expandedMarketIds, setExpandedMarketIds] = useState(() => new Set())
  const [marketRankingMessage, setMarketRankingMessage] = useState('')
  const [adminEntryEnabled, setAdminEntryEnabled] = useState(false)
  const [adminToken, setAdminToken] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState(() => {
    try {
      return localStorage.getItem('agro_mitra_district') || 'Davanagere'
    } catch {
      return 'Davanagere'
    }
  })
  const [selectedCrop, setSelectedCrop] = useState(() => {
    try {
      return localStorage.getItem('agro_mitra_crop') || 'Maize'
    } catch {
      return 'Maize'
    }
  })
  const [apmcSortBy, setApmcSortBy] = useState('market_name')

  const handleDistrictChange = (newDistrict) => {
    setSelectedDistrict(newDistrict)
    try {
      localStorage.setItem('agro_mitra_district', newDistrict)
    } catch {}
  }

  const handleCropChange = (newCrop) => {
    setSelectedCrop(newCrop)
    setComparisonCommodity(newCrop)
    try {
      localStorage.setItem('agro_mitra_crop', newCrop)
    } catch {}
  }

  const toggleExpandMarket = (id) => {
    setExpandedMarketIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  const [manualObservationDraft, setManualObservationDraft] = useState({
    marketId: '', commodity: '', variety: '', price: '', unit: '', observationDate: '', sourceName: '', sourceUrl: '',
  })
  const [manualObservationMessage, setManualObservationMessage] = useState(null)
  const [manualObservationSubmitting, setManualObservationSubmitting] = useState(false)
  const [marketCommodityFilter, setMarketCommodityFilter] = useState('')
  const [marketFilterDraft, setMarketFilterDraft] = useState('')
  const [selectedMarketFilter, setSelectedMarketFilter] = useState('')
  const [selectedMarketDraft, setSelectedMarketDraft] = useState('')
  const [marketDateFrom, setMarketDateFrom] = useState('')
  const [marketDateFromDraft, setMarketDateFromDraft] = useState('')
  const [marketDateTo, setMarketDateTo] = useState('')
  const [marketDateToDraft, setMarketDateToDraft] = useState('')
  const [marketDataType, setMarketDataType] = useState('')
  const [marketDataTypeDraft, setMarketDataTypeDraft] = useState('')
  const [marketFreshness, setMarketFreshness] = useState('')
  const [marketFreshnessDraft, setMarketFreshnessDraft] = useState('')
  const [marketDataError, setMarketDataError] = useState('')
  const [marketDataLoading, setMarketDataLoading] = useState(true)
  const [marketRefreshCount, setMarketRefreshCount] = useState(0)
  const [syncInProgress, setSyncInProgress] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [options, setOptions] = useState(() => loadedCollections.options.records.length
    ? loadedCollections.options.records
    : [createOption(language === 'kn' ? 'ಸ್ಥಳೀಯ ಎಪಿಎಂಸಿ' : 'Local APMC'), createOption(language === 'kn' ? 'ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ' : 'Nearby Market')])
  const [storageNotice, setStorageNotice] = useState([
    loadedCollections.calculations.error,
    loadedCollections.observations.error,
    loadedCollections.options.error,
  ].filter(Boolean).join(' '))
  const [selectedCalculation, setSelectedCalculation] = useState(null)
  const [observationDraft, setObservationDraft] = useState({
    market: '', commodity: '', price: '', date: '', source: '', unit: '', customUnit: '',
  })
  const [observationErrors, setObservationErrors] = useState({})
  const [editingObservationId, setEditingObservationId] = useState(null)
  const [optionErrors, setOptionErrors] = useState({})
  const [comparisonResults, setComparisonResults] = useState(null)
  const [comparisonBase, setComparisonBase] = useState(null)
  const [transportScenarioCosts, setTransportScenarioCosts] = useState({})
  const [pooledFarmers, setPooledFarmers] = useState('2')
  const [pooledQuintals, setPooledQuintals] = useState('50')
  const [decision, setDecision] = useState(null)
  const [isComparing, setIsComparing] = useState(false)
  const [whatsAppPreviewOpen, setWhatsAppPreviewOpen] = useState(false)
  const [whatsAppPreviewText, setWhatsAppPreviewText] = useState('')
  const [whatsAppCopyFeedback, setWhatsAppCopyFeedback] = useState('')

  const labels = getLabels(language)
  const statusLabels = getStatusLabels(language)
  const paymentLabels = getPaymentLabels(language)
  const transportChecklistLabels = getTransportChecklistLabels(language)
  const transportChecklistStatusLabels = getTransportChecklistStatusLabels(language)
  const observationUnits = getObservationUnits(language)
  const dataSourceLabels = getDataSourceLabels(language)

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang)
    try {
      localStorage.setItem('farmer_app_lang', newLang)
    } catch {
      // storage unavailable
    }
  }

  useEffect(() => {
    let isMounted = true
    async function verifyAuth() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const user = await res.json()
          if (isMounted) {
            setCurrentUser(user)
            setAuthState('dashboard')
          }
        } else {
          if (isMounted) {
            setCurrentUser(null)
            setAuthState('login')
          }
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null)
          setAuthState('login')
        }
      }
    }
    verifyAuth()
    return () => {
      isMounted = false
    }
  }, [])

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData)
    setAuthState('welcome')
  }

  const handleWelcomeComplete = () => {
    setAuthState('dashboard')
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // ignore
    }
    setCurrentUser(null)
    setAuthState('login')
  }

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true)
    const handleOffline = () => setBrowserOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/admin/status')
      .then((response) => {
        if (!response.ok) throw new Error('Admin status is unavailable.')
        return response.json()
      })
      .then((data) => {
        if (active) setAdminEntryEnabled(data.manual_entry_enabled === true)
      })
      .catch(() => {
        if (active) setAdminEntryEnabled(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setMarketDataLoading(true)
    setMarketDataError('')

    fetchMarketDashboardData({
      district: selectedDistrict,
      commodity: marketCommodityFilter.trim() || selectedCrop,
      marketId: selectedMarketFilter,
      fromDate: marketDateFrom,
      toDate: marketDateTo,
      dataType: marketDataType,
      freshness: marketFreshness,
    }, language)
      .then(({ markets, observations: loadedObservations, rankingMessage }) => {
        if (!active) return
        setBackendMarkets(markets)
        setBackendObservations(loadedObservations)
        setMarketRankingMessage(rankingMessage)
        setIsCachedData(false)
        try {
          if (loadedObservations && loadedObservations.length > 0) {
            localStorage.setItem('verified_market_cache', JSON.stringify({
              markets,
              observations: loadedObservations,
              rankingMessage,
            }))
          }
        } catch {
          // Ignore cache write issues
        }
      })
      .catch(() => {
        if (!active) return
        let cached = null
        try {
          const raw = localStorage.getItem('verified_market_cache')
          if (raw) cached = JSON.parse(raw)
        } catch {
          cached = null
        }

        if (cached && Array.isArray(cached.observations) && cached.observations.length > 0) {
          let filteredObs = cached.observations
          if (selectedMarketFilter) {
            filteredObs = filteredObs.filter((o) => String(o.market_id) === String(selectedMarketFilter))
          }
          if (selectedDistrict) {
            filteredObs = filteredObs.filter((o) => (o.market_district || '').toLowerCase().includes(selectedDistrict.toLowerCase()))
          }
          const cropFilter = marketCommodityFilter.trim() || selectedCrop
          if (cropFilter) {
            filteredObs = filteredObs.filter((o) => (o.commodity || '').toLowerCase().includes(cropFilter.toLowerCase()))
          }
          setBackendMarkets(cached.markets || [])
          setBackendObservations(filteredObs)
          setMarketRankingMessage(cached.rankingMessage || '')
          setIsCachedData(true)
          setMarketDataError('')
        } else {
          setBackendObservations([])
          setIsCachedData(false)
          setMarketDataError(t('no_observations_matched', language))
        }
      })
      .finally(() => {
        if (active) setMarketDataLoading(false)
      })
    return () => { active = false }
  }, [selectedDistrict, selectedCrop, marketCommodityFilter, selectedMarketFilter, marketDateFrom, marketDateTo, marketDataType, marketFreshness, marketRefreshCount, language])

  const refreshCalculations = () => {
    const loaded = loadCalculations()
    if (!loaded.ok) {
      setStorageNotice(loaded.error)
      return
    }
    setCalculations(loaded.records)
    if (loaded.error) setStorageNotice(loaded.error)
  }

  const refreshObservations = () => {
    const loaded = loadMarketObservations()
    if (!loaded.ok) {
      setStorageNotice(loaded.error)
      return
    }
    setObservations(loaded.records)
    if (loaded.error) setStorageNotice(loaded.error)
  }

  const persistOptions = (nextOptions) => {
    const saved = saveSellingOptions(nextOptions)
    setStorageNotice(saved.error)
    return saved.ok
  }

  async function triggerMarketSync() {
    setSyncInProgress(true)
    setSyncMessage('')
    try {
      const res = await fetch(`/api/market-prices/sync?district=${encodeURIComponent(selectedDistrict)}&commodity=${encodeURIComponent(selectedCrop)}`, { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      const resultData = await res.json()
      if (resultData.success) {
        setSyncMessage(language === 'kn'
          ? `AGMARKNET ನಿಂದ ${resultData.records_synced} ಬೆಲೆಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ. ಇತ್ತೀಚಿನ ದಿನಾಂಕ: ${resultData.latest_observation_date || 'ಲಭ್ಯವಿಲ್ಲ'}.`
          : `Synchronized ${resultData.records_synced} prices from AGMARKNET. Latest date: ${resultData.latest_observation_date || 'unavailable'}.`)
      } else {
        setSyncMessage(resultData.error || (language === 'kn' ? 'ಬೆಲೆಗಳನ್ನು ನವೀಕರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' : 'Could not update prices.'))
      }
      setMarketRefreshCount((c) => c + 1)
    } catch {
      setSyncMessage(language === 'kn' ? 'ಸರ್ವರ್ ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ.' : 'Server connection failed.')
    } finally {
      setSyncInProgress(false)
    }
  }

  const handleChange = ({ target: { name, value } }) => {
    setData((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setResult(null)
    setIsOffline(false)
    setComparisonResults(null)
    setDecision(null)
  }

  const validate = () => {
    const nextErrors = {}
    const number = (key, { required = false, min = 0, max = Infinity } = {}) => {
      const value = data[key].trim()
      if (!value) {
        if (required) nextErrors[key] = language === 'kn' ? 'ಮೌಲ್ಯವನ್ನು ನಮೂದಿಸಿ.' : 'Enter a value.'
        return 0
      }
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) nextErrors[key] = language === 'kn' ? 'ಸರಿಯಾದ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.' : 'Enter a valid number.'
      else if (parsed < min || parsed > max) {
        nextErrors[key] = key === 'l'
          ? (language === 'kn' ? '0 ರಿಂದ 100 ರವರೆಗೆ ನಮೂದಿಸಿ.' : 'Enter a value from 0 to 100.')
          : min > 0 ? (language === 'kn' ? 'ಸೊನ್ನೆಗಿಂತ ಹೆಚ್ಚಿನ ಮೌಲ್ಯ ನಮೂದಿಸಿ.' : 'Enter a value greater than zero.')
            : (language === 'kn' ? 'ಋಣಾತ್ಮಕ ಮೌಲ್ಯವನ್ನು ನಮೂದಿಸಬೇಡಿ.' : 'Do not enter negative values.')
      }
      return parsed
    }
    const q = number('q', { required: true, min: 0.000001 })
    const p = number('p', { required: true, min: 0.000001 })
    const l = number('l', { required: true, min: 0, max: 100 }) / 100
    const d = number('d', { min: 0 })
    const costs = costFields.reduce((acc, key) => ({ ...acc, [key]: number(key, { min: 0 }) }), {})

    return {
      isValid: Object.keys(nextErrors).length === 0,
      errors: nextErrors,
      values: { q, p, l, d, ...costs },
    }
  }

  const recordCalculation = (inputs, calculationResult, mode, comparisonMetadata = null) => {
    const breakdown = getCalculationBreakdown(inputs)
    const calculation = {
      id: createId(),
      timestamp: new Date().toISOString(),
      mode,
      inputs,
      result: calculationResult,
      breakdown,
      comparison: comparisonMetadata,
    }
    const saved = saveCalculation(calculation)
    if (!saved.ok) {
      setStorageNotice(saved.error)
      return
    }
    refreshCalculations()
    setStorageNotice(saved.error)
  }

  const calculate = async (event) => {
    event.preventDefault()
    const { isValid, errors: nextErrors, values } = validate()
    setErrors(nextErrors)
    if (!isValid) return

    setIsCalculating(true)
    let calculationMode = 'api'
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('API request failed')
      const json = await response.json()
      setResult(json)
      setIsOffline(false)
      recordCalculation(values, json, 'api')
    } catch {
      calculationMode = 'offline'
      const localResult = calculateLocally(values)
      setResult(localResult)
      setIsOffline(true)
      recordCalculation(values, localResult, 'offline')
    } finally {
      setIsCalculating(false)
    }
  }

  const updateOption = (id, updates) => {
    setOptions((current) => current.map((option) => (option.id === id ? { ...option, ...updates, saved: false } : option)))
    setOptionErrors((current) => ({ ...current, [id]: undefined }))
    setComparisonResults(null)
    setDecision(null)
  }

  const addOption = () => {
    if (options.length >= 3) return
    const nextIndex = options.length + 1
    const nextOptions = [...options, createOption(language === 'kn' ? `ಮಾರಾಟದ ಆಯ್ಕೆ ${nextIndex}` : `Selling Option ${nextIndex}`)]
    setOptions(nextOptions)
    persistOptions(nextOptions)
    setComparisonResults(null)
    setDecision(null)
  }

  const removeOption = (id) => {
    if (options.length <= 1) return
    const nextOptions = options.filter((option) => option.id !== id)
    setOptions(nextOptions)
    persistOptions(nextOptions)
    setComparisonResults(null)
    setDecision(null)
  }

  const saveDraft = (id) => {
    const nextOptions = options.map((option) => (option.id === id ? { ...option, saved: true } : option))
    setOptions(nextOptions)
    persistOptions(nextOptions)
  }

  const compareOptions = async () => {
    const { isValid, errors: nextErrors, values: base } = validate()
    const baseErrors = { ...nextErrors }
    if (!comparisonCommodity.trim()) {
      baseErrors.commodity = language === 'kn' ? 'ಬೆಳೆ / ಸರಕನ್ನು ನಮೂದಿಸಿ.' : 'Enter a commodity.'
    }
    setErrors(baseErrors)
    const issuesById = {}
    const fieldErrorsById = {}
    const savedOptions = options.map((option) => ({ ...option, saved: true }))
    setOptions(savedOptions)
    persistOptions(savedOptions)
    for (const option of savedOptions) {
      issuesById[option.id] = getOptionIssues(option, new Date())
      fieldErrorsById[option.id] = getOptionFieldErrors(option, new Date(), language)
    }
    setOptionErrors(fieldErrorsById)
    const hasFieldErrors = Object.values(fieldErrorsById).some((item) => Object.keys(item).length > 0)
    if (!isValid || baseErrors.commodity || hasFieldErrors) {
      setComparisonResults(null)
      setDecision(null)
      return
    }

    setComparisonBase(base)
    setIsComparing(true)
    let resultsById = {}
    let calculationMode = 'api'
    const requests = savedOptions.map((option) => ({
      option,
      inputs: {
        ...base,
        p: Number(option.price),
        ct: Number(option.transportQuote || 0),
      },
    }))

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          common_inputs: base,
          options: savedOptions.map((option) => ({
            client_id: option.id,
            name: option.name,
            price: Number(option.price),
            transport_quote: Number(option.transportQuote || 0),
            commodity: comparisonCommodity.trim(),
            variety: option.qualityRequirements.trim() || null,
            price_date: option.priceDate || null,
            source: option.source.trim() || null,
            distance_km: Number(option.distance || 0),
            transport_quote_valid_until: option.transportQuoteValidUntil || null,
            payment_terms: option.paymentCategory || null,
            buyer_confirmation_status: option.confirmation || null,
          })),
        }),
      })
      if (!response.ok) throw new Error('API compare request failed')
      const comparison = await response.json()
      const responseResults = comparison.results?.items
      if (!Array.isArray(responseResults)) throw new Error('API returned an invalid comparison')
      resultsById = Object.fromEntries(responseResults.map((item) => [item.client_id, {
        net_proceeds: item.net_proceeds,
        gross: item.gross,
        selling_option_id: item.selling_option_id,
      }]))
      if (requests.some(({ option }) => !Number.isFinite(resultsById[option.id]?.net_proceeds))) {
        throw new Error('API returned an incomplete comparison')
      }
    } catch {
      calculationMode = 'offline'
      resultsById = Object.fromEntries(requests.map(({ option, inputs }) => [option.id, calculateLocally(inputs)]))
      setIsOffline(true)
    } finally {
      setIsComparing(false)
    }
    setComparisonResults(resultsById)
    const finalDecision = getComparisonDecision(savedOptions, resultsById, issuesById)
    setDecision(finalDecision)
    const snapshot = {
      decision: finalDecision,
      results: resultsById,
      base: { ...base },
      options: savedOptions.map((option) => ({ ...option })),
    }
    for (const { option, inputs } of requests) {
      recordCalculation(inputs, resultsById[option.id], calculationMode, {
        ...snapshot,
        optionId: option.id,
        optionName: option.name,
        priceDate: option.priceDate,
        source: option.source,
      })
    }
  }

  const reset = () => {
    setData(initialData)
    setComparisonCommodity('')
    setErrors({})
    setResult(null)
    setIsOffline(false)
    setComparisonResults(null)
    setComparisonBase(null)
    setDecision(null)
  }

  const resetOptions = () => {
    const nextOptions = [createOption(language === 'kn' ? 'ಸ್ಥಳೀಯ ಎಪಿಎಂಸಿ' : 'Local APMC'), createOption(language === 'kn' ? 'ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ' : 'Nearby Market')]
    setOptions(nextOptions)
    persistOptions(nextOptions)
    setOptionErrors({})
    setComparisonResults(null)
    setComparisonBase(null)
    setDecision(null)
    setIsOffline(false)
  }

  const viewCalculation = (calculation) => {
    setSelectedCalculation(calculation)
  }

  const reuseCalculation = (calculation) => {
    setData({
      q: String(calculation.inputs.q),
      p: String(calculation.inputs.p),
      l: String(calculation.inputs.l * 100),
      d: String(calculation.inputs.d),
      ct: String(calculation.inputs.ct),
      ch: String(calculation.inputs.ch),
      cp: String(calculation.inputs.cp),
      cm: String(calculation.inputs.cm),
      co: String(calculation.inputs.co),
    })
    setErrors({})
    setResult(null)
    setSelectedCalculation(null)
    setIsOffline(false)
    setComparisonResults(null)
    setDecision(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeCalculation = (id) => {
    const deleted = deleteCalculation(id)
    if (!deleted.ok) {
      setStorageNotice(deleted.error)
      return
    }
    setStorageNotice(deleted.error)
    refreshCalculations()
    if (selectedCalculation?.id === id) setSelectedCalculation(null)
  }

  const clearHistory = () => {
    const confirmMsg = language === 'kn'
      ? 'ಎಲ್ಲ ಹಿಂದಿನ ಲೆಕ್ಕಾಚಾರಗಳನ್ನು ಅಳಿಸಬೇಕೇ? ಉಳಿಸಿದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಅಳಿಯುವುದಿಲ್ಲ.'
      : 'Clear all calculation history? Saved market prices will remain.'
    if (!window.confirm(confirmMsg)) return
    const cleared = clearCalculationHistory()
    if (!cleared.ok) {
      setStorageNotice(cleared.error)
      return
    }
    setCalculations([])
    setSelectedCalculation(null)
    setStorageNotice('')
  }

  const saveObservation = (event) => {
    event.preventDefault()
    const nextErrors = {}
    const price = observationDraft.price.trim() ? Number(observationDraft.price) : NaN
    if (!observationDraft.market.trim()) nextErrors.market = language === 'kn' ? 'ಮಾರುಕಟ್ಟೆಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.' : 'Enter a market name.'
    if (!observationDraft.commodity.trim()) nextErrors.commodity = language === 'kn' ? 'ಬೆಳೆ / ಸರಕನ್ನು ನಮೂದಿಸಿ.' : 'Enter a commodity.'
    if (!Number.isFinite(price) || price <= 0) nextErrors.price = language === 'kn' ? 'ಸೊನ್ನೆಗಿಂತ ಹೆಚ್ಚಿನ ಮಾನ್ಯ ಬೆಲೆ ನಮೂದಿಸಿ.' : 'Enter a valid price greater than zero.'
    if (!observationDraft.date) nextErrors.date = language === 'kn' ? 'ಬೆಲೆ ಗಮನಿಸಿದ ದಿನಾಂಕ ನಮೂದಿಸಿ.' : 'Enter the observation date.'
    else {
      const observedDate = new Date(`${observationDraft.date}T00:00:00Z`)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (!Number.isFinite(observedDate.getTime()) || observedDate.toISOString().slice(0, 10) !== observationDraft.date
        || observedDate.getTime() > Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) {
        nextErrors.date = language === 'kn' ? 'ಮಾನ್ಯ ಹಿಂದಿನ ಅಥವಾ ಇಂದಿನ ದಿನಾಂಕ ನಮೂದಿಸಿ.' : 'Enter a valid past or today date.'
      }
    }
    if (!observationDraft.source.trim()) nextErrors.source = language === 'kn' ? 'ಮೂಲವನ್ನು ನಮೂದಿಸಿ.' : 'Enter the source.'
    if (!observationDraft.unit || (observationDraft.unit === 'other' && !observationDraft.customUnit.trim())) {
      nextErrors.unit = language === 'kn' ? 'ಬೆಲೆ ಘಟಕವನ್ನು ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ನಮೂದಿಸಿ.' : 'Select or enter a price unit.'
    }
    setObservationErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const previous = observations.find((record) => record.id === editingObservationId)
    const observation = {
      id: previous?.id ?? createId(),
      market: observationDraft.market.trim(),
      commodity: observationDraft.commodity.trim(),
      price,
      date: observationDraft.date,
      source: observationDraft.source.trim(),
      unit: observationDraft.unit === 'other' ? observationDraft.customUnit.trim() : observationDraft.unit,
      savedAt: previous?.savedAt ?? new Date().toISOString(),
    }
    const saved = saveMarketObservation(observation)
    if (!saved.ok) {
      setStorageNotice(saved.error)
      return
    }
    refreshObservations()
    setStorageNotice(saved.error)
    setObservationDraft({ market: '', commodity: '', price: '', date: '', source: '', unit: '', customUnit: '' })
    setObservationErrors({})
    setEditingObservationId(null)
  }

  const editObservation = (observation) => {
    setEditingObservationId(observation.id)
    setObservationDraft({
      market: observation.market,
      commodity: observation.commodity,
      price: String(observation.price),
      date: observation.date,
      source: observation.source,
      unit: ['kg', 'quintal', 'tonne'].includes(observation.unit) ? observation.unit : 'other',
      customUnit: ['kg', 'quintal', 'tonne'].includes(observation.unit) ? '' : observation.unit,
    })
    setObservationErrors({})
  }

  const removeObservation = (id) => {
    const deleted = deleteMarketObservation(id)
    if (!deleted.ok) {
      setStorageNotice(deleted.error)
      return
    }
    setStorageNotice(deleted.error)
    refreshObservations()
    if (editingObservationId === id) {
      setEditingObservationId(null)
      setObservationDraft({ market: '', commodity: '', price: '', date: '', source: '', unit: '', customUnit: '' })
      setObservationErrors({})
    }
  }

  const clearObservations = () => {
    const confirmMsg = language === 'kn'
      ? 'ಎಲ್ಲ ಉಳಿಸಿದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳನ್ನು ತೆರವುಗೊಳಿಸಬೇಕೇ?'
      : 'Clear all saved market observations?'
    if (!window.confirm(confirmMsg)) return
    const cleared = clearMarketObservations()
    if (!cleared.ok) {
      setStorageNotice(cleared.error)
      return
    }
    setObservations([])
    setStorageNotice('')
    setEditingObservationId(null)
    setObservationDraft({ market: '', commodity: '', price: '', date: '', source: '', unit: '', customUnit: '' })
    setObservationErrors({})
  }

  const submitManualMarketObservation = async (event) => {
    event.preventDefault()
    setManualObservationMessage(null)
    if (!adminToken.trim()) {
      setManualObservationMessage({
        type: 'error',
        text: language === 'kn' ? 'ನಿರ್ವಾಹಕ ಪ್ರವೇಶ ಟೋಕನ್ ನಮೂದಿಸಿ.' : 'Enter the admin access token.',
      })
      return
    }
    if (!manualObservationDraft.marketId || !manualObservationDraft.commodity.trim()) {
      setManualObservationMessage({
        type: 'error',
        text: language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಮತ್ತು ಬೆಳೆ / ಸರಕು ಕಡ್ಡಾಯ.' : 'Market and commodity are required.',
      })
      return
    }
    const price = manualObservationDraft.price.trim() ? Number(manualObservationDraft.price) : NaN
    if (!Number.isFinite(price) || price <= 0) {
      setManualObservationMessage({
        type: 'error',
        text: language === 'kn' ? 'ಸೊನ್ನೆಗಿಂತ ಹೆಚ್ಚಿನ ಮಾನ್ಯ ಬೆಲೆ ನಮೂದಿಸಿ.' : 'Enter a valid positive price.',
      })
      return
    }
    if (!manualObservationDraft.unit) {
      setManualObservationMessage({
        type: 'error',
        text: language === 'kn' ? 'ಬೆಲೆ ಘಟಕವನ್ನು ಆಯ್ಕೆಮಾಡಿ.' : 'Select an explicit price unit.',
      })
      return
    }
    if (manualObservationDraft.observationDate) {
      const observed = new Date(`${manualObservationDraft.observationDate}T00:00:00Z`)
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
      if (!Number.isFinite(observed.getTime()) || observed.toISOString().slice(0, 10) !== manualObservationDraft.observationDate
        || observed > today) {
        setManualObservationMessage({
          type: 'error',
          text: language === 'kn' ? 'ಮಾನ್ಯ ಹಿಂದಿನ ಅಥವಾ ಇಂದಿನ ಗಮನಿಕೆ ದಿನಾಂಕ ನಮೂದಿಸಿ.' : 'Enter a valid non-future observation date.',
        })
        return
      }
    }
    setManualObservationSubmitting(true)
    try {
      const response = await fetch('/api/price-observations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          market_id: Number(manualObservationDraft.marketId),
          commodity: manualObservationDraft.commodity.trim(),
          variety: manualObservationDraft.variety.trim() || null,
          price,
          unit: manualObservationDraft.unit,
          observation_date: manualObservationDraft.observationDate || null,
          source_name: manualObservationDraft.sourceName.trim() || null,
          source_url: manualObservationDraft.sourceUrl.trim() || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        const detail = typeof payload.detail === 'string'
          ? payload.detail
          : (language === 'kn' ? 'ನಮೂದು ಉಳಿಸಲಾಗಲಿಲ್ಲ.' : 'The observation was not saved.')
        throw new Error(detail)
      }
      setManualObservationDraft({
        marketId: '', commodity: '', variety: '', price: '', unit: '', observationDate: '', sourceName: '', sourceUrl: '',
      })
      setManualObservationMessage({
        type: 'success',
        text: payload.ranking_eligible
          ? (language === 'kn'
            ? 'ಕೈಯಾರೆ ನಮೂದಿಸಿದ ಬೆಲೆ ಉಳಿಸಲಾಗಿದೆ; ಇದು ಸ್ವತಂತ್ರವಾಗಿ ಪರಿಶೀಲಿತವಲ್ಲ.'
            : 'Manual price saved; it is not independently verified.')
          : (language === 'kn'
            ? 'ದಾಖಲೆ ಉಳಿಸಲಾಗಿದೆ; ಮೂಲ ಅಥವಾ ದಿನಾಂಕದ ಕೊರತೆಯಿಂದ ಇದು ಶ್ರೇಯಾಂಕಕ್ಕೆ ಅರ್ಹವಲ್ಲ.'
            : 'Record saved; missing source/date means it is not rank-eligible.'),
      })
      setMarketDataLoading(true)
      setMarketRefreshCount((count) => count + 1)
    } catch (error) {
      setManualObservationMessage({
        type: 'error',
        text: error instanceof Error
          ? error.message
          : (language === 'kn' ? 'ಬೆಲೆ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' : 'Could not save the observation.'),
      })
    } finally {
      setManualObservationSubmitting(false)
    }
  }

  const applyObservationPrice = (observation) => {
    // Uses modal price if present, otherwise base observation price
    const activePrice = observation.modal_price || observation.price
    const pricePerKg = pricePerKilogram(activePrice, observation.unit)
    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return
    setData((current) => ({ ...current, p: String(pricePerKg) }))
    setErrors((current) => ({ ...current, p: undefined }))
    setResult(null)
    setSelectedCalculation(null)
    setIsOffline(false)
    setComparisonResults(null)
    setDecision(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startObservationEditReset = () => {
    setEditingObservationId(null)
    setObservationDraft({ market: '', commodity: '', price: '', date: '', source: '', unit: '', customUnit: '' })
    setObservationErrors({})
  }

  const inputs = result ? {
    q: Number(data.q), p: Number(data.p), l: Number(data.l) / 100, d: Number(data.d || 0),
    ct: Number(data.ct || 0), ch: Number(data.ch || 0), cp: Number(data.cp || 0), cm: Number(data.cm || 0), co: Number(data.co || 0),
  } : null
  const saleableQuantity = inputs ? inputs.q * (1 - inputs.l) : 0
  const lostQuantity = inputs ? inputs.q - saleableQuantity : 0
  const effectivePrice = inputs ? Math.max(0, inputs.p - inputs.d) : 0
  const qualityDeduction = inputs ? saleableQuantity * (inputs.p - effectivePrice) : 0
  const adjustedSaleValue = inputs ? saleableQuantity * effectivePrice : 0
  const totalCosts = inputs ? inputs.ct + inputs.ch + inputs.cp + inputs.cm + inputs.co : 0

  const field = (key, helper, fieldOptions = {}) => (
    <div className="input-group">
      <label htmlFor={key}>{labels[key]}</label>
      <span className="input-helper">{helper}</span>
      <input id={key} name={key} type="number" inputMode="decimal" step="any" min={fieldOptions.min} max={fieldOptions.max}
        required={fieldOptions.required} value={data[key]} onChange={handleChange} className={errors[key] ? 'has-error' : ''}
        disabled={isCalculating || isComparing} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} />
      {errors[key] && <p className="field-error" id={`${key}-error`} role="alert">{errors[key]}</p>}
    </div>
  )

  const optionField = (option, key, label, type = 'text', helper = '') => {
    const error = optionErrors[option.id]?.[key]
    const id = `${option.id}-${key}`
    const shared = {
      id,
      value: option[key] ?? '',
      disabled: isComparing,
      className: error ? 'has-error' : '',
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `${id}-error` : undefined,
      onChange: (event) => updateOption(option.id, { [key]: event.target.value }),
    }
    return (
      <div className="input-group">
        <label htmlFor={id}>{label}</label>
        {helper && <span className="input-helper">{helper}</span>}
        {type === 'textarea'
          ? <textarea {...shared} rows="3" />
          : <input {...shared} type={type} inputMode={type === 'number' ? 'decimal' : undefined} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined} />}
        {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
      </div>
    )
  }

  const formatOrMissing = (value, formatter = (entry) => entry) => value === '' || value == null
    ? (language === 'kn' ? 'ಮಾಹಿತಿ ನೀಡಿಲ್ಲ' : 'Not provided')
    : formatter(value)

  const decisionWinnerId = decision?.status === 'winner' ? decision.ranked[0].option.id : null
  const decisionCloseIds = decision?.status === 'close' ? decision.ranked.slice(0, 2).map(({ option }) => option.id) : []

  // Filter backend observations: show latest only per APMC market if toggle active
  const displayedObservations = showLatestOnly
    ? getLatestMarketObservations(backendObservations)
    : backendObservations

  const sortedObservations = [...displayedObservations].sort((a, b) => {
    if (apmcSortBy === 'modal_price') {
      const priceA = a.modal_price || a.price || 0
      const priceB = b.modal_price || b.price || 0
      return priceB - priceA
    }
    if (apmcSortBy === 'reporting_date') {
      const dateA = a.observation_date ? new Date(a.observation_date).getTime() : 0
      const dateB = b.observation_date ? new Date(b.observation_date).getTime() : 0
      return dateB - dateA
    }
    const nameA = a.market_name || ''
    const nameB = b.market_name || ''
    return nameA.localeCompare(nameB)
  })

  const decisionConfidence = (() => {
    if (!decision || decision.status === 'incomplete') {
      return { level: 'low', label: t('confidence_low', language) }
    }
    const hasUnconfirmedOrStale = options.some((opt) => {
      const isUnconfirmed = opt.confirmation === 'unconfirmed'
      const daysOld = opt.priceDate ? (Date.now() - new Date(opt.priceDate).getTime()) / (1000 * 60 * 60 * 24) : 99
      return isUnconfirmed || daysOld > 3
    })
    if (hasUnconfirmedOrStale) {
      return { level: 'medium', label: t('confidence_medium', language) }
    }
    return { level: 'high', label: t('confidence_high', language) }
  })()

  if (authState === 'checking') {
    return (
      <div className="auth-checking-screen">
        <div className="auth-checking-box">
          <div className="auth-spinner large" aria-hidden="true" />
          <p className="auth-checking-text">{language === 'kn' ? 'ದೃಢೀಕರಣ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…' : 'Checking authentication…'}</p>
        </div>
      </div>
    )
  }

  if (authState === 'login') {
    return (
      <LoginPage
        language={language}
        setLanguage={handleLanguageChange}
        onLoginSuccess={handleLoginSuccess}
        onGoToRegister={() => setAuthState('register')}
      />
    )
  }

  if (authState === 'register') {
    return (
      <RegisterPage
        language={language}
        setLanguage={handleLanguageChange}
        onRegisterSuccess={handleLoginSuccess}
        onGoToLogin={() => setAuthState('login')}
      />
    )
  }

  if (authState === 'welcome') {
    return (
      <WelcomeAnimation
        language={language}
        username={currentUser?.username || ''}
        onComplete={handleWelcomeComplete}
      />
    )
  }

  return (
    <main className={`container ref-dashboard-container lang-${language}`}>
      <DashboardHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        currentUser={currentUser}
        onLogout={handleLogout}
        browserOnline={browserOnline}
        isOffline={isOffline}
      />

      <WelcomeHero
        language={language}
        currentUser={currentUser}
      />

      <StickyQuickNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        language={language}
      />

      {/* 31 Karnataka Districts & 7 Crops Selectors */}
      <section className="selector-banner" aria-label="District and Crop Selector">
        <div className="selector-group">
          <label htmlFor="district-select" className="selector-label">
            📍 {t('district_label', language)}
          </label>
          <select
            id="district-select"
            className="district-select-input"
            value={selectedDistrict}
            onChange={(e) => handleDistrictChange(e.target.value)}
          >
            {KARNATAKA_DISTRICTS.map((dist) => (
              <option key={dist.id} value={dist.name}>
                {language === 'kn' ? dist.name_kn : dist.name}
              </option>
            ))}
          </select>
        </div>

        <div className="selector-group">
          <label htmlFor="crop-select" className="selector-label">
            🌾 {t('crop_label', language)}
          </label>
          <select
            id="crop-select"
            className="crop-select-input"
            value={selectedCrop}
            onChange={(e) => handleCropChange(e.target.value)}
          >
            {KARNATAKA_CROPS.map((crop) => (
              <option key={crop.id} value={crop.name}>
                {language === 'kn' ? crop.name_kn : crop.name} ({crop.default_unit})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Sugarcane Special Pricing Banner */}
      {selectedCrop === 'Sugarcane' && (
        <section className="sugarcane-banner" role="region" aria-label={t('sugarcane_notice_title', language)}>
          <div className="sugarcane-banner-header">
            <span className="sugarcane-icon">🎋</span>
            <strong>{t('sugarcane_notice_title', language)}</strong>
          </div>
          <p>{t('sugarcane_notice_body', language)}</p>
          <div className="sugarcane-frp-badge">
            📌 {t('sugarcane_frp_ref', language)}
          </div>
        </section>
      )}

      <aside className="disclaimer" aria-label={t('disclaimer_title', language)}>
        <strong>{t('disclaimer_title', language)}: </strong>
        <span>{t('disclaimer_body', language)}</span>
      </aside>

      <aside className="local-storage-notice">
        <h2>{t('local_storage_title', language)}</h2>
        <p>{t('local_storage_body', language)}</p>
        {!browserOnline && <p className="offline-explanation">{t('offline_note', language)}</p>}
        {storageNotice && <p className="storage-error" role="alert">{storageNotice}</p>}
      </aside>

      
      {/* 3x3 + 1 Responsive Feature Cards Grid */}
      <div className={`ref-cards-grid ${activeTab === 'all' ? 'overview-mode' : 'focused-mode'}`}><article className={`ref-feature-card ${activeTab !== 'all' && activeTab !== 'card-apmc' ? 'is-hidden' : ''}`} id="card-apmc">
        <div className="ref-card-header">
          <div className="ref-card-badge-row">
            <span className="ref-card-num-circle">1</span>
            <div className="ref-card-icon-pill">🏛️</div>
          </div>
          <div className="ref-card-headings">
            <h2 className="ref-card-title-kn">ಅಧಿಕೃತ ಎಪಿಎಂಸಿ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ</h2>
            <h3 className="ref-card-title-en">Official APMC Data</h3>
            <p className="ref-card-desc">
              {language === 'kn'
                ? 'ನಿಮ್ಮ ಆಯ್ದ ಜಿಲ್ಲೆ ಮತ್ತು ಬೆಳೆಗೆ ಅಧಿಕೃತ ಮೂಲಗಳಿಂದ (AGMARKNET) ಇತ್ತೀಚಿನ ಮಂಡಿ ದರಗಳನ್ನು ಪಡೆಯಿರಿ.'
                : 'Get latest mandi rates from official sources (AGMARKNET) for your selected district and crop.'}
            </p>
          </div>
        </div>

        <div className="ref-card-body-summary">
          <ul className="ref-feature-checklist">
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'AGMARKNET 2.0 ನೇರ ಸಂಪರ್ಕ' : 'Live AGMARKNET 2.0 sync'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಕನಿಷ್ಠ, ಗರಿಷ್ಠ & ಮಾದರಿ ಬೆಲೆ' : 'Min, Max & Modal price'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ತಳಿ, ಗ್ರೇಡ್ ಮತ್ತು ಬೆಲೆ ಘಟಕ' : 'Variety, grade and unit'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ವರದಿ ದಿನಾಂಕ & ದತ್ತಾಂಶ ಮೂಲ' : 'Reporting date & source'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ತಾಜಾ / ವಿಳಂಬಿತ / ಹಳೆಯ ಸ್ಥಿತಿ' : 'Fresh / Delayed / Stale status'}</span></li>
          </ul>
          <div className="ref-card-illustration-box">
            <APMCIllustration />
          </div>
        </div>

        <div className="ref-card-actions-bar">
          <button
            type="button"
            className="ref-card-btn btn-primary"
            onClick={() => setActiveTab('card-apmc')}
          >
            <span>{language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ' : 'View Market Prices'}</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>

        <div className="ref-card-interactive-drawer open">
          <div className="ref-card-drawer-inner">
            <section className="market-dashboard" aria-labelledby="market-dashboard-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('market_overview_eyebrow', language)}</p>
            <h2 id="market-dashboard-title">{t('market_overview_title', language)}</h2>
          </div>
          <span className="option-count">
            {backendMarkets.length} {t('markets_count_suffix', language)} · {backendObservations.length} {t('prices_count_suffix', language)}
          </span>
        </div>

        <div style={{ margin: '0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="calculate-button"
            disabled={syncInProgress || !browserOnline}
            onClick={triggerMarketSync}
            style={{ backgroundColor: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem' }}
          >
            🔄 {syncInProgress ? t('refreshing_prices', language) : t('refresh_prices_button', language)}
          </button>
          <span style={{ fontSize: '0.85rem', color: syncMessage.includes('ವಿಫಲ') || syncMessage.includes('failed') ? '#b91c1c' : '#15803d', fontWeight: '500' }}>
            {syncMessage || t('sync_active_note', language)}
          </span>
        </div>

        <p className="section-intro">
          {t('section_intro', language, { district: getLocalizedDistrictName(selectedDistrict, language) })}
        </p>

        {/* APMC Sort Bar */}
        <div className="apmc-sort-bar">
          <span className="sort-label">⇅ {language === 'kn' ? 'ವಿಂಗಡಣೆ:' : 'Sort by:'}</span>
          <button
            type="button"
            className={`sort-pill-btn ${apmcSortBy === 'market_name' ? 'active' : ''}`}
            onClick={() => setApmcSortBy('market_name')}
          >
            {language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಹೆಸರು' : 'Market Name'}
          </button>
          <button
            type="button"
            className={`sort-pill-btn ${apmcSortBy === 'modal_price' ? 'active' : ''}`}
            onClick={() => setApmcSortBy('modal_price')}
          >
            {language === 'kn' ? 'ಮಾದರಿ ಬೆಲೆ' : 'Modal Price'}
          </button>
          <button
            type="button"
            className={`sort-pill-btn ${apmcSortBy === 'reporting_date' ? 'active' : ''}`}
            onClick={() => setApmcSortBy('reporting_date')}
          >
            {language === 'kn' ? 'ವರದಿ ದಿನಾಂಕ' : 'Report Date'}
          </button>
        </div>

        {/* Latest APMC Price Toggle Bar */}
        <div className="latest-toggle-bar">
          <label className="latest-toggle-label" htmlFor="latest-price-toggle">
            <input
              id="latest-price-toggle"
              type="checkbox"
              checked={showLatestOnly}
              onChange={(e) => setShowLatestOnly(e.target.checked)}
            />
            <span>{t('latest_only_toggle', language)}</span>
          </label>
          <span className="option-count">
            {showLatestOnly
              ? (language === 'kn' ? `ಇತ್ತೀಚಿನ ಬೆಲೆಗಳು: ${sortedObservations.length}` : `Latest quotes: ${sortedObservations.length}`)
              : (language === 'kn' ? `ಒಟ್ಟು ದಾಖಲೆಗಳು: ${sortedObservations.length}` : `All records: ${sortedObservations.length}`)}
          </span>
        </div>

        <form className="market-filters" onSubmit={(event) => {
          event.preventDefault()
          setMarketDataLoading(true)
          setMarketDataError('')
          setMarketCommodityFilter(marketFilterDraft)
          setSelectedMarketFilter(selectedMarketDraft)
          setMarketDateFrom(marketDateFromDraft)
          setMarketDateTo(marketDateToDraft)
          setMarketDataType(marketDataTypeDraft)
          setMarketFreshness(marketFreshnessDraft)
          setMarketRefreshCount((count) => count + 1)
        }}>
          <div className="input-group">
            <label htmlFor="market-commodity-filter">{t('commodity_label', language)}</label>
            <select
              id="market-commodity-filter"
              value={marketFilterDraft}
              onChange={(event) => setMarketFilterDraft(event.target.value)}
            >
              <option value="">{t('all_commodities', language)}</option>
              {KARNATAKA_CROPS.map((crop) => (
                <option key={crop.id} value={crop.name}>
                  {language === 'kn' ? crop.name_kn : crop.name}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="market-filter">{t('market_label', language)}</label>
            <select id="market-filter" value={selectedMarketDraft}
              onChange={(event) => setSelectedMarketDraft(event.target.value)}>
              <option value="">{t('all_markets', language)}</option>
              {backendMarkets.map((market) => (
                <option key={market.id} value={market.id}>
                  {getLocalizedMarketName(market.name, language)}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="market-date-from">{t('from_date_label', language)}</label>
            <input id="market-date-from" type="date" value={marketDateFromDraft}
              onChange={(event) => setMarketDateFromDraft(event.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="market-date-to">{t('to_date_label', language)}</label>
            <input id="market-date-to" type="date" value={marketDateToDraft}
              onChange={(event) => setMarketDateToDraft(event.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="market-data-type">{t('data_type_label', language)}</label>
            <select id="market-data-type" value={marketDataTypeDraft} onChange={(event) => setMarketDataTypeDraft(event.target.value)}>
              <option value="">{t('all_types', language)}</option>
              <option value="official">{t('official_source', language)}</option>
              <option value="manual">{t('manual_source', language)}</option>
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="market-freshness">{t('freshness_label', language)}</label>
            <select id="market-freshness" value={marketFreshnessDraft} onChange={(event) => setMarketFreshnessDraft(event.target.value)}>
              <option value="">{t('all_statuses', language)}</option>
              <option value="recent">{t('freshness_recent', language)}</option>
              <option value="stale">{t('freshness_stale', language)}</option>
              <option value="unknown">{t('freshness_unknown', language)}</option>
            </select>
          </div>
          <div className="market-filter-actions">
            <button type="submit" className="calculate-button">{t('show_prices_button', language)}</button>
            <button type="button" className="reset-button" onClick={() => {
              setMarketFilterDraft('')
              setSelectedMarketDraft('')
              setMarketDateFromDraft('')
              setMarketDateToDraft('')
              setMarketDataTypeDraft('')
              setMarketFreshnessDraft('')
              setMarketCommodityFilter('')
              setSelectedMarketFilter('')
              setMarketDateFrom('')
              setMarketDateTo('')
              setMarketDataType('')
              setMarketFreshness('')
              setMarketDataLoading(true)
              setMarketDataError('')
              setMarketRefreshCount((count) => count + 1)
            }}
              disabled={marketDataLoading}>{t('reset_filters_button', language)}</button>
          </div>
        </form>

        {adminEntryEnabled && (
          <section className="manual-market-entry" aria-labelledby="manual-entry-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{language === 'kn' ? 'ಅಧಿಕೃತ ಟೋಕನ್ ಅಗತ್ಯ' : 'Authorized token required'}</p>
                <h3 id="manual-entry-heading">{language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ನಮೂದಿಸಿ' : 'Enter Market Price'}</h3>
              </div>
              <span className="option-count">{language === 'kn' ? 'ಕೈಯಾರೆ · ಪರಿಶೀಲಿಸಿಲ್ಲ' : 'Manual · Unverified'}</span>
            </div>
            <div className="input-group">
              <label htmlFor="market-admin-token">{language === 'kn' ? 'ನಿರ್ವಾಹಕ ಟೋಕನ್' : 'Admin token'}</label>
              <input id="market-admin-token" type="password" autoComplete="off" value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)} />
            </div>
            <form className="manual-observation-form" onSubmit={submitManualMarketObservation}>
              <div className="manual-observation-fields">
                <div className="input-group">
                  <label htmlFor="manual-market-id">{t('market_label', language)} *</label>
                  <select id="manual-market-id" required value={manualObservationDraft.marketId}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, marketId: event.target.value }))}>
                    <option value="">{t('market_label', language)} {language === 'kn' ? 'ಆಯ್ಕೆಮಾಡಿ' : 'select'}</option>
                    {backendMarkets.map((market) => (
                      <option key={market.id} value={market.id}>
                        {getLocalizedMarketName(market.name, language)} · {market.location}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="manual-commodity">{t('commodity_label', language)} *</label>
                  <input id="manual-commodity" required value={manualObservationDraft.commodity}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, commodity: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label htmlFor="manual-variety">{t('variety_label', language)}</label>
                  <input id="manual-variety" value={manualObservationDraft.variety}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, variety: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label htmlFor="manual-price">{t('p_label', language)} *</label>
                  <input id="manual-price" type="number" inputMode="decimal" step="any" min="0" required value={manualObservationDraft.price}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, price: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label htmlFor="manual-unit">{language === 'kn' ? 'ಬೆಲೆ ಘಟಕ' : 'Price unit'} *</label>
                  <select id="manual-unit" required value={manualObservationDraft.unit}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, unit: event.target.value }))}>
                    <option value="">{language === 'kn' ? 'ಘಟಕ ಆಯ್ಕೆಮಾಡಿ' : 'Select unit'}</option>
                    <option value="INR/kg">{language === 'kn' ? '₹ / ಕೆ.ಜಿ.' : '₹ / kg'}</option>
                    <option value="INR/quintal">{language === 'kn' ? '₹ / ಕ್ವಿಂಟಾಲ್' : '₹ / quintal'}</option>
                    <option value="INR/tonne">{language === 'kn' ? '₹ / ಟನ್' : '₹ / tonne'}</option>
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="manual-observation-date">{t('observation_date_label', language)}</label>
                  <input id="manual-observation-date" type="date" value={manualObservationDraft.observationDate}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, observationDate: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label htmlFor="manual-source-name">{t('source_label', language)}</label>
                  <input id="manual-source-name" value={manualObservationDraft.sourceName}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, sourceName: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label htmlFor="manual-source-url">{language === 'kn' ? 'ಮೂಲ URL (ಐಚ್ಛಿಕ)' : 'Source URL (optional)'}</label>
                  <input id="manual-source-url" type="url" value={manualObservationDraft.sourceUrl}
                    onChange={(event) => setManualObservationDraft((current) => ({ ...current, sourceUrl: event.target.value }))} />
                </div>
              </div>
              <button type="submit" className="calculate-button" disabled={manualObservationSubmitting}>
                {manualObservationSubmitting ? (language === 'kn' ? 'ಉಳಿಸಲಾಗುತ್ತಿದೆ…' : 'Saving...') : (language === 'kn' ? 'ಬೆಲೆ ಉಳಿಸಿ' : 'Save Price')}
              </button>
              {manualObservationMessage && <p className={manualObservationMessage.type === 'success' ? 'manual-success' : 'market-data-error'}
                role={manualObservationMessage.type === 'success' ? 'status' : 'alert'}>{manualObservationMessage.text}</p>}
            </form>
          </section>
        )}

        {isCachedData && (
          <div className="cached-data-banner" role="status">
            <span className="cached-badge">{t('cached_data_badge', language)}</span>
            <span>
              {language === 'kn'
                ? 'ಸರ್ವರ್ ಸಂಪರ್ಕ ಲಭ್ಯವಿಲ್ಲದ ಕಾರಣ ಕೊನೆಯದಾಗಿ ಪರಿಶೀಲಿಸಿದ ಬೆಲೆಗಳನ್ನು ಪ್ರದರ್ಶಿಸಲಾಗುತ್ತಿದೆ.'
                : 'Live API unreachable; displaying latest previously verified cached records.'}
            </span>
          </div>
        )}

        {marketDataLoading && <p className="empty-state" role="status">{t('loading_market_data', language)}</p>}
        {!marketDataLoading && marketDataError && <p className="market-data-error" role="alert">{marketDataError}</p>}
        {!marketDataLoading && !marketDataError && marketRankingMessage
          && <p className="ranking-status" role="status">{language === 'kn' ? 'ಬೆಲೆ ಶ್ರೇಯಾಂಕ ಸ್ಥಿತಿ' : 'Ranking status'}: {localizeRankingMessage(marketRankingMessage, language)}</p>}
        {!marketDataLoading && !marketDataError && sortedObservations.length === 0 && (
          <div className="empty-market-state" role="status">
            <p className="empty-title">⚠️ {t('no_observations_matched', language)}</p>
            <p className="empty-subtitle">
              {language === 'kn'
                ? `${getLocalizedDistrictName(selectedDistrict, language)} ಜಿಲ್ಲೆಯ ${backendMarkets.length} ಮಾರುಕಟ್ಟೆಗಳಲ್ಲಿ ${getLocalizedCropName(selectedCrop, language)}ಗೆ ಇತ್ತೀಚಿನ ಅಧಿಕೃತ ದರ ದಾಖಲಾಗಿಲ್ಲ.`
                : `No verified market price available for ${getLocalizedCropName(selectedCrop, language)} in ${getLocalizedDistrictName(selectedDistrict, language)} district.`}
            </p>
          </div>
        )}

        {/* Compact Expandable APMC Mandi Price List */}
        {!marketDataLoading && !marketDataError && sortedObservations.length > 0 && (
          <div className="apmc-recessed-container">
            <div className="apmc-list" role="region" aria-label={t('market_overview_title', language)}>
              {sortedObservations.map((observation) => {
                const isExpanded = expandedMarketIds.has(observation.id)
                const dateValue = observation.observation_date ? new Date(`${observation.observation_date}T00:00:00Z`) : null
                const safeSourceUrl = getSafeHttpUrl(observation.source_url)
                const activePrice = observation.modal_price || observation.price
                const pricePerKg = pricePerKilogram(activePrice, observation.unit)
                const localizedMarket = getLocalizedMarketName(observation.market_name, language)
                const unitLabel = formatUnitString(observation.unit, language)
                const freshness = observation.freshness || (isObservationStale(observation) ? 'stale' : 'recent')
                const stale = freshness === 'stale'
                const isFresh = freshness === 'recent'
                const formattedDate = dateValue && Number.isFinite(dateValue.getTime()) ? dateFormat.format(dateValue) : null

                return (
                  <article
                    className={`apmc-compact-row ${isExpanded ? 'expanded' : ''} ${stale ? 'stale' : ''}`}
                    key={observation.id}
                  >
                    {/* Collapsed Header / Clickable Bar */}
                    <div
                      className="apmc-row-summary"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpandMarket(observation.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleExpandMarket(observation.id)
                        }
                      }}
                    >
                      <div className="apmc-market-ident">
                        <div className="apmc-title-wrap">
                          <span className="apmc-name-text">
                            {localizedMarket || (language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಲಭ್ಯವಿಲ್ಲ' : 'Market unavailable')}
                          </span>
                          {stale && <span className="stale-badge">{language === 'kn' ? 'ಹಳೆಯದು' : 'STALE'}</span>}
                          {isFresh && !isCachedData && <span className="fresh-badge">{language === 'kn' ? 'ಇತ್ತೀಚಿನ' : 'FRESH'}</span>}
                          {isCachedData && <span className="cached-badge">{t('cached_data_badge', language)}</span>}
                        </div>
                        <div className="apmc-sub-text">
                          <span>{observation.market_district || 'Davanagere'}, {observation.market_state || 'Karnataka'}</span>
                          {formattedDate && <span className="apmc-dot-sep">·</span>}
                          {formattedDate && <span className="apmc-date-hint">{formattedDate}</span>}
                        </div>
                      </div>

                      <div className="apmc-price-meta">
                        <div className="apmc-price-display">
                          <span className="apmc-price-value">
                            {Number.isFinite(activePrice) ? rupees.format(activePrice) : '—'}
                          </span>
                          <span className="apmc-price-unit">/{language === 'kn' ? 'ಕ್ವಿಂ.' : 'qtl'}</span>
                        </div>
                        {pricePerKg && (
                          <span className="apmc-price-per-kg">
                            (≈ {rupees.format(pricePerKg)}/kg)
                          </span>
                        )}
                      </div>

                      <div className={`apmc-expand-chevron ${isExpanded ? 'rotated' : ''}`} aria-hidden="true">
                        ▾
                      </div>
                    </div>

                    {/* Expanded Drawer Details */}
                    {isExpanded && (
                      <div className="apmc-details-drawer">
                        <div className="apmc-detail-grid">
                          <div className="apmc-detail-pill">
                            <span className="pill-label">{t('commodity_label', language)}</span>
                            <strong className="pill-value">{observation.commodity || 'Maize'}</strong>
                          </div>
                          <div className="apmc-detail-pill">
                            <span className="pill-label">{t('variety_label', language)}</span>
                            <strong className="pill-value">{observation.variety || (language === 'kn' ? 'ಸಾಮಾನ್ಯ / ನಮೂದಿಸಿಲ್ಲ' : 'General / Unspecified')}</strong>
                          </div>
                          <div className="apmc-detail-pill">
                            <span className="pill-label">{t('modal_price_label', language)}</span>
                            <strong className="pill-value price-highlight">
                              {Number.isFinite(activePrice) ? rupees.format(activePrice) : '—'} / {unitLabel}
                            </strong>
                          </div>
                          {Number.isFinite(observation.min_price) && Number.isFinite(observation.max_price) && (
                            <div className="apmc-detail-pill">
                              <span className="pill-label">{t('min_max_price_label', language)}</span>
                              <strong className="pill-value">
                                {rupees.format(observation.min_price)} – {rupees.format(observation.max_price)}
                              </strong>
                            </div>
                          )}
                          <div className="apmc-detail-pill">
                            <span className="pill-label">{t('observation_date_label', language)}</span>
                            <strong className="pill-value">{formattedDate || (language === 'kn' ? 'ಲಭ್ಯವಿಲ್ಲ' : 'Unavailable')}</strong>
                          </div>
                          <div className="apmc-detail-pill">
                            <span className="pill-label">{t('source_label', language)}</span>
                            <strong className="pill-value">
                              {observation.source_name || 'AGMARKNET 2.0'}
                              {safeSourceUrl && (
                                <a href={safeSourceUrl} target="_blank" rel="noreferrer" className="pill-link">
                                  ({language === 'kn' ? 'ಮೂಲ' : 'Source'})
                                </a>
                              )}
                            </strong>
                          </div>
                          {observation.retrieved_at && (
                            <div className="apmc-detail-pill">
                              <span className="pill-label">{t('retrieved_at_label', language)}</span>
                              <strong className="pill-value">{formatTimestamp(observation.retrieved_at)}</strong>
                            </div>
                          )}
                          <div className="apmc-detail-pill">
                            <span className="pill-label">{t('verification_label', language)}</span>
                            <strong className="pill-value verification-tag">
                              {observation.verification_status === 'verified' ? `✓ ${t('verified', language)}` : t('unverified', language)}
                            </strong>
                          </div>
                          <div className="apmc-detail-pill">
                            <span className="pill-label">{t('arrivals_card_title', language)}</span>
                            <strong className="pill-value">
                              {observation.arrival_quantity !== null && observation.arrival_quantity !== undefined
                                ? `${observation.arrival_quantity} ${observation.arrival_unit || 'tonnes'}`
                                : t('arrival_unavailable', language)}
                            </strong>
                          </div>
                        </div>

                        {stale ? (
                          <div className="stale-alert-banner">
                            ⚠️ {t('stale_price_warning', language)}
                          </div>
                        ) : observation.freshness === 'recent' ? (
                          <div className="recent-notice-banner">
                            ✅ {t('freshness_recent', language)}
                          </div>
                        ) : null}

                        {observation.ranking_eligible && pricePerKg !== null ? (
                          <button
                            type="button"
                            className="use-calc-tactile-btn"
                            onClick={() => applyObservationPrice(observation)}
                          >
                            📥 {t('use_in_calculator_button', language)}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  </div>
</article>

<article className={`ref-feature-card ${activeTab !== 'all' && activeTab !== 'card-comparison' ? 'is-hidden' : ''}`} id="card-comparison">
        <div className="ref-card-header">
          <div className="ref-card-badge-row">
            <span className="ref-card-num-circle">2</span>
            <div className="ref-card-icon-pill">⚖️</div>
          </div>
          <div className="ref-card-headings">
            <h2 className="ref-card-title-kn">ಎರಡು ಮಾರುಕಟ್ಟೆಗಳ ತುಲನೆ</h2>
            <h3 className="ref-card-title-en">Two-Market Comparison</h3>
            <p className="ref-card-desc">
              {language === 'kn'
                ? 'ಎರಡು ಅಥವಾ ಹೆಚ್ಚಿನ ಮಾರಾಟ ಆಯ್ಕೆಗಳ ನಡುವಿನ ದರ ಮತ್ತು ನಿವ್ವಳ ಆದಾಯವನ್ನು ಹೋಲಿಕೆ ಮಾಡಿ.'
                : 'Compare prices and estimated net returns between two markets (or more).'}
            </p>
          </div>
        </div>

        <div className="ref-card-body-summary">
          <ul className="ref-feature-checklist">
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಆಯ್ಕೆ (3 ಆಯ್ಕೆಗಳವರೆಗೆ)' : 'Select markets (up to 3)'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಸಾರಿಗೆ ವಿವರಗಳ ನಮೂದು' : 'Set transport details'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಅಪಾಯ ಮತ್ತು ದೂರ ಪರಿಶೀಲನೆ' : 'Check risks and distance'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ನಿವ್ವಳ ಆದಾಯದ ಹೋಲಿಕೆ' : 'Compare net proceeds'}</span></li>
          </ul>
          <div className="ref-card-illustration-box">
            <ComparisonIllustration />
          </div>
        </div>

        <div className="ref-card-actions-bar">
          <button
            type="button"
            className="ref-card-btn btn-primary"
            onClick={() => {
              setActiveTab('card-comparison')
              compareOptions()
            }}
            disabled={isComparing || isCalculating}
          >
            <span>{isComparing ? t('comparing_button', language) : (language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ ಮಾಡಿ' : 'Compare Markets')}</span>
            <span className="btn-arrow">→</span>
          </button>
          <button
            type="button"
            className="ref-card-btn btn-secondary"
            onClick={addOption}
            disabled={options.length >= 3 || isComparing}
          >
            <span>+ {t('add_option_button', language)}</span>
          </button>
        </div>

        <div className="ref-card-interactive-drawer open">
          <div className="ref-card-drawer-inner">
            <section className="comparison-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{language === 'kn' ? 'ಆಯ್ಕೆಗಳ ತುಲನೆ' : 'Decision Analysis'}</p>
            <h2>{t('comparison_title', language)}</h2>
          </div>
          <span className="option-count">
            {options.length} / 3 {language === 'kn' ? 'ಆಯ್ಕೆಗಳು' : 'options'}
          </span>
        </div>
        <p className="section-intro">{t('comparison_intro', language)}</p>

        <div className="input-group">
          <label htmlFor="comparison-commodity">{t('commodity_label', language)}</label>
          <select
            id="comparison-commodity"
            value={comparisonCommodity}
            aria-invalid={Boolean(errors.commodity)}
            className={errors.commodity ? 'has-error' : ''}
            aria-describedby={errors.commodity ? 'comparison-commodity-error' : undefined}
            onChange={(event) => {
              setComparisonCommodity(event.target.value)
              setErrors((current) => ({ ...current, commodity: undefined }))
              setComparisonResults(null)
              setDecision(null)
            }}
          >
            <option value="">{t('select_crop', language)}</option>
            {KARNATAKA_CROPS.map((crop) => (
              <option key={crop.id} value={crop.name}>
                {language === 'kn' ? crop.name_kn : crop.name}
              </option>
            ))}
          </select>
          {errors.commodity && <p className="field-error" id="comparison-commodity-error" role="alert">{errors.commodity}</p>}
        </div>

        <div className="option-list">
          {options.map((option, index) => (
            <article className="option-editor" key={option.id}>
              <div className="option-editor-heading">
                <h3>{option.name || (language === 'kn' ? `ಮಾರಾಟದ ಆಯ್ಕೆ ${index + 1}` : `Selling Option ${index + 1}`)}</h3>
                <span className={option.saved ? 'draft-status saved-status' : 'draft-status'}>
                  {option.saved ? t('option_saved_badge', language) : (language === 'kn' ? 'ಕರಡು' : 'Draft')}
                </span>
              </div>
              <div className="option-fields">
                <div className="input-group">
                  <label htmlFor={`${option.id}-name`}>{t('option_name_label', language)}</label>
                  <select
                    id={`${option.id}-name`}
                    value={option.name}
                    disabled={isComparing}
                    className={optionErrors[option.id]?.name ? 'has-error' : ''}
                    aria-invalid={Boolean(optionErrors[option.id]?.name)}
                    aria-describedby={optionErrors[option.id]?.name ? `${option.id}-name-error` : undefined}
                    onChange={(event) => updateOption(option.id, { name: event.target.value })}
                  >
                    <option value="">{language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಆಯ್ಕೆಮಾಡಿ' : 'Select Market'}</option>
                    {/* APMC markets fetched for current district */}
                    {backendMarkets.map((market) => {
                      const localized = getLocalizedMarketName(market.name, language)
                      return (
                        <option key={market.id} value={market.name}>
                          {localized}
                        </option>
                      )
                    })}
                    {/* Include standard fallback options if not in backendMarkets */}
                    <option value={language === 'kn' ? 'ಸ್ಥಳೀಯ ಎಪಿಎಂಸಿ' : 'Local APMC'}>
                      {language === 'kn' ? 'ಸ್ಥಳೀಯ ಎಪಿಎಂಸಿ' : 'Local APMC'}
                    </option>
                    <option value={language === 'kn' ? 'ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ' : 'Nearby Market'}>
                      {language === 'kn' ? 'ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ' : 'Nearby Market'}
                    </option>
                    {/* Preserve existing custom value if not in the list */}
                    {option.name && !backendMarkets.some((m) => m.name === option.name) && option.name !== (language === 'kn' ? 'ಸ್ಥಳೀಯ ಎಪಿಎಂಸಿ' : 'Local APMC') && option.name !== (language === 'kn' ? 'ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ' : 'Nearby Market') && (
                      <option value={option.name}>{option.name}</option>
                    )}
                  </select>
                  {optionErrors[option.id]?.name && <p className="field-error" id={`${option.id}-name-error`} role="alert">{optionErrors[option.id].name}</p>}
                </div>
                {optionField(option, 'price', t('p_label', language), 'number', t('p_helper', language))}
                {optionField(option, 'priceDate', t('observation_date_label', language), 'date')}
                <div className="input-group">
                  <label htmlFor={`${option.id}-source`}>{t('source_label', language)}</label>
                  <select
                    id={`${option.id}-source`}
                    value={option.source}
                    disabled={isComparing}
                    className={optionErrors[option.id]?.source ? 'has-error' : ''}
                    aria-invalid={Boolean(optionErrors[option.id]?.source)}
                    aria-describedby={optionErrors[option.id]?.source ? `${option.id}-source-error` : undefined}
                    onChange={(event) => updateOption(option.id, { source: event.target.value })}
                  >
                    <option value="">{language === 'kn' ? 'ಮೂಲ ಆಯ್ಕೆಮಾಡಿ' : 'Select Data Source'}</option>
                    {Object.entries(dataSourceLabels).map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                    {/* If option has another source value, preserve it */}
                    {option.source && !dataSourceLabels[option.source] && (
                      <option value={option.source}>{option.source}</option>
                    )}
                  </select>
                  {optionErrors[option.id]?.source && <p className="field-error" id={`${option.id}-source-error`} role="alert">{optionErrors[option.id].source}</p>}
                </div>
                {optionField(option, 'distance', t('distance_label', language), 'number', language === 'kn' ? 'ಒಂದು ದಾರಿ, ಕಿ.ಮೀ.' : 'One way, km')}
                {optionField(option, 'transportQuote', t('transport_quote_label', language), 'number', language === 'kn' ? '₹ ಒಟ್ಟು ಉಲ್ಲೇಖ' : '₹ Total quoted')}
                {optionField(option, 'transportQuoteValidUntil', t('transport_valid_label', language), 'date')}
                {optionField(option, 'qualityRequirements', t('quality_req_label', language), 'textarea')}
                <div className="input-group">
                  <label htmlFor={`${option.id}-paymentCategory`}>{t('payment_terms_label', language)}</label>
                  <select id={`${option.id}-paymentCategory`} value={option.paymentCategory} disabled={isComparing}
                    className={optionErrors[option.id]?.paymentCategory ? 'has-error' : ''}
                    aria-invalid={Boolean(optionErrors[option.id]?.paymentCategory)}
                    onChange={(event) => updateOption(option.id, { paymentCategory: event.target.value })}>
                    <option value="">{language === 'kn' ? 'ಆಯ್ಕೆಮಾಡಿ' : 'Select'}</option>
                    {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {optionErrors[option.id]?.paymentCategory && <p className="field-error" role="alert">{optionErrors[option.id].paymentCategory}</p>}
                </div>
                {optionField(option, 'paymentTerms', option.paymentCategory === 'credit'
                  ? (language === 'kn' ? 'ಸಾಲದ ಅವಧಿ ವಿವರ' : 'Credit Period Details')
                  : (language === 'kn' ? 'ಪಾವತಿ ವಿವರಗಳು' : 'Payment Details'), 'textarea')}
                <div className="input-group">
                  <label htmlFor={`${option.id}-confirmation`}>{t('buyer_status_label', language)}</label>
                  <select id={`${option.id}-confirmation`} value={option.confirmation} disabled={isComparing}
                    onChange={(event) => updateOption(option.id, { confirmation: event.target.value })}>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </div>

              <fieldset className="transport-checklist">
                <legend>{t('transport_checklist_title', language)}</legend>
                <div className="transport-checklist-fields">
                  {TRANSPORT_CHECKLIST_ITEMS.map((item) => {
                    const id = `${option.id}-transport-${item}`
                    return (
                      <div className="input-group" key={item}>
                        <label htmlFor={id}>{transportChecklistLabels[item]}</label>
                        <select id={id} value={option.transportChecklist?.[item] ?? 'unknown'} disabled={isComparing}
                          className={optionErrors[option.id]?.transportChecklist ? 'has-error' : ''}
                          aria-invalid={Boolean(optionErrors[option.id]?.transportChecklist)}
                          onChange={(event) => updateOption(option.id, {
                            transportChecklist: {
                              loading: 'unknown',
                              unloading: 'unknown',
                              waiting: 'unknown',
                              toll: 'unknown',
                              ...option.transportChecklist,
                              [item]: event.target.value,
                            },
                          })}>
                          {Object.entries(transportChecklistStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
                {optionErrors[option.id]?.transportChecklist && <p className="field-error" role="alert">{optionErrors[option.id].transportChecklist}</p>}
              </fieldset>

              <label className="checkbox-row">
                <input type="checkbox" checked={option.qualityComparable} disabled={isComparing}
                  onChange={(event) => updateOption(option.id, { qualityComparable: event.target.checked })} />
                <span>{t('quality_comp_label', language)}</span>
              </label>

              <div className="option-actions">
                <button type="button" className="calculate-button" onClick={() => saveDraft(option.id)} disabled={isComparing}>
                  {t('save_option_button', language)}
                </button>
                <button type="button" className="reset-button" onClick={() => removeOption(option.id)} disabled={isComparing}>
                  {t('remove_option_button', language)}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  </div>
</article>

<article className={`ref-feature-card ${activeTab !== 'all' && activeTab !== 'card-produce' ? 'is-hidden' : ''}`} id="card-produce">
        <div className="ref-card-header">
          <div className="ref-card-badge-row">
            <span className="ref-card-num-circle">3</span>
            <div className="ref-card-icon-pill">🌾</div>
          </div>
          <div className="ref-card-headings">
            <h2 className="ref-card-title-kn">ಬೆಳೆ ವಿವರ & ಪ್ರಮಾಣ</h2>
            <h3 className="ref-card-title-en">Produce & Lot</h3>
            <p className="ref-card-desc">
              {language === 'kn'
                ? 'ನಿಮ್ಮ ಬೆಳೆ, ಪ್ರಮಾಣ ಮತ್ತು ವೆಚ್ಚದ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ. ಇದನ್ನು ಹೋಲಿಕೆಯಲ್ಲಿ ಮರುಬಳಸಲಾಗುತ್ತದೆ.'
                : 'Enter your crop, quantity and cost details. This data is used in comparison and analysis.'}
            </p>
          </div>
        </div>

        <div className="ref-card-body-summary">
          <ul className="ref-feature-checklist">
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಬೆಳೆ ಮತ್ತು ತಳಿ' : 'Crop & variety'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಪ್ರಮಾಣ ಮತ್ತು ಘಟಕ' : 'Quantity & unit'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಕಡಿತಗಳು (ನಷ್ಟ & ಗುಣಮಟ್ಟ)' : 'Deductions (loss & quality cut)'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ವೆಚ್ಚಗಳ ಪೂರ್ಣ ವಿವರ' : 'Expense breakdown'}</span></li>
          </ul>
          <div className="ref-card-illustration-box">
            <ProduceIllustration />
          </div>
        </div>

        <div className="ref-card-actions-bar">
          <button
            type="submit"
            form="calculator-form"
            className="ref-card-btn btn-primary"
            onClick={() => setActiveTab('card-produce')}
            disabled={isCalculating || isComparing}
          >
            <span>{isCalculating ? t('calculating_button', language) : (language === 'kn' ? 'ಬೆಳೆ ವಿವರ ನವೀಕರಿಸಿ' : 'Update Produce Details')}</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>

        <div className="ref-card-interactive-drawer open">
          <div className="ref-card-drawer-inner">
            <div className="produce-reuse-pill" role="note">
              <span>💡</span>
              <span>{language === 'kn'
                ? `ಆಯ್ಕೆಮಾಡಲಾದ ಬೆಳೆ: ${selectedCrop} (${selectedDistrict} ಜಿಲ್ಲೆ) — ಈ ಪ್ರಮಾಣ ಮತ್ತು ವೆಚ್ಚದ ನಿಯತಾಂಕಗಳು ಮಾರುಕಟ್ಟೆ ಆಯ್ಕೆಗಳ ತುಲನೆಗೂ ಅನ್ವಯಿಸುತ್ತವೆ.`
                : `Selected Crop: ${selectedCrop} (${selectedDistrict} District) — these lot quantity and cost parameters are also shared across comparison options.`}</span>
            </div>
            <form id="calculator-form" onSubmit={calculate} noValidate>
        <div className="grid">
          <section className="form-section">
            <h2>{t('lot_details_title', language)}</h2>
            {field('q', t('q_helper', language), { min: '0', required: true })}
            {field('p', t('p_helper', language), { min: '0', required: true })}
            {field('l', t('l_helper', language), { min: '0', max: '100', required: true })}
            {field('d', t('d_helper', language), { min: '0' })}
          </section>
          <section className="form-section">
            <h2>{t('cost_details_title', language)}</h2>
            {field('ct', t('cost_helper', language), { min: '0' })}
            {field('ch', t('cost_helper', language), { min: '0' })}
            {field('cp', t('cost_helper', language), { min: '0' })}
            {field('cm', t('cost_helper', language), { min: '0' })}
            {field('co', t('cost_helper', language), { min: '0' })}
          </section>
        </div>
        <div className="button-row">
          <button className="calculate-button" type="submit" disabled={isCalculating || isComparing}>
            {isCalculating ? t('calculating_button', language) : t('calculate_button', language)}
          </button>
          <button className="reset-button" type="button" onClick={reset} disabled={isCalculating || isComparing}>
            {t('reset_button', language)}
          </button>
        </div>
            </form>
            {result && inputs && (
              <section className="result-box" aria-labelledby="calculator-result-title" aria-live="polite">
                <p className="result-kicker">{t('result_kicker', language)}</p>
                <h2 id="calculator-result-title">{t('net_proceeds_title', language)}</h2>
                <output aria-label={t('net_proceeds_title', language)}>
                  {rupees.format(result.net_proceeds)}
                </output>
                {isOffline && (
                  <p className="offline-explanation">
                    {language === 'kn'
                      ? 'ಆಫ್‌ಲೈನ್ ಲೆಕ್ಕಾಚಾರ — ಫಲಿತಾಂಶವು ಅಂದಾಜು ಮಾತ್ರ.'
                      : 'Calculated offline — this result is an estimate only.'}
                  </p>
                )}
                <div className="summary-grid">
                  <div>
                    <span>{t('gross_proceeds_label', language)}</span>
                    <strong>{rupees.format(result.gross)}</strong>
                  </div>
                  <div>
                    <span>{t('saleable_quantity_label', language)}</span>
                    <strong>{quantity.format(saleableQuantity)} kg</strong>
                  </div>
                  <div>
                    <span>{t('physical_loss_label', language)}</span>
                    <strong>{quantity.format(lostQuantity)} kg ({quantity.format(inputs.l * 100)}%)</strong>
                  </div>
                  <div>
                    <span>{t('quality_deduction_label', language)}</span>
                    <strong>{rupees.format(qualityDeduction)}</strong>
                  </div>
                  <div>
                    <span>{t('adjusted_sale_value_label', language)}</span>
                    <strong>{rupees.format(adjustedSaleValue)}</strong>
                  </div>
                  <div>
                    <span>{t('total_costs_label', language)}</span>
                    <strong>{rupees.format(totalCosts)}</strong>
                  </div>
                </div>
                <p className="calculation-note">{t('calc_note', language)}</p>
                <div className="cost-breakdown">
                  <h3>{t('cost_breakdown_title', language)}</h3>
                  <dl>
                    <div><dt>{labels.ct}</dt><dd>{rupees.format(inputs.ct)}</dd></div>
                    <div><dt>{labels.ch}</dt><dd>{rupees.format(inputs.ch)}</dd></div>
                    <div><dt>{labels.cp}</dt><dd>{rupees.format(inputs.cp)}</dd></div>
                    <div><dt>{labels.cm}</dt><dd>{rupees.format(inputs.cm)}</dd></div>
                    <div><dt>{labels.co}</dt><dd>{rupees.format(inputs.co)}</dd></div>
                  </dl>
                </div>
              </section>
            )}
          </div>
        </div>
      </article>

<article className={`ref-feature-card ${activeTab !== 'all' && activeTab !== 'card-decision' ? 'is-hidden' : ''}`} id="card-decision">
        <div className="ref-card-header">
          <div className="ref-card-badge-row">
            <span className="ref-card-num-circle">4</span>
            <div className="ref-card-icon-pill">📊</div>
          </div>
          <div className="ref-card-headings">
            <h2 className="ref-card-title-kn">ನಿರ್ಧಾರ ವಿಶ್ಲೇಷಣೆ & ಶಿಫಾರಸು</h2>
            <h3 className="ref-card-title-en">Decision Analysis & Recommendation</h3>
            <p className="ref-card-desc">
              {language === 'kn'
                ? 'ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ, ಬ್ರೇಕ್-ಈವನ್ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು AI-ಆಧಾರಿತ ಮಾರುಕಟ್ಟೆ ಶಿಫಾರಸು ನೋಡಿ.'
                : 'See estimated net proceeds, break-even analysis and AI recommendation.'}
            </p>
          </div>
        </div>

        <div className="ref-card-body-summary">
          <ul className="ref-feature-checklist">
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಒಟ್ಟು ಮಾರಾಟ & ನಿವ್ವಳ ಆದಾಯ' : 'Gross & net proceeds'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಬ್ರೇಕ್-ಈವನ್ ಸಾರಿಗೆ ವೆಚ್ಚ' : 'Break-even transport cost'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'AI ವಿಜೇತ ಆಯ್ಕೆಯ ಶಿಫಾರಸು' : 'AI winner recommendation'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಧ್ವನಿ ಓದುವಿಕೆ (ಕನ್ನಡ / English)' : 'Voice readout (Kannada / English)'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ವಾಟ್ಸಾಪ್ ಸಂದೇಶ ಹಂಚಿಕೆ' : 'WhatsApp sharing'}</span></li>
          </ul>
          <div className="ref-card-illustration-box">
            <DecisionIllustration />
          </div>
        </div>

        <div className="ref-card-actions-bar">
          <button
            type="button"
            className="ref-card-btn btn-primary"
            onClick={() => setActiveTab('card-decision')}
          >
            <span>{language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ ವೀಕ್ಷಿಸಿ' : 'View Analysis'}</span>
            <span className="btn-arrow">→</span>
          </button>
          {decision && (
            <RecommendationSpeakerButton
              language={language}
              district={selectedDistrict}
              crop={selectedCrop}
              decision={decision}
              options={options}
              comparisonResults={comparisonResults}
              comparisonBase={comparisonBase}
              transportScenarioCosts={transportScenarioCosts}
              observations={backendObservations}
            />
          )}
        </div>

        <div className="ref-card-interactive-drawer open">
          <div className="ref-card-drawer-inner">
            {decision ? (
            <section className="comparison-results" aria-live="polite">
            <h2>{t('comparison_results_title', language)}</h2>

            {/* Agro Mitra Recommendation Card */}
            <div className="agro-mitra-recommendation-card" role="region" aria-labelledby="agro-mitra-rec-heading">
              <div className="recommendation-header">
                <div className="recommendation-badge" id="agro-mitra-rec-heading">
                  🌾 {t('agro_mitra_recommendation_title', language)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <RecommendationSpeakerButton
                    language={language}
                    district={selectedDistrict}
                    crop={selectedCrop}
                    decision={decision}
                    options={options}
                    comparisonResults={comparisonResults}
                    comparisonBase={comparisonBase}
                    transportScenarioCosts={transportScenarioCosts}
                    observations={backendObservations}
                  />
                  <div className={`confidence-tag confidence-${decisionConfidence.level}`}>
                    {decisionConfidence.label}
                  </div>
                </div>
              </div>

              <div className="recommendation-body">
                {decision.status === 'winner' && decision.ranked?.length >= 2 && (
                  <div className="recommendation-verdict">
                    <p className="recommendation-main-text">
                      🏆 <strong>{decision.ranked[0].option.name}</strong>{' '}
                      {language === 'kn' ? 'ಮಾರುಕಟ್ಟೆಯು' : 'may provide approximately'}{' '}
                      <span className="diff-highlight">{rupees.format(decision.difference)}</span>{' '}
                      {language === 'kn'
                        ? `ಹೆಚ್ಚಿನ ನಿವ್ವಳ ಆದಾಯವನ್ನು ${decision.ranked[1].option.name} ಗಿಂತ ಒದಗಿಸಬಹುದು (ಎಲ್ಲ ಸಾರಿಗೆ, ಹ್ಯಾಂಡ್ಲಿಂಗ್ ಮತ್ತು ಕಡಿತಗಳ ನಂತರ).`
                        : `more than ${decision.ranked[1].option.name} after estimated expenses and deductions.`}
                    </p>
                    <div className="recommendation-breakdown-box">
                      <h4>{t('recommendation_reasons_title', language)}</h4>
                      <ul>
                        <li>
                          {language === 'kn'
                            ? `ಮಾರಾಟ ಬೆಲೆಯ ವ್ಯತ್ಯಾಸ: ${decision.ranked[0].option.name} (₹${decision.ranked[0].option.price}/kg) vs ${decision.ranked[1].option.name} (₹${decision.ranked[1].option.price}/kg)`
                            : `Selling price difference: ${decision.ranked[0].option.name} (₹${decision.ranked[0].option.price}/kg) vs ${decision.ranked[1].option.name} (₹${decision.ranked[1].option.price}/kg)`}
                        </li>
                        <li>
                          {language === 'kn'
                            ? `ಸಾರಿಗೆ ವೆಚ್ಚದ ವ್ಯತ್ಯಾಸ: ₹${Math.abs(Number(decision.ranked[0].option.transportQuote || 0) - Number(decision.ranked[1].option.transportQuote || 0))}`
                            : `Transportation cost difference: ₹${Math.abs(Number(decision.ranked[0].option.transportQuote || 0) - Number(decision.ranked[1].option.transportQuote || 0))}`}
                        </li>
                        <li>{t('reason_deductions', language)}</li>
                      </ul>
                    </div>
                  </div>
                )}

                {decision.status === 'close' && (
                  <div className="recommendation-caution-box">
                    <p className="caution-text">⚖️ {t('similar_returns_caution', language)}</p>
                    <p className="caution-sub">
                      {language === 'kn'
                        ? `ವ್ಯತ್ಯಾಸ ಕೇವಲ ${rupees.format(decision.difference)} (${decision.differencePercent?.toFixed(1)}%) ಆಗಿದೆ.`
                        : `Difference is only ${rupees.format(decision.difference)} (${decision.differencePercent?.toFixed(1)}%).`}
                    </p>
                  </div>
                )}

                {decision.status === 'all-negative' && (
                  <div className="recommendation-caution-box" style={{ borderColor: '#f87171', background: '#fef2f2' }}>
                    <p className="caution-text" style={{ color: '#991b1b' }}>⚠️ {t('all_loss_title', language)}</p>
                    <p className="caution-sub" style={{ color: '#b91c1c' }}>{t('all_loss_sub', language)}</p>
                  </div>
                )}

                {decision.status === 'incomplete' && (
                  <div className="recommendation-breakdown-box" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                    <h4 style={{ color: '#334155' }}>ℹ️ {t('incomplete_comparison_title', language)}</h4>
                    <p style={{ fontSize: '0.88rem', margin: '0 0 6px 0', color: '#475569' }}>{t('incomplete_comparison_msg', language)}</p>
                    <ul style={{ color: '#475569' }}>
                      {decision.issues?.map((issue, index) => (
                        <li key={`${index}-${issue}`}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <footer className="recommendation-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <small style={{ flex: 1, minWidth: '220px' }}>⚠️ {t('recommendation_disclaimer', language)}</small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      id="rec-share-whatsapp-btn"
                      className="reset-button"
                      onClick={() => {
                        const msg = generateWhatsAppMessage({
                          lang: language,
                          district: selectedDistrict,
                          crop: selectedCrop,
                          observations: backendObservations,
                          rankingMessage: marketRankingMessage,
                          result,
                          calcInputs: data,
                          options,
                          comparisonResults,
                          comparisonBase,
                          decision,
                        })
                        setWhatsAppPreviewText(msg)
                        setWhatsAppCopyFeedback('')
                        setWhatsAppPreviewOpen(true)
                      }}
                      style={{
                        background: '#25D366',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        padding: '0.55rem 1.1rem',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}
                    >
                      <span>💬</span> {t('share_whatsapp_button', language)}
                    </button>
                    {comparisonBase && (() => {
                      const smsText = generateSmsSummary(comparisonCommodity, comparisonBase.q, options, comparisonResults)
                      const smsHref = `sms:?&body=${encodeURIComponent(smsText)}`
                      return (
                        <a href={smsHref} className="reset-button" style={{ textDecoration: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 'bold', padding: '0.55rem 1.1rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                          📱 {t('send_sms_button', language)}
                        </a>
                      )
                    })()}
                  </div>
                </div>
              </footer>
            </div>
            {decision.status === 'winner' && (
              <div className="decision-message winner-message">
                <strong>{t('winner_title', language)}: {decision.ranked[0].option.name}</strong>
                <p>{t('winner_sub', language)}</p>
              </div>
            )}
            {decision.status === 'close' && (
              <div className="decision-message close-message">
                <strong>{t('close_title', language)}</strong>
                <p>{t('close_diff', language)}: {rupees.format(decision.difference)}{decision.differencePercent == null ? '' : ` (${decision.differencePercent.toFixed(2)}%)`}</p>
              </div>
            )}
            {decision.status === 'all-negative' && (
              <div className="decision-message loss-message">
                <strong>{t('all_loss_title', language)}</strong>
                <p>{t('all_loss_sub', language)}</p>
              </div>
            )}

            {/* Transport Sensitivity / Break-Even */}
            {decision.status !== 'incomplete' && comparisonResults && comparisonBase && (() => {
              const { scenarioResultsById, breakEvenCostsById } = calculateTransportSensitivity(
                options,
                comparisonResults,
                transportScenarioCosts,
              )
              const scenarioRanking = options
                .filter((option) => Number.isFinite(scenarioResultsById[option.id]))
                .map((option) => ({ option, net: scenarioResultsById[option.id] }))
                .sort((a, b) => b.net - a.net)
              const comparedOptions = options.filter((option) => Number.isFinite(comparisonResults[option.id]?.net_proceeds))
              const scenarioComplete = scenarioRanking.length === comparedOptions.length
              const scenarioWinner = scenarioComplete ? scenarioRanking[0] : null
              return (
                <section className="transport-sensitivity" aria-labelledby="transport-sensitivity-heading">
                  <h3 id="transport-sensitivity-heading">{t('transport_sensitivity_title', language)}</h3>
                  <p>{t('transport_sensitivity_intro', language)}</p>
                  {scenarioWinner && (
                    <p className="scenario-winner" role="status">
                      {scenarioWinner.net < 0
                        ? (language === 'kn' ? 'ಈ ಸನ್ನಿವೇಶದಲ್ಲೂ ಎಲ್ಲ ಆಯ್ಕೆಗಳ ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ ಋಣಾತ್ಮಕವಾಗಿದೆ.' : 'All options have negative returns in this scenario.')
                        : (language === 'kn' ? `ಈ ಸನ್ನಿವೇಶದಲ್ಲಿ ಅತಿ ಹೆಚ್ಚು ಅಂದಾಜು: ${scenarioWinner.option.name} — ${rupees.format(scenarioWinner.net)}` : `Highest estimate in this scenario: ${scenarioWinner.option.name} — ${rupees.format(scenarioWinner.net)}`)}
                    </p>
                  )}
                  <div className="transport-sensitivity-grid">
                    {options.filter((option) => Number.isFinite(comparisonResults[option.id]?.net_proceeds)).map((option) => {
                      const scenarioNet = scenarioResultsById[option.id]
                      const breakEvenCost = breakEvenCostsById[option.id]
                      const scenarioId = `${option.id}-transport-scenario`
                      return (
                        <div className="transport-sensitivity-card" key={option.id}>
                          <label htmlFor={scenarioId}>{option.name || (language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ' : 'Market')}</label>
                          <span className="input-helper">{language === 'kn' ? 'ಸನ್ನಿವೇಶದ ಒಟ್ಟು ಸಾರಿಗೆ ವೆಚ್ಚ' : 'What-if total freight cost'}</span>
                          <div className="currency-input">
                            <span aria-hidden="true">₹</span>
                            <input id={scenarioId} type="number" inputMode="decimal" min="0" step="any"
                              value={transportScenarioCosts[option.id] ?? option.transportQuote}
                              onChange={(event) => setTransportScenarioCosts((current) => ({ ...current, [option.id]: event.target.value }))} />
                          </div>
                          {Number.isFinite(scenarioNet) ? (
                            <p>{t('scenario_net_label', language)}: <strong>{rupees.format(scenarioNet)}</strong></p>
                          ) : (
                            <p className="field-error">{language === 'kn' ? 'ಸೊನ್ನೆ ಅಥವಾ ಧನಾತ್ಮಕ ಸಾರಿಗೆ ವೆಚ್ಚ ನಮೂದಿಸಿ.' : 'Enter a positive transport cost.'}</p>
                          )}
                          {Number.isFinite(breakEvenCost) && (
                            <p className="break-even-note">
                              {t('breakeven_label', language)}: <strong>{rupees.format(breakEvenCost)}</strong>. {t('breakeven_below_only', language)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })()}

            {/* Pooled Transport What-If */}
            {comparisonResults && comparisonBase && (() => {
              const myQuintals = Math.round(((comparisonBase.q / 100) + Number.EPSILON) * 100) / 100
              const eligibleOptions = options.filter((opt) => Number.isFinite(comparisonResults[opt.id]?.net_proceeds) && Number.isFinite(Number(opt.transportQuote)) && Number(opt.transportQuote) > 0)
              const smsText = generateSmsSummary(comparisonCommodity, comparisonBase.q, options, comparisonResults)
              const smsHref = `sms:?&body=${encodeURIComponent(smsText)}`

              return (
                <>
                  <section className="transport-sensitivity pooled-cost-section" aria-labelledby="pooled-cost-heading" style={{ marginTop: '1.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
                    <h3 id="pooled-cost-heading" style={{ color: '#166534' }}>{t('pooled_title', language)}</h3>
                    <p style={{ fontSize: '0.9rem', color: '#14532d' }}>{t('pooled_intro', language)}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                      <div>
                        <label htmlFor="pooled-farmers" style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem' }}>{t('pooled_farmers_label', language)}:</label>
                        <input id="pooled-farmers" type="number" min="1" step="1" value={pooledFarmers}
                          onChange={(e) => setPooledFarmers(e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem', borderRadius: '4px', border: '1px solid #86efac' }} />
                      </div>
                      <div>
                        <label htmlFor="pooled-quintals" style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem' }}>{t('pooled_quintals_label', language)}:</label>
                        <input id="pooled-quintals" type="number" min="1" step="any" value={pooledQuintals}
                          onChange={(e) => setPooledQuintals(e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem', borderRadius: '4px', border: '1px solid #86efac' }} />
                        <span style={{ fontSize: '0.75rem', color: '#166534' }}>{t('your_share_label', language)}: {myQuintals} {language === 'kn' ? 'ಕ್ವಿಂಟಾಲ್' : 'quintals'} ({comparisonBase.q} kg)</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                      {eligibleOptions.map((opt) => {
                        const pooled = calculatePooledTransport(opt.transportQuote, pooledQuintals, myQuintals)
                        if (!pooled) return null
                        const originalQuote = Number(opt.transportQuote)
                        const savings = Math.max(0, originalQuote - pooled.myShare)
                        return (
                          <div key={opt.id} style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                            <strong style={{ display: 'block', color: '#166534' }}>{opt.name}</strong>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                              <div>{t('cost_per_quintal_label', language)}: <strong>{rupees.format(pooled.costPerQuintal)}</strong></div>
                              <div>{t('your_pooled_cost_label', language)}: <strong>{rupees.format(pooled.myShare)}</strong> ({t('original_quote_label', language)}: {rupees.format(originalQuote)})</div>
                              {savings > 0 && <div style={{ color: '#15803d', fontWeight: 'bold' }}>{t('estimated_savings_label', language)}: {rupees.format(savings)}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <div style={{ margin: '1.25rem 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <button
                      type="button"
                      id="share-whatsapp-btn"
                      className="reset-button"
                      onClick={() => {
                        const msg = generateWhatsAppMessage({
                          lang: language,
                          district: selectedDistrict,
                          crop: selectedCrop,
                          observations: backendObservations,
                          rankingMessage: marketRankingMessage,
                          result,
                          calcInputs: data,
                          options,
                          comparisonResults,
                          comparisonBase,
                          decision,
                        })
                        setWhatsAppPreviewText(msg)
                        setWhatsAppCopyFeedback('')
                        setWhatsAppPreviewOpen(true)
                      }}
                      style={{
                        background: '#25D366',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        padding: '0.6rem 1.2rem',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}
                    >
                      <span>💬</span> {t('share_whatsapp_button', language)}
                    </button>
                    <a href={smsHref} className="reset-button" style={{ textDecoration: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 'bold', padding: '0.6rem 1.2rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      📱 {t('send_sms_button', language)}
                    </a>
                  </div>
                </>
              )
            })()}

            <div className="comparison-cards">
              {options.map((option) => {
                const calculated = comparisonResults?.[option.id]
                const status = statusLabels[option.confirmation] ?? statusLabels.unconfirmed
                const optionPrice = Number(option.price)
                const optionEffectivePrice = Math.max(0, optionPrice - (comparisonBase?.d ?? 0))
                const optionQualityDeduction = comparisonBase ? comparisonBase.q * (1 - comparisonBase.l) * (optionPrice - optionEffectivePrice) : null
                const optionCosts = comparisonBase ? Number(option.transportQuote || 0) + comparisonBase.ch + comparisonBase.cp + comparisonBase.cm + comparisonBase.co : null
                return (
                  <article className={`comparison-card${option.id === decisionWinnerId ? ' winner-card' : ''}${decisionCloseIds.includes(option.id) ? ' close-card' : ''}`} key={option.id}>
                    <div className="comparison-card-heading">
                      <h3>{option.name || (language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ' : 'Market')}</h3>
                      {option.id === decisionWinnerId && <span className="winner-tag">{language === 'kn' ? 'ಅತ್ಯಧಿಕ ಅಂದಾಜು' : 'Highest estimate'}</span>}
                    </div>
                    <p className="buyer-status">{status}</p>
                    <dl>
                      <div><dt>{t('p_label', language)}</dt><dd>{formatOrMissing(option.price, (value) => rupees.format(Number(value)) + ' / kg')}</dd></div>
                      <div><dt>{t('observation_date_label', language)}</dt><dd>{formatOrMissing(option.priceDate)}</dd></div>
                      <div><dt>{t('source_label', language)}</dt><dd>{formatOrMissing(option.source)}</dd></div>
                      <div><dt>{t('distance_label', language)}</dt><dd>{formatOrMissing(option.distance, (value) => `${value} km`)}</dd></div>
                      <div><dt>{t('transport_quote_label', language)}</dt><dd>{formatOrMissing(option.transportQuote, (value) => rupees.format(Number(value)))}</dd></div>
                      <div><dt>{t('quality_req_label', language)}</dt><dd>{formatOrMissing(option.qualityRequirements)}</dd></div>
                      <div><dt>{t('payment_terms_label', language)}</dt><dd>{paymentLabels[option.paymentCategory] ?? (language === 'kn' ? 'ಮಾಹಿತಿ ನೀಡಿಲ್ಲ' : 'Not provided')}{option.paymentTerms ? ` — ${option.paymentTerms}` : ''}</dd></div>
                    </dl>
                    {calculated && comparisonBase ? (
                      <>
                        <div className="option-net">
                          <span>{t('net_proceeds_title', language)}</span>
                          <strong>{rupees.format(calculated.net_proceeds)}</strong>
                        </div>
                        <dl className="calculation-breakdown">
                          <div><dt>{t('saleable_quantity_label', language)}</dt><dd>{quantity.format(comparisonBase.q * (1 - comparisonBase.l))} kg</dd></div>
                          <div><dt>{t('gross_proceeds_label', language)}</dt><dd>{rupees.format(calculated.gross)}</dd></div>
                          <div><dt>{t('quality_deduction_label', language)}</dt><dd>{rupees.format(optionQualityDeduction)}</dd></div>
                          <div><dt>{t('total_costs_label', language)}</dt><dd>{rupees.format(optionCosts)}</dd></div>
                        </dl>
                      </>
                    ) : null}
                  </article>
                )
              })}
            </div>
        </section>
          ) : (
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#64776d' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 600, color: '#143f35' }}>
                {language === 'kn' ? 'ಯಾವುದೇ ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ ಡೇಟಾ ಇಲ್ಲ' : 'No Comparison Data Available Yet'}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {language === 'kn'
                  ? 'ಮಾರುಕಟ್ಟೆಗಳನ್ನು ಹೋಲಿಸಲು ಕಾರ್ಡ್ 2 ರಲ್ಲಿ "ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ ಮಾಡಿ" ಕ್ಲಿಕ್ ಮಾಡಿ.'
                  : 'Click "Compare Markets" in Card 2 to generate estimated net proceeds and recommendations.'}
              </p>
            </div>
          )}
      </div>
    </div>
  </article>

<article className={`ref-feature-card ${activeTab !== 'all' && activeTab !== 'card-analytics' ? 'is-hidden' : ''}`} id="card-analytics">
        <div className="ref-card-header">
          <div className="ref-card-badge-row">
            <span className="ref-card-num-circle">5</span>
            <div className="ref-card-icon-pill">📈</div>
          </div>
          <div className="ref-card-headings">
            <h2 className="ref-card-title-kn">ಮಾರುಕಟ್ಟೆ ಐತಿಹಾಸಿಕ ವಿಶ್ಲೇಷಣೆ</h2>
            <h3 className="ref-card-title-en">Market Historical Analytics</h3>
            <p className="ref-card-desc">
              {language === 'kn'
                ? 'ನೈಜ ಐತಿಹಾಸಿಕ ದಾಖಲೆಗಳೊಂದಿಗೆ ಬೆಲೆ ಪ್ರವೃತ್ತಿ, ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ ಮತ್ತು ದೈನಂದಿನ ಆವಕ ಪರಿಶೀಲಿಸಿ.'
                : 'View price trends, market comparison and daily arrivals using verified records.'}
            </p>
          </div>
        </div>

        <div className="ref-card-body-summary">
          <ul className="ref-feature-checklist">
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? '7-ದಿನಗಳ ಬೆಲೆ ಪ್ರವೃತ್ತಿ' : '7-day price trend'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? '30-ದಿನಗಳ ಬೆಲೆ ಪ್ರವೃತ್ತಿ' : '30-day price trend'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಮಾರುಕಟ್ಟೆಗಳ ಐತಿಹಾಸಿಕ ಹೋಲಿಕೆ' : 'Market comparison'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ದೈನಂದಿನ ಆವಕ ಪ್ರಮಾಣ' : 'Arrival quantity (ಮಾರುಕಟ್ಟೆ ಆವಕ)'}</span></li>
          </ul>
          <div className="ref-card-illustration-box">
            <AnalyticsIllustration />
          </div>
        </div>

        <div className="ref-card-actions-bar">
          <button
            type="button"
            className="ref-card-btn btn-primary"
            onClick={() => setActiveTab('card-analytics')}
          >
            <span>{language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ ವೀಕ್ಷಿಸಿ' : 'View Analytics'}</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>

        <div className="ref-card-interactive-drawer open">
          <div className="ref-card-drawer-inner">
            <HistoricalAnalytics
        selectedDistrict={selectedDistrict}
        selectedCrop={selectedCrop}
        selectedMarket={backendMarkets.length > 0 ? backendMarkets[0].name : ''}
        availableMarkets={backendMarkets}
        language={language}
            />
          </div>
        </div>
      </article>

<article className={`ref-feature-card ${activeTab !== 'all' && activeTab !== 'card-saved-obs' ? 'is-hidden' : ''}`} id="card-saved-obs">
        <div className="ref-card-header">
          <div className="ref-card-badge-row">
            <span className="ref-card-num-circle">6</span>
            <div className="ref-card-icon-pill">💾</div>
          </div>
          <div className="ref-card-headings">
            <h2 className="ref-card-title-kn">ಉಳಿಸಿದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು</h2>
            <h3 className="ref-card-title-en">Saved Market Observations</h3>
            <p className="ref-card-desc">
              {language === 'kn'
                ? 'ನಿಮ್ಮ ಸ್ವಂತ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಮತ್ತು ಟಿಪ್ಪಣಿಗಳನ್ನು ಸ್ಥಳೀಯವಾಗಿ ಸಂಗ್ರಹಿಸಿ ನಿರ್ವಹಿಸಿ.'
                : 'View and manage your saved market prices and notes (stored locally).'}
            </p>
          </div>
        </div>

        <div className="ref-card-body-summary">
          <ul className="ref-feature-checklist">
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಉಳಿಸಿದ ದಾಖಲೆಗಳ ವೀಕ್ಷಣೆ' : 'View saved records'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ದಾಖಲೆ ತಿದ್ದುಪಡಿ ಅಥವಾ ಅಳಿಸುವಿಕೆ' : 'Edit or delete'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಗ್ರಾಹಕೀಯ ಘಟಕಗಳು & ಟಿಪ್ಪಣಿ' : 'Custom units & notes'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಆಫ್‌ಲೈನ್ ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆ' : 'Offline storage'}</span></li>
          </ul>
          <div className="ref-card-illustration-box">
            <SavedObsIllustration />
          </div>
        </div>

        <div className="ref-card-actions-bar">
          <button
            type="button"
            className="ref-card-btn btn-primary"
            onClick={() => setActiveTab('card-saved-obs')}
          >
            <span>{language === 'kn' ? 'ಉಳಿಸಿದ ಬೆಲೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ' : 'View Saved Data'}</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>

        <div className="ref-card-interactive-drawer open">
          <div className="ref-card-drawer-inner">
            <section className="local-data-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{language === 'kn' ? 'ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆ' : 'Local Storage'}</p>
            <h2>{language === 'kn' ? 'ಉಳಿಸಿದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು' : 'Saved Market Observations'}</h2>
          </div>
          <span className="option-count">{observations.length}</span>
        </div>
        <form className="observation-form" onSubmit={saveObservation} noValidate>
          <div className="option-fields">
            {[
              ['market', t('market_label', language), 'text'],
              ['commodity', t('commodity_label', language), 'text'],
              ['price', t('p_label', language), 'number'],
              ['date', t('observation_date_label', language), 'date'],
              ['source', t('source_label', language), 'text'],
            ].map(([key, label, type]) => (
              <div className="input-group" key={key}>
                <label htmlFor={`observation-${key}`}>{label}</label>
                <input id={`observation-${key}`} type={type} inputMode={type === 'number' ? 'decimal' : undefined}
                  step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined}
                  value={observationDraft[key]} aria-invalid={Boolean(observationErrors[key])}
                  className={observationErrors[key] ? 'has-error' : ''}
                  aria-describedby={observationErrors[key] ? `observation-${key}-error` : undefined}
                  onChange={(event) => setObservationDraft((current) => ({ ...current, [key]: event.target.value }))} />
                {observationErrors[key] && <p className="field-error" id={`observation-${key}-error`} role="alert">{observationErrors[key]}</p>}
              </div>
            ))}
            <div className="input-group">
              <label htmlFor="observation-unit">{language === 'kn' ? 'ಬೆಲೆ ಘಟಕ' : 'Price Unit'}</label>
              <select id="observation-unit" value={observationDraft.unit} aria-invalid={Boolean(observationErrors.unit)}
                className={observationErrors.unit ? 'has-error' : ''}
                onChange={(event) => setObservationDraft((current) => ({ ...current, unit: event.target.value }))}>
                <option value="">{language === 'kn' ? 'ಆಯ್ಕೆಮಾಡಿ' : 'Select'}</option>
                {Object.entries(observationUnits).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="button-row">
            <button type="submit" className="calculate-button">
              {editingObservationId ? (language === 'kn' ? 'ಬದಲಾವಣೆ ಉಳಿಸಿ' : 'Save Changes') : (language === 'kn' ? 'ಸ್ಥಳೀಯವಾಗಿ ಉಳಿಸಿ' : 'Save Locally')}
            </button>
            {editingObservationId && (
              <button type="button" className="reset-button" onClick={startObservationEditReset}>
                {language === 'kn' ? 'ರದ್ದುಮಾಡಿ' : 'Cancel'}
              </button>
            )}
          </div>
        </form>

        {observations.length > 0 && (
          <div className="observation-list">
            {observations.map((obs) => {
              const ageHours = (sessionTime.getTime() - Date.parse(`${obs.date}T00:00:00Z`)) / 3_600_000
              const stale = ageHours > OBSERVATION_FRESHNESS_HOURS
              return (
                <article className={`observation-card${stale ? ' stale-observation' : ''}`} key={obs.id}>
                  <div className="observation-heading">
                    <h3>{obs.market} · {obs.commodity}</h3>
                    <strong>{rupees.format(obs.price)} / {obs.unit}</strong>
                  </div>
                  <p className="observation-date">{t('observation_date_label', language)}: {dateFormat.format(new Date(`${obs.date}T00:00:00Z`))}</p>
                  <p>{t('source_label', language)}: {obs.source}</p>
                  <div className="option-actions">
                    <button type="button" className="reset-button" onClick={() => editObservation(obs)}>{language === 'kn' ? 'ತಿದ್ದುಪಡಿ' : 'Edit'}</button>
                    <button type="button" className="reset-button" onClick={() => removeObservation(obs.id)}>{t('delete_button', language)}</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  </div>
</article>

<article className={`ref-feature-card wide-card ${activeTab !== 'all' && activeTab !== 'card-recent-calcs' ? 'is-hidden' : ''}`} id="card-recent-calcs">
        <div className="ref-card-header">
          <div className="ref-card-badge-row">
            <span className="ref-card-num-circle">7</span>
            <div className="ref-card-icon-pill">🕒</div>
          </div>
          <div className="ref-card-headings">
            <h2 className="ref-card-title-kn">ಇತ್ತೀಚಿನ ಲೆಕ್ಕಾಚಾರಗಳು</h2>
            <h3 className="ref-card-title-en">Recent Calculations History</h3>
            <p className="ref-card-desc">
              {language === 'kn'
                ? 'ನಿಮ್ಮ ಹಿಂದಿನ ಲೆಕ್ಕಾಚಾರಗಳನ್ನು ಪ್ರವೇಶಿಸಿ ಮತ್ತು ಇನ್‌ಪುಟ್‌ಗಳನ್ನು ಮರುಬಳಸಿ.'
                : 'Access your previous calculations and reuse inputs.'}
            </p>
          </div>
        </div>

        <div className="ref-card-body-summary">
          <ul className="ref-feature-checklist">
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಹಿಂದಿನ ಲೆಕ್ಕಾಚಾರಗಳ ಸಂಗ್ರಹ (50 ರವರೆಗೆ)' : 'View past calculations (up to 50)'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಒಟ್ಟು ಮತ್ತು ನಿವ್ವಳ ಆದಾಯ ಪರಿಶೀಲನೆ' : 'Check gross & net returns'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಮಾಹಿತಿ ಮರುಬಳಕೆ' : 'Reuse inputs'}</span></li>
            <li className="ref-checklist-item"><span className="ref-check-icon">✔</span><span>{language === 'kn' ? 'ಇತಿಹಾಸ ತೆರವಿನ ಆಯ್ಕೆ' : 'Clear history'}</span></li>
          </ul>
          <div className="ref-card-illustration-box">
            <HistoryIllustration />
          </div>
        </div>

        <div className="ref-card-actions-bar">
          <button
            type="button"
            className="ref-card-btn btn-primary"
            onClick={() => setActiveTab('card-recent-calcs')}
          >
            <span>{language === 'kn' ? 'ಇತಿಹಾಸ ವೀಕ್ಷಿಸಿ' : 'View History'}</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>

        <div className="ref-card-interactive-drawer open">
          <div className="ref-card-drawer-inner">
            <section className="local-data-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{language === 'kn' ? 'ಸ್ಥಳೀಯ ಇತಿಹಾಸ' : 'Saved Calculations'}</p>
            <h2>{t('recent_calc_title', language)}</h2>
          </div>
          <span className="option-count">{calculations.length} / {MAX_CALCULATIONS}</span>
        </div>
        {calculations.length === 0 ? (
          <p className="empty-state">{t('no_saved_calcs', language)}</p>
        ) : (
          <div className="history-list">
            {calculations.map((calculation) => (
              <article className="history-card" key={calculation.id}>
                <div>
                  <h3>{rupees.format(calculation.result.net_proceeds)}</h3>
                  {calculation.comparison && <p><strong>{language === 'kn' ? 'ಆಯ್ಕೆ' : 'Option'}: {calculation.comparison.optionName}</strong></p>}
                  <p>{timeFormat.format(new Date(calculation.timestamp))} · {calculation.inputs.q} kg × {rupees.format(calculation.inputs.p)}/kg</p>
                  <span className={calculation.mode === 'offline' ? 'history-mode offline-mode' : 'history-mode'}>
                    {calculation.mode === 'offline' ? (language === 'kn' ? 'ಸ್ಥಳೀಯ ಲೆಕ್ಕಾಚಾರ' : 'Offline calculation') : (language === 'kn' ? 'ಆನ್‌ಲೈನ್ ಲೆಕ್ಕಾಚಾರ' : 'Online API calculation')}
                  </span>
                </div>
                <div className="history-actions">
                  <button type="button" className="reset-button" onClick={() => viewCalculation(calculation)}>{t('view_details_button', language)}</button>
                  <button type="button" className="reset-button" onClick={() => reuseCalculation(calculation)}>{t('reuse_inputs_button', language)}</button>
                  <button type="button" className="reset-button" onClick={() => removeCalculation(calculation.id)}>{t('delete_button', language)}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  </div>
</article>
</div>

      {/* WhatsApp Message Share Preview Modal */}
      {whatsAppPreviewOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="whatsapp-preview-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <h3 id="whatsapp-preview-title" style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>💬</span> {t('whatsapp_preview_title', language)}
              </h3>
              <button
                type="button"
                onClick={() => setWhatsAppPreviewOpen(false)}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </header>
            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
              <textarea
                readOnly
                value={whatsAppPreviewText}
                rows={14}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  lineHeight: 1.45,
                  resize: 'vertical',
                  background: '#f8fafc',
                  color: '#1e293b',
                  boxSizing: 'border-box',
                }}
              />
              {whatsAppCopyFeedback && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.85rem',
                    color: whatsAppCopyFeedback.includes('✓') ? '#16a34a' : '#dc2626',
                    fontWeight: 'bold',
                  }}
                >
                  {whatsAppCopyFeedback}
                </div>
              )}
            </div>
            <footer
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="reset-button"
                onClick={async () => {
                  try {
                    await copyToClipboard(whatsAppPreviewText)
                    setWhatsAppCopyFeedback(t('copy_success', language))
                  } catch {
                    setWhatsAppCopyFeedback(t('copy_failed', language))
                  }
                }}
                style={{ padding: '0.5rem 1rem' }}
              >
                📋 {t('copy_message_button', language)}
              </button>
              <a
                href={buildWhatsAppUrl(whatsAppPreviewText)}
                target="_blank"
                rel="noopener noreferrer"
                className="calculate-button"
                style={{
                  textDecoration: 'none',
                  background: '#25D366',
                  color: '#ffffff',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                🚀 {t('whatsapp_preview_send', language)}
              </a>
              <button
                type="button"
                className="reset-button"
                onClick={() => setWhatsAppPreviewOpen(false)}
                style={{ padding: '0.5rem 1rem' }}
              >
                {t('whatsapp_preview_close', language)}
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  )
}
