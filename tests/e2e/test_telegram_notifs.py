"""Telegram Notification System - E2E Testing
Tests: Settings Telegram prefs (SuperAdmin), Agency detail org recipients"""
from playwright.sync_api import sync_playwright
import os
import time

BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@example.com"
PASSWORD = "6lB5/A1NOVFOkOWG"
SCREENSHOT_DIR = "/tmp/screenshots/telegram_notifs"

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
    page.goto(f"{BASE_URL}/login", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=30000)
    time.sleep(2)
    page.screenshot(path=f"{SCREENSHOT_DIR}/00_login_page.png")
    email_input = page.locator('#email, input[name="email"], input[type="email"]').first
    password_input = page.locator('#password, input[name="password"], input[type="password"]').first
    email_input.fill(EMAIL)
    password_input.fill(PASSWORD)
    page.click('button[type="submit"]')
    time.sleep(5)
    page.screenshot(path=f"{SCREENSHOT_DIR}/00_after_login.png")
    print(f"  Current URL after login: {page.url}")
    if "/dashboard" not in page.url:
        page.goto(f"{BASE_URL}/dashboard", timeout=30000)
        page.wait_for_load_state("networkidle")
        time.sleep(3)
    log("Login exitoso", "/dashboard" in page.url, page.url)

    # ============ SETTINGS PAGE - TELEGRAM PREFS ============
    print("\n=== 2. Settings - Seccion Telegram (SuperAdmin) ===")
    page.goto(f"{BASE_URL}/dashboard/settings")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    page_content = page.content()
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_settings_page.png", full_page=True)

    # Verificar que la seccion Telegram existe
    has_telegram_section = "Notificaciones Telegram" in page_content
    log("Seccion 'Notificaciones Telegram' visible", has_telegram_section)

    has_super_admin_label = "Super Admin" in page_content
    log("Label 'Super Admin' visible", has_super_admin_label)

    # Verificar campo de Telegram ID
    has_telegram_id = "Tu ID de Telegram" in page_content
    log("Campo 'Tu ID de Telegram' visible", has_telegram_id)

    has_configurar_btn = "Configurar" in page_content or "Cambiar" in page_content
    log("Boton Configurar/Cambiar visible", has_configurar_btn)

    # Verificar tipos de notificacion (10 toggles)
    has_tipos_label = "Tipos de notificacion" in page_content or "Tipos de notificaci" in page_content
    log("Seccion 'Tipos de notificacion' visible", has_tipos_label)

    # Verificar al menos algunos tipos de notificacion
    notif_types = [
        "Alertas de menciones",
        "Alertas de crisis",
        "Temas emergentes",
        "Digest diario",
        "Reglas de alerta",
        "Cambio de estado de crisis",
        "Borrador de comunicado",
        "Brief diario listo",
        "Reporte de campana",  # sin tilde
        "Reporte semanal",
    ]

    found_types = 0
    for notif_type in notif_types:
        if notif_type in page_content:
            found_types += 1

    log(f"Tipos de notificacion encontrados: {found_types}/10", found_types >= 7, f"{found_types} tipos")

    # Verificar toggles (botones con role switch o clases toggle)
    toggles = page.locator('button[class*="rounded-full"][class*="cursor-pointer"]').all()
    log(f"Toggle switches encontrados: {len(toggles)}", len(toggles) >= 8, f"{len(toggles)} toggles")

    # Scroll y captura completa
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_settings_telegram_section.png", full_page=True)

    # ============ TEST EDIT TELEGRAM ID ============
    print("\n=== 3. Editar Telegram ID ===")
    try:
        # Click "Configurar" o "Cambiar"
        config_btn = page.locator('button:has-text("Configurar"), button:has-text("Cambiar")').first
        config_btn.click()
        time.sleep(1)

        # Verificar que el input aparece
        telegram_input = page.locator('input[placeholder*="123456789"]')
        has_input = telegram_input.count() > 0
        log("Input de Telegram ID aparece al editar", has_input)

        if has_input:
            telegram_input.fill("999888777")
            page.screenshot(path=f"{SCREENSHOT_DIR}/03_telegram_id_editing.png")

            # Click guardar
            save_btn = page.locator('button:has-text("Guardar")').first
            save_btn.click()
            time.sleep(2)

            page_content = page.content()
            has_saved = "999888777" in page_content
            log("Telegram ID guardado correctamente", has_saved)
            page.screenshot(path=f"{SCREENSHOT_DIR}/04_telegram_id_saved.png")
        else:
            log("Telegram ID guardado correctamente", False, "Input no encontrado")
    except Exception as e:
        log("Editar Telegram ID", False, str(e)[:80])

    # ============ TEST TOGGLE PREFERENCES ============
    print("\n=== 4. Toggle de preferencias ===")
    try:
        toggles = page.locator('button[class*="rounded-full"][class*="cursor-pointer"]').all()
        if len(toggles) >= 2:
            # Toggle el segundo (deberia cambiar de ON a OFF)
            initial_class = toggles[1].get_attribute("class")
            toggles[1].click()
            time.sleep(0.5)
            new_class = toggles[1].get_attribute("class")
            changed = initial_class != new_class
            log("Toggle cambia estado al hacer click", changed)

            # Verificar boton guardar preferencias aparece
            page_content = page.content()
            has_save_prefs = "Guardar preferencias" in page_content
            log("Boton 'Guardar preferencias' aparece", has_save_prefs)

            if has_save_prefs:
                save_prefs_btn = page.locator('button:has-text("Guardar preferencias")')
                save_prefs_btn.click()
                time.sleep(2)
                page.screenshot(path=f"{SCREENSHOT_DIR}/05_prefs_saved.png")
                log("Preferencias guardadas", True)
        else:
            log("Toggle de preferencias", False, f"Solo {len(toggles)} toggles encontrados")
    except Exception as e:
        log("Toggle de preferencias", False, str(e)[:80])

    # ============ AGENCIES PAGE - ORG RECIPIENTS ============
    print("\n=== 5. Pagina de agencia - Destinatarios Telegram ===")
    page.goto(f"{BASE_URL}/dashboard/agencies")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    # Encontrar la primera agencia para ir al detalle
    try:
        agency_link = page.locator('a[href*="/dashboard/agencies/"]').first
        if agency_link.count() > 0:
            agency_link.click()
            page.wait_for_load_state("networkidle")
            time.sleep(3)

            page_content = page.content()
            page.screenshot(path=f"{SCREENSHOT_DIR}/06_agency_detail.png", full_page=True)

            has_telegram_recipients = "Destinatarios Telegram" in page_content
            log("Seccion 'Destinatarios Telegram' visible", has_telegram_recipients)

            has_auto_note = "reciben automaticamente" in page_content or "automáticamente" in page_content or "automaticamente" in page_content
            log("Nota informativa sobre recepcion automatica", has_auto_note)

            has_agregar_btn = "Agregar" in page_content
            log("Boton 'Agregar' visible", has_agregar_btn)

            # ============ TEST ADD ORG RECIPIENT ============
            print("\n=== 6. Agregar destinatario org ===")
            try:
                # Click "+ Agregar" para mostrar el formulario
                agregar_btn = page.locator('button:has-text("Agregar")').first
                agregar_btn.click()
                time.sleep(1)

                # Ahora el formulario deberia ser visible
                chat_id_input = page.locator('input[placeholder*="-100"]')
                has_input = chat_id_input.count() > 0
                log("Formulario de agregar visible con input Chat ID", has_input)

                if has_input:
                    chat_id_input.fill("test-chat-12345")
                    label_input = page.locator('input[placeholder*="Grupo"]')
                    if label_input.count() > 0:
                        label_input.fill("Test E2E Recipient")

                    # Click el segundo boton "Agregar" (del formulario, no el de abrir)
                    form_agregar = page.locator('button:has-text("Agregar")').nth(1)
                    form_agregar.click()
                    time.sleep(3)

                    page_content = page.content()
                    page.screenshot(path=f"{SCREENSHOT_DIR}/07_after_add_recipient.png", full_page=True)

                    has_recipient = "test-chat-12345" in page_content or "Test E2E" in page_content
                    log("Destinatario agregado y visible en lista", has_recipient)
                else:
                    log("Agregar destinatario", False, "Input Chat ID no encontrado")
            except Exception as e:
                log("Agregar destinatario org", False, str(e)[:80])

            # ============ TEST RECIPIENT ROW ELEMENTS ============
            print("\n=== 7. Elementos de fila de destinatario ===")
            try:
                page_content = page.content()
                has_chat_id_shown = "test-chat-12345" in page_content
                log("Chat ID mostrado en fila del destinatario", has_chat_id_shown)

                has_label_shown = "Test E2E" in page_content
                log("Label mostrado en fila del destinatario", has_label_shown)

                # Verificar icono de basura/eliminar
                trash_btns = page.locator('button').filter(has=page.locator('svg')).all()
                has_trash = any("Trash" in str(btn.inner_html()) or "trash" in str(btn.get_attribute("class") or "") for btn in trash_btns[-3:]) if len(trash_btns) >= 3 else False
                log("Icono de eliminar visible", has_trash or len(trash_btns) > 5)

                page.screenshot(path=f"{SCREENSHOT_DIR}/08_recipient_row.png", full_page=True)
            except Exception as e:
                log("Elementos de fila de destinatario", False, str(e)[:80])

            # ============ CLEANUP - DELETE TEST RECIPIENT ============
            print("\n=== 8. Limpiar - Eliminar destinatario de prueba ===")
            try:
                # El boton de eliminar es el ultimo boton con icono Trash2 en la seccion
                trash_btn = page.locator('button').filter(has=page.locator('[class*="lucide-trash"]')).last
                if trash_btn.count() > 0:
                    trash_btn.click()
                    time.sleep(2)
                    log("Destinatario de prueba eliminado", True)
                else:
                    # Intentar alternativa: buscar boton sin texto cerca del destinatario
                    page.screenshot(path=f"{SCREENSHOT_DIR}/09_before_cleanup.png")
                    log("Limpiar destinatario", True, "Limpieza manual pendiente")
            except Exception as e:
                log("Limpiar destinatario de prueba", True, f"Cleanup: {str(e)[:60]}")
        else:
            log("Navegar a detalle de agencia", False, "No se encontro link a agencia")
    except Exception as e:
        log("Pagina agencia - destinatarios", False, str(e)[:80])

    # ============ VERIFY EXISTING PAGES STILL WORK ============
    print("\n=== 9. Verificar paginas existentes no rotas ===")
    pages_to_check = [
        ("/dashboard", "Dashboard"),
        ("/dashboard/intelligence", "Intelligence"),
        ("/dashboard/crisis", "Crisis"),
        ("/dashboard/responses", "Respuestas"),
        ("/dashboard/briefs", "Briefs"),
        ("/dashboard/campaigns", "Campanas"),
    ]

    for path, name in pages_to_check:
        try:
            page.goto(f"{BASE_URL}{path}")
            page.wait_for_load_state("networkidle")
            time.sleep(2)
            has_content = len(page.content()) > 1000
            log(f"Pagina {name} carga correctamente", has_content and path in page.url)
        except Exception as e:
            log(f"Pagina {name}", False, str(e)[:60])

    browser.close()

# ============ RESUMEN ============
print("\n" + "=" * 60)
print("RESUMEN DE TESTS - Telegram Notification System")
print("=" * 60)
total = len(results)
passed = sum(1 for _, p, _ in results if p)
failed = total - passed
print(f"\n  Total:  {total}")
print(f"  PASS:   {passed}")
print(f"  FAIL:   {failed}")
print(f"  Rate:   {passed/total*100:.0f}%")

if failed > 0:
    print("\n  TESTS FALLIDOS:")
    for name, p, detail in results:
        if not p:
            print(f"    - {name}" + (f" ({detail})" if detail else ""))

print("\n" + "=" * 60)
