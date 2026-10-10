const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/curriculum.json'))),labels=JSON.parse(fs.readFileSync(path.join(root,'assets/labels.json')));
const url=process.env.APP_URL||'http://127.0.0.1:8898/',out=path.join(root,'qa','patterns-'+Date.now());
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1280,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Geometry is independent of OCR. Fix its result to 鉄 to test every shape
 // branch and saved outcome; tests/shape.cjs separately exercises the real model.
 const fake=`window.ort={env:{wasm:{}},Tensor:class{},InferenceSession:{create:async()=>({inputNames:['x'],outputNames:['y'],run:async()=>{const data=new Float32Array(${labels.length});data[${labels.indexOf('鉄')}]=1;return {y:{data}};}})}};`;
 await page.route('**/assets/ort.wasm.min.js',route=>route.fulfill({contentType:'text/javascript',body:fake}));
 await page.goto(url);
 const geometry=await page.evaluate(async paths=>{
  const {checkCharacterShape,DEFAULT_SHAPE_SETTINGS}=await import('./shape-rules.mjs');
  const ref=paths.map(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const length=p.getTotalLength();return Array.from({length:81},(_,i)=>{const q=p.getPointAtLength(i*length/80);return {x:q.x,y:q.y};});});
  const fixtures={ref};
  const variant=(name,change)=>{const s=structuredClone(ref);change(s);fixtures[name]=s;};
  variant('top',s=>s[4].unshift({x:s[4][0].x,y:33}));
  variant('bottom',s=>s[4].push({x:s[4].at(-1).x,y:94}));
  variant('both',s=>{s[4].unshift({x:s[4][0].x,y:33});s[4].push({x:s[4].at(-1).x,y:94});});
  variant('gap',s=>s[1]=s[1].map(p=>({x:p.x+12,y:p.y-3})));
  variant('flat',s=>s[7]=s[7].map(p=>({x:p.x,y:88.5})));
  variant('down',s=>s[7]=s[7].map(p=>({x:p.x,y:88.5+(p.x-14.5)*.25})));
  variant('horizontalEnd',s=>{const y=s[12][70].y;s[12]=s[12].map((p,i)=>i<70?p:{x:p.x,y});});
  variant('notParallel',s=>{const x=s[3][0].x;s[3]=s[3].map(p=>({x:p.x,y:p.y+(p.x-x)*.3}));});
  variant('levelHorizontals',s=>{for(const j of [2,3,9,10])s[j]=s[j].map(p=>({x:p.x,y:s[j][0].y}));});
  variant('beautyAndWrong',s=>s[4].unshift({x:s[4][0].x,y:33}));
  variant('mildTop',s=>s[4].unshift({x:s[4][0].x,y:38.4}));
  variant('mildBottom',s=>s[4].push({x:s[4].at(-1).x,y:86}));
  variant('mildGap',s=>s[1]=s[1].map(p=>({x:p.x+5,y:p.y})));
  variant('mildRise',s=>s[7]=s[7].map(p=>({x:p.x,y:88.5-(p.x-14.5)*Math.tan(12*Math.PI/180)})));
  const disabled=Object.fromEntries(Object.keys(DEFAULT_SHAPE_SETTINGS).map(k=>[k,'off']));
  const run=(name,options={})=>checkCharacterShape('鉄',fixtures[name],ref,options);
  const results={};for(const name of ['ref','top','bottom','both','gap','flat','down'])results[name]=run(name);
  for(const [name,key] of [['top','containment'],['bottom','containment'],['gap','connection'],['flat','rise']])results[name+'Off']=run(name,{[key]:'off'});
  results.allOff=run('top',disabled);
  results.diagonalEnd=run('ref',{sweepEnd:'strict'});results.horizontalEnd=run('horizontalEnd',{sweepEnd:'strict'});
  results.notParallel=run('notParallel',{beautyParallel:'normal'});
  results.levelHorizontals=run('levelHorizontals',{beautySlope:'normal'});
  results.beautyAndWrong=run('beautyAndWrong',{sweepEnd:'strict'});
  results.beautyOnlyMissing=checkCharacterShape('鉄',ref.slice(1),ref,{...disabled,sweepEnd:'strict'});
  for(const [name,key] of [['mildTop','containment'],['mildBottom','containment'],['mildGap','connection'],['mildRise','rise']])for(const level of ['relaxed','strict'])results[name+level]=run(name,{[key]:level});
  const rotate=s=>s.map(a=>a.map(p=>({x:.55*(Math.cos(.15)*p.x-Math.sin(.15)*p.y)+19,y:.55*(Math.sin(.15)*p.x+Math.cos(.15)*p.y)+7})));
  for(const name of ['ref','top','bottom','gap','flat'])results[name+'Moved']=checkCharacterShape('鉄',rotate(fixtures[name]),ref);
  const reversed=[...fixtures.both.slice(8),...fixtures.both.slice(0,8)].map(s=>[...s].reverse());results.reordered=checkCharacterShape('鉄',reversed,ref);
  // Exact boundary between accepted and rejected protrusion is a manual check.
  const edge=structuredClone(ref);edge[4].unshift({x:28.7,y:39.02});results.edge=checkCharacterShape('鉄',edge,ref);
  return {fixtures,results};
 },data.glyphs['鉄'].paths);
 const r=geometry.results;
 console.log('GEOMETRY',Object.fromEntries(Object.entries(r).map(([k,v])=>[k,{status:v.status,issues:v.checks.filter(c=>c.status!=='pass').map(c=>c.id),beauty:v.beautyChecks?.filter(c=>c.status!=='pass').map(c=>c.id)}])));
 assert.equal(r.ref.status,'pass');
 for(const name of ['top','bottom','both','gap','flat','down','topMoved','bottomMoved','flatMoved','reordered'])assert.equal(r[name].status,'fail',name);
 // A moved, severely separated roof can make stroke correspondence ambiguous.
 // It must request comparison rather than silently pass or guess an error.
 assert.equal(r.gapMoved.status,'uncertain');
 for(const name of ['topOff','bottomOff','gapOff','flatOff','refMoved'])assert.equal(r[name].status,'pass',name);
 assert.equal(r.allOff.status,'skipped');assert.equal(r.both.checks.filter(c=>c.status==='fail').length,2);
 assert.equal(r.diagonalEnd.status,'pass');assert.equal(r.diagonalEnd.beautyChecks[0].status,'review');
 assert.equal(r.horizontalEnd.status,'pass');assert.equal(r.horizontalEnd.beautyChecks[0].status,'pass');
 assert.ok(r.notParallel.beautyChecks.some(c=>c.status==='review'));assert.equal(r.notParallel.status,'pass');
 assert.ok(r.levelHorizontals.beautyChecks.some(c=>c.status==='review'));assert.equal(r.levelHorizontals.status,'pass');
 assert.equal(r.beautyAndWrong.status,'fail');assert.equal(r.beautyOnlyMissing.status,'pass');assert.equal(r.beautyOnlyMissing.beautyChecks[0].status,'uncertain');
 assert.equal(r.edge.status,'uncertain');
 for(const name of ['mildTop','mildBottom','mildGap','mildRise']){assert.equal(r[name+'relaxed'].status,'pass',name+' relaxed');assert.equal(r[name+'strict'].status,'fail',name+' strict');}
 for(const result of Object.values(r))for(const c of [...result.checks,...result.beautyChecks||[]])if(c.focus)for(const p of [c.focus.tip,c.focus.acrossPoint])assert.ok(Math.hypot(p.x-c.focus.point.x,p.y-c.focus.point.y)+2<c.focus.radius,c.id);
 if(process.env.GEOMETRY_ONLY){console.log('PASS: geometry and independently adjustable tolerance levels');await browser.close();return;}
 fs.mkdirSync(out,{recursive:true});
 async function start(options={}){
  await page.evaluate(options=>{localStorage.setItem('kanji-hint-drill-v1',JSON.stringify({version:1,records:{}}));localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:3,characters:['鉄'],scopeMode:'characters',multiple:false,length:5,mode:'write',shapeChecks:options}));},options);
  await page.reload();await page.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));await page.click('#start');
  assert.equal(await page.locator('#shapeIssues button').count(),0);
 }
 async function draw(name){
  await page.locator('#canvas').scrollIntoViewIfNeeded();const box=await page.locator('#canvas').boundingBox();
  for(const s of geometry.fixtures[name]){await page.mouse.move(box.x+s[0].x/109*box.width,box.y+s[0].y/109*box.height);await page.mouse.down();for(const p of s.slice(1))await page.mouse.move(box.x+p.x/109*box.width,box.y+p.y/109*box.height);await page.mouse.up();}
  await page.click('#check');await page.waitForFunction(()=>!document.getElementById('next').hidden||!document.getElementById('confirmation').hidden);
  return page.locator('#feedback').innerText();
 }
 const records=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records));
 for(const [name,kind,word] of [['top','containment','上に'],['bottom','containment','下に'],['gap','connection','つけよう'],['flat','rise','右上に']]){
  await start();const text=await draw(name);assert.doesNotMatch(text,/正解！/);assert.ok(text.includes(word));const record=(await records())[0];assert.equal(record.history.at(-1).type,'wrong');assert.equal(record.history.at(-1).reason,kind);assert.equal(record.correct,0);
 }
 await start();await draw('both');assert.equal(await page.locator('#shapeIssues button').count(),2);
 const cy=await page.locator('#shapeFocus .focus-circle').getAttribute('cy');await page.locator('#shapeIssues button').nth(1).click();assert.notEqual(await page.locator('#shapeFocus .focus-circle').getAttribute('cy'),cy);
 await page.screenshot({path:path.join(out,'metal-bottom.png'),fullPage:true});
 await start({sweepEnd:'strict',beautyParallel:'strict',beautySlope:'normal',shape:'off'});const beautyText=await draw('ref');assert.match(beautyText,/正解！/);assert.match(beautyText,/美文字のヒント/);assert.match(beautyText,/13画目/);
 const beautiful=(await records())[0];assert.equal(beautiful.correct,1);assert.equal(beautiful.helped,0);assert.equal(beautiful.errors,0);assert.ok(beautiful.history[0].beautyNotes.includes('tetsu-sweep-end'));assert.match(beautiful.history[0].shapePolicy,/shape=off$/);
 await page.screenshot({path:path.join(out,'beauty-advice.png'),fullPage:true});
 await start({sweepEnd:'strict'});await draw('top');assert.equal((await records())[0].errors,1);
 await page.click('#back');await page.locator('.shape-settings > summary').click();assert.equal(await page.locator('#shapeSweepEnd').inputValue(),'strict');await page.click('#resetShapeSettings');assert.equal(await page.locator('#shapeSweepEnd').inputValue(),'off');assert.equal(await page.locator('#shapeContainment').inputValue(),'normal');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'settings overflow '+width);}
 await page.setViewportSize({width:390,height:950});await page.screenshot({path:path.join(out,'settings-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: metal endpoints/join/rise, independent settings, scale/tilt/order, boundary, dynamic circles, beauty direction/parallel independent of correctness, preserved mastery and notes, multi-issue focus switch, mobile settings. OCR fixed to iron; real-model coverage in shape.cjs.');console.log('SCREENSHOTS',out);await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
