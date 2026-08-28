/* ── TARGET SETTING — admins & sales managers set monthly ₱ targets per specialist.
   In-app targets OVERRIDE the sheet/corporate numbers for the same specialist+month;
   every target view and specialist page picks them up automatically. ── */
let SPEC_TGT=null;
async function loadSpecTargets(force){
  if(SPEC_TGT&&!force)return SPEC_TGT;
  SPEC_TGT=[];
  if(SB){try{const {data}=await SB.from('spec_targets').select('spec,month,amount');SPEC_TGT=data||[];}catch(e){}}
  mergeSpecTargets();
  return SPEC_TGT;
}
function mergeSpecTargets(){
  if(!SPEC_TGT||!SPEC_TGT.length)return;
  TARGETS=(TARGETS||[]).filter(t=>!(t.scope==='SPECIALIST'&&SPEC_TGT.some(s=>s.month===t.month&&specCanon(s.spec).toLowerCase()===specCanon(t.name||'').toLowerCase())));
  for(const s of SPEC_TGT)TARGETS.push({month:s.month,scope:'SPECIALIST',name:s.spec,value:s.amount});
}
async function renderTargets(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  await loadSpecTargets();
  await loadSpecRoster();
  const ym=window._tgSetYm||new Date().toISOString().slice(0,7);window._tgSetYm=ym;
  const prev=(function(){const d=new Date(ym+'-15');d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7);})();
  const specs=specNames();
  const mine=s=>(SPEC_TGT||[]).find(x=>x.month===ym&&specCanon(x.spec).toLowerCase()===specCanon(s).toLowerCase());
  const sheet=s=>{const t=(TARGETS||[]).find(x=>x.month===ym&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===specCanon(s).toLowerCase()&&!mine(s));return t?t.value:null;};
  const prevOf=s=>{const t=(TARGETS||[]).find(x=>x.month===prev&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===specCanon(s).toLowerCase());return t?t.value:null;};
  const inp='style="width:150px;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:13px;text-align:right"';
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">'+
    '<b style="font-size:13px">Month</b><input type="month" value="'+ym+'" onchange="window._tgSetYm=this.value;renderTargets()" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12.5px">'+
    '<button onclick="tgCopyPrev()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">Copy from '+prev+'</button>'+
    '<button onclick="specAdd()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">+ Add specialist</button>'+
    '<span style="flex:1"></span>'+
    '<button onclick="tgSaveAll()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">Save all</button></div>'+
    '<div id="tg-msg" style="min-height:16px;font-size:12px;margin-bottom:8px"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Specialist</th><th style="text-align:right">Target for '+ym+' (₱)</th><th style="text-align:right">Currently in effect</th><th style="text-align:right">Last month</th><th></th></tr></thead><tbody>'+
    specs.map(s=>{const m=mine(s),sh=sheet(s);
      return '<tr><td style="font-weight:600">'+esc(s)+'</td>'+
      '<td class="r"><input class="tg-in" data-spec="'+esc(s)+'" type="number" min="0" step="1000" value="'+(m?m.amount:'')+'" placeholder="'+(sh!=null?sh:'—')+'" '+inp+'></td>'+
      '<td class="r">'+(m?'<b>'+fmtPeso(m.amount)+'</b> <span class="pill pgr" style="font-size:9px">set here</span>':sh!=null?fmtPeso(sh)+' <span class="pill pgy" style="font-size:9px">sheet</span>':'<span class="mu">none</span>')+'</td>'+
      '<td class="r mu">'+(prevOf(s)!=null?fmtPeso(prevOf(s)):'—')+'</td>'+
      '<td style="white-space:nowrap">'+(m?'<a href="#" onclick="tgClear(\''+jsq(s)+'\');return false" style="color:var(--rd);font-size:11px">clear</a> ':'')+
      (ROLE==='admin'?'<a href="#" onclick="specDeact(\''+jsq(s)+'\');return false" title="Hide from pickers & targets — history is kept" style="color:var(--tx3);font-size:11px">deactivate</a>':'')+'</td></tr>';}).join('')+
    '</tbody></table></div><div class="tfooter"><span>Targets set here override the sheet/corporate numbers for that specialist & month, everywhere (Vs target, Specialists, their own pages) · blank = keep the sheet value · specialists see targets, only admins & sales managers set them · deactivating hides a PS from pickers and this list; every record they ever made stays</span></div></div>'+
    (function(){const inact=(SPEC_ROSTER||[]).filter(r=>!r.active);
      return inact.length&&ROLE==='admin'?'<div class="panel" style="padding:10px 16px;margin-top:12px;font-size:12px"><b>Inactive specialists:</b> '+
        inact.map(r=>esc(r.spec)+' <a href="#" onclick="specReact(\''+jsq(r.spec)+'\');return false" style="color:var(--gr);font-size:11px">reactivate</a>').join(' · ')+'</div>':'';})();
}
async function tgSaveAll(){
  if(!canManage()||!SB)return;
  const ym=window._tgSetYm;const msg=$('tg-msg');
  const rows=[...document.querySelectorAll('.tg-in')].map(i=>({spec:i.dataset.spec,v:i.value.trim()})).filter(r=>r.v!==''&&!isNaN(parseFloat(r.v)));
  if(!rows.length){if(msg){msg.style.color='var(--am)';msg.textContent='Nothing entered — type amounts first (blank rows keep their sheet value).';}return;}
  try{
    const {error}=await SB.from('spec_targets').upsert(rows.map(r=>({spec:r.spec,month:ym,amount:Math.round(parseFloat(r.v)),set_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()})));
    if(error)throw error;
    audit('targets.set',{month:ym,specialists:rows.length});
    await loadSpecTargets(true);
    renderTargets();
    const m2=$('tg-msg');if(m2){m2.style.color='var(--gr)';m2.textContent=rows.length+' target'+(rows.length>1?'s':'')+' saved for '+ym+'.';}
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not save: '+(e.message||e)+(String(e.message||'').includes('spec_targets')?' — run the spec_targets SQL from SUPABASE-SETUP.md first.':'');}}
}
async function tgClear(spec){
  if(!canManage()||!SB)return;
  if(!confirm('Remove the in-app target for '+spec+' ('+window._tgSetYm+')? The sheet value (if any) takes over again.'))return;
  try{
    const {error}=await SB.from('spec_targets').delete().eq('spec',spec).eq('month',window._tgSetYm);
    if(error)throw error;
    audit('targets.clear',{month:window._tgSetYm,spec});
    await loadSpecTargets(true);renderTargets();
  }catch(e){alert(e.message||e);}
}
function tgCopyPrev(){
  const ym=window._tgSetYm;
  const d=new Date(ym+'-15');d.setMonth(d.getMonth()-1);const prev=d.toISOString().slice(0,7);
  let n=0;
  document.querySelectorAll('.tg-in').forEach(i=>{
    if(i.value.trim()!=='')return;
    const t=(TARGETS||[]).find(x=>x.month===prev&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===specCanon(i.dataset.spec).toLowerCase());
    if(t){i.value=t.value;n++;}
  });
  const msg=$('tg-msg');if(msg){msg.style.color='var(--tx3)';msg.textContent=n?n+' filled from '+prev+' — review, then Save all.':'No '+prev+' targets to copy.';}
}

/* ── SHIPMENT TRACKING (courier / waybill / dispatched / delivered) ── */
async function shipSave(id){
  if(!canManage())return alert('Admins and sales managers only.');
  const courier=(($('sh-courier')||{}).value||'').trim(),waybill=(($('sh-waybill')||{}).value||'').trim();
  try{
    const {error}=await SB.from('orders').update({courier:courier||null,waybill:waybill||null}).eq('id',id);
    if(error)throw error;
    audit('shipment.details',{order:id.slice(0,8),courier,waybill});
    NORDERS=null;renderOrderPage();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('courier')?'\n\n(Run the shipment-columns SQL from SUPABASE-SETUP.md first.)':''));}
}
async function shipMark(id,field){
  if(!canManage())return;
  const label=field==='dispatched_at'?'dispatched':'delivered';
  if(!confirm('Mark this order '+label+' today?'))return;
  try{
    const patch={};patch[field]=new Date().toISOString().slice(0,10);
    const {error}=await SB.from('orders').update(patch).eq('id',id);
    if(error)throw error;
    audit('shipment.'+label,{order:id.slice(0,8)});
    NORDERS=null;renderOrderPage();
  }catch(e){alert('Could not update: '+(e.message||e));}
}
async function shipUnmark(id,field){
  if(!canManage())return;
  try{const patch={};patch[field]=null;
    const {error}=await SB.from('orders').update(patch).eq('id',id);if(error)throw error;
    NORDERS=null;renderOrderPage();
  }catch(e){alert(e.message||e);}
}

