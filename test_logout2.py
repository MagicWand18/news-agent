from playwright.sync_api import sync_playwright

BASE_URL = "http://159.65.97.78:3000"
SCREENSHOTS_DIR = "/Users/master/Downloads/news-agent/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()

    # Go to dashboard
    page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)

    # Get info about the logout button via JS
    btn_info = page.evaluate("""() => {
        const buttons = [...document.querySelectorAll('button')];
        const logout = buttons.find(b => b.innerText.includes('Cerrar'));
        if (!logout) return {found: false};
        const rect = logout.getBoundingClientRect();
        const style = window.getComputedStyle(logout);
        return {
            found: true,
            text: logout.innerText,
            rect: {top: rect.top, left: rect.left, width: rect.width, height: rect.height},
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            overflow: style.overflow,
            parentOverflow: logout.parentElement ? window.getComputedStyle(logout.parentElement).overflow : 'N/A',
            parentHeight: logout.parentElement ? logout.parentElement.getBoundingClientRect().height : 0,
            html: logout.outerHTML.substring(0, 500)
        };
    }""")
    print("Logout button info:", btn_info)

    # Make the logout button visible and click via JS
    print("\nForcing visibility and clicking via JavaScript...")
    url_before = page.url
    result = page.evaluate("""() => {
        const buttons = [...document.querySelectorAll('button')];
        const logout = buttons.find(b => b.innerText.includes('Cerrar'));
        if (!logout) return 'not found';
        // Force visibility
        logout.style.display = 'block';
        logout.style.visibility = 'visible';
        logout.style.opacity = '1';
        // Make parent visible too
        let el = logout.parentElement;
        while (el) {
            el.style.overflow = 'visible';
            el = el.parentElement;
        }
        logout.click();
        return 'clicked';
    }""")
    print(f"Click result: {result}")
    page.wait_for_timeout(3000)
    url_after = page.url
    print(f"URL before: {url_before}")
    print(f"URL after: {url_after}")
    page.screenshot(path=f"{SCREENSHOTS_DIR}/09_after_logout_click.png", full_page=True)

    if url_before == url_after:
        print("BUG CONFIRMED: Logout button click does NOT navigate. URL unchanged.")
    else:
        print(f"Logout redirected to: {url_after}")

    # Test auth bypass with completely fresh context
    print("\n=== Testing auth bypass with fresh context (no cookies) ===")
    context2 = browser.new_context(viewport={"width": 1440, "height": 900})
    page2 = context2.new_page()

    response = page2.goto(f"{BASE_URL}/dashboard", wait_until="networkidle", timeout=30000)
    page2.wait_for_timeout(2000)
    final_url = page2.url
    print(f"Fresh context - /dashboard final URL: {final_url}")
    page2.screenshot(path=f"{SCREENSHOTS_DIR}/10_fresh_context_dashboard.png", full_page=True)

    if "/login" in final_url:
        print("Auth works correctly: fresh context redirected to login.")
    else:
        print("BUG CONFIRMED: Auth bypass - dashboard accessible without any session/cookies.")

    context2.close()
    browser.close()
    print("\nDone!")
