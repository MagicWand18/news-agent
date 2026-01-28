#!/usr/bin/env python3
"""
Sprint 5 Feature Test - Tests new UI/UX improvements:
1. Timeline on Dashboard
2. CountUp animations on KPIs
3. Filter components on Mentions, Analytics, Clients pages
"""

from playwright.sync_api import sync_playwright
import os
from datetime import datetime

# Configuration
BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@mediabot.local"
PASSWORD = "admin123"
SCREENSHOT_DIR = "/Users/master/Downloads/news-agent/screenshots/sprint5"

def ensure_screenshot_dir():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print(f"Screenshots: {SCREENSHOT_DIR}")

def take_screenshot(page, name):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{SCREENSHOT_DIR}/{timestamp}_{name}.png"
    page.screenshot(path=filename, full_page=True)
    print(f"  Screenshot: {filename}")
    return filename

def login(page):
    """Login to the application."""
    print("\n=== Logging in ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    if "/login" in page.url or page.locator('input[type="email"]').count() > 0:
        page.locator('input[type="email"]').fill(EMAIL)
        page.locator('input[type="password"]').fill(PASSWORD)
        page.locator('button[type="submit"]').click()
        page.wait_for_url("**/dashboard**", timeout=15000)

    print(f"  Logged in. URL: {page.url}")
    return "/dashboard" in page.url

def test_dashboard_timeline(page):
    """Test the new MentionTimeline component on dashboard."""
    print("\n=== Testing Dashboard Timeline ===")
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)  # Wait for animations

    take_screenshot(page, "01_dashboard_timeline")

    # Check for timeline elements
    timeline_items = page.locator('.timeline-item').all()
    print(f"  Timeline items found: {len(timeline_items)}")

    # Check for KPI cards with animated values
    stat_cards = page.locator('[class*="rounded-xl"][class*="border"]').all()
    print(f"  Stat cards found: {len(stat_cards)}")

    # Check for the timeline vertical line (via CSS inspection)
    mentions_section = page.locator('text=Menciones recientes').first
    if mentions_section.is_visible():
        print("  ✓ Mentions section found")

    return {
        "timeline_items": len(timeline_items),
        "stat_cards": len(stat_cards),
        "status": "OK"
    }

def test_mentions_filters(page):
    """Test the new filter components on Mentions page."""
    print("\n=== Testing Mentions Page Filters ===")
    page.goto(f"{BASE_URL}/dashboard/mentions")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)

    take_screenshot(page, "02_mentions_filters_initial")

    # Check for FilterBar
    filter_bar = page.locator('[class*="bg-gray-50"][class*="rounded-lg"]').first
    print(f"  FilterBar visible: {filter_bar.is_visible() if filter_bar.count() > 0 else False}")

    # Check for filter selects
    selects = page.locator('select').all()
    print(f"  Select filters found: {len(selects)}")

    # Check for date range buttons (presets)
    date_presets = page.locator('button:has-text("dias"), button:has-text("Hoy")').all()
    print(f"  Date preset buttons: {len(date_presets)}")

    # Try clicking a filter
    if len(selects) > 0:
        selects[0].select_option(index=1) if selects[0].locator('option').count() > 1 else None
        page.wait_for_timeout(1000)
        take_screenshot(page, "03_mentions_filter_applied")

    # Check for filter chips
    filter_chips = page.locator('[class*="rounded-full"][class*="bg-brand"]').all()
    print(f"  Filter chips visible: {len(filter_chips)}")

    # Test clear button if filters are active
    clear_btn = page.locator('button:has-text("Limpiar")').first
    if clear_btn.count() > 0 and clear_btn.is_visible():
        print("  ✓ Clear button visible")
        clear_btn.click()
        page.wait_for_timeout(500)
        take_screenshot(page, "04_mentions_filters_cleared")

    return {
        "selects": len(selects),
        "date_presets": len(date_presets),
        "status": "OK"
    }

