"""
Karnataka 31 Districts and 7 Priority Agricultural Crops Metadata
for Agro Mitra - Karnataka Farmer Market Decision Assistant.
Verified against AGMARKNET 2.0 and Government of Karnataka standards.
"""

from typing import Any

KARNATAKA_STATE_ID = 16

# Official 31 Districts of Karnataka with AGMARKNET District IDs & Aliases
KARNATAKA_DISTRICTS: list[dict[str, Any]] = [
    {
        "id": 242,
        "name": "Bagalkote",
        "name_kn": "ಬಾಗಲಕೋಟೆ",
        "aliases": ["bagalkot", "bagalkote"],
    },
    {
        "id": 245,
        "name": "Ballari",
        "name_kn": "ಬಳ್ಳಾರಿ",
        "aliases": ["bellary", "ballari"],
    },
    {
        "id": 244,
        "name": "Belagavi",
        "name_kn": "ಬೆಳಗಾವಿ",
        "aliases": ["belgaum", "belagavi"],
    },
    {
        "id": 727,
        "name": "Bengaluru Rural",
        "name_kn": "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ",
        "aliases": ["bengaluru rural", "bangalore rural"],
    },
    {
        "id": 728,
        "name": "Bengaluru South",
        "name_kn": "ಬೆಂಗಳೂರು ದಕ್ಷಿಣ",
        "aliases": ["bengaluru south", "bangalore south", "ramanagar", "ramanagara"],
    },
    {
        "id": 243,
        "name": "Bengaluru Urban",
        "name_kn": "ಬೆಂಗಳೂರು ನಗರ",
        "aliases": ["bengaluru", "bengaluru urban", "bangalore", "bangalore urban"],
    },
    {
        "id": 246,
        "name": "Bidar",
        "name_kn": "ಬೀದರ್",
        "aliases": ["bidar"],
    },
    {
        "id": 248,
        "name": "Chamarajanagar",
        "name_kn": "ಚಾಮರಾಜನಗರ",
        "aliases": ["chamarajanagar", "chamarajnagar"],
    },
    {
        "id": 726,
        "name": "Chikkaballapura",
        "name_kn": "ಚಿಕ್ಕಬಳ್ಳಾಪುರ",
        "aliases": ["chikkaballapur", "chikkaballapura"],
    },
    {
        "id": 249,
        "name": "Chikkamagaluru",
        "name_kn": "ಚಿಕ್ಕಮಗಳೂರು",
        "aliases": ["chikkamagaluru", "chikmagalur"],
    },
    {
        "id": 250,
        "name": "Chitradurga",
        "name_kn": "ಚಿತ್ರದುರ್ಗ",
        "aliases": ["chitradurga"],
    },
    {
        "id": 262,
        "name": "Dakshina Kannada",
        "name_kn": "ದಕ್ಷಿಣ ಕನ್ನಡ",
        "aliases": ["dakshina kannada", "mangaluru", "mangalore"],
    },
    {
        "id": 251,
        "name": "Davanagere",
        "name_kn": "ದಾವಣಗೆರೆ",
        "aliases": ["davangere", "davanagere"],
    },
    {
        "id": 252,
        "name": "Dharwad",
        "name_kn": "ಧಾರವಾಡ",
        "aliases": ["dharwad", "hubballi", "hubli"],
    },
    {
        "id": 253,
        "name": "Gadag",
        "name_kn": "ಗದಗ",
        "aliases": ["gadag"],
    },
    {
        "id": 254,
        "name": "Hassan",
        "name_kn": "ಹಾಸನ",
        "aliases": ["hassan"],
    },
    {
        "id": 255,
        "name": "Haveri",
        "name_kn": "ಹಾವೇರಿ",
        "aliases": ["haveri"],
    },
    {
        "id": 256,
        "name": "Kalaburagi",
        "name_kn": "ಕಲಬುರಗಿ",
        "aliases": ["kalaburagi", "gulbarga"],
    },
    {
        "id": 260,
        "name": "Kodagu",
        "name_kn": "ಕೊಡಗು",
        "aliases": ["kodagu", "coorg", "madikeri"],
    },
    {
        "id": 258,
        "name": "Kolar",
        "name_kn": "ಕೋಲಾರ",
        "aliases": ["kolar"],
    },
    {
        "id": 259,
        "name": "Koppal",
        "name_kn": "ಕೊಪ್ಪಳ",
        "aliases": ["koppal"],
    },
    {
        "id": 261,
        "name": "Mandya",
        "name_kn": "ಮಂಡ್ಯ",
        "aliases": ["mandya"],
    },
    {
        "id": 263,
        "name": "Mysuru",
        "name_kn": "ಮೈಸೂರು",
        "aliases": ["mysuru", "mysore"],
    },
    {
        "id": 264,
        "name": "Raichur",
        "name_kn": "ರಾಯಚೂರು",
        "aliases": ["raichur"],
    },
    {
        "id": 266,
        "name": "Shivamogga",
        "name_kn": "ಶಿವಮೊಗ್ಗ",
        "aliases": ["shivamogga", "shimoga"],
    },
    {
        "id": 267,
        "name": "Tumakuru",
        "name_kn": "ತುಮಕೂರು",
        "aliases": ["tumakuru", "tumkur"],
    },
    {
        "id": 268,
        "name": "Udupi",
        "name_kn": "ಉಡುಪಿ",
        "aliases": ["udupi"],
    },
    {
        "id": 257,
        "name": "Uttara Kannada",
        "name_kn": "ಉತ್ತರ ಕನ್ನಡ",
        "aliases": ["uttara kannada", "karwar", "sirsi"],
    },
    {
        "id": 699,
        "name": "Vijayanagara",
        "name_kn": "ವಿಜಯನಗರ",
        "aliases": ["vijayanagara", "hospet", "hosapete"],
    },
    {
        "id": 247,
        "name": "Vijayapura",
        "name_kn": "ವಿಜಯಪುರ",
        "aliases": ["vijayapura", "bijapur"],
    },
    {
        "id": 269,
        "name": "Yadgir",
        "name_kn": "ಯಾದಗಿರಿ",
        "aliases": ["yadgir"],
    },
]

