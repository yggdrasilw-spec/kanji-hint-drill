const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');let browser;
(async()=>{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();await page.goto(process.env.APP_URL||'http://127.0.0.1:8898/');await page.waitForFunction(()=>document.getElementById('modelStatus').textContent.includes('使えます'),{timeout:120000});
 const result=await page.evaluate(async()=>{
  const {configureShapeData,checkCharacterShape,normalizeShapeSettings}=await import('./shape-rules.mjs');const [curriculum,components,rules,labels]=await Promise.all(['./data/curriculum.json','./data/shape-components.json','./data/shape-rules.json','./assets/labels.json'].map(async p=>(await fetch(p)).json()));configureShapeData(components,rules);
  const session=await ort.InferenceSession.create('./assets/recognizer.onnx',{executionProviders:['wasm']}),out=[];
  for(const char of ['矢','知','日','目','見','三','青','金','月','利','鉄']){
   const can=document.createElement('canvas');can.width=can.height=128;const ctx=can.getContext('2d');ctx.fillStyle='black';ctx.fillRect(0,0,128,128);ctx.strokeStyle='white';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.scale(128/109,128/109);
   const ref=curriculum.glyphs[char].paths.map(d=>{ctx.stroke(new Path2D(d));const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const l=p.getTotalLength();return Array.from({length:64},(_,i)=>{const pnt=p.getPointAtLength(l*i/63);return {x:pnt.x,y:pnt.y};});});
   const pixels=ctx.getImageData(0,0,128,128).data,values=new Float32Array(16384);for(let i=0;i<values.length;i++)values[i]=pixels[i*4]/255;
   const response=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',values,[1,1,128,128])}),raw=Array.from(response[session.outputNames[0]].data),sum=raw.reduce((a,b)=>a+b,0);let probs=raw;if(raw.some(x=>x<0)||Math.abs(sum-1)>.1){const max=Math.max(...raw),ex=raw.map(x=>Math.exp(x-max)),total=ex.reduce((a,b)=>a+b,0);probs=ex.map(x=>x/total);}
   const candidates=probs.map((confidence,i)=>({char:labels[i],confidence})).sort((a,b)=>b.confidence-a.confidence).slice(0,5),shape=checkCharacterShape(char,ref,ref,normalizeShapeSettings());
   out.push({char,candidates,identity:shape.status,decision:candidates[0].char===char&&candidates[0].confidence>=.55?(shape.status==='uncertain'?'self-confirmation':'recognized'):'self-confirmation'});
  }session.release();return out;
 });for(const r of result){assert.notEqual(r.identity,'fail',r.char);assert.ok(r.candidates.length);assert.ok(Number.isFinite(r.candidates[0].confidence));}
 const qa=path.resolve(__dirname,'../qa/shape');fs.mkdirSync(qa,{recursive:true});fs.writeFileSync(path.join(qa,'real-model.json'),JSON.stringify({note:'KanjiVG synthetic glyphs, not real child handwriting',result},null,2)+'\n');console.log('PASS: real ONNX model and independent shape engine on 11 representative synthetic glyphs',JSON.stringify(result.map(r=>({char:r.char,top:r.candidates[0].char,confidence:r.candidates[0].confidence,shape:r.identity,decision:r.decision}))));await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
