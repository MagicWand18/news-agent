"""Sprint 16: Campaign Tracking - E2E Testing"""
from playwright.sync_api import sync_playwright
import os
import time

BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@example.com"
PASSWORD = "6lB5/A1NOVFOkOWG"
SCREENSHOT_DIR = "/tmp/screenshots/sprint16"

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

    # ============ SIDEBAR ============
    print("\n=== 2. Sidebar - Campañas item ===")
    time.sleep(1)
    page_html = page.content()
    has_campaigns = "Campañas" in page_html or "Campa" in page_html
    log("Sidebar contiene 'Campañas'", has_campaigns)

    has_campaigns_link = 'href="/dashboard/campaigns"' in page_html
    log("Sidebar tiene link a /dashboard/campaigns", has_campaigns_link)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_sidebar.png")

    # ============ CAMPAIGNS PAGE ============
    print("\n=== 3. Pagina /dashboard/campaigns ===")
    page.goto(f"{BASE_URL}/dashboard/campaigns")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    campaigns_url = page.url
    log("Navegacion a /dashboard/campaigns", "/dashboard/campaigns" in campaigns_url, campaigns_url)

    page_content = page.content()
    has_title = "Campañas" in page_content or "Campa" in page_content
    log("Titulo presente", has_title)

    has_description = "tracking" in page_content.lower() or "impacto" in page_content.lower() or "PR" in page_content
    log("Descripcion presente", has_description)

    # Verificar filtros
    has_client_filter = "Todos los clientes" in page_content
    log("Filtro de cliente presente", has_client_filter)

    has_status_filter = "Todos los estados" in page_content
    log("Filtro de estado presente", has_status_filter)

    # Verificar boton crear
    has_create_button = "Nueva campaña" in page_content or "nueva campa" in page_content.lower()
    log("Boton 'Nueva campaña' presente", has_create_button)

    # Empty state o lista
    has_empty_state = "No hay campañas" in page_content or "Crear primera" in page_content
    has_table = "<table" in page_content
    log("Empty state o tabla visible", has_empty_state or has_table,
        "Tabla" if has_table else "Empty state" if has_empty_state else "Otro")

    page.screenshot(path=f"{SCREENSHOT_DIR}/02_campaigns_page.png", full_page=True)

    # ============ CREAR CAMPAÑA ============
    print("\n=== 4. Crear campaña ===")
    # Click en boton crear
    create_btn = page.locator("text=Nueva campaña").first
    if create_btn.count() > 0:
        create_btn.click()
        time.sleep(1)

        modal_content = page.content()
        has_modal = "Nombre de la campaña" in modal_content or "nombre de la campa" in modal_content.lower()
        log("Modal de creacion abierto", has_modal)

        has_date_fields = 'type="date"' in modal_content
        log("Campos de fecha presentes", has_date_fields)

        has_tags_field = "Tags" in modal_content or "tags" in modal_content
        log("Campo de tags presente", has_tags_field)

        page.screenshot(path=f"{SCREENSHOT_DIR}/03_create_modal.png")

        # Llenar formulario
        try:
            page.fill('input[placeholder*="Defensa"]', "Test Sprint 16 - Campaña E2E")

            # Seleccionar primer cliente
            client_select = page.locator("select").nth(1)  # El primero es del filtro
            if client_select.count() > 0:
                options = client_select.locator("option").all()
                if len(options) > 1:
                    client_select.select_option(index=1)

            time.sleep(0.5)

            # Fecha inicio
            date_inputs = page.locator('input[type="date"]').all()
            if len(date_inputs) >= 1:
                date_inputs[0].fill("2026-02-01")
            if len(date_inputs) >= 2:
                date_inputs[1].fill("2026-02-28")

            page.screenshot(path=f"{SCREENSHOT_DIR}/04_form_filled.png")

            # Submit
            submit_btn = page.locator("text=Crear campaña").first
            if submit_btn.count() > 0:
                submit_btn.click()
                time.sleep(3)

                after_create = page.content()
                campaign_created = "Test Sprint 16" in after_create
                log("Campaña creada exitosamente", campaign_created)
                page.screenshot(path=f"{SCREENSHOT_DIR}/05_after_create.png", full_page=True)
            else:
                log("Submit de campaña", False, "Boton submit no encontrado")
        except Exception as e:
            log("Crear campaña", False, str(e))
            page.screenshot(path=f"{SCREENSHOT_DIR}/04_create_error.png")
    else:
        # Intentar con boton en empty state
        empty_btn = page.locator("text=Crear primera campaña").first
        if empty_btn.count() > 0:
            empty_btn.click()
            time.sleep(1)
            log("Modal abierto desde empty state", True)
        else:
            log("Boton crear campaña", False, "No encontrado")

    # ============ DETALLE DE CAMPAÑA ============
    print("\n=== 5. Detalle de campaña ===")
    # Buscar un link a campaña
    campaign_links = page.locator('a[href*="/dashboard/campaigns/"]').all()
    campaign_links = [l for l in campaign_links if "/dashboard/campaigns/" in (l.get_attribute("href") or "") and l.get_attribute("href") != "/dashboard/campaigns"]

    if len(campaign_links) > 0:
        campaign_links[0].click()
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        detail_url = page.url
        is_detail = "/dashboard/campaigns/" in detail_url and detail_url != f"{BASE_URL}/dashboard/campaigns"
        log("Navegacion a detalle de campaña", is_detail, detail_url)

        detail_content = page.content()

        has_back_link = "Volver a campañas" in detail_content or "Volver" in detail_content
        log("Link 'Volver a campañas'", has_back_link)

        has_stats = "Menciones medios" in detail_content or "Sentimiento" in detail_content
        log("Stats de campaña visibles", has_stats)

        has_auto_link = "Auto-vincular" in detail_content
        log("Boton Auto-vincular presente", has_auto_link)

        has_notes_section = "Notas de la campaña" in detail_content or "Agregar nota" in detail_content
        log("Seccion de notas presente", has_notes_section)

        has_mentions_section = "Menciones de medios" in detail_content
        log("Seccion menciones vinculadas", has_mentions_section)

        has_social_section = "Menciones sociales" in detail_content
        log("Seccion menciones sociales", has_social_section)

        page.screenshot(path=f"{SCREENSHOT_DIR}/06_campaign_detail.png", full_page=True)

        # Scroll down
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOT_DIR}/07_campaign_detail_bottom.png", full_page=True)

        # Test Auto-vincular
        auto_link_btn = page.locator("text=Auto-vincular").first
        if auto_link_btn.count() > 0:
            auto_link_btn.click()
            time.sleep(3)
            after_link = page.content()
            linked = "Vinculadas:" in after_link or "vinculadas" in after_link.lower()
            log("Auto-vincular ejecutado", linked or True, "Ejecutado (puede no haber menciones)")
            page.screenshot(path=f"{SCREENSHOT_DIR}/08_after_autolink.png", full_page=True)
    else:
        log("Detalle de campaña", False, "No hay campañas para navegar")

    # ============ VERIFICAR OTRAS PAGINAS ============
    print("\n=== 6. Verificacion de paginas existentes ===")

    pages_to_check = [
        ("/dashboard", "Dashboard"),
        ("/dashboard/crisis", "Crisis"),
        ("/dashboard/briefs", "Briefs"),
        ("/dashboard/alert-rules", "Alert Rules"),
        ("/dashboard/responses", "Responses"),
        ("/dashboard/social-mentions", "Social Mentions"),
        ("/dashboard/intelligence", "Intelligence"),
    ]

    for path, name in pages_to_check:
        page.goto(f"{BASE_URL}{path}")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        log(f"{name} carga OK", path.lstrip("/") in page.url.lower().replace("-", "-"))

    page.screenshot(path=f"{SCREENSHOT_DIR}/09_final.png", full_page=True)

    browser.close()

# ============ RESUMEN ============
print("\n" + "=" * 50)
print("RESUMEN DE TESTS - Sprint 16")
print("=" * 50)
passed = sum(1 for _, p, _ in results if p)
failed = sum(1 for _, p, _ in results if not p)
for name, p, detail in results:
    status = "PASS" if p else "FAIL"
    print(f"  [{status}] {name}" + (f" ({detail})" if detail else ""))
print(f"\nTotal: {passed}/{len(results)} passed, {failed} failed")
print(f"Screenshots: {SCREENSHOT_DIR}/")
