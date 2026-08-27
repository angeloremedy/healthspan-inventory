/* ── AUDIT TRAIL — who changed what, when. Fire-and-forget; never blocks the action ── */
function audit(action,detail){
  try{
    if(!SB||!SBUSER)return;
    SB.from('audit_log').insert({user_id:SBUSER.id,who:(SBPROFILE&&SBPROFILE.name)||SBUSER.email||'',action,detail:JSON.stringify(detail||{}).slice(0,900)}).then(()=>{});
  }catch(e){}
}
async function renderAudit(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  let rows=[];
  try{const {data}=await SB.from('audit_log').select('at,who,action,detail').order('at',{ascending:false}).limit(400);rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — has the audit_log table been created? (SUPABASE-SETUP.md)</div>';return;}
  const fmt=d=>{try{const o=JSON.parse(d||'{}');return Object.keys(o).map(k=>k+': '+String(o[k])).join(' · ');}catch(e){return d||'';}};
  $('content').innerHTML=
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td class="mu" style="white-space:nowrap;font-size:11px">'+esc(String(r.at||'').slice(0,16).replace('T',' '))+'</td>'+
      '<td style="font-weight:600">'+esc(r.who||'')+'</td><td><span class="pill pbl">'+esc(r.action)+'</span></td>'+
      '<td class="mu" style="font-size:11.5px;max-width:420px;overflow:hidden;text-overflow:ellipsis">'+esc(fmt(r.detail))+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Latest '+rows.length+' events · orders, payments, shipments, merges, and account management are logged automatically</span></div></div>';
}

/* ── DEMAND PLANNING: forecast snapshots (MAPE), campaign calendar, AI review ── */
// 1) Once a month, freeze what the model predicts per SKU. Next month, the change in
//    cumulative sold units becomes the "actual" — forecast vs reality, honestly scored.
async function maybeSnapshotForecast(){
  try{
    if(window._fsnapDone||!SB||!SBUSER||!canManage()||!(DATA&&DATA.length))return;
    window._fsnapDone=true;
    const ym=new Date().toISOString().slice(0,7);
    const {count}=await SB.from('forecast_snapshots').select('sku',{count:'exact',head:true}).eq('month',ym);
    if(count>0)return;
    const rows=DATA.filter(p=>((p.velAdj||0)>0||(p.velocity||0)>0)&&p.sku).map(p=>({
      month:ym,sku:p.sku,name:p.name||p.sku,
      forecast_units:Math.round(((p.velAdj!=null?p.velAdj:p.velocity)||0)*10)/10,
      sold_cum:p.sold||0}));
    if(!rows.length)return;
    for(let i=0;i<rows.length;i+=200)await SB.from('forecast_snapshots').upsert(rows.slice(i,i+200));
    // score LAST month: actual = this capture's cumulative sold − last capture's
    const d=new Date(ym+'-15');d.setMonth(d.getMonth()-1);const prev=d.toISOString().slice(0,7);
    const {data:prevRows}=await SB.from('forecast_snapshots').select('sku,sold_cum,actual_units').eq('month',prev);
    if(prevRows&&prevRows.length){
      const cur={};rows.forEach(r=>cur[r.sku]=r.sold_cum);
      const upd=prevRows.filter(r=>r.actual_units==null&&cur[r.sku]!=null).map(r=>({month:prev,sku:r.sku,actual_units:Math.max(0,(cur[r.sku]||0)-(r.sold_cum||0))}));
      for(let i=0;i<upd.length;i+=200)await SB.from('forecast_snapshots').upsert(upd.slice(i,i+200));
    }
    audit('forecast.snapshot',{month:ym,skus:rows.length});
  }catch(e){}
}
async function renderFcastAcc(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  maybeSnapshotForecast();
  let rows=[];
  try{const {data}=await SB.from('forecast_snapshots').select('month,sku,name,forecast_units,actual_units').order('month',{ascending:false}).limit(5000);rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — has the forecast_snapshots table been created? (SUPABASE-SETUP.md)</div>';return;}
  const scored=rows.filter(r=>r.actual_units!=null);
  const months=[...new Set(scored.map(r=>r.month))].sort().reverse();
  if(!months.length){
    const ym=new Date().toISOString().slice(0,7);
    const captured=rows.filter(r=>r.month===ym).length;
    $('content').innerHTML='<div class="empty" style="margin-top:40px">No scored months yet.<br><br>'+
      (captured?'This month’s forecast ('+captured+' SKUs) is frozen — the first accuracy scores appear after next month’s snapshot.':'The first snapshot is captured automatically when an admin or manager opens the app each month.')+'</div>';
    return;
  }
  const sel=window._faMonth&&months.includes(window._faMonth)?window._faMonth:months[0];window._faMonth=sel;
  const scoreMonth=m=>{
    const rs=scored.filter(r=>r.month===m&&r.actual_units>0);
    if(!rs.length)return null;
    const mape=rs.reduce((a,r)=>a+Math.abs(r.forecast_units-r.actual_units)/r.actual_units,0)/rs.length*100;
    const bias=rs.reduce((a,r)=>a+(r.forecast_units-r.actual_units),0);
    const fu=rs.reduce((a,r)=>a+r.forecast_units,0),au=rs.reduce((a,r)=>a+r.actual_units,0);
    return {n:rs.length,mape,bias,fu,au,wape:au?Math.abs(fu-au)/au*100:0};
  };
  const cur=scoreMonth(sel);
  const mrows=scored.filter(r=>r.month===sel).map(r=>({...r,err:r.actual_units>0?Math.abs(r.forecast_units-r.actual_units)/r.actual_units*100:null}))
    .sort((a,b)=>(b.err??-1)-(a.err??-1));
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">Month</b>'+
    '<select onchange="window._faMonth=this.value;renderFcastAcc()" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12.5px">'+months.map(m=>'<option'+(m===sel?' selected':'')+'>'+m+'</option>').join('')+'</select>'+
    '<span style="font-size:11px;color:var(--tx3)">forecast frozen at the start of each month, scored against what actually moved</span></div>'+
    (cur?'<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">MAPE</div><div class="met-val">'+cur.mape.toFixed(0)+'%</div><div class="met-sub">avg per-SKU error ('+cur.n+' SKUs)</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Total-units error</div><div class="met-val">'+cur.wape.toFixed(0)+'%</div><div class="met-sub">forecast '+Math.round(cur.fu).toLocaleString()+' vs actual '+Math.round(cur.au).toLocaleString()+' u</div><div class="met-bar"></div></div>'+
    '<div class="met '+(cur.bias>=0?'am':'pu')+'"><div class="met-lbl">Bias</div><div class="met-val">'+(cur.bias>=0?'+':'')+Math.round(cur.bias).toLocaleString()+' u</div><div class="met-sub">'+(cur.bias>=0?'over-forecasting':'under-forecasting')+' overall</div><div class="met-bar"></div></div>'+
    '<div class="met"><div class="met-lbl">Months scored</div><div class="met-val">'+months.length+'</div><div class="met-sub">history builds automatically</div><div class="met-bar"></div></div>'+
    '</div>':'')+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th style="text-align:right">Forecast</th><th style="text-align:right">Actual</th><th style="text-align:right">Error</th><th></th></tr></thead><tbody>'+
    mrows.map(r=>'<tr><td style="font-weight:600">'+esc(r.name||r.sku)+'</td><td class="r">'+r.forecast_units+'</td><td class="r">'+r.actual_units+'</td>'+
      '<td class="r" style="font-weight:600;color:'+(r.err==null?'var(--tx3)':r.err>50?'var(--rd)':r.err>25?'var(--am)':'var(--gr)')+'">'+(r.err==null?'—':r.err.toFixed(0)+'%')+'</td>'+
      '<td class="mu" style="font-size:11px">'+(r.err==null?(r.forecast_units>0&&!r.actual_units?'forecast but zero moved':''):r.forecast_units>r.actual_units?'over':'under')+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>MAPE = mean absolute % error on SKUs that actually sold · big misses at the top — those are the SKUs where the model (or an unplanned event) needs a look · the AI planning review reads these numbers too</span></div></div>';
}

// 2) Campaign calendar — planned promos/campaigns as a demand signal
let CAMPAIGNS=null;
async function loadCampaigns(force){
  if(CAMPAIGNS&&!force)return CAMPAIGNS;
  CAMPAIGNS=[];
  if(SB){try{const {data}=await SB.from('campaigns').select('*').order('from_date',{ascending:false}).limit(200);CAMPAIGNS=data||[];}catch(e){}}
  return CAMPAIGNS;
}
async function renderCampaigns(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  await loadCampaigns(true);
  const today=new Date().toISOString().slice(0,10);
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px"';
  const state=c=>c.to_date<today?'<span class="pill pgy">done</span>':c.from_date>today?'<span class="pill pbl">upcoming</span>':'<span class="pill pgr">running</span>';
  $('content').innerHTML=
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">Add campaign / promo</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<input id="cp-name" placeholder="Name (e.g. Anniversary 10+8)" '+inp+' style="flex:1;min-width:160px;'+inp.slice(7,-1)+'">'+
    '<input id="cp-from" type="date" '+inp+'><span style="font-size:12px;color:var(--tx3)">to</span><input id="cp-to" type="date" '+inp+'>'+
    '<input id="cp-skus" placeholder="SKUs / lines affected (free text)" '+inp+' style="flex:1;min-width:160px;'+inp.slice(7,-1)+'">'+
    '<input id="cp-up" type="number" placeholder="expected uplift %" '+inp+' style="width:130px;'+inp.slice(7,-1)+'">'+
    '<button onclick="campaignAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer">Add</button></div></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Campaign</th><th>Runs</th><th>Status</th><th>SKUs / lines</th><th style="text-align:right">Expected uplift</th><th></th></tr></thead><tbody>'+
    ((CAMPAIGNS||[]).map(c=>'<tr><td style="font-weight:600">'+esc(c.name)+'</td><td class="mu" style="font-size:11.5px">'+esc(c.from_date)+' → '+esc(c.to_date)+'</td><td>'+state(c)+'</td>'+
      '<td class="mu" style="font-size:11.5px;max-width:240px;overflow:hidden;text-overflow:ellipsis">'+esc(c.skus||'all')+'</td>'+
      '<td class="r">'+(c.uplift_pct!=null?'+'+c.uplift_pct+'%':'—')+'</td>'+
      '<td><a href="#" onclick="campaignDel('+c.id+');return false" style="color:var(--rd);font-size:11px">remove</a></td></tr>').join('')||'<tr><td colspan="6"><div class="empty">No campaigns yet — add the next promo so the forecast and the AI review can see it coming.</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Active & upcoming campaigns show as a banner on the stockout forecast and feed the AI planning review · precursor to the full promotions engine on the roadmap</span></div></div>';
}
async function campaignAdd(){
  if(!canManage()||!SB)return;
  const g=id=>($(id)&&$(id).value||'').trim();
  if(!g('cp-name')||!g('cp-from')||!g('cp-to'))return alert('Need a name and both dates.');
  try{
    const {error}=await SB.from('campaigns').insert({name:g('cp-name'),from_date:g('cp-from'),to_date:g('cp-to'),skus:g('cp-skus')||null,uplift_pct:g('cp-up')?parseInt(g('cp-up'),10):null,created_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('campaign.add',{name:g('cp-name'),from:g('cp-from'),to:g('cp-to')});
    renderCampaigns();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('campaigns')?'\n\n(Run the campaigns SQL from SUPABASE-SETUP.md.)':''));}
}
async function campaignDel(id){
  if(!canManage()||!SB||!confirm('Remove this campaign?'))return;
  try{const {error}=await SB.from('campaigns').delete().eq('id',id);if(error)throw error;renderCampaigns();}catch(e){alert(e.message||e);}
}

// 3) AI planning review — the existing Ask AI worker walks the whole catalog and
//    reports exceptions in plain language (stock risks, misses, campaign impacts)
async function renderPlanReview(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  $('content').innerHTML=
    '<div class="panel" style="padding:18px;max-width:760px">'+
    '<div class="phd">AI planning review</div>'+
    '<div style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">The AI walks every SKU — stock, velocity, days-to-stockout, expiry — plus the campaign calendar and last month’s forecast accuracy, and reports what needs attention: stockout risks, overstock/expiry money, forecast misses, and what to do about each. Takes ~30–60 seconds on the smart model.</div>'+
    '<button id="pr-btn" onclick="runPlanReview()" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:13.5px;font-weight:700;cursor:pointer">Run planning review</button>'+
    '<div id="pr-out" style="margin-top:16px;font-size:13px;line-height:1.65"></div></div>';
}
async function runPlanReview(){
  const btn=$('pr-btn'),out=$('pr-out');
  if(!out||btn.disabled)return;
  btn.disabled=true;btn.textContent='Reviewing…';
  out.innerHTML='<span style="color:var(--tx3)">Gathering the catalog, campaigns, and accuracy history…</span>';
  try{
    await loadCampaigns();
    let acc='';
    try{
      const {data}=await SB.from('forecast_snapshots').select('month,name,forecast_units,actual_units').not('actual_units','is',null).order('month',{ascending:false}).limit(300);
      const scored=(data||[]).filter(r=>r.actual_units>0);
      if(scored.length){
        const worst=scored.map(r=>({...r,err:Math.abs(r.forecast_units-r.actual_units)/r.actual_units*100})).sort((a,b)=>b.err-a.err).slice(0,12);
        acc='\n\nRecent forecast accuracy (worst misses — forecast vs actual units):\n'+worst.map(r=>r.month+' '+r.name+': F'+r.forecast_units+' vs A'+r.actual_units+' ('+r.err.toFixed(0)+'% off)').join('\n');
      }
    }catch(e){}
    const today=new Date().toISOString().slice(0,10);
    const camps=(CAMPAIGNS||[]).filter(c=>c.to_date>=today);
    const campTxt=camps.length?'\n\nPlanned/running campaigns (expect demand uplift on these):\n'+camps.map(c=>c.name+' ('+c.from_date+' to '+c.to_date+', '+(c.skus||'all products')+(c.uplift_pct?', ~+'+c.uplift_pct+'%':'')+')').join('\n'):'\n\nNo campaigns planned.';
    const q='You are Healthspan\'s demand planner doing the monthly planning review. Using the live catalog data you have (stock, velocity, months of stock, days to stockout, expiry, batches), plus the notes below, give a decisive exception report: 1) SKUs at real stockout risk in the next 60 days (consider campaign uplift — flag any campaign SKU that cannot support the promo), 2) overstock and expiry money at risk worth acting on, 3) what last month\'s worst forecast misses suggest (one-off event vs trend change), 4) exactly 5 prioritized actions for Paul with quantities where possible. Be specific with product names and numbers; no preamble; keep it under 450 words.'+campTxt+acc;
    const r=await fetch('/.netlify/functions/ask',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),body:JSON.stringify({question:q,catalog:askCatalog(),history:[]})});
    const job=await r.json();
    if(!job.id)throw new Error(job.error||'could not start');
    let res=null;
    for(let i=0;i<70;i++){
      await new Promise(s=>setTimeout(s,2500));
      if(i===6)out.innerHTML='<span style="color:var(--tx3)">Thinking it through — deep review takes a little longer…</span>';
      try{const rr=await fetch('/.netlify/functions/ask?id='+job.id,{headers:await sbAuthHeaders()});const o=await rr.json();if(!o.pending){res=o;break;}}catch(e){}
    }
    if(!res||!res.answer)throw new Error((res&&res.error)||'Timed out — please run it again.');
    out.innerHTML=askFmt(res.answer)+'<div style="font-size:10.5px;color:var(--tx3);margin-top:12px">Generated '+new Date().toLocaleString()+' · AI analysis over live data — sanity-check quantities before ordering</div>';
    audit('planning.review',{campaigns:camps.length});
  }catch(e){out.innerHTML='<span style="color:var(--rd)">Could not complete the review: '+esc(e.message||e)+'</span>';}
  btn.disabled=false;btn.textContent='Run planning review';
}

/* ── REVIEW SCORECARDS: quarterly per-specialist performance, auto-filled from live
      data, with manager rating + comments (the HR review, done from numbers) ── */
function scQuarters(){
  const out=[];const d=new Date();
  for(let i=0;i<5;i++){
    const q=Math.floor(d.getMonth()/3);
    out.push({key:d.getFullYear()+'-Q'+(q+1),months:[0,1,2].map(k=>d.getFullYear()+'-'+String(q*3+k+1).padStart(2,'0'))});
    d.setMonth(d.getMonth()-3);
  }
  return out;
}
async function renderScorecards(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  if(!SHOPIFY||!SHOPIFY.specialists){$('content').innerHTML='<div class="empty" style="margin-top:40px">Waiting for the sales cache…</div>';try{loadShopify().then(()=>{if(currentView==='scorecards')renderScorecards();});}catch(e){}return;}
  if(!VISITS){loadVisits().then(()=>{if(currentView==='scorecards')renderScorecards();});}
  const qs=scQuarters();
  const sel=window._scQ&&qs.some(q=>q.key===window._scQ)?window._scQ:qs[0].key;window._scQ=sel;
  const Q=qs.find(q=>q.key===sel),P=qs[qs.findIndex(q=>q.key===sel)+1]||null;
  let notes={};
  try{const {data}=await SB.from('review_notes').select('*').eq('quarter',sel);(data||[]).forEach(r=>notes[specCanon(r.spec).toLowerCase()]=r);}catch(e){}
  // merge case-variant tags into canonical specialists
  const S={};
  for(const raw in (SHOPIFY.specialists||{})){
    const cn=specCanon(raw);if(!cn||INTERNAL_TAG.test(cn))continue;
    const k=cn.toLowerCase();
    const e=S[k]||(S[k]={name:cn,monthly:{}});
    const m=SHOPIFY.specialists[raw].monthly||{};
    for(const ym in m){const t=e.monthly[ym]||(e.monthly[ym]={u:0,v:0});t.u+=m[ym].u||0;t.v+=m[ym].v||0;}
  }
  const sumQ=(e,months,f)=>months.reduce((a,ym)=>a+(((e.monthly[ym]||{})[f])||0),0);
  const tgtQ=k=>{let t=0,has=false;for(const ym of Q.months){const x=(TARGETS||[]).find(x=>x.month===ym&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===k);if(x){t+=x.value||0;has=true;}}return has?t:null;};
  const vQ={},aQ={};
  for(const v of (VISITS||[])){
    if(v.status==='planned')continue;
    const ym=(v.date||'').slice(0,7);if(!Q.months.includes(ym))continue;
    const k=specCanon(v.spec||'').toLowerCase();if(!k)continue;
    vQ[k]=(vQ[k]||0)+1;(aQ[k]||(aQ[k]=new Set())).add(custNorm(v.account||''));
  }
  const rows=Object.keys(S).map(k=>{
    const e=S[k];
    const rev=sumQ(e,Q.months,'v'),units=sumQ(e,Q.months,'u');
    const prev=P?sumQ(e,P.months,'v'):0;
    const T=tgtQ(k);
    return {k,name:e.name,rev,units,prev,T,att:T?rev/T*100:null,visits:vQ[k]||0,accts:(aQ[k]&&aQ[k].size)||0,note:notes[k]||null};
  }).filter(r=>r.rev>0||r.prev>0||r.T||r.note).sort((a,b)=>b.rev-a.rev);
  const dPill=(rev,prev)=>{if(!prev)return rev?'<span class="pill pbl">new/rejoined</span>':'';const d=(rev-prev)/prev*100;return '<span style="font-weight:700;color:'+(d>=5?'var(--gr)':d<=-5?'var(--rd)':'var(--tx3)')+'">'+(d>=0?'+':'')+d.toFixed(0)+'% vs prev qtr</span>';};
  $('content').innerHTML=
    '<div class="no-print panel" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">Quarter</b>'+
    '<select onchange="window._scQ=this.value;renderScorecards()" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12.5px">'+qs.map(q=>'<option'+(q.key===sel?' selected':'')+'>'+q.key+'</option>').join('')+'</select>'+
    '<span style="font-size:11.5px;color:var(--tx3)">numbers auto-filled from live sales, targets & visits · ratings and comments save per specialist per quarter</span>'+
    '<span style="flex:1"></span><button onclick="window.print()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">🖨 Print all</button></div>'+
    (rows.length?rows.map(r=>{
      const n=r.note||{};
      return '<div class="panel" style="padding:16px;margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:15px"><a href="#" onclick="showSpecPage(\''+esc(r.name).replace(/'/g,'&#39;')+'\');return false" style="color:var(--tx);text-decoration:none">'+esc(r.name)+'</a></b>'+dPill(r.rev,r.prev)+'<span style="flex:1"></span>'+
      (r.att!=null?'<span class="pill '+(r.att>=100?'pgr':r.att>=80?'':'prd')+'" style="'+(r.att<100&&r.att>=80?'background:var(--am-bg);color:var(--am)':'')+'">'+r.att.toFixed(0)+'% of target</span>':'<span class="pill pgy">no target set</span>')+'</div>'+
      '<div class="metrics" style="margin-bottom:10px">'+
      '<div class="met gr"><div class="met-lbl">Booked</div><div class="met-val" style="font-size:14px">'+fmtPeso(r.rev)+'</div><div class="met-sub">'+(r.T?'target '+fmtPeso(r.T):'—')+'</div><div class="met-bar"></div></div>'+
      '<div class="met bl"><div class="met-lbl">Units</div><div class="met-val" style="font-size:14px">'+r.units.toLocaleString()+'</div><div class="met-sub">prev qtr '+fmtPeso(r.prev)+'</div><div class="met-bar"></div></div>'+
      '<div class="met am"><div class="met-lbl">Visits</div><div class="met-val" style="font-size:14px">'+r.visits+'</div><div class="met-sub">'+r.accts+' accounts touched</div><div class="met-bar"></div></div>'+
      '<div class="met pu"><div class="met-lbl">₱ per visit</div><div class="met-val" style="font-size:14px">'+(r.visits?fmtPeso(Math.round(r.rev/r.visits)):'—')+'</div><div class="met-sub">selling efficiency</div><div class="met-bar"></div></div>'+
      '</div>'+
      '<div class="no-print" style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">'+
      '<select id="sc-r-'+r.k+'" style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px;font-size:12.5px"><option value="">Rating…</option>'+[5,4,3,2,1].map(x=>'<option value="'+x+'"'+(n.rating===x?' selected':'')+'>'+'★'.repeat(x)+' '+x+'</option>').join('')+'</select>'+
      '<textarea id="sc-c-'+r.k+'" rows="2" placeholder="Manager comments — wins, coaching points, agreements…" style="flex:1;min-width:220px;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px">'+esc(n.comments||'')+'</textarea>'+
      '<button onclick="scSave(\''+r.k+'\',\''+esc(r.name).replace(/'/g,'&#39;')+'\')" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer">Save</button></div>'+
      (n.comments?'<div style="display:none" class="print-note"><b>Review:</b> '+(n.rating?'★'.repeat(n.rating)+' · ':'')+esc(n.comments)+'</div>':'')+
      (n.updated_at?'<div class="no-print" style="font-size:10px;color:var(--tx3);margin-top:4px">Last saved '+esc(String(n.updated_at).slice(0,16).replace('T',' '))+'</div>':'')+
      '</div>';}).join(''):'<div class="empty" style="margin-top:30px">No specialist activity found for '+sel+'.</div>')+
    '<style>@media print{.print-note{display:block !important;font-size:12px;margin-top:6px}}</style>';
}
async function scSave(k,name){
  if(!canManage())return;
  const rating=parseInt((($('sc-r-'+k)||{}).value||''),10)||null;
  const comments=(($('sc-c-'+k)||{}).value||'').trim()||null;
  try{
    const {error}=await SB.from('review_notes').upsert({spec:name,quarter:window._scQ,rating,comments,updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()});
    if(error)throw error;
    audit('review.save',{spec:name,quarter:window._scQ,rating});
    renderScorecards();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('review_notes')?'\n\n(Run the review_notes SQL from SUPABASE-SETUP.md.)':''));}
}

/* ── INDEPENDENCE MODULE: cutover flags · item master · reorder-due · returns/CM ·
      shadow stock ledger · pick confirmation · barcode scanning ──
   PARALLEL-RUN RULE: Shopify (pricing/orders) and Verna's sheet (stock) stay the
   source of truth until the matching flag is flipped on the Cutover switches page. */

// Cutover flags — the "declare independence" switches
let FLAGS={};
async function loadFlags(force){
  if(window._flagsLoaded&&!force)return FLAGS;
  try{const {data}=await SB.from('app_settings').select('key,value');FLAGS={};(data||[]).forEach(r=>FLAGS[r.key]=r.value);window._flagsLoaded=true;}catch(e){}
  return FLAGS;
}
const flagOn=k=>FLAGS[k]==='on';
async function setFlag(k,v,label){
  if(ROLE!=='admin')return alert('Admins only.');
  if(!confirm((v==='on'?'TURN ON: ':'TURN OFF: ')+label+'\n\nThis changes which system the app treats as the truth. Proceed?'))return;
  try{
    const {error}=await SB.from('app_settings').upsert({key:k,value:v,updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()});
    if(error)throw error;
    audit('cutover.'+k,{value:v});
    await loadFlags(true);
    applyCatalog();
    renderCutover();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('app_settings')?'\n\n(Run the independence SQL from SUPABASE-SETUP.md.)':''));}
}
async function renderCutover(){
  if(ROLE!=='admin'){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  await loadFlags(true);await loadItems();
  let moves=0,rets=0;
  try{const {count}=await SB.from('stock_moves').select('id',{count:'exact',head:true});moves=count||0;}catch(e){}
  try{const {count}=await SB.from('returns').select('id',{count:'exact',head:true});rets=count||0;}catch(e){}
  const items=Object.values(ITEMS||{});
  const drift=items.filter(it=>{const p=DATA.find(d=>d.sku===it.sku);return p&&p.price&&it.price!=null&&Math.round(p.price)!==it.price;}).length;
  const sw=(k,label,desc,ready)=>{
    const on=flagOn(k);
    return '<div class="panel" style="padding:14px 16px;margin-bottom:12px;border-left:3px solid '+(on?'var(--gr)':'var(--am)')+'">'+
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b style="font-size:13.5px">'+label+'</b>'+
      (on?'<span class="pill pgr">INDEPENDENT</span>':'<span class="pill" style="background:var(--am-bg);color:var(--am)">parallel run — legacy is truth</span>')+
      '<span style="flex:1"></span>'+
      '<button onclick="setFlag(\''+k+'\',\''+(on?'off':'on')+'\',\''+label+'\')" style="background:'+(on?'var(--am)':'var(--gr)')+';color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">'+(on?'Revert to legacy':'Declare independence')+'</button></div>'+
      '<div style="font-size:12px;color:var(--tx2);margin-top:6px">'+desc+'</div>'+
      '<div style="font-size:11.5px;margin-top:6px;color:var(--tx3)"><b>Readiness:</b> '+ready+'</div></div>';
  };
  $('content').innerHTML=
    '<div style="max-width:820px">'+
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px;font-size:12.5px;color:var(--tx2)"><b style="color:var(--tx)">The declaration of independence, one system at a time.</b><br>Everything below is built and testable while Shopify and Verna’s sheet remain the truth. Flip a switch only when its readiness case is proven — each flip is reversible and audited.</div>'+
    sw('use_catalog_pricing','Pricing truth: Item master (replaces Shopify pricing)',
      'OFF: order entry and analytics price from Shopify. ON: prices come from your Item master; Shopify becomes reference-only.',
      items.length+' items in the master · '+(items.length?drift+' price(s) differ from Shopify right now (review in Item master before flipping)':'seed the Item master first (Item master → Import current catalog)'))+
    sw('native_only_orders','Order entry: platform only (stop double-entry in Shopify)',
      'OFF: pilot rule — specialists enter orders here AND in Shopify. ON: the “also enter in Shopify” reminder disappears; this platform is the sole order register going forward.',
      'Requires: a full parallel month reconciling to accounting, and the accounting export + credit memos signed off')+
    sw('ledger_is_truth','Stock truth: platform ledger (replaces Verna’s sheet)',
      'OFF: the scan/pick ledger records shadow movements for comparison only; the sheet remains stock truth. ON: the ledger is authoritative (WMS Stage 2 endgame — flip LAST).',
      moves+' shadow movements recorded so far · requires receiving + pick confirmation + two matching cycle counts, and Verna’s sign-off')+
    '<div class="panel" style="padding:12px 16px;font-size:12px;color:var(--tx3)">Also live in shadow mode: Returns & credit memos ('+rets+' recorded — process in Shopify too while parallel) · re-running the backfill stays the Shopify sync until "platform only" is on.</div>'+
    '</div>';
}

// ── ITEM MASTER (catalog): shadow until use_catalog_pricing is ON
let ITEMS=null;
async function loadItems(force){
  if(ITEMS&&!force)return ITEMS;
  ITEMS={};
  try{const {data}=await SB.from('items').select('*');(data||[]).forEach(r=>ITEMS[r.sku]=r);}catch(e){}
  return ITEMS;
}
function applyCatalog(){ // when independent, the item master overrides prices everywhere
  try{
    if(!flagOn('use_catalog_pricing')||!ITEMS||!(DATA&&DATA.length))return;
    for(const p of DATA){const it=ITEMS[p.sku];if(!it||it.active===false)continue;
      if(it.price!=null){p.price=it.price;p.priceSrc='catalog';}
      if(it.deals){try{const ds=JSON.parse(it.deals);if(ds.length)p.deals=ds.map(d=>({title:d.buy+'+'+d.free+' '+(it.name||p.name),setSize:d.buy+d.free,price:d.price}));}catch(e){}}
    }
  }catch(e){}
}
async function renderCatalog(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  await loadFlags();await loadItems(true);
  const items=Object.values(ITEMS).sort((a,b)=>String(a.sku).localeCompare(String(b.sku)));
  const on=flagOn('use_catalog_pricing');
  const shopP={};DATA.forEach(p=>shopP[p.sku]=p.price);
  const inp='style="width:110px;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12.5px;text-align:right"';
  $('content').innerHTML=
    '<div class="panel" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-left:3px solid '+(on?'var(--gr)':'var(--am)')+'">'+
    (on?'<span class="pill pgr">TRUTH — this catalog prices the app</span>':'<span class="pill" style="background:var(--am-bg);color:var(--am)">shadow — Shopify still prices the app</span>')+
    '<span style="font-size:12px;color:var(--tx3)">'+items.length+' items · edit prices/costs here, compare against Shopify, flip the switch on the Cutover page when clean</span>'+
    '<span style="flex:1"></span>'+
    '<button onclick="catalogSeed()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer">⇩ Import current catalog</button>'+
    '<button onclick="catalogAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">+ New item</button></div>'+
    '<div id="cat-msg" style="min-height:14px;font-size:12px;margin-bottom:6px"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Name</th><th>Line</th><th style="text-align:right">Price ₱</th><th style="text-align:right">Shopify ₱</th><th style="text-align:right">Cost ₱</th><th style="text-align:right">Margin</th><th>Deals</th><th>Barcode</th><th></th></tr></thead><tbody>'+
    (items.length?items.map(it=>{
      const sp=shopP[it.sku];
      const drift=sp&&it.price!=null&&Math.round(sp)!==it.price;
      const mg=it.price&&it.cost?((it.price-it.cost)/it.price*100).toFixed(0)+'%':'—';
      return '<tr'+(it.active===false?' style="opacity:.45"':'')+'><td style="font-weight:600">'+esc(it.sku)+'</td>'+
      '<td style="max-width:230px;overflow:hidden;text-overflow:ellipsis">'+esc(it.name||'')+(it.active===false?' <span class="pill pgy">inactive</span>':'')+'</td>'+
      '<td class="mu" style="font-size:11px">'+esc(it.line||'')+'</td>'+
      '<td class="r"><input type="number" value="'+(it.price!=null?it.price:'')+'" onchange="catalogSet(\''+esc(it.sku)+'\',\'price\',this.value)" '+inp+'></td>'+
      '<td class="r '+(drift?'':'mu')+'" style="'+(drift?'color:var(--am);font-weight:700':'')+'">'+(sp?fmtPeso(sp):'—')+(drift?' ⚠':'')+'</td>'+
      '<td class="r"><input type="number" value="'+(it.cost!=null?it.cost:'')+'" onchange="catalogSet(\''+esc(it.sku)+'\',\'cost\',this.value)" '+inp+'></td>'+
      '<td class="r" style="font-weight:600">'+mg+'</td>'+
      (function(){let n=0;try{n=JSON.parse(it.deals||'[]').length;}catch(e){}return '<td><a href="#" onclick="catalogDeals(\''+esc(it.sku)+'\');return false" style="color:var(--ac);font-size:11px">'+(n?n+' deal'+(n>1?'s':''):'+ deals')+'</a></td>';})()+
      '<td><input value="'+esc(it.barcode||'')+'" placeholder="scan code" onchange="catalogSet(\''+esc(it.sku)+'\',\'barcode\',this.value)" style="width:120px;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:11.5px"></td>'+
      '<td><a href="#" onclick="catalogSet(\''+esc(it.sku)+'\',\'active\','+(it.active===false?'true':'false')+');return false" style="color:'+(it.active===false?'var(--gr)':'var(--tx3)')+';font-size:11px">'+(it.active===false?'activate':'deactivate')+'</a></td></tr>';
    }).join(''):'<tr><td colspan="10"><div class="empty">Empty — tap “Import current catalog” to seed every product with its current sheet/Shopify data, then add costs.</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>⚠ = price here differs from Shopify (drift to resolve before independence) · costs enable true margin reporting · barcode links a scan code to the SKU for the Scan view · edits save instantly and are audited</span></div></div>';
}
async function catalogSeed(){
  if(!canManage())return;
  if(!DATA.length)return alert('Wait for the sheet sync first.');
  if(!confirm('Seed/refresh the item master from the current catalog ('+DATA.length+' products)?\n\nPrices you have already edited here are kept; only missing items and empty prices are filled.'))return;
  try{
    await loadItems(true);
    const rows=DATA.map(p=>{
      const ex=ITEMS[p.sku]||{};
      return {sku:p.sku,name:p.name||p.sku,line:p.line||null,category:p.category||null,
        price:(ex.price!=null?ex.price:(p.price!=null?Math.round(p.price):null)),
        cost:ex.cost!=null?ex.cost:null,barcode:ex.barcode||null,
        active:ex.active!==false,updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()};
    });
    for(let i=0;i<rows.length;i+=200){const {error}=await SB.from('items').upsert(rows.slice(i,i+200));if(error)throw error;}
    audit('catalog.seed',{items:rows.length});
    renderCatalog();
  }catch(e){alert('Could not seed: '+(e.message||e)+(String(e.message||'').includes('items')?'\n\n(Run the independence SQL from SUPABASE-SETUP.md.)':''));}
}
async function catalogSet(sku,field,val){
  if(!canManage())return;
  try{
    const patch={updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()};
    if(field==='active')patch.active=(val===true||val==='true');
    else if(field==='barcode')patch.barcode=String(val||'').trim()||null;
    else patch[field]=val===''?null:Math.round(parseFloat(val));
    const {error}=await SB.from('items').update(patch).eq('sku',sku);
    if(error)throw error;
    audit('catalog.edit',{sku,field,val:String(val).slice(0,40)});
    await loadItems(true);applyCatalog();
    const m=$('cat-msg');if(m){m.style.color='var(--gr)';m.textContent=sku+' saved.';}
    if(field==='active')renderCatalog();
  }catch(e){alert('Could not save: '+(e.message||e));}
}
async function catalogAdd(){
  if(!canManage())return;
  const sku=prompt('New SKU code:','');if(!sku||!sku.trim())return;
  const name=prompt('Product name:','');if(name===null)return;
  try{
    const {error}=await SB.from('items').insert({sku:sku.trim(),name:(name||sku).trim(),active:true,updated_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('catalog.add',{sku:sku.trim()});
    renderCatalog();
  }catch(e){alert('Could not add: '+(e.message||e));}
}

// ── REORDER-DUE ALERTS: each account's buying rhythm vs the calendar
function renderSalesDue(){
  const recent=(SHOPIFY&&SHOPIFY.recent)||[];
  if(!recent.length){$('content').innerHTML='<div class="empty" style="margin-top:40px">Waiting for the sales cache…</div>';try{loadShopify().then(()=>{if(currentView==='salesdue')renderSalesDue();});}catch(e){}return;}
  const byC={};
  for(const o of recent){
    const c=acctDedup(o.c||'');if(!c||/pull\s*-?\s*out/i.test(c))continue;
    const k=custNorm(c);if(!k)continue;
    const e=byC[k]||(byC[k]={name:c,dates:new Set(),spec:{},val:0});
    e.dates.add(o.dt);e.val+=(o.ls||[]).reduce((a,l)=>a+(l[2]||0),0);
    const t=specCanon(o.t||'');if(t&&!INTERNAL_TAG.test(t))e.spec[t]=(e.spec[t]||0)+1;
  }
  for(const o of (NORDERS||[])){ // native orders count toward the rhythm too
    if(o.deleted_at||o.status==='cancelled')continue;
    const k=custNorm(acctDedup(o.account||''));if(!k||!byC[k])continue;
    byC[k].dates.add(o.date);
  }
  const today=Date.now();
  const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const rows=[];
  for(const k in byC){
    const e=byC[k];
    const ds=[...e.dates].sort();
    if(ds.length<3)continue; // need a rhythm
    const gaps=[];for(let i=1;i<ds.length;i++){const g=(new Date(ds[i])-new Date(ds[i-1]))/864e5;if(g>=1)gaps.push(g);}
    if(gaps.length<2)continue;
    gaps.sort((a,b)=>a-b);
    const cycle=Math.round(gaps[Math.floor(gaps.length/2)]); // median gap
    if(cycle<7||cycle>200)continue; // not a meaningful rhythm
    const last=ds[ds.length-1];
    const since=Math.floor((today-new Date(last).getTime())/864e5);
    if(since<cycle*1.25)continue; // not overdue yet
    if(since>cycle*6)continue;    // long-lost — that's the dormant list's job
    const spec=ownerOf(e.name)||Object.entries(e.spec).sort((a,b)=>b[1]-a[1]).map(x=>x[0])[0]||'';
    if(myTag&&specCanon(spec).toLowerCase()!==specCanon(myTag).toLowerCase())continue; // specialists see their own
    rows.push({name:e.name,cycle,last,since,over:since-cycle,spec,val:e.val,orders:ds.length});
  }
  rows.sort((a,b)=>b.val-a.val);
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met am"><div class="met-lbl">Accounts due to reorder</div><div class="met-val">'+rows.length+'</div><div class="met-sub">past their usual cycle</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Value at play</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.val,0))+'</div><div class="met-sub">their 13-month bookings</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">The play</div><div class="met-val" style="font-size:13px">Call today</div><div class="met-sub">they buy on rhythm — be the reminder</div><div class="met-bar"></div></div>'+
    '</div>'+
    (rows.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Account</th><th>Specialist</th><th style="text-align:right">Usual cycle</th><th style="text-align:right">Last order</th><th style="text-align:right">Days over</th><th style="text-align:right">13-mo value</th><th></th></tr></thead><tbody>'+
    rows.map(r=>'<tr onclick="showAccountPage(\''+esc(r.name).replace(/'/g,'&#39;')+'\')" style="cursor:pointer"><td style="font-weight:600;max-width:230px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</td>'+
      '<td class="mu">'+esc(r.spec||'—')+'</td>'+
      '<td class="r mu">~'+r.cycle+'d ('+r.orders+' orders)</td>'+
      '<td class="r mu" style="font-size:11px">'+esc(r.last)+'</td>'+
      '<td class="r" style="font-weight:700;color:'+(r.over>r.cycle?'var(--rd)':'var(--am)')+'">+'+r.over+'d</td>'+
      '<td class="r">'+fmtPeso(r.val)+'</td>'+
      '<td style="white-space:nowrap"><a href="#" onclick="event.stopPropagation();window._lvAccount=\''+esc(r.name).replace(/'/g,'&#39;')+'\';showView(\'logvisit\',null);return false" style="color:var(--ac);font-size:11.5px">log visit</a> · '+
      '<a href="#" onclick="event.stopPropagation();window._noAccount=\''+esc(r.name).replace(/'/g,'&#39;')+'\';showView(\'neworder\',null);return false" style="color:var(--gr);font-size:11.5px">order</a></td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Rhythm = median gap between this account’s orders (needs 3+ orders) · listed when 25% past their cycle, dropped after 6 cycles (that’s the dormant list) · specialists see their own accounts, managers see all</span></div></div>':
    '<div class="empty" style="margin-top:30px">Nobody is overdue against their buying rhythm right now. 🎉</div>');
}

// ── RETURNS & CREDIT MEMOS (shadow: also process in Shopify while parallel)
async function renderReturns(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  await loadFlags();
  let rows=[];
  try{const {data}=await SB.from('returns').select('*').order('id',{ascending:false}).limit(300);rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — run the independence SQL from SUPABASE-SETUP.md first.</div>';return;}
  const acctOpts=acctList().map(r=>'<option value="'+esc(r.name)+'">').join('');
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px"';
  $('content').innerHTML=
    (!flagOn('native_only_orders')?'<div class="panel" style="padding:9px 14px;margin-bottom:12px;border-left:3px solid var(--am);font-size:12px">Parallel run: record the return here <b>and</b> process the refund/return in Shopify — this register becomes the only one at cutover.</div>':'')+
    '<div class="panel" style="padding:12px 16px;margin-bottom:14px"><div class="phd">Record a return / credit memo</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<input id="rt-acct" list="rt-accts" placeholder="Account" '+inp+' style="flex:1;min-width:150px;'+inp.slice(7,-1)+'"><datalist id="rt-accts">'+acctOpts+'</datalist>'+
    '<input id="rt-ref" placeholder="Order ref (opt.)" '+inp+' style="width:110px;'+inp.slice(7,-1)+'">'+
    '<input id="rt-items" placeholder="Items returned (e.g. 2× TD042)" '+inp+' style="flex:1;min-width:150px;'+inp.slice(7,-1)+'">'+
    '<input id="rt-amt" type="number" placeholder="CM amount ₱" '+inp+' style="width:120px;'+inp.slice(7,-1)+'">'+
    '<select id="rt-act" '+inp+'><option value="restock">Back to stock (sellable)</option><option value="writeoff">Write off (damaged/expired)</option></select>'+
    '<input id="rt-why" placeholder="Reason" '+inp+' style="width:140px;'+inp.slice(7,-1)+'">'+
    '<button onclick="returnAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer">Record</button></div></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>CM no.</th><th>Date</th><th>Account</th><th>Items</th><th style="text-align:right">Amount</th><th>Disposition</th><th>Reason</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr><td style="font-weight:700">CM-'+String(1000+r.id)+'</td><td class="mu" style="font-size:11px">'+esc(String(r.created_at||'').slice(0,10))+'</td>'+
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis"><a href="#" onclick="showAccountPage(\''+esc(r.account).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(r.account)+'</a></td>'+
      '<td class="mu" style="font-size:11.5px;max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc(r.items||'—')+(r.order_ref?' · '+esc(r.order_ref):'')+'</td>'+
      '<td class="r" style="font-weight:700">'+fmtPeso(r.amount||0)+'</td>'+
      '<td>'+(r.action==='restock'?'<span class="pill pgr">restocked</span>':'<span class="pill prd">written off</span>')+(r.applied?' <span class="pill pbl">applied to AR</span>':'')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+esc(r.reason||'')+'</td>'+
      '<td style="white-space:nowrap"><a href="#" onclick="printCM('+r.id+');return false" style="color:var(--ac);font-size:11px">🖨 CM</a>'+
      (!r.applied&&r.order_ref&&ROLE==='admin'?' · <a href="#" onclick="applyCM('+r.id+');return false" style="color:var(--gr);font-size:11px">apply to order balance</a>':'')+'</td></tr>').join(''):
      '<tr><td colspan="8"><div class="empty">No returns recorded yet.</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>CM numbers are permanent · "apply to order balance" (admin) reduces the linked native order’s balance by the CM amount · restocked items re-enter the shadow ledger; write-offs are logged for the disposal trail</span></div></div>';
}
async function returnAdd(){
  if(!canManage())return;
  const g=id=>($(id)&&$(id).value||'').trim();
  if(!g('rt-acct')||!g('rt-amt'))return alert('Need at least the account and the CM amount.');
  try{
    const {data,error}=await SB.from('returns').insert({account:g('rt-acct'),order_ref:g('rt-ref')||null,items:g('rt-items')||null,amount:Math.round(parseFloat(g('rt-amt'))),action:($('rt-act')||{}).value||'restock',reason:g('rt-why')||null,created_by:(SBUSER&&SBUSER.id)||null}).select().single();
    if(error)throw error;
    audit('return.record',{cm:'CM-'+String(1000+data.id),account:g('rt-acct'),amount:g('rt-amt'),action:($('rt-act')||{}).value});
    if((($('rt-act')||{}).value)==='restock'&&g('rt-items')){ // shadow ledger note (free-text items)
      try{await SB.from('stock_moves').insert({sku:'(return)',qty:0,kind:'return',ref:'CM-'+String(1000+data.id),note:g('rt-items'),by_name:(SBPROFILE&&SBPROFILE.name)||'',user_id:(SBUSER&&SBUSER.id)||null});}catch(e){}
    }
    renderReturns();
  }catch(e){alert('Could not record: '+(e.message||e));}
}
async function applyCM(id){
  if(ROLE!=='admin')return;
  try{
    const {data:r}=await SB.from('returns').select('*').eq('id',id).maybeSingle();
    if(!r||r.applied)return;
    let o=null;
    const ref=r.order_ref;
    if(/^[0-9a-f-]{30,40}$/i.test(ref)){const q=await SB.from('orders').select('*').eq('id',ref).maybeSingle();o=q.data;}
    if(!o){const q=await SB.from('orders').select('*').eq('ext_ref',ref).maybeSingle();o=q.data;}
    if(!o){const q=await SB.from('orders').select('*').eq('ext_ref','#'+ref).maybeSingle();o=q.data;}
    if(!o&&/^HS-\d+$/i.test(ref)){const num=parseInt(ref.replace(/\D/g,''),10)-1000;const q=await SB.from('orders').select('*').eq('num',num).maybeSingle();o=q.data;}
    if(!o)return alert('Order "'+ref+'" not found in the register.');
    if(!confirm('Apply CM-'+String(1000+id)+' ('+fmtPeso(r.amount)+') against '+ordLabel(o)+'?\nBalance '+fmtPeso(o.balance||0)+' → '+fmtPeso(Math.max(0,(o.balance||0)-r.amount))))return;
    const balance=Math.max(0,(o.balance||0)-r.amount);
    const {error}=await SB.from('orders').update({balance,pay_status:balance<=0?'paid':o.pay_status==='pending'?'partial':o.pay_status}).eq('id',o.id);
    if(error)throw error;
    await SB.from('returns').update({applied:true}).eq('id',id);
    audit('return.apply',{cm:'CM-'+String(1000+id),order:ordLabel(o),amount:r.amount,newBalance:balance});
    NORDERS=null;renderReturns();
  }catch(e){alert('Could not apply: '+(e.message||e));}
}
async function printCM(id){
  const {data:r}=await SB.from('returns').select('*').eq('id',id).maybeSingle();
  if(!r)return;
  let acct=null;try{const q=await SB.from('accounts').select('*').eq('name',acctDedup(r.account)).maybeSingle();acct=q.data;}catch(e){}
  currentView='creditmemo';
  $('ptitle').textContent='Credit memo';
  const net=Math.round((r.amount||0)/1.12);
  $('content').innerHTML=
    '<div class="no-print" style="display:flex;gap:10px;margin-bottom:12px"><a href="#" onclick="showView(\'returns\',null);return false" style="color:var(--ac);font-size:12.5px">← Back</a><span style="flex:1"></span>'+
    '<button onclick="window.print()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">🖨 Print / Save PDF</button></div>'+
    '<div class="printdoc">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div>'+hsLogo(34,'#00168F')+'<div style="font-size:19px;font-weight:800;margin-top:5px">HEALTHSPAN GLOBAL, INC.</div><div style="font-size:12px;color:#555">Credit Memo</div></div>'+
    '<div style="text-align:right;font-size:12px"><b style="font-size:15px">CM-'+String(1000+r.id)+'</b><br>Date: '+esc(String(r.created_at||'').slice(0,10))+'</div></div>'+
    '<div style="margin:14px 0;font-size:12.5px"><b>'+esc(r.account)+'</b>'+(acct&&acct.address?'<br>'+esc(acct.address):'')+'</div>'+
    '<table><thead><tr><th>Reference</th><th>Items</th><th>Disposition</th><th>Reason</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+
    '<tr><td>'+esc(r.order_ref||'—')+'</td><td>'+esc(r.items||'—')+'</td><td>'+(r.action==='restock'?'Returned to stock':'Written off')+'</td><td>'+esc(r.reason||'—')+'</td><td style="text-align:right;font-weight:700">'+fmtPeso(r.amount||0)+'</td></tr>'+
    '</tbody></table>'+
    '<div style="text-align:right;font-size:12px;margin-top:6px;color:#333">VATable: '+fmtPeso(net)+'<br>12% VAT: '+fmtPeso((r.amount||0)-net)+'</div>'+
    '<div style="text-align:right;font-weight:700;font-size:14px;margin-top:2px">CREDIT TOTAL: '+fmtPeso(r.amount||0)+'</div>'+
    '<div style="display:flex;gap:40px;margin-top:36px;font-size:12px">'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Prepared by · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Approved by · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Received / acknowledged by · date</div></div>'+
    '</div>';
}

// ── SHADOW STOCK LEDGER: pick confirmation + barcode scan (receive / pick / count)
async function ledgerAdd(rows){
  const base={by_name:(SBPROFILE&&SBPROFILE.name)||'',user_id:(SBUSER&&SBUSER.id)||null};
  const {error}=await SB.from('stock_moves').insert(rows.map(r=>({...base,...r})));
  if(error)throw error;
}
async function confirmPick(orderRef){
  if(!SBUSER)return;
  let o=null;
  try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('id',orderRef).maybeSingle();o=data;}catch(e){}
  if(!o)return alert('Order not found.');
  if(!confirm('Confirm this order as PICKED?\n\nEvery line is recorded as an outbound movement in the platform ledger'+(flagOn('ledger_is_truth')?'.':' (shadow — Verna’s sheet stays the stock truth until cutover).')))return;
  try{
    const rows=(o.order_lines||[]).map(l=>({sku:l.sku,qty:-Math.abs(l.qty||0),kind:'pick',ref:ordLabel(o),note:l.name||null}));
    if(!rows.length)return;
    await ledgerAdd(rows);
    audit('ledger.pick',{order:ordLabel(o),lines:rows.length});
    // gear 2: the warehouse action drives the order status too
    if(o.status==='pending'&&canManage()&&confirm('Picked ✓ ('+rows.length+' line'+(rows.length>1?'s':'')+' in the ledger).\n\nAlso mark '+ordLabel(o)+' as FULFILLED?')){
      const {error:e2}=await SB.from('orders').update({status:'fulfilled'}).eq('id',o.id);
      if(!e2){audit('order.fulfilled',{order:ordLabel(o),via:'pick-confirm'});NORDERS=null;}
      alert(e2?('Ledger saved, but the status update failed: '+e2.message):'Fulfilled ✓ — ledger and order updated together.');
    }else{
      alert('Picked ✓ — '+rows.length+' line'+(rows.length>1?'s':'')+' recorded in the ledger.');
    }
  }catch(e){alert('Could not record: '+(e.message||e)+(String(e.message||'').includes('stock_moves')?'\n\n(Run the independence SQL from SUPABASE-SETUP.md.)':''));}
}
/* SCAN-TO-PICK: fulfillment queue → pick list → scan every item against the order.
   Wrong item = red stop; over-scan = warning; all lines green = confirm + fulfill. */
async function showScanPick(orderId){
  currentView='scanpick';
  window._scanHandler=pickCode;
  $('ptitle').textContent='Scan to pick';
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading order…</div>';
  await loadItems();
  let o=null;
  try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('id',orderId).maybeSingle();o=data;}catch(e){}
  if(!o){$('content').innerHTML='<div class="empty" style="margin-top:40px">Order not found.</div>';return;}
  window._PICK={id:o.id,label:ordLabel(o),account:o.account,lines:(o.order_lines||[]).map(l=>({sku:l.sku,name:l.name||l.sku,qty:l.qty||0,got:0}))};
  const supported='BarcodeDetector' in window;
  $('content').innerHTML=
    '<div style="max-width:640px">'+
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><a href="#" onclick="window._scanHandler=null;scanStop();showPickSlip(\''+esc(String(o.id))+'\');return false" style="color:var(--ac);font-size:12.5px">← Pick list</a>'+
    '<b style="font-size:14px">'+esc(ordLabel(o))+'</b><span class="mu" style="font-size:12px">'+esc(o.account||'')+'</span></div>'+
    '<div class="panel" style="padding:16px">'+
    '<div id="pk-prog" style="margin-bottom:10px"></div>'+
    (supported?'<button id="scan-btn" onclick="scanStart()" style="width:100%;background:var(--gr);color:#fff;border:none;border-radius:10px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;margin-bottom:8px">📷 Scan next item</button>'+
      '<video id="scan-video" playsinline style="display:none;width:100%;border-radius:12px;margin-bottom:8px"></video>':'')+
    '<input id="pk-code" placeholder="…or type/paste the code and press Enter" onkeydown="if(event.key===\'Enter\'){pickCode(this.value);this.value=\'\';}" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:14px">'+
    '<div id="pk-msg" style="min-height:34px;margin-top:8px"></div>'+
    '<div id="pk-lines"></div>'+
    '<div id="pk-done"></div>'+
    '</div></div>';
  pickRefresh();
}
function pickRefresh(){
  const P=window._PICK;if(!P)return;
  const tot=P.lines.reduce((a,l)=>a+l.qty,0),got=P.lines.reduce((a,l)=>a+Math.min(l.got,l.qty),0);
  const pg=$('pk-prog');
  if(pg)pg.innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><b>'+got+' / '+tot+' units scanned</b><span class="mu">'+P.lines.filter(l=>l.got>=l.qty).length+' / '+P.lines.length+' lines done</span></div>'+
    '<div style="height:8px;background:var(--sf2);border-radius:6px;overflow:hidden"><div style="height:100%;width:'+(tot?Math.round(got/tot*100):0)+'%;background:var(--gr);transition:width .2s"></div></div>';
  const ln=$('pk-lines');
  if(ln)ln.innerHTML=P.lines.map((l,i)=>{
    const done=l.got>=l.qty;
    return '<div class="drow" style="align-items:center;'+(done?'opacity:.55':'')+'">'+
    '<span class="dlbl">'+(done?'✅':'⬜')+' <b>'+esc(l.name)+'</b><br><span style="color:var(--tx3);font-size:11px">'+esc(l.sku)+'</span></span>'+
    '<span class="dval" style="font-weight:700;font-size:14px;color:'+(done?'var(--gr)':'var(--tx)')+'">'+l.got+' / '+l.qty+
    (!done?' <a href="#" onclick="window._PICK.lines['+i+'].got=window._PICK.lines['+i+'].qty;pickRefresh();return false" title="Mark this line complete without scanning each unit" style="color:var(--tx3);font-size:10px">fill</a>':'')+'</span></div>';
  }).join('');
  const dn=$('pk-done');
  if(dn)dn.innerHTML=P.lines.every(l=>l.got>=l.qty)?'<button onclick="pickFinish()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;margin-top:10px">✓ All scanned — confirm pick'+(canManage()?' & fulfill':'')+'</button>':'';
}
function pickCode(code){
  const P=window._PICK;if(!P)return;
  const msg=$('pk-msg');
  const m=scanMatch(code);
  const show=(html,bg,fg)=>{if(msg)msg.innerHTML='<div style="background:'+bg+';color:'+fg+';border-radius:8px;padding:8px 12px;font-size:12.5px;font-weight:600">'+html+'</div>';};
  if(!m){show('“'+esc(String(code))+'” doesn’t match any SKU or barcode. Link it in the Item master, or type the SKU.','var(--rd-bg)','var(--rd)');return;}
  const line=P.lines.find(l=>l.sku===m.sku);
  if(!line){show('🛑 <b>'+esc(m.name)+'</b> is NOT on this order — wrong item, put it back.','var(--rd-bg)','var(--rd)');return;}
  if(line.got>=line.qty){show('⚠ '+esc(m.name)+' is already complete ('+line.qty+'/'+line.qty+') — that’s one too many.','var(--am-bg)','var(--am)');return;}
  line.got++;
  show('✓ '+esc(m.name)+' — '+line.got+' of '+line.qty,'var(--gr-bg)','var(--gr)');
  pickRefresh();
  const c=$('pk-code');if(c)c.focus();
}
async function pickFinish(){
  const P=window._PICK;if(!P)return;
  try{
    const rows=P.lines.map(l=>({sku:l.sku,qty:-Math.abs(l.qty),kind:'pick',ref:P.label,note:l.name}));
    await ledgerAdd(rows);
    audit('ledger.scanpick',{order:P.label,lines:rows.length});
    let ftxt='';
    if(canManage()){
      const {error}=await SB.from('orders').update({status:'fulfilled'}).eq('id',P.id);
      if(!error){audit('order.fulfilled',{order:P.label,via:'scan-pick'});NORDERS=null;ftxt=' and marked fulfilled';}
    }
    window._scanHandler=null;scanStop();
    alert('✓ '+P.label+' picked'+ftxt+' — every unit scanned and in the ledger.');
    const id=P.id;window._PICK=null;
    showOrderPage(id);
  }catch(e){alert('Could not record: '+(e.message||e));}
}

let SCAN_MODE='pick',SCAN_STREAM=null;
async function renderScan(){
  window._scanHandler=null;
  const supported='BarcodeDetector' in window;
  await loadItems();
  $('content').innerHTML=
    '<div style="max-width:640px">'+
    '<div class="panel" style="padding:14px 16px;margin-bottom:12px;border-left:3px solid '+(flagOn('ledger_is_truth')?'var(--gr)':'var(--am)')+';font-size:12px">'+
    (flagOn('ledger_is_truth')?'Ledger is the stock truth — every scan moves real inventory.':'Shadow mode: scans build the platform ledger for comparison; <b>Verna’s sheet remains the stock truth</b> until independence is declared on the Cutover page.')+'</div>'+
    '<div class="panel" style="padding:16px">'+
    '<div style="display:flex;gap:8px;margin-bottom:12px">'+['receive','pick','count'].map(m=>'<button onclick="SCAN_MODE=\''+m+'\';renderScan()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--bd);font-weight:700;font-size:13px;cursor:pointer;background:'+(SCAN_MODE===m?'var(--ac)':'var(--sf)')+';color:'+(SCAN_MODE===m?'#fff':'var(--tx)')+'">'+(m==='receive'?'📦 Receive':m==='pick'?'📤 Pick':'🔢 Count')+'</button>').join('')+'</div>'+
    (supported?'<button id="scan-btn" onclick="scanStart()" style="width:100%;background:var(--gr);color:#fff;border:none;border-radius:10px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;margin-bottom:10px">📷 Start camera scan</button>'+
      '<video id="scan-video" playsinline style="display:none;width:100%;border-radius:12px;margin-bottom:10px"></video>':
      '<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">Camera scanning needs Chrome/Edge (or Android). On this browser, type or paste the code below — same result.</div>')+
    '<label style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Barcode / SKU</label>'+
    '<input id="scan-code" placeholder="Scan, type, or paste a code…" onkeydown="if(event.key===\'Enter\')scanResolve(this.value)" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:12px;font-size:15px">'+
    '<div id="scan-hit" style="margin-top:12px"></div>'+
    '</div>'+
    '<div class="panel" style="padding:14px 16px;margin-top:12px" id="scan-log"><div class="phd">Recent movements</div><div class="mu" style="font-size:12px">Loading…</div></div></div>';
  scanLog();
}
async function scanLog(){
  const box=$('scan-log');if(!box)return;
  let rows=[];
  try{const {data}=await SB.from('stock_moves').select('at,sku,qty,kind,ref,by_name').order('id',{ascending:false}).limit(15);rows=data||[];}catch(e){}
  box.innerHTML='<div class="phd">Recent movements ('+(flagOn('ledger_is_truth')?'live ledger':'shadow ledger')+')</div>'+
    (rows.length?rows.map(r=>'<div class="drow"><span class="dlbl" style="font-size:12px"><b>'+esc(r.sku)+'</b> · '+esc(r.kind)+(r.ref?' · '+esc(r.ref):'')+'<br><span style="color:var(--tx3);font-size:11px">'+esc(String(r.at||'').slice(0,16).replace('T',' '))+' · '+esc(r.by_name||'')+'</span></span><span class="dval" style="font-weight:700;color:'+(r.qty>0?'var(--gr)':r.qty<0?'var(--rd)':'var(--tx3)')+'">'+(r.qty>0?'+':'')+r.qty+'</span></div>').join(''):'<div class="mu" style="font-size:12px">Nothing recorded yet.</div>');
}
async function scanStart(){
  const v=$('scan-video'),btn=$('scan-btn');
  if(!v)return;
  try{
    SCAN_STREAM=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    v.srcObject=SCAN_STREAM;v.style.display='block';await v.play();
    if(btn){btn.textContent='Scanning… point at a barcode';btn.disabled=true;}
    const det=new window.BarcodeDetector();
    const tick=async()=>{
      if(!SCAN_STREAM||(currentView!=='scan'&&currentView!=='scanpick'))return scanStop();
      try{const codes=await det.detect(v);if(codes&&codes.length){scanStop();(window._scanHandler||scanResolve)(codes[0].rawValue);return;}}catch(e){}
      requestAnimationFrame(tick);
    };
    tick();
  }catch(e){alert('Camera unavailable: '+(e.message||e)+' — type the code instead.');}
}
function scanStop(){
  try{if(SCAN_STREAM){SCAN_STREAM.getTracks().forEach(t=>t.stop());SCAN_STREAM=null;}}catch(e){}
  const v=$('scan-video');if(v)v.style.display='none';
  const btn=$('scan-btn');if(btn){btn.textContent='📷 Start camera scan';btn.disabled=false;}
}
function scanMatch(code){ // item barcode → item sku → DATA sku (case-insensitive)
  code=String(code||'').trim();if(!code)return null;
  const items=Object.values(ITEMS||{});
  const byBc=items.find(i=>i.barcode&&i.barcode.toLowerCase()===code.toLowerCase());
  if(byBc)return{sku:byBc.sku,name:byBc.name};
  const bySku=items.find(i=>String(i.sku).toLowerCase()===code.toLowerCase())||DATA.find(p=>String(p.sku).toLowerCase()===code.toLowerCase());
  if(bySku)return{sku:bySku.sku,name:bySku.name};
  return null;
}
function scanResolve(code){
  code=String(code||'').trim();if(!code)return;
  const hit=$('scan-hit');if(!hit)return;
  const m=scanMatch(code);
  let sku=m&&m.sku,name=m&&m.name;
  if(!sku){
    hit.innerHTML='<div style="background:var(--rd-bg);color:var(--rd);border-radius:10px;padding:10px 14px;font-size:12.5px">Code “'+esc(code)+'” doesn’t match any SKU or barcode. Link it to a product in the Item master (Barcode column), then scan again.</div>';
    return;
  }
  const p=DATA.find(x=>x.sku===sku);
  hit.innerHTML='<div style="background:var(--gr-bg);border-radius:10px;padding:12px 14px">'+
    '<b style="font-size:14px">'+esc(name||sku)+'</b> <span class="mu" style="font-size:11px">'+esc(sku)+(p?' · sheet stock: '+(stk(p)??'—'):'')+'</span>'+
    '<div style="display:flex;gap:8px;margin-top:8px;align-items:center">'+
    '<input id="scan-qty" type="number" min="1" value="1" style="width:90px;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px;font-size:14px;text-align:center">'+
    (SCAN_MODE==='pick'?'<input id="scan-ref" placeholder="Order ref (opt.)" style="flex:1;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px;font-size:12.5px">':'')+
    '<button onclick="scanRecord(\''+esc(sku)+'\')" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer">'+(SCAN_MODE==='receive'?'+ Receive':SCAN_MODE==='pick'?'− Pick':'Set count')+'</button></div></div>';
  const q=$('scan-qty');if(q){q.focus();q.select();}
}
async function scanRecord(sku){
  const qty=parseInt(($('scan-qty')||{}).value||'0',10);
  if(!qty||qty<1)return;
  try{
    let msg='✓ '+esc(sku)+' '+(SCAN_MODE==='pick'?'−':'+')+qty+' recorded — scan the next one.';
    let row;
    if(SCAN_MODE==='count'){
      // gear 3: a count is compared against expected stock; the variance is the story
      const p=DATA.find(x=>x.sku===sku);
      const expect=p?stk(p):null;
      const diff=expect!=null?qty-expect:null;
      row={sku,qty:qty,kind:'count',note:expect!=null?('counted '+qty+' vs sheet '+expect+' (Δ '+(diff>=0?'+':'')+diff+')'):'physical count (no sheet figure)'};
      msg=diff===0?'✓ '+esc(sku)+' counted '+qty+' — matches the sheet exactly. That’s cutover evidence.':
        diff!=null?'⚠ '+esc(sku)+' counted '+qty+' vs sheet '+expect+' — variance <b>'+(diff>0?'+':'')+diff+'</b> logged. Recount or investigate.':
        '✓ '+esc(sku)+' counted '+qty+' (no sheet figure to compare).';
    }else{
      row=SCAN_MODE==='receive'?{sku,qty:qty,kind:'receive'}:
        {sku,qty:-qty,kind:'pick',ref:(($('scan-ref')||{}).value||'').trim()||null};
    }
    await ledgerAdd([row]);
    audit('ledger.'+SCAN_MODE,{sku,qty});
    const hit=$('scan-hit');if(hit)hit.innerHTML='<div style="background:'+(msg.startsWith('⚠')?'var(--am-bg)':'var(--gr-bg)')+';color:'+(msg.startsWith('⚠')?'var(--am)':'var(--gr)')+';border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600">'+msg+'</div>';
    const c=$('scan-code');if(c){c.value='';c.focus();}
    scanLog();
  }catch(e){alert('Could not record: '+(e.message||e)+(String(e.message||'').includes('stock_moves')?'\n\n(Run the independence SQL from SUPABASE-SETUP.md.)':''));}
}


// Duplicate-entry guard: typed a name that isn't an existing account but looks like one?
function acctSuggest(v){
  try{
    if(!v)return null;
    if(!ACCTBYNORM)buildAcctIdx();
    const k=custNorm(acctDedup(v));
    if(!k||ACCTBYNORM[k])return null; // exact existing account — fine
    const a=[...new Set(k.split(' ').filter(t=>t.length>=4))];
    let best=null,bs=0;
    for(const key in ACCTBYNORM){
      const e=ACCTBYNORM[key];if(e.parentKey)continue;
      const ek=custNorm(e.name);
      if(ek.length>=6&&k.length>=6&&(ek.includes(k)||k.includes(ek)))return e.name;
      if(!a.length)continue;
      const b=ek.split(' ').filter(t=>t.length>=4);
      const hit=b.filter(t=>a.includes(t)).length;
      if(!hit)continue;
      const score=hit/Math.max(a.length,b.length);
      if(score>bs){bs=score;best=e.name;}
    }
    return bs>=0.5?best:null;
  }catch(e){return null;}
}
function dupeHint(inId,outId,rerun){
  const el=$(outId);if(!el)return;
  const v=($(inId)&&$(inId).value||'').trim();
  const m=v?acctSuggest(v):null;
  el.innerHTML=m?'<div style="background:var(--am-bg);color:var(--am);border-radius:8px;padding:8px 12px;font-size:12px;margin-top:6px">⚠ Not an existing account — did you mean '+
    '<a href="#" onclick="$(\''+inId+'\').value=\''+esc(m).replace(/'/g,'&#39;')+'\';'+(rerun||'')+'dupeHint(\''+inId+'\',\''+outId+'\');return false" style="color:var(--am);font-weight:700">'+esc(m)+'</a>? Tap to use it, or continue if this really is a new account.</div>':'';
}

// Upsell recommendations: co-occurrence mined from our own 13-month order history
function upsellIdx(){
  if(window._UPS)return window._UPS;
  const recent=(SHOPIFY&&SHOPIFY.recent)||[];
  if(!recent.length)return null;
  const m={};DATA.forEach(p=>m[p.sku]=p.name);
  const bs=Object.keys(m).sort((a,b)=>b.length-a.length);
  const baseOf=t=>{t=String(t||'').trim();if(!t)return null;if(m[t])return t;
    return bs.find(x=>t.startsWith(x)&&t.length>x.length)||bs.find(x=>x.length>=4&&t.length>x.length&&t.includes(x))||null;};
  const byCust={};
  for(const o of recent){
    const c=custNorm(acctDedup(o.c||''));
    if(!c||/pull\s*-?\s*out/i.test(o.c||''))continue;
    const s=byCust[c]||(byCust[c]=new Set());
    for(const l of (o.ls||[])){const b=baseOf(l[0]);if(b)s.add(b);}
  }
  const cnt={},pair={};
  for(const c in byCust){
    const arr=[...byCust[c]];
    for(const x of arr){cnt[x]=(cnt[x]||0)+1;
      const px=pair[x]||(pair[x]={});
      for(const y of arr)if(y!==x)px[y]=(px[y]||0)+1;}
  }
  return window._UPS={byCust,cnt,pair,nameOf:m};
}
function upsellFor(acctName,n){
  const U=upsellIdx();if(!U)return[];
  const have=U.byCust[custNorm(acctDedup(acctName))];
  if(!have||!have.size)return[];
  const best={};
  for(const a of have){
    if((U.cnt[a]||0)<5)continue; // need real support
    const pa=U.pair[a]||{};
    for(const b in pa){
      if(have.has(b)||pa[b]<4)continue;
      const conf=pa[b]/U.cnt[a];
      if(conf<0.25)continue;
      if(!best[b]||conf>best[b].conf)best[b]={conf,anchor:a,n:pa[b]};
    }
  }
  return Object.keys(best).map(b=>({sku:b,name:U.nameOf[b]||b,conf:best[b].conf,anchor:U.nameOf[best[b].anchor]||best[b].anchor}))
    .sort((a,b)=>b.conf-a.conf).slice(0,n||5);
}
function upsellPanelHTML(name){
  const recs=upsellFor(name,5);
  if(!recs.length)return'';
  return '<div class="panel" style="padding:16px;margin-top:14px"><div class="phd">Worth offering next</div>'+
    recs.map(r=>'<div class="drow"><span class="dlbl">'+esc(r.name)+'<br><span style="color:var(--tx3);font-size:11px">'+Math.round(r.conf*100)+'% of clinics buying '+esc(r.anchor)+' also buy this</span></span><span class="dval mu">'+r.n+' clinics</span></div>').join('')+
    '<div style="font-size:10px;color:var(--tx3);margin-top:8px">Mined from our own order history — products this account doesn’t buy yet, bought by similar clinics</div></div>';
}

// Customer health score: one number per account, with reasons
function arOverdueSet(){
  if(window._ARSET&&Date.now()-(window._ARSETts||0)<120000)return window._ARSET;
  const s=new Set();
  try{for(const r of arRows())if((r.d30+r.d60+r.d90)>0)s.add(custNorm(r.name));}catch(e){}
  window._ARSET=s;window._ARSETts=Date.now();
  return s;
}
function healthOf(r,arSet){
  let s=100;const why=[];
  const days=r.last?Math.floor((Date.now()-new Date(r.last).getTime())/864e5):9999;
  if(days>9000){s-=45;why.push('no recorded activity');}
  else if(days>180){s-=45;why.push('quiet '+days+' days');}
  else if(days>90){s-=25;why.push('quiet '+days+' days');}
  else if(days>45){s-=10;why.push(days+' days since activity');}
  if(!r.v90){s-=20;why.push('no bookings in 90d');}
  if(arSet&&arSet.has(custNorm(r.name))){s-=20;why.push('overdue balance');}
  if(r.e&&!r.e.visitN){s-=10;why.push('never visited');}
  s=Math.max(0,s);
  return {s,why:why.join(' · ')||'active & current',c:s>=75?'var(--gr)':s>=45?'var(--am)':'var(--rd)'};
}

// Leaderboard & pace: MTD race + projected month-end attainment per specialist
function renderSalesPace(){
  const recent=(SHOPIFY&&SHOPIFY.recent)||[];
  if(!recent.length){$('content').innerHTML='<div class="empty" style="margin-top:40px">Waiting for the sales cache…</div>';try{loadShopify().then(()=>{if(currentView==='salespace')renderSalesPace();});}catch(e){}return;}
  if(!VISITS){loadVisits().then(()=>{if(currentView==='salespace')renderSalesPace();});}
  const now=new Date();
  const ym=now.toISOString().slice(0,7);
  const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const elapsed=Math.min(1,Math.max(0.03,now.getDate()/dim));
  const S={},disp={};
  for(const o of recent){
    const raw=specCanon(o.t||'');
    if(!raw||INTERNAL_TAG.test(raw)||/pull\s*-?\s*out/i.test(o.c||''))continue;
    if((o.dt||'').slice(0,7)!==ym)continue;
    const t=raw.toLowerCase();if(!disp[t])disp[t]=raw;
    S[t]=(S[t]||0)+(o.ls||[]).reduce((a,l)=>a+(l[2]||0),0);
  }
  for(const x of (TARGETS||[])){ // specialists with a target but no sales yet still race
    if(x.month!==ym||x.scope!=='SPECIALIST')continue;
    const t=specCanon(x.name||'').toLowerCase();
    if(t&&!(t in S)){S[t]=0;if(!disp[t])disp[t]=specCanon(x.name);}
  }
  const V={};
  for(const v of (VISITS||[])){
    if(v.status==='planned'||(v.date||'').slice(0,7)!==ym)continue;
    const t=specCanon(v.spec||'').toLowerCase();if(t)V[t]=(V[t]||0)+1;
  }
  const tgtOf=t=>{const x=(TARGETS||[]).find(x=>x.month===ym&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===t);return x?x.value:null;};
  const rows=Object.keys(S).map(t=>{
    const mtd=S[t],T=tgtOf(t),proj=Math.round(mtd/elapsed);
    return {t,name:disp[t],mtd,T,proj,att:T?proj/T*100:null,cur:T?mtd/T*100:null,visits:V[t]||0};
  }).sort((a,b)=>b.mtd-a.mtd);
  const medal=i=>i===0?'🥇':i===1?'🥈':i===2?'🥉':'<span class="mu">'+(i+1)+'</span>';
  const paceP=a=>a==null?'<span class="mu">no target</span>':'<span style="font-weight:700;color:'+(a>=100?'var(--gr)':a>=80?'var(--am)':'var(--rd)')+'">'+a.toFixed(0)+'%</span>';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Month</div><div class="met-val">'+ym+'</div><div class="met-sub">'+Math.round(elapsed*100)+'% elapsed</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Team MTD</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.mtd,0))+'</div><div class="met-sub">booked so far</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Projected month-end</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.proj,0))+'</div><div class="met-sub">at the current pace</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">On pace for target</div><div class="met-val">'+rows.filter(r=>r.att!=null&&r.att>=100).length+' / '+rows.filter(r=>r.att!=null).length+'</div><div class="met-sub">specialists with targets</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th></th><th>Specialist</th><th style="text-align:right">MTD booked</th><th style="text-align:right">Target</th><th style="text-align:right">Now at</th><th style="text-align:right">Projected finish</th><th style="text-align:right">Pace</th><th style="text-align:right">Visits MTD</th></tr></thead><tbody>'+
    rows.map((r,i)=>'<tr onclick="showSpecPage(\''+esc(r.name).replace(/'/g,'&#39;')+'\')" style="cursor:pointer'+(i<3?';font-weight:600':'')+'">'+
      '<td style="font-size:15px">'+medal(i)+'</td><td>'+esc(r.name)+'</td>'+
      '<td class="r" style="font-weight:700">'+fmtPeso(r.mtd)+'</td>'+
      '<td class="r mu">'+(r.T!=null?fmtPeso(r.T):'—')+'</td>'+
      '<td class="r">'+(r.cur!=null?r.cur.toFixed(0)+'%':'—')+'</td>'+
      '<td class="r">'+fmtPeso(r.proj)+'</td>'+
      '<td class="r">'+paceP(r.att)+'</td>'+
      '<td class="r mu">'+r.visits+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Pace = MTD ÷ share of the month elapsed, vs target — green ≥100%, amber ≥80% · coach while the month can still be saved · tap a row for the specialist’s page · targets from Set targets (overrides) or the sheet</span></div></div>';
}

// Multiple contacts per account (doctor, purchaser, nurse…)
async function fillContacts(key,name){
  const box=$('ac-contacts');if(!box)return;
  let list=[];
  try{const {data}=await SB.from('account_contacts').select('*').eq('acct_key',key).order('id');list=data||[];}
  catch(e){box.innerHTML='';return;}
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12px"';
  box.innerHTML='<div class="phd">Contacts</div>'+
    (list.length?list.map(c=>'<div class="drow" style="align-items:flex-start"><span class="dlbl"><b>'+esc(c.name)+'</b>'+(c.role?' · '+esc(c.role):'')+'<br><span style="color:var(--tx3);font-size:11.5px">'+esc(c.phone||'')+(c.email?' · '+esc(c.email):'')+'</span></span>'+
      '<span class="dval"><a href="#" onclick="acDelContact('+c.id+',\''+esc(key)+'\',\''+esc(name).replace(/'/g,'&#39;')+'\');return false" style="color:var(--rd);font-size:11px">remove</a></span></div>').join(''):'<div style="font-size:12px;color:var(--tx3);margin-bottom:6px">No contacts yet — add the doctor, purchaser, or clinic staff.</div>')+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'+
    '<input id="ac-cn" placeholder="Name" '+inp+' style="flex:1;min-width:110px;'+inp.slice(7,-1)+'">'+
    '<input id="ac-cr" placeholder="Role (doctor…)" '+inp+' style="width:110px;'+inp.slice(7,-1)+'">'+
    '<input id="ac-cp" placeholder="Phone" '+inp+' style="width:110px;'+inp.slice(7,-1)+'">'+
    '<button onclick="acAddContact(\''+esc(key)+'\',\''+esc(name).replace(/'/g,'&#39;')+'\')" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">Add</button></div>';
}
async function acAddContact(key,name){
  const g=id=>($(id)&&$(id).value||'').trim();
  if(!g('ac-cn'))return;
  try{
    const {error}=await SB.from('account_contacts').insert({acct_key:key,account:name,name:g('ac-cn'),role:g('ac-cr')||null,phone:g('ac-cp')||null,created_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('contact.add',{account:name,contact:g('ac-cn')});
    fillContacts(key,name);
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('account_contacts')?'\n\n(Run the account_contacts SQL from SUPABASE-SETUP.md.)':''));}
}
async function acDelContact(id,key,name){
  if(!confirm('Remove this contact?'))return;
  try{const {error}=await SB.from('account_contacts').delete().eq('id',id);if(error)throw error;fillContacts(key,name);}catch(e){alert(e.message||e);}
}

// PDC register: every post-dated cheque, tracked to maturity
const PDC_ST={on_hand:'on hand',deposited:'deposited',cleared:'cleared',bounced:'bounced'};
async function renderPDC(){
  if(!canManage()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins and sales managers only.</div>';return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  let rows=[];
  try{const {data}=await SB.from('pdcs').select('*').order('maturity');rows=data||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load — has the pdcs table been created? (SUPABASE-SETUP.md)</div>';return;}
  const today=new Date().toISOString().slice(0,10);
  const wk=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  const d30=new Date(Date.now()+30*864e5).toISOString().slice(0,10);
  const open=rows.filter(r=>r.status==='on_hand'||r.status==='deposited');
  const sum=a=>a.reduce((x,r)=>x+(r.amount||0),0);
  const pill=s=>s==='cleared'?'<span class="pill pgr">cleared</span>':s==='bounced'?'<span class="pill prd">bounced</span>':s==='deposited'?'<span class="pill pbl">deposited</span>':'<span class="pill" style="background:var(--am-bg);color:var(--am)">on hand</span>';
  const acctOpts=acctList().map(r=>'<option value="'+esc(r.name)+'">').join('');
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px"';
  const act=r=>{
    const L=[];
    if(r.status==='on_hand')L.push(['deposited','deposit']);
    if(r.status==='deposited'){L.push(['cleared','cleared ✓']);L.push(['bounced','bounced ✗']);}
    if(r.status==='bounced')L.push(['deposited','redeposit']);
    return L.map(([s,l])=>'<a href="#" onclick="pdcSet('+r.id+',\''+s+'\');return false" style="color:'+(s==='bounced'?'var(--rd)':'var(--ac)')+';font-size:11px">'+l+'</a>').join(' · ')+
      ' · <a href="#" onclick="pdcDel('+r.id+');return false" style="color:var(--tx3);font-size:11px">del</a>';
  };
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Cheques open</div><div class="met-val">'+open.length+'</div><div class="met-sub">'+fmtPeso(sum(open))+' on hand / in bank</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Maturing this week</div><div class="met-val" style="font-size:15px">'+fmtPeso(sum(open.filter(r=>r.maturity<=wk)))+'</div><div class="met-sub">deposit these now</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Next 30 days</div><div class="met-val" style="font-size:15px">'+fmtPeso(sum(open.filter(r=>r.maturity<=d30)))+'</div><div class="met-sub">expected collections</div><div class="met-bar"></div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="met-lbl">Bounced (open)</div><div class="met-val" style="font-size:15px;color:var(--rd)">'+fmtPeso(sum(rows.filter(r=>r.status==='bounced')))+'</div><div class="met-sub">chase or replace</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="padding:12px 16px;margin-bottom:14px"><div class="phd">Record a cheque</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
    '<input id="pd-acct" list="pd-accts" placeholder="Account" '+inp+' style="flex:1;min-width:150px;'+inp.slice(7,-1)+'"><datalist id="pd-accts">'+acctOpts+'</datalist>'+
    '<input id="pd-bank" placeholder="Bank" '+inp+' style="width:110px;'+inp.slice(7,-1)+'">'+
    '<input id="pd-no" placeholder="Cheque no." '+inp+' style="width:110px;'+inp.slice(7,-1)+'">'+
    '<input id="pd-amt" type="number" placeholder="Amount ₱" '+inp+' style="width:120px;'+inp.slice(7,-1)+'">'+
    '<input id="pd-mat" type="date" title="Maturity date" '+inp+'>'+
    '<input id="pd-ref" placeholder="Order ref (opt.)" '+inp+' style="width:120px;'+inp.slice(7,-1)+'">'+
    '<button onclick="pdcAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer">Add</button></div></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Maturity</th><th>Account</th><th>Bank · cheque no.</th><th style="text-align:right">Amount</th><th>Status</th><th>Order</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>'<tr'+(r.status!=='cleared'&&r.maturity<=today?' style="background:var(--am-bg)"':'')+'><td style="font-weight:600">'+esc(r.maturity)+(r.status!=='cleared'&&r.status!=='bounced'&&r.maturity<=today?' <span class="pill prd" style="font-size:9px">due</span>':'')+'</td>'+
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis"><a href="#" onclick="showAccountPage(\''+esc(r.account).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(r.account)+'</a></td>'+
      '<td class="mu" style="font-size:11.5px">'+esc(r.bank||'—')+' · '+esc(r.cheque_no||'—')+'</td>'+
      '<td class="r" style="font-weight:700">'+fmtPeso(r.amount||0)+'</td>'+
      '<td>'+pill(r.status)+'</td>'+
      '<td class="mu" style="font-size:11px">'+(r.order_ref?'<a href="#" onclick="showOrderPage(\''+esc(r.order_ref).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(r.order_ref)+'</a>':'—')+'</td>'+
      '<td style="white-space:nowrap">'+act(r)+'</td></tr>').join(''):'<tr><td colspan="7"><div class="empty">No cheques recorded yet — PDCs from order notes ("50% PDC 30 days") belong here.</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Highlighted rows are at/past maturity and not yet cleared · deposit → cleared marks the cash real (record the payment on the order too) · bounced cheques stay visible until replaced</span></div></div>';
}
async function pdcAdd(){
  if(!canManage()||!SB)return;
  const g=id=>($(id)&&$(id).value||'').trim();
  if(!g('pd-acct')||!g('pd-amt')||!g('pd-mat'))return alert('Need at least the account, amount, and maturity date.');
  try{
    const {error}=await SB.from('pdcs').insert({account:g('pd-acct'),bank:g('pd-bank')||null,cheque_no:g('pd-no')||null,amount:Math.round(parseFloat(g('pd-amt'))),maturity:g('pd-mat'),order_ref:g('pd-ref')||null,status:'on_hand',created_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('pdc.add',{account:g('pd-acct'),amount:g('pd-amt'),maturity:g('pd-mat')});
    renderPDC();
  }catch(e){alert('Could not save: '+(e.message||e)+(String(e.message||'').includes('pdcs')?'\n\n(Run the pdcs SQL from SUPABASE-SETUP.md.)':''));}
}
async function pdcSet(id,status){
  if(!canManage()||!SB)return;
  if(status==='bounced'&&!confirm('Mark this cheque bounced?'))return;
  try{
    const {error}=await SB.from('pdcs').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    audit('pdc.'+status,{id});
    renderPDC();
  }catch(e){alert(e.message||e);}
}
async function pdcDel(id){
  if(!canManage()||!SB||!confirm('Delete this cheque record?'))return;
  try{const {error}=await SB.from('pdcs').delete().eq('id',id);if(error)throw error;audit('pdc.delete',{id});renderPDC();}catch(e){alert(e.message||e);}
}
