import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..');
const cache='C:/Users/user/.cache/kanji-curriculum';
const reference=fs.readFileSync('C:/Users/user/kakijun/kanjiiri.html','utf8');
const gradeLists=Object.fromEntries([1,2,3,4,5,6].map(g=>[g,JSON.parse(reference.match(new RegExp(`^\\s*${g}:\\s*(\\[[^\\r\\n]+\\]),?\\s*$`,'m'))[1])]));
const g1rows=[
 ['上','かぞえうた','一:114 二:114 三:114 四:114 五:114 六:115 七:115 八:115 九:115 十:115'],
 ['上','かんじのはなし','木:126 山:126 川:127 目:127 月:127 上:128 下:128'],
 ['下','おはなしをよもう／サラダでげんき','大:8 中:8 入:8 犬:10 小:12 白:14 出:14 力:16'],
 ['下','なにに見えるかな','見:30 先:30 生:30 気:35'],
 ['下','よう日と日づけ','日:36 月:36 火:36 水:36 金:36 土:36'],
 ['下','はっけんしたよ','花:38 文:38 音:39 町:41'],
 ['下','ひらがなをつかおう1','字:42'],
 ['下','ふねのせつめいをよもう／いろいろなふね','休:44 人:44 車:46'],
 ['下','のりもののカードをつくろう','本:52'],
 ['下','すきなきょうかをはなそう','学:58 校:58'],
 ['下','こころにとどけてよもう／おとうとねずみチロ','手:70 赤:71 青:71 名:72 立:74 口:76 耳:77'],
 ['下','かん字をつかおう1','女:83 子:83 男:83'],
 ['下','すきなおはなしはなにかな','年:85'],
 ['下','おはなしをかこう','村:97'],
 ['下','ちがいをかんがえてよもう／子どもをまもるどうぶつたち','早:108 足:108'],
 ['下','かん字をつかおう2','右:120 左:120 田:120 千:120 百:120 円:120'],
 ['下','すきなところをつたえよう／スイミー','貝:122 糸:128 林:128'],
 ['下','かたちのにているかん字','玉:138 王:138 正:139 雨:139 石:138'],
 ['下','一年かんのおもいでブック','草:142'],
 ['下','かん字をつかおう4','森:144 天:144 竹:144 虫:144 夕:144 空:144'],
];
// Grade 1 lower-volume 月 is a reading addition, already introduced in upper.
g1rows.find(r=>r[1]==='よう日と日づけ')[2]='日:36 火:36 水:36 金:36 土:36';
const parse=s=>s.split(' ').map(x=>{const[text,p]=x.split(':');return{text,pages:p.split(',').map(Number)};});
const grades=[{grade:1,units:g1rows.map(([volume,title,chars],i)=>({id:`g1-${String(i+1).padStart(2,'0')}`,volume,title,newCharacters:parse(chars)}))}];
for(let g=2;g<=6;g++){
 const src=JSON.parse(fs.readFileSync(path.join(cache,`tokyo-shoseki-grade${g}.json`)));
 grades.push({grade:g,units:src.units.map(u=>({id:u.id,volume:u.volume,title:u.title,newCharacters:u.newCharacters,readingAdditions:u.readingAdditions||[]}))});
}
const gradeOf=Object.fromEntries(Object.entries(gradeLists).flatMap(([g,cs])=>cs.map(c=>[c,+g])));
for(const g of grades){const cs=g.units.flatMap(u=>u.newCharacters.map(c=>c.text));const missing=gradeLists[g.grade].filter(c=>!cs.includes(c));if(missing.length||new Set(cs).size!==gradeLists[g.grade].length||cs.length!==new Set(cs).size)throw Error(JSON.stringify({grade:g.grade,count:cs.length,missing,duplicates:cs.filter((c,i)=>cs.indexOf(c)!==i)}));}
const tag=(s,t)=>[...s.matchAll(new RegExp(`<${t}(?: [^>]*)?>([^<]*)</${t}>`,'g'))].map(m=>m[1]);
const kd=gunzipSync(fs.readFileSync(path.join(root,'source/kanjidic2.xml.gz'))).toString('utf8');
const glyphs={};
for(const char of Object.keys(gradeOf)){
 const code=char.codePointAt(0).toString(16).padStart(5,'0');
 const svg=fs.readFileSync(`C:/Users/user/kakijun/svg/${code}.svg`,'utf8');
 const paths=[...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m=>m[1]);
 if(!paths.length)throw Error(`Missing strokes: ${char}`);
 glyphs[char]={paths,grade:gradeOf[char],readings:[],words:[]};
}
for(const m of kd.matchAll(/<character>([\s\S]*?)<\/character>/g)){
 const c=tag(m[1],'literal')[0];if(!glyphs[c])continue;
 glyphs[c].readings=[...m[1].matchAll(/<reading r_type="(ja_on|ja_kun)">([^<]+)<\/reading>/g)].map(r=>({type:r[1]==='ja_on'?'音':'訓',reading:r[2]}));
}
const jm=gunzipSync(fs.readFileSync(path.join(root,'source/JMdict_e.gz'))).toString('utf8');
const kana=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
const candidates=new Map();
for(const m of jm.matchAll(/<entry>([\s\S]*?)<\/entry>/g)){
 const e=m[1];if(/&(arch|obs|rare|vulg|sens);/.test(e))continue;
 const writings=tag(e,'keb').filter(w=>w.length<=5&&[...w].filter(c=>gradeOf[c]).length>0&&[...w].every(c=>gradeOf[c]||/[ぁ-ゖー]/.test(c)));
 if(!writings.length)continue;
 const pri=/<(?:ke|re)_pri>(ichi1|news1|spec1|gai1)<\//.test(e)?0:/<(?:ke|re)_pri>/.test(e)?1:3;
 for(const r of e.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)){
  const reading=tag(r[1],'reb')[0],restrict=tag(r[1],'re_restr');if(!reading||/<re_nokanji/.test(r[1])||!/[ぁ-ゖ]/.test(reading))continue;
  for(const word of writings){if(restrict.length&&!restrict.includes(word))continue;
   for(const char of new Set([...word].filter(c=>gradeOf[c]))){if([...word].filter(c=>c===char).length!==1)continue;
    const item={word,reading:kana(reading),rank:pri*10+word.length,knownGrade:Math.max(...[...word].map(c=>gradeOf[c]||0))};
    const arr=candidates.get(char)||[];if(!arr.some(x=>x.word===word&&x.reading===item.reading))arr.push(item);candidates.set(char,arr);
   }
  }
 }
}
for(const [c,v] of Object.entries(glyphs)){
 const arr=(candidates.get(c)||[]).sort((a,b)=>a.knownGrade-b.knownGrade||a.rank-b.rank);
 // Keep grade-diverse common compounds and multiple readings for each character.
 const chosen=[];
 for(let max=1;max<=6;max++){const eligible=arr.filter(a=>a.knownGrade<=max).sort((a,b)=>a.rank-b.rank);for(const a of eligible.slice(0,8))if(!chosen.some(x=>x.word===a.word&&x.reading===a.reading))chosen.push(a);}
 v.words=chosen;
}
const curated={
 '一':[['一つ','ひとつ'],['一日','いちにち']], '二':[['二つ','ふたつ'],['二月','にがつ']], '三':[['三つ','みっつ'],['三月','さんがつ']],
 '四':[['四つ','よっつ'],['四月','しがつ']], '五':[['五つ','いつつ'],['五月','ごがつ']], '六':[['六つ','むっつ'],['六月','ろくがつ']],
 '七':[['七つ','ななつ'],['七月','しちがつ']], '八':[['八つ','やっつ'],['八月','はちがつ']], '九':[['九つ','ここのつ'],['九月','くがつ']],
 '十':[['十','じゅう'],['十月','じゅうがつ']], '木':[['木','き'],['木曜日','もくようび']], '山':[['山','やま'],['火山','かざん']],
 '川':[['川','かわ'],['河川','かせん']], '上':[['上','うえ'],['上下','じょうげ']], '下':[['下','した'],['上下','じょうげ']],
 '月':[['月','つき'],['一月','いちがつ']], '目':[['目','め'],['目次','もくじ']], '生':[['生きる','いきる'],['先生','せんせい']],
 '大':[['大きい','おおきい'],['大学','だいがく']], '小':[['小さい','ちいさい'],['小学校','しょうがっこう']], '日':[['日','ひ'],['日本','にほん']],
 '人':[['人','ひと'],['人間','にんげん']], '空':[['空','そら'],['空気','くうき']], '車':[['車','くるま'],['電車','でんしゃ']],
 '水':[['水','みず'],['水曜日','すいようび']], '金':[['金','きん'],['お金','おかね']], '白':[['白い','しろい'],['白紙','はくし']],
 '明':[['明るい','あかるい'],['発明','はつめい']], '行':[['行く','いく'],['銀行','ぎんこう']], '楽':[['楽しい','たのしい'],['音楽','おんがく']],
 '読':[['読む','よむ'],['読書','どくしょ']], '書':[['書く','かく'],['図書館','としょかん']], '長':[['長い','ながい'],['校長','こうちょう']],
};
for(const [c,arr] of Object.entries(curated))for(const [word,reading] of arr.reverse())glyphs[c].words.unshift({word,reading,rank:-10,knownGrade:Math.max(...[...word].map(x=>gradeOf[x]||0)),curated:true});
const data={publisher:'東京書籍',series:'新編 新しい国語',schoolYear:2026,grades,glyphs};
fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.mkdirSync(path.join(root,'assets'),{recursive:true});
fs.writeFileSync(path.join(root,'data/curriculum.json'),JSON.stringify(data));
fs.copyFileSync(path.join(root,'source/model/char_classifier.onnx'),path.join(root,'assets/recognizer.onnx'));
const labels=[...fs.readFileSync(path.join(root,'source/labels/char_classifier_labels.txt'),'utf8').trim()];fs.writeFileSync(path.join(root,'assets/labels.json'),JSON.stringify(labels));
if(labels.length<1026||Object.keys(glyphs).some(c=>!labels.includes(c)))throw Error('Recognition label coverage is incomplete');
fs.writeFileSync(path.join(root,'data/provenance.json'),JSON.stringify({curriculum:'ユーザー提供の令和8年度 東京書籍 新編 新しい国語の画面画像を転記。学習月ではなく教材の単元・掲載ページ。読み方の単元初出は未転記。',strokeData:{source:'https://kanjivg.tagaini.net/',author:'Ulrich Apel',license:'CC BY-SA 3.0',localSource:'既存のkakijun/svg'},vocabulary:{sources:['https://www.edrdg.org/kanjidic/kanjidic2.xml.gz','https://www.edrdg.org/pub/Nihongo/JMdict_e.gz'],author:'Electronic Dictionary Research and Development Group',license:'CC BY-SA 4.0',description:'辞書の語彙例＋独自の低学年語彙。語彙に含まれる漢字は出題範囲・既習学年で絞る。教科書での読みの既習は保証しない。'},recognition:{source:'https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0',author:'Dariyooo (DaAppLab)',license:'MIT'}},null,2));
console.log(JSON.stringify({grades:grades.map(g=>({grade:g.grade,units:g.units.length,characters:g.units.reduce((n,u)=>n+u.newCharacters.length,0)})),glyphs:Object.keys(glyphs).length,labels:labels.length,withoutWords:Object.entries(glyphs).filter(([,g])=>!g.words.length).map(([c])=>c)}));
