import {resample} from './core.mjs';

export const CHECK_LEVELS=['off','relaxed','normal','strict'];
export const DEFAULT_SHAPE_SETTINGS=Object.freeze({protrusion:'normal',containment:'normal',connection:'normal',rise:'normal',sweepEnd:'off',beautyParallel:'off',beautySlope:'off',count:'normal',direction:'normal',order:'normal',shape:'relaxed'});
export function normalizeShapeSettings(value){
 return Object.fromEntries(Object.entries(DEFAULT_SHAPE_SETTINGS).map(([key,fallback])=>[key,(key==='count'?['off','normal']:CHECK_LEVELS).includes(value?.[key])?value[key]:fallback]));
}

// KanjiVG 鉄: the 12th stroke must cross the upper horizontal (10th stroke).
// Distances are relative to the drawn horizontal, not pixels or the writing box.
export const CHARACTER_RULES=Object.freeze({
 '鉄':[
  {id:'tetsu-upper-protrusion',kind:'protrusion',stroke:11,across:9,label:'右がわの縦線',text:'右がわの まんなかの線を、上の横線より 上まで のばそう。'},
  {id:'metal-top-bound',kind:'containment',stroke:4,across:2,end:'start',side:'above',label:'金へんの縦線の上',text:'金へんの 5画目は、3画目の横線より 上に 突き出さないように しよう。'},
  {id:'metal-bottom-bound',kind:'containment',stroke:4,across:7,end:'finish',side:'below',label:'金へんの縦線の下',text:'金へんの 5画目は、8画目の線より 下に 突き出さないように しよう。'},
  {id:'metal-roof-join',kind:'connection',stroke:1,across:0,label:'金へんの1・2画目',text:'金へんの 2画目の はじめを、1画目の線に つけよう。'},
  {id:'metal-rise',kind:'rise',stroke:7,across:2,label:'金へんの8画目',text:'金へんの 8画目は、右上に はらい上げよう。'},
  {id:'tetsu-sweep-end',kind:'sweepEnd',stroke:12,across:10,advice:true,label:'13画目の終わり',text:'13画目の 右はらいは、終わりを 右へ 横向きに してみよう。'},
  {id:'metal-parallel',kind:'beautyParallel',stroke:2,across:3,advice:true,label:'金へんの横線',text:'金へんの 3・4画目の 横線の向きを そろえてみよう。'},
  {id:'right-parallel',kind:'beautyParallel',stroke:9,across:10,advice:true,label:'右がわの横線',text:'右がわの 10・11画目の 横線の向きを そろえてみよう。'},
  ...[2,3,9,10].map(stroke=>({id:'horizontal-slope-'+(stroke+1),kind:'beautySlope',stroke,across:stroke,advice:true,label:(stroke+1)+'画目の右上がり',text:(stroke+1)+'画目の 横線を、少し 右上がりに してみよう。'}))
 ]
});

