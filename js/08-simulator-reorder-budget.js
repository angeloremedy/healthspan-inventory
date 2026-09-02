/* ── SIMULATOR: REORDER BUDGET OPTIMIZER ── */
function renderBudgetSim(){
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end">'+
    '<div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--tx3);font-weight:500">Purchasing budget</label><div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--tx3)">₱</span><input type="number" id="bg-budget" value="'+SIMBUDGET.budget+'" min="0" step="50000" oninput="updateBudgetSim()" style="width:140px;padding:5px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--sf);color:var(--tx1);font-size:12px"></div></div>'+
    '<div style="font-size:10.5px;color:var(--tx3);max-width:380px">Funds reorders in priority order: items running out before the next shipment lands, A-items first. Lead time & coverage come from your Reorder plan settings.</div>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="bg-metrics"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>ABC</th><th>Stock out in</th><th style="text-align:right">Order qty</th><th style="text-align:right">Cost</th><th style="text-align:right">Cumulative</th><th>Funded</th></tr></thead><tbody id="bg-tbody"></tbody></table></div><div class="tfooter"><span>Greedy allocation under the budget &middot; green rows are funded within the cap, dimmed rows would need more budget</span></div></div>';
  updateBudgetSim();
}
function updateBudgetSim(){
  const el=$('bg-budget'); if(!el)return;
  SIMBUDGET.budget=Math.max(0,parseInt(el.value)||0);
  const rows=reorderRows(PLAN.lead,PLAN.cover,PLAN.safety,1);
  const rank=p=>p.abc==='A'?0:p.abc==='B'?1:2;
  rows.sort((a,b)=>((b.runsOutInLead?1:0)-(a.runsOutInLead?1:0))||(rank(a.p)-rank(b.p))||((a.p.daysToStockout??9999)-(b.p.daysToStockout??9999)));
  let spent=0, funded=0, aFunded=0;
  const aTot=rows.filter(r=>r.p.abc==='A').length;
  const out=rows.map(r=>{
    const fit=spent+r.cost<=SIMBUDGET.budget;
    if(fit){spent+=r.cost;funded++;if(r.p.abc==='A')aFunded++;}
    return {r,funded:fit,cum:spent};
  });
  $('bg-metrics').innerHTML=
    '<div class="met gr"><div class="met-lbl">Budget</div><div class="met-val" style="font-size:17px">'+fmtK(SIMBUDGET.budget)+'</div><div class="met-sub">'+fmtK(Math.max(0,SIMBUDGET.budget-spent))+' unspent</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">SKUs funded</div><div class="met-val">'+funded+'</div><div class="met-sub">of '+rows.length+' needing reorder</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Left exposed</div><div class="met-val">'+(rows.length-funded)+'</div><div class="met-sub">unfunded at this budget</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">A-items covered</div><div class="met-val">'+aFunded+'/'+aTot+'</div><div class="met-sub">high-value SKUs funded</div><div class="met-bar"></div></div>';
  $('bg-tbody').innerHTML=out.length?out.slice(0,250).map(o=>{
    const p=o.r.p, abcC=p.abc==='A'?'prd':p.abc==='B'?'pam':'pgy';
    return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer'+(o.funded?'':';opacity:.5')+'"><td class="mo">'+esc(p.sku)+'</td>'+
    '<td style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
    '<td><span class="pill '+abcC+'">'+(p.abc||'—')+'</span></td><td>'+soPill(p.daysToStockout)+'</td>'+
    '<td class="r" style="font-weight:600">'+o.r.qty.toLocaleString()+'</td><td class="r">'+fmtP(o.r.cost)+'</td>'+
    '<td class="r mu">'+(o.funded?fmtK(o.cum):'—')+'</td>'+
    '<td>'+(o.funded?'<span class="pill pgr">Funded</span>':'<span class="pill pgy">Skipped</span>')+'</td></tr>';
  }).join(''):'<tr><td colspan="8"><div class="empty">Nothing needs reordering under current settings</div></td></tr>';
}

/* ── SIMULATOR: SERVICE-LEVEL TRADE-OFF ── */
function safetyAt(p,service){
  const dbar=(p.velAdj!=null?p.velAdj:(p.velocity||0));
  if(dbar<=0)return 0;
  const leadMo=leadFor(p.line)/30.44;
  const sdLead=(p.demandStd!=null?p.demandStd:0)*Math.sqrt(Math.max(0,leadMo));
  return Math.ceil(zFor(service)*sdLead);
}
function svcCash(service){
  let units=0,cash=0,aCash=0;
  for(const p of DATA){const s=safetyAt(p,service);if(s<=0)continue;units+=s;const c=s*(p.price||0);cash+=c;if(p.abc==='A')aCash+=c;}
  return {units,cash,aCash};
}
function renderServiceSim(){
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-direction:column;gap:16px">'+
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:5px"><span>Service level target</span><span id="sv-lbl" style="font-weight:700;color:var(--ac)">95% &middot; z=1.65</span></div>'+
    '<input type="range" id="sv-level" min="80" max="99.5" step="0.5" value="'+SIMSVC.level+'" style="width:100%" oninput="updateServiceSim()"></div>'+
    '<div style="display:flex;gap:10px;align-items:center"><button class="btn" onclick="applyServiceLevel()">Apply to Reorder point view</button><span id="sv-applied" style="font-size:10.5px;color:var(--tx3)"></span></div>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="sv-metrics"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Service level</th><th style="text-align:right">z-score</th><th style="text-align:right">Safety stock units</th><th style="text-align:right">Cash tied up</th><th style="text-align:right">vs 95%</th></tr></thead><tbody id="sv-tbody"></tbody></table></div><div class="tfooter"><span>Higher service level = fewer stockouts but more cash parked in safety stock &middot; cash = safety units &times; unit price across all SKUs</span></div></div>';
  updateServiceSim();
}
function updateServiceSim(){
  const el=$('sv-level'); if(!el)return;
  SIMSVC.level=parseFloat(el.value)||95;
  const z=zFor(SIMSVC.level);
  $('sv-lbl').textContent=SIMSVC.level+'% · z='+z.toFixed(2);
  const cur=svcCash(SIMSVC.level), base=svcCash(95), d=cur.cash-base.cash;
  $('sv-metrics').innerHTML=
    '<div class="met pu"><div class="met-lbl">Safety-stock cash</div><div class="met-val" style="font-size:17px">'+fmtK(cur.cash)+'</div><div class="met-sub">at '+SIMSVC.level+'% service</div><div class="met-bar"></div></div>'+
    '<div class="met '+(d>0?'rd':'gr')+'"><div class="met-lbl">vs 95% baseline</div><div class="met-val" style="font-size:17px">'+(d===0?'—':(d>0?'+':'−')+fmtK(Math.abs(d)))+'</div><div class="met-sub">'+(d>0?'more':'less')+' cash parked</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Safety units</div><div class="met-val">'+cur.units.toLocaleString()+'</div><div class="met-sub">buffer units held</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">On A-items</div><div class="met-val" style="font-size:17px">'+fmtK(cur.aCash)+'</div><div class="met-sub">cash in A-item buffers</div><div class="met-bar"></div></div>';
  const levels=[80,90,95,97.5,99];
  $('sv-tbody').innerHTML=levels.map(l=>{
    const c=svcCash(l), dd=c.cash-base.cash;
    return '<tr'+(Math.abs(l-SIMSVC.level)<0.01?' style="background:var(--sf2)"':'')+'><td style="font-weight:600">'+l+'%</td><td class="r mu">'+zFor(l).toFixed(2)+'</td><td class="r">'+c.units.toLocaleString()+'</td><td class="r" style="font-weight:600">'+fmtK(c.cash)+'</td><td class="r" style="color:'+(dd>0?'var(--rd)':dd<0?'var(--gr)':'var(--tx3)')+'">'+(dd===0?'—':(dd>0?'+':'−')+fmtK(Math.abs(dd)))+'</td></tr>';
  }).join('');
}
function applyServiceLevel(){
  PLAN.service=SIMSVC.level;
  try{localStorage.setItem('hs_plan',JSON.stringify(PLAN));}catch(e){}
  if($('sv-applied'))$('sv-applied').textContent='Applied — Reorder point now uses '+SIMSVC.level+'%';
  refreshSidebar();
}

