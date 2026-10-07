const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa');fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(fs.readFileSync(path.join(root,'data/curriculum.json')));
async function drawChar(page,char){
 const points=await page.evaluate(paths=>paths.map(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const len=p.getTotalLength();return Array.from({length:30},(_,i)=>{const pt=p.getPointAtLength(i*len/29);return{x:pt.x,y:pt.y};});}),data.glyphs[char].paths);
 await page.locator('#canvas').scrollIntoViewIfNeeded();const box=await page.locator('#canvas').boundingBox();for(const s of points){await page.mouse.move(box.x+s[0].x/109*box.width,box.y+s[0].y/109*box.height);await page.mouse.down();for(const p of s.slice(1))await page.mouse.move(box.x+p.x/109*box.width,box.y+p.y/109*box.height);await page.mouse.up();}
}
function questionChar(masked,reading){return Object.entries(data.glyphs).find(([c,g])=>g.words.some(w=>w.word.replace(c,'□')===masked&&w.reading===reading))?.[0];}
let activeBrowser;
(async()=>{
 const browser=activeBrowser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('BROWSER',m.text().slice(0,700));});
 await page.goto((process.env.APP_URL||(process.env.APP_URL||'http://127.0.0.1:8897/')));await page.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます')||document.getElementById('modelStatus').textContent.includes('読み込めません'),{timeout:120000});
 console.log('MODEL',await page.locator('#modelStatus').innerText());assert.match(await page.locator('#modelStatus').innerText(),/使えます/);
 await page.screenshot({path:path.join(out,'setup-desktop.png'),fullPage:true});
 for(let g=1;g<=6;g++){await page.selectOption('#grade',String(g));await page.click('#selectNone');assert.equal(await page.locator('#start').isDisabled(),true);await page.locator('#units input').first().check();assert.ok(Number(await page.locator('#scopeCount').innerText())>0);await page.locator('#units .until').nth(2).click();assert.equal(await page.locator('#units input:checked').count(),3);}
 await page.selectOption('#grade','2');await page.click('#selectNone');await page.locator('#units input').first().check();await page.click('#start');
 const masked=await page.locator('#masked').innerText(),reading=await page.locator('#reading').innerText(),char=questionChar(masked,reading);assert.ok(char,masked+' '+reading);console.log('QUESTION',char,masked,reading);
 assert.equal(await page.locator('#check').isDisabled(),true);await drawChar(page,char);assert.equal(await page.locator('#strokeCount').innerText(),data.glyphs[char].paths.length+'画');
 await page.click('#check');await page.waitForFunction(()=>!document.getElementById('next').hidden||!document.getElementById('confirmation').hidden,{timeout:60000});console.log('JUDGEMENT',await page.locator('#feedback').innerText());
 assert.match(await page.locator('#feedback').innerText(),/正解！/);assert.equal(await page.locator('#confirmation').isVisible(),false);
 await page.screenshot({path:path.join(out,'drill-desktop.png'),fullPage:true});
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1')));assert.equal(Object.keys(saved.records).length,1);
 await page.click('#next');await page.click('#hint');await page.click('#clear');assert.ok(await page.locator('#guide path').count()>0);await page.click('#answer');assert.ok(await page.locator('#next').isVisible());
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1')));assert.ok(Object.values(saved.records).some(r=>r.errors>0));
 await page.click('#progressTab');await page.screenshot({path:path.join(out,'records-desktop.png'),fullPage:true});await page.reload();await page.click('#progressTab');assert.ok(await page.locator('.record-row').count()>=2);
 await page.click('#setupTab');await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'setup-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 await page.click('#start');await page.screenshot({path:path.join(out,'drill-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 await drawChar(page,'漢');await page.click('#check');await page.waitForFunction(()=>!document.getElementById('next').hidden,{timeout:60000});assert.match(await page.locator('#feedback').innerText(),/答えは/);
 let attempts=0;while(await page.locator('#drillView').isVisible()){if(await page.locator('#next').isVisible())await page.click('#next');else await page.click('#answer');if(++attempts>40)throw Error('Unbounded retry loop');}
 assert.ok(await page.locator('#resultView').isVisible());assert.match(await page.locator('#resultMessage').innerText(),/練習しました/);
 assert.ok(Number((await page.locator('#resultMessage').innerText()).match(/\d+/)[0])<=14);
 const fallback=await browser.newPage();await fallback.route('**/assets/recognizer.onnx',route=>route.abort());await fallback.goto((process.env.APP_URL||(process.env.APP_URL||'http://127.0.0.1:8897/')));await fallback.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('読み込めません'));
 await fallback.click('#start');await drawChar(fallback,'一');await fallback.click('#check');assert.ok(await fallback.locator('#confirmation').isVisible());
 assert.equal(await fallback.evaluate(()=>localStorage.getItem('kanji-hint-drill-v1')),null);await fallback.click('#selfCorrect');const manual=await fallback.evaluate(()=>JSON.parse(localStorage.getItem('kanji-hint-drill-v1')));assert.equal(Object.values(manual.records)[0].correct,0);assert.equal(Object.values(manual.records)[0].helped,1);
 await fallback.click('#progressTab');await fallback.locator('#import').setInputFiles({name:'record.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,records:{'一|一つ|ひとつ':{attempts:3,correct:3,stage:3,streak:3,due:Date.now()+86400000,lastSeen:Date.now()+1000,history:[]}}}))});await fallback.waitForFunction(()=>document.getElementById('storageMessage').textContent.includes('読み込みました'));assert.ok(await fallback.locator('.record-row').count()>=1);
 const downloadWait=fallback.waitForEvent('download');await fallback.click('#export');assert.match((await downloadWait).suggestedFilename(),/学習記録/);await fallback.close();
 assert.deepEqual(errors,[]);console.log('PASS: model loads, 6 grade selectors, checkbox scopes, here-until, real handwriting correct/wrong, hints/answer records, persistence, bounded retries/results, uncertain-model manual confirmation, import/export and mobile layout');await browser.close();
})().catch(async e=>{console.error(e);if(activeBrowser)await activeBrowser.close();process.exitCode=1;});
