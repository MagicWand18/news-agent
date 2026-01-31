#!/usr/bin/env python3
"""
Verificación de UI de Grounding en Detalle de Cliente
Toma screenshots de la configuración de grounding en modo claro y oscuro
"""

from playwright.sync_api import sync_playwright
import os

BASE_URL = "http://159.65.97.78:3000"
EMAIL = "admin@mediabot.local"
PASSWORD = "admin123"
SCREENSHOT_DIR = "/Users/master/Downloads/news-agent/screenshots/grounding_ui"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1200})
        page = context.new_page()

        print("=== Verificación UI de Grounding ===\n")

        # Login
        print("1. Iniciando sesión...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state('networkidle')
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=15000)
        page.wait_for_load_state('networkidle')
        print("   ✓ Login exitoso")

        # Navegar a Clientes
        print("\n2. Navegando a lista de clientes...")
        page.goto(f"{BASE_URL}/dashboard/clients")
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/01_clients_list_light.png", full_page=True)
        print("   ✓ Screenshot: 01_clients_list_light.png")

        # Buscar y hacer click en el primer cliente
        print("\n3. Abriendo detalle de cliente...")
        # Navegar directamente al primer cliente conocido
        page.goto(f"{BASE_URL}/dashboard/clients/cmkxo2e0q0005v1z9j6mv5ie8")
        page.wait_for_load_state('networkidle')
        # Esperar a que el contenido cargue (no solo "Cargando...")
        page.wait_for_timeout(3000)
        # Esperar a que aparezca el nombre del cliente
        try:
            page.wait_for_selector('h2:has-text("Presidencia")', timeout=10000)
            print("   ✓ Cliente cargado correctamente")
        except:
            print("   ⚠ Timeout esperando cliente, esperando más...")
            page.wait_for_timeout(3000)

        client_name = "Presidencia"
        if True:
            print(f"   Cliente: {client_name}")

            # Screenshot en modo claro
            page.screenshot(path=f"{SCREENSHOT_DIR}/02_client_detail_light.png", full_page=True)
            print("   ✓ Screenshot: 02_client_detail_light.png")

            # Verificar sección de Grounding Config
            print("\n4. Verificando sección de Grounding Config...")
            grounding_section = page.locator('text=Configuración de Búsqueda Automática')
            if grounding_section.count() > 0:
                print("   ✓ Sección de Grounding encontrada")

                # Scroll a la sección de grounding
                grounding_section.scroll_into_view_if_needed()
                page.wait_for_timeout(500)
                page.screenshot(path=f"{SCREENSHOT_DIR}/03_grounding_section_light.png", full_page=True)
                print("   ✓ Screenshot: 03_grounding_section_light.png")

                # Verificar toggles
                auto_toggle = page.locator('text=Grounding Automático').first
                weekly_toggle = page.locator('text=Grounding Semanal').first
                print(f"   - Toggle Automático visible: {auto_toggle.is_visible()}")
                print(f"   - Toggle Semanal visible: {weekly_toggle.is_visible()}")

                # Verificar botón de búsqueda manual
                search_btn = page.locator('button:has-text("Ejecutar búsqueda ahora")')
                print(f"   - Botón búsqueda manual visible: {search_btn.is_visible()}")
            else:
                print("   ⚠ Sección de Grounding NO encontrada")

            # Activar Dark Mode
            print("\n5. Activando Dark Mode...")
            page.evaluate("localStorage.setItem('theme', 'dark'); document.documentElement.classList.add('dark');")
            page.wait_for_timeout(500)

            # Screenshot del detalle en dark mode
            page.reload()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/04_client_detail_dark.png", full_page=True)
            print("   ✓ Screenshot: 04_client_detail_dark.png")

            # Scroll a grounding section en dark mode
            grounding_section = page.locator('text=Configuración de Búsqueda Automática')
            if grounding_section.count() > 0:
                grounding_section.scroll_into_view_if_needed()
                page.wait_for_timeout(500)
                page.screenshot(path=f"{SCREENSHOT_DIR}/05_grounding_section_dark.png", full_page=True)
                print("   ✓ Screenshot: 05_grounding_section_dark.png")

            # Verificar estado de dark mode
            has_dark_class = page.evaluate("document.documentElement.classList.contains('dark')")
            print(f"\n   HTML tiene clase 'dark': {has_dark_class}")

        # Limpiar
        browser.close()

        print(f"\n=== Verificación Completada ===")
        print(f"Screenshots guardados en: {SCREENSHOT_DIR}")

if __name__ == "__main__":
    main()
