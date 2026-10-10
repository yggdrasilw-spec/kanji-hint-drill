import {resample} from '../core.mjs';
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
export const dot=(a,b)=>a.x*b.x+a.y*b.y;
export const cross=(a,b)=>a.x*b.y-a.y*b.x;
export const norm=a=>Math.hypot(a.x,a.y);
export const dist=(a,b)=>norm(sub(a,b));
export function bounds(strokes){
 const ps=strokes.flat();if(!ps.length||ps.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||Math.abs(p.x)>1e6||Math.abs(p.y)>1e6))return null;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const p of ps){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
 return {x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2,width:x1-x0,height:y1-y0,size:Math.max(x1-x0,y1-y0)};
}
export function nearest(p,line){
 let point=line[0],distance=Infinity;
 for(let i=1;i<line.length;i++){const a=line[i-1],v=sub(line[i],a),t=Math.max(0,Math.min(1,dot(sub(p,a),v)/(dot(v,v)||1))),q={x:a.x+t*v.x,y:a.y+t*v.y},d=dist(p,q);if(d<distance){point=q;distance=d;}}
 return {point,distance};
}
export function intersections(a,b){
 const out=[];for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
  const r=sub(a[i],a[i-1]),s=sub(b[j],b[j-1]),den=cross(r,s);if(Math.abs(den)<1e-8)continue;
  const q=sub(b[j-1],a[i-1]),t=cross(q,s)/den,u=cross(q,r)/den;
  if(t>=0&&t<=1&&u>=0&&u<=1)out.push({x:a[i-1].x+t*r.x,y:a[i-1].y+t*r.y});
 }return out;
}
export function lineDistance(a,b){return intersections(a,b).length?0:Math.min(...a.map(p=>nearest(p,b).distance),...b.map(p=>nearest(p,a).distance));}
export function samples(line,from=0,to=1,n=32){const ps=resample(line,101);return resample(ps.slice(Math.floor(from*100),Math.ceil(to*100)+1),n);}
// The longest stable run projected along an axis separates a hook from its stem.
export function mainRun(line,axis='horizontal'){
 const ps=resample(line,65),horizontal=axis==='horizontal';let best=null,start=0;
 const accept=(a,b)=>{const v=sub(b,a);return horizontal?Math.abs(v.x)>Math.abs(v.y)*1.6:Math.abs(v.y)>Math.abs(v.x)*1.6;};
 for(let i=1;i<=ps.length;i++)if(i===ps.length||!accept(ps[i-1],ps[i])){
  if(i-1>start){const run=ps.slice(start,i),b=bounds([run]),length=horizontal?b.width:b.height;if(!best||length>best.length)best={points:run,length};}start=i;
 }
 return best;
}
export function frame(horizontal){
 const run=mainRun(horizontal);if(!run||run.length<1e-6)return null;
 let v=sub(run.points.at(-1),run.points[0]);if(v.x<0)v={x:-v.x,y:-v.y};const l=norm(v);if(!l)return null;
 return {x:{x:v.x/l,y:v.y/l},y:{x:-v.y/l,y:v.x/l},origin:run.points[0],length:l};
}
export const local=(p,f)=>({x:dot(sub(p,f.origin),f.x),y:dot(sub(p,f.origin),f.y)});
export const world=(p,f)=>({x:f.origin.x+p.x*f.x.x+p.y*f.y.x,y:f.origin.y+p.x*f.x.y+p.y*f.y.y});
export function projectedLength(line,axis){const run=mainRun(line,axis);return run?.length||0;}
export function focus(lines,actualIndices=[],anchors=[],polygon=null,kind='line-group'){
 const ps=[...lines.flat(),...anchors,...(polygon||[]).map(([x,y])=>({x,y}))],b=bounds([ps]);if(!b)return null;
 const point={x:b.cx,y:b.cy};return {kind,coordinateSpace:'answer',actualIndices:[...new Set(actualIndices)],strokeIds:[...new Set(actualIndices)].map(i=>'stroke-'+(i+1)),anchors,region:polygon?{polygon}:undefined,point,radius:Math.max(5,...ps.map(p=>dist(p,point)+5)),tip:anchors[0],acrossPoint:anchors[1]};
}
export function angle(a,b){return Math.atan2(cross(a,b),dot(a,b))*180/Math.PI;}
export function boxAtY(line,y){
 const xs=[];for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if((y-a.y)*(y-b.y)<=0&&Math.abs(b.y-a.y)>1e-8)xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));}return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
}
