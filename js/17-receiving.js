/* ── RECEIVING — inbound shipments from suppliers (Logistics → Receiving) ──────────
   Verna's page (2026-09-08). A purchase order says what we ordered; a SHIPMENT is
   what the supplier actually sent, on which vessel, with which papers, and what we
   counted at the door. One PO can arrive in several shipments; each shipment:

     tracking   carrier · tracking no. · ETD · ETA · customs status · broker
                status: expected → shipped → in customs → arrived → counting →
                received → closed
     counts     per line: expected (from the PO's outstanding qty), counted,
                batch, expiry, bin, QA hold. "Post the counted lines" writes the
                stock ledger (sellable) or quarantine (QA hold), updates the PO's
                received quantities and status — the same path receiving on the PO
                page used, now with the shipment as the record.
     terms      the supplier's payment terms in days from the receipt date → the
                due date finance pays against (shown on the PO's AP block too)
     landed     the calculator: invoice (FX) × rate + freight, insurance, customs
                duty, import VAT (recoverable by default → excluded from cost),
                brokerage, arrastre/wharfage, storage/demurrage, trucking, bank
                charges, other → total landed ₱, allocated to lines by value or
                by quantity → landed unit cost per SKU. "Apply" writes it to the
                shipment lines AND to the PO (landed_cost add-on, fx_rate), so the
                existing Landed cost & valuation page keeps working unchanged.

   Roles: the warehouse and admins run it; finance reads it (and the costs);
   managers read it without costs. Costs follow the company rule everywhere. */
let SHIPMENTS=null, SHIP_LINES={}, SHIP_OPEN=null, SHIP_FILTER='open';
const SHIP_STATUS=['expected','shipped','in_customs','arrived','counting','received','closed'];
const SHIP_LABEL={expected:'Expected',shipped:'On the water',in_customs:'In customs',arrived:'Arrived',counting:'Counting',received:'Received',closed:'Closed'};
const SHIP_TONE={expected:'pgy',shipped:'pbl',in_customs:'pam',arrived:'pam',counting:'pam',received:'pgr',closed:'pgy'};
const SHIP_FEES=[['freight','Freight'],['insurance','Insurance'],['duty','Customs duty'],['vat_import','Import VAT (12%)'],['brokerage','Brokerage'],['arrastre','Arrastre / wharfage'],['storage','Storage / demurrage'],['trucking','Trucking to warehouse'],['bank','Bank charges'],['other','Other']];
const SHIP_NO=id=>'RCV-'+id;
function shipCanRun(){return roleIn('admin','supply_chain')||(typeof isSuper==='function'&&isSuper());}
function shipCanCost(){return roleIn('admin','finance','supply_chain')||(typeof isSuper==='function'&&isSuper());}
function shipFmtDate(d){return d?esc(String(d).slice(0,10)):'—';}

async function loadShipments(force){
  if(SHIPMENTS&&!force)return SHIPMENTS;
  try{const [a,b]=await Promise.all([SB.from('shipments').select('*').order('id',{ascending:false}).limit(500),SB.from('shipment_lines').select('*').order('id').limit(5000)]);
    if(a.error)throw a.error;SHIPMENTS=a.data||[];SHIP_LINES={};for(const l of (b.data||[]))(SHIP_LINES[l.shipment_id]=SHIP_LINES[l.shipment_id]||[]).push(l);window._shipErr='';}
  catch(e){SHIPMENTS=SHIPMENTS||[];window._shipErr=e.message||String(e);}
  return SHIPMENTS;
}
function shipDue(s){ if(!s.received_at||!s.terms_days)return null; const d=new Date(String(s.received_at).slice(0,10)+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+(+s.terms_days||0)); return d.toISOString().slice(0,10); }

