"""Reproducible KanjiVG import. No source repository is modified.
Usage: python scripts/build-shape-data.py --svg ../kakijun/svg --parts ../kakijun/bushu-hunter/data
KanjiVG derived components/samples: Ulrich Apel, CC BY-SA 3.0.
Hunter candidate labels/ranges: existing attribution, CC BY-SA 4.0.
"""
import argparse, collections, hashlib, json, math, re, xml.etree.ElementTree as ET
from pathlib import Path
VERSION='shape-generator-1'
NS='{http://kanjivg.tagaini.net}'
def digest(data): return hashlib.sha256(data).hexdigest()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def sample_path(d):
    tokens=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',d)
    i=0; cmd=None; p=(0.,0.); start=p; previous=None; out=[]
    count={'M':2,'L':2,'H':1,'V':1,'C':6,'S':4,'Q':4,'T':2,'Z':0}
    while i<len(tokens):
        if tokens[i].isalpha(): cmd=tokens[i]; i+=1
        kind=cmd.upper(); relative=cmd.islower()
        if kind not in count: raise ValueError('unsupported SVG command '+cmd)
        if kind=='Z': out.append(start); p=start; cmd=None; continue
        a=list(map(float,tokens[i:i+count[kind]]));i+=count[kind]
        def point(x,y): return (x+p[0],y+p[1]) if relative else (x,y)
        old=p
        if kind in ('M','L','T'):
            end=point(*a)
            if kind=='T' and previous: control=(2*p[0]-previous[0],2*p[1]-previous[1])
            else: control=None
            if kind=='M':start=end;out.append(end);cmd='l' if relative else 'L'
            elif control:
                for j in range(1,25):
                    t=j/24;out.append(tuple((1-t)**2*old[k]+2*t*(1-t)*control[k]+t*t*end[k] for k in range(2)))
            else: out.append(end)
            p=end;previous=control
        elif kind in ('H','V'):
            p=((p[0]+a[0] if relative else a[0]),p[1]) if kind=='H' else (p[0],(p[1]+a[0] if relative else a[0]));out.append(p);previous=None
        else:
            if kind=='C': c1=point(*a[:2]);c2=point(*a[2:4]);end=point(*a[4:])
            elif kind=='S': c1=(2*p[0]-previous[0],2*p[1]-previous[1]) if previous else p;c2=point(*a[:2]);end=point(*a[2:])
            else: c1=point(*a[:2]);end=point(*a[2:]);c2=None
            for j in range(1,33):
                t=j/32
                out.append(tuple((1-t)**3*old[k]+3*t*(1-t)**2*c1[k]+3*t*t*(1-t)*c2[k]+t**3*end[k] if c2 else (1-t)**2*old[k]+2*t*(1-t)*c1[k]+t*t*end[k] for k in range(2)))
            p=end;previous=c2 or c1
    lengths=[0.]
    for a,b in zip(out,out[1:]):lengths.append(lengths[-1]+math.dist(a,b))
    result=[];j=1
    for k in range(48):
        length=k*lengths[-1]/47
        while j<len(lengths)-1 and lengths[j]<length:j+=1
        t=(length-lengths[j-1])/(lengths[j]-lengths[j-1] or 1)
        result.append({axis:round(out[j-1][n]+t*(out[j][n]-out[j-1][n]),5) for n,axis in enumerate(('x','y'))})
    return result
def bbox(lines):
    ps=[p for line in lines for p in line];return [min(p['x'] for p in ps),min(p['y'] for p in ps),max(p['x'] for p in ps),max(p['y'] for p in ps)]
def segment_gap(a,b):
    vx=b[1]['x']-b[0]['x'];vy=b[1]['y']-b[0]['y'];t=max(0,min(1,((a['x']-b[0]['x'])*vx+(a['y']-b[0]['y'])*vy)/(vx*vx+vy*vy or 1)))
    return math.hypot(a['x']-b[0]['x']-t*vx,a['y']-b[0]['y']-t*vy)
