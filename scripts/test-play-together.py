"""Play together opens the room-code box, and Copy invite resets after confirming."""
import asyncio, json, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]/'dist-pages'
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  f=ROOT/path.split('?')[0].replace('/alien-force-classic/','/',1).lstrip('/')
  return str(f if f.is_file() else ROOT/'index.html')
 def log_message(self,*args): pass
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 user={'id':'11111111-1111-4111-8111-111111111111','aud':'authenticated','role':'authenticated','email':'test@example.com','app_metadata':{'provider':'discord'},'user_metadata':{},'identities':[{'provider':'discord','id':'test'}]}
 async with async_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=await getattr(p,engine).launch(**({'channel':'msedge'} if engine=='chromium' else {}))
   for w,h in [(1440,900),(390,844)]:
    ctx=await browser.new_context(viewport={'width':w,'height':h},reduced_motion='reduce')
    if engine=='chromium': await ctx.grant_permissions(['clipboard-read','clipboard-write'])
    page=await ctx.new_page()
    room={'id':'22222222-2222-4222-8222-222222222222','code':'ABC123','host_id':user['id'],'status':'open','phase':'lobby','mode':'arcade','members':[{'player_id':user['id'],'display_name':'Test Pilot','ready':False}]}
    session={'access_token':'test-token','refresh_token':'test-refresh','expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
    await page.add_init_script('localStorage.setItem("alien-force-multiplayer",'+json.dumps(json.dumps(session))+');')
    async def api(route):
     url=route.request.url
     data=room if '/rpc/game_lobby' in url else user if '/auth/v1/user' in url else []
     await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
    await page.route('https://*.supabase.co/**',api)
    await page.goto(f'http://127.0.0.1:{server.server_port}/alien-force-classic/#player=menu')
    await page.get_by_role('button',name="Join a friend's lobby").click()
    await page.locator('.hangar-lobby').wait_for()
    code=page.locator('#hangar-join-code')
    await code.wait_for(timeout=10000)
    assert await code.is_visible(), 'room-code box should open'
    await page.keyboard.press('Escape')
    if engine=='chromium':
     copy=page.locator('.hangar-tabs button',has_text='Copy invite')
     await copy.click()
     await page.locator('.hangar-tabs button',has_text='Invite copied').wait_for(timeout=3000)
     await page.locator('.hangar-tabs button',has_text='Copy invite').wait_for(timeout=5000)
    print(f'PASS {engine} {w}x{h}: Play together opens room-code box'+(', invite label resets' if engine=='chromium' else ''),flush=True)
    await ctx.close()
   await browser.close()
asyncio.run(main())
