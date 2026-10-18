import {bounds,intersections,nearest,focus} from './geometry.mjs';

// Conservative whole-character targets. A geometric crossing alone does not
// establish that a character/component should be taught as left-right balanced.
export const BALANCED_CHARACTERS=Object.freeze(['十','土','士','王','干','工','中','申','田','由','甲','里','車','羊','半','平']);
export const CENTER_BALANCE_LIMITS=Object.freeze({center:{relaxed:.10,normal:.075,strict:.05},symmetry:{relaxed:.30,normal:.22,strict:.16}});
const axisX=54.5,frameSize=109;
const point=line=>({x:(line[0].x+line.at(-1).x)/2,y:(line[0].y+line.at(-1).y)/2});
function straight(line,vertical){
 const b=bounds([line]);if(!b)return false;
 const main=vertical?b.height:b.width,minor=vertical?b.width:b.height;
 return main>0&&minor/main<.12;
}
function joint(horizontal,vertical,scale){
 const hits=intersections(horizontal,vertical);if(hits.length)return hits[0];
 // A terminal pen lift near a crossbar is not a reason to lose beauty guidance.
 let best=null;for(const p of [vertical[0],vertical.at(-1)]){const q=nearest(p,horizontal);if(!best||q.distance<best.distance)best=q;}
 return best?.distance<=scale*.035?best.point:null;
}
export function balancedReference(char,reference){
 if(!BALANCED_CHARACTERS.includes(char))return null;
 const box=bounds(reference);if(!box||box.size<1e-6)return null;
 const stems=reference.flatMap((line,i)=>{const b=bounds([line]);return straight(line,true)&&b.height>box.size*.4&&Math.abs(point(line).x-box.cx)<box.size*.10?[{index:i,length:b.height}]:[];}).sort((a,b)=>b.length-a.length);
 const stem=stems[0]?.index;if(stem===undefined)return null;
 const horizontals=[];
 reference.forEach((line,i)=>{
  if(i===stem||!straight(line,false))return;
  const b=bounds([line]);if(b.width<box.size*.25)return;
  const cross=joint(line,reference[stem],box.size);if(!cross)return;
  const left=cross.x-b.x0,right=b.x1-cross.x;
  if(Math.min(left,right)>b.width*.15&&Math.abs(left-right)/b.width<=.12)horizontals.push(i);
 });
 return horizontals.length?{stem,horizontals}:null;
}
export function centerBalanceFeedback(char,strokes,reference,match,levels={}){
 if((levels.center??'off')==='off'&&(levels.symmetry??'off')==='off')return [];
 const target=balancedReference(char,reference);if(!target||!match?.available)return [];
 const stem=match.matches?.[target.stem];if(!stem?.stable)return [];
 const rows=[],stemNumber=target.stem+1,axis=point(stem.points).x;
 const add=(id,category,label,text,lines,indices,anchors,observed,expected)=>rows.push({id:'display.balance.'+id,kind:'centerBalance',layer:'beauty',category,status:'review',adviceOnly:true,childLabel:label,childText:text,focus:focus(lines,indices,anchors),observed,expected});
 const centerLevel=levels.center??'off';
 if(centerLevel!=='off'){
  const difference=axis-axisX,limit=(CENTER_BALANCE_LIMITS.center[centerLevel]??.075)*frameSize;
  if(Math.abs(difference)>limit)add('axis','beautyCenter',stemNumber+'かくめ：たての てんせん',stemNumber+'かくめの たての せんを、もうすこし '+(difference>0?'ひだり':'みぎ')+'に かこう。まんなかの たての てんせんに、そろえよう。',[stem.points],stem.indices,[point(stem.points)],{axis,gridCenter:axisX,difference},{maximum:limit,unit:'canvas-coordinate'});
 }
 const symmetryLevel=levels.symmetry??'off';
 if(symmetryLevel!=='off')for(const index of target.horizontals){
  const horizontal=match.matches?.[index];if(!horizontal?.stable)continue;
  const box=bounds([horizontal.points]);if(!box||box.width<1e-6)continue;
  const cross=joint(horizontal.points,stem.points,bounds(strokes).size);if(!cross)continue;
  const left=cross.x-box.x0,right=box.x1-cross.x;if(Math.min(left,right)<=0)continue;
  const difference=Math.abs(left-right)/box.width,maximum=CENTER_BALANCE_LIMITS.symmetry[symmetryLevel]??.22;
  if(difference<=maximum)continue;
  const short=left<right?'ひだり':'みぎ',long=left<right?'みぎ':'ひだり',number=index+1;
  const canExtend=short==='ひだり'?cross.x-Math.max(left,right)>=2:cross.x+Math.max(left,right)<=107;
  const action=canExtend?short+'を もうすこし ながく かこう。':long+'を もうすこし みじかく かこう。';
  add('arms-'+number,'beautySymmetry',number+'かくめ：みぎと ひだり',number+'かくめは、'+stemNumber+'かくめの たての せんから、みぎと ひだりを おなじ ながさに しよう。'+action,[horizontal.points,stem.points],[...horizontal.indices,...stem.indices],[cross],{left,right,difference},{maximum,unit:'crossbar-length-ratio'});
 }
 return rows.slice(0,3);
}
