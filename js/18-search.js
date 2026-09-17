/* ── SEARCH — one box, everything you may open (2026-09-17) ─────────────────────
   The sidebar box (desktop) and the menu box (phones) used to find PAGES only.
   Now the same box finds records: an order by its number or its clinic, an
   account, a specialist, a SKU by code or name, a batch, a finance request by
   its V-/RO-/PP-/RP-/RE-/CA-/ER- number, a pull-out, a PO, a quotation, a
   transfer, a complaint, a shipment, a serial, a loaner, a supplier, a cheque.

   Two truths, unchanged: viewAllowed() decides which KINDS of record a person may
   even look for (a specialist never sees a PO hit; a viewer never sees payments),
   and RLS decides which ROWS come back from the database (a specialist's order
   search returns only their own orders, because that is all the database gives
   them). Nothing here widens either. Costs are never in a result line.

   A hit opens the record the way the app already does — the order page, the
   account page, the SKU drawer — or lands on the record's list with the row
   scrolled into view and flashed, for lists that have no page of their own. */
const SR_MIN=2, SR_LIMIT=6;
let SR_HITS=[], SR_SEQ=0, SR_SEL=-1, SR_Q='', SR_TIMER=null;

/* "HS-1042" → [{kind:'order',n:42}] — document numbers as people type them
   (prefix + printed number, dash optional, any case); the printed offset comes
   off so the raw row number is what we query. */
