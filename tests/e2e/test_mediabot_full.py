#!/usr/bin/env python3
"""
MediaBot E2E Test Script
Tests all pages, captures screenshots, and verifies UI components.
Updated for Sprint 5: Tests filter components and timeline.
"""

from playwright.sync_api import sync_playwright
import os
from datetime import datetime

# Configuration
BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@mediabot.local"
PASSWORD = "admin123"
SCREENSHOT_DIR = "/Users/master/Downloads/news-agent/screenshots/e2e"

# Menu items to test
MENU_ITEMS = [
    {"name": "Dashboard", "path": "/dashboard", "exact": True},
    {"name": "Clientes", "path": "/dashboard/clients"},
    {"name": "Menciones", "path": "/dashboard/mentions"},
    {"name": "Analiticas", "path": "/dashboard/analytics"},
    {"name": "Tareas", "path": "/dashboard/tasks"},
    {"name": "Equipo", "path": "/dashboard/team"},
    {"name": "Configuracion", "path": "/dashboard/settings"},
]


def ensure_screenshot_dir():
    """Create screenshot directory if it doesn't exist."""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print(f"Screenshots will be saved to: {SCREENSHOT_DIR}")


def take_screenshot(page, name):
    """Take a screenshot with timestamp."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{SCREENSHOT_DIR}/{timestamp}_{name}.png"
    page.screenshot(path=filename, full_page=True)
    print(f"  Screenshot: {filename}")
    return filename


def discover_elements(page, page_name):
    """Discover and report all interactive elements on a page."""
    print(f"\n  === Elements on {page_name} ===")

    # Buttons
    buttons = page.locator('button').all()
    visible_buttons = [b for b in buttons if b.is_visible()]
    print(f"  Buttons ({len(visible_buttons)} visible):")
    for btn in visible_buttons[:10]:
        try:
            text = btn.inner_text().strip()[:50] or "[no text]"
            print(f"    - {text}")
        except:
            pass

    # Links
    links = page.locator('a[href]').all()
    visible_links = [l for l in links if l.is_visible()]
    print(f"  Links ({len(visible_links)} visible):")
    for link in visible_links[:10]:
        try:
            text = link.inner_text().strip()[:30] or "[no text]"
            href = link.get_attribute('href') or ""
            print(f"    - {text} -> {href[:50]}")
        except:
            pass

    # Forms/Inputs
    inputs = page.locator('input, textarea, select').all()
    visible_inputs = [i for i in inputs if i.is_visible()]
    print(f"  Inputs ({len(visible_inputs)} visible):")
    for inp in visible_inputs[:10]:
        try:
            name = inp.get_attribute('name') or inp.get_attribute('placeholder') or inp.get_attribute('id') or "[unnamed]"
            inp_type = inp.get_attribute('type') or 'text'
            print(f"    - {name} ({inp_type})")
        except:
            pass

    return {
        "buttons": len(visible_buttons),
        "links": len(visible_links),
        "inputs": len(visible_inputs)
    }


def test_login(page):
    """Test the login flow."""
    print("\n=== Testing Login ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    # Take screenshot of login page
    take_screenshot(page, "01_login_page")

    # Check if we're on login page
    if "/login" in page.url or page.locator('input[type="email"], input[name="email"]').count() > 0:
        print("  On login page, filling credentials...")

        # Fill email
        email_input = page.locator('input[type="email"], input[name="email"]').first
        email_input.fill(EMAIL)

        # Fill password
        password_input = page.locator('input[type="password"]').first
        password_input.fill(PASSWORD)

        take_screenshot(page, "02_login_filled")

        # Submit
        submit_btn = page.locator('button[type="submit"]').first
        submit_btn.click()

        # Wait for navigation - give more time for auth
        print("  Waiting for authentication...")
        try:
            page.wait_for_url("**/dashboard**", timeout=15000)
        except:
            # If timeout, check current state
            page.wait_for_timeout(3000)

        take_screenshot(page, "03_after_login")

        if "/dashboard" in page.url:
            print("  Login successful!")
            return True
        else:
            print(f"  Login may have failed. Current URL: {page.url}")
            # Check for error messages
            error_msg = page.locator('text=error, text=Error, text=invalid, text=Invalid').first
            if error_msg.is_visible():
                print(f"  Error message: {error_msg.inner_text()}")
            return False
    else:
        print("  Already logged in or unexpected page")
        return True


def test_menu_navigation(page):
    """Test navigation through all menu items."""
    print("\n=== Testing Menu Navigation ===")
    results = {}

    for i, menu in enumerate(MENU_ITEMS):
        print(f"\n--- {menu['name']} ({menu['path']}) ---")

        try:
            # Navigate to page
            page.goto(f"{BASE_URL}{menu['path']}")
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1500)  # Extra wait for charts to render

            # Check URL
            current_url = page.url
            print(f"  URL: {current_url}")

            # Take screenshot
            screenshot_name = f"{i+4:02d}_{menu['name'].lower().replace(' ', '_')}"
            take_screenshot(page, screenshot_name)

            # Discover elements
            elements = discover_elements(page, menu['name'])

            results[menu['name']] = {
                "status": "OK",
                "url": current_url,
                "elements": elements
            }

        except Exception as e:
            print(f"  ERROR: {str(e)}")
            results[menu['name']] = {
                "status": "ERROR",
                "error": str(e)
            }

    return results


def test_sprint5_features(page):
    """Test Sprint 5 specific features: filters and timeline."""
    print("\n=== Testing Sprint 5 Features ===")
    results = {}

    # Test Dashboard Timeline
    print("\n--- Dashboard Timeline ---")
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    timeline_items = page.locator('.timeline-item').all()
    print(f"  Timeline items: {len(timeline_items)}")
    results['timeline_items'] = len(timeline_items)

    # Test Mentions Filters
    print("\n--- Mentions Filters ---")
    page.goto(f"{BASE_URL}/dashboard/mentions")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    filter_selects = page.locator('select').all()
    date_presets = page.locator('button:has-text("dias"), button:has-text("Hoy")').all()
    print(f"  Filter selects: {len(filter_selects)}")
    print(f"  Date presets: {len(date_presets)}")
    results['mentions_filter_selects'] = len(filter_selects)
    results['mentions_date_presets'] = len(date_presets)

    # Test Analytics Multi-select
    print("\n--- Analytics Filters ---")
    page.goto(f"{BASE_URL}/dashboard/analytics")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)

    multi_buttons = page.locator('button[class*="rounded-full"]').all()
    print(f"  Multi-select buttons: {len(multi_buttons)}")
    results['analytics_multi_buttons'] = len(multi_buttons)

    # Test Clients Filters
    print("\n--- Clients Filters ---")
    page.goto(f"{BASE_URL}/dashboard/clients")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    search_input = page.locator('input[placeholder*="Buscar"]').first
    client_selects = page.locator('select').all()
    print(f"  Search input visible: {search_input.is_visible() if search_input.count() > 0 else False}")
    print(f"  Filter selects: {len(client_selects)}")
    results['clients_search_visible'] = search_input.is_visible() if search_input.count() > 0 else False
    results['clients_filter_selects'] = len(client_selects)

    return results


def test_client_detail(page):
    """Test client detail page if clients exist."""
    print("\n=== Testing Client Detail Page ===")

    page.goto(f"{BASE_URL}/dashboard/clients")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Find first client link
    client_links = page.locator('a[href*="/dashboard/clients/"]').all()
    if len(client_links) > 0:
        # Click first client
        first_client = client_links[0]
        client_name = first_client.inner_text().strip()
        print(f"  Clicking on client: {client_name}")
        first_client.click()

        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1500)

        take_screenshot(page, "11_client_detail")
        discover_elements(page, "Client Detail")

        return {"status": "OK", "client": client_name}
    else:
        print("  No clients found")
        return {"status": "NO_CLIENTS"}


def test_mention_detail(page):
    """Test mention detail page if mentions exist."""
    print("\n=== Testing Mention Detail Page ===")

    page.goto(f"{BASE_URL}/dashboard/mentions")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Find first mention link
    mention_links = page.locator('a[href*="/dashboard/mentions/"]').all()
    if len(mention_links) > 0:
        first_mention = mention_links[0]
        print(f"  Clicking on first mention...")
        first_mention.click()

        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1500)

        take_screenshot(page, "12_mention_detail")
        discover_elements(page, "Mention Detail")

        return {"status": "OK"}
    else:
        print("  No mentions found")
        return {"status": "NO_MENTIONS"}


def main():
    print("=" * 60)
    print("MediaBot E2E Test")
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)

    ensure_screenshot_dir()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            # Test login
            login_ok = test_login(page)

            if login_ok:
                # Test all menu items
                menu_results = test_menu_navigation(page)

                # Test Sprint 5 features
                sprint5_results = test_sprint5_features(page)

                # Test detail pages
                client_result = test_client_detail(page)
                mention_result = test_mention_detail(page)

                # Summary
                print("\n" + "=" * 60)
                print("TEST SUMMARY")
                print("=" * 60)

                print("\nMenu Pages:")
                for name, result in menu_results.items():
                    status = result.get("status", "UNKNOWN")
                    elements = result.get("elements", {})
                    print(f"  {name}: {status} (buttons: {elements.get('buttons', '?')}, links: {elements.get('links', '?')}, inputs: {elements.get('inputs', '?')})")

                print("\nSprint 5 Features:")
                for key, value in sprint5_results.items():
                    print(f"  {key}: {value}")

                print(f"\nClient Detail: {client_result.get('status')}")
                print(f"Mention Detail: {mention_result.get('status')}")

            else:
                print("\nLogin failed, cannot continue tests")

        except Exception as e:
            print(f"\nFATAL ERROR: {str(e)}")
            take_screenshot(page, "error_state")

        finally:
            browser.close()

    print(f"\nScreenshots saved to: {SCREENSHOT_DIR}")
    print("Test complete!")


if __name__ == "__main__":
    main()
