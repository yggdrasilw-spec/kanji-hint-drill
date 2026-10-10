import {savedShape} from './shape/policy.mjs';
import {sentenceQuestions} from './sentences.mjs';
export const STORAGE_KEY='kanji-hint-drill-v1';
export const DAY=86400000;
export function selectScope(data,grade,unitIds){
 const selected=new Set(unitIds),g=data.grades.find(g=>g.grade===Number(grade));
 return [...new Set((g?.units||[]).filter(u=>selected.has(u.id)).flatMap(u=>[...u.newCharacters.map(c=>c.text),...(u.readingAdditions||[]).flatMap(c=>[...c.text].filter(ch=>data.glyphs[ch]))]))];
}
export function questionsFor(data,grade,unitIds,multiple=true){
 return sentenceQuestions(data,grade,selectScope(data,grade,unitIds),multiple);
}
export function gradeCharacters(data,grade){
 return Object.keys(data.glyphs).filter(char=>data.glyphs[char].grade===Number(grade)).sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
}
export function selectedCharacters(data,value){
 return [...new Set(Array.isArray(value)?value:[])].filter(char=>typeof char==='string'&&Object.hasOwn(data.glyphs,char));
}
export function questionsForCharacters(data,chars,multiple=true){
 const selected=selectedCharacters(data,chars);
 // Build each target at its own grade; selecting a higher-grade card must not
 // reveal unfamiliar surrounding kanji in a lower-grade question.
 return [...new Set(selected.map(char=>data.glyphs[char].grade))].flatMap(grade=>sentenceQuestions(data,grade,selected.filter(char=>data.glyphs[char].grade===grade),multiple));
}
export function updateRecord(previous,outcome,now=Date.now()){
 const r={attempts:0,correct:0,helped:0,errors:0,streak:0,stage:0,due:now,history:[],...previous};
 r.attempts++;r.lastSeen=now;r.lastOutcome=outcome.type;
 const aided=outcome.hints>0||outcome.answerSeen||outcome.needsReview;
 if(outcome.type==='correct'&&!aided){r.correct++;r.streak++;r.stage=Math.min(4,r.stage+1);r.due=now+[1,3,7,14][r.stage-1]*DAY;}
 else if(outcome.type==='correct'){r.helped++;r.streak=0;r.stage=Math.max(0,r.stage-1);r.due=now+10*60000;}
 else{r.errors++;r.streak=0;r.stage=0;r.due=now;}
 r.history=[...r.history,{...savedShape(outcome),time:now,type:outcome.type,hints:outcome.hints||0,answerSeen:!!outcome.answerSeen,reason:outcome.reason||'',recognized:outcome.recognized||null,shapePolicy:String(outcome.shapePolicy||'').slice(0,300),beautyNotes:(outcome.beautyNotes||[]).filter(x=>typeof x==='string').slice(0,12)}].slice(-30);
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
export function analyzeStrokes(strokes,expected,options={}){
 const level=key=>['off','relaxed','normal','strict'].includes(options[key])?options[key]:'normal';
 const drawn=strokes.map(s=>resample(s)),ref=expected.map(s=>resample(s));
 if(drawn.length!==ref.length)return level('count')==='off'?{type:'good',text:'画数の確認は、設定でお休みしています。'}:{type:'count',text:`画の数を見直そう。お手本は${ref.length}画、今は${drawn.length}画です。`,expected:ref.length,actual:drawn.length};
 if(!drawn.length||drawn.some(s=>!s.length)||ref.some(s=>!s.length))return {type:'shape',text:'線を、お手本と比べて確認しよう。'};
 const rows=drawn.map((s,i)=>({index:i,error:distance(s,ref[i]),reverse:distance([...s].reverse(),ref[i])}));
 const ordered=rows.reduce((s,r)=>s+Math.min(r.error,r.reverse),0)/rows.length;
 const used=new Set(),assigned=drawn.map(s=>{let best={i:-1,d:Infinity};ref.forEach((r,i)=>{const d=Math.min(distance(s,r),distance([...s].reverse(),r));if(!used.has(i)&&d<best.d)best={i,d};});used.add(best.i);return best;});
 const reversed=level('direction')==='off'?null:assigned.map((r,index)=>({index,error:distance(drawn[index],ref[r.i]),reverse:distance([...drawn[index]].reverse(),ref[r.i])})).find(r=>r.reverse+({relaxed:12,normal:7,strict:4}[level('direction')])<r.error&&r.reverse<14);
 if(reversed)return {type:'direction',stroke:reversed.index+1,text:`${reversed.index+1}画目の書く向きを見直そう。`};
 if(level('order')!=='off'&&ordered>({relaxed:20,normal:14,strict:10}[level('order')])&&assigned.reduce((s,r)=>s+r.d,0)/assigned.length<11)return {type:'order',text:'書き順を見直そう。形は近いですが、画を書く順番が違うようです。'};
 const worst=assigned.map((r,index)=>({index,error:r.d})).sort((a,b)=>b.error-a.error)[0];
 if(level('shape')!=='off'&&worst.error>({relaxed:28,normal:20,strict:14}[level('shape')]))return {type:'shape',stroke:worst.index+1,text:`${worst.index+1}画目の位置や長さを、お手本と比べよう。`};
 return {type:'good',text:['count','direction','order','shape'].some(key=>level(key)==='off')?'設定で選んだ確認ができました。':'画の数と書く順番もよくできています。'};
}
export function validateProgress(value){
 if(!value||value.version!==1||typeof value.records!=='object'||!value.records||Array.isArray(value.records))throw Error('このアプリの学習記録ではありません。');
 const records={};
 for(const [id,r] of Object.entries(value.records)){
  if(id.length>150||!r||typeof r!=='object')continue;
  const safe={history:[]};for(const k of ['attempts','correct','helped','errors','streak','stage','due','lastSeen'])safe[k]=Number.isFinite(r[k])&&r[k]>=0?Math.min(r[k],k==='due'||k==='lastSeen'?1e15:100000):0;
  safe.stage=Math.min(4,safe.stage);safe.lastOutcome=['correct','wrong','answer'].includes(r.lastOutcome)?r.lastOutcome:'wrong';
  safe.history=(Array.isArray(r.history)?r.history:[]).slice(-30).map(h=>({...savedShape(h),time:Number(h.time)||0,type:['correct','wrong','answer'].includes(h.type)?h.type:'wrong',hints:Math.min(100,Number(h.hints)||0),answerSeen:!!h.answerSeen,reason:String(h.reason||'').slice(0,100),recognized:String(h.recognized||'').slice(0,2),shapePolicy:String(h.shapePolicy||'').slice(0,300),beautyNotes:(Array.isArray(h.beautyNotes)?h.beautyNotes:[]).filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,100))}));records[id]=safe;
 }
 return {version:1,records};
}
