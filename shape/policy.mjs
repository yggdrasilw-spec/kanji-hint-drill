export const ENGINE_VERSION='component-engine-1';
export const LEVELS=['off','relaxed','normal','strict'];
export const EXTRA_DEFAULTS=Object.freeze({structure:'normal',internalBars:'normal',identityLength:'normal',identityExtent:'normal',compactEnding:'off',writingHook:'off',writingSweep:'off',writingRise:'off',writingBounds:'off',writingContact:'off',beautyLength:'off',beautyAspect:'off',beautySpacing:'off'});
export function sanitizeOverrides(value){
 const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;
 for(const [char,entry] of Object.entries(value).slice(0,1026)){
  if([...char].length!==1||!entry||typeof entry!=='object')continue;
  const clean=part=>Object.fromEntries(Object.entries(part||{}).slice(0,128).filter(([k,v])=>k.length<180&&LEVELS.includes(v)&&!['__proto__','constructor','prototype'].includes(k)));
  out[char]={categories:clean(entry.categories),rules:clean(entry.rules)};
 }return out;
}
export function effectivePolicy(char,rule,settings,overrides={}){
 const global=settings[rule.category]??'off';if(global==='off')return {level:'off',from:'global'};
 const own=overrides[char];if(own?.rules?.[rule.id])return {level:own.rules[rule.id],from:'character-rule'};
 if(own?.categories?.[rule.category])return {level:own.categories[rule.category],from:'character-category'};
 return {level:global,from:'global'};
}
export function snapshot(char,settings,overrides,rules,mode='normal'){
 return {char,mode,settings:{...settings},rules:Object.fromEntries(rules.map(r=>[r.id,effectivePolicy(char,r,settings,overrides)]))};
}
export function aggregate(results,layer){
 const rows=results.filter(r=>r.layer===layer&&r.status!=='skipped');
 if(!rows.length)return 'skipped';
 if(rows.some(r=>r.status==='fail'))return 'fail';
 if(rows.some(r=>r.status==='uncertain'))return 'uncertain';
 if(rows.every(r=>r.status==='unavailable'))return 'unavailable';return 'pass';
}
// Bounded, data-only import. Unknown rule IDs are inert history, never executable settings.
export function savedShape(outcome){
 if(!outcome||typeof outcome!=='object')return {};
 const str=(v,n=180)=>typeof v==='string'?v.slice(0,n):'';
 const result={};if(typeof outcome.engineVersion!=='string')return result;
 result.engineVersion=str(outcome.engineVersion,60);result.ruleSetVersion=str(outcome.ruleSetVersion,60);
 result.shapeResults=(Array.isArray(outcome.shapeResults)?outcome.shapeResults:[]).slice(0,128).filter(r=>r&&typeof r==='object').map(r=>({ruleId:str(r.ruleId),ruleVersion:Number.isInteger(r.ruleVersion)?Math.max(1,Math.min(10000,r.ruleVersion)):1,layer:['identity','writing','beauty'].includes(r.layer)?r.layer:'identity',status:['pass','fail','uncertain','skipped','unavailable'].includes(r.status)?r.status:'unavailable',reasonCode:str(r.reasonCode,100)}));
 const p=outcome.policySnapshot;if(p&&typeof p==='object'){
  const settings=Object.fromEntries(Object.entries(p.settings||{}).slice(0,40).filter(([k,v])=>k.length<60&&LEVELS.includes(v)));
  const rules=Object.fromEntries(Object.entries(p.rules||{}).slice(0,128).filter(([k,v])=>k.length<180&&v&&LEVELS.includes(v.level)).map(([k,v])=>[k,{level:v.level,from:['global','character-rule','character-category'].includes(v.from)?v.from:'global'}]));
  result.policySnapshot={char:str(p.char,2),mode:p.mode==='evaluation'?'evaluation':'normal',settings,rules};
 }return result;
}
