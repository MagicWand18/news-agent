"""Sprint 15: AI Media Brief - E2E Testing"""
from playwright.sync_api import sync_playwright
import os
import time

BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@example.com"
PASSWORD = "6lB5/A1NOVFOkOWG"
SCREENSHOT_DIR = "/tmp/screenshots/sprint15"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []

def log(test_name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((test_name, passed, detail))
    print(f"  [{status}] {test_name}" + (f" - {detail}" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    # ============ LOGIN ============
    print("\n=== 1. Login ===")
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('#email', EMAIL)
    page.fill('#password', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_url("**/dashboard**", timeout=15000)
    page.wait_for_load_state("networkidle")
    log("Login exitoso", "/dashboard" in page.url, page.url)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_dashboard.png", full_page=True)

    # ============ SIDEBAR ============
    print("\n=== 2. Sidebar - Media Brief item ===")
    time.sleep(1)
    # Desktop sidebar is the second nav (hidden mobile is first)
    page_html = page.content()
    has_media_brief = "Media Brief" in page_html
    log("Sidebar contiene 'Media Brief'", has_media_brief)

    has_briefs_link = 'href="/dashboard/briefs"' in page_html
    log("Sidebar tiene link a /dashboard/briefs", has_briefs_link)
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_sidebar.png")

    # ============ BRIEFS PAGE ============
    print("\n=== 3. Pagina /dashboard/briefs ===")
    page.goto(f"{BASE_URL}/dashboard/briefs")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    briefs_url = page.url
    log("Navegacion a /dashboard/briefs", "/dashboard/briefs" in briefs_url, briefs_url)

    # Verificar header
    page_content = page.content()
    has_title = "AI Media Brief" in page_content
    log("Titulo 'AI Media Brief' presente", has_title)

    has_description = "Briefings diarios" in page_content or "generados por IA" in page_content
    log("Descripcion presente", has_description)

    # Verificar filtro de cliente
    has_client_filter = page.locator("text=Todos los clientes").count() > 0 or page.locator("text=Cliente").count() > 0
    log("Filtro de cliente presente", has_client_filter)

    # Verificar que la pagina tiene contenido (brief o empty state)
    has_brief_card = "Brief de hoy" in page_content or "Puntos clave" in page_content
    has_empty_state = "Sin briefs disponibles" in page_content or "proximo ciclo" in page_content
    log("Brief card o empty state visible", has_brief_card or has_empty_state,
        "Brief card" if has_brief_card else "Empty state" if has_empty_state else "Nada")

    page.screenshot(path=f"{SCREENSHOT_DIR}/03_briefs_page.png", full_page=True)

    # ============ INTELLIGENCE PAGE ============
    print("\n=== 4. Intelligence - Seccion Ultimo Brief ===")
    page.goto(f"{BASE_URL}/dashboard/intelligence")
    page.wait_for_load_state("networkidle")
    time.sleep(4)

    intel_url = page.url
    log("Navegacion a /dashboard/intelligence", "/dashboard/intelligence" in intel_url)

    intel_content = page.content()

    # Verificar que la pagina carga correctamente
    has_intel_title = "Media Intelligence" in intel_content
    log("Titulo Intelligence presente", has_intel_title)

    # Verificar seccion Ultimo Brief (puede no estar si no hay datos aun)
    has_ultimo_brief = "Ultimo Brief" in intel_content or "ltimo Brief" in intel_content
    has_ver_todos = "Ver todos" in intel_content
    log("Seccion 'Ultimo Brief' presente", has_ultimo_brief,
        "Visible" if has_ultimo_brief else "No visible (sin datos de brief aun - esperado)")

    # Verificar que existe link a briefs en sidebar (siempre presente)
    has_briefs_link_intel = "/dashboard/briefs" in intel_content
    log("Link a /dashboard/briefs en pagina", has_briefs_link_intel,
        "Encontrado" if has_briefs_link_intel else "Solo en sidebar")

    page.screenshot(path=f"{SCREENSHOT_DIR}/04_intelligence_page.png", full_page=True)

    # Scroll down para ver mas
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(1)
    page.screenshot(path=f"{SCREENSHOT_DIR}/05_intelligence_bottom.png", full_page=True)

    # ============ VERIFICAR OTRAS PAGINAS NO SE ROMPIERON ============
    print("\n=== 5. Verificacion de paginas existentes ===")

    # Dashboard
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    log("Dashboard carga OK", "/dashboard" in page.url)
    page.screenshot(path=f"{SCREENSHOT_DIR}/06_dashboard.png", full_page=True)

    # Crisis
    page.goto(f"{BASE_URL}/dashboard/crisis")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    log("Crisis carga OK", "crisis" in page.url.lower())

    # Alert Rules
    page.goto(f"{BASE_URL}/dashboard/alert-rules")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    log("Alert Rules carga OK", "alert-rules" in page.url.lower())

    # Responses
    page.goto(f"{BASE_URL}/dashboard/responses")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    log("Responses carga OK", "responses" in page.url.lower())

    # Social Mentions
    page.goto(f"{BASE_URL}/dashboard/social-mentions")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    log("Social Mentions carga OK", "social-mentions" in page.url.lower())

    # Mentions
    page.goto(f"{BASE_URL}/dashboard/mentions")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    log("Mentions carga OK", "mentions" in page.url.lower())

    page.screenshot(path=f"{SCREENSHOT_DIR}/07_mentions.png", full_page=True)

    browser.close()

# ============ RESUMEN ============
print("\n" + "=" * 50)
print("RESUMEN DE TESTS - Sprint 15")
print("=" * 50)
passed = sum(1 for _, p, _ in results if p)
failed = sum(1 for _, p, _ in results if not p)
for name, p, detail in results:
    status = "PASS" if p else "FAIL"
    print(f"  [{status}] {name}" + (f" ({detail})" if detail else ""))
print(f"\nTotal: {passed}/{len(results)} passed, {failed} failed")
print(f"Screenshots: {SCREENSHOT_DIR}/")
