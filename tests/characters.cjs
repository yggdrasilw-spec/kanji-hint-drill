const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.APP_URL||'http://127.0.0.1:8897/',root=path.resolve(__dirname,'..'),out=path.join(root,'qa','cards-'+Date.now());
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.character-card').length===1026);
 assert.ok(await page.locator('#characterPicker').isVisible());assert.ok(await page.locator('#start').isDisabled());assert.ok(await page.locator('#quickStart').isDisabled());
 for(const [g,n] of [[1,80],[2,160],[3,200],[4,202],[5,193],[6,191]])assert.equal(await page.locator('.character-grade[data-grade="'+g+'"] .character-card').count(),n);
 await page.locator('#characterSearch').fill('鉄');const iron=page.locator('.character-card[data-char="鉄"]');await iron.click();assert.equal(await iron.getAttribute('aria-pressed'),'true');assert.ok(await iron.evaluate(el=>el.classList.contains('selected')));assert.equal(await page.locator('#scopeCount').innerText(),'1');
 await iron.click();assert.equal(await iron.getAttribute('aria-pressed'),'false');assert.ok(await page.locator('#start').isDisabled());await iron.click();
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.character-card').length===1026);assert.equal(await iron.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#scopeCount').innerText(),'1');
 await page.locator('#characterSearch').fill('鉄');await page.locator('#multiple').uncheck();await page.click('#start');assert.equal((await page.locator('#masked').getAttribute('data-question-id')).split('|')[0],'鉄');
 // Show the answer repeatedly to exercise retries; no other character may enter.
 let count=0;while(await page.locator('#drillView').isVisible()){
  assert.equal((await page.locator('#masked').getAttribute('data-question-id')).split('|')[0],'鉄');await page.click('#answer');await page.click('#next');if(++count>5)throw Error('unbounded iron retry');
 }
 assert.ok(await page.locator('#resultView').isVisible());await page.click('#finish');
 await page.locator('input[name=mode][value=read]').check();await page.click('#start');assert.equal((await page.locator('#masked').getAttribute('data-question-id')).split('|')[0],'鉄');assert.ok(await page.locator('#readingControls').isVisible());await page.click('#back');
 await page.locator('input[name=mode][value=write]').check();await page.locator('#characterSearch').fill('見');await page.locator('.character-card[data-char="見"]').click();assert.equal(await page.locator('#scopeCount').innerText(),'2');assert.deepEqual(new Set(await page.locator('#scopePreview span').allTextContents()),new Set(['鉄','見']));
 await page.selectOption('#characterGradeFilter','3');assert.equal(await page.locator('.character-card:visible').count(),0);assert.ok(await page.locator('#characterSearchEmpty').isVisible());assert.equal(await page.locator('#scopeCount').innerText(),'2');
 await page.locator('#characterSearch').fill('');assert.equal(await page.locator('.character-card:visible').count(),200);await page.selectOption('#characterGradeFilter','');
 await page.getByRole('button',{name:'2年生：この学年を全部えらぶ',exact:true}).click();assert.equal(await page.locator('#scopeCount').innerText(),'162');await page.getByRole('button',{name:'2年生：この学年を外す',exact:true}).click();assert.equal(await page.locator('#scopeCount').innerText(),'2');
 await page.click('#characterSelectAll');assert.equal(await page.locator('#scopeCount').innerText(),'1026');await page.click('#characterSelectNone');assert.equal(await page.locator('.character-card[aria-pressed=true]').count(),0);assert.ok(await page.locator('#start').isDisabled());
 await page.getByRole('button',{name:'単元から えらぶ',exact:true}).click();assert.ok(await page.locator('#unitPicker').isVisible());assert.ok(await page.locator('#start').isEnabled());await page.selectOption('#grade','6');await page.click('#selectAll');await page.getByRole('button',{name:'かんじを えらぶ',exact:true}).click();assert.ok(await page.locator('#start').isDisabled());
 await page.locator('#characterSearch').fill('鉄');await iron.click();await page.click('#start');assert.equal((await page.locator('#masked').getAttribute('data-question-id')).split('|')[0],'鉄');await page.click('#back');
 await page.locator('#characterSearch').fill('');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'cards-desktop.png'),fullPage:true});
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);
  assert.ok(await page.locator('#quickStart').isEnabled()||width>720);
  await page.locator('#characterSearch').fill('鉄');await iron.scrollIntoViewIfNeeded();const box=await iron.boundingBox();assert.ok(box.width>=44&&box.height>=44);
  await page.screenshot({path:path.join(out,'iron-'+width+'.png'),fullPage:true});await page.locator('#characterSearch').fill('');
 }
 const mixed=await page.evaluate(async()=>{const data=await fetch('./data/curriculum.json').then(r=>r.json()),{questionsForCharacters}=await import('./core.mjs');return [...new Set(questionsForCharacters(data,['鉄','見','知']).map(q=>q.char))];});assert.deepEqual(new Set(mixed),new Set(['鉄','見','知']));
 // Old unit selections and malformed saved card selections must remain usable.
 const legacy=await browser.newPage();await legacy.addInitScript(()=>localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:3,selections:{3:[]},characters:['鉄','鉄','fake',null,'見'],shapeChecks:{protrusion:'strict'}})));
 await legacy.goto(url);await legacy.waitForFunction(()=>document.querySelectorAll('.character-card').length===1026);assert.equal(await legacy.locator('#scopeCount').innerText(),'2');assert.equal(await legacy.locator('#shapeProtrusion').inputValue(),'strict');await legacy.close();
 assert.deepEqual(errors,[]);console.log('PASS: 1026 cards, toggle/glow, empty scope, persistence, iron-only writing/reading/retries, search/filter, cross-grade selection, bulk selection, unit isolation, mobile targets/layout and old settings');console.log('SCREENSHOTS',out);await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
