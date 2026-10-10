import {resample} from '../core.mjs';
import {bounds,sub,dot,cross,norm,dist,nearest,lineDistance,mainRun,frame,local,world,projectedLength,focus,angle,boxAtY,intersections} from './geometry.mjs';
const limits=(level,values)=>values[{relaxed:0,normal:1,strict:2}[level]];
const banded=(value,min,max,band)=>value<min-band||value>max+band?'fail':value<min+band||value>max-band?'uncertain':'pass';
const unavailable=reason=>({status:'unavailable',confidence:'none',reasonCode:reason});
const unsure=reason=>({status:'uncertain',confidence:'low',reasonCode:reason});
function hookTurn(points,scale){
 const ps=resample(points,101),before=sub(ps[85],ps[70]),tails=[1,2,3,5,8,12].map(n=>sub(ps[100],ps[100-n])).filter(v=>norm(v)>=scale*.006);
 return {ps,turn:norm(before)<scale*.008||!tails.length?null:Math.max(...tails.map(last=>Math.abs(angle(before,last))))};
}
function componentBox(ctx){
 const wall=ctx.get('leftWall'),roof=ctx.get('roof'),bottom=ctx.get('bottom');if(!wall?.stable||!roof?.stable||(ctx.rule.kind==='internalBars'&&!bottom?.stable))return null;
 const f=frame(roof.points);if(!f||f.length<ctx.match.scale*.045)return null;
 const left=wall.points.map(p=>local(p,f)),right=roof.points.map(p=>local(p,f)),base=bottom?.points.map(p=>local(p,f));
 const rb=bounds([right]),lb=bounds([left]),y0=0,y1=base?base.reduce((s,p)=>s+p.y,0)/base.length:Math.min(lb.y1,rb.y1);
 if(y1-y0<f.length*.20)return null;
 const at=y=>({left:boxAtY(left,y),right:boxAtY(right,y)});let samples=[.25,.5,.75].map(t=>({y:y0+(y1-y0)*t,...at(y0+(y1-y0)*t)}));
 if(samples.some(p=>p.left===null||p.right===null||p.right-p.left<f.length*.15))return null;
 const x0=samples.reduce((s,p)=>s+p.left,0)/3,x1=samples.reduce((s,p)=>s+p.right,0)/3;
 return {f,y0,y1,x0,x1,samples,width:x1-x0,height:y1-y0,polygon:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>{const p=world({x,y},f);return [p.x,p.y];}),indices:[...wall.indices,...roof.indices,...(bottom?.indices||[])]};
}
function barsInBox(ctx,box){
 const ys=[];let unstable=false;const excluded=new Set([ctx.get('leftWall'),ctx.get('roof'),ctx.get('bottom')].filter(Boolean).flatMap(m=>m.indices));
 for(const v of ctx.match.virtual){
  if(v.indices.every(i=>excluded.has(i)))continue;
  const line=v.points.map(p=>local(p,box.f)),runs=[];let run=[];
  for(let i=0;i<line.length;i++){
   const p=line[i],prev=line[Math.max(0,i-1)],dx=Math.abs(p.x-prev.x),dy=Math.abs(p.y-prev.y);
   if(i===0||dx>dy*1.5){run.push(p);}else {if(run.length>1)runs.push(run);run=[p];}
  }if(run.length>1)runs.push(run);
  for(const ps of runs){const b=bounds([ps]),y=ps.reduce((s,p)=>s+p.y,0)/ps.length;
   const inside=y>box.y0+box.height*.09&&y<box.y1-box.height*.09&&b.x0>=box.x0-box.width*.20&&b.x1<=box.x1+box.width*.20;
   if(!inside)continue;if(b.width<box.width*.42)continue;
   if(b.height>box.height*.17){unstable=true;continue;}
   // Joined fragments and retraced bars count once; a distinct nearby bar is uncertain.
   const neighbor=ys.find(r=>Math.abs(r.y-y)<box.height*.065);
   if(neighbor){if(Math.abs(neighbor.y-y)>box.height*.025)unstable=true;neighbor.indices.push(...v.indices);}else ys.push({y,indices:[...v.indices]});
  }
 }
 return {bars:ys.sort((a,b)=>a.y-b.y),unstable};
}
export function evaluateRule(ctx){
 const {rule,level,match}=ctx,p=rule.parameters||{},ms=rule.roles.map(role=>ctx.get(role)),available=ms.filter(Boolean),indices=available.flatMap(m=>m.indices),foc=()=>focus(available.map(m=>m.points),indices);
 if(!match.available)return unavailable(match.reason);
 if(rule.kind==='strokePresence'){
  const missing=match.missing,extra=match.extras;const stable=available.filter(m=>m.stable);
  if(!missing.length&&!extra.length)return {status:available.every(m=>m.stable)?'pass':'uncertain',confidence:available.every(m=>m.stable)?'high':'low',reasonCode:'visual-lines-present'};
  if(stable.length<Math.max(1,available.length*.6))return unsure('unstable-missing-location');
  let f=extra.length?focus(extra.map(v=>v.points),extra.flatMap(v=>v.indices)):foc();
  return {status:'fail',confidence:'high',reasonCode:missing.length?'missing-line':'extra-line',observed:{missing:missing.map(i=>i+1),extra:extra.flatMap(v=>v.indices.map(i=>i+1))},expected:{count:ctx.expected.length},focus:f,text:missing.length?'字の中に 足りない線が あります。お手本と 比べよう。':'字の中の 余分な線を、お手本と 比べよう。'};
 }
 if(rule.kind==='internalBars'){
  const box=componentBox(ctx);if(!box)return unsure('unstable-component-frame');const found=barsInBox(ctx,box),count=found.bars.length;
  const status=found.unstable?'uncertain':count===p.count?'pass':'fail';
  return {status,confidence:found.unstable?'low':'high',reasonCode:count<p.count?'missing-internal-bar':count>p.count?'extra-internal-bar':'internal-bars-present',observed:{count},expected:{count:p.count},focus:focus([],box.indices,[],box.polygon,'component-region'),text:ctx.instance.attributes.element+'の 中の 横線は '+p.count+'本。いまは '+count+'本に 見えます。'+(count<p.count?'足りない線を 確かめよう。':count>p.count?'余分な線を 確かめよう。':'横線の 位置を 比べよう。')};
 }
 if(rule.kind==='topology'){
  const problems=[],borderline=[];let ambiguous=false;for(const pair of p.relations){const a=ctx.get(pair.a),b=ctx.get(pair.b);if(!a?.stable||!b?.stable){ambiguous=true;continue;}
   const gap=lineDistance(a.points,b.points)/match.scale,max=limits(level,[.085,.065,.045]);if(gap>max+.012)problems.push({a,b,gap,max,pair});else if(gap>max-.012)borderline.push({a,b,gap,max,pair});
  }
  const issue=problems[0]||borderline[0],status=problems.length?'fail':borderline.length||ambiguous?'uncertain':'pass';
  return {status,confidence:status==='fail'?'high':status==='uncertain'?'low':'high',reasonCode:issue?'contact-gap':ambiguous?'ambiguous-contact-correspondence':'contact-signature',observed:issue?{gap:issue.gap}:undefined,expected:issue?{maximum:issue.max}:undefined,focus:issue?focus([issue.a.points,issue.b.points],[...issue.a.indices,...issue.b.indices]):null,text:issue?'色のついた 二本の つながりを、お手本と 比べよう。':ambiguous?'線の対応が はっきりしませんでした。字全体を、お手本と 比べよう。':rule.text};
 }
 if(ms.some(m=>!m?.stable))return unsure('ambiguous-role-correspondence');
 const [a,b]=ms,points=a?.points;if(!points)return unavailable('role-missing');
 if(rule.kind==='componentAspect'){
  const box=componentBox(ctx);if(!box)return unsure('unstable-component-frame');const aspect=box.width/box.height,widen=limits(level,[.13,.07,0]),[minimum,maximum]=p.range;
  return {status:banded(aspect,minimum-widen,maximum+widen,.025),confidence:'high',reasonCode:'component-body-aspect',observed:{aspect},expected:{minimum:minimum-widen,maximum:maximum+widen},focus:focus([],box.indices,box.samples.flatMap(s=>[world({x:s.left,y:s.y},box.f),world({x:s.right,y:s.y},box.f)]),box.polygon,'component-region')};
 }
 if(rule.kind==='spacing'){
  const owner=ctx.getBoxContext(),box=componentBox(owner);if(!box)return unsure('unstable-component-frame');const counted=barsInBox(owner,box);
  if(counted.unstable||counted.bars.length!==2)return unavailable('internal-bars-not-established');
  const gaps=[counted.bars[0].y-box.y0,counted.bars[1].y-counted.bars[0].y,box.y1-counted.bars[1].y],average=gaps.reduce((a,b)=>a+b)/3,spread=Math.max(...gaps.map(g=>Math.abs(g-average)))/average,max=limits(level,[.7,.5,.32]);
  return {status:banded(spread,0,max,.035)==='uncertain'&&spread<.035?'pass':banded(spread,0,max,.035),confidence:'high',reasonCode:'eye-spacing',observed:{gaps,spread},expected:{maximum:max},focus:foc()};
 }
 if(['lengthOrder','lengthIdentity','lengthRatio'].includes(rule.kind)){
  const axis=p.axis||'horizontal',la=projectedLength(points,axis),lb=projectedLength(b.points,axis);if(Math.min(la,lb)<match.scale*.035)return unsure('short-main-line');
  const ratio=lb/la,gap=(la-lb)/Math.max(la,lb),minimum=limits(level,rule.layer==='identity'?[.02,.04,.07]:[.04,.08,.13]);
  const status=rule.kind==='lengthRatio'?banded(ratio,p.minimum??.25,p.maximum??.94,.025):gap<minimum-.018?'fail':gap<minimum+.018?'uncertain':'pass';
  const runs=[mainRun(points,axis),mainRun(b.points,axis)].map(r=>r.points);return {status,confidence:'high',reasonCode:'main-line-length-relation',observed:{gap,ratio,long:la,short:lb},expected:{minimum},focus:focus(runs,indices,runs.flatMap(r=>[r[0],r.at(-1)]),'','length-comparison')};
 }
 if(['upwardSlope','parallel'].includes(rule.kind)){
  const run=mainRun(points);if(!run)return unsure('unstable-line-direction');const v=sub(run.points.at(-1),run.points[0]),theta=rule.kind==='parallel'?Math.abs(angle(v,sub(mainRun(b.points)?.points.at(-1)||b.points.at(-1),mainRun(b.points)?.points[0]||b.points[0]))):Math.atan2(-v.y,v.x)*180/Math.PI;
  const [min,max]=rule.kind==='parallel'?[0,limits(level,[14,10,6])]:limits(level,[[-2,20],[0,16],[2,12]]);return {status:rule.kind==='parallel'&&theta<max-1?'pass':banded(theta,min,max,1),confidence:'high',reasonCode:'horizontal-angle',observed:{angle:theta},expected:{minimum:min,maximum:max},focus:foc()};
 }
 if(['protrusion','boundedEndpoint','contact','crossing','separation'].includes(rule.kind)){
  if(rule.kind==='contact'||rule.kind==='separation'){
   const length=dist(b.points[0],b.points.at(-1));if(length<match.scale*.04)return unsure('short-contact-reference');
   const endpoint=p.end==='finish'||p.end==='end'||p.side==='below'?points.at(-1):points[0],near=nearest(endpoint,b.points),gap=near.distance/length;
   const threshold=limits(level,rule.kind==='contact'?[.22,.17,.12]:[.015,.035,.055]),status=rule.kind==='contact'?(gap>threshold+.015?'fail':gap>threshold-.015?'uncertain':'pass'):(gap<threshold-.01?'fail':gap<threshold+.01?'uncertain':'pass');
   return {status,confidence:status==='uncertain'?'low':'high',reasonCode:rule.kind==='contact'?'endpoint-contact':'required-gap',observed:{gap},expected:rule.kind==='contact'?{maximum:threshold}:{minimum:threshold},focus:focus([],indices,[endpoint,near.point],null,'endpoint-pair')};
  }
  const base=frame(b.points);if(!base)return unsure('unstable-reference-axis');const endpoint=p.side==='below'?points.at(-1):points[0],near=nearest(endpoint,b.points),signed=dot(sub(endpoint,near.point),base.y)/base.length*(p.side==='below'?1:-1),gap=near.distance/base.length;
  let status,reason,expected;if(rule.kind==='crossing'){status=intersections(points,b.points).length?'pass':'uncertain';reason='crossing';}
  else if(rule.kind==='boundedEndpoint'){const max=limits(level,[.16,.10,.065]);status=signed>max+.018?'fail':signed>max-.018?'uncertain':'pass';reason='bounded-endpoint';expected={maximum:max};}
  else{const min=limits(level,[.03,.07,.12]);status=signed<min-.018?'fail':signed<min+.018?'uncertain':intersections(points,b.points).length?'pass':'uncertain';reason='required-protrusion';expected={minimum:min};}
  return {status,confidence:status==='uncertain'?'low':'high',reasonCode:reason,observed:{extension:signed,gap},expected,focus:focus([],indices,[endpoint,near.point],null,'endpoint-pair')};
 }
 if(rule.kind==='compactEnding'){
  const base=frame(b.points);if(!base)return unsure('unstable-reference-axis');const ps=resample(points,41),tail=sub(ps.at(-1),ps[24]),tailRatio=norm(tail)/base.length,endpointRatio=local(ps.at(-1),base).x/base.length,theta=Math.atan2(-dot(tail,base.y),dot(tail,base.x))*180/Math.PI;
  const loose=limits(level,[.18,.08,0]),tooLong=tailRatio>p.tailRatio+loose&&endpointRatio>p.endpointRatio+loose&&theta<0;
  return {status:tooLong?'fail':tailRatio>p.tailRatio+loose||endpointRatio>p.endpointRatio+loose?'uncertain':'pass',confidence:tooLong?'high':'medium',reasonCode:'compact-ending-geometry',observed:{tailRatio,endpointRatio,angle:theta},expected:{tailMaximum:p.tailRatio+loose,endpointMaximum:p.endpointRatio+loose},focus:focus([ps.slice(24)],a.indices,[ps[24],ps.at(-1)],null,'line-group')};
 }
 if(rule.kind==='risingStroke'||rule.kind==='sweepGeometry'){
  const base=frame(b.points);if(!base)return unsure('unstable-reference-axis');const raw=rule.kind==='risingStroke'?a.rawPoints:points,ps=resample(raw,41),v=sub(ps.at(-1),ps[rule.kind==='risingStroke'?0:30]);if(norm(v)<base.length*.04)return unsure('short-ending');const theta=-angle(base.x,v),min=limits(level,[0,5,10]);
  return {status:rule.kind==='risingStroke'?(theta<min-2?'fail':theta<min+2?'uncertain':'pass'):(theta<-75||theta>20?'fail':'pass'),confidence:'medium',reasonCode:'ending-direction',observed:{angle:theta},expected:{minimum:min},focus:foc()};
 }
 if(rule.kind==='hookGeometry'){
  // Measure the written direction and several short tails. A fixed final 12.5%
  // averages a small hook together with its much longer stem.
  const reference=ctx.expected?.[ctx.instance?.roles[rule.roles[0]]?.stroke-1];
  let min=limits(level,[20,30,42]);
  if(reference){const ref=hookTurn(reference,bounds(ctx.expected).size);if(ref.turn===null||ref.turn<20)return unavailable('reference-hook-not-established');min=Math.min(min,ref.turn*limits(level,[.5,.65,.8]));}
  const {ps,turn}=hookTurn(a.rawPoints,match.scale),f=focus([ps.slice(70)],a.indices,[ps[70],ps.at(-1)],null,'line-group');
  if(turn===null)return {...unsure('short-hook'),focus:f};
  return {status:turn<min-5?'fail':turn<min+5?'uncertain':'pass',confidence:'medium',reasonCode:'ending-turn',observed:{turn},expected:{minimum:min},focus:f};
 }
 return unavailable('checker-not-implemented');
}
