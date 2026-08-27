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
  return '<select onchange="setOwner(\''+esc(acctDedup(name)).replace(/'/g,'&#39;')+'\',this.value)" onclick="event.stopPropagation()" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:7px;padding:5px 7px;font-size:11.5px;max-width:110px">'+
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
    let mtd=0;
    for(const o of SHOPIFY.recent){
      if((o.dt||'').slice(0,7)!==ym||/pull\s*-?\s*out/i.test(o.c||''))continue;
      const t=specCanon(o.t||'');
      if(INTERNAL_TAG.test(t))continue;
      if(myTag&&t.toLowerCase()!==specCanon(myTag).toLowerCase())continue;
      mtd+=(o.ls||[]).reduce((a,l)=>a+(l[2]||0),0);
    }
    let tgt=null;
    if(myTag){const x=(TARGETS||[]).find(x=>x.month===ym&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===specCanon(myTag).toLowerCase());if(x)tgt=x.value;}
    chips.push(chip(fmtPeso(mtd),(myTag?'my':'team')+' booked this month',tgt?Math.round(mtd/tgt*100)+'% of target':'', 'var(--ac)',myTag?'salespace':'salesoverview'));
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
      if(n.classList.contains('ni')||n.id==='lnav')n.style.display=collapsed?'none':'';
      n=n.nextElementSibling;
    }
  });
}


