"""Two isolated browser sessions; RPC and realtime are local test doubles."""
import asyncio
import copy
import json
from playwright.async_api import async_playwright

MODULE = '''
export const multiplayerConfigured=true;
const user={id:SELF,identities:[],user_metadata:{}};
window.receivers={};window.lastTick=-1;
export async function lobbyPlayerId(){return user.id}
export async function lobbyAction(){return null}
export async function connection(){return {
 auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:null})}}}}}},
 rpc:async(name,args)=>({data:await window.testRpc(args.p_action),error:null}),
 channel(){return {on(type,filter,cb){window.receivers[filter.event]=p=>{if(filter.event==='snapshot')window.lastTick=p.payload.state.tick;cb(p)};return this},subscribe(cb){cb('SUBSCRIBED');return this},unsubscribe(){window.receivers={};return Promise.resolve()},send:async packet=>window.testSend(packet)}}
}}
'''

async def main():
    room=dict(id='shared',code='ABC123',host_id='host',status='open',phase='lobby',match_id=None,match_roster=[],members=[])
    pages={}
    rounds=0
    async def rpc(who, action):
        nonlocal rounds
        if action in ['create','join'] and not any(m['player_id']==who for m in room['members']):
            room['members'].append(dict(player_id=who,display_name=who.title(),ready=False))
        if action in ['ready','unready']:
            assert room['phase']=='lobby'
            next(m for m in room['members'] if m['player_id']==who)['ready']=action=='ready'
        if action=='launch':
            assert who=='host' and room['phase']=='lobby' and len(room['members'])>=2
            assert all(m['ready'] for m in room['members'])
            rounds+=1
            room.update(phase='playing',match_id=str(rounds),match_roster=[m['player_id'] for m in room['members']])
            for m in room['members']: m['ready']=False
        if action=='return':
            assert who=='host'
            room.update(phase='lobby',match_id=None,match_roster=[])
            for m in room['members']: m['ready']=False
        if action=='leave':
            if who=='host': room['status']='closed'
            room['members']=[m for m in room['members'] if m['player_id']!=who]
            return None
        return copy.deepcopy(room)
    async def send(who, packet):
        for other, page in pages.items():
            if other!=who and not page.is_closed():
                await page.evaluate('(p)=>window.receivers[p.event]?.({payload:p.payload})',packet)
        return 'ok'
    async with async_playwright() as p:
        browser=await p.chromium.launch(channel='msedge',headless=True)
        errors=[]
        for who in ['host','guest']:
            page=await browser.new_page(viewport={'width':1440 if who=='host' else 390,'height':1000})
            pages[who]=page
            page.set_default_timeout(60000)
            page.set_default_navigation_timeout(120000)
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.expose_function('testRpc',lambda action,who=who:rpc(who,action))
            await page.expose_function('testSend',lambda packet,who=who:send(who,packet))
            await page.route('**/src/lib/multiplayer.ts',lambda route,request,who=who:route.fulfill(content_type='application/javascript',body=MODULE.replace('SELF',json.dumps(who))))
            await page.goto('http://127.0.0.1:5198/alien-force-classic/')
            await page.get_by_role('button',name='Create Room',exact=True).click()
            await page.get_by_role('button',name='Bullet Run Free for all',exact=False).click()
            if who=='host': await page.get_by_role('button',name='Create Bullet Run room').click()
            else:
                await page.locator('#bullet-code').fill('ABC123')
                await page.get_by_role('button',name='Join room',exact=True).click()
        host,guest=pages['host'],pages['guest']
        for round_number in [1,2]:
            for page in pages.values():
                await page.get_by_text('0/2 pilots ready',exact=True).wait_for()
            for page in pages.values():
                await page.get_by_role('button',name='Ready up',exact=True).click()
            await host.get_by_text('2/2 pilots ready',exact=True).wait_for()
            await host.get_by_role('button',name='Start match',exact=True).click()
            for page in pages.values(): await page.locator('canvas[aria-label="Bullet Run arena"]').wait_for()
            await guest.wait_for_function('window.lastTick>3')
            assert room['match_id']==str(round_number)
            await host.get_by_role('button',name='Return everyone to room',exact=True).click()
            for page in pages.values():
                await page.get_by_text('0/2 pilots ready',exact=True).wait_for()
                assert await page.locator('canvas[aria-label="Bullet Run arena"]').count()==0
            print(f'PASS synchronized round {round_number}: readiness, launch, guest snapshots, return/reset',flush=True)
        await host.get_by_role('button',name='Leave room',exact=True).click()
        await guest.get_by_text('The host closed this room.',exact=True).wait_for()
        assert not errors,errors
        print('PASS host closure reaches guest; no page errors; local fixtures only',flush=True)
        await browser.close()

asyncio.run(main())
