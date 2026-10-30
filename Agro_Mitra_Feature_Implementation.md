# Agro Mitra --- Feature Implementation Roadmap

**Project:** Agro Mitra --- Karnataka Farmer Market Decision Assistant\
**Purpose:** A phased implementation plan for adding farmer-focused
features to the existing application.\
**Implementation rule:** Complete and test one phase at a time. Do not
start the next phase until the current phase is accepted.

------------------------------------------------------------------------

## 1. Project context and constraints

Agro Mitra is an existing Flask + SQLite + HTML/CSS/JavaScript
application. It helps farmers compare agricultural market prices and
estimate net proceeds after transport, handling, commission, quality
deductions and other expenses.

### Preserve the existing stack

-   Backend: Python Flask.
-   Database: SQLite.
-   Frontend: existing HTML, CSS and JavaScript.
-   Preserve the current AGMARKNET/government price-data integration
    where it works.
-   Preserve existing routes, API contracts, historical records and
    working calculations.
-   Do not migrate to React, Next.js, or another frontend framework.
-   Do not add dependencies unless they are genuinely needed.
-   Keep the current modern soft-skeuomorphic design: warm ivory/cream,
    forest green, subtle teal, tactile cards, recessed inputs and
    readable typography.
-   Support Kannada and English, with only one language displayed at a
    time.
-   Keep the interface responsive and usable on low-end Android phones
    and slower connections.

### Non-negotiable data integrity rules

1.  Never fabricate market prices, APMC names, arrivals, MSP values,
    procurement centres, transport quotes or forecasts.
2.  Every displayed market price must retain its source, reporting date,
    fetch timestamp and unit where available.
3.  Clearly distinguish source-reported values from farmer-entered
    estimates.
4.  Never label cached or stale data as live/current.
5.  Never compare prices until units and quantity conversions are
    validated.
6.  Do not assume every crop is available in every district or market.
7.  If data is unavailable, say so clearly instead of filling gaps with
    dummy values.
8.  Keep a record of provider limitations and API failures.
9.  Do not silently merge conflicting records from different providers.
10. Recommendations are estimates, not guaranteed sale prices or profit.

------------------------------------------------------------------------

## 2. Current core coverage

### Karnataka districts

Use the following 31-district list as the initial district
configuration. Validate names and provider identifiers against current
official administrative and data-provider metadata before
implementation. District names and boundaries can change; do not treat
this static list as a permanent source of truth.

1.  Bagalkote
2.  Ballari
3.  Belagavi
4.  Bengaluru Rural
5.  Bengaluru South
6.  Bengaluru Urban
7.  Bidar
8.  Chamarajanagar
9.  Chikkaballapura
10. Chikkamagaluru
11. Chitradurga
12. Dakshina Kannada
13. Davanagere
14. Dharwad
15. Gadag
16. Hassan
17. Haveri
18. Kalaburagi
19. Kodagu
20. Kolar
21. Koppal
22. Mandya
23. Mysuru
24. Raichur
25. Ramanagara
26. Shivamogga
27. Tumakuru
28. Udupi
29. Uttara Kannada
30. Vijayanagara
31. Vijayapura
32. Yadgir

**District-count validation required:** The list above must be
reconciled with the current official 31-district directory before it is
used in production. In particular, check the administrative
naming/transition involving Bengaluru South and Ramanagara. Do not
display both as separate districts if the official source identifies one
as the current name/status of the other. The final production list must
contain exactly the currently verified districts and valid provider
mappings.

Official reference: https://igod.gov.in/sg/KA/E042/organizations

### Initial seven crops

  \#   Crop                             Kannada display name
  ---- -------------------------------- ----------------------
  1    Maize                            ಮೆಕ್ಕೆಜೋಳ
  2    Paddy (Common)                   ಭತ್ತ
  3    Red Gram / Arhar / Tur (Whole)   ತೊಗರಿ
  4    Groundnut                        ಕಡಲೆಕಾಯಿ
  5    Ragi / Finger Millet             ರಾಗಿ
  6    Soybean                          ಸೋಯಾಬೀನ್
  7    Sugarcane                        ಕಬ್ಬು

