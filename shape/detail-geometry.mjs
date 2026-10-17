import {resample} from '../core.mjs';
import {bounds,dist,sub,norm,angle,nearest,intersections,focus} from './geometry.mjs';

export const DETAIL_LIMITS=Object.freeze({
 position:[.14,.10,.065],path:[.18,.13,.09],finish:[50,35,22],
 contact:[.10,.07,.045],crossing:[.13,.09,.06],separation:[.18,.13,.08],
 length:[.50,.35,.22],component:[.18,.13,.085]
});
const at=(level,key)=>DETAIL_LIMITS[key][{relaxed:0,normal:1,strict:2}[level]??1];
const status=(value,maximum,band)=>value>maximum+band?'fail':value>maximum-band?'uncertain':'pass';
export function normalizedLines(lines){
 const b=bounds(lines);if(!b||b.size<1e-8)return null;
 return lines.map(line=>resample(line,17).map(p=>({x:(p.x-b.cx)/b.size,y:(p.y-b.cy)/b.size})));
}
export function closestPair(a,b){
 const hits=intersections(a,b);if(hits.length)return {a:hits[0],b:hits[0],gap:0,hits};
 let best={gap:Infinity,hits};
 for(const p of a){const q=nearest(p,b);if(q.distance<best.gap)best={a:p,b:q.point,gap:q.distance,hits};}
 for(const p of b){const q=nearest(p,a);if(q.distance<best.gap)best={a:q.point,b:p,gap:q.distance,hits};}
 return best;
}
export function pairFeature(a,b){
 const pair=closestPair(a,b),depthA=Math.min(dist(pair.a,a[0]),dist(pair.a,a.at(-1))),depthB=Math.min(dist(pair.b,b[0]),dist(pair.b,b.at(-1)));
 const va=sub(a.at(-1),a[0]),vb=sub(b.at(-1),b[0]),parallel=Math.abs(Math.sin(angle(va,vb)*Math.PI/180))<.14;
 const type=pair.hits.length?(Math.min(depthA,depthB)>.025?'C':'T'):pair.gap<=.025?(parallel&&Math.min(depthA,depthB)>.025?'O':'T'):'S';
 return {...pair,depthA,depthB,type};
}
const length=line=>line.slice(1).reduce((sum,p,i)=>sum+dist(p,line[i]),0);
const circularDifference=(a,b)=>Math.abs((a-b+540)%360-180);
function finish(line){const ps=resample(line,17);let v=sub(ps.at(-1),ps[13]);if(norm(v)<.002)v=sub(ps.at(-1),ps[10]);return {vector:v,angle:Math.atan2(v.y,v.x)*180/Math.PI};}

