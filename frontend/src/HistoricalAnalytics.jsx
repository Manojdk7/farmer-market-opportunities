import React, { useState, useEffect, useId } from 'react'
import { t, getLocalizedCropName, getLocalizedMarketName, getLocalizedDistrictName } from './translations'

export function HistoricalAnalytics({
  selectedDistrict,
  selectedCrop,
  selectedMarket,
  availableMarkets = [],
  language = 'kn',
  apiBaseUrl = '',
}) {
  const [periodDays, setPeriodDays] = useState(7)
  const [trendData, setTrendData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Arrivals data state
  const [arrivalData, setArrivalData] = useState(null)
  const [arrivalLoading, setArrivalLoading] = useState(false)

  // Market comparison state
  const [selectedComparisonMarkets, setSelectedComparisonMarkets] = useState([])
  const [comparisonData, setComparisonData] = useState(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)

  // Interactive tooltip state for chart
  const [activeTooltip, setActiveTooltip] = useState(null)

  const activeMarketName = selectedMarket || (availableMarkets.length > 0 ? availableMarkets[0].name : '')

  // Fetch price trend for the active market
  useEffect(() => {
    if (!activeMarketName) {
      setTrendData(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      district: selectedDistrict || 'Davanagere',
      crop: selectedCrop || 'Maize',
      market: activeMarketName,
      days: String(periodDays),
    })

    fetch(`${apiBaseUrl}/api/analytics/price-trend?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setTrendData(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedDistrict, selectedCrop, activeMarketName, periodDays, apiBaseUrl])

  // Fetch arrival tracking for the active market
  useEffect(() => {
    if (!activeMarketName) {
      setArrivalData(null)
      return
    }

    let isMounted = true
    setArrivalLoading(true)

    const params = new URLSearchParams({
      district: selectedDistrict || 'Davanagere',
      crop: selectedCrop || 'Maize',
      market: activeMarketName,
    })

    fetch(`${apiBaseUrl}/api/analytics/arrivals?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setArrivalData(data)
          setArrivalLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setArrivalData(null)
          setArrivalLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedDistrict, selectedCrop, activeMarketName, apiBaseUrl])

  // Fetch market comparison when additional markets are selected
  useEffect(() => {
    if (selectedComparisonMarkets.length === 0 || !activeMarketName) {
      setComparisonData(null)
      return
    }

    let isMounted = true
    setComparisonLoading(true)

    const allMarketsToCompare = [activeMarketName, ...selectedComparisonMarkets.filter((m) => m !== activeMarketName)]
    const params = new URLSearchParams({
      district: selectedDistrict || 'Davanagere',
      crop: selectedCrop || 'Maize',
      markets: allMarketsToCompare.join(','),
      days: String(periodDays),
    })

    fetch(`${apiBaseUrl}/api/analytics/market-comparison?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setComparisonData(data)
          setComparisonLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setComparisonData(null)
          setComparisonLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedDistrict, selectedCrop, activeMarketName, selectedComparisonMarkets, periodDays, apiBaseUrl])

  const toggleComparisonMarket = (mName) => {
    setSelectedComparisonMarkets((prev) => {
      if (prev.includes(mName)) {
        return prev.filter((m) => m !== mName)
      } else {
        return [...prev, mName]
      }
    })
  }

  const renderTrendBadge = (trend) => {
    switch (trend) {
      case 'RISING':
        return <span className="trend-badge trend-rising">▲ {t('trend_rising', language)}</span>
      case 'FALLING':
        return <span className="trend-badge trend-falling">▼ {t('trend_falling', language)}</span>
      case 'STABLE':
        return <span className="trend-badge trend-stable">■ {t('trend_stable', language)}</span>
      default:
        return <span className="trend-badge trend-insufficient">○ {t('trend_insufficient', language)}</span>
    }
  }

  // Render SVG Chart for single market or comparison
  const renderSvgChart = () => {
    if (!trendData || !trendData.observations || trendData.observations.length === 0) {
      return (
        <div className="chart-empty-state">
          <p>{t('no_observations_matched', language)}</p>
        </div>
      )
    }

    const obs = trendData.observations
    const width = 640
    const height = 240
    const padding = { top: 25, right: 35, bottom: 45, left: 60 }

    const prices = obs.map((o) => o.modal_price)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    const pSpan = maxP === minP ? (minP > 0 ? minP * 0.2 : 100) : maxP - minP
    const yMin = Math.max(0, minP - pSpan * 0.15)
    const yMax = maxP + pSpan * 0.15

    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    const getX = (idx) => {
      if (obs.length === 1) return padding.left + plotWidth / 2
      return padding.left + (idx / (obs.length - 1)) * plotWidth
    }

    const getY = (val) => {
      if (yMax === yMin) return padding.top + plotHeight / 2
      return padding.top + plotHeight - ((val - yMin) / (yMax - yMin)) * plotHeight
    }

    // Main line path
    const points = obs.map((o, idx) => `${getX(idx)},${getY(o.modal_price)}`)
    const linePath = `M ${points.join(' L ')}`

    // Area fill path
    const areaPath = `M ${points[0]} L ${points.join(' L ')} L ${getX(obs.length - 1)},${padding.top + plotHeight} L ${getX(0)},${padding.top + plotHeight} Z`

    return (
      <div className="svg-chart-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="responsive-svg-chart"
          role="img"
          aria-label={t('analytics_section_title', language)}
        >
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const yVal = yMin + (yMax - yMin) * pct
            const yCoord = getY(yVal)
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={yCoord}
                  x2={width - padding.right}
                  y2={yCoord}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={yCoord + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748b"
                >
                  ₹{Math.round(yVal)}
                </text>
              </g>
            )
          })}

          {/* Area under curve */}
          <path d={areaPath} fill="rgba(45, 106, 79, 0.08)" />

          {/* Price Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#1b4332"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {obs.map((o, idx) => {
            const cx = getX(idx)
            const cy = getY(o.modal_price)
            const isHovered = activeTooltip && activeTooltip.index === idx

            return (
              <g
                key={idx}
                className="chart-data-node"
                onMouseEnter={() => setActiveTooltip({ index: idx, ...o, cx, cy })}
                onClick={() => setActiveTooltip({ index: idx, ...o, cx, cy })}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? '#2d6a4f' : '#ffffff'}
                  stroke="#1b4332"
                  strokeWidth={isHovered ? 2.5 : 2}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                />
                {/* Reporting Date tick on X-axis */}
                <text
                  x={cx}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#475569"
                >
                  {o.reporting_date.slice(5)}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Tooltip Overlay */}
        {activeTooltip && (
          <div
            className="chart-tooltip-bubble"
            style={{
              position: 'absolute',
              left: `${(activeTooltip.cx / width) * 100}%`,
              top: `${(activeTooltip.cy / height) * 100}%`,
              transform: 'translate(-50%, -125%)',
            }}
          >
            <div className="tooltip-date">{activeTooltip.reporting_date}</div>
            <div className="tooltip-price">
              ₹{activeTooltip.modal_price.toLocaleString('en-IN')}{' '}
              <span className="tooltip-unit">/ {trendData.unit || 'qtl'}</span>
            </div>
            {activeTooltip.source && <div className="tooltip-source">{activeTooltip.source}</div>}
          </div>
        )}
      </div>
    )
  }

  // Arrival Baselines & Status
  const renderArrivalTrackingCard = () => {
    if (arrivalLoading) {
      return (
        <div className="arrival-analytics-card loading">
          <p>{t('loading_market_data', language)}</p>
        </div>
      )
    }

    if (!arrivalData || !arrivalData.available) {
      return (
        <div className="arrival-analytics-card unavailable">
          <div className="arrival-header">
            <h4>{t('arrivals_card_title', language)}</h4>
            <span className="arrival-unavailable-badge">{t('arrival_unavailable', language)}</span>
          </div>
          <p className="arrival-note">
            {t('arrival_disclaimer', language)}
          </p>
        </div>
      )
    }

    const baseline = arrivalData.historical_baseline || {}
    let baselineBadge = null
    if (baseline.classification === 'HIGH') {
      baselineBadge = <span className="arrival-badge high">▲ {t('arrival_high', language)}</span>
    } else if (baseline.classification === 'LOW') {
      baselineBadge = <span className="arrival-badge low">▼ {t('arrival_low', language)}</span>
    } else if (baseline.classification === 'NORMAL') {
      baselineBadge = <span className="arrival-badge normal">■ {t('arrival_normal', language)}</span>
    } else {
      baselineBadge = <span className="arrival-badge insufficient">{t('arrival_insufficient_history', language)}</span>
    }

    return (
      <div className="arrival-analytics-card">
        <div className="arrival-header">
          <div>
            <h4>{t('arrivals_card_title', language)}</h4>
            <span className="arrival-market-name">{getLocalizedMarketName(activeMarketName, language)}</span>
          </div>
          {baselineBadge}
        </div>

        <div className="arrival-metrics-grid">
          <div className="arrival-metric-box">
            <span className="metric-title">{t('latest_arrival_quantity', language)}</span>
            <span className="metric-val">
              {arrivalData.arrival_quantity} {arrivalData.arrival_unit || 'tonnes'}
            </span>
            <span className="metric-sub">{arrivalData.reporting_date}</span>
          </div>

          {arrivalData.previous_arrival_quantity !== null && (
            <div className="arrival-metric-box">
              <span className="metric-title">{t('previous_arrival_quantity', language)}</span>
              <span className="metric-val">
                {arrivalData.previous_arrival_quantity} {arrivalData.arrival_unit || 'tonnes'}
              </span>
              <span className="metric-sub">{arrivalData.previous_reporting_date}</span>
            </div>
          )}

          {arrivalData.arrival_change !== null && (
            <div className="arrival-metric-box">
              <span className="metric-title">{t('arrival_change', language)}</span>
              <span className={`metric-val ${arrivalData.arrival_change >= 0 ? 'pos' : 'neg'}`}>
                {arrivalData.arrival_change >= 0 ? `+${arrivalData.arrival_change}` : arrivalData.arrival_change}{' '}
                {arrivalData.arrival_unit || 'tonnes'}
                {arrivalData.arrival_percentage_change !== null && (
                  <span className="pct-sub"> ({arrivalData.arrival_percentage_change > 0 ? `+${arrivalData.arrival_percentage_change}` : arrivalData.arrival_percentage_change}%)</span>
                )}
              </span>
            </div>
          )}
        </div>

        {baseline.available && (
          <div className="baseline-details-row">
            <span>
              {t('arrival_baseline_title', language)}: <strong>{baseline.median_quantity} {arrivalData.arrival_unit}</strong> ({baseline.sample_count} {language === 'kn' ? 'ವರದಿ ದಿನಗಳು' : 'reporting days'})
            </span>
          </div>
        )}

        <p className="arrival-disclaimer-text">
          ℹ️ {t('arrival_disclaimer', language)}
        </p>
      </div>
    )
  }

  // Filter comparable markets (same district, active market excluded)
  const otherMarkets = availableMarkets.filter((m) => m.name !== activeMarketName)

  return (
    <section className="historical-analytics-section" aria-labelledby="historical-analytics-title">
      <div className="analytics-header-row">
        <div>
          <h3 id="historical-analytics-title" className="analytics-main-title">
            {t('analytics_section_title', language)}
          </h3>
          <p className="analytics-subtitle">
            {getLocalizedMarketName(activeMarketName, language)} — {getLocalizedCropName(selectedCrop, language)} ({getLocalizedDistrictName(selectedDistrict, language)})
          </p>
        </div>

        {/* 7 Days / 30 Days Period Toggle Switch */}
        <div className="period-toggle-group" role="group" aria-label="Historical Period Selector">
          <button
            type="button"
            className={`period-btn ${periodDays === 7 ? 'active' : ''}`}
            onClick={() => setPeriodDays(7)}
          >
            {t('period_7_days', language)}
          </button>
          <button
            type="button"
            className={`period-btn ${periodDays === 30 ? 'active' : ''}`}
            onClick={() => setPeriodDays(30)}
          >
            {t('period_30_days', language)}
          </button>
        </div>
      </div>

      {loading && (
        <div className="analytics-loading-box">
          <p>{t('loading_market_data', language)}</p>
        </div>
      )}

      {error && (
        <div className="analytics-error-box">
          <p>⚠️ {error}</p>
        </div>
      )}

      {!loading && !error && trendData && (
        <>
          {/* Key Summary Metric Cards */}
          <div className="analytics-summary-cards">
            <div className="analytics-card">
              <span className="card-lbl">{t('trend_label', language)}</span>
              <div className="card-val">{renderTrendBadge(trendData.trend)}</div>
              <span className="card-sub">
                {t('reporting_days_count', language, { count: trendData.available_reporting_days })}
              </span>
            </div>

            <div className="analytics-card">
              <span className="card-lbl">{t('first_price_label', language)}</span>
              <span className="card-val">
                {trendData.first_price ? `₹${trendData.first_price.toLocaleString('en-IN')}` : '—'}
              </span>
              <span className="card-sub">{trendData.first_reporting_date || '—'}</span>
            </div>

            <div className="analytics-card">
              <span className="card-lbl">{t('latest_price_label', language)}</span>
              <span className="card-val">
                {trendData.latest_price ? `₹${trendData.latest_price.toLocaleString('en-IN')}` : '—'}
              </span>
              <span className="card-sub">{trendData.latest_reporting_date || '—'}</span>
            </div>

            <div className="analytics-card">
              <span className="card-lbl">{t('price_change_label', language)}</span>
              <span className={`card-val ${trendData.absolute_change > 0 ? 'pos' : trendData.absolute_change < 0 ? 'neg' : ''}`}>
                {trendData.absolute_change !== null
                  ? `${trendData.absolute_change > 0 ? '+' : ''}₹${trendData.absolute_change}`
                  : '—'}
                {trendData.percentage_change !== null && (
                  <span className="card-pct"> ({trendData.percentage_change > 0 ? '+' : ''}{trendData.percentage_change}%)</span>
                )}
              </span>
              <span className="card-sub">{trendData.unit || 'INR/quintal'}</span>
            </div>
          </div>

          {/* 30-Day Additional Statistics (Phase 4) */}
          {periodDays === 30 && trendData.min_price !== null && (
            <div className="analytics-30day-stats-box">
              <h4>{t('stats_30_days_title', language)}</h4>
              <div className="stats-30day-grid">
                <div className="stat-pill">
                  <span>{t('min_modal_price', language)}:</span>
                  <strong>₹{trendData.min_price.toLocaleString('en-IN')}</strong>
                </div>
                <div className="stat-pill">
                  <span>{t('max_modal_price', language)}:</span>
                  <strong>₹{trendData.max_price.toLocaleString('en-IN')}</strong>
                </div>
                <div className="stat-pill">
                  <span>{t('avg_modal_price', language)}:</span>
                  <strong>₹{trendData.average_price.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Trend Chart */}
          <div className="chart-outer-card">
            <div className="chart-header">
              <span className="chart-title">
                {periodDays === 7 ? '7-Day Price Curve' : '30-Day Price Curve'} ({trendData.unit || 'INR/quintal'})
              </span>
              <span className="chart-hint">
                {trendData.available_reporting_days < periodDays && (
                  <em>⚠️ {t('missing_reporting_days_note', language)}</em>
                )}
              </span>
            </div>
            {renderSvgChart()}
          </div>

          {/* Multi-Market Comparison Section (Phase 4) */}
          {otherMarkets.length > 0 && (
            <div className="market-comparison-card">
              <div className="comparison-header">
                <h4>{t('market_comparison_title', language)}</h4>
                <p className="comp-sub">{t('market_comparison_subtitle', language)}</p>
              </div>

              <div className="comparison-market-pills">
                {otherMarkets.map((m) => {
                  const isSelected = selectedComparisonMarkets.includes(m.name)
                  return (
                    <button
                      key={m.name}
                      type="button"
                      className={`comp-market-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleComparisonMarket(m.name)}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {getLocalizedMarketName(m.name, language)}
                    </button>
                  )
                })}
              </div>

              {comparisonLoading && (
                <div className="comparison-loading"><p>{t('loading_market_data', language)}</p></div>
              )}

              {comparisonData && (
                <div className="comparison-results-box">
                  {!comparisonData.is_comparable && (
                    <div className="incomparable-warning">
                      ⚠️ {comparisonData.incomparable_reason || t('incomparable_units_warning', language)}
                    </div>
                  )}

                  <div className="comparison-table-wrapper">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>{t('market_label', language)}</th>
                          <th>{t('trend_label', language)}</th>
                          <th>{t('latest_price_label', language)}</th>
                          <th>{t('price_change_label', language)}</th>
                          <th>{t('reporting_days_count', language, { count: '' })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.markets.map((mRes) => (
                          <tr key={mRes.market} className={mRes.market === activeMarketName ? 'primary-row' : ''}>
                            <td>
                              <strong>{getLocalizedMarketName(mRes.market, language)}</strong>
                              {mRes.market === activeMarketName && <span className="active-tag"> (Active)</span>}
                            </td>
                            <td>{renderTrendBadge(mRes.trend)}</td>
                            <td>{mRes.latest_price ? `₹${mRes.latest_price} / ${mRes.unit}` : '—'}</td>
                            <td className={mRes.absolute_change > 0 ? 'pos' : mRes.absolute_change < 0 ? 'neg' : ''}>
                              {mRes.percentage_change !== null ? `${mRes.percentage_change > 0 ? '+' : ''}${mRes.percentage_change}%` : '—'}
                            </td>
                            <td>{mRes.available_reporting_days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Daily Arrival Tracking (Phase 5) */}
          {renderArrivalTrackingCard()}
        </>
      )}
    </section>
  )
}

