import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateDetail,detailContext,pairFeature,normalizedLines} from '../shape/detail-geometry.mjs';
import {savedShape} from '../shape/policy.mjs';
import {configureShapeData,rulesForCharacter,checkCharacterShape,normalizeShapeSettings} from '../shape-rules.mjs';
import catalog from '../data/shape-detail-reference.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const components=read('data/shape-components.json'),rules=read('data/shape-rules.json'),fixtures=read('qa/shape/reference-fixtures.json');configureShapeData(components,rules);
assert.equal(Object.keys(catalog.characters).length,1026);
let strokeTotal=0,pairTotal=0,componentTotal=0;
for(const [char,entry] of Object.entries(components.characters)){
 const n=entry.strokeTypes.length,rows=rulesForCharacter(char).filter(r=>r.kind.startsWith('detail')),ids=new Set();
 for(const row of rows){assert.ok(!ids.has(row.id));ids.add(row.id);assert.ok(row.id.length<180,char+' stable override ID');assert.ok(row.category in normalizeShapeSettings());for(const number of row.strokeNumbers)assert.ok(number>=1&&number<=n);}
 for(const kind of ['detailStart','detailEnd','detailPath','detailFinish','detailLength'])assert.deepEqual(rows.filter(r=>r.kind===kind).map(r=>r.strokeNumbers[0]),Array.from({length:n},(_,i)=>i+1),char+' all '+kind);
 const pairs=rows.filter(r=>r.kind==='detailPair');assert.equal(new Set(pairs.map(r=>r.strokeNumbers.join('-'))).size,n*(n-1)/2);assert.equal(rows.filter(r=>r.kind==='detailComponent').length,entry.components.length-1);
 strokeTotal+=n;pairTotal+=pairs.length;componentTotal+=entry.components.length;
}
assert.deepEqual([strokeTotal,pairTotal,componentTotal],[9662,47138,5567]);
const line=(x,y,a,b)=>[{x,y},{x:a,y:b}],reference=[line(0,50,100,50),line(50,0,50,100),line(0,0,0,100)];
function measure(kind,drawn,parameters={},roles=['line-1'],level='normal',ref=reference){
 const matches=drawn.map((points,i)=>({stable:true,points,rawPoints:points,indices:[i]})),match={available:true,scale:100,matches,toReference:p=>({x:p.x-50,y:p.y-50})},instance={roles:Object.fromEntries(ref.map((_,i)=>['line-'+(i+1),{stroke:i+1}]))};
 const ctx={rule:{kind,roles,strokeNumbers:roles.map(r=>+r.slice(5)),parameters,text:'対象箇所を比べる'},level,match,instance,expected:ref,get:role=>matches[instance.roles[role].stroke-1]};ctx.details=detailContext(match,ref);return evaluateDetail(ctx);
}
for(const kind of ['detailStart','detailEnd','detailPath','detailFinish','detailLength'])assert.equal(measure(kind,reference).status,'pass',kind+' reference');
let s=structuredClone(reference);s[0][0].x+=25;assert.equal(measure('detailStart',s).status,'fail');assert.deepEqual(measure('detailStart',s).focus.actualIndices,[0]);
s=structuredClone(reference);s[0][1].x-=25;assert.equal(measure('detailEnd',s).status,'fail');
s=structuredClone(reference);s[0]=[{x:0,y:50},{x:50,y:85},{x:100,y:50}];assert.equal(measure('detailPath',s).status,'fail');
s=structuredClone(reference);s[0]=[{x:0,y:50},{x:80,y:50},{x:80,y:100}];assert.equal(measure('detailFinish',s).status,'fail');
s=structuredClone(reference);s[0]=line(35,50,65,50);assert.equal(measure('detailLength',s).status,'fail');
s=structuredClone(reference);s[1]=line(50,70,50,100);const crossing=measure('detailPair',s,{relation:'C'},['line-1','line-2']);assert.equal(crossing.status,'fail');assert.deepEqual(crossing.focus.actualIndices,[0,1]);
const contact=[line(0,50,50,50),line(50,0,50,100),line(0,0,0,100)];s=structuredClone(contact);s[0][1].x=75;assert.equal(measure('detailPair',s,{relation:'T'},['line-1','line-2'],'normal',contact).status,'fail');s[0][1].x=53;assert.equal(measure('detailPair',s,{relation:'T'},['line-1','line-2'],'normal',contact).status,'pass');
const separate=[line(0,20,100,20),line(0,65,100,65),line(0,0,0,100)];s=structuredClone(separate);s[0]=line(0,65,100,65);assert.equal(measure('detailPair',s,{relation:'S'},['line-1','line-2'],'normal',separate).status,'fail');
s=structuredClone(reference);s[0]=s[0].map(p=>({...p,x:p.x+30}));assert.equal(measure('detailComponent',s,{childCount:1},['line-1','line-2','line-3']).status,'fail');
// Grade-spanning handwritten variants retain one shared coordinate frame.
for(const char of ['一','三','口','十','女','向','歩','明','鉄','曜','鬱'].filter(c=>fixtures[c])){
 const ref=fixtures[char],theta=8*Math.PI/180,variant=ref.map(line=>line.map(p=>({x:20+.7*(Math.cos(theta)*p.x-Math.sin(theta)*p.y),y:35+.7*(Math.sin(theta)*p.x+Math.cos(theta)*p.y)}))),settings=normalizeShapeSettings();settings.writingFinish='normal';
 const result=checkCharacterShape(char,variant,ref,settings);assert.ok(result.results.filter(r=>r.kind.startsWith('detail')).every(r=>!['fail','review'].includes(r.status)),char+' scale/rotation invariance');
 const off=checkCharacterShape(char,ref,ref,{...settings,writingPosition:'off'});assert.ok(off.results.filter(r=>['detailStart','detailEnd'].includes(r.kind)).every(r=>r.status==='skipped'));
}
// A late issue survives bounded history; imports round-trip its compact summary.
const rows=Array.from({length:300},(_,i)=>({ruleId:'rule-'+i,ruleVersion:1,status:i===299?'fail':'pass',layer:'writing',reasonCode:'test'})),saved=savedShape({engineVersion:'test',shapeResults:rows});assert.equal(saved.shapeResults[0].ruleId,'rule-299');assert.equal(saved.shapeResultsTruncated,false);assert.equal(saved.shapePassDetailsOmitted,true);assert.equal(saved.shapeResults.length,1);assert.equal(saved.shapeResultCounts.fail,1);assert.deepEqual(savedShape(saved),saved);assert.doesNotThrow(()=>savedShape({engineVersion:'test',shapeResults:'bad'}));
console.log('PASS: 1026 chars, 9662 strokes x5, 47138 pairs, 5567 components; position/bend/finish/length/junction/separation/layout mutants, tolerant tiny overrun, aligned transformations, off settings and bounded issue history');

const many=savedShape({engineVersion:'test',shapeResults:rows.map((r,i)=>({...r,status:i===299?'fail':'uncertain'}))});assert.equal(many.shapeResults[0].ruleId,'rule-299');assert.equal(many.shapeResultsTruncated,true);

for(const char of ['十','見','議']){const result=checkCharacterShape(char,fixtures[char],fixtures[char],normalizeShapeSettings());assert.ok(result.results.filter(r=>r.kind.startsWith('detail')).every(r=>r.adviceOnly===true));}