def gap(a,b):return min(segment_gap(p,(x,y)) for p in a[::4] for x,y in zip(b,b[1:]))
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--svg',type=Path,required=True);parser.add_argument('--parts',type=Path,required=True);args=parser.parse_args()
    root=Path(__file__).resolve().parent.parent;curr=read(root/'data/curriculum.json');hunter=read(args.parts/'kanji_parts.json')
    source={'generatorVersion':VERSION,'curriculumSha256':digest((root/'data/curriculum.json').read_bytes()),'svg':{'author':'Ulrich Apel','url':'https://kanjivg.tagaini.net/','license':'CC BY-SA 3.0'},'hunter':{'license':'CC BY-SA 4.0','files':{f:digest((args.parts/f).read_bytes()) for f in ('kanji_parts.json','radical_reference.json','bushu_validation.json','bushu_dictionary_review.json')}}}
    chars={};templates={};fixtures={};counts=collections.Counter()
    for char,glyph in curr['glyphs'].items():
        code=f'{ord(char):05x}';raw=(args.svg/(code+'.svg')).read_bytes();xml=ET.fromstring(raw);paths=[n for n in xml.iter() if n.tag.endswith('}path')];assert [p.get('d') for p in paths]==glyph['paths'],char+' path mismatch'
        samples=[sample_path(p.get('d')) for p in paths];path_ids={p.get('id'):i+1 for i,p in enumerate(paths)};components=[]
        def walk(n,parent=None):
            attrs={key:n.get(NS+key) for key in ('element','original','variant','position','part','number','partial','radical') if n.get(NS+key) is not None}
            if attrs.get('element'):
                strokes=[path_ids[p.get('id')] for p in n.iter() if p.tag.endswith('}path')];assert strokes
                ident=code+'.'+attrs['element']+'.'+('-'.join(map(str,strokes)))
                if any(c['id']==ident for c in components): ident+='.'+str(len(components))
                # Semantic variant and split-part metadata are retained in the profile.
                profile=attrs['element']+'.'+attrs.get('position',('standalone' if parent is None else 'nested'))
                if attrs.get('original'):profile+='.'+attrs['original']
                if attrs.get('part'):profile+='.part'+attrs['part']
                item={'id':ident,'parentId':parent,'formId':profile,'strokes':strokes,'attributes':attrs,'roles':{},'review':{'status':'pending','sourceIds':['kanjivg-'+code]},'sourceGroupId':n.get('id')};components.append(item);parent=ident
            for child in n:
                if child.tag.endswith('}g'):walk(child,parent)
        container=next(n for n in xml.iter() if n.get('id')=='kvg:StrokePaths_'+code);walk(container)
        inherited=[]
        for h in hunter[code]:
            ranges=h.get('ranges') or [[h['start'],h['end']]];indices=sorted(set(i+1 for a,b in ranges for i in range(a,b+1)));assert all(1<=i<=len(paths) for i in indices)
            inherited.append({**h,'strokes':indices,'source':'hunter','review':'candidate-only'})
        root_instance=components[0];root_instance['roles']={f'line-{i+1}':{'stroke':i+1} for i in range(len(paths))};rules=[]
        def add(instance,kind,layer,roles,parameters=None,category=None,label=None,text=None,template=None):
            identity=kind in ('strokePresence','topology','internalBars','lengthIdentity','protrusion','boundedEndpoint','crossing','separation') and layer=='identity'
            template=template or instance['formId']+'.'+kind
            # Definitions are shared; character instances carry only role bindings/overrides.
            definitions={'kind':kind,'layer':layer,'category':category or kind,'parameters':parameters or {},'label':label or instance['attributes']['element']+'の部分','text':text or 'この部分を、お手本と 比べよう。'}
            key=template+'.'+digest(json.dumps(definitions,ensure_ascii=False,sort_keys=True).encode())[:10]
            templates[key]={'id':key,'version':1,**definitions,'review':{'status':'pending' if identity else 'synthetic-candidate','sourceIds':['kanjivg-structure','design-spec']},'toleranceProfile':kind+'-v1','requires':['component-frame-stable','roles-matched'],'focusKind':'component-region' if kind in ('internalBars','componentAspect','strokePresence') else 'line-group','messageKey':kind}
            rules.append({'id':instance['id']+'.'+kind+'.'+'-'.join(roles),'version':1,'instanceId':instance['id'],'templateId':key,'roles':roles})
        allroles=list(root_instance['roles']);add(root_instance,'strokePresence','identity',allroles,category='structure',template='whole.presence',label='字の骨組み',text='足りない線や 余分な線を、お手本と 比べよう。')
        # Character-specific contact signatures remain candidates, never approved identity rules.
        relations=[]
        for i in range(len(samples)):
            for j in range(i+1,len(samples)):
                g=min(gap(samples[i],samples[j]),gap(samples[j],samples[i]))
                if g<2.5:relations.append({'a':f'line-{i+1}','b':f'line-{j+1}','relation':'contact','referenceGap':round(g,4)})
        if relations:add(root_instance,'topology','writing',allroles,{'relations':relations},'structureContact',template='whole.contacts',label='線のつながり（参考）',text='線のつながりを、お手本と 比べよう。')
        for instance in components:
            at=instance['attributes'];el=at['element'];ss=instance['strokes'];n=len(ss)
            if at.get('partial')=='true' or at.get('part'):continue
            roles=instance['roles']
            def bind(names):
                for name,i in names.items():roles[name]={'stroke':ss[i]}
            if el in ('目','日','曰','口') and n=={'目':5,'日':4,'曰':4,'口':3}[el]:
                # Folded roof keeps its horizontal/vertical segments within one stroke.
                bind({'leftWall':0,'roof':1,'bottom':n-1,**{f'bar-{i+1}':i+2 for i in range(n-3)}})
                add(instance,'internalBars','identity',list(roles),{'count':n-3},'internalBars',text=el+'の 中の 横線の 本数を、お手本と 比べよう。',template=el+'.bars')
                for name in [f'bar-{i+1}' for i in range(n-3)]:add(instance,'parallel','beauty',[name,'roof'],category='beautyParallel',text='この部分の 横線の 向きを、そろえてみよう。',template=el+'.parallel')
                if n==5:add(instance,'spacing','beauty',['roof','bar-1','bar-2','bottom'],category='beautySpacing',text='目の 中の 横線の あいだを、そろえてみよう。',template='eye.spacing')
            if el=='月' and n==4:
                bind({'leftWall':0,'roof':1,'bar-1':2,'bar-2':3})
                profile={'standalone':(.28,.70),'right':(.24,.67),'left':(.20,.58),'bottom':(.42,1.10)}.get(at.get('position','standalone' if instance['parentId'] is None else 'nested'),(.22,.85))
                if at.get('original')=='肉':profile=(.22,.72) if at.get('position')=='left' else (.30,1.12)
                add(instance,'componentAspect','beauty',['leftWall','roof'],{'range':profile},'beautyAspect',text='月の 部分の 本体を、少し 細めにしてみよう。')
            if el in ('土','士','木','未','末','王','玉','牛','午','干','千','本'):
                horiz=[i for i in ss if paths[i-1].get(NS+'type','').startswith('㇐')]
                # Only explicit, complete distinguishers receive identity comparisons.
                if el in ('土','士','未','末') and len(horiz)>=2 and char==el:
                    bind({'upperBar':ss.index(horiz[0]),'lowerBar':ss.index(horiz[1])})
                    longer,shorter=('lowerBar','upperBar') if el in ('土','未') else ('upperBar','lowerBar')
                    add(instance,'lengthIdentity','identity',[longer,shorter],{'axis':'horizontal'},'identityLength',text=el+'の 上下の 横線の 長さを、お手本と 比べよう。',template=el+'.distinction')
                if el in ('土','王') and at.get('position')=='left' and n in (3,4):
                    bind({'risingBase':n-1,'upperBar':0});add(instance,'risingStroke','writing',['risingBase','upperBar'],category='writingRise',text='へんの 下の線を、右上に はらい上げよう。',template=el+'.left.rise')
            if el=='金' and n==8:
                bind({'upperBar':2,'middleBar':3,'lowerBar':7,'stem':4,'roofLeft':0,'roofRight':1})
                if at.get('position')=='left':
                    add(instance,'risingStroke','writing',['lowerBar','upperBar'],category='writingRise',text='金へんの 下の線を、右上に はらい上げよう。',template='metal.left.rise')
                    for side,role in [('above','upperBar'),('below','lowerBar')]:add(instance,'boundedEndpoint','writing',['stem',role],{'side':side},'writingBounds',text='金へんの 縦線の '+('上' if side=='above' else '下')+'を、横線の 内側に 収めよう。',template='metal.left.bound.'+side)
                    add(instance,'contact','writing',['roofRight','roofLeft'],{'end':'start'},'writingContact',text='金へんの 上の二本を、つなげよう。',template='metal.left.roof-contact')
                else:
                    for a,b in [('lowerBar','middleBar'),('middleBar','upperBar')]:add(instance,'lengthOrder','beauty',[a,b],{'axis':'horizontal'},'beautyLength',text='金の 下の横線を 長く、上の横線を 短くしてみよう。',template='metal.standalone.length')
            if el=='刂' and n==2:
                bind({'shortStem':0,'longStem':1});add(instance,'lengthOrder','beauty',['longStem','shortStem'],{'axis':'vertical'},'beautyLength',text='りっとうの 右の縦線を、左より 長くしてみよう。',template='knife.right.length')
            if el=='矢' and n==5:
                bind({'ending':4,'lowerBar':2,'stem':3})
                if char=='知':
                    instance['formId']='arrow.left-compact';add(instance,'compactEnding','writing',['ending','lowerBar'],{'tailRatio':.34,'endpointRatio':1.10},'compactEnding',text='矢の 最後の線を、少し 短く 収めよう。',template='arrow.left-compact.ending')
                else:add(instance,'sweepGeometry','writing',['ending','lowerBar'],category='writingSweep',text='矢の 最後の はらいの 向きを、比べよう。',template='arrow.sweep')
            if el in ('三','龶'):
                hs=[i for i in ss if paths[i-1].get(NS+'type','').startswith('㇐')]
                if len(hs)==3:
                    for name,i in zip(('upperBar','middleBar','lowerBar'),hs):roles[name]={'stroke':i}
                    for a,b in [('lowerBar','upperBar'),('upperBar','middleBar')]:add(instance,'lengthOrder','beauty',[a,b],{'axis':'horizontal'},'beautyLength',text='下の横線を 長く、まんなかを 短くしてみよう。',template=el+'.length')
            # Each stroke's named type supplies writing candidates, not a mandated printed form.
            for i in (ss if instance is root_instance else []):
                if any(t and t[0] in '㇁㇂㇃㇆㇈㇉㇚㇙㇟㇖㇠' for t in paths[i-1].get(NS+'type','').split('/')):
                    role='ending-'+str(i);roles[role]={'stroke':i};add(instance,'hookGeometry','writing',[role],category='writingHook',label=str(i)+'画目の終わり',text=str(i)+'画目の 終わりの 向きを、比べよう。',template='hook.geometry')
            hs=[i for i in (ss if instance is root_instance else []) if paths[i-1].get(NS+'type','').startswith('㇐')]
            for i in hs:
                role='horizontal-'+str(i);roles[role]={'stroke':i};add(instance,'upwardSlope','beauty',[role],category='beautySlope',label=str(i)+'画目の横線',text=str(i)+'画目の 横線を、少し 右上がりにしてみよう。',template='horizontal.slope')
        # Explicit protrusion distinctions, with source/shape review still pending.
        distinctions={'夫':(3,1,True),'天':(3,1,False),'牛':(4,2,True),'午':(4,2,False),'干':(3,1,False),'千':(3,1,False)}
        if char in distinctions:
            stem,bar,protrudes=distinctions[char];root_instance['roles']['distinguishingStem']={'stroke':stem};root_instance['roles']['distinguishingBar']={'stroke':bar}
            add(root_instance,'protrusion' if protrudes else 'boundedEndpoint','identity',['distinguishingStem','distinguishingBar'],{'side':'above'},'identityExtent',text='まんなかの線の 上の長さを、お手本と 比べよう。',template=char+'.extent')
        fixtures[char]=samples
        counts.update(r['templateId'].split('.')[0] for r in rules)
        chars[char]={'char':char,'unicode':'U+'+f'{ord(char):04X}','grade':glyph['grade'],'svgSha256':digest(raw),'components':components,'hunterCandidates':inherited,'strokeTypes':[p.get(NS+'type','') for p in paths],'rules':rules,'review':{'human':'pending','realHandwriting':'not-collected','synthetic':'not-run'},'incompleteReasons':['identity-source-and-form-review-pending','child-handwriting-calibration-pending','not-all-character-specific-details-covered']}
    (root/'qa/shape').mkdir(parents=True,exist_ok=True)
    (root/'qa/shape/reference-fixtures.json').write_text(json.dumps(fixtures,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    data={'version':1,'ruleSetVersion':'elementary-shape-1','source':source,'characters':chars};rules={'version':1,'templates':templates}
    (root/'data/shape-components.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');(root/'data/shape-rules.json').write_text(json.dumps(rules,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'characters':len(chars),'instances':sum(len(c['components']) for c in chars.values()),'rules':sum(len(c['rules']) for c in chars.values()),'templates':len(templates),'generator':VERSION}))
if __name__=='__main__': main()