function srDocParse(q){
  const s=String(q||'').trim().toUpperCase().replace(/\s+/g,'');
  const fm=Object.assign({},DOCFMT_DEFAULT,(typeof DOCFMT!=='undefined'&&DOCFMT)||{});
  const out=[];
  for(const k of Object.keys(fm)){
    const f=fm[k]||{};const pre=String(f.prefix||'').toUpperCase();if(!pre)continue;
    const m=s.match(new RegExp('^'+pre.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&').replace(/-$/,'-?')+'0*(\\d+)$'));
    if(!m)continue;
    const n=parseInt(m[1],10)-(f.offset_no||0);
    if(n>0)out.push({kind:k,n});
  }
  return out;
}
/* which kinds a role may look for, and where a hit lands */
function srKinds(){
  const A=v=>typeof viewAllowed==='function'&&viewAllowed(v);
  return {
    pages:true,
    products:A('all')||A('catalog'),
    batches:A('batches'),
    orders:A('order'),
    accounts:A('account'),
    specs:A('spec'),
    quotes:A('quotes'),
    pos:A('po'),
    fin:(typeof FIN_KINDS!=='undefined'?FIN_KINDS:[]).filter(k=>A(k)),
    pullouts:A('pullouts'),
    transfers:A('transfers'),
    complaints:A('complaints'),
    shipments:A('receiving'),
    serials:A('serials'),
    loans:A('loans'),
    suppliers:A('suppliers'),
    pdcs:A('pdc'),
    returns:A('returns'),
    waves:A('wavepick')
  };
}
const srLike=q=>'%'+String(q).replace(/[%_\\,()]/g,' ').trim()+'%';
const srHas=(s,ql)=>String(s||'').toLowerCase().includes(ql);
function srPage(v){return document.querySelector('.nav .ni[onclick*="\''+v+'\'"]')||null;}
function srOwnTag(){return (ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';}
function srMine(spec){const t=srOwnTag();return !t||specCanon(spec||'').toLowerCase()===specCanon(t).toLowerCase();}

/* the search itself: synchronous hits first (pages, SKUs, batches, cached accounts
   and specialists, recent Shopify orders), then the database in parallel */
async function srRun(q,onPaint){
  const seq=++SR_SEQ;SR_Q=q;
  const ql=q.trim().toLowerCase();if(ql.length<SR_MIN){SR_HITS=[];onPaint([]);return [];}
  const K=srKinds();const docs=srDocParse(q);const groups=[];
  const add=(title,items)=>{if(items&&items.length)groups.push({title,items:items.slice(0,SR_LIMIT)});};
  // pages — label match on the sidebar the role can see; the short label and the description count too
  {const seen=new Set(),items=[];
   document.querySelectorAll('.nav .ni').forEach(el=>{
     const oc=el.getAttribute('onclick')||'';const mv=oc.match(/showView\('([a-z_]+)'/);if(!mv)return;
     const v=mv[1];if(seen.has(v)||!viewAllowed(v))return;
     const label=el.textContent.replace(/\d+$/,'').trim();
     const desc=(typeof DESC!=='undefined'&&DESC[v])||'';
     if(srHas(label,ql)||(ql.length>=4&&srHas(desc.slice(0,160),ql))){seen.add(v);items.push({t:'page',label,sub:'Page',go:()=>showView(v,srPage(v))});}
   });
   add('Pages',items);}
  // SKUs — code, name, line, supplier
  if(K.products){const items=[];
    for(const p of (DATA||[])){if(srHas(p.sku,ql)||srHas(p.name,ql)||srHas(p.line,ql)||srHas(p.supplier,ql)){items.push({t:'sku',label:p.name,sub:String(p.sku)+' · '+(p.line||'')+(p.stock!=null?' · '+(+p.stock||0).toLocaleString()+' on hand':''),go:()=>openDrawer(p.sku)});if(items.length>=SR_LIMIT)break;}}
    // code hits first
    items.sort((a,b)=>(srHas(a.sub,ql)?0:1)-(srHas(b.sub,ql)?0:1));
    add('Products',items);}
  if(K.batches&&ql.length>=3){const items=[];
    for(const b of (BATCHES||[])){if(srHas(b.batch,ql)){items.push({t:'batch',label:'Batch '+b.batch,sub:(b.skuCode||b.name||'')+' · exp '+(b.expiry||'—')+' · '+(b.soh||0)+' on hand',go:()=>openDrawer(b.skuCode)});if(items.length>=SR_LIMIT)break;}}
    add('Batches',items);}
  // accounts and specialists from what is already loaded (specialists: own only)
  const acctItems=[],specItems=[];
  if(K.accounts&&!srOwnTag()){try{
    const names=(typeof acctNames==='function'?acctNames():[]);
    for(const n of names){if(srHas(n,ql)){acctItems.push({t:'acct',label:n,sub:'Account',go:()=>showAccountPage(n)});if(acctItems.length>=SR_LIMIT)break;}}
  }catch(e){}}
  if(K.specs){try{
    const names=(typeof specNames==='function'?specNames():[]);
    for(const n of names){if(srHas(n,ql)&&srMine(n)){specItems.push({t:'spec',label:n,sub:'Specialist',go:()=>showSpecPage(n)});if(specItems.length>=SR_LIMIT)break;}}
  }catch(e){}}
  // recent Shopify orders (in memory) — own only for a specialist
  const ordItems=[];
  if(K.orders){
    for(const o of ((SHOPIFY&&SHOPIFY.recent)||[])){
      const n=String(o.n||'');
      if((srHas(n,ql)||srHas(o.c,ql)||(/^\d{3,}$/.test(ql)&&n.replace(/\D/g,'').endsWith(ql)))&&srMine(o.t)){
        ordItems.push({t:'order',label:n.replace(/^#/,''),sub:(o.c||'')+' · '+(o.t||'')+' · '+(o.dt||'')+' · Shopify',go:()=>showOrderPage(n.replace(/^#/,''))});if(ordItems.length>=SR_LIMIT)break;}
    }
  }
  const paintNow=()=>{if(seq!==SR_SEQ)return;const g=groups.slice();
    if(ordItems.length)g.push({title:'Orders',items:ordItems.slice(0,SR_LIMIT)});
    if(acctItems.length)g.push({title:'Accounts',items:acctItems.slice(0,SR_LIMIT)});
    if(specItems.length)g.push({title:'Specialists',items:specItems.slice(0,SR_LIMIT)});
    SR_HITS=[];g.forEach(gr=>gr.items.forEach(it=>{it.i=SR_HITS.length;SR_HITS.push(it);}));onPaint(g,false);};
  paintNow();
  if(!SB||!SBUSER)return groups;
  // the database — every query is RLS-scoped; each is optional and failures are silent
  const like=srLike(q);const Q=[];
  const list=(view,hl,prep)=>()=>{if(prep)prep();showView(view,srPage(view));srHighlight(hl);};
  if(K.orders){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='order').map(d=>d.n);
    let sel=SB.from('orders').select('id,num,account,spec,date,status,total,source,ext_ref').is('deleted_at',null).order('num',{ascending:false}).limit(SR_LIMIT);
    sel=docN.length?sel.in('num',docN):/^\d{2,}$/.test(ql)?sel.or('num.eq.'+(parseInt(ql,10)-(((DOCFMT||DOCFMT_DEFAULT).order||{}).offset_no||0))+',account.ilike.'+like+',ext_ref.ilike.'+like):sel.or('account.ilike.'+like+',spec.ilike.'+like+',ext_ref.ilike.'+like);
    const {data}=await sel;
    for(const o of (data||[])){const lbl=typeof ordLabel==='function'?ordLabel(o):'HS-'+o.num;
      if(ordItems.some(x=>x.label===lbl))continue;
      ordItems.unshift({t:'order',label:lbl,sub:(o.account||'')+' · '+(o.spec||'')+' · '+(o.date||'')+' · '+(o.status||''),go:()=>showOrderPage(o.id)});}
  })());}
  if(K.accounts){Q.push((async()=>{
    if(srOwnTag()){ // a specialist's accounts are the clinics on their own orders
      const {data}=await SB.from('orders').select('account').is('deleted_at',null).ilike('account',like).order('date',{ascending:false}).limit(40);
      const seen=new Set(acctItems.map(a=>a.label));
      for(const r of (data||[])){if(!seen.has(r.account)){seen.add(r.account);acctItems.push({t:'acct',label:r.account,sub:'Account',go:()=>showAccountPage(r.account)});}}
    }else{
      const {data}=await SB.from('accounts').select('name,specialty').ilike('name',like).limit(SR_LIMIT);
      const seen=new Set(acctItems.map(a=>a.label.toLowerCase()));
      for(const r of (data||[])){if(!seen.has(String(r.name).toLowerCase())){seen.add(String(r.name).toLowerCase());acctItems.push({t:'acct',label:r.name,sub:r.specialty?'Account · '+r.specialty:'Account',go:()=>showAccountPage(r.name)});}}
    }
  })());}
  if(K.quotes){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='quote').map(d=>d.n);
    let sel=SB.from('quotes').select('id,num,account,spec,status,date').order('num',{ascending:false}).limit(SR_LIMIT);
    sel=docN.length?sel.in('num',docN):sel.or('account.ilike.'+like+',spec.ilike.'+like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){if(!srMine(r.spec))continue;const lbl=docNo('quote',r.num);items.push({t:'quote',label:lbl,sub:(r.account||'')+' · '+(r.status||'')+' · '+(r.date||''),go:list('quotes',lbl)});}
    add('Quotations',items);
  })());}
  if(K.pos){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='po').map(d=>d.n);
    let sel=SB.from('pos').select('id,supplier,status,eta').order('id',{ascending:false}).limit(SR_LIMIT);
    sel=docN.length?sel.in('id',docN):sel.ilike('supplier',like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){const lbl=docNo('po',r.id);items.push({t:'po',label:lbl,sub:(r.supplier||'')+' · '+(r.status||'')+(r.eta?' · ETA '+r.eta:''),go:list('po',lbl,()=>{window._poOpen=r.id;})});}
    add('Purchase orders',items);
  })());}
  if(K.fin.length){Q.push((async()=>{
    const docK=docs.filter(d=>K.fin.includes(d.kind));
    let sel=SB.from('fin_requests').select('id,num,kind,payee,requester_name,amount,status,date_requested,ref_no').in('kind',K.fin).order('num',{ascending:false}).limit(SR_LIMIT);
    sel=docK.length?sel.or(docK.map(d=>'and(kind.eq.'+d.kind+',num.eq.'+d.n+')').join(',')):sel.or('payee.ilike.'+like+',requester_name.ilike.'+like+',ref_no.ilike.'+like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){const lbl=docNo(r.kind,r.num);const title=(typeof FIN_SPEC!=='undefined'&&FIN_SPEC[r.kind]&&FIN_SPEC[r.kind].title)||r.kind;
      items.push({t:'fin',label:lbl,sub:title+' · '+(r.payee||r.requester_name||'')+' · '+(r.status||''),go:list(r.kind,lbl)});}
    add('Finance requests',items);
  })());}
  if(K.pullouts){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='pullout').map(d=>d.n);
    let sel=SB.from('pullouts').select('id,requester_name,purpose,status,product_line').order('id',{ascending:false}).limit(SR_LIMIT);
    sel=docN.length?sel.in('id',docN):sel.or('requester_name.ilike.'+like+',purpose.ilike.'+like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){const lbl=docNo('pullout',r.id);items.push({t:'pull',label:lbl,sub:'Pull-out · '+(r.requester_name||'')+' · '+(r.status||''),go:list('pullouts',lbl)});}
    add('Pull-outs',items);
  })());}
  if(K.transfers){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='transfer').map(d=>d.n);
    let sel=SB.from('transfers').select('id,to_branch,status').order('id',{ascending:false}).limit(SR_LIMIT);
    sel=docN.length?sel.in('id',docN):sel.ilike('to_branch',like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){const lbl=docNo('transfer',r.id);items.push({t:'tr',label:lbl,sub:'Transfer · '+(r.to_branch||'')+' · '+(r.status||''),go:list('transfers',lbl)});}
    add('Branch transfers',items);
  })());}
  if(K.complaints){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='complaint').map(d=>d.n);
    let sel=SB.from('complaints').select('id,account,status,description').order('id',{ascending:false}).limit(SR_LIMIT);
    sel=docN.length?sel.in('id',docN):sel.or('account.ilike.'+like+',description.ilike.'+like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){const lbl=docNo('complaint',r.id);items.push({t:'cx',label:lbl,sub:'Complaint · '+(r.account||'')+' · '+(r.status||''),go:list('complaints',lbl)});}
    add('Complaints',items);
  })());}
  if(K.shipments){Q.push((async()=>{
    const m=ql.match(/^rcv-?0*(\d+)$/);
    let sel=SB.from('shipments').select('id,supplier,status,eta,tracking_no,carrier').order('id',{ascending:false}).limit(SR_LIMIT);
    sel=m?sel.eq('id',+m[1]):sel.or('supplier.ilike.'+like+',tracking_no.ilike.'+like+',carrier.ilike.'+like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){const lbl='RCV-'+r.id;items.push({t:'ship',label:lbl,sub:'Shipment · '+(r.supplier||'')+' · '+(r.status||'')+(r.tracking_no?' · '+r.tracking_no:''),go:list('receiving',lbl,()=>{SHIP_OPEN=r.id;SHIP_FILTER='all';})});}
    add('Shipments',items);
  })());}
  if(K.serials&&ql.length>=3){Q.push((async()=>{
    const {data}=await SB.from('serials').select('id,sku,serial,status,batch').ilike('serial',like).limit(SR_LIMIT);const items=[];
    for(const r of (data||[])){items.push({t:'serial',label:r.serial,sub:'Serial · '+(r.sku||'')+' · '+(r.status||''),go:list('serials',r.serial)});}
    add('Serial numbers',items);
  })());}
  if(K.loans){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='loan').map(d=>d.n);
    let sel=SB.from('loans').select('id,account,serial,status,due_date').order('id',{ascending:false}).limit(SR_LIMIT);
    sel=docN.length?sel.in('id',docN):sel.or('account.ilike.'+like+',serial.ilike.'+like);
    const {data}=await sel;const items=[];
    for(const r of (data||[])){const lbl=docNo('loan',r.id);items.push({t:'loan',label:lbl,sub:'Loaner · '+(r.account||'')+' · '+(r.status||'')+(r.due_date?' · due '+r.due_date:''),go:list('loans',lbl)});}
    add('Loaner units',items);
  })());}
  if(K.suppliers){Q.push((async()=>{
    const {data}=await SB.from('suppliers').select('id,name,currency,terms').ilike('name',like).limit(SR_LIMIT);const items=[];
    for(const r of (data||[])){items.push({t:'sup',label:r.name,sub:'Supplier'+(r.currency?' · '+r.currency:'')+(r.terms?' · '+r.terms:''),go:list('suppliers',r.name)});}
    add('Suppliers',items);
  })());}
  if(K.pdcs){Q.push((async()=>{
    const {data}=await SB.from('pdcs').select('id,account,cheque_no,bank,maturity,status').or('cheque_no.ilike.'+like+',account.ilike.'+like+',bank.ilike.'+like).order('maturity',{ascending:false}).limit(SR_LIMIT);const items=[];
    for(const r of (data||[])){items.push({t:'pdc',label:'Cheque '+(r.cheque_no||''),sub:(r.account||'')+' · '+(r.bank||'')+' · '+(r.maturity||'')+' · '+(r.status||''),go:list('pdc',String(r.cheque_no||''))});}
    add('Post-dated cheques',items);
  })());}
  if(K.returns){Q.push((async()=>{
    const docN=docs.filter(d=>d.kind==='cm').map(d=>d.n);if(!docN.length)return;
    const {data}=await SB.from('returns').select('id,account,action,applied').in('id',docN).limit(SR_LIMIT);const items=[];
    for(const r of (data||[])){const lbl=docNo('cm',r.id);items.push({t:'cm',label:lbl,sub:'Credit memo · '+(r.account||'')+' · '+(r.applied?'applied':'open'),go:list('returns',lbl)});}
    add('Credit memos',items);
  })());}
  if(K.waves){const docN=docs.filter(d=>d.kind==='wave').map(d=>d.n);
    if(docN.length)add('Wave picks',docN.map(n=>({t:'wave',label:docNo('wave',n),sub:'Wave pick',go:()=>showWavePick(n)})));}
  await Promise.allSettled(Q);
  if(seq!==SR_SEQ)return groups;
  // final paint: orders/accounts/specialists in front of the list-type records
  const g=groups.filter(x=>x.title==='Pages'||x.title==='Products'||x.title==='Batches');
  if(ordItems.length)g.push({title:'Orders',items:ordItems.slice(0,SR_LIMIT)});
  if(acctItems.length)g.push({title:'Accounts',items:acctItems.slice(0,SR_LIMIT)});
  if(specItems.length)g.push({title:'Specialists',items:specItems.slice(0,SR_LIMIT)});
  groups.filter(x=>!g.includes(x)).forEach(x=>g.push(x));
  SR_HITS=[];g.forEach(gr=>gr.items.forEach(it=>{it.i=SR_HITS.length;SR_HITS.push(it);}));
  onPaint(g,true);
  return g;
}

