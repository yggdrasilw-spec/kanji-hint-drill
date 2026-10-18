import {bounds,nearest,focus} from './geometry.mjs';

// Presentation only: never change a measured status, policy or mastery record.
export const CHILD_FEEDBACK_VERSION='grade-one-1';
const ordinal=n=>n+'かくめ';
const movement=(dx,dy)=>Math.abs(dx)>=Math.abs(dy)?dx>0?'みぎ':'ひだり':dy>0?'した':'うえ';
export function childFeedback(row,ctx={}){
 const numbers=row.referenceStrokeNumbers||row.strokeNumbers||[],[a,b]=numbers;
 const one=a?ordinal(a):'いろの ついた せん',two=b?ordinal(b):'もう ひとつの せん';
 const pair=one+'と '+two,tag=numbers.length>1?numbers.slice(0,2).join('・')+'かくめ':one;
 const o=row.observed||{},e=row.expected||{},p=ctx.rule?.parameters||{};
 const make=(text,label)=>({childText:text,childLabel:tag+'：'+label});
 if(/unstable|ambiguous|correspondence|role-missing/.test(row.reasonCode||'')||row.confidence==='low')return make('どの せんか、うまく わからなかったよ。おてほんと、いっしょに たしかめよう。','たしかめよう');
 switch(row.kind){
 case 'strokePresence':return make(o.missing?.length?o.missing.map(ordinal).join('と ')+'の せんを かこう。おてほんを みてね。':'かいた せんが おおいみたい。おてほんの せんを、1ぽんずつ かぞえよう。','せんの かず');
 case 'internalBars':return make('いろの ついた ところの なかは、よこの せんが '+e.count+'ほんだよ。'+(o.count<e.count?'あと '+(e.count-o.count)+'ほん かこう。':o.count>e.count?'いまは '+o.count+'ほん あるよ。おてほんを みよう。':'せんを かく ばしょを、たしかめよう。'),'なかの せん');
 case 'detailPair':{
  const relation=e.relation||p.relation;
  if(relation==='C')return make(o.crossed?(row.status==='pass'?pair+'は、つきぬけて かけたね。':pair+'は、つきぬけているよ。'+(o.depthA<=o.depthB?one:two)+'の せんの さきを、もうすこし ながく しよう。'):pair+'は、つきぬけるように かこう。まるの なかを みてね。','つきぬける');
  if(relation==='T'){
   let stop=one,base=two;
   const refs=numbers.map(n=>ctx.details?.reference?.[n-1]);
   if(refs.every(Boolean)){
    // Which line ends at the joint is a property of the reference, not the child's order.
    const near=(line,other)=>Math.min(...[line[0],line.at(-1)].map(pt=>nearest(pt,other).distance));
    if(near(refs[1],refs[0])<near(refs[0],refs[1]))[stop,base]=[two,one];
   }
   return make(stop+'は、'+base+'に くっつけて とめよう。つきぬけないでね。','くっつける');
  }
  if(relation==='S')return make(o.gap>e.maximum?pair+'を、すこし ちかづけよう。くっつけずに、すきまを あけてね。':pair+'は、はなそう。くっつけないでね。','はなす');
  return make(pair+'は、おなじ ところに かさねよう。おてほんを みてね。','かさねる');
 }
 case 'contact':return make(pair+'は、くっつけよう。まるの なかの せんの はしを みてね。','くっつける');
 case 'separation':return make(pair+'は、はなそう。くっつけないでね。','はなす');
 case 'crossing':return make(pair+'は、つきぬけるように かこう。','つきぬける');
 case 'protrusion':return make(one+'は、'+two+'を つきぬけて、'+(p.side==='below'?'した':'うえ')+'に もうすこし ながく だそう。','さきを のばす');
 case 'boundedEndpoint':return make(one+'は、'+two+'より '+(p.side==='below'?'した':'うえ')+'に ださないでね。くっつけた ところで とめよう。','ここで とめる');
 case 'hookGeometry':return make(one+'の おわりは、きちんと はねよう。おてほんの はねる むきも みてね。','はねる');
 case 'sweepGeometry':return make(one+'の おわりは、おてほんと おなじ むきに はらおう。','はらう');
 case 'risingStroke':return make(one+'の おわりは、みぎうえに はらおう。','みぎうえへ');
 case 'compactEnding':return make(one+'の おわりを、もうすこし みじかく しよう。','みじかく');
 case 'componentAspect':return make(o.aspect>e.maximum?'いろの ついた ところを、もうすこし ほそながく かくと、きれいだよ。':'いろの ついた ところは、よこの はばを もうすこし ひろく すると、きれいだよ。','ほそさ・ひろさ');
 case 'spacing':return make('いろの ついた ところの よこの せんは、すきまを おなじ くらいに あけよう。','すきまを そろえる');
 case 'parallel':return make(pair+'の よこの せんは、おなじ むきに そろえよう。','むきを そろえる');
 case 'upwardSlope':return make(one+'は、みぎの はしを '+(o.angle>e.maximum?'もうすこし さげよう。':'すこし あげよう。'),'よこの せん');
 case 'lengthOrder':case 'lengthIdentity':case 'lengthRatio':return make(row.kind==='lengthRatio'&&o.ratio<(p.minimum??.25)?two+'を、もうすこし ながく かこう。':one+'は '+two+'より、ながく かこう。','ながさ');
 case 'detailLength':return make(one+'は、もうすこし '+(o.ratio<1?'ながく':'みじかく')+' かくと、きれいだよ。','ながさ');
 case 'detailStart':case 'detailEnd':{
  const n=a-1,line=ctx.details?.drawn?.[n],ref=ctx.details?.reference?.[n],last=row.kind==='detailEnd';
  const target=last?ref?.at(-1):ref?.[0],actual=last?line?.at(-1):line?.[0];
  const direction=target&&actual?movement(target.x-actual.x,target.y-actual.y):null;
  return make(one+'の '+(last?'おわる':'かきはじめる')+' ところを、'+(direction?'もうすこし '+direction+'に しよう。':'おてほんと みくらべよう。'),'かき'+(last?'おわり':'はじめ'));
 }
 case 'detailFinish':return make(one+'の さいごは、おてほんと おなじ むきに かこう。','さいごの むき');
 case 'detailPath':return make(one+'の まるの ところは、おてほんの せんに そって かこう。まがる ところも みてね。','せんの かたち');
 case 'detailComponent':{
  const child=numbers.slice(0,p.childCount),refs=child.map(n=>ctx.details?.reference?.[n-1]).filter(Boolean),drawn=child.map(n=>ctx.details?.drawn?.[n-1]).filter(Boolean);
  const rb=bounds(refs),db=bounds(drawn),rp=bounds(numbers.map(n=>ctx.details?.reference?.[n-1]).filter(Boolean)),dp=bounds(numbers.map(n=>ctx.details?.drawn?.[n-1]).filter(Boolean));
  if(rb&&db&&o.sizeDifference>o.centerDifference)return make('いろの ついた ところを、もうすこし '+(db.size/dp.size<rb.size/rp.size?'おおきく':'ちいさく')+' かこう。てんせんも みてね。','おおきさ');
  return make('いろの ついた ところを、'+(rb&&db?'もうすこし '+movement((rb.cx-rp.cx)/rp.size-(db.cx-dp.cx)/dp.size,(rb.cy-rp.cy)/rp.size-(db.cy-dp.cy)/dp.size)+'に かこう。':'おてほんと みくらべよう。')+'てんせんを みて、みぎと ひだりの ばしょを そろえよう。','かく ばしょ');
 }
 default:return make('いろの ついた ところを、おてほんと みくらべよう。','たしかめよう');
 }
}

