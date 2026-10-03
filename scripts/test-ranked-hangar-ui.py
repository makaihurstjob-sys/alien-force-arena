"""Built UI regression with mocked Discord auth and RPCs; no live rating writes."""
import asyncio, json, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright, expect
ROOT = Path(__file__).resolve().parents[1] / 'dist-pages'
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split('?')[0].replace('/alien-force-classic/', '/', 1)
        file = ROOT / path.lstrip('/')
        return str(file if file.is_file() else ROOT / 'index.html')
    def log_message(self, *args): pass
async def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    user = {'id':'11111111-1111-4111-8111-111111111111', 'aud':'authenticated', 'role':'authenticated', 'email':'test@example.com', 'app_metadata':{'provider':'discord'}, 'user_metadata':{}, 'identities':[{'provider':'discord', 'id':'discord-test'}]}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge', headless=True)
        for width in [1440,390]:
            page = await browser.new_page(viewport={'width':width,'height':1000})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            session={'access_token':'test-token','refresh_token':'test-refresh','expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
            await page.add_init_script('localStorage.setItem("alien-force-multiplayer", '+json.dumps(json.dumps(session))+');')
            room={'id':'22222222-2222-4222-8222-222222222222','code':'ABC123','host_id':user['id'],'status':'open','phase':'lobby','mode':'ranked','members':[{'player_id':user['id'],'display_name':'Test Pilot','ready':False}]}
            waiting=False
            async def api(route):
                nonlocal waiting
                url=route.request.url
                body=route.request.post_data_json if route.request.method=='POST' else {}
                if '/rpc/game_lobby' in url:
                    if body.get('p_action')=='ready': room['members'][0]['ready']=True
                    if body.get('p_action')=='unready': room['members'][0]['ready']=False
                    data=room
                elif '/rpc/ranked_queue_' in url:
                    if url.endswith('ranked_queue_join'): waiting=True
                    if url.endswith('ranked_queue_leave'): waiting=False
                    data={'status':'waiting','queued_at':'2026-10-03T12:00:00Z'} if waiting else {'status':'idle'}
                elif '/auth/v1/user' in url: data=user
                else: data=[]
                await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
            await page.route('https://*.supabase.co/**',api)
            await page.goto(f'http://127.0.0.1:{server.server_port}/alien-force-classic/#room=ABC123&mode=shared')
            start=page.get_by_role('button',name='Start match',exact=True)
            await expect(start).to_be_disabled()
            assert await page.locator('.ranked-settings').count()==0, 'Separate ranked panel returned'
            await page.get_by_role('button',name='Ready up',exact=True).click()
            await expect(start).to_be_enabled()
            await start.click()
            cancel=page.get_by_role('button',name='Cancel search',exact=True)
            await expect(cancel).to_be_enabled()
            assert waiting
            await cancel.click()
            await expect(start).to_be_enabled()
            assert not waiting
            assert not errors, errors
            print(f'PASS {width}px: original hangar, Ready -> Start -> queue -> Cancel, no separate panel or runtime errors',flush=True)
            await page.close()
        await browser.close()
    server.shutdown()
asyncio.run(main())
