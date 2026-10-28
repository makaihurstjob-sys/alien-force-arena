"""Responsive lobby footer checks with local multiplayer fixtures."""
import asyncio, json, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('C:/Users/macor/dashboard_files/conversation-a11aa5db2bb84b0ca911c6f23478d060')
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
   for w,h in [(1920,1080),(1440,900),(1366,768),(1024,768),(768,1024),(844,390),(667,375),(390,844),(320,568)]:
    page=await browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
    room={'id':'22222222-2222-4222-8222-222222222222','code':'ABC123','host_id':user['id'],'status':'open','phase':'lobby','mode':'ranked','members':[{'player_id':user['id'],'display_name':'Test Pilot','ready':False}]}
    session={'access_token':'test-token','refresh_token':'test-refresh','expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
    await page.add_init_script('localStorage.setItem("alien-force-multiplayer",'+json.dumps(json.dumps(session))+');')
    async def api(route):
     url=route.request.url
     if '/rpc/game_lobby' in url: data=room
     elif '/rpc/ranked_queue_' in url: data={'status':'idle'}
     elif '/rest/v1/ranked_players' in url: data={'rating':35,'peak':35,'wins':1,'losses':0,'draws':0}
     elif '/auth/v1/user' in url: data=user
     else: data=[]
     await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
    await page.route('https://*.supabase.co/**',api)
    await page.goto(f'http://127.0.0.1:{server.server_port}/alien-force-classic/#room=ABC123&mode=shared')
    await page.locator('.hangar-footer').wait_for()
    await page.get_by_label('35 rating points',exact=True).wait_for()
    assert (await page.locator('.hangar-lobby').get_by_label('Your Ranked progress',exact=True).inner_text()).strip()=='35'
    for count in [1,2]:  # Ranked lobbies now show exactly two slots
     if count==2:
      room['members'].append({'player_id':'guest0','display_name':'Pilot 0','ready':False})
      await page.wait_for_function("document.querySelectorAll('.hangar-slot:not(.is-empty)').length===2")
     metrics=await page.evaluate('''() => {
      const dialog=document.querySelector('.is-hangar'), footer=document.querySelector('.hangar-footer'), slots=document.querySelector('.hangar-slots');
      const qr=document.querySelector('.hangar-invite-qr'),svg=qr.querySelector('svg'),cap=qr.querySelector('figcaption');
      const boxes=[...document.querySelectorAll('.hangar-plaque > button')].map(e=>e.getBoundingClientRect());
      const f=footer.getBoundingClientRect(),r=svg.getBoundingClientRect(),c=cap.getBoundingClientRect();
      const card=qr.getBoundingClientRect(),link=document.querySelector('.hangar-invite > label').getBoundingClientRect();
      const rank=document.querySelector('.has-ranked-progress .hangar-rank-progress').getBoundingClientRect(),name=document.querySelector('.has-ranked-progress > strong').getBoundingClientRect();
      return {qrLeft:card.right<=link.left,qrCentered:Math.abs((r.left+r.right)/2-(card.left+card.right)/2),rankRight:rank.left>=name.right-1,rankAligned:Math.abs((rank.top+rank.bottom)/2-(name.top+name.bottom)/2),gap:f.top+parseFloat(getComputedStyle(footer).paddingTop)-Math.max(...boxes.map(b=>b.bottom)),overflow:dialog.scrollWidth-dialog.clientWidth,
       center:Math.abs((r.left+r.right)/2-(c.left+c.right)/2),cardsClipped:slots.scrollHeight-slots.clientHeight};
     }''')
     assert metrics['qrLeft'] and metrics['qrCentered']<=1,(engine,w,h,count,metrics)
     assert metrics['rankRight'] and metrics['rankAligned']<=1,(engine,w,h,count,metrics)
     assert metrics['gap']>=27,(engine,w,h,count,metrics)
     assert metrics['overflow']<=1,(engine,w,h,count,metrics)
     assert metrics['center']<=1,(engine,w,h,count,metrics)
     assert metrics['cardsClipped']<=1,(engine,w,h,count,metrics)
     await page.get_by_role('button',name='Leave room',exact=True).evaluate('(e)=>e.scrollIntoView({block:"center"})')
     box=await page.get_by_role('button',name='Leave room',exact=True).bounding_box()
     assert box['y']>=0 and box['y']+box['height']<=h+1,(engine,w,h,box)
     if count==1:
      await page.locator('.is-hangar').evaluate('(e)=>e.scrollTop=0')
      await page.screenshot(path=str(OUT/f'lobby-alignment-{engine}-{w}x{h}.png'))

    print(f'PASS {engine} {w}x{h}: 1/2 pilots, QR left/centered, badge/rating beside name, footer gap, no overflow/clipping, reachable controls',flush=True)
    await page.close()
   await browser.close()
asyncio.run(main())
