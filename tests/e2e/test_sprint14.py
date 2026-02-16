"""
Playwright E2E test for Sprint 14 features.
Validates:
  1. Generate Response from Social Mentions (button + drafts)
  2. Alert Rules CRUD page
  3. Insights Timeline with infinite scroll
  4. Sidebar navigation items
"""
import sys
import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@crisalida.com"
PASSWORD = "Cris4lid402"
SCREENSHOT_DIR = "screenshots/sprint14"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []

def log(msg):
    print(f"  {msg}")

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

        # ==================== LOGIN ====================
        print("\n🔐 Logging in...")
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=15000)
        page.wait_for_load_state("networkidle")
        test_pass("Login successful")
        time.sleep(2)

        # ==================== TEST 1: SIDEBAR ====================
        print("\n📋 Test 1: Sidebar - Reglas de Alerta item")

        # Verificar que el item existe en sidebar
        sidebar = page.locator("nav[data-tour-id='sidebar']")
        alert_rules_link = sidebar.locator("a[href='/dashboard/alert-rules']")
        if alert_rules_link.count() > 0:
            test_pass("Sidebar: 'Reglas de Alerta' link exists")
        else:
            test_fail("Sidebar: 'Reglas de Alerta' link NOT found")

        page.screenshot(path=f"{SCREENSHOT_DIR}/01_sidebar.png", full_page=False)

        # ==================== TEST 2: ALERT RULES PAGE ====================
        print("\n🔔 Test 2: Alert Rules CRUD page")

        page.goto(f"{BASE_URL}/dashboard/alert-rules", wait_until="networkidle")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_alert_rules_page.png", full_page=True)

        # Verificar que la pagina cargó
        heading = page.locator("text=Reglas de Alerta")
        if heading.count() > 0:
            test_pass("Alert Rules: Page heading found")
        else:
            test_fail("Alert Rules: Page heading NOT found")

        # Verificar boton de crear
        create_btn = page.locator("text=Nueva regla")
        if create_btn.count() > 0:
            test_pass("Alert Rules: 'Nueva regla' button found")

            # Abrir modal de creacion
            create_btn.first.click()
            time.sleep(1)
            page.screenshot(path=f"{SCREENSHOT_DIR}/03_alert_rules_create_modal.png", full_page=True)

            # Verificar que el modal tiene los tipos de regla
            rule_types = page.locator("text=Pico de menciones negativas")
            if rule_types.count() > 0:
                test_pass("Alert Rules: Rule type options visible in modal")
            else:
                test_fail("Alert Rules: Rule type options NOT visible")

            # Verificar canales
            channels = page.locator("text=Dashboard")
            if channels.count() > 0:
                test_pass("Alert Rules: Channel options visible")
            else:
                test_fail("Alert Rules: Channel options NOT visible")

            # Cerrar modal
            close_btn = page.locator("button").filter(has=page.locator("svg.lucide-x"))
            if close_btn.count() > 0:
                close_btn.first.click()
                time.sleep(0.5)
        else:
            test_fail("Alert Rules: 'Nueva regla' button NOT found")

        # ==================== TEST 3: INTELLIGENCE TIMELINE ====================
        print("\n🧠 Test 3: Intelligence page - Insights Timeline")

        page.goto(f"{BASE_URL}/dashboard/intelligence", wait_until="networkidle")
        page.wait_for_load_state("networkidle")
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_intelligence_page.png", full_page=True)

        # Verificar que la pagina cargó
        intel_heading = page.locator("text=Media Intelligence")
        if intel_heading.count() > 0:
            test_pass("Intelligence: Page heading found")
        else:
            test_fail("Intelligence: Page heading NOT found")

        # Verificar Timeline de Insights
        timeline_heading = page.locator("text=Timeline de Insights")
        if timeline_heading.count() > 0:
            test_pass("Intelligence: 'Timeline de Insights' section found")
        else:
            test_fail("Intelligence: 'Timeline de Insights' section NOT found")

        # Verificar Temas Principales (fue movido a seccion standalone)
        topics_heading = page.locator("text=Temas Principales")
        if topics_heading.count() > 0:
            test_pass("Intelligence: 'Temas Principales' section found")
        else:
            test_fail("Intelligence: 'Temas Principales' section NOT found")

        # Scroll para ver timeline completo
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOT_DIR}/05_intelligence_bottom.png", full_page=True)

        # Verificar boton "Cargar mas insights"
        load_more = page.locator("text=Cargar mas insights")
        if load_more.count() > 0:
            test_pass("Intelligence: 'Cargar mas insights' button found")
            # Click para probar paginacion
            load_more.first.click()
            time.sleep(2)
            page.screenshot(path=f"{SCREENSHOT_DIR}/06_intelligence_more_loaded.png", full_page=True)
            test_pass("Intelligence: Load more clicked successfully")
        else:
            log("Intelligence: 'Cargar mas' button not visible (might not have enough data)")

        # Verificar insight cards expandibles (buscar chevron o click)
        insight_cards = page.locator("button").filter(has=page.locator("text=Semana del"))
        if insight_cards.count() > 0:
            test_pass(f"Intelligence: Found {insight_cards.count()} expandable insight card(s)")
            # Expandir primer insight
            insight_cards.first.click()
            time.sleep(1)
            page.screenshot(path=f"{SCREENSHOT_DIR}/07_intelligence_insight_expanded.png", full_page=True)

            # Verificar que el contenido expandido tiene recomendaciones
            recs = page.locator("text=Recomendaciones")
            if recs.count() > 0:
                test_pass("Intelligence: Expanded insight shows 'Recomendaciones'")
            else:
                test_fail("Intelligence: Expanded insight missing 'Recomendaciones'")
        else:
            log("Intelligence: No expandable insight cards (no insight data yet)")

        # ==================== TEST 4: SOCIAL MENTION DETAIL ====================
        print("\n📱 Test 4: Social Mention Detail - Generar Comunicado")

        page.goto(f"{BASE_URL}/dashboard/social-mentions", wait_until="networkidle")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOT_DIR}/08_social_mentions_list.png", full_page=True)

        # Buscar una mencion para ir al detalle
        mention_links = page.locator("a[href*='/dashboard/social-mentions/']")
        mention_count = mention_links.count()
        log(f"Found {mention_count} social mention links")

        if mention_count > 0:
            # Click en la primera mencion
            first_href = mention_links.first.get_attribute("href")
            log(f"Navigating to: {first_href}")
            mention_links.first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(2)
            page.screenshot(path=f"{SCREENSHOT_DIR}/09_social_mention_detail.png", full_page=True)

            # Verificar boton "Generar comunicado"
            gen_btn = page.locator("text=Generar comunicado")
            if gen_btn.count() > 0:
                test_pass("Social Mention Detail: 'Generar comunicado' button found")
            else:
                test_fail("Social Mention Detail: 'Generar comunicado' button NOT found")

            # Verificar boton "Crear tarea" (ya existia)
            task_btn = page.locator("text=Crear tarea")
            if task_btn.count() > 0:
                test_pass("Social Mention Detail: 'Crear tarea' button found")
            else:
                test_fail("Social Mention Detail: 'Crear tarea' button NOT found")

            # Verificar boton "Ver post original" (ya existia)
            post_btn = page.locator("text=Ver post original")
            if post_btn.count() > 0:
                test_pass("Social Mention Detail: 'Ver post original' button found")
            else:
                test_fail("Social Mention Detail: 'Ver post original' button NOT found")

            # Verificar seccion de borradores vinculados (puede estar vacia si no hay)
            drafts_section = page.locator("text=Borradores de comunicado")
            if drafts_section.count() > 0:
                test_pass("Social Mention Detail: 'Borradores de comunicado' section visible")
            else:
                log("Social Mention Detail: No drafts section (no drafts linked yet - expected)")

            # Scroll down para ver toda la pagina
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1)
            page.screenshot(path=f"{SCREENSHOT_DIR}/10_social_mention_detail_bottom.png", full_page=True)

        else:
            log("No social mentions found to test detail page")

        # ==================== TEST 5: RESPONSES PAGE (verificar integracion) ====================
        print("\n📝 Test 5: Responses page")

        page.goto(f"{BASE_URL}/dashboard/responses", wait_until="networkidle")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOT_DIR}/11_responses_page.png", full_page=True)

        resp_heading = page.locator("text=Respuestas")
        if resp_heading.count() > 0:
            test_pass("Responses: Page loads correctly")
        else:
            test_fail("Responses: Page failed to load")

        # ==================== TEST 6: CRISIS PAGE (verificar no regression) ====================
        print("\n🚨 Test 6: Crisis page (regression check)")

        page.goto(f"{BASE_URL}/dashboard/crisis", wait_until="networkidle")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOT_DIR}/12_crisis_page.png", full_page=True)

        crisis_heading = page.locator("text=Crisis")
        if crisis_heading.count() > 0:
            test_pass("Crisis: Page loads correctly")
        else:
            test_fail("Crisis: Page failed to load")

        # ==================== SUMMARY ====================
        print("\n" + "=" * 60)
        print("SPRINT 14 E2E TEST RESULTS")
        print("=" * 60)

        passes = [r for r in results if r[0] == "PASS"]
        fails = [r for r in results if r[0] == "FAIL"]

        for status, name in results:
            icon = "✅" if status == "PASS" else "❌"
            print(f"  {icon} {name}")

        print(f"\n  Total: {len(results)} tests | ✅ {len(passes)} passed | ❌ {len(fails)} failed")
        print(f"  Screenshots saved to: {SCREENSHOT_DIR}/")

        browser.close()

        if fails:
            sys.exit(1)


if __name__ == "__main__":
    run_tests()
