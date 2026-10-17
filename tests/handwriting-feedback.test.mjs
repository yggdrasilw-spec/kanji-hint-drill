import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configureShapeData,checkCharacterShape,normalizeShapeSettings,rulesForCharacter} from '../shape-rules.mjs';
import {evaluateRule} from '../shape/checks.mjs';
import {hasHook} from '../shape/stroke-types.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
configureShapeData(read('../data/shape-components.json'),read('../data/shape-rules.json'));
const fixtures=read('../qa/shape/reference-fixtures.json');
const run=(c,s=fixtures[c],settings={},options={})=>checkCharacterShape(c,s,fixtures[c],normalizeShapeSettings(settings),options);
for(const type of ['㇆a','㇆v','㇈b','㇖b/㇆','㇃','㇑/㇚'])assert.equal(hasHook(type),true,type);
assert.equal(hasHook('㇗'),false);
const row=rulesForCharacter('向').find(r=>r.kind==='hookGeometry');assert.ok(row);assert.equal(row.category,'writingHook');
const normal=run('向',undefined,{writingHook:'normal'});assert.equal(normal.writingChecks.find(r=>r.kind==='hookGeometry').status,'pass');
const noHook=structuredClone(fixtures['向']);noHook[2]=noHook[2].slice(0,56);noHook[2].push({x:noHook[2].at(-1).x,y:91});
const missing=run('向',noHook,{writingHook:'normal'}),issue=missing.writingChecks.find(r=>r.kind==='hookGeometry');
assert.equal(issue.status,'fail');assert.deepEqual(issue.focus.actualIndices,[2]);assert.equal(missing.status,'pass','writing does not reject recognized character');
assert.equal(run('向',noHook,{writingHook:'off'}).results.find(r=>r.kind==='hookGeometry').status,'skipped');
assert.equal(run('向',noHook,{writingHook:'normal'},{overrides:{向:{rules:{[row.id]:'off'}}}}).results.find(r=>r.kind==='hookGeometry').status,'skipped');
for(const c of ['子','心','月','手'])assert.ok(run(c,undefined,{writingHook:'normal'}).writingChecks.some(r=>r.kind==='hookGeometry'&&r.status==='pass'),c);
assert.equal(run('子',undefined,{writingHook:'normal'}).results.find(r=>r.kind==='hookGeometry'&&r.referenceStrokeNumbers[0]===1).status,'unavailable','no hook mandated where the reference has none');
// A tiny hook should survive the longer stem; a straight ending must fail.
const direct=(kind,a,b,parameters={})=>evaluateRule({rule:{kind,roles:['a',...(b?['b']:[])],parameters},level:'normal',match:{available:true,scale:100},get:role=>({stable:true,points:role==='a'?a:b,rawPoints:role==='a'?a:b,indices:role==='a'?[0]:[1]})});
assert.equal(direct('hookGeometry',[{x:0,y:0},{x:0,y:100},{x:-2,y:99}]).status,'pass');
assert.equal(direct('hookGeometry',[{x:0,y:0},{x:0,y:100}]).status,'fail');
// A diagonal reference is valid for contact; it need not have a horizontal run.
assert.equal(direct('contact',[{x:20,y:20},{x:60,y:50}],[{x:0,y:0},{x:30,y:30}]).status,'pass');
const pair=gap=>({rule:{kind:'topology',roles:['a','b'],parameters:{relations:[{a:'a',b:'b'}]},text:'この二本'},level:'normal',match:{available:true,scale:100},get:role=>({stable:true,points:[{x:0,y:role==='a'?0:gap},{x:100,y:role==='a'?0:gap}],indices:role==='a'?[0]:[1]})});
for(const [gap,status] of [[0,'pass'],[6.5,'pass'],[10,'uncertain'],[13,'fail']]){const r=evaluateRule(pair(gap));assert.equal(r.status,status);if(status!=='pass')assert.deepEqual(r.focus.actualIndices,[0,1]);}
const ambiguous=pair(0),get=ambiguous.get;ambiguous.get=role=>({...get(role),stable:role==='a'});
const unknown=evaluateRule(ambiguous);assert.equal(unknown.status,'uncertain');assert.equal(unknown.focus,null);assert.doesNotMatch(unknown.text,/二本/);
const topology=rulesForCharacter('向').find(r=>r.kind==='detailPair'&&r.parameters.relation==='T');assert.equal(topology.category,'writingContact');assert.equal(topology.layer,'writing');
assert.equal(run('向',undefined,{structure:'strict',writingContact:'off'}).results.find(r=>r.id===topology.id).status,'skipped');
assert.equal(run('向',undefined,{writingContact:'normal'}).results.find(r=>r.id===topology.id).status,'pass');
assert.equal(run('向',undefined,{writingContact:'off'},{overrides:{向:{rules:{[topology.id]:'strict'}}}}).results.find(r=>r.id===topology.id).status,'skipped');
let hooks=0;
for(const [char,strokes]of Object.entries(fixtures)){
 const result=run(char,strokes,{writingHook:'normal'});
 for(const hook of result.results.filter(r=>r.kind==='hookGeometry')){hooks++;assert.notEqual(hook.status,'fail',char+' reference '+hook.referenceStrokeNumbers);}
}
console.log('Reference hook candidates checked:',hooks);
console.log('PASS: 向 hook detection/off/overrides, small hooks, nonmandatory reference forms, independent contact policy, diagonal contact and both highlighted lines at the boundary');

// The exceptional iron profile also keeps optional writing apart from identity.
const iron=run('鉄',undefined,{writingContact:'normal'});assert.ok(iron.writingChecks.some(r=>r.kind==='contact'));assert.ok(iron.checks.every(r=>!['connection','containment','rise'].includes(r.kind)));
assert.equal(run('鉄',fixtures['鉄'].slice(1)).status,'uncertain','cannot locate the mandatory protrusion on an incomplete character');

for(const c of ['鉄','銅','銀']){
 const fine=run(c,undefined,{writingContact:'normal',writingBounds:'normal',writingRise:'normal'});
 for(const kind of ['contact','boundedEndpoint','risingStroke'])assert.ok(fine.writingChecks.some(r=>r.kind===kind),c+' '+kind);
 assert.equal(fine.engineVersion,run('向').engineVersion);
}
for(const c of ['夫','失','鉄'])assert.ok(rulesForCharacter(c).some(r=>r.kind==='protrusion'&&r.category==='identityExtent'),c);
for(const c of ['向','見','鉄'])for(const rule of rulesForCharacter(c).filter(r=>r.kind==='detailPair'))assert.equal(rule.roles.length,2,'each contact is a separate checkpoint');

// Shared fine-detail checks must accept the supplied reference forms.
for(const [char,strokes] of Object.entries(fixtures)){
 const result=run(char,strokes,{writingSweep:'normal',writingRise:'normal',writingBounds:'normal',writingContact:'normal',beautyParallel:'normal'});
 for(const row of [...result.writingChecks,...result.beautyChecks])assert.ok(!['fail','review'].includes(row.status),char+' reference '+row.kind);
}
