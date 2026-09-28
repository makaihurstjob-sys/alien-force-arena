"""Opt-in live smoke test: creates one temporary room and two anonymous identities."""
import asyncio
import json
import os
import re
from playwright.async_api import async_playwright

URL = os.environ.get('ALIEN_FORCE_TEST_URL', 'https://makaihurstjob-sys.github.io/alien-force-classic/')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge', headless=True)
        pages = []
        errors = []
        snapshots = []
        frame_shapes = set()
        def frame_received(frame):
            try:
                if isinstance(frame, bytes):
                    topic_size, event_size, metadata_size = frame[1:4]
                    offset = 5 + topic_size
                    event = frame[offset:offset + event_size].decode()
                    offset += event_size + metadata_size
                    packet = {'payload': {'event': event, 'payload': json.loads(frame[offset:])}}
                else:
                    packet = json.loads(frame)
                if isinstance(packet, list):
                    frame_shapes.add('list:' + str(len(packet)))
                    packet = {'payload': packet[-1]}
                else:
                    frame_shapes.add('object:' + ','.join(packet.keys()))
                payload = packet.get('payload', {})
                frame_shapes.add('payload:' + ','.join(payload.keys()) + ':event=' + str(payload.get('event')))
                if payload.get('event') == 'snapshot':
                    state = payload.get('payload', {})
                    snapshots.append((state.get('matchId'), state.get('state', {}).get('tick', -1)))
            except (ValueError, AttributeError):
                pass
        try:
            for width in [1440, 390]:
                context = await browser.new_context(viewport={'width': width, 'height': 1000})
                page = await context.new_page()
                page.set_default_timeout(45000)
                page.on('pageerror', lambda e: errors.append(str(e)))
                pages.append(page)
                if width == 390:
                    page.on('websocket', lambda ws: ws.on('framereceived', frame_received))
                await page.goto(URL)
                if width == 1440:
                    await page.get_by_role('button', name='Bullet Run', exact=True).click()
                    await page.locator('.desktop-play:visible').click()
            host, guest = pages
            room_label = host.locator('.hangar-tabs > strong, .bullet-lobby > strong')
            await room_label.wait_for()
            code = (await room_label.inner_text()).split()[-1]
            assert re.fullmatch(r'[A-Z0-9]+', code)
            await guest.goto(URL + '#room=' + code + '&mode=bullet')
            for page in pages:
                await page.get_by_text('0/2 pilots ready', exact=True).wait_for()
            identities = [await page.evaluate("JSON.parse(localStorage.getItem('alien-force-multiplayer')).user.id") for page in pages]
            assert identities[0] != identities[1]
            print('PASS two independent live anonymous identities', flush=True)
            for round_number in [1, 2]:
                for page in pages:
                    await page.get_by_text('0/2 pilots ready', exact=True).wait_for()
                assert await host.get_by_role('button', name='Start match', exact=True).is_disabled()
                await guest.get_by_role('button', name='Ready up', exact=True).click()
                await host.get_by_text('1/2 pilots ready', exact=True).wait_for()
                await guest.get_by_role('button', name='Cancel ready', exact=True).click()
                await host.get_by_text('0/2 pilots ready', exact=True).wait_for()
                for page in pages:
                    await page.get_by_role('button', name='Ready up', exact=True).click()
                for page in pages:
                    await page.get_by_text('2/2 pilots ready', exact=True).wait_for()
                start = len(snapshots)
                await host.get_by_role('button', name='Start match', exact=True).click()
                for page in pages:
                    await page.locator('canvas[aria-label="Bullet Run arena"]').wait_for()
                for _ in range(100):
                    if len(snapshots) >= start + 3:
                        break
                    await asyncio.sleep(.1)
                received = snapshots[start:]
                assert len(received) >= 3, f'No live guest snapshot stream; formats: {frame_shapes}'
                assert received[-1][1] > received[0][1], 'Snapshot ticks did not advance'
                assert received[-1][0], 'Missing match ID'
                if round_number == 1:
                    first_match = received[-1][0]
                else:
                    assert received[-1][0] != first_match
                await host.get_by_role('button', name='Return everyone to room', exact=True).click()
                for page in pages:
                    await page.get_by_text('0/2 pilots ready', exact=True).wait_for()
                    assert await page.locator('canvas[aria-label="Bullet Run arena"]').count() == 0
                print(f'PASS live round {round_number}: ready/cancel sync, launch, advancing Realtime snapshots, return/reset', flush=True)
            await host.get_by_role('button', name='Leave room', exact=True).click()
            await guest.get_by_text('The host closed this room.', exact=True).wait_for()
            assert not errors, errors
            print('PASS live host closure reaches guest; no page errors', flush=True)
        finally:
            if pages:
                leave = pages[0].get_by_role('button', name='Leave room', exact=True)
                if await leave.count() and await leave.is_visible():
                    await leave.click()
                    print('Cleanup: host left temporary test room', flush=True)
            await browser.close()

asyncio.run(main())
