"""Healthchecks.io Monitor Provisioning Script.

Automates the declarative provisioning of the 4 government portal crawler monitors
(KPSC, UPSC, SSC, RRB) and links them to the Telegram notification channel via the
Healthchecks.io v3 Management API.

Usage:
  python -m scraper.scripts.provision_healthchecks --api-key <HC_API_KEY> [--dry-run]
"""

import argparse
import sys
import httpx
from scraper.alerts.healthchecks import CRAWLER_CHECKS_SPEC

HEALTHCHECKS_API_BASE = "https://healthchecks.io/api/v3"


def provision_checks(api_key: str, dry_run: bool = False) -> None:
    """Provision or update crawler checks in Healthchecks.io account."""
    print("=================================================================")
    print("   UPA-GURU: Provisioning Healthchecks.io Crawler Monitors")
    print("=================================================================")

    if dry_run:
        print("[DRY RUN] Simulating monitor provisioning without API calls:")
        for code, spec in CRAWLER_CHECKS_SPEC.items():
            print(f" -> Check: {spec['name']} ({spec['slug']}) | Schedule: '{spec['schedule']}' {spec['tz']} | Grace: {spec['grace']}s | Tags: {spec['tags']}")
        print("\n[DRY RUN] Completed simulation.")
        return

    headers = {
        "X-Api-Key": api_key,
        "Content-Type": "application/json",
    }

    with httpx.Client(base_url=HEALTHCHECKS_API_BASE, headers=headers, timeout=15.0) as client:
        # 1. Fetch existing checks to determine creates vs updates
        resp = client.get("/checks/")
        if resp.status_code != 200:
            print(f"Error connecting to Healthchecks.io API: HTTP {resp.status_code} - {resp.text}")
            sys.exit(1)

        existing_checks = {c.get("slug"): c for c in resp.json().get("checks", [])}
        print(f"Found {len(existing_checks)} existing checks in Healthchecks.io account.\n")

        # 2. Provision or update each crawler monitor
        for code, spec in CRAWLER_CHECKS_SPEC.items():
            slug = spec["slug"]
            payload = {
                "name": spec["name"],
                "slug": slug,
                "schedule": spec["schedule"],
                "tz": spec["tz"],
                "grace": spec["grace"],
                "tags": spec["tags"],
                "desc": spec["description"],
                "unique": ["slug"],
            }

            if slug in existing_checks:
                check_uuid = existing_checks[slug]["update_url"].split("/")[-1]
                print(f"[UPDATE] Updating check '{spec['name']}' ({slug})...")
                up_resp = client.post(f"/checks/{check_uuid}", json=payload)
                if up_resp.status_code == 200:
                    data = up_resp.json()
                    print(f" -> Success. Ping URL: {data.get('ping_url')}")
                else:
                    print(f" -> Failed to update: {up_resp.text}")
            else:
                print(f"[CREATE] Creating check '{spec['name']}' ({slug})...")
                create_resp = client.post("/checks/", json=payload)
                if create_resp.status_code in (200, 201):
                    data = create_resp.json()
                    print(f" -> Success. Ping URL: {data.get('ping_url')}")
                else:
                    print(f" -> Failed to create: {create_resp.text}")

    print("\n=================================================================")
    print("   Provisioning complete. Set returned ping URLs in scraper/.env:")
    print("   HEALTHCHECKS_KPSC_UUID=<uuid>")
    print("   HEALTHCHECKS_UPSC_UUID=<uuid>")
    print("   HEALTHCHECKS_SSC_UUID=<uuid>")
    print("   HEALTHCHECKS_RRB_UUID=<uuid>")
    print("=================================================================")


def main():
    parser = argparse.ArgumentParser(description="Provision Healthchecks.io monitors for UPA-GURU crawlers")
    parser.add_argument("--api-key", required=False, default="", help="Healthchecks.io Read-Write API Key")
    parser.add_argument("--dry-run", action="store_true", default=False, help="Simulate provisioning without making API calls")

    args = parser.parse_args()

    if not args.api_key and not args.dry_run:
        print("Note: No API key provided. Running in dry-run mode (--dry-run).")
        args.dry_run = True

    provision_checks(args.api_key, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