/* land on a list and flash the row that carries the number (or name) */
function srHighlight(text){
  const t=String(text||'').trim();if(!t)return;
  const t0=Date.now();
  const tick=()=>{
    const c=$('content');if(!c)return;
    let hit=null;
    for(const el of c.querySelectorAll('td,th,b,strong,.phd,.tile,a,span,div')){
      if(el.children.length>3)continue;
      if(String(el.textContent||'').trim().indexOf(t)>=0){hit=el.closest('tr')||el.closest('.tile')||el.closest('.panel')||el;break;}
    }
    if(hit){try{hit.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}hit.classList.add('sr-hl');setTimeout(()=>hit.classList.remove('sr-hl'),2600);return;}
    if(Date.now()-t0<4000)setTimeout(tick,160);
  };
  setTimeout(tick,120);
}

/* ── the results panel (desktop): floats beside the sidebar box ── */
const SR_ICON={page:'▤',sku:'◫',batch:'⧉',order:'⌗',acct:'⌂',spec:'☺',quote:'✎',po:'⇩',fin:'₱',pull:'⇪',tr:'⇄',cx:'⚑',ship:'⛴',serial:'#',loan:'↺',sup:'⌂',pdc:'▭',cm:'↩',wave:'≣'};
function srPanelHTML(groups,done){
  if(!groups.length)return '<div class="sr-empty">'+(done?'Nothing matches “'+esc(SR_Q)+'”. Try an order number (HS-1042), a clinic, a SKU, or a request number (RE-1007).':'Searching…')+'</div>';
  let h='';
  for(const g of groups){
    h+='<div class="sr-grp">'+esc(g.title)+'</div>';
    for(const it of g.items){
      h+='<div class="sr-it'+(it.i===SR_SEL?' sel':'')+'" data-i="'+it.i+'" onmousedown="event.preventDefault()" onclick="srPick('+it.i+')"><span class="sr-ic">'+(SR_ICON[it.t]||'·')+'</span><div style="min-width:0;flex:1"><div class="sr-l">'+esc(it.label)+'</div>'+(it.sub?'<div class="sr-s">'+esc(it.sub)+'</div>':'')+'</div></div>';
    }
  }
  if(!done)h+='<div class="sr-empty" style="padding:6px 14px">Looking in the database…</div>';
  return h;
}
function srPanel(){
  let p=$('srpanel');
  if(!p){p=document.createElement('div');p.id='srpanel';p.className='sr-panel';p.style.display='none';document.body.appendChild(p);
    document.addEventListener('mousedown',e=>{if(p.style.display!=='none'&&!p.contains(e.target)&&e.target.id!=='navq')srClose();});}
  return p;
}
function srPlace(){
  const p=srPanel(),inp=$('navq');if(!inp)return p;
  const r=inp.getBoundingClientRect();
  p.style.left=Math.round(r.right+10)+'px';p.style.top=Math.max(8,Math.round(r.top-4))+'px';
  return p;
}
function srClose(){const p=$('srpanel');if(p)p.style.display='none';SR_SEL=-1;}
function srInput(v){
  const q=String(v||'');
  clearTimeout(SR_TIMER);
  if(q.trim().length<SR_MIN){srClose();SR_SEQ++;return;}
  SR_TIMER=setTimeout(()=>{
    const p=srPlace();p.style.display='block';SR_SEL=-1;
    p.innerHTML=srPanelHTML([],false);
    srRun(q,(groups,done)=>{if(q!==SR_Q)return;p.innerHTML=srPanelHTML(groups,done);});
  },160);
}
function srKey(e){
  const p=$('srpanel');const open=p&&p.style.display!=='none';
  if(e.key==='Escape'){if(open){srClose();e.preventDefault();}else{e.target.value='';navFilter('');}return;}
  if(!open)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!SR_HITS.length)return;
    SR_SEL=e.key==='ArrowDown'?Math.min(SR_HITS.length-1,SR_SEL+1):Math.max(0,SR_SEL-1);
    p.querySelectorAll('.sr-it').forEach(el=>el.classList.toggle('sel',+el.dataset.i===SR_SEL));
    const el=p.querySelector('.sr-it.sel');try{if(el)el.scrollIntoView({block:'nearest'});}catch(err){}return;}
  if(e.key==='Enter'){e.preventDefault();if(SR_HITS.length)srPick(SR_SEL>=0?SR_SEL:0);}
}
function srPick(i){
  const it=SR_HITS[i];if(!it)return;
  srClose();
  const inp=$('navq');if(inp){inp.value='';try{navFilter('');}catch(e){}}
  try{if(typeof closeMobileMenu==='function')closeMobileMenu();}catch(e){}
  try{audit('search.open',{q:SR_Q,kind:it.t,label:it.label});}catch(e){}
  try{it.go();}catch(e){}
}
/* ⌘K / Ctrl+K puts the cursor in the box; "/" too when nothing else has focus */
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  const inField=/^(input|textarea|select)$/i.test((document.activeElement||{}).tagName||'')||(document.activeElement&&document.activeElement.isContentEditable);
  if(((e.metaKey||e.ctrlKey)&&k==='k')||(k==='/'&&!inField&&!e.metaKey&&!e.ctrlKey&&!e.altKey)){
    const inp=$('navq');if(!inp)return;
    if(window.matchMedia&&window.matchMedia('(max-width:760px)').matches){e.preventDefault();try{openMobileMenu();const m=$('mmq');if(m)m.focus();}catch(err){}return;}
    e.preventDefault();inp.focus();inp.select();
  }
});

/* ── phones: the menu box searches records too ── */
(function(){
  if(typeof buildMobileMenu!=='function')return;
  const base=buildMobileMenu;
  buildMobileMenu=function(q){
    base(q);
    const list=$('mmenu-list');if(!list)return;
    const s=String(q||'').trim();
    if(s.length<SR_MIN){SR_SEQ++;return;}
    const box=document.createElement('div');box.id='sr-mobile';box.className='sr-mobile';box.innerHTML='<div class="sr-empty">Searching…</div>';
    list.insertBefore(box,list.firstChild);
    srRun(s,(groups,done)=>{
      if(s!==SR_Q)return;const b=$('sr-mobile');if(!b)return;
      const g=groups.filter(x=>x.title!=='Pages'); // the menu already lists the pages
      b.innerHTML=g.length?srPanelHTML(g,done):(done?'<div class="sr-empty">No records match “'+esc(s)+'”.</div>':'<div class="sr-empty">Searching…</div>');
    });
  };
})();
