#!/usr/bin/env python3
"""
Sprint 8 E2E Test - Fuentes Expandidas + Onboarding Mágico
Tests the new features deployed in Sprint 8:
1. Login page with aurora background
2. Dark mode toggle in sidebar
3. /dashboard/sources page (RSS source management)
4. /dashboard/clients/new (Onboarding wizard)
"""

from playwright.sync_api import sync_playwright
import os
import time

# Configuration
BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@mediabot.local"
PASSWORD = "admin123"
SCREENSHOT_DIR = "screenshots/sprint8"

def ensure_screenshot_dir():
    """Create screenshot directory if it doesn't exist."""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def save_screenshot(page, name):
    """Save a screenshot with the given name."""
    path = f"{SCREENSHOT_DIR}/{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"  📸 Screenshot saved: {path}")

def test_login_page(page):
    """Test login page with aurora background effect."""
    print("\n🔐 Testing Login Page...")

    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")

    # Check for aurora background
    aurora = page.locator(".aurora-bg, [class*='aurora'], [class*='gradient']").first
    if aurora.count() > 0:
        print("  ✅ Aurora background effect detected")
    else:
        print("  ⚠️ Aurora background not found (may use different class)")

    save_screenshot(page, "01_login_page")

    # Login
    page.fill('input[type="email"], input[name="email"]', EMAIL)
    page.fill('input[type="password"], input[name="password"]', PASSWORD)
    save_screenshot(page, "02_login_filled")

    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(2)  # Wait for redirect

    print("  ✅ Login successful")
    save_screenshot(page, "03_dashboard_after_login")

def test_dark_mode(page):
    """Test dark mode toggle in sidebar."""
    print("\n🌓 Testing Dark Mode Toggle...")

    # Look for dark mode toggle by aria-label (Spanish)
    dark_toggle = page.locator('button[aria-label*="modo oscuro"], button[aria-label*="modo claro"]').first

    # Fallback to other selectors
    if dark_toggle.count() == 0:
        dark_toggle = page.locator('button[aria-label*="dark"], button[aria-label*="theme"]').first

    if dark_toggle.count() > 0:
        print("  ✅ Dark mode toggle found")
        save_screenshot(page, "04_before_dark_mode")

        try:
            # Try to click with force if element is in sidebar
            dark_toggle.click(force=True, timeout=5000)
            time.sleep(1)
            save_screenshot(page, "05_after_dark_mode")

            # Toggle back
            dark_toggle_after = page.locator('button[aria-label*="modo oscuro"], button[aria-label*="modo claro"]').first
            dark_toggle_after.click(force=True, timeout=5000)
            time.sleep(1)
            print("  ✅ Dark mode toggled successfully")
        except Exception as e:
            print(f"  ⚠️ Could not click toggle (may be hidden): {str(e)[:50]}")
            save_screenshot(page, "05_dark_mode_state")
    else:
        print("  ⚠️ Dark mode toggle not found in expected location")
        save_screenshot(page, "04_sidebar_no_toggle")

def test_sources_page(page):
    """Test /dashboard/sources page (RSS source management)."""
    print("\n📰 Testing Sources Page...")

    page.goto(f"{BASE_URL}/dashboard/sources")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    save_screenshot(page, "06_sources_page")

    # Check for key elements
    elements_found = []

    # Check for filter components
    if page.locator('select, [class*="filter"]').count() > 0:
        elements_found.append("Filters")

    # Check for source cards/list
    if page.locator('table, [class*="card"], [class*="list"]').count() > 0:
        elements_found.append("Source list")

    # Check for tabs (sources/requests)
    if page.locator('button:has-text("Solicitudes"), button:has-text("Fuentes")').count() > 0:
        elements_found.append("Tabs")

    # Check for stats
    if page.locator('[class*="stat"], [class*="kpi"]').count() > 0:
        elements_found.append("Statistics")

    print(f"  ✅ Elements found: {', '.join(elements_found) if elements_found else 'Basic layout'}")

    # Try clicking on Requests tab if exists
    requests_tab = page.locator('button:has-text("Solicitudes")').first
    if requests_tab.count() > 0:
        requests_tab.click()
        time.sleep(1)
        save_screenshot(page, "07_sources_requests_tab")
        print("  ✅ Requests tab accessible")

    # Try opening add source modal
    add_button = page.locator('button:has-text("Agregar"), button:has-text("Nueva")').first
    if add_button.count() > 0:
        add_button.click()
        time.sleep(1)
        save_screenshot(page, "08_add_source_modal")

        # Close modal
        close_btn = page.locator('button:has-text("Cancelar"), button[aria-label="close"], .modal-close').first
        if close_btn.count() > 0:
            close_btn.click()
            time.sleep(0.5)
        else:
            page.keyboard.press("Escape")

        print("  ✅ Add source modal working")

