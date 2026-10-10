import {CHECK_LEVELS,DEFAULT_SHAPE_SETTINGS,CHARACTER_RULES,normalizeShapeSettings as normalizeLegacy,checkCharacterShape as legacyCheck,protrusionFocus} from './shape/legacy-iron.mjs';
import {EXTRA_DEFAULTS,sanitizeOverrides,effectivePolicy} from './shape/policy.mjs';
import {configureShapeData,evaluateCharacter,rulesForCharacter as componentRulesForCharacter} from './shape/engine.mjs';
import {matchStrokes} from './shape/matching.mjs';
import {analyzeStrokes} from './core.mjs';
export {CHECK_LEVELS,DEFAULT_SHAPE_SETTINGS,CHARACTER_RULES,protrusionFocus,configureShapeData,EXTRA_DEFAULTS,sanitizeOverrides};
export function rulesForCharacter(char){return char==='鉄'?CHARACTER_RULES['鉄'].map(r=>({...r,category:r.kind,layer:r.advice?'beauty':'identity',review:{status:'legacy-profile'},version:2})):componentRulesForCharacter(char);}
export function normalizeShapeSettings(value){return {...normalizeLegacy(value),...Object.fromEntries(Object.entries(EXTRA_DEFAULTS).map(([k,v])=>[k,CHECK_LEVELS.includes(value?.[k])?value[k]:v]))};}
export function checkCharacterShape(char,strokes,expected,settings,options={}){
 const policy=normalizeShapeSettings(settings);
 if(char!=='鉄')return evaluateCharacter(char,strokes,expected,policy,{...options,overrides:sanitizeOverrides(options.overrides)});
 const own=sanitizeOverrides(options.overrides),legacyRules=rulesForCharacter(char),levels=Object.fromEntries(legacyRules.map(r=>[r.id,effectivePolicy(char,r,policy,own).level]));
 const result=legacyCheck(char,strokes,expected,policy,levels),rows=[...(result.checks||[]),...(result.beautyChecks||[])];
 return {...result,writingChecks:[],engineVersion:'legacy-iron-v2',ruleSetVersion:'legacy-iron-v2',policySnapshot:{char,mode:'normal',settings:policy,rules:Object.fromEntries(legacyRules.map(r=>[r.id,effectivePolicy(char,r,policy,own)]))},results:rows.map(r=>({...r,ruleId:r.id,ruleVersion:2,reviewStatus:'legacy-profile',layer:r.advice?'beauty':'identity',status:r.status==='review'?'fail':r.status,reasonCode:r.kind}))};
}
// Fine-detail categories are owned by the component engine. A disabled category
// is not reintroduced through the old pixel-based position/length comparison.
export function analyzeCharacterWriting(char,strokes,expected,settings){
 if(char==='鉄'||!rulesForCharacter(char).length)return analyzeStrokes(strokes,expected,settings);
 const p=normalizeShapeSettings(settings);
 if(p.count!=='off'&&strokes.length!==expected.length)return {type:'count',text:`画の数を見直そう。お手本は${expected.length}画、今は${strokes.length}画です。`};
 const m=matchStrokes(strokes,expected);
 if(!m.available)return ['order','direction'].some(k=>p[k]!=='off')?{type:'shape',text:'書く順番や 向きを、お手本と 比べよう。'}:{type:'good',text:'文字を 読み取りました。'};
 if(p.direction!=='off'){
  const reversed=m.matches.find(r=>r?.stable&&r.indices.length===1&&r.points[0]!==r.rawPoints[0]);
  if(reversed)return {type:'direction',stroke:reversed.indices[0]+1,text:(reversed.indices[0]+1)+'画目の 書く向きを 見直そう。'};
 }
 if(p.order!=='off'&&m.matches.some((r,i)=>r?.stable&&r.indices.length===1&&r.indices[0]!==i))return {type:'order',text:'形は近いですが、書く順番を お手本と 比べよう。'};
 return {type:'good',text:'文字を 読み取りました。'};
}
