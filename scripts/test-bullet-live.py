"""Real Bullet Run room, two identities, Realtime start/input and host closure."""
import asyncio, json, os
from playwright.async_api import async_playwright

URL = os.environ.get('ALIEN_TEST_ORIGIN', 'https://makaihurstjob-sys.github.io/alien-force-classic/')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge', headless=True)
        desktop = await browser.new_context(viewport={'width':1440,'height':1000})
        mobile = await browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        host, guest = await desktop.new_page(), await mobile.new_page()
        errors, snapshots, inputs = [], [], []
        def observe(page):
            page.on('pageerror', lambda e: errors.append(str(e)))
            def socket(ws):
                def message(raw):
                    try:
                        if isinstance(raw, bytes) and raw[0] in (3,4):
                            if raw[0] == 3:
                                at, size, payload_at = 7+sum(raw[1:4]), raw[4], 7+sum(raw[1:6])
                            else:
                                at, size, payload_at = 5+raw[1], raw[2], 5+sum(raw[1:4])
                            envelope = {'event':raw[at:at+size].decode(),'payload':json.loads(raw[payload_at:])}
                        else:
                            data=json.loads(raw)
                            envelope=data[4] if isinstance(data,list) else data.get('payload',{})
                        if envelope.get('event') == 'snapshot': snapshots.append(envelope['payload']['state'])
                        if envelope.get('event') == 'input': inputs.append(envelope['payload'])
                    except (ValueError,TypeError,KeyError,AttributeError): pass
                ws.on('framereceived',message)
            page.on('websocket',socket)
        observe(host); observe(guest)
        try:
            await host.goto(URL+'bullet-run',wait_until='networkidle')
            await host.get_by_role('button',name='Create Bullet Run room',exact=True).click()
            await host.locator('#bullet-link').wait_for(timeout=45000)
            link=await host.locator('#bullet-link').input_value()
            await guest.goto(link,wait_until='networkidle')
            await guest.get_by_role('button',name='Join room',exact=True).click()
            for page in [host,guest]:
                await page.get_by_text('2/24 players',exact=False).wait_for(timeout=30000)
                await page.get_by_text('Arena connected',exact=True).wait_for(timeout=30000)
            await host.get_by_role('button',name='Start match',exact=True).click()
            for page in [host,guest]:
                await page.locator('canvas').wait_for(timeout=20000)
                assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), 'Layout overflow'
            await guest.wait_for_timeout(1000)
            assert snapshots, 'No live snapshots received'
            before={v['id']:(v['x'],v['y']) for v in snapshots[-1]['pilots']}
            await guest.keyboard.down('KeyD')
            await guest.keyboard.down('Space')
            await guest.wait_for_timeout(1200)
            await guest.keyboard.up('KeyD')
            await guest.keyboard.up('Space')
            await guest.wait_for_timeout(500)
            assert any(v['input']['right'] and v['input']['fire'] for v in inputs), 'Guest input not received'
            after=snapshots[-1]
            assert any(before[v['id']]!=(v['x'],v['y']) for v in after['pilots']), 'No synchronized movement'
            assert any(s['bullets'] for s in snapshots), 'No synchronized projectiles'
            assert not errors, errors
            print('PASS: live create/join, two identities, Realtime start, guest movement/shooting, desktop/mobile layout',flush=True)
            await host.get_by_role('button',name='Leave room',exact=True).click()
            await host.get_by_role('button',name='Create Bullet Run room',exact=True).wait_for()
            await guest.get_by_text('The host closed this room.',exact=True).wait_for(timeout=15000)
            await guest.get_by_role('button',name='Leave room',exact=True).click()
            await guest.get_by_role('button',name='Create Bullet Run room',exact=True).wait_for()
            print('PASS: host closure propagated and both test players left; no runtime errors',flush=True)
        except Exception:
            for name,page in [('host',host),('guest',guest)]:
                print(name+': '+(await page.locator('body').inner_text())[:1800],flush=True)
            raise
        finally:
            for page in [guest,host]:
                try:
                    button=page.get_by_role('button',name='Leave room',exact=True)
                    if await button.count():
                        await button.click(timeout=5000)
                        await page.get_by_role('button',name='Create Bullet Run room',exact=True).wait_for(timeout=10000)
                except Exception as e: print('Cleanup incomplete: '+str(e),flush=True)
            await browser.close()

asyncio.run(main())
