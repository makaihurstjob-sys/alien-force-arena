"""Two independent browser identities, real hosted lobby and Realtime transport.
Run against a static production preview or ALIEN_TEST_ORIGIN after publication.
"""
import asyncio
import json
import os
from playwright.async_api import async_playwright

ORIGIN = os.environ.get("ALIEN_TEST_ORIGIN", "http://127.0.0.1:5191/alien-force-classic/")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="msedge", headless=True)
        desktop = await browser.new_context(viewport={"width": 1440, "height": 1000})
        mobile = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        h, g = await desktop.new_page(), await mobile.new_page()
        errors, snapshots, inputs = [], {"host": [], "guest": []}, []
        def observe(page, name):
            page.on("pageerror", lambda error: errors.append(str(error)))
            def socket(ws):
                def message(raw):
                    try:
                        if isinstance(raw, bytes) and raw[0] in (3, 4):
                            # Supabase Realtime's JSON broadcasts use a binary header.
                            if raw[0] == 3:
                                event_at = 7 + sum(raw[1:4])
                                event_size = raw[4]
                                payload_at = 7 + sum(raw[1:6])
                            else:
                                event_at = 5 + raw[1]
                                event_size = raw[2]
                                payload_at = 5 + sum(raw[1:4])
                            envelope = {"event": raw[event_at:event_at + event_size].decode(), "payload": json.loads(raw[payload_at:])}
                        else:
                            data = json.loads(raw)
                            envelope = data[4] if isinstance(data, list) else data.get("payload", {})
                        event = envelope.get("event")
                        payload = envelope.get("payload", {})
                        if event == "state": snapshots[name].append(payload["snapshot"])
                        if event == "pilot": inputs.append(payload)
                    except (ValueError, TypeError, KeyError, AttributeError): pass
                ws.on("framereceived", message)
                ws.on("framesent", message)
            page.on("websocket", socket)
        observe(h, "host"); observe(g, "guest")
        try:
            await h.goto(ORIGIN, wait_until="networkidle")
            await h.get_by_role("button", name="Create Room", exact=True).click()
            await h.get_by_role("textbox", name="Room link").wait_for(timeout=45000)
            link = await h.get_by_role("textbox", name="Room link").input_value()
            await g.goto(link, wait_until="networkidle")
            await g.get_by_role("dialog").get_by_role("button", name="Join room", exact=True).click()
            await g.get_by_text("2/2 players", exact=True).wait_for(timeout=30000)
            await h.get_by_text("2/2 players", exact=True).wait_for(timeout=15000)
            assert await h.get_by_role("button", name="Start match", exact=True).is_disabled()
            await h.get_by_role("button", name="Ready", exact=True).click()
            await g.get_by_role("button", name="Ready", exact=True).click()
            await h.get_by_role("button", name="Start match", exact=True).click(timeout=20000)
            await g.get_by_role("region", name="Online 1v1 match").wait_for(timeout=15000)
            await h.wait_for_function("document.querySelector('.online-duel')?.dataset.phase === 'playing'", timeout=15000)
            await g.wait_for_function("document.querySelector('.online-duel')?.dataset.phase === 'playing'", timeout=15000)
            assert await h.locator(".online-duel").get_attribute("data-match-id") == await g.locator(".online-duel").get_attribute("data-match-id")
            assert not await g.evaluate("document.documentElement.scrollWidth > innerWidth"), "mobile page overflow"
            assert not await g.locator("dialog").evaluate("e => e.scrollWidth > e.clientWidth"), "mobile dialog overflow"
            assert await h.locator(".duel-footer").evaluate("e => e.getBoundingClientRect().top >= document.querySelector('.duel-controls').getBoundingClientRect().bottom"), "desktop controls overlap footer"
            for width, height in [(320, 740), (844, 390), (390, 844)]:
                await g.set_viewport_size({"width": width, "height": height})
                assert not await g.locator("dialog").evaluate("e => e.scrollWidth > e.clientWidth"), f"dialog overflow at {width}"
            print("PASS: real lobby, readiness gate, shared match/countdown and mobile layout", flush=True)

            # The two ships face each other on an unobstructed lane. Host shots should
            # produce the same eliminations, rounds, scores and final result on both devices.
            await h.locator(".duel-arena canvas").focus()
            await h.keyboard.down("Space")
            await h.get_by_role("region", name="Match results").wait_for(timeout=35000)
            await h.keyboard.up("Space")
            await g.get_by_role("region", name="Match results").wait_for(timeout=10000)
            assert "Victory! 3 - 0" in await h.locator(".duel-results").inner_text()
            assert "Defeat 3 - 0" in await g.locator(".duel-results").inner_text()
            first_match = await h.locator(".online-duel").get_attribute("data-match-id")
            await h.get_by_role("button", name="Rematch", exact=True).click()
            await g.wait_for_timeout(600)
            assert await g.locator(".online-duel").get_attribute("data-match-id") == first_match
            await g.get_by_role("button", name="Rematch", exact=True).click()
            await h.wait_for_function("old => document.querySelector('.online-duel')?.dataset.matchId !== old", arg=first_match)
            await g.wait_for_function("document.querySelector('.online-duel')?.dataset.phase === 'playing'", timeout=15000)
            print("PASS: synchronized shots, eliminations, 3-0 match result and mutual rematch", flush=True)
            if os.environ.get("ALIEN_SCREENSHOTS"):
                folder = os.environ["ALIEN_SCREENSHOTS"]
                os.makedirs(folder, exist_ok=True)
                await h.screenshot(path=os.path.join(folder, "alien-force-1v1-desktop.png"), full_page=True)
                await g.screenshot(path=os.path.join(folder, "alien-force-1v1-mobile.png"), full_page=True)

            # Mobile input is authoritative at the host. Capture both position and shot count.
            assert snapshots["host"] and snapshots["guest"], "No wire snapshots captured"
            before = snapshots["host"][-1]["state"]["ships"][1]
            touch = await mobile.new_cdp_session(g)
            async def press_touch(name, duration):
                button = g.get_by_role("button", name=name, exact=True)
                await button.scroll_into_view_if_needed()
                bounds = await button.bounding_box()
                await touch.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": bounds["x"] + bounds["width"] / 2, "y": bounds["y"] + bounds["height"] / 2, "id": 1}]})
                await g.wait_for_timeout(duration)
                await touch.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            await press_touch("Move up", 650)
            await press_touch("Fire", 150)
            await g.wait_for_timeout(200)
            after = snapshots["host"][-1]["state"]["ships"][1]
            assert after["y"] < before["y"], (before, after)
            assert after["shots"] > before["shots"], (before, after)
            print("PASS: mobile lane steering and fire reach host simulation", flush=True)

            # Deliberately drop the guest network. Both clients must pause; score must freeze.
            await mobile.set_offline(True)
            await h.wait_for_function("document.querySelector('.online-duel')?.dataset.paused === 'true'", timeout=12000)
            frozen = await h.locator(".online-duel").get_attribute("data-tick")
            await h.wait_for_timeout(500)
            assert await h.locator(".online-duel").get_attribute("data-tick") == frozen
            await mobile.set_offline(False)
            await h.wait_for_function("document.querySelector('.online-duel')?.dataset.paused === 'false'", timeout=20000)
            await g.wait_for_function("document.querySelector('.online-duel')?.dataset.paused === 'false'", timeout=20000)
            print("PASS: disconnect freezes match and reconnect resumes", flush=True)

            # A guest can reload, rejoin their room with the persisted guest identity,
            # and receive the existing host snapshot instead of starting another match.
            current_match = await h.locator(".online-duel").get_attribute("data-match-id")
            await g.reload(wait_until="networkidle")
            await g.get_by_role("dialog").get_by_role("button", name="Join room", exact=True).click()
            await g.get_by_role("region", name="Online 1v1 match").wait_for(timeout=15000)
            assert await g.locator(".online-duel").get_attribute("data-match-id") == current_match
            await h.wait_for_function("document.querySelector('.online-duel')?.dataset.paused === 'false'", timeout=15000)
            print("PASS: guest reload and rejoin recover the same match", flush=True)

            # A participant leaving ends the other client's active match and restores lobby access.
            await g.get_by_role("button", name="Leave match", exact=True).click()
            await g.get_by_role("textbox", name="Room code").wait_for(timeout=15000)
            await h.get_by_role("button", name="Leave room", exact=True).wait_for(timeout=15000)
            await h.get_by_role("button", name="Leave room", exact=True).click()
            assert not errors, errors
            print(json.dumps({"passed": True, "hostSnapshots": len(snapshots["host"]), "guestSnapshots": len(snapshots["guest"]), "browserErrors": errors}), flush=True)
        finally:
            for page in (g, h):
                for name in ("Leave match", "Leave room"):
                    try:
                        button = page.get_by_role("button", name=name, exact=True)
                        if await button.count(): await button.click(timeout=3000)
                    except Exception: pass
            await browser.close()

asyncio.run(main())
