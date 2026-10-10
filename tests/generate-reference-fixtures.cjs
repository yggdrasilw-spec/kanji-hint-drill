const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto(process.env.APP_URL||'http://127.0.0.1:8897/');
  const fixtures=await page.evaluate(async()=>{
   const data=await (await fetch('./data/curriculum.json')).json();
   return Object.fromEntries(Object.entries(data.glyphs).map(([char,g])=>[char,g.paths.map(d=>{
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const length=p.getTotalLength();
    return Array.from({length:64},(_,i)=>{const q=p.getPointAtLength(i*length/63);return {x:q.x,y:q.y};});
   })]));
  });
  fs.mkdirSync('qa/shape',{recursive:true});fs.writeFileSync('qa/shape/reference-fixtures.json',JSON.stringify(fixtures));
  console.log('Generated reference fixtures:',Object.keys(fixtures).length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