/* ── the landed-cost arithmetic (pure; the test exercises it) ── */
function shipLanded(s,lines){
  const f=s.fees||{}; const rate=+s.fx_rate||1; const inv=+s.invoice_total||0;
  const n=k=>Math.round((+f[k]||0)*100)/100;
  const goods=Math.round(inv*rate*100)/100;                       // invoice in ₱
  const vatRecoverable=f.vat_recoverable!==false;                 // input VAT is not a cost
  const feeKeys=SHIP_FEES.map(x=>x[0]);
  const feesTotal=feeKeys.reduce((a,k)=>a+((k==='vat_import'&&vatRecoverable)?0:n(k)),0);
  const landed=Math.round((goods+feesTotal)*100)/100;
  const adder=Math.round(feesTotal*100)/100;                       // what the PO's landed_cost add-on carries
  // allocation
  const L=(lines||[]).filter(l=>(+l.qty_counted||+l.qty_expected||0)>0);
  const qtyOf=l=>(+l.qty_counted>0?+l.qty_counted:+l.qty_expected)||0;
  const valOf=l=>qtyOf(l)*(+l.unit_cost||0);
  const totQ=L.reduce((a,l)=>a+qtyOf(l),0), totV=L.reduce((a,l)=>a+valOf(l),0);
  const per={};
  for(const l of L){
    const share=s.alloc_method==='qty'||!totV?(totQ?qtyOf(l)/totQ:0):(valOf(l)/totV);
    const unitGoods=(+l.unit_cost||0)*rate;
    const unitFees=qtyOf(l)?(feesTotal*share)/qtyOf(l):0;
    per[l.id]=Math.round((unitGoods+unitFees)*100)/100;
  }
  return {goods,feesTotal,landed,adder,vatRecoverable,per,rate};
}

