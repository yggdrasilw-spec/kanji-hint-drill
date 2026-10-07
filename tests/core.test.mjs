import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectScope,questionsFor,updateRecord,buildQueue,analyzeStrokes,validateProgress,DAY} from '../core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/curriculum.json',import.meta.url)));
assert.equal(Object.keys(data.glyphs).length,1026);
for(const g of data.grades){
 const ids=g.units.map(u=>u.id),chars=selectScope(data,g.grade,ids);assert.equal(chars.length,new Set(chars).size);
 assert.deepEqual(selectScope(data,g.grade,[]),[]);assert.deepEqual(questionsFor(data,g.grade,[]),[]);
 for(const u of g.units){const qs=questionsFor(data,g.grade,[u.id]);const scope=new Set(selectScope(data,g.grade,[u.id]));assert.ok(qs.length>0,`No questions for ${u.title}`);
  for(const q of qs){assert.ok(scope.has(q.char));assert.equal([...q.word].filter(c=>c===q.char).length,1);for(const c of q.word)if(data.glyphs[c])assert.ok(scope.has(c)||data.glyphs[c].grade<g.grade,`Unlearned ${c} in ${q.word}`);}
 }
}
const now=1700000000000;let r=updateRecord(null,{type:'wrong'},now);assert.equal(r.due,now);assert.equal(r.stage,0);
r=updateRecord(r,{type:'correct',hints:1},now+100);assert.equal(r.correct,0);assert.equal(r.helped,1);assert.equal(r.stage,0);
r=updateRecord(r,{type:'correct',hints:0},now+200);assert.equal(r.due,now+200+DAY);assert.equal(r.stage,1);
r=updateRecord(r,{type:'correct',hints:0},now+DAY);assert.equal(r.stage,2);assert.equal(r.due,now+4*DAY);
r=updateRecord(r,{type:'correct',hints:0},now+4*DAY);assert.equal(r.stage,3);assert.equal(r.streak,3);
r=updateRecord(r,{type:'correct',answerSeen:true},now+5*DAY);assert.equal(r.streak,0);assert.equal(r.helped,2);
const strokeReview=updateRecord(null,{type:'correct',hints:0,needsReview:true,reason:'order'},now);assert.equal(strokeReview.correct,0);assert.equal(strokeReview.history[0].hints,0);assert.equal(strokeReview.history[0].reason,'order');
const sample=[{x:20,y:50},{x:90,y:50}],vert=[{x:50,y:20},{x:50,y:90}];assert.equal(analyzeStrokes([sample],[sample]).type,'good');assert.equal(analyzeStrokes([[...sample].reverse()],[sample]).type,'direction');assert.equal(analyzeStrokes([sample],[sample,vert]).type,'count');assert.equal(analyzeStrokes([vert,sample],[sample,vert]).type,'order');
const qs=[{id:'a',char:'一'},{id:'b',char:'二'},{id:'c',char:'三'}];assert.equal(buildQueue(qs,{b:{due:now-1,errors:2},c:{due:now+DAY,errors:0}},3,now,()=>.5)[0].id,'b');
assert.throws(()=>validateProgress({records:{}}));assert.equal(validateProgress({version:1,records:{a:{stage:999,history:[],due:Infinity}}}).records.a.stage,4);
console.log('PASS: 1026 glyphs, all selected units, vocabulary scope, multi-reading questions, spaced review, hint/answer handling, stroke analysis, imported records');
