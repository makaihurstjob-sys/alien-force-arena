import asyncio, os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge', headless=True)
        for width in [1440, 390]:
            page = await browser.new_page(viewport={'width': width, 'height': 1000})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            url = os.environ.get('PAGES_URL', 'http://127.0.0.1:8766/alien-force-classic/')
            if '127.0.0.1' in url:
                await page.route('**/alien-force-classic/**', lambda route: route.continue_(url=route.request.url.replace('/alien-force-classic/', '/')))
            await page.goto(url, wait_until='networkidle')
            if width > 767:
                await page.locator('.desktop-mode-tile').filter(has_text='Ranked Ratings').click()
            else:
                await page.get_by_role('button', name='Show Ranked Ratings', exact=True).click()
            await page.get_by_role('button', name='View Ranked Ratings', exact=True).click()
            await page.locator('.ranked-experiment summary').click()
            for label in ['1A · Stocks', '1B · Rounds']:
                await page.get_by_role('button', name=label, exact=True).click()
                arena = page.locator('.ranked-experiment > canvas')
                assert await arena.evaluate('(e) => e === document.activeElement')
                await page.wait_for_timeout(3300)
                before = await arena.evaluate('(e) => e.toDataURL()')
                await page.keyboard.press('f')
                await page.wait_for_timeout(250)
                assert before != await arena.evaluate('(e) => e.toDataURL()')
                await page.get_by_role('button', name=label, exact=True).focus()
                await page.wait_for_timeout(100)
                before = await arena.evaluate('(e) => e.toDataURL()')
                await page.wait_for_timeout(200)
                assert before == await arena.evaluate('(e) => e.toDataURL()')
            assert not errors, errors
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.screenshot(path=f'ranked-experiment-{width}.png', full_page=True)
            print(f'PASS {width}: both formats, keyboard focus, animation, blur pause, no overflow or runtime errors', flush=True)
            await page.close()
        await browser.close()

asyncio.run(main())
