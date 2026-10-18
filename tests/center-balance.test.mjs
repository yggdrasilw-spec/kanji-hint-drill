import fs from 'node:fs';
import assert from 'node:assert/strict';
import {BALANCED_CHARACTERS,balancedReference,centerBalanceFeedback} from '../shape/center-balance.mjs';
import {matchStrokes} from '../shape/matching.mjs';
import {configureShapeData,checkCharacterShape,normalizeShapeSettings,analyzeCharacterWriting} from '../shape-rules.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const fixtures=read('qa/shape/reference-fixtures.json');configureShapeData(read('data/shape-components.json'),read('data/shape-rules.json'));
const ref=fixtures['土'],levels={center:'normal',symmetry:'normal'};
const measure=(s,l=levels,char='土',reference=ref)=>centerBalanceFeedback(char,s,reference,matchStrokes(s,reference),l);
assert.deepEqual(measure(ref),[]);
const shifted=ref.map(line=>line.map(p=>({...p,x:p.x+15}))),axis=measure(shifted).find(r=>r.category==='beautyCenter');assert.ok(axis);assert.match(axis.childText,/2かくめ.*ひだり.*たての てんせん/);assert.deepEqual(axis.focus.actualIndices,[1]);
const shiftedLeft=ref.map(line=>line.map(p=>({...p,x:p.x-15})));assert.match(measure(shiftedLeft)[0].childText,/みぎ/);
const s=structuredClone(ref);s[0]=s[0].map(p=>({...p,x:p.x<53?53+(p.x-53)*.3:p.x}));const arm=measure(s).find(r=>r.category==='beautySymmetry');assert.ok(arm);assert.match(arm.childText,/1かくめは、2かくめ.*ひだりを もうすこし ながく/);assert.deepEqual(arm.focus.actualIndices,[0,1]);
const opposite=structuredClone(ref);opposite[0]=opposite[0].map(p=>({...p,x:p.x>53?53+(p.x-53)*.3:p.x}));assert.match(measure(opposite).find(r=>r.category==='beautySymmetry').childText,/みぎを もうすこし ながく/);
assert.deepEqual(measure(s,{center:'off',symmetry:'off'}),[]);assert.deepEqual(measure(s,levels,'右'),[]);
const ambiguous=matchStrokes(s,ref);ambiguous.matches[1].stable=false;assert.deepEqual(centerBalanceFeedback('土',s,ref,ambiguous,levels),[]);
let eligible=0;
for(const [char,reference] of Object.entries(fixtures)){
 const target=balancedReference(char,reference);if(target){eligible++;assert.ok(BALANCED_CHARACTERS.includes(char));assert.deepEqual(measure(reference,levels,char,reference),[],char+' reference should not be flagged');}
 else assert.deepEqual(centerBalanceFeedback(char,reference,reference,{available:true},levels),[]);
}
assert.ok(eligible>=5);assert.ok(balancedReference('十',fixtures['十']));assert.ok(balancedReference('土',ref));
const off=normalizeShapeSettings(),on={...off,beautyCenter:'normal',beautySymmetry:'normal'};
for(const input of [shifted,s]){
 const base=checkCharacterShape('土',input,ref,off),result=checkCharacterShape('土',input,ref,on);
 assert.equal(result.status,base.status);assert.deepEqual(result.layers,base.layers);assert.deepEqual(analyzeCharacterWriting('土',input,ref,on),analyzeCharacterWriting('土',input,ref,off));
 assert.ok(result.presentationHints.some(r=>r.kind==='centerBalance'));assert.ok(!result.results.some(r=>r.kind==='centerBalance'));
 assert.equal(checkCharacterShape('土',input,ref,on,{overrides:{'土':{categories:{beautyCenter:'off',beautySymmetry:'off'}}}}).presentationHints.length,0);
 assert.equal(checkCharacterShape('土',input,ref,off,{overrides:{'土':{categories:{beautyCenter:'strict',beautySymmetry:'strict'}}}}).presentationHints.length,0);
}
console.log('PASS center line / both arm directions, focus indices, ambiguous matching, off overrides, unchanged scoring; '+eligible+' eligible reference characters across 1026');
