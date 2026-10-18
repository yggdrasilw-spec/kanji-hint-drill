import assert from 'node:assert/strict';
import {positionAllowance,evaluateDetail} from '../shape/detail-geometry.mjs';
for(const n of [1,2,3,4,5,6,7,20]){assert.ok(positionAllowance(n,'relaxed')>positionAllowance(n,'normal'));assert.ok(positionAllowance(n,'normal')>positionAllowance(n,'strict'));}
assert.ok(positionAllowance(2)>positionAllowance(4));assert.ok(positionAllowance(4)>positionAllowance(6));assert.ok(positionAllowance(6)>positionAllowance(7));
function measure(n,kind,offset,level='normal'){
 const ref=[{x:0,y:0},{x:1,y:0}],drawn=ref.map(p=>({...p}));drawn[kind==='detailEnd'?1:0].y+=offset;
 return evaluateDetail({rule:{kind,roles:['line-1'],strokeNumbers:[1]},level,match:{available:true},details:{reference:Array(n).fill(ref),drawn:Array(n).fill(drawn)},instance:{roles:{'line-1':{stroke:1}}},get:()=>({stable:true,points:drawn,indices:[0]})});
}
for(const kind of ['detailStart','detailEnd']){
 assert.equal(measure(2,kind,.14).status,'pass','sparse valid variation');
 assert.equal(measure(4,kind,.12).status,'pass');
 assert.equal(measure(10,kind,.14).status,'fail','dense characters retain prior limit');
 assert.equal(measure(2,kind,.35).status,'fail','large displacement is still visible');
 assert.equal(measure(2,kind,.18).status,'uncertain');
 assert.equal(measure(2,kind,.14,'strict').status,'fail');
 assert.equal(measure(2,kind,.35).expected.referenceOnly,true);
 assert.match(measure(2,kind,.35).text,/正解とは 別/);
}
console.log('PASS sparse endpoint allowance, all strictness levels, boundary, gross displacement, reference-only wording');