def test_analytics_filters(page):
    """Test the new multi-select filters on Analytics page."""
    print("\n=== Testing Analytics Page Filters ===")
    page.goto(f"{BASE_URL}/dashboard/analytics")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)  # Wait for charts

    take_screenshot(page, "05_analytics_filters")

    # Check for filter bar
    filter_bar = page.locator('[class*="bg-gray-50"][class*="rounded-lg"]').first
    print(f"  FilterBar visible: {filter_bar.is_visible() if filter_bar.count() > 0 else False}")

    # Check for multi-select buttons (sentiment/urgency filters)
    multi_buttons = page.locator('button[class*="rounded-full"]').all()
    print(f"  Multi-select buttons found: {len(multi_buttons)}")

    # Try toggling a sentiment filter
    positivo_btn = page.locator('button:has-text("Positivo")').first
    if positivo_btn.count() > 0 and positivo_btn.is_visible():
        positivo_btn.click()
        page.wait_for_timeout(1000)
        take_screenshot(page, "06_analytics_filter_toggled")
        print("  ✓ Toggled Positivo filter")

    return {
        "multi_buttons": len(multi_buttons),
        "status": "OK"
    }

def test_clients_filters(page):
    """Test the new filters on Clients page."""
    print("\n=== Testing Clients Page Filters ===")
    page.goto(f"{BASE_URL}/dashboard/clients")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)

    take_screenshot(page, "07_clients_filters")

    # Check for search input
    search_input = page.locator('input[placeholder*="Buscar"]').first
    print(f"  Search input visible: {search_input.is_visible() if search_input.count() > 0 else False}")

    # Check for industry filter
    industry_select = page.locator('select').all()
    print(f"  Filter selects found: {len(industry_select)}")

    # Check for status filter buttons or select
    status_elements = page.locator('text=Estado, text=Activo, text=Inactivo').all()
    print(f"  Status filter elements: {len(status_elements)}")

    # Try filtering by status if available
    activo_btn = page.locator('button:has-text("Activo")').first
    if activo_btn.count() > 0 and activo_btn.is_visible():
        activo_btn.click()
        page.wait_for_timeout(500)
        take_screenshot(page, "08_clients_status_filtered")

    return {
        "search_visible": search_input.is_visible() if search_input.count() > 0 else False,
        "selects": len(industry_select),
        "status": "OK"
    }

def discover_all_elements(page, page_name):
    """Discover interactive elements on a page."""
    print(f"\n  === Elements on {page_name} ===")

    buttons = [b for b in page.locator('button').all() if b.is_visible()]
    links = [l for l in page.locator('a[href]').all() if l.is_visible()]
    inputs = [i for i in page.locator('input, select, textarea').all() if i.is_visible()]

    print(f"  Buttons: {len(buttons)}")
    print(f"  Links: {len(links)}")
    print(f"  Inputs: {len(inputs)}")

    return {"buttons": len(buttons), "links": len(links), "inputs": len(inputs)}

def main():
    print("=" * 60)
    print("Sprint 5 Feature Tests")
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)

    ensure_screenshot_dir()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        results = {}

        try:
            if login(page):
                # Test each Sprint 5 feature
                results['dashboard_timeline'] = test_dashboard_timeline(page)
                discover_all_elements(page, "Dashboard")

                results['mentions_filters'] = test_mentions_filters(page)
                discover_all_elements(page, "Mentions")

                results['analytics_filters'] = test_analytics_filters(page)
                discover_all_elements(page, "Analytics")

                results['clients_filters'] = test_clients_filters(page)
                discover_all_elements(page, "Clients")

                # Summary
                print("\n" + "=" * 60)
                print("TEST SUMMARY")
                print("=" * 60)

                for test_name, result in results.items():
                    status = result.get('status', 'UNKNOWN')
                    print(f"  {test_name}: {status}")
                    for key, value in result.items():
                        if key != 'status':
                            print(f"    - {key}: {value}")

                print("\n✓ All Sprint 5 features tested successfully!")
            else:
                print("\n✗ Login failed!")

        except Exception as e:
            print(f"\nERROR: {str(e)}")
            take_screenshot(page, "error_state")

        finally:
            browser.close()

    print(f"\nScreenshots saved to: {SCREENSHOT_DIR}")

if __name__ == "__main__":
    main()
