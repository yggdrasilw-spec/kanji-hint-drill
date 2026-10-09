import assert from 'node:assert/strict';
import {protrusionFocus} from '../shape-rules.mjs';
const horizontal=[{x:40,y:30},{x:90,y:30}];
function contains(focus,point){assert.ok(Math.hypot(point.x-focus.point.x,point.y-focus.point.y)+2<focus.radius,'endpoint/ink must fit inside the circle');}
for(const tip of [{x:60,y:31},{x:60,y:56},{x:60,y:15},{x:42,y:30}]){
 const focus=protrusionFocus(tip,horizontal,12,10);contains(focus,tip);contains(focus,focus.acrossPoint);assert.equal(focus.acrossPoint.y,30);assert.equal(focus.stroke,12);assert.equal(focus.across,10);
}
const close=protrusionFocus({x:60,y:31},horizontal,12,10),far=protrusionFocus({x:60,y:56},horizontal,12,10);assert.ok(far.radius>close.radius);assert.deepEqual(far.point,{x:60,y:43});
const crooked=protrusionFocus({x:60,y:52},[{x:40,y:30},{x:60,y:35},{x:90,y:28}],12,10);contains(crooked,crooked.tip);contains(crooked,crooked.acrossPoint);assert.deepEqual(crooked.acrossPoint,{x:60,y:35});
const rotate=p=>({x:p.y+3,y:-p.x+100}),rotated=protrusionFocus(rotate({x:60,y:56}),horizontal.map(rotate),12,10);contains(rotated,rotated.tip);contains(rotated,rotated.acrossPoint);assert.deepEqual(rotated.point,rotate(far.point));assert.equal(rotated.radius,far.radius);
const duplicate=protrusionFocus({x:60,y:56},[horizontal[0],horizontal[0],horizontal[1]],12,10);contains(duplicate,duplicate.tip);contains(duplicate,duplicate.acrossPoint);
console.log('PASS: distant tips and both ink anchors fit, dynamic center/radius, curved/slanted/rotated horizontals, duplicate points');
