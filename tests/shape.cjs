const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/curriculum.json')));
const url=process.env.APP_URL||'http://127.0.0.1:8898/';
const out=path.join(root,'qa','shape-'+Date.now());
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const geometry=await page.evaluate(async paths=>{
  const {checkCharacterShape,normalizeShapeSettings}=await import('./shape-rules.mjs');
  const ref=paths.map(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const len=p.getTotalLength();return Array.from({length:100},(_,i)=>{const q=p.getPointAtLength(i*len/99);return {x:q.x,y:q.y};});});
  const h={x:ref[9].at(-1).x-ref[9][0].x,y:ref[9].at(-1).y-ref[9][0].y},l2=h.x*h.x+h.y*h.y;
  const extension=p=>-(h.x*(p.y-ref[9][0].y)-h.y*(p.x-ref[9][0].x))/l2;
  const cut=ratio=>{
   const result=structuredClone(ref),s=result[11];let i=1;while(i<s.length&&extension(s[i])>ratio)i++;
   const a=s[i-1],b=s[i],t=(extension(a)-ratio)/(extension(a)-extension(b));
   result[11]=[{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},...s.slice(i)];return result;
  };
  const status=(s,options={})=>checkCharacterShape('鉄',s,ref,options).status;
  const transform=(s,scale,angle,dx,dy)=>s.map(a=>a.map(p=>({x:scale*(Math.cos(angle)*p.x-Math.sin(angle)*p.y)+dx,y:scale*(Math.sin(angle)*p.x+Math.cos(angle)*p.y)+dy})));
  const wrong=cut(-.08),short=cut(.1),boundary=cut(.14);
  const shuffled=[...ref.slice(8),...ref.slice(0,8)].map(s=>[...s].reverse());
  const malformed=ref.map(s=>s.map(p=>({x:p.x,y:50}))),nan=structuredClone(ref);nan[0][0].x=NaN;
  window.shapeFixtures={ref,wrong,short,boundary};
  return {
   correct:status(ref),wrong:status(wrong),relaxed:status(short,{protrusion:'relaxed'}),normal:status(short),strict:status(cut(.19),{protrusion:'strict'}),boundary:status(boundary),
   transformed:status(transform(ref,.52,.15,21,3)),transformedWrong:status(transform(wrong,.52,-.12,21,3)),shuffled:status(shuffled),missing:status(ref.slice(1)),malformed:status(malformed),nan:status(nan),
   off:status(wrong,{protrusion:'off'}),other:checkCharacterShape('金',ref,ref).status,
   normalized:normalizeShapeSettings({protrusion:'bad',shape:'off',count:7}),touch:status(cut(0)),
   shortResult:checkCharacterShape('鉄',short,ref),wrongResult:checkCharacterShape('鉄',wrong,ref),farResult:checkCharacterShape('鉄',cut(-.45),ref),reversedResult:checkCharacterShape('鉄',cut(-.45).map(s=>[...s].reverse()),ref)
  };
 },data.glyphs['鉄'].paths);
 console.log('GEOMETRY',JSON.stringify(Object.fromEntries(Object.entries(geometry).filter(([k])=>!k.endsWith('Result')))));
 for(const k of ['correct','relaxed','transformed','shuffled'])assert.equal(geometry[k],'pass',k);
 for(const k of ['wrong','normal','strict','transformedWrong','touch'])assert.equal(geometry[k],'fail',k);
 for(const k of ['boundary','missing','malformed','nan'])assert.equal(geometry[k],'uncertain',k);
 assert.equal(geometry.off,'pass');// 金 now has component rules; its behavior is covered by shape-expansion.test.mjs.
 assert.equal(geometry.normalized.protrusion,'normal');assert.equal(geometry.normalized.shape,'off');
 for(const result of [geometry.shortResult,geometry.wrongResult,geometry.farResult,geometry.reversedResult]){
  assert.equal(result.status,'fail');const focus=result.focus;
  for(const point of [focus.tip,focus.acrossPoint])assert.ok(Math.hypot(point.x-focus.point.x,point.y-focus.point.y)+2<focus.radius);
 }
 assert.ok(geometry.farResult.focus.radius>geometry.wrongResult.focus.radius);
 const {questionsFor}=await import('../core.mjs');
 const unit=data.grades.find(g=>g.grade===3).units.find(u=>u.newCharacters.some(c=>c.text==='鉄'));
 const q=questionsFor(data,3,[unit.id],false).find(q=>q.char==='鉄');assert.ok(q);
 const seed={version:1,records:{[q.id]:{attempts:0,correct:0,helped:0,errors:1,stage:0,streak:0,due:0,history:[]}}};
 await page.evaluate(({seed,unit})=>{localStorage.setItem('kanji-hint-drill-v1',JSON.stringify(seed));localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:3,selections:{3:[unit]},multiple:false,length:5,mode:'write',vertical:true,scopeMode:'units'}));},{seed,unit:unit.id});
 await page.reload();await page.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'),{timeout:120000});
 await page.locator('.shape-settings > summary').click();await page.selectOption('#shapeProtrusion','strict');await page.selectOption('#shapePosition','off');await page.reload();
 assert.equal(await page.locator('#shapeProtrusion').inputValue(),'strict');assert.equal(await page.locator('#shapePosition').inputValue(),'off');
 await page.locator('.shape-settings > summary').click();await page.click('#resetShapeSettings');assert.equal(await page.locator('#shapeProtrusion').inputValue(),'normal');
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'settings width '+width);}
 fs.mkdirSync(out,{recursive:true});await page.setViewportSize({width:1280,height:950});await page.screenshot({path:path.join(out,'shape-settings.png'),fullPage:true});
 async function draw(kind){
  const points=await page.evaluate(async ({paths,kind})=>{
   const ref=paths.map(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const len=p.getTotalLength();return Array.from({length:65},(_,i)=>{const pt=p.getPointAtLength(i*len/64);return {x:pt.x,y:pt.y};});});
   if(kind==='wrong')ref[11]=ref[11].filter(p=>p.y>40);
   if(kind==='metalTop')ref[4]=[{x:ref[4][0].x,y:33},...ref[4]];
   if(kind==='boundary'){
    const b=ref[9],h={x:b.at(-1).x-b[0].x,y:b.at(-1).y-b[0].y},l2=h.x*h.x+h.y*h.y;
    const ext=p=>-(h.x*(p.y-b[0].y)-h.y*(p.x-b[0].x))/l2,s=ref[11];let i=1;while(i<s.length&&ext(s[i])>.14)i++;
    const a=s[i-1],c=s[i],t=(ext(a)-.14)/(ext(a)-ext(c));ref[11]=[{x:a.x+(c.x-a.x)*t,y:a.y+(c.y-a.y)*t},...s.slice(i)];
   }return ref;
  },{paths:data.glyphs['鉄'].paths,kind});
  await page.locator('#canvas').scrollIntoViewIfNeeded();const box=await page.locator('#canvas').boundingBox();
  for(const s of points){await page.mouse.move(box.x+s[0].x/109*box.width,box.y+s[0].y/109*box.height);await page.mouse.down();for(const p of s.slice(1))await page.mouse.move(box.x+p.x/109*box.width,box.y+p.y/109*box.height);await page.mouse.up();}
 }
 async function start(){
  // Make the tested character due again without changing its outcome history.
  await page.evaluate(id=>{const store=JSON.parse(localStorage.getItem('kanji-hint-drill-v1'));store.records[id].due=0;localStorage.setItem('kanji-hint-drill-v1',JSON.stringify(store));},q.id);
  await page.reload();await page.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'),{timeout:120000});
  await page.click('#start');assert.equal((await page.locator('#masked').getAttribute('data-question-id')).split('|')[0],'鉄');
 }
 async function judge(){await page.click('#check');await page.waitForFunction(()=>!document.getElementById('next').hidden||!document.getElementById('confirmation').hidden,{timeout:60000});return page.locator('#feedback').innerText();}
 await start();await draw('wrong');const wrongFeedback=await judge();console.log('WRONG',wrongFeedback);assert.doesNotMatch(wrongFeedback,/正解！/);assert.match(wrongFeedback,/上まで/);
 let records=await page.evaluate(()=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records);assert.equal(records[q.id].correct,0);assert.equal(records[q.id].history.at(-1).reason,'protrusion');assert.equal(records[q.id].history.at(-1).type,'wrong');assert.equal(await page.locator('#shapeFocus path').count(),2);
 const marker=await page.evaluate(()=>{
  const circle=document.querySelector('#shapeFocus .focus-circle'),anchors=[...document.querySelectorAll('#shapeFocus .focus-anchor')];
  const x=Number(circle.getAttribute('cx')),y=Number(circle.getAttribute('cy')),radius=Number(circle.getAttribute('r'));
  return {radius,anchors:anchors.length,contains:anchors.every(p=>Math.hypot(Number(p.getAttribute('cx'))-x,Number(p.getAttribute('cy'))-y)+2<radius)};
 });assert.equal(marker.anchors,2);assert.ok(marker.contains);assert.notEqual(marker.radius,8);
 await page.screenshot({path:path.join(out,'shape-iron-wrong.png'),fullPage:true});
 await page.click('#back');await start();assert.equal(await page.locator('#shapeFocus path').count(),0);await draw('correct');assert.match(await judge(),/正解！/);
 records=await page.evaluate(()=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records);assert.equal(records[q.id].correct,1);assert.match(records[q.id].history.at(-1).shapePolicy,/protrusion=normal/);
 await page.click('#back');await start();await draw('boundary');const uncertain=await judge();console.log('UNCERTAIN',uncertain);assert.doesNotMatch(uncertain,/正解！/);assert.ok(await page.locator('#confirmation').isVisible());await page.click('#selfCorrect');
 records=await page.evaluate(()=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records);assert.equal(records[q.id].correct,1);assert.equal(records[q.id].helped,1);
 await page.click('#back');await start();await draw('metalTop');const metalFeedback=await judge();console.log('METAL TOP',metalFeedback);assert.doesNotMatch(metalFeedback,/正解！/);assert.match(metalFeedback,/5画目.*上に/);
 records=await page.evaluate(()=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records);assert.equal(records[q.id].history.at(-1).reason,'containment');assert.equal(records[q.id].history.at(-1).type,'wrong');
 await page.click('#back');await page.locator('.shape-settings > summary').click();await page.selectOption('#shapeProtrusion','off');await start();await draw('wrong');assert.match(await judge(),/正解！/);
 assert.deepEqual(errors,[]);console.log('PASS: iron topology, thresholds, boundary, transforms, order/direction, invalid input, persistence/reset, settings mobile layout, real model wrong/correct/uncertain/off, review records and highlights');console.log('SCREENSHOTS',out);
 await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
