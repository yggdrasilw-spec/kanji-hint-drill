const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),labels=JSON.parse(fs.readFileSync(root+'/assets/labels.json')),ref=JSON.parse(fs.readFileSync(root+'/qa/shape/reference-fixtures.json'))['土'];
 const {normalizeShapeSettings}=await import(require('node:url').pathToFileURL(root+'/shape-rules.mjs').href);
 const policy=Object.fromEntries(Object.keys(normalizeShapeSettings()).map(k=>[k,'off']));policy.beautyLayout='normal';
 const browser=await chromium.launch({headless:true,channel:'msedge'}),p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.route('**/assets/ort.wasm.min.js',r=>r.fulfill({contentType:'text/javascript',body:`window.ort={env:{wasm:{}},Tensor:class{},InferenceSession:{create:async()=>({inputNames:['x'],outputNames:['y'],run:async()=>{let data=new Float32Array(${labels.length});data[${labels.indexOf('土')}]=1;return {y:{data}}}})}};`}));
 await p.goto(process.env.APP_URL||'http://127.0.0.1:8898/');await p.evaluate(policy=>{localStorage.removeItem('kanji-hint-drill-v1');localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:1,scopeMode:'characters',characters:['土'],multiple:false,length:5,mode:'write',shapeChecks:policy}));},policy);await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
 for(const variant of ['small','wide']){ await p.evaluate(()=>localStorage.removeItem('kanji-hint-drill-v1'));await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
  const lines=ref.map(line=>line.map(q=>variant==='small'?({x:55+(q.x-55)*.4,y:55+(q.y-55)*.4}):({x:q.x,y:55+(q.y-55)*.5})));const box=await p.locator('#canvas').boundingBox();assert.equal(await p.locator('.writing-area').evaluate(e=>getComputedStyle(e,'::before').borderTopStyle),'dashed');assert.equal(await p.locator('.writing-area').evaluate(e=>getComputedStyle(e,'::after').borderLeftStyle),'dashed');
  for(const line of lines){await p.mouse.move(box.x+line[0].x/109*box.width,box.y+line[0].y/109*box.height);await p.mouse.down();for(const q of line.slice(1))await p.mouse.move(box.x+q.x/109*box.width,box.y+q.y/109*box.height);await p.mouse.up();}
  await p.click('#check');await p.waitForFunction(()=>document.getElementById('feedback').textContent.includes('正解'));
  assert.match(await p.locator('#shapeIssueText').textContent(),variant==='small'?/じの ぜんたいを、もうすこし おおきく/:/じの ぜんたいを、もうすこし ほそながく/);
  assert.ok(await p.locator('#shapeFocus path').count()>0);
  assert.doesNotMatch(await p.locator('#shapeIssueText').textContent(),/交差|突出|対応|箇所|比率/);
  for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'child feedback fits '+width);}
  await p.setViewportSize({width:390,height:900});
  await p.screenshot({path:root+'/qa/child-feedback-'+variant+'.png',fullPage:true});
  const record=await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records)[0]);assert.equal(record.history.some(h=>h.type==='wrong'),false);assert.equal(record.history[0].type,'correct');

 }
 assert.deepEqual(errors,[]);console.log('PASS child language with actual small/wide 土 strokes, 320-1280 layouts, focus location and correct records');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
