/* ── PHASE A OWNERSHIP · BATCH RECALL TRACE · CATALOG DEAL DEFINITIONS ── */

// Account ownership: every account gets an owning specialist (PRD Phase A)
let OWNERS=null;
async function loadOwners(force){
  if(OWNERS&&!force)return OWNERS;
  OWNERS={};
  window.STAGES={};
  try{
    const {data}=await SB.from('accounts').select('name,owner_tag,stage,lost_reason');
    (data||[]).forEach(r=>{const k=custNorm(acctDedup(r.name));if(r.owner_tag)OWNERS[k]=r.owner_tag;if(r.stage)window.STAGES[k]={stage:r.stage,lost:r.lost_reason};});
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
  try{localStorage.setItem(navKey(el),collapsed?'1':'0');}catch(e){}
  navApplyCollapse();
}
function navApplyCollapse(){
  document.querySelectorAll('.nav .nlbl').forEach(lbl=>{
    let collapsed=false;
    try{collapsed=localStorage.getItem(navKey(lbl))==='1';}catch(e){}
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