/* ── the page ── */
async function renderReceiving(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  loadingHint();
  await loadShipments(true);
  if(currentView!=='receiving')return;
  const S=SHIPMENTS||[];
  const today=todayISO();
  const isOpen=s=>!['received','closed'].includes(s.status);
  const rows=S.filter(s=>SHIP_FILTER==='all'?true:SHIP_FILTER==='open'?isOpen(s):SHIP_FILTER==='late'?(isOpen(s)&&s.eta&&s.eta<today):s.status===SHIP_FILTER);
  const onWater=S.filter(s=>['shipped','in_customs'].includes(s.status)), arrived=S.filter(s=>['arrived','counting'].includes(s.status)), late=S.filter(s=>isOpen(s)&&s.eta&&s.eta<today);
  const recvMonth=S.filter(s=>s.received_at&&String(s.received_at).slice(0,7)===today.slice(0,7));
  const next=S.filter(s=>isOpen(s)&&s.eta&&s.eta>=today).sort((a,b)=>a.eta<b.eta?-1:1)[0];
  const cost=shipCanCost(), run=shipCanRun();
  const tabs=[['open','Open ('+S.filter(isOpen).length+')'],['late','Past ETA ('+late.length+')'],['received','Received'],['all','All ('+S.length+')']];
  let h=(typeof roBanner==='function'?roBanner('receiving'):'')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">On the water</div><div class="met-val">'+onWater.length+'</div><div class="met-sub">shipped or clearing customs</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Arrived, to count</div><div class="met-val">'+arrived.length+'</div><div class="met-sub">at the door, not yet in stock</div><div class="met-bar"></div></div>'+
    '<div class="met '+(late.length?'rd':'gr')+'"><div class="met-lbl">Past ETA</div><div class="met-val">'+late.length+'</div><div class="met-sub">'+(late.length?'chase the supplier / forwarder':'nothing overdue')+'</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Next arrival</div><div class="met-val" style="font-size:15px">'+(next?esc(next.eta):'—')+'</div><div class="met-sub">'+(next?esc(next.supplier)+' · '+SHIP_NO(next.id):'no ETA on record')+'</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Received this month</div><div class="met-val">'+recvMonth.length+'</div><div class="met-sub">shipments booked into stock</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><div class="tabs" style="margin:0">'+tabs.map(([k,l])=>'<div class="tab'+(SHIP_FILTER===k?' active':'')+'" onclick="SHIP_FILTER=\''+k+'\';renderReceiving()">'+l+'</div>').join('')+'</div><span style="flex:1"></span>'+
    (run?'<a href="#" class="abtn t-gr" onclick="shipNew();return false">+ New shipment from a PO</a>':'')+'</div>';
  if(window._shipErr)h+='<div class="viewdesc" style="border-color:var(--am)">Receiving tables not reachable ('+esc(window._shipErr)+') — run the receiving SQL from SUPABASE-SETUP.md.</div>';
  h+='<div class="tcard"><div class="tscroll"><table><thead><tr><th>Shipment</th><th>Supplier · PO</th><th>Status</th><th>Carrier · tracking</th><th>ETD → ETA</th><th>Lines</th><th>Counted</th>'+(cost?'<th class="r">Landed ₱</th><th>Terms / due</th>':'')+'<th></th></tr></thead><tbody>'+
    (rows.length?rows.map(s=>{const L=SHIP_LINES[s.id]||[];const exp=L.reduce((a,l)=>a+(+l.qty_expected||0),0),cnt=L.reduce((a,l)=>a+(+l.qty_counted||0),0);const open=SHIP_OPEN===s.id;const lateRow=isOpen(s)&&s.eta&&s.eta<today;
      return '<tr'+(open?' style="background:var(--sf2)"':'')+'><td style="font-weight:700">'+SHIP_NO(s.id)+(s.ref?'<div class="mu" style="font-size:10.5px">'+esc(s.ref)+'</div>':'')+'</td>'+
      '<td>'+esc(s.supplier||'—')+'<div class="mu" style="font-size:10.5px">'+(s.po_id?'<a href="#" onclick="showView(\'po\',null);return false" style="color:var(--ac)">'+esc(PO_NO(s.po_id))+'</a>':'no PO')+'</div></td>'+
      '<td><span class="pill '+SHIP_TONE[s.status]+'">'+SHIP_LABEL[s.status]+'</span>'+(lateRow?' <span class="pill prd" title="ETA has passed">late</span>':'')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+esc(s.carrier||'—')+(s.tracking_no?'<div>'+esc(s.tracking_no)+'</div>':'')+(s.customs_status?'<div>'+esc(s.customs_status)+'</div>':'')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+shipFmtDate(s.etd)+' → <b>'+shipFmtDate(s.eta)+'</b>'+(s.received_at?'<div>received '+shipFmtDate(s.received_at)+'</div>':'')+'</td>'+
      '<td class="r">'+L.length+'</td><td class="r">'+cnt.toLocaleString()+' / '+exp.toLocaleString()+(exp&&cnt&&cnt!==exp&&['received','closed'].includes(s.status)?' <span class="pill '+(cnt<exp?'prd':'pam')+'">'+(cnt<exp?'short':'over')+'</span>':'')+'</td>'+
      (cost?'<td class="r">'+(s.landed_total!=null?fmtPeso(s.landed_total):'<span class="mu">—</span>')+'</td><td class="mu" style="font-size:11.5px">'+(s.terms_days!=null?s.terms_days+'d':'—')+(shipDue(s)?'<div>due <b>'+esc(shipDue(s))+'</b></div>':'')+'</td>':'')+
      '<td style="white-space:nowrap"><a href="#" class="lnk" onclick="SHIP_OPEN='+(open?'null':s.id)+';keepScroll();renderReceiving();return false" style="color:var(--ac);font-size:12px">'+(open?'close':'open')+'</a></td></tr>'+
      (open?'<tr><td colspan="'+(cost?10:8)+'" style="padding:0 10px 14px">'+shipPanel(s,L)+'</td></tr>':'');}).join('')
    :'<tr><td colspan="10" class="mu">'+(SHIP_FILTER==='open'?'Nothing inbound — start one from a purchase order.':'Nothing here.')+'</td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>A shipment is what the supplier actually sent against a PO · counts at the door write the ledger and the PO · the due date is the receipt date plus the supplier\'s terms · the landed-cost calculator turns invoice + fees into a real unit cost and feeds Landed cost &amp; valuation</span></div></div>';
  $('content').innerHTML=h;
}

function shipPanel(s,L){
  const run=shipCanRun(),cost=shipCanCost();
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:6px 8px;font-size:12.5px;font:inherit"';
  const stepIdx=SHIP_STATUS.indexOf(s.status);
  const next=SHIP_STATUS[stepIdx+1];
  const canPost=run&&['arrived','counting','received'].includes(s.status)&&L.some(l=>!l.received&&(+l.qty_counted||0)>0);
  const lc=shipLanded(s,L);
  let h='<div class="panel" style="padding:12px 14px">';
  /* pipeline */
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'+SHIP_STATUS.map((st,i)=>'<span class="pill '+(i<stepIdx?'pgr':i===stepIdx?SHIP_TONE[st]:'pgy')+'" style="opacity:'+(i<=stepIdx?1:.55)+'">'+(i<stepIdx?'✓ ':'')+SHIP_LABEL[st]+'</span>'+(i<SHIP_STATUS.length-1?'<span class="mu">›</span>':'')).join('')+
    '<span style="flex:1"></span>'+(run&&next&&next!=='received'&&next!=='closed'?'<a href="#" class="abtn" onclick="shipAdvance('+s.id+',\''+next+'\');return false">Mark '+SHIP_LABEL[next].toLowerCase()+'</a>':'')+
    (run&&s.status==='received'?'<a href="#" class="abtn" onclick="shipAdvance('+s.id+',\'closed\');return false">Close</a>':'')+
    (run?'<a href="#" class="abtn" onclick="shipEdit('+s.id+');return false">Tracking &amp; papers</a>':'')+'</div>';
  /* tracking facts */
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 14px;font-size:12px;margin-bottom:10px">'+
    [['Supplier',s.supplier],['PO',s.po_id?PO_NO(s.po_id):'—'],['Supplier ref / invoice',s.ref],['Carrier',s.carrier],['Tracking no.',s.tracking_no],['ETD',s.etd],['ETA',s.eta],['Customs',s.customs_status],['Broker / forwarder',s.broker],['Arrived',s.arrived_at&&String(s.arrived_at).slice(0,10)],['Received',s.received_at&&String(s.received_at).slice(0,10)]]
    .concat(cost?[['Terms (days from receipt)',s.terms_days!=null?s.terms_days+' days':null],['Payment due',shipDue(s)]]:[])
    .map(([k,v])=>'<div><div class="mu" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">'+k+'</div><div>'+(v?esc(String(v)):'<span class="mu">—</span>')+'</div></div>').join('')+'</div>'+
    (s.notes?'<div class="mu" style="font-size:12px;margin-bottom:8px">'+esc(s.notes)+'</div>':'');
  /* lines */
  h+='<div class="phd" style="margin:8px 0 4px">Lines — count at the door</div>'+
    '<div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th class="r">Expected</th><th class="r">Counted</th><th>Batch</th><th>Expiry</th><th>Bin</th><th>QA hold</th>'+(cost?'<th class="r">Unit cost ('+esc(s.currency||'PHP')+')</th><th class="r">Landed ₱/unit</th>':'')+'<th>Posted</th></tr></thead><tbody>'+
    (L.length?L.map(l=>{const ed=run&&!l.received&&!['closed'].includes(s.status);const diff=(+l.qty_counted||0)-(+l.qty_expected||0);
      return '<tr><td class="mu" style="font-size:11px">'+esc(l.sku)+'</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(l.name||'')+'</td><td class="r">'+(+l.qty_expected||0)+'</td>'+
      '<td class="r">'+(ed?'<input type="number" min="0" value="'+esc(l.qty_counted==null?'':l.qty_counted)+'" onchange="shipLineSet('+l.id+',\'qty_counted\',this.value)" '+inp+' style="width:72px">':(+l.qty_counted||0))+(l.qty_counted!=null&&diff?' <span class="pill '+(diff<0?'prd':'pam')+'" title="counted vs expected">'+(diff>0?'+':'')+diff+'</span>':'')+'</td>'+
      '<td>'+(ed?'<input value="'+esc(l.batch||'')+'" placeholder="lot" onchange="shipLineSet('+l.id+',\'batch\',this.value)" '+inp+' style="width:90px">':esc(l.batch||'—'))+'</td>'+
      '<td>'+(ed?'<input value="'+esc(l.expiry||'')+'" placeholder="MM/YYYY" onchange="shipLineSet('+l.id+',\'expiry\',this.value)" '+inp+' style="width:84px">':esc(l.expiry||'—'))+'</td>'+
      '<td>'+(ed?'<input value="'+esc(l.bin||'')+'" placeholder="bin" onchange="shipLineSet('+l.id+',\'bin\',this.value)" '+inp+' style="width:64px">':esc(l.bin||'—'))+'</td>'+
      '<td>'+(ed?'<input type="checkbox" '+(l.qa_hold?'checked':'')+' onchange="shipLineSet('+l.id+',\'qa_hold\',this.checked)" title="Receive into quarantine until QA releases it">':(l.qa_hold?'<span class="pill pam">QA</span>':'—'))+'</td>'+
      (cost?'<td class="r mu">'+(l.unit_cost!=null?Number(l.unit_cost).toLocaleString('en-PH',{maximumFractionDigits:2}):'—')+'</td><td class="r">'+(lc.per[l.id]!=null?fmtPeso(lc.per[l.id]):'—')+'</td>':'')+
      '<td>'+(l.received?'<span class="pill pgr">'+(l.qa_hold?'quarantine':'in stock')+'</span>':'<span class="mu">—</span>')+'</td></tr>';}).join('')
    :'<tr><td colspan="11" class="mu">No lines — the PO had nothing outstanding when this shipment was created.</td></tr>')+
    '</tbody></table></div>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">'+
    (canPost?'<a href="#" class="abtn t-gr" onclick="shipPost('+s.id+');return false">Post the counted lines to stock</a>':'')+
    (run&&L.some(l=>l.received&&l.qty_counted!=null&&(+l.qty_counted)!==(+l.qty_expected))?'<a href="#" class="abtn t-rd" onclick="shipClaim('+s.id+');return false">Raise a claim with the supplier</a>':'')+
    '<span id="ship-msg" class="mu" style="font-size:11.5px"></span></div>';
  /* landed cost */
  if(cost){
    const f=s.fees||{};
    h+='<div class="phd" style="margin:14px 0 4px">Landed cost calculator</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px 12px;align-items:end">'+
      '<label><div class="mu" style="font-size:10px">Invoice total ('+esc(s.currency||'PHP')+')</div><input type="number" step="0.01" value="'+esc(s.invoice_total==null?'':s.invoice_total)+'" '+(run?'onchange="shipSet('+s.id+',\'invoice_total\',this.value)"':'disabled')+' '+inp+' style="width:100%;box-sizing:border-box"></label>'+
      '<label><div class="mu" style="font-size:10px">FX rate (₱ per '+esc(s.currency||'unit')+')</div><input type="number" step="0.0001" value="'+esc(s.fx_rate==null?'':s.fx_rate)+'" '+(run?'onchange="shipSet('+s.id+',\'fx_rate\',this.value)"':'disabled')+' '+inp+' style="width:100%;box-sizing:border-box"></label>'+
      SHIP_FEES.map(([k,l])=>'<label><div class="mu" style="font-size:10px">'+l+' ₱</div><input type="number" step="0.01" value="'+esc(f[k]==null?'':f[k])+'" '+(run?'onchange="shipFee('+s.id+',\''+k+'\',this.value)"':'disabled')+' '+inp+' style="width:100%;box-sizing:border-box"></label>').join('')+
      '<label style="display:flex;gap:6px;align-items:center;font-size:12px"><input type="checkbox" '+(lc.vatRecoverable?'checked':'')+' '+(run?'onchange="shipFee('+s.id+',\'vat_recoverable\',this.checked)"':'disabled')+'> Import VAT is recoverable (input tax — not a cost)</label>'+
      '<label><div class="mu" style="font-size:10px">Allocate fees by</div><select '+(run?'onchange="shipSet('+s.id+',\'alloc_method\',this.value)"':'disabled')+' '+inp+' style="width:100%"><option value="value"'+(s.alloc_method!=='qty'?' selected':'')+'>line value</option><option value="qty"'+(s.alloc_method==='qty'?' selected':'')+'>quantity</option></select></label>'+
      '</div>'+
      '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:12.5px">'+
      '<span>Goods ₱ <b>'+fmtPeso(lc.goods)+'</b></span><span>Fees counted ₱ <b>'+fmtPeso(lc.feesTotal)+'</b>'+(lc.vatRecoverable&&(+f.vat_import||0)?' <span class="mu">(VAT '+fmtPeso(+f.vat_import)+' excluded)</span>':'')+'</span><span>Landed total ₱ <b style="font-size:14px">'+fmtPeso(lc.landed)+'</b></span>'+
      (lc.goods?'<span class="mu">fees = '+Math.round(lc.feesTotal/lc.goods*1000)/10+'% on top of goods</span>':'')+
      '<span style="flex:1"></span>'+(run?'<a href="#" class="abtn t-gr" onclick="shipApplyLanded('+s.id+');return false">Apply to lines &amp; PO</a>':'')+'</div>'+
      (s.landed_applied_at?'<div class="mu" style="font-size:11px;margin-top:4px">Applied '+esc(String(s.landed_applied_at).slice(0,16).replace('T',' '))+' — the PO carries ₱'+Number(s.landed_total_fees||0).toLocaleString('en-PH')+' of fees and the FX rate; Landed cost &amp; valuation reads them.</div>':'');
  }
  h+='</div>';
  return h;
}

/* ── actions ── */
async function shipNew(){
  if(!shipCanRun())return;
  let pos=[];try{const {data}=await SB.from('pos').select('id,supplier,status,eta,etd,currency,terms,customs_status,broker').in('status',['ordered','partial']).order('id',{ascending:false}).limit(200);pos=data||[];}catch(e){}
  if(!pos.length)return uiAlert('No open purchase orders (ordered or partial) to receive against.');
  const v=await uiForm('New shipment',[
    {k:'po',l:'Purchase order',t:'select',opts:pos.map(p=>({v:String(p.id),l:PO_NO(p.id)+' · '+p.supplier+(p.eta?' · ETA '+p.eta:'')})),req:1},
    {k:'ref',l:'Supplier ref / invoice / packing list no.',placeholder:'INV-2026-0912'},
    {k:'carrier',l:'Carrier / forwarder',placeholder:'DHL, Maersk, LBC…'},
    {k:'tracking_no',l:'Tracking / AWB / BL no.'},
    {k:'etd',l:'ETD (departs origin)',t:'date'},{k:'eta',l:'ETA (at the warehouse)',t:'date'},
    {k:'terms_days',l:'Supplier terms — days from receipt',t:'number',hint:'What finance pays against. Leave blank if the PO was prepaid.'}
  ],{ok:'Create shipment'});
  if(!v)return;
  const po=pos.find(p=>String(p.id)===String(v.po));if(!po)return;
  try{
    const {data:pls}=await SB.from('po_lines').select('id,sku,name,qty,received,unit_cost').eq('po_id',po.id);
    const outstanding=(pls||[]).filter(l=>(l.qty||0)-(l.received||0)>0);
    const row={po_id:po.id,supplier:po.supplier,ref:v.ref||null,carrier:v.carrier||null,tracking_no:v.tracking_no||null,etd:v.etd||po.etd||null,eta:v.eta||po.eta||null,status:v.etd?'shipped':'expected',
      currency:po.currency||'PHP',customs_status:po.customs_status||null,broker:po.broker||null,terms_days:v.terms_days?parseInt(v.terms_days,10):null,fees:{vat_recoverable:true},alloc_method:'value',
      created_by:SBUSER.id,created_name:(SBPROFILE&&SBPROFILE.name)||''};
    const {data:sh,error}=await SB.from('shipments').insert(row).select().single();if(error)throw error;
    if(outstanding.length){const {error:e2}=await SB.from('shipment_lines').insert(outstanding.map(l=>({shipment_id:sh.id,po_line_id:l.id,sku:l.sku,name:l.name,qty_expected:(l.qty||0)-(l.received||0),unit_cost:l.unit_cost})));if(e2)throw e2;}
    audit('shipment.create',{ship:SHIP_NO(sh.id),po:PO_NO(po.id),lines:outstanding.length});
    SHIP_OPEN=sh.id;SHIP_FILTER='open';await loadShipments(true);renderReceiving();
  }catch(e){uiAlert('Could not create the shipment: '+(e.message||e)+(/shipments/.test(String(e.message))?' — run the receiving SQL from SUPABASE-SETUP.md.':''));}
}
async function shipEdit(id){
  const s=(SHIPMENTS||[]).find(x=>x.id===id);if(!s||!shipCanRun())return;
  const v=await uiForm('Tracking & papers — '+SHIP_NO(id),[
    {k:'ref',l:'Supplier ref / invoice / packing list no.',v:s.ref},{k:'carrier',l:'Carrier / forwarder',v:s.carrier},{k:'tracking_no',l:'Tracking / AWB / BL no.',v:s.tracking_no},
    {k:'etd',l:'ETD',t:'date',v:s.etd},{k:'eta',l:'ETA',t:'date',v:s.eta},
    {k:'customs_status',l:'Customs status',t:'select',opts:['','in transit','lodged','assessment','paid','cleared','released'],v:s.customs_status||''},{k:'broker',l:'Broker / forwarder',v:s.broker},
    {k:'terms_days',l:'Supplier terms — days from receipt',t:'number',v:s.terms_days},{k:'notes',l:'Notes',t:'textarea',v:s.notes}
  ],{ok:'Save'});
  if(!v)return;
  const patch={ref:v.ref||null,carrier:v.carrier||null,tracking_no:v.tracking_no||null,etd:v.etd||null,eta:v.eta||null,customs_status:v.customs_status||null,broker:v.broker||null,terms_days:v.terms_days===''?null:parseInt(v.terms_days,10),notes:v.notes||null,updated_at:new Date().toISOString()};
  await shipPatch(id,patch,'shipment.edit');
  // the PO's import block mirrors the live shipment so the PO page stays true
  try{if(s.po_id)await SB.from('pos').update({etd:patch.etd,eta:patch.eta,customs_status:patch.customs_status,broker:patch.broker,updated_at:new Date().toISOString()}).eq('id',s.po_id);}catch(e){}
}
async function shipPatch(id,patch,what){
  try{const {data,error}=await SB.from('shipments').update(patch).eq('id',id).select('id');if(error)throw error;if(!data||!data.length)throw new Error('No change saved — permissions?');
    if(what)audit(what,{ship:SHIP_NO(id),...Object.fromEntries(Object.entries(patch).filter(([k])=>k!=='fees'&&k!=='updated_at'))});
    await loadShipments(true);keepScroll();renderReceiving();}
  catch(e){uiAlert('Could not save: '+(e.message||e));}
}
async function shipAdvance(id,status){
  const s=(SHIPMENTS||[]).find(x=>x.id===id);if(!s||!shipCanRun())return;
  const patch={status,updated_at:new Date().toISOString()};
  if(status==='arrived'&&!s.arrived_at)patch.arrived_at=todayISO();
  if(status==='closed'){const L=SHIP_LINES[id]||[];if(L.some(l=>!l.received&&(+l.qty_expected||0)>0)&&!await uiConfirm('Some lines were never posted to stock. Close anyway? (Whatever was not received stays outstanding on the PO.)',{ok:'Close',danger:true}))return;}
  await shipPatch(id,patch,'shipment.'+status);
}
async function shipSet(id,k,v){const p={};p[k]=v===''?null:(k==='alloc_method'?v:Math.round(parseFloat(v)*10000)/10000);p.updated_at=new Date().toISOString();await shipPatch(id,p,null);}
async function shipFee(id,k,v){const s=(SHIPMENTS||[]).find(x=>x.id===id);if(!s)return;const fees=Object.assign({},s.fees||{});if(k==='vat_recoverable')fees[k]=!!v;else fees[k]=v===''?null:Math.round(parseFloat(v)*100)/100;await shipPatch(id,{fees,updated_at:new Date().toISOString()},null);}
async function shipLineSet(lineId,k,v){
  const p={};p[k]=k==='qa_hold'?!!v:(k==='qty_counted'?(v===''?null:parseInt(v,10)):(String(v).trim()||null));
  try{const {data,error}=await SB.from('shipment_lines').update(p).eq('id',lineId).select('id,shipment_id');if(error)throw error;if(!data||!data.length)throw new Error('No change saved — permissions?');
    const sid=data[0].shipment_id;const s=(SHIPMENTS||[]).find(x=>x.id===sid);
    if(s&&s.status==='arrived'&&k==='qty_counted')await SB.from('shipments').update({status:'counting',updated_at:new Date().toISOString()}).eq('id',sid);
    await loadShipments(true);keepScroll();renderReceiving();}
  catch(e){uiAlert('Could not save: '+(e.message||e));}
}
/* the door: counted lines → ledger (or quarantine) → PO received quantities → PO status → shipment received */
async function shipPost(id){
  const s=(SHIPMENTS||[]).find(x=>x.id===id);if(!s||!shipCanRun())return;
  const L=(SHIP_LINES[id]||[]).filter(l=>!l.received&&(+l.qty_counted||0)>0);
  if(!L.length)return uiAlert('Nothing to post — enter the counted quantities first.');
  const short=L.filter(l=>(+l.qty_counted)<(+l.qty_expected)),over=L.filter(l=>(+l.qty_counted)>(+l.qty_expected));
  if(!await uiConfirm('Post '+L.length+' line'+(L.length>1?'s':'')+' to stock?'+(short.length?'\n'+short.length+' short of the expected quantity':'')+(over.length?'\n'+over.length+' over the expected quantity':'')+'\n\nSellable lines go into the stock ledger now; QA-hold lines go to quarantine. The PO\'s received quantities update.',{ok:'Post to stock'}))return;
  const msg=$('ship-msg');
  try{
    const ledger=[];const qa=[];
    for(const l of L){ if(l.qa_hold)qa.push(l); else ledger.push({sku:l.sku,qty:+l.qty_counted,kind:'receive',ref:SHIP_NO(id)+(s.po_id?' '+PO_NO(s.po_id):''),batch:l.batch||null,note:(l.expiry?'exp '+l.expiry:'')+(l.bin?' bin '+l.bin:'')||null}); }
    if(ledger.length)await ledgerAdd(ledger);
    for(const l of qa){const p=(DATA||[]).find(x=>x.sku===l.sku);await quarAdd(l.sku,(p&&p.name)||l.name||l.sku,+l.qty_counted,l.batch,'QA hold',SHIP_NO(id),false);}
    // PO lines: received += counted
    for(const l of L){ if(l.po_line_id){const {data:pl}=await SB.from('po_lines').select('received').eq('id',l.po_line_id).maybeSingle();await SB.from('po_lines').update({received:((pl&&pl.received)||0)+(+l.qty_counted)}).eq('id',l.po_line_id);} }
    const {error}=await SB.from('shipment_lines').update({received:true,received_at:new Date().toISOString()}).in('id',L.map(l=>l.id));if(error)throw error;
    if(s.po_id){const {data:ls}=await SB.from('po_lines').select('qty,received').eq('po_id',s.po_id);const full=(ls||[]).every(x=>(x.received||0)>=x.qty);await SB.from('pos').update({status:full?'received':'partial',updated_at:new Date().toISOString()}).eq('id',s.po_id);}
    const allDone=(SHIP_LINES[id]||[]).every(l=>l.received||L.includes(l)||!(+l.qty_expected));
    await SB.from('shipments').update({status:'received',received_at:s.received_at||todayISO(),updated_at:new Date().toISOString()}).eq('id',id);
    audit('shipment.post',{ship:SHIP_NO(id),po:s.po_id?PO_NO(s.po_id):null,lines:L.length,units:L.reduce((a,l)=>a+(+l.qty_counted),0),qa:qa.length});
    for(const l of ledger)try{boRelease(l.sku,l.qty);}catch(e){}
    if(s.terms_days)try{notify({roles:['finance']},'auto','Shipment received: '+SHIP_NO(id)+' · '+s.supplier,'Received '+todayISO()+' — payment due '+shipDue(Object.assign({},s,{received_at:s.received_at||todayISO()}))+' ('+s.terms_days+' days). '+(short.length?short.length+' line'+(short.length>1?'s':'')+' short — check the claim before paying.':''),'#/v/receiving');}catch(e){}
    if(short.length||over.length)try{notify({roles:['supply_chain']},'auto','Count differs from the PO: '+SHIP_NO(id),(short.length?short.length+' short':'')+(short.length&&over.length?', ':'')+(over.length?over.length+' over':'')+' — raise a claim from the shipment if the supplier owes us.','#/v/receiving');}catch(e){}
    await loadShipments(true);keepScroll();renderReceiving();
    if(!allDone&&$('ship-msg'))$('ship-msg').textContent='Posted. Lines without a count stay open on this shipment.';
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not post: '+(e.message||e);}else uiAlert('Could not post: '+(e.message||e));}
}
async function shipApplyLanded(id){
  const s=(SHIPMENTS||[]).find(x=>x.id===id);if(!s||!shipCanRun())return;
  const L=SHIP_LINES[id]||[];const lc=shipLanded(s,L);
  if(!lc.goods&&!lc.feesTotal)return uiAlert('Enter the invoice total, the FX rate and the fees first.');
  if(!await uiConfirm('Apply the landed cost?\n\nGoods '+fmtPeso(lc.goods)+' + fees '+fmtPeso(lc.feesTotal)+' = '+fmtPeso(lc.landed)+'\n\nEach line gets its landed ₱/unit; the PO\'s landed-cost add-on and FX rate are set from this shipment, which is what Landed cost & valuation reads.',{ok:'Apply'}))return;
  try{
    for(const l of L)if(lc.per[l.id]!=null)await SB.from('shipment_lines').update({landed_unit_cost:lc.per[l.id]}).eq('id',l.id);
    await SB.from('shipments').update({landed_total:lc.landed,landed_total_fees:lc.feesTotal,landed_applied_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
    if(s.po_id){
      // the PO's add-on = the fees of every applied shipment on it; its FX rate = this shipment's (the latest payment)
      const {data:sib}=await SB.from('shipments').select('landed_total_fees').eq('po_id',s.po_id).not('landed_applied_at','is',null);
      const fees=(sib||[]).reduce((a,x)=>a+(+x.landed_total_fees||0),0)+((sib||[]).length?0:lc.feesTotal);
      await SB.from('pos').update({landed_cost:Math.round(fees*100)/100,fx_rate:lc.rate||null,updated_at:new Date().toISOString()}).eq('id',s.po_id);
    }
    audit('shipment.landed',{ship:SHIP_NO(id),goods:lc.goods,fees:lc.feesTotal,landed:lc.landed,method:s.alloc_method||'value'});
    await loadShipments(true);keepScroll();renderReceiving();
  }catch(e){uiAlert('Could not apply: '+(e.message||e));}
}
async function shipClaim(id){
  const s=(SHIPMENTS||[]).find(x=>x.id===id);if(!s)return;
  const L=(SHIP_LINES[id]||[]).filter(l=>l.received&&l.qty_counted!=null&&(+l.qty_counted)!==(+l.qty_expected));
  window._cpPrefill={supplier:s.supplier,po_ref:SHIP_NO(id)+(s.po_id?' · '+PO_NO(s.po_id):''),kind:L.some(l=>(+l.qty_counted)<(+l.qty_expected))?'Short shipment':'Wrong item / batch',
    desc:L.map(l=>l.sku+': expected '+l.qty_expected+', counted '+l.qty_counted).join('; ')};
  window._cpDir='supplier';CP_DIR='supplier';showView('complaints',null);
}