/* ── MOBILE FULL MENU: every view reachable on the phone ── */
function openMobileMenu(){
  const m=$('mmenu');if(!m)return;
  const q=$('mmq');if(q)q.value='';
  buildMobileMenu('');
  m.style.display='block';
  document.body.style.overflow='hidden';
}
function closeMobileMenu(){
  const m=$('mmenu');if(m)m.style.display='none';
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
        if(ROLE==='sales'&&!el.classList.contains('nv-sales'))return;
        const oc=el.getAttribute('onclick')||'';
        if(ROLE==='manager'&&(oc.includes("'users'")||oc.includes("'cutover'")))return;
        const mv=oc.match(/showView\('([a-z]+)'/);
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
  html+='<div style="padding:18px;border-top:2px solid var(--bd);margin-top:8px;font-size:13px;color:var(--tx2)">'+esc(who)+' · '+(ROLE==='sales'?'Sales':ROLE==='manager'?'Sales manager':'Admin')+
    '<div style="display:flex;gap:10px;margin-top:10px">'+
    '<button onclick="closeMobileMenu();openChangePassword()" style="flex:1;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13px">Change password</button>'+
    '<button onclick="roleLogout()" style="flex:1;background:var(--rd-bg);color:var(--rd);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13px;font-weight:600">Sign out</button></div>'+
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
    '<a href="#" onclick="showAccountPage(\''+esc(r.name).replace(/'/g,'&#39;')+'\');return false" style="color:var(--tx);font-weight:600;font-size:12.5px;text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.name)+'</a>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin:2px 0 6px">'+(r.owner?esc(r.owner)+' · ':'')+(days!=null?days+'d since activity':'no activity')+(r.booked?' · '+fmtPeso(r.booked):'')+'</div>'+
    (can?'<div style="display:flex;gap:6px;font-size:11px">'+
      (r.stage!=='lead'?'<a href="#" onclick="stageMove(\''+esc(r.name).replace(/'/g,'&#39;')+'\',\''+r.stage+'\',-1);return false" style="color:var(--tx3)">‹ back</a>':'')+
      (r.stage!=='active'?'<a href="#" onclick="stageMove(\''+esc(r.name).replace(/'/g,'&#39;')+'\',\''+r.stage+'\',1);return false" style="color:var(--gr);font-weight:700">advance ›</a>':'')+
      '<span style="flex:1"></span><a href="#" onclick="stageLost(\''+esc(r.name).replace(/'/g,'&#39;')+'\');return false" style="color:var(--rd)">lost</a></div>':'')+
    '</div>';
  };
  const col=(st,label)=>{
    const cs=rows.filter(r=>r.stage===st).sort((a,b)=>(b.booked||0)-(a.booked||0));
    return '<div style="flex:1;min-width:220px;background:var(--sf2);border-radius:12px;padding:10px;max-height:520px;overflow-y:auto">'+
    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);margin-bottom:8px">'+label+' · '+cs.length+'</div>'+
    cs.slice(0,40).map(card).join('')+(cs.length>40?'<div class="mu" style="font-size:11px;text-align:center">+'+(cs.length-40)+' more (use Accounts to search)</div>':'')+'</div>';
  };
  $('content').innerHTML=
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
    (open.length?'<div style="margin-top:10px">'+open.map(o=>'<div class="drow"><span class="dlbl"><b>'+esc(o.title)+'</b> — <a href="#" onclick="showAccountPage(\''+esc(o.account).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(o.account)+'</a>'+(o.owner_tag?' · '+esc(o.owner_tag):'')+(o.expected_month?' · closes '+esc(o.expected_month):'')+'</span>'+
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
const PO_NO=id=>'PO-'+String(1000+id);
async function renderPOs(){
  if(!roleIn('admin','manager','supply_chain','finance')){$('content').innerHTML='<div class="empty" style="margin-top:40px">Warehouse, finance, and management only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  let pos=[],lines=[];
  try{
    const r1=await SB.from('pos').select('*').order('id',{ascending:false}).limit(100);pos=r1.data||[];
    const r2=await SB.from('po_lines').select('*');lines=r2.data||[];
  }catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — run the purchase-orders SQL from SUPABASE-SETUP.md first.</div>';return;}
  const byPo={};lines.forEach(l=>(byPo[l.po_id]||(byPo[l.po_id]=[])).push(l));
  const suppliers=[...new Set([...(DATA||[]).map(p=>p.supplier).filter(Boolean),...pos.map(p=>p.supplier)])].sort();
  const skuOpts=(DATA||[]).map(p=>'<option value="'+esc(p.sku)+'">'+esc(p.name)+'</option>').join('');
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px"';
  const pill=st=>st==='received'?'<span class="pill pgr">received</span>':st==='partial'?'<span class="pill pbl">partially received</span>':st==='ordered'?'<span class="pill" style="background:var(--am-bg);color:var(--am)">ordered</span>':st==='cancelled'?'<span class="pill prd">cancelled</span>':'<span class="pill pgy">draft</span>';
  const openId=window._poOpen;
  const openArr=pos.filter(p=>p.status==='ordered'||p.status==='partial');
  $('content').innerHTML=
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
      '<b style="font-size:14px">'+PO_NO(p.id)+'</b> '+pill(p.status)+'<span class="mu" style="font-size:12px">'+esc(p.supplier)+(p.eta?' · ETA '+esc(p.eta):'')+'</span>'+
      '<span style="flex:1"></span><span class="mu" style="font-size:12px">'+done+' / '+tot+' units received</span><span style="color:var(--ac);font-size:12px">'+(opened?'▲':'▼')+'</span></div>'+
      (opened?'<div style="margin-top:10px">'+
        (ls.length?'<div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th style="text-align:right">Ordered</th><th style="text-align:right">Received</th><th style="text-align:right">Unit cost</th><th></th></tr></thead><tbody>'+
        ls.map(l=>'<tr><td>'+esc(l.sku)+'</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(l.name||'')+'</td><td class="r">'+l.qty+'</td><td class="r" style="font-weight:700;color:'+((l.received||0)>=l.qty?'var(--gr)':'var(--tx)')+'">'+(l.received||0)+'</td><td class="r mu">'+(l.unit_cost?fmtPeso(l.unit_cost):'—')+'</td>'+
        '<td>'+((p.status==='ordered'||p.status==='partial')&&(l.received||0)<l.qty?'<a href="#" onclick="poReceive('+p.id+','+l.id+',\''+esc(l.sku)+'\','+l.qty+','+(l.received||0)+');return false" style="color:var(--gr);font-size:11.5px;font-weight:700">receive…</a>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="mu" style="font-size:12px">No lines yet.</div>')+
        apBlock(p)+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">'+
        (p.status==='draft'?'<input id="pl-sku-'+p.id+'" list="pl-skus" placeholder="SKU" '+inp+' style="width:150px;'+inp.slice(7,-1)+'"><datalist id="pl-skus">'+skuOpts+'</datalist>'+
          '<input id="pl-qty-'+p.id+'" type="number" placeholder="Qty" '+inp+' style="width:90px;'+inp.slice(7,-1)+'">'+
          '<input id="pl-cost-'+p.id+'" type="number" placeholder="Unit cost ₱ (opt.)" '+inp+' style="width:150px;'+inp.slice(7,-1)+'">'+
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
    const {error}=await SB.from('pos').update({status:st,updated_at:new Date().toISOString()}).eq('id',poId);
    if(error)throw error;
    audit('po.'+st,{po:PO_NO(poId)});
    renderPOs();
  }catch(e){alert(e.message||e);}
}
async function poReceive(poId,lineId,sku,qty,got){
  if(!canWarehouse())return alert('Receiving is admin + supply chain.');
  const left=qty-got;
  const n=parseInt(prompt('Receiving '+sku+' — how many units? ('+left+' outstanding)',String(left))||'0',10);
  if(!n||n<1)return;
  if(n>left&&!confirm(n+' is more than the '+left+' outstanding — receive anyway?'))return;
  const batch=(prompt('Batch / lot number (from the box):','')||'').trim();
  const expiry=(prompt('Expiry (MM/YYYY):','')||'').trim();
  try{
    await ledgerAdd([{sku,qty:n,kind:'receive',ref:PO_NO(poId),batch:batch||null,note:expiry?('exp '+expiry):null}]);
    const {error}=await SB.from('po_lines').update({received:got+n}).eq('id',lineId);
    if(error)throw error;
    const {data:ls}=await SB.from('po_lines').select('qty,received').eq('po_id',poId);
    const full=(ls||[]).every(l=>(l.received||0)>=l.qty);
    await SB.from('pos').update({status:full?'received':'partial',updated_at:new Date().toISOString()}).eq('id',poId);
    audit('po.receive',{po:PO_NO(poId),sku,qty:n,batch});
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
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Managers and admins only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  let rows=[];
  try{const {data}=await SB.from('approvals').select('*').order('id',{ascending:false}).limit(200);rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — run the finance-suite SQL from SUPABASE-SETUP.md first.</div>';return;}
  const pend=rows.filter(r=>r.status==='pending');
  const pill=st=>st==='approved'?'<span class="pill pgr">approved</span>':st==='rejected'?'<span class="pill prd">rejected</span>':'<span class="pill" style="background:var(--am-bg);color:var(--am)">pending</span>';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:12px">'+
    '<div class="met am"><div class="met-lbl">Awaiting decision</div><div class="met-val">'+pend.length+'</div><div class="met-sub">orders held from fulfillment</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Held value</div><div class="met-val" style="font-size:15px">'+fmtPeso(pend.reduce((a,r)=>a+(r.amount||0),0))+'</div><div class="met-sub">released on approval</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>When</th><th>Type</th><th>Account</th><th>Order</th><th style="text-align:right">Amount</th><th>Why held</th><th>By</th><th>Status</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td class="mu" style="font-size:11px">'+esc(String(r.created_at||'').slice(0,16).replace('T',' '))+'</td>'+
      '<td>'+(r.kind==='credit'?'<span class="pill prd">credit hold</span>':'<span class="pill pbl">big order</span>')+'</td>'+
      '<td style="max-width:170px;overflow:hidden;text-overflow:ellipsis"><a href="#" onclick="showAccountPage(\''+esc(r.account).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(r.account)+'</a></td>'+
      '<td><a href="#" onclick="showOrderPage(\''+esc(r.order_id||'').replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(r.order_label||'—')+'</a></td>'+
      '<td class="r" style="font-weight:700">'+fmtPeso(r.amount||0)+'</td>'+
      '<td class="mu" style="font-size:11.5px;max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(r.reason||'')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+esc(r.requested_name||'')+'</td>'+
      '<td>'+pill(r.status)+'</td>'+
      '<td style="white-space:nowrap">'+(r.status==='pending'?'<a href="#" onclick="approvalAct('+r.id+',\'approved\');return false" style="color:var(--gr);font-weight:700;font-size:11.5px">approve ✓</a> · <a href="#" onclick="approvalAct('+r.id+',\'rejected\');return false" style="color:var(--rd);font-size:11.5px">reject ✗</a>':'')+'</td></tr>').join(''):
    '<tr><td colspan="9"><div class="empty">Nothing waiting — orders that trip a credit limit or the big-order threshold land here.</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Approve = the order is released to the fulfillment queue · reject = the order is cancelled with the reason on record · thresholds: credit limit per account (set by finance on account pages) and the big-order threshold below</span></div></div>'+
    (ROLE==='admin'?'<div class="panel" style="padding:10px 14px;margin-top:12px;font-size:12px"><b>Big-order threshold:</b> orders above ₱<span id="ap-thr">'+((window.FLAGS&&FLAGS.approval_threshold)?Number(FLAGS.approval_threshold).toLocaleString():'—')+'</span> from specialists need sign-off · <a href="#" onclick="setApprovalThreshold();return false" style="color:var(--ac)">change</a> (blank = off)</div>':'');
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
    if(r.order_id){
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
    const k=cn.toLowerCase();const m=(SHOPIFY.specialists[raw].monthly||{})[ym];
    if(!S[k])S[k]={name:cn,v:0};
    if(m)S[k].v+=m.v||0;
  }
  const tgtOf=k=>{const x=(TARGETS||[]).find(x=>x.month===ym&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===k);return x?x.value:null;};
  const rateFor=att=>{let r=0;for(const t of rules.slice().sort((a,b)=>a.min-b.min))if(att>=t.min)r=t.pct;return r;};
  const rows=Object.keys(S).map(k=>{
    const e=S[k],T=tgtOf(k);
    const att=T?e.v/T*100:null;
    const pct=att!=null?rateFor(att):0;
    return {name:e.name,booked:e.v,T,att,pct,comm:Math.round(e.v*pct/100)};
  }).filter(r=>r.booked>0||r.T).sort((a,b)=>b.comm-a.comm);
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
    '<div class="met bl"><div class="met-lbl">Team booked</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.booked,0))+'</div><div class="met-sub">commissionable sales</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Earning</div><div class="met-val">'+rows.filter(r=>r.comm>0).length+' / '+rows.length+'</div><div class="met-sub">specialists above tier 1</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Specialist</th><th style="text-align:right">Booked</th><th style="text-align:right">Target</th><th style="text-align:right">Attainment</th><th style="text-align:right">Rate</th><th style="text-align:right">Commission</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td style="font-weight:600">'+esc(r.name)+'</td><td class="r">'+fmtPeso(r.booked)+'</td><td class="r mu">'+(r.T!=null?fmtPeso(r.T):'—')+'</td>'+
      '<td class="r" style="font-weight:600;color:'+(r.att==null?'var(--tx3)':r.att>=100?'var(--gr)':r.att>=80?'var(--am)':'var(--rd)')+'">'+(r.att!=null?r.att.toFixed(0)+'%':'no target')+'</td>'+
      '<td class="r">'+r.pct+'%</td><td class="r" style="font-weight:800;color:var(--ac)">'+fmtPeso(r.comm)+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Commission = booked × the rate of the highest tier reached · based on booked sales (switch to collected later if policy changes) · export is the payroll input — payroll itself stays outside HQ · rate changes are audited</span></div></div>';
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
  const h=['Specialist','Month','Booked','Target','Attainment %','Rate %','Commission'];
  const body=rows.map(r=>[r.name,window._commYm,r.booked,r.T||'',r.att!=null?r.att.toFixed(1):'',r.pct,r.comm].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));
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
    if(['fx_total','amount_paid','peso_value'].includes(field))patch[field]=v.trim()===''?null:Math.round(parseFloat(v.replace(/,/g,''))*100)/100;
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
  const cell=(field,label,val,fmt)=>'<div class="drow"><span class="dlbl">'+label+'</span><span class="dval">'+(val!=null&&val!==''?esc(fmt?fmt(val):String(val)):'—')+(ed?' <a href="#" onclick="apSet('+p.id+',\''+field+'\',\''+label+'\',\''+esc(String(val==null?'':val)).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac);font-size:10px">✎</a>':'')+'</span></div>';
  return '<div style="background:var(--sf2);border-radius:10px;padding:10px 14px;margin-top:10px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:4px">Supplier AP</div>'+
    cell('terms','Terms',p.terms)+
    cell('proforma','Proforma invoice',p.proforma)+
    cell('currency','Currency',p.currency||'PHP')+
    cell('fx_total','Invoice total ('+(p.currency||'PHP')+')',p.fx_total,v=>Number(v).toLocaleString())+
    cell('amount_paid','Paid ('+(p.currency||'PHP')+')',p.amount_paid,v=>Number(v).toLocaleString())+
    '<div class="drow"><span class="dlbl">Balance</span><span class="dval" style="font-weight:700;color:'+(bal>0?'var(--rd)':'var(--gr)')+'">'+(bal!=null?Number(bal).toLocaleString():'—')+'</span></div>'+
    cell('peso_value','Est. value in ₱ (open)',p.peso_value,v=>fmtPeso(v))+
    '</div>';
}

/* ══════════ QUOTATIONS — formal quotes, print, convert to order ══════════ */
let QUOTES=null,QCART=[];
async function loadQuotes(force){
  if(QUOTES&&!force)return QUOTES;
  try{const {data}=await SB.from('quotes').select('*,quote_lines(*)').order('created_at',{ascending:false}).limit(500);QUOTES=data||[];}
  catch(e){QUOTES=[];}
  return QUOTES;
}
const qtLabel=q=>'QT-'+String(q.num||0).padStart(4,'0');
function qtMine(q){
  const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
  return !myTag||specCanon(q.spec||'').toLowerCase()===specCanon(myTag).toLowerCase();
}
async function renderQuotes(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
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
  $('content').innerHTML=
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
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  await loadPromos(true);
  const canW=roleIn('admin','marketing');
  const today=new Date().toISOString().slice(0,10);
  const live=PROMOS.filter(p=>p.active&&p.start_date<=today&&p.end_date>=today);
  const inp='style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px"';
  const lbl='style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin:8px 0 3px"';
  const mech=p=>p.mechanic==='pct'?(p.pct+'% off'):('buy '+p.buy_n+' get '+p.free_m+' free');
  $('content').innerHTML=
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
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
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
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Expired</div><div class="met-val">'+expd+'</div><div class="met-sub">renew before the next import</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Expiring ≤ 6 months</div><div class="met-val">'+soon+'</div><div class="met-sub">start renewal now — FDA takes months</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Registered</div><div class="met-val">'+regd+' / '+items.length+'</div><div class="met-sub">SKUs with a CPR/FDA number</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>Type</th><th>Registration no.</th><th>Status</th>'+(canW?'<th></th>':'')+'</tr></thead><tbody>'+
    items.map(x=>'<tr><td style="font-weight:600">'+esc(x.sku)+'</td><td>'+esc(x.name||'')+'</td><td class="mu">'+esc(x.reg_type||'—')+'</td><td>'+esc(x.reg_no||'—')+'</td><td>'+pill(x)+'</td>'+
      (canW?'<td><a href="#" onclick="regEdit(\''+esc(x.sku).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac);font-size:11.5px">edit</a></td>':'')+
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

/* ── late INIT (js/10 loads last, so calls here see every module) ── */
try{navApplyCollapse();}catch(e){} // the js/09 call runs before this file loads — THIS one is the real startup apply
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
    const m={};for(const l of (data||[]))m[String(l.sku).toLowerCase()]=(m[String(l.sku).toLowerCase()]||0)+(l.qty||0);
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
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  let sessions=[];
  try{const {data}=await SB.from('count_sessions').select('*').order('id',{ascending:false}).limit(20);sessions=data||[];}catch(e){}
  const last=sessions[0];
  const pct=x=>x&&x.skus?Math.round(x.matched/x.skus*100):null;
  const clean2=sessions.length>=2&&sessions.slice(0,2).every(x=>x.skus&&x.matched===x.skus);
  const lines=[...new Set((DATA||[]).map(p=>p.line).filter(Boolean))].sort();
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met '+(last&&pct(last)===100?'gr':'am')+'"><div class="met-lbl">Last count</div><div class="met-val">'+(last?pct(last)+'%':'—')+'</div><div class="met-sub">'+(last?esc((last.closed_at||'').slice(0,10))+' · '+last.matched+'/'+last.skus+' matched':'none yet')+'</div><div class="met-bar"></div></div>'+
    '<div class="met '+(clean2?'gr':'bl')+'"><div class="met-lbl">Cutover evidence</div><div class="met-val">'+(clean2?'READY ✓':(sessions.filter(x=>x.skus&&x.matched===x.skus).length)+' / 2')+'</div><div class="met-sub">two consecutive 100% counts retire the sheet</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Sessions</div><div class="met-val">'+sessions.length+'</div><div class="met-sub">all recorded, all audited</div><div class="met-bar"></div></div>'+
    '</div>'+
    (canW?'<div class="panel" style="padding:16px;margin-bottom:14px"><div class="phd">Start a count</div>'+
      '<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">Blind count: expected quantities stay hidden until you close the session. Count physically, type what you see.</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button onclick="ccStart(\'\')" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:11px 18px;font-size:13px;font-weight:700;cursor:pointer">Count everything</button>'+
      lines.map(l=>'<button onclick="ccStart(\''+esc(l).replace(/'/g,'&#39;')+'\')" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px 14px;font-size:12.5px;cursor:pointer">'+esc(l)+'</button>').join('')+
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
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
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
  $('content').innerHTML=
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
