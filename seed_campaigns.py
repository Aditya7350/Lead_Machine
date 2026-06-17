"""Run once: python seed_campaigns.py"""
from config import execute, query

CAMPAIGNS = [
    ("dentists-austin-tx", "dentists", "{dentist,dental clinic,dental office,family dentist,cosmetic dentist}", "Austin", "TX", "US"),
    ("plumbers-exeter-uk", "plumbers", "{plumber,plumbing services,emergency plumber,heating engineer}", "Exeter", "Devon", "GB"),
    ("restaurants-nashik-in", "restaurants", "{restaurant,cafe,dining,family restaurant}", "Nashik", "Maharashtra", "IN"),
]

if __name__ == "__main__":
    for name, niche, keywords, city, region, country in CAMPAIGNS:
        existing = query("SELECT id FROM campaigns WHERE name = %s", (name,))
        if existing:
            print(f"  ⊘ Already exists: {name}")
            continue
        execute("""
            INSERT INTO campaigns (name, niche, keywords, city, region, country_code)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (name, niche, keywords, city, region, country))
        print(f"  ✓ Created: {name}")
    print("\n✓ Seed complete!")
