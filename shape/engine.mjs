import {detailRulesForCharacter,detailCatalog} from './detail-rules.mjs';
import {detailContext} from './detail-geometry.mjs';
import {focus} from './geometry.mjs';
import {matchStrokes} from './matching.mjs';
import {evaluateRule} from './checks.mjs';
import {ENGINE_VERSION,effectivePolicy,snapshot,aggregate} from './policy.mjs';
import {hasHook} from './stroke-types.mjs';
let componentData=null,ruleData=null;const ruleCache=new Map();
export function configureShapeData(components,rules){
 if(components?.version!==1||rules?.version!==1)throw Error('Unsupported shape data');componentData=components;ruleData=rules;ruleCache.clear();
}
export function rulesForCharacter(char){
 if(ruleCache.has(char))return ruleCache.get(char);
 const entry=componentData?.characters?.[char];if(!entry)return [];
 // The complete pair inventory replaces the older near-line-only signatures.
 const rules=entry.rules.map(binding=>({...ruleData.templates[binding.templateId],...binding})).filter(rule=>rule.kind!=='topology');
 const root=entry.components.find(c=>c.parentId===null);
 if(root)entry.strokeTypes.forEach((type,i)=>{
  const role='line-'+(i+1);
  if(!hasHook(type)||rules.some(r=>r.kind==='hookGeometry'&&r.roles.some(name=>entry.components.find(c=>c.id===r.instanceId)?.roles[name]?.stroke===i+1)))return;
  rules.push({id:root.id+'.hookGeometry.ending-'+(i+1),version:2,instanceId:root.id,roles:[role],kind:'hookGeometry',layer:'writing',category:'writingHook',label:(i+1)+'画目のはね',text:(i+1)+'画目の 終わりの はねを、お手本と 比べよう。',review:{status:'synthetic-candidate'}});
 });
 // Reuse the same fine-detail rules for every matching component, including nested forms.
 if(root){
  const add=(kind,category,layer,strokes,label,text,parameters={})=>{
   const roles=strokes.map(n=>'line-'+n);
   if(!strokes.every(n=>root.roles['line-'+n])||rules.some(r=>r.kind===kind&&r.roles.length===roles.length&&r.roles.every((role,i)=>entry.components.find(c=>c.id===r.instanceId)?.roles[role]?.stroke===strokes[i])))return;
   rules.push({id:root.id+'.'+kind+'.'+roles.join('-'),version:1,instanceId:root.id,roles,kind,category,layer,label,text,parameters,review:{status:'synthetic-candidate'}});
  };
  for(const part of entry.components){
   const name=part.attributes.element,ns=part.strokes;
   if((name==='夫'&&ns.length===4)||(name==='失'&&ns.length===5)){
    const offset=name==='夫'?0:1,stem=ns[offset+2],upper=ns[offset];
    add('protrusion','identityExtent','identity',[stem,upper],name+'の縦線の突出',stem+'画目が '+upper+'画目より 上に出る長さを、お手本と 比べよう。',{side:'above'});
   }
  }
  const hs=Object.entries(root.roles).filter(([name])=>name.startsWith('horizontal-')).map(([,role])=>role.stroke);
  for(let i=1;i<hs.length;i++)add('parallel','beautyParallel','beauty',[hs[i-1],hs[i]],'横線の平行',hs[i-1]+'・'+hs[i]+'画目の 横線の向きを 比べよう。');
  entry.strokeTypes.forEach((type,i)=>{
   if(!String(type).split('/').some(t=>/^㇏/u.test(t)))return;
   const base=hs.filter(n=>n<i+1).at(-1);if(!base)return;
   add('sweepGeometry','writingSweep','writing',[i+1,base],(i+1)+'画目の右払い',(i+1)+'画目の 右はらいの 終わりの向きを、お手本と 比べよう。');
  });
 }
 rules.push(...detailRulesForCharacter(entry));
 const configured=rules.map(rule=>({...rule,strokeNumbers:rule.roles.map(role=>entry.components.find(c=>c.id===rule.instanceId)?.roles[role]?.stroke).filter(Boolean)}));ruleCache.set(char,configured);return configured;
}
export function evaluateCharacter(char,strokes,expected,settings,options={}){
 const entry=componentData?.characters?.[char],rules=rulesForCharacter(char),mode=options.mode==='evaluation'?'evaluation':'normal';
 if(!entry)return {status:'unavailable',checks:[],writingChecks:[],beautyChecks:[],results:[],reasonCode:'character-data-unavailable'};
 const match=expected?.length===entry.strokeTypes.length?matchStrokes(strokes,expected):{available:false,reason:'reference-count-mismatch'},instances=new Map(entry.components.map(c=>[c.id,c]));
 const policySnapshot=snapshot(char,settings,options.overrides||{},rules,mode);
 const details=match.available&&rules.some(rule=>rule.kind.startsWith('detail')&&effectivePolicy(char,rule,settings,options.overrides||{}).level!=='off')?detailContext(match,expected):null;
 const results=rules.map(rule=>{
  const policy=effectivePolicy(char,rule,settings,options.overrides||{}),instance=instances.get(rule.instanceId);
  const result={adviceOnly:rule.review.status==='reference-candidate'||['contact','separation','topology'].includes(rule.kind),id:rule.id,ruleId:rule.id,ruleVersion:rule.version,layer:rule.layer,category:rule.category,kind:rule.kind,label:rule.label,text:rule.text,instanceId:rule.instanceId,referenceStrokeNumbers:rule.roles.map(r=>instance.roles[r]?.stroke).filter(Boolean),effectiveLevel:policy.level,settingSource:policy.from,reviewStatus:rule.review.status};
  if(policy.level==='off')return {...result,status:'skipped',confidence:'none',reasonCode:'setting-off'};
  const get=role=>{const ref=instance.roles[role];return ref?match.matches?.[ref.stroke-1]:null;};
  const ctx={rule,instance,level:policy.level,match,get,expected,details,getBoxContext:()=>({rule:{kind:'internalBars'},match,instance,get,expected})};
  const measured=evaluateRule(ctx),pending=rule.layer==='identity'&&rule.review.status!=='approved';
  // Candidate measurements are visible, but cannot automatically reject a child.
  const gated=pending&&mode==='normal'&&measured.status==='fail'?{...measured,status:'uncertain',candidateStatus:'fail',reasonCode:'pending-review:'+measured.reasonCode}:measured;
  const locatedFocus=gated.focus||(['fail','uncertain'].includes(gated.status)?focus(rule.roles.map(get).filter(Boolean).map(m=>m.points),rule.roles.map(get).filter(Boolean).flatMap(m=>m.indices)):null);
  if(gated.status==='uncertain'&&!locatedFocus)gated.text=rule.label+'の 場所を特定できませんでした。字全体を お手本と 比べよう。';
  return {...result,...gated,focus:locatedFocus,actualStrokeIds:(locatedFocus?.actualIndices||[]).map(i=>'stroke-'+(i+1))};
 });
 // A located internal-bar issue supersedes the generic missing-stroke message.
 const located=results.filter(r=>r.kind==='internalBars'&&['fail','uncertain'].includes(r.status)&&r.observed?.count!==r.expected?.count);
 const actionable=r=>r.status!=='skipped'&&r.status!=='unavailable';
 let checks=results.filter(r=>r.layer==='identity'&&actionable(r));if(located.length)checks=checks.filter(r=>r.kind!=='strokePresence'&&!(r.kind==='topology'&&r.status==='uncertain'&&!r.focus));
 const writingChecks=results.filter(r=>r.layer==='writing'&&actionable(r));
 const beautyChecks=results.filter(r=>r.layer==='beauty'&&actionable(r)).map(r=>({...r,advice:true,status:r.status==='fail'?'review':r.status}));
 const layers={identity:aggregate(results,'identity'),writing:aggregate(results,'writing'),beauty:aggregate(results,'beauty')},status=layers.identity==='fail'?'fail':layers.identity==='uncertain'?'uncertain':layers.identity==='pass'?'pass':layers.identity;
 const inventoryComplete=rules.filter(r=>r.kind.startsWith('detail')).length===entry.strokeTypes.length*5+entry.strokeTypes.length*(entry.strokeTypes.length-1)/2+entry.components.length-1;
 const issues=checks.filter(r=>['fail','uncertain'].includes(r.status));const issue=issues.find(r=>r.status==='fail'&&r.focus)||issues.find(r=>r.focus)||issues[0];
 return {status,layers,checks,writingChecks,beautyChecks,results,focus:issue?.focus,ruleId:issue?.id,kind:issue?.kind,text:issue?.text,engineVersion:ENGINE_VERSION,ruleSetVersion:componentData.ruleSetVersion+'+details-1',policySnapshot,coverage:{inventory:detailCatalog.characters[char]?{strokes:entry.strokeTypes.length,pairs:entry.strokeTypes.length*(entry.strokeTypes.length-1)/2,components:entry.components.length,complete:inventoryComplete}:null,humanReview:entry.review.human,realHandwriting:entry.review.realHandwriting,incompleteReasons:entry.incompleteReasons.filter(reason=>!inventoryComplete||reason!=='not-all-character-specific-details-covered')}};
}
