import assert from 'node:assert/strict';
import fs from 'node:fs';
import {configureShapeData,checkCharacterShape,normalizeShapeSettings,rulesForCharacter,analyzeCharacterWriting} from '../shape-rules.mjs';
import {matchStrokes} from '../shape/matching.mjs';
import {effectivePolicy,savedShape} from '../shape/policy.mjs';
import {updateRecord,validateProgress} from '../core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/shape-components.json',import.meta.url))),rules=JSON.parse(fs.readFileSync(new URL('../data/shape-rules.json',import.meta.url)));
const curriculum=JSON.parse(fs.readFileSync(new URL('../data/curriculum.json',import.meta.url)));
configureShapeData(data,rules);
const fixtures=JSON.parse(fs.readFileSync(new URL('../qa/shape/reference-fixtures.json',import.meta.url)));
const reference=char=>structuredClone(fixtures[char]),level=normalizeShapeSettings({beautyLength:'normal',beautyAspect:'normal',beautySpacing:'normal',compactEnding:'normal'});
const run=(c,s=reference(c),p={},mode='normal')=>checkCharacterShape(c,s,reference(c),{...level,...p},{mode});
const find=(r,kind)=>r.results.find(x=>x.kind===kind);
const summary=r=>({status:r.status,items:r.results.filter(r=>!['pass','skipped'].includes(r.status)).map(r=>({kind:r.kind,status:r.status,reason:r.reasonCode,observed:r.observed}))});
assert.deepEqual(Object.keys(data.characters).sort(),Object.keys(curriculum.glyphs).sort());
const audit=[];let elapsed=0;
for(const [c,entry] of Object.entries(data.characters)){
 const components=new Map(entry.components.map(i=>[i.id,i]));assert.equal(components.size,entry.components.length,c);
 const ids=new Set();for(const binding of entry.rules){assert.ok(!ids.has(binding.id));ids.add(binding.id);const rule=rules.templates[binding.templateId],instance=components.get(binding.instanceId);assert.ok(rule&&instance,c);for(const role of binding.roles)assert.ok(instance.roles[role]?.stroke>=1&&instance.roles[role]?.stroke<=entry.strokeTypes.length,c+' '+role);}
 const start=performance.now(),result=run(c,reference(c),{beautyLength:'off',beautyAspect:'off',beautySpacing:'off',compactEnding:'off'}),ms=performance.now()-start;elapsed+=ms;
 assert.notEqual(result.status,'fail',c+' '+JSON.stringify(summary(result)));
 assert.ok(!result.results.some(r=>r.candidateStatus==='fail'),c+' reference candidate '+JSON.stringify(summary(result)));
 assert.ok(result.results.length,c);audit.push({char:c,unicode:entry.unicode,grade:entry.grade,svgSha256:entry.svgSha256,engineVersion:result.engineVersion,identityStatus:result.status,instances:entry.components.map(i=>({instanceId:i.id,formId:i.formId})),rules:result.results.map(r=>({ruleId:r.ruleId,layer:r.layer,implementation:r.status==='skipped'?'implemented':r.status==='unavailable'?'candidate':'synthetic-verified',sourceReview:r.reviewStatus,syntheticReference:r.status,realHandwriting:'not-collected',humanReview:'pending'})),synthetic:'reference-and-transforms-tested',humanReview:'pending',realHandwriting:'not-collected',incompleteReasons:entry.incompleteReasons});
 for(const theta of [-8,8]){const a=theta*Math.PI/180,co=Math.cos(a),si=Math.sin(a),s=reference(c).map(line=>line.map(p=>({x:30+.65*(co*p.x-si*p.y),y:-12+.65*(si*p.x+co*p.y)})));assert.notEqual(run(c,s,{beautyLength:'off',beautyAspect:'off',beautySpacing:'off',compactEnding:'off'}).status,'fail',c+' transformed');}
}
console.log('all-character geometry',JSON.stringify({characters:audit.length,totalMs:Math.round(elapsed),averageMs:elapsed/audit.length}));
for(const c of ['日','目','見']){
 assert.equal(find(run(c),'internalBars').status,'pass',c+' reference '+JSON.stringify(summary(run(c))));
 const eye=data.characters[c].components.find(i=>i.attributes.element===(c==='日'?'日':'目')),bar=eye.roles['bar-1'].stroke-1,s=reference(c);s.splice(bar,1);
 const result=run(c,s),detail=find(result,'internalBars');assert.equal(detail.candidateStatus,'fail',c+' missing '+JSON.stringify(summary(result)));assert.equal(detail.observed.count,detail.expected.count-1);assert.equal(result.status,'uncertain');
 const bad=run(c,s,{},'evaluation');assert.equal(find(bad,'internalBars').status,'fail');
 const extra=reference(c),line=structuredClone(extra[bar]).map(p=>({...p,y:p.y+5}));extra.push(line);assert.equal(find(run(c,extra),'internalBars').observed.count,detail.expected.count+1,c+' extra');
 const duplicated=reference(c);duplicated.push(structuredClone(duplicated[bar]));assert.equal(find(run(c,duplicated),'internalBars').observed.count,detail.expected.count,c+' retrace');
 const split=reference(c),roof=eye.roles.roof.stroke-1,ps=split[roof];split.splice(roof,1,ps.slice(0,25),ps.slice(24));assert.equal(find(run(c,split),'internalBars').observed.count,detail.expected.count,c+' split '+JSON.stringify(summary(run(c,split))));
 const reordered=reference(c).reverse().map(s=>s.reverse());assert.equal(find(run(c,reordered),'internalBars').status,'pass',c+' reverse');
 const off=run(c,s,{structure:'off',internalBars:'off'});assert.equal(off.status,'skipped');
 for(const row of result.results)if(row.focus){const f=row.focus;assert.equal(f.coordinateSpace,'answer');for(const [x,y] of f.region?.polygon||[])assert.ok(Math.hypot(x-f.point.x,y-f.point.y)+3<f.radius);}
}
// Same global stroke count cannot hide an extra bar behind a missing leg.
{const s=reference('見');s.pop();s.push(s[2].map(p=>({...p,y:p.y+6})));assert.equal(find(run('見',s),'internalBars').observed.count,3);}
for(const c of ['三','青','金','利']){const r=run(c);assert.ok(r.beautyChecks.some(r=>r.kind==='lengthOrder'),c);assert.ok(r.beautyChecks.every(r=>r.status!=='review'),c+' reference beauty '+JSON.stringify(summary(r)));}
{const s=reference('三');const length=Math.max(...s[0].map(p=>p.x))-Math.min(...s[0].map(p=>p.x));const b=s[1],min=Math.min(...b.map(p=>p.x)),old=Math.max(...b.map(p=>p.x))-min;s[1]=b.map(p=>({...p,x:min+(p.x-min)*length/old*1.2}));assert.ok(run('三',s).beautyChecks.some(r=>r.status==='review'));assert.equal(run('三',s).status,'pass');}
for(const c of ['月','明','服','青'])assert.ok(rulesForCharacter(c).some(r=>r.kind==='componentAspect'),c);
{const s=reference('月').map(l=>l.map(p=>({...p,x:54+(p.x-54)*2.1})));assert.ok(run('月',s).beautyChecks.some(r=>r.kind==='componentAspect'&&r.status==='review'),'wide moon '+JSON.stringify(summary(run('月',s))));}
{const s=reference('知');const line=s[4],first=line[0];s[4]=line.map(p=>({x:first.x+(p.x-first.x)*2.3,y:first.y+(p.y-first.y)*2.3}));const result=run('知',s);assert.ok(result.writingChecks.some(r=>r.kind==='compactEnding'&&r.status!=='pass'),'long ending '+JSON.stringify(summary(result)));assert.notEqual(result.status,'fail');}
for(const c of ['土','士','未','末'])assert.ok(rulesForCharacter(c).some(r=>r.kind==='lengthIdentity'),c);