For every crop, verify the exact commodity name/ID and unit from the
selected data provider. Support aliases only when they are confirmed
mappings, not guesses. Default crop: Maize. Default district:
Davanagere.

### Existing core workflow that must remain functional

1.  Farmer selects district and crop.
2.  Backend fetches verified price records for that district and crop.
3.  Dashboard displays available APMC markets and price information.
4.  Farmer selects two markets for comparison.
5.  Farmer enters quantity and relevant expenses.
6.  Application calculates estimated net proceeds and transport-cost
    break-even.
7.  Application explains the comparison and warns when information is
    stale, incomplete or uncertain.

------------------------------------------------------------------------

## 3. Recommended implementation order

Implement in this order. Phase 0 is a foundation phase; Phases 1--3 are
the first visible farmer-facing improvements.

  ------------------------------------------------------------------------------
  Phase             Feature           Main area                Priority
  ----------------- ----------------- ------------------------ -----------------
  0                 Data foundation   Backend/database         Critical
                    and validation                             

  1                 One-tap WhatsApp  Frontend                 High
                    decision sharing                           

  2                 Kannada voice     Frontend/accessibility   High
                    readout                                    

  3                 7-day APMC price  Frontend/database        High
                    trend                                      

  4                 30-day price      Frontend/database        Medium
                    trend                                      

  5                 Daily arrival     Data/backend/UI          Medium
                    quantity tracking                          

  6                 MSP comparison    Data/backend/UI          High, after
                    and procurement                            verified data
                    information                                

  7                 Village and taluk Data/UI                  Medium
                    selection                                  

  8                 Distance and      Routing/calculator       Medium
                    freight estimator                          

  9                 Farmer vehicle    Backend/UI/privacy       Advanced
                    pooling                                    

  10                Add six more      Data/backend/UI          Medium
                    crops                                      

  11                Warehouse storage Calculator               Advanced
                    vs sell-now                                
                    calculator                                 

  12                Installable       Frontend/offline         High
                    Android PWA                                

  13                Automated daily   Backend/operations       High
                    synchronization                            

  14                Secondary         Data integration         Advanced
                    government data                            
                    source                                     

  15                Performance,      Whole application        High
                    offline and                                
                    security                                   
                    hardening                                  

  16                Final integration Whole application        Critical
                    and acceptance                             
                    testing                                    
  ------------------------------------------------------------------------------

------------------------------------------------------------------------

# 4. Detailed phase specifications

## Phase 0 --- Data foundation and validation

**Goal:** Ensure all existing market-price and calculator information is
trustworthy before adding more features.

### Tasks

-   Inspect the current Flask routes, database schema, frontend data
    flow and existing provider integration.
-   Verify the district list and reconcile the Bengaluru
    South/Ramanagara administrative naming issue using current official
    sources.
-   Verify all district-to-provider identifiers.
-   Verify all seven crop-to-provider commodity identifiers and aliases.
-   Verify price units: ₹/quintal, ₹/tonne, ₹/kg or any other
    source-defined unit.
-   Store source name, source record identifier (when available),
    reporting date, fetch timestamp and original unit.
-   Detect and prevent duplicate records.
-   Preserve historical price records.
-   Remove fabricated sample records from production views without
    deleting legitimate historical data.
-   Add consistent Fresh, Delayed, Stale and Unavailable statuses based
    on configurable rules.
-   Make API errors visible and recoverable.
-   Ensure district and crop selection both affect the backend query,
    not merely a frontend filter.
-   Confirm market discovery is separate from crop-price availability.
-   Check that the calculator never treats an APMC modal price as a
    confirmed buyer quotation.

### Acceptance criteria

