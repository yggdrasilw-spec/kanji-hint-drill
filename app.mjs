import {STORAGE_KEY,selectScope,questionsFor,updateRecord,buildQueue,summaryFor,analyzeStrokes,validateProgress} from './core.mjs';
import {createReading,readingQuestions} from './reading.mjs';
const $=id=>document.getElementById(id);
let kana,reader;
let data,session,labels,modelError='',modelReady=false,questions=[],queue=[],queueIndex=0,queueLimit=0,results=[],strokes=[],drawing=null,current=null,answerSeen=false,hints=0,judged=false,busy=false,token=0;
let store={version:1,records:{}},settings={grade:1,selections:{},multiple:true,length:10,mode:'write',vertical:true},storageAvailable=true;
try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)store=validateProgress(JSON.parse(raw));const saved=JSON.parse(localStorage.getItem(STORAGE_KEY+'-settings')||'null');if(saved&&[1,2,3,4,5,6].includes(+saved.grade)){settings={...settings,...saved};settings.selections=saved.selections&&typeof saved.selections==='object'?saved.selections:{};}}
catch(e){storageAvailable=false;$('storageMessage').textContent='保存した記録を読み込めませんでした。練習はできますが、記録の保存状態を確認してください。';}
const canvas=$('canvas'),ctx=canvas.getContext('2d');
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));localStorage.setItem(STORAGE_KEY+'-settings',JSON.stringify(settings));}catch(e){storageAvailable=false;$('storageMessage').textContent='記録を保存できません。学習後に「記録を書き出す」で保存してください。';}}
function show(view){reader?.stop();for(const id of ['setupView','drillView','recordView','resultView'])$(id).hidden=id!==view;$('setupTab').classList.toggle('active',view==='setupView');$('progressTab').classList.toggle('active',view==='recordView');window.scrollTo({top:0,behavior:'smooth'});}
function units(){return data.grades.find(g=>g.grade===+settings.grade).units;}
function selected(){return settings.selections[settings.grade]||[];}
function renderUnits(){
 $('units').replaceChildren();let volume;
 for(const [i,u] of units().entries()){
  if(volume!==u.volume){volume=u.volume;const title=document.createElement('p');title.className='volume-heading';title.textContent=volume==='通年'?'単元をえらぶ':volume+'巻';$('units').append(title);}
  const row=document.createElement('div');row.className='unit-row';const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=selected().includes(u.id);input.value=u.id;input.setAttribute('aria-label',u.title);const copy=document.createElement('span');copy.textContent=u.title;
  const note=document.createElement('small');const cs=selectScope(data,settings.grade,[u.id]);note.textContent=cs.join(' ');copy.append(note);label.append(input,copy);
  input.addEventListener('change',()=>{settings.selections[settings.grade]=[...$('units').querySelectorAll('input:checked')].map(x=>x.value);persist();refreshScope();});
  const until=document.createElement('button');until.type='button';until.className='until';until.textContent='ここまで';until.setAttribute('aria-label',u.title+'までを選ぶ');until.addEventListener('click',()=>{settings.selections[settings.grade]=units().slice(0,i+1).map(x=>x.id);persist();renderUnits();refreshScope();});row.append(label,until);$('units').append(row);
 }
}
function refreshScope(){
 const chars=selectScope(data,settings.grade,selected());questions=questionsFor(data,settings.grade,selected(),settings.multiple);if(settings.mode==='read')questions=readingQuestions(questions,data);
 $('scopeCount').textContent=chars.length;$('selectionSummary').textContent=selected().length?`${selected().length}単元 · ${questions.length}通りの問題`:'単元をえらんでね。';$('scopePreview').replaceChildren();
 chars.forEach(c=>{const s=document.createElement('span');s.textContent=c;$('scopePreview').append(s);});$('start').disabled=!questions.length;$('quickStart').disabled=!questions.length;
}
async function loadModel(){
 try{
  if(!globalThis.ort)throw Error('実行ライブラリを読み込めません。');
  ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('./assets/',location.href).href;
  labels=await fetchJSON('./assets/labels.json');
  session=await ort.InferenceSession.create('./assets/recognizer.onnx',{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  modelReady=true;$('modelStatus').textContent='手書きの自動判定が使えます。';
 }catch(e){modelError=e.message;$('modelStatus').textContent='自動判定を読み込めませんでした。答えを見て確認する練習ができます。';console.warn('recognition unavailable',e);}
}
async function fetchJSON(url){const r=await fetch(url);if(!r.ok)throw Error(`データを読み込めません (${r.status})`);return r.json();}
function redraw(){
 ctx.clearRect(0,0,480,480);ctx.lineWidth=11;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#263a32';ctx.fillStyle='#263a32';
 for(const s of [...strokes,...(drawing?[drawing]:[])]){if(!s.length)continue;ctx.beginPath();ctx.moveTo(s[0].x/109*480,s[0].y/109*480);for(const p of s.slice(1))ctx.lineTo(p.x/109*480,p.y/109*480);ctx.stroke();if(s.length===1){ctx.beginPath();ctx.arc(s[0].x/109*480,s[0].y/109*480,5.5,0,Math.PI*2);ctx.fill();}}
 $('strokeCount').textContent=strokes.length+'画';$('check').disabled=judged||busy||!strokes.length||!!drawing;if(reader?.active())reader.refresh();
}
function position(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(109,(e.clientX-r.left)/r.width*109)),y:Math.max(0,Math.min(109,(e.clientY-r.top)/r.height*109))};}
canvas.addEventListener('pointerdown',e=>{if(judged||busy||drawing||!current||e.button!==0)return;e.preventDefault();drawing=[position(e)];canvas.setPointerCapture(e.pointerId);redraw();});
canvas.addEventListener('pointermove',e=>{if(!drawing||!canvas.hasPointerCapture(e.pointerId))return;e.preventDefault();for(const sample of (e.getCoalescedEvents?.()||[e])){const p=position(sample);if(Math.hypot(p.x-drawing.at(-1).x,p.y-drawing.at(-1).y)>.3)drawing.push(p);}redraw();});
canvas.addEventListener('pointerup',e=>{if(!drawing||!canvas.hasPointerCapture(e.pointerId))return;drawing.push(position(e));strokes.push(drawing);drawing=null;canvas.releasePointerCapture(e.pointerId);redraw();});
canvas.addEventListener('pointercancel',()=>{drawing=null;redraw();});
function renderGuide(all=false){
 if(reader?.active()){$('guide').replaceChildren();reader.renderHint(all);return;}
 $('guide').replaceChildren();const paths=data.glyphs[current.char].paths;
 paths.slice(0,all?paths.length:hints).forEach((d,i)=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);if(all){p.style.stroke=i===hints-1?'#d47637':'#d4a872';p.style.opacity='.7';}$('guide').append(p);if(all){const len=p.getTotalLength();p.style.strokeDasharray=String(len);p.animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:220,delay:i*220,fill:'both'});const pt=p.getPointAtLength(0),n=document.createElementNS('http://www.w3.org/2000/svg','text');n.setAttribute('x',String(Math.max(3,pt.x-5)));n.setAttribute('y',String(Math.max(7,pt.y-3)));n.style.fill='#a26028';n.style.stroke='none';n.style.fontSize='6px';n.textContent=i+1;$('guide').append(n);}});
 const hintCount=data.glyphs[current.char].paths.length;$('hint').disabled=hints>=hintCount||judged||busy;
 $('hint').querySelector('span:nth-child(2)').firstChild.textContent=hints===0?'1画目を見せて':hints>=hintCount?'すべての画を表示中':`${hints+1}画目も見せて`;
}
function referenceStrokes(){return data.glyphs[current.char].paths.map(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const len=p.getTotalLength();return Array.from({length:32},(_,i)=>{const pt=p.getPointAtLength(i*len/31);return{x:pt.x,y:pt.y};});});}
function begin(){
 refreshScope();if(!questions.length)return;queue=buildQueue(questions,store.records,+settings.length);queueLimit=queue.length+4;queueIndex=0;results=[];show('drillView');loadQuestion();
}
function renderSentence(q,isRead){
 const sentence=$('masked');sentence.replaceChildren();sentence.classList.add('sentence');sentence.dataset.questionId=q.id;
 const target=document.createElement(isRead?'span':'ruby');target.id='sentenceTarget';target.className='sentence-target';
 const base=document.createElement('span');base.className='target-text';base.textContent=isRead?q.displayWord:q.masked;target.append(base);
 if(!isRead){const rt=document.createElement('rt');rt.textContent=q.reading;target.append(rt);}
 sentence.append(document.createTextNode(q.before),target,document.createTextNode(q.after));
}
function loadQuestion(){
 reader?.stop();token++;if(queueIndex>=queue.length){renderResults();return;}
 current=queue[queueIndex];strokes=[];drawing=null;hints=current.requiresHint?1:0;answerSeen=false;judged=false;busy=false;
 const isRead=current.mode==='read';$('readingControls').hidden=!isRead;$('writingBox').hidden=false;$('kanaTools').hidden=true;$('questionInstruction').textContent=isRead?'ぶんを よんで、いろの ついた ことばを よもう':'ぶんを よんで、□の かんじを かこう';$('reading').hidden=true;
 $('reading').textContent=current.reading;renderSentence(current,isRead);$('cue').textContent='よみがなと ぶんを ヒントに、□の かんじを かいてね。';
 $('position').textContent=`${queueIndex+1} / ${queue.length}問`;$('sessionBadge').textContent=store.records[current.id]?.errors?'復習':'練習';$('progressFill').style.width=(queueIndex/queue.length*100)+'%';
 $('feedback').textContent='';$('feedback').className='feedback';$('next').hidden=true;$('confirmation').hidden=true;$('answer').disabled=false;$('clear').disabled=false;$('undo').disabled=false;$('check').textContent='できた！ たしかめる 🌸';if(isRead){$('cue').textContent='いろの ついた ぶぶんの よみを、こたえてね。';reader.unlock();reader.reset();}renderGuide();redraw();
}
async function recognize(kind='kanji'){
 if(!modelReady)throw Error('Model unavailable');
 const sample=document.createElement('canvas');sample.width=sample.height=128;const c=sample.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,128,128);c.drawImage(canvas,0,0,128,128);
 // DaKanji v2 expects light ink on a dark background; grid and hints stay out of this image.
 const pixels=c.getImageData(0,0,128,128).data,values=new Float32Array(128*128);for(let i=0;i<values.length;i++)values[i]=255-(.299*pixels[i*4]+.587*pixels[i*4+1]+.114*pixels[i*4+2]);
 const outputs=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',values,[1,1,128,128])});
 const raw=Array.from(outputs[session.outputNames[0]].data);if(raw.length!==labels.length||raw.some(x=>!Number.isFinite(x)))throw Error('認識結果を読み取れません。');
 const sum=raw.reduce((s,x)=>s+x,0);let probs=raw;
 if(raw.some(x=>x<0)||Math.abs(sum-1)>.1){const m=Math.max(...raw),exp=raw.map(x=>Math.exp(x-m)),s=exp.reduce((a,b)=>a+b,0);probs=exp.map(x=>x/s);}
 return probs.map((confidence,i)=>({char:labels[i],confidence})).filter(p=>kind!=='kana'||/^[ぁ-ゖー]$/.test(p.char)).sort((a,b)=>b.confidence-a.confidence).slice(0,5);
}
const homographs={'ニ':'二','エ':'工','カ':'力','タ':'夕'};
function feedback(text,style='review'){$('feedback').textContent=text;$('feedback').className='feedback '+style;}
function record(outcome){reader?.stop();
 if(judged)return;judged=true;store.records[current.id]=updateRecord(store.records[current.id],outcome);persist();results.push({q:current,outcome});
 if((outcome.type!=='correct'||outcome.hints>0||outcome.answerSeen||outcome.needsReview)&&queue.length<queueLimit){const at=Math.min(queue.length,queueIndex+4);if(!queue.slice(queueIndex+1).some(q=>q.id===current.id))queue.splice(at,0,current);}
 $('next').hidden=false;$('confirmation').hidden=true;$('check').disabled=true;$('clear').disabled=true;$('undo').disabled=true;$('answer').disabled=true;$('hint').disabled=true;if(reader?.active())reader.lock();
}
function offerConfirmation(text){feedback(text);answerSeen=true;renderGuide(true);$('confirmation').hidden=false;$('check').disabled=true;$('answer').disabled=true;}
async function check(){if(reader?.active()){reader.judge();return;}
 if(!strokes.length||judged||busy)return;
 if(!modelReady){offerConfirmation('自動判定が使えないため、答えのお手本と比べて確認しよう。');return;}
 busy=true;$('check').textContent='判定しています…';redraw();const requestToken=token;
 try{
  const predictions=await recognize();if(requestToken!==token)return;const best=predictions[0],recognized=homographs[best.char]||best.char;
  if(best.confidence<.55){offerConfirmation('字の判定がはっきりしませんでした。誤答としては記録しません。お手本と比べて確認しよう。');return;}
  const analysis=analyzeStrokes(strokes,referenceStrokes());
  if(recognized===current.char){
   feedback(`正解！${hints||answerSeen?' ヒントを使って思い出せたね。':' 自分の力で書けたね。'}\n${analysis.text}`,analysis.type==='good'?'good':'review');
   // Correct character with a stroke problem needs review; it is not counted as fluent mastery.
   const outcome={type:'correct',hints,answerSeen,reason:analysis.type==='good'?'':analysis.type,recognized,needsReview:analysis.type!=='good'};
   record(outcome);
  }else if(predictions.some(p=>(homographs[p.char]||p.char)===current.char&&p.confidence>.12)){
   offerConfirmation('似ている字の候補がありました。お手本と比べて確認しよう。');
  }else{
   feedback(`「${recognized}」に見えました。\n答えは「${current.char}」。${analysis.type==='good'?'字の形の違いを比べてみよう。':analysis.text}`);answerSeen=true;renderGuide(true);record({type:'wrong',hints,answerSeen:true,reason:recognized!==current.char?'different-character':analysis.type,recognized});
  }
 }catch(e){if(requestToken!==token)return;offerConfirmation('自動判定が止まりました。今回は、お手本と比べて確認しよう。');console.warn(e);}
 finally{if(requestToken===token){busy=false;$('check').textContent='できた！ たしかめる 🌸';redraw();if(!$('confirmation').hidden)$('check').disabled=true;}}
}
function renderResults(){show('resultView');const independent=results.filter(r=>r.outcome.type==='correct'&&!r.outcome.hints&&!r.outcome.answerSeen&&!r.outcome.needsReview).length,helped=results.filter(r=>r.outcome.type==='correct'&&(r.outcome.hints||r.outcome.answerSeen||r.outcome.needsReview)).length,wrong=results.length-independent-helped;
 $('resultMessage').textContent=`${results.length}問練習しました。${storageAvailable?'記録はこの端末に保存しました。':'記録の保存ができません。学習の記録から書き出してください。'}`;metrics($('resultCounts'),[['自力で正解',independent],['ヒント・確認で正解',helped],['もう一度練習',wrong]]);$('resultItems').replaceChildren();
 const byChar=new Map();for(const r of results)byChar.set(r.q.char,r);for(const r of byChar.values()){const row=document.createElement('div');row.className='result-row';const c=document.createElement('strong');c.className='record-char';c.textContent=r.q.char;const text=document.createElement('div');text.textContent=r.q.word+'（'+r.q.reading+'）';const badge=document.createElement('span');badge.className='badge';badge.textContent=r.outcome.type==='correct'&&!r.outcome.hints&&!r.outcome.answerSeen&&!r.outcome.needsReview?'翌日以降に復習':'もう一度復習';row.append(c,text,badge);$('resultItems').append(row);}}
