export function normalizeReading(value){return String(value).normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s。、，,.！？!?]/g,'');}
export function readingQuestions(questions,data){return questions.map(q=>({...q,id:q.id+'|read',mode:'read',requiresHint:false,acceptedReadings:[...new Set([q.reading,...(data?.glyphs[q.char]?.words||[]).filter(w=>w.word===q.word).map(w=>w.reading)])]}));}
export function createReading({$,getCurrent,getState,setStrokes,setBusy,recognize,record,feedback,kana}){
 let inputMode='keyboard',recognition=null,request=0,composing=false,committing=false;
 const field=$('readingInput'),speech=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
 function stop(){request++;if(committing){committing=false;setBusy(false);}if(recognition){const old=recognition;recognition=null;old.abort();}$('speak').textContent='🎤 はなす';}
 function active(){return getCurrent()?.mode==='read';}
 function canCheck(){return active()&&normalizeReading(field.value).length>0&&!composing;}
 function refresh(){const s=getState();$('check').disabled=s.judged||s.busy||!canCheck();$('kanaCommit').disabled=s.judged||s.busy||!s.strokes.length||!!s.drawing;}
 function switchInput(mode){stop();inputMode=mode;for(const b of $('inputModes').querySelectorAll('button')){b.classList.toggle('selected',b.dataset.input===mode);b.setAttribute('aria-pressed',String(b.dataset.input===mode));}$('writingBox').hidden=mode!=='handwriting';$('kanaTools').hidden=mode!=='handwriting';$('speechBox').hidden=mode!=='voice';$('readingInputLabel').textContent=mode==='handwriting'?'かいた もじ → よみの こたえ':'よみを ひらがなで いれてね';if(mode==='keyboard')field.focus();refresh();}
 function reset(){stop();field.value='';$('speechCandidates').replaceChildren();$('speechStatus').textContent='ボタンを おして、ことばを よんでね。';$('kanaCandidates').replaceChildren();$('kanaStatus').textContent='ひらがなを １もじずつ かいてね。';switchInput(inputMode);}
 function renderHint(all=false){
  const q=getCurrent(),chars=[...normalizeReading(q.reading)],budget=all?Infinity:getState().hints;
  let remaining=budget,total=0;$('readingHint').replaceChildren();
  for(const char of chars){const paths=kana.glyphs[char]?.paths||[];total+=paths.length;const tile=document.createElement('span');tile.className='kana-hint-tile';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 109 109');svg.setAttribute('aria-hidden','true');for(const d of paths.slice(0,Math.max(0,remaining))){const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);svg.append(p);}remaining-=paths.length;if(all&&!paths.length)tile.textContent=char;else tile.append(svg);$('readingHint').append(tile);}
  $('readingHint').setAttribute('aria-label',all?'よみの答え：'+q.reading:'よみの一筆ヒント');$('hint').disabled=getState().judged||getState().busy||budget>=total;
  $('hint').querySelector('span:nth-child(2)').firstChild.textContent=budget===0?'ひらがなを ひとふで':budget>=total?'ヒントを ぜんぶ みたよ':'つぎの ひとふで';
 }
 function judge(){if(!canCheck()||getState().judged||getState().busy)return;stop();const answer=normalizeReading(field.value),q=getCurrent(),correct=(q.acceptedReadings||[q.reading]).some(r=>answer===normalizeReading(r));feedback(correct?'はなまる！ よめたね！ 🌸':'おしい！ こたえは「'+q.reading+'」。もういちど よんでみよう。',correct?'good':'review');const s=getState();record({type:correct?'correct':'wrong',hints:s.hints,answerSeen:s.answerSeen||!correct,reason:correct?'':'reading',recognized:answer});if(!correct)renderHint(true);lock();}
 function lock(){stop();field.disabled=true;for(const b of $('inputModes').querySelectorAll('button'))b.disabled=true;for(const id of ['speak','kanaCommit','deleteKana'])$(id).disabled=true;}
 async function commit(){
  const s=getState();if(!s.strokes.length||s.drawing||s.busy||s.judged)return;stop();const id=++request;committing=true;setBusy(true);$('kanaCommit').disabled=true;$('kanaStatus').textContent='もじを よみとっているよ…';$('kanaCandidates').replaceChildren();
  try{const candidates=await recognize('kana');if(id!==request||!active()||getState().judged)return;
   const choices=candidates.filter(p=>/^[ぁ-ゖー]$/.test(p.char));if(!choices.length)throw Error('no candidates');
   $('kanaStatus').textContent='かいた もじは どれかな？ えらんでね。';
   for(const p of choices){const b=document.createElement('button');b.textContent=p.char;b.setAttribute('aria-label',p.char+'を こたえに いれる');b.onclick=()=>{if(getState().judged)return;field.value+=p.char;setStrokes([]);$('kanaCandidates').replaceChildren();$('kanaStatus').textContent='つぎの ひらがなを かいてね。';refresh();};$('kanaCandidates').append(b);}
  }catch{if(id!==request)return;$('kanaStatus').textContent='もじを よみとれなかったよ。もういちど かくか、「うつ」を えらんでね。';}finally{if(id===request){committing=false;setBusy(false);refresh();}}
 }
 $('inputModes').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(!getState().judged)switchInput(b.dataset.input);});
 field.addEventListener('input',refresh);field.addEventListener('compositionstart',()=>{composing=true;refresh();});field.addEventListener('compositionend',()=>{composing=false;refresh();});field.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&!composing)judge();});
 $('deleteKana').onclick=()=>{field.value=[...field.value].slice(0,-1).join('');refresh();};$('kanaCommit').onclick=commit;
 $('speak').onclick=()=>{
  if(recognition){stop();return;}if(!speech){$('speechStatus').textContent='このブラウザでは おはなしの よみとりが できないよ。「うつ」「かく」を えらんでね。';return;}
  stop();const id=request,qid=getCurrent()?.id,engine=new speech();recognition=engine;engine.lang='ja-JP';engine.interimResults=false;engine.maxAlternatives=5;$('speak').textContent='⏹ おわる';$('speechStatus').textContent='きいているよ… ことばを よんでね。';
  engine.onresult=e=>{if(id!==request||getCurrent()?.id!==qid||getState().judged||!active())return;const transcript=e.results[0][0].transcript,normalized=normalizeReading(transcript);field.value=/^[ぁ-ゖー]+$/.test(normalized)?normalized:'';$('speechCandidates').replaceChildren();
   if(field.value){$('speechStatus').textContent='「'+field.value+'」と きこえたよ。たしかめて「できた！」を おしてね。';}
   else{const q=getCurrent(),matches=[...new Set([q,...getQuestionsForSpeech()].filter(x=>normalizeReading(x.word)===normalized).map(x=>x.reading))];$('speechStatus').textContent='「'+transcript+'」と きこえたよ。よみの こうほを えらぶか、ひらがなで なおしてね。';for(const reading of matches){const b=document.createElement('button');b.textContent=reading;b.onclick=()=>{if(getState().judged)return;field.value=reading;refresh();};$('speechCandidates').append(b);}}
   refresh();};
  engine.onerror=e=>{if(id!==request)return;$('speechStatus').textContent=e.error==='not-allowed'?'マイクが つかえないよ。ブラウザの マイクを きょかするか、「うつ」「かく」で こたえてね。':e.error==='no-speech'?'こえが きこえなかったよ。もういちど おして はなしてね。':'うまく ききとれなかったよ。「うつ」「かく」でも こたえられるよ。';};
  engine.onend=()=>{if(recognition===engine){recognition=null;$('speak').textContent='🎤 はなす';}};
  try{engine.start();}catch{stop();$('speechStatus').textContent='マイクを はじめられなかったよ。「うつ」「かく」を えらんでね。';}
 };
 let getQuestionsForSpeech=()=>[];
 return {active,refresh,reset,renderHint,judge,lock,stop,setQuestions(fn){getQuestionsForSpeech=fn;},unlock(){field.disabled=false;for(const b of $('inputModes').querySelectorAll('button'))b.disabled=false;for(const id of ['speak','deleteKana'])$(id).disabled=false;}};
}
