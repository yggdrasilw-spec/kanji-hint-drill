import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url)));
const data=read('shape-components'),rules=read('shape-rules'),curriculum=read('curriculum');
assert.equal(data.version,1);assert.equal(rules.version,1);assert.deepEqual(Object.keys(data.characters).sort(),Object.keys(curriculum.glyphs).sort());
const kinds=new Set(['strokePresence','topology','internalBars','lengthIdentity','lengthOrder','lengthRatio','componentAspect','spacing','parallel','upwardSlope','protrusion','boundedEndpoint','contact','crossing','separation','compactEnding','risingStroke','sweepGeometry','hookGeometry']);
let count=0,instances=0;const impact={};
for(const [char,c] of Object.entries(data.characters)){
 assert.equal(c.char,char);assert.equal(c.grade,curriculum.glyphs[char].grade);assert.match(c.svgSha256,/^[a-f0-9]{64}$/);assert.equal(c.strokeTypes.length,curriculum.glyphs[char].paths.length);
 const map=new Map(c.components.map(i=>[i.id,i]));assert.equal(map.size,c.components.length);
 for(const i of map.values()){
  assert.ok(!i.parentId||map.has(i.parentId));assert.ok(i.formId);assert.equal(new Set(i.strokes).size,i.strokes.length);for(const n of i.strokes)assert.ok(Number.isInteger(n)&&n>=1&&n<=c.strokeTypes.length);
  for(const role of Object.values(i.roles))assert.ok(i.strokes.includes(role.stroke));
  const seen=new Set();let node=i;while(node?.parentId){assert.ok(!seen.has(node.parentId),'component cycle');seen.add(node.parentId);node=map.get(node.parentId);}
 }
 const ids=new Set();for(const r of c.rules){
  assert.ok(!ids.has(r.id),'duplicate rule '+r.id);ids.add(r.id);const t=rules.templates[r.templateId];assert.ok(t&&map.has(r.instanceId));assert.equal(r.version,t.version);assert.ok(kinds.has(t.kind));assert.ok(['identity','writing','beauty'].includes(t.layer));assert.ok(t.category&&t.toleranceProfile&&t.requires.length&&t.focusKind&&t.messageKey&&t.review.sourceIds.length);
  assert.ok(r.roles.length);for(const role of r.roles)assert.ok(map.get(r.instanceId).roles[role],r.id+' missing '+role);
  for(const p of t.parameters.relations||[])assert.ok(r.roles.includes(p.a)&&r.roles.includes(p.b));
  if(t.layer==='identity')assert.equal(t.review.status,'pending','New identity rules require actual human source/form review before approval');
  (impact[r.templateId]??=[]).push({char,instanceId:r.instanceId,ruleId:r.id});count++;
 }instances+=map.size;
}
fs.mkdirSync(new URL('../qa/shape/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../qa/shape/rule-impact.json',import.meta.url),JSON.stringify(impact,null,2)+'\n');
console.log('PASS: schema, exact curriculum scope, unique occurrence/rule IDs, hierarchy, stroke roles, source/version/review contracts, affected-character index',JSON.stringify({characters:1026,instances,rules:count,templates:Object.keys(rules.templates).length}));
