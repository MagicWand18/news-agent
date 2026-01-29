#!/usr/bin/env python3
"""Test new features: CSV Export and Generate Response buttons"""

from playwright.sync_api import sync_playwright
import time

BASE_URL = "http://159.65.97.78:3000"

def test_new_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # 1. Login
        print("1. Logging in...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")

        page.fill('input[type="email"]', "admin@mediabot.local")
        page.fill('input[type="password"]', "admin123")
        page.click('button[type="submit"]')

        page.wait_for_url("**/dashboard**", timeout=10000)
        print("   Logged in successfully!")

        # 2. Go to Mentions page and check for Export CSV button
        print("\n2. Testing CSV Export button...")
        page.goto(f"{BASE_URL}/dashboard/mentions")
        page.wait_for_load_state("networkidle")
        time.sleep(1)  # Wait for React to hydrate

        page.screenshot(path="/tmp/mentions_page.png", full_page=True)

        # Check for export button
        export_button = page.locator('button:has-text("Exportar CSV")')
        if export_button.count() > 0:
            print("   CSV Export button found!")
            # Check if it's visible
            if export_button.is_visible():
                print("   CSV Export button is visible!")
            else:
                print("   CSV Export button exists but not visible")
        else:
            print("   CSV Export button NOT found!")
            # Let's see what buttons exist
            buttons = page.locator("button").all()
            print(f"   Found {len(buttons)} buttons on page")
            for i, btn in enumerate(buttons[:5]):
                try:
                    text = btn.inner_text()
                    print(f"   - Button {i}: '{text}'")
                except:
                    pass

        # 3. Find a mention to test Generate Response
        print("\n3. Testing Generate Response button...")

        # Look for mention links
        mention_links = page.locator('a[href*="/dashboard/mentions/"]').all()
        print(f"   Found {len(mention_links)} mention links")

        if len(mention_links) > 0:
            # Click on the first mention
            first_link = mention_links[0]
            href = first_link.get_attribute("href")
            print(f"   Navigating to mention: {href}")
            page.goto(f"{BASE_URL}{href}")
            page.wait_for_load_state("networkidle")
            time.sleep(1)

            page.screenshot(path="/tmp/mention_detail.png", full_page=True)

            # Check for generate button
            generate_button = page.locator('button:has-text("Generar Comunicado")')
            if generate_button.count() > 0:
                print("   Generate Response button found!")
                if generate_button.is_visible():
                    print("   Generate Response button is visible!")

                    # Click to open modal
                    generate_button.click()
                    time.sleep(0.5)

                    page.screenshot(path="/tmp/generate_modal.png", full_page=True)

                    # Check for modal content
                    modal = page.locator('text="Generar Comunicado de Prensa"')
                    if modal.count() > 0:
                        print("   Modal opened successfully!")

                        # Check for tone options
                        tones = page.locator('text="Profesional"')
                        if tones.count() > 0:
                            print("   Tone options visible!")
                    else:
                        print("   Modal did not open properly")
            else:
                print("   Generate Response button NOT found!")
                # Debug: show available buttons
                buttons = page.locator("button").all()
                print(f"   Found {len(buttons)} buttons on page")
                for i, btn in enumerate(buttons[:5]):
                    try:
                        text = btn.inner_text()
                        print(f"   - Button {i}: '{text}'")
                    except:
                        pass
        else:
            print("   No mentions found to test with")

        print("\n4. Screenshots saved:")
        print("   - /tmp/mentions_page.png")
        print("   - /tmp/mention_detail.png")
        print("   - /tmp/generate_modal.png")

        browser.close()
        print("\nTest completed!")

if __name__ == "__main__":
    test_new_features()
