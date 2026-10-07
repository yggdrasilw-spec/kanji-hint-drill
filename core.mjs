export const STORAGE_KEY='kanji-hint-drill-v1';
export const DAY=86400000;
export function selectScope(data,grade,unitIds){
 const selected=new Set(unitIds),g=data.grades.find(g=>g.grade===Number(grade));
 return [...new Set((g?.units||[]).filter(u=>selected.has(u.id)).flatMap(u=>[...u.newCharacters.map(c=>c.text),...(u.readingAdditions||[]).flatMap(c=>[...c.text].filter(ch=>data.glyphs[ch]))]))];
}
export function questionsFor(data,grade,unitIds,multiple=true){
 const chars=selectScope(data,grade,unitIds),known=new Set(chars);
 Object.entries(data.glyphs).forEach(([c,g])=>{if(g.grade<Number(grade))known.add(c);});
 const questions=[];
 for(const char of chars){
  const glyph=data.glyphs[char];
  const words=glyph.words.filter(w=>[...w.word].every(c=>!data.glyphs[c]||known.has(c)))
   .sort((a,b)=>a.rank-b.rank||a.word.length-b.word.length);
  const unique=[];
  for(const w of words)if(!unique.some(a=>a.word===w.word&&a.reading===w.reading))unique.push(w);
  // Keep multiple real vocabulary readings; no unlearned kanji in surrounding text.
  for(const w of unique.slice(0,multiple?5:1))questions.push({id:`${char}|${w.word}|${w.reading}`,char,word:w.word,reading:w.reading,masked:w.word.replace(char,'□'),requiresHint:false});
  if(!unique.length){
   const r=glyph.readings.find(r=>r.type==='訓')||glyph.readings[0];
   if(!r)continue;
   const reading=r.reading.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[-.]/g,'');
   questions.push({id:`${char}|direct|${reading}`,char,word:char,reading,masked:'□',requiresHint:true});
  }
 }
 // A bare reading or a homophone with the same surrounding characters needs a stroke cue.
 const alternatives=new Map();
 for(const q of questions){const key=q.reading+'|'+q.masked;const set=alternatives.get(key)||new Set();set.add(q.char);alternatives.set(key,set);}
 for(const q of questions)q.requiresHint=q.requiresHint||(q.masked==='□')||alternatives.get(q.reading+'|'+q.masked).size>1;
 return questions;
}
export function updateRecord(previous,outcome,now=Date.now()){
 const r={attempts:0,correct:0,helped:0,errors:0,streak:0,stage:0,due:now,history:[],...previous};
 r.attempts++;r.lastSeen=now;r.lastOutcome=outcome.type;
 const aided=outcome.hints>0||outcome.answerSeen||outcome.needsReview;
 if(outcome.type==='correct'&&!aided){r.correct++;r.streak++;r.stage=Math.min(4,r.stage+1);r.due=now+[1,3,7,14][r.stage-1]*DAY;}
 else if(outcome.type==='correct'){r.helped++;r.streak=0;r.stage=Math.max(0,r.stage-1);r.due=now+10*60000;}
 else{r.errors++;r.streak=0;r.stage=0;r.due=now;}
 r.history=[...r.history,{time:now,type:outcome.type,hints:outcome.hints||0,answerSeen:!!outcome.answerSeen,reason:outcome.reason||'',recognized:outcome.recognized||null}].slice(-30);
 return r;
}
export function buildQueue(questions,records,count=10,now=Date.now(),random=Math.random){
 const shuffle=a=>a.map(q=>({q,r:random()})).sort((a,b)=>a.r-b.r).map(x=>x.q);
 const due=shuffle(questions.filter(q=>records[q.id]?.due<=now)).sort((a,b)=>(records[b.id].errors-records[a.id].errors));
 const fresh=shuffle(questions.filter(q=>!records[q.id]));
 const later=shuffle(questions.filter(q=>records[q.id]?.due>now));
 const pool=[];while(due.length||fresh.length){if(due.length)pool.push(due.shift());if(fresh.length)pool.push(fresh.shift());}
 const seen=new Set(),result=[];
 for(const q of [...pool,...later]){if(seen.has(q.char))continue;seen.add(q.char);result.push(q);if(result.length>=count)return result;}
 for(const q of [...pool,...later]){if(result.some(x=>x.id===q.id))continue;result.push(q);if(result.length>=count)break;}
 return result;
}
export function summaryFor(questions,records,now=Date.now()){
 const entries=questions.map(q=>records[q.id]).filter(Boolean);
 return {total:questions.length,practiced:entries.length,due:entries.filter(r=>r.due<=now).length,mastered:entries.filter(r=>r.stage>=3&&r.streak>=3).length};
}
export function resample(points,n=24){
 if(!points.length)return [];
 const dist=[0];for(let i=1;i<points.length;i++)dist.push(dist.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 if(!dist.at(-1))return Array.from({length:n},()=>({...points[0]}));
 const out=[];let j=1;
 for(let i=0;i<n;i++){const d=i*dist.at(-1)/(n-1);while(j<dist.length-1&&dist[j]<d)j++;const t=(d-dist[j-1])/(dist[j]-dist[j-1]||1);out.push({x:points[j-1].x+t*(points[j].x-points[j-1].x),y:points[j-1].y+t*(points[j].y-points[j-1].y)});}
 return out;
}
function distance(a,b){return a.reduce((s,p,i)=>s+Math.hypot(p.x-b[i].x,p.y-b[i].y),0)/a.length;}
export function analyzeStrokes(strokes,expected){
 const drawn=strokes.map(s=>resample(s)),ref=expected.map(s=>resample(s));
 if(drawn.length!==ref.length)return {type:'count',text:`画の数を見直そう。お手本は${ref.length}画、今は${drawn.length}画です。`,expected:ref.length,actual:drawn.length};
 const rows=drawn.map((s,i)=>({index:i,error:distance(s,ref[i]),reverse:distance([...s].reverse(),ref[i])}));
 const reversed=rows.find(r=>r.reverse+7<r.error&&r.reverse<14);
 if(reversed)return {type:'direction',stroke:reversed.index+1,text:`${reversed.index+1}画目の書く向きを見直そう。`};
 const ordered=rows.reduce((s,r)=>s+r.error,0)/rows.length;
 const used=new Set(),assigned=drawn.map(s=>{let best={i:-1,d:Infinity};ref.forEach((r,i)=>{const d=Math.min(distance(s,r),distance([...s].reverse(),r));if(!used.has(i)&&d<best.d)best={i,d};});used.add(best.i);return best;});
 if(ordered>14&&assigned.reduce((s,r)=>s+r.d,0)/assigned.length<11)return {type:'order',text:'書き順を見直そう。形は近いですが、画を書く順番が違うようです。'};
 const worst=rows.sort((a,b)=>b.error-a.error)[0];
 if(worst.error>20)return {type:'shape',stroke:worst.index+1,text:`${worst.index+1}画目の位置や長さを、お手本と比べよう。`};
 return {type:'good',text:'画の数と書く順番もよくできています。'};
}
export function validateProgress(value){
 if(!value||value.version!==1||typeof value.records!=='object'||!value.records||Array.isArray(value.records))throw Error('このアプリの学習記録ではありません。');
 const records={};
 for(const [id,r] of Object.entries(value.records)){
  if(id.length>150||!r||typeof r!=='object')continue;
  const safe={history:[]};for(const k of ['attempts','correct','helped','errors','streak','stage','due','lastSeen'])safe[k]=Number.isFinite(r[k])&&r[k]>=0?Math.min(r[k],k==='due'||k==='lastSeen'?1e15:100000):0;
  safe.stage=Math.min(4,safe.stage);safe.lastOutcome=['correct','wrong','answer'].includes(r.lastOutcome)?r.lastOutcome:'wrong';
  safe.history=(Array.isArray(r.history)?r.history:[]).slice(-30).map(h=>({time:Number(h.time)||0,type:['correct','wrong','answer'].includes(h.type)?h.type:'wrong',hints:Math.min(100,Number(h.hints)||0),answerSeen:!!h.answerSeen,reason:String(h.reason||'').slice(0,100),recognized:String(h.recognized||'').slice(0,2)}));records[id]=safe;
 }
 return {version:1,records};
}
