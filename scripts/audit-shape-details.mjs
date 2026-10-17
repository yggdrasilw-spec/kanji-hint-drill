import fs from 'node:fs';
import assert from 'node:assert/strict';
import {configureShapeData,checkCharacterShape,normalizeShapeSettings,rulesForCharacter} from '../shape-rules.mjs';
import catalog from '../data/shape-detail-reference.mjs';
import {ENGINE_VERSION} from '../shape/policy.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const components=read('data/shape-components.json'),rules=read('data/shape-rules.json'),fixtures=read('qa/shape/reference-fixtures.json');configureShapeData(components,rules);
const settings=normalizeShapeSettings(Object.fromEntries(Object.keys(normalizeShapeSettings()).map(key=>[key,key==='count'?'normal':'normal'])));settings.beautySlope='off';
const rows=[],counts={pass:0,fail:0,uncertain:0,unavailable:0,skipped:0};let active=0;
for(const [char,reference] of Object.entries(fixtures)){
 const allRules=rulesForCharacter(char),inventory=allRules.filter(r=>r.kind.startsWith('detail')),n=reference.length,pairs=inventory.filter(r=>r.kind==='detailPair');
 assert.equal(pairs.length,n*(n-1)/2,char+' all pairs');
 for(const kind of ['detailStart','detailEnd','detailPath','detailFinish','detailLength'])assert.equal(inventory.filter(r=>r.kind===kind).length,n,char+' '+kind);
 assert.equal(inventory.filter(r=>r.kind==='detailComponent').length,components.characters[char].components.length-1,char+' component inventory');
 const result=checkCharacterShape(char,reference,reference,settings),details=result.results.filter(r=>r.kind.startsWith('detail')),summary={pass:0,fail:0,uncertain:0,unavailable:0,skipped:0};
 for(const row of details){summary[row.status]++;counts[row.status]++;if(row.status!=='skipped')active++;assert.equal(row.status,'pass',char+' '+row.ruleId+' '+row.reasonCode);assert.ok(row.focus&&row.focus.actualIndices.length,char+' located '+row.ruleId);}
 rows.push({char,totalRules:allRules.length,grade:components.characters[char].grade,strokes:n,pairs:pairs.length,detailRules:details.length,reference:summary,allReferenceDetailsWithinNormalTolerance:true});
}
const output={version:1,engineVersion:ENGINE_VERSION,source:catalog.source,tests:{referenceCharacters:rows.length,totalRules:rows.reduce((sum,row)=>sum+row.totalRules,0),maximumRulesPerCharacter:Math.max(...rows.map(row=>row.totalRules)),referenceDetailChecks:active,counts,geometryInventoryComplete:true,allReferenceDetailsWithinNormalTolerance:true,recognitionModelTested:false,realHandwritingCalibrated:false,educationalReviewComplete:false},characters:rows};
const path=new URL('../data/shape-detail-validation.json',import.meta.url),text=JSON.stringify(output,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),text,'stale validation report');else fs.writeFileSync(path,text);
console.log(JSON.stringify(output.tests));
