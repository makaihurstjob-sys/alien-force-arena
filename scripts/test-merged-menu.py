"""Exercise the built Pages app, with local fallback routing and no database writes."""
import asyncio, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        relative = path.split('?')[0].removeprefix('/alien-force-classic/').lstrip('/')
        target = Path('dist-pages').resolve() / relative
        return str(target if target.is_file() else Path('dist-pages/index.html').resolve())
    def log_message(self, *args): pass

async def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/alien-force-classic/'
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='msedge', headless=True)
            for width in [1440, 768, 390]:
                page = await browser.new_page(viewport={'width': width, 'height': 1000})
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                await page.goto(url, wait_until='networkidle')
                modes = ['Classic','Ranked','Arcade','Bullet Run','Practice','Global Leaderboard','Ranked Ratings']
                positions = []
                for mode in modes:
                    if width >= 768:
                        await page.locator('.desktop-mode-tile').filter(has=page.locator('strong', has_text=mode)).filter(has_text=mode).first.click() if mode != 'Ranked' else await page.locator('.desktop-mode-tile').filter(has=page.get_by_text('Ranked', exact=True)).click()
                        positions.append(round((await page.locator('.desktop-play').bounding_box())['y']))
                    else:
                        await page.get_by_role('button', name=f'Show {mode}', exact=True).click()
                if width >= 768: assert max(positions)-min(positions) <= 1, positions
                await page.get_by_role('button', name='View Ranked Ratings', exact=True).click()
                await page.locator('.ranked-experiment summary').click()
                await page.get_by_role('button', name='1A · Stocks', exact=True).click()
                await page.get_by_role('button', name='1B · Rounds', exact=True).click()
                await page.get_by_role('button', name='Close dialog', exact=True).click()
                if width >= 768: await page.locator('.desktop-mode-tile').filter(has_text='Bullet Run').click()
                else: await page.get_by_role('button', name='Show Bullet Run', exact=True).click()
                await page.locator('a.desktop-play' if width >= 768 else 'a.mobile-play').click()
                await page.get_by_role('heading', name='Bullet Run', exact=True).wait_for()
                await page.get_by_role('button', name='Create Bullet Run room', exact=True).wait_for()
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                await page.reload(wait_until='networkidle')
                await page.get_by_role('heading', name='Bullet Run', exact=True).wait_for()
                await page.get_by_role('link', name='Main menu', exact=False).click()
                for route, marker in [('classic','canvas'), ('practice','canvas')]:
                    await page.goto(url + route, wait_until='networkidle')
                    await page.locator(marker).first.wait_for()
                assert not errors, errors
                print(f'PASS {width}: seven modes, stable desktop action, ranked experiments, Bullet Run lobby/reload/return, Classic and Practice, no runtime errors', flush=True)
                await page.close()
            await browser.close()
    finally: server.shutdown()

asyncio.run(main())
