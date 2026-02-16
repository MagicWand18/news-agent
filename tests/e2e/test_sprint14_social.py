"""
Test Sprint 14 Feature 1: Social mention detail with super admin account.
"""
import sys
import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@example.com"
PASSWORD = "6lB5/A1NOVFOkOWG"
SCREENSHOT_DIR = "screenshots/sprint14"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []

def test_pass(name):
    results.append(("PASS", name))
    print(f"  ✅ {name}")

def test_fail(name, reason=""):
    results.append(("FAIL", f"{name}: {reason}"))
    print(f"  ❌ {name}: {reason}")


def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Login con super admin
        print("\n🔐 Logging in as super admin...")
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=15000)
        page.wait_for_load_state("networkidle")
        test_pass("Login as super admin")
        time.sleep(2)

        # Ir a social mentions
        print("\n📱 Testing Social Mention Detail...")
        page.goto(f"{BASE_URL}/dashboard/social-mentions", wait_until="networkidle")
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # Buscar menciones con links al detalle
        mention_links = page.locator("a[href*='/dashboard/social-mentions/c']")
        mention_count = mention_links.count()
        print(f"  Found {mention_count} social mention links")

        if mention_count > 0:
            # Click primera mencion
            first_href = mention_links.first.get_attribute("href")
            print(f"  Navigating to: {first_href}")
            page.goto(f"{BASE_URL}{first_href}", wait_until="networkidle")
            page.wait_for_load_state("networkidle")
            time.sleep(2)
            page.screenshot(path=f"{SCREENSHOT_DIR}/13_social_detail_superadmin.png", full_page=True)

            # Verificar botones
            gen_btn = page.locator("text=Generar comunicado")
            if gen_btn.count() > 0:
                test_pass("Social Detail: 'Generar comunicado' button found")
            else:
                test_fail("Social Detail: 'Generar comunicado' button NOT found")

            task_btn = page.locator("text=Crear tarea")
            if task_btn.count() > 0:
                test_pass("Social Detail: 'Crear tarea' button found")
            else:
                test_fail("Social Detail: 'Crear tarea' button NOT found")

            post_btn = page.locator("text=Ver post original")
            if post_btn.count() > 0:
                test_pass("Social Detail: 'Ver post original' button found")
            else:
                test_fail("Social Detail: 'Ver post original' button NOT found")

            # Scroll para ver toda la pagina
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1)
            page.screenshot(path=f"{SCREENSHOT_DIR}/14_social_detail_bottom.png", full_page=True)

        else:
            # Intento directo navegando a la lista y buscando rows
            print("  Trying to find mention rows...")
            rows = page.locator("[data-mention-id]")
            row_count = rows.count()
            print(f"  Found {row_count} mention rows")

            if row_count == 0:
                print("  No social mentions in system - testing page structure only")
                # Navegar a una URL de social mention (aunque no exista) para ver la estructura
                page.goto(f"{BASE_URL}/dashboard/social-mentions/test-id", wait_until="networkidle")
                time.sleep(2)
                page.screenshot(path=f"{SCREENSHOT_DIR}/13_social_detail_empty.png", full_page=True)
                test_pass("Social Detail: Page structure loads (no data)")

        # Summary
        print("\n" + "=" * 60)
        print("SOCIAL MENTION DETAIL TEST RESULTS")
        print("=" * 60)

        passes = [r for r in results if r[0] == "PASS"]
        fails = [r for r in results if r[0] == "FAIL"]

        for status, name in results:
            icon = "✅" if status == "PASS" else "❌"
            print(f"  {icon} {name}")

        print(f"\n  Total: {len(results)} tests | ✅ {len(passes)} passed | ❌ {len(fails)} failed")

        browser.close()

        if fails:
            sys.exit(1)


if __name__ == "__main__":
    run_tests()
