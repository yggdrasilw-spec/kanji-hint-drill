import {resample} from '../core.mjs';
import {bounds,dist,sub,dot,cross} from './geometry.mjs';
export function assignment(cost){
 const n=cost.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 for(let i=1;i<=n;i++){p[0]=i;let j0=0;const min=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
  do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=n;j++)if(!used[j]){const c=cost[i0-1][j-1]-u[i0]-v[j];if(c<min[j]){min[j]=c;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;j0=j1;}while(p[j0]);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
 }const out=Array(n);for(let j=1;j<=n;j++)out[j-1]=p[j]-1;return out;
}
const error=(a,b)=>a.reduce((sum,p,i)=>sum+dist(p,b[i]),0)/a.length;
const costOf=(a,b)=>Math.min(error(a,b),error([...a].reverse(),b));
function join(a,b){let best=null;for(const x of [a,[...a].reverse()])for(const y of [b,[...b].reverse()]){const gap=dist(x.at(-1),y[0]);if(!best||gap<best.gap)best={gap,points:[...x,...y]};}return best;}
export function matchStrokes(strokes,expected){
 const invalid=!Array.isArray(strokes)||!Array.isArray(expected)||!strokes.length||strokes.length>96||expected.length>40||strokes.some(s=>!Array.isArray(s)||s.length<2||s.length>4096)||expected.some(s=>!Array.isArray(s)||s.length<2||s.length>4096);
 if(invalid)return {available:false,reason:'input-limit-or-empty'};
 const b=bounds(strokes),r=bounds(expected);if(!b||!r||b.size<1e-6||r.size<1e-6)return {available:false,reason:'invalid-coordinates'};
 const refs=expected.map(s=>resample(s,32).map(p=>({x:(p.x-r.cx)/r.size*100,y:(p.y-r.cy)/r.size*100})));
 let transform=p=>({x:(p.x-b.cx)/b.size*100,y:(p.y-b.cy)/b.size*100});
 let virtual=strokes.map((points,i)=>({points,indices:[i]}));
 // Retracing is one visual line, but its original strokes remain in count/order analysis.
 const duplicates=[];for(let i=0;i<virtual.length;i++)for(let j=i+1;j<virtual.length;j++)if(costOf(resample(virtual[i].points,32).map(transform),resample(virtual[j].points,32).map(transform))<1.3){virtual[i].indices.push(...virtual[j].indices);duplicates.push(...virtual[j].indices);virtual.splice(j--,1);}
 // Only join fragments when the joined geometry clearly improves a reference match.
 for(let step=0;step<12;step++){
  let best=null;for(let i=0;i<virtual.length;i++)for(let j=i+1;j<virtual.length;j++){
   const joined=join(virtual[i].points,virtual[j].points);if(joined.gap>b.size*.07)continue;
   const a=resample(virtual[i].points,32).map(transform),c=resample(virtual[j].points,32).map(transform),q=resample(joined.points,32).map(transform);
   if(Math.min(...refs.map(r=>costOf(a,r)))<3||Math.min(...refs.map(r=>costOf(c,r)))<3)continue;
   for(let k=0;k<refs.length;k++){const e=costOf(q,refs[k]),old=Math.min(costOf(a,refs[k]),costOf(c,refs[k]));if(e<7&&old>e+4&&(!best||old-e>best.gain))best={i,j,points:joined.points,gain:old-e};}
  }if(!best)break;virtual[best.i]={points:best.points,indices:[...virtual[best.i].indices,...virtual[best.j].indices]};virtual.splice(best.j,1);
 }
 let costs,map;
 function solve(){const ns=virtual.map(v=>resample(v.points,32).map(transform));costs=ns.map(a=>refs.map(b=>costOf(a,b)));const n=virtual.length+refs.length;
  const square=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i<virtual.length?(j<refs.length?costs[i][j]:12):(j<refs.length?12:0)));const a=assignment(square);map=refs.map((_,j)=>a[j]<virtual.length&&costs[a[j]][j]<24?a[j]:null);
 }
 solve();
 // Fit one uniform scale and a limited rotation using stable matches. This cannot
 // stretch a component independently or turn a reflected glyph into the answer.
 for(let iteration=0;iteration<2;iteration++){
  const pairs=map.flatMap((i,j)=>i!==null&&costs[i][j]<20?resample(virtual[i].points,9).map((p,k)=>({p,q:resample(expected[j],9)[costOf(resample(virtual[i].points,32).map(transform),refs[j])===error(resample(virtual[i].points,32).map(transform),refs[j])?k:8-k]})):[]);
  if(pairs.length<18)break;const center=key=>({x:pairs.reduce((s,v)=>s+v[key].x,0)/pairs.length,y:pairs.reduce((s,v)=>s+v[key].y,0)/pairs.length}),cp=center('p'),cq=center('q');let aa=0,bb=0,den=0;
  for(const {p,q} of pairs){const x=sub(p,cp),y=sub(q,cq);aa+=dot(x,y);bb+=cross(x,y);den+=dot(x,x);}if(den<1e-6)break;
  const theta=Math.atan2(bb,aa);if(Math.abs(theta)>12*Math.PI/180)break;const scale=Math.hypot(aa,bb)/den,co=Math.cos(theta),si=Math.sin(theta);
  transform=p=>{const x=sub(p,cp),q={x:cq.x+scale*(co*x.x-si*x.y),y:cq.y+scale*(si*x.x+co*x.y)};return {x:(q.x-r.cx)/r.size*100,y:(q.y-r.cy)/r.size*100};};solve();
 }
 const matches=map.map((i,j)=>{if(i===null)return null;const v=virtual[i],ns=resample(v.points,32).map(transform),forward=error(ns,refs[j])<=error([...ns].reverse(),refs[j]);const alternatives=costs.map((row,k)=>k===i?Infinity:row[j]);return {points:forward?v.points:[...v.points].reverse(),rawPoints:v.points,indices:v.indices,error:costs[i][j],stable:costs[i][j]<20&&Math.min(...alternatives)>costs[i][j]+1.2};});
 const used=new Set(map.filter(i=>i!==null));const extras=virtual.filter((_,i)=>!used.has(i));const present=matches.filter(Boolean),mean=present.reduce((s,m)=>s+m.error,0)/(present.length||1);
 return {available:present.length>=Math.min(2,expected.length)&&mean<16,reason:'unstable-correspondence',matches,extras,missing:matches.flatMap((m,j)=>m?[]:[j]),duplicates,virtual,scale:b.size,mean};
}
