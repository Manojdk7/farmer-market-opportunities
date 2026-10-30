"""Phase 0 validation: test multi-district sync for major crops."""
from database import SessionLocal
from agmarknet_sync import sync_agmarknet_prices

districts = ['Ballari', 'Belagavi', 'Dharwad']
crops = ['Maize', 'Paddy (Common)', 'Ragi / Finger Millet']

with SessionLocal() as db:
    for district in districts:
        for crop in crops:
            r = sync_agmarknet_prices(db, district, crop)
            errors = r.get('errors') or []
            print(f"{district}/{crop}: synced={r['records_synced']}, added={r['records_added']}, errors={len(errors)}")

print("Multi-district sync validation complete.")
