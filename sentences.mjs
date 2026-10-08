import {sentenceGroups} from './data/sentences.mjs';
export function parseWord(value){
 const parts=[];let offset=0;
 for(const m of value.matchAll(/([\p{Script=Han}々])\(([^)]+)\)/gu)){
  if(m.index>offset){const text=value.slice(offset,m.index);parts.push({text,reading:text});}
  parts.push({text:m[1],reading:m[2]});offset=m.index+m[0].length;
 }
 if(offset<value.length){const text=value.slice(offset);parts.push({text,reading:text});}
 return {parts,word:parts.map(p=>p.text).join(''),reading:parts.map(p=>p.reading).join('')};
}
export const sentenceBank=sentenceGroups.flatMap(([template,words],group)=>words.split(/\s+/).filter(Boolean).map((value,index)=>({key:`s${group}-${index}`,template,...parseWord(value)})));
export function sentenceQuestions(data,grade,chars,multiple=true){
 const known=new Set(chars);
 for(const [c,g] of Object.entries(data.glyphs))if(g.grade<Number(grade))known.add(c);
 const result=[];
 const level=s=>Math.max(...s.parts.map(p=>data.glyphs[p.text]?.grade||0));
 for(const char of chars){
  const all=sentenceBank.filter(s=>s.parts.filter(p=>p.text===char).length===1);
  const appropriate=all.filter(s=>level(s)<=Number(grade));
  const candidates=appropriate.length?appropriate:all.sort((a,b)=>level(a)-level(b)).slice(0,1);
  for(const s of candidates.slice(0,multiple?5:1)){
   const displayWord=s.parts.map(p=>/[\p{Script=Han}]/u.test(p.text)&&!known.has(p.text)?p.reading:p.text).join('');
   const [before,after]=s.template.split('{}');
   result.push({id:`${char}|${s.word}|${s.reading}|${s.key}`,char,word:s.word,reading:s.reading,displayWord,masked:displayWord.replace(char,'□'),before,after,sentence:before+displayWord+after,sentenceKey:s.key,requiresHint:false,acceptedReadings:[s.reading]});
  }
 }
 return result;
}
