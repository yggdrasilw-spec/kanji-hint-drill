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