/* ── SIMULATOR: CAMPAIGN SURGE ── */
function renderSurgeSim(){
  const lines=[...new Set(DATA.map(p=>p.line).filter(Boolean))].sort();
  const opts='<option value="">All lines</option>'+lines.map(l=>'<option value="'+esc(l)+'"'+(SIMSURGE.group===l?' selected':'')+'>'+esc(l)+'</option>').join('');
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-direction:column;gap:16px">'+
    '<div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--tx3);font-weight:500">Campaign scope (product line)</label><select id="sg-group" onchange="updateSurgeSim()" style="max-width:280px;padding:6px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--sf);color:var(--tx1);font-size:12px">'+opts+'</select></div>'+
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:5px"><span>Demand lift during campaign</span><span id="sg-lift-lbl" style="font-weight:700;color:var(--ac)">+100%</span></div>'+
    '<input type="range" id="sg-lift" min="0" max="300" step="10" value="'+SIMSURGE.lift+'" style="width:100%" oninput="updateSurgeSim()"></div>'+
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:5px"><span>Campaign length</span><span id="sg-weeks-lbl" style="font-weight:700;color:var(--ac)">6 weeks</span></div>'+
    '<input type="range" id="sg-weeks" min="1" max="12" step="1" value="'+SIMSURGE.weeks+'" style="width:100%" oninput="updateSurgeSim()"></div>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="sg-metrics"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Stock</th><th style="text-align:right">Normal /mo</th><th style="text-align:right">Campaign need</th><th>Stock out in</th><th style="text-align:right">Pre-buy</th><th style="text-align:right">Cost</th></tr></thead><tbody id="sg-tbody"></tbody></table></div><div class="tfooter"><span>Campaign need = forecast demand over the window &times; (1 + lift) &middot; pre-buy covers the shortfall so the line doesn’t run dry mid-campaign</span></div></div>';
  updateSurgeSim();
}
function updateSurgeSim(){
  const gEl=$('sg-group'); if(!gEl)return;
  SIMSURGE.group=gEl.value;
  SIMSURGE.lift=parseInt($('sg-lift').value)||0;
  SIMSURGE.weeks=parseInt($('sg-weeks').value)||1;
  $('sg-lift-lbl').textContent='+'+SIMSURGE.lift+'%';
  $('sg-weeks-lbl').textContent=SIMSURGE.weeks+' week'+(SIMSURGE.weeks>1?'s':'');
  const mult=1+SIMSURGE.lift/100, days=SIMSURGE.weeks*7;
  const group=DATA.filter(p=>(!SIMSURGE.group||p.line===SIMSURGE.group)&&stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0));
  const rows=group.map(p=>{
    const demand=unitsOverDays(p,days,mult), s=Math.max(0,stk(p));
    return {p,demand:Math.round(demand),prebuy:Math.max(0,Math.ceil(demand-s)),dts:simDaysToStockout(p,mult)};
  }).map(r=>Object.assign(r,{cost:r.prebuy*(r.p.price||0)}));
  const stockouts=rows.filter(r=>r.dts!=null&&r.dts<=days).length;
  const totPre=rows.reduce((a,r)=>a+r.prebuy,0), totCost=rows.reduce((a,r)=>a+r.cost,0);
  rows.sort((a,b)=>(a.dts??9999)-(b.dts??9999)||b.prebuy-a.prebuy);
  $('sg-metrics').innerHTML=
    '<div class="met bl"><div class="met-lbl">SKUs in scope</div><div class="met-val">'+group.length+'</div><div class="met-sub">'+esc(SIMSURGE.group||'all lines')+'</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Stock out in campaign</div><div class="met-val">'+stockouts+'</div><div class="met-sub">run dry within '+SIMSURGE.weeks+'w</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Pre-buy units</div><div class="met-val">'+totPre.toLocaleString()+'</div><div class="met-sub">to cover the surge</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Pre-buy cost</div><div class="met-val" style="font-size:17px">'+fmtK(totCost)+'</div><div class="met-sub">stock-up investment</div><div class="met-bar"></div></div>';
  $('sg-tbody').innerHTML=rows.length?rows.slice(0,250).map(r=>{
    const p=r.p;
    return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(p.sku)+'</td>'+
    '<td style="max-width:170px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
    '<td class="mu" style="max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(p.line||'')+'</td>'+
    '<td class="r stk">'+Math.max(0,stk(p)).toLocaleString()+'</td>'+
    '<td class="r mu">'+(p.velAdj!=null?p.velAdj:(p.velocity||0))+'</td>'+
    '<td class="r" style="font-weight:600">'+r.demand.toLocaleString()+'</td>'+
    '<td>'+soPill(r.dts)+'</td>'+
    '<td class="r" style="font-weight:700;color:var(--ac)">'+r.prebuy.toLocaleString()+'</td>'+
    '<td class="r">'+fmtP(r.cost)+'</td></tr>';
  }).join(''):'<tr><td colspan="9"><div class="empty">No SKUs with demand in this scope</div></td></tr>';
}

