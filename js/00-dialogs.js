/* ── IN-APP DIALOGS ──────────────────────────────────────────────────────────────
   The browser's prompt() / confirm() / alert() are gone from HQ (2026-09-08):
   they look like a different product, cannot be styled, block the whole tab,
   and iOS treats them badly inside an installed app. These four replace them,
   with the same shape so the ~370 call sites could be rewritten mechanically:

     await uiPrompt(label, defaultValue, {type, placeholder, required, ok, hint})
           → string, or null when cancelled            (was: prompt())
     await uiConfirm(message, {ok, cancel, danger, title})
           → true / false                              (was: confirm())
           uiAlert(message, {title})                   (was: alert(); returns a
           promise but nothing needs to await it — the box closes itself)
     await uiForm(title, [{k, l, t, v, opts, req, hint}], {ok})
           → {k: value} or null — several fields in one box, for the flows
             that used to chain three prompts in a row

   One box at a time; Enter confirms, Escape cancels; focus lands on the field;
   the overlay click cancels. Everything is HTML-escaped — labels may carry a
   record's name. */
let _uiQueue = Promise.resolve();
function _uiEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _uiRoot(){
  let r=document.getElementById('uidlg');
  if(!r){ r=document.createElement('div'); r.id='uidlg'; r.className='uidlg'; r.innerHTML='<div class="uidlg-bg"></div><div class="uidlg-box" role="dialog" aria-modal="true"></div>'; document.body.appendChild(r); }
  return r;
}
/* the core: paint a box, resolve with whatever the caller's buttons return */
function _uiOpen(html, wire){
  const run=()=>new Promise(res=>{
    const root=_uiRoot(), box=root.querySelector('.uidlg-box'), bg=root.querySelector('.uidlg-bg');
    box.innerHTML=html; root.classList.add('open'); document.body.classList.add('uidlg-open');
    let done=false;
    const close=(v)=>{ if(done)return; done=true; root.classList.remove('open'); document.body.classList.remove('uidlg-open'); box.innerHTML=''; document.removeEventListener('keydown',onKey,true); bg.onclick=null; res(v); };
    const onKey=(e)=>{ if(e.key==='Escape'){e.preventDefault();close(wire.onEscape());} else if(e.key==='Enter'&&!(e.target&&e.target.tagName==='TEXTAREA')){ if(e.target&&e.target.tagName==='BUTTON')return; e.preventDefault(); const v=wire.onEnter(); if(v!==undefined)close(v); } };
    document.addEventListener('keydown',onKey,true);
    bg.onclick=()=>close(wire.onEscape());
    wire.mount(box, close);
    const f=box.querySelector('[data-focus]')||box.querySelector('input,select,textarea,button');
    if(f){ try{ f.focus(); if(f.select&&f.tagName==='INPUT'&&f.type!=='date'&&f.type!=='number')f.select(); }catch(e){} }
  });
  const p=_uiQueue.then(run,run); _uiQueue=p.catch(()=>{}); return p;
}
function _uiBtns(ok, cancel, danger){
  return '<div class="uidlg-btns">'+(cancel!==false?'<button type="button" class="uidlg-cancel" data-act="cancel">'+_uiEsc(cancel||'Cancel')+'</button>':'')+
    '<button type="button" class="uidlg-ok'+(danger?' danger':'')+'" data-act="ok">'+_uiEsc(ok||'OK')+'</button></div>';
}
function _uiField(f){
  const id='uif-'+_uiEsc(f.k||'v'), v=f.v==null?'':f.v, t=f.t||'text';
  const lbl=(f.l?'<label class="uidlg-lbl" for="'+id+'">'+_uiEsc(f.l)+(f.req?' <span class="uidlg-req">*</span>':'')+'</label>':'');
  let inp;
  if(t==='textarea')inp='<textarea id="'+id+'" data-k="'+_uiEsc(f.k)+'" rows="'+(f.rows||3)+'" placeholder="'+_uiEsc(f.placeholder||'')+'"'+(f.focus?' data-focus':'')+'>'+_uiEsc(v)+'</textarea>';
  else if(t==='select')inp='<select id="'+id+'" data-k="'+_uiEsc(f.k)+'"'+(f.focus?' data-focus':'')+'>'+(f.opts||[]).map(o=>{const val=typeof o==='object'?o.v:o, lab=typeof o==='object'?o.l:o; return '<option value="'+_uiEsc(val)+'"'+(String(val)===String(v)?' selected':'')+'>'+_uiEsc(lab)+'</option>';}).join('')+'</select>';
  else if(t==='checkbox')inp='<label class="uidlg-check"><input type="checkbox" id="'+id+'" data-k="'+_uiEsc(f.k)+'"'+(v?' checked':'')+'> '+_uiEsc(f.text||'')+'</label>';
  else inp='<input id="'+id+'" data-k="'+_uiEsc(f.k)+'" type="'+_uiEsc(t)+'" value="'+_uiEsc(v)+'" placeholder="'+_uiEsc(f.placeholder||'')+'"'+(f.step?' step="'+_uiEsc(f.step)+'"':'')+(f.min!=null?' min="'+_uiEsc(f.min)+'"':'')+(f.focus?' data-focus':'')+' autocomplete="off">';
  return '<div class="uidlg-field">'+lbl+inp+(f.hint?'<div class="uidlg-hint">'+_uiEsc(f.hint)+'</div>':'')+'</div>';
}
function _uiRead(box){
  const out={};
  box.querySelectorAll('[data-k]').forEach(el=>{ const k=el.getAttribute('data-k'); out[k]=el.type==='checkbox'?el.checked:el.value; });
  return out;
}
/* prompt(): one value. Returns the string (trimmed? no — callers trim, as they did) or null. */
function uiPrompt(label, def, o){
  o=o||{}; const type=o.type||'text';
  const html='<div class="uidlg-title">'+_uiEsc(o.title||'')+'</div>'+
    _uiField({k:'v',l:label,v:def==null?'':def,t:type,placeholder:o.placeholder,req:o.required,hint:o.hint,focus:true,rows:o.rows,step:o.step,min:o.min})+
    '<div class="uidlg-err" id="uidlg-err"></div>'+_uiBtns(o.ok||'OK',o.cancel,o.danger);
  return _uiOpen(html,{
    onEscape:()=>null,
    onEnter(){ const v=_uiRead(document.querySelector('#uidlg .uidlg-box')).v; if(o.required&&!String(v).trim()){const e=document.getElementById('uidlg-err');if(e)e.textContent='This is required.';return undefined;} return String(v); },
    mount(box,close){ box.querySelector('[data-act="ok"]').onclick=()=>{ const v=_uiRead(box).v; if(o.required&&!String(v).trim()){const e=document.getElementById('uidlg-err');if(e)e.textContent='This is required.';return;} close(String(v)); }; const c=box.querySelector('[data-act="cancel"]'); if(c)c.onclick=()=>close(null); }
  });
}
/* confirm(): yes / no. Long messages wrap; a first line ending in a full stop reads as the title. */
function uiConfirm(msg, o){
  o=o||{}; const lines=String(msg==null?'':msg).split('\n'); const title=o.title||'';
  const html='<div class="uidlg-title">'+_uiEsc(title)+'</div><div class="uidlg-msg">'+lines.map(l=>_uiEsc(l)||'&nbsp;').join('<br>')+'</div>'+_uiBtns(o.ok||'OK',o.cancel,o.danger);
  return _uiOpen(html,{ onEscape:()=>false, onEnter:()=>true,
    mount(box,close){ box.querySelector('[data-act="ok"]').onclick=()=>close(true); const c=box.querySelector('[data-act="cancel"]'); if(c)c.onclick=()=>close(false); box.querySelector('[data-act="ok"]').setAttribute('data-focus',''); } });
}
/* alert(): one button. Fire-and-forget is fine. */
function uiAlert(msg, o){
  o=o||{}; const lines=String(msg==null?'':msg).split('\n');
  const html='<div class="uidlg-title">'+_uiEsc(o.title||'')+'</div><div class="uidlg-msg">'+lines.map(l=>_uiEsc(l)||'&nbsp;').join('<br>')+'</div>'+_uiBtns(o.ok||'OK',false,false);
  return _uiOpen(html,{ onEscape:()=>true, onEnter:()=>true, mount(box,close){ const b=box.querySelector('[data-act="ok"]'); b.onclick=()=>close(true); b.setAttribute('data-focus',''); } });
}
/* several fields in one box → {k: value} or null */
function uiForm(title, fields, o){
  o=o||{}; fields=(fields||[]).map((f,i)=>Object.assign({},f,{focus:i===0}));
  const html='<div class="uidlg-title">'+_uiEsc(title||'')+'</div>'+(o.intro?'<div class="uidlg-msg">'+_uiEsc(o.intro)+'</div>':'')+fields.map(_uiField).join('')+'<div class="uidlg-err" id="uidlg-err"></div>'+_uiBtns(o.ok||'Save',o.cancel,o.danger);
  const validate=(box)=>{ const v=_uiRead(box); const miss=fields.find(f=>f.req&&!String(v[f.k]==null?'':v[f.k]).trim()); if(miss){const e=document.getElementById('uidlg-err');if(e)e.textContent='“'+miss.l+'” is required.';return null;} return v; };
  return _uiOpen(html,{ onEscape:()=>null,
    onEnter(){ const v=validate(document.querySelector('#uidlg .uidlg-box')); return v===null?undefined:v; },
    mount(box,close){ box.querySelector('[data-act="ok"]').onclick=()=>{ const v=validate(box); if(v!==null)close(v); }; const c=box.querySelector('[data-act="cancel"]'); if(c)c.onclick=()=>close(null); } });
}
