from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path('/mnt/data/factory-v16')
html=(ROOT/'index.html').read_text()
for x in ('<link rel="stylesheet" href="./styles.css">','<link rel="stylesheet" href="./layout.css">','<link rel="stylesheet" href="./theme-v15.css">','<link rel="stylesheet" href="./operations.css">','<script src="./access.js" defer></script>','<script src="./operations.js" defer></script>','<script src="./app.js" defer></script>'):html=html.replace(x,'')

def setup(page):
  errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
  page.set_content(html)
  for filename in ('styles.css','layout.css','theme-v15.css','operations.css'):page.add_style_tag(content=(ROOT/filename).read_text())
  for filename in ('access.js','operations.js','app.js'):page.add_script_tag(content=(ROOT/filename).read_text())
  if errs:raise AssertionError(errs)
  return errs

def nav(page,dept,feature):
  selector=f'#nav [data-feature="{feature}"][data-feature-dept="{dept}"]'
  if not page.locator(selector).count():page.locator(f'#nav [data-dept="{dept}"]').click()
  page.locator(selector).click()

def flow(page,operation,id):
  loc=page.locator(f'[data-op-action="flow:{operation}"][data-op-id="{id}"]')
  assert loc.count()>0, (operation,id,page.locator('#view-title').inner_text())
  loc.click()

def op(page,action,id=None):
  selector=f'[data-op-action="{action}"]'+(f'[data-op-id="{id}"]' if id is not None else '')
  loc=page.locator(selector)
  assert loc.count()>0, (action,id)
  loc.first.click()

with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  page.set_default_timeout(3500)
  errors=setup(page);id='SO-2026-1023-018'
  nav(page,'pmc','schedule');flow(page,'trial',id);flow(page,'formal',id)
  print('after formal',page.evaluate(f'FactoryOperations.state.flows["{id}"].stage'))
  nav(page,'pmc','kitting');flow(page,'reserve',id)
  text=page.locator('.op-alert').inner_text();assert '库存不足' in text and '250' in text, text
  print('stock guard:',text[:85]);page.screenshot(path=str(ROOT/'preview-shortage.png'),full_page=True)
  nav(page,'purchase','purchase');op(page,'next:purchase:待到货','PO-001');op(page,'next:purchase:已入库','PO-001')
  assert page.evaluate('FactoryOperations.state.stock["PK-001"]')==750
  nav(page,'pmc','kitting');flow(page,'reserve',id);assert page.evaluate(f'FactoryOperations.state.flows["{id}"].stage')=='reserved'
  nav(page,'warehouse','issue');flow(page,'issue',id)
  nav(page,'production','tasks');flow(page,'blendStart',id)
  assert '清洗任务' in page.locator('.op-alert').inner_text()
  op(page,'task:verify','TK-001');flow(page,'blendStart',id);flow(page,'blendFinish',id)
  nav(page,'quality','inspection');flow(page,'semiPass',id)
  nav(page,'production','tasks');flow(page,'packStart',id)
  assert '调机调线' in page.locator('.op-alert').inner_text()
  nav(page,'engineering','engineering');op(page,'task:start','TK-003');op(page,'task:finish','TK-003');op(page,'task:verify','TK-003')
  nav(page,'production','tasks');flow(page,'packStart',id);flow(page,'packFinish',id)
  nav(page,'quality','inspection');flow(page,'finalPass',id)
  nav(page,'quality','release');flow(page,'release',id)
  nav(page,'warehouse','inventory');flow(page,'receipt',id)
  assert page.evaluate(f'FactoryOperations.state.flows["{id}"].stage')=='stored'
  print('COMPLETE FLOW',page.evaluate(f'FactoryOperations.state.flows["{id}"].audit.map(x=>x.action)'))
  page.screenshot(path=str(ROOT/'preview-inventory.png'),full_page=True)
  # HR / employee permission unaffected; master CRUD
  nav(page,'tech','bom');op(page,'new:bom');assert page.locator('#ops-form').count()>0
  page.locator('[name=parent]').fill('FG-001');page.locator('[name=child]').fill('RM-002');page.locator('[name=qty]').fill('0.025');page.locator('[name=unit]').fill('kg/L');page.locator('#ops-form button[type=submit]').click()
  assert 'RM-002' in page.locator('#view').inner_text()
  print('BOM change saved')
  nav(page,'ehs','safety');op(page,'next:safety:待复核','EHS-001');op(page,'next:safety:已关闭','EHS-001');assert page.evaluate('FactoryOperations.state.safety[0].status')=='已关闭'
  print('EHS verified')
  nav(page,'it','employees');op(page,'edit:staff','E002');page.locator('[name=title]').fill('高级配制工');page.locator('#ops-form button[type=submit]').click();assert '高级配制工' in page.locator('#view').inner_text()
  nav(page,'pmc','shift');op(page,'new:shift');print('roster form present',page.locator('#ops-form').count());page.locator('.op-modal-head [data-op-action="close"]').click()
  page.screenshot(path=str(ROOT/'preview-ops-end.png'),full_page=True)
  assert not errors,errors
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  mobile.set_default_timeout(3500)
  e2=setup(mobile)
  print('mobile open',flush=True);mobile.locator('#mobile-menu').click();print('mobile dept',flush=True);mobile.locator('#nav [data-dept="pmc"]').click();mobile.locator('#mobile-menu').click() if False else None
  # opening dept closes sidebar; reopen and click submodule
  print('mobile reopen',flush=True);mobile.locator('#mobile-menu').click();print('mobile feature',flush=True);mobile.locator('#nav [data-feature="schedule"][data-feature-dept="pmc"]').click()
  mobile.wait_for_timeout(350)
  mobile.screenshot(path=str(ROOT/'preview-mobile-ops.png'),full_page=True)
  print('mobile horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth'),mobile.evaluate('innerWidth'))
  assert mobile.evaluate('document.documentElement.scrollWidth')<=mobile.evaluate('innerWidth')
  assert not e2,e2
  browser.close()