/* ── SIMULATOR: MONTE CARLO STOCKOUT RISK ── */
function mcRisk(p,horizonDays){
  const runs=500, mean0=(p.velAdj!=null?p.velAdj:(p.velocity||0));
  const s0=stk(p);
  if(mean0<=0||s0===null)return null;
  const fallback=!(p.demandStd>0);
  const sd=fallback?mean0*0.35:p.demandStd;
  if(s0<=0)return {p,prob:1,expDay:0,fallback};
  let outCount=0,sumDay=0;
  for(let r=0;r<runs;r++){
    let rem=s0,day=0;
    for(let k=0;k<8&&day<horizonDays;k++){
      let dem=fcRate(p,k)+sd*randn(); if(dem<0)dem=0;
      const daily=dem/30.44;
      if(daily>0&&rem<=dem){const d=day+rem/daily;if(d<=horizonDays){outCount++;sumDay+=d;}break;}
      rem-=dem; day+=30.44;
    }
  }
  return {p,prob:outCount/runs,expDay:outCount>0?Math.round(sumDay/outCount):null,fallback};
}
function riskBar(prob){
  const pct=Math.round(prob*100), col=prob>=0.7?'var(--rd)':prob>=0.3?'var(--am)':'var(--gr)';
  return '<div style="display:flex;align-items:center;gap:7px"><div style="flex:0 0 90px;height:6px;background:var(--sf2);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+col+'"></div></div><span style="font-weight:600;color:'+col+'">'+pct+'%</span></div>';
}
function renderMonteSim(){
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-direction:column;gap:6px">'+
    '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2)"><span>Risk horizon</span><span id="mc-h-lbl" style="font-weight:700;color:var(--ac)">60 days</span></div>'+
    '<input type="range" id="mc-h" min="14" max="120" step="7" value="'+SIMMONTE.horizon+'" style="width:100%" oninput="updateMonteSim()">'+
    '<div style="font-size:10.5px;color:var(--tx3)">Each SKU’s demand is simulated 500 times using its average and its variability (CV). The probability is the share of runs that stock out before the horizon.</div>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="mc-metrics"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Stock</th><th style="text-align:right">Fcst /mo</th><th>Variability</th><th>Stockout probability</th><th style="text-align:right">Expected day</th></tr></thead><tbody id="mc-tbody"></tbody></table></div><div class="tfooter"><span>Probabilistic forecast (Monte Carlo, 500 runs) &middot; lumpier demand widens the odds &middot; SKUs marked * use an assumed spread from too little history</span></div></div>';
  updateMonteSim();
}
function updateMonteSim(){
  const el=$('mc-h'); if(!el)return;
  SIMMONTE.horizon=parseInt(el.value)||60;
  $('mc-h-lbl').textContent=SIMMONTE.horizon+' days';
  const rows=DATA.filter(p=>stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0)).map(p=>mcRisk(p,SIMMONTE.horizon)).filter(Boolean).sort((a,b)=>b.prob-a.prob);
  const high=rows.filter(r=>r.prob>=0.7).length, med=rows.filter(r=>r.prob>=0.3&&r.prob<0.7).length;
  const expected=Math.round(rows.reduce((a,r)=>a+r.prob,0));
  $('mc-metrics').innerHTML=
    '<div class="met rd"><div class="met-lbl">High risk</div><div class="met-val">'+high+'</div><div class="met-sub">&ge;70% chance of stockout</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Medium risk</div><div class="met-val">'+med+'</div><div class="met-sub">30–70% chance</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Expected stockouts</div><div class="met-val">'+expected+'</div><div class="met-sub">within '+SIMMONTE.horizon+' days</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">SKUs modelled</div><div class="met-val">'+rows.length+'</div><div class="met-sub">with demand history</div><div class="met-bar"></div></div>';
  $('mc-tbody').innerHTML=rows.length?rows.slice(0,300).map(r=>{
    const p=r.p;
    return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(p.sku)+(r.fallback?' <span style="color:var(--tx3)">*</span>':'')+'</td>'+
    '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
    '<td class="mu" style="max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(p.line||'')+'</td>'+
    '<td class="r stk">'+Math.max(0,stk(p)).toLocaleString()+'</td>'+
    '<td class="r mu">'+(p.velAdj!=null?p.velAdj:(p.velocity||0))+'</td>'+
    '<td>'+cvBadge(p)+'</td><td style="min-width:150px">'+riskBar(r.prob)+'</td>'+
    '<td class="r mu">'+(r.expDay!=null?'day '+r.expDay:'—')+'</td></tr>';
  }).join(''):'<tr><td colspan="8"><div class="empty">No SKUs with demand to model</div></td></tr>';
}

