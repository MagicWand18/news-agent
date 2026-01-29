from playwright.sync_api import sync_playwright

BASE_URL = "http://159.65.97.78:3000"
SCREENSHOTS_DIR = "/Users/master/Downloads/news-agent/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()

    # Go to dashboard
    page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)

    # Find the logout button and force-click it (even if not visible/scrolled)
    logout_btn = page.locator('button:has-text("Cerrar")')
    print(f"Logout button count: {logout_btn.count()}")

    if logout_btn.count() > 0:
        # Scroll sidebar to bottom to make it visible
        page.evaluate("""() => {
            const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="Sidebar"]');
            if (sidebar) sidebar.scrollTop = sidebar.scrollHeight;
        }""")
        page.wait_for_timeout(500)

        # Screenshot showing logout button
        page.screenshot(path=f"{SCREENSHOTS_DIR}/08_sidebar_scrolled.png", full_page=True)

        # Get button bounding box
        bbox = logout_btn.first.bounding_box()
        print(f"Logout button bounding box: {bbox}")

        # Force click
        print("Clicking logout button (force)...")
        url_before = page.url
        logout_btn.first.click(force=True)
        page.wait_for_timeout(3000)
        url_after = page.url
        print(f"URL before click: {url_before}")
        print(f"URL after click: {url_after}")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/09_after_logout_click.png", full_page=True)

        if url_before == url_after:
            print("CONFIRMED BUG: Logout button does NOT navigate away. URL unchanged.")
        else:
            print(f"Logout redirected to: {url_after}")

    # Also test: can we access dashboard pages without any auth token?
    print("\n--- Testing auth bypass with fresh context (no cookies) ---")
    context2 = browser.new_context(viewport={"width": 1440, "height": 900})
    page2 = context2.new_page()

    response = page2.goto(f"{BASE_URL}/dashboard", wait_until="networkidle", timeout=30000)
    page2.wait_for_timeout(2000)
    print(f"Fresh context - /dashboard status: {response.status}")
    print(f"Fresh context - Final URL: {page2.url}")
    page2.screenshot(path=f"{SCREENSHOTS_DIR}/10_fresh_context_dashboard.png", full_page=True)

    if "/login" in page2.url:
        print("Auth works: fresh context redirected to login.")
    else:
        print("CONFIRMED BUG: Auth bypass - dashboard accessible without any session/token.")

    context2.close()
    browser.close()
