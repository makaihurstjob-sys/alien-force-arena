import asyncio, os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge', headless=True)
        for width, height in [(1440, 900), (390, 844), (320, 640), (844, 390)]:
            context = await browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.goto(os.environ.get('PAGES_URL', 'http://127.0.0.1:4178/alien-force-classic/'))
            await page.get_by_role('button', name='START', exact=True).click()
            await page.locator('.arena-play-button').wait_for(state='visible')
            assert await page.locator('.arena-play-button').evaluate("e => getComputedStyle(e).outlineStyle") == 'none'
            await page.keyboard.press('Tab')
            await page.locator('.arena-play-button').focus()
            assert await page.locator('.arena-play-button').evaluate("e => getComputedStyle(e).outlineStyle") == 'solid'
            await page.locator('.arena-play-button').evaluate('e => e.blur()')
            assert await page.locator('.arena-menu-nav button').all_text_contents() == ['Play', 'Leaderboards', 'Loadout', 'Shop']
            assert await page.locator('.desktop-mode-picker, .mode-carousel').count() == 0
            assert await page.locator('.arena-menu-logo').evaluate("e => getComputedStyle(e).userSelect") == 'none'
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.screenshot(path=str(Path('test-artifacts') / f'menu-{width}.png'), full_page=True)
            await page.locator('.arena-selected-game').click()
            choices = page.locator('.arena-game-grid > button')
            assert await choices.count() == 8
            await choices.filter(has_text='Classic 1v1').click()
            assert await page.locator('.arena-selected-copy strong').inner_text() == 'Classic 1v1'
            await page.locator('dialog[aria-labelledby="mobile-panel-title"]').wait_for(state='hidden')
            await page.locator('.arena-selected-game').click()
            await page.keyboard.press('Escape')
            await page.locator('dialog[aria-labelledby="mobile-panel-title"]').wait_for(state='hidden')
            for tab in ['Loadout', 'Shop']:
                await page.locator('.arena-menu-nav').get_by_role('button', name=tab, exact=True).click()
                assert await page.locator('.arena-feature-panel').is_visible()
                await page.get_by_role('button', name='Close dialog', exact=True).click()
            await page.locator('.arena-menu-nav').get_by_role('button', name='Leaderboards', exact=True).click()
            assert await page.locator('.classic-tracker').is_visible()
            await page.get_by_role('button', name='Ranked ratings', exact=True).click()
            assert await page.locator('#mobile-panel-title').inner_text() == 'Ranked Ratings'
            await page.get_by_role('button', name='Close dialog', exact=True).click()
            await page.locator('.arena-selected-game').click()
            await page.locator('.arena-game-grid > button').filter(has=page.get_by_text('Classic', exact=True)).click()
            await page.locator('.arena-play-button').click()
            await page.get_by_role('region', name='Classic lobby', exact=True).wait_for(timeout=45000)
            await page.get_by_role('button', name='Leave room', exact=True).click()
            await page.locator('dialog[aria-labelledby=mobile-panel-title]').wait_for(state='hidden')
            assert not errors, errors
            print(f'PASS {width}x{height}: navigation, selection, focus, dialogs, no overflow or runtime errors', flush=True)
            await context.close()
        await browser.close()

asyncio.run(main())