function bounds(strokes){
 const points=strokes.flat();
 if(!points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 return {cx:(minX+maxX)/2,cy:(minY+maxY)/2,size:Math.max(maxX-minX,maxY-minY)};
}
function normalize(strokes){
 const b=bounds(strokes);if(!b||b.size<1e-6)return null;
 return strokes.map(s=>resample(s,32).map(p=>({x:(p.x-b.cx)/b.size*100,y:(p.y-b.cy)/b.size*100})));
}
const distance=(a,b)=>a.reduce((sum,p,i)=>sum+Math.hypot(p.x-b[i].x,p.y-b[i].y),0)/a.length;

// Minimum cost one-to-one assignment; geometry can be checked independently of order.
function assignment(cost){
 const n=cost.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;const min=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
  do{
   used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=n;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
   for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
 }
 const result=Array(n);for(let j=1;j<=n;j++)result[j-1]=p[j]-1;return result;
}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
export function protrusionFocus(tip,horizontal,stroke,across){
 // Compare the oriented upper endpoint with the nearest point on the actual
 // drawn horizontal, including curved and slanted horizontals.
 let acrossPoint=horizontal[0],distance=Infinity;
 for(let i=1;i<horizontal.length;i++){
  const a=horizontal[i-1],b=horizontal[i],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
  const t=len2?Math.max(0,Math.min(1,((tip.x-a.x)*dx+(tip.y-a.y)*dy)/len2)):0;
  const p={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(tip.x-p.x,tip.y-p.y);
  if(d<distance){distance=d;acrossPoint=p;}
 }
 const length=Math.hypot(horizontal.at(-1).x-horizontal[0].x,horizontal.at(-1).y-horizontal[0].y);
 const padding=Math.max(3,length*.1),point={x:(tip.x+acrossPoint.x)/2,y:(tip.y+acrossPoint.y)/2};
 // Never cap the radius: doing so could put the endpoint outside the circle.
 return {point,radius:Math.max(5,length*.18,Math.hypot(tip.x-acrossPoint.x,tip.y-acrossPoint.y)/2+padding),tip:{...tip},acrossPoint,stroke,across};
}
function wholeStrokeFocus(a,b,stroke,across){
 const points=[...a,...b],xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const point={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
 return {point,radius:Math.max(5,...points.map(p=>Math.hypot(p.x-point.x,p.y-point.y)+3)),tip:a[0],acrossPoint:b.at(-1),stroke,across};
}
function crossings(a,b){
 const out=[];
 for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
  const r=sub(a[i],a[i-1]),s=sub(b[j],b[j-1]),den=cross(r,s);if(Math.abs(den)<1e-8)continue;
  const q=sub(b[j-1],a[i-1]),t=cross(q,s)/den,w=cross(q,r)/den;
  if(t>=-1e-6&&t<=1+1e-6&&w>=-1e-6&&w<=1+1e-6)out.push({x:a[i-1].x+t*r.x,y:a[i-1].y+t*r.y});
 }
 return out;
}

export function checkCharacterShape(char,strokes,expected,settings){
 const options=normalizeShapeSettings(settings),rules=(CHARACTER_RULES[char]||[]).filter(r=>options[r.kind]!=='off');
 if(!rules.length)return {status:'skipped',checks:[]};
 const uncertain=text=>({status:rules.some(r=>!r.advice)?'uncertain':'pass',checks:[],beautyChecks:rules.filter(r=>r.advice).map(r=>({...r,status:'uncertain',text:r.label+'を、お手本と 比べて 確認しよう。'})),text:text||'線の位置を はっきり 確かめられませんでした。お手本と 比べよう。'});
 if(strokes.length!==expected.length||!strokes.length||strokes.some(s=>s.length<2)||expected.some(s=>s.length<2))return uncertain('画の数や 線の位置を、お手本と 比べて 確認しよう。');
 const drawn=normalize(strokes),reference=normalize(expected);if(!drawn||!reference)return uncertain();
 const cost=drawn.map(s=>reference.map(r=>Math.min(distance(s,r),distance([...s].reverse(),r))));
 const map=assignment(cost),mean=map.reduce((sum,i,j)=>sum+cost[i][j],0)/map.length;
 if(mean>18)return uncertain();
 const matched=j=>{const i=map[j],s=drawn[i],r=reference[j];return {index:i,points:distance(s,r)<=distance([...s].reverse(),r)?strokes[i]:[...strokes[i]].reverse()};};
 const checks=[];
 for(const rule of rules){
  const a=matched(rule.stroke),b=matched(rule.across);
  // An ambiguous correspondence is not evidence of an incorrect character.
  let ambiguous=cost[a.index][rule.stroke]>27||cost[b.index][rule.across]>20;
  for(const [match,target] of [[a,rule.stroke],[b,rule.across]]){
   const alternatives=cost.map((row,i)=>i===match.index?Infinity:row[target]);
   if(Math.min(...alternatives)<cost[match.index][target]+2)ambiguous=true;
  }
  const item={id:rule.id,kind:rule.kind,label:rule.label,advice:!!rule.advice,stroke:a.index+1,across:b.index+1,text:rule.text};
  if(ambiguous){checks.push({...item,status:'uncertain',text:rule.label+'の 線の位置を、お手本と 比べよう。'});continue;}
  const h=sub(b.points.at(-1),b.points[0]),length=Math.hypot(h.x,h.y);
  if(length<1e-6){checks.push({...item,status:'uncertain'});continue;}
  const level=options[rule.kind];
  if(rule.kind==='beautyParallel'||rule.kind==='beautySlope'){
   const v=sub(a.points.at(-1),a.points[0]);
   // Beauty targets are geometric ideals, not distances from the SVG style.
   const angle=rule.kind==='beautyParallel'?Math.abs(Math.atan2(cross(h,v),h.x*v.x+h.y*v.y)*180/Math.PI):Math.atan2(-v.y,v.x)*180/Math.PI;
   const band=1;
   const [minimum,maximum]=rule.kind==='beautyParallel'?[0,{relaxed:12,normal:8,strict:4}[level]]:{relaxed:[0,18],normal:[2,12],strict:[3,9]}[level];
   const status=angle<minimum-band||angle>maximum+band?'review':angle<minimum+band||angle>maximum-band?'uncertain':'pass';
   // Parallel's lower bound is zero, with no ambiguity band at perfect parallel.
   checks.push({...item,status:rule.kind==='beautyParallel'&&angle<=maximum-band?'pass':status,angle,minimum,maximum,focus:wholeStrokeFocus(a.points,b.points,a.index+1,b.index+1)});continue;
  }
  if(rule.kind==='rise'||rule.kind==='sweepEnd'){
   // Angles use a nearby horizontal as their baseline, so a tilted or scaled
   // whole glyph retains the same relation. Resampling avoids point-rate bias.
   const samples=resample(a.points,41),end=samples.at(-1),start=samples[rule.kind==='rise'?0:36],v=sub(end,start);
   const angle=Math.atan2(-cross(h,v),h.x*v.x+h.y*v.y)*180/Math.PI;
   const threshold=rule.kind==='rise'?{relaxed:2,normal:7,strict:12}[level]:{relaxed:42,normal:26,strict:15}[level];
   const value=rule.kind==='rise'?angle:Math.abs(angle),band=2;
   const raw=rule.kind==='rise'?(value>=threshold+band?'pass':value<threshold-band?'fail':'uncertain'):(value<=threshold-band?'pass':value>threshold+band?'fail':'uncertain');
   const status=Math.hypot(v.x,v.y)<length*.02?'uncertain':raw==='fail'&&rule.advice?'review':raw;
   const focus=protrusionFocus(end,[start,start],a.index+1,undefined);
   checks.push({...item,status,angle,threshold,focus});continue;
  }
  const start=rule.end==='finish'?a.points.at(-1):a.points[0],focus=protrusionFocus(start,b.points,a.index+1,b.index+1);
  if(rule.kind==='connection'){
   const gap=Math.hypot(start.x-focus.acrossPoint.x,start.y-focus.acrossPoint.y)/length;
   const maximum={relaxed:.23,normal:.18,strict:.12}[level],band=.015;
   checks.push({...item,status:gap<=maximum-band?'pass':gap>maximum+band?'fail':'uncertain',gap,maximum,focus});continue;
  }
  const offset=sub(start,b.points[0]);
  const projection=(offset.x*h.x+offset.y*h.y)/(length*length);
  if(projection<-.15||projection>1.15){checks.push({...item,status:'uncertain',focus});continue;}
  if(rule.kind==='containment'){
   // Measure against the actual drawn curve near the endpoint, not only its
   // straight chord. Positive overshoot points outside the metal radical.
   const offset=sub(start,focus.acrossPoint),overshoot=cross(h,offset)/(length*length)*(rule.side==='above'?-1:1);
   const maximum={relaxed:.13,normal:.07,strict:.04}[level],band=.012;
   checks.push({...item,status:overshoot<=maximum-band?'pass':overshoot>maximum+band?'fail':'uncertain',overshoot,maximum,focus});continue;
  }
  // Screen y grows downwards: positive extension means above the horizontal.
  const extension=-cross(h,offset)/(length*length);
  const [minimum,band]={relaxed:[.06,.02],normal:[.14,.035],strict:[.26,.05]}[level];
  const hits=crossings(a.points,b.points),intersects=hits.length>0;
  const status=!intersects&&extension>minimum-band?'uncertain':extension>=minimum+band&&intersects?'pass':extension<minimum-band?'fail':'uncertain';
  checks.push({...item,status,extension,minimum,
   text:status==='uncertain'?'上の横線より 上に出る長さを、お手本と 比べて 確認しよう。':rule.text,
   focus});
 }
 const required=checks.filter(c=>!c.advice),beautyChecks=checks.filter(c=>c.advice);
 const status=['fail','uncertain'].find(status=>required.some(c=>c.status===status))||'pass';
 const issue=required.find(c=>c.status===status);
 return {status,checks:required,beautyChecks,text:issue?.text,focus:issue?.focus,ruleId:issue?.id,kind:issue?.kind};
}