// Each structural length distinguisher has its own comparison, independent of beauty.
for(const c of ['土','士','未','末']){const row=rulesForCharacter(c).find(r=>r.kind==='lengthIdentity'),instance=data.characters[c].components.find(i=>i.id===row.instanceId),a=instance.roles[row.roles[0]].stroke-1,b=instance.roles[row.roles[1]].stroke-1,s=reference(c);const center=line=>(Math.min(...line.map(p=>p.x))+Math.max(...line.map(p=>p.x)))/2,la=Math.max(...s[a].map(p=>p.x))-Math.min(...s[a].map(p=>p.x)),lb=Math.max(...s[b].map(p=>p.x))-Math.min(...s[b].map(p=>p.x)),cx=center(s[a]);s[a]=s[a].map(p=>({...p,x:cx+(p.x-cx)*lb/la*.8}));assert.equal(find(run(c,s,{},'evaluation'),'lengthIdentity').status,'fail',c+' inverted lengths');assert.equal(run(c,s).status,'uncertain');}
// Spacing advice and body width never alter the identity outcome or learning schedule.
{const s=reference('目');s[2]=s[2].map(p=>({...p,y:p.y-12}));const r=run('目',s);assert.equal(find(r,'internalBars').status,'pass');assert.ok(r.beautyChecks.some(x=>x.kind==='spacing'&&x.status==='review'),JSON.stringify(summary(r)));assert.equal(r.status,'pass');}
{const s=reference('月');for(let i=38;i<s[0].length;i++)s[0][i].x-=8*(i-38)/(s[0].length-39);const before=find(run('月'),'componentAspect'),after=find(run('月',s),'componentAspect');assert.ok(Math.abs(before.observed.aspect-after.observed.aspect)<.025,'moon body excludes lower sweep');}
{const s=reference('利');const last=s[6].at(-1);s[6].push({x:last.x-12,y:last.y});const r=run('利',s);assert.notEqual(find(r,'lengthOrder').status,'fail','hook does not compensate a stem');}
assert.equal(matchStrokes([[{x:1e308,y:0},{x:2,y:3}]],reference('一')).available,false);
const sampleRule=rulesForCharacter('目').find(r=>r.kind==='internalBars');
assert.equal(effectivePolicy('目',sampleRule,{internalBars:'off'},{目:{rules:{[sampleRule.id]:'strict'}}}).level,'off');
assert.equal(effectivePolicy('目',sampleRule,{internalBars:'normal'},{目:{rules:{[sampleRule.id]:'strict'},categories:{internalBars:'relaxed'}}}).level,'strict');
assert.equal(analyzeCharacterWriting('見',reference('見').reverse(),reference('見'),{count:'off',direction:'off',order:'off',shape:'off'}).type,'good');
const beauty=run('三'),outcome={type:'correct',engineVersion:beauty.engineVersion,ruleSetVersion:beauty.ruleSetVersion,shapeResults:beauty.results,policySnapshot:beauty.policySnapshot,beautyNotes:beauty.beautyChecks.map(r=>r.id)};
const ir=reference('鉄'),wrongIron=structuredClone(ir);wrongIron[11]=wrongIron[11].filter(p=>p.y>40);assert.equal(checkCharacterShape('鉄',wrongIron,ir,{}, {overrides:{鉄:{categories:{protrusion:'off'},rules:{}}}}).status,'pass');assert.equal(checkCharacterShape('鉄',wrongIron,ir,{protrusion:'off'}, {overrides:{鉄:{categories:{protrusion:'strict'},rules:{}}}}).status,'pass');
const record=updateRecord(null,outcome,100);assert.equal(record.stage,1);assert.equal(record.helped,0);assert.deepEqual(validateProgress({version:1,records:{test:record}}).records.test.history[0].shapeResults,record.history[0].shapeResults);
assert.deepEqual(savedShape({engineVersion:'x',shapeResults:[{ruleId:'unknown',status:'executeme',layer:'x'}]}).shapeResults[0].status,'unavailable');
assert.equal(matchStrokes([[{x:NaN,y:0},{x:2,y:3}]],reference('一')).available,false);
assert.equal(matchStrokes(Array.from({length:97},()=>reference('一')[0]),reference('一')).available,false);
fs.writeFileSync(new URL('../data/shape-coverage.json',import.meta.url),JSON.stringify({version:1,engineVersion:'component-engine-1',characters:audit,summary:{characters:audit.length,rules:audit.reduce((s,c)=>s+c.rules.length,0),syntheticReferenceAndTransforms:true,allDetailsComplete:false,identityReviewPending:true,realHandwriting:'not-collected',referenceTiming:{totalMs:Math.round(elapsed),averageMs:elapsed/audit.length}}},null,2)+'\n');
console.log('PASS: all 1026 mappings, transforms, partial strokes, inner-bar localization, retracing/splits, shape-specific length/aspect, writing/beauty/history independence and off policy');
