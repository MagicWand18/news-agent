"""Sprint 17: Executive Dashboard + Reportes Exportables - E2E Testing"""
from playwright.sync_api import sync_playwright
import os
import time

BASE_URL = "http://159.65.97.78:3000"
# Super Admin (ve item Ejecutivo)
SA_EMAIL = "admin@example.com"
SA_PASSWORD = "6lB5/A1NOVFOkOWG"
# Admin normal (NO ve item Ejecutivo)
ADMIN_EMAIL = "admin@crisalida.com"
ADMIN_PASSWORD = "Cris4lid402"

SCREENSHOT_DIR = "/tmp/screenshots/sprint17"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []

def log(test_name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((test_name, passed, detail))
    print(f"  [{status}] {test_name}" + (f" - {detail}" if detail else ""))


def login(page, email, password):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('#email', email)
    page.fill('#password', password)
    page.click('button[type="submit"]')
    page.wait_for_url("**/dashboard**", timeout=15000)
    page.wait_for_load_state("networkidle")
    time.sleep(1)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ===================================================================
    # PART A: SUPER ADMIN - Executive Dashboard
    # ===================================================================
    print("\n" + "=" * 60)
    print("PART A: Super Admin - Executive Dashboard")
    print("=" * 60)

    page = browser.new_page(viewport={"width": 1400, "height": 900})
    login(page, SA_EMAIL, SA_PASSWORD)
    log("SA Login exitoso", "/dashboard" in page.url)

    # --- Sidebar ---
    print("\n=== 1. Sidebar - Ejecutivo item ===")
    page_html = page.content()
    has_executive = "Ejecutivo" in page_html
    log("Sidebar contiene 'Ejecutivo'", has_executive)

    has_executive_link = 'href="/dashboard/executive"' in page_html
    log("Sidebar tiene link a /dashboard/executive", has_executive_link)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_sidebar_sa.png")

    # --- Executive Page ---
    print("\n=== 2. Pagina /dashboard/executive ===")
    page.goto(f"{BASE_URL}/dashboard/executive")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    exec_url = page.url
    log("Navegacion a /dashboard/executive", "/dashboard/executive" in exec_url, exec_url)
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_executive_page.png")

    exec_content = page.content()
    has_exec_title = "Dashboard Ejecutivo" in exec_content
    log("Titulo 'Dashboard Ejecutivo' presente", has_exec_title)

    # Verificar KPI cards
    has_total_mentions = "Total Menciones" in exec_content
    log("KPI 'Total Menciones' presente", has_total_mentions)

    has_social_mentions = "Menciones Sociales" in exec_content
    log("KPI 'Menciones Sociales' presente", has_social_mentions)

    has_crisis_activas = "Crisis Activas" in exec_content
    log("KPI 'Crisis Activas' presente", has_crisis_activas)

    has_clientes_activos = "Clientes Activos" in exec_content
    log("KPI 'Clientes Activos' presente", has_clientes_activos)

    # Verificar period selector
    has_7d = "7 dias" in exec_content
    has_14d = "14 dias" in exec_content
    has_30d = "30 dias" in exec_content
    log("Selector de periodo presente", has_7d and has_14d and has_30d)

    # Health scores section
    has_health = "Health Score" in exec_content or "health" in exec_content.lower()
    log("Seccion Health Score presente", has_health)

    # Inactivity alerts
    has_inactivity = "inactividad" in exec_content.lower() or "Alertas de inactividad" in exec_content
    log("Seccion de inactividad presente", has_inactivity)

    # Org cards section
    has_org_section = "Por organizacion" in exec_content or "organizacion" in exec_content.lower()
    log("Seccion de organizaciones presente", has_org_section)

    page.screenshot(path=f"{SCREENSHOT_DIR}/03_executive_full.png", full_page=True)

    # --- ExportButton in Campaigns ---
    print("\n=== 3. ExportButton en Campaigns ===")
    page.goto(f"{BASE_URL}/dashboard/campaigns")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    # Buscar una campaña y navegar a detalle
    campaign_links = page.locator('a[href*="/dashboard/campaigns/"]').all()
    if len(campaign_links) > 0:
        campaign_links[0].click()
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        camp_content = page.content()
        has_export = "Exportar" in camp_content
        log("ExportButton en detalle de campaña", has_export)
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_campaign_export.png")
    else:
        log("ExportButton en detalle de campaña", False, "No hay campañas para verificar")

    # --- ExportButton in Briefs ---
    print("\n=== 4. ExportButton en Briefs ===")
    page.goto(f"{BASE_URL}/dashboard/briefs")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    briefs_content = page.content()
    has_brief_export = "Exportar" in briefs_content
    log("ExportButton en pagina de briefs", has_brief_export)
    page.screenshot(path=f"{SCREENSHOT_DIR}/05_briefs_export.png")

    # --- ExportButton in Client Detail ---
    print("\n=== 5. ExportButton en Client Detail ===")
    page.goto(f"{BASE_URL}/dashboard/clients")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    client_links = page.locator('a[href*="/dashboard/clients/"]').all()
    if len(client_links) > 0:
        client_links[0].click()
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        client_content = page.content()
        has_client_export = "Exportar" in client_content
        log("ExportButton en detalle de cliente", has_client_export)
        page.screenshot(path=f"{SCREENSHOT_DIR}/06_client_export.png")
    else:
        log("ExportButton en detalle de cliente", False, "No hay clientes para verificar")

    # --- Shared Report Public Page ---
    print("\n=== 6. Pagina publica /shared/invalid-id ===")
    page.goto(f"{BASE_URL}/shared/invalid-nonexistent-id")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    shared_content = page.content()
    has_not_found = "no encontrado" in shared_content.lower() or "not found" in shared_content.lower() or "MediaBot" in shared_content
    log("Pagina /shared muestra error para ID invalido", has_not_found)
    page.screenshot(path=f"{SCREENSHOT_DIR}/07_shared_invalid.png")

    page.close()

    # ===================================================================
    # PART B: ADMIN NORMAL - NO debe ver Ejecutivo
    # ===================================================================
    print("\n" + "=" * 60)
    print("PART B: Admin Normal - NO debe ver Ejecutivo")
    print("=" * 60)

    page = browser.new_page(viewport={"width": 1400, "height": 900})
    login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    log("Admin Login exitoso", "/dashboard" in page.url)

    print("\n=== 7. Sidebar - Admin normal NO ve Ejecutivo ===")
    time.sleep(1)
    admin_html = page.content()
    no_executive = "Ejecutivo" not in admin_html
    log("Admin normal NO ve 'Ejecutivo' en sidebar", no_executive)

    no_executive_link = 'href="/dashboard/executive"' not in admin_html
    log("Admin normal NO tiene link a /dashboard/executive", no_executive_link)
    page.screenshot(path=f"{SCREENSHOT_DIR}/08_sidebar_admin.png")

    page.close()
    browser.close()

    # ===================================================================
    # RESUMEN
    # ===================================================================
    print("\n" + "=" * 60)
    print("RESUMEN Sprint 17")
    print("=" * 60)
    total = len(results)
    passed = sum(1 for _, p, _ in results if p)
    failed = sum(1 for _, p, _ in results if not p)
    print(f"\nTotal: {total}  |  PASS: {passed}  |  FAIL: {failed}")
    print()
    for name, p, detail in results:
        status = "PASS" if p else "FAIL"
        print(f"  [{status}] {name}" + (f" - {detail}" if detail else ""))
    print(f"\n{'ALL TESTS PASSED!' if failed == 0 else f'{failed} TESTS FAILED'}")
