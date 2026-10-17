import catalog from '../data/shape-detail-reference.mjs';
export {catalog as detailCatalog};
export function detailRulesForCharacter(entry){
 const root=entry.components.find(c=>c.parentId===null),reference=catalog.characters[entry.char];
 if(!root||!reference||reference.strokes!==entry.strokeTypes.length||reference.svgSha256!==entry.svgSha256)return [];
 const rules=[],add=(suffix,kind,category,layer,numbers,label,text,parameters={})=>rules.push({id:entry.unicode+'.detail.'+suffix,version:1,instanceId:root.id,roles:numbers.map(n=>'line-'+n),strokeNumbers:numbers,kind,category,layer,label,text,parameters,review:{status:'reference-candidate'},coverageSource:'complete-geometry-inventory'});
 for(let n=1;n<=reference.strokes;n++){
  add('start-'+n,'detailStart','writingPosition','writing',[n],n+'画目の始まり',n+'画目の 書き始めの位置を、赤い所と お手本で 比べよう。');
  add('end-'+n,'detailEnd','writingPosition','writing',[n],n+'画目の終点',n+'画目の 線の終わる位置を、赤い所と お手本で 比べよう。');
  add('path-'+n,'detailPath','writingPath','writing',[n],n+'画目の曲がり・経路',n+'画目の 線の進み方・折れ曲がりを、赤い所で 比べよう。');
  add('finish-'+n,'detailFinish','writingFinish','writing',[n],n+'画目の終わりの向き',n+'画目の 最後に向かう方向を、赤い所と お手本で 比べよう。筆圧は確認していません。');
  add('length-'+n,'detailLength','beautyLength','beauty',[n],n+'画目の長さ',n+'画目の 長さのバランスを、お手本と 比べよう。');
 }
 let k=0;
 for(let a=1;a<=reference.strokes;a++)for(let b=a+1;b<=reference.strokes;b++){
  const relation=reference.relations[k++],name={C:'交差・突出',T:'接触・収まり',S:'離れ',O:'重なり'}[relation],category={C:'writingCrossing',T:'writingContact',S:'writingSeparation',O:'writingContact'}[relation];
  add('pair-'+a+'-'+b,'detailPair',category,'writing',[a,b],a+'・'+b+'画目の'+name+'（手本の特徴）',a+'・'+b+'画目の '+name+'を、赤い所と お手本で 比べよう。小さな違いは許容し、この形を必須とはしません。',{relation});
 }
 for(const part of entry.components){
  if(part.parentId===null)continue;const parent=entry.components.find(c=>c.id===part.parentId);if(!parent)continue;
  const numbers=[...part.strokes,...parent.strokes.filter(n=>!part.strokes.includes(n))];
  add('component-'+part.id,'detailComponent','beautyLayout','beauty',numbers,part.attributes.element+'の位置・大きさ',part.attributes.element+'の部分の 位置と大きさを、字全体との バランスで 比べよう。',{childCount:part.strokes.length,componentId:part.id,parentId:parent.id});
 }
 return rules;
}
