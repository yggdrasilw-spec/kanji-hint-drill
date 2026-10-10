import {matchStrokes} from './matching.mjs';
import {evaluateRule} from './checks.mjs';
import {ENGINE_VERSION,effectivePolicy,snapshot,aggregate} from './policy.mjs';
let componentData=null,ruleData=null;
export function configureShapeData(components,rules){
 if(components?.version!==1||rules?.version!==1)throw Error('Unsupported shape data');componentData=components;ruleData=rules;
}
export function rulesForCharacter(char){
 const entry=componentData?.characters?.[char];if(!entry)return [];
 return entry.rules.map(binding=>({...ruleData.templates[binding.templateId],...binding}));
}
export function evaluateCharacter(char,strokes,expected,settings,options={}){
 const entry=componentData?.characters?.[char],rules=rulesForCharacter(char),mode=options.mode==='evaluation'?'evaluation':'normal';
 if(!entry)return {status:'unavailable',checks:[],writingChecks:[],beautyChecks:[],results:[],reasonCode:'character-data-unavailable'};
 const match=expected?.length===entry.strokeTypes.length?matchStrokes(strokes,expected):{available:false,reason:'reference-count-mismatch'},instances=new Map(entry.components.map(c=>[c.id,c]));
 const policySnapshot=snapshot(char,settings,options.overrides||{},rules,mode);
 const results=rules.map(rule=>{
  const policy=effectivePolicy(char,rule,settings,options.overrides||{}),instance=instances.get(rule.instanceId);
  const result={id:rule.id,ruleId:rule.id,ruleVersion:rule.version,layer:rule.layer,kind:rule.kind,label:rule.label,text:rule.text,instanceId:rule.instanceId,referenceStrokeNumbers:rule.roles.map(r=>instance.roles[r]?.stroke).filter(Boolean),effectiveLevel:policy.level,settingSource:policy.from,reviewStatus:rule.review.status};
  if(policy.level==='off')return {...result,status:'skipped',confidence:'none',reasonCode:'setting-off'};
  const get=role=>{const ref=instance.roles[role];return ref?match.matches?.[ref.stroke-1]:null;};
  const ctx={rule,instance,level:policy.level,match,get,expected,getBoxContext:()=>({rule:{kind:'internalBars'},match,instance,get,expected})};
  const measured=evaluateRule(ctx),pending=rule.layer==='identity'&&rule.review.status!=='approved';
  // Candidate measurements are visible, but cannot automatically reject a child.
  const gated=pending&&mode==='normal'&&measured.status==='fail'?{...measured,status:'uncertain',candidateStatus:'fail',reasonCode:'pending-review:'+measured.reasonCode}:measured;
  return {...result,...gated,actualStrokeIds:(gated.focus?.actualIndices||[]).map(i=>'stroke-'+(i+1))};
 });
 // A located internal-bar issue supersedes the generic missing-stroke message.
 const located=results.filter(r=>r.kind==='internalBars'&&['fail','uncertain'].includes(r.status)&&r.observed?.count!==r.expected?.count);
 const actionable=r=>r.status!=='skipped'&&r.status!=='unavailable';
 let checks=results.filter(r=>r.layer==='identity'&&actionable(r));if(located.length)checks=checks.filter(r=>r.kind!=='strokePresence'&&!(r.kind==='topology'&&r.status==='uncertain'&&!r.focus));
 const writingChecks=results.filter(r=>r.layer==='writing'&&actionable(r));
 const beautyChecks=results.filter(r=>r.layer==='beauty'&&actionable(r)).map(r=>({...r,advice:true,status:r.status==='fail'?'review':r.status}));
 const layers={identity:aggregate(results,'identity'),writing:aggregate(results,'writing'),beauty:aggregate(results,'beauty')},status=layers.identity==='fail'?'fail':layers.identity==='uncertain'?'uncertain':layers.identity==='pass'?'pass':layers.identity;
 const issues=checks.filter(r=>['fail','uncertain'].includes(r.status));const issue=issues.find(r=>r.status==='fail'&&r.focus)||issues.find(r=>r.focus)||issues[0];
 return {status,layers,checks,writingChecks,beautyChecks,results,focus:issue?.focus,ruleId:issue?.id,kind:issue?.kind,text:issue?.text,engineVersion:ENGINE_VERSION,ruleSetVersion:componentData.ruleSetVersion,policySnapshot,coverage:{humanReview:entry.review.human,realHandwriting:entry.review.realHandwriting,incompleteReasons:entry.incompleteReasons}};
}
