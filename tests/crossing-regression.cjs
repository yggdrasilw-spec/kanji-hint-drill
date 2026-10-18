const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),labels=JSON.parse(fs.readFileSync(root+'/assets/labels.json')),ref=JSON.parse(fs.readFileSync(root+'/qa/shape/reference-fixtures.json'))['土'];
 const {normalizeShapeSettings}=await import(require('node:url').pathToFileURL(root+'/shape-rules.mjs').href);
 const policy=Object.fromEntries(Object.keys(normalizeShapeSettings()).map(k=>[k,'off']));policy.writingCrossing='normal';
 const browser=await chromium.launch({headless:true,channel:'msedge'}),p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.route('**/assets/ort.wasm.min.js',r=>r.fulfill({contentType:'text/javascript',body:`window.ort={env:{wasm:{}},Tensor:class{},InferenceSession:{create:async()=>({inputNames:['x'],outputNames:['y'],run:async()=>{let data=new Float32Array(${labels.length});data[${labels.indexOf('土')}]=1;return {y:{data}}}})}};`}));
 await p.goto(process.env.APP_URL||'http://127.0.0.1:8898/');await p.evaluate(policy=>{localStorage.removeItem('kanji-hint-drill-v1');localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:1,scopeMode:'characters',characters:['土'],multiple:false,length:5,mode:'write',shapeChecks:policy}));},policy);await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
 for(const fraction of [.25,.55]){ await p.evaluate(()=>localStorage.removeItem('kanji-hint-drill-v1'));await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
  const lines=structuredClone(ref);lines[1]=lines[1].slice(Math.floor(lines[1].length*fraction));const box=await p.locator('#canvas').boundingBox();
  for(const line of lines){await p.mouse.move(box.x+line[0].x/109*box.width,box.y+line[0].y/109*box.height);await p.mouse.down();for(const q of line.slice(1))await p.mouse.move(box.x+q.x/109*box.width,box.y+q.y/109*box.height);await p.mouse.up();}
  await p.click('#check');await p.waitForFunction(()=>document.getElementById('feedback').textContent.includes('正解'));
  if(fraction===.25){assert.equal(await p.locator('#shapeIssueText').textContent(),'');assert.equal(await p.locator('#shapeFocus path').count(),0);}
  else{assert.match(await p.locator('#shapeIssueText').textContent(),/つきぬけるように/);assert.ok(await p.locator('#shapeFocus path').count()>0);}
  await p.screenshot({path:root+'/qa/crossing-tsuchi-'+fraction+'.png',fullPage:true});
  const record=await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records)[0]);assert.equal(record.history.some(h=>h.type==='wrong'),false);assert.equal(record.history[0].type,'correct');

 }
 assert.deepEqual(errors,[]);console.log('PASS 土 pointer strokes: valid short arm has no crossing warning; separated lines show precise advice; correct record retained');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
