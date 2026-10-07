import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const sources=[
 ['https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/download/v2.0/char_classifier_onnx.zip','source/model.zip'],
 ['https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/download/v2.0/char_classifier_labels.zip','source/labels.zip'],
 ['https://raw.githubusercontent.com/dariyooo/DaKanji-Single-Kanji-Recognition/v2.0/LICENSE','assets/DAKANJI-LICENSE.txt'],
 ['https://www.edrdg.org/kanjidic/kanjidic2.xml.gz','source/kanjidic2.xml.gz'],
 ['https://www.edrdg.org/pub/Nihongo/JMdict_e.gz','source/JMdict_e.gz'],
 ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.js','assets/ort.wasm.min.js'],
 ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.mjs','assets/ort-wasm-simd-threaded.mjs'],
 ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm','assets/ort-wasm-simd-threaded.wasm'],
 ['https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/LICENSE','assets/ONNXRUNTIME-LICENSE.txt'],
];
for(const [url,file] of sources){
 const dest=path.join(root,file);await fs.mkdir(path.dirname(dest),{recursive:true});
 if(await fs.stat(dest).then(s=>s.size>0).catch(()=>false)){console.log('cached',file);continue;}
 const response=await fetch(url);if(!response.ok)throw new Error(`${response.status} ${url}`);
 const bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(dest,bytes);console.log(file,bytes.length);
}