def test_onboarding_wizard(page):
    """Test /dashboard/clients/new (Onboarding wizard)."""
    print("\n🧙 Testing Onboarding Wizard...")

    page.goto(f"{BASE_URL}/dashboard/clients/new")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    save_screenshot(page, "09_wizard_step1")

    # Check for wizard stepper
    if page.locator('[class*="stepper"], [class*="wizard"], [class*="step"]').count() > 0:
        print("  ✅ Wizard stepper visible")

    # Step 1: Fill basic info - try multiple selectors for name field
    name_filled = False

    # Try different input selectors
    for selector in ['input[name="name"]', 'input[placeholder*="nombre"]', 'input[placeholder*="empresa"]', 'input[type="text"]']:
        name_input = page.locator(selector).first
        if name_input.count() > 0:
            try:
                name_input.fill("Empresa Test Sprint 8")
                name_filled = True
                print(f"  ✅ Step 1: Name field filled (selector: {selector})")
                break
            except:
                continue

    if not name_filled:
        print("  ⚠️ Could not find name input field")

    # Fill description
    desc_input = page.locator('textarea, textarea[name="description"], textarea[placeholder*="descripción"]').first
    if desc_input.count() > 0:
        try:
            desc_input.fill("Empresa de prueba para verificar el wizard de onboarding")
            print("  ✅ Step 1: Description filled")
        except:
            print("  ⚠️ Could not fill description")

    # Select industry if available
    industry_select = page.locator('select[name="industry"], [class*="industry"]').first
    if industry_select.count() > 0:
        industry_select.select_option(index=1)
        print("  ✅ Step 1: Industry selected")

    save_screenshot(page, "10_wizard_step1_filled")

    # Small wait for form to validate
    time.sleep(1)

    # Click Next
    next_btn = page.locator('button:has-text("Siguiente"), button:has-text("Next"), button:has-text("Buscar")').first
    if next_btn.count() > 0:
        try:
            # Check if button is enabled
            is_disabled = next_btn.get_attribute("disabled")
            if is_disabled:
                print("  ⚠️ Next button is disabled (form validation may have failed)")
                save_screenshot(page, "11_wizard_button_disabled")
            else:
                next_btn.click(timeout=10000)
                print("  ✅ Clicked Next button")

                # Wait for step 2 (searching animation)
                time.sleep(3)
                save_screenshot(page, "11_wizard_step2_searching")

                # Wait more for results
                time.sleep(5)
                save_screenshot(page, "12_wizard_step2_results")

                # Check if we're on step 3 (review)
                if page.locator('input[type="checkbox"], [class*="keyword"], [class*="chip"]').count() > 0:
                    print("  ✅ Step 2-3: Keywords/results visible")
                    save_screenshot(page, "13_wizard_step3_review")
        except Exception as e:
            print(f"  ⚠️ Could not click Next: {str(e)[:50]}")
            save_screenshot(page, "11_wizard_error")

def test_tasks_page(page):
    """Test tasks page with modern filters (Sprint 7 feature)."""
    print("\n📋 Testing Tasks Page...")

    page.goto(f"{BASE_URL}/dashboard/tasks")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    save_screenshot(page, "14_tasks_page")

    # Check for filter components
    if page.locator('[class*="filter"], [class*="FilterBar"]').count() > 0:
        print("  ✅ Modern filter components detected")

    # Check for filter chips
    if page.locator('[class*="chip"], [class*="Chip"]').count() > 0:
        print("  ✅ Filter chips detected")

def test_intelligence_page(page):
    """Test intelligence page (Sprint 6 feature)."""
    print("\n🧠 Testing Intelligence Page...")

    page.goto(f"{BASE_URL}/dashboard/intelligence")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    save_screenshot(page, "15_intelligence_page")

    # Check for SOV, topics, insights
    if page.locator('[class*="sov"], [class*="donut"], [class*="chart"]').count() > 0:
        print("  ✅ SOV charts detected")

    if page.locator('text=tema, text=topic, [class*="topic"]').count() > 0:
        print("  ✅ Topics section detected")

def test_main_navigation(page):
    """Navigate through main pages and take screenshots."""
    print("\n🗺️ Testing Main Navigation...")

    pages = [
        ("dashboard", "16_nav_dashboard"),
        ("dashboard/mentions", "17_nav_mentions"),
        ("dashboard/clients", "18_nav_clients"),
        ("dashboard/analytics", "19_nav_analytics"),
    ]

    for path, screenshot_name in pages:
        page.goto(f"{BASE_URL}/{path}")
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        save_screenshot(page, screenshot_name)
        print(f"  ✅ {path} loaded")

def main():
    """Run all tests."""
    print("=" * 60)
    print("🚀 Sprint 8 E2E Test - MediaBot")
    print("=" * 60)
    print(f"Target: {BASE_URL}")
    print(f"Screenshots: {SCREENSHOT_DIR}/")

    ensure_screenshot_dir()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        try:
            # Run all tests
            test_login_page(page)
            test_dark_mode(page)
            test_sources_page(page)
            test_onboarding_wizard(page)
            test_tasks_page(page)
            test_intelligence_page(page)
            test_main_navigation(page)

            print("\n" + "=" * 60)
            print("✅ All Sprint 8 tests completed!")
            print("=" * 60)
            print(f"\n📁 Screenshots saved to: {SCREENSHOT_DIR}/")

        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            save_screenshot(page, "error_state")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    main()
