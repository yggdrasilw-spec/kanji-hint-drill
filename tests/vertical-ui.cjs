const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const root=require('node:path').resolve(__dirname,'..'),labels=JSON.parse(fs.readFileSync(root+'/assets/labels.json'));
const b=await chromium.launch({headless:true,channel:'msedge'}),p=await b.newPage({viewport:{width:1366,height:900}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.route('**/assets/ort.wasm.min.js',r=>r.fulfill({contentType:'text/javascript',body:`window.ort={env:{wasm:{}},Tensor:class{},InferenceSession:{create:async()=>({inputNames:['x'],outputNames:['y'],run:async()=>{let data=new Float32Array(${labels.length});data[${labels.indexOf('十')}]=1;return {y:{data}}}})}};`}));
await p.goto('http://127.0.0.1:8898/');
await p.evaluate(()=>localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:1,scopeMode:'characters',characters:['十'],length:5,multiple:false,mode:'write',shapeChecks:{count:'off',direction:'off',order:'off',shape:'off',writingPosition:'normal',writingPath:'off',writingCrossing:'off',writingContact:'off',writingSeparation:'off',structure:'off',internalBars:'off',identityLength:'off',identityExtent:'off'}})));
await p.reload();await p.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));
fs.mkdirSync('C:/Users/user/.cache/hitofude-ui',{recursive:true});
for(const width of [320,390,768,1366]){
 await p.setViewportSize({width,height:900});
 for(let step=0;step<4;step++){
  await p.locator('.setup-pages button').nth(step).click();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`setup ${step} overflow ${width}`);
  const clipped=await p.locator('button:visible').evaluateAll(els=>els.filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).map(e=>e.textContent));
  assert.deepEqual(clipped,[],`clipped buttons ${width} step ${step}`);
  await p.screenshot({path:`C:/Users/user/.cache/hitofude-ui/setup-${step}-${width}.png`,fullPage:true});
 }
}
await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
const sample=[{x:20,y:55},{x:95,y:55}];
let box=await p.locator('#canvas').boundingBox();await p.mouse.move(box.x+box.width*.2,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.8,box.y+box.height*.5);await p.mouse.up();
const ink=await p.locator('#canvas').evaluate(e=>e.toDataURL());
for(const width of [320,390,768,1366]){
 await p.setViewportSize({width,height:900});
 for(const hand of ['left','right']){
  if(await p.locator('body').getAttribute('data-hand')!==hand)await p.click('#handToggle');
  const canvas=await p.locator('#canvas').boundingBox(),question=await p.locator('.question-paper').boundingBox();
  assert.ok(hand==='left'?canvas.x<question.x:canvas.x>question.x,`hand side ${hand} ${width}`);
  assert.equal(await p.locator('#canvas').evaluate(e=>e.toDataURL()),ink,'retained ink');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`drill overflow ${width}`);
  await p.screenshot({path:`C:/Users/user/.cache/hitofude-ui/drill-${hand}-${width}.png`,fullPage:true});
 }
}
await p.click('#handToggle');await p.reload();assert.equal(await p.locator('body').getAttribute('data-hand'),'left');
await p.locator('input[name=mode][value=read]').check();
await p.locator('.setup-pages button').nth(2).click();await p.click('#start');
await p.click('[data-input=handwriting]');
for(const width of [320,768,1366]){
 await p.setViewportSize({width,height:900});
 const input=await p.locator('#readingControls').boundingBox(),inkBox=await p.locator('#writingBox').boundingBox();
 assert.ok(inkBox.y>=input.y+input.height-1,'reading controls and canvas do not overlap');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'reading overflow '+width);
 await p.screenshot({path:`C:/Users/user/.cache/hitofude-ui/reading-${width}.png`,fullPage:true});
}
await p.click('[data-input=keyboard]');
const reading=await p.locator('#masked').getAttribute('data-question-id');
await p.locator('#readingInput').fill(reading.split('|')[2]);await p.click('#check');
assert.match(await p.locator('#feedback').textContent(),/はなまる/);
await p.click('#progressTab');assert.equal(await p.locator('#recordView').isVisible(),true);
assert.deepEqual(errors,[]);await b.close();console.log('PASS setup 4 pages x4 widths, button bounds, right/left x4 widths, ink preservation and saved hand; screenshots in .cache/hitofude-ui');
})().catch(e=>{console.error(e);process.exit(1)});
