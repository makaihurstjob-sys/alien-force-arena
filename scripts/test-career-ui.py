import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / 'pages' / 'career-test.html'
HTML = '''<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import Career from '../src/components/Career.tsx';
import '../src/styles.css'; import '../src/components/main-menu-overhaul.css'; import '../src/components/career.css';
createRoot(document.getElementById('root')).render(React.createElement(Career));
</script></body></html>'''
AUTH = '''export async function connection() { return {auth: {
onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
getSession: async () => ({data:{session:{user:{id:'own-account'}}}})
}}; }'''
RECORDS = '''
const run={id:'run',player_id:'own-account',recorded_at:'2026-10-13T12:00:00Z',outcome:'game_over',start_level:1,level:2,score:900,duration_ms:61000,shots:20,hits:9,crashes:2,shot_deaths:1,lives_remaining:0,levels_cleared:1};
export async function getClassicPlayer(id) { if(id!=='own-account') throw Error('Wrong account'); return {display_name:'Career Pilot',runs:2,best_score:900,shots:20,hits:9,crashes:2,levels_cleared:1,duration_ms:61000,accuracy:45}; }
export async function getClassicHistory(id,page) { if(window.failRecords) throw Error('Records unavailable'); return window.emptyRecords ? [] : page ? [run] : Array.from({length:21},(_,i)=>({...run,id:String(i)})); }
export async function getClassicLeaderboard() { return [{...run,rank:1,display_name:'Board Pilot',accuracy:45}]; }
'''

async def main():
    assert not FIXTURE.exists()
    FIXTURE.write_text(HTML, encoding='utf-8')
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='msedge', headless=True)
            for width,height in [(1440,768),(1024,600),(390,844),(320,640)]:
                page = await browser.new_page(viewport={'width':width,'height':height})
                errors=[]
                page.on('pageerror',lambda e: errors.append(str(e)))
                await page.goto('http://127.0.0.1:5197/alien-force-classic/')
                await page.get_by_role('button',name='START',exact=True).click()
                await page.locator('.arena-menu-header').get_by_role('button',name='Career',exact=True).click()
                await page.locator('.career-dialog').wait_for()
                box=await page.locator('.career-dialog').bounding_box()
                assert box['width']==width and box['height']==height,box
                assert await page.locator('.career-dialog').evaluate('e => e.scrollWidth <= e.clientWidth')
                await page.get_by_role('button',name='Close dialog',exact=True).click()
                await page.get_by_role('button',name='Open Career',exact=True).click()
                await page.keyboard.press('Escape')
                await page.locator('.career-dialog').wait_for(state='hidden')
                await page.route('**/src/lib/multiplayer.ts',lambda r:r.fulfill(content_type='application/javascript',body=AUTH))
                await page.route('**/src/lib/classic-records.ts',lambda r:r.fulfill(content_type='application/javascript',body=RECORDS))
                await page.goto('http://127.0.0.1:5197/alien-force-classic/career-test.html')
                await page.get_by_role('heading',name='Career Pilot',exact=True).wait_for()
                assert await page.locator('summary').count()==20
                await page.locator('summary').first.click()
                assert await page.get_by_text('Deaths from shots',exact=True).first.is_visible()
                await page.get_by_role('button',name='Next',exact=True).click()
                await page.get_by_text('Page 2',exact=True).wait_for()
                await page.evaluate('window.emptyRecords=true')
                await page.get_by_role('button',name='Refresh records').click()
                await page.get_by_text('No saved Classic games yet.',exact=True).wait_for()
                await page.evaluate('window.failRecords=true')
                await page.get_by_role('button',name='Refresh records').click()
                await page.get_by_role('alert').wait_for()
                await page.evaluate('window.failRecords=false')
                await page.get_by_role('button',name='Try again',exact=True).click()
                await page.get_by_role('heading',name='Career Pilot',exact=True).wait_for()
                await page.get_by_role('button',name='Classic scores',exact=True).click()
                await page.get_by_role('button',name='Board Pilot').wait_for()
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert not errors,errors
                print(f'PASS {width}x{height}: fullscreen navigation, account history, details, paging, empty/error/retry, scores',flush=True)
                await page.close()
            await browser.close()
    finally:
        FIXTURE.unlink(missing_ok=True)

asyncio.run(main())
