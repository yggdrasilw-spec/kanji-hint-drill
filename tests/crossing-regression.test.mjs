import fs from 'node:fs';
import assert from 'node:assert/strict';
import {configureShapeData,checkCharacterShape,normalizeShapeSettings} from '../shape-rules.mjs';
import {pairFeature,normalizedLines,evaluateDetail} from '../shape/detail-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
configureShapeData(read('data/shape-components.json'),read('data/shape-rules.json'));
const ref=read('qa/shape/reference-fixtures.json')['土'],settings=normalizeShapeSettings({writingCrossing:'normal'});
const measure=strokes=>checkCharacterShape('土',strokes,ref,settings).results.find(r=>r.id.endsWith('.detail.pair-1-2'));
assert.equal(measure(ref).status,'pass');
for(const fraction of [.15,.25,.35]){
 const s=structuredClone(ref);s[1]=s[1].slice(Math.floor(s[1].length*fraction));
 assert.ok(pairFeature(...normalizedLines(s).slice(0,2)).hits.length,'geometric intersection');
 const result=measure(s);assert.equal(result.status,'pass');assert.equal(result.observed.crossed,true);assert.equal(result.ruleVersion,2);
 // A shared translation, scale and mild rotation do not change the relation.
 const variant=s.map(line=>line.map(p=>({x:20+.7*(p.x*.995-p.y*.1),y:30+.7*(p.x*.1+p.y*.995)})));
 assert.equal(measure(variant).status,'pass');
}
let s=structuredClone(ref);s[1]=s[1].slice(Math.floor(s[1].length*.45));assert.equal(measure(s).status,'uncertain');assert.match(measure(s).text,/線は交差しています/);
s=structuredClone(ref);s[1]=s[1].slice(Math.floor(s[1].length*.55));assert.equal(pairFeature(...normalizedLines(s).slice(0,2)).hits.length,0);assert.equal(measure(s).status,'fail');assert.match(measure(s).text,/離れて/);
const off=checkCharacterShape('土',s,ref,{...settings,writingCrossing:'off'}).results.find(r=>r.id.endsWith('.detail.pair-1-2'));assert.equal(off.status,'skipped');
// Small gaps request a comparison; a T contact is not accepted as a clear crossing.
function relation(start){const reference=[[{x:-.5,y:0},{x:.5,y:0}],[{x:0,y:-.5},{x:0,y:.5}]],drawn=[reference[0],[{x:0,y:start},{x:0,y:.5}]];return evaluateDetail({rule:{kind:'detailPair',roles:['a','b'],parameters:{relation:'C'}},level:'normal',match:{available:true},details:{reference,drawn},instance:{roles:{a:{stroke:1},b:{stroke:2}}},get:role=>({stable:true,points:drawn[role==='a'?0:1],indices:[role==='a'?0:1]})});}
assert.equal(relation(.01).status,'uncertain');assert.equal(relation(.06).status,'fail');assert.equal(relation(0).status,'fail');assert.equal(relation(-.1).status,'pass');
console.log('PASS 土 shorter crossing arms x3, transformed variants, near-tip/gap/T/disconnected cases and off policy');