# Seven Priority Agricultural Crops for Karnataka
KARNATAKA_CROPS: list[dict[str, Any]] = [
    {
        "id": 4,
        "key": "maize",
        "name": "Maize",
        "name_kn": "ಮೆಕ್ಕೆಜೋಳ",
        "agmarknet_name": "Maize",
        "default_unit": "INR/quintal",
        "is_sugarcane": False,
        "aliases": ["maize", "makka", "corn", "ಮೆಕ್ಕೆಜೋಳ"],
    },
    {
        "id": 2,
        "key": "paddy",
        "name": "Paddy (Common)",
        "name_kn": "ಭತ್ತ",
        "agmarknet_name": "Paddy(Common)",
        "default_unit": "INR/quintal",
        "is_sugarcane": False,
        "aliases": ["paddy", "paddy(common)", "rice paddy", "ಭತ್ತ"],
    },
    {
        "id": 45,
        "key": "red_gram",
        "name": "Red Gram / Arhar / Tur (Whole)",
        "name_kn": "ತೊಗರಿ",
        "agmarknet_name": "Red gram/Arhar/Tur(whole)",
        "default_unit": "INR/quintal",
        "is_sugarcane": False,
        "aliases": ["red gram", "arhar", "tur", "tur whole", "pigeon pea", "ತೊಗರಿ"],
    },
    {
        "id": 10,
        "key": "groundnut",
        "name": "Groundnut",
        "name_kn": "ಕಡಲೆಕಾಯಿ",
        "agmarknet_name": "Groundnut",
        "default_unit": "INR/quintal",
        "is_sugarcane": False,
        "aliases": ["groundnut", "peanut", "ground nut", "ಕಡಲೆಕಾಯಿ"],
    },
    {
        "id": 30,
        "key": "ragi",
        "name": "Ragi / Finger Millet",
        "name_kn": "ರಾಗಿ",
        "agmarknet_name": "Ragi(Finger Millet)",
        "default_unit": "INR/quintal",
        "is_sugarcane": False,
        "aliases": ["ragi", "finger millet", "ragi(finger millet)", "ರಾಗಿ"],
    },
    {
        "id": 13,
        "key": "soybean",
        "name": "Soybean",
        "name_kn": "ಸೋಯಾಬೀನ್",
        "agmarknet_name": "Soyabean",
        "default_unit": "INR/quintal",
        "is_sugarcane": False,
        "aliases": ["soybean", "soyabean", "soya", "ಸೋಯಾಬೀನ್"],
    },
    {
        "id": 122,
        "key": "sugarcane",
        "name": "Sugarcane",
        "name_kn": "ಕಬ್ಬು",
        "agmarknet_name": "Sugarcane",
        "default_unit": "INR/tonne",
        "is_sugarcane": True,
        "frp_reference_per_tonne": 3400.0,  # Statutory FRP reference per tonne at 10.25% recovery
        "pricing_types": ["APMC Modal Price", "Sugar Mill Purchase Price / FRP Reference", "Farmer Direct Buyer Offer"],
        "aliases": ["sugarcane", "sugar cane", "ಕಬ್ಬು"],
    },
]


def find_district_by_name_or_alias(query_str: str | None) -> dict[str, Any] | None:
    if not query_str:
        return None
    normalized = query_str.strip().lower()
    for d in KARNATAKA_DISTRICTS:
        if d["name"].lower() == normalized or d["name_kn"] == query_str.strip():
            return d
        if any(alias in normalized for alias in d["aliases"]):
            return d
    return None


def find_crop_by_name_or_alias(query_str: str | None) -> dict[str, Any] | None:
    if not query_str:
        return None
    normalized = query_str.strip().lower()
    for c in KARNATAKA_CROPS:
        if c["name"].lower() == normalized or c["name_kn"] == query_str.strip() or c["key"] == normalized:
            return c
        if any(alias in normalized for alias in c["aliases"]):
            return c
    return None
