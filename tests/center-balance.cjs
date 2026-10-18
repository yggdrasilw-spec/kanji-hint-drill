const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),labels=JSON.parse(fs.readFileSync(root+'/assets/labels.json')),ref=JSON.parse(fs.readFileSync(root+'/qa/shape/reference-fixtures.json'))['土'];
 const {normalizeShapeSettings}=await import(require('node:url').pathToFileURL(root+'/shape-rules.mjs').href);
 const policy=Object.fromEntries(Object.keys(normalizeShapeSettings()).map(k=>[k,'off']));policy.beautyCenter='normal';policy.beautySymmetry='normal';
 const browser=await chromium.launch({headless:true,channel:'msedge'}),p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.route('**/assets/ort.wasm.min.js',r=>r.fulfill({contentType:'text/javascript',body:`window.ort={env:{wasm:{}},Tensor:class{},InferenceSession:{create:async()=>({inputNames:['x'],outputNames:['y'],run:async()=>{let data=new Float32Array(${labels.length});data[${labels.indexOf('土')}]=1;return {y:{data}}}})}};`}));
 await p.goto(process.env.APP_URL||'http://127.0.0.1:8898/');await p.evaluate(policy=>{localStorage.removeItem('kanji-hint-drill-v1');localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:1,scopeMode:'characters',characters:['土'],multiple:false,length:5,mode:'write',shapeChecks:policy}));},policy);await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
 for(const variant of ['axis','arms']){ await p.evaluate(()=>localStorage.removeItem('kanji-hint-drill-v1'));await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
  const lines=variant==='axis'?ref.map(line=>line.map(q=>({...q,x:q.x+12}))):ref.map((line,i)=>line.map(q=>i===0?({...q,x:q.x<53?53+(q.x-53)*.3:q.x}):q));const box=await p.locator('#canvas').boundingBox();assert.equal(await p.locator('.writing-area').evaluate(e=>getComputedStyle(e,'::before').borderTopStyle),'dashed');assert.equal(await p.locator('.writing-area').evaluate(e=>getComputedStyle(e,'::after').borderLeftStyle),'dashed');
  for(const line of lines){await p.mouse.move(box.x+line[0].x/109*box.width,box.y+line[0].y/109*box.height);await p.mouse.down();for(const q of line.slice(1))await p.mouse.move(box.x+q.x/109*box.width,box.y+q.y/109*box.height);await p.mouse.up();}
  await p.click('#check');await p.waitForFunction(()=>document.getElementById('feedback').textContent.includes('正解'));
  assert.match(await p.locator('#shapeIssueText').textContent(),variant==='axis'?/2かくめ.*たての てんせん/:/1かくめは、2かくめ.*ひだりを もうすこし ながく/);
  assert.ok(await p.locator('#shapeFocus path').count()>0);
  assert.doesNotMatch(await p.locator('#shapeIssueText').textContent(),/交差|突出|対応|箇所|比率/);
  for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'child feedback fits '+width);}
  await p.setViewportSize({width:390,height:900});
  await p.screenshot({path:root+'/qa/center-balance-'+variant+'.png',fullPage:true});
  const record=await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records)[0]);assert.equal(record.history.some(h=>h.type==='wrong'),false);assert.equal(record.history[0].type,'correct');assert.equal(record.correct,1);assert.equal(record.helped,0);assert.notEqual(record.history[0].needsReview,true);assert.ok(record.due>Date.now());

 }
 await p.setViewportSize({width:1280,height:900});await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await p.locator('.setup-pages button').nth(3).click();await p.locator('.settings-book nav button').filter({hasText:/美文字の助言/}).first().click();assert.equal(await p.locator('.settings-page [data-shape-setting=beautyCenter]').count(),1);assert.equal(await p.locator('.settings-page [data-shape-setting=beautySymmetry]').count(),1);await p.locator('.settings-advanced>summary').click();await p.locator('.settings-advanced details>summary').click();await p.selectOption('#shapeCharacter','土');for(const category of ['beautyCenter','beautySymmetry']){await p.selectOption('#shapeRuleCategory',category);await p.locator('#shapeCharacterRules select[data-category='+category+']').locator('..').getByRole('button',{name:'見ない',exact:true}).click();assert.equal(await p.evaluate(category=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1-settings')).shapeOverrides['土'].categories[category],category),'off');}assert.deepEqual(errors,[]);console.log('PASS 土 center-line and unequal-arm pointer inputs, 320-1280 layouts, independent correct and review due retained');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
