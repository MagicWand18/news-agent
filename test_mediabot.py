from playwright.sync_api import sync_playwright
import os

SCREENSHOTS_DIR = "/Users/master/Downloads/news-agent/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

BASE_URL = "http://159.65.97.78:3000"

PAGES = [
    ("01_root", "/", "Root URL - check if redirects to login or dashboard"),
    ("02_dashboard", "/dashboard", "Main dashboard with KPIs and charts"),
    ("03_clients", "/dashboard/clients", "Client list"),
    ("04_mentions", "/dashboard/mentions", "Mentions list"),
    ("05_tasks", "/dashboard/tasks", "Task management"),
    ("06_team", "/dashboard/team", "Team management"),
    ("07_login", "/login", "Login page design"),
]

def test_all_pages():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Collect console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)

        for filename, path, description in PAGES:
            url = f"{BASE_URL}{path}"
            print(f"\n{'='*60}")
            print(f"Testing: {description}")
            print(f"URL: {url}")
            print(f"{'='*60}")

            try:
                response = page.goto(url, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(2000)  # Extra wait for JS rendering

                final_url = page.url
                status = response.status if response else "N/A"
                title = page.title()

                print(f"  Status: {status}")
                print(f"  Final URL: {final_url}")
                print(f"  Title: {title}")

                if final_url != url:
                    print(f"  REDIRECT DETECTED: {url} -> {final_url}")

                # Take full-page screenshot
                screenshot_path = f"{SCREENSHOTS_DIR}/{filename}.png"
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"  Screenshot saved: {screenshot_path}")

                # Check for visible elements
                body_text_length = len(page.inner_text("body"))
                print(f"  Body text length: {body_text_length}")

            except Exception as e:
                print(f"  ERROR: {e}")
                screenshot_path = f"{SCREENSHOTS_DIR}/{filename}_error.png"
                page.screenshot(path=screenshot_path)
                print(f"  Error screenshot saved: {screenshot_path}")

        # Test 8: Try to find and click the logout button
        print(f"\n{'='*60}")
        print("Testing: Logout button functionality")
        print(f"{'='*60}")

        try:
            # First go to dashboard
            page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            # Look for logout button - try various selectors
            logout_selectors = [
                'text=Cerrar sesión',
                'text=Cerrar Sesión',
                'text=Logout',
                'text=Log out',
                'text=Sign out',
                'text=Salir',
                '[data-testid="logout"]',
                'button:has-text("Cerrar")',
                'a:has-text("Cerrar")',
                'button:has-text("Logout")',
                'a:has-text("Logout")',
                'button:has-text("Salir")',
                'a:has-text("Salir")',
            ]

            logout_found = False
            for selector in logout_selectors:
                try:
                    el = page.locator(selector)
                    if el.count() > 0:
                        print(f"  Found logout element with selector: {selector}")
                        print(f"  Text: {el.first.inner_text()}")
                        print(f"  Visible: {el.first.is_visible()}")
                        logout_found = True

                        # Screenshot before click
                        page.screenshot(path=f"{SCREENSHOTS_DIR}/08_before_logout_click.png", full_page=True)

                        # Click it
                        el.first.click()
                        page.wait_for_timeout(3000)

                        final_url = page.url
                        print(f"  After click URL: {final_url}")

                        # Screenshot after click
                        page.screenshot(path=f"{SCREENSHOTS_DIR}/09_after_logout_click.png", full_page=True)
                        print(f"  Screenshots saved for logout test")
                        break
                except Exception:
                    continue

            if not logout_found:
                print("  No logout button found with standard selectors.")
                # Dump sidebar HTML for inspection
                sidebar_html = page.evaluate("""() => {
                    const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="Sidebar"]');
                    return sidebar ? sidebar.innerHTML.substring(0, 3000) : 'No sidebar found';
                }""")
                print(f"  Sidebar HTML (first 1000 chars): {sidebar_html[:1000]}")

                # Try to find all buttons/links in the page
                all_buttons = page.evaluate("""() => {
                    const elements = [...document.querySelectorAll('button, a')];
                    return elements.map(el => ({
                        tag: el.tagName,
                        text: el.innerText.trim().substring(0, 50),
                        href: el.href || '',
                        class: el.className.substring(0, 80)
                    })).filter(el => el.text.length > 0);
                }""")
                print(f"  All clickable elements:")
                for btn in all_buttons:
                    print(f"    {btn['tag']}: '{btn['text']}' href={btn['href']} class={btn['class']}")

        except Exception as e:
            print(f"  ERROR during logout test: {e}")

        # Print console errors
        if console_errors:
            print(f"\n{'='*60}")
            print("Console Errors Collected:")
            print(f"{'='*60}")
            for err in console_errors[:20]:
                print(f"  {err}")

        browser.close()
        print(f"\nDone! All screenshots saved to {SCREENSHOTS_DIR}/")

if __name__ == "__main__":
    test_all_pages()
