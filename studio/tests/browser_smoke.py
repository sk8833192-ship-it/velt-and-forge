"""Optional real Chromium acceptance test; no server or product build required.
Run: python3 studio/tests/browser_smoke.py [--browser-path /path/to/chrome]
Requires the developer-only Python playwright and Pillow packages.
"""
import argparse
import io
import json
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('--browser-path')
args = parser.parse_args()
ARTIFACTS = Path(tempfile.mkdtemp(prefix='velt-forge-qa-'))
STUDIO = Path(__file__).resolve().parents[1] / 'index.html'
errors, network = [], []


def wait_ready(page):
    page.wait_for_function('window.VeltStudio && VeltStudio.getAnalysis() !== null')
    page.wait_for_function("!document.querySelector('#smart-fix').disabled")


def config(page):
    return page.evaluate('VeltStudio.getConfiguration()')


def canvas(page, selector='#relief-canvas'):
    return page.locator(selector).evaluate('(c) => c.toDataURL()')


with sync_playwright() as p:
    launch_options = {'headless': True}
    if args.browser_path:
        launch_options['executable_path'] = args.browser_path
    browser = p.chromium.launch(**launch_options)
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, accept_downloads=True, offline=True)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: network.append(request.url) if request.url.startswith(('http:', 'https:')) else None)
    page.goto(STUDIO.as_uri())
    wait_ready(page)
    assert config(page)['pricing']['total'] == 89
    assert page.evaluate('VeltStudio.getAnalysis().strokeRiskPixels') > 0, 'Fine serif demo must trigger the detector'
    page.screenshot(path=str(ARTIFACTS / 'desktop.png'), full_page=True)
    die = canvas(page)
    for mode in ['ice', 'leather', 'die']:
        page.locator(f'[data-mode="{mode}"]').click()
        page.wait_for_timeout(150)
        assert page.locator(f'[data-mode="{mode}"]').get_attribute('aria-pressed') == 'true'
        if mode != 'die':
            assert canvas(page) != die
        page.screenshot(path=str(ARTIFACTS / f'preview-{mode}.png'))
    page.locator('[data-material="steel"]').click()
    page.wait_for_timeout(150)
    assert canvas(page) != die, 'Steel must visibly change the die'
    page.locator('[data-size="38"]').click()
    page.select_option('#handle', 'steel')
    wait_ready(page)
    assert config(page)['pricing']['total'] == 102
    page.select_option('#medium', 'leather')
    wait_ready(page)
    assert config(page)['targetMedium']['minGap'] == .65
    for demo, name in [('wedding', 'Wedding Monogram A & M.svg'), ('leather', 'Leather Studio Badge.svg'), ('crest', 'Bar Crest.svg')]:
        page.locator(f'[data-demo="{demo}"]').click()
        page.wait_for_function('(name) => VeltStudio.getConfiguration().artwork === name', arg=name)
        wait_ready(page)
    page.locator('#threshold').evaluate('(e) => {e.value=210;e.dispatchEvent(new Event("input",{bubbles:true}));}')
    page.locator('#boldness').evaluate('(e) => {e.value=.25;e.dispatchEvent(new Event("input",{bubbles:true}));}')
    wait_ready(page)
    assert config(page)['artworkProcessing']['radialDilationMM'] == .25
    before = canvas(page, '#inspection-canvas')
    page.locator('#invert').check()
    wait_ready(page)
    assert canvas(page, '#inspection-canvas') != before
    page.locator('#invert').uncheck()
    wait_ready(page)
    page.locator('#show-overlay').uncheck()
    assert canvas(page, '#inspection-canvas') != before
    page.locator('#show-overlay').check()
    # Real safe SVG, including an asymmetric feature for the manufacturing proof.
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect x="70" y="100" width="70" height="400"/><path d="M140 100h240v70H140zM140 270h150v70H140z"/></svg>'
    page.set_input_files('#file-input', {'name': 'Asymmetric F.svg', 'mimeType': 'image/svg+xml', 'buffer': svg})
    page.wait_for_function('VeltStudio.getConfiguration().artwork === "Asymmetric F.svg"')
    wait_ready(page)
    # Real PNG and JPEG decoding, not mocked image objects.
    image = Image.new('RGB', (300, 300), 'white')
    draw = ImageDraw.Draw(image)
    draw.rectangle((70, 50, 100, 260), fill='black')
    draw.rectangle((70, 50, 230, 85), fill='black')
    for extension, format_name, mime in [('png', 'PNG', 'image/png'), ('jpg', 'JPEG', 'image/jpeg')]:
        buf = io.BytesIO()
        image.save(buf, format=format_name)
        page.set_input_files('#file-input', {'name': f'Uploaded.{extension}', 'mimeType': mime, 'buffer': buf.getvalue()})
        page.wait_for_function('(name) => VeltStudio.getConfiguration().artwork === name', arg=f'Uploaded.{extension}')
        wait_ready(page)
    retained = config(page)['artwork']
    page.set_input_files('#file-input', {'name': 'active.svg', 'mimeType': 'image/svg+xml', 'buffer': b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'})
    page.wait_for_function('document.querySelector("#upload-status").classList.contains("error")')
    assert config(page)['artwork'] == retained
    page.locator('[data-mode="die"]').click()
    old_view = canvas(page)
    box = page.locator('#relief-canvas').bounding_box()
    page.mouse.move(box['x'] + box['width'] * .45, box['y'] + box['height'] * .5)
    page.mouse.down()
    page.mouse.move(box['x'] + box['width'] * .7, box['y'] + box['height'] * .6, steps=5)
    page.mouse.up()
    page.wait_for_timeout(200)
    assert canvas(page) != old_view, 'Dragging must change tilt/light'
    page.locator('#review-order').click()
    assert page.locator('#summary-dialog').is_visible()
    exact = json.loads(page.locator('#summary-json').text_content())
    assert exact == config(page)
    with page.expect_download() as result:
        page.locator('#download-json').click()
    result.value.save_as(str(ARTIFACTS / 'configuration.json'))
    assert json.loads((ARTIFACTS / 'configuration.json').read_text()) == exact
    page.keyboard.press('Escape')
    page.locator('#open-export').click()
    for extension in ['svg', 'png']:
        with page.expect_download() as result:
            page.locator('#download-' + extension).click()
        result.value.save_as(str(ARTIFACTS / f'proof.{extension}'))
    exported = ET.parse(ARTIFACTS / 'proof.svg').getroot()
    production = exported.find('{http://www.w3.org/2000/svg}g[@id="production-artwork"]')
    assert 'scale(-1 1)' in production.attrib['transform']
    assert exported.attrib['width'] == '58mm'
    with Image.open(ARTIFACTS / 'proof.png') as proof:
        assert proof.size == (2428, 2560)
        assert set(proof.crop((190, 220, 2238, 2268)).convert('RGB').getdata()) <= {(0, 0, 0), (255, 255, 255)}, 'Artwork must be binary'
    page.keyboard.press('Escape')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(ARTIFACTS / 'mobile.png'), full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile must not overflow'
    page.locator('#review-order').click()
    assert page.locator('#summary-dialog').is_visible()
    page.keyboard.press('Escape')
    assert not errors, errors
    assert not network, network
    browser.close()
print(f'Browser acceptance passed; offline screenshots and exported proofs: {ARTIFACTS}')
