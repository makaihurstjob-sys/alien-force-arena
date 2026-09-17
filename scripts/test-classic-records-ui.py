"""Exercise real leaderboard UI with controlled records; no hosted writes."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / 'pages' / 'records-test.html'
HTML = '''<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import Board from '../src/components/ClassicLeaderboard.tsx';
import '../src/styles.css';
createRoot(document.getElementById('root')).render(React.createElement(Board));
</script></body></html>'''
MOCK = '''
const id='11111111-1111-4111-8111-111111111111';
const run={id:'run',player_id:id,recorded_at:'2026-09-17T12:00:00Z',outcome:'game_over',start_level:1,level:2,score:900,duration_ms:61000,shots:20,hits:9,crashes:2,shot_deaths:1,lives_remaining:0,levels_cleared:1};
export async function getClassicLeaderboard(page) { if(window.failRecords) throw Error('Records unavailable'); return page ? [] : [{...run,rank:1,display_name:'Test Pilot',accuracy:45}]; }
export async function getClassicPlayer() { return {player_id:id,display_name:'Test Pilot',runs:2,best_score:900,shots:20,hits:9,crashes:2,levels_cleared:1,duration_ms:61000,accuracy:45}; }
export async function getClassicHistory() { return [run,{...run,id:'custom',start_level:2,outcome:'restarted'}]; }
'''

async def main():
    assert not PAGE.exists()
    PAGE.write_text(HTML, encoding='utf-8')
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='msedge', headless=True)
            for width, height in [(1440,1000),(390,844)]:
                page = await browser.new_page(viewport={'width':width,'height':height})
                errors=[]
                page.on('pageerror', lambda error: errors.append(str(error)))
                await page.route('**/src/lib/classic-records.ts', lambda route: route.fulfill(content_type='application/javascript',body=MOCK))
                await page.goto('http://127.0.0.1:5197/alien-force-classic/records-test.html')
                await page.get_by_role('button', name='Test Pilot').click()
                await page.get_by_role('heading', name='Test Pilot', exact=True).wait_for()
                await page.locator('summary').first.click()
                assert await page.get_by_text('Deaths from shots', exact=True).first.is_visible()
                assert await page.get_by_text('Custom start · Level 2',exact=True).is_visible()
                assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Profile overflows viewport'
                await page.reload()
                await page.get_by_role('heading',name='Test Pilot',exact=True).wait_for()
                await page.get_by_role('button',name='Leaderboard',exact=True).click()
                await page.get_by_role('button',name='Test Pilot').wait_for()
                await page.evaluate('window.failRecords=true')
                await page.get_by_role('button',name='Refresh records').click()
                await page.get_by_role('alert').wait_for()
                await page.evaluate('window.failRecords=false')
                await page.get_by_role('button',name='Try again').click()
                await page.get_by_role('button',name='Test Pilot').wait_for()
                assert not errors, errors
                print(f'PASS {width}px: player navigation, run details, custom labels, share URL reload, responsive profile, error/retry',flush=True)
                await page.close()
            await browser.close()
    finally:
        PAGE.unlink(missing_ok=True)

asyncio.run(main())
