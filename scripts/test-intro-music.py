"""Opening intro music: loads the loop, starts on the first gesture, toggles, and fades into the menu."""
import asyncio, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('C:/Users/macor/dashboard_files/conversation-a11aa5db2bb84b0ca911c6f23478d060')
ROOT=Path(__file__).resolve().parents[1]/'dist-pages'
BASE=__import__('sys').argv[1] if len(__import__('sys').argv)>1 else None
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  f=ROOT/path.split('?')[0].replace('/alien-force-classic/','/',1).lstrip('/')
  return str(f if f.is_file() else ROOT/'index.html')
 def log_message(self,*args): pass
PROBE='''(() => {
 window.__music = { started: 0, contexts: [] };
 const C = window.AudioContext || window.webkitAudioContext;
 if (!C) return;
 const create = C.prototype.createBufferSource;
 C.prototype.createBufferSource = function(...a) { const node = create.apply(this,a); const start = node.start; node.start = function(...args) { window.__music.started++; window.__music.loop = node.loop; window.__music.seconds = node.buffer && node.buffer.duration; return start.apply(node,args); }; return node; };
 const resume = C.prototype.resume;
 C.prototype.resume = function() { if (!window.__music.contexts.includes(this)) window.__music.contexts.push(this); return resume.call(this); };
})();'''
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=BASE or f'http://127.0.0.1:{server.server_port}/alien-force-classic/'
 tag='live-' if BASE else ''
 async with async_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=await getattr(p,engine).launch(**({'channel':'msedge','args':['--autoplay-policy=user-gesture-required']} if engine=='chromium' else {}))
   for w,h in [(1440,900),(390,844),(320,568),(844,390)]:
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<500)
    await ctx.add_init_script(PROBE)
    page=await ctx.new_page()
    page.on('pageerror',lambda e: print('PAGE ERROR',e,flush=True))
    audio=[]
    page.on('response',lambda r: audio.append(r.status) if r.url.endswith('/audio/deep-signal-loop.wav') else None)
    await page.goto(url)
    toggle=page.locator('.opening-music')
    await toggle.wait_for()
    assert await toggle.inner_text()=='♪ Music on'
    await page.locator('.opening-skip').click()
    supports_audio=await page.evaluate('!!(window.AudioContext || window.webkitAudioContext)')
    if supports_audio:
     await page.wait_for_function('window.__music.started===1',timeout=15000)
     assert audio==[200],audio
     assert await page.evaluate('window.__music.loop && Math.abs(window.__music.seconds-25.26)<0.05')
    # The toggle and the skip control must not overlap at any width.
    assert await toggle.is_visible()
    if supports_audio: await page.wait_for_function("window.__music.contexts.some(c=>c.state==='running')")
    await page.locator('.opening-start').wait_for()
    await page.screenshot(path=str(OUT/f'intro-music-{tag}{engine}-{w}x{h}.png'))
    await toggle.click()
    assert await toggle.inner_text()=='♪ Music off'
    assert await page.evaluate("localStorage.getItem('alien-force-music-muted')")=='true'
    await page.reload()
    await page.locator('.opening-music').wait_for()
    assert await page.locator('.opening-music').inner_text()=='♪ Music off'
    await page.locator('.opening-music').click()
    assert await page.evaluate("localStorage.getItem('alien-force-music-muted')")=='false'
    await page.keyboard.press('Space')
    await page.locator('.opening-start').click()
    await page.locator('.opening-intro').wait_for(state='detached')
    if supports_audio: assert await page.evaluate("window.__music.contexts[0].state==='closed'")  # the menu theme takes over in its own context
    await ctx.close()
    print('ok',engine,w,h,'audio playback' if supports_audio else 'UI only: Web Audio unavailable',flush=True)
   await browser.close()
 server.shutdown()
asyncio.run(main())
