"""Local hangar presentation tests; Supabase is replaced with fixtures."""
import ast
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

tree = ast.parse(Path('scripts/test-room-entry.py').read_text(encoding='utf-8'))
MOCK = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(getattr(t, 'id', '') == 'MOCK' for t in n.targets))
OUT = Path('C:/Users/macor/dashboard_files/conversation-a11aa5db2bb84b0ca911c6f23478d060')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge', headless=True)
        for width in [1440, 390]:
            page = await browser.new_page(viewport={'width': width, 'height': 1000})
            page.set_default_timeout(30000)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.route('**/src/lib/multiplayer.ts', lambda r: r.fulfill(content_type='application/javascript', body=MOCK))
            await page.goto('http://127.0.0.1:5198/alien-force-classic/')
            await page.get_by_role('button', name='Create Room', exact=True).click()
            await page.get_by_role('button', name='Bullet Run Free for all', exact=False).click()
            await page.get_by_role('button', name='Create Bullet Run room').click()
            await page.locator('.hangar-lobby').wait_for()
            await page.evaluate('''() => {
                const r=window.fixtureRoom; r.host_id=r.members[0].player_id;
                r.members[0].display_name='Makai';
                r.members.push({player_id:'guest',display_name:'Framber',ready:true},{player_id:'third',display_name:'Pilot 03',ready:false});
            }''')
            await page.get_by_text('1/3 pilots ready', exact=True).wait_for()
            assert await page.locator('.hangar-slot').count() == 4
            assert await page.get_by_role('button', name='Start match', exact=True).is_disabled()
            await page.get_by_role('button', name='Ready up', exact=True).click()
            await page.get_by_text('2/3 pilots ready', exact=True).wait_for()
            await page.screenshot(path=str(OUT / f'hangar-implementation-{width}.png'))
            await page.locator('.hangar-game-selector').click()
            await page.get_by_role('heading', name='Choose game', exact=True).wait_for()
            await page.screenshot(path=str(OUT / f'hangar-selector-implementation-{width}.png'))
            await page.keyboard.press('Escape')
            assert await page.locator('.hangar-lobby').is_visible()
            assert await page.locator('.hangar-game-selector').evaluate('(e)=>e===document.activeElement')
            await page.get_by_text('2/3 pilots ready', exact=True).wait_for()
            for close_button in ['Close game selector', 'Bullet Run Free for all Current game']:
                await page.locator('.hangar-game-selector').click()
                await page.get_by_role('button', name=close_button, exact=True).click()
                assert await page.locator('.hangar-lobby').is_visible()
                await page.get_by_text('2/3 pilots ready', exact=True).wait_for()
            for count, expected in [(4, 5), (5, 6), (6, 6)]:
                await page.evaluate('(n)=>window.fixtureRoom.members.push({player_id:String(n),display_name:"Pilot "+n,ready:false})', count)
                await page.get_by_text(f'2/{count} pilots ready', exact=True).wait_for()
                assert await page.locator('.hangar-slot').count() == expected
            assert await page.locator('.hangar-slot.is-empty').count() == 0
            assert await page.locator('.is-hangar').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
            await page.screenshot(path=str(OUT / f'hangar-six-implementation-{width}.png'))
            await page.get_by_role('button', name='Leave room', exact=True).click()
            await page.get_by_role('button', name='Create Room', exact=True).wait_for()
            assert not await page.locator('dialog[open]').count()
            assert not errors, errors
            print(f'PASS {width}: full-screen lobby, readiness, overlay/focus, 4/5/6 slots, no overflow, leave returns home', flush=True)
            await page.close()
        await browser.close()

asyncio.run(main())
