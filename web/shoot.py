from playwright.sync_api import sync_playwright
import pathlib,sys
u='file://'+str(pathlib.Path('dist-single/index.html').resolve())
import os;os.makedirs('shots',exist_ok=True)
def go(pg,h):
    pg.evaluate(f"location.hash='{h}'");pg.wait_for_timeout(350)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    errs=[]
    m=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
    m.on('pageerror',lambda e:errs.append(str(e)))
    m.goto(u);m.wait_for_timeout(800);m.screenshot(path='shots/m1-feed.png')
    m.click('text=Apply');m.wait_for_timeout(300);m.screenshot(path='shots/m2-applied.png')
    go(m,'offer-o6');m.screenshot(path='shots/m3-offer.png')
    go(m,'chats');m.screenshot(path='shots/m4-chats.png')
    go(m,'chats-d1');m.screenshot(path='shots/m5-chat.png')
    m.click('[aria-label=Details]');m.wait_for_timeout(300);m.screenshot(path='shots/m6-details.png')
    m.keyboard.press('Escape')
    go(m,'me');m.screenshot(path='shots/m7-profile.png')
    go(m,'plus');m.screenshot(path='shots/m8-plus.png')
    m.click('text=Post an offer');m.wait_for_timeout(300);m.click('text=Continue');m.wait_for_timeout(300);m.screenshot(path='shots/m9-product.png')
    m.click('text=Scotch Bonnet');m.click('text=Continue');m.wait_for_timeout(300);m.screenshot(path='shots/m10-details.png',full_page=False)
    d=b.new_page(viewport={'width':1440,'height':900})
    d.on('pageerror',lambda e:errs.append(str(e)))
    d.goto(u);d.wait_for_timeout(800);d.screenshot(path='shots/d1-feed.png')
    go(d,'chats-d1');d.screenshot(path='shots/d2-chats.png')
    go(d,'offer-o6');d.screenshot(path='shots/d3-offer.png')
    go(d,'plus');d.click('text=Post an offer');d.click('text=Continue');d.click('text=Scotch Bonnet');d.click('text=Continue');d.wait_for_timeout(300);d.screenshot(path='shots/d4-details.png')
    print(errs)