-   All currently verified districts can be selected.
-   Davanagere is the default district.
-   All seven initial crops are configured.
-   Backend queries use the selected district and crop.
-   No dummy prices or invented APMC records appear.
-   Historical records remain available.
-   Units, reporting dates and source details are visible.
-   Missing data and API failures have clear states.

------------------------------------------------------------------------

## Phase 1 --- One-tap WhatsApp decision summary

**Goal:** Let a farmer share a useful market comparison with family
members, buyers or transport contacts.

### Message contents

-   Agro Mitra heading.
-   Selected crop and quantity.
-   Selected district.
-   Market A and Market B names.
-   Modal prices, with units and reporting dates.
-   Estimated expenses for each market.
-   Estimated net proceeds for each market.
-   Difference in estimated net proceeds.
-   Break-even additional transport cost, if calculable.
-   Data freshness/source note.
-   Disclaimer that the result is an estimate and final buyer terms must
    be confirmed.

### Implementation

-   Add a clearly labelled WhatsApp share button near the
    recommendation.
-   Generate the message from the current calculation state; do not
    hardcode sample values.
-   Encode the message safely for a WhatsApp share URL such as
    `https://wa.me/?text=...`.
-   Use the Web Share API where appropriate, with a WhatsApp URL
    fallback.
-   Do not send data automatically; the farmer must confirm sharing in
    WhatsApp.
-   Handle missing values gracefully.
-   Ensure Kannada and English message templates follow the currently
    selected language.

### Acceptance criteria

-   Shared text matches the currently displayed calculation.
-   No stale or missing value is presented as current.
-   Button works on Android and desktop fallback.
-   Farmer can review/edit the message before sending.

------------------------------------------------------------------------

## Phase 2 --- Kannada voice readout

**Goal:** Make the recommendation accessible to farmers who prefer
listening.

### Implementation

-   Use browser-native Web Speech API: `speechSynthesis`.
-   Prefer an available Kannada voice with language `kn-IN`.
-   Add a speaker button to the recommendation section.
-   Read the crop, market names, estimated net proceeds, difference and
    key caution.
-   Format currency and quantities so they are spoken naturally.
-   Add Stop; add Pause/Resume if supported reliably.
-   Cancel any previous speech before starting a new one.
-   Do not assume every browser/device has a Kannada voice installed.
-   If no Kannada voice exists, show a clear message and retain the
    readable text.
-   Respect the selected application language.

### Acceptance criteria

-   One tap reads the current recommendation.
-   Speech does not overlap or continue after navigating away/starting
    another reading.
-   Kannada voice is used when available.
-   Unsupported-browser and missing-voice cases fail gracefully.

------------------------------------------------------------------------

## Phase 3 --- 7-day APMC price trend

**Goal:** Show whether the market price has recently risen, fallen or
remained broadly stable.

### Implementation

-   Use historical SQLite records for the selected crop, market and
    variety where possible.
-   Retrieve the last seven available reporting days, not simply the
    last seven calendar dates.
-   Plot modal price with a lightweight chart or SVG/canvas sparkline.
-   Show first and latest available values and percentage change.
-   Label the result Rising, Falling or Stable using a documented
    threshold.
-   Show reporting dates and units.
-   Identify gaps in reporting.
-   Do not invent missing values or interpolate them as actual prices.
-   If insufficient history exists, show an explanatory message.

### Acceptance criteria

-   Trend corresponds to the selected market/crop.
-   All points have source reporting dates.
-   Unit is consistent across the graph.
-   Missing history does not create a false trend.

------------------------------------------------------------------------

## Phase 4 --- 30-day price trend

**Goal:** Give farmers a longer historical view.

### Implementation

-   Add a 7-day / 30-day switch.
-   Retrieve the last 30 available reporting days.
-   Show minimum, maximum and average modal price for the available
    period.
-   Allow comparison of selected markets when comparable records exist.
-   Display the number of available reporting days.
-   Show gaps and stale data.
-   Do not describe historical trends as forecasts.

