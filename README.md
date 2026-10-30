# Connecting Farmers to Better Market Opportunities (Concept A)

## Problem

Farmers struggle to compare selling options under uncertainty. Available information may not be comparable, recent, or complete about costs.

## Solution (Concept A: Net-Proceeds Comparator)

An offline-capable, Kannada-first selling-decision aid that estimates net proceeds across feasible selling options, shows the underlying evidence, and flags unconfirmed variables before transport.

### Features

- **Net-Proceeds Calculator**: Accounts for price, physical loss, quality deductions, transport, handling, and commissions.
- **Offline Fallback**: If the backend fails, it calculates locally and displays an "Offline" badge.
- **Trust Indicators**: Mandatory disclaimers about unconfirmed buyers and estimated ranges.
- **Market Price Overview**: The dashboard browses stored API market observations, source/date details, and sample-data labels before using a supported INR price per kg in the calculator. Browser-entered observations remain local and are not uploaded.
- **Price Provenance**: Stored observations show source, unit, data type, verification, freshness, and ranking eligibility; manual writes require a backend-configured admin token.
- **Transport Sensitivity**: The selling-option comparison calculates break-even total transport costs and lets farmers test alternate quotes without changing the saved comparison. Quote validity and loading, unloading, waiting, and toll charges must be reviewed before an option can be treated as a complete comparison.

### Setup Instructions

