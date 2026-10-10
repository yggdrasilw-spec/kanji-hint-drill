const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),port=18997,labels=JSON.parse(fs.readFileSync(path.join(root,'assets/labels.json'))),fixtures=JSON.parse(fs.readFileSync(path.join(root,'qa/shape/reference-fixtures.json')));
(async()=>{
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/ort.wasm.min.js',route=>route.fulfill({contentType:'text/javascript',body:`window.ort={env:{wasm:{}},Tensor:class{},InferenceSession:{create:async()=>({inputNames:['x'],outputNames:['y'],run:async()=>{const data=new Float32Array(${labels.length});data[${labels.indexOf('向')}]=1;return {y:{data}};}})}};`}));
  // Expose the real presentation function in the test response only.
  await page.route('**/app.mjs',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'app.mjs'),'utf8')+'\nwindow.__showShapeIssues=showShapeIssues;'}));
  const url='http://127.0.0.1:'+port+'/';await page.goto(url);
  await page.evaluate(()=>localStorage.setItem('kanji-hint-drill-v1-settings',JSON.stringify({grade:3,scopeMode:'characters',characters:['向'],length:5,mode:'write',shapeChecks:{writingHook:'normal',count:'off',direction:'off',order:'off',shape:'off'}})));
  await page.reload();await page.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'));
  assert.equal(await page.locator('[data-shape-setting="structureContact"]').inputValue(),'off');await page.click('#start');
  const strokes=structuredClone(fixtures['向']);strokes[2]=strokes[2].slice(0,56);strokes[2].push({x:strokes[2].at(-1).x,y:91});
  await page.locator('#canvas').scrollIntoViewIfNeeded();const box=await page.locator('#canvas').boundingBox();for(const line of strokes){await page.mouse.move(box.x+line[0].x/109*box.width,box.y+line[0].y/109*box.height);await page.mouse.down();for(const p of line.slice(1))await page.mouse.move(box.x+p.x/109*box.width,box.y+p.y/109*box.height);await page.mouse.up();}
  await page.click('#check');await page.waitForFunction(()=>!document.getElementById('next').hidden||!document.getElementById('confirmation').hidden);assert.match(await page.locator('#feedback').textContent(),/3画目.*はね/);assert.match(await page.locator('#feedback').textContent(),/正解/);assert.equal(await page.locator('#shapeFocus path').count(),1);
  const record=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kanji-hint-drill-v1')).records)[0]);assert.equal(record.history[0].reason,'hookGeometry');assert.equal(record.history[0].engineVersion,'component-engine-2');
  await page.evaluate(()=>window.__showShapeIssues({checks:[{id:'unknown',label:'線全体',status:'uncertain',text:'字全体を 比べよう。'},{id:'pair',label:'二本',status:'uncertain',text:'色のついた 二本を 比べよう。',focus:{actualIndices:[0,1],point:{x:50,y:50},radius:25}}]}));
  assert.equal(await page.locator('#shapeFocus path').count(),2);assert.equal(await page.locator('#shapeIssues button[aria-pressed="true"]').textContent(),'二本');assert.match(await page.locator('#shapeIssueText').textContent(),/二本/);
  await page.locator('#shapeIssues button').first().click();assert.equal(await page.locator('#shapeFocus path').count(),0);await page.locator('#shapeIssues button').last().click();assert.equal(await page.locator('#shapeFocus path').count(),2);
  fs.mkdirSync(path.join(root,'qa/handwriting-feedback'),{recursive:true});await page.screenshot({path:path.join(root,'qa/handwriting-feedback/highlight.png'),fullPage:true});
  await page.click('#back');await page.locator('.shape-settings > summary').click();for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'settings overflow '+width);}
  assert.deepEqual(errors,[]);console.log('PASS: 向 missing-hook feedback and highlight, contact defaults, focus fallback, pair switching and 320–1280px settings');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
