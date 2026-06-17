import time
import json
import requests
from config import GOOGLE_MAPS_API_KEY, query, execute

PLACES_URL = "https://maps.googleapis.com/maps/api/place"


def search_places(keyword: str, city: str, country: str, radius_km: int = 25) -> list:
    """Search Google Maps for businesses matching keyword + location."""
    # Geocode the city
    geo = requests.get(f"{PLACES_URL}/findplacefromtext/json", params={
        "input": f"{city}, {country}",
        "inputtype": "textquery",
        "fields": "geometry",
        "key": GOOGLE_MAPS_API_KEY,
    }).json()

    candidates = geo.get("candidates", [])
    if not candidates:
        print(f"    Could not geocode: {city}, {country}")
        return []

    loc = candidates[0]["geometry"]["location"]
    results = []
    page_token = None

    while True:
        params = {
            "query": f"{keyword} in {city}",
            "location": f"{loc['lat']},{loc['lng']}",
            "radius": radius_km * 1000,
            "key": GOOGLE_MAPS_API_KEY,
        }
        if page_token:
            params["pagetoken"] = page_token

        res = requests.get(f"{PLACES_URL}/textsearch/json", params=params).json()
        results.extend(res.get("results", []))
        page_token = res.get("next_page_token")

        if not page_token or len(results) >= 60:
            break
        time.sleep(2)  # Google requires delay before using next_page_token

    return results


def get_place_details(place_id: str) -> dict:
    """Get detailed info for a single place."""
    res = requests.get(f"{PLACES_URL}/details/json", params={
        "place_id": place_id,
        "fields": "name,formatted_phone_number,website,formatted_address,geometry,rating,user_ratings_total,business_status",
        "key": GOOGLE_MAPS_API_KEY,
    }).json()
    return res.get("result", {})


def scrape_campaign(campaign: dict) -> int:
    """Scrape leads for a single campaign. Returns count of new leads."""
    print(f"[Scraper] Running: {campaign['name']}")
    all_places = []
    keywords = campaign.get("keywords", [campaign["niche"]])

    for keyword in keywords:
        print(f"    Searching: \"{keyword}\" in {campaign['city']}, {campaign['country_code']}")
        places = search_places(keyword, campaign["city"], campaign["country_code"], campaign.get("radius_km", 25))
        all_places.extend(places)
        time.sleep(0.5)

    # Deduplicate by place_id
    unique = {}
    for p in all_places:
        pid = p.get("place_id")
        if pid and pid not in unique:
            unique[pid] = p

    print(f"    Found {len(unique)} unique businesses (from {len(all_places)} total)")

    new_count = 0
    for place_id, place in unique.items():
        try:
            # Skip if already in DB
            existing = query("SELECT id FROM leads WHERE google_place_id = %s", (place_id,))
            if existing:
                continue

            # Get details
            details = get_place_details(place_id)
            if not details or details.get("business_status") == "CLOSED_PERMANENTLY":
                continue

            geo = details.get("geometry", {}).get("location", {})

            execute("""
                INSERT INTO leads (campaign_id, google_place_id, business_name, niche, phone,
                    website_url, address, city, country_code, latitude, longitude,
                    google_rating, review_count, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'new')
                ON CONFLICT (google_place_id) DO NOTHING
            """, (
                campaign["id"], place_id, details.get("name", "Unknown"),
                campaign["niche"], details.get("formatted_phone_number"),
                details.get("website"), details.get("formatted_address"),
                campaign["city"], campaign["country_code"],
                geo.get("lat"), geo.get("lng"),
                details.get("rating"), details.get("user_ratings_total", 0),
            ))

            execute("""
                INSERT INTO activity_log (type, campaign_id, message, metadata)
                VALUES ('scrape', %s, %s, %s)
            """, (campaign["id"], f"Found: {details.get('name', 'Unknown')}",
                  json.dumps({"place_id": place_id})))

            new_count += 1
            time.sleep(0.2)
        except Exception as e:
            print(f"    Error: {e}")

    execute("UPDATE campaigns SET last_run_at = now() WHERE id = %s", (campaign["id"],))
    print(f"    Stored {new_count} new leads")
    return new_count


def scrape_all_active() -> int:
    """Scrape all active campaigns."""
    campaigns = query("SELECT * FROM campaigns WHERE status = 'active'")
    total = 0
    for c in campaigns:
        total += scrape_campaign(c)
    print(f"[Scraper] Total new leads: {total}")
    return total


def create_campaign(name, niche, keywords, city, country_code="US", region=None, radius_km=25, send_limit=15) -> dict:
    """Create a new campaign and return it."""
    # Format keywords as PostgreSQL array
    kw_str = "{" + ",".join(keywords) + "}"
    execute("""
        INSERT INTO campaigns (name, niche, keywords, city, region, country_code, radius_km, send_limit)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (name, niche, kw_str, city, region, country_code, radius_km, send_limit))
    return query("SELECT * FROM campaigns WHERE name = %s", (name,))[0]
