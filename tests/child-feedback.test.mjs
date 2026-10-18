import assert from 'node:assert/strict';
import fs from 'node:fs';
import {childFeedback,wholeCanvasFeedback} from '../shape/child-feedback.mjs';
import {configureShapeData,checkCharacterShape,normalizeShapeSettings} from '../shape-rules.mjs';
const say=(kind,observed={},expected={},parameters={})=>childFeedback({kind,referenceStrokeNumbers:[1,2],observed,expected,status:'fail',confidence:'high'},{rule:{parameters}}).childText;
assert.match(say('detailPair',{gap:0},{relation:'S',maximum:.2}),/1かくめと 2かくめは、はなそう。くっつけない/);
assert.match(say('detailPair',{gap:.3},{relation:'S',maximum:.2}),/ちかづけよう/);
assert.match(say('detailPair',{}, {relation:'T'}),/くっつけて とめよう。つきぬけない/);
assert.match(say('detailPair',{crossed:false},{relation:'C'}),/1かくめと 2かくめは、つきぬける/);
assert.match(say('detailPair',{crossed:true,depthA:.1,depthB:.01},{relation:'C'}),/つきぬけているよ。2かくめ/);
assert.match(say('protrusion',{}, {},{side:'above'}),/1かくめは、2かくめを つきぬけて、うえに/);
assert.match(say('boundedEndpoint',{}, {},{side:'below'}),/したに ださない/);
assert.match(say('detailLength',{ratio:.5}),/ながく/);assert.match(say('detailLength',{ratio:1.6}),/みじかく/);
assert.match(say('lengthRatio',{ratio:.1},{},{minimum:.25}),/2かくめを、もうすこし ながく/);
assert.match(say('upwardSlope',{angle:25},{maximum:16}),/さげよう/);assert.match(say('upwardSlope',{angle:-5},{maximum:16}),/あげよう/);
assert.match(say('componentAspect',{aspect:1},{maximum:.5}),/ほそながく/);assert.match(say('componentAspect',{aspect:.2},{maximum:.5}),/ひろく/);
assert.match(say('hookGeometry'),/1かくめの おわりは、きちんと はねよう/);
assert.match(say('spacing'),/すきまを おなじ くらい/);
assert.doesNotMatch(childFeedback({kind:'contact',confidence:'low',referenceStrokeNumbers:[1,2]}).childText,/くっつけよう/);
const context={rule:{parameters:{}},details:{reference:[[{x:0,y:0},{x:1,y:0}]],drawn:[[{x:.1,y:0},{x:1.1,y:0}]]}};
assert.match(childFeedback({kind:'detailStart',referenceStrokeNumbers:[1],observed:{}},context).childText,/ひだり/);
context.details.drawn[0][0].x=-.1;assert.match(childFeedback({kind:'detailStart',referenceStrokeNumbers:[1],observed:{}},context).childText,/みぎ/);
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const fixtures=read('qa/shape/reference-fixtures.json');configureShapeData(read('data/shape-components.json'),read('data/shape-rules.json'));
const ref=fixtures['土'],scaled=ref.map(line=>line.map(p=>({x:55+(p.x-55)*.4,y:55+(p.y-55)*.4})));
assert.equal(wholeCanvasFeedback(scaled,ref,'off').length,0);assert.match(wholeCanvasFeedback(scaled,ref,'normal')[0].childText,/ぜんたいを、もうすこし おおきく/);
const wide=ref.map(line=>line.map(p=>({x:p.x,y:55+(p.y-55)*.5})));
assert.ok(wholeCanvasFeedback(wide,ref,'normal').some(r=>/ほそながく/.test(r.childText)));
const defaults=normalizeShapeSettings({beautyLayout:'normal'}),visible=checkCharacterShape('土',scaled,ref,defaults),hidden=checkCharacterShape('土',scaled,ref,{...defaults,beautyLayout:'off'});
assert.ok(visible.presentationHints.length);assert.equal(hidden.presentationHints.length,0);assert.equal(visible.status,hidden.status);
assert.equal(checkCharacterShape('土',scaled,ref,defaults,{overrides:{'土':{categories:{beautyLayout:'off'}}}}).presentationHints.length,0);
assert.ok(!visible.results.some(r=>r.kind==='canvasBeauty'),'whole-letter hints never enter scoring');
const kinds=new Set();let messages=0;
for(const [char,reference] of Object.entries(fixtures)){
 const settings=normalizeShapeSettings(Object.fromEntries(Object.keys(defaults).map(k=>[k,'normal'])));
 const result=checkCharacterShape(char,reference,reference,settings);
 for(const row of result.results){if(['skipped','unavailable'].includes(row.status))continue;kinds.add(row.kind);assert.ok(row.childText,char+' '+row.kind);assert.ok(row.childLabel);assert.doesNotMatch(row.childText+row.childLabel,/[\u3400-\u9fff]|undefined|NaN/);messages++;}
}
assert.ok(kinds.size>=20);console.log('PASS '+messages+' child messages across 1026 characters; directional actions, uncertain wording, optional whole-letter beauty hints and unchanged scoring');
