from pathlib import Path
import os
from playwright.sync_api import sync_playwright


OUTPUT = Path('/tmp/the-office-desktop.png')
APP_URL = os.environ.get('THE_OFFICE_URL', 'http://127.0.0.1:5173')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    page.goto(APP_URL)
    page.wait_for_load_state('networkidle')
    page.locator('.panel-kicker').get_by_text('OBSERVANDO').wait_for(timeout=5000)
    assert page.get_by_text('OBSERVADOR AUTOMÁTICO', exact=True).is_visible()
    page.screenshot(path=str(OUTPUT), full_page=True)

    assert page.get_by_text('La oficina', exact=True).is_visible()
    assert page.get_by_role('button', name='Seleccionar a Maya').is_visible()
    assert page.get_by_role('button', name='Seleccionar a Leo').is_visible()
    assert page.get_by_text('VPS · OPERATIONS', exact=True).is_visible()
    assert page.get_by_text("DIRECTOR'S OFFICE", exact=True).is_visible()
    assert page.get_by_role('button', name='Seleccionar a Clara').is_visible()
    assert page.get_by_role('button', name='Seleccionar a Lex').is_visible()
    assert page.get_by_role('button', name='Seleccionar a Rhea').is_visible()
    assert page.get_by_role('button', name='Seleccionar a Milo').is_visible()
    assert page.get_by_role('button', name='Seleccionar a Director').is_visible()
    sprite_count = page.locator('.agent-sheet').count()
    assert sprite_count == 8, f'Expected seven office sprites plus selected portrait, found {sprite_count}'
    assert page.locator('.agent-sheet').first.evaluate(
        "element => getComputedStyle(element).backgroundImage.includes('/assets/pixel-agents/characters/char_')"
    )

    page.get_by_role('button', name='Seleccionar a Leo').click()
    assert page.locator('.agent-profile .provider-badge').get_by_text('Codex', exact=True).is_visible()
    assert page.get_by_text('Registro local detectado · sin hooks', exact=True).is_visible()
    mode = page.locator('.observer-facts').locator('b').first.text_content()
    assert mode in ('ACTIVIDAD REAL', 'VIDA SIMULADA')
    assert page.get_by_role('button', name='Asignar').count() == 0

    page.get_by_role('button', name='Seleccionar a Director').click()
    assert page.locator('.agent-profile .provider-badge').get_by_text('VPS', exact=True).is_visible()
    assert page.get_by_text('RESULTADOS DEL VPS', exact=True).is_visible()

    page.get_by_role('button', name='EXPANDIR').click()
    assert page.get_by_text('La oficina está creciendo.', exact=True).is_visible()
    page.get_by_role('button', name='×', exact=True).click()

    assert not console_errors, f'Browser console errors: {console_errors}'
    browser.close()

print(f'Visual observer smoke test passed. Screenshot: {OUTPUT}')
