/* ── PHASE A OWNERSHIP · BATCH RECALL TRACE · CATALOG DEAL DEFINITIONS ── */

// Account ownership: every account gets an owning specialist (PRD Phase A)
let OWNERS=null;
async function loadOwners(force){
  if(OWNERS&&!force)return OWNERS;
  OWNERS={};
  try{const {data}=await SB.from('accounts').select('name,owner_tag');(data||[]).forEach(r=>{if(r.owner_tag)OWNERS[custNorm(acctDedup(r.name))]=r.owner_tag;});}catch(e){}
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
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
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
      (lm||[]).forEach(m=>hits.push({sku:m.sku,batch:m.batch||'—',date:String(m.at||'').slice(0,10),customer:'(ledger) '+(m.ref||''),qty:Math.abs(m.qty),order:m.ref,expiry:''}));
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