// One shared, similarity-aligned frame retains both the child's actual ink and
// the reference quantities. A component is never independently stretched to fit.
export function detailContext(match,expected){
 const reference=normalizedLines(expected),drawn=match.matches?.map(m=>m?resample(m.points,17).map(p=>{const q=match.toReference(p);return {x:q.x/100,y:q.y/100};}):null);
 return {reference,drawn};
}
function rawFocus(ctx,roles,anchors){
 const ms=roles.map(ctx.get).filter(Boolean);return focus(ms.map(m=>m.points),ms.flatMap(m=>m.indices),anchors||[]);
}
function refIndex(ctx,role){return ctx.instance.roles[role]?.stroke-1;}
export function evaluateDetail(ctx){
 const {rule,level,match,details}=ctx,roles=rule.roles,ms=roles.map(ctx.get);
 if(!match.available||!details?.reference)return {status:'unavailable',confidence:'none',reasonCode:'detail-frame-unavailable'};
 if(ms.some(m=>!m?.stable))return {status:'uncertain',confidence:'low',reasonCode:'detail-stroke-correspondence',focus:rawFocus(ctx,roles),text:rule.strokeNumbers.join('・')+'画目の 線の対応を 特定できませんでした。赤い線と お手本を 比べよう。'};
 const refs=roles.map(r=>details.reference[refIndex(ctx,r)]),drawn=roles.map(r=>details.drawn[refIndex(ctx,r)]),f=()=>rawFocus(ctx,roles);
 if(refs.some(r=>!r)||drawn.some(r=>!r))return {status:'unavailable',confidence:'none',reasonCode:'detail-role-unavailable'};
 if(rule.kind==='detailComponent'){
  const child=rule.parameters.childCount,rb=bounds(refs.slice(0,child)),db=bounds(drawn.slice(0,child)),rp=bounds(refs),dp=bounds(drawn);
  if(!rb||!db||!rp||!dp||Math.min(rp.size,dp.size)<.002)return {status:'unavailable',confidence:'none',reasonCode:'component-frame-too-small'};
  const center=Math.hypot((db.cx-dp.cx)/dp.size-(rb.cx-rp.cx)/rp.size,(db.cy-dp.cy)/dp.size-(rb.cy-rp.cy)/rp.size),size=Math.abs(db.size/dp.size-rb.size/rp.size),maximum=at(level,'component');
  return {status:status(Math.max(center,size),maximum,.015),confidence:'medium',reasonCode:'component-placement',observed:{centerDifference:center,sizeDifference:size},expected:{maximum,unit:'parent-size-ratio'},focus:rawFocus(ctx,roles.slice(0,child)),text:rule.text};
 }
 const [ref,other]=refs,[line,lineB]=drawn,a=ms[0];
 if(rule.kind==='detailStart'||rule.kind==='detailEnd'){
  const end=rule.kind==='detailEnd',offset=dist(end?line.at(-1):line[0],end?ref.at(-1):ref[0]),maximum=at(level,'position'),point=end?a.points.at(-1):a.points[0];
  return {status:status(offset,maximum,.015),confidence:'medium',reasonCode:end?'stroke-end-position':'stroke-start-position',observed:{distance:offset},expected:{maximum,unit:'character-size-ratio'},focus:focus([],a.indices,[point]),text:rule.text};
 }
 if(rule.kind==='detailPath'){
  const distances=line.map((p,i)=>dist(p,ref[i])),maximum=at(level,'path'),worst=distances.indexOf(Math.max(...distances)),raw=resample(a.points,17);
  return {status:status(distances[worst],maximum,.015),confidence:'medium',reasonCode:'stroke-bend-path',observed:{distance:distances[worst],position:worst/16},expected:{maximum,unit:'character-size-ratio'},focus:focus([raw.slice(Math.max(0,worst-2),Math.min(17,worst+3))],a.indices,[raw[worst]]),text:rule.text};
 }
 if(rule.kind==='detailFinish'){
  const rf=finish(ref),af=finish(line);if(norm(rf.vector)<.002)return {status:'skipped',confidence:'none',reasonCode:'reference-ending-too-short'};
  const difference=circularDifference(af.angle,rf.angle),maximum=at(level,'finish');
  return {status:norm(af.vector)<.002?'uncertain':status(difference,maximum,4),confidence:'medium',reasonCode:'stroke-finish-direction',observed:{angle:af.angle,difference},expected:{angle:rf.angle,maximum,unit:'degrees'},focus:focus([resample(a.points,17).slice(12)],a.indices),text:rule.text};
 }
 if(rule.kind==='detailLength'){
  const referenceLength=length(ref),actualLength=length(line),difference=Math.abs(actualLength-referenceLength)/Math.max(referenceLength,actualLength,.005),maximum=at(level,'length');
  return {status:status(difference,maximum,.03),confidence:'medium',reasonCode:'relative-stroke-length',observed:{ratio:actualLength/referenceLength,difference},expected:{maximum,unit:'stroke-length-ratio'},focus:f(),text:rule.text};
 }
 if(rule.kind==='detailPair'){
  const reference=pairFeature(ref,other),actual=pairFeature(line,lineB),type=rule.parameters.relation,anchors=closestPair(resample(ms[0].points,17),resample(ms[1].points,17)),focusPair=()=>focus([],ms.flatMap(m=>m.indices),[anchors.a,anchors.b]);
  let measured,maximum,reason;
  if(type==='C'){
   // Small pen lifts at a crossing are tolerated. Large lost extensions or a
   // crossing displaced along the lines remain visible as a review candidate.
   measured=Math.max(actual.gap,Math.max(0,reference.depthA-actual.depthA),Math.max(0,reference.depthB-actual.depthB));maximum=at(level,'crossing');reason='crossing-and-extent';
  }else if(type==='T'){
   measured=Math.max(actual.gap,Math.max(0,Math.min(actual.depthA,actual.depthB)-Math.min(reference.depthA,reference.depthB)));maximum=at(level,'contact');reason='touch-and-overshoot';
  }else if(type==='S'){
   const lower=Math.max(0,reference.gap*.35-.015),upper=reference.gap+at(level,'separation'),tooClose=Math.max(0,lower-actual.gap),tooFar=Math.max(0,actual.gap-upper);
   return {status:tooClose>.008||tooFar>.015?'fail':tooClose>0||tooFar>0?'uncertain':'pass',confidence:'medium',reasonCode:'reference-separation',observed:{gap:actual.gap},expected:{minimum:lower,maximum:upper,unit:'character-size-ratio',referenceOnly:true},focus:focusPair(),text:rule.text};
  }else{
   measured=Math.abs(actual.gap-reference.gap);maximum=at(level,'contact');reason='overlap-reference';
  }
  return {status:status(measured,maximum,.012),confidence:'medium',reasonCode:reason,observed:{gap:actual.gap,depthA:actual.depthA,depthB:actual.depthB,difference:measured},expected:{relation:type,maximum,unit:'character-size-ratio',referenceOnly:true},focus:focusPair(),text:rule.text};
 }
 return {status:'unavailable',confidence:'none',reasonCode:'unknown-detail-check'};
}
