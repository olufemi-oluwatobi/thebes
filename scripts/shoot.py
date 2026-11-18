#!/usr/bin/env python3
"""Seeds demo data in the LOCAL dev Worker and screenshots the app for the landing page.
Needs: npm run dev running on :8787, python playwright, /usr/bin/google-chrome.  Output: public/img/squad-*.jpg"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8787'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'img')
TAG = str(int(time.time()))[-6:]
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1'

FLYERS = [
  ('Fresh bread, at your door by 9am', 'Mama Tola Bakery', '#E9C46A', '#26331F'),
  ('Handmade candles, poured in Lagos', 'Ember & Wick', '#CBD6A8', '#26331F'),
  ('Learn guitar in 8 weeks', 'Strings Academy', '#E9E6D2', '#26331F'),
]
CAMPS = [
  dict(title='Fresh bread, delivered', product_url='https://example.com/bread', snippet='Warm bread at your door by 9am. Order before 8pm tonight.', reward_rule='click', reward_cents=50, locations=['NG:Lagos']),
  dict(title='Ember & Wick candles', product_url='https://example.com/candles', snippet='Hand-poured soy candles made in Lagos. Gift boxes from $12.', reward_rule='signup', reward_cents=300, locations=['NG:Lagos', 'NG']),
  dict(title='Guitar in 8 weeks', product_url='https://example.com/guitar', snippet='Small classes, real songs from week one. First lesson free.', reward_rule='snippet', reward_cents=200, locations=['*']),
]

def flyer_html(t, brand, bg, fg):
    return f"""<html><body style="margin:0;width:800px;height:1000px;background:{bg};color:{fg};font-family:'Libre Baskerville',Georgia,serif;display:flex;flex-direction:column;justify-content:center;padding:64px;box-sizing:border-box">
    <div style="font:700 26px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;opacity:.7">{brand}</div>
    <div style="font-size:84px;line-height:1.08;font-weight:700;margin-top:24px">{t}</div></body></html>"""

def sql(q):
    subprocess.run(['npx','wrangler','d1','execute','thebes','--local','--env','local','--command',q], capture_output=True)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def ctx(email):
        c = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, user_agent=UA, is_mobile=True, has_touch=True)
        pg = c.new_page()
        r = c.request.post(BASE + '/api/auth/start', data=json.dumps({'email': email}), headers={'content-type':'application/json'})
        pg.goto(r.json()['link']); pg.wait_for_load_state('networkidle')
        return c, pg
    api = lambda c, path, body=None, method='POST': c.request.fetch(BASE+path, method=method, data=json.dumps(body) if body is not None else None, headers={'content-type':'application/json'}).json()

    adm, _ = ctx('admin@thebes.local')
    sel, sp = ctx(f'seller{TAG}@example.com')
    mk, mp = ctx(f'ama{TAG}@example.com')
    api(mk, '/api/me/profile', dict(name='Ama', city='Lagos', country='NG', phone='+2348000000001', prefs=dict(scope='local', categories=['food'])))
    co = api(sel, '/api/companies', dict(name='Lagos Makers'))['id']

    # flyers
    fp = b.new_context(viewport={'width':800,'height':1000}).new_page()
    ids = []
    for i,(t,brand,bg,fg) in enumerate(FLYERS):
        fp.set_content(flyer_html(t,brand,bg,fg)); fp.wait_for_timeout(300)
        png = fp.screenshot(type='png')
        r = sel.request.post(f'{BASE}/api/companies/{co}/assets?kind=product', data=png, headers={'content-type':'image/png'})
        ids.append(r.json()['id'])
    camp = []
    for c, aid in reversed(list(zip(CAMPS, ids))):
        r = api(sel, '/api/squad/campaigns', {**c, 'company_id': co, 'image_asset_id': aid}); camp.append(r['id'])
        api(adm, f'/api/admin/squad/campaigns/{r["id"]}', dict(action='fund', amount_cents=20000, reference='DEMO'))
        api(sel, f'/api/squad/campaigns/{r["id"]}/submit')
        api(adm, f'/api/admin/squad/campaigns/{r["id"]}', dict(action='approve'))

    camp.reverse()   # camp[0] is the bread campaign, created last so it is first on the board
    # a marketer link with real clicks
    link = api(mk, f'/api/squad/campaigns/{camp[0]}/link')
    code = link['code']
    for n in range(1, 38):
        subprocess.run(['curl','-s','-o','/dev/null','-A',UA,'-H',f'cf-connecting-ip: 10.9.{n//200}.{n%200+1}', f'{BASE}/s/{code}'])
    api(mk, f'/api/squad/campaigns/{camp[1]}/link'); api(mk, f'/api/squad/campaigns/{camp[2]}/link')
    sql("UPDATE ledger SET created_at = created_at - 777600000 WHERE rowid % 3 != 0")

    def shot(ctx_pg, hash_, name, wait=1200, scroll=0):
        ctx_pg.goto(f'{BASE}/app/{hash_}'); ctx_pg.reload(); ctx_pg.wait_for_timeout(wait)
        if scroll: ctx_pg.evaluate(f"document.querySelector('.page')&&(document.querySelector('.page').scrollTop={scroll})")
        ctx_pg.evaluate("document.querySelectorAll('code,.linkbox code').forEach(e=>e.textContent=e.textContent.replace('http://localhost:8787','gorillasquad.co'))")
        ctx_pg.screenshot(path=os.path.join(OUT, f'squad-{name}.jpg'), type='jpeg', quality=88)
        print('shot', name)

    shot(mp, '#board', 'board')
    shot(mp, f'#campaign/{camp[0]}', 'link')
    mp.evaluate("document.querySelector('[data-act=mylink]')&&document.querySelector('[data-act=mylink]').click()"); mp.wait_for_timeout(900)
    mp.evaluate("document.querySelector('.page').scrollTop=490"); mp.wait_for_timeout(300)
    mp.evaluate("document.querySelectorAll('code').forEach(e=>e.textContent=e.textContent.replace('http://localhost:8787','gorillasquad.co'))")
    mp.screenshot(path=os.path.join(OUT,'squad-link.jpg'), type='jpeg', quality=88)
    shot(mp, '#links', 'live')
    shot(mp, '#wallet', 'wallet')
    shot(sp, '#new', 'list')
    b.close()
