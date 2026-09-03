/* ── PHASE A OWNERSHIP · BATCH RECALL TRACE · CATALOG DEAL DEFINITIONS ── */

// Account ownership: every account gets an owning specialist (PRD Phase A)
let OWNERS=null;
async function loadOwners(force){
  if(OWNERS&&!force)return OWNERS;
  OWNERS={};
  window.STAGES={};window.CREDITS={};
  try{
    const {data}=await SB.from('accounts').select('name,owner_tag,stage,lost_reason,credit_limit');
    (data||[]).forEach(r=>{const k=custNorm(acctDedup(r.name));if(r.owner_tag)OWNERS[k]=r.owner_tag;if(r.stage)window.STAGES[k]={stage:r.stage,lost:r.lost_reason};if(r.credit_limit!=null)window.CREDITS[k]=r.credit_limit;});
  }catch(e){ // stage columns may not exist yet — fall back to owners only
    try{const {data}=await SB.from('accounts').select('name,owner_tag');(data||[]).forEach(r=>{if(r.owner_tag)OWNERS[custNorm(acctDedup(r.name))]=r.owner_tag;});}catch(e2){}
  }
  return OWNERS;
}
function ownerOf(name){return (OWNERS||{})[custNorm(acctDedup(name||''))]||null;}
async function setOwner(name,tag){
  if(!canManage())return alert('Admins and sales managers only.');
  try{
    const nm=acctDedup(name);
    const {data:ex}=await SB.from('accounts').select('name').eq('name',nm).maybeSingle();
    if(ex){const {error}=await SB.from('accounts').update({owner_tag:tag||null}).eq('name',nm);if(error)throw error;}
    else{const {error}=await SB.from('accounts').insert({name:nm,owner_tag:tag||null});if(error)throw error;}
    audit('account.owner',{account:nm,owner:tag||'(none)'});
    await loadOwners(true);
    if(currentView==='account')renderAccountPage();
    if(currentView==='customers')renderCustomers();
  }catch(e){alert('Could not save owner: '+(e.message||e)+(String(e.message||'').includes('owner_tag')?'\n\n(Run the owner_tag SQL from SUPABASE-SETUP.md.)':''));}
}
function ownerSelHTML(name){
  const cur=ownerOf(name)||'';
  return '<select onchange="setOwner(\''+jsq(acctDedup(name))+'\',this.value)" onclick="event.stopPropagation()" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:7px;padding:5px 7px;font-size:11.5px;max-width:110px">'+
    '<option value="">— owner —</option>'+specNames().map(s=>'<option'+(specCanon(s).toLowerCase()===specCanon(cur).toLowerCase()?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select>';
}

// Batch recall trace: batch → every clinic/order/DR that received it
async function renderRecall(){
  if(!roleIn('admin','manager','supply_chain','marketing')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Warehouse, management, and marketing only.</div>';return;}
  const skus=DATA.map(p=>'<option value="'+esc(p.sku)+'">'+esc(p.name)+'</option>').join('');
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 11px;font-size:13px"';
  $('content').innerHTML=
    '<div style="max-width:860px">'+
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">Trace a batch</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<input id="rc-sku" list="rc-skus" placeholder="SKU (e.g. TD040)" '+inp+' style="width:170px;'+inp.slice(7,-1)+'"><datalist id="rc-skus">'+skus+'</datalist>'+
    '<input id="rc-batch" placeholder="Batch / lot no. (optional)" '+inp+' style="flex:1;min-width:160px;'+inp.slice(7,-1)+'">'+
    '<button onclick="recallRun()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">Trace</button></div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:6px">Searches every OUT-sheet shipment row (plus the platform ledger) · SKU alone lists all its batches; add the batch/lot no. to pinpoint one</div></div>'+
    '<div id="rc-out"></div></div>';
}
async function recallRun(){
  const sku=(($('rc-sku')||{}).value||'').trim(),batch=(($('rc-batch')||{}).value||'').trim();
  const out=$('rc-out');if(!out)return;
  if(!sku&&!batch)return alert('Give at least a SKU or a batch number.');
  out.innerHTML='<div class="empty">Searching every shipment row…</div>';
  try{
    const r=await fetch('/.netlify/functions/refresh?trace=1&sku='+encodeURIComponent(sku)+'&batch='+encodeURIComponent(batch),{headers:await sbAuthHeaders()});
    const d=await r.json();
    if(d.error)throw new Error(d.error);
    let hits=d.hits||[];
    // include platform-ledger picks that carry this batch (post-cutover trail)
    try{
      let q=SB.from('stock_moves').select('at,sku,qty,kind,ref,batch,note').lt('qty',0);
      if(sku)q=q.eq('sku',sku);
      if(batch)q=q.eq('batch',batch);
      const {data:lm}=await q.limit(200);
      try{if(!NORDERS)await loadNativeOrders();}catch(e){}
      const byLbl={};(NORDERS||[]).forEach(o=>{byLbl[ordLabel(o)]=o.account;if(o.ext_ref)byLbl[o.ext_ref]=o.account;});
      (lm||[]).forEach(m=>hits.push({sku:m.sku,batch:m.batch||'—',date:String(m.at||'').slice(0,10),customer:(m.ref&&byLbl[m.ref])?byLbl[m.ref]+' (ledger)':'(ledger) '+(m.ref||''),qty:Math.abs(m.qty),order:m.ref,expiry:''}));
    }catch(e){}
    const totQ=hits.reduce((a,h)=>a+(h.qty||0),0);
    const custs=new Set(hits.map(h=>custNorm(h.customer||'')));
    audit('recall.trace',{sku,batch,hits:hits.length});
    out.innerHTML=
      '<div class="metrics" style="margin-bottom:12px">'+
      '<div class="met rd"><div class="met-lbl">Shipments found</div><div class="met-val">'+hits.length+(d.total>hits.length?' of '+d.total:'')+'</div><div class="met-bar"></div></div>'+
      '<div class="met am"><div class="met-lbl">Units shipped</div><div class="met-val">'+totQ.toLocaleString()+'</div><div class="met-bar"></div></div>'+
      '<div class="met bl"><div class="met-lbl">Destinations</div><div class="met-val">'+custs.size+'</div><div class="met-sub">clinics / accounts to contact</div><div class="met-bar"></div></div>'+
      '</div>'+
      '<div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:8px"><button onclick="window.print()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">🖨 Print recall list</button></div>'+
      '<div class="tcard printdoc" style="padding:0"><div class="tscroll"><table><thead><tr><th>Date</th><th>Customer / destination</th><th>SKU</th><th>Batch</th><th>Expiry</th><th style="text-align:right">Qty</th><th>Order ref</th></tr></thead><tbody>'+
      (hits.length?hits.map(h=>'<tr><td>'+esc(h.date||'—')+'</td><td style="font-weight:600">'+esc(h.customer||'—')+'</td><td>'+esc(h.sku)+'</td><td>'+esc(h.batch)+'</td><td class="mu">'+esc(h.expiry||'')+'</td><td style="text-align:right;font-weight:700">'+h.qty+'</td><td class="mu">'+esc(h.order||'')+'</td></tr>').join(''):'<tr><td colspan="7"><div class="empty">No shipments found for that combination.</div></td></tr>')+
      '</tbody></table></div><div class="tfooter"><span>Every warehouse OUT row matching the trace, newest first · print this as the contact list for a recall · sources: Verna’s OUT sheet + the platform ledger</span></div></div>';
  }catch(e){out.innerHTML='<div class="empty" style="color:var(--rd)">Trace failed: '+esc(e.message||e)+'</div>';}
}

// Catalog deal definitions — replaces Shopify-derived deals when pricing is independent
async function catalogDeals(sku){
  if(!canManage())return;
  await loadItems();
  const it=ITEMS[sku];if(!it)return;
  let cur=[];try{cur=JSON.parse(it.deals||'[]');}catch(e){}
  const txt=prompt('Deal definitions for '+sku+' — one per line as  buy+free=set price\n(e.g. "5+1=237500"). Blank = no deals.',cur.map(d=>d.buy+'+'+d.free+'='+d.price).join('\n'));
  if(txt===null)return;
  const deals=[];
  for(const line of txt.split('\n')){
    const m=line.trim().match(/^(\d+)\s*\+\s*(\d+)\s*=\s*(\d[\d,]*)$/);
    if(m)deals.push({buy:+m[1],free:+m[2],price:parseInt(m[3].replace(/,/g,''),10)});
  }
  try{
    const {error}=await SB.from('items').update({deals:deals.length?JSON.stringify(deals):null,updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()}).eq('sku',sku);
    if(error)throw error;
    audit('catalog.deals',{sku,deals:deals.length});
    await loadItems(true);applyCatalog();renderCatalog();
  }catch(e){alert('Could not save deals: '+(e.message||e)+(String(e.message||'').includes('deals')?'\n\n(Run the items.deals SQL from SUPABASE-SETUP.md.)':''));}
}


/* ── HOME LIVE STRIP: real numbers on the landing page, filled as data arrives ── */
async function homeLive(){
  const box=$('hm-live'),attn=$('hm-attn');
  if(!box||currentView!=='home')return;
  try{if(!SHOPIFY)loadShopify();}catch(e){}
  try{if(!VISITS)loadVisits().then(()=>{if(currentView==='home')homeLive();});}catch(e){}
  try{if(!NORDERS&&ROLE!=='sales')loadNativeOrders().then(()=>{if(currentView==='home')homeLive();});}catch(e){}
  const ym=new Date().toISOString().slice(0,7);
  const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const chip=(v,label,sub,color,go)=>'<div onclick="homeGo(\''+go+'\')" style="cursor:pointer;flex:1;min-width:150px;background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:10px 14px">'+
    '<div style="font-size:19px;font-weight:800;color:'+color+'">'+v+'</div><div style="font-size:10.5px;color:var(--tx3)">'+label+(sub?' · '+sub:'')+'</div></div>';
  const chips=[];
  // MTD booked (mine for specialists, team otherwise)
  if(SHOPIFY&&SHOPIFY.recent){
    /* Two figures on purpose: the chip follows the toolbar toggle so home agrees
       with the sales views, but the % of target is always external, because a
       target is. Letting a quota percentage move with a view preference was the
       bug here. */
    let mtd=0,mtdExt=0;
    for(const o of SHOPIFY.recent){
      if((o.dt||'').slice(0,7)!==ym||/pull\s*-?\s*out/i.test(o.c||''))continue;
      const t=specCanon(o.t||'');
      const int=ordInternal(o);
      if(myTag&&t.toLowerCase()!==specCanon(myTag).toLowerCase())continue;
      const v=(o.ls||[]).reduce((a,l)=>a+(l[2]||0),0);
      if(!int)mtdExt+=v;
      if(!(SEXT&&hasIntSplit()&&int))mtd+=v;
    }
    let tgt=null;
    if(myTag){const x=(TARGETS||[]).find(x=>x.month===ym&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===specCanon(myTag).toLowerCase());if(x)tgt=x.value;}
    chips.push(chip(fmtPeso(mtd),(myTag?'my':'team')+' booked this month'+((SEXT&&hasIntSplit())?'':' (incl. Remedy)'),
      tgt?Math.round(mtdExt/tgt*100)+'% of target':'', 'var(--ac)',myTag?'salespace':'salesoverview'));
  }
  // open follow-ups (mine for specialists)
  if(VISITS){
    const mine=v=>!myTag||specCanon(v.spec||'').toLowerCase()===specCanon(myTag).toLowerCase();
    const fu=(VISITS||[]).filter(v=>v.status!=='planned'&&v.outcome==='Follow-up needed'&&!v.fu_done&&mine(v)).length;
    const today=new Date().toISOString().slice(0,10);
    const wk=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
    const plans=(VISITS||[]).filter(v=>v.status==='planned'&&mine(v)&&v.date>=today&&v.date<=wk).length;
    chips.push(chip(String(fu),'open follow-up'+(fu===1?'':'s'),plans?plans+' visits planned this week':'','var(--am)','followups'));
  }
  if(ROLE!=='sales'){
    if(NORDERS){
      const pend=(NORDERS||[]).filter(o=>!o.deleted_at&&o.status==='pending').length;
      chips.push(chip(String(pend),'orders waiting to ship','oldest first in the queue','var(--bl)','fulfillq'));
      try{
        const rows=arRows();const over=rows.reduce((a,r)=>a+r.d30+r.d60+r.d90,0);
        chips.push(chip(fmtPeso(over),'AR past due','tap for the aging','var(--rd)','ar'));
      }catch(e){}
    }
    const so=(DATA||[]).filter(p=>p.daysToStockout!=null&&p.daysToStockout>0&&p.daysToStockout<=30&&(p.velAdj||0)>0).length;
    if(DATA&&DATA.length)chips.push(chip(String(so),'SKUs run out ≤30 days','order the red ones first','var(--pu)','forecast'));
  }
  box.innerHTML=chips.join('');
  // needs-attention line (managers/admins)
  if(attn&&ROLE!=='sales'&&DATA&&DATA.length){
    const bits=[];
    const so14=(DATA||[]).filter(p=>p.daysToStockout!=null&&p.daysToStockout>0&&p.daysToStockout<=14&&(p.velAdj||0)>0);
    if(so14.length)bits.push('<a href="#" onclick="homeGo(\'forecast\');return false" style="color:var(--rd);font-weight:600">'+so14.length+' SKU'+(so14.length>1?'s':'')+' out within 14 days</a>');
    if(NORDERS){
      const old7=(NORDERS||[]).filter(o=>!o.deleted_at&&o.status==='pending'&&(Date.now()-new Date(o.date).getTime())/864e5>7).length;
      if(old7)bits.push('<a href="#" onclick="homeGo(\'fulfillq\');return false" style="color:var(--am);font-weight:600">'+old7+' order'+(old7>1?'s':'')+' pending over a week</a>');
    }
    attn.innerHTML=bits.length?'<div style="font-size:12px;color:var(--tx3);margin:2px 2px 6px">Needs attention: '+bits.join(' · ')+'</div>':'';
  }
}

/* ── SIDEBAR: search filter + collapsible sections (state remembered per device) ── */
function navFilter(q){
  q=String(q||'').trim().toLowerCase();
  document.querySelectorAll('.nav .ni').forEach(el=>{
    if(q&&el.closest('#fav-sec')){el.style.display='none';return;} // the pinned copy would double every hit
    el.style.display=q?(el.textContent.toLowerCase().includes(q)?'':'none'):'';
  });
  document.querySelectorAll('.nav .nlbl').forEach(el=>{el.style.display=q?'none':'';});
  if(!q)navApplyCollapse(); // restore collapse states when the search clears
}
function navKey(el){return 'hs_nav_'+String(el.textContent||'').trim().toLowerCase().replace(/[^a-z]/g,'');}
function navToggle(el){
  const collapsed=!el.classList.contains('collapsed');
  if(navKey(el)==='hs_nav_productlines'){window._plOpen=!collapsed;} // session-only: always collapsed again next load
  else try{localStorage.setItem(navKey(el),collapsed?'1':'0');}catch(e){}
  navApplyCollapse();
}
function navApplyCollapse(){
  document.querySelectorAll('.nav .nlbl').forEach(lbl=>{
    let collapsed=false;
    if(navKey(lbl)==='hs_nav_productlines'){
      collapsed=!window._plOpen; // ALWAYS collapsed on load, regardless of old saved state
      try{localStorage.removeItem('hs_nav_productlines');}catch(e){} // clear stale pre-fix value
    }else{
      try{const v=localStorage.getItem(navKey(lbl));collapsed=v==='1';}catch(e){}
    }
    lbl.classList.toggle('collapsed',collapsed);
    let n=lbl.nextElementSibling;
    while(n&&!n.classList.contains('nlbl')){
      if(n.classList.contains('ni')||n.id==='lnav')n.style.display=(collapsed||n.dataset.deny==='1')?'none':'';
      n=n.nextElementSibling;
    }
  });
}
/* ── navSync: the sidebar shows ONLY what viewAllowed() permits for this role.
   Derived from the same function that guards navigation — no second list to drift. ── */
function navSync(){
  try{
    document.querySelectorAll('.nav .ni').forEach(el=>{
      const oc=el.getAttribute('onclick')||'';
      const m=oc.match(/showView\('([a-z]+)'/);
      let deny;
      if(m)deny=typeof viewAllowed==='function'&&!viewAllowed(m[1]);
      else deny=(ROLE==='sales');  // product-line filters open inventory views — not for sales
      el.dataset.deny=deny?'1':'0';
      el.style.display=deny?'none':'';
    });
    const ln=document.getElementById('lnav');
    if(ln){ln.dataset.deny=(ROLE==='sales')?'1':'0';if(ROLE==='sales')ln.style.display='none';}
    try{if(typeof favPaint==='function')favPaint();}catch(e){} // re-pin favourites after the sidebar is rebuilt
    // a section whose every item is denied disappears entirely (e.g. Admin for finance)
    document.querySelectorAll('.nav .nlbl').forEach(lbl=>{
      let n=lbl.nextElementSibling,any=false;
      while(n&&!n.classList.contains('nlbl')){
        if((n.classList.contains('ni')||n.id==='lnav')&&n.dataset.deny!=='1')any=true;
        n=n.nextElementSibling;
      }
      lbl.style.display=any?'':'none';
    });
    navApplyCollapse();
  }catch(e){}
}


/* ── MOBILE FULL MENU: every view reachable on the phone ── */
function openMobileMenu(){
  const m=$('mmenu');if(!m)return;
  const q=$('mmq');if(q)q.value='';
  buildMobileMenu('');
  m.style.display='block';
  document.body.classList.add('menuopen'); // hides the fixed bottom bar (it escapes the menu's viewport, so it would peek below)
  document.body.style.overflow='hidden';
}
function closeMobileMenu(){
  const m=$('mmenu');if(m)m.style.display='none';
  document.body.classList.remove('menuopen');
  document.body.style.overflow='';
}
function mmGo(v){closeMobileMenu();showView(v,null);}
function buildMobileMenu(q){
  const list=$('mmenu-list');if(!list)return;
  q=String(q||'').trim().toLowerCase();
  let html='';
  const addItem=(el,go)=>{
    const c=el.cloneNode(true);
    c.querySelectorAll('.nbadge').forEach(b=>b.remove());
    const label=c.textContent.trim();
    if(q&&!label.toLowerCase().includes(q))return;
    const svg=el.querySelector('svg');
    html+='<div onclick="'+go+'" style="display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid var(--bd);font-size:14.5px;font-weight:500;cursor:pointer">'+
      (svg?'<span style="width:20px;height:20px;flex-shrink:0;color:var(--ac)"><svg viewBox="'+(svg.getAttribute('viewBox')||'0 0 24 24')+'" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">'+svg.innerHTML+'</svg></span>':'')+
      esc(label)+'</div>';
  };
  const walk=(nodes)=>{
    nodes.forEach(el=>{
      if(el.classList&&el.classList.contains('nlbl')){
        if(ROLE==='sales'&&!el.classList.contains('nv-sales'))return;
        if(ROLE==='manager'&&el.id==='nav-admin-lbl')return;
        if(!q)html+='<div style="padding:14px 18px 5px;font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--tx3)">'+esc(el.textContent.replace(/[▾▸]/g,'').trim())+'</div>';
      }else if(el.classList&&el.classList.contains('ni')){
        const oc=el.getAttribute('onclick')||'';
        const mv=oc.match(/showView\('([a-z]+)'/);
        if(mv&&typeof viewAllowed==='function'&&!viewAllowed(mv[1]))return;
        if(!mv&&ROLE==='sales'&&!el.classList.contains('nv-sales'))return;
        const ml=oc.match(/fltLine\('((?:[^'\\]|\\.)*)'/);
        if(mv)addItem(el,"mmGo('"+mv[1]+"')");
        else if(ml)addItem(el,"closeMobileMenu();fltLine('"+ml[1].replace(/"/g,'&quot;')+"',null)");
      }else if(el.id==='lnav'){
        walk([...el.children]);
      }
    });
  };
  const nav=document.querySelector('.nav');
  if(nav)walk([...nav.children]);
  // account row at the bottom: who am I + password + sign out (unreachable otherwise on phones)
  const who=(SBPROFILE&&SBPROFILE.name)||(SBUSER&&SBUSER.email)||'';
  html+='<div style="padding:18px;border-top:2px solid var(--bd);margin-top:8px;font-size:13px;color:var(--tx2)">'+'<a href="#" onclick="closeMobileMenu();showView(\'profile\',null);return false" style="color:var(--tx);font-weight:700">'+esc(who)+'</a>'+' · '+(ROLE==='sales'?'Sales':ROLE==='manager'?'Sales manager':'Admin')+
    /* a 2-column grid, not a single flex row: five buttons whose labels don't fit
       forced the whole menu to scroll sideways on phones */
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">'+
    '<button onclick="closeMobileMenu();openChangePassword()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13px">Change password</button>'+
    '<button onclick="closeMobileMenu();downloadManual()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13px">📖 My manual</button>'+
    '<button onclick="favOpen()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13px">★ Favourites</button>'+
    '<button onclick="mbarOpen()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13px">☆ Customize bar</button>'+
    '<button onclick="roleLogout()" style="grid-column:1 / -1;background:var(--rd-bg);color:var(--rd);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13px;font-weight:600">Sign out</button></div>'+
    '<div style="display:flex;gap:8px;margin-top:10px;align-items:center;font-size:12px;color:var(--tx3)">Theme:'+
    '<button onclick="applyMode(\'light\')" style="background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:7px 12px">☀️</button>'+
    '<button onclick="applyMode(\'dark\')" style="background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:7px 12px">🌙</button>'+
    '<button onclick="applyMode(\'system\')" style="background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:7px 12px">🖥</button></div></div>';
  list.innerHTML=html||'<div class="empty" style="margin-top:30px">No matching views.</div>';
}


/* FEFO batch allocation for ledger picks — same walk the pick slip prints, so the
   ledger records WHICH batch left the building (recall-traceable after cutover) */
function fefoAlloc(sku,qty){
  const bs=(BATCHES||[]).filter(b=>b.skuCode===sku&&b.soh>0);
  const out=[];let need=qty;
  for(const b of bs){if(need<=0)break;const take=Math.min(need,b.soh);out.push({batch:b.batch||null,take});need-=take;}
  if(need>0)out.push({batch:null,take:need});
  return out;
}

/* ── PIPELINE (PRD Phases B–C): leads with stages + opportunities ── */
const PIPE_STAGES=['lead','contacted','qualified','active'];
const PIPE_W={lead:0.25,contacted:0.5,qualified:0.75,active:0.85};
function stageOf(r){ // explicit stage wins; otherwise derived from behavior
  const ex=(window.STAGES||{})[custNorm(acctDedup(r.name))];
  if(ex&&ex.stage)return ex.stage;
  const days=r.last?Math.floor((Date.now()-new Date(r.last).getTime())/864e5):9999;
  if(r.booked>0||r.shipped>0)return days>365?'dormant':'active';
  if(r.src==='prospect')return 'contacted'; // visit-log only: we've talked to them
  return 'lead';
}
function canStage(name){return canManage()||( ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag&&specCanon(ownerOf(name)||'').toLowerCase()===specCanon(SBPROFILE.specialist_tag).toLowerCase());}
async function setStage(name,stage,reason){
  if(!canStage(name))return alert('Only the account owner, managers, or admins can move stages.');
  try{
    const nm=acctDedup(name);
    const patch={stage,stage_since:new Date().toISOString(),lost_reason:stage==='lost'?(reason||null):null};
    const {data:ex}=await SB.from('accounts').select('name').eq('name',nm).maybeSingle();
    if(ex){const {error}=await SB.from('accounts').update(patch).eq('name',nm);if(error)throw error;}
    else{const {error}=await SB.from('accounts').insert({name:nm,...patch});if(error)throw error;}
    audit('pipeline.stage',{account:nm,stage,reason:reason||''});
    await loadOwners(true);
    if(currentView==='pipeline')renderPipeline();
    if(currentView==='account')renderAccountPage();
  }catch(e){alert('Could not move: '+(e.message||e)+(String(e.message||'').includes('stage')?'\n\n(Run the pipeline SQL from SUPABASE-SETUP.md.)':''));}
}
function stageMove(name,cur,dir){
  const i=PIPE_STAGES.indexOf(cur);
  const next=PIPE_STAGES[Math.min(PIPE_STAGES.length-1,Math.max(0,i+dir))];
  if(next!==cur)setStage(name,next);
}
function stageLost(name){
  const r=prompt('Mark "'+name+'" as LOST — reason? (price / competitor / timing / no budget / other)','');
  if(r===null)return;
  setStage(name,'lost',r.trim()||'other');
}
let OPPS=null;
async function loadOpps(force){
  if(OPPS&&!force)return OPPS;
  OPPS=[];
  try{const {data}=await SB.from('opportunities').select('*').order('id',{ascending:false}).limit(300);OPPS=data||[];}catch(e){}
  return OPPS;
}
async function renderPipeline(){
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading pipeline…</div>';
  try{await loadOwners();}catch(e){}
  await loadOpps(true);
  const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const rows=acctList().map(r=>({...r,stage:stageOf(r),owner:ownerOf(r.name)||''}))
    .filter(r=>!r.e.isRemedy)
    .filter(r=>!myTag||specCanon(r.owner).toLowerCase()===specCanon(myTag).toLowerCase());
  const open=(OPPS||[]).filter(o=>o.stage==='open').filter(o=>!myTag||specCanon(o.owner_tag||'').toLowerCase()===specCanon(myTag).toLowerCase());
  const ym=new Date().toISOString().slice(0,7);
  const stageByKey=k=>{const r=rows.find(x=>custNorm(acctDedup(x.name))===k);return r?r.stage:'active';};
  const wVal=open.reduce((a,o)=>a+Math.round((o.est_value||0)*(PIPE_W[stageByKey(custNorm(acctDedup(o.account)))]||0.5)),0);
  const mVal=open.filter(o=>o.expected_month===ym).reduce((a,o)=>a+(o.est_value||0),0);
  const won=(OPPS||[]).filter(o=>o.stage==='won').length,lost=(OPPS||[]).filter(o=>o.stage==='lost').length;
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px"';
  const acctOpts=acctList().map(r=>'<option value="'+esc(r.name)+'">').join('');
  const card=r=>{
    const days=r.last?Math.floor((Date.now()-new Date(r.last).getTime())/864e5):null;
    const can=canStage(r.name);
    return '<div style="background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:9px 11px;margin-bottom:8px">'+
    '<a href="#" onclick="showAccountPage(\''+jsq(r.name)+'\');return false" style="color:var(--tx);font-weight:600;font-size:12.5px;text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.name)+'</a>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin:2px 0 6px">'+(r.owner?esc(r.owner)+' · ':'')+(days!=null?days+'d since activity':'no activity')+(r.booked?' · '+fmtPeso(r.booked):'')+'</div>'+
    (can?'<div style="display:flex;gap:6px;font-size:11px">'+
      (r.stage!=='lead'?'<a href="#" onclick="stageMove(\''+jsq(r.name)+'\',\''+r.stage+'\',-1);return false" style="color:var(--tx3)">‹ back</a>':'')+
      (r.stage!=='active'?'<a href="#" onclick="stageMove(\''+jsq(r.name)+'\',\''+r.stage+'\',1);return false" style="color:var(--gr);font-weight:700">advance ›</a>':'')+
      '<span style="flex:1"></span><a href="#" onclick="stageLost(\''+jsq(r.name)+'\');return false" style="color:var(--rd)">lost</a></div>':'')+
    '</div>';
  };
  const col=(st,label)=>{
    const cs=rows.filter(r=>r.stage===st).sort((a,b)=>(b.booked||0)-(a.booked||0));
    return '<div style="flex:1;min-width:220px;background:var(--sf2);border-radius:12px;padding:10px;max-height:520px;overflow-y:auto">'+
    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);margin-bottom:8px">'+label+' · '+cs.length+'</div>'+
    cs.slice(0,40).map(card).join('')+(cs.length>40?'<div class="mu" style="font-size:11px;text-align:center">+'+(cs.length-40)+' more (use Accounts to search)</div>':'')+'</div>';
  };
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('pipeline'):'')+
    '<div class="metrics" style="margin-bottom:12px">'+
    '<div class="met bl"><div class="met-lbl">Open opportunities</div><div class="met-val">'+open.length+'</div><div class="met-sub">'+fmtPeso(open.reduce((a,o)=>a+(o.est_value||0),0))+' unweighted</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Weighted pipeline</div><div class="met-val" style="font-size:15px">'+fmtPeso(wVal)+'</div><div class="met-sub">by account stage (25/50/75/85%)</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Expected this month</div><div class="met-val" style="font-size:15px">'+fmtPeso(mVal)+'</div><div class="met-sub">opportunities closing '+ym+'</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Win rate</div><div class="met-val">'+((won+lost)?Math.round(won/(won+lost)*100)+'%':'—')+'</div><div class="met-sub">'+won+' won · '+lost+' lost</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="padding:12px 14px;margin-bottom:12px"><div class="phd">New opportunity</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<input id="op-acct" list="op-accts" placeholder="Account" '+inp+' style="flex:1;min-width:140px;'+inp.slice(7,-1)+'"><datalist id="op-accts">'+acctOpts+'</datalist>'+
    '<input id="op-title" placeholder="What’s the deal? (e.g. first stocking order)" '+inp+' style="flex:1;min-width:170px;'+inp.slice(7,-1)+'">'+
    '<input id="op-val" type="number" placeholder="Est. ₱" '+inp+' style="width:110px;'+inp.slice(7,-1)+'">'+
    '<input id="op-month" type="month" title="Expected close" '+inp+'>'+
    '<button onclick="oppAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:600;cursor:pointer">Add</button></div>'+
    (open.length?'<div style="margin-top:10px">'+open.map(o=>'<div class="drow"><span class="dlbl"><b>'+esc(o.title)+'</b> — <a href="#" onclick="showAccountPage(\''+jsq(o.account)+'\');return false" style="color:var(--ac)">'+esc(o.account)+'</a>'+(o.owner_tag?' · '+esc(o.owner_tag):'')+(o.expected_month?' · closes '+esc(o.expected_month):'')+'</span>'+
      '<span class="dval">'+fmtPeso(o.est_value||0)+' · <a href="#" onclick="oppSet('+o.id+',\'won\');return false" style="color:var(--gr);font-size:11px">won ✓</a> <a href="#" onclick="oppSet('+o.id+',\'lost\');return false" style="color:var(--rd);font-size:11px">lost ✗</a></span></div>').join('')+'</div>':'')+
    '</div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap">'+col('lead','Lead')+col('contacted','Contacted')+col('qualified','Qualified')+col('active','Active')+'</div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:10px">Stages start from behavior (bought = active · visited = contacted · found = lead) and every manual move is remembered and audited · advance › as the relationship progresses · dormant & lost accounts live in the Accounts view</div>';
}
async function oppAdd(){
  const g=id=>($(id)&&$(id).value||'').trim();
  if(!g('op-acct')||!g('op-title'))return alert('Need the account and a title.');
  try{
    const owner=ownerOf(g('op-acct'))||((ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||null);
    const {error}=await SB.from('opportunities').insert({account:acctDedup(g('op-acct')),acct_key:custNorm(acctDedup(g('op-acct'))),title:g('op-title'),owner_tag:owner,est_value:g('op-val')?Math.round(parseFloat(g('op-val'))):null,expected_month:g('op-month')||null,created_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('opportunity.add',{account:g('op-acct'),title:g('op-title'),value:g('op-val')});
    renderPipeline();
  }catch(e){alert('Could not add: '+(e.message||e)+(String(e.message||'').includes('opportunities')?'\n\n(Run the pipeline SQL from SUPABASE-SETUP.md.)':''));}
}
async function oppSet(id,stage){
  let reason=null;
  if(stage==='lost'){reason=prompt('Lost — reason? (price / competitor / timing / no budget / other)','');if(reason===null)return;}
  if(stage==='won'&&!confirm('Mark this opportunity WON? Link the resulting order from the account page afterwards.'))return;
  try{
    const {error}=await SB.from('opportunities').update({stage,lost_reason:reason,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    audit('opportunity.'+stage,{id,reason:reason||''});
    renderPipeline();
  }catch(e){alert(e.message||e);}
}

/* ── PURCHASE ORDERS + RECEIVING (procure-to-pay, feeds the scan ledger) ── */
const PO_NO=id=>docNo('po',id);
async function renderPOs(){
  if(!roleIn('admin','manager','supply_chain','finance')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Warehouse, finance, and management only.</div>';return;}
  loadingHint();
  let pos=[],lines=[];
  try{
    const r1=await SB.from('pos').select('*').order('id',{ascending:false}).limit(100);pos=r1.data||[];
    const r2=await SB.from('po_lines').select('*');lines=r2.data||[];
  }catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — run the purchase-orders SQL from SUPABASE-SETUP.md first.</div>';return;}
  const byPo={};lines.forEach(l=>(byPo[l.po_id]||(byPo[l.po_id]=[])).push(l));
  // costs follow the same rule as everywhere else: never sales managers (2026-08-28)
  const SHOWCOST=roleIn('admin','finance','supply_chain');
  const suppliers=[...new Set([...(DATA||[]).map(p=>p.supplier).filter(Boolean),...pos.map(p=>p.supplier)])].sort();
  const skuOpts=(DATA||[]).map(p=>'<option value="'+esc(p.sku)+'">'+esc(p.name)+'</option>').join('');
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px"';
  const pill=st=>st==='received'?'<span class="pill pgr">received</span>':st==='partial'?'<span class="pill pbl">partially received</span>':st==='ordered'?'<span class="pill" style="background:var(--am-bg);color:var(--am)">ordered</span>':st==='cancelled'?'<span class="pill prd">cancelled</span>':'<span class="pill pgy">draft</span>';
  const openId=window._poOpen;
  const openArr=pos.filter(p=>p.status==='ordered'||p.status==='partial');
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('po'):'')+
    '<div class="metrics" style="margin-bottom:12px">'+
    '<div class="met bl"><div class="met-lbl">Open POs</div><div class="met-val">'+openArr.length+'</div><div class="met-sub">ordered, awaiting stock</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Units incoming</div><div class="met-val">'+openArr.reduce((a,p)=>a+((byPo[p.id]||[]).reduce((x,l)=>x+Math.max(0,(l.qty||0)-(l.received||0)),0)),0).toLocaleString()+'</div><div class="met-sub">still to receive</div><div class="met-bar"></div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="met-lbl">Open payables (est ₱)</div><div class="met-val" style="font-size:15px">'+fmtPeso(pos.filter(p=>p.status!=='cancelled').reduce((a,p)=>a+(p.peso_value||0),0))+'</div><div class="met-sub">from the AP blocks below</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Next arrival</div><div class="met-val" style="font-size:15px">'+((openArr.filter(p=>p.eta).sort((a,b)=>a.eta<b.eta?-1:1)[0]||{}).eta||'—')+'</div><div class="met-sub">earliest ETA</div><div class="met-bar"></div></div>'+
    '</div>'+
    (canWarehouse()?'<div class="panel" style="padding:12px 14px;margin-bottom:12px"><div class="phd">New purchase order</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<input id="po-sup" list="po-sups" placeholder="Supplier" '+inp+' style="flex:1;min-width:150px;'+inp.slice(7,-1)+'"><datalist id="po-sups">'+suppliers.map(s2=>'<option value="'+esc(s2)+'">').join('')+'</datalist>'+
    '<input id="po-eta" type="date" title="ETA" '+inp+'>'+
    '<button onclick="poCreate()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:600;cursor:pointer">Create draft</button>'+
    '<span style="font-size:11px;color:var(--tx3)">then add lines inside the PO and mark it ordered</span></div></div>':'')+
    (pos.length?pos.map(p=>{
      const ls=byPo[p.id]||[];
      const done=ls.reduce((a,l)=>a+(l.received||0),0),tot=ls.reduce((a,l)=>a+(l.qty||0),0);
      const opened=openId===p.id;
      return '<div class="panel" style="padding:12px 16px;margin-bottom:10px">'+
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;cursor:pointer" onclick="window._poOpen='+(opened?'null':p.id)+';renderPOs()">'+
      '<b style="font-size:14px">'+PO_NO(p.id)+'</b> '+pill(p.status)+(p.awaiting_approval?' <span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">waiting for approval</span>':'')+(p.approved&&p.status!=='draft'?' <span class="pill pgr">approved</span>':'')+'<span class="mu" style="font-size:12px">'+esc(p.supplier)+(p.eta?' · ETA '+esc(p.eta):'')+'</span>'+
      '<span style="flex:1"></span><span class="mu" style="font-size:12px">'+done+' / '+tot+' units received</span><span style="color:var(--ac);font-size:12px">'+(opened?'▲':'▼')+'</span></div>'+
      (opened?'<div style="margin-top:10px">'+
        (ls.length?'<div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th style="text-align:right">Ordered</th><th style="text-align:right">Received</th>'+(SHOWCOST?'<th style="text-align:right">Unit cost</th>':'')+'<th></th></tr></thead><tbody>'+
        ls.map(l=>'<tr><td>'+esc(l.sku)+'</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(l.name||'')+'</td><td class="r">'+l.qty+'</td><td class="r" style="font-weight:700;color:'+((l.received||0)>=l.qty?'var(--gr)':'var(--tx)')+'">'+(l.received||0)+'</td>'+(SHOWCOST?'<td class="r mu">'+(l.unit_cost?fmtPeso(l.unit_cost):'—')+'</td>':'')+
        '<td>'+((p.status==='ordered'||p.status==='partial')&&(l.received||0)<l.qty?'<a href="#" onclick="poReceive('+p.id+','+l.id+',\''+esc(l.sku)+'\','+l.qty+','+(l.received||0)+');return false" style="color:var(--gr);font-size:11.5px;font-weight:700">receive…</a>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="mu" style="font-size:12px">No lines yet.</div>')+
        apBlock(p)+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">'+
        (p.status==='draft'?'<input id="pl-sku-'+p.id+'" list="pl-skus" placeholder="SKU" '+inp+' style="width:150px;'+inp.slice(7,-1)+'"><datalist id="pl-skus">'+skuOpts+'</datalist>'+
          '<input id="pl-qty-'+p.id+'" type="number" placeholder="Qty" '+inp+' style="width:90px;'+inp.slice(7,-1)+'">'+
          (SHOWCOST?'<input id="pl-cost-'+p.id+'" type="number" placeholder="Unit cost ₱ (opt.)" '+inp+' style="width:150px;'+inp.slice(7,-1)+'">':'')+
          '<button onclick="poAddLine('+p.id+')" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">+ Line</button>'+
          (ls.length?'<button onclick="poStatus('+p.id+',\'ordered\')" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">Mark ordered →</button>':'')
        :'')+
        (p.status!=='cancelled'&&p.status!=='received'?'<a href="#" onclick="poStatus('+p.id+',\'cancelled\');return false" style="color:var(--rd);font-size:11px">cancel PO</a>':'')+
        '</div></div>':'')+
      '</div>';}).join(''):'<div class="empty" style="margin-top:20px">No purchase orders yet — create the first draft above.</div>')+
    '<div style="font-size:11px;color:var(--tx3);margin-top:8px">Receiving asks for batch + expiry at the door and writes straight into the stock ledger'+(flagOn('ledger_is_truth')?'':' (shadow — the sheet stays stock truth until cutover)')+' · unit costs flow toward margin reporting</div>';
}
async function poCreate(){
  if(!canWarehouse())return alert('PO writing is admin + supply chain.');
  const sup=(($('po-sup')||{}).value||'').trim();
  if(!sup)return alert('Who’s the supplier?');
  try{
    const {data,error}=await SB.from('pos').insert({supplier:sup,eta:(($('po-eta')||{}).value||null)||null,status:'draft',created_by:(SBUSER&&SBUSER.id)||null}).select().single();
    if(error)throw error;
    audit('po.create',{po:PO_NO(data.id),supplier:sup});
    window._poOpen=data.id;renderPOs();
  }catch(e){alert('Could not create: '+(e.message||e));}
}
async function poAddLine(poId){
  if(!canWarehouse())return;
  const sku=(($('pl-sku-'+poId)||{}).value||'').trim(),qty=parseInt(($('pl-qty-'+poId)||{}).value||'0',10);
  if(!sku||!qty||qty<1)return alert('Need a SKU and quantity.');
  const p=(DATA||[]).find(x=>x.sku===sku);
  const cost=($('pl-cost-'+poId)||{}).value;
  try{
    const {error}=await SB.from('po_lines').insert({po_id:poId,sku,name:(p&&p.name)||sku,qty,unit_cost:cost?Math.round(parseFloat(cost)):null});
    if(error)throw error;
    renderPOs();
  }catch(e){alert(e.message||e);}
}
async function poStatus(poId,st){
  if(!canWarehouse())return;
  if(st==='cancelled'&&!confirm('Cancel this PO?'))return;
  try{
    // SPEND GATE: sending a PO to the supplier commits money. Over the
    // threshold it holds for sign-off first — the mirror of the sales-order gate.
    if(st==='ordered'){
      const thr=parseFloat(((FLAGS&&FLAGS.po_approval_threshold)||'').toString().replace(/,/g,''))||0;
      const {data:po,error:poErr}=await SB.from('pos').select('id,supplier,approved,awaiting_approval').eq('id',poId).maybeSingle();
      if(thr>0&&(poErr||!po))return alert('Cannot check the purchase limit right now'+(poErr?' ('+(poErr.message||poErr)+')':'')+'. The PO was NOT marked ordered — run the accounting-integrity SQL if this persists.');
      const {data:ls}=await SB.from('po_lines').select('qty,unit_cost').eq('po_id',poId);
      const value=(ls||[]).reduce((a,l)=>a+((l.unit_cost||0)*(l.qty||0)),0);
      const noCost=(ls||[]).some(l=>l.unit_cost==null); // an uncosted PO can hide any amount
      if(thr>0&&noCost&&!po.approved){
        return alert(PO_NO(poId)+' has line(s) with no unit cost, so its value cannot be checked against the '+fmtPeso(thr)+' purchase limit.\n\nEnter the unit costs first — an uncosted PO cannot be sent for approval or marked ordered.');
      }
      if(thr>0&&value>thr&&!po.approved){
        if(po.awaiting_approval)return alert(PO_NO(poId)+' is already waiting for approval ('+fmtPeso(value)+' is over the '+fmtPeso(thr)+' limit).');
        if(!confirm(PO_NO(poId)+' is '+fmtPeso(value)+', over the '+fmtPeso(thr)+' purchase limit.\n\nSubmit it for approval? It stays a draft until an admin signs off.'))return;
        await SB.from('pos').update({awaiting_approval:true,updated_at:new Date().toISOString()}).eq('id',poId);
        await SB.from('approvals').insert({kind:'po',po_id:poId,order_label:PO_NO(poId),account:(po&&po.supplier)||'',amount:Math.round(value),
          reason:'Purchase order '+fmtPeso(value)+' exceeds the '+fmtPeso(thr)+' approval limit',
          requested_by:(SBUSER&&SBUSER.id)||null,requested_name:(SBPROFILE&&SBPROFILE.name)||''});
        audit('po.submit',{po:PO_NO(poId),value});
        try{notify({roles:['admin']},'approval','PO needs approval: '+PO_NO(poId),((po&&po.supplier)||'')+' \u00b7 '+fmtPeso(value)+' \u2014 over the purchase limit','#/v/approvals');}catch(e){}
        alert('Submitted for approval. The PO stays a draft until it is signed off.');
        renderPOs();return;
      }
    }
    const {error}=await SB.from('pos').update({status:st,updated_at:new Date().toISOString()}).eq('id',poId);
    if(error)throw error;
    audit('po.'+st,{po:PO_NO(poId)});
    renderPOs();
  }catch(e){alert(e.message||e);}
}
async function setPoThreshold(){
  if(!isSuper())return alert('Spend limits are a super-admin setting.');
  const v=prompt('Hold purchase orders above this amount for approval (₱, blank = off):',(FLAGS&&FLAGS.po_approval_threshold)||'');
  if(v===null)return;
  await setFlagRaw('po_approval_threshold',v.trim().replace(/,/g,''));
  renderApprovals();
}
async function poReceive(poId,lineId,sku,qty,got){
  if(!canWarehouse())return alert('Receiving is admin + supply chain.');
  const left=qty-got;
  const n=parseInt(prompt('Receiving '+sku+' — how many units? ('+left+' outstanding)',String(left))||'0',10);
  if(!n||n<1)return;
  if(n>left&&!confirm(n+' is more than the '+left+' outstanding — receive anyway?'))return;
  const batch=(prompt('Batch / lot number (from the box):','')||'').trim();
  const expiry=(prompt('Expiry (MM/YYYY):','')||'').trim();
  const qaHold=!confirm('Receive as SELLABLE stock?\n\nOK = sellable (into the ledger now)\nCancel = QA HOLD (quarantined until inspection releases it)');
  try{
    if(qaHold){
      const p=DATA.find(x=>x.sku===sku);
      await quarAdd(sku,(p&&p.name)||sku,n,batch,'QA hold',PO_NO(poId),false);
    }else
    await ledgerAdd([{sku,qty:n,kind:'receive',ref:PO_NO(poId),batch:batch||null,note:expiry?('exp '+expiry):null}]);
    const {error}=await SB.from('po_lines').update({received:got+n}).eq('id',lineId);
    if(error)throw error;
    const {data:ls}=await SB.from('po_lines').select('qty,received').eq('po_id',poId);
    const full=(ls||[]).every(l=>(l.received||0)>=l.qty);
    await SB.from('pos').update({status:full?'received':'partial',updated_at:new Date().toISOString()}).eq('id',poId);
    audit('po.receive',{po:PO_NO(poId),sku,qty:n,batch});
    boRelease(sku,n); // stock arrived — auto-release waiting backorders, oldest first
    renderPOs();
  }catch(e){alert('Could not receive: '+(e.message||e));}
}

/* ══ FINANCE SUITE: credit limits + approvals · commissions · supplier AP · events ══ */

// ── CREDIT LIMITS + APPROVAL QUEUE ──────────────────────────────────────────
function openExposure(name){ // open balances for an account (native register)
  const nm=acctDedup(name||'');
  return (NORDERS||[]).filter(o=>!o.deleted_at&&o.status!=='cancelled'&&(o.balance||0)>0&&acctDedup(o.account||'')===nm)
    .reduce((a,o)=>a+(o.balance||0),0);
}
function creditLimitOf(name){
  const k=custNorm(acctDedup(name||''));
  return (window.CREDITS||{})[k]||null;
}
async function setCreditLimit(name){
  if(!roleIn('admin','finance'))return alert('Credit limits are set by finance/admin.');
  const cur=creditLimitOf(name);
  const v=prompt('Credit limit for '+name+' (₱ — blank to remove):',cur!=null?String(cur):'');
  if(v===null)return;
  try{
    const nm=acctDedup(name);
    const lim=v.trim()===''?null:Math.round(parseFloat(v.replace(/,/g,'')));
    const {data:ex}=await SB.from('accounts').select('name').eq('name',nm).maybeSingle();
    if(ex){const {error}=await SB.from('accounts').update({credit_limit:lim}).eq('name',nm);if(error)throw error;}
    else{const {error}=await SB.from('accounts').insert({name:nm,credit_limit:lim});if(error)throw error;}
    audit('credit.limit',{account:nm,limit:lim});
    await loadOwners(true);
    if(currentView==='account')renderAccountPage();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('credit_limit')?'\n\n(Run the finance-suite SQL from SUPABASE-SETUP.md.)':''));}
}
async function renderApprovals(){
  if(!canManage()&&ROLE!=='finance'){$('content').innerHTML='<div class="empty" style="margin-top:40px">Managers decide approvals; finance may watch.</div>';return;}
  loadingHint();
  let rows=[];
  try{const {data}=await SB.from('approvals').select('*').order('id',{ascending:false}).limit(200);rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — run the finance-suite SQL from SUPABASE-SETUP.md first.</div>';return;}
  const pend=rows.filter(r=>r.status==='pending');
  const pill=st=>st==='approved'?'<span class="pill pgr">approved</span>':st==='rejected'?'<span class="pill prd">rejected</span>':'<span class="pill" style="background:var(--am-bg);color:var(--am)">pending</span>';
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('approvals'):'')+
    '<div class="metrics" style="margin-bottom:12px">'+
    '<div class="met am"><div class="met-lbl">Awaiting decision</div><div class="met-val">'+pend.length+'</div><div class="met-sub">orders held from fulfillment</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Held value</div><div class="met-val" style="font-size:15px">'+fmtPeso(pend.reduce((a,r)=>a+(r.amount||0),0))+'</div><div class="met-sub">released on approval</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>When</th><th>Type</th><th>Account</th><th>Order</th><th style="text-align:right">Amount</th><th>Why held</th><th>By</th><th>Status</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td class="mu" style="font-size:11px">'+esc(String(r.created_at||'').slice(0,16).replace('T',' '))+'</td>'+
      '<td>'+(r.kind==='credit'?'<span class="pill prd">credit hold</span>':r.kind==='po'?'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">purchase</span>':'<span class="pill pbl">big order</span>')+'</td>'+
      '<td style="max-width:170px;overflow:hidden;text-overflow:ellipsis"><a href="#" onclick="showAccountPage(\''+jsq(r.account)+'\');return false" style="color:var(--ac)">'+esc(r.account)+'</a></td>'+
      '<td>'+(r.kind==='po'?'<a href="#" onclick="showView(\'po\');return false" style="color:var(--ac)">'+esc(r.order_label||'—')+'</a>':'<a href="#" onclick="showOrderPage(\''+jsq(r.order_id||'')+'\');return false" style="color:var(--ac)">'+esc(r.order_label||'—')+'</a>')+'</td>'+
      '<td class="r" style="font-weight:700">'+fmtPeso(r.amount||0)+'</td>'+
      '<td class="mu" style="font-size:11.5px;max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(r.reason||'')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+esc(r.requested_name||'')+'</td>'+
      '<td>'+pill(r.status)+'</td>'+
      '<td style="white-space:nowrap">'+(r.status==='pending'&&canManage()?'<a href="#" onclick="approvalAct('+r.id+',\'approved\');return false" style="color:var(--gr);font-weight:700;font-size:11.5px">approve ✓</a> · <a href="#" onclick="approvalAct('+r.id+',\'rejected\');return false" style="color:var(--rd);font-size:11.5px">reject ✗</a>':'')+'</td></tr>').join(''):
    '<tr><td colspan="9"><div class="empty">Nothing waiting — orders that trip a credit limit or the big-order threshold land here.</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Approve = the order is released to the fulfillment queue · reject = the order is cancelled with the reason on record · thresholds: credit limit per account (set by finance on account pages) and the big-order threshold below</span></div></div>'+
    (ROLE==='admin'?'<div class="panel" style="padding:10px 14px;margin-top:12px;font-size:12px"><b>Big-order threshold:</b> orders above ₱<span id="ap-thr">'+((window.FLAGS&&FLAGS.approval_threshold)?Number(FLAGS.approval_threshold).toLocaleString():'—')+'</span> from specialists need sign-off · <a href="#" onclick="setApprovalThreshold();return false" style="color:var(--ac)">change</a> (blank = off)'+
      '<br><b>Purchase threshold:</b> purchase orders above ₱<span id="ap-pothr">'+((window.FLAGS&&FLAGS.po_approval_threshold)?Number(FLAGS.po_approval_threshold).toLocaleString():'—')+'</span> hold as drafts until signed off · <a href="#" onclick="setPoThreshold();return false" style="color:var(--ac)">change</a> (blank = off)</div>':'');
}
async function setApprovalThreshold(){
  if(!isSuper())return alert('Cutover-level setting — super admin only.');
  const v=prompt('Hold specialist orders above this amount for manager approval (₱, blank = off):',(FLAGS&&FLAGS.approval_threshold)||'');
  if(v===null)return;
  await setFlagRaw('approval_threshold',v.trim().replace(/,/g,''));
  renderApprovals();
}
async function setFlagRaw(k,v){ // super-admin setting write (no confirm ceremony)
  try{
    const {error}=await SB.from('app_settings').upsert({key:k,value:String(v),updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()});
    if(error)throw error;
    audit('setting.'+k,{value:String(v).slice(0,40)});
    await loadFlags(true);
  }catch(e){alert('Could not save: '+(e.message||e));}
}
async function approvalAct(id,decision){
  if(!canManage())return;
  if(decision==='rejected'&&!confirm('Reject this order? It will be CANCELLED with the reason on record.'))return;
  try{
    const {data:r}=await SB.from('approvals').select('*').eq('id',id).maybeSingle();
    if(!r||r.status!=='pending')return;
    const {error}=await SB.from('approvals').update({status:decision,decided_by:(SBPROFILE&&SBPROFILE.name)||'',decided_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    if(r.kind==='po'&&r.po_id){ // purchase order spend gate — admin only (managers have no write on pos)
      if(!roleIn('admin'))return alert('Purchase approvals are an admin decision.');
      const patch=decision==='approved'
        ?{approved:true,awaiting_approval:false,status:'ordered',updated_at:new Date().toISOString()}
        :{awaiting_approval:false,status:'cancelled',updated_at:new Date().toISOString()};
      const {error:ePo}=await SB.from('pos').update(patch).eq('id',r.po_id);
      if(ePo)throw new Error('The PO could not be updated: '+(ePo.message||ePo));
    }else if(r.order_id){
      if(decision==='approved')await SB.from('orders').update({approved:true}).eq('id',r.order_id);
      else await SB.from('orders').update({status:'cancelled',approved:true}).eq('id',r.order_id);
    }
    audit('approval.'+decision,{order:r.order_label,account:r.account,amount:r.amount});
    try{
      if(r.requested_by)notify({user_id:r.requested_by},'decision','Order '+(decision==='approved'?'APPROVED':'REJECTED')+': '+r.order_label,r.account+' · '+fmtPeso(r.amount||0)+(decision==='rejected'?' — cancelled':''),'#/v/orders');
      if(decision==='approved')notify({roles:['supply_chain']},'order','New order '+r.order_label,r.account+' · '+fmtPeso(r.amount||0)+' — approved, ready to pick','#/v/fulfillq');
    }catch(e){}
    NORDERS=null;renderApprovals();
  }catch(e){alert('Could not decide: '+(e.message||e));}
}

// ── COMMISSIONS (finance-owned): rate tiers by attainment, payroll-ready ────
async function loadCommRules(){
  let rules=[{min:0,pct:0},{min:80,pct:1},{min:100,pct:2},{min:120,pct:3}];
  try{const {data}=await SB.from('comm_rules').select('rules').eq('id',1).maybeSingle();if(data&&data.rules)rules=JSON.parse(data.rules);}catch(e){}
  return rules;
}
async function renderCommissions(){
  if(!roleIn('admin','finance')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Finance and admin only.</div>';return;}
  if(!SHOPIFY||!SHOPIFY.specialists){$('content').innerHTML='<div class="empty" style="margin-top:40px">Waiting for the sales cache…</div>';try{loadShopify().then(()=>{if(currentView==='commissions')renderCommissions();});}catch(e){}return;}
  const rules=await loadCommRules();
  const yms=[];const d=new Date();for(let i=0;i<13;i++){yms.push(d.toISOString().slice(0,7));d.setMonth(d.getMonth()-1);}
  const ym=window._commYm&&yms.includes(window._commYm)?window._commYm:yms[1]||yms[0]; // default: last complete month
  window._commYm=ym;
  // merged per-specialist booked for the month
  const S={};
  for(const raw in (SHOPIFY.specialists||{})){
    const cn=specCanon(raw);if(!cn||INTERNAL_TAG.test(cn))continue;
    const k=cn.toLowerCase();
    /* Commission is paid on external sales only, always — never on Remedy or
       Healthspan-internal orders, and deliberately not tied to the sales toggle. */
    const m=netMonthly(SHOPIFY.specialists[raw],'',true)[ym];
    if(!S[k])S[k]={name:cn,v:0};
    if(m)S[k].v+=m.v||0;
  }
  // CREDIT MEMOS for the month, netted against the specialist who booked the sale.
  // CMs already refunded in Shopify are excluded — the sales cache has removed
  // those units at source, so deducting again would double-count the reversal.
  const CM={};let cmUnattributed=0,cmError='';
  {
    const nextYm=(function(){const [y,m]=ym.split('-').map(Number);const d=new Date(Date.UTC(y,m,1));return d.toISOString().slice(0,7);})();
    const {data:cms,error:cmErr}=await SB.from('returns').select('amount,spec,date,shopify_refunded')
      .gte('date',ym+'-01').lt('date',nextYm+'-01'); // month-length safe: no '-31'
    if(cmErr)cmError=cmErr.message||String(cmErr); // pre-migration DB: say so, don't show a silent zero
    for(const r of (cms||[])){
      if(r.shopify_refunded)continue;
      const amt=Math.round(r.amount||0);
      const k=specCanon(r.spec||'').toLowerCase();
      if(!k){cmUnattributed+=amt;continue;}
      CM[k]=(CM[k]||0)+amt;
    }
  }
  const tgtOf=k=>{const x=(TARGETS||[]).find(x=>x.month===ym&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===k);return x?x.value:null;};
  const rateFor=att=>{let r=0;for(const t of rules.slice().sort((a,b)=>a.min-b.min))if(att>=t.min)r=t.pct;return r;};
  const rows=Object.keys(S).map(k=>{
    const e=S[k],T=tgtOf(k);
    const cm=CM[k]||0;
    const net=Math.max(0,e.v-cm);           // commissionable = booked less returns
    const att=T?net/T*100:null;             // attainment on NET, so a return can drop a tier
    const pct=att!=null?rateFor(att):0;
    return {name:e.name,booked:e.v,cm,net,T,att,pct,comm:Math.round(net*pct/100)};
  }).filter(r=>r.booked>0||r.T||r.cm).sort((a,b)=>b.comm-a.comm);
  // a specialist with credit memos but no bookings this month has no row in S —
  // surface them rather than losing the reversal entirely
  for(const k in CM){
    if(rows.some(r=>specCanon(r.name).toLowerCase()===k))continue;
    rows.push({name:k,booked:0,cm:CM[k],net:0,T:tgtOf(k),att:0,pct:0,comm:0});
  }
  window._COMMROWS=rows;
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">Month</b>'+
    '<select onchange="window._commYm=this.value;renderCommissions()" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12.5px">'+yms.map(m=>'<option'+(m===ym?' selected':'')+'>'+m+'</option>').join('')+'</select>'+
    '<span style="font-size:11.5px;color:var(--tx3)">rate tiers by attainment: '+rules.map(t=>t.min+'%→'+t.pct+'%').join(' · ')+'</span>'+
    '<a href="#" onclick="editCommRules();return false" style="color:var(--ac);font-size:12px">edit tiers</a>'+
    '<span style="flex:1"></span>'+
    '<button onclick="commExport()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12.5px;font-weight:600;cursor:pointer">Export for payroll</button></div>'+
    '<div class="metrics" style="margin-bottom:12px">'+
    '<div class="met gr"><div class="met-lbl">Total commissions</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.comm,0))+'</div><div class="met-sub">'+ym+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Team booked</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.booked,0))+'</div><div class="met-sub">gross, before credit memos</div><div class="met-bar"></div></div>'+
    (cmError?'<div class="met am"><div class="met-lbl">Credit memos</div><div class="met-val" style="font-size:13px">not loaded</div><div class="met-sub">'+esc(cmError.slice(0,60))+' — figures below are GROSS</div><div class="met-bar"></div></div>':'')+
    '<div class="met rd"><div class="met-lbl">Credit memos netted</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.cm,0))+'</div><div class="met-sub">'+(cmUnattributed?fmtPeso(cmUnattributed)+' more had no specialist':'all attributed')+'</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Earning</div><div class="met-val">'+rows.filter(r=>r.comm>0).length+' / '+rows.length+'</div><div class="met-sub">specialists above tier 1</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Specialist</th><th style="text-align:right">Booked</th><th style="text-align:right">Credit memos</th><th style="text-align:right">Net</th><th style="text-align:right">Target</th><th style="text-align:right">Attainment</th><th style="text-align:right">Rate</th><th style="text-align:right">Commission</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td style="font-weight:600">'+esc(r.name)+'</td><td class="r mu">'+fmtPeso(r.booked)+'</td>'+
      '<td class="r" style="color:'+(r.cm?'var(--rd)':'var(--tx3)')+'">'+(r.cm?'−'+fmtPeso(r.cm):'—')+'</td>'+
      '<td class="r" style="font-weight:700">'+fmtPeso(r.net)+'</td><td class="r mu">'+(r.T!=null?fmtPeso(r.T):'—')+'</td>'+
      '<td class="r" style="font-weight:600;color:'+(r.att==null?'var(--tx3)':r.att>=100?'var(--gr)':r.att>=80?'var(--am)':'var(--rd)')+'">'+(r.att!=null?r.att.toFixed(0)+'%':'no target')+'</td>'+
      '<td class="r">'+r.pct+'%</td><td class="r" style="font-weight:800;color:var(--ac)">'+fmtPeso(r.comm)+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Booked here is <b>external sales only</b> — Remedy and Healthspan-internal orders never earn commission, and that is fixed, not a setting. Commission = <b>net</b> × the rate of the highest tier reached, where net = booked less the month\u2019s credit memos attributed to that specialist \u2014 so a return can also drop someone a tier. Credit memos ticked \u201calready refunded in Shopify\u201d are skipped, because the sales cache has already removed those units at source. CMs recorded without a specialist are shown on the card above but cannot be deducted from anyone \u2014 name the specialist when recording them. Based on booked (not collected) sales \u00b7 export is the payroll input — payroll itself stays outside HQ · rate changes are audited</span></div></div>';
}
async function editCommRules(){
  if(!roleIn('admin','finance'))return;
  const rules=await loadCommRules();
  const txt=prompt('Commission tiers — one per line as  min-attainment% : rate%\n(e.g. "80:1" = reaching 80% of target earns 1% of booked)',rules.map(t=>t.min+':'+t.pct).join('\n'));
  if(txt===null)return;
  const out=[];
  for(const line of txt.split('\n')){const m=line.trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);if(m)out.push({min:+m[1],pct:+m[2]});}
  if(!out.length)return alert('No valid tiers.');
  try{
    const {error}=await SB.from('comm_rules').upsert({id:1,rules:JSON.stringify(out),updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()});
    if(error)throw error;
    audit('commissions.rules',{tiers:out.length});
    renderCommissions();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('comm_rules')?'\n\n(Run the finance-suite SQL.)':''));}
}
function commExport(){
  const rows=window._COMMROWS||[];if(!rows.length)return;
  const h=['Specialist','Month','Booked (gross)','Credit memos','Net commissionable','Target','Attainment %','Rate %','Commission'];
  const body=rows.map(r=>[r.name,window._commYm,r.booked,r.cm||0,r.net,r.T||'',r.att!=null?r.att.toFixed(1):'',r.pct,r.comm].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent([h.join(','),...body].join('\n'));
  a.download='healthspan_commissions_'+window._commYm+'.csv';a.click();
  audit('commissions.export',{month:window._commYm,specialists:rows.length});
}

// ── EVENTS CALENDAR: one month grid — campaigns, demos, trainings, planned visits ──
async function renderEvents(){
  await loadCampaigns();
  if(!VISITS){loadVisits().then(()=>{if(currentView==='salesevents')renderEvents();});}
  const ym=window._evYm||new Date().toISOString().slice(0,7);window._evYm=ym;
  const [Y,M]=ym.split('-').map(Number);
  const first=new Date(Y,M-1,1),dim=new Date(Y,M,0).getDate(),startDow=first.getDay();
  const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const items={}; // day -> [{t,txt,color}]
  const add=(day,txt,color,title)=>{(items[day]||(items[day]=[])).push({txt,color,title:title||txt});};
  for(const c of (CAMPAIGNS||[])){
    for(let d=1;d<=dim;d++){
      const ds=ym+'-'+String(d).padStart(2,'0');
      if(ds>=c.from_date&&ds<=c.to_date){
        if(ds===c.from_date||d===1)add(d,'📣 '+c.name,'var(--am)',c.name+' ('+c.from_date+'→'+c.to_date+')');
        else add(d,'· '+c.name,'var(--am)',c.name);
      }
    }
  }
  for(const v of (VISITS||[])){
    if((v.date||'').slice(0,7)!==ym)continue;
    if(myTag&&specCanon(v.spec||'').toLowerCase()!==specCanon(myTag).toLowerCase())continue;
    const d=+v.date.slice(8,10);
    const demo=/demo|event|congress/i.test(v.type||'');
    if(v.status==='planned')add(d,(demo?'🎓 ':'📍 ')+(v.spec?v.spec.split(' ')[0]+': ':'')+v.account,'var(--bl)',(v.type||'Visit')+' — '+v.account+' ('+v.spec+')');
    else if(demo)add(d,'🎓 '+v.account,'var(--pu)',(v.type||'Demo')+' — '+v.account+' ('+v.spec+')');
  }
  const nav=dlt=>{const nd=new Date(Y,M-1+dlt,1);return nd.toISOString().slice(0,7);};
  const today=new Date().toISOString().slice(0,10);
  let cells='';
  for(let i=0;i<startDow;i++)cells+='<div></div>';
  for(let d=1;d<=dim;d++){
    const ds=ym+'-'+String(d).padStart(2,'0');
    const its=(items[d]||[]).slice(0,4);
    cells+='<div style="min-height:86px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:6px'+(ds===today?';outline:2px solid var(--ac)':'')+'">'+
      '<div style="font-size:11px;font-weight:700;color:var(--tx3)">'+d+'</div>'+
      its.map(x=>'<div title="'+esc(x.title)+'" style="font-size:10px;color:'+x.color+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">'+esc(x.txt)+'</div>').join('')+
      ((items[d]||[]).length>4?'<div style="font-size:9px;color:var(--tx3)">+'+((items[d]||[]).length-4)+' more</div>':'')+
      '</div>';
  }
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
    '<button onclick="window._evYm=\''+nav(-1)+'\';renderEvents()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 12px;cursor:pointer">‹</button>'+
    '<b style="font-size:15px">'+new Date(Y,M-1,15).toLocaleString('en',{month:'long',year:'numeric'})+'</b>'+
    '<button onclick="window._evYm=\''+nav(1)+'\';renderEvents()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 12px;cursor:pointer">›</button>'+
    '<span style="flex:1"></span>'+
    '<span style="font-size:11px;color:var(--tx3)">📣 campaign · 📍 planned visit · 🎓 demo/training/event'+(myTag?' · showing yours':'')+'</span></div>'+
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;font-size:10px;color:var(--tx3);font-weight:700;text-transform:uppercase;margin-bottom:4px">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>'<div style="padding:0 6px">'+x+'</div>').join('')+'</div>'+
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">'+cells+'</div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:10px">One calendar for the room: campaigns (Campaign calendar), demos & trainings, and planned visits — Mench’s weekly Calendar of Events, live · specialists see their own visits; everyone sees campaigns</div>';
}

// ── SUPPLIER AP (finance): terms, proforma, FX amounts, payments per PO ──
async function apSet(poId,field,label,cur){
  if(!roleIn('admin','finance'))return alert('AP fields are finance/admin.');
  const v=prompt(label+':',cur==null?'':String(cur));
  if(v===null)return;
  try{
    const patch={};
    if(['fx_total','amount_paid','peso_value','fx_rate','landed_cost'].includes(field))patch[field]=v.trim()===''?null:Math.round(parseFloat(v.replace(/,/g,''))*100)/100;
    else patch[field]=v.trim()||null;
    const {error}=await SB.from('pos').update(patch).eq('id',poId);
    if(error)throw error;
    audit('ap.'+field,{po:PO_NO(poId),value:String(v).slice(0,40)});
    renderPOs();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes(field)?'\n\n(Run the finance-suite SQL.)':''));}
}
function apBlock(p){
  const bal=(p.fx_total!=null&&p.amount_paid!=null)?(p.fx_total-p.amount_paid):null;
  const ed=roleIn('admin','finance');
  const cell=(field,label,val,fmt)=>'<div class="drow"><span class="dlbl">'+label+'</span><span class="dval">'+(val!=null&&val!==''?esc(fmt?fmt(val):String(val)):'—')+(ed?' <a href="#" onclick="apSet('+p.id+',\''+field+'\',\''+label+'\',\''+jsq(String(val==null?'':val))+'\');return false" style="color:var(--ac);font-size:10px">✎</a>':'')+'</span></div>';
  return '<div style="background:var(--sf2);border-radius:10px;padding:10px 14px;margin-top:10px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:4px">Supplier AP</div>'+
    cell('terms','Terms',p.terms)+
    cell('proforma','Proforma invoice',p.proforma)+
    cell('currency','Currency',p.currency||'PHP')+
    cell('fx_total','Invoice total ('+(p.currency||'PHP')+')',p.fx_total,v=>Number(v).toLocaleString())+
    cell('amount_paid','Paid ('+(p.currency||'PHP')+')',p.amount_paid,v=>Number(v).toLocaleString())+
    '<div class="drow"><span class="dlbl">Balance</span><span class="dval" style="font-weight:700;color:'+(bal>0?'var(--rd)':'var(--gr)')+'">'+(bal!=null?Number(bal).toLocaleString():'—')+'</span></div>'+
    cell('peso_value','Est. value in ₱ (open)',p.peso_value,v=>fmtPeso(v))+
    cell('fx_rate','FX rate at payment (₱ per '+(p.currency||'unit')+')',p.fx_rate,v=>Number(v).toLocaleString())+
    cell('landed_cost','Landed cost add-on ₱ (freight+customs+brokerage)',p.landed_cost,v=>fmtPeso(v))+
    '</div>'+
    '<div style="background:var(--sf2);border-radius:10px;padding:10px 14px;margin-top:10px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:4px">Import shipment</div>'+
    impCell(p,'etd','ETD (departs origin)')+
    impCell(p,'eta','ETA (arrives PH)')+
    impCell(p,'customs_status','Customs status (in transit / clearing / cleared / delivered)')+
    impCell(p,'broker','Broker / forwarder')+
    '</div>';
}
function impCell(p,field,label){
  const ed=canWarehouse()||roleIn('finance');
  const val=p[field];
  return '<div class="drow"><span class="dlbl">'+label+'</span><span class="dval">'+(val?esc(String(val)):'—')+(ed?' <a href="#" onclick="impSet('+p.id+',\''+field+'\',\''+label.replace(/'/g,'')+'\',\''+jsq(String(val==null?'':val))+'\');return false" style="color:var(--ac);font-size:10px">✎</a>':'')+'</span></div>';
}
async function impSet(poId,field,label,cur){
  if(!canWarehouse()&&!roleIn('finance'))return;
  const v=prompt(label+(field==='etd'||field==='eta'?' (YYYY-MM-DD)':'')+':',cur||'');
  if(v===null)return;
  try{
    const patch={};patch[field]=v.trim()||null;
    const {error}=await SB.from('pos').update(patch).eq('id',poId);
    if(error)throw error;
    audit('import.'+field,{po:PO_NO(poId),value:v.slice(0,40)});
    renderPOs();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes(field)?'\n\n(Run the procure-to-pay SQL.)':''));}
}

/* ══════════ QUOTATIONS — formal quotes, print, convert to order ══════════ */
let QUOTES=null,QCART=[];
async function loadQuotes(force){
  if(QUOTES&&!force)return QUOTES;
  try{const {data}=await SB.from('quotes').select('*,quote_lines(*)').order('created_at',{ascending:false}).limit(500);QUOTES=data||[];}
  catch(e){QUOTES=[];}
  return QUOTES;
}
const qtLabel=q=>docNo('quote',q.num);
function qtMine(q){
  const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
  return !myTag||specCanon(q.spec||'').toLowerCase()===specCanon(myTag).toLowerCase();
}
async function renderQuotes(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  await loadQuotes(true);try{loadPromos();}catch(e){}
  const rows=QUOTES.filter(qtMine);
  const open=rows.filter(q=>['draft','sent'].includes(q.status));
  const acc=rows.filter(q=>q.status==='accepted').length,lost=rows.filter(q=>q.status==='lost').length;
  const today=new Date().toISOString().slice(0,10);
  const stPill=q=>{
    if(q.status==='accepted')return'<span class="pill pgr">accepted</span>';
    if(q.status==='lost')return'<span class="pill prd">lost</span>'+(q.lost_reason?' <span class="mu" style="font-size:10.5px">'+esc(q.lost_reason)+'</span>':'');
    const exp=q.expiry&&q.expiry<today;
    return'<span class="pill '+(q.status==='sent'?'pbl':'pgy')+'">'+q.status+'</span>'+(exp?' <span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">expired</span>':'');
  };
  const canW=roleIn('admin','manager','sales');
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('quotes'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Open quotes</div><div class="met-val">'+open.length+'</div><div class="met-sub">'+fmtPeso(open.reduce((a,q)=>a+(q.total||0),0))+' quoted</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Accepted</div><div class="met-val">'+acc+'</div><div class="met-sub">all time</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Win rate</div><div class="met-val">'+((acc+lost)?Math.round(acc/(acc+lost)*100)+'%':'—')+'</div><div class="met-sub">'+lost+' lost</div><div class="met-bar"></div></div>'+
    '</div>'+
    (canW?'<div style="margin-bottom:14px"><button onclick="quoteNew()" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:11px 20px;font-size:13.5px;font-weight:700;cursor:pointer">+ New quotation</button></div>':'')+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Quote</th><th>Account</th><th>Specialist</th><th>Date</th><th>Valid until</th><th>Status</th><th class="r">Total</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(q=>'<tr><td style="font-weight:700">'+qtLabel(q)+'</td><td>'+esc(q.account)+'</td><td class="mu">'+esc(q.spec||'')+'</td><td class="mu">'+esc(q.date||'')+'</td><td class="mu">'+esc(q.expiry||'—')+'</td>'+
      '<td>'+stPill(q)+'</td><td class="r" style="font-weight:600">'+fmtPeso(q.total||0)+'</td>'+
      '<td style="white-space:nowrap;font-size:11.5px">'+
      '<a href="#" onclick="quotePrint(\''+q.id+'\');return false" style="color:var(--ac)">print</a>'+
      (canW&&['draft','sent'].includes(q.status)?
        ' · <a href="#" onclick="quoteStatus(\''+q.id+'\',\''+(q.status==='draft'?'sent':'accepted')+'\');return false" style="color:var(--gr)">'+(q.status==='draft'?'mark sent':'mark accepted')+'</a>'+
        ' · <a href="#" onclick="quoteStatus(\''+q.id+'\',\'lost\');return false" style="color:var(--rd)">lost</a>'+
        ' · <a href="#" onclick="quoteConvert(\''+q.id+'\');return false" style="color:var(--ac);font-weight:700">→ order</a>':'')+
      '</td></tr>').join(''):'<tr><td colspan="8" class="mu">No quotations yet'+(canW?' — make the first one.':'.')+'</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Quotes use the same catalog pricing, deals, and live promos as order entry · accepted quotes convert to an order in one tap · win rate = accepted ÷ (accepted + lost)</span></div></div>';
}
function quoteNew(){
  QCART=[];
  const accounts=acctList().map(r=>r.name);
  const myTag=(SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const specs=specNames();
  const inp='style="width:100%;box-sizing:border-box;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:14px"';
  const lbl='style="font-size:11.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin:12px 0 5px;display:block"';
  const prodOpts=DATA.filter(p=>p.price>0).map(p=>'<option value="'+esc(p.name)+' ('+esc(p.sku)+')">'+fmtPeso(p.price)+'</option>').join('');
  const exp=new Date(Date.now()+30*864e5).toISOString().slice(0,10);
  $('content').innerHTML='<div style="max-width:680px">'+
    '<div class="panel" style="padding:18px;margin-bottom:14px"><div class="phd">New quotation</div>'+
    '<label '+lbl+'>Account / clinic</label><input id="qt-acct" list="qt-accts" placeholder="Start typing…" '+inp+'>'+
    '<datalist id="qt-accts">'+accounts.map(a=>'<option value="'+esc(a)+'">').join('')+'</datalist>'+
    '<div class="g2" style="gap:10px"><div><label '+lbl+'>Specialist</label>'+
    (myTag&&ROLE==='sales'?'<input id="qt-spec" value="'+esc(myTag)+'" readonly '+inp.slice(0,-1)+';opacity:.75">':'<select id="qt-spec" '+inp+'>'+specs.map(s=>'<option>'+esc(s)+'</option>').join('')+'</select>')+
    '</div><div><label '+lbl+'>Valid until</label><input id="qt-exp" type="date" value="'+exp+'" '+inp+'></div></div></div>'+
    '<div class="panel" style="padding:18px;margin-bottom:14px"><div class="phd">Items</div>'+
    '<label '+lbl+'>Product</label><input id="qt-prod" list="qt-prods" oninput="qtProdChanged()" placeholder="Start typing or select…" '+inp+'>'+
    '<datalist id="qt-prods">'+prodOpts+'</datalist>'+
    '<div class="g2" style="gap:10px"><div><label '+lbl+'>Pricing</label><select id="qt-deal" '+inp+'><option value="">À la carte</option></select></div>'+
    '<div><label '+lbl+'>Qty (sets, for deals)</label><input id="qt-qty" type="number" min="1" value="1" '+inp+'></div></div>'+
    '<button onclick="qtAdd()" style="width:100%;background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13.5px;font-weight:600;cursor:pointer;margin-top:10px">+ Add to quote</button>'+
    '<div id="qt-cart" style="margin-top:12px"></div></div>'+
    '<div class="panel" style="padding:18px">'+
    '<label '+lbl+'>Notes for the client (optional)</label><textarea id="qt-notes" rows="2" '+inp+'></textarea>'+
    '<div id="qt-msg" style="min-height:18px;font-size:12px;margin:10px 0 4px"></div>'+
    '<button onclick="qtSave()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">Save quotation</button>'+
    '<a href="#" onclick="showView(\'quotes\',null);return false" style="display:block;text-align:center;color:var(--tx3);font-size:12px;margin-top:10px">Cancel</a>'+
    '</div></div>';
  qtRender();
}
function qtResolve(){
  const v=(($('qt-prod')&&$('qt-prod').value)||'').trim();if(!v)return null;
  const m=v.match(/\(([^()]+)\)\s*$/);
  if(m){const p=DATA.find(x=>x.sku.toLowerCase()===m[1].trim().toLowerCase());if(p)return p;}
  let p=DATA.find(x=>x.sku.toLowerCase()===v.toLowerCase());if(p)return p;
  const c=DATA.filter(x=>x.name.toLowerCase().startsWith(v.toLowerCase()));
  return c.length===1?c[0]:null;
}
function qtProdChanged(){
  const p=qtResolve();const sel=$('qt-deal');if(!sel)return;
  let html='<option value="">À la carte'+(p&&p.price>0?' — '+fmtPeso(p.price)+'/u':'')+'</option>';
  if(p&&p.deals)p.deals.forEach((d,i)=>{if(d.setSize&&d.price>0)html+='<option value="'+i+'">'+esc(d.title)+' — '+fmtPeso(d.price)+'/set</option>';});
  sel.innerHTML=html;
}
function qtAdd(){
  const p=qtResolve();const msg=$('qt-msg');
  if(!p){if(msg){msg.style.color='var(--rd)';msg.textContent='Pick a product from the list.';}return;}
  const sets=Math.max(1,parseInt(($('qt-qty')&&$('qt-qty').value)||'1',10)||1);
  const dealIx=($('qt-deal')&&$('qt-deal').value)||'';
  if(dealIx!==''&&p.deals&&p.deals[dealIx]){
    const d=p.deals[dealIx];const per=d.setSize-1;
    QCART.push({sku:p.sku,name:p.name,qty:sets*per,price:Math.round(d.price/per),amount:Math.round(sets*d.price),is_free:false,deal:(d.title.match(/\d+\s*\+\s*\d+/)||[d.title])[0]});
    QCART.push({sku:p.sku,name:p.name,qty:sets,price:0,amount:0,is_free:true,deal:(d.title.match(/\d+\s*\+\s*\d+/)||[d.title])[0]});
  }else{
    const pr=(typeof promoFor==='function')?promoFor(p.sku):null;
    if(pr&&pr.mechanic==='pct'&&pr.pct>0){
      const up=Math.round(p.price*(1-pr.pct/100));
      QCART.push({sku:p.sku,name:p.name,qty:sets,price:up,amount:Math.round(sets*up),is_free:false,deal:pr.name});
      if(msg){msg.style.color='var(--gr)';msg.textContent='Promo applied: '+pr.name+' ('+pr.pct+'% off)';}
    }else{
      QCART.push({sku:p.sku,name:p.name,qty:sets,price:p.price,amount:Math.round(sets*p.price),is_free:false,deal:null});
      if(pr&&pr.mechanic==='nplusm'&&pr.buy_n>0&&sets>=pr.buy_n){
        const fq=Math.floor(sets/pr.buy_n)*(pr.free_m||0);
        if(fq>0){QCART.push({sku:p.sku,name:p.name,qty:fq,price:0,amount:0,is_free:true,deal:pr.name});
          if(msg){msg.style.color='var(--gr)';msg.textContent='Promo applied: '+pr.name+' — +'+fq+' free';}}
      }
    }
  }
  qtRender();
}
function qtRm(i){QCART.splice(i,1);qtRender();}
function qtRender(){
  const box=$('qt-cart');if(!box)return;
  if(!QCART.length){box.innerHTML='<div style="font-size:12px;color:var(--tx3)">No items yet.</div>';return;}
  const tot=QCART.reduce((a,l)=>a+l.amount,0);
  box.innerHTML='<table style="width:100%;font-size:12.5px"><thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>'+
    QCART.map((l,i)=>'<tr><td>'+esc(l.name)+(l.deal?' <span class="pill pbl">'+esc(l.deal)+'</span>':'')+(l.is_free?' <span class="pill" style="background:var(--pu-bg);color:var(--pu)">free</span>':'')+'</td>'+
      '<td style="text-align:right">'+l.qty+'</td><td style="text-align:right">'+(l.amount?fmtPeso(l.amount):'₱0')+'</td>'+
      '<td style="text-align:right"><a href="#" onclick="qtRm('+i+');return false" style="color:var(--rd)">✕</a></td></tr>').join('')+
    '</tbody></table><div style="text-align:right;font-weight:700;font-size:15px;margin-top:10px">Total '+fmtPeso(tot)+'</div>';
}
async function qtSave(){
  const msg=$('qt-msg');
  const account=($('qt-acct')&&$('qt-acct').value||'').trim();
  const spec=($('qt-spec')&&$('qt-spec').value||'').trim();
  if(!account){if(msg){msg.style.color='var(--rd)';msg.textContent='Pick the account.';}return;}
  if(!QCART.length){if(msg){msg.style.color='var(--rd)';msg.textContent='Add at least one item.';}return;}
  const total=QCART.reduce((a,l)=>a+l.amount,0);
  try{
    const {data:q,error}=await SB.from('quotes').insert({account,spec,date:new Date().toISOString().slice(0,10),expiry:($('qt-exp')&&$('qt-exp').value)||null,status:'draft',total,notes:($('qt-notes')&&$('qt-notes').value||'').trim()||null,created_by:SBUSER.id}).select().single();
    if(error)throw error;
    const {error:e2}=await SB.from('quote_lines').insert(QCART.map(l=>({quote_id:q.id,sku:l.sku,name:l.name,qty:l.qty,price:l.price,amount:l.amount,is_free:l.is_free,deal:l.deal})));
    if(e2)throw e2;
    audit('quote.create',{quote:qtLabel(q),account,total});
    QCART=[];showView('quotes',null);
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not save: '+(e.message||e)+(String(e.message||'').includes('quotes')?' (run the quotations SQL from SUPABASE-SETUP.md)':'');}}
}
async function qpSync(account,outcome,reason){ // quote decision → pipeline (opportunities + stage)
  try{
    const upd=outcome==='won'?{stage:'won'}:{stage:'lost',lost_reason:(reason||'quote lost')};
    const {data}=await SB.from('opportunities').update(upd).eq('account',account).eq('stage','open').select('id');
    if(data&&data.length)audit('quote.pipeline',{account,outcome,opps:data.length});
    if(outcome==='won'&&typeof setStage==='function'&&typeof canStage==='function'&&canStage(account))try{await setStage(account,'active','quote accepted');}catch(e){}
  }catch(e){}
}
async function quoteStatus(id,status){
  let reason=null;
  if(status==='lost'){reason=prompt('Lost — why? (price / competitor / timing / no response / other)');if(reason===null)return;}
  try{
    const upd={status};if(reason!==null)upd.lost_reason=reason.trim()||null;
    const {error}=await SB.from('quotes').update(upd).eq('id',id);if(error)throw error;
    const q=(QUOTES||[]).find(x=>x.id===id);
    audit('quote.'+status,{quote:q?qtLabel(q):id.slice(0,8),reason:reason||''});
    if(q&&status==='accepted')qpSync(q.account,'won');
    if(q&&status==='lost')qpSync(q.account,'lost',reason);
    renderQuotes();
  }catch(e){alert(e.message||e);}
}
async function quoteConvert(id){
  const q=(QUOTES||[]).find(x=>x.id===id);if(!q)return;
  if(!confirm('Convert '+qtLabel(q)+' into an order for '+q.account+'? The order form opens prefilled — review, then submit.'))return;
  if(q.status!=='accepted'){try{await SB.from('quotes').update({status:'accepted'}).eq('id',id);}catch(e){}}
  audit('quote.convert',{quote:qtLabel(q),account:q.account});
  qpSync(q.account,'won');
  window._noAccount=q.account;
  CART=(q.quote_lines||[]).map(l=>({sku:l.sku,name:l.name,qty:l.qty,price:l.price,amount:l.amount,is_free:l.is_free,deal:l.deal}));
  showView('neworder',null);
}
async function quotePrint(id){
  const q=(QUOTES||[]).find(x=>x.id===id);if(!q)return;
  let acct=null;try{const {data}=await SB.from('accounts').select('*').eq('name',acctDedup(q.account||'')).maybeSingle();acct=data;}catch(e){}
  const lines=q.quote_lines||[];
  $('ptitle').textContent='Quotation';
  $('content').innerHTML=
    '<div class="no-print" style="display:flex;gap:10px;margin-bottom:12px">'+
    '<a href="#" onclick="showView(\'quotes\',null);return false" style="color:var(--ac);font-size:12.5px">← Back to quotations</a><span style="flex:1"></span>'+
    '<button onclick="window.print()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">🖨 Print / Save PDF</button></div>'+
    '<div class="printdoc">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div>'+hsLogo(34,'#00168F')+'<div style="font-size:19px;font-weight:800;margin-top:5px">HEALTHSPAN GLOBAL, INC.</div><div style="font-size:12px;color:#555">Quotation</div></div>'+
    '<div style="text-align:right;font-size:12px"><b style="font-size:15px">'+qtLabel(q)+'</b><br>Date: '+esc(q.date||'')+'<br>Valid until: <b>'+esc(q.expiry||'—')+'</b></div></div>'+
    '<div style="display:flex;gap:30px;margin:14px 0;font-size:12.5px">'+
    '<div style="flex:1"><b>Prepared for</b><br>'+esc(q.account||'—')+(acct&&acct.address?'<br>'+esc(acct.address):'')+(acct&&acct.contact_person?'<br>Attn: '+esc(acct.contact_person):'')+'</div>'+
    '<div><b>Prepared by</b><br>'+esc(q.spec||'—')+'</div></div>'+
    '<table><thead><tr><th>#</th><th>Product</th><th>SKU</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+
    lines.map((l,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(l.name||l.sku)+'</b>'+(l.is_free?' (FREE)':'')+(l.deal?' — '+esc(l.deal):'')+'</td><td>'+esc(l.sku)+'</td><td style="text-align:center">'+l.qty+'</td><td style="text-align:right">'+(l.price?fmtPeso(l.price):'₱0')+'</td><td style="text-align:right">'+(l.amount?fmtPeso(l.amount):'₱0')+'</td></tr>').join('')+
    '</tbody></table>'+
    '<div style="text-align:right;font-size:12px;margin-top:6px;color:#333">VATable sales: '+fmtPeso(Math.round((q.total||0)/1.12))+'<br>12% VAT: '+fmtPeso((q.total||0)-Math.round((q.total||0)/1.12))+'</div>'+
    '<div style="text-align:right;font-weight:700;font-size:14px;margin-top:2px">TOTAL (VAT inclusive): '+fmtPeso(q.total||0)+'</div>'+
    (q.notes?'<div style="font-size:12px;margin-top:8px"><b>Notes:</b> '+esc(q.notes)+'</div>':'')+
    '<div style="font-size:11px;color:#555;margin-top:14px">Prices are VAT-inclusive and valid until the date above. This quotation is not an invoice.</div>'+
    '</div>';
}

/* ══════════ PROMOTIONS ENGINE — promos as configuration ══════════ */
let PROMOS=null;
async function loadPromos(force){
  if(PROMOS&&!force)return PROMOS;
  try{const {data}=await SB.from('promos').select('*').order('start_date',{ascending:false});PROMOS=data||[];}
  catch(e){PROMOS=PROMOS||[];}
  return PROMOS;
}
function promoFor(sku){ // first live promo covering this SKU (today inside window, active)
  const today=new Date().toISOString().slice(0,10);
  return (PROMOS||[]).find(p=>p.active&&p.start_date<=today&&p.end_date>=today&&
    (String(p.skus||'').trim()==='*'||String(p.skus||'').toLowerCase().split(/[,\n]/).map(x=>x.trim()).includes(String(sku).toLowerCase())))||null;
}
async function renderPromos(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  await loadPromos(true);
  const canW=roleIn('admin','marketing');
  const today=new Date().toISOString().slice(0,10);
  const live=PROMOS.filter(p=>p.active&&p.start_date<=today&&p.end_date>=today);
  const inp='style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px"';
  const lbl='style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin:8px 0 3px"';
  const mech=p=>p.mechanic==='pct'?(p.pct+'% off'):('buy '+p.buy_n+' get '+p.free_m+' free');
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('promos'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Live now</div><div class="met-val">'+live.length+'</div><div class="met-sub">applies automatically at order entry</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">All promos</div><div class="met-val">'+PROMOS.length+'</div><div class="met-sub">past + scheduled</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="g2" style="align-items:start;gap:14px">'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Promo</th><th>Window</th><th>Mechanic</th><th>SKUs</th><th>Status</th>'+(canW?'<th></th>':'')+'</tr></thead><tbody>'+
    (PROMOS.length?PROMOS.map(p=>{
      const st=!p.active?'<span class="pill pgy">off</span>':p.start_date>today?'<span class="pill pbl">scheduled</span>':p.end_date<today?'<span class="pill pgy">ended</span>':'<span class="pill pgr">LIVE</span>';
      return '<tr><td style="font-weight:600">'+esc(p.name)+'</td><td class="mu" style="font-size:11.5px">'+esc(p.start_date)+' → '+esc(p.end_date)+'</td>'+
      '<td>'+mech(p)+'</td><td class="mu" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(p.skus||'')+'">'+(String(p.skus||'').trim()==='*'?'all products':esc(p.skus||''))+'</td>'+
      '<td>'+st+'</td>'+
      (canW?'<td style="white-space:nowrap;font-size:11.5px"><a href="#" onclick="promoToggle('+p.id+','+(p.active?'false':'true')+');return false" style="color:'+(p.active?'var(--am)':'var(--gr)')+'">'+(p.active?'turn off':'turn on')+'</a> · <a href="#" onclick="promoDel('+p.id+');return false" style="color:var(--rd)">delete</a></td>':'')+
      '</tr>';}).join(''):'<tr><td colspan="6" class="mu">No promotions configured yet.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>A LIVE promo applies automatically in order entry and quotations for its SKUs — no more free-typed deal lines · buy-N-get-M adds the free units; %-off discounts the unit price (tagged with the promo name, audited with the order)</span></div></div>'+
    (canW?'<div class="panel" style="padding:16px"><div class="phd">New promotion</div>'+
      '<label '+lbl+'>Name (shows on order lines)</label><input id="pm-name" placeholder="e.g. Anniversary 10+8" '+inp+'>'+
      '<div class="g2" style="gap:10px"><div><label '+lbl+'>Starts</label><input id="pm-start" type="date" '+inp+'></div><div><label '+lbl+'>Ends</label><input id="pm-end" type="date" '+inp+'></div></div>'+
      '<label '+lbl+'>Eligible SKUs (comma-separated, or * for all)</label><input id="pm-skus" placeholder="SKU1, SKU2, …" '+inp+'>'+
      '<label '+lbl+'>Mechanic</label><select id="pm-mech" onchange="$(\'pm-nm\').style.display=this.value===\'nplusm\'?\'flex\':\'none\';$(\'pm-pw\').style.display=this.value===\'pct\'?\'block\':\'none\'" '+inp+'><option value="nplusm">Buy N, get M free</option><option value="pct">% off unit price</option></select>'+
      '<div id="pm-nm" class="g2" style="gap:10px;display:flex"><div style="flex:1"><label '+lbl+'>Buy N</label><input id="pm-n" type="number" min="1" value="10" '+inp+'></div><div style="flex:1"><label '+lbl+'>Get M free</label><input id="pm-m" type="number" min="1" value="8" '+inp+'></div></div>'+
      '<div id="pm-pw" style="display:none"><label '+lbl+'>% off</label><input id="pm-pct" type="number" min="1" max="90" value="10" '+inp+'></div>'+
      '<div id="pm-msg" style="min-height:14px;font-size:11px;margin:8px 0 4px"></div>'+
      '<button onclick="promoAdd()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:8px;padding:11px;font-size:13px;font-weight:600;cursor:pointer">Create promo</button></div>':'')+
    '</div>';
}
async function promoAdd(){
  const g=id=>($(id)&&$(id).value||'').trim();const msg=$('pm-msg');
  if(!g('pm-name')||!g('pm-start')||!g('pm-end')||!g('pm-skus')){if(msg){msg.style.color='var(--rd)';msg.textContent='Name, window, and SKUs are required.';}return;}
  const mech=g('pm-mech');
  try{
    const {error}=await SB.from('promos').insert({name:g('pm-name'),start_date:g('pm-start'),end_date:g('pm-end'),skus:g('pm-skus'),mechanic:mech,
      buy_n:mech==='nplusm'?parseInt(g('pm-n'),10)||null:null,free_m:mech==='nplusm'?parseInt(g('pm-m'),10)||null:null,pct:mech==='pct'?parseFloat(g('pm-pct'))||null:null,
      active:true,created_by:SBUSER.id});
    if(error)throw error;
    audit('promo.create',{name:g('pm-name'),mech,window:g('pm-start')+'→'+g('pm-end')});
    renderPromos();
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent=(e.message||e)+(String(e.message||'').includes('promos')?' (run the promotions SQL from SUPABASE-SETUP.md)':'');}}
}
async function promoToggle(id,on){
  try{const {error}=await SB.from('promos').update({active:on}).eq('id',id);if(error)throw error;audit('promo.'+(on?'on':'off'),{id});renderPromos();}catch(e){alert(e.message||e);}
}
async function promoDel(id){
  if(!confirm('Delete this promo? Past orders keep their promo-tagged lines.'))return;
  try{const {error}=await SB.from('promos').delete().eq('id',id);if(error)throw error;audit('promo.delete',{id});renderPromos();}catch(e){alert(e.message||e);}
}

/* ══════════ PRODUCT REGISTRATION TRACKING — CPR/FDA per SKU ══════════ */
async function renderRegs(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  let items=[];
  try{const {data,error}=await SB.from('items').select('sku,name,reg_type,reg_no,reg_expiry').order('sku');if(error)throw error;items=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the item master + registration SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  const today=Date.now();
  const dLeft=x=>x.reg_expiry?Math.floor((new Date(x.reg_expiry).getTime()-today)/864e5):null;
  items.sort((a,b)=>{const da=dLeft(a),db=dLeft(b);return (da===null?1e9:da)-(db===null?1e9:db);});
  const expd=items.filter(x=>dLeft(x)!==null&&dLeft(x)<0).length;
  const soon=items.filter(x=>{const d=dLeft(x);return d!==null&&d>=0&&d<=180;}).length;
  const regd=items.filter(x=>x.reg_no).length;
  const canW=typeof canCatalogEdit==='function'?canCatalogEdit():roleIn('admin','finance');
  const pill=x=>{const d=dLeft(x);
    if(d===null)return x.reg_no?'<span class="pill pgy">no expiry set</span>':'<span class="pill pgy">unregistered / n-a</span>';
    if(d<0)return'<span class="pill prd">EXPIRED '+Math.abs(d)+'d ago</span>';
    if(d<=180)return'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">'+d+'d left</span>';
    return'<span class="pill pgr">'+esc(x.reg_expiry)+'</span>';};
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('regs'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Expired</div><div class="met-val">'+expd+'</div><div class="met-sub">renew before the next import</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Expiring ≤ 6 months</div><div class="met-val">'+soon+'</div><div class="met-sub">start renewal now — FDA takes months</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Registered</div><div class="met-val">'+regd+' / '+items.length+'</div><div class="met-sub">SKUs with a CPR/FDA number</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>Type</th><th>Registration no.</th><th>Status</th>'+(canW?'<th></th>':'')+'</tr></thead><tbody>'+
    items.map(x=>'<tr><td style="font-weight:600">'+esc(x.sku)+'</td><td>'+esc(x.name||'')+'</td><td class="mu">'+esc(x.reg_type||'—')+'</td><td>'+esc(x.reg_no||'—')+'</td><td>'+pill(x)+'</td>'+
      (canW?'<td><a href="#" onclick="regEdit(\''+jsq(x.sku)+'\');return false" style="color:var(--ac);font-size:11.5px">edit</a></td>':'')+
      '</tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>CPR/FDA registration per SKU — expired and expiring-soon float to the top · alerts at 6 months because renewals take time · registration data lives on the item master</span></div></div>';
}
async function regEdit(sku){
  const {data:x}=await SB.from('items').select('sku,reg_type,reg_no,reg_expiry').eq('sku',sku).maybeSingle();
  if(!x)return alert('SKU not in the item master yet — seed the catalog first (Item master → seed).');
  const t=prompt('Registration type (CPR / FDA / NA):',x.reg_type||'CPR');if(t===null)return;
  const n=prompt('Registration number:',x.reg_no||'');if(n===null)return;
  const e=prompt('Expiry date (YYYY-MM-DD, blank if none):',x.reg_expiry||'');if(e===null)return;
  try{
    const {error}=await SB.from('items').update({reg_type:t.trim()||null,reg_no:n.trim()||null,reg_expiry:e.trim()||null}).eq('sku',sku);
    if(error)throw error;
    audit('reg.update',{sku,no:n.trim(),expiry:e.trim()});
    renderRegs();
  }catch(err){alert(err.message||err);}
}

/* ══════════ NOTIFICATIONS — the machine pings you (gap #2 closed) ══════════ */
let NOTIFS=null;
async function notify(target,kind,title,body,link){ // fire-and-forget; target={user_id} or {roles:[...]}
  if(!SB||!SBUSER)return;
  try{
    const base={kind,title,body:body||null,link:link||null,created_by:SBUSER.id};
    const rows=target.roles?target.roles.map(r=>Object.assign({role:r},base)):[Object.assign({user_id:target.user_id},base)];
    await SB.from('notifications').insert(rows);
  }catch(e){}
}
async function notifyOrderOwner(orderId,kind,title,body,link){
  if(!SB)return;
  try{
    const {data:o}=await SB.from('orders').select('user_id').eq('id',orderId).maybeSingle();
    if(o&&o.user_id&&o.user_id!==(SBUSER&&SBUSER.id))await notify({user_id:o.user_id},kind,title,body,link);
  }catch(e){}
}
async function loadNotifs(force){
  if(NOTIFS&&!force)return NOTIFS;
  if(!SB||!SBUSER)return NOTIFS=[];
  try{
    const {data}=await SB.from('notifications').select('*')
      .or('user_id.eq.'+SBUSER.id+(ROLE?',role.eq.'+ROLE:''))
      .order('created_at',{ascending:false}).limit(30);
    NOTIFS=data||[];
  }catch(e){NOTIFS=NOTIFS||[];}
  return NOTIFS;
}
function nSeen(){try{return localStorage.getItem('hs_notif_seen')||'';}catch(e){return'';}}
function nBadge(){
  const b=$('nbadge');if(!b)return;
  const seen=nSeen();
  const n=(NOTIFS||[]).filter(x=>x.created_at>seen).length;
  b.style.display=n?'block':'none';
  b.textContent=n>9?'9+':String(n);
}
async function nPoll(){await loadNotifs(true);nBadge();}
function nAgo(ts){
  const m=Math.floor((Date.now()-new Date(ts).getTime())/60000);
  if(m<1)return'now';if(m<60)return m+'m';const h=Math.floor(m/60);if(h<24)return h+'h';return Math.floor(h/24)+'d';
}
async function toggleNotifs(){
  if(!SB||!SBUSER)return;
  await loadNotifs(true);
  const seen=nSeen();
  const icon=k=>k==='approval'?'⏳':k==='decision'?'✅':k==='order'?'🧾':k==='fulfilled'?'📦':'🔔';
  $('dbody').innerHTML=
    '<div class="dsku">NOTIFICATIONS</div><div class="dname">What needs you</div>'+
    '<div class="dsec">'+
    ((NOTIFS||[]).length?(NOTIFS||[]).map(x=>
      '<div class="drow" onclick="'+(x.link?'closeDrawer&&closeDrawer();$(\'overlay\').classList.remove(\'open\');$(\'drawer\').classList.remove(\'open\');location.hash=\''+esc(x.link)+'\';':'')+'" style="align-items:flex-start;border-bottom:1px solid var(--bd);padding:10px 0;'+(x.link?'cursor:pointer':'')+'">'+
      '<span class="dlbl" style="max-width:85%">'+icon(x.kind)+' <b'+(x.created_at>seen?' style="color:var(--ac)"':'')+'>'+esc(x.title)+'</b>'+
      (x.body?'<br><span style="color:var(--tx3);font-size:11.5px">'+esc(x.body)+'</span>':'')+'</span>'+
      '<span class="dval" style="color:var(--tx3);font-size:10.5px">'+nAgo(x.created_at)+'</span></div>').join(''):
      '<div style="font-size:12.5px;color:var(--tx3);padding:14px 0">Nothing yet — approvals, new orders, and fulfillments land here the moment they happen.</div>')+
    '</div>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:10px">Held orders ping managers · decisions ping the specialist · approved orders ping the warehouse · fulfillments ping the order owner. Checked every 90 seconds.</div>';
  $('overlay').classList.add('open');$('drawer').classList.add('open');
  try{localStorage.setItem('hs_notif_seen',new Date().toISOString());}catch(e){}
  nBadge();
}

const FAV_MAX=10;   // declared here: the startup favPaint() below reads it

/* ── late INIT (js/10 loads last, so calls here see every module) ── */
try{navApplyCollapse();}catch(e){} // the js/09 call runs before this file loads — THIS one is the real startup apply
try{favPaint();}catch(e){}          // pin favourites once the sidebar exists

/* ══ SHORT-DATED STOCK QUEUE ══
   Expiry watch says WHAT is short-dated; this says WHAT WE'RE DOING ABOUT IT.
   Every batch inside the window gets a plan (discount / FOC / transfer /
   quarantine / accept the loss) with an owner and a target date, so expiring
   money is worked, not just watched. Plans live in `shortdated` (sku+batch). */
const SD_WINDOW=183; // months≈6 — the point where a plan still has time to work
const SD_PLANS={discount:'Discount / promo',foc:'FOC to a loyal account',transfer:'Transfer to Remedy',quarantine:'Quarantine (unsellable)',accept:'Accept the write-off'};
function sdRisk(d){return d<=60?'rd':d<=92?'am':'bl';} // expired lots are <=60 too — same red
async function renderShortDated(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  let plans=[];
  try{const {data,error}=await SB.from('shortdated').select('*').limit(1000);if(error)throw error;plans=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the shortdated SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  const key=(s,b)=>String(s||'').toLowerCase()+'|'+String(b||'').toLowerCase();
  const pmap={};for(const p of plans)pmap[key(p.sku,p.batch)]=p;
  // every batch with stock inside the window, worst first
  const lots=(BATCHES||[]).filter(b=>{const d=expDaysLeft(b.expiry);return b.soh>0&&d!==null&&d<=SD_WINDOW;})
    .map(b=>{const d=expDaysLeft(b.expiry);const p=DATA.find(x=>x.sku===b.skuCode);
      return{sku:b.skuCode,name:b.name,batch:b.batch||'',expiry:b.expiry,days:d,qty:b.soh,
             value:(p&&p.price>0?p.price*b.soh:0),plan:pmap[key(b.skuCode,b.batch)]||null};})
    .sort((a,b)=>a.days-b.days);
  const unplanned=lots.filter(l=>!l.plan);
  const atRisk=lots.reduce((a,l)=>a+l.value,0);
  const unpV=unplanned.reduce((a,l)=>a+l.value,0);
  const done=plans.filter(p=>p.status==='done').length;
  const canW=canWarehouse()||roleIn('manager','marketing'); // whoever can actually action it
  const pill=l=>{
    if(l.plan&&l.plan.status==='done')return '<span class="pill pgr">'+esc(SD_PLANS[l.plan.plan]||l.plan.plan)+' · done</span>';
    if(l.plan)return '<span class="pill pbl">'+esc(SD_PLANS[l.plan.plan]||l.plan.plan)+(l.plan.owner_tag?' · '+esc(l.plan.owner_tag):'')+(l.plan.target_date?' by '+esc(l.plan.target_date):'')+'</span>';
    return '<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">no plan yet</span>';
  };
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('shortdated'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met am"><div class="met-lbl">Short-dated value</div><div class="met-val" style="font-size:15px">'+fmtPeso(atRisk)+'</div><div class="met-sub">'+lots.length+' lots inside 6 months</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">No plan yet</div><div class="met-val" style="font-size:15px">'+fmtPeso(unpV)+'</div><div class="met-sub">'+unplanned.length+' lots nobody has decided on</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Worked &amp; closed</div><div class="met-val">'+done+'</div><div class="met-sub">lots resolved through this queue</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th class="r">Days</th><th class="r">Units</th><th class="r">Value</th><th>Plan</th>'+(canW?'<th></th>':'')+'</tr></thead><tbody>'+
    (lots.length?lots.map(l=>'<tr><td style="font-weight:600">'+esc(l.name||l.sku)+'</td><td class="mu">'+esc(l.batch||'—')+'</td><td class="mu">'+esc(l.expiry||'—')+'</td>'+
      '<td class="r"><span class="pill p'+sdRisk(l.days)+'">'+(l.days<0?'expired':l.days+'d')+'</span></td><td class="r">'+l.qty+'</td><td class="r">'+(l.value?fmtPeso(l.value):'—')+'</td>'+
      '<td>'+pill(l)+(l.plan&&l.plan.notes?'<div class="mu" style="font-size:10.5px;margin-top:2px">'+esc(l.plan.notes)+'</div>':'')+'</td>'+
      (canW?'<td style="white-space:nowrap;font-size:11.5px">'+
        (l.plan&&l.plan.status==='done'?'':'<a href="#" onclick="sdPlan(\''+esc(l.sku)+'\',\''+esc(l.batch)+'\');return false" style="color:var(--ac)">'+(l.plan?'change':'set plan')+'</a>'+
          (l.plan?' · <a href="#" onclick="sdClose('+l.plan.id+');return false" style="color:var(--gr)">done</a>'+delLink('shortdated',l.plan.id):''))+'</td>':'')+
      '</tr>').join(''):'<tr><td colspan="'+(canW?8:7)+'" class="mu">Nothing expiring within 6 months — clean.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Every lot inside 6 months, earliest first · a plan names what we do and who does it · closing a lot records the outcome. Discounts and FOC still go through the normal promo/order flow — this is the worklist, not a separate discount channel.</span></div></div>';
}
async function sdPlan(sku,batch){
  const lot=(BATCHES||[]).find(b=>b.skuCode===sku&&String(b.batch||'')===String(batch||''));
  const opts=Object.keys(SD_PLANS).map((k,i)=>(i+1)+') '+SD_PLANS[k]).join('\n');
  const pick=prompt('Plan for '+(lot?lot.name:sku)+(batch?' · batch '+batch:'')+':\n\n'+opts+'\n\nEnter 1-5:','1');
  const keys=Object.keys(SD_PLANS);const plan=keys[parseInt(pick,10)-1];
  if(!plan)return;
  const own=(prompt('Who owns this action? (specialist tag or name — blank = the warehouse team)','')||'').trim();
  const target=(prompt('Target date to have it done (YYYY-MM-DD):',new Date(Date.now()+14*864e5).toISOString().slice(0,10))||'').trim();
  if(target&&!/^\d{4}-\d{2}-\d{2}$/.test(target))return alert('Target date must look like 2026-09-15 — nothing saved.');
  const notes=(prompt('Note (e.g. which account, what discount):','')||'').trim();
  try{
    const row={sku,batch:batch||'',name:lot?lot.name:null,expiry:lot?lot.expiry:null,qty:lot?lot.soh:null, // '' not null — keeps the unique key honest
      plan,owner_tag:own||null,target_date:target||null,notes:notes||null,status:'open',
      created_by:SBUSER.id,created_name:(SBPROFILE&&SBPROFILE.name)||''};
    const {error}=await SB.from('shortdated').upsert(row,{onConflict:'sku,batch'});
    if(error)throw error;
    audit('shortdated.plan',{sku,batch:batch||'',plan,owner:own||''});
    if(plan==='quarantine'&&canWarehouse()&&lot&&confirm('Pull these '+lot.soh+' units into quarantine now?'))
      await quarAdd(sku,lot.name,lot.soh,batch,'expiry','SD',true);
    renderShortDated();
  }catch(e){alert('Could not save the plan: '+(e.message||e));}
}
async function sdClose(id){
  const note=(prompt('What actually happened? (outcome for the record)','')||'').trim();
  try{
    const {error}=await SB.from('shortdated').update({status:'done',outcome:note||null,closed_at:new Date().toISOString(),closed_by:(SBPROFILE&&SBPROFILE.name)||''}).eq('id',id);
    if(error)throw error;
    audit('shortdated.close',{id,note});
    renderShortDated();
  }catch(e){alert('Could not close it: '+(e.message||e));}
}

/* ══ RECEIVING DISCREPANCIES & SUPPLIER SCORECARD ══
   po_lines already carries ordered vs received; nobody was reading it. Short
   ships, over ships, and lead-time accuracy per supplier — the numbers that
   make the reorder plan's assumptions honest. */
async function renderPoScore(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  if(!roleIn('admin','finance','supply_chain')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Finance, admin and the warehouse team only — this page shows purchase costs.</div>';return;}
  loadingHint();
  let pos=[],lines=[],sups=[];
  try{
    const [a,b,c]=await Promise.all([
      SB.from('pos').select('id,supplier,status,eta,etd,created_at,updated_at').order('id',{ascending:false}).limit(400),
      SB.from('po_lines').select('po_id,sku,name,qty,received,unit_cost').order('id',{ascending:false}).limit(4000),
      SB.from('suppliers').select('name,lead_time_days').limit(200)
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error; // a silent po_lines failure would read as "no discrepancies"
    pos=a.data||[];lines=b.data||[];sups=c.data||[];
  }catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load POs: '+esc(e.message||e)+'</div>';return;}
  const poById={};for(const p of pos)poById[p.id]=p;
  const linesBy={};for(const l of lines)(linesBy[l.po_id]=linesBy[l.po_id]||[]).push(l);
  const lead={};for(const s of sups)lead[s.name]=s.lead_time_days;
  // discrepancies on POs that are done being received
  const closed=new Set(pos.filter(p=>p.status==='received'||p.status==='partial').map(p=>p.id));
  const disc=lines.filter(l=>closed.has(l.po_id)&&(l.received||0)!==l.qty)
    .map(l=>{const p=poById[l.po_id];const gap=(l.received||0)-l.qty;
      return{po:l.po_id,supplier:p?p.supplier:'—',sku:l.sku,name:l.name,qty:l.qty,got:l.received||0,gap,
             value:Math.abs(gap)*(l.unit_cost||0),eta:p?p.eta:null,status:p?p.status:''};})
    .sort((a,b)=>b.value-a.value);
  // supplier grades
  const g={};
  for(const p of pos){
    if(p.status==='draft'||p.status==='cancelled')continue;
    const s=(g[p.supplier]=g[p.supplier]||{pos:0,lines:0,short:0,over:0,units:0,got:0,late:0,onTimeCount:0,leadSum:0,leadN:0});
    s.pos++;
    for(const l of (linesBy[p.id]||[])){
      s.lines++;s.units+=l.qty;s.got+=(l.received||0);
      if((l.received||0)<l.qty)s.short++;else if((l.received||0)>l.qty)s.over++;
    }
    if(p.status==='received'&&p.eta&&p.updated_at){
      const act=p.updated_at.slice(0,10);
      if(act>p.eta)s.late++;else s.onTimeCount++;
      const ordered=(p.created_at||'').slice(0,10);
      if(ordered){const d=Math.round((new Date(act)-new Date(ordered))/864e5);if(d>=0&&d<400){s.leadSum+=d;s.leadN++;}}
    }
  }
  const rows=Object.entries(g).map(([name,s])=>{
    const fill=s.units?Math.round(s.got/s.units*100):null;
    const onTime=(s.late+s.onTimeCount)?Math.round(s.onTimeCount/(s.late+s.onTimeCount)*100):null;
    const actual=s.leadN?Math.round(s.leadSum/s.leadN):null;
    return{name,...s,fill,onTime,actual,quoted:lead[name]!=null?lead[name]:null};
  }).sort((a,b)=>(a.fill==null?101:a.fill)-(b.fill==null?101:b.fill));
  const grade=v=>v==null?'<span class="mu">—</span>':'<span class="pill p'+(v>=98?'gr':v>=90?'bl':v>=75?'am':'rd')+'">'+v+'%</span>';
  const shortV=disc.filter(d=>d.gap<0).reduce((a,d)=>a+d.value,0);
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('poscore'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Short-shipped value</div><div class="met-val" style="font-size:15px">'+fmtPeso(shortV)+'</div><div class="met-sub">at PO cost — worth claiming</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Lines off</div><div class="met-val">'+disc.length+'</div><div class="met-sub">received ≠ ordered on closed POs</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Suppliers graded</div><div class="met-val">'+rows.length+'</div><div class="met-sub">fill rate · on-time · real lead time</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard" style="margin-bottom:16px"><div class="phd" style="padding:12px 14px 0;margin-bottom:8px">Supplier scorecard</div><div class="tscroll"><table><thead><tr><th>Supplier</th><th class="r">POs</th><th class="r">Fill rate</th><th class="r">On time</th><th class="r">Lead time — quoted</th><th class="r">actual</th><th class="r">Short lines</th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td style="font-weight:600">'+esc(r.name)+'</td><td class="r">'+r.pos+'</td><td class="r">'+grade(r.fill)+'</td><td class="r">'+grade(r.onTime)+'</td>'+
      '<td class="r mu">'+(r.quoted!=null?r.quoted+'d':'—')+'</td><td class="r">'+(r.actual!=null?'<span class="pill p'+(r.quoted!=null&&r.actual>r.quoted*1.25?'am':'bl')+'">'+r.actual+'d</span>':'<span class="mu">—</span>')+'</td>'+
      '<td class="r">'+(r.short||'—')+(r.over?' <span class="mu">(+'+r.over+' over)</span>':'')+'</td></tr>').join(''):'<tr><td colspan="7" class="mu">No received POs yet.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Fill rate = units received ÷ units ordered · on-time = received on or before the ETA · actual lead time ≈ PO created → last update on a received PO (close enough to grade a supplier, not an audited date). Where actual runs 25%+ past quoted, the reorder plan is under-buying — worth updating the supplier’s lead time.</span></div></div>'+
    '<div class="tcard"><div class="phd" style="padding:12px 14px 0;margin-bottom:8px">Receiving discrepancies</div><div class="tscroll"><table><thead><tr><th>PO</th><th>Supplier</th><th>Product</th><th class="r">Ordered</th><th class="r">Received</th><th class="r">Gap</th><th class="r">Value</th></tr></thead><tbody>'+
    (disc.length?disc.map(d=>'<tr><td class="mu">PO-'+d.po+'</td><td>'+esc(d.supplier)+'</td><td style="font-weight:600">'+esc(d.name||d.sku)+'</td><td class="r">'+d.qty+'</td><td class="r">'+d.got+'</td>'+
      '<td class="r"><span class="pill p'+(d.gap<0?'rd':'am')+'">'+(d.gap>0?'+':'')+d.gap+'</span></td><td class="r">'+(d.value?fmtPeso(d.value):'—')+'</td></tr>').join(''):'<tr><td colspan="7" class="mu">Every closed PO received exactly what was ordered.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Only POs marked received or partial appear here — open POs are still arriving. Short lines are claimable against the supplier; over-ships need a costing decision.</span></div></div>';
}

/* ── desktop sidebar hide/show (hamburger in the topbar) ── */
function sbToggle(){
  const hide=!document.body.classList.contains('sbhidden');
  document.body.classList.toggle('sbhidden',hide);
  try{localStorage.setItem('hs_sb_hidden',hide?'1':'0');}catch(e){}
}
try{if(localStorage.getItem('hs_sb_hidden')==='1')document.body.classList.add('sbhidden');}catch(e){}
try{
  setTimeout(()=>{if(SB&&SBUSER)nPoll();},5000);
  setInterval(()=>{if(SB&&SBUSER)nPoll();},90000);
}catch(e){}


/* ── STOCK RESERVATIONS / ATP (gap #3 closed): pending native orders ARE the reservation ── */
let RESV=null,_resvTs=0;
async function loadReservations(force){
  if(RESV&&!force&&Date.now()-_resvTs<60000)return RESV;
  if(!SB)return RESV=RESV||{};
  try{
    const {data}=await SB.from('order_lines')
      .select('sku,qty,orders!inner(status,source,deleted_at)')
      .eq('orders.status','pending').eq('orders.source','native').is('orders.deleted_at',null);
    const m={};const add=(sku,q)=>{const k=String(sku).toLowerCase();m[k]=(m[k]||0)+(q||0);};
    for(const l of (data||[]))add(l.sku,l.qty);
    // pull-out requests reserve too: units asked for (or approved but not yet
    // released) are promised internally and must leave available-to-promise,
    // otherwise the same box gets sold to a clinic AND handed to a KOL.
    try{
      const {data:pl}=await SB.from('pullout_lines')
        .select('sku,qty,released_qty,pullouts!inner(status)')
        .in('pullouts.status',['pending','approved']);
      for(const l of (pl||[]))add(l.sku,Math.max(0,(l.qty||0)-(l.released_qty||0)));
    }catch(e){} // pre-migration DB: orders-only reservations
    RESV=m;_resvTs=Date.now();
  }catch(e){RESV=RESV||{};}
  return RESV;
}
function reservedQty(sku){return (RESV&&RESV[String(sku).toLowerCase()])||0;}

/* ══════════ CYCLE COUNTS — the evidence machine for retiring the sheet ══════════ */
let CCS=null; // active in-memory session {scope,items:[{sku,name,expected}],started}
async function renderCycleCounts(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  const canW=canWarehouse();
  if(CCS){renderCCSheet();return;}
  loadingHint();
  let sessions=[];
  try{const {data}=await SB.from('count_sessions').select('*').order('id',{ascending:false}).limit(20);sessions=data||[];}catch(e){}
  const last=sessions[0];
  const pct=x=>x&&x.skus?Math.round(x.matched/x.skus*100):null;
  const clean2=sessions.length>=2&&sessions.slice(0,2).every(x=>x.skus&&x.matched===x.skus);
  const lines=[...new Set((DATA||[]).map(p=>p.line).filter(Boolean))].sort();
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('cyclecount'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met '+(last&&pct(last)===100?'gr':'am')+'"><div class="met-lbl">Last count</div><div class="met-val">'+(last?pct(last)+'%':'—')+'</div><div class="met-sub">'+(last?esc((last.closed_at||'').slice(0,10))+' · '+last.matched+'/'+last.skus+' matched':'none yet')+'</div><div class="met-bar"></div></div>'+
    '<div class="met '+(clean2?'gr':'bl')+'"><div class="met-lbl">Cutover evidence</div><div class="met-val">'+(clean2?'READY ✓':(sessions.filter(x=>x.skus&&x.matched===x.skus).length)+' / 2')+'</div><div class="met-sub">two consecutive 100% counts retire the sheet</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Sessions</div><div class="met-val">'+sessions.length+'</div><div class="met-sub">all recorded, all audited</div><div class="met-bar"></div></div>'+
    '</div>'+
    (canW?'<div class="panel" style="padding:16px;margin-bottom:14px"><div class="phd">Start a count</div>'+
      '<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">Blind count: expected quantities stay hidden until you close the session. Count physically, type what you see.</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button onclick="ccStart(\'\')" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:11px 18px;font-size:13px;font-weight:700;cursor:pointer">Count everything</button>'+
      lines.map(l=>'<button onclick="ccStart(\''+jsq(l)+'\')" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px 14px;font-size:12.5px;cursor:pointer">'+esc(l)+'</button>').join('')+
      '</div></div>':'')+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Date</th><th>Scope</th><th>Counted by</th><th class="r">SKUs</th><th class="r">Matched</th><th class="r">Variance (units)</th><th>Result</th></tr></thead><tbody>'+
    (sessions.length?sessions.map(x=>'<tr><td>'+esc((x.closed_at||'').slice(0,16).replace('T',' '))+'</td><td>'+esc(x.scope||'all')+'</td><td class="mu">'+esc(x.started_name||'')+'</td>'+
      '<td class="r">'+x.skus+'</td><td class="r">'+x.matched+'</td><td class="r">'+(x.variance_units||0)+'</td>'+
      '<td>'+(x.skus&&x.matched===x.skus?'<span class="pill pgr">CLEAN 100%</span>':'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">'+pct(x)+'%</span>')+'</td></tr>').join(''):
      '<tr><td colspan="7" class="mu">No count sessions yet.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Expected = the current stock truth at the moment the session starts (sheet until cutover, ledger after) · variances on closing write adjustment movements into the ledger · sessions are the sign-off evidence on the Cutover page</span></div></div>';
}
function ccStart(line){
  const items=(DATA||[]).filter(p=>typeof p.stock==='number'&&(!line||p.line===line))
    .map(p=>({sku:p.sku,name:p.name,expected:stk(p)})).sort((a,b)=>a.name.localeCompare(b.name));
  if(!items.length)return alert('Nothing to count in that scope.');
  CCS={scope:line||'all',items,started:new Date().toISOString()};
  renderCCSheet();
}
function renderCCSheet(){
  const inp='style="width:90px;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:12px;font-size:16px;text-align:center"';
  $('ptitle').textContent='Cycle count — '+CCS.scope;
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:12px;border-left:3px solid var(--am);display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
    '<b style="font-size:13px">Counting: '+esc(CCS.scope)+'</b><span style="font-size:11.5px;color:var(--tx3)">'+CCS.items.length+' SKUs · blind — expected stays hidden · leave blank = not counted (skipped)</span><span style="flex:1"></span>'+
    '<button onclick="ccClose()" style="background:var(--gr);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer">✓ Close & grade</button>'+
    '<a href="#" onclick="if(confirm(\'Abandon this count? Nothing is saved.\')){CCS=null;renderCycleCounts();}return false" style="color:var(--rd);font-size:12px">abandon</a></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th>SKU</th><th class="r">Counted</th></tr></thead><tbody>'+
    CCS.items.map((x,i)=>'<tr><td style="font-weight:600">'+esc(x.name)+'</td><td class="mu">'+esc(x.sku)+'</td>'+
      '<td class="r"><input id="cc-'+i+'" type="number" min="0" inputmode="numeric" '+inp+'></td></tr>').join('')+
    '</tbody></table></div></div>';
}
async function ccClose(){
  const counted=CCS.items.map((x,i)=>{
    const v=($('cc-'+i)&&$('cc-'+i).value)||'';
    return v===''?null:{...x,counted:Math.max(0,parseInt(v,10)||0)};
  }).filter(Boolean);
  if(!counted.length)return alert('Nothing entered yet.');
  const matched=counted.filter(x=>x.counted===x.expected).length;
  const varU=counted.reduce((a,x)=>a+Math.abs(x.counted-x.expected),0);
  if(!confirm('Close this count?\n\n'+counted.length+' SKUs counted · '+matched+' match ('+Math.round(matched/counted.length*100)+'%) · '+varU+' units of variance.\n\nVariances write adjustment movements into the ledger.'))return;
  try{
    const {data:sess,error}=await SB.from('count_sessions').insert({scope:CCS.scope,started_by:SBUSER.id,started_name:(SBPROFILE&&SBPROFILE.name)||'',started_at:CCS.started,closed_at:new Date().toISOString(),skus:counted.length,matched,variance_units:varU}).select().single();
    if(error)throw error;
    const {error:e2}=await SB.from('count_lines').insert(counted.map(x=>({session_id:sess.id,sku:x.sku,name:x.name,expected:x.expected,counted:x.counted,variance:x.counted-x.expected})));
    if(e2)throw e2;
    const adj=counted.filter(x=>x.counted!==x.expected).map(x=>({sku:x.sku,qty:x.counted-x.expected,kind:'adjust',ref:'CC-'+sess.id,note:'cycle count: counted '+x.counted+' vs expected '+x.expected}));
    if(adj.length)for(let i=0;i<adj.length;i+=200)await ledgerAdd(adj.slice(i,i+200));
    audit('count.close',{session:sess.id,scope:CCS.scope,skus:counted.length,matched,variance:varU});
    CCS=null;
    alert(matched===counted.length?'CLEAN COUNT ✓ 100% matched — one step closer to retiring the sheet.':'Count closed — '+adj.length+' variance(s) recorded as ledger adjustments.');
    renderCycleCounts();
  }catch(e){alert('Could not close: '+(e.message||e)+(String(e.message||'').includes('count_sessions')?'\n\n(Run the cycle-counts SQL from SUPABASE-SETUP.md.)':''));}
}

/* ══════════ CASH-FLOW FORECAST — collections per week from AR terms + PDC maturities ══════════ */
async function renderCashflow(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  await loadNativeOrders();
  let pdcs=[];try{const {data}=await SB.from('pdcs').select('account,amount,maturity,status').in('status',['on_hand','deposited']);pdcs=data||[];}catch(e){}
  const today=new Date();today.setHours(0,0,0,0);
  const monday=new Date(today);monday.setDate(monday.getDate()-((monday.getDay()+6)%7)); // this week's Monday
  const W=8,buckets=[];
  for(let i=0;i<W;i++){const a=new Date(monday.getTime()+i*7*864e5),b=new Date(a.getTime()+6*864e5);buckets.push({from:a,to:b,label:a.toISOString().slice(5,10).replace('-','/')+'–'+b.toISOString().slice(5,10).replace('-','/'),ar:0,pdc:0});}
  let overdueAR=0,beyond=0,pdcTot=0;
  const pdcAccts=new Set(pdcs.map(x=>String(x.account||'').trim().toLowerCase())); // an AR balance covered by a cheque counts once — as the cheque
  const put=(t,amt,kind)=>{
    if(t<monday.getTime()){if(kind==='ar')overdueAR+=amt;else buckets[0][kind]+=amt;return;} // overdue cheques: deposit now
    const i=Math.floor((t-monday.getTime())/(7*864e5));
    if(i>=W)beyond+=amt;else buckets[i][kind]+=amt;
  };
  (NORDERS||[]).filter(o=>!o.deleted_at&&o.status!=='cancelled'&&o.pay_status!=='refunded'&&(o.balance||0)>0)
    .forEach(o=>{
      if(pdcAccts.has(String(o.account||'').trim().toLowerCase()))return; // cheque in hand covers it
      put(new Date(o.date).getTime()+((o.terms_days||0)*864e5),o.balance,'ar');
    });
  pdcs.forEach(x=>{pdcTot+=x.amount||0;put(new Date(x.maturity).getTime(),x.amount||0,'pdc');});
  const wkTot=buckets.map(b=>b.ar+b.pdc);
  const maxW=Math.max(1,...wkTot);
  const total8=wkTot.reduce((a,b)=>a+b,0);
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('cashflow'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Expected — next 8 weeks</div><div class="met-val" style="font-size:16px">'+fmtPeso(total8)+'</div><div class="met-sub">AR maturing + cheques deposit-ready</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Already overdue</div><div class="met-val" style="font-size:16px">'+fmtPeso(overdueAR)+'</div><div class="met-sub">past terms, no cheque in hand — chase now</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Cheques in hand</div><div class="met-val" style="font-size:16px">'+fmtPeso(pdcTot)+'</div><div class="met-sub">'+pdcs.length+' PDCs awaiting maturity</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Beyond 8 weeks</div><div class="met-val" style="font-size:16px">'+fmtPeso(beyond)+'</div><div class="met-sub">longer terms + far maturities</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Week</th><th class="r">AR maturing</th><th class="r">PDCs maturing</th><th class="r">Expected in</th><th style="width:34%"></th></tr></thead><tbody>'+
    buckets.map((b,i)=>'<tr'+(i===0?' style="font-weight:600"':'')+'><td>'+b.label+(i===0?' <span class="pill pbl">this week</span>':'')+'</td>'+
      '<td class="r">'+(b.ar?fmtPeso(b.ar):'—')+'</td><td class="r">'+(b.pdc?fmtPeso(b.pdc):'—')+'</td>'+
      '<td class="r" style="font-weight:700">'+((b.ar+b.pdc)?fmtPeso(b.ar+b.pdc):'—')+'</td>'+
      '<td><div style="height:10px;border-radius:5px;background:var(--sf2);overflow:hidden"><div style="height:100%;width:'+Math.round((b.ar+b.pdc)/maxW*100)+'%;background:var(--ac)"></div></div></td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>AR lands in the week its terms mature (order date + terms) · accounts with a cheque in hand count via the cheque, not double · overdue AR is excluded from the weekly bars — it\'s in the red card · bounced/cleared cheques excluded</span></div></div>';
}


/* ── COMMUNICATION LOG: 2-tap call/Viber touches on account pages ── */
async function commLog(account,kind){
  if(!SB||!SBUSER)return;
  const note=prompt(kind+' with '+account+' — what happened? (optional)','');
  if(note===null)return;
  try{
    const {error}=await SB.from('visits').insert({user_id:SBUSER.id,spec:(SBPROFILE&&SBPROFILE.specialist_tag)||(SBPROFILE&&SBPROFILE.name)||'',account,date:new Date().toISOString().slice(0,10),type:kind,outcome:'Contacted',notes:(note||'').trim()||null,status:'done'});
    if(error)throw error;
    audit('comm.log',{account,kind});
    alert(kind+' logged ✓ — it counts as a touch (timeline, coverage, dormancy).');
    if(typeof showAccountPage==='function')showAccountPage(account);
  }catch(e){alert('Could not log: '+(e.message||e));}
}


/* ── BACKORDERS: manager ATP overrides become tracked shortfalls that auto-release ── */
async function boRelease(sku,qtyIn){
  try{
    const {data:bos}=await SB.from('backorders').select('*').eq('status','open').ilike('sku',sku).order('id',{ascending:true});
    let left=qtyIn;
    for(const b of (bos||[])){
      if(left<b.qty_short)break;
      left-=b.qty_short;
      await SB.from('backorders').update({status:'released',released_at:new Date().toISOString()}).eq('id',b.id);
      audit('backorder.release',{order:b.order_label,sku:b.sku,qty:b.qty_short});
      notify({roles:['supply_chain']},'auto','Backorder released: '+b.order_label,b.qty_short+'u '+b.name+' arrived — '+b.account+' can ship now','#/v/fulfillq');
      notifyOrderOwner(b.order_id,'auto','Backorder released: '+b.order_label,b.qty_short+'u '+b.name+' arrived — your order can ship','#/v/orders');
    }
  }catch(e){}
}
async function boCancel(id){
  if(!canFulfil())return;
  if(!confirm('Cancel this backorder? (e.g. the order itself was cancelled)'))return;
  try{await SB.from('backorders').update({status:'cancelled',released_at:new Date().toISOString()}).eq('id',id);audit('backorder.cancel',{id});renderFulfillQ();}catch(e){alert(e.message||e);}
}

/* ── RETURNS RECEIVING + QUARANTINE & DISPOSAL (the pharma trail) ── */
async function returnsReceive(cmRef){
  if(!canWarehouse()&&!roleIn('finance','admin'))return;
  for(;;){
    const skuIn=(prompt('Returned SKU (blank = done):','')||'').trim();
    if(!skuIn)break;
    const p=DATA.find(x=>x.sku.toLowerCase()===skuIn.toLowerCase())||DATA.find(x=>x.name.toLowerCase().startsWith(skuIn.toLowerCase()));
    if(!p){alert('Unknown SKU/product: '+skuIn);continue;}
    const qty=parseInt(prompt('Quantity of '+p.name+':','1')||'0',10);
    if(!qty||qty<1)continue;
    const batch=(prompt('Batch / lot (from the box, blank if unreadable):','')||'').trim();
    const sellable=confirm(p.name+' ×'+qty+'\n\nOK = SELLABLE (back into stock)\nCancel = QUARANTINE (held for inspection)');
    if(sellable){
      await ledgerAdd([{sku:p.sku,qty:qty,kind:'return',ref:cmRef,batch:batch||null,note:'return restock'}]);
      audit('return.restock',{cm:cmRef,sku:p.sku,qty,batch});
    }else{
      await quarAdd(p.sku,p.name,qty,batch,'return',cmRef,false);
    }
  }
}
async function quarAdd(sku,name,qty,batch,reason,ref,pullFromStock){
  const {data,error}=await SB.from('quarantine').insert({sku,name,qty,batch:batch||null,reason,source_ref:ref||null,pulled:!!pullFromStock,created_by:SBUSER.id,created_name:(SBPROFILE&&SBPROFILE.name)||''}).select().single();
  if(error)throw error;
  if(pullFromStock)await ledgerAdd([{sku,qty:-qty,kind:'adjust',ref:'QUAR-'+data.id,batch:batch||null,note:'pulled to quarantine ('+reason+')'}]);
  audit('quarantine.add',{sku,qty,reason,ref:ref||''});
  return data;
}
async function renderQuarantine(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  let rows=[];
  try{const {data,error}=await SB.from('quarantine').select('*').order('id',{ascending:false}).limit(300);if(error)throw error;rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the quarantine SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  const held=rows.filter(r=>r.status==='held');
  const heldU=held.reduce((a,r)=>a+(r.qty||0),0);
  const heldV=held.reduce((a,r)=>{const p=DATA.find(d=>d.sku===r.sku);return a+(p&&p.price>0?p.price*r.qty:0);},0);
  const disp90=rows.filter(r=>r.status==='disposed'&&r.decided_at&&r.decided_at>new Date(Date.now()-90*864e5).toISOString()).reduce((a,r)=>a+(r.qty||0),0);
  const canW=canWarehouse();
  const pill=r=>r.status==='held'?'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">HELD</span>':r.status==='released'?'<span class="pill pgr">released to stock</span>':'<span class="pill prd">disposed</span>';
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('quarantine'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met am"><div class="met-lbl">Held in quarantine</div><div class="met-val">'+heldU+'u</div><div class="met-sub">'+held.length+' lots · not sellable, not in ATP</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Value held</div><div class="met-val" style="font-size:15px">'+fmtPeso(heldV)+'</div><div class="met-sub">at list prices</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Disposed (90d)</div><div class="met-val">'+disp90+'u</div><div class="met-sub">the write-off trail</div><div class="met-bar"></div></div>'+
    '</div>'+
    (canW?'<div style="margin-bottom:14px"><button onclick="quarPull()" style="background:var(--am);color:#fff;border:none;border-radius:10px;padding:11px 18px;font-size:13px;font-weight:700;cursor:pointer">Pull stock into quarantine</button><span style="font-size:11.5px;color:var(--tx3);margin-left:10px">expiring / damaged / QA-hold units — removed from sellable stock immediately</span></div>':'')+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>#</th><th>Product</th><th>Batch</th><th class="r">Qty</th><th>Reason</th><th>Ref</th><th>Since</th><th>Status</th>'+(canW?'<th></th>':'')+'</tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td class="mu">Q-'+r.id+'</td><td style="font-weight:600">'+esc(r.name||r.sku)+'</td><td class="mu">'+esc(r.batch||'—')+'</td><td class="r">'+r.qty+'</td>'+
      '<td>'+esc(r.reason)+'</td><td class="mu" style="font-size:11px">'+esc(r.source_ref||'—')+'</td><td class="mu" style="font-size:11px">'+esc((r.created_at||'').slice(0,10))+'</td><td>'+pill(r)+'</td>'+
      (canW?'<td style="white-space:nowrap;font-size:11.5px">'+(r.status==='held'?'<a href="#" onclick="quarDecide('+r.id+',\'released\');return false" style="color:var(--gr)">release</a> · <a href="#" onclick="quarDecide('+r.id+',\'disposed\');return false" style="color:var(--rd)">dispose</a>':'')+'</td>':'')+
      '</tr>').join(''):'<tr><td colspan="9" class="mu">Nothing in quarantine — as it should be.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Quarantined units are out of sellable stock and ATP · release puts them back into the ledger · dispose closes the trail with who/when — the compliance record for expired or damaged product</span></div></div>';
}
async function quarPull(){
  if(!canWarehouse())return;
  const skuIn=(prompt('SKU or product to pull into quarantine:','')||'').trim();if(!skuIn)return;
  const p=DATA.find(x=>x.sku.toLowerCase()===skuIn.toLowerCase())||DATA.find(x=>x.name.toLowerCase().startsWith(skuIn.toLowerCase()));
  if(!p)return alert('Unknown SKU/product.');
  const qty=parseInt(prompt('Quantity of '+p.name+' to pull:','1')||'0',10);if(!qty||qty<1)return;
  const batch=(prompt('Batch / lot:','')||'').trim();
  const reason=(prompt('Reason (expiry / damage / QA hold):','expiry')||'expiry').trim();
  try{await quarAdd(p.sku,p.name,qty,batch,reason,null,true);renderQuarantine();}
  catch(e){alert('Could not quarantine: '+(e.message||e));}
}
async function quarDecide(id,status){
  if(!canWarehouse())return;
  const note=(prompt(status==='released'?'Release back to sellable stock — inspection note:':'DISPOSE — method/witness note (compliance record):','')||'').trim();
  if(note===''&&status==='disposed'&&!confirm('No disposal note — record anyway?'))return;
  try{
    const {data:r}=await SB.from('quarantine').select('*').eq('id',id).maybeSingle();
    if(!r||r.status!=='held')return;
    const {error}=await SB.from('quarantine').update({status,notes:note||null,decided_at:new Date().toISOString(),decided_by:(SBPROFILE&&SBPROFILE.name)||''}).eq('id',id);
    if(error)throw error;
    if(status==='released'){
      // back into the ledger: pulled stock returns via adjust; return-sourced units enter for the first time
      const kind=r.pulled?'adjust':(String(r.reason||'').toLowerCase().startsWith('qa')?'receive':'return');
      await ledgerAdd([{sku:r.sku,qty:r.qty,kind:kind,ref:'QUAR-'+r.id,batch:r.batch||null,note:'quarantine release'}]);
    }
    audit('quarantine.'+status,{q:r.id,sku:r.sku,qty:r.qty});
    renderQuarantine();
  }catch(e){alert('Could not update: '+(e.message||e));}
}

/* ── WAREHOUSE KPIs: measurable the moment the ledger is authoritative ── */
async function renderWhKpi(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  const since30=new Date(Date.now()-30*864e5).toISOString();
  let ful=[],pend=[],boN=0,boAll=0,picks7=0;
  try{
    // five independent aggregates — one wave, not five round trips in a row
    const [r1,r2,b1,b2,p7]=await Promise.all([
      SB.from('orders').select('id,num,account,created_at,fulfilled_at,total').eq('source','native').eq('status','fulfilled').is('deleted_at',null).gte('fulfilled_at',since30).not('fulfilled_at','is',null).order('fulfilled_at',{ascending:false}).limit(500),
      SB.from('orders').select('id,num,date,account').eq('source','native').eq('status','pending').is('deleted_at',null).order('date',{ascending:true}).limit(500),
      SB.from('backorders').select('id',{count:'exact',head:true}).gte('created_at',since30),
      SB.from('orders').select('id',{count:'exact',head:true}).eq('source','native').is('deleted_at',null).gte('created_at',since30),
      SB.from('stock_moves').select('qty').eq('kind','pick').gte('created_at',new Date(Date.now()-7*864e5).toISOString()).limit(2000)
    ]);
    ful=r1.data||[];pend=r2.data||[];boAll=b1.count||0;boN=b2.count||0;
    picks7=(p7.data||[]).reduce((a,r)=>a+Math.abs(r.qty||0),0);
  }catch(e){}
  const cyc=ful.filter(o=>o.created_at&&o.fulfilled_at).map(o=>(new Date(o.fulfilled_at)-new Date(o.created_at))/36e5).sort((a,b)=>a-b);
  const med=cyc.length?cyc[Math.floor(cyc.length/2)]:null;
  const avg=cyc.length?cyc.reduce((a,b)=>a+b,0)/cyc.length:null;
  const fmtH=h=>h==null?'—':h<48?h.toFixed(1)+'h':(h/24).toFixed(1)+'d';
  const age=d=>Math.round((Date.now()-new Date(d))/864e5);
  const fill=boN?Math.max(0,100-Math.round(boAll/boN*100)):100;
  const within48=cyc.length?Math.round(cyc.filter(h=>h<=48).length/cyc.length*100):null;
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Order cycle time (median, 30d)</div><div class="met-val">'+fmtH(med)+'</div><div class="met-sub">order taken → fulfilled · avg '+fmtH(avg)+'</div><div class="met-bar"></div></div>'+
    '<div class="met '+(within48==null||within48>=80?'gr':'am')+'"><div class="met-lbl">Fulfilled ≤ 48h</div><div class="met-val">'+(within48==null?'—':within48+'%')+'</div><div class="met-sub">of '+cyc.length+' timed fulfillments</div><div class="met-bar"></div></div>'+
    '<div class="met '+(fill>=95?'gr':'am')+'"><div class="met-lbl">Fill rate (30d)</div><div class="met-val">'+fill+'%</div><div class="met-sub">'+boAll+' backordered of '+boN+' orders</div><div class="met-bar"></div></div>'+
    '<div class="met '+(pend.length&&age(pend[0].date)>7?'rd':'bl')+'"><div class="met-lbl">Open queue</div><div class="met-val">'+pend.length+'</div><div class="met-sub">oldest '+(pend.length?age(pend[0].date)+'d':'—')+' · '+picks7.toLocaleString()+' units picked (7d)</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Order</th><th>Account</th><th>Taken</th><th>Fulfilled</th><th class="r">Cycle</th></tr></thead><tbody>'+
    (ful.length?ful.slice(0,40).map(o=>{const h=o.created_at&&o.fulfilled_at?(new Date(o.fulfilled_at)-new Date(o.created_at))/36e5:null;
      return '<tr onclick="showOrderPage(\''+o.id+'\')" style="cursor:pointer"><td style="font-weight:700">'+esc(fmtOrdNum(o.num))+'</td><td>'+esc(o.account||'')+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc((o.created_at||'').slice(0,16).replace('T',' '))+'</td><td class="mu" style="font-size:11px">'+esc((o.fulfilled_at||'').slice(0,16).replace('T',' '))+'</td>'+
      '<td class="r" style="font-weight:600;color:'+(h!=null&&h>72?'var(--rd)':h!=null&&h>48?'var(--am)':'var(--gr)')+'">'+fmtH(h)+'</td></tr>';}).join(''):'<tr><td colspan="5" class="mu">No timed fulfillments yet — cycle times start counting from this deploy (fulfilled_at is stamped from now on).</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Cycle time = order created → marked fulfilled (stamped automatically by pick-confirm, scan-to-pick, and status controls) · fill rate = orders without a backorder · these numbers become the warehouse\'s scoreboard once the ledger is the stock truth</span></div></div>';
}

/* ── COMPLAINTS LOG: quality reports with batch reference, feeding the recall trace ── */
async function renderComplaints(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  let rows=[];
  try{const {data,error}=await SB.from('complaints').select('*').order('id',{ascending:false}).limit(200);if(error)throw error;rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the complaints SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  const open=rows.filter(r=>r.status!=='closed');
  const canM=roleIn('admin','manager','supply_chain');
  const pill=r=>r.status==='closed'?'<span class="pill pgr">closed</span>':r.status==='investigating'?'<span class="pill pbl">investigating</span>':'<span class="pill prd">OPEN</span>';
  const inp='style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px"';
  const lbl='style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin:8px 0 3px"';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met '+(open.length?'rd':'gr')+'"><div class="met-lbl">Open complaints</div><div class="met-val">'+open.length+'</div><div class="met-sub">quality reports needing action</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">All time</div><div class="met-val">'+rows.length+'</div><div class="met-sub">every report kept — the compliance trail</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="g2" style="align-items:start;gap:14px">'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>#</th><th>Account</th><th>Product / batch</th><th>What happened</th><th>Filed by</th><th>Status</th>'+(canM?'<th></th>':'')+'</tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td class="mu">'+CX_NO(r.id)+'</td><td style="font-weight:600">'+esc(r.account||'—')+'</td>'+
      '<td>'+esc(r.sku||'—')+(r.batch?' <span class="pill pbl" style="cursor:pointer" onclick="showView(\'recall\',null)" title="Trace this batch in Batch recall trace">'+esc(r.batch)+'</span>':'')+'</td>'+
      '<td style="font-size:11.5px;max-width:240px">'+esc(r.description||'')+(r.resolution?'<br><span style="color:var(--gr)">→ '+esc(r.resolution)+'</span>':'')+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc(r.created_name||'')+'<br>'+esc((r.created_at||'').slice(0,10))+'</td><td>'+pill(r)+'</td>'+
      (canM?'<td style="white-space:nowrap;font-size:11.5px">'+(r.status!=='closed'?(r.status==='open'?'<a href="#" onclick="complaintSet('+r.id+',\'investigating\');return false" style="color:var(--ac)">investigate</a> · ':'')+'<a href="#" onclick="complaintSet('+r.id+',\'closed\');return false" style="color:var(--gr)">close</a>':'')+delLink('complaints',r.id)+'</td>':'')+
      '</tr>').join(''):'<tr><td colspan="7" class="mu">No complaints on record.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Every complaint keeps its batch reference — one tap into the recall trace shows every other clinic that received the same lot · closing requires a resolution note</span></div></div>'+
    '<div class="panel" style="padding:16px"><div class="phd">File a complaint</div>'+
    '<label '+lbl+'>Account / clinic</label><input id="cp-acct" list="cp-accts" '+inp+'>'+
    '<datalist id="cp-accts">'+acctList().map(r=>'<option value="'+esc(r.name)+'">').join('')+'</datalist>'+
    '<label '+lbl+'>Product (SKU or name)</label><input id="cp-sku" '+inp+'>'+
    '<label '+lbl+'>Batch / lot (from the box)</label><input id="cp-batch" '+inp+'>'+
    '<label '+lbl+'>What happened</label><textarea id="cp-desc" rows="3" '+inp+'></textarea>'+
    '<div id="cp-msg" style="min-height:14px;font-size:11px;margin:8px 0 4px"></div>'+
    '<button onclick="complaintAdd()" style="width:100%;background:var(--rd);color:#fff;border:none;border-radius:8px;padding:11px;font-size:13px;font-weight:600;cursor:pointer">File complaint</button>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:8px">Supply chain and management are pinged immediately.</div></div>'+
    '</div>';
}
async function complaintAdd(){
  const g=id=>($(id)&&$(id).value||'').trim();const msg=$('cp-msg');
  if(!g('cp-acct')||!g('cp-desc')){if(msg){msg.style.color='var(--rd)';msg.textContent='Need at least the account and what happened.';}return;}
  const p=DATA.find(x=>x.sku.toLowerCase()===g('cp-sku').toLowerCase())||DATA.find(x=>x.name.toLowerCase().startsWith(g('cp-sku').toLowerCase()));
  try{
    const {data,error}=await SB.from('complaints').insert({account:g('cp-acct'),sku:p?p.sku:(g('cp-sku')||null),batch:g('cp-batch')||null,description:g('cp-desc'),created_by:SBUSER.id,created_name:(SBPROFILE&&SBPROFILE.name)||''}).select().single();
    if(error)throw error;
    audit('complaint.file',{c:data.id,account:g('cp-acct'),sku:p?p.sku:g('cp-sku'),batch:g('cp-batch')});
    notify({roles:['supply_chain']},'auto','Complaint '+CX_NO(data.id)+': '+g('cp-acct'),(p?p.name:g('cp-sku'))+(g('cp-batch')?' · batch '+g('cp-batch'):'')+' — '+g('cp-desc').slice(0,120),'#/v/complaints');
    renderComplaints();
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent=(e.message||e)+(String(e.message||'').includes('complaints')?' (run the complaints SQL)':'');}}
}
async function complaintSet(id,status){
  if(!roleIn('admin','manager','supply_chain'))return;
  let resolution=null;
  if(status==='closed'){resolution=prompt('Resolution (what was found / done):');if(resolution===null)return;if(!resolution.trim())return alert('Closing needs a resolution note — it\'s the compliance record.');}
  try{
    const upd={status};if(resolution)upd.resolution=resolution.trim();if(status==='closed')upd.closed_at=new Date().toISOString();
    const {error}=await SB.from('complaints').update(upd).eq('id',id);if(error)throw error;
    audit('complaint.'+status,{c:id});renderComplaints();
  }catch(e){alert(e.message||e);}
}


/* ── MY MANUAL: view it in the app, download it, or open it in a tab ── */
async function fetchManualBlob(){
  const r=await fetch('/.netlify/functions/manual',{headers:await sbAuthHeaders()});
  if(!r.ok){let e='HTTP '+r.status;try{e=(await r.json()).error||e;}catch(x){}throw new Error(e);}
  const blob=await r.blob();
  const cd=r.headers.get('Content-Disposition')||'';
  const m=cd.match(/filename="([^"]+)"/);
  return {blob,name:(m&&m[1])||'HQ-Manual.pdf'};
}
function downloadManual(){showView('manual',null);} // legacy entry points open the viewer
async function renderManualView(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Fetching your manual…</div>';
  try{
    if(window._manURL){try{URL.revokeObjectURL(window._manURL);}catch(e){}}
    const {blob,name}=await fetchManualBlob();
    window._manURL=URL.createObjectURL(blob);window._manName=name;
    audit('manual.view',{});
    $('content').innerHTML=
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">'+
      '<b style="font-size:13.5px">'+esc(name)+'</b><span style="font-size:11.5px;color:var(--tx3)">written for your role — it matches exactly what your screens show</span><span style="flex:1"></span>'+
      '<button onclick="manualSave()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer">⬇ Download</button>'+
      '<button onclick="manualTab()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 16px;font-size:12.5px;cursor:pointer">Open full screen</button></div>'+
      '<iframe src="'+window._manURL+'" style="width:100%;height:calc(100dvh - 190px);min-height:420px;border:1px solid var(--bd);border-radius:12px;background:#fff"></iframe>'+
      '<div style="font-size:10.5px;color:var(--tx3);margin-top:8px">If the preview shows only the first page on iPhone/iPad, tap “Open full screen” — Safari’s reader shows every page.</div>';
  }catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load the manual: '+esc(e.message||e)+'</div>';}
}
function manualSave(){
  const a=document.createElement('a');a.href=window._manURL;a.download=window._manName||'HQ-Manual.pdf';a.click();
}
function manualTab(){
  const w=window.open(window._manURL,'_blank');
  if(!w)manualSave(); // popup blocked → download instead
}

/* ══════════ SUPPLIER MASTER + INCOMING SHIPMENTS + VALUATION ══════════ */
async function renderSuppliers(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  let sup=[],pos=[];
  try{const {data,error}=await SB.from('suppliers').select('*').order('name');if(error)throw error;sup=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the procure-to-pay SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  try{const {data}=await SB.from('pos').select('id,supplier,status,eta,etd,customs_status').in('status',['ordered','partial']);pos=data||[];}catch(e){}
  const canW=canWarehouse()||roleIn('finance');
  const incoming=pos.filter(p=>p.eta).sort((a,b)=>a.eta<b.eta?-1:1);
  $('content').innerHTML=(typeof roBanner==='function'?roBanner('suppliers'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Suppliers</div><div class="met-val">'+sup.filter(x=>x.active!==false).length+'</div><div class="met-sub">'+sup.length+' on file</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Incoming shipments</div><div class="met-val">'+incoming.length+'</div><div class="met-sub">'+(incoming.length?'next ETA '+esc(incoming[0].eta):'nothing on the water')+'</div><div class="met-bar"></div></div>'+
    '</div>'+
    (incoming.length?'<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">On the water</div>'+
      incoming.map(p=>'<div class="drow" style="border-bottom:1px solid var(--bd);padding:7px 0"><span class="dlbl"><b>'+PO_NO(p.id)+'</b> · '+esc(p.supplier)+'</span>'+
      '<span class="dval" style="font-size:11.5px">'+(p.etd?'ETD '+esc(p.etd)+' · ':'')+'ETA <b>'+esc(p.eta)+'</b>'+(p.customs_status?' · <span class="pill pbl">'+esc(p.customs_status)+'</span>':'')+'</span></div>').join('')+
      '<div style="font-size:10.5px;color:var(--tx3);margin-top:6px">Edit ETD/ETA/customs on each PO (Purchase orders → Import shipment).</div></div>':'')+
    (canW?'<div style="margin-bottom:14px"><button onclick="supAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:11px 18px;font-size:13px;font-weight:700;cursor:pointer">+ New supplier</button></div>':'')+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Supplier</th><th>Currency</th><th>Terms</th><th class="r">Lead time</th><th>Contact</th><th>Notes</th>'+(canW?'<th></th>':'')+'</tr></thead><tbody>'+
    (sup.length?sup.map(x=>'<tr'+(x.active===false?' style="opacity:.5"':'')+'><td style="font-weight:600">'+esc(x.name)+(x.active===false?' <span class="pill pgy">inactive</span>':'')+'</td>'+
      '<td>'+esc(x.currency||'PHP')+'</td><td class="mu">'+esc(x.terms||'—')+'</td><td class="r">'+(x.lead_time_days?x.lead_time_days+'d':'—')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+esc([x.contact,x.email,x.phone].filter(Boolean).join(' · ')||'—')+'</td><td class="mu" style="font-size:11px;max-width:180px">'+esc(x.notes||'')+'</td>'+
      (canW?'<td style="white-space:nowrap;font-size:11.5px"><a href="#" onclick="supEdit('+x.id+');return false" style="color:var(--ac)">edit</a> · <a href="#" onclick="supToggle('+x.id+','+(x.active===false?'true':'false')+');return false" style="color:'+(x.active===false?'var(--gr)':'var(--am)')+'">'+(x.active===false?'activate':'deactivate')+'</a></td>':'')+
      '</tr>').join(''):'<tr><td colspan="7" class="mu">No suppliers yet — add the first one.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Lead times feed ordering judgment (the forecast assumes ~2 months when unset) · currencies drive the multi-currency AP fields on POs · supplier bill PAYMENTS stay in the bank portals by design</span></div></div>';
}
async function supAdd(){await supForm(null);}
async function supEdit(id){
  const {data}=await SB.from('suppliers').select('*').eq('id',id).maybeSingle();
  if(data)await supForm(data);
}
async function supForm(cur){
  if(!canWarehouse()&&!roleIn('finance'))return;
  const g=(label,v)=>{const r=prompt(label+':',v==null?'':String(v));return r===null?undefined:r.trim();};
  const name=g('Supplier name',cur&&cur.name);if(name===undefined||!name)return;
  const currency=g('Currency (PHP / USD / EUR…)',cur?cur.currency:'USD');if(currency===undefined)return;
  const terms=g('Payment terms (e.g. 50% DP, 50% before ship)',cur&&cur.terms);if(terms===undefined)return;
  const lead=g('Lead time in days (order → warehouse)',cur&&cur.lead_time_days);if(lead===undefined)return;
  const contact=g('Contact person',cur&&cur.contact);if(contact===undefined)return;
  const email=g('Email',cur&&cur.email);if(email===undefined)return;
  const notes=g('Notes',cur&&cur.notes);if(notes===undefined)return;
  try{
    const rec={name,currency:currency||'PHP',terms:terms||null,lead_time_days:parseInt(lead,10)||null,contact:contact||null,email:email||null,notes:notes||null};
    if(cur){const {error}=await SB.from('suppliers').update(rec).eq('id',cur.id);if(error)throw error;}
    else{rec.created_by=SBUSER.id;const {error}=await SB.from('suppliers').insert(rec);if(error)throw error;}
    audit(cur?'supplier.update':'supplier.create',{name});
    renderSuppliers();
  }catch(e){alert('Could not save: '+(e.message||e));}
}
async function supToggle(id,on){
  if(!canWarehouse()&&!roleIn('finance'))return;
  try{const {error}=await SB.from('suppliers').update({active:on}).eq('id',id);if(error)throw error;renderSuppliers();}catch(e){alert(e.message||e);}
}

/* ── LANDED COST & INVENTORY VALUATION (admin + finance only — this is the costs page) ── */
async function renderValuation(){
  if(!roleIn('admin','finance')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Finance and admin only — this page shows costs and margins.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Computing…</div>';
  await loadItems();
  let pls=[],posAll=[];
  try{const {data}=await SB.from('po_lines').select('po_id,sku,qty,received,unit_cost').not('unit_cost','is',null).order('id',{ascending:false}).limit(1000);pls=data||[];}catch(e){}
  try{const {data}=await SB.from('pos').select('id,landed_cost,fx_rate,currency');posAll=data||[];}catch(e){}
  const poMap={};posAll.forEach(p=>poMap[p.id]=p);
  // landed adder per unit for each PO = landed_cost / units received on it
  const poUnits={};pls.forEach(l=>{poUnits[l.po_id]=(poUnits[l.po_id]||0)+(l.received||l.qty||0);});
  const latest={}; // sku → {cost, landed}
  for(const l of pls){ // newest first — keep the first seen per sku
    const k=l.sku.toLowerCase();
    if(latest[k])continue;
    const po=poMap[l.po_id]||{};
    let unit=l.unit_cost||0;
    if(po.currency&&po.currency!=='PHP'&&po.fx_rate)unit=unit*po.fx_rate; // FX cost → ₱ at payment rate
    const landed=(po.landed_cost&&poUnits[l.po_id])?po.landed_cost/poUnits[l.po_id]:0;
    latest[k]={cost:unit,landed};
  }
  const rows=DATA.filter(p=>typeof p.stock==='number'||p.price>0).map(p=>{
    const it=(ITEMS||{})[p.sku]||{};
    const src=latest[p.sku.toLowerCase()];
    const base=src?src.cost:(it.cost!=null?it.cost:null);
    const landed=src?src.landed:0;
    const cost=base!=null?base+landed:null;
    const stock=stk(p)||0;
    return {sku:p.sku,name:p.name,line:p.line,price:p.price||0,base,landed,cost,stock,value:cost!=null?cost*stock:null,
      margin:(cost!=null&&p.price>0)?(p.price-cost)/p.price*100:null,src:src?'PO'+(landed?'+landed':''):(it.cost!=null?'item master':null)};
  }).filter(r=>r.cost!=null);
  rows.sort((a,b)=>(b.value||0)-(a.value||0));
  const totV=rows.reduce((a,r)=>a+(r.value||0),0);
  const totRetail=rows.reduce((a,r)=>a+r.price*r.stock,0);
  window._VALROWS=rows; window._VALTOT=totV;  // the freeze action snapshots exactly what is on screen
  let snaps=[];
  try{const {data}=await SB.from('valuation_snapshots').select('month,taken_at,taken_by,basis,total_value,total_units,sku_count').order('month',{ascending:false}).limit(13);snaps=data||[];}catch(e){}
  const lastMonth=(function(){const d=new Date();d.setDate(0);return d.toISOString().slice(0,7);})();
  const haveLast=snaps.some(x=>x.month===lastMonth);
  const byLine={};rows.forEach(r=>{byLine[r.line||'—']=(byLine[r.line||'—']||0)+(r.value||0);});
  const lowM=rows.filter(r=>r.margin!=null&&r.margin<30).length;
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Inventory at cost</div><div class="met-val" style="font-size:16px">'+fmtPeso(totV)+'</div><div class="met-sub">'+rows.length+' costed SKUs (landed included where known)</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Same stock at list</div><div class="met-val" style="font-size:16px">'+fmtPeso(totRetail)+'</div><div class="met-sub">'+(totRetail?('blended margin '+Math.round((1-totV/totRetail)*100)+'%'):'—')+'</div><div class="met-bar"></div></div>'+
    '<div class="met '+(lowM?'am':'gr')+'"><div class="met-lbl">Margin < 30%</div><div class="met-val">'+lowM+'</div><div class="met-sub">SKUs to reprice or renegotiate</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px;border-left:3px solid '+(haveLast?'var(--gr)':'var(--am)')+'">'+
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">Month-end snapshots</b>'+
      (haveLast?'<span class="pill pgr">'+esc(lastMonth)+' frozen</span>':'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">'+esc(lastMonth)+' not frozen yet</span>')+
      '<span style="flex:1"></span>'+
      '<button onclick="valFreeze(\''+lastMonth+'\')" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">Freeze '+esc(lastMonth)+'</button></div>'+
      '<div style="font-size:12px;color:var(--tx2);margin-top:6px">The figures above are recomputed live from today\u2019s costs and today\u2019s stock \u2014 so \u201cinventory value at 31 July\u201d changes every time someone edits a cost. Freezing writes the month\u2019s value, units and per-SKU detail to a permanent record that later edits cannot touch. Do it once a month, after the count and before the accounting sign-off.</div>'+
      (snaps.length?'<div class="tscroll" style="margin-top:10px"><table><thead><tr><th>Month</th><th class="r">At cost</th><th class="r">Units</th><th class="r">SKUs</th><th>Basis</th><th>Frozen</th></tr></thead><tbody>'+
        snaps.map(x=>'<tr><td style="font-weight:600">'+esc(x.month)+'</td><td class="r" style="font-weight:600">'+fmtPeso(x.total_value)+'</td><td class="r">'+(x.total_units||0).toLocaleString()+'</td><td class="r mu">'+(x.sku_count||0)+'</td>'+
          '<td class="mu" style="font-size:11px">'+esc(x.basis||'—')+'</td><td class="mu" style="font-size:11px">'+esc(String(x.taken_at||'').slice(0,10))+(x.taken_by?' \u00b7 '+esc(x.taken_by):'')+'</td></tr>').join('')+
        '</tbody></table></div>':'<div class="mu" style="font-size:11.5px;margin-top:8px">No snapshots yet.</div>')+
      '</div>'+
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">Value at cost by line</div>'+
    Object.entries(byLine).sort((a,b)=>b[1]-a[1]).map(([l,v])=>'<div class="drow"><span class="dlbl">'+esc(l)+'</span><span class="dval">'+fmtPeso(v)+'</span></div>').join('')+'</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th class="r">Unit cost ₱</th><th class="r">+ landed</th><th class="r">List</th><th class="r">Margin</th><th class="r">Stock</th><th class="r">Value at cost</th><th>Source</th></tr></thead><tbody>'+
    rows.slice(0,120).map(r=>'<tr><td style="font-weight:600">'+esc(r.name)+'</td><td class="r">'+fmtPeso(Math.round(r.base))+'</td><td class="r mu">'+(r.landed?fmtPeso(Math.round(r.landed)):'—')+'</td>'+
      '<td class="r">'+fmtPeso(r.price)+'</td><td class="r" style="font-weight:700;color:'+(r.margin==null?'var(--tx3)':r.margin<30?'var(--rd)':r.margin<50?'var(--am)':'var(--gr)')+'">'+(r.margin==null?'—':Math.round(r.margin)+'%')+'</td>'+
      '<td class="r">'+r.stock.toLocaleString()+'</td><td class="r" style="font-weight:600">'+fmtPeso(Math.round(r.value))+'</td><td class="mu" style="font-size:10.5px">'+esc(r.src||'')+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Unit cost = latest PO receive cost (× FX payment rate for foreign POs) + that PO\'s landed cost spread across its received units · falls back to the item-master cost · margins vs VAT-inclusive list price · admin + finance only</span></div></div>';
}

async function valFreeze(month){
  if(!roleIn('admin','finance'))return alert('Finance and admin only.');
  const rows=window._VALROWS||[];
  if(!rows.length)return alert('Nothing costed to snapshot yet.');
  const basis=(typeof flagOn==='function'&&flagOn('ledger_is_truth'))?'ledger':'sheet';
  const units=Math.round(rows.reduce((a,r)=>a+(r.stock||0),0)); // bigint column
  const total=Math.round(window._VALTOT||0);
  // honesty check: this snapshots stock and costs AS THEY ARE NOW, labelled as that month
  const monthEnd=(function(){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0));})();
  const daysLate=Math.round((Date.now()-monthEnd.getTime())/864e5);
  if(!confirm('Freeze '+month+' at '+fmtPeso(total)+' across '+rows.length+' costed SKUs ('+units.toLocaleString()+' units, stock basis: '+basis+')?\n\nThis becomes the permanent month-end figure. Later cost edits will not change it.'+
     (daysLate>5?'\n\nNOTE: it is '+daysLate+' days past the end of '+month+'. This records TODAY\u2019s stock and costs under that month\u2019s label — the further past month end, the less true that is.':'')))return;
  const lines=rows.map(r=>({sku:r.sku,name:r.name,units:r.stock,cost:Math.round(r.cost||0),value:Math.round(r.value||0)}));
  try{
    const {error}=await SB.from('valuation_snapshots').insert({month,basis,total_value:total,total_units:units,sku_count:rows.length,lines,taken_by:(SBPROFILE&&SBPROFILE.name)||''});
    if(error){
      if(String(error.message||'').match(/duplicate|unique/i)){
        if(!(typeof isSuper==='function'&&isSuper()))return alert(month+' is already frozen. Re-freezing a month is a super-admin decision.');
        if(!confirm(month+' is already frozen. RE-FREEZE it with today\u2019s numbers? The previous figure is overwritten.'))return;
        const {error:e2}=await SB.from('valuation_snapshots').update({basis,total_value:total,total_units:units,sku_count:rows.length,lines,taken_at:new Date().toISOString(),taken_by:(SBPROFILE&&SBPROFILE.name)||''}).eq('month',month);
        if(e2)throw e2;
        audit('valuation.refreeze',{month,total});
      }else throw error;
    }else audit('valuation.freeze',{month,total,units,basis});
    renderValuation();
  }catch(e){alert('Could not freeze: '+(e.message||e)+'\n\n(Run the accounting-integrity SQL from SUPABASE-SETUP.md.)');}
}

/* ── MOBILE SUGGESTION SHIM: iOS Safari barely renders <datalist>, especially as a PWA.
   On touch devices, every input[list] gets a custom tappable dropdown instead. ── */
(function(){
  const touch=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
  if(!touch)return; // desktop keeps the native datalist
  let panel=null,curInput=null;
  function ensure(){
    if(panel)return panel;
    panel=document.createElement('div');
    panel.id='dl-shim';
    panel.style.cssText='position:fixed;z-index:99999;background:var(--sf);border:1px solid var(--bd);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-height:40vh;overflow-y:auto;display:none;-webkit-overflow-scrolling:touch';
    document.body.appendChild(panel);
    return panel;
  }
  function hide(){if(panel){panel.style.display='none';}curInput=null;}
  function show(input){
    const listId=input.getAttribute('list');if(!listId)return;
    const dl=document.getElementById(listId);if(!dl)return;
    const q=(input.value||'').toLowerCase().trim();
    const opts=[...dl.querySelectorAll('option')].map(o=>o.value).filter(Boolean);
    const hits=(q?opts.filter(v=>v.toLowerCase().includes(q)):opts).slice(0,8);
    if(!hits.length){hide();return;}
    const p=ensure();curInput=input;
    p.innerHTML=hits.map(v=>'<div class="dl-opt" data-v="'+v.replace(/"/g,'&quot;')+'" style="padding:12px 14px;font-size:14px;color:var(--tx);border-bottom:1px solid var(--bd);cursor:pointer">'+v.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>').join('');
    const r=input.getBoundingClientRect();
    p.style.left=Math.max(6,r.left)+'px';
    p.style.width=Math.min(r.width,window.innerWidth-12)+'px';
    // open above the input when the keyboard eats the lower half
    if(r.bottom>window.innerHeight*0.55){p.style.top='';p.style.bottom=(window.innerHeight-r.top+4)+'px';}
    else{p.style.bottom='';p.style.top=(r.bottom+4)+'px';}
    p.style.display='block';
  }
  document.addEventListener('input',e=>{
    const t=e.target;
    if(t&&t.tagName==='INPUT'&&t.getAttribute('list'))show(t);
  },true);
  document.addEventListener('focusin',e=>{
    const t=e.target;
    if(t&&t.tagName==='INPUT'&&t.getAttribute('list')&&t.value)show(t);
  },true);
  // touchstart beats blur; fill the input and fire the events views listen for
  document.addEventListener('touchstart',e=>{
    const opt=e.target&&e.target.closest&&e.target.closest('.dl-opt');
    if(opt&&curInput){
      e.preventDefault();
      curInput.value=opt.getAttribute('data-v');
      curInput.dispatchEvent(new Event('input',{bubbles:true}));
      curInput.dispatchEvent(new Event('change',{bubbles:true}));
      hide();
      curInput=null;
      return;
    }
    if(panel&&panel.style.display==='block'&&!(e.target&&e.target.getAttribute&&e.target.getAttribute('list')))hide();
  },{passive:false,capture:true});
  document.addEventListener('focusout',()=>{setTimeout(()=>{if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#dl-shim'))return;hide();},250);},true);
  window.addEventListener('hashchange',hide);
})();

/* ══════════ TRANSFER ORDERS — Remedy branch shipments as documents ══════════ */
const TR_NO=id=>docNo('transfer',id);
let TCART=[];
async function renderTransfers(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  let rows=[];
  try{const {data,error}=await SB.from('transfers').select('*,transfer_lines(*)').order('id',{ascending:false}).limit(100);if(error)throw error;rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the transfer-orders SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  const inTransit=rows.filter(r=>r.status==='in_transit');
  const canW=canFulfil();
  const pill=r=>r.status==='draft'?'<span class="pill pgy">draft</span>':r.status==='in_transit'?'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">IN TRANSIT</span>':'<span class="pill pgr">delivered</span>';
  $('content').innerHTML=
    (typeof roBanner==='function'?roBanner('transfers'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met am"><div class="met-lbl">In transit</div><div class="met-val">'+inTransit.length+'</div><div class="met-sub">'+inTransit.reduce((a,r)=>a+(r.transfer_lines||[]).reduce((x,l)=>x+(l.qty||0),0),0)+' units on the road</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Transfers</div><div class="met-val">'+rows.length+'</div><div class="met-sub">documents, not chat messages</div><div class="met-bar"></div></div>'+
    '</div>'+
    (canW?'<div style="margin-bottom:14px"><button onclick="trNew()" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:11px 18px;font-size:13px;font-weight:700;cursor:pointer">+ New transfer</button></div>':'')+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Transfer</th><th>To</th><th>Lines</th><th class="r">Units</th><th>Dispatched</th><th>Status</th>'+(canW?'<th></th>':'')+'</tr></thead><tbody>'+
    (rows.length?rows.map(r=>{const u=(r.transfer_lines||[]).reduce((a,l)=>a+(l.qty||0),0);
      return '<tr><td style="font-weight:700">'+TR_NO(r.id)+'</td><td style="font-weight:600">'+esc(r.to_branch)+'</td>'+
      '<td class="mu" style="font-size:11px;max-width:260px">'+(r.transfer_lines||[]).map(l=>l.qty+'× '+esc(l.name||l.sku)+(l.batch?' ['+esc(l.batch)+']':'')).join(', ')+'</td>'+
      '<td class="r">'+u+'</td><td class="mu" style="font-size:11px">'+esc((r.dispatched_at||'').slice(0,10)||'—')+'</td><td>'+pill(r)+'</td>'+
      (canW?'<td style="white-space:nowrap;font-size:11.5px">'+
        (r.status==='draft'?'<a href="#" onclick="trDispatch('+r.id+');return false" style="color:var(--am);font-weight:700">dispatch</a> · <a href="#" onclick="trDelete('+r.id+');return false" style="color:var(--rd)">delete</a>':
         r.status==='in_transit'?'<a href="#" onclick="trDelivered('+r.id+');return false" style="color:var(--gr);font-weight:700">✓ delivered</a>':'')+'</td>':'')+
      '</tr>';}).join(''):'<tr><td colspan="7" class="mu">No transfers yet.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Dispatch writes FEFO batch-stamped outbound movements (ref TR-n) into the ledger — the same trail the recall trace reads · per-branch on-hand still isn\'t tracked (by design); delivered just closes the document</span></div></div>';
}
function trNew(){
  if(!canFulfil())return;
  const br=(prompt('Transfer to which branch? (BGC / Vertis North / GH Mall / other)','BGC')||'').trim();
  if(!br)return;
  TCART=[];
  for(;;){
    const skuIn=(prompt('SKU or product (blank = done adding lines):','')||'').trim();
    if(!skuIn)break;
    const p=DATA.find(x=>x.sku.toLowerCase()===skuIn.toLowerCase())||DATA.find(x=>x.name.toLowerCase().startsWith(skuIn.toLowerCase()));
    if(!p){alert('Unknown SKU/product: '+skuIn);continue;}
    const qty=parseInt(prompt('Quantity of '+p.name+':','1')||'0',10);
    if(!qty||qty<1)continue;
    TCART.push({sku:p.sku,name:p.name,qty});
  }
  if(!TCART.length)return;
  trSave(br);
}
async function trSave(br){
  try{
    const {data:t,error}=await SB.from('transfers').insert({to_branch:br,status:'draft',created_by:SBUSER.id,created_name:(SBPROFILE&&SBPROFILE.name)||''}).select().single();
    if(error)throw error;
    const {error:e2}=await SB.from('transfer_lines').insert(TCART.map(l=>({transfer_id:t.id,sku:l.sku,name:l.name,qty:l.qty})));
    if(e2)throw e2;
    audit('transfer.create',{tr:TR_NO(t.id),to:br,lines:TCART.length});
    TCART=[];renderTransfers();
  }catch(e){alert('Could not save: '+(e.message||e));}
}
async function trDispatch(id){
  if(!canFulfil())return;
  const {data:t}=await SB.from('transfers').select('*,transfer_lines(*)').eq('id',id).maybeSingle();
  if(!t||t.status!=='draft')return;
  if(!confirm('Dispatch '+TR_NO(id)+' to '+t.to_branch+'?\n\nEvery line is written as an outbound FEFO movement in the ledger (batch-stamped).'))return;
  try{
    const rows=[];
    for(const l of (t.transfer_lines||[])){
      const alloc=(typeof fefoAlloc==='function')?fefoAlloc(l.sku,l.qty):[{take:l.qty,batch:null}];
      for(const a of alloc)rows.push({sku:l.sku,qty:-a.take,kind:'pick',ref:TR_NO(id),batch:a.batch||null,note:'transfer to '+t.to_branch});
      // stamp the first batch on the line for the document
      if(alloc[0]&&alloc[0].batch)await SB.from('transfer_lines').update({batch:alloc.map(a=>a.batch).filter(Boolean).join(', ')}).eq('id',l.id);
    }
    if(rows.length)await ledgerAdd(rows);
    const {error}=await SB.from('transfers').update({status:'in_transit',dispatched_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    audit('transfer.dispatch',{tr:TR_NO(id),to:t.to_branch,moves:rows.length});
    renderTransfers();
  }catch(e){alert('Could not dispatch: '+(e.message||e));}
}
async function trDelivered(id){
  if(!canFulfil())return;
  try{const {error}=await SB.from('transfers').update({status:'delivered',delivered_at:new Date().toISOString()}).eq('id',id);if(error)throw error;audit('transfer.delivered',{tr:TR_NO(id)});renderTransfers();}catch(e){alert(e.message||e);}
}
async function trDelete(id){
  if(!canFulfil())return;
  if(!confirm('Delete this DRAFT transfer? (Dispatched transfers are permanent — the ledger already moved.)'))return;
  try{const {error}=await SB.from('transfers').delete().eq('id',id).eq('status','draft');if(error)throw error;renderTransfers();}catch(e){alert(e.message||e);}
}


/* ── VIEW-ONLY CLARITY: who writes where. One map powers the in-view banners
   AND the home-screen 'view-only' badges. Admin/super are never named — a given. ── */
const VIEW_WRITERS={
  approvals:{roles:['manager'],label:'the sales managers'},
  pdc:{roles:['finance'],label:'finance'},
  ar:{roles:['finance'],label:'finance (payments are recorded on order pages)'},
  returns:{roles:['finance'],label:'finance'},
  cashflow:{roles:['finance'],label:'finance (it computes from AR + PDCs)'},
  commissions:{roles:['finance'],label:'finance'},
  catalog:{roles:['finance'],label:'finance'},
  regs:{roles:['finance'],label:'finance (on the item master)'},
  po:{roles:['supply_chain','finance'],label:'supply chain (finance fills the AP and import fields)'},
  suppliers:{roles:['supply_chain','finance'],label:'supply chain and finance'},
  scan:{roles:['supply_chain'],label:'the warehouse team'},
  cyclecount:{roles:['supply_chain'],label:'the warehouse team'},
  quarantine:{roles:['supply_chain'],label:'the warehouse team (finance can add from returns)'},
  shortdated:{roles:['supply_chain','manager','marketing'],label:'the warehouse team, sales managers and marketing'},
  pullouts:null, // everyone may request; approving/releasing is gated inside the page
  archive:null, numbering:null, // super-admin pages
  voucher:null,  orderpay:null,  proofpay:null,  replenish:null,  reimburse:null,  cashadvance:null, // anyone files; approving is gated inside the page
  codelists:{roles:['finance'],label:'finance and admin'}, routes:{roles:['admin'],label:'the admins'},

  poscore:null, // report — read-only by nature
  transfers:{roles:['supply_chain','manager'],label:'the warehouse team'},
  fulfillq:{roles:['supply_chain','manager'],label:'the warehouse team and sales managers'},
  whkpi:null, valuation:null, // reports — read-only for everyone by nature
  promos:{roles:['marketing'],label:'marketing'},
  campaigns:{roles:['marketing','manager'],label:'marketing'},
  quotes:{roles:['sales','manager'],label:'the specialists and sales managers'},
  pipeline:{roles:['sales','manager'],label:'the specialists (their accounts) and sales managers'},
  customers:{roles:['sales','manager'],label:'the specialists (their accounts) and sales managers'},
  salesevents:{roles:['sales','marketing','manager'],label:'the specialists, managers, and marketing'},
  targets:{roles:['manager'],label:'the sales managers'},
  scorecards:{roles:['manager'],label:'the sales managers'},
  complaints:{roles:['sales','manager','supply_chain'],label:'the field team (filing) and supply chain (handling)'}
};
function roFor(v){ // true when this view is read-only for the current role
  const w=VIEW_WRITERS[v];
  if(!w||ROLE==='admin')return false;
  return !(w.roles||[]).includes(ROLE);
}
function roBanner(v){
  if(!roFor(v))return '';
  return '<div class="panel" style="padding:9px 14px;margin-bottom:12px;font-size:12px;color:var(--tx2);border-left:3px solid var(--bd)">'+
    '👁 <b>View-only for your role.</b> Changes here are made by '+VIEW_WRITERS[v].label+'.</div>';
}

/* ── CUSTOMIZE THE BOTTOM BAR: pick your own four quick-access pages
   (Home and Menu are always there). Saved per user, per device. ── */
function mbarKey(){return 'hs_mbar_'+((SBUSER&&SBUSER.id)||'anon');}
function mbarGet(){
  try{const v=JSON.parse(localStorage.getItem(mbarKey())||'null');if(Array.isArray(v))return v.slice(0,4);}catch(e){}
  return null;
}
function mbarOpen(){
  closeMobileMenu&&closeMobileMenu();
  window._mbarMax=(ROLE==='sales')?2:4;
  window._mbarFixed=(ROLE==='sales')?['logvisit','neworder']:[];
  const cur=(mbarGet()||[]).filter(v=>!window._mbarFixed.includes(v)).slice(0,window._mbarMax);
  window._mbarSel=cur.slice();
  // every page this role can open, from the sidebar (title + view)
  const opts=[];
  document.querySelectorAll('.nav .ni').forEach(el=>{
    const m=(el.getAttribute('onclick')||'').match(/showView\('([a-z]+)'/);
    if(!m||m[1]==='home'||window._mbarFixed.includes(m[1]))return;
    if(typeof viewAllowed==='function'&&!viewAllowed(m[1]))return;
    let t='';el.childNodes.forEach(n=>{if(n.nodeType===3)t+=n.textContent;});
    opts.push([m[1],t.trim()||m[1]]);
  });
  let ov=document.getElementById('mbar-ov');
  if(!ov){ov=document.createElement('div');ov.id='mbar-ov';document.body.appendChild(ov);}
  ov.style.cssText='position:fixed;inset:0;z-index:700;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(16px + var(--sat,0px)) 16px calc(24px + env(safe-area-inset-bottom,0px))';
  const chip=(v,t)=>'<button data-v="'+v+'" onclick="mbarToggle(this)" style="margin:0 6px 8px 0;padding:9px 13px;border-radius:20px;font-size:12.5px;cursor:pointer;border:1px solid '+(window._mbarSel.includes(v)?'var(--ac);background:var(--ac);color:#fff;font-weight:600':'var(--bd);background:var(--sf);color:var(--tx)')+'">'+t.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</button>';
  ov.innerHTML=
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:16px">Customize your bottom bar</b><span style="flex:1"></span><button onclick="mbarClose()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 14px;font-size:13px">Cancel</button></div>'+
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:12px">Pick up to <b>'+window._mbarMax+'</b> page'+(window._mbarMax>1?'s':'')+' for one-tap access. '+(ROLE==='sales'?'Home, Log visit, New order, and Menu are always there.':'Home and Menu are always there.')+' <span id="mbar-n" style="font-weight:700;color:var(--ac)">'+window._mbarSel.length+'/'+window._mbarMax+'</span></div>'+
    '<div id="mbar-chips">'+opts.map(o=>chip(o[0],o[1])).join('')+'</div>'+
    '<div style="display:flex;gap:10px;margin-top:16px">'+
    '<button onclick="mbarSave()" style="flex:1;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">Save</button>'+
    '<button onclick="mbarReset()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:13px 16px;font-size:13px;cursor:pointer">Reset to default</button></div>';
}
function mbarToggle(btn){
  const v=btn.getAttribute('data-v');
  const i=window._mbarSel.indexOf(v);
  if(i>=0)window._mbarSel.splice(i,1);
  else{
    if(window._mbarSel.length>=(window._mbarMax||4)){alert('That’s '+(window._mbarMax||4)+' already — unpick one first.');return;}
    window._mbarSel.push(v);
  }
  const on=window._mbarSel.includes(v);
  btn.style.border='1px solid '+(on?'var(--ac)':'var(--bd)');
  btn.style.background=on?'var(--ac)':'var(--sf)';
  btn.style.color=on?'#fff':'var(--tx)';
  btn.style.fontWeight=on?'600':'400';
  const n=document.getElementById('mbar-n');if(n)n.textContent=window._mbarSel.length+'/'+(window._mbarMax||4);
}
function mbarSave(){
  try{localStorage.setItem(mbarKey(),JSON.stringify(window._mbarSel.slice(0,4)));}catch(e){}
  mbarClose();buildMobileNav();
  audit('mbar.customize',{picks:window._mbarSel.join(',')});
}
function mbarReset(){
  try{localStorage.removeItem(mbarKey());}catch(e){}
  mbarClose();buildMobileNav();
}
function mbarClose(){const ov=document.getElementById('mbar-ov');if(ov)ov.remove();}

/* ══════════════════ INVENTORY PULL-OUTS ══════════════════
   Replaces the Google form. A pull-out is stock leaving for internal use —
   KOL engagements, campaigns, FOC promos, trade partnerships, launches and
   training — charged to a department's fund source (the QBO class).

   The flow, and what each step does to stock:
     request   → units RESERVED (out of available-to-promise, nothing moves)
     approve   → the fund source signs off; finance + the warehouse are pinged
     release   → the warehouse hands the goods over; NOW the ledger moves
                 (FEFO batch-stamped, ref PL-n) and the reservation ends
     booked    → the PS records it in Shopify during the parallel run, and
                 ticks it here so nothing is left half-done
   Rejecting or cancelling frees the reservation immediately. */
const PL_NO=id=>docNo('pullout',id);
const CX_NO=id=>docNo('complaint',id);
const PL_REASONS=['KOL & Speaker Engagements','Market Building & Brand Campaigns','FOC & Sales Promotion','Key Accounts & Trade Partnerships','Product Launches & Training Programs'];
const PL_LINES_OPT=['Innoaesthetic','Termosalud','GTG','Skinpen','Biojuve','Mark Vu','Mesoestetic'];
let FUNDS=null;
async function loadFunds(force){
  if(FUNDS&&!force)return FUNDS;
  try{const {data,error}=await SB.from('fund_sources').select('*').order('sort');if(error)throw error;FUNDS=data||[];}
  catch(e){FUNDS=[];}
  return FUNDS;
}
function fundOf(cls){return (FUNDS||[]).find(f=>f.class===cls)||null;}
// may I decide this one? the mapped approver, their backup, or the super admin
function canDecidePullout(p){
  const f=fundOf(p.fund_class);if(!f)return false;
  const me=(SBUSER&&SBUSER.id)||'';
  return (f.approver_id&&f.approver_id===me)||(f.backup_id&&f.backup_id===me)||(typeof isSuper==='function'&&isSuper());
}
async function renderPullouts(cheap){
  // attachments hang off each request; loaded with the page, not per row
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  // cheap = the only thing that changed is the local cart (you added or removed a
  // line you just typed). Repaint from what we already have — no placeholder, no
  // round-trip, no waiting to see the item you entered.
  if(cheap&&window._PLROWS&&window._PLLINES){
    return plPaint(window._PLROWS,window._PLLINES);
  }
  loadingHint();
  /* This page chained FIVE round trips — funds, reservations, items, the user
     roster (a Netlify function, which can cold-start for seconds), then its own
     data. None of them depends on another; they all go out at once now. */
  const roster=(roleIn('admin')&&!window._PLUSERS&&typeof adminUsers==='function')
    ?adminUsers('list').then(out=>{
        let arr=(out&&(out.users||out.list))||out||[];
        if(!Array.isArray(arr))arr=[];
        // product specialists never approve spending — keep them out of the picker
        window._PLUSERS=arr.filter(u=>u&&u.id&&u.role!=='sales')
          .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
      }).catch(()=>{window._PLUSERS=[];})
    :Promise.resolve();
  let rows=[],lines=[];
  try{
    const [a,b,at]=(await Promise.all([
      Promise.all([
        SB.from('pullouts').select('*').order('id',{ascending:false}).limit(300),
        SB.from('pullout_lines').select('*').limit(3000),
        SB.from('attachments').select('*').eq('rec_type','pullout')
      ]),
      loadFunds(true),
      loadReservations().catch(()=>{}),           // the Available column needs this
      roleIn('admin','finance')?loadItems().catch(()=>{}):null, // spend panel costs
      roster
    ]))[0];
    if(a.error)throw a.error;if(b.error)throw b.error;
    rows=a.data||[];lines=b.data||[];
    window._PLATT={};
    for(const f of ((at&&at.data)||[]))(window._PLATT[f.rec_id]||(window._PLATT[f.rec_id]=[])).push(f);
  }catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the pull-out SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  const byPl={};lines.forEach(l=>(byPl[l.pullout_id]||(byPl[l.pullout_id]=[])).push(l));
  window._PLROWS=rows;window._PLLINES=byPl; // the QBO export reads what is on screen
  plPaint(rows,byPl);
}
function plPaint(rows,byPl){
  const canW=canWarehouse();
  const me=(SBUSER&&SBUSER.id)||'';
  const mine=rows.filter(r=>r.requester_id===me);
  const toDecide=rows.filter(r=>r.status==='pending'&&canDecidePullout(r));
  const toRelease=rows.filter(r=>r.status==='approved');
  const unrouted=(FUNDS||[]).filter(f=>f.active&&!f.approver_id).length;
  const pill=st=>st==='pending'?'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">waiting for approval</span>'
    :st==='approved'?'<span class="pill pbl">approved · awaiting release</span>'
    :st==='released'?'<span class="pill pgr">released</span>'
    :st==='rejected'?'<span class="pill prd">rejected</span>':'<span class="pill" style="background:var(--sf2);color:var(--tx3)">cancelled</span>';
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px"';
  const skuOpts=(DATA||[]).map(p=>'<option value="'+esc(p.sku)+'">'+esc(p.name)+'</option>').join('');
  const fundOpts=(FUNDS||[]).filter(f=>f.active).map(f=>'<option value="'+esc(f.class)+'">'+esc(f.class)+(f.approver_name?' — '+esc(f.approver_name):' — no approver set')+'</option>').join('');
  window._plCart=window._plCart||[];
  $('content').innerHTML=
    '<div class="panel" style="padding:10px 14px;margin-bottom:12px;font-size:11.5px;color:var(--tx2)">'+
      '<b style="color:var(--tx)">Parallel run.</b> The Google pull-out form still works while everyone moves across \u2014 but a request filed there is invisible here, so it will not reserve stock, route to the fund source, or reach the warehouse queue. File it here instead whenever you can.'+
    '</div>'+
    (function(){ // you may hold a read-only role everywhere else and still own this decision
      const me=(SBUSER&&SBUSER.id)||'';
      const mineClasses=(FUNDS||[]).filter(f=>f.approver_id===me||f.backup_id===me);
      if(!mineClasses.length)return '';
      const waiting=rows.filter(r=>r.status==='pending'&&mineClasses.some(f=>f.class===r.fund_class));
      return '<div class="panel" style="padding:12px 14px;margin-bottom:12px;border-left:3px solid '+(waiting.length?'var(--am)':'var(--gr)')+'">'+
        '<b style="font-size:13px">You approve '+mineClasses.map(f=>esc(f.class)+(f.backup_id===me&&f.approver_id!==me?' (backup)':'')).join(' · ')+'</b>'+
        '<div style="font-size:12px;color:var(--tx2);margin-top:4px">'+
        (waiting.length?'<b style="color:var(--am)">'+waiting.length+' request(s) are waiting on you</b> — '+waiting.map(r=>PL_NO(r.id)).join(', ')+'. Nothing leaves the warehouse until you decide.'
                       :'Nothing waiting on you right now.')+
        ' Your approval rights come from the fund-source list, not from your access level — you can decide these even though other pages are read-only for you.</div></div>';
    })()+
    (unrouted&&roleIn('admin')?'<div class="panel" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--am);font-size:12px"><b>'+unrouted+' fund source(s) have no approver yet</b> — requests against them cannot be routed. Set them in the fund-source table below.</div>':'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met '+(toDecide.length?'am':'gr')+'"><div class="met-lbl">Waiting for YOUR approval</div><div class="met-val">'+toDecide.length+'</div><div class="met-sub">'+(toDecide.length?'they cannot move until you decide':'nothing on your desk')+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Approved, not yet released</div><div class="met-val">'+toRelease.length+'</div><div class="met-sub">units are reserved out of ATP</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">My requests</div><div class="met-val">'+mine.length+'</div><div class="met-sub">'+mine.filter(r=>r.status==='pending').length+' still pending</div><div class="met-bar"></div></div>'+
    '</div>'+
    // ── the request form (anyone signed in) ──
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px">'+
      '<div class="phd" style="margin-bottom:10px">New pull-out request</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'+
      '<input id="pl-sku" list="pl-skulist" placeholder="SKU or product" '+inp+' style="flex:1;min-width:170px;'+inp.slice(7,-1)+'"><datalist id="pl-skulist">'+skuOpts+'</datalist>'+
      '<input id="pl-qty" type="number" min="1" placeholder="Qty" '+inp+' style="width:90px;'+inp.slice(7,-1)+'">'+
      '<input id="pl-uom" placeholder="Unit (pc, box…)" '+inp+' style="width:130px;'+inp.slice(7,-1)+'">'+
      '<button onclick="plAddLine()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer">+ Add item</button>'+
      '</div>'+
      (window._plCart.length?'<div class="tscroll" style="margin-bottom:10px"><table><thead><tr><th>SKU</th><th>Product</th><th class="r">Qty</th><th>Unit</th><th class="r">On hand</th><th class="r">Available</th><th></th></tr></thead><tbody>'+
        window._plCart.map((l,i)=>{
          const p=(DATA||[]).find(x=>x.sku===l.sku);
          const on=p?(stk(p)||0):0;const av=on-(typeof reservedQty==='function'?reservedQty(l.sku):0);
          return '<tr><td class="mu">'+esc(l.sku)+'</td><td style="font-weight:600">'+esc(l.name)+'</td><td class="r">'+l.qty+'</td><td class="mu">'+esc(l.uom||'pc')+'</td>'+
          '<td class="r mu">'+on+'</td><td class="r" style="font-weight:700;color:'+(av<l.qty?'var(--rd)':'var(--gr)')+'">'+av+'</td>'+
          '<td><a href="#" onclick="plDropLine('+i+');return false" style="color:var(--rd);font-size:11.5px">remove</a></td></tr>';}).join('')+
        '</tbody></table></div>':'<div class="mu" style="font-size:12px;margin-bottom:10px">No items yet — add at least one.</div>')+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      '<select id="pl-fund" '+inp+' style="min-width:260px;'+inp.slice(7,-1)+'"><option value="">Fund source (class)…</option>'+fundOpts+'</select>'+
      '<select id="pl-reason" '+inp+'><option value="">Reason…</option>'+PL_REASONS.map(r=>'<option>'+esc(r)+'</option>').join('')+'</select>'+
      '<select id="pl-line" '+inp+'><option value="">Product line…</option>'+PL_LINES_OPT.map(r=>'<option>'+esc(r)+'</option>').join('')+'</select>'+
      '<input id="pl-needed" type="date" title="Date needed" '+inp+'>'+
      '<input id="pl-purpose" placeholder="What is it for? (event, KOL, account…)" '+inp+' style="flex:1;min-width:200px;'+inp.slice(7,-1)+'">'+
      '<button onclick="plSubmit()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:12.5px;font-weight:700;cursor:pointer">Submit request</button>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--tx3);margin-top:8px">Submitting reserves the units immediately — they drop out of available-to-promise so nobody sells them while your request is pending. The fund source you pick is notified; nothing leaves the warehouse until they approve and the warehouse releases it.</div>'+
    '</div>'+
    // ── the register ──
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>No.</th><th>Requested</th><th>Needed</th><th>By</th><th>Fund source</th><th>Reason</th><th>Items</th><th>Status</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>{
      const ls=byPl[r.id]||[];
      const f=fundOf(r.fund_class);
      const isMine=r.requester_id===me;
      const acts=[];
      if(r.status==='pending'&&canDecidePullout(r))acts.push('<a href="#" onclick="plDecide('+r.id+',\'approved\');return false" style="color:var(--gr);font-weight:700">approve ✓</a>','<a href="#" onclick="plDecide('+r.id+',\'rejected\');return false" style="color:var(--rd)">reject</a>');
      if(r.status==='pending'&&isMine)acts.push('<a href="#" onclick="plCancel('+r.id+');return false" style="color:var(--tx3)">cancel</a>');
      if(r.status==='approved'&&canW)acts.push('<a href="#" onclick="plRelease('+r.id+');return false" style="color:var(--ac);font-weight:700">release stock →</a>');
      if(r.status==='released'&&!r.booked_ref&&(canW||roleIn('admin','sales','manager')))acts.push('<a href="#" onclick="plBooked('+r.id+');return false" style="color:var(--ac)">mark booked</a>');
      const _d=delLink('pullouts',r.id);if(_d)acts.push(_d.replace(/^ · /,''));
      return '<tr'+(isMine?' style="background:var(--sf2)"':'')+'><td style="font-weight:700">'+PL_NO(r.id)+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc(String(r.date_requested||'').slice(0,10))+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc(String(r.date_needed||'—').slice(0,10))+'</td>'+
      '<td class="mu" style="font-size:11.5px;max-width:130px;overflow:hidden;text-overflow:ellipsis">'+esc(r.requester_name||r.requester_email||'—')+'</td>'+
      '<td style="font-size:11.5px">'+esc(r.fund_class)+(f&&f.approver_name?'<div class="mu" style="font-size:10px">'+esc(f.approver_name)+'</div>':'<div style="font-size:10px;color:var(--rd)">no approver set</div>')+'</td>'+
      '<td class="mu" style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis">'+esc(r.reason||'—')+(r.purpose?'<div style="font-size:10px">'+esc(r.purpose)+'</div>':'')+'</td>'+
      '<td class="mu" style="font-size:11px;max-width:230px">'+(ls.length?ls.map(l=>esc(l.sku)+' ×'+l.qty+(l.released_qty?' <span style="color:var(--gr)">('+l.released_qty+' out)</span>':'')).join('<br>'):'—')+
        '<div style="margin-top:5px">'+(typeof attBlock==='function'?attBlock('pullout',r.id,((window._PLATT||{})[String(r.id)]||[]),(isMine&&r.status==='pending')||canW||roleIn('admin','finance')):'')+'</div></td>'+
      '<td>'+pill(r.status)+(r.booked_ref?'<div class="mu" style="font-size:10px">booked '+esc(r.booked_ref)+'</div>':'')+(r.decision_note?'<div class="mu" style="font-size:10px">'+esc(r.decision_note)+'</div>':'')+'</td>'+
      '<td style="white-space:nowrap;font-size:11.5px">'+acts.join(' · ')+'</td></tr>';
    }).join(''):'<tr><td colspan="9" class="mu">No pull-out requests yet.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Requesting reserves · the fund source approves · the warehouse releases (that is when stock actually moves, FEFO batch-stamped against '+esc(PL_NO(0).replace('1000','n'))+') · during the parallel run the specialist still books it in Shopify and ticks “mark booked” here. Pull-outs are internal issues — they never count as sales.</span></div></div>'+
    // ── fund-source spend: what finance needs for the class charge ──
    ((roleIn('admin','finance'))?(function(){
      const ym=window._plYm||new Date().toISOString().slice(0,7);
      const inRange=r=>String(r.date_requested||'').slice(0,7)===ym;
      const yms=[];{const d=new Date();for(let i=0;i<13;i++){yms.push(d.toISOString().slice(0,7));d.setMonth(d.getMonth()-1);}}
      const costOf=sku=>{const it=(ITEMS||{})[sku];return (it&&it.cost!=null)?it.cost:null;};
      const agg={};let unknownCost=0;
      for(const r of rows){
        if(!inRange(r)||r.status==='rejected'||r.status==='cancelled')continue;
        const a=(agg[r.fund_class]=agg[r.fund_class]||{n:0,units:0,value:0,released:0,pending:0});
        a.n++;if(r.status==='released')a.released++;else a.pending++;
        for(const l of (byPl[r.id]||[])){
          a.units+=l.qty||0;
          const c=costOf(l.sku);
          if(c==null)unknownCost++;else a.value+=c*(l.qty||0);
        }
      }
      const list=Object.entries(agg).sort((a,b)=>b[1].value-a[1].value);
      const tot=list.reduce((x,[,a])=>({units:x.units+a.units,value:x.value+a.value,n:x.n+a.n}),{units:0,value:0,n:0});
      return '<div class="panel" style="padding:14px 16px;margin-top:16px">'+
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'+
        '<div class="phd" style="margin:0">Fund-source spend</div>'+
        '<select onchange="window._plYm=this.value;renderPullouts()" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:6px 9px;font-size:12px">'+
          yms.map(m=>'<option'+(m===ym?' selected':'')+'>'+m+'</option>').join('')+'</select>'+
        '<span style="flex:1"></span>'+
        '<button onclick="plSpendCSV()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer">Export for QBO</button></div>'+
        (list.length?'<div class="tscroll"><table><thead><tr><th>Class</th><th class="r">Requests</th><th class="r">Units</th><th class="r">At cost</th><th class="r">Released</th><th class="r">Still open</th></tr></thead><tbody>'+
          list.map(([cls,a])=>'<tr><td style="font-weight:600">'+esc(cls)+'</td><td class="r">'+a.n+'</td><td class="r">'+a.units.toLocaleString()+'</td>'+
            '<td class="r" style="font-weight:700">'+fmtPeso(a.value)+'</td><td class="r mu">'+a.released+'</td><td class="r" style="color:'+(a.pending?'var(--am)':'var(--tx3)')+'">'+(a.pending||'—')+'</td></tr>').join('')+
          '<tr style="border-top:2px solid var(--bd)"><td style="font-weight:700">TOTAL</td><td class="r">'+tot.n+'</td><td class="r">'+tot.units.toLocaleString()+'</td><td class="r" style="font-weight:800">'+fmtPeso(tot.value)+'</td><td colspan="2"></td></tr>'+
          '</tbody></table></div>':'<div class="mu" style="font-size:12px">Nothing in '+esc(ym)+'.</div>')+
        '<div style="font-size:11px;color:var(--tx3);margin-top:8px">Rejected and cancelled requests are excluded. Valued at <b>item-master cost</b> \u2014 the basis QBO wants for a class charge, not list price'+
        (unknownCost?' \u00b7 <span style="color:var(--am)">'+unknownCost+' line(s) have no cost on the item master, so they count as \u20b10</span>':'')+
        '. Released rows have left the warehouse; still-open ones are reserved but not yet handed over.</div></div>';
    })():'')+
    // ── fund sources (admin) ──
    (roleIn('admin')?'<div class="panel" style="padding:14px 16px;margin-top:16px"><div class="phd" style="margin-bottom:8px">Fund sources — who approves each class</div>'+
      '<div class="tscroll"><table><thead><tr><th>Class (QBO)</th><th>Approver</th><th>Backup (optional)</th><th>Active</th><th></th></tr></thead><tbody>'+
      (function(){
        const us=window._PLUSERS||[];
        const sel=(f,isB)=>{
          const cur=isB?(f.backup_id||''):(f.approver_id||'');
          const cls=jsq(f.class);
          return '<select onchange="plSetApprover(\''+cls+'\','+(isB?'true':'false')+',this.value)" '+
            'style="background:var(--bg);color:var(--tx);border:1px solid '+((!isB&&!cur)?'var(--rd)':'var(--bd)')+';border-radius:8px;padding:6px 8px;font-size:12px;max-width:210px">'+
            '<option value="">'+(isB?'— no backup —':'— not set —')+'</option>'+
            us.map(u=>'<option value="'+esc(u.id)+'"'+(u.id===cur?' selected':'')+'>'+esc(u.name||u.email||'(no name)')+' · '+esc(String(u.role||'').replace('_',' '))+'</option>').join('')+
            '</select>';
        };
        return (FUNDS||[]).map(f=>'<tr><td style="font-weight:600">'+esc(f.class)+'</td>'+
          '<td>'+(us.length?sel(f,false):(f.approver_name?esc(f.approver_name):'<span style="color:var(--rd)">not set</span>'))+'</td>'+
          '<td>'+(us.length?sel(f,true):(f.backup_name?esc(f.backup_name):'—'))+'</td>'+
          '<td>'+(f.active?'<span class="pill pgr">yes</span>':'<span class="pill" style="background:var(--sf2);color:var(--tx3)">no</span>')+'</td>'+
          '<td style="font-size:11.5px;white-space:nowrap"><a href="#" onclick="plToggleFund(\''+jsq(f.class)+'\','+(f.active?'false':'true')+');return false" style="color:var(--tx3)">'+(f.active?'deactivate':'activate')+'</a></td></tr>').join('');
      })()+
      '</tbody></table></div><div style="font-size:11px;color:var(--tx3);margin-top:8px">Pick from the dropdown — changes save immediately. An approver can be anyone with an HQ login, including someone whose role is read-only everywhere else; approval rights come from this table, not from their access level. The super admin can decide any class as a fallback.</div></div>':'');
  plRestore();
}
function plSpendCSV(){
  if(!roleIn('admin','finance'))return;
  const ym=window._plYm||new Date().toISOString().slice(0,7);
  const rows=window._PLROWS||[],byPl=window._PLLINES||{};
  const costOf=sku=>{const it=(ITEMS||{})[sku];return (it&&it.cost!=null)?it.cost:null;};
  const out=[];
  for(const r of rows){
    if(String(r.date_requested||'').slice(0,7)!==ym)continue;
    if(r.status==='rejected'||r.status==='cancelled')continue;
    for(const l of (byPl[r.id]||[])){
      const c=costOf(l.sku);
      out.push([PL_NO(r.id),r.date_requested||'',r.status,r.fund_class,r.reason||'',r.product_line||'',
        r.requester_name||'',r.approver_name||'',l.sku,l.name||'',l.qty,l.uom||'',
        c==null?'':c,c==null?'':c*(l.qty||0),r.released_at?String(r.released_at).slice(0,10):'',r.booked_ref||'',r.purpose||'']);
    }
  }
  if(!out.length)return alert('Nothing to export for '+ym+'.');
  const h=['Pull-out no.','Date requested','Status','Fund source (class)','Reason','Product line','Requested by','Approved by','SKU','Product','Qty','Unit','Unit cost','Value at cost','Released','Booked ref','Purpose'];
  const csv=[h,...out].map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='healthspan-pullouts-'+ym+'.csv';a.click();
  audit('export.pullouts',{month:ym,lines:out.length});
}
function plKeep(){ // remember the half-filled form across a repaint
  const g=id=>($(id)&&$(id).value)||'';
  window._plForm={fund:g('pl-fund'),reason:g('pl-reason'),line:g('pl-line'),needed:g('pl-needed'),purpose:g('pl-purpose'),uom:g('pl-uom')};
}
function plRestore(){
  const f=window._plForm;if(!f)return;
  const set=(id,v)=>{if($(id)&&v)$(id).value=v;};
  set('pl-fund',f.fund);set('pl-reason',f.reason);set('pl-line',f.line);set('pl-needed',f.needed);set('pl-purpose',f.purpose);set('pl-uom',f.uom);
}
function plAddLine(){
  plKeep();
  const raw=(($('pl-sku')||{}).value||'').trim();
  const qty=parseInt((($('pl-qty')||{}).value||'0'),10);
  if(!raw||!qty||qty<1)return alert('Pick a product and a quantity.');
  const p=(DATA||[]).find(x=>x.sku.toLowerCase()===raw.toLowerCase())||(DATA||[]).find(x=>x.name.toLowerCase()===raw.toLowerCase())||(DATA||[]).find(x=>x.name.toLowerCase().startsWith(raw.toLowerCase()));
  if(!p)return alert('Unknown product: '+raw);
  const uom=(($('pl-uom')||{}).value||'').trim()||'pc';
  window._plCart=window._plCart||[];
  const ex=window._plCart.find(l=>l.sku===p.sku);
  if(ex)ex.qty+=qty;else window._plCart.push({sku:p.sku,name:p.name,qty,uom});
  ['pl-sku','pl-qty'].forEach(id=>{if($(id))$(id).value='';});
  renderPullouts(true); // local change only — repaint, don't reload
}
function plDropLine(i){plKeep();window._plCart.splice(i,1);renderPullouts(true);}
async function plSubmit(){
  const cart=window._plCart||[];
  if(!cart.length)return alert('Add at least one item.');
  const cls=(($('pl-fund')||{}).value||'');
  const reason=(($('pl-reason')||{}).value||'');
  const line=(($('pl-line')||{}).value||'');
  const needed=(($('pl-needed')||{}).value||'');
  const purpose=(($('pl-purpose')||{}).value||'').trim();
  if(!cls)return alert('Pick the fund source — that decides who approves it.');
  if(!reason)return alert('Pick a reason for the pull-out.');
  const f=fundOf(cls);
  if(f&&!f.approver_id&&!confirm(cls+' has no approver set yet, so nobody will be notified. Submit anyway and ask an admin to set one?'))return;
  // honest warning, not a block: internal issues can legitimately go negative-ish
  const short=cart.filter(l=>{const p=(DATA||[]).find(x=>x.sku===l.sku);const on=p?(stk(p)||0):0;return on-(typeof reservedQty==='function'?reservedQty(l.sku):0)<l.qty;});
  if(short.length&&!confirm('Not enough available to promise for: '+short.map(l=>l.sku).join(', ')+'.\n\nSubmit anyway? The warehouse will see the shortfall when they release.'))return;
  try{
    const {data,error}=await SB.from('pullouts').insert({
      requester_id:SBUSER.id,requester_name:(SBPROFILE&&SBPROFILE.name)||'',requester_email:(SBUSER&&SBUSER.email)||'',
      date_needed:needed||null,product_line:line||null,reason,fund_class:cls,purpose:purpose||null,status:'pending'
    }).select().single();
    if(error)throw error;
    const {error:eL}=await SB.from('pullout_lines').insert(cart.map(l=>({pullout_id:data.id,sku:l.sku,name:l.name,qty:l.qty,uom:l.uom})));
    if(eL){ // don't leave a lineless request sitting in everyone's queue
      try{await SB.from('pullouts').update({status:'cancelled',decision_note:'auto-cancelled: the items failed to save'}).eq('id',data.id);}catch(e2){}
      throw new Error('The items could not be saved, so the request was cancelled: '+(eL.message||eL));
    }
    audit('pullout.request',{no:PL_NO(data.id),fund:cls,reason,items:cart.length,units:cart.reduce((a,l)=>a+l.qty,0)});
    // notify ONLY the people who must act: the fund source (and their backup)
    try{
      const body=(SBPROFILE&&SBPROFILE.name?SBPROFILE.name:'Someone')+' requested '+cart.reduce((a,l)=>a+l.qty,0)+' unit(s) — '+reason+(needed?' · needed '+needed:'');
      if(f&&f.approver_id)notify({user_id:f.approver_id},'approval','Pull-out needs your approval: '+PL_NO(data.id),body,'#/v/pullouts');
      if(f&&f.backup_id)notify({user_id:f.backup_id},'approval','Pull-out needs approval (backup): '+PL_NO(data.id),body,'#/v/pullouts');
    }catch(e){}
    window._plCart=[];window._plForm=null; // clean slate after a successful submit
    await loadReservations(true); // the new reservation applies immediately
    renderPullouts();
    alert(PL_NO(data.id)+' submitted.'+(f&&f.approver_name?' '+f.approver_name+' has been notified.':''));
  }catch(e){alert('Could not submit: '+(e.message||e));}
}
async function plDecide(id,decision){
  const {data:r}=await SB.from('pullouts').select('*').eq('id',id).maybeSingle();
  if(!r||r.status!=='pending')return renderPullouts();
  if(!canDecidePullout(r))return alert('Only the fund source for '+r.fund_class+' can decide this one.');
  const note=(prompt(decision==='approved'
    ?'Approve '+PL_NO(id)+' — note for the record (optional):'
    :'Reject '+PL_NO(id)+' — why? (this goes back to the requester)','')||'').trim();
  if(decision==='rejected'&&!note&&!confirm('Reject with no reason given?'))return;
  try{
    const {error}=await SB.from('pullouts').update({status:decision,approver_name:(SBPROFILE&&SBPROFILE.name)||'',decided_at:new Date().toISOString(),decision_note:note||null}).eq('id',id);
    if(error)throw error;
    audit('pullout.'+decision,{no:PL_NO(id),fund:r.fund_class,note});
    try{
      if(decision==='approved'){
        // the two people who now have to act: finance (the charge) and the warehouse (the goods)
        const body=r.fund_class+' · '+(r.reason||'')+' · requested by '+(r.requester_name||'')+(r.date_needed?' · needed '+r.date_needed:'');
        notify({roles:['finance']},'approval','Pull-out approved: '+PL_NO(id),body+' — for the class charge','#/v/pullouts');
        notify({roles:['supply_chain']},'order','Pull-out to release: '+PL_NO(id),body+' — release the stock when ready','#/v/pullouts');
      }
      if(r.requester_id)notify({user_id:r.requester_id},'decision','Pull-out '+(decision==='approved'?'APPROVED':'REJECTED')+': '+PL_NO(id),
        decision==='approved'?'The warehouse will release it'+(r.date_needed?' before '+r.date_needed:'')+'.':(note||'No reason given.'),'#/v/pullouts');
    }catch(e){}
    if(decision==='rejected')await loadReservations(true); // reservation freed
    renderPullouts();
  }catch(e){alert('Could not save the decision: '+(e.message||e));}
}
async function plCancel(id){
  if(!confirm('Cancel '+PL_NO(id)+'? The reserved units are released back to available stock.'))return;
  try{
    const {error}=await SB.from('pullouts').update({status:'cancelled'}).eq('id',id);
    if(error)throw error;
    audit('pullout.cancel',{no:PL_NO(id)});
    await loadReservations(true);renderPullouts();
  }catch(e){alert('Could not cancel: '+(e.message||e));}
}
async function plRelease(id){
  if(!canWarehouse())return alert('Releasing stock is the warehouse team and admin.');
  const {data:r}=await SB.from('pullouts').select('*').eq('id',id).maybeSingle();
  if(!r||r.status!=='approved')return renderPullouts();
  const {data:ls}=await SB.from('pullout_lines').select('*').eq('pullout_id',id);
  if(!ls||!ls.length)return alert('No lines on this request.');
  if(!confirm('Release '+PL_NO(id)+' — '+ls.reduce((a,l)=>a+(l.qty-(l.released_qty||0)),0)+' unit(s)?\n\nThis writes the stock ledger now (earliest expiry first) and ends the reservation.'))return;
  try{
    // ORDER MATTERS: build every movement, write the ledger, THEN stamp the lines
    // and the header. Stamping first meant a failed ledger write left lines marked
    // released with no stock movement — and the retry saw nothing left to release
    // and quietly marked the whole thing done.
    const moves=[],stamps=[];
    for(const l of ls){
      const left=(l.qty||0)-(l.released_qty||0);
      if(left<=0)continue;
      // fefoAlloc returns [{batch,take}] — earliest expiry first, same as an order pick
      const picks=(typeof fefoAlloc==='function')?fefoAlloc(l.sku,left):[{batch:null,take:left}];
      for(const pk of picks)moves.push({sku:l.sku,qty:-Math.abs(pk.take),kind:'pick',ref:PL_NO(id),batch:pk.batch||null,note:'pull-out · '+(r.fund_class||'')});
      stamps.push({id:l.id,qty:l.qty,batch:picks.map(x=>x.batch).filter(Boolean).join(', ')||null});
    }
    if(!moves.length)return alert('Every line on '+PL_NO(id)+' is already released — nothing left to hand over.');
    if(typeof ledgerAdd==='function')await ledgerAdd(moves); // throws → nothing below runs, retry stays clean
    for(const st of stamps)await SB.from('pullout_lines').update({released_qty:st.qty,batch:st.batch}).eq('id',st.id);
    const {error}=await SB.from('pullouts').update({status:'released',released_at:new Date().toISOString(),released_by:(SBPROFILE&&SBPROFILE.name)||''}).eq('id',id);
    if(error)throw error;
    audit('pullout.release',{no:PL_NO(id),units:moves.reduce((a,m)=>a+Math.abs(m.qty),0),fund:r.fund_class});
    try{
      if(r.requester_id)notify({user_id:r.requester_id},'order','Pull-out released: '+PL_NO(id),'The stock is out of the warehouse — collect or confirm delivery.','#/v/pullouts');
      notify({roles:['finance']},'auto','Pull-out released: '+PL_NO(id),r.fund_class+' — book it against the class; the specialist still records it in Shopify during the parallel run','#/v/pullouts');
    }catch(e){}
    await loadReservations(true);renderPullouts();
  }catch(e){alert('Could not release: '+(e.message||e));}
}
async function plBooked(id){
  const ref=(prompt('Reference it was booked under (Shopify order no. / HS number):','')||'').trim();
  if(!ref)return;
  try{
    const {error}=await SB.from('pullouts').update({booked_ref:ref}).eq('id',id);
    if(error)throw error;
    audit('pullout.booked',{no:PL_NO(id),ref});renderPullouts();
  }catch(e){alert('Could not save: '+(e.message||e));}
}
async function plSetApprover(cls,isBackup,userId){
  if(!roleIn('admin'))return alert('Admins set fund-source approvers.');
  const u=(window._PLUSERS||[]).find(x=>x.id===userId)||null;
  try{
    const patch=isBackup?{backup_id:u?u.id:null,backup_name:u?(u.name||u.email||''):null}
                        :{approver_id:u?u.id:null,approver_name:u?(u.name||u.email||''):null};
    patch.updated_by=(SBUSER&&SBUSER.id)||null;patch.updated_at=new Date().toISOString();
    const {error}=await SB.from('fund_sources').update(patch).eq('class',cls);
    if(error)throw error;
    audit('fundsource.set',{class:cls,who:u?(u.name||u.email):'(cleared)',backup:!!isBackup});
    await loadFunds(true);renderPullouts();
  }catch(e){alert('Could not save: '+(e.message||e));await loadFunds(true);renderPullouts();}
}
async function plToggleFund(cls,active){
  if(!roleIn('admin'))return;
  try{
    const {error}=await SB.from('fund_sources').update({active:!!active,updated_at:new Date().toISOString()}).eq('class',cls);
    if(error)throw error;
    audit('fundsource.'+(active?'activate':'deactivate'),{class:cls});
    await loadFunds(true);renderPullouts();
  }catch(e){alert('Could not save: '+(e.message||e));}
}

/* ══════════════════ APP-WIDE TABLE SORTING ══════════════════
   Every table in HQ is built as an innerHTML string by its own render
   function, so wiring sort state into 87 of them would be 87 chances to get
   it wrong. Instead this sorts the RENDERED DOM: click any column header,
   the rows reorder in place; click again to reverse.

   What it deliberately leaves alone:
   · headers that already have their own onclick (All SKUs has real,
     data-level sorting that survives paging — that one wins)
   · rows that are not data: section headings, TOTAL lines and empty-state
     rows all use a colspan, so they stay exactly where the render put them
     and the data rows sort around them
   · anything marked data-nosort

   Because it re-appends the existing <tr> nodes rather than rebuilding them,
   every onclick, drawer link and inline handler inside a row keeps working.
   A re-render (filter, refresh, action) resets to the render's own order,
   which is the honest behaviour: this is a way to look at what is on screen,
   not a saved preference. */
(function(){
  const NUM=/^-?[\d,.]+$/;
  function keyOf(td){
    const raw=(td?td.textContent:'').replace(/\s+/g,' ').trim();
    if(!raw||raw==='—'||raw==='–'||raw==='-')return {empty:true,n:0,s:''};
    // money, percentages, counts, and short unit suffixes: 45d · 12u · 98% · ₱1,234
    let t=raw.replace(/[₱, ]/g,'').replace(/[−–—]/g,'-');
    const m=t.match(/^(-?[\d.]+)\s*(?:%|[a-z]{1,3})?$/i);
    if(m&&NUM.test(m[1].replace(/\./g,'.'))){
      const n=parseFloat(m[1]);
      if(!isNaN(n))return {n,s:raw.toLowerCase()};
    }
    // ISO dates sort correctly as text; MM/YYYY expiry does not
    const exp=raw.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if(exp)return {n:(+exp[2])*100+(+exp[1]),s:raw.toLowerCase()};
    const iso=raw.match(/^\d{4}-\d{2}-\d{2}/);
    if(iso)return {n:new Date(raw.slice(0,10)).getTime()||0,s:raw.toLowerCase()};
    return {n:null,s:raw.toLowerCase()};
  }
  function sortTable(table,idx,dir){
    const body=table.tBodies&&table.tBodies[0];if(!body)return;
    const head=table.tHead&&table.tHead.rows[table.tHead.rows.length-1];if(!head)return;
    const width=head.cells.length;
    const rows=Array.prototype.slice.call(body.rows);
    // data rows only: full width, no colspan (that is how this app draws
    // section headings, totals and "nothing here yet" rows)
    const pos=[],data=[];
    rows.forEach((r,i)=>{
      if(r.cells.length!==width)return;
      for(let c=0;c<r.cells.length;c++)if(r.cells[c].colSpan>1)return;
      if(r.hasAttribute('data-nosort'))return;
      pos.push(i);data.push(r);
    });
    if(data.length<2)return;
    const keys=new Map();
    data.forEach(r=>keys.set(r,keyOf(r.cells[idx])));
    data.sort((a,b)=>{
      const ka=keys.get(a),kb=keys.get(b);
      if(ka.empty!==kb.empty)return ka.empty?1:-1;      // blanks last, both ways
      let v;
      if(ka.n!==null&&kb.n!==null)v=ka.n-kb.n;
      else v=ka.s.localeCompare(kb.s,undefined,{numeric:true,sensitivity:'base'});
      return v*dir;
    });
    // put the sorted rows back into the slots the data rows occupied, so
    // headings and totals keep their place
    const out=rows.slice();
    pos.forEach((p,k)=>{out[p]=data[k];});
    const frag=document.createDocumentFragment();
    out.forEach(r=>frag.appendChild(r));
    body.appendChild(frag);
  }
  document.addEventListener('click',function(e){
    const th=e.target&&e.target.closest?e.target.closest('th'):null;
    if(!th)return;
    if(th.hasAttribute('onclick')||th.hasAttribute('data-nosort'))return; // its own sort wins
    const table=th.closest('table');if(!table||!table.tHead)return;
    const head=table.tHead.rows[table.tHead.rows.length-1];
    if(th.parentNode!==head)return;
    for(let c=0;c<head.cells.length;c++)if(head.cells[c].colSpan>1)return; // merged header: skip
    const idx=th.cellIndex;
    const dir=(table._sortIdx===idx&&table._sortDir===1)?-1:1;
    sortTable(table,idx,dir);
    table._sortIdx=idx;table._sortDir=dir;
    Array.prototype.forEach.call(head.cells,c=>{
      c.classList.remove('sorted');
      const old=c.querySelector('.thsort');if(old)old.remove();
    });
    th.classList.add('sorted');
    const arrow=document.createElement('span');
    arrow.className='thsort';arrow.textContent=dir===1?' ▲':' ▼';
    th.appendChild(arrow);
  },true);
})();

/* super-admin delete link, for use inside any row's action cell */
function reRender(){ // repaint the view we are on, keeping the sidebar highlight
  const el=document.querySelector('.ni.active');
  try{showView(currentView,el);}catch(e){}
}
function delLink(table,id){
  if(typeof isSuper!=='function'||!isSuper())return '';
  return ' · <a href="#" onclick="archiveRecord(\''+table+'\',\''+String(id).replace(/'/g,'')+'\').then(function(ok){if(ok)reRender();});return false" style="color:var(--rd)" title="Archive this record (super admin)">delete</a>';
}
/* ══════════════════ SUPER-ADMIN ARCHIVE & DELETE ══════════════════
   The super admin can delete anything — but nothing evaporates on a click.
   Deleting asks you to TYPE the record's number (no muscle-memory accidents),
   copies the row and its children into the archive bin as JSON, then removes
   the original. The Archive page can put it back or purge it for good, and
   purging asks again. Every step lands in the Activity log, and the bin is in
   the nightly backup — so even a purge is recoverable from last night. */
const ARCH_KINDS={ // table → how to describe it, and which children travel with it
  pullouts:{label:'Pull-out request',no:r=>PL_NO(r.id),sum:r=>r.fund_class+' · '+(r.reason||'')+' · '+(r.requester_name||''),children:[{table:'pullout_lines',fk:'pullout_id'}]},
  quotes:{label:'Quotation',no:r=>qtLabel(r),sum:r=>r.account+' · '+fmtPeso(r.total||0),children:[{table:'quote_lines',fk:'quote_id'}]},
  pos:{label:'Purchase order',no:r=>PO_NO(r.id),sum:r=>r.supplier+' · '+r.status,children:[{table:'po_lines',fk:'po_id'}]},
  transfers:{label:'Transfer order',no:r=>TR_NO(r.id),sum:r=>(r.to_branch||'')+' · '+r.status,children:[{table:'transfer_lines',fk:'transfer_id'}]},
  returns:{label:'Credit memo',no:r=>docNo('cm',r.id),sum:r=>r.account+' · '+fmtPeso(r.amount||0),children:[]},
  pdcs:{label:'Cheque (PDC)',no:r=>'PDC-'+r.id,sum:r=>r.account+' · '+fmtPeso(r.amount||0)+' · matures '+(r.maturity||''),children:[]},
  promos:{label:'Promotion',no:r=>'PROMO-'+r.id,sum:r=>r.name||'',children:[]},
  campaigns:{label:'Campaign',no:r=>'CAMP-'+r.id,sum:r=>r.name||'',children:[]},
  complaints:{label:'Complaint',no:r=>CX_NO(r.id),sum:r=>(r.account||'')+' · '+(r.sku||''),children:[]},
  quarantine:{label:'Quarantine lot',no:r=>'Q-'+r.id,sum:r=>(r.name||r.sku)+' · '+r.qty+'u',children:[]},
  shortdated:{label:'Short-dated plan',no:r=>'SD-'+r.id,sum:r=>(r.name||r.sku)+' · '+(r.plan||''),children:[]},
  visits:{label:'Visit',no:r=>'VISIT-'+r.id,sum:r=>(r.account||'')+' · '+(r.date||''),children:[]},
  opportunities:{label:'Opportunity',no:r=>'OPP-'+r.id,sum:r=>(r.account||'')+' · '+fmtPeso(r.est_value||0),children:[]},
  approvals:{label:'Approval request',no:r=>'APR-'+r.id,sum:r=>(r.order_label||'')+' · '+(r.status||''),children:[]},
  fin_requests:{label:'Finance request',no:r=>FIN_NO(r.kind,r.num),sum:r=>(FIN_SPEC[r.kind]?FIN_SPEC[r.kind].title:r.kind)+' · '+(r.payee||r.requester_name||'')+' · '+fmtPeso(r.amount||0),children:[{table:'fin_lines',fk:'req_id'}]},
  fund_sources:{label:'Fund source',no:r=>r.class,sum:r=>'approver: '+(r.approver_name||'none'),children:[]}
};
/* archiveRecord(table, id) — the one entry point. Returns true when archived. */
async function archiveRecord(table,id,noOverride){
  if(!isSuper())return alert('Deleting records is reserved to the super admin.'),false;
  const K=ARCH_KINDS[table];
  if(!K)return alert('That record type is not set up for archiving yet.'),false;
  let row=null;
  try{const {data,error}=await SB.from(table).select('*').eq(table==='fund_sources'?'class':'id',id).maybeSingle();if(error)throw error;row=data;}
  catch(e){return alert('Could not read the record: '+(e.message||e)),false;}
  if(!row)return alert('That record no longer exists.'),false;
  const no=noOverride||K.no(row);
  const typed=prompt('DELETE '+K.label+' '+no+'\n\n'+(K.sum(row)||'')+
    '\n\nIt will be archived — hidden everywhere, restorable from Admin → Archive.\n\nType '+no+' to confirm:','');
  if(typed===null)return false;
  if(String(typed).trim()!==String(no)){alert('That did not match "'+no+'" — nothing was deleted.');return false;}
  const reason=(prompt('Why is this being deleted? (goes on the record)','')||'').trim();
  try{
    const children={};
    for(const c of (K.children||[])){
      const {data}=await SB.from(c.table).select('*').eq(c.fk,id);
      children[c.table]={fk:c.fk,rows:data||[]};
    }
    const {error:eB}=await SB.from('archive_bin').insert({src_table:table,src_id:String(id),label:no,
      summary:(K.label+' · '+(K.sum(row)||'')).slice(0,300),payload:{row,children},reason:reason||null,
      archived_by:(SBUSER&&SBUSER.id)||null,archived_name:(SBPROFILE&&SBPROFILE.name)||''});
    if(eB)throw new Error('Could not archive it, so nothing was deleted: '+(eB.message||eB));
    // RLS filters a forbidden DELETE to zero rows and still returns success —
    // so ask for the deleted rows back and check we actually got one. Otherwise
    // the app would cheerfully report a delete that never happened.
    const {data:gone,error:eD}=await SB.from(table).delete().eq(table==='fund_sources'?'class':'id',id).select();
    if(eD||!gone||!gone.length){
      try{await SB.from('archive_bin').delete().eq('src_table',table).eq('src_id',String(id)).is('restored_at',null);}catch(e2){}
      throw new Error(eD?('Could not delete it: '+(eD.message||eD)):'The database refused the delete (nothing was removed, and the archive entry was rolled back). Run the super-admin delete policies from SUPABASE-SETUP.md.');
    }
    audit('archive.delete',{table,no,reason});
    alert(no+' deleted. You can restore it from Admin → Archive.');
    return true;
  }catch(e){alert(e.message||e);return false;}
}
async function renderArchive(){
  if(!isSuper()){$('content').innerHTML='<div class="empty" style="margin-top:40px">The archive is super-admin only.</div>';return;}
  loadingHint();
  let rows=[];
  try{const {data,error}=await SB.from('archive_bin').select('id,src_table,src_id,label,summary,reason,archived_name,archived_at,restored_at,restored_by').order('archived_at',{ascending:false}).limit(300);
    if(error)throw error;rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the archive SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  const live=rows.filter(r=>!r.restored_at);
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:14px;font-size:12px;color:var(--tx2)">'+
      '<b style="color:var(--tx)">Everything you have deleted.</b> Deleting a record archives it here rather than destroying it: it disappears from the app, but the row and its lines are kept as data. '+
      '<b>Restore</b> puts it back (it is re-created, so it may come back with a new id and its links to other records are not rebuilt). '+
      '<b>Purge</b> removes it from here permanently — though the nightly backup still holds last night’s copy.</div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">In the archive</div><div class="met-val">'+live.length+'</div><div class="met-sub">deleted, still recoverable</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Restored</div><div class="met-val">'+(rows.length-live.length)+'</div><div class="met-sub">put back at some point</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Record</th><th>Type</th><th>What it was</th><th>Reason</th><th>Deleted by</th><th>When</th><th>Status</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td style="font-weight:700">'+esc(r.label||'—')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+esc((ARCH_KINDS[r.src_table]&&ARCH_KINDS[r.src_table].label)||r.src_table)+'</td>'+
      '<td class="mu" style="font-size:11.5px;max-width:260px;overflow:hidden;text-overflow:ellipsis">'+esc(r.summary||'')+'</td>'+
      '<td class="mu" style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis">'+esc(r.reason||'—')+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc(r.archived_name||'')+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc(String(r.archived_at||'').slice(0,16).replace('T',' '))+'</td>'+
      '<td>'+(r.restored_at?'<span class="pill pgr">restored '+esc(String(r.restored_at).slice(0,10))+'</span>':'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">archived</span>')+'</td>'+
      '<td style="white-space:nowrap;font-size:11.5px">'+(r.restored_at?'':'<a href="#" onclick="archRestore('+r.id+');return false" style="color:var(--gr);font-weight:700">restore</a> · ')+
        '<a href="#" onclick="archPurge('+r.id+');return false" style="color:var(--rd)">purge</a></td></tr>').join('')
      :'<tr><td colspan="8" class="mu">Nothing has been deleted.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Deleting requires typing the record’s number · restoring re-creates the record and its lines · purging asks again and is permanent here. Every action is in the Activity log.</span></div></div>';
}
async function archRestore(binId){
  if(!isSuper())return;
  let b=null;
  try{const {data,error}=await SB.from('archive_bin').select('*').eq('id',binId).maybeSingle();if(error)throw error;b=data;}catch(e){return alert('Could not read it: '+(e.message||e));}
  if(!b||b.restored_at)return renderArchive();
  if(!confirm('Restore '+b.label+'?\n\n'+(b.summary||'')+'\n\nIt is re-created from the archived copy. Note: it may come back with a new id, and links from other records to the old one are not rebuilt.'))return;
  try{
    const row=Object.assign({},(b.payload&&b.payload.row)||{});
    const isFS=b.src_table==='fund_sources';
    if(!isFS)delete row.id; // identity column: let the database issue a fresh one
    delete row.num;         // quotes/orders carry a second identity column
    delete row.created_at;  // let the restore stamp itself
    const {data:ins,error}=await SB.from(b.src_table).insert(row).select().single();
    if(error)throw error;
    const newId=isFS?ins.class:ins.id;
    const ch=(b.payload&&b.payload.children)||{};
    for(const t in ch){
      const spec=ch[t];const kids=(spec.rows||[]).map(k=>{const c=Object.assign({},k);delete c.id;c[spec.fk]=newId;return c;});
      if(kids.length){const {error:eK}=await SB.from(t).insert(kids);if(eK)throw new Error('The record came back but its lines did not: '+(eK.message||eK));}
    }
    await SB.from('archive_bin').update({restored_at:new Date().toISOString(),restored_by:(SBPROFILE&&SBPROFILE.name)||''}).eq('id',binId);
    audit('archive.restore',{table:b.src_table,label:b.label,newId:String(newId)});
    alert(b.label+' restored.');
    renderArchive();
  }catch(e){alert('Could not restore: '+(e.message||e));}
}
async function archPurge(binId){
  if(!isSuper())return;
  let b=null;
  try{const {data}=await SB.from('archive_bin').select('id,label,summary').eq('id',binId).maybeSingle();b=data;}catch(e){}
  if(!b)return renderArchive();
  if(!confirm('PURGE '+b.label+' from the archive?\n\n'+(b.summary||'')+'\n\nThis removes the archived copy for good. Only last night’s backup would still have it.'))return;
  const typed=prompt('This is permanent. Type '+b.label+' once more to purge it:','');
  if(typed===null)return;
  if(String(typed).trim()!==String(b.label))return alert('That did not match — nothing was purged.');
  try{
    const {error}=await SB.from('archive_bin').delete().eq('id',binId);
    if(error)throw error;
    audit('archive.purge',{label:b.label});
    renderArchive();
  }catch(e){alert('Could not purge: '+(e.message||e));}
}

/* ── DOCUMENT NUMBERING (super admin) — one panel for every series ── */
async function renderNumbering(){
  if(!isSuper()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Numbering is a super-admin setting.</div>';return;}
  loadingHint();
  let rows=[];
  try{const {data,error}=await SB.from('doc_formats').select('*').order('sort');if(error)throw error;rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the numbering SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  let ds=null;try{const {data}=await SB.from('doc_series').select('*').eq('kind','dr').maybeSingle();ds=data;}catch(e){}
  const ex=r=>{let n=String((r.offset_no||0)+1);if(r.pad>0)while(n.length<r.pad)n='0'+n;return (r.prefix||'')+n;};
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:14px;font-size:12px;color:var(--tx2)">'+
      '<b style="color:var(--tx)">How every document number is printed.</b> The number itself always comes from the record’s own position in its series, so two documents can never collide. What you control here is how it is <i>shown</i>: the prefix, how many digits it is padded to, and the number the series appears to start at. '+
      'Changing a format changes it everywhere that number appears, including on documents already issued — so agree it with accounting before you touch it. '+
      '<b>Delivery receipt numbers are different</b>: those are stamped permanently onto the order at first print and are set on the Cutover page.</div>'+
    '<div class="tcard" style="margin-bottom:16px"><div class="tscroll"><table><thead><tr><th>Document</th><th>Prefix</th><th class="r">Pad to</th><th class="r">Series starts at</th><th>Next looks like</th><th></th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td style="font-weight:600">'+esc(r.label||r.kind)+'</td>'+
      '<td class="mu">'+esc(r.prefix||'(none)')+'</td><td class="r mu">'+(r.pad||'—')+'</td><td class="r mu">'+((r.offset_no||0)+1)+'</td>'+
      '<td style="font-weight:700;color:var(--ac)">'+esc(ex(r))+'</td>'+
      '<td style="font-size:11.5px"><a href="#" onclick="numEdit(\''+esc(r.kind)+'\');return false" style="color:var(--ac)">change</a></td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Example shows the first number in each series with the current format.</span></div></div>'+
    '<div class="panel" style="padding:14px 16px"><div class="phd">Delivery receipts (BIR series)</div>'+
      '<div style="font-size:12px;color:var(--tx2);margin-top:6px">'+(ds?'Currently <b>'+esc(ds.prefix||'')+String(ds.next_no||1).padStart(ds.pad||0,'0')+'</b> next, padded to '+(ds.pad||0)+' digits.':'Not configured — orders fall back to their HS number on the printed DR.')+
      ' DR numbers are assigned once, at first print, and never move. Set them on the <a href="#" onclick="showView(\'cutover\');return false" style="color:var(--ac)">Cutover page</a>.</div></div>';
}
async function numEdit(kind){
  if(!isSuper())return;
  let r=null;try{const {data}=await SB.from('doc_formats').select('*').eq('kind',kind).maybeSingle();r=data;}catch(e){}
  if(!r)return alert('Unknown series.');
  const prefix=prompt('Prefix for '+(r.label||kind)+' (e.g. HS- · blank for none):',r.prefix||'');
  if(prefix===null)return;
  const pad=prompt('Pad the number to how many digits? (0 = no padding)\n\ne.g. pad 4 shows 7 as 0007',String(r.pad||0));
  if(pad===null)return;
  const off=prompt('The series should appear to start at which number?\n\n(Internally records are still 1,2,3… — this only shifts what is printed. Currently the first is '+((r.offset_no||0)+1)+'.)',String((r.offset_no||0)+1));
  if(off===null)return;
  const padN=parseInt(pad,10),offN=parseInt(off,10);
  if(isNaN(padN)||padN<0||padN>12)return alert('Padding must be 0–12.');
  if(isNaN(offN)||offN<0)return alert('The starting number must be 0 or more.');
  let ex=String(offN);while(ex.length<padN)ex='0'+ex;
  if(!confirm('Numbers for '+(r.label||kind)+' will read '+prefix.trim()+ex+' onwards.\n\nThis changes how EXISTING documents of this type display too. Continue?'))return;
  try{
    const {error}=await SB.from('doc_formats').update({prefix:prefix.trim(),pad:padN,offset_no:offN-1}).eq('kind',kind);
    if(error)throw error;
    audit('numbering.set',{kind,prefix:prefix.trim(),pad:padN,starts:offN});
    await loadDocFormats(true);
    renderNumbering();
  }catch(e){alert('Could not save: '+(e.message||e));}
}

/* ══════════════════ ATTACHMENTS ══════════════════
   Files go to a Google Shared Drive through the `upload` function; Supabase
   keeps the pointer. Two upload paths, tried in order:
     1. a resumable session — the browser PUTs the bytes straight to Google, so
        big receipts never touch Netlify's 6 MB request limit;
     2. base64 through the function, for when a network or browser blocks (1).
   Reading always goes through the function, so an HQ session — not Drive
   membership — decides who can open a document. */
const ATT_MAX=20*1024*1024; // Drive accepts more, but this is a sane per-receipt cap
function attIcon(m){m=String(m||'');return m.indexOf('image/')===0?'🖼':m.indexOf('pdf')>=0?'📕':m.indexOf('sheet')>=0||m.indexOf('excel')>=0?'📊':m.indexOf('word')>=0||m.indexOf('document')>=0?'📄':'📎';}
function attSize(n){n=Number(n||0);return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':n+' B';}
async function attList(recType,recId){
  try{const {data,error}=await SB.from('attachments').select('*').eq('rec_type',recType).eq('rec_id',String(recId)).order('id');
    if(error)throw error;return data||[];}catch(e){return [];}
}
/* the markup for a record's attachments — call it wherever a record is drawn */
/* A lossless id for the status line. Stripping non-alphanumerics collided —
   "St. Luke's" and "StLukes" produced the same element id. */
function attKey(recType,recId){
  let h=5381,str=recType+':'+String(recId);
  for(let i=0;i<str.length;i++)h=((h*33)^str.charCodeAt(i))>>>0;
  return String(recType).replace(/[^a-z0-9]/gi,'')+h.toString(36);
}
function attBlock(recType,recId,files,canAdd){
  const key=recType+':'+recId;
  return '<div class="attblock" data-att="'+esc(key)+'">'+
    (files.length?files.map(f=>'<span class="attchip" title="'+esc(f.name)+(f.uploaded_name?' · '+esc(f.uploaded_name):'')+'">'+
      '<a href="#" onclick="attOpen(\''+jsq(f.file_id)+'\',\''+jsq(f.name)+'\');return false" style="color:var(--ac)">'+attIcon(f.mime)+' '+esc(f.name.length>28?f.name.slice(0,26)+'…':f.name)+'</a>'+
      '<span class="mu" style="font-size:10px"> '+attSize(f.size)+'</span>'+
      (canAdd?' <a href="#" onclick="attRemove('+f.id+',\''+jsq(f.file_id)+'\');return false" style="color:var(--rd);font-size:10px" title="Remove">✕</a>':'')+
      '</span>').join(' '):'<span class="mu" style="font-size:11.5px">No files attached.</span>')+
    (canAdd?' <label class="attadd">+ Attach<input type="file" multiple style="display:none" onchange="attPick(this,\''+jsq(recType)+'\',\''+jsq(recId)+'\')"></label>':'')+
    '<span class="mu" id="att-msg-'+attKey(recType,recId)+'" style="font-size:11px;margin-left:6px"></span></div>';
}
function attMsg(recType,recId,txt,bad){
  const el=document.getElementById('att-msg-'+attKey(recType,recId));
  if(el){el.textContent=txt||'';el.style.color=bad?'var(--rd)':'var(--tx3)';}
}
async function attPick(input,recType,recId){
  const files=[...(input.files||[])];input.value='';
  if(!files.length)return;
  let skipped='';
  for(const f of files){
    if(f.size>ATT_MAX){skipped=f.name+' is over 20 MB — put it in Drive and paste the link instead.';continue;}
    try{
      attMsg(recType,recId,'Uploading '+f.name+'…');
      const meta=await attUpload(f);
      const {error}=await SB.from('attachments').insert({rec_type:recType,rec_id:String(recId),file_id:meta.id,
        name:f.name,mime:f.type||null,size:f.size,uploaded_by:(SBUSER&&SBUSER.id)||null,uploaded_name:(SBPROFILE&&SBPROFILE.name)||''});
      if(error)throw new Error(error.message);
      audit('attachment.add',{rec:recType+' '+recId,name:f.name,size:f.size});
    }catch(e){attMsg(recType,recId,'Could not attach '+f.name+': '+(e.message||e),true);return;}
  }
  attMsg(recType,recId,skipped,!!skipped);
  if(typeof reRender==='function')reRender();
}
/* upload one file: direct to Google first, function fallback second */
async function attUpload(file){
  const h=await sbAuthHeaders({'Content-Type':'application/json'});
  try{
    const r=await fetch('/.netlify/functions/upload',{method:'POST',headers:h,
      body:JSON.stringify({action:'session',name:file.name,mime:file.type||'application/octet-stream'})});
    const j=await r.json();
    if(!j.uploadUrl)throw new Error(j.error||'no upload url');
    const put=await fetch(j.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
    if(!put.ok)throw new Error('direct upload failed ('+put.status+')');
    const done=await put.json();
    if(!done.id)throw new Error('Drive did not return a file id');
    return done;
  }catch(e){
    // the direct PUT can be blocked (CORS, proxy, offline) — fall back for smaller files
    if(file.size>4*1024*1024)throw new Error((e.message||e)+' — and the file is too big for the fallback route');
    const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]||'');fr.onerror=()=>rej(new Error('could not read the file'));fr.readAsDataURL(file);});
    const r2=await fetch('/.netlify/functions/upload',{method:'POST',headers:h,
      body:JSON.stringify({action:'put',name:file.name,mime:file.type||'application/octet-stream',data:b64})});
    const j2=await r2.json();
    if(!j2.id)throw new Error(j2.error||'upload failed');
    return j2;
  }
}
async function attOpen(fileId,name){
  try{
    const r=await fetch('/.netlify/functions/upload?id='+encodeURIComponent(fileId),{headers:await sbAuthHeaders()});
    if(!r.ok){
      const j=await r.json().catch(()=>({}));
      if(j.tooBig){ // over ~4MB: Netlify cannot stream it back, so hand over a Drive link
        const l=await fetch('/.netlify/functions/upload',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),body:JSON.stringify({action:'link',id:fileId})});
        const lj=await l.json();
        if(lj.url){window.open(lj.url,'_blank');return;}
      }
      throw new Error(j.error||('HTTP '+r.status));
    }
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const w=window.open(url,'_blank');
    if(!w){const a=document.createElement('a');a.href=url;a.download=name||'file';a.click();}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){alert('Could not open it: '+(e.message||e));}
}
async function attRemove(rowId,fileId){
  if(!confirm('Remove this attachment? It is deleted from Drive too.'))return;
  try{
    /* The server owns this now. Deleting the row from the browser looked like it
       worked even when RLS filtered it to nothing — PostgREST answers a 0-row
       DELETE with success — and the Drive file was then destroyed anyway. The
       function checks who owns the row, removes it, and only then removes the file. */
    const r=await fetch('/.netlify/functions/upload',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({action:'remove',row:rowId,id:fileId})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error)throw new Error(d.error||('Could not remove it ('+r.status+')'));
    audit('attachment.remove',{file:fileId});
    if(typeof reRender==='function')reRender();
  }catch(e){alert('Could not remove it: '+(e.message||e));}
}
/* super admin: is Drive actually wired up? shown on the Cutover page */
async function attCheck(){
  try{
    const r=await fetch('/.netlify/functions/upload',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({action:'check'})});
    const j=await r.json();
    alert(j.ok?('Drive is connected.\n\nFolder: '+(j.folder||'?')+(j.sharedDrive?'\nOn a Shared Drive ✓':'\n\nWARNING: this folder is NOT on a Shared Drive. A service account has no storage of its own, so uploads will fail with a quota error. Move the folder into a Shared Drive.'))
      :('Drive is not working yet:\n\n'+(j.error||'unknown')));
  }catch(e){alert('Could not reach the upload function: '+(e.message||e));}
}

/* ══════════════════ FINANCE FORMS ══════════════════
   Six Google forms — voucher for approval, request to order/pay, proof of
   payment, replenishment, expense reimbursement, cash advance — as one engine.

   Rather than six near-identical views, each form is a SPEC: its fields, which
   are required, which option list feeds each dropdown, which sections only
   appear for a given answer, and whether it takes line items. One renderer
   draws them, one submit path saves them, one approval chain routes them, and
   attachments work the same everywhere.

   Anyone signed in can file one; who signs it off is configured per form in
   approval_routes (Admin → Approval routes), so a route can point at a named
   person, at whoever holds a role, or at the request's own fund source. */
const FIN_KINDS=['voucher','orderpay','proofpay','replenish','reimburse','cashadvance','expreport'];
const FIN_SPEC={
  voucher:{title:'Voucher for approval',no:'voucher',
    blurb:'For payments that need a voucher raised — supplier invoices, honoraria, reimbursable costs already incurred.',
    fields:[
      {k:'ref_no',t:'text',l:'Request no. (if any)',col:'ref_no'},
      {k:'date_requested',t:'date',l:'Date',req:1,col:'date_requested'},
      {k:'payee_type',t:'radio',l:'Payee type',opts:['Internal (employee, intern, consultant)','External (supplier, govt agency)']},
      {k:'fund_class',t:'fund',l:'Fund source',req:1,col:'fund_class'},
      {k:'payee',t:'text',l:'Payee name',req:1,col:'payee'},
      {k:'purpose',t:'area',l:'Nature of transaction',req:1,col:'purpose'},
      {k:'amount',t:'money',l:'Invoice / receipt amount',req:1,col:'amount'},
      {k:'input_vat',t:'money',l:'Input VAT (if any)'},
      {k:'ewt',t:'money',l:'Expanded withholding tax (if any)'},
      {k:'cash_payable',t:'money',l:'Cash payable'},
      {k:'product_line',t:'list',list:'product_line',l:'Product line',col:'product_line'},
      {k:'event_code',t:'list',list:'event_code',l:'Event code (product marketing)',col:'event_code'},
      {k:'cashflow_tag',t:'list',list:'cashflow_tag',l:'Cash-flow tag',req:1,col:'cashflow_tag'},
      {k:'po_number',t:'text',l:'PO number (for inventory)'},
      {k:'pay_mode',t:'list',list:'pay_mode',l:'Mode of payment'}
    ],
    attach:'Supporting documents (SOA, invoice)'},

  orderpay:{title:'Request to order / pay',no:'orderpay',
    blurb:'To ORDER (supply chain, 3–5 days after an approved quotation) or to PAY (finance, 3–5 days after an approved quotation/invoice). Payments upload on Fridays.',
    fields:[
      {k:'date_requested',t:'date',l:'Date submitted',req:1,col:'date_requested'},
      {k:'date_needed',t:'date',l:'Date needed',req:1,col:'date_needed'},
      {k:'request_to',t:'sel',l:'Request to',req:1,opts:[
        'Order (no approved quotation — non-inventory)','Order (no approved quotation — inventory)',
        'Pay (with approved quotation or invoice)','Settle a balance']},
      // to PAY
      {k:'payee',t:'text',l:'Payee (supplier name)',col:'payee',when:{request_to:['Pay (with approved quotation or invoice)','Settle a balance']},req:1},
      {k:'supplier_contact',t:'text',l:'Supplier contact person',when:{request_to:['Pay (with approved quotation or invoice)']}},
      {k:'supplier_phone',t:'text',l:'Supplier phone',when:{request_to:['Pay (with approved quotation or invoice)']}},
      {k:'supplier_email',t:'text',l:'Supplier email',when:{request_to:['Pay (with approved quotation or invoice)']}},
      {k:'bank_details',t:'area',l:'Supplier bank details',when:{request_to:['Pay (with approved quotation or invoice)']}},
      {k:'currency',t:'sel',l:'Currency',opts:['PHP','EUR','USD','HKD'],col:'currency',when:{request_to:['Pay (with approved quotation or invoice)','Settle a balance']}},
      {k:'amount',t:'money',l:'Amount to pay',col:'amount',when:{request_to:['Pay (with approved quotation or invoice)','Settle a balance']},req:1},
      {k:'delivery_status',t:'radio',l:'Delivery status',opts:['Delivered','Not yet delivered'],when:{request_to:['Pay (with approved quotation or invoice)']}},
      {k:'delivery_ref',t:'text',l:'Delivery reference no.',when:{request_to:['Pay (with approved quotation or invoice)']}},
      // to SETTLE
      {k:'delivered_on',t:'date',l:'When were the goods/services fully delivered?',when:{request_to:['Settle a balance']},req:1},
      {k:'prev_request',t:'text',l:'Previous request no. for the initial payment',when:{request_to:['Settle a balance']},req:1},
      // both
      {k:'purpose',t:'area',l:'Purpose of the transaction',req:1,col:'purpose'},
      {k:'product_line',t:'list',list:'product_line',l:'Product line',col:'product_line'},
      {k:'fund_class',t:'fund',l:'Fund source',req:1,col:'fund_class'},
      {k:'event_code',t:'list',list:'event_code',l:'Event code',col:'event_code'},
      {k:'po_number',t:'text',l:'Related PO / request-to-pay no.'}
    ],
    lines:{label:'Items to order',hint:'One row per item — what it is, how many, and a preferred supplier if you have one.',
      cols:[{k:'description',l:'Item (name & units)',t:'text',w:'flex:1;min-width:180px'},
            {k:'qty',l:'Qty',t:'num',w:'width:80px'},
            {k:'supplier',l:'Preferred supplier & contact',t:'text',w:'flex:1;min-width:160px'},
            {k:'link',l:'Link (if any)',t:'text',w:'flex:1;min-width:140px'}],
      when:{request_to:['Order (no approved quotation — non-inventory)','Order (no approved quotation — inventory)']}},
    attach:'Approved/signed quotation or SOA · BIR 2303 · supplier proof of account · item photos'},

  proofpay:{title:'Proof of payment',no:'proofpay',
    blurb:'Filed after a payment goes out, so the voucher can be closed and the supplier sent their proof.',
    fields:[
      {k:'ref_no',t:'text',l:'Voucher no.',req:1,col:'ref_no'},
      {k:'date_requested',t:'date',l:'Date paid',req:1,col:'date_requested'},
      {k:'payee',t:'text',l:'Supplier',req:1,col:'payee'},
      {k:'purpose',t:'area',l:'Nature of the transaction paid',req:1,col:'purpose'},
      {k:'amount',t:'money',l:'Gross amount',req:1,col:'amount'},
      {k:'cash_payment',t:'money',l:'Cash payment',req:1},
      {k:'tax_withheld',t:'money',l:'Tax withheld'},
      {k:'supplier_email',t:'text',l:'Supplier email'},
      {k:'notes_requestor',t:'area',l:'Notes to the requestor'},
      {k:'notes_supplier',t:'area',l:'Notes to the supplier'}
    ],
    attach:'Bank approval · BIR 2307 · OR from the supplier'},

  replenish:{title:'Request for replenishment',no:'replenish',
    blurb:'Topping up a float — courier credits, petty cash, waybill pads.',
    fields:[
      {k:'requesting_for',t:'text',l:'Requesting for',req:1},
      {k:'date_requested',t:'date',l:'Date of request',req:1,col:'date_requested'},
      {k:'replenish_type',t:'list',list:'replenish_type',l:'Replenishment of',req:1},
      {k:'amount',t:'money',l:'Amount',col:'amount'},
      {k:'purpose',t:'area',l:'Notes',col:'purpose'}
    ],
    attach:'Supporting document'},

  reimburse:{title:'Expense reimbursement',no:'reimburse',
    blurb:'Money you spent that the company owes back. Attach every receipt — finance cannot process a line without one.',
    fields:[
      {k:'date_requested',t:'date',l:'Date submitted',req:1,col:'date_requested'},
      {k:'team',t:'list',list:'team',l:'Team',req:1,col:'team'},
      {k:'reimburse_type',t:'list',list:'reimburse_type',l:'Reimbursement type',req:1},
      {k:'car_type',t:'list',list:'car_type',l:'Car reimbursement type',when:{reimburse_type:['Car Reimbursement']},req:1},
      {k:'purpose',t:'area',l:'Description',req:1,col:'purpose'},
      {k:'amount',t:'money',l:'Total amount',req:1,col:'amount'},
      {k:'credit_to',t:'radio',l:'Where to credit it',opts:['UnionBank payroll account','Other account (payroll not active yet)']},
      {k:'bank_details',t:'text',l:'Bank / e-wallet, account name, account no.',when:{credit_to:['Other account (payroll not active yet)']},req:1}
    ],
    lines:{label:'Transactions',hint:'One row per receipt. The total above should match these.',
      cols:[{k:'description',l:'Description',t:'text',w:'flex:1;min-width:220px'},
            {k:'amount',l:'Amount ₱',t:'money',w:'width:130px'}],
      when:{reimburse_type:['Healthspan Other Expense','Remedy Other Expense']}},
    attach:'Receipts / invoices for every line'},

  expreport:{title:'Expense report (revolving fund)',no:'expreport',
    blurb:'The liquidation of a revolving fund: every peso spent from the fund, itemised with its receipt, for the period you are reporting. Approval clears the way for the fund to be replenished (file the Request for replenishment separately).',
    fields:[
      {k:'date_requested',t:'date',l:'Date submitted',req:1,col:'date_requested'},
      {k:'team',t:'list',list:'team',l:'Team',req:1,col:'team'},
      {k:'period_from',t:'date',l:'Period covered — from',req:1},
      {k:'period_to',t:'date',l:'Period covered — to',req:1},
      {k:'fund_amount',t:'money',l:'Revolving fund amount'},
      {k:'purpose',t:'area',l:'Notes (optional)',col:'purpose'},
      {k:'amount',t:'money',l:'Total spent this period',req:1,col:'amount'}
    ],
    lines:{label:'Expenses',hint:'One row per receipt — the total above should equal these.',
      cols:[{k:'exp_date',l:'Date',t:'text',w:'width:110px'},
            {k:'category',l:'Category',t:'text',w:'width:150px'},
            {k:'description',l:'Description',t:'text',w:'flex:1;min-width:180px'},
            {k:'amount',l:'Amount ₱',t:'money',w:'width:120px'}]},
    attach:'Receipts for every line'},

  cashadvance:{title:'Request for cash advance',no:'cashadvance',
    blurb:'Money needed up front for a project. Liquidate with receipts afterwards.',
    fields:[
      {k:'team',t:'list',list:'team',l:'Team',req:1,col:'team'},
      {k:'date_requested',t:'date',l:'Date of request',req:1,col:'date_requested'},
      {k:'last_day',t:'date',l:'Last day of the project',req:1},
      {k:'purpose',t:'area',l:'Purpose',req:1,col:'purpose'},
      {k:'amount',t:'money',l:'Amount requested',req:1,col:'amount'},
      {k:'fund_class',t:'fund',l:'Fund source',req:1,col:'fund_class'},
      {k:'breakdown_link',t:'text',l:'Link to the expected-expenses breakdown',req:1},
      {k:'credit_to',t:'text',l:'Where to credit it — bank, account name, account no.',req:1}
    ],
    attach:'Breakdown or supporting documents'}
};
const FIN_NO=(kind,num)=>docNo(kind,num);

/* ── option lists (finance-owned) and approval routes ── */
let CODES=null,ROUTES=null;
async function loadCodes(force){
  if(CODES&&!force)return CODES;
  CODES={};
  try{const {data}=await SB.from('code_lists').select('*').eq('active',true).order('sort');
    for(const r of (data||[]))(CODES[r.list]||(CODES[r.list]=[])).push(r.label||r.code);}catch(e){}
  return CODES;
}
async function loadRoutes(force){
  // force means "no older than 20s", not "refetch every paint": every finance
  // page forced this, which is one full round trip per navigation for a table
  // that changes a few times a year. Decisions still re-check at decide time.
  if(ROUTES&&force&&(Date.now()-(window._routesAt||0))<20000)return ROUTES;
  if(ROUTES&&!force)return ROUTES;
  window._routesAt=Date.now();
  ROUTES={};
  try{const {data}=await SB.from('approval_routes').select('*').eq('active',true).order('step');
    for(const r of (data||[]))(ROUTES[r.kind]||(ROUTES[r.kind]=[])).push(r);}catch(e){}
  return ROUTES;
}
function finSteps(kind,amount){ // the steps that actually apply to this request
  return (ROUTES[kind]||[]).filter(r=>(amount||0)>=(r.min_amount||0));
}
function finStepOf(req){const st=finSteps(req.kind,req.amount);return st[(req.step||1)-1]||null;}
function finStepWho(r,req){ // who this step is waiting on, in words
  if(!r)return '';
  if(r.approver_name)return r.approver_name;
  if(r.use_fund_source){const f=fundOf(req.fund_class);return f&&f.approver_name?f.approver_name+' ('+req.fund_class+')':(req.fund_class||'the fund source')+' — no approver set';}
  if(r.approver_role)return String(r.approver_role).replace('_',' ');
  return r.label||'someone';
}
function canDecideFin(req){ // may I decide the step it is sitting on?
  if(!req||req.status!=='pending')return false;
  // nobody signs off their own spending — not even an admin. The super admin can,
  // because someone has to be able to unstick a request, and it is on the record.
  const me0=(SBUSER&&SBUSER.id)||'';
  if(typeof isSuper==='function'&&isSuper())return true;
  if(req.requester_id&&req.requester_id===me0)return false;
  if(roleIn('admin'))return true;
  const r=finStepOf(req);if(!r)return false;
  const me=(SBUSER&&SBUSER.id)||'';
  if(r.approver_id&&r.approver_id===me)return true;
  if(r.approver_role&&ROLE===r.approver_role)return true;
  if(r.use_fund_source){const f=fundOf(req.fund_class);if(f&&(f.approver_id===me||f.backup_id===me))return true;}
  return false;
}
/* ── the form renderer: one function, six forms ── */
function finVisible(f,vals){ // a field or section shown only for certain answers
  if(!f.when)return true;
  for(const k in f.when){if(!(f.when[k]||[]).includes(vals[k]||''))return false;}
  return true;
}
function finField(f,vals){
  const id='fn-'+f.k, v=vals[f.k]==null?'':vals[f.k];
  const inp='style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px"';
  const lbl='<div style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">'+esc(f.l)+(f.req?' <span style="color:var(--rd)">*</span>':'')+'</div>';
  let body='';
  const opts=f.t==='list'?((CODES||{})[f.list]||[]):(f.opts||[]);
  if(f.t==='area')body='<textarea id="'+id+'" rows="2" oninput="finSet(\''+f.k+'\',this.value)" '+inp+'>'+esc(v)+'</textarea>';
  else if(f.t==='sel'||f.t==='list')body='<select id="'+id+'" onchange="finSet(\''+f.k+'\',this.value,1)" '+inp+'><option value="">— choose —</option>'+
    opts.map(o=>'<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
  else if(f.t==='fund')body='<select id="'+id+'" onchange="finSet(\''+f.k+'\',this.value,1)" '+inp+'><option value="">— choose —</option>'+
    (FUNDS||[]).filter(x=>x.active).map(x=>'<option'+(x.class===v?' selected':'')+'>'+esc(x.class)+'</option>').join('')+'</select>';
  else if(f.t==='radio')body='<div style="display:flex;gap:12px;flex-wrap:wrap;padding:4px 0">'+opts.map(o=>
    '<label style="display:flex;align-items:center;gap:5px;font-size:12.5px;cursor:pointer"><input type="radio" name="'+id+'"'+(o===v?' checked':'')+' onchange="finSet(\''+f.k+'\',\''+jsq(o)+'\',1)"> '+esc(o)+'</label>').join('')+'</div>';
  else if(f.t==='date')body='<input id="'+id+'" type="date" value="'+esc(v)+'" onchange="finSet(\''+f.k+'\',this.value)" '+inp+'>';
  else if(f.t==='money'||f.t==='num')body='<input id="'+id+'" type="number" step="'+(f.t==='money'?'0.01':'1')+'" value="'+esc(v)+'" oninput="finSet(\''+f.k+'\',this.value)" '+inp+'>';
  else body='<input id="'+id+'" type="text" value="'+esc(v)+'" oninput="finSet(\''+f.k+'\',this.value)" '+inp+'>';
  return '<div style="flex:1 1 240px;min-width:200px;margin-bottom:10px">'+lbl+body+'</div>';
}
function finLinesTable(spec){
  const rows=window._finLines||[];
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12.5px"';
  return '<div class="panel" style="padding:12px 14px;margin-bottom:12px">'+
    '<div class="phd" style="margin-bottom:2px">'+esc(spec.label)+'</div>'+
    '<div class="mu" style="font-size:11.5px;margin-bottom:8px">'+esc(spec.hint||'')+'</div>'+
    rows.map((r,i)=>'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px">'+
      spec.cols.map(c=>'<input value="'+esc(r[c.k]==null?'':r[c.k])+'" placeholder="'+esc(c.l)+'" '+
        (c.t==='num'||c.t==='money'?'type="number" ':'')+'oninput="finLineSet('+i+',\''+c.k+'\',this.value)"'+
        ' style="'+c.w+';'+inp.slice(7,-1)+'">').join('')+
      '<a href="#" onclick="finLineDrop('+i+');return false" style="color:var(--rd);font-size:11.5px">remove</a></div>').join('')+
    '<button onclick="finLineAdd()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer">+ Add row</button>'+
    (spec.cols.some(c=>c.k==='amount')?'<span class="mu" style="font-size:12px;margin-left:10px">Rows total: <b>'+fmtPeso(rows.reduce((a,r)=>a+(parseFloat(r.amount)||0),0))+'</b></span>':'')+
    '</div>';
}
function finSet(k,v,repaint){window._finVals=window._finVals||{};window._finVals[k]=v;if(repaint)renderFinForm(window._finKind,true);}
function finLineAdd(){(window._finLines=window._finLines||[]).push({});renderFinForm(window._finKind,true);}
function finLineDrop(i){(window._finLines||[]).splice(i,1);renderFinForm(window._finKind,true);}
function finLineSet(i,k,v){const L=window._finLines||[];if(L[i])L[i][k]=v;}

/* ── the view: file one, and the register of everything of this kind ── */
async function renderFinForm(kind,cheap){
  kind=kind||window._finKind||'voucher';
  if(!FIN_SPEC[kind])return;
  if(window._finKind!==kind){window._finVals={};window._finLines=[];window._finKind=kind;cheap=false;}
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  if(cheap&&window._FINROWS)return finPaint(kind,window._FINROWS,window._FINLINES,window._FINATT);
  loadingHint();
  /* ONE wave of requests, not a waterfall: funds, codes, routes and the page's
     own data were awaited one after another — 4-5 round trips in series is why
     these pages sat on "Loading…". Nothing below depends on anything else. */
  let rows=[],lines={},att={};
  try{
    const [,,,a,b,c]=await Promise.all([
      loadFunds(),loadCodes(),loadRoutes(true),
      SB.from('fin_requests').select('*').eq('kind',kind).order('id',{ascending:false}).limit(300),
      SB.from('fin_lines').select('*').order('seq').limit(2000),
      SB.from('attachments').select('*').eq('rec_type',kind)
    ]);
    if(a.error)throw a.error;
    rows=a.data||[];
    const ids=new Set(rows.map(r=>r.id));
    for(const l of (b.data||[]))if(ids.has(l.req_id))(lines[l.req_id]||(lines[l.req_id]=[])).push(l);
    for(const f of (c.data||[]))(att[f.rec_id]||(att[f.rec_id]=[])).push(f);
  }catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the finance-forms SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  window._FINROWS=rows;window._FINLINES=lines;window._FINATT=att;
  finPaint(kind,rows,lines,att);
}
function finPaint(kind,rows,lines,att){
  const S=FIN_SPEC[kind];
  const vals=window._finVals=window._finVals||{};
  if(!vals.date_requested)vals.date_requested=new Date().toISOString().slice(0,10);
  const me=(SBUSER&&SBUSER.id)||'';
  const mine=rows.filter(r=>r.requester_id===me);
  const toDecide=rows.filter(r=>canDecideFin(r));
  const steps=(ROUTES[kind]||[]);
  const pill=r=>r.status==='pending'?'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">step '+(r.step||1)+' · '+esc(finStepWho(finStepOf(r),r))+'</span>'
    :r.status==='approved'?'<span class="pill pgr">approved</span>'
    :r.status==='rejected'?'<span class="pill prd">rejected</span>'
    :r.status==='settled'?'<span class="pill pbl">settled</span>':'<span class="pill" style="background:var(--sf2);color:var(--tx3)">cancelled</span>';
  const tabs=FIN_KINDS.map(k=>'<button onclick="showView(\''+k+'\')" style="background:'+(k===kind?'var(--ac)':'var(--sf)')+';color:'+(k===kind?'#fff':'var(--tx)')+
    ';border:1px solid '+(k===kind?'var(--ac)':'var(--bd)')+';border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer">'+esc(FIN_SPEC[k].title)+'</button>').join(' ');
  $('content').innerHTML=
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'+tabs+'</div>'+
    '<div class="panel" style="padding:12px 16px;margin-bottom:12px;font-size:12px;color:var(--tx2)">'+esc(S.blurb)+
      ' <b style="color:var(--tx)">Route:</b> '+(steps.length?steps.map(r=>esc(r.label||('step '+r.step))).join(' → '):'<span style="color:var(--rd)">no approval route set — an admin needs to configure one</span>')+'.</div>'+
    '<div class="metrics" style="margin-bottom:12px">'+
    '<div class="met '+(toDecide.length?'am':'gr')+'"><div class="met-lbl">Waiting on you</div><div class="met-val">'+toDecide.length+'</div><div class="met-sub">'+(toDecide.length?'they cannot move until you decide':'nothing on your desk')+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Open</div><div class="met-val">'+rows.filter(r=>r.status==='pending').length+'</div><div class="met-sub">'+fmtPeso(rows.filter(r=>r.status==='pending').reduce((a,r)=>a+(r.amount||0),0))+' in flight</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Mine</div><div class="met-val">'+mine.length+'</div><div class="met-sub">'+mine.filter(r=>r.status==='pending').length+' still pending</div><div class="met-bar"></div></div>'+
    '</div>'+
    // ── the form ──
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px">'+
      '<div class="phd" style="margin-bottom:10px">New '+esc(S.title.toLowerCase())+'</div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap">'+S.fields.filter(f=>finVisible(f,vals)).map(f=>finField(f,vals)).join('')+'</div>'+
      (S.lines&&finVisible(S.lines,vals)?finLinesTable(S.lines):'')+
      '<div style="font-size:11px;color:var(--tx3);margin:6px 0 10px">'+(S.attach?'<b>Attach after submitting:</b> '+esc(S.attach)+' — the request appears in the register below with a + Attach button.':'')+'</div>'+
      '<button onclick="finSubmit()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">Submit request</button>'+
    '</div>'+
    // ── the register ──
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>No.</th><th>Date</th><th>Requested by</th><th>What for</th><th class="r">Amount</th><th>Status</th><th>Files</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>{
      const isMine=r.requester_id===me, can=canDecideFin(r);
      const acts=[];
      if(can)acts.push('<a href="#" onclick="finDecide('+r.id+',\'approve\');return false" style="color:var(--gr);font-weight:700">approve ✓</a>','<a href="#" onclick="finDecide('+r.id+',\'reject\');return false" style="color:var(--rd)">reject</a>');
      if(isMine&&r.status==='pending')acts.push('<a href="#" onclick="finCancel('+r.id+');return false" style="color:var(--tx3)">cancel</a>');
      if(r.status==='approved'&&roleIn('admin','finance'))acts.push('<a href="#" onclick="finSettle('+r.id+');return false" style="color:var(--ac)">mark settled</a>');
      if(typeof delLink==='function'){const d=delLink('fin_requests',r.id);if(d)acts.push(d.replace(/^ · /,''));}
      const ls=lines[r.id]||[];
      return '<tr'+(isMine?' style="background:var(--sf2)"':'')+'><td style="font-weight:700">'+FIN_NO(kind,r.num)+(r.ref_no?'<div class="mu" style="font-size:10px">'+esc(r.ref_no)+'</div>':'')+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc(String(r.date_requested||'').slice(0,10))+(r.date_needed?'<div style="font-size:10px">need '+esc(r.date_needed)+'</div>':'')+'</td>'+
      '<td class="mu" style="font-size:11.5px;max-width:120px;overflow:hidden;text-overflow:ellipsis">'+esc(r.requester_name||r.requester_email||'—')+'</td>'+
      '<td style="font-size:11.5px;max-width:250px"><div style="max-height:52px;overflow:hidden">'+esc(r.purpose||r.payee||'—')+'</div>'+
        (r.fund_class?'<div class="mu" style="font-size:10px">'+esc(r.fund_class)+(r.event_code?' · '+esc(r.event_code):'')+(r.cashflow_tag?' · '+esc(r.cashflow_tag):'')+'</div>':'')+
        (ls.length?'<div class="mu" style="font-size:10px">'+ls.length+' line'+(ls.length>1?'s':'')+'</div>':'')+'</td>'+
      '<td class="r" style="font-weight:700">'+(r.amount?((r.currency&&r.currency!=='PHP'?esc(r.currency)+' ':'')+fmtPeso(r.amount)):'—')+'</td>'+
      '<td>'+pill(r)+(r.decision_note?'<div class="mu" style="font-size:10px;max-width:150px">'+esc(r.decision_note)+'</div>':'')+'</td>'+
      '<td>'+(typeof attBlock==='function'?attBlock(kind,r.id,(att[String(r.id)]||[]),isMine||can||roleIn('admin','finance')):'')+'</td>'+
      '<td style="white-space:nowrap;font-size:11.5px">'+acts.join(' · ')+'</td></tr>';
    }).join(''):'<tr><td colspan="8" class="mu">Nothing filed yet.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Anyone can file one · it moves through '+(steps.length||1)+' approval step'+((steps.length||1)>1?'s':'')+' before it is actionable · every decision is recorded with who and when. Attach supporting documents to the row after submitting.</span></div></div>';
}

/* ── submit, decide, cancel ── */
async function finSubmit(){
  const kind=window._finKind,S=FIN_SPEC[kind],vals=window._finVals||{};
  const shown=S.fields.filter(f=>finVisible(f,vals));
  for(const f of shown){
    if(f.req&&!String(vals[f.k]||'').trim())return alert('“'+f.l+'” is required.');
  }
  const lines=(S.lines&&finVisible(S.lines,vals))?(window._finLines||[]).filter(l=>Object.values(l).some(v=>String(v||'').trim())):[];
  if(S.lines&&finVisible(S.lines,vals)&&!lines.length&&kind!=='reimburse')return alert('Add at least one row under “'+S.lines.label+'”.');
  // the money on the lines should agree with the total the person typed
  if(lines.length&&vals.amount&&S.lines.cols.some(c=>c.k==='amount')){
    const sum=lines.reduce((a,l)=>a+(parseFloat(l.amount)||0),0);
    if(Math.abs(sum-parseFloat(vals.amount||0))>1&&!confirm('The rows add up to '+fmtPeso(sum)+' but the total says '+fmtPeso(parseFloat(vals.amount)||0)+'.\n\nSubmit anyway?'))return;
  }
  const st=finSteps(kind,Math.round(parseFloat(vals.amount||0)));
  if(!st.length&&!confirm('No approval route is set for this form, so nobody will be notified. Submit anyway and ask an admin to configure one?'))return;
  const row={kind,requester_id:SBUSER.id,requester_name:(SBPROFILE&&SBPROFILE.name)||'',requester_email:(SBUSER&&SBUSER.email)||'',
    status:'pending',step:1,data:{}};
  for(const f of shown){ // only what the form actually showed — a field hidden by
    const v=vals[f.k];    // an earlier answer must not smuggle a stale value through
    if(v==null||v==='')continue;
    if(f.col)row[f.col]=(f.t==='money'||f.t==='num')?Math.round(parseFloat(v)||0):v;
    else row.data[f.k]=v;
  }
  if(!row.date_requested)row.date_requested=new Date().toISOString().slice(0,10);
  if(typeof blockIfClosed==='function'&&blockIfClosed(row.date_requested,'Request not filed'))return;
  try{
    const {data,error}=await SB.from('fin_requests').insert(row).select().single();
    if(error)throw error;
    if(lines.length){
      const {error:eL}=await SB.from('fin_lines').insert(lines.map((l,i)=>({req_id:data.id,seq:i+1,
        description:l.description||null,qty:l.qty?parseFloat(l.qty):null,
        amount:l.amount?Math.round(parseFloat(l.amount)):null,
        meta:{supplier:l.supplier||'',link:l.link||''}})));
      if(eL){ // never leave a lineless request in everyone's queue
        try{await SB.from('fin_requests').update({status:'cancelled',decision_note:'auto-cancelled: the lines failed to save'}).eq('id',data.id);}catch(e2){}
        throw new Error('The lines could not be saved, so the request was cancelled: '+(eL.message||eL));
      }
    }
    audit('fin.'+kind+'.file',{no:FIN_NO(kind,data.num),amount:row.amount||0,fund:row.fund_class||''});
    await finNotifyStep(data,st[0]);
    window._finVals={};window._finLines=[];
    alert(FIN_NO(kind,data.num)+' submitted.'+(st[0]?' Sent to '+finStepWho(st[0],data)+'.':''));
    renderFinForm(kind);
  }catch(e){alert('Could not submit: '+(e.message||e));}
}
async function finNotifyStep(req,step){
  if(!step)return;
  const title=FIN_SPEC[req.kind].title+' needs approval: '+FIN_NO(req.kind,req.num);
  const body=(req.requester_name||'Someone')+' · '+(req.amount?fmtPeso(req.amount):'')+(req.purpose?' · '+String(req.purpose).slice(0,80):'');
  try{
    if(step.approver_id)return notify({user_id:step.approver_id},'approval',title,body,'#/v/'+req.kind);
    if(step.use_fund_source){
      const f=fundOf(req.fund_class);
      if(f&&f.approver_id)await notify({user_id:f.approver_id},'approval',title,body,'#/v/'+req.kind);
      if(f&&f.backup_id)await notify({user_id:f.backup_id},'approval',title+' (backup)',body,'#/v/'+req.kind);
      return;
    }
    if(step.approver_role)return notify({roles:[step.approver_role]},'approval',title,body,'#/v/'+req.kind);
  }catch(e){}
}
async function finDecide(id,what){
  const {data:r}=await SB.from('fin_requests').select('*').eq('id',id).maybeSingle();
  if(!r||r.status!=='pending')return renderFinForm(window._finKind);
  if(!canDecideFin(r))return alert('This one is waiting on '+finStepWho(finStepOf(r),r)+'.');
  const no=FIN_NO(r.kind,r.num);
  const note=(prompt((what==='approve'?'Approve ':'Reject ')+no+' — note for the record'+(what==='reject'?' (goes back to the requester)':' (optional)')+':','')||'').trim();
  if(what==='reject'&&!note&&!confirm('Reject with no reason given?'))return;
  const steps=finSteps(r.kind,r.amount);
  const decisions=(r.decisions||[]).concat([{step:r.step,by:(SBUSER&&SBUSER.id)||'',name:(SBPROFILE&&SBPROFILE.name)||'',at:new Date().toISOString(),decision:what,note:note||''}]);
  const last=(r.step||1)>=steps.length;
  const patch=what==='reject'
    ?{status:'rejected',decision_note:note||null,decisions,updated_at:new Date().toISOString()}
    :(last?{status:'approved',decision_note:note||null,decisions,updated_at:new Date().toISOString()}
          :{step:(r.step||1)+1,decisions,decision_note:note||null,updated_at:new Date().toISOString()});
  try{
    const {data:done,error}=await SB.from('fin_requests').update(patch).eq('id',id).select();
    if(error)throw error;
    if(!done||!done.length)throw new Error('The database refused the update — you may not be on this step.');
    audit('fin.'+r.kind+'.'+what,{no,step:r.step,note});
    try{
      if(r.requester_id&&(what==='reject'||last))
        notify({user_id:r.requester_id},'decision',FIN_SPEC[r.kind].title+' '+(what==='reject'?'REJECTED':'APPROVED')+': '+no,
          what==='reject'?(note||'No reason given.'):'Approved in full — finance will action it.','#/v/'+r.kind);
      if(what==='approve'&&!last)await finNotifyStep(r,steps[r.step]); // step is 1-based, so this is the next one
      if(what==='approve'&&last&&r.kind!=='proofpay')
        notify({roles:['finance']},'auto',FIN_SPEC[r.kind].title+' approved: '+no,(r.payee||r.requester_name||'')+' · '+fmtPeso(r.amount||0)+' — ready to action','#/v/'+r.kind);
    }catch(e){}
    renderFinForm(r.kind);
  }catch(e){alert('Could not save the decision: '+(e.message||e));}
}
async function finSettle(id){ // the money actually moved — closes the loop for finance
  if(!roleIn('admin','finance'))return;
  const ref=(prompt('Mark settled — reference (voucher no., bank ref, cheque no.):','')||'').trim();
  if(ref===null)return;
  try{
    const {data:done,error}=await SB.from('fin_requests').update({status:'settled',ref_no:ref||null,updated_at:new Date().toISOString()}).eq('id',id).eq('status','approved').select();
    if(error)throw error;
    if(!done||!done.length)throw new Error('It is not in an approved state.');
    audit('fin.settle',{id,ref});
    try{const r=done[0];if(r.requester_id)notify({user_id:r.requester_id},'decision','Settled: '+FIN_NO(r.kind,r.num),'Finance has released the payment'+(ref?' ('+ref+')':'')+'.','#/v/'+r.kind);}catch(e){}
    renderFinForm(window._finKind);
  }catch(e){alert('Could not mark it settled: '+(e.message||e));}
}
async function finCancel(id){
  if(!confirm('Cancel this request?'))return;
  try{
    const {data:done,error}=await SB.from('fin_requests').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id).eq('status','pending').select();
    if(error)throw error;
    if(!done||!done.length)throw new Error('The database refused it.');
    audit('fin.cancel',{id});renderFinForm(window._finKind);
  }catch(e){alert('Could not cancel: '+(e.message||e));}
}

/* ── code lists: the dropdowns finance keeps changing ── */
const CODE_LISTS=[['event_code','Event codes'],['cashflow_tag','Cash-flow tags'],['product_line','Product lines'],
  ['pay_mode','Modes of payment'],['replenish_type','Replenishment types'],['reimburse_type','Reimbursement types'],
  ['car_type','Car reimbursement types'],['team','Teams']];
async function renderCodeLists(){
  if(!roleIn('admin','finance')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Finance and admin only.</div>';return;}
  loadingHint();
  const which=window._clWhich||'event_code';
  let rows=[];
  try{const {data,error}=await SB.from('code_lists').select('*').eq('list',which).order('sort');if(error)throw error;rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Needs the finance-forms SQL (SUPABASE-SETUP.md): '+esc(e.message||e)+'</div>';return;}
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:12px;font-size:12px;color:var(--tx2)">'+
      'The dropdown options behind the finance forms. Add a code when a new programme starts; <b>deactivate</b> rather than delete when one ends — historical requests keep showing the code they were filed under, and a deactivated code simply stops appearing in new forms.</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'+
      CODE_LISTS.map(([k,l])=>'<button onclick="window._clWhich=\''+k+'\';renderCodeLists()" style="background:'+(k===which?'var(--ac)':'var(--sf)')+';color:'+(k===which?'#fff':'var(--tx)')+';border:1px solid '+(k===which?'var(--ac)':'var(--bd)')+';border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer">'+esc(l)+'</button>').join(' ')+
    '</div>'+
    '<div class="panel" style="padding:12px 14px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      '<input id="cl-new" placeholder="New '+esc((CODE_LISTS.find(x=>x[0]===which)||[,''])[1].replace(/s$/,'').toLowerCase())+'" style="flex:1;min-width:220px;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px">'+
      '<button onclick="clAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer">Add</button></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th class="r">#</th><th>Code</th><th>Status</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td class="r mu">'+(r.sort||'')+'</td><td style="font-weight:600">'+esc(r.label||r.code)+'</td>'+
      '<td>'+(r.active?'<span class="pill pgr">active</span>':'<span class="pill" style="background:var(--sf2);color:var(--tx3)">retired</span>')+'</td>'+
      '<td style="white-space:nowrap;font-size:11.5px"><a href="#" onclick="clRename('+r.id+',\''+jsq(r.label||r.code)+'\');return false" style="color:var(--ac)">rename</a> · '+
      '<a href="#" onclick="clToggle('+r.id+','+(r.active?'false':'true')+');return false" style="color:var(--tx3)">'+(r.active?'retire':'reactivate')+'</a></td></tr>').join('')
      :'<tr><td colspan="4" class="mu">Nothing in this list yet.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Renaming changes how the code reads on new AND existing requests, because requests store the code itself. Retiring only hides it from new forms.</span></div></div>';
}
async function clAdd(){
  const v=(($('cl-new')||{}).value||'').trim();if(!v)return;
  const which=window._clWhich||'event_code';
  try{
    const {data:mx}=await SB.from('code_lists').select('sort').eq('list',which).order('sort',{ascending:false}).limit(1);
    const next=((mx&&mx[0]&&mx[0].sort)||0)+1;
    const {error}=await SB.from('code_lists').insert({list:which,code:v,label:v,sort:next,updated_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('codelist.add',{list:which,code:v});
    await loadCodes(true);renderCodeLists();
  }catch(e){alert(String(e.message||e).match(/duplicate|unique/i)?'That one is already in the list.':'Could not add: '+(e.message||e));}
}
async function clRename(id,cur){
  const v=(prompt('Rename this option. It changes on existing requests too, because they store the code itself:',cur)||'').trim();
  if(!v||v===cur)return;
  try{
    const {error}=await SB.from('code_lists').update({label:v,code:v,updated_at:new Date().toISOString(),updated_by:(SBUSER&&SBUSER.id)||null}).eq('id',id);
    if(error)throw error;
    audit('codelist.rename',{id,from:cur,to:v});
    await loadCodes(true);renderCodeLists();
  }catch(e){alert('Could not rename: '+(e.message||e));}
}
async function clToggle(id,active){
  try{
    const {error}=await SB.from('code_lists').update({active:!!active,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    audit('codelist.'+(active?'activate':'retire'),{id});
    await loadCodes(true);renderCodeLists();
  }catch(e){alert('Could not save: '+(e.message||e));}
}

/* ── approval routes: who signs off which form ── */
async function renderRoutes(){
  if(!roleIn('admin')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins only.</div>';return;}
  loadingHint();
  await loadRoutes(true);
  if(!window._PLUSERS){try{
    const o=(typeof adminUsers==='function')?await adminUsers('list'):null;
    let arr=(o&&(o.users||o.list))||o||[];if(!Array.isArray(arr))arr=[];
    window._PLUSERS=arr.filter(u=>u&&u.id&&u.role!=='sales').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }catch(e){window._PLUSERS=[];}}
  const rows=[];
  for(const k of FIN_KINDS)for(const r of ((ROUTES||{})[k]||[]))rows.push(r);
  const nameOf=k=>(FIN_SPEC[k]?FIN_SPEC[k].title:k);
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:12px;font-size:12px;color:var(--tx2)">'+
      'Who signs off each form, in order. A step can point at <b>a named person</b>, at <b>whoever holds a role</b> (so it survives someone leaving), or at <b>the request’s own fund source</b> — which routes marketing spend to the marketing approver and sales spend to the sales approver without a step each. '+
      'A step with a minimum amount only applies at or above that figure, so small claims skip it. '+
      '<b>Pull-out requests are not here</b> \u2014 they route off the fund-source table directly.</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Form</th><th class="r">Step</th><th>Label</th><th>Goes to</th><th class="r">Applies from</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td style="font-weight:600">'+esc(nameOf(r.kind))+'</td><td class="r">'+r.step+'</td>'+
      '<td class="mu">'+esc(r.label||'')+'</td>'+
      '<td>'+(r.use_fund_source?'<span class="pill pbl">the request’s fund source</span>':r.approver_name?esc(r.approver_name):r.approver_role?'<span class="pill" style="background:var(--sf2);color:var(--tx2)">any '+esc(String(r.approver_role).replace('_',' '))+'</span>':'<span style="color:var(--rd)">not set</span>')+'</td>'+
      '<td class="r mu">'+(r.min_amount?fmtPeso(r.min_amount):'any amount')+'</td>'+
      '<td style="white-space:nowrap;font-size:11.5px"><a href="#" onclick="routeEdit('+r.id+');return false" style="color:var(--ac)">change</a> · '+
      '<a href="#" onclick="routeDrop('+r.id+');return false" style="color:var(--rd)">remove</a></td></tr>').join('')
      :'<tr><td colspan="6" class="mu">No routes configured — every form would submit with nobody notified.</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Steps run in order; a request sits at one step until it is approved, then moves to the next. Rejecting at any step ends it.</span></div></div>'+
    '<div class="panel" style="padding:12px 14px;margin-top:12px"><button onclick="routeAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer">+ Add a step</button></div>';
}
function routeWhoPrompt(){
  const us=window._PLUSERS||[];
  const list=us.map((u,i)=>(i+1)+') '+(u.name||u.email)+' — '+String(u.role||'').replace('_',' ')).join('\n');
  const v=prompt('Who approves this step?\n\n  F = the request’s own fund source\n  R:<role> = anyone with that role (admin, finance, manager, supply_chain, marketing)\n'+list+'\n\nEnter F, R:finance, or a number:','F');
  if(v===null)return null;
  const t=v.trim();
  if(/^f$/i.test(t))return {use_fund_source:true,approver_id:null,approver_name:null,approver_role:null};
  if(/^r:/i.test(t)){
    const role=t.slice(2).trim().toLowerCase();
    const ROLES=['admin','manager','sales','supply_chain','finance','marketing','viewer'];
    if(!ROLES.includes(role))return alert('“'+role+'” is not a role. Use one of: '+ROLES.join(', ')),null;
    return {use_fund_source:false,approver_id:null,approver_name:null,approver_role:role};
  }
  const u=us[parseInt(t,10)-1];
  if(!u)return alert('No match — nothing changed.'),null;
  return {use_fund_source:false,approver_id:u.id,approver_name:u.name||u.email,approver_role:null};
}
async function routeAdd(){
  if(!roleIn('admin'))return;
  const kinds=FIN_KINDS.slice(); // pull-outs route off fund_sources, not this table
  const pick=prompt('Which form?\n\n'+kinds.map((k,i)=>(i+1)+') '+FIN_SPEC[k].title).join('\n')+'\n\nEnter a number:','1');
  if(pick===null)return;
  const kind=kinds[parseInt(pick,10)-1];if(!kind)return alert('No match.');
  const step=parseInt(prompt('Step number (1 = first to approve):','1')||'0',10);
  if(!step||step<1)return alert('Step must be 1 or more.');
  const label=(prompt('Label for this step (e.g. Fund source, Finance):','')||'').trim();
  const who=routeWhoPrompt();if(!who)return;
  const min=Math.round(parseFloat(prompt('Only apply this step at or above what amount? (0 = always)','0')||'0')||0);
  try{
    const {error}=await SB.from('approval_routes').insert(Object.assign({kind,step,label:label||null,min_amount:min,active:true},who));
    if(error)throw error;
    audit('route.add',{kind,step,who:who.approver_name||who.approver_role||'fund source'});
    await loadRoutes(true);renderRoutes();
  }catch(e){alert(String(e.message||e).match(/duplicate|unique/i)?'That form already has a step '+step+' — change it instead.':'Could not add: '+(e.message||e));}
}
async function routeEdit(id){
  if(!roleIn('admin'))return;
  let cur=null;try{const {data}=await SB.from('approval_routes').select('*').eq('id',id).maybeSingle();cur=data;}catch(e){}
  const who=routeWhoPrompt();if(!who)return;
  const min=Math.round(parseFloat(prompt('Only apply this step at or above what amount? (0 = always)',String((cur&&cur.min_amount)||0))||'0')||0);
  try{
    const {error}=await SB.from('approval_routes').update(Object.assign({min_amount:min},who)).eq('id',id);
    if(error)throw error;
    audit('route.edit',{id,who:who.approver_name||who.approver_role||'fund source'});
    await loadRoutes(true);renderRoutes();
  }catch(e){alert('Could not save: '+(e.message||e));}
}
async function routeDrop(id){
  if(!roleIn('admin'))return;
  if(!confirm('Remove this approval step? Requests already waiting on it will fall to the next step.'))return;
  try{
    const {error}=await SB.from('approval_routes').delete().eq('id',id);
    if(error)throw error;
    audit('route.remove',{id});
    await loadRoutes(true);renderRoutes();
  }catch(e){alert('Could not remove: '+(e.message||e));}
}

/* ══════════════════ FAVOURITES ══════════════════
   Up to ten pages you pick, pinned to the top of the sidebar AND the top of
   the home page — one list, both places, so there is nothing to keep in sync.
   Stored per person per device (same as the bottom bar), because it is a
   personal shortcut rather than company data.
   The star in the top bar toggles the page you are on; "Choose favourites"
   in the mobile menu and on the home row opens the full picker. */
function favKey(){return 'hs_fav_'+((SBUSER&&SBUSER.id)||'anon');}
function favGet(){
  try{const v=JSON.parse(localStorage.getItem(favKey())||'[]');
    return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,FAV_MAX):[];}catch(e){return [];}
}
function favSet(list){
  try{localStorage.setItem(favKey(),JSON.stringify((list||[]).slice(0,FAV_MAX)));}catch(e){}
}
function favHas(v){return favGet().indexOf(v)>=0;}
/* every page this role can actually open, read from the sidebar */
function favOptions(){
  const out=[];
  document.querySelectorAll('.nav .ni').forEach(el=>{
    if(el.closest('#fav-sec'))return; // skip the pinned copies of themselves
    const m=(el.getAttribute('onclick')||'').match(/showView\('([a-z_]+)'/);
    if(!m||m[1]==='home')return;
    if(typeof viewAllowed==='function'&&!viewAllowed(m[1]))return;
    let t='';el.childNodes.forEach(n=>{if(n.nodeType===3)t+=n.textContent;});
    if(!out.some(o=>o[0]===m[1]))out.push([m[1],(t||'').trim()||m[1]]);
  });
  return out;
}
function favTitle(v){
  const hit=favOptions().find(o=>o[0]===v);
  return hit?hit[1]:v;
}
/* toggle the page you are on, from the star in the top bar */
function favToggleCurrent(){
  const v=currentView;
  if(!v||v==='home')return;
  const list=favGet(),i=list.indexOf(v);
  if(i>=0)list.splice(i,1);
  else{
    if(list.length>=FAV_MAX)return alert('That is '+FAV_MAX+' favourites already — remove one first (the star on that page, or Choose favourites).');
    list.push(v);
  }
  favSet(list);favPaint();
  try{audit('favourite.'+(i>=0?'remove':'add'),{view:v});}catch(e){}
}
/* paint: the star's state, the sidebar section, and the home row */
function favPaint(){
  const btn=document.getElementById('fav-btn');
  if(btn){
    const on=favHas(currentView);
    btn.innerHTML=(on?'★':'☆');
    btn.title=on?'Remove this page from your favourites':'Add this page to your favourites';
    btn.style.color=on?'var(--ac)':'var(--tx3)';
    btn.style.display=(currentView&&currentView!=='home')?'':'none';
  }
  favSidebar();
  // the home row is the same list, so it repaints with the sidebar rather than
  // waiting for the next full render of the page
  try{
    const row=document.getElementById('hm-fav');
    if(row&&typeof window._favRow==='function')row.innerHTML=window._favRow();
  }catch(e){}
}
/* the sidebar section, rebuilt from the same list */
function favSidebar(){
  const nav=document.querySelector('.nav');if(!nav)return;
  let sec=document.getElementById('fav-sec');
  const list=favGet().filter(v=>typeof viewAllowed!=='function'||viewAllowed(v));
  if(sec)sec.remove();
  if(!list.length)return;
  sec=document.createElement('div');sec.id='fav-sec';
  const lbl=document.createElement('div');
  lbl.className='nlbl';lbl.textContent='Favourites';
  lbl.setAttribute('onclick','navToggle(this)');      // collapses like every other section
  lbl.title='Click to collapse/expand';
  sec.appendChild(lbl);
  list.forEach(v=>{
    const src=[...document.querySelectorAll('.nav .ni')].find(el=>!el.closest('#fav-sec')&&(el.getAttribute('onclick')||'').indexOf("showView('"+v+"'")>=0);
    const d=document.createElement('div');
    d.className='ni';
    d.setAttribute('onclick',"showView('"+v+"',this)");
    const svg=src&&src.querySelector('svg');
    if(svg)d.appendChild(svg.cloneNode(true));
    d.appendChild(document.createTextNode(favTitle(v)));
    if(v===currentView)d.classList.add('active');   // the rebuild would drop it otherwise
    sec.appendChild(d);
  });
  // Home, then My profile, then the favourites
  const anchor=[...nav.children].find(el=>(el.getAttribute&&el.getAttribute('onclick')||'').indexOf("showView('profile'")>=0)
    ||[...nav.children].find(el=>(el.getAttribute&&el.getAttribute('onclick')||'').indexOf("showView('home'")>=0);
  nav.insertBefore(sec,anchor?anchor.nextSibling:nav.firstChild);
  try{navApplyCollapse();}catch(e){}   // the section was just rebuilt — restore its saved state
}
/* the picker — same shape as the bottom-bar customiser, so it feels familiar */
function favOpen(){
  if(typeof closeMobileMenu==='function')closeMobileMenu();
  window._favSel=favGet().slice();
  const opts=favOptions();
  let ov=document.getElementById('fav-ov');
  if(!ov){ov=document.createElement('div');ov.id='fav-ov';document.body.appendChild(ov);}
  ov.style.cssText='position:fixed;inset:0;z-index:700;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(16px + var(--sat,0px)) 16px calc(24px + env(safe-area-inset-bottom,0px))';
  const chip=(v,t)=>{
    const on=window._favSel.includes(v);
    return '<button data-v="'+v+'" onclick="favToggle(this)" style="margin:0 6px 8px 0;padding:9px 13px;border-radius:20px;font-size:12.5px;cursor:pointer;border:1px solid '+(on?'var(--ac)':'var(--bd)')+';background:'+(on?'var(--ac)':'var(--sf)')+';color:'+(on?'#fff':'var(--tx)')+';font-weight:'+(on?'600':'400')+'">'+esc(t)+'</button>';
  };
  ov.innerHTML=
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:16px">Choose your favourites</b><span style="flex:1"></span>'+
    '<button onclick="favClose()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 14px;font-size:14px;font-weight:700;cursor:pointer">✕</button></div>'+
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:12px">Pick up to <b>'+FAV_MAX+'</b> pages. They pin to the top of the sidebar and the top of your home page — the same list in both places. <span id="fav-n">'+window._favSel.length+'/'+FAV_MAX+'</span></div>'+
    '<div id="fav-chips">'+opts.map(o=>chip(o[0],o[1])).join('')+'</div>'+
    '<div style="display:flex;gap:10px;margin-top:16px">'+
    '<button onclick="favSave()" style="flex:1;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">Save favourites</button>'+
    '<button onclick="favClear()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:13px 16px;font-size:13px;cursor:pointer">Clear all</button></div>';
}
function favToggle(btn){
  const v=btn.getAttribute('data-v');
  window._favSel=window._favSel||[];
  const i=window._favSel.indexOf(v);
  if(i>=0)window._favSel.splice(i,1);
  else{
    if(window._favSel.length>=FAV_MAX){alert('That is '+FAV_MAX+' already — unpick one first.');return;}
    window._favSel.push(v);
  }
  const on=window._favSel.includes(v);
  btn.style.border='1px solid '+(on?'var(--ac)':'var(--bd)');
  btn.style.background=on?'var(--ac)':'var(--sf)';
  btn.style.color=on?'#fff':'var(--tx)';
  btn.style.fontWeight=on?'600':'400';
  const n=document.getElementById('fav-n');if(n)n.textContent=window._favSel.length+'/'+FAV_MAX;
}
function favSave(){
  favSet(window._favSel||[]);
  try{audit('favourite.set',{picks:(window._favSel||[]).join(',')});}catch(e){}
  favClose();favPaint();
  if(currentView==='home'&&typeof renderHome==='function')renderHome();
}
function favClear(){window._favSel=[];favSave();}
function favClose(){const ov=document.getElementById('fav-ov');if(ov)ov.remove();}
