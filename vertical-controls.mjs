// Retain select/change behavior while keeping short choices in vertical buttons.
const bindings=new WeakMap();
const enhance=select=>{
 const signature=JSON.stringify([...select.options].map(o=>[o.value,o.textContent,o.disabled]));
 const previous=bindings.get(select);
 if(previous?.signature===signature){previous.sync();return;}
 if(previous){select.removeEventListener('change',previous.sync);previous.group.remove();bindings.delete(select);delete select.dataset.verticalChoices;select.hidden=false;}
 if(select.options.length>8||select.options.length<2)return;
 const group=document.createElement('div');group.className='vertical-choices';group.setAttribute('role','group');group.setAttribute('aria-label',select.labels?.[0]?.textContent.trim().split('\n')[0]||'設定をえらぶ');
 const sync=()=>{for(const b of group.children)b.setAttribute('aria-pressed',String(b.dataset.value===select.value));};
 for(const option of select.options){const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.dataset.value=option.value;button.disabled=option.disabled;button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();};group.append(button);}
 select.dataset.verticalChoices='true';select.hidden=true;select.after(group);select.addEventListener('change',sync);bindings.set(select,{signature,group,sync});sync();
};
const refresh=()=>{for(const select of document.querySelectorAll('select'))enhance(select);};
refresh();
document.querySelector('.shape-settings').addEventListener('shape-settings-reset',()=>queueMicrotask(refresh));
new MutationObserver(refresh).observe(document.getElementById('setupView'),{childList:true,subtree:true});