/* ── DELIVERY RECEIPT (printable → PDF via the browser print dialog) ── */
async function showDeliveryReceipt(ref){
  currentView='delivery';
  pushRoute('#/d/'+encodeURIComponent(ref));
  $('ptitle').textContent='Delivery receipt';
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Preparing…</div>';
  let o=null;
  if(SB&&/^[0-9a-f-]{30,40}$/i.test(ref)){try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('id',ref).maybeSingle();o=data;}catch(e){}}
  if(!o&&SB&&/HG-/i.test(ref)){try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('ext_ref',ref).maybeSingle();o=data;}catch(e){}}
  if(!o){$('content').innerHTML='<div class="empty" style="margin-top:40px">Order not found.</div>';return;}
  let acct=null;
  if(SB){try{const {data}=await SB.from('accounts').select('*').eq('name',acctDedup(o.account||'')).maybeSingle();acct=data;}catch(e){}}
  // BIR-friendly DR series: assign a permanent DR number on first print (atomic via RPC)
  if(SB&&o.id&&o.source!=='shopify'&&!o.dr_no&&typeof canFulfil==='function'&&canFulfil()){
    try{
      const {data:no,error}=await SB.rpc('next_doc_no',{k:'dr'});
      if(!error&&no){
        const {error:e2}=await SB.from('orders').update({dr_no:no}).eq('id',o.id).is('dr_no',null);
        if(!e2){o.dr_no=no;audit('dr.assign',{order:ordLabel(o),dr:no});}
      }
    }catch(e){} // series not configured yet — DR shows the HS number as before
  }
  const lines=(o.order_lines||[]);
  $('content').innerHTML=
    '<div class="no-print" style="display:flex;gap:10px;margin-bottom:12px">'+
    '<a href="#" onclick="showOrderPage(\''+jsq(String(ref))+'\');return false" style="color:var(--ac);font-size:12.5px">← Back to order</a><span style="flex:1"></span>'+
    '<button onclick="window.print()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">🖨 Print / Save PDF</button></div>'+
    '<div class="printdoc">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div>'+hsLogo(34,'#00168F')+'<div style="font-size:19px;font-weight:800;margin-top:5px">HEALTHSPAN GLOBAL, INC.</div><div style="font-size:12px;color:#555">Delivery Receipt</div></div>'+
    '<div style="text-align:right;font-size:12px"><b style="font-size:15px">DR '+esc(o.dr_no||ordLabel(o))+'</b>'+(o.dr_no?'<br>Order: '+esc(ordLabel(o)):'')+'<br>Order date: '+esc(o.date)+'<br>Printed: '+new Date().toISOString().slice(0,10)+'</div></div>'+
    '<div style="display:flex;gap:30px;margin:14px 0;font-size:12.5px">'+
    '<div style="flex:1"><b>Deliver to</b><br>'+esc(o.account||'—')+
      (acct&&acct.address?'<br>'+esc(acct.address):'')+(acct&&acct.phone?'<br>'+esc(acct.phone):'')+
      (acct&&acct.delivery_notes?'<br><i style="color:#555">'+esc(acct.delivery_notes)+'</i>':'')+'</div>'+
    '<div><b>Specialist</b><br>'+esc(o.spec||'—')+'</div>'+
    '<div><b>Courier</b><br>'+esc(o.courier||'________________')+'<br><b>Waybill</b> '+esc(o.waybill||'____________')+'</div></div>'+
    '<table><thead><tr><th>#</th><th>Product</th><th>SKU</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+
    lines.map((l,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(l.name||l.sku)+'</b>'+(l.is_free?' (FREE)':'')+'</td><td>'+esc(l.sku)+'</td><td style="text-align:center">'+l.qty+'</td><td style="text-align:right">'+((l.amount||0)>0?fmtPeso(l.amount):'₱0')+'</td></tr>').join('')+
    '</tbody></table>'+
    '<div style="text-align:right;font-size:12px;margin-top:6px;color:#333">VATable sales: '+fmtPeso(Math.round((o.total||0)/1.12))+'<br>12% VAT: '+fmtPeso((o.total||0)-Math.round((o.total||0)/1.12))+'</div>'+
    '<div style="text-align:right;font-weight:700;font-size:14px;margin-top:2px">TOTAL (VAT inclusive): '+fmtPeso(o.total)+'</div>'+
    (o.order_note||o.notes?'<div style="font-size:12px;margin-top:8px"><b>Notes:</b> '+esc(o.order_note||o.notes)+'</div>':'')+
    '<div style="font-size:11px;color:#555;margin-top:14px">Received the above goods in good order and condition.</div>'+
    '<div style="display:flex;gap:40px;margin-top:34px;font-size:12px">'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Released by · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Courier / driver · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Received by (printed name & signature) · date</div></div>'+
    '</div>';
}