### Acceptance criteria

-   The chart uses actual historical records only.
-   Market and crop filters work.
-   Summary statistics are calculated from available valid records.
-   No fabricated points appear.

------------------------------------------------------------------------

## Phase 5 --- Daily arrival quantity tracking (ಮಾರುಕಟ್ಟೆ ಆವಕ)

**Goal:** Show the amount of produce reported as arriving at a market.

### Implementation

-   Inspect the provider schema for arrival quantity and unit.
-   Store the source value and original unit.
-   Display arrivals in the expanded APMC details.
-   Compare with the previous available reporting day only when both
    records are valid and comparable.
-   Optionally calculate a historical baseline (for example, a rolling
    median) when enough records exist.
-   Only show High/Normal/Low arrival labels when a documented baseline
    and sufficient history support them.
-   Explain that arrivals can influence prices but do not guarantee a
    price movement.
-   If arrivals are unavailable, show "Arrival data unavailable."

### Acceptance criteria

-   Arrival quantity is never inferred from price.
-   Unit and reporting date are visible.
-   Comparisons use compatible units and dates.
-   High-arrival alerts are not based on arbitrary hardcoded thresholds.

------------------------------------------------------------------------

## Phase 6 --- Government MSP comparison and procurement information

**Goal:** Help farmers compare a market modal price with the applicable
government-announced Minimum Support Price.

### Implementation

-   Create a versioned MSP reference dataset.
-   Store crop, marketing season/year, variety/grade where relevant,
    unit, effective period, official notification source and retrieval
    date.
-   Verify the applicable MSP from official Government of India
    notifications.
-   Compare only like-for-like commodities, varieties and units.
-   Display the difference between modal price and MSP.
-   Clearly state that MSP is not automatically a guaranteed purchase
    offer at every APMC.
-   Show procurement agency, centre, registration method, eligibility
    and operating dates only when verified from current official
    sources.
-   Do not automatically recommend NAFED, KGFCSC or another agency
    without verifying the crop-specific scheme and current procurement
    arrangements.
-   Add a source link and last-verified date.
-   If no applicable MSP or procurement details are verified, say so.

### Acceptance criteria

-   MSP record is linked to the correct season and crop.
-   Unit conversion is validated.
-   Alerts distinguish market price from procurement price.
-   Procurement centre details are current and sourced.
-   No unsupported guarantee is shown.

------------------------------------------------------------------------

## Phase 7 --- Village and taluk selection

**Goal:** Let the farmer specify the origin location for logistics
calculations.

### Implementation

-   Add searchable taluk and village selectors.
-   Use verified Karnataka administrative metadata.
-   Link villages to taluks and districts using provider identifiers
    where available.
-   Keep district, taluk and village relationships consistent.
-   Allow manual selection if geolocation is denied or unavailable.
-   Do not require precise GPS access.
-   Request location permission only when the user explicitly chooses a
    location-based feature.
-   Do not store precise coordinates unless necessary and consented to.

### Acceptance criteria

-   Village belongs to the selected taluk and district.
-   Invalid combinations are rejected.
-   Manual selection works without GPS.
-   Location privacy is respected.

------------------------------------------------------------------------

## Phase 8 --- Distance and freight estimator

**Goal:** Estimate road distance and help farmers compare transport
costs.

### Implementation

-   Evaluate OpenStreetMap routing and OSRM availability/usage policy.
-   Calculate road distance from selected origin to selected APMC when
    valid coordinates or routable locations exist.
-   Display route distance in kilometres and identify the routing
    source.
-   Allow the farmer to edit distance.
-   Allow entry of an actual transport quote.
-   Add optional vehicle categories only when relevant.
-   If using default freight rates, store them as configurable
    assumptions with source/date and label them as estimates.
-   Do not hardcode ₹25--₹35/km as a universal rate.
-   Do not claim a quote is guaranteed.
-   If routing is unavailable, allow manual distance and quote entry.

### Acceptance criteria