/* ── SIMULATOR: 12-MONTH DEMAND & STOCK PROJECTION ── */
function renderProjectSim(){
  const cands=DATA.filter(p=>stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0)).sort((a,b)=>(b.velAdj||b.velocity||0)-(a.velAdj||a.velocity||0));
  if(!cands.length){$('content').innerHTML='<div class="empty" style="margin-top:40px">No SKUs with demand history to project</div>';return;}
  if(!SIMPROJ.sku||!cands.find(p=>p.sku===SIMPROJ.sku))SIMPROJ.sku=cands[0].sku;
  const opts=cands.map(p=>'<option value="'+esc(p.sku)+'"'+(SIMPROJ.sku===p.sku?' selected':'')+'>'+esc(p.sku)+' — '+esc(p.name)+'</option>').join('');
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--tx3);font-weight:500">Product</label><select id="pj-sku" onchange="updateProjectSim()" style="max-width:360px;padding:6px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--sf);color:var(--tx1);font-size:12px">'+opts+'</select></div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="pj-metrics"></div>'+
    '<div class="panel"><div class="phd">12-month demand & stock projection</div><div class="cw" style="height:340px"><canvas id="pj-canvas"></canvas></div><div style="font-size:10.5px;color:var(--tx3);margin-top:8px">Shaded band = 80% confidence from demand variability &middot; beyond month 6 assumes steady demand &middot; dashed line = reorder point</div></div>';
  updateProjectSim();
}
function updateProjectSim(){
  const sel=$('pj-sku'); if(!sel)return;
  SIMPROJ.sku=sel.value;
  const p=DATA.find(x=>x.sku===SIMPROJ.sku); if(!p)return;
  const s0=Math.max(0,stk(p)||0), sd=(p.demandStd>0?p.demandStd:(p.velAdj||p.velocity||0)*0.35);
  const now=new Date(), labels=[], demand=[], stockRem=[], upper=[], lower=[], rop=ropCalc(p).rop, ropArr=[];
  let cum=0;
  for(let k=0;k<12;k++){
    const d=new Date(now.getFullYear(),now.getMonth()+k,1);
    labels.push(d.toLocaleDateString('en-PH',{month:'short',year:'2-digit'}));
    const dem=fcRate(p,k); demand.push(Math.round(dem)); cum+=dem;
    const cumSd=sd*Math.sqrt(k+1), z=1.28;
    stockRem.push(Math.round(s0-cum));
    upper.push(Math.round(s0-(cum-z*cumSd)));
    lower.push(Math.round(s0-(cum+z*cumSd)));
    ropArr.push(rop);
  }
  let soM=stockRem.findIndex(v=>v<=0);
  const totDem=Math.round(demand.reduce((a,v)=>a+v,0));
  const cover=(p.velAdj||p.velocity)>0?Math.round(s0/((p.velAdj||p.velocity))*10)/10:null;
  $('pj-metrics').innerHTML=
    '<div class="met '+(soM>=0?'rd':'gr')+'"><div class="met-lbl">Projected stockout</div><div class="met-val" style="font-size:17px">'+(soM>=0?labels[soM]:'>12 mo')+'</div><div class="met-sub">on current stock</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Current stock</div><div class="met-val">'+s0.toLocaleString()+'</div><div class="met-sub">'+(cover!=null?cover+' months cover':'—')+'</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">12-mo demand</div><div class="met-val">'+totDem.toLocaleString()+'</div><div class="met-sub">projected units</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Reorder point</div><div class="met-val">'+rop.toLocaleString()+'</div><div class="met-sub">buy-again level</div><div class="met-bar"></div></div>';
  if(projInst){projInst.destroy();projInst=null;}
  projInst=new Chart($('pj-canvas'),{data:{labels,datasets:[
    {type:'line',label:'band-low',data:lower,borderWidth:0,pointRadius:0,fill:false,backgroundColor:'rgba(29,158,117,0.12)'},
    {type:'line',label:'band-high',data:upper,borderWidth:0,pointRadius:0,fill:'-1',backgroundColor:'rgba(29,158,117,0.12)'},
    {type:'line',label:'Projected stock',data:stockRem,borderColor:'#1D9E75',borderWidth:2,pointRadius:2,tension:.2,fill:false},
    {type:'line',label:'Reorder point',data:ropArr,borderColor:'#D85A30',borderDash:[5,4],borderWidth:1.5,pointRadius:0,fill:false},
    {type:'bar',label:'Monthly demand',data:demand,backgroundColor:'rgba(55,138,221,0.35)',yAxisID:'y1'}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
    scales:{y:{title:{display:true,text:'Units in stock'},grid:{color:'rgba(128,128,128,0.12)'}},y1:{position:'right',title:{display:true,text:'Demand/mo'},grid:{drawOnChartArea:false},beginAtZero:true}},
    plugins:{legend:{labels:{boxWidth:10,font:{size:10},filter:i=>!/^band-/.test(i.text)}}}}});
}

/* ── SIMULATOR: CASH-FLOW / WORKING CAPITAL ── */
function renderCashSim(){
  $('content').innerHTML=
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:14px">Six-month projection of purchasing outflow, sales at list price, and inventory value on hand. Month 1 includes the current reorder need; later months replenish to demand. Lead & coverage from Reorder plan settings.</div>'+
    '<div class="metrics" style="margin-bottom:14px" id="cf-metrics"></div>'+
    '<div class="panel"><div class="phd">Purchasing vs sales vs inventory value</div><div class="cw" style="height:340px"><canvas id="cf-canvas"></canvas></div></div>';
  updateCashSim();
}
function updateCashSim(){
  if(!$('cf-metrics'))return;
  const rr=reorderRows(PLAN.lead,PLAN.cover,PLAN.safety,1);
  const restock=rr.reduce((a,r)=>a+r.cost,0);
  let inv=DATA.reduce((a,p)=>{const s=stk(p);return a+(s>0&&p.price?s*p.price:0);},0);
  const now=new Date(), labels=[], purch=[], sales=[], invLine=[];
  for(let k=0;k<6;k++){
    const d=new Date(now.getFullYear(),now.getMonth()+k,1);
    labels.push(d.toLocaleDateString('en-PH',{month:'short',year:'2-digit'}));
    let sv=0; for(const p of DATA){if(p.price>0)sv+=fcRate(p,k)*p.price;}
    const po=k===0?restock:sv;
    inv=inv-sv+po;
    purch.push(Math.round(po)); sales.push(Math.round(sv)); invLine.push(Math.round(Math.max(0,inv)));
  }
  const totPurch=purch.reduce((a,v)=>a+v,0), totSales=sales.reduce((a,v)=>a+v,0), peak=Math.max(...invLine);
  $('cf-metrics').innerHTML=
    '<div class="met rd"><div class="met-lbl">6-mo purchasing</div><div class="met-val" style="font-size:17px">'+fmtK(totPurch)+'</div><div class="met-sub">cash out on stock</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">6-mo sales</div><div class="met-val" style="font-size:17px">'+fmtK(totSales)+'</div><div class="met-sub">revenue at list price</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Peak inventory value</div><div class="met-val" style="font-size:17px">'+fmtK(peak)+'</div><div class="met-sub">max cash tied up</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Month 1 restock</div><div class="met-val" style="font-size:17px">'+fmtK(restock)+'</div><div class="met-sub">current reorder need</div><div class="met-bar"></div></div>';
  if(cashInst){cashInst.destroy();cashInst=null;}
  cashInst=new Chart($('cf-canvas'),{data:{labels,datasets:[
    {type:'bar',label:'Purchases',data:purch,backgroundColor:'rgba(216,90,48,0.55)'},
    {type:'bar',label:'Sales',data:sales,backgroundColor:'rgba(55,138,221,0.45)'},
    {type:'line',label:'Inventory value',data:invLine,borderColor:'#7F77DD',borderWidth:2,pointRadius:2,tension:.2,fill:false}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
    scales:{y:{ticks:{callback:v=>'₱'+Math.round(v).toLocaleString()},grid:{color:'rgba(128,128,128,0.12)'}}},
    plugins:{legend:{labels:{boxWidth:10,font:{size:10}}}}}});
}

/* ── SIMULATOR: BULK-BUY / MOQ TRADE-OFF ── */
function renderBulkSim(){
  const sl=(id,val,lbl,min,max,step,unit)=>'<div style="display:flex;flex-direction:column;gap:5px;min-width:150px;flex:1"><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2)"><span>'+lbl+'</span><span id="'+id+'-lbl" style="font-weight:700;color:var(--ac)">'+val+unit+'</span></div><input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'" style="width:100%" oninput="updateBulkSim()"></div>';
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-wrap:wrap;gap:22px">'+
    sl('bk-disc',SIMBULK.disc,'Bulk discount',0,30,1,'%')+
    sl('bk-months',SIMBULK.months,'Months of supply',1,12,1,'mo')+
    sl('bk-hold',SIMBULK.hold,'Holding cost /mo',0,5,0.5,'%')+
    sl('bk-shelf',SIMBULK.shelf,'Assumed shelf life',3,36,1,'mo')+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="bk-metrics"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th style="text-align:right">Fcst /mo</th><th style="text-align:right">Bulk qty</th><th style="text-align:right">Discount saved</th><th style="text-align:right">Holding cost</th><th style="text-align:right">Expiry risk</th><th style="text-align:right">Net benefit</th></tr></thead><tbody id="bk-tbody"></tbody></table></div><div class="tfooter"><span>Net = discount saved &minus; holding cost &minus; expiry write-off risk &middot; expiry risk = units that can’t sell within the shelf life &middot; positive net = worth bulk-buying</span></div></div>';
  updateBulkSim();
}
function updateBulkSim(){
  const el=$('bk-disc'); if(!el)return;
  SIMBULK.disc=parseFloat(el.value)||0; SIMBULK.months=parseInt($('bk-months').value)||1;
  SIMBULK.hold=parseFloat($('bk-hold').value)||0; SIMBULK.shelf=parseInt($('bk-shelf').value)||1;
  $('bk-disc-lbl').textContent=SIMBULK.disc+'%'; $('bk-months-lbl').textContent=SIMBULK.months+'mo';
  $('bk-hold-lbl').textContent=SIMBULK.hold+'%'; $('bk-shelf-lbl').textContent=SIMBULK.shelf+'mo';
  const rows=[];
  for(const p of DATA){
    const monthly=(p.velAdj!=null?p.velAdj:(p.velocity||0));
    if(monthly<=0||!(p.price>0))continue;
    const bulkQty=Math.ceil(monthly*SIMBULK.months), bulkVal=bulkQty*p.price;
    const discSaved=SIMBULK.disc/100*bulkVal;
    const holding=SIMBULK.hold/100*p.price*(bulkQty/2)*SIMBULK.months;
    const sellable=monthly*SIMBULK.shelf;
    const expired=Math.max(0,bulkQty-sellable), expiryRisk=expired*p.price;
    rows.push({p,monthly,bulkQty,discSaved,holding,expiryRisk,net:discSaved-holding-expiryRisk});
  }
  rows.sort((a,b)=>b.net-a.net);
  const worth=rows.filter(r=>r.net>0), totNet=worth.reduce((a,r)=>a+r.net,0);
  const totDisc=rows.reduce((a,r)=>a+r.discSaved,0), totExp=rows.reduce((a,r)=>a+r.expiryRisk,0);
  $('bk-metrics').innerHTML=
    '<div class="met gr"><div class="met-lbl">Worth bulk-buying</div><div class="met-val">'+worth.length+'</div><div class="met-sub">SKUs with positive net</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Net opportunity</div><div class="met-val" style="font-size:17px">'+fmtK(totNet)+'</div><div class="met-sub">total upside on those SKUs</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Discount captured</div><div class="met-val" style="font-size:17px">'+fmtK(totDisc)+'</div><div class="met-sub">across all SKUs</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Expiry risk</div><div class="met-val" style="font-size:17px">'+fmtK(totExp)+'</div><div class="met-sub">value that could expire</div><div class="met-bar"></div></div>';
  $('bk-tbody').innerHTML=rows.length?rows.slice(0,300).map(r=>{
    const p=r.p;
    return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(p.sku)+'</td>'+
    '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
    '<td class="r mu">'+r.monthly+'</td><td class="r">'+r.bulkQty.toLocaleString()+'</td>'+
    '<td class="r" style="color:var(--gr)">'+fmtK(r.discSaved)+'</td><td class="r mu">'+fmtK(r.holding)+'</td>'+
    '<td class="r" style="color:'+(r.expiryRisk>0?'var(--rd)':'var(--tx3)')+'">'+fmtK(r.expiryRisk)+'</td>'+
    '<td class="r" style="font-weight:700;color:'+(r.net>=0?'var(--gr)':'var(--rd)')+'">'+(r.net<0?'−':'')+fmtK(Math.abs(r.net))+'</td></tr>';
  }).join(''):'<tr><td colspan="8"><div class="empty">No SKUs with demand and price</div></td></tr>';
}

/* ── SIMULATOR: BRANCH REBALANCING ── */
function renderBranchSim(){
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-direction:column;gap:6px">'+
    '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2)"><span>Minimum move to flag</span><span id="br-min-lbl" style="font-weight:700;color:var(--ac)">10 units</span></div>'+
    '<input type="range" id="br-min" min="0" max="50" step="5" value="'+SIMBRANCH.minMove+'" style="width:100%" oninput="updateBranchSim()">'+
    '<div style="font-size:10.5px;color:var(--tx3)">Target allocation assumes each clinic should hold a SKU in proportion to its overall transfer volume. Based on 2025+ transfer history as a demand proxy (live per-branch on-hand isn’t in the data feed). Expiry-driven moves are always shown.</div>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="br-metrics"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th style="text-align:right">BGC</th><th style="text-align:right">Vertis</th><th style="text-align:right">GH Mall</th><th>Suggested move</th><th>Reason</th></tr></thead><tbody id="br-tbody"></tbody></table></div><div class="tfooter"><span>Move quantity balances a SKU toward each clinic’s demand-proportional share &middot; expiry-flagged rows have near-expiry stock at a clinic that a busier clinic could use first</span></div></div>';
  updateBranchSim();
}
function updateBranchSim(){
  const el=$('br-min'); if(!el)return;
  SIMBRANCH.minMove=parseInt(el.value)||0;
  const branches=['BGC','Vertis North','GH Mall'];
  const total={}; let grand=0;
  branches.forEach(b=>{total[b]=(BRANCH_TRANSFERS||[]).filter(t=>t.branch===b).reduce((a,t)=>a+t.qty,0);grand+=total[b];});
  const weight={}; branches.forEach(b=>weight[b]=grand>0?total[b]/grand:1/3);
  const bySku={};
  (BRANCH_TRANSFERS||[]).forEach(t=>{if(!bySku[t.sku])bySku[t.sku]={name:t.name,line:t.line,b:{'BGC':0,'Vertis North':0,'GH Mall':0}};bySku[t.sku].b[t.branch]=(bySku[t.sku].b[t.branch]||0)+t.qty;});
  const urgent={}; branches.forEach(b=>{(BRANCH_EXPIRY[b]||[]).forEach(i=>{const pm=i.expiry&&i.expiry.match(/^(\d{1,2})\/(\d{4})$/);if(pm&&(new Date(+pm[2],+pm[1]-1,1)-new Date())/864e5<=92)urgent[i.sku+'|'+b]=true;});});
  const rows=[];
  for(const sku in bySku){
    const o=bySku[sku], tot=branches.reduce((a,b)=>a+o.b[b],0); if(tot<=0)continue;
    const surplus={}; branches.forEach(b=>surplus[b]=o.b[b]-tot*weight[b]);
    let from=branches[0],to=branches[0];
    branches.forEach(b=>{if(surplus[b]>surplus[from])from=b;if(surplus[b]<surplus[to])to=b;});
    const move=Math.max(0,Math.round(Math.min(surplus[from],-surplus[to])));
    const exp=branches.filter(b=>urgent[sku+'|'+b]);
    if(move>=SIMBRANCH.minMove||exp.length)rows.push({sku,name:o.name,b:o.b,from,to,move,exp:exp.length>0});
  }
  rows.sort((a,b)=>((b.exp?1:0)-(a.exp?1:0))||(b.move-a.move));
  const totMove=rows.reduce((a,r)=>a+r.move,0), expDriven=rows.filter(r=>r.exp).length;
  $('br-metrics').innerHTML=
    '<div class="met bl"><div class="met-lbl">SKUs to rebalance</div><div class="met-val">'+rows.length+'</div><div class="met-sub">across Remedy’s 3 branches</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Units to move</div><div class="met-val">'+totMove.toLocaleString()+'</div><div class="met-sub">suggested transfers</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Expiry-driven</div><div class="met-val">'+expDriven+'</div><div class="met-sub">near-expiry at a clinic</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Branch split</div><div class="met-val" style="font-size:15px">'+branches.map(b=>Math.round(weight[b]*100)+'%').join(' / ')+'</div><div class="met-sub">BGC / Vertis / GH share</div><div class="met-bar"></div></div>';
  $('br-tbody').innerHTML=rows.length?rows.slice(0,300).map(r=>{
    const fromShort=r.from==='Vertis North'?'Vertis':r.from==='GH Mall'?'GH':r.from;
    const toShort=r.to==='Vertis North'?'Vertis':r.to==='GH Mall'?'GH':r.to;
    const moveTxt=r.move>0?('<span class="pill pbl">'+fromShort+' → '+toShort+' '+r.move+'</span>'):'<span class="pill pgy">balanced</span>';
    return '<tr><td class="mo">'+esc(r.sku)+'</td>'+
    '<td style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</td>'+
    '<td class="r">'+r.b['BGC'].toLocaleString()+'</td><td class="r">'+r.b['Vertis North'].toLocaleString()+'</td><td class="r">'+r.b['GH Mall'].toLocaleString()+'</td>'+
    '<td>'+moveTxt+'</td>'+
    '<td>'+(r.exp?'<span class="pill prd">Expiry</span>':'<span class="pill pgy">Rebalance</span>')+'</td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="empty">No branch transfer data, or nothing to rebalance at this threshold</div></td></tr>';
}

/* ── CONTEXT-AWARE CSV EXPORT ── */
function downloadCSV(name,headers,rows){
  const esc=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const csv=[headers.map(esc).join(','),...rows.map(r=>r.map(esc).join(','))].join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
  a.download='healthspan_'+name+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}
function exportCurrentView(){
  switch(currentView){
    case 'reorderplan': return exportReorderCSV();
    case 'ropoint': return exportROPCSV();
    case 'forecast': return exportForecast();
    case 'variability': return exportVariability();
    case 'abc': return exportABC();
    case 'writeoff': return exportWriteoff();
    case 'whatif': return exportWhatif();
    case 'simpromo': return exportPromo();
    case 'simbudget': return exportBudget();
    case 'simservice': return exportService();
    case 'simsurge': return exportSurge();
    case 'simmonte': return exportMonte();
    case 'simproject': return exportProject();
    case 'simcash': return exportCash();
    case 'simbulk': return exportBulk();
    case 'simbranch': return exportBranch();
    case 'customers': return exportCustomers();
    case 'health': return exportHealth();
    case 'coverage': return exportCoverage();
    case 'dealvalue': return exportDeals();
    case 'salesoverview': return exportSalesOverview();
    case 'salesdeals': return exportSalesDeals();
    case 'salesrecon': return exportSalesRecon();
    case 'salesfield': return exportSalesField();
    case 'salesfree': return exportSalesFree();
    case 'salestarget': return exportSalesTarget();
    case 'salesspec': return exportSalesSpec();
    default: return exportCSV();
  }
}
function exportSalesOverview(){
  if(!SALESIDX)return;
  const stkOf={};DATA.forEach(p=>stkOf[p.sku]=stk(p));
  downloadCSV('sales_overview_'+SPERIOD,['SKU','Product','Line','Total units','Via deals','A la carte','Free units','Revenue PHP','Stock now'],
    salesRows().map(r=>[r.sku,r.name,r.line,r.u,r.d,r.au,r.f,Math.round(r.v),stkOf[r.sku]??'']));
}
function exportSalesDeals(){
  if(!SALESIDX)return;
  const dealTypeOf=sku=>{const S=SALESIDX[sku];if(!S||!S.bundles||!S.bundles.length)return '';
    return [...new Set(S.bundles.map(b=>{const m=(b.productTitle||'').match(/\d+\s*\+\s*\d+/);return m?m[0].replace(/\s+/g,''):(b.productTitle||'').slice(0,16);}))].sort().join(', ');};
  downloadCSV('deals_vs_alacarte_'+SPERIOD,['SKU','Product','Line','Deal type','Deal units','A la carte units','Deal share %','Deal revenue PHP','PHP per unit via deal','PHP per unit a la carte','Effective discount %'],
    salesRows().filter(r=>r.d>0||r.au>0).map(r=>{
      const dPU=r.d>0?r.dealRev/r.d:null,aPU=r.au>0?r.alaRev/r.au:null;
      return [r.sku,r.name,r.line,dealTypeOf(r.sku),r.d,r.au,(r.d+r.au)>0?Math.round(r.d/(r.d+r.au)*100):'',Math.round(r.dealRev),dPU!=null?Math.round(dPU):'',aPU!=null?Math.round(aPU):'',(dPU!=null&&aPU>0)?Math.round((1-dPU/aPU)*100):''];}));
}
function exportSalesFree(){
  if(!SALESIDX)return;
  const priceOf={};DATA.forEach(p=>priceOf[p.sku]=p.price||0);
  downloadCSV('free_items_'+SPERIOD,['SKU','Product','Line','Free units','Paid units','Free %','Value at list PHP','Stock now'],
    salesRows().filter(r=>r.f>0||r.paid>0).map(r=>{const p=DATA.find(x=>x.sku===r.sku);
      return [r.sku,r.name,r.line,r.f,r.paid,r.u>0?(r.f/r.u*100).toFixed(0):'',Math.round(r.f*(priceOf[r.sku]||0)),p?stk(p):''];}));
}
function exportSalesTarget(){
  if(!(TARGETS||[]).length)return;
  const ym=window._tgMonth||new Date().toISOString().slice(0,7);
  const specs=specMerged();
  let actTotal={u:0,v:0};const actLine={};
  // forced everywhere below, exactly like renderSalesTarget: a target is set on
  // external sales, so the CSV must not include Remedy or internal orders
  for(const sku in (SALESIDX||{})){const S=SALESIDX[sku];
    const c=netMonthly(S,'',true)[ym],b=netMonthly(S,'b',true)[ym];if(!c&&!b)continue;
    const u=c?c.u:0,v=(c?c.v:0)+(b?b.v:0);
    actTotal.u+=u;actTotal.v+=v;const L=S.line||'';const a=actLine[L]||(actLine[L]={u:0,v:0});a.u+=u;a.v+=v;}
  downloadCSV('sales_vs_target_'+ym,['Month','Scope','Name','Actual PHP','Target PHP','Attainment %','Actual units','Target units'],
    TARGETS.filter(t=>t.month===ym).map(t=>{
      let act={u:0,v:0};
      if(t.scope==='TOTAL')act=actTotal;
      else if(t.scope==='LINE'){const k=Object.keys(actLine).find(x=>x.toLowerCase()===(t.name||'').toLowerCase());if(k)act=actLine[k];}
      else if(t.scope==='SPECIALIST'){const k=Object.keys(specs).find(x=>x.toLowerCase()===(t.name||'').toLowerCase());const c=k?netMonthly(specs[k],'',true)[ym]:null;if(c)act={u:c.u,v:c.v};}
      else{const a=tgActualProduct(ym,t.name||'');if(a)act={u:a.u,v:a.v};}
      return [t.month,t.scope,t.name,Math.round(act.v),t.value||'',t.value>0?(act.v/t.value*100).toFixed(0):'',act.u,t.units||''];}));
}
function exportSalesSpec(){
  const specs=specMerged();
  downloadCSV('sales_per_specialist_'+SPERIOD,['Specialist','Units','Revenue PHP'],
    Object.keys(specs).map(n=>{const t=netPeriod(specs[n],SPERIOD,'');return [n,t.u,Math.round(t.v)];}).sort((a,b)=>b[2]-a[2]));
}
function exportSalesRecon(){
  if(!SALESIDX)return;
  downloadCSV('vs_accounting',['Month','Accounting booked PHP','QBO PHP','Dashboard external PHP','Delta PHP','Delta %','Internal excluded PHP','Dashboard total PHP'],
    reconRows().filter(r=>r.acct!==null||r.all>0).map(r=>[r.m,r.acct??'',r.qbo??'',r.ext,r.gap??'',(r.gap!==null&&r.acct>0)?(r.gap/r.acct*100).toFixed(1):'',r.internal,r.all]));
}
function exportSalesField(){
  if(!SHOPIFY||!SHOPIFY.recent)return;
  const F=fieldRows();
  downloadCSV('field_coverage_'+SPERIOD,['Specialist','Orders','Visits logged','Active days','Contacts per day','Accounts reached','Universe (6mo)','Coverage %','Free units','Booked PHP'],
    F.rows.map(r=>[r.n,r.orders,r.visits,r.days,r.perDay.toFixed(1),r.custs,r.custs6,r.cov.toFixed(0),r.free,Math.round(r.rev)]));
}
function exportForecast(){
  const rows=DATA.filter(p=>((p.velAdj||0)>0||(p.velocity||0)>0)&&stk(p)!==null).sort((a,b)=>(a.daysToStockout??9999)-(b.daysToStockout??9999));
  downloadCSV('stockout_forecast',['SKU','Product','Line','Stock','Forecast/mo','Trend','Days to stockout','Projected date','Basis'],
    rows.map(p=>[p.sku,p.name,p.line,stk(p),(p.velAdj!=null?p.velAdj:p.velocity||0),p.trendFlag,p.daysToStockout??'>365',p.stockoutDate||'',p.seasonal?'seasonal+trend':'trend']));
}
function exportVariability(){
  const rows=DATA.filter(p=>((p.velAdj||0)>0||(p.velocity||0)>0||(p.sold||0)>0)).sort((a,b)=>((b.cv==null?-1:b.cv)-(a.cv==null?-1:a.cv)));
  downloadCSV('demand_variability',['SKU','Product','Line','Months history','Avg/mo','Std dev','CV','Class'],
    rows.map(p=>[p.sku,p.name,p.line,p.demandN??'',p.demandMean??'',p.demandStd??'',p.cv??'',p.demandClass||'']));
}
function exportABC(){
  const ranked=DATA.filter(p=>p.abc).slice().sort((a,b)=>(b.abcShare||0)-(a.abcShare||0));
  let cum=0;
  downloadCSV('abc_analysis',['Rank','Class','SKU','Product','Line','Forecast/mo','Unit price','Share %','Cumulative %'],
    ranked.map((p,i)=>{cum+=p.abcShare||0;return [i+1,p.abc,p.sku,p.name,p.line,(p.velAdj!=null?p.velAdj:p.velocity||0),p.price??'',(p.abcShare||0).toFixed(1),Math.min(100,cum).toFixed(1)];}));
}
function exportWriteoff(){
  downloadCSV('writeoff_forecast',['SKU','Product','Batch','Expiry','Days to expiry','SOH','Projected expired','Write-off value'],
    collisionRows(1).map(c=>[c.sku,c.name,c.batch,c.expiry,c.daysToExpiry,c.soh,c.projExpired,Math.round(c.writeOff)]));
}
function exportWhatif(){
  const mult=WHATIF.mult, arrival=PLAN.lead+WHATIF.delay;
  const rows=DATA.filter(p=>((p.velAdj||0)>0||(p.velocity||0)>0)&&stk(p)!==null).map(p=>({p,d:simDaysToStockout(p,mult)})).sort((a,b)=>(a.d??9999)-(b.d??9999));
  downloadCSV('whatif_scenario',['SKU','Product','Line','Stock','Days to stockout (scenario)','Runs out before day '+arrival],
    rows.map(x=>[x.p.sku,x.p.name,x.p.line,stk(x.p),x.d??'>365',(x.d!=null&&x.d<=arrival&&stk(x.p)>0)?'YES':'']));
}
function exportPromo(){
  const mult=1+SIMPROMO.lift/100, base=collisionRows(1), promo=collisionRows(mult);
  const pMap={}; promo.forEach(c=>pMap[c.sku+'|'+c.batch]=c);
  const rows=base.map(b=>{const p=pMap[b.sku+'|'+b.batch];const pe=p?p.projExpired:0,pw=p?p.writeOff:0;const sold=Math.max(0,b.soh-pe);const dc=Math.round(SIMPROMO.disc/100*(b.price||0)*sold);const ws=Math.round(Math.max(0,b.writeOff-pw));return [b.sku,b.name,b.batch,b.expiry,b.daysToExpiry,b.soh,b.projExpired,pe,Math.max(0,b.projExpired-pe),ws,dc,ws-dc];}).sort((a,b)=>b[9]-a[9]);
  downloadCSV('promo_rescue',['SKU','Product','Batch','Expiry','Days to expiry','SOH','Expire now','Expire w/ promo','Rescued','Write-off saved','Discount cost','Net'],rows);
}
function exportBudget(){
  const rr=reorderRows(PLAN.lead,PLAN.cover,PLAN.safety,1), rank=p=>p.abc==='A'?0:p.abc==='B'?1:2;
  rr.sort((a,b)=>((b.runsOutInLead?1:0)-(a.runsOutInLead?1:0))||(rank(a.p)-rank(b.p))||((a.p.daysToStockout??9999)-(b.p.daysToStockout??9999)));
  let spent=0;
  const rows=rr.map(r=>{const fit=spent+r.cost<=SIMBUDGET.budget;if(fit)spent+=r.cost;return [r.p.sku,r.p.name,r.p.abc||'',r.p.daysToStockout??'>365',r.qty,Math.round(r.cost),fit?'YES':'',fit?Math.round(spent):''];});
  downloadCSV('budget_plan',['SKU','Product','ABC','Days to stockout','Order qty','Cost','Funded','Cumulative spend'],rows);
}
function exportService(){
  downloadCSV('service_level',['Service level %','z-score','Safety stock units','Cash tied up'],
    [80,90,95,97.5,99].map(l=>{const c=svcCash(l);return [l,zFor(l).toFixed(2),c.units,Math.round(c.cash)];}));
}
function exportSurge(){
  const mult=1+SIMSURGE.lift/100, days=SIMSURGE.weeks*7;
  const group=DATA.filter(p=>(!SIMSURGE.group||p.line===SIMSURGE.group)&&stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0));
  const rows=group.map(p=>{const dem=Math.round(unitsOverDays(p,days,mult));const s=Math.max(0,stk(p));const pre=Math.max(0,Math.ceil(dem-s));return [p.sku,p.name,p.line,s,(p.velAdj!=null?p.velAdj:p.velocity||0),dem,simDaysToStockout(p,mult)??'>365',pre,Math.round(pre*(p.price||0))];}).sort((a,b)=>b[7]-a[7]);
  downloadCSV('campaign_surge',['SKU','Product','Line','Stock','Normal/mo','Campaign need','Days to stockout','Pre-buy','Cost'],rows);
}
function exportMonte(){
  const rows=DATA.filter(p=>stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0)).map(p=>mcRisk(p,SIMMONTE.horizon)).filter(Boolean).sort((a,b)=>b.prob-a.prob);
  downloadCSV('monte_carlo_risk',['SKU','Product','Line','Stock','Forecast/mo','CV','Stockout probability %','Expected day','Horizon days'],
    rows.map(r=>[r.p.sku,r.p.name,r.p.line,Math.max(0,stk(r.p)),(r.p.velAdj!=null?r.p.velAdj:r.p.velocity||0),r.p.cv??'',Math.round(r.prob*100),r.expDay??'',SIMMONTE.horizon]));
}
function exportProject(){
  const p=DATA.find(x=>x.sku===SIMPROJ.sku); if(!p){return exportCSV();}
  const s0=Math.max(0,stk(p)||0), sd=(p.demandStd>0?p.demandStd:(p.velAdj||p.velocity||0)*0.35), now=new Date();
  let cum=0; const rows=[];
  for(let k=0;k<12;k++){const d=new Date(now.getFullYear(),now.getMonth()+k,1);const dem=fcRate(p,k);cum+=dem;const cs=sd*Math.sqrt(k+1);rows.push([d.toLocaleDateString('en-PH',{month:'short',year:'2-digit'}),Math.round(dem),Math.round(s0-cum),Math.round(s0-(cum-1.28*cs)),Math.round(s0-(cum+1.28*cs))]);}
  downloadCSV('projection_'+p.sku,['Month','Projected demand','Projected stock','Stock (high)','Stock (low)'],rows);
}
function exportCash(){
  const rr=reorderRows(PLAN.lead,PLAN.cover,PLAN.safety,1), restock=rr.reduce((a,r)=>a+r.cost,0), now=new Date();
  let inv=DATA.reduce((a,p)=>{const s=stk(p);return a+(s>0&&p.price?s*p.price:0);},0);
  const rows=[];
  for(let k=0;k<6;k++){const d=new Date(now.getFullYear(),now.getMonth()+k,1);let sv=0;for(const p of DATA){if(p.price>0)sv+=fcRate(p,k)*p.price;}const po=k===0?restock:sv;inv=inv-sv+po;rows.push([d.toLocaleDateString('en-PH',{month:'short',year:'2-digit'}),Math.round(po),Math.round(sv),Math.round(Math.max(0,inv))]);}
  downloadCSV('cash_flow',['Month','Purchases','Sales','Inventory value'],rows);
}
function exportBulk(){
  const rows=[];
  for(const p of DATA){const m=(p.velAdj!=null?p.velAdj:p.velocity||0);if(m<=0||!(p.price>0))continue;const q=Math.ceil(m*SIMBULK.months);const dv=SIMBULK.disc/100*q*p.price;const h=SIMBULK.hold/100*p.price*(q/2)*SIMBULK.months;const ex=Math.max(0,q-m*SIMBULK.shelf)*p.price;rows.push([p.sku,p.name,m,q,Math.round(dv),Math.round(h),Math.round(ex),Math.round(dv-h-ex)]);}
  rows.sort((a,b)=>b[7]-a[7]);
  downloadCSV('bulk_buy',['SKU','Product','Forecast/mo','Bulk qty','Discount saved','Holding cost','Expiry risk','Net benefit'],rows);
}
function exportCoverage(){
  const cands=DATA.filter(p=>{const s=stk(p);return s>0&&((p.velAdj||0)>0||(p.velocity||0)>0);})
    .map(p=>{const rate=(p.velAdj!=null&&p.velAdj>0)?p.velAdj:p.velocity;const m=stk(p)/rate;return {p,mo:m,wk:m*4.345};})
    .sort((a,b)=>a.wk-b.wk);
  downloadCSV('stock_coverage',['SKU','Product','Line','Stock','Forecast/mo','Weeks of cover','Months of cover'],
    cands.map(x=>[x.p.sku,x.p.name,x.p.line,stk(x.p),(x.p.velAdj!=null?x.p.velAdj:x.p.velocity),Math.round(x.wk*10)/10,Math.round(x.mo*10)/10]));
}
function exportHealth(){
  const active=DATA.filter(p=>{const s=stk(p);return (s!==null&&s>0)||p.sold>0;});
  const issues={}; const add=(p,t)=>{(issues[p.sku]=issues[p.sku]||{p,tags:[]}).tags.push(t);};
  active.filter(p=>!(p.price>0)).forEach(p=>add(p,'no price'));
  active.filter(p=>stk(p)>0&&!p.expiry).forEach(p=>add(p,'no expiry'));
  active.filter(p=>stk(p)>0&&!p.batch).forEach(p=>add(p,'no batch'));
  active.filter(p=>stk(p)>0&&!p.bin).forEach(p=>add(p,'no bin'));
  DATA.filter(p=>{const s=stk(p);return s!==null&&s<0;}).forEach(p=>add(p,'negative stock'));
  DATA.filter(p=>p.demandClass==='insufficient'&&p.sold>0).forEach(p=>add(p,'low history'));
  const bset=new Set((BATCHES||[]).filter(b=>b.soh>0).map(b=>b.skuCode));
  active.filter(p=>stk(p)>0&&p.expiry&&!bset.has(p.sku)).forEach(p=>add(p,'no shelf-life record'));
  const myr=new Date().getFullYear()+10;
  active.filter(p=>{const m=String(p.expiry||'').match(/\d{4}/g);return m&&Math.max(...m.map(Number))>myr;}).forEach(p=>add(p,'implausible expiry'));
  downloadCSV('data_health',['SKU','Product','Line','Stock','Price','Issues'],
    Object.values(issues).map(x=>[x.p.sku,x.p.name,x.p.line,stk(x.p)??'',x.p.price??'',x.tags.join('; ')]));
}
function exportCustomers(){
  const all=CUSTOMERS||[]; const tot=all.reduce((a,x)=>a+x.value,0);
  downloadCSV('customers',['Customer','Is Remedy','Orders','SKUs','Units','Shipped value','Share %','Last order (days ago)','Trend'],
    all.map(c=>[c.name,c.isRemedy?'YES':'',c.orders,c.skuCount,c.qty,c.value,tot>0?(c.value/tot*100).toFixed(1):'',c.daysSince??'',c.trend]));
}
function exportBranch(){
  const branches=['BGC','Vertis North','GH Mall'], total={}; let grand=0;
  branches.forEach(b=>{total[b]=(BRANCH_TRANSFERS||[]).filter(t=>t.branch===b).reduce((a,t)=>a+t.qty,0);grand+=total[b];});
  const weight={}; branches.forEach(b=>weight[b]=grand>0?total[b]/grand:1/3);
  const bySku={}; (BRANCH_TRANSFERS||[]).forEach(t=>{if(!bySku[t.sku])bySku[t.sku]={name:t.name,b:{'BGC':0,'Vertis North':0,'GH Mall':0}};bySku[t.sku].b[t.branch]=(bySku[t.sku].b[t.branch]||0)+t.qty;});
  const rows=[];
  for(const sku in bySku){const o=bySku[sku],tot=branches.reduce((a,b)=>a+o.b[b],0);if(tot<=0)continue;const surplus={};branches.forEach(b=>surplus[b]=o.b[b]-tot*weight[b]);let from=branches[0],to=branches[0];branches.forEach(b=>{if(surplus[b]>surplus[from])from=b;if(surplus[b]<surplus[to])to=b;});const move=Math.max(0,Math.round(Math.min(surplus[from],-surplus[to])));if(move<SIMBRANCH.minMove)continue;rows.push([sku,o.name,o.b['BGC'],o.b['Vertis North'],o.b['GH Mall'],from,to,move]);}
  rows.sort((a,b)=>b[7]-a[7]);
  downloadCSV('branch_rebalancing',['SKU','Product','BGC','Vertis North','GH Mall','Move from','Move to','Units'],rows);
}
/* ── COPY FOR AI (prompt-ready export of the filtered products) ── */
async function copyForAI(){
  const rows=currentFilteredRows();
  const btn=document.getElementById('aiCopyBtn');
  if(!rows.length){if(btn)btn.textContent='Nothing in filter';setTimeout(()=>renderTable(),1200);return;}
  const asOf=new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila'});
  const scope=[fLine&&('line '+fLine),fSup&&('supplier '+fSup),fCat&&('category '+fCat),fSearch&&('search "'+fSearch+'"'),fTab!=='all'&&('tab '+fTab)].filter(Boolean).join(' · ')||'all products';
  let t='HEALTHSPAN GLOBAL — INVENTORY + SALES MOVEMENT EXPORT\n';
  t+='As of: '+asOf+' · Scope: '+scope+' · '+rows.length+' SKUs\n';
  const shopPriced=rows.filter(p=>p.priceSrc==='shopify').length;
  t+='Notes: stock is warehouse-level on-hand (from the inventory master sheet). ';
  t+=shopPriced>0
    ?('Prices in PHP: '+shopPriced+' of '+rows.length+' SKUs carry LIVE Shopify prices (price_source=shopify, confirmed aligned with the master sheet); the rest use the sheet price; blank = no price in either system. ')
    :'Prices are in PHP from the master sheet; blank = no price on file (Shopify prices not loaded in this session). ';
  t+='Monthly units = actual outbound movement (sales/issues) from the warehouse. Supplier cost / landed cost are NOT in this data.\n\n';
  t+='PRODUCTS (sku | name | supplier | line | stock_on_hand | price_php | price_source | forecast_units_per_month | months_of_cover | days_to_stockout | projected_stockout_date | master_expiry | batch):\n';
  for(const p of rows){
    t+=[p.sku,p.name,p.supplier||'',p.line||'',stk(p)??'',p.price??'',(p.price!=null?(p.priceSrc||'sheet'):''),(p.velAdj!=null?p.velAdj:p.velocity)??'',p.monthsOfStock??'',p.daysToStockout??'',p.stockoutDate||'',p.expiry||'',p.batch||''].join(' | ')+'\n';
  }
  if((MONTHS||[]).length&&rows.some(p=>Array.isArray(p.monthly))){
    t+='\nMONTHLY UNITS OUT PER SKU (actual movement, '+MONTHS[0]+' → '+MONTHS[MONTHS.length-1]+'; the last month is partial):\n';
    for(const p of rows){
      if(Array.isArray(p.monthly))t+=p.sku+' '+p.name+': '+MONTHS.map((m,i)=>m+'='+(p.monthly[i]??0)).join(', ')+'\n';
    }
  }
  if(rows.some(p=>p.shopifySales)){
    t+='\nSHOPIFY UNIT DEMAND PER SKU (INCLUDES internal orders to Remedy branches and Healthspan staff/academy — the Sales views default to EXTERNAL ONLY, so these are higher than those pages show) (physical units booked at the store; deals counted as a whole incl. +1 units; not double-counted; month=units):\n';
    for(const p of rows){
      if(!p.shopifySales)continue;
      const yms=Object.keys(p.shopifySales).sort();
      t+=p.sku+' '+p.name+': '+yms.map(m=>m+'='+p.shopifySales[m]).join(', ')+'\n';
    }
  }
  const dealRows2=rows.filter(p=>p.deals&&p.deals.length);
  if(dealRows2.length){
    t+='\nLIVE DEALS ON SHOPIFY (sku | deal title | physical units per set | set price):\n';
    for(const p of dealRows2)for(const d of p.deals)t+=[p.sku,d.title,d.setSize,d.price].join(' | ')+'\n';
  }
  const skuSet=new Set(rows.map(p=>p.sku));
  const bs=(BATCHES||[]).filter(b=>skuSet.has(b.skuCode)&&b.soh>0);
  if(bs.length){
    t+='\nBATCHES with stock, FEFO order — earliest expiry first (sku | batch | expiry MM/YYYY | units_on_hand):\n';
    for(const b of bs)t+=[b.skuCode,b.batch||'',b.expiry||'',b.soh].join(' | ')+'\n';
  }
  let copied=false;
  try{await navigator.clipboard.writeText(t);copied=true;}catch(e){}
  if(!copied){
    const a=document.createElement('a');
    a.href='data:text/plain;charset=utf-8,﻿'+encodeURIComponent(t);
    a.download='healthspan_ai_export_'+new Date().toISOString().slice(0,10)+'.txt';
    a.click();
  }
  if(btn){const old=btn.innerHTML;btn.innerHTML=copied?'✓ Copied '+rows.length+' SKUs':'✓ Downloaded';setTimeout(()=>{btn.innerHTML=old;},1800);}
}
