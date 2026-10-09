import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gradeCharacters,selectedCharacters,questionsForCharacters,buildQueue} from '../core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/curriculum.json',import.meta.url)));
assert.deepEqual([1,2,3,4,5,6].map(g=>gradeCharacters(data,g).length),[80,160,200,202,193,191]);
const all=[1,2,3,4,5,6].flatMap(g=>gradeCharacters(data,g));assert.equal(new Set(all).size,1026);
assert.deepEqual(selectedCharacters(data,['鉄','鉄','見','不存在','constructor',null,7]),['鉄','見']);
assert.deepEqual(questionsForCharacters(data,[]),[]);assert.deepEqual(questionsForCharacters(data,['不存在']),[]);
for(const chars of [['鉄'],['鉄','知','見'],['一','鉄','難'],all]){
 const questions=questionsForCharacters(data,chars);assert.deepEqual(new Set(questions.map(q=>q.char)),new Set(chars));
 for(const q of questions){
  assert.ok(chars.includes(q.char));assert.ok(q.masked.includes('□'));assert.ok(q.before||q.after);
  for(const c of q.displayWord)if(data.glyphs[c])assert.ok(data.glyphs[c].grade<=data.glyphs[q.char].grade,'future grade leaked into '+q.char+': '+q.displayWord);
 }
 const records=Object.fromEntries(questions.map(q=>[q.id,{due:0,errors:1}]));records['外|scope']={due:0,errors:100};
 assert.ok(buildQueue(questions,records,20,1,()=>.5).every(q=>chars.includes(q.char)));
}
assert.equal(questionsForCharacters(data,['鉄'],false).length,1);assert.ok(questionsForCharacters(data,all,true).length>questionsForCharacters(data,all,false).length);
console.log('PASS: all 1026 grade cards, duplicates/stale selections, empty scope, iron-only/mixed-grade questions, contextual masking, grade-safe vocabulary, review scope and multiple readings');
