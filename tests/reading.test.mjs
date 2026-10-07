import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeReading,readingQuestions} from '../reading.mjs';
import {questionsFor} from '../core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/curriculum.json',import.meta.url))),kana=JSON.parse(fs.readFileSync(new URL('../data/kana.json',import.meta.url)));
assert.equal(normalizeReading(' ガッコウ。 '),'がっこう');
for(const grade of data.grades){const write=questionsFor(data,grade.grade,grade.units.map(u=>u.id));const read=readingQuestions(write,data);assert.equal(read.length,write.length);for(const q of read){assert.equal(q.id.endsWith('|read'),true);assert.ok(q.acceptedReadings.includes(q.reading));for(const c of normalizeReading(q.reading))assert.ok(kana.glyphs[c]||c==='ー',`Missing kana hint ${c}`);}}
const alternative=readingQuestions([{id:'生|生|なま',char:'生',word:'生',reading:'なま'}],{glyphs:{生:{words:[{word:'生',reading:'せい'}]}}});assert.deepEqual(alternative[0].acceptedReadings,['なま','せい']);
console.log('PASS: all grades keep shared vocabulary, separate reading record IDs, kana hint coverage, normalization and valid alternative readings');
