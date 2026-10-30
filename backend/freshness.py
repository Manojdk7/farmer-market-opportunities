import os
from datetime import date, datetime, timezone

RECENT_CALENDAR_DAYS = max(1, int(os.getenv("PRICE_RECENT_CALENDAR_DAYS", "7")))
SUPPORTED_PRICE_UNITS = frozenset({"INR/kg", "INR/quintal", "INR/tonne"})


def observation_freshness(observation_date: date | None, today: date | None = None) -> str:
    if observation_date is None:
        return "unknown"
    current_date = today or datetime.now(timezone.utc).date()
    age_days = (current_date - observation_date).days
    if age_days < 0:
        return "unknown"
    if age_days < RECENT_CALENDAR_DAYS:
        return "recent"
    return "stale"
