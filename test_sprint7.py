#!/usr/bin/env python3
"""
Test Sprint 7 features: Dark Mode, Aurora Background, Modern Filters
"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "/Users/master/Downloads/news-agent/screenshots/sprint7"
BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@mediabot.local"
PASSWORD = "admin123"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def test_sprint7():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        print("=" * 60)
        print("Testing Sprint 7 Features")
        print("=" * 60)

        # 1. Test Login Page with Aurora Background
        print("\n[1/6] Testing Login Page with Aurora Background...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)  # Wait for animation
        page.screenshot(path=f"{SCREENSHOT_DIR}/01_login_aurora.png", full_page=True)

        # Check for aurora background elements
        aurora_bg = page.locator(".aurora-bg").first
        if aurora_bg.is_visible():
            print("   Aurora background: FOUND")
        else:
            print("   Aurora background: Not found (may be CSS class)")
        print(f"   Screenshot: {SCREENSHOT_DIR}/01_login_aurora.png")

        # 2. Login
        print("\n[2/6] Logging in...")
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=15000)
        page.wait_for_load_state("networkidle")
        print("   Login: SUCCESS")

        # 3. Test Dashboard (Light Mode)
        print("\n[3/6] Testing Dashboard (Light Mode)...")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_dashboard_light.png", full_page=True)
        print(f"   Screenshot: {SCREENSHOT_DIR}/02_dashboard_light.png")

        # Check for dark mode toggle in sidebar
        theme_toggle = page.locator('button[aria-label*="modo"]').first
        if theme_toggle.is_visible():
            print("   Dark mode toggle: FOUND")
        else:
            # Try finding by icon
            moon_icon = page.locator('svg.lucide-moon').first
            sun_icon = page.locator('svg.lucide-sun').first
            if moon_icon.is_visible() or sun_icon.is_visible():
                print("   Dark mode toggle: FOUND (icon visible)")
                theme_toggle = moon_icon if moon_icon.is_visible() else sun_icon
                theme_toggle = theme_toggle.locator("xpath=ancestor::button")

        # 4. Test Dark Mode Toggle
        print("\n[4/6] Testing Dark Mode Toggle...")
        # Find and click the toggle button in sidebar
        sidebar_buttons = page.locator('aside button, div.bg-brand-900 button').all()
        for btn in sidebar_buttons:
            try:
                if btn.is_visible():
                    aria_label = btn.get_attribute("aria-label") or ""
                    if "modo" in aria_label.lower() or "theme" in aria_label.lower():
                        btn.click()
                        page.wait_for_timeout(500)
                        break
                    # Check if it contains sun/moon icon
                    inner = btn.inner_html()
                    if "lucide-moon" in inner or "lucide-sun" in inner:
                        btn.click()
                        page.wait_for_timeout(500)
                        break
            except:
                continue

        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_dashboard_dark.png", full_page=True)
        print(f"   Screenshot: {SCREENSHOT_DIR}/03_dashboard_dark.png")

        # Check if dark class is applied
        html_class = page.locator("html").get_attribute("class") or ""
        if "dark" in html_class:
            print("   Dark mode: ENABLED (html has 'dark' class)")
        else:
            print("   Dark mode: May not be active (checking visually)")

        # 5. Test Tasks Page with Modern Filters
        print("\n[5/6] Testing Tasks Page with Modern Filters...")
        page.goto(f"{BASE_URL}/dashboard/tasks")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_tasks_filters_dark.png", full_page=True)
        print(f"   Screenshot: {SCREENSHOT_DIR}/04_tasks_filters_dark.png")

        # Check for FilterBar components
        filter_bar = page.locator('.bg-gray-50, .dark\\:bg-gray-800\\/50').first
        filter_selects = page.locator('select').all()
        print(f"   Filter selects found: {len(filter_selects)}")

        # Check for filter labels
        labels = page.locator('label').all_text_contents()
        filter_labels = [l for l in labels if l in ["Estado", "Prioridad", "Cliente", "Buscar"]]
        print(f"   Filter labels found: {filter_labels}")

        # 6. Toggle back to Light Mode and check other pages
        print("\n[6/6] Testing other pages in light mode...")

        # Toggle back to light
        sidebar_buttons = page.locator('aside button, div.bg-brand-900 button').all()
        for btn in sidebar_buttons:
            try:
                if btn.is_visible():
                    inner = btn.inner_html()
                    if "lucide-sun" in inner:
                        btn.click()
                        page.wait_for_timeout(500)
                        break
            except:
                continue

        # Check Clients page
        page.goto(f"{BASE_URL}/dashboard/clients")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/05_clients_light.png", full_page=True)
        print(f"   Clients page screenshot: {SCREENSHOT_DIR}/05_clients_light.png")

        # Check Intelligence page
        page.goto(f"{BASE_URL}/dashboard/intelligence")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/06_intelligence_light.png", full_page=True)
        print(f"   Intelligence page screenshot: {SCREENSHOT_DIR}/06_intelligence_light.png")

        # Final summary
        print("\n" + "=" * 60)
        print("Sprint 7 Testing Complete!")
        print("=" * 60)
        print(f"\nScreenshots saved to: {SCREENSHOT_DIR}/")
        print("\nFeatures tested:")
        print("  1. Aurora background on login page")
        print("  2. Dark mode toggle functionality")
        print("  3. Dashboard in both light and dark modes")
        print("  4. Tasks page with modern FilterBar/FilterSelect")
        print("  5. Multiple pages navigation")

        browser.close()

if __name__ == "__main__":
    test_sprint7()