1. **Backend** (PowerShell):

   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\python.exe -m pip install -r requirements.txt
   .\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
   # Copy the generated value, then set it in this same PowerShell window:
   $env:MARKET_DATA_ADMIN_TOKEN = 'paste-generated-value-here'
   .\venv\Scripts\python.exe -m uvicorn main:app --reload
   ```

   If you do not need manual market-data entry, omit `MARKET_DATA_ADMIN_TOKEN`; the write endpoint stays disabled.

2. **Frontend** (separate terminal):

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

3. Open the API documentation at <http://127.0.0.1:8000/docs>.

### Production deployment (Vercel + Render)

The deployment configuration is prepared for a Vercel frontend and a Render FastAPI service:

1. Push this project to a Git provider that both Vercel and Render can access.
2. In Render, create a Blueprint from the repository and select `backend/render.yaml`. The service uses a persistent disk for SQLite and enables secure session cookies. The `starter` plan is required because Render's free web services do not provide persistent disks.
3. Wait for the API health check at `/health` to pass. If Render assigns a different service hostname, update the API hostname in `frontend/vercel.json`.
4. In Vercel, import the same repository and set the project Root Directory to `frontend`. Use `npm run build` as the build command and `dist` as the output directory. The Vercel rewrite sends `/api/*` requests through the frontend origin so browser authentication cookies remain first-party.
5. Deploy, then test registration, login, refresh, logout, calculator API, and market-data requests on the Vercel URL. Confirm a redeploy does not reset data by creating a test account/record and checking it after a Render restart.

Do not add production credentials or admin tokens to source control. The Render SQLite database persists on its mounted disk; keep independent backups before schema changes or maintenance.

## Backend API and SQLite

The backend uses SQLAlchemy with SQLite by default. On startup it runs a transactional SQLite migration for the Phase 5 observation fields, then creates missing tables without dropping existing genuine/manual data. The migration keeps existing IDs, market links, prices, units, and record-entry timestamps. Existing synthetic sample observations are changed to have no observation date because their old seed dates were generated examples, not real observation dates. Exact duplicate synthetic seed rows are consolidated, keeping the lowest existing ID. Old non-sample rows are classified as manual/unverified; no retrieval timestamp is invented. Set `DATABASE_URL` to use another SQLAlchemy-supported database URL; PostgreSQL is not configured or required. The Phase 5 migration is specific to SQLite; other database backends need a migration tool before use.

On startup, an idempotent development seed creates three sample-labelled Karnataka market records, five synthetic demo price observations, two selling-option records, and one sample comparison if their sample records are not already present. Demo prices have no observation or retrieval dates and are never rank-eligible. These numbers are demonstrations only, not current Karnataka market rates or offers. No actual sale outcomes are seeded. Existing non-sample observations are not overwritten by seeding.

### Price data trust and sources

The official sources investigated were:

- [AGMARKNET 2.0](https://agmarknet.gov.in/) — the official portal landing page loaded as a JavaScript application. This inspection confirmed the portal itself, but did not verify a documented public API, a downloadable dataset, its Karnataka commodity coverage, units, or source-record date fields. No AGMARKNET feed or scraper is integrated.
- [Open Government Data Platform India](https://www.data.gov.in/) — the portal and a candidate daily market-price resource could not be inspected with the available web access (HTTP 403). Dataset availability, API access, units, dates, and usage terms therefore remain unverified. No OGD API is integrated.

No external price rows are stored as official or verified. The current development seed contains 5 demo observations, 0 verified official observations, and 0 manually entered observations in a newly seeded database. Manual entries are stored with `data_type=manual` and `verification_status=unverified`, even when a source name or URL is supplied. An admin entering a record does not make it independently verified.

### Freshness, provenance, and eligibility

- `observation_date` is the date the source says the price was observed. It is not replaced with the entry date.
- `retrieved_at` means an actual source retrieval/import timestamp. Manual entry and synthetic seed do not populate it.
- Since records currently store a calendar date, not an observation time, freshness uses UTC calendar days without inventing a time: an observation dated today is recent; an older date is stale; a missing, invalid, or future date is unknown. `PRICE_RECENT_CALENDAR_DAYS` configures the number of UTC calendar days considered recent (default `1`). Date-only data cannot promise an exact rolling 24-hour age.
- Ranking eligibility is returned per observation with exclusion reasons. Demo, stale/unknown-date, missing-source, invalid-price, missing market/commodity, and unsupported-unit observations are ineligible. Only `INR/kg`, `INR/quintal`, and `INR/tonne` are currently supported. Comparable groups must match commodity, variety, and unit across at least two distinct markets; otherwise the API reports “Insufficient reliable data for ranking.” No market-price ranking or official-data integration is currently performed.
- Retrieval/import timestamps, source URLs, and varieties remain blank unless actually available; the application does not fabricate them.

### Transport-cost sensitivity

The comparison screen shows the maximum total transport cost at which each option would tie with the strongest competing option, using the other options' current what-if costs. An option is estimated to do better only when its scenario transport cost is below that break-even amount. Farmers can enter a different total quote for each option to see scenario net proceeds and the resulting highest estimate; this is a what-if view only and does not change the saved quote, comparison, or calculation. Invalid or blank scenario costs suppress the scenario ranking and break-even figures.

Before an option can be considered complete for comparison, its transport quote must have a current-or-future validity date and the user must state whether loading, unloading, waiting, and toll charges are included or excluded. These are user-reported details, not independently verified quotes. The tool does not infer a transport rate from distance.

### Manual observation entry and authorization

Manual write access is disabled unless `MARKET_DATA_ADMIN_TOKEN` is configured in the backend process environment with at least 32 characters. The frontend asks for that bearer token in page memory only; it is not saved in browser storage. The API checks it on every `POST /api/price-observations` request using a constant-time comparison. `GET /api/admin/status` exposes only whether the feature is enabled, not the token. Use a generated random value; never commit it or put it in frontend source.

This is a shared development token, not production user authentication: it has no individual identities, roles, audit trail, or rotation workflow. Production deployment needs HTTPS and a proper authenticated/authorized admin system. Do not expose this prototype write route publicly as a production admin feature.

### Endpoints

- `GET /api/markets?district=Davanagere&state=Karnataka` — active stored markets; district/state filters are optional.
- `GET /api/price-observations?commodity=Maize&limit=20` — stored observations with market location, variety, explicit unit, observation date, retrieval date when available, source name/URL, data type, verification status, freshness, and ranking eligibility/reasons. Optional filters: `market_id`, `commodity`, `from_date`, `to_date`, `data_type`, `freshness`; `limit` is 1–200. Prices retain their explicit units; this endpoint does not convert them.
- `GET /api/admin/status` — reports whether manual-entry writes are enabled; never returns the configured secret.
- `POST /api/price-observations` — adds a validated manual/unverified record and requires `Authorization: Bearer <MARKET_DATA_ADMIN_TOKEN>`. Missing observation date or source can be retained for review but makes the record ineligible for ranking. Retrieval timestamps are not generated for manual entry.
- `POST /api/calculate` — validated Phase 1 calculation. Existing root fields `gross` and `net_proceeds` remain for frontend compatibility; `breakdown` adds quantity/loss, saleable quantity, quality adjustment, costs, and units. The `l` request field remains a loss fraction (for example `0.05` means 5%).
- `POST /api/comparisons` — validates and saves two or three option estimates and their input/result snapshot. Returns HTTP 201 and a comparison ID. A winner is set only when units and critical details are comparable, price dates are within seven days, and the leading estimate exceeds the 2% close-result threshold.
- `GET /api/comparisons` and `GET /api/comparisons/{id}` — read saved comparisons, including the synthetic sample comparison.
- `GET /api/sync` — reports `not_configured`; it does not claim that synchronization has occurred.

Seed data is created during backend startup; there is no public seed endpoint or external import command.

Example calculation request:

```json
{
  "q": 100,
  "p": 22,
  "l": 0.05,
  "d": 0,
  "ct": 50,
  "ch": 10,
  "cp": 20,
  "cm": 5,
  "co": 15,
  "quantity_unit": "kg",
  "price_unit": "INR/kg"
}
```

Example comparison request:

```json
{
  "commodity": "Maize",
  "quantity": 100,
  "quantity_unit": "kg",
  "physical_loss_percent": 5,
  "calculation_inputs": {"d": 0, "ch": 10, "cp": 20, "cm": 5, "co": 15},
  "options": [
    {
      "name": "Sample Local Option",
      "price": 22,
      "price_unit": "INR/kg",
      "price_date": "2026-10-29",
      "source": "User-entered quote",
      "distance_km": 5,
      "transport_cost": 50,
      "transport_source": "User-entered quote",
      "quality_requirements": "Same grade",
      "quality_comparable": true,
      "payment_terms": "Cash"
    },
    {
      "name": "Sample Nearby Option",
      "price": 24,
      "price_unit": "INR/kg",
      "price_date": "2026-10-29",
      "source": "User-entered quote",
      "distance_km": 18,
      "transport_cost": 100,
      "transport_source": "User-entered quote",
      "quality_requirements": "Same grade",
      "quality_comparable": true,
      "payment_terms": "Cash"
    }
  ]
}
```

Run backend tests:

```powershell
cd backend
.\venv\Scripts\python.exe -m unittest discover -v
```

The current data includes synthetic demo rows clearly marked as samples. There is no verified live market-price provider, automatic cloud synchronization beyond the backend's configured database, or production admin identity/role system. The Render/Vercel configuration above is a deployment starting point; complete the hosted smoke tests and configure an authenticated admin workflow before using manual price entry in production.