-   Route is based on valid origin and destination.
-   Distance is labelled as an estimate.
-   Farmer can override it.
-   Transport estimate is clearly separated from an actual quote.

------------------------------------------------------------------------

## Phase 9 --- Farmer vehicle pooling (ರೈತರ ಜಂಟಿ ಸಾರಿಗೆ)

**Goal:** Help nearby farmers identify opportunities to share transport.

### Implementation

-   Allow a farmer to publish an optional trip request.
-   Fields: crop, approximate quantity, destination market, intended
    dispatch date/time window, origin village/taluk, vehicle capacity
    needed and optional contact method.
-   Allow other farmers to view and express interest.
-   Calculate indicative shared freight per farmer only when a real
    quote/cost is provided.
-   Add expiry, cancellation and reporting controls.
-   Require consent before sharing contact details.
-   Avoid exposing phone numbers or precise home locations publicly.
-   Clearly label listings as farmer-provided and unverified.
-   Do not claim to book or guarantee a vehicle.

### Acceptance criteria

-   Expired listings disappear from active results.
-   Users control what contact information is shared.
-   Shared-cost calculation is transparent.
-   Reporting and cancellation are available.

------------------------------------------------------------------------

## Phase 10 --- Expand to six additional crops

**Goal:** Expand the crop selector from seven to thirteen supported
crops.

### Additional crops

  \#   Crop                  Kannada display name
  ---- --------------------- ----------------------
  8    Bengal Gram / Chana   ಕಡಲೆ
  9    Onion                 ಈರುಳ್ಳಿ
  10   Cotton                ಹತ್ತಿ
  11   Arecanut / Supari     ಅಡಿಕೆ
  12   Sunflower             ಸೂರ್ಯಕಾಂತಿ
  13   Coffee                ಕಾಫಿ

### Implementation

-   Add crops through the existing crop configuration/metadata
    structure.
-   Verify exact provider commodity names and IDs.
-   Add confirmed aliases.
-   Verify price units and variety mappings.
-   Test availability across districts.
-   Do not assume all crops are traded in every district.
-   Ensure calculator and comparison logic support the correct units.
-   Keep unavailable combinations explicit.

### Acceptance criteria

-   Thirteen crops appear in the selector.
-   Each new crop has a verified mapping or is marked unsupported
    pending mapping.
-   No dummy price data is introduced.
-   Existing seven crops continue working.

------------------------------------------------------------------------

## Phase 11 --- Warehouse storage vs immediate sale calculator

**Goal:** Compare selling now with storing produce and selling later.

### Farmer inputs

-   Crop and quantity.
-   Current verified market price or farmer-entered buyer quote.
-   Storage duration.
-   Warehouse rent and handling charges.
-   Loading/unloading and transport.
-   Loan amount, interest rate and period if using a pledge loan.
-   Insurance and other charges.
-   Expected quality deterioration/weight loss.
-   Farmer-entered expected future selling price.

### Calculations

**Sell now:**

`Net now = Current gross sale value - current selling and transport expenses`

**Store and sell later:**

`Future net = Future gross sale value - storage costs - handling - transport - interest - insurance - estimated loss and other expenses`

Calculate the future selling price needed for the storage option to
break even with selling now.

### Safety and accuracy

-   Do not predict future price unless a separately validated
    forecasting feature exists.
-   Clearly label future price as a user-entered assumption.
-   Do not promise loan eligibility.
-   Verify warehouse accreditation, receipt and pledge-loan conditions
    before displaying specific scheme information.
-   Include a disclaimer that actual terms depend on the warehouse,
    lender, commodity and applicable scheme.

### Acceptance criteria

-   Both scenarios use consistent units.
-   Every expense is visible.
-   Break-even future price is correct.
-   Assumptions are clearly labelled.

------------------------------------------------------------------------

## Phase 12 --- Installable Android PWA

**Goal:** Make Agro Mitra installable on supported Android browsers
without a Play Store release.

