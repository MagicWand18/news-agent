#!/usr/bin/env python3
"""
Verificación de Dark Mode en MediaBot Dashboard
Toma screenshots de todas las páginas principales en dark mode
"""

from playwright.sync_api import sync_playwright
import os

BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@mediabot.local"
PASSWORD = "admin123"
SCREENSHOT_DIR = "/Users/master/Downloads/news-agent/screenshots/dark_mode_verify"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        print("=== Verificación Dark Mode MediaBot ===\n")

        # 1. Login page
        print("1. Capturando Login page...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state('networkidle')
        page.screenshot(path=f"{SCREENSHOT_DIR}/01_login_page.png", full_page=True)
        print(f"   ✓ Guardado: 01_login_page.png")

        # Login
        print("\n2. Iniciando sesión...")
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=15000)
        page.wait_for_load_state('networkidle')
        print("   ✓ Login exitoso")

        # 2. Dashboard en light mode primero
        print("\n3. Capturando Dashboard (light mode)...")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_dashboard_light.png", full_page=True)
        print(f"   ✓ Guardado: 02_dashboard_light.png")

        # 3. Activar dark mode
        print("\n4. Activando Dark Mode...")
        # Buscar el botón de toggle de tema en el sidebar
        try:
            # El toggle debería estar en el sidebar
            theme_toggle = page.locator('button:has(svg.lucide-moon), button:has(svg.lucide-sun)').first
            if theme_toggle.is_visible():
                theme_toggle.click()
                page.wait_for_timeout(500)
                print("   ✓ Dark mode activado")
            else:
                # Intentar con selector alternativo
                page.click('button[aria-label*="tema"], button[title*="tema"], button:has-text("Tema")', timeout=3000)
                page.wait_for_timeout(500)
        except Exception as e:
            print(f"   ⚠ No se encontró toggle de tema: {e}")
            # Intentar forzar dark mode via localStorage
            page.evaluate("localStorage.setItem('theme', 'dark'); document.documentElement.classList.add('dark');")
            page.wait_for_timeout(500)
            print("   ✓ Dark mode forzado via JS")

        # 4. Dashboard en dark mode
        print("\n5. Capturando Dashboard (dark mode)...")
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_dashboard_dark.png", full_page=True)
        print(f"   ✓ Guardado: 03_dashboard_dark.png")

        # 5. Página Fuentes
        print("\n6. Navegando a Fuentes...")
        page.goto(f"{BASE_URL}/dashboard/sources")
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_sources_dark.png", full_page=True)
        print(f"   ✓ Guardado: 04_sources_dark.png")

        # 6. Abrir modal de editar fuente
        print("\n7. Abriendo modal de editar fuente...")
        try:
            # Buscar el primer botón de editar en la tabla
            edit_btn = page.locator('button[title="Editar"]').first
            if edit_btn.is_visible():
                edit_btn.click()
                page.wait_for_timeout(500)
                page.screenshot(path=f"{SCREENSHOT_DIR}/05_sources_edit_modal_dark.png", full_page=True)
                print(f"   ✓ Guardado: 05_sources_edit_modal_dark.png")
                # Cerrar modal
                page.click('button:has-text("Cancelar")')
                page.wait_for_timeout(300)
            else:
                print("   ⚠ No se encontró botón de editar")
        except Exception as e:
            print(f"   ⚠ Error abriendo modal: {e}")

        # 7. Pestaña Solicitudes
        print("\n8. Navegando a pestaña Solicitudes...")
        try:
            page.click('button:has-text("Solicitudes")')
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/06_sources_requests_dark.png", full_page=True)
            print(f"   ✓ Guardado: 06_sources_requests_dark.png")
        except Exception as e:
            print(f"   ⚠ Error: {e}")

        # 8. Modal Solicitar Fuente
        print("\n9. Abriendo modal Solicitar Fuente...")
        try:
            page.click('button:has-text("Solicitar Fuente")')
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/07_request_modal_dark.png", full_page=True)
            print(f"   ✓ Guardado: 07_request_modal_dark.png")
            page.click('button:has-text("Cancelar")')
            page.wait_for_timeout(300)
        except Exception as e:
            print(f"   ⚠ Error: {e}")

        # 9. Página Intelligence
        print("\n10. Navegando a Intelligence...")
        page.goto(f"{BASE_URL}/dashboard/intelligence")
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/08_intelligence_dark.png", full_page=True)
        print(f"   ✓ Guardado: 08_intelligence_dark.png")

        # 10. Página Menciones
        print("\n11. Navegando a Menciones...")
        page.goto(f"{BASE_URL}/dashboard/mentions")
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/09_mentions_dark.png", full_page=True)
        print(f"   ✓ Guardado: 09_mentions_dark.png")

        # 11. Página Clientes
        print("\n12. Navegando a Clientes...")
        page.goto(f"{BASE_URL}/dashboard/clients")
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/10_clients_dark.png", full_page=True)
        print(f"   ✓ Guardado: 10_clients_dark.png")

        # 12. Detalle de Cliente (primer cliente)
        print("\n13. Navegando a detalle de cliente...")
        try:
            # Click en el primer cliente de la lista
            client_link = page.locator('a[href*="/dashboard/clients/"]').first
            if client_link.is_visible():
                client_link.click()
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(1000)
                page.screenshot(path=f"{SCREENSHOT_DIR}/11_client_detail_dark.png", full_page=True)
                print(f"   ✓ Guardado: 11_client_detail_dark.png")
        except Exception as e:
            print(f"   ⚠ Error: {e}")

        # 13. Página Analytics
        print("\n14. Navegando a Analytics...")
        page.goto(f"{BASE_URL}/dashboard/analytics")
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/12_analytics_dark.png", full_page=True)
        print(f"   ✓ Guardado: 12_analytics_dark.png")

        # Verificar colores de dark mode en el DOM
        print("\n=== Verificando clases de Dark Mode ===")
        has_dark_class = page.evaluate("document.documentElement.classList.contains('dark')")
        print(f"   HTML tiene clase 'dark': {has_dark_class}")

        bg_color = page.evaluate("getComputedStyle(document.body).backgroundColor")
        print(f"   Background color del body: {bg_color}")

        browser.close()

        print(f"\n=== Verificación Completada ===")
        print(f"Screenshots guardados en: {SCREENSHOT_DIR}")
        print(f"Total: 12 capturas")

if __name__ == "__main__":
    main()
