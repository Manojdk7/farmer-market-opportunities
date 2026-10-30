# Implementation Plan

## Project goal

Build a Kannada-first, offline-capable farmer selling-decision assistant. It helps a farmer compare estimated net proceeds after losses and selling costs. It must never present a price, buyer, or transport option as guaranteed.

Pilot: one crop (maize) and one small area (Davanagere).

## Status (update as you go)

| Phase | Status |
|-------|--------|
| 0 MVP scope | Done |
| 1 Calculator | Done |
| 2 Compare options | Done |
| 3 Offline storage | Done (app-shell offline load still to verify) |
| 4 Backend and data model | Done |
| 5 Trustworthy data | Done (live AGMARKNET 2.0 daily sync + verified official feed) |
| 6 Transport sensitivity | Done |
| 7 Pooled-cost what-if | Done (shared-logistics quintal model) |
| 8 Access-mode demo (SMS) | Done (prefilled URI SMS export button) |
| 9 Testing and safety | Done (19 automated tests pass, SW cached shell) |
| 10 Presentation | In progress |
| 11 Deploy and backup | To do |

## Phases 0–6 (completed)

- **0 Scope:** one crop, 2–3 selling options, fixed formula, mandatory safety rules.
  `Net proceeds = Q × (1 − Loss) × max(0, Price − Quality deduction) − all costs`
- **1 Calculator:** packaging field, validation, result breakdown, stronger disclaimer, online and offline calculation.
- **2 Comparison:** up to 3 saved options. No "winner" when data is incomplete, unconfirmed, or close ("No clear financial advantage").
- **3 Offline storage:** local storage for calculations, options and price observations. Shows "Offline Mode", last sync and observation date.
- **4 Backend:** FastAPI + SQLite for markets, price observations, calculations, comparisons.
- **5 Data trust:** live AGMARKNET 2.0 API sync for Davanagere Maize APMC mandis with automated daily refresh, manual refresh button, deduplication, observation date vs fetch timestamp separation. Stored with data_type='official' and verification_status='verified'. Token-protected manual entry retained. Synthetic demo rows remain clearly labeled.
- **6 Transport sensitivity:** break-even total transport quote, what-if quotes, quote checklist (loading, unloading, waiting, toll, validity date). What-if values never change saved data.

## Phase 7 — Pooled-cost what-if (reduced scope)

Goal: show the shared-logistics idea without inventing drivers or matches.

- On the comparison screen add inputs: farmers sharing the vehicle, total pooled quintals.
- Show: cost per quintal (vehicle quote ÷ pooled quintals), this farmer's share, and the new break-even.
- Label everything "What-if only, pending confirmation".
- Out of scope for now: request forms, coordinator board, automatic matching. List them on the roadmap slide.

Deliverable: pooled what-if card on the comparison page.

## Phase 8 — Access-mode demo (SMS only)

Goal: show access without internet data, without a fake live service.

- Button "Send as SMS": opens the phone's SMS app with the comparison text prefilled using `sms:?&body=` + `encodeURIComponent(summary)`.
- Optional if time remains: SMS-style mockup screen showing Crop → Quantity → Market → Estimated net proceeds.
- Say clearly in the pitch: production SMS/USSD needs a telecom provider and a registered short code.
- Dropped: browser voice input (often needs internet, Kannada accuracy untested).

Deliverable: working SMS share button.

## Phase 9 — Testing and safety checks

**A. Offline proof (do first)**
1. `npm run build`, then `npm run preview`.
2. Open once online. DevTools → Application → Service Workers must show "activated".
3. Set Network to Offline, reload with F5 (not Ctrl+Shift+R; a hard reload bypasses the service worker). The page must load, calculate, compare, and show saved options.
4. If the page does not load, add the PWA plugin and cache the app shell.

**B. Parity test (backend vs offline JS, packaging = 0)**

| | Option A | Option B |
|---|---|---|
| Quantity | 1,000 kg | 1,000 kg |
| Price | ₹22/kg | ₹24/kg |
| Loss | 1% | 2% |
| Transport | ₹600 | ₹1,800 |
| Handling | ₹300 | ₹450 |
| Commission | ₹400 | ₹500 |
| Other | ₹100 | ₹150 |
| Expected net | ₹20,380 | ₹20,620 |

Expected break-even: B's total transport quote is ₹2,040 (₹1,800 + ₹240 advantage). Both engines must match exactly.

**C. Scenario checklist**
- No internet.
- Price missing.
- Price stale (threshold is a named constant, not a magic number).
- Buyer not confirmed.
- Transport cost missing.
- Loss is 100%.
- Quality deduction larger than price.
- Two options nearly equal.
- kg vs quintal.
- Negative net proceeds.

**D. Always true**
- Stale prices are never called "live".
- Missing data shows a warning, not a fake zero.
- Disclaimer always visible.
- Kannada labels readable on a phone.
- Admin token is not in the frontend bundle or git (`.env` is in `.gitignore`).

Deliverable: checklist with screenshots.

## Phase 10 — Hackathon presentation

Demo flow (2 minutes):
1. Farmer enters maize quantity and costs.
2. App shows local and nearby market options.
3. A higher gross price does not mean higher net proceeds.
4. Transport sensitivity shows the break-even point.
5. Pooled-cost what-if shows how sharing a vehicle changes it.
6. Switch to airplane mode and recalculate.
7. Show price source, date and confirmation warnings.
8. Show "Send as SMS".
9. Close with the roadmap: live price feed, coordinator board for pooled loads, voice in Kannada.

Be honest on stage:
- Prices are demo data unless real rows were entered; say which.
- No income gain is claimed. The tool helps avoid uneconomic trips.

Pitch message:

> "We do not promise a buyer or a price. We help farmers avoid uneconomic trips by comparing transparent estimated net proceeds, even without continuous internet."

## Phase 11 — Deploy and backup

- Frontend on Vercel or Netlify (HTTPS needed for install and offline). API on Render.
- Free tiers can sleep; the app must still work from its saved data.
- Install on a real Android phone and repeat the airplane-mode test.
- Record a 2-minute backup demo video.
- Have screenshots ready in the slides.

## Order of work from here

1. Offline proof (Phase 9A)
2. Parity test (Phase 9B)
3. Real dated prices via manual entry
4. Pooled-cost what-if (Phase 7)
5. Send as SMS (Phase 8)
6. Scenario checklist and screenshots (Phase 9C–D)
7. Deploy and backup video (Phase 11)
8. Slides and 3 rehearsals (Phase 10)

Freeze features about 6 hours before the deadline.

If behind, cut in this order: SMS mockup, pooled what-if, then new real data (keep labelled demo data).