### Implementation

-   Inspect the existing web app manifest and service worker.
-   Set app name, short name, theme colour, background colour, display
    mode and start URL.
-   Create suitable app icons in required sizes.
-   Add an "Install Agro Mitra" button in the header.
-   Use `beforeinstallprompt` when supported.
-   Provide manual installation instructions when the event is
    unavailable.
-   Cache essential static assets.
-   Cache the last successfully fetched market data only with its source
    reporting date and fetch timestamp.
-   Clearly label offline/cached data.
-   Never present cached records as live prices.
-   Provide an offline state and a retry/sync action.

### Acceptance criteria

-   PWA passes browser installability checks where supported.
-   Install button handles unsupported browsers.
-   Cached data is clearly identified.
-   Core interface opens offline after a successful prior visit.

------------------------------------------------------------------------

## Phase 13 --- Automated daily synchronization

**Goal:** Refresh available market data automatically and reliably.

### Implementation

-   Build a reusable synchronization service separate from Flask request
    handlers.
-   Configure a daily 5:30 PM Asia/Kolkata schedule as an initial
    default, not as an assumption that all markets report by that time.
-   Make schedule configurable.
-   Sync all verified districts and supported crops.
-   Respect provider pagination, rate limits, terms and availability.
-   Retry transient failures with bounded backoff.
-   Avoid duplicate records.
-   Log sync start/end time, provider, district, crop, status, record
    count and errors.
-   Add a manual refresh mechanism.
-   Display last successful synchronization time.
-   Do not overwrite newer records with older provider responses.

### Acceptance criteria

-   Scheduled job runs independently of a farmer page request.
-   Failures are logged and recoverable.
-   Re-running a sync does not duplicate records.
-   Partial district/crop failures are reported accurately.

------------------------------------------------------------------------

## Phase 14 --- Secondary government data source

**Goal:** Improve resilience when the primary data provider is
unavailable.

### Implementation

-   Inspect available government datasets/APIs, including data.gov.in
    and Karnataka government data portals.
-   Confirm whether a candidate source is genuinely independent or
    republishes AGMARKNET data.
-   Verify API access, credentials, terms, update frequency, schema and
    coverage.
-   Normalize data into the application's internal price-record format.
-   Preserve original source and source record identifiers.
-   Define source-priority and conflict-resolution rules.
-   Compare reporting dates and units before accepting fallback records.
-   Never silently combine conflicting prices.
-   Display which source supplied each record.

### Acceptance criteria

-   Fallback is used only when configured and verified.
-   Source identity remains visible.
-   Conflicts are logged and handled transparently.
-   Duplicate records are prevented.

------------------------------------------------------------------------

## Phase 15 --- Performance, offline and security hardening

**Goal:** Make the application dependable for real farmers and
low-bandwidth use.

### Implementation

-   Optimize database indexes and frequent queries.
-   Add pagination or lazy loading for large market lists.
-   Cache carefully with explicit freshness timestamps.
-   Reduce unnecessary API requests.
-   Handle slow networks and timeouts.
-   Validate all backend inputs.
-   Protect API keys and secrets outside source control.
-   Apply appropriate request limits and security headers.
-   Review SQLite transactions and backup strategy.
-   Ensure offline states are understandable.
-   Test keyboard access, screen-reader labels, contrast and Kannada
    font rendering.
-   Check mobile performance on low-end Android devices.
-   Avoid collecting unnecessary personal data.

### Acceptance criteria

-   No exposed secrets.
-   Large market lists remain usable.
-   Errors are understandable.
-   Offline and stale data are clearly distinguished.
-   Mobile UI remains readable and responsive.

------------------------------------------------------------------------

## Phase 16 --- Final integration and acceptance testing

**Goal:** Verify that all completed phases work together without
regressions.

### Test matrix