/* ── CUSTOMER STATEMENT (printable per-account: orders, payments, balance, aging) ── */
async function showStatement(name){
  currentView='statement';
  pushRoute('#/m/'+encodeURIComponent(name));
  $('ptitle').textContent='Statement';
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Preparing…</div>';
  await loadNativeOrders();
  if(!ACCTBYNORM)buildAcctIdx();
  const e=ACCTBYNORM[custNorm(acctDedup(name))];
  if(!e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Account not found.</div>';return;}
  const nameSet=new Set();
  const addNames=x=>{for(const n of x.names)nameSet.add(String(n).trim().toLowerCase());};
  addNames(e);(e.children||[]).forEach(k=>{if(ACCTBYNORM[k])addNames(ACCTBYNORM[k]);});
  let acct=null;
  if(SB){try{const {data}=await SB.from('accounts').select('*').eq('name',e.name).maybeSingle();acct=data;}catch(err){}}
  const os=(NORDERS||[]).filter(o=>!o.deleted_at&&o.status!=='cancelled'&&o.pay_status!=='refunded'&&nameSet.has(String(o.account||'').trim().toLowerCase()))
    .sort((a,b)=>a.date<b.date?-1:1);
  const today=Date.now();
  const bucket=o=>{
    if((o.balance||0)<=0)return null;
    const due=new Date(o.date).getTime()+((o.terms_days||0)*864e5);
    const d=Math.floor((today-due)/864e5);
    return d<=0?'cur':d<=30?'d30':d<=60?'d60':'d90';
  };
  const B={cur:0,d30:0,d60:0,d90:0};let billed=0,paid=0,due=0;
  os.forEach(o=>{billed+=o.total||0;paid+=o.paid||0;due+=o.balance||0;const b=bucket(o);if(b)B[b]+=o.balance||0;});
  const stat=o=>o.pay_status==='paid'?'Paid':o.pay_status==='partial'?'Partial':'Unpaid';
  $('content').innerHTML=
    '<div class="no-print" style="display:flex;gap:10px;margin-bottom:12px">'+
    '<a href="#" onclick="showAccountPage(\''+jsq(e.name)+'\');return false" style="color:var(--ac);font-size:12.5px">← Back to account</a><span style="flex:1"></span>'+
    '<button onclick="window.print()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">🖨 Print / Save PDF</button></div>'+
    '<div class="printdoc">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div>'+hsLogo(34,'#00168F')+'<div style="font-size:19px;font-weight:800;margin-top:5px">HEALTHSPAN GLOBAL, INC.</div><div style="font-size:12px;color:#555">Statement of Account</div></div>'+
    '<div style="text-align:right;font-size:12px">As of <b>'+new Date().toISOString().slice(0,10)+'</b></div></div>'+
    '<div style="margin:14px 0;font-size:12.5px"><b>'+esc(e.name)+'</b>'+(e.children&&e.children.length?' (incl. '+e.children.length+' branches)':'')+
    (acct&&acct.address?'<br>'+esc(acct.address):'')+(acct&&acct.phone?'<br>'+esc(acct.phone):'')+'</div>'+
    '<table><thead><tr><th>Date</th><th>Order</th><th>Status</th><th style="text-align:center">Terms</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th></tr></thead><tbody>'+
    os.map(o=>'<tr'+((o.balance||0)>0?' style="font-weight:600"':'')+'><td>'+esc(o.date)+'</td><td>'+esc(ordLabel(o))+'</td><td>'+stat(o)+'</td>'+
      '<td style="text-align:center">'+(o.terms_days?o.terms_days+'d':'—')+'</td>'+
      '<td style="text-align:right">'+fmtPeso(o.total||0)+'</td><td style="text-align:right">'+fmtPeso(o.paid||0)+'</td>'+
      '<td style="text-align:right">'+((o.balance||0)>0?fmtPeso(o.balance):'—')+'</td></tr>').join('')+
    '<tr style="font-weight:800;border-top:2px solid #333"><td colspan="4">TOTAL</td><td style="text-align:right">'+fmtPeso(billed)+'</td><td style="text-align:right">'+fmtPeso(paid)+'</td><td style="text-align:right">'+fmtPeso(due)+'</td></tr>'+
    '</tbody></table>'+
    (due>0?'<div style="margin-top:14px;font-size:12.5px"><b>Aging of outstanding balance</b>'+
    '<table style="margin-top:4px"><thead><tr><th>Current</th><th>1–30 days past due</th><th>31–60 days</th><th>Over 60 days</th><th>Total due</th></tr></thead>'+
    '<tbody><tr><td>'+fmtPeso(B.cur)+'</td><td>'+fmtPeso(B.d30)+'</td><td>'+fmtPeso(B.d60)+'</td><td style="font-weight:700">'+fmtPeso(B.d90)+'</td><td style="font-weight:800">'+fmtPeso(due)+'</td></tr></tbody></table></div>'
    :'<div style="margin-top:14px;font-size:13px;font-weight:700">No outstanding balance — account fully settled. Thank you!</div>')+
    '<div style="font-size:10px;color:#777;margin-top:16px">Cancelled and refunded orders excluded · terms per order notes · please contact Healthspan for any discrepancy</div>'+
    '</div>';
}

/* ── ACCOUNTING EXPORT — period CSV of the order register ── */
function acctExportCSV(){
  const from=($('ax-from')||{}).value||'2000-01-01',to=($('ax-to')||{}).value||'2099-12-31';
  const os=(NORDERS||[]).filter(o=>!o.deleted_at&&o.date>=from&&o.date<=to).sort((a,b)=>a.date<b.date?-1:1);
  if(!os.length)return alert('No orders in that date range.');
  const h=['Order','Ext ref','Date','Account','Specialist','Status','Pay status','Terms (days)','Total (VAT inc)','VATable (net)','VAT 12%','Paid','Balance','Source'];
  const rows=os.map(o=>{const net=Math.round((o.total||0)/1.12);
    return [ordLabel(o),o.ext_ref||'',o.date,o.account||'',o.spec||'',o.status,o.pay_status||'',o.terms_days||'',o.total||0,net,(o.total||0)-net,o.paid||0,o.balance||0,o.source||'native']
    .map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');});
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent([h.join(','),...rows].join('\n'));
  a.download='healthspan_orders_'+from+'_to_'+to+'.csv';
  a.click();
  audit('accounting.export',{from,to,orders:os.length});
}

/* ── UNIFIED ACCOUNT INDEX — one entity per customer, merged from every source:
   Verna's OUT sheet (shipped), Shopify (booked), the visit log, and the CRM table ── */
let ACCTBYNORM=null;
// Shopify displayName artifact: company name doubled ("X X" or "X X - Branch") → collapse
function acctDedup(s){const m=String(s||'').match(/^(.{4,}?)\s+\1(\s*-\s*.+)?$/);return m?(m[1]+(m[2]||'')).trim():String(s||'').trim();}
/* Curated links live in Supabase (account_links): kind 'merge' = same customer under a
   different spelling → fold into the target; kind 'branch' = child clinic of a parent.
   Editable in-app by admins & sales managers. */
let ACCT_LINKS=null;
async function loadAcctLinks(force){
  if(ACCT_LINKS&&!force)return ACCT_LINKS;
  ACCT_LINKS=[];
  if(SB){try{const {data}=await SB.from('account_links').select('from_key,from_name,to_name,kind');ACCT_LINKS=data||[];}catch(e){}}
  ACCTBYNORM=null; // next index build applies the links
  return ACCT_LINKS;
}
function buildAcctIdx(){
  ACCTBYNORM={};
  const alias={};
  for(const l of (ACCT_LINKS||[]))if(l.kind==='merge')alias[l.from_key]=l.to_name;
  const get=(name)=>{
    let disp=acctDedup(name);
    let k=custNorm(disp);if(!k)return null;
    if(alias[k]&&custNorm(alias[k])!==k){disp=alias[k];k=custNorm(disp);if(!k)return null;} // merged spelling → target account
    let e=ACCTBYNORM[k];
    if(!e){e=ACCTBYNORM[k]={name:disp,names:new Set(),sheet:null,shop:null,visitN:0,lastVisit:'',isRemedy:false,children:null,parentKey:null};}
    e.names.add(String(name).trim()); // keep RAW spellings for timeline matching
    e.names.add(disp);
    return e;
  };
  for(const c of (CUSTOMERS||[])){const e=get(c.name);if(!e)continue;e.sheet=c;e.isRemedy=e.isRemedy||!!c.isRemedy;e.name=acctDedup(c.name);}
  for(const n in ((SHOPIFY&&SHOPIFY.customers)||{})){
    if(/pull\s*-?\s*out/i.test(n))continue;
    const e=get(n);if(!e)continue;
    const s=SHOPIFY.customers[n];
    if(!e.shop)e.shop={o:0,u:0,v:0,u90:0,v90:0,l:''};
    e.shop.o+=s.o||0;e.shop.u+=s.u||0;e.shop.v+=s.v||0;e.shop.u90+=s.u90||0;e.shop.v90+=s.v90||0;
    if((s.l||'')>e.shop.l)e.shop.l=s.l;
    if(!e.sheet)e.name=acctDedup(n);
  }
  for(const v of (VISITS||[])){const e=get(v.account);if(!e)continue;e.visitN++;if(v.date>e.lastVisit)e.lastVisit=v.date;}
  // CURATED parent groups — confirmed by the team (Jojo: A one + A2 are both Aivee;
  // verified via Shopify records: Forbestown BGC address, "Cosmelan - Aivee" deals)
  const CURATED_GROUPS={'Aivee Group':['a one skin and laser technologies','a2 skin and laser']};
  for(const pName in CURATED_GROUPS){
    const members=CURATED_GROUPS[pName].map(k=>ACCTBYNORM[k]).filter(Boolean);
    if(!members.length)continue;
    const pk=custNorm(pName);
    const P=ACCTBYNORM[pk]||(ACCTBYNORM[pk]={name:pName,names:new Set([pName]),sheet:null,shop:null,visitN:0,lastVisit:'',isRemedy:false,children:null,parentKey:null,virtual:true});
    for(const m of members){if(m===P||m.parentKey)continue;(P.children=P.children||[]).push(custNorm(m.name));m.parentKey=pk;}
  }
  // Parent/branch grouping — only structurally CONFIRMED: "X - Branch" groups under X
  // when X itself exists as an account, or ≥2 accounts share the "X - " prefix.
  const keys=Object.keys(ACCTBYNORM);
  const prefixCount={};
  for(const k of keys){const n=ACCTBYNORM[k].name;const i=n.indexOf(' - ');
    if(i>3){const p=custNorm(n.slice(0,i));if(p)prefixCount[p]=(prefixCount[p]||0)+1;}}
  for(const k of keys){
    const e=ACCTBYNORM[k];const n=e.name;const i=n.indexOf(' - ');
    if(i<=3)continue;
    const pName=n.slice(0,i).trim();const pk=custNorm(pName);
    if(!pk||pk===k)continue;
    if(ACCTBYNORM[pk]||prefixCount[pk]>=2){
      let P=ACCTBYNORM[pk];
      if(!P)P=ACCTBYNORM[pk]={name:pName,names:new Set([pName]),sheet:null,shop:null,visitN:0,lastVisit:'',isRemedy:e.isRemedy,children:null,parentKey:null,virtual:true};
      (P.children=P.children||[]).push(k);
      e.parentKey=pk;
      P.isRemedy=P.isRemedy||e.isRemedy;
    }
  }
  // curated parent/child links from the database (set in-app by admins & managers)
  for(const l of (ACCT_LINKS||[])){
    if(l.kind!=='branch')continue;
    const ck=l.from_key,pk=custNorm(l.to_name);
    const C=ACCTBYNORM[ck];
    if(!C||C.parentKey||!pk||ck===pk)continue;
    let P=ACCTBYNORM[pk];
    if(P&&P.parentKey===ck)continue; // no cycles
    if(!P)P=ACCTBYNORM[pk]={name:l.to_name,names:new Set([l.to_name]),sheet:null,shop:null,visitN:0,lastVisit:'',isRemedy:C.isRemedy,children:null,parentKey:null,virtual:true};
    (P.children=P.children||[]).push(ck);
    C.parentKey=pk;
    P.isRemedy=P.isRemedy||C.isRemedy;
  }
  return ACCTBYNORM;
}
/* ── MERGE / PARENT-CHILD actions (admin & sales manager) ── */
function canManage(){return ROLE==='admin'||ROLE==='manager';}
function findAcctByName(t){
  if(!ACCTBYNORM)buildAcctIdx();
  const k=custNorm(t);if(!k)return null;
  if(ACCTBYNORM[k])return ACCTBYNORM[k];
  const c=Object.values(ACCTBYNORM).filter(e=>!e.parentKey&&custNorm(e.name).includes(k));
  return c.length===1?c[0]:null;
}
async function linkAccount(fromName,kind,toName){
  if(!canManage())return alert('Admins and sales managers only.');
  if(!SB)return alert('Sign in first.');
  let t=toName;
  if(!t){t=prompt((kind==='merge'?'Merge "'+fromName+'" into which account?':'Which account is the PARENT of "'+fromName+'"?')+'\nType the account name as it appears in the Accounts list:','');if(!t)return;}
  const target=findAcctByName(t);
  if(!target)return alert('No single account matches "'+t+'" — check the exact spelling in the Accounts list.');
  const fk=custNorm(acctDedup(fromName));
  if(custNorm(target.name)===fk)return alert('That’s the same account.');
  const msg=kind==='merge'
    ?'Merge "'+fromName+'" into "'+target.name+'"?\n\nAll its orders, shipments, and visits will show under '+target.name+'. You can undo this from the account page.'
    :'Make "'+fromName+'" a branch of "'+target.name+'"?\n\nIt stays its own account but rolls up into the parent. You can undo this from the account page.';
  if(!confirm(msg))return;
  try{
    const {error}=await SB.from('account_links').upsert({from_key:fk,from_name:fromName,to_name:target.name,kind,created_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('account.'+kind,{from:fromName,to:target.name});
    await loadAcctLinks(true);
    showAccountPage(target.name);
  }catch(e){alert('Could not save the link: '+(e.message||e)+(String(e.message||'').includes('account_links')?'\n\n(The account_links table may not exist yet — run the SQL from SUPABASE-SETUP.md.)':''));}
}
async function unlinkAccount(fromKey,goName){
  if(!canManage())return;
  if(!confirm('Remove this link? The account becomes standalone again.'))return;
  try{
    const {error}=await SB.from('account_links').delete().eq('from_key',fromKey);
    if(error)throw error;
    audit('account.unlink',{key:fromKey});
    await loadAcctLinks(true);
    showAccountPage(goName);
  }catch(e){alert('Could not remove: '+(e.message||e));}
}
// Aggregate an entity + its branches (for the parent's cards and list row)
function acctAgg(e){
  const list=[e,...((e.children||[]).map(k=>ACCTBYNORM[k]).filter(Boolean))];
  const out={shipped:0,booked:0,v90:0,orders:0,visitN:0,last:'',names:new Set()};
  for(const x of list){
    if(x.sheet){out.shipped+=x.sheet.value||0;if((x.sheet.lastOrder||'')>out.last)out.last=x.sheet.lastOrder||'';}
    if(x.shop){out.booked+=x.shop.v||0;out.v90+=x.shop.v90||0;out.orders+=x.shop.o||0;if((x.shop.l||'')>out.last)out.last=x.shop.l;}
    out.visitN+=x.visitN;if(x.lastVisit>out.last)out.last=x.lastVisit;
    for(const n of x.names)out.names.add(n);
  }
  return out;
}
function acctList(){
  if(!ACCTBYNORM)buildAcctIdx();
  return Object.values(ACCTBYNORM).filter(e=>!e.parentKey).map(e=>{
    const a=acctAgg(e);
    const hasSheet=e.sheet||(e.children||[]).some(k=>ACCTBYNORM[k]&&ACCTBYNORM[k].sheet);
    const hasShop=e.shop||(e.children||[]).some(k=>ACCTBYNORM[k]&&ACCTBYNORM[k].shop);
    const src=hasSheet&&hasShop?'both':hasSheet?'sheet':hasShop?'shopify':'prospect';
    return {e,name:e.name,shipped:a.shipped,booked:a.booked,v90:a.v90,last:a.last,src,total:a.shipped+a.booked,branches:(e.children||[]).length};
  }).sort((a,b)=>b.total-a.total);
}

/* ── FULL-PAGE ACCOUNT PROFILE ── */
let CUR_ACCT=null,ACCT_BACK='customers';
let ROUTING=false; // true while applying a route from the URL (prevents push loops)
function pushRoute(h){
  if(ROUTING)return;
  try{if(location.hash!==h)history.pushState(null,'',h);}catch(e){}
}
function applyRoute(){
  const h=location.hash||'';
  ROUTING=true;
  try{
    if(h.startsWith('#/a/')){const n=decodeURIComponent(h.slice(4));if(n){showAccountPage(n);return;}}
    if(h.startsWith('#/o/')){const n=decodeURIComponent(h.slice(4));if(n){showOrderPage(n);return;}}
    if(h.startsWith('#/s/')){const n=decodeURIComponent(h.slice(4));if(n){showSpecPage(n);return;}}
    if(h.startsWith('#/p/')){const n=decodeURIComponent(h.slice(4));if(n){showPickSlip(n);return;}}
    if(h.startsWith('#/d/')){const n=decodeURIComponent(h.slice(4));if(n){showDeliveryReceipt(n);return;}}
    if(h.startsWith('#/m/')){const n=decodeURIComponent(h.slice(4));if(n){showStatement(n);return;}}
    if(h.startsWith('#/v/')){const v=h.slice(4);if(v){showView(v,document.querySelector('.ni[onclick*="\''+v+'\'"]'));return;}}
  }finally{ROUTING=false;}
}
window.addEventListener('popstate',applyRoute);
function showAccountPage(name){
  if(currentView!=='account')ACCT_BACK=currentView||'customers';
  CUR_ACCT=String(name||'').trim();
  currentView='account';
  pushRoute('#/a/'+encodeURIComponent(CUR_ACCT));
  $('ptitle').textContent=CUR_ACCT;
  $('overlay').classList.remove('open');$('drawer').classList.remove('open');
  renderAccountPage();
  injectDesc('account');
}
async function renderAccountPage(){
  const name=CUR_ACCT;if(!name){showView(ACCT_BACK);return;}
  await loadVisits();
  try{await loadOwners();}catch(e){}
  if(!ACCTBYNORM)buildAcctIdx();
  const e=ACCTBYNORM[custNorm(acctDedup(name))]||{name:acctDedup(name),names:new Set([name]),sheet:null,shop:null,visitN:0,lastVisit:'',children:null};
  let acct=null;
  if(SB){try{const {data}=await SB.from('accounts').select('*').eq('name',e.name).maybeSingle();acct=data||null;}catch(err){}}
  const AGG=acctAgg(e);
  const aliases=[...AGG.names];
  // timeline from ALL name variants INCLUDING branches: orders + visits + shipments
  const inNames=new Set(aliases.map(a=>a.trim()));
  const skuName=(()=>{const m={};DATA.forEach(p=>m[p.sku]=p.name);const bs=Object.keys(m).sort((a,b)=>b.length-a.length);
    return s=>{s=String(s).trim();if(m[s])return m[s];const b=bs.find(x=>s.startsWith(x)&&s.length>x.length)||bs.find(x=>x.length>=4&&s.length>x.length&&s.includes(x));return b?m[b]+' (deal)':s;};})();
  await loadOverrides();await loadNativeOrders();
  const orders=window._MIGRATED?[]:((SHOPIFY&&SHOPIFY.recent)||[]).filter(o=>inNames.has((o.c||'').trim())&&!(OVR[o.n]&&OVR[o.n].deleted_at))
    .map(o=>({k:'order',dt:o.dt,who:o.t||'',label:o.n,amt:(o.ls||[]).reduce((x,l)=>x+(l[2]||0),0),ref:o.n}));
  const natOrders=(NORDERS||[]).filter(o=>inNames.has(acctDedup(o.account||''))||inNames.has((o.account||'').trim()))
    .filter(o=>o.status!=='cancelled'&&!o.deleted_at)
    .map(o=>({k:'order',dt:o.date,who:o.spec||'',label:ordLabel(o),amt:o.total,ref:o.id,native:o.source!=='shopify'}));
  orders.push(...natOrders);
  const visits=(VISITS||[]).filter(v=>inNames.has((v.account||'').trim()))
    .map(v=>({k:v.status==='planned'?'plan':'visit',dt:v.date,who:v.spec,label:v.type||'Visit',out:v.outcome,notes:(v.products?'endorsed: '+v.products+(v.notes?' · '+v.notes:''):v.notes),fu:v.outcome==='Follow-up needed'&&!v.fu_done}));
  const ship=[e,...((e.children||[]).map(k=>ACCTBYNORM[k]).filter(Boolean))]
    .flatMap(x=>(x.sheet&&x.sheet.recent||[]).map(r=>({k:'ship',dt:r.date,who:'warehouse',label:r.qty+' × '+r.name,amt:null})));
  const tl=[...orders,...visits,...ship].sort((a,b)=>a.dt<b.dt?1:a.dt>b.dt?-1:0).slice(0,60);
  const openFu=visits.filter(v=>v.fu).length;
  const pill=k=>k==='order'?'<span class="pill pgr">order</span>':k==='plan'?'<span class="pill pbl">planned</span>':k==='ship'?'<span class="pill pgy">shipped</span>':'<span class="pill" style="background:rgba(186,117,23,.15);color:var(--am)">visit</span>';
  const F=(id,label,val,ph)=>'<label style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin:10px 0 4px">'+label+'</label>'+
    '<input id="'+id+'" value="'+esc(val||'')+'" placeholder="'+ph+'" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px">';
  // what they buy (sheet top products, else derive from Shopify orders)
  let buys=(e.sheet&&e.sheet.topProducts||[]).map(t=>({name:t.name,q:t.qty,v:t.value}));
  if(!buys.length&&orders.length){
    const agg={};const sheetSkus=new Set(DATA.map(p=>p.sku));const bases=[...sheetSkus].sort((a,b)=>b.length-a.length);
    const nameOf={};DATA.forEach(p=>nameOf[p.sku]=p.name);
    for(const o of ((SHOPIFY&&SHOPIFY.recent)||[]).filter(o=>inNames.has((o.c||'').trim())))
      for(const [sku,q,a] of (o.ls||[])){
        const s=String(sku).trim();
        const base=sheetSkus.has(s)?s:(bases.find(b=>s.startsWith(b)&&s.length>b.length)||bases.find(b=>b.length>=4&&s.length>b.length&&s.includes(b))||s);
        const isBundle=base!==s&&sheetSkus.has(base);
        const g2=agg[base]||(agg[base]={q:0,v:0});if(!isBundle)g2.q+=q||0;g2.v+=a||0;}
    buys=Object.keys(agg).map(k2=>({name:nameOf[k2]||k2,q:agg[k2].q,v:agg[k2].v})).sort((a,b)=>b.v-a.v||b.q-a.q).slice(0,6);
  }
  $('content').innerHTML=
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">'+
    '<a href="#" onclick="showView(\''+esc(ACCT_BACK)+'\');return false" style="color:var(--ac);font-size:12.5px">← Back</a>'+
    (e.isRemedy?'<span class="pill pbl">sister co.</span>':'')+
    (e.shop?'':'<span class="pill pgy">no Shopify orders</span>')+
    (openFu?'<span class="pill prd">'+openFu+' open follow-up'+(openFu>1?'s':'')+'</span>':'')+
    (canManage()?ownerSelHTML(name):(ownerOf(name)?'<span class="pill pbl">owner: '+esc(ownerOf(name))+'</span>':''))+
    (function(){const l=creditLimitOf(e.name);const ed=roleIn('admin','finance');
      if(l==null&&!ed)return '';
      return '<span class="pill" style="background:var(--am-bg);color:var(--am)'+(ed?';cursor:pointer':'')+'"'+(ed?' onclick="setCreditLimit(\''+jsq(e.name)+'\')" title="Credit limit — tap to change (finance/admin)"':'')+'>limit: '+(l!=null?fmtPeso(l):'set…')+'</span>';})()+
    (function(){try{const st=stageOf({name:e.name,booked:AGG.booked,shipped:AGG.shipped,last:AGG.last,src:e.shop?'shopify':'prospect'});return '<span class="pill" style="background:var(--pu-bg);color:var(--pu)" title="Pipeline stage - manage in the Pipeline view">'+st+'</span>';}catch(ex){return '';}})()+
    (aliases.length>1?'<span class="pill pgy" title="'+esc(aliases.join(' / '))+'">'+aliases.length+' name spellings merged</span>':'')+
    '<span style="flex:1"></span>'+
    '<button onclick="showStatement(\''+jsq(name)+'\')" title="Printable statement of account: orders, payments, balance, aging" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">🖨 Statement</button>'+
    (canManage()&&!e.virtual?'<button onclick="linkAccount(\''+jsq(name)+'\',\'merge\')" title="This is the same customer as another account, under a different spelling" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">⇢ Merge into…</button>'+
    (e.parentKey?'':'<button onclick="linkAccount(\''+jsq(name)+'\',\'branch\')" title="Group this account under a parent company" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">⌂ Set parent…</button>'):'')+
    '<button onclick="window._noAccount=\''+jsq(name)+'\';showView(\'neworder\',null)" style="background:var(--gr);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer">+ New order</button>'+
    '<button onclick="window._lvAccount=\''+jsq(name)+'\';showView(\'logvisit\',null)" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer">+ Log visit here</button>'+
    '<button onclick="commLog(\''+jsq(name)+'\',\'Call\')" title="Log a phone touch — counts like a visit for coverage and dormancy" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">📞 Call</button>'+
    '<button onclick="commLog(\''+jsq(name)+'\',\'Viber\')" title="Log a Viber touch" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">Viber</button>'+
    '</div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Booked (13mo)</div><div class="met-val" style="font-size:15px">'+fmtPeso(AGG.booked)+'</div><div class="met-sub">'+AGG.orders+' Shopify orders'+(e.children?' · all branches':'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Shipped (sheet)</div><div class="met-val" style="font-size:15px">'+fmtPeso(AGG.shipped)+'</div><div class="met-sub">'+(AGG.shipped?'warehouse OUT':'not in OUT sheet')+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Last 90d booked</div><div class="met-val" style="font-size:15px">'+fmtPeso(AGG.v90)+'</div><div class="met-sub">momentum</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Visits logged</div><div class="met-val">'+AGG.visitN+'</div><div class="met-sub">'+(AGG.last?'last activity '+esc(AGG.last):'none yet')+'</div><div class="met-bar"></div></div>'+
    '</div>'+
    ((e.children&&e.children.length)?'<div class="panel" style="padding:12px 16px;margin-bottom:14px"><div class="phd">Branches</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+
      e.children.map(k=>{const c=ACCTBYNORM[k];if(!c)return '';const ca=acctAgg(c);
        return '<a href="#" onclick="showAccountPage(\''+jsq(c.name)+'\');return false" style="color:var(--ac);font-size:12px;background:var(--sf2);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;text-decoration:none">'+esc(c.name.slice(e.name.length).replace(/^\s*-\s*/,''))+' · '+fmtPeso(ca.booked+ca.shipped)+'</a>';}).join('')+'</div></div>':'')+
    (e.parentKey&&ACCTBYNORM[e.parentKey]?'<div style="font-size:12px;margin-bottom:12px">Branch of <a href="#" onclick="showAccountPage(\''+jsq(ACCTBYNORM[e.parentKey].name)+'\');return false" style="color:var(--ac);font-weight:600">'+esc(ACCTBYNORM[e.parentKey].name)+'</a>'+
      (canManage()&&(ACCT_LINKS||[]).some(l=>l.kind==='branch'&&l.from_key===custNorm(e.name))?' · <a href="#" onclick="unlinkAccount(\''+custNorm(e.name)+'\',\''+jsq(e.name)+'\');return false" style="color:var(--rd);font-size:11px">unlink</a>':'')+'</div>':'')+
    (function(){const merged=(ACCT_LINKS||[]).filter(l=>l.kind==='merge'&&custNorm(l.to_name)===custNorm(e.name));
      return merged.length?'<div class="panel" style="padding:10px 16px;margin-bottom:14px;font-size:12px"><div class="phd" style="margin-bottom:6px">Merged into this account</div>'+
        merged.map(l=>'<div style="display:flex;justify-content:space-between;padding:3px 0"><span>'+esc(l.from_name)+'</span>'+(canManage()?'<a href="#" onclick="unlinkAccount(\''+jsq(l.from_key)+'\',\''+jsq(e.name)+'\');return false" style="color:var(--rd);font-size:11px">unmerge</a>':'')+'</div>').join('')+'</div>':'';})()+
    '<div class="g2" style="align-items:start">'+
    '<div>'+
    '<div class="panel" style="padding:16px;margin-bottom:14px"><div class="phd">Timeline — orders, visits, shipments'+(e.children?' (all branches)':'')+'</div>'+
    (tl.length?tl.map(t=>{
      const click=t.k==='order'?' onclick="showOrderPage(\''+jsq(String(t.ref))+'\')" style="cursor:pointer;align-items:flex-start;border-bottom:1px solid var(--bd);padding:8px 0"':' style="align-items:flex-start;border-bottom:1px solid var(--bd);padding:8px 0"';
      return '<div class="drow"'+click+'>'+
        '<span class="dlbl" style="max-width:65%">'+pill(t.k)+(t.native?' <span class="pill pgr">HS</span>':'')+' <b>'+esc(t.label||'')+'</b> · '+esc(t.dt)+(t.k==='order'?' <span style="color:var(--ac);font-size:10px">open →</span>':'')+
        '<br><span style="color:var(--tx3);font-size:11.5px">'+esc(t.who||'')+(t.out?' · '+esc(t.out):'')+(t.notes?' · '+esc(t.notes):'')+'</span></span>'+
        '<span class="dval">'+(t.amt!=null?fmtPeso(t.amt):'')+'</span></div>';
      }).join(''):'<div style="font-size:12px;color:var(--tx3)">Nothing recorded yet — log the first visit.</div>')+'</div>'+
    (buys.length?'<div class="panel" style="padding:16px"><div class="phd">What they buy</div>'+buys.map(b=>'<div class="drow"><span class="dlbl">'+esc(b.name)+'</span><span class="dval">'+(b.q?b.q.toLocaleString()+' u':'')+(b.v?' · '+fmtPeso(b.v):'')+'</span></div>').join('')+'</div>':'')+
    upsellPanelHTML(e.name)+
    '</div>'+
    '<div><div class="panel" style="padding:16px" id="ac-panel">'+acctDetailsHTML(e.name,acct,false)+'</div>'+
    '<div class="panel" style="padding:16px;margin-top:14px" id="ac-contacts"><div class="phd">Contacts</div><div style="font-size:12px;color:var(--tx3)">Loading…</div></div>'+
    '<div class="panel" style="padding:16px;margin-top:14px" id="ac-docs"><div class="phd">Documents</div><div style="font-size:12px;color:var(--tx3)">Loading…</div></div></div>'+
    '</div>';
  try{fillContacts(custNorm(e.name),e.name);}catch(ex){}
  try{fillAcctDocs(e.name);}catch(ex){}
}
/* Documents on an account: LTO/PRC licences, signed DRs, letters. Stored in the
   Healthspan Shared Drive; the account name is the key, so a document follows
   the account even if it is later merged under a different spelling. */
async function fillAcctDocs(name){
  const box=$('ac-docs');if(!box)return;
  const files=(typeof attList==='function')?await attList('account',name):[];
  const canAdd=typeof canManage==='function'?canManage():false;
  box.innerHTML='<div class="phd">Documents</div>'+
    (typeof attBlock==='function'?attBlock('account',name,files,canAdd||roleIn('sales')):'')+
    '<div class="mu" style="font-size:11px;margin-top:8px">Licences (LTO, PRC), signed delivery receipts, agreements \u2014 anything that belongs to this clinic rather than to one order.</div>';
}
/* Details panel: read-only by default, Edit button switches to the form (per Angelo) */
let ACCT_REC=null;
function licPill(exp){ // license expiry status pill
  if(!exp)return'';
  const d=Math.floor((new Date(exp).getTime()-Date.now())/864e5);
  if(d<0)return' <span class="pill prd">expired</span>';
  if(d<=60)return' <span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">expires in '+d+'d</span>';
  return' <span style="color:var(--tx3);font-size:11px">until '+esc(exp)+'</span>';
}
function acctDetailsHTML(name,acct,editing){
  ACCT_REC=acct;
  const lbl=t=>'<div style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin:10px 0 2px">'+t+'</div>';
  const nameArg=jsq(name);
  if(!editing){
    const val=v=>v?esc(v):'<span style="color:var(--tx3)">—</span>';
    return '<div class="phd" style="display:flex;justify-content:space-between;align-items:center">Account details'+
      (SB?'<button onclick="editAccount(\''+nameArg+'\')" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:5px 12px;font-size:11.5px;font-weight:600;cursor:pointer">Edit</button>':'<span style="font-size:10px;color:var(--tx3)">sign in to edit</span>')+'</div>'+
      lbl('Contact person')+val(acct&&acct.contact_person)+
      lbl('Phone')+val(acct&&acct.phone)+
      lbl('Email / Viber')+val(acct&&(acct.email||acct.viber)?esc([acct.email,acct.viber].filter(Boolean).join(' · ')):null)+
      lbl('Address')+val(acct&&acct.address)+
      lbl('Region / City')+val(acct&&(acct.region||acct.city)?esc([acct.region,acct.city].filter(Boolean).join(' · ')):null)+
      lbl('Clinic type')+val(acct&&acct.clinic_type)+
      lbl('Specialty')+val(acct&&acct.specialty)+
      lbl('Tier')+(acct&&acct.tier?'<span class="pill '+(acct.tier==='A'?'pgr':acct.tier==='B'?'pbl':'pam')+'" style="font-weight:700">'+esc(acct.tier)+'</span>':'<span style="color:var(--tx3)">—</span>')+
      lbl('Source')+val(acct&&acct.source)+
      lbl('Delivery notes')+(acct&&acct.delivery_notes?'<div style="font-size:12.5px;white-space:pre-wrap">'+esc(acct.delivery_notes)+'</div>':'<span style="color:var(--tx3);font-size:12.5px">—</span>')+
      lbl('Birthday / anniversary')+val(acct&&(acct.birthday||acct.anniversary)?esc([acct.birthday?'🎂 '+acct.birthday:'',acct.anniversary?'🏥 '+acct.anniversary:''].filter(Boolean).join(' · ')):null)+
      lbl('Licenses')+((acct&&(acct.lto_no||acct.prc_no))?
        '<div style="font-size:12.5px">'+(acct.lto_no?'LTO '+esc(acct.lto_no)+licPill(acct.lto_expiry)+'<br>':'')+(acct.prc_no?'PRC '+esc(acct.prc_no)+licPill(acct.prc_expiry):'')+'</div>'
        :'<span style="color:var(--tx3);font-size:12.5px">—</span>')+
      lbl('Notes')+'<div style="font-size:12.5px;white-space:pre-wrap">'+(acct&&acct.notes?esc(acct.notes):'<span style="color:var(--tx3)">—</span>')+'</div>';
  }
  const F=(id,label,v,ph)=>lbl(label)+'<input id="'+id+'" value="'+esc(v||'')+'" placeholder="'+ph+'" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px">';
  const D=(id,label,v)=>lbl(label)+'<input id="'+id+'" type="date" value="'+esc(v||'')+'" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px">';
  const SEL=(id,label,v,opts)=>lbl(label)+'<select id="'+id+'" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px"><option value="">—</option>'+opts.map(o=>'<option'+(v===o?' selected':'')+'>'+o+'</option>').join('')+'</select>';
  return '<div class="phd">Editing account details</div>'+
    F('ac-person','Contact person',acct&&acct.contact_person,'e.g. Dr. Santos / clinic manager')+
    F('ac-phone','Phone',acct&&acct.phone,'')+
    F('ac-email','Email',acct&&acct.email,'clinic@…')+
    F('ac-viber','Viber',acct&&acct.viber,'if different from phone')+
    F('ac-addr','Address',acct&&acct.address,'')+
    F('ac-region','Region',acct&&acct.region,'e.g. NCR / Region IV-A')+
    F('ac-city','City',acct&&acct.city,'e.g. Quezon City')+
    SEL('ac-ctype','Clinic type',acct&&acct.clinic_type,['Derma clinic','Multi-specialty clinic','Hospital','Aesthetic center / spa','Distributor','Pharmacy','Other'])+
    F('ac-spec','Specialty',acct&&acct.specialty,'e.g. Dermatology')+
    SEL('ac-tier','Tier (A = top value)',acct&&acct.tier,['A','B','C'])+
    SEL('ac-source','Source',acct&&acct.source,['Rep visit','Event / demo','Referral','Walk-in / inbound','Online','Existing (migrated)'])+
    lbl('Delivery notes (prints on the DR)')+'<textarea id="ac-dnotes" rows="2" placeholder="receiving hours, guard instructions…" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px">'+esc(acct&&acct.delivery_notes||'')+'</textarea>'+
    D('ac-bday','Doctor\'s birthday',acct&&acct.birthday)+
    D('ac-anniv','Clinic anniversary',acct&&acct.anniversary)+
    F('ac-lto','LTO no.',acct&&acct.lto_no,'clinic license')+
    D('ac-ltoexp','LTO expiry',acct&&acct.lto_expiry)+
    F('ac-prc','PRC no.',acct&&acct.prc_no,'doctor license')+
    D('ac-prcexp','PRC expiry',acct&&acct.prc_expiry)+
    lbl('Notes')+'<textarea id="ac-notes" rows="4" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px">'+esc(acct&&acct.notes||'')+'</textarea>'+
    '<div id="ac-msg" style="min-height:14px;font-size:11px;margin-top:8px"></div>'+
    '<div style="display:flex;gap:8px;margin-top:2px">'+
    '<button onclick="saveAccountEdit(\''+nameArg+'\')" style="flex:1;background:var(--ac);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer">Save</button>'+
    '<button onclick="editAccountCancel(\''+nameArg+'\')" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:10px 14px;font-size:13px;cursor:pointer">Cancel</button>'+
    '</div>';
}
function editAccount(name){const p=$('ac-panel');if(p)p.innerHTML=acctDetailsHTML(name,ACCT_REC,true);}
function editAccountCancel(name){const p=$('ac-panel');if(p)p.innerHTML=acctDetailsHTML(name,ACCT_REC,false);}
async function saveAccountEdit(name){
  await saveAccount(name);
  if(SB){try{const {data}=await SB.from('accounts').select('*').eq('name',name).maybeSingle();ACCT_REC=data||ACCT_REC;}catch(e){}}
  const p=$('ac-panel');if(p)p.innerHTML=acctDetailsHTML(name,ACCT_REC,false);
}

/* Legacy drawer entry — everything routes to the full-page profile now */
function openAccountDrawer(name){showAccountPage(name);}
async function openAccountDrawer_legacy(name){
  name=String(name||'').trim();if(!name)return;
  const shopC=((SHOPIFY&&SHOPIFY.customers)||{})[name]||null;
  await loadVisits();
  // CRM record from Supabase (may not exist yet)
  let acct=null;
  if(SB){try{const {data}=await SB.from('accounts').select('*').eq('name',name).maybeSingle();acct=data||null;}catch(e){}}
  const orders=((SHOPIFY&&SHOPIFY.recent)||[]).filter(o=>(o.c||'').trim()===name)
    .map(o=>({k:'order',dt:o.dt,t:o.t||'',label:o.n,amt:(o.ls||[]).reduce((x,l)=>x+(l[2]||0),0)}));
  const visits=(VISITS||[]).filter(v=>(v.account||'').trim()===name)
    .map(v=>({k:v.status==='planned'?'plan':'visit',dt:v.date,t:v.spec,label:v.type||'Visit',out:v.outcome,notes:(v.products?'endorsed: '+v.products+(v.notes?' · '+v.notes:''):v.notes)}));
  const tl=[...orders,...visits].sort((a,b)=>a.dt<b.dt?1:a.dt>b.dt?-1:0).slice(0,30);
  const pill=k=>k==='order'?'<span class="pill pgr">order</span>':k==='plan'?'<span class="pill pbl">planned</span>':'<span class="pill pam" style="background:rgba(186,117,23,.15);color:var(--am)">visit</span>';
  const f=(id,label,val,ph)=>'<label style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin:8px 0 3px">'+label+'</label>'+
    '<input id="'+id+'" value="'+esc(val||'')+'" placeholder="'+ph+'" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px">';
  $('dbody').innerHTML=
    '<div class="dsku">ACCOUNT</div>'+
    '<div class="dname">'+esc(name)+'</div>'+
    (shopC?'<div class="dstk" style="color:var(--gr)">'+fmtPeso(shopC.v||0)+'</div><div class="dsub">'+(shopC.o||0)+' orders (13 months) · last '+esc(shopC.l||'—')+'</div>':'<div class="dsub" style="margin-top:6px">No Shopify orders yet — prospect or sheet-only account</div>')+
    '<div class="dsec"><div class="dsectitle">Account details'+(SB?'':' (sign-in required to edit)')+'</div>'+
    f('ac-person','Contact person',acct&&acct.contact_person,'e.g. Dr. Santos / clinic manager')+
    f('ac-phone','Phone',acct&&acct.phone,'')+
    f('ac-addr','Address',acct&&acct.address,'')+
    f('ac-spec','Specialty',acct&&acct.specialty,'e.g. Dermatology')+
    '<label style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin:8px 0 3px">Notes</label>'+
    '<textarea id="ac-notes" rows="2" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px">'+esc(acct&&acct.notes||'')+'</textarea>'+
    (SB?'<div id="ac-msg" style="min-height:14px;font-size:11px;margin-top:6px"></div>'+
    '<button onclick="saveAccount(\''+jsq(name)+'\')" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px;font-size:12.5px;font-weight:600;cursor:pointer;margin-top:2px">Save details</button>':'')+
    '</div>'+
    '<div class="dsec"><div class="dsectitle">Timeline — orders & visits</div>'+
    (tl.length?tl.map(e=>'<div class="drow" style="align-items:flex-start"><span class="dlbl" style="max-width:200px">'+pill(e.k)+' <b>'+esc(e.label||'')+'</b> · '+esc(e.dt)+'<br><span style="color:var(--tx3)">'+esc(e.t||'')+(e.out?' · '+esc(e.out):'')+(e.notes?' · '+esc(e.notes):'')+'</span></span><span class="dval">'+(e.amt!=null?fmtPeso(e.amt):'')+'</span></div>').join(''):'<div style="font-size:11.5px;color:var(--tx3)">No recorded orders or visits in the recent window.</div>')+'</div>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:10px">Orders from Shopify (≈6-month window) · visits from the Log visit tab · details save to the shared account record</div>';
  $('overlay').classList.add('open');
  $('drawer').classList.add('open');
}
async function saveAccount(name){
  if(!SB)return;
  const g=id=>($(id)&&$(id).value||'').trim();
  const msg=$('ac-msg');
  const N=v=>v||null; // '' → null (dates & optional text)
  const rec={name,contact_person:g('ac-person'),phone:g('ac-phone'),address:g('ac-addr'),specialty:g('ac-spec'),notes:g('ac-notes'),updated_at:new Date().toISOString(),updated_by:SBUSER?SBUSER.id:null};
  // CRM fields (only when the full editor is on screen — the legacy drawer lacks them)
  if($('ac-email')){Object.assign(rec,{email:N(g('ac-email')),viber:N(g('ac-viber')),region:N(g('ac-region')),city:N(g('ac-city')),clinic_type:N(g('ac-ctype')),tier:N(g('ac-tier')),source:N(g('ac-source')),delivery_notes:N(g('ac-dnotes')),birthday:N(g('ac-bday')),anniversary:N(g('ac-anniv')),lto_no:N(g('ac-lto')),lto_expiry:N(g('ac-ltoexp')),prc_no:N(g('ac-prc')),prc_expiry:N(g('ac-prcexp'))});}
  try{
    const {error}=await SB.from('accounts').upsert(rec,{onConflict:'name'});
    if(error)throw new Error(error.message);
    if(msg){msg.style.color='var(--gr)';msg.textContent='Saved.';}
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not save: '+e.message;}}
}

/* ── FOLLOW-UPS & PLANNED VISITS ── */
async function fuMark(id,field){
  if(!SB)return;
  try{
    const upd=field==='fu'?{fu_done:true}:{status:'done'};
    const {error}=await SB.from('visits').update(upd).eq('id',id);
    if(error)throw new Error(error.message);
    VISITS=null;renderFollowups();
  }catch(e){alert('Could not update: '+e.message);}
}
async function renderFollowups(){
  if(!SB){$('content').innerHTML='<div class="empty" style="margin-top:40px">Follow-ups need the account sign-in (Supabase) — available once you log in with your Healthspan account.</div>';return;}
  loadingHint();
  await loadVisits(true);
  const myTag=(SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const mine=v=>!myTag||specCanon(v.spec).toLowerCase()===specCanon(myTag).toLowerCase();
  const today=new Date().toISOString().slice(0,10);
  const fus=(VISITS||[]).filter(v=>v.status!=='planned'&&v.outcome==='Follow-up needed'&&!v.fu_done&&mine(v));
  const plans=(VISITS||[]).filter(v=>v.status==='planned'&&mine(v)).sort((a,b)=>a.dt<b.dt?-1:1);
  const row=(v,btnLabel,field)=>'<div class="drow" style="align-items:flex-start;border-bottom:1px solid var(--bd);padding:10px 0">'+
    '<span class="dlbl" style="max-width:60%"><a href="#" onclick="openAccountDrawer(\''+jsq(v.account)+'\');return false" style="color:var(--tx);font-weight:600">'+esc(v.account)+'</a> · '+esc(v.date)+(v.date<today&&v.status==='planned'?' <span class="pill prd">overdue</span>':'')+
    '<br><span style="color:var(--tx3);font-size:11.5px">'+esc(v.spec)+(v.notes?' · '+esc(v.notes):'')+'</span></span>'+
    '<button onclick="fuMark(\''+v.id+'\',\''+field+'\')" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">'+btnLabel+'</button></div>';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met am"><div class="met-lbl">Open follow-ups</div><div class="met-val">'+fus.length+'</div><div class="met-sub">'+(myTag?'yours':'whole team')+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Planned visits</div><div class="met-val">'+plans.length+'</div><div class="met-sub">'+plans.filter(v=>v.date<today).length+' overdue</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="margin-bottom:14px;padding:16px"><div class="phd">Follow-ups needed</div>'+
    (fus.length?fus.map(v=>row(v,'✓ Done','fu')).join(''):'<div style="font-size:12px;color:var(--tx3)">Nothing open — log visits with outcome “Follow-up needed” and they appear here.</div>')+'</div>'+
    '<div class="panel" style="padding:16px"><div class="phd">Planned visits</div>'+
    (plans.length?plans.map(v=>row(v,'✓ Visited','plan')).join(''):'<div style="font-size:12px;color:var(--tx3)">None planned — pick a future date in Log visit to plan one.</div>')+'</div>';
}

/* ── CHANGE PASSWORD (in-app) ── */
function openChangePassword(){
  if(!SB)return;
  $('dbody').innerHTML=
    '<div class="dsku">ACCOUNT</div><div class="dname">Change password</div>'+
    '<div class="dsec"><input id="cp-1" type="password" placeholder="New password (min 8 characters)" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:14px;margin:8px 0">'+
    '<input id="cp-2" type="password" placeholder="Repeat new password" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:14px">'+
    '<div id="cp-msg" style="min-height:16px;font-size:12px;margin:8px 0 4px"></div>'+
    '<button onclick="doChangePassword()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:11px;font-size:13.5px;font-weight:600;cursor:pointer">Update password</button></div>';
  $('overlay').classList.add('open');$('drawer').classList.add('open');
}
async function doChangePassword(){
  const p1=($('cp-1')&&$('cp-1').value)||'',p2=($('cp-2')&&$('cp-2').value)||'';
  const msg=$('cp-msg');
  if(p1.length<8){if(msg){msg.style.color='var(--rd)';msg.textContent='Use at least 8 characters.';}return;}
  if(p1!==p2){if(msg){msg.style.color='var(--rd)';msg.textContent='Passwords don’t match.';}return;}
  try{
    const {error}=await SB.auth.updateUser({password:p1});
    if(error)throw new Error(error.message);
    if(msg){msg.style.color='var(--gr)';msg.textContent='Password updated.';}
    if($('cp-1'))$('cp-1').value='';if($('cp-2'))$('cp-2').value='';
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent=e.message;}}
}
