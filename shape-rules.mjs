import {EXTRA_DEFAULTS,sanitizeOverrides,LEVELS} from './shape/policy.mjs';
import {configureShapeData,evaluateCharacter,rulesForCharacter} from './shape/engine.mjs';
import {matchStrokes} from './shape/matching.mjs';
import {analyzeStrokes} from './core.mjs';
// Retained only as a geometry utility for saved tooling; no character-specific evaluation.
export {protrusionFocus} from './shape/legacy-iron.mjs';
export {configureShapeData,rulesForCharacter,EXTRA_DEFAULTS,sanitizeOverrides};
export const CHECK_LEVELS=LEVELS;
export const DEFAULT_SHAPE_SETTINGS=Object.freeze({count:'normal',direction:'normal',order:'normal',beautyParallel:'off',beautySlope:'off',...EXTRA_DEFAULTS});
export function normalizeShapeSettings(value){
 return Object.fromEntries(Object.entries(DEFAULT_SHAPE_SETTINGS).map(([key,fallback])=>[key,(key==='count'?['off','normal']:CHECK_LEVELS).includes(value?.[key])?value[key]:fallback]));
}
export function checkCharacterShape(char,strokes,expected,settings,options={}){
 return evaluateCharacter(char,strokes,expected,normalizeShapeSettings(settings),{...options,overrides:sanitizeOverrides(options.overrides)});
}
export function analyzeCharacterWriting(char,strokes,expected,settings){
 if(!rulesForCharacter(char).length)return analyzeStrokes(strokes,expected,settings);
 const p=normalizeShapeSettings(settings);
 if(p.count!=='off'&&strokes.length!==expected.length)return {type:'count',text:`せんの かずを かぞえよう。おてほんは ${expected.length}かく、いまは ${strokes.length}かくだよ。`};
 const m=matchStrokes(strokes,expected);
 if(!m.available)return ['order','direction'].some(k=>p[k]!=='off')?{type:'shape',text:'かく じゅんばんと むきを、おてほんと みくらべよう。'}:{type:'good',text:'かいた じが よめたよ。'};
 if(p.direction!=='off'){
  const reversed=m.matches.find(r=>r?.stable&&r.indices.length===1&&r.points[0]!==r.rawPoints[0]);
  if(reversed)return {type:'direction',stroke:reversed.indices[0]+1,text:(reversed.indices[0]+1)+'かくめは、おてほんと おなじ むきに かこう。'};
 }
 if(p.order!=='off'&&m.matches.some((r,i)=>r?.stable&&r.indices.length===1&&r.indices[0]!==i))return {type:'order',text:'おてほんの じゅんばんで、1かくめから かこう。'};
 return {type:'good',text:'かいた じが よめたよ。'};
}