-   All currently verified Karnataka districts.
-   All thirteen configured crops.
-   Kannada and English language modes.
-   WhatsApp share message accuracy.
-   Kannada voice availability and fallback.
-   7-day and 30-day trends.
-   Arrival quantity and units.
-   MSP season/crop/unit mapping.
-   Taluk/village validation.
-   Distance and freight calculations.
-   Vehicle pooling privacy and expiry.
-   Warehouse calculator formulas.
-   PWA installation and offline cached-data labels.
-   Scheduled synchronization and retries.
-   Secondary source and conflict handling.
-   Existing market comparison and net-proceeds calculations.

### Final deliverables

-   List of files created and modified.
-   Database migration details.
-   API/provider mapping details.
-   Tests performed and results.
-   Run and deployment instructions.
-   Known limitations and unavailable data sources.
-   Screenshots or short demonstration flow, if available.

Do not report a feature as complete unless it has been implemented and
tested.

------------------------------------------------------------------------

# 5. Standard instruction to use for every coding-agent phase

Copy this instruction before asking your VS Code AI coding agent to
implement a phase.

``` text
You are modifying my existing Agro Mitra Flask + SQLite + HTML/CSS/JavaScript project.

Implement ONLY the phase specified in my next instruction.

Before coding:
1. Inspect the existing project and the relevant files.
2. Read implementation.md and understand the current architecture.
3. Trace the existing data flow, routes, database schema and UI components related to this phase.
4. Identify the smallest safe set of changes.
5. Reuse existing functions and components where possible.
6. Explain briefly what you intend to change before editing.

Implementation rules:
- Do not rewrite the whole project.
- Do not change the technology stack.
- Do not break existing working functionality.
- Do not create fake prices, markets, arrivals, MSP values or quotes.
- Do not add unnecessary dependencies.
- Preserve Kannada and English language support.
- Preserve the modern soft-skeuomorphic design.
- Keep mobile responsiveness.
- Validate input and handle API/database errors.
- Keep source, reporting date, unit and freshness metadata intact.
- Clearly distinguish verified data from user-entered estimates.

After coding:
1. Run the application or relevant tests.
2. Test the new feature.
3. Test affected existing features for regression.
4. Fix errors introduced by your changes.
5. List files created and modified.
6. Explain how to test the feature manually.
7. Report limitations honestly.

Do not implement the next phase automatically. Stop and wait for my approval.
```

------------------------------------------------------------------------

# 6. Recommended execution strategy

### First implementation batch

Implement these one at a time:

1.  Phase 0 --- Data foundation.
2.  Phase 1 --- WhatsApp sharing.
3.  Phase 2 --- Kannada voice.
4.  Phase 3 --- 7-day price trend.

Do not begin Phase 4 until these are tested and accepted.

### Later batches

-   Batch 2: Phases 4--6 (market intelligence).
-   Batch 3: Phases 7--9 (logistics and pooling).
-   Batch 4: Phases 10--12 (crop expansion, storage calculator and PWA).
-   Batch 5: Phases 13--15 (automation, fallback and hardening).
-   Final: Phase 16 (integration and acceptance tests).

The number of days required will depend on the current state of the
codebase, data-provider access and testing results. Treat the batches as
planning groups, not deadlines.

------------------------------------------------------------------------

# 7. Product direction

Agro Mitra should first become a **trustworthy farmer decision-support
platform**, not an unvalidated AI price-prediction application.

Its core value is helping farmers understand:

-   What price is actually reported at nearby markets?
-   How recent and reliable is that information?
-   How much might the farmer receive after expenses?
-   Does travelling to another market make financial sense?
-   How much additional transport cost can the alternative market
    absorb?
-   What government price/procurement information is applicable?
-   What are the risks and assumptions behind the recommendation?

Only after sufficient quality historical data has been collected should
a separate machine-learning price-forecasting phase be considered. Any
forecast must be evaluated on held-out time periods and compared with
simple baselines before being shown to farmers.

**Final principle: Build small, verify every feature, protect data
integrity, and improve farmer usefulness with each phase.**
