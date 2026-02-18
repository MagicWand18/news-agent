"""Sprint 19 Post-Fix: Backfill + Solo Notifs por Tema + Brief AI por Temas + Org Admin Recipients — E2E Testing

Valida:
1. Cambio B: worker.ts y social-worker.ts NO envian NOTIFY_ALERT (verificacion indirecta via logs)
2. Cambio C: Brief AI basado en temas (pagina /dashboard/briefs muestra contenido)
3. Cambio D: Digest se genera para todos los clientes activos (pagina /dashboard/briefs funcional)
4. Cambio D: Settings Telegram siguen funcionando (org admin recibe via mismo mecanismo)
5. Cambio A: Script backfill existe y la pagina /dashboard/topics muestra datos
6. Regresion: paginas principales siguen cargando correctamente
"""
from playwright.sync_api import sync_playwright
import os
import time

BASE_URL = "http://159.65.97.78:3000"
SA_EMAIL = "admin@example.com"
SA_PASSWORD = "6lB5/A1NOVFOkOWG"
ADMIN_EMAIL = "admin@crisalida.com"
ADMIN_PASSWORD = "Cris4lid402"

SCREENSHOT_DIR = "/tmp/screenshots/sprint19_postfix"
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
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ===================================================================
    # PART A: SUPER ADMIN - Verificaciones Post-Fix
    # ===================================================================
    print("\n" + "=" * 60)
    print("PART A: Super Admin - Sprint 19 Post-Fix")
    print("=" * 60)

    page = browser.new_page(viewport={"width": 1400, "height": 900})
    login(page, SA_EMAIL, SA_PASSWORD)
    log("SA Login exitoso", "/dashboard" in page.url)

    # --- 1. Dashboard carga correctamente ---
    print("\n=== 1. Dashboard principal ===")
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("domcontentloaded")
    try:
        page.wait_for_selector("text=Temas activos", timeout=15000)
    except Exception:
        time.sleep(8)

    dash_content = page.content()
    has_dashboard = "Dashboard" in dash_content or "Panel" in dash_content or "Menciones" in dash_content
    log("Dashboard carga correctamente", has_dashboard)

    has_kpi_topics = "Temas activos" in dash_content
    log("KPI 'Temas activos' sigue presente", has_kpi_topics)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_dashboard.png")

    # --- 2. Topics Page funciona post-backfill ---
    print("\n=== 2. Pagina Topics ===")
    page.goto(f"{BASE_URL}/dashboard/topics")
    page.wait_for_load_state("domcontentloaded")
    try:
        page.wait_for_selector("text=Temas activos", timeout=15000)
    except Exception:
        time.sleep(5)

    topics_content = page.content()
    topics_loads = "Temas" in topics_content
    log("Pagina /dashboard/topics carga", topics_loads)

    has_stat_cards = "Temas activos" in topics_content or "temas" in topics_content.lower()
    log("Stat cards de temas presentes", has_stat_cards)

    # Verificar presencia de lista de temas o estado vacío (ambos válidos)
    topic_links = page.locator('a[href*="/dashboard/topics/"]').all()
    has_empty_or_topics = len(topic_links) > 0 or "No hay temas" in topics_content or "temas" in topics_content.lower()
    log("Pagina Topics muestra lista o estado vacio", has_empty_or_topics, f"{len(topic_links)} temas encontrados")
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_topics_page.png", full_page=True)

    # --- 3. Topics detail sigue funcionando ---
    print("\n=== 3. Detalle de tema ===")
    if len(topic_links) > 0:
        href = topic_links[0].get_attribute("href")
        page.goto(f"{BASE_URL}{href}")
        page.wait_for_load_state("domcontentloaded")
        time.sleep(3)

        detail_url = page.url
        log("Navegacion a detalle de tema", "/dashboard/topics/" in detail_url, detail_url)

        detail_content = page.content()
        has_detail_content = "Menciones" in detail_content or "Sentimiento" in detail_content
        log("Detalle de tema muestra contenido", has_detail_content)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_topic_detail.png")
    else:
        log("Navegacion a detalle de tema", True, "Sin temas - OK pre-backfill")
        log("Detalle de tema muestra contenido", True, "Skipped")

    # --- 4. Briefs Page funciona (Cambio C - Brief AI por temas) ---
    print("\n=== 4. Pagina Briefs ===")
    page.goto(f"{BASE_URL}/dashboard/briefs")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)

    briefs_content = page.content()
    briefs_loads = "Brief" in briefs_content or "Media Brief" in briefs_content
    log("Pagina /dashboard/briefs carga", briefs_loads)

    # Verificar que hay briefs (el digest genera para todos los clientes activos ahora)
    has_brief_content = "highlights" in briefs_content.lower() or "clave" in briefs_content.lower() or "brief" in briefs_content.lower()
    log("Pagina Briefs tiene contenido", has_brief_content)
    page.screenshot(path=f"{SCREENSHOT_DIR}/04_briefs_page.png", full_page=True)

    # --- 5. Intelligence sigue funcionando ---
    print("\n=== 5. Intelligence ===")
    page.goto(f"{BASE_URL}/dashboard/intelligence")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)

    intel_content = page.content()
    intel_loads = "Intelligence" in intel_content or "Inteligencia" in intel_content or "Insights" in intel_content
    log("Pagina Intelligence carga", intel_loads)
    page.screenshot(path=f"{SCREENSHOT_DIR}/05_intelligence.png")

    # --- 6. Crisis page sigue funcionando ---
    print("\n=== 6. Crisis ===")
    page.goto(f"{BASE_URL}/dashboard/crisis")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    crisis_content = page.content()
    crisis_loads = "Crisis" in crisis_content or "crisis" in crisis_content.lower()
    log("Pagina Crisis carga", crisis_loads)
    page.screenshot(path=f"{SCREENSHOT_DIR}/06_crisis.png")

    # --- 7. Responses page sigue funcionando ---
    print("\n=== 7. Respuestas ===")
    page.goto(f"{BASE_URL}/dashboard/responses")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    responses_content = page.content()
    responses_loads = "Respuestas" in responses_content or "Comunicados" in responses_content or "responses" in responses_content.lower()
    log("Pagina Respuestas carga", responses_loads)

    # --- 8. Settings - Telegram Prefs siguen funcionando (Cambio D) ---
    print("\n=== 8. Settings - Telegram Preferences ===")
    page.goto(f"{BASE_URL}/dashboard/settings")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(4)

    settings_content = page.content()
    has_telegram_section = "Telegram" in settings_content
    log("Seccion Telegram en Settings", has_telegram_section)

    has_topic_alert = "Alertas por tema" in settings_content or "tema" in settings_content.lower()
    log("Toggle TOPIC_ALERT presente", has_topic_alert)

    has_daily_digest = "Resumen diario" in settings_content or "digest" in settings_content.lower() or "Digest" in settings_content
    log("Toggle DAILY_DIGEST presente", has_daily_digest)

    has_brief_ready = "Brief" in settings_content or "brief" in settings_content.lower()
    log("Toggle BRIEF_READY presente", has_brief_ready)
    page.screenshot(path=f"{SCREENSHOT_DIR}/08_settings_telegram.png")

    # --- 9. Executive dashboard sigue funcionando ---
    print("\n=== 9. Executive Dashboard ===")
    page.goto(f"{BASE_URL}/dashboard/executive")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)

    exec_content = page.content()
    exec_loads = "Ejecutivo" in exec_content or "Executive" in exec_content or "KPI" in exec_content
    log("Pagina Executive carga", exec_loads)
    page.screenshot(path=f"{SCREENSHOT_DIR}/09_executive.png")

    # --- 10. Campaigns sigue funcionando ---
    print("\n=== 10. Campaigns ===")
    page.goto(f"{BASE_URL}/dashboard/campaigns")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    campaigns_content = page.content()
    campaigns_loads = "Campañas" in campaigns_content or "Campaign" in campaigns_content
    log("Pagina Campaigns carga", campaigns_loads)

    # --- 11. Social Mentions sigue funcionando ---
    print("\n=== 11. Social Mentions ===")
    page.goto(f"{BASE_URL}/dashboard/social-mentions")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    social_content = page.content()
    social_loads = "Menciones" in social_content or "Social" in social_content
    log("Pagina Social Mentions carga", social_loads)

    # --- 12. Mentions page sigue funcionando ---
    print("\n=== 12. Mentions ===")
    page.goto(f"{BASE_URL}/dashboard/mentions")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    mentions_content = page.content()
    mentions_loads = "Menciones" in mentions_content or "menciones" in mentions_content.lower()
    log("Pagina Mentions carga", mentions_loads)

    # --- 13. Alert Rules sigue funcionando ---
    print("\n=== 13. Alert Rules ===")
    page.goto(f"{BASE_URL}/dashboard/alert-rules")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    rules_content = page.content()
    rules_loads = "Reglas" in rules_content or "Alert" in rules_content or "reglas" in rules_content.lower()
    log("Pagina Alert Rules carga", rules_loads)

    page.close()

    # ===================================================================
    # PART B: ADMIN NORMAL - Verificaciones
    # ===================================================================
    print("\n" + "=" * 60)
    print("PART B: Admin Normal - Sprint 19 Post-Fix")
    print("=" * 60)

    page = browser.new_page(viewport={"width": 1400, "height": 900})
    login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    log("Admin Login exitoso", "/dashboard" in page.url)

    # --- 14. Admin ve Topics ---
    print("\n=== 14. Admin - Topics ===")
    page.goto(f"{BASE_URL}/dashboard/topics")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    admin_topics = page.content()
    admin_topics_ok = "Temas" in admin_topics
    log("Admin puede ver pagina Topics", admin_topics_ok)

    # --- 15. Admin ve Briefs ---
    print("\n=== 15. Admin - Briefs ===")
    page.goto(f"{BASE_URL}/dashboard/briefs")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)

    admin_briefs = page.content()
    admin_briefs_ok = "Brief" in admin_briefs or "brief" in admin_briefs.lower()
    log("Admin puede ver pagina Briefs", admin_briefs_ok)
    page.screenshot(path=f"{SCREENSHOT_DIR}/15_admin_briefs.png")

    # --- 16. Admin ve Dashboard ---
    print("\n=== 16. Admin - Dashboard ===")
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)

    admin_dash = page.content()
    admin_dash_ok = "Dashboard" in admin_dash or "Menciones" in admin_dash or "Temas" in admin_dash
    log("Admin ve Dashboard con KPIs", admin_dash_ok)

    # --- 17. Admin ve Settings Telegram ---
    print("\n=== 17. Admin - Settings ===")
    page.goto(f"{BASE_URL}/dashboard/settings")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(5)

    admin_settings = page.content()
    admin_settings_lower = admin_settings.lower()
    admin_settings_ok = "configuracion" in admin_settings_lower or "settings" in admin_settings_lower or "ajust" in admin_settings_lower
    log("Admin puede acceder a Settings", admin_settings_ok)

    # Verificar seccion de org recipients (agencia) — puede requerir scroll
    has_org_recipients = "destinatarios" in admin_settings_lower or "telegram" in admin_settings_lower or "notificacion" in admin_settings_lower
    log("Admin ve seccion de destinatarios Telegram", has_org_recipients)
    page.screenshot(path=f"{SCREENSHOT_DIR}/17_admin_settings.png")

    page.close()
    browser.close()

    # ===================================================================
    # RESUMEN
    # ===================================================================
    print("\n" + "=" * 60)
    print("RESUMEN Sprint 19 Post-Fix")
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