// Optional whole-letter beauty hints use the original 109x109 practice frame.
// They are presentation hints: excluded from identity/writing aggregation.
export function wholeCanvasFeedback(strokes,reference,level='off'){
 if(level==='off')return [];
 const b=bounds(strokes),r=bounds(reference);if(!b||!r||Math.min(b.size,r.size)<1e-6)return [];
 const rows=[],t={relaxed:.4,normal:.3,strict:.2}[level]??.3;
 const add=(id,label,text)=>rows.push({id:'display.whole.'+id,kind:'canvasBeauty',layer:'beauty',category:'beautyLayout',status:'review',adviceOnly:true,childLabel:'じ ぜんたい：'+label,childText:text,focus:focus(strokes,strokes.map((_,i)=>i))});
 const scale=b.size/r.size;
 if(scale<1-t)add('size','おおきさ','じの ぜんたいを、もうすこし おおきく かくと、きれいだよ。てんせんも みてね。');
 else if(scale>1+t||b.x0<2||b.y0<2||b.x1>107||b.y1>107)add('size','おおきさ','じの ぜんたいを、もうすこし ちいさく しよう。ますから はみださないように かこう。');
 if(Math.min(r.width,r.height)/r.size>.2){
  const ratio=(b.width/b.height)/(r.width/r.height);
  if(ratio>1+t)add('aspect','ほそさ','じの ぜんたいを、もうすこし ほそながく かくと、きれいだよ。');
  else if(ratio<1/(1+t))add('aspect','よこの はば','じの ぜんたいは、よこの はばを もうすこし ひろく すると、きれいだよ。');
 }
 if(Math.abs(b.cx-r.cx)>r.size*t*.5||Math.abs(b.cy-r.cy)>r.size*t*.5)add('center','まんなか','じの ぜんたいを、もうすこし '+movement(r.cx-b.cx,r.cy-b.cy)+'に かこう。てんせんを みて、ますの まんなかに そろえよう。');
 return rows.slice(0,2);
}
