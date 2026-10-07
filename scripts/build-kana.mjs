import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),source=process.argv[2]||'C:/Users/user/kakijun/svg',glyphs={};
for(let n=0x3041;n<=0x3096;n++){
 const file=path.join(source,n.toString(16).padStart(5,'0')+'.svg');
 if(!fs.existsSync(file))continue;
 const svg=fs.readFileSync(file,'utf8');
 const paths=[...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m=>m[1]);
 if(paths.length)glyphs[String.fromCodePoint(n)]={paths};
}
fs.writeFileSync(path.join(root,'data/kana.json'),JSON.stringify({source:'KanjiVG / Ulrich Apel',license:'CC BY-SA 3.0',glyphs}));
console.log('Kana glyphs:',Object.keys(glyphs).length);