function metrics(el,items){el.replaceChildren();for(const [label,n] of items){const div=document.createElement('div');div.className='metric';const strong=document.createElement('strong');strong.textContent=n;const span=document.createElement('span');span.textContent=label;div.append(strong,span);el.append(div);}}
const reasonNames={reading:'よみをもう一度', 'different-character':'別の字に似ていた',count:'画の数',direction:'書く向き',order:'書き順',shape:'画の位置・長さ',answer:'答えを見て確認'};
function renderRecords(){
 const entries=Object.entries(store.records);metrics($('recordSummary'),[['練習したことば',entries.length],['復習の時期',entries.filter(([,r])=>r.due<=Date.now()).length],['自力で3回以上',entries.filter(([,r])=>r.stage>=3&&r.streak>=3).length]]);$('recordList').replaceChildren();
 if(!entries.length){const p=document.createElement('p');p.textContent='まだ記録はありません。単元を選んで練習してみよう。';$('recordList').append(p);return;}
 for(const [id,r] of entries.sort((a,b)=>a[1].due-b[1].due).slice(0,100)){
  const [char,word,reading]=id.split('|');const mode=id.split('|').at(-1);const row=document.createElement('div');row.className='record-row';const c=document.createElement('strong');c.className='record-char';c.textContent=char;const detail=document.createElement('div');detail.className='record-detail';detail.textContent=`${word==='direct'?char:word}（${reading}）・${mode==='read'?'よむ':'かく'}`;const small=document.createElement('small');small.textContent=`自力 ${r.correct}回 · ヒント ${r.helped}回 · 練習し直し ${r.errors}回`;detail.append(small);
  const issues=[...new Set(r.history.map(h=>h.reason).filter(Boolean))];if(issues.length){const reason=document.createElement('small');reason.className='reason-label';reason.textContent='見直すところ：'+issues.map(x=>reasonNames[x]||'ヒントで確認').join('、');detail.append(reason);}
  const due=document.createElement('span');due.className='badge';due.textContent=r.due<=Date.now()?'今、復習しよう':new Date(r.due).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'})+'に復習';row.append(c,detail,due);$('recordList').append(row);
 }
}
$('grade').addEventListener('change',()=>{settings.grade=+$('grade').value;if(!Array.isArray(settings.selections[settings.grade]))settings.selections[settings.grade]=[units()[0].id];persist();renderUnits();refreshScope();});
$('multiple').addEventListener('change',()=>{settings.multiple=$('multiple').checked;persist();refreshScope();});$('sessionLength').addEventListener('change',()=>{settings.length=+$('sessionLength').value;persist();});
$('selectAll').onclick=()=>{settings.selections[settings.grade]=units().map(u=>u.id);persist();renderUnits();refreshScope();};$('selectNone').onclick=()=>{settings.selections[settings.grade]=[];persist();renderUnits();refreshScope();};$('start').onclick=$('quickStart').onclick=begin;
$('setupTab').onclick=$('back').onclick=$('finish').onclick=()=>{token++;busy=false;show('setupView');refreshScope();};$('progressTab').onclick=()=>{token++;busy=false;renderRecords();show('recordView');};$('restart').onclick=begin;
$('undo').onclick=()=>{if(judged||busy)return;strokes.pop();redraw();};$('clear').onclick=()=>{if(judged||busy)return;strokes=[];drawing=null;redraw();};
$('hint').onclick=()=>{if(judged||busy)return;hints++;renderGuide();if(reader?.active()){feedback('ひらがなの ヒントを ひとふで ふやしたよ。');return;}feedback(`${hints}画目まで表示しました。続きは自分で書いてみよう。`);};
$('answer').onclick=()=>{if(judged||busy)return;answerSeen=true;renderGuide(true);if(reader?.active()){feedback('こたえは「'+current.reading+'」。こえに だして よんでみよう。');record({type:'answer',hints,answerSeen:true,reason:'answer'});return;}feedback(`答えは「${current.char}」。${data.glyphs[current.char].paths.length}画です。\n1画目から順番に見直そう。`);record({type:'answer',hints,answerSeen:true,reason:'answer'});};$('check').onclick=check;
$('selfCorrect').onclick=()=>{feedback('お手本と比べて確認できたね。次はヒントなしで思い出そう。','good');record({type:'correct',hints,answerSeen:true,reason:'answer'});};$('selfWrong').onclick=()=>{feedback('もう一度練習する字として記録しました。');record({type:'wrong',hints,answerSeen:true,reason:'answer'});};
$('next').onclick=()=>{queueIndex++;loadQuestion();};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ひとふでヒント-学習記録.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('import').onchange=async()=>{try{const file=$('import').files[0];if(!file)return;if(file.size>5e6)throw Error('記録ファイルが大きすぎます。');const incoming=validateProgress(JSON.parse(await file.text()));for(const [id,r] of Object.entries(incoming.records))if(!store.records[id]||(r.lastSeen||0)>(store.records[id].lastSeen||0))store.records[id]=r;persist();renderRecords();$('storageMessage').textContent='記録を読み込みました。新しい記録を優先してまとめています。';}catch(e){$('storageMessage').textContent='読み込めませんでした：'+e.message;}finally{$('import').value='';}};
try{
 [data,kana]=await Promise.all([fetchJSON('./data/curriculum.json'),fetchJSON('./data/kana.json')]);
 reader=createReading({$,kana,getCurrent:()=>current,getState:()=>({judged,busy,strokes,drawing,hints,answerSeen}),setStrokes:s=>{strokes=s;redraw();},setBusy:value=>{busy=value;redraw();},recognize,record,feedback});reader.setQuestions(()=>questions);
 if(!['write','read'].includes(settings.mode))settings.mode='write';
 document.body.classList.toggle('vertical-ui',settings.vertical!==false);
 $('verticalToggle').setAttribute('aria-pressed',String(settings.vertical!==false));$('verticalToggle').textContent=settings.vertical===false?'よこがき ↔':'たてがき ↕';
 $('verticalToggle').onclick=()=>{settings.vertical=settings.vertical===false;document.body.classList.toggle('vertical-ui',settings.vertical);$('verticalToggle').setAttribute('aria-pressed',String(settings.vertical));$('verticalToggle').textContent=settings.vertical?'たてがき ↕':'よこがき ↔';persist();};
 for(const radio of document.querySelectorAll('input[name="mode"]')){radio.checked=radio.value===settings.mode;radio.onchange=()=>{settings.mode=radio.value;persist();refreshScope();};}
 $('grade').value=settings.grade;$('multiple').checked=settings.multiple;$('sessionLength').value=[5,10,20].includes(+settings.length)?settings.length:10;
 for(const g of data.grades)if(!Array.isArray(settings.selections[g.grade]))settings.selections[g.grade]=[g.units[0].id];
 renderUnits();refreshScope();await loadModel();
}catch(e){$('fatal').hidden=false;$('fatal').textContent='漢字のデータを読み込めません。HTTPでアプリを開き直してください。';console.error(e);}
