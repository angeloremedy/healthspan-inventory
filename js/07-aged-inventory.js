/* ── AGED INVENTORY ── */
function renderAged(){
  const buckets={dead:[],slow:[],aging:[],active:[]};
  DATA.forEach(p=>{
    const s=stk(p);
    if(s!==null&&s>0&&p.agedBucket) buckets[p.agedBucket]=(buckets[p.agedBucket]||[]),buckets[p.agedBucket].push(p);
  });
  function agedVal(arr){return arr.reduce((a,p)=>a+(p.stock>0&&p.price?p.stock*p.price:0),0);}
  function agedTable(arr,label){
    if(!arr||!arr.length) return '<div class="empty">No items in this category</div>';
    const sorted=[...arr].sort((a,b)=>b.daysSinceLastSale-a.daysSinceLastSale);
    return '<div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Stock</th><th style="text-align:right">Value</th><th style="text-align:right">Days since last sale</th><th>Last sale</th></tr></thead><tbody>'+
      sorted.map(p=>{
        const val=p.stock*(p.price||0);
        const d=p.daysSinceLastSale;
        const dc=d>180?'color:var(--rd)':d>90?'color:var(--am)':d>30?'color:var(--am)':'';
        return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')">'+
          '<td class="mo">'+esc(p.sku)+'</td>'+
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
          '<td class="mu">'+esc(p.line)+'</td>'+
          '<td class="r stk">'+p.stock+'</td>'+
          '<td class="r" style="font-weight:600">'+fmtP(val)+'</td>'+
          '<td class="r" style="font-weight:700;'+dc+'">'+( d===999?'Before 2022':d)+'</td>'+
          '<td class="mu" style="font-size:11px">'+esc(p.lastSaleDate||'Never')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  const deadVal=agedVal(buckets.dead), slowVal=agedVal(buckets.slow), agingVal=agedVal(buckets.aging);
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:16px">'+
    '<div class="met rd"><div class="met-lbl">Dead stock (&gt;180d)</div><div class="met-val">'+buckets.dead.length+'</div><div class="met-sub">'+fmtK(deadVal)+' tied up</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Slow moving (90–180d)</div><div class="met-val">'+buckets.slow.length+'</div><div class="met-sub">'+fmtK(slowVal)+' tied up</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Aging (30–90d)</div><div class="met-val">'+buckets.aging.length+'</div><div class="met-sub">'+fmtK(agingVal)+' tied up</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Active (&lt;30d)</div><div class="met-val">'+buckets.active.length+'</div><div class="met-sub">moved recently</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="exp-section"><div class="exp-section-hd red">Dead stock — no sale in 180+ days ('+buckets.dead.length+' SKUs)</div><div class="tcard" style="margin-bottom:0">'+agedTable(buckets.dead)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd amber">Slow moving — 90–180 days ('+buckets.slow.length+' SKUs)</div><div class="tcard" style="margin-bottom:0">'+agedTable(buckets.slow)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd amber">Aging — 30–90 days ('+buckets.aging.length+' SKUs)</div><div class="tcard" style="margin-bottom:0">'+agedTable(buckets.aging)+'</div></div>';
}

/* ── SHRINKAGE TRACKER ── */
function renderShrinkage(){
  const items=DATA.filter(p=>Math.abs(p.shrinkage||0)>2&&(p.received||0)>10)
    .sort((a,b)=>Math.abs(b.shrinkageValue||0)-Math.abs(a.shrinkageValue||0));
  const totalLoss=items.filter(p=>p.shrinkage>0).reduce((a,p)=>a+(p.shrinkageValue||0),0);
  const totalOvercount=items.filter(p=>p.shrinkage<0).reduce((a,p)=>a+Math.abs(p.shrinkageValue||0),0);
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:16px">'+
    '<div class="met rd"><div class="met-lbl">Unaccounted loss</div><div class="met-val" style="font-size:18px">'+fmtP(totalLoss)+'</div><div class="met-sub">received &minus; sold &minus; pull-outs &minus; current</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Overcount / data gap</div><div class="met-val" style="font-size:18px">'+fmtP(totalOvercount)+'</div><div class="met-sub">current stock exceeds accounting</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">SKUs with discrepancy</div><div class="met-val">'+items.length+'</div><div class="met-sub">difference &gt;2 units</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="margin-bottom:12px;font-size:12px;color:var(--tx3)">Formula: Shrinkage = Received &minus; Sold &minus; Internal pull-outs &minus; Current stock. Positive = unaccounted loss. Negative = stock exceeds records (possible data entry gap).</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th style="text-align:right">Received</th><th style="text-align:right">Sold</th><th style="text-align:right">Pull-outs</th><th style="text-align:right">Current</th><th style="text-align:right">Shrinkage</th><th style="text-align:right">Value</th><th>Flag</th></tr></thead><tbody>'+
    (items.length?items.map(p=>{
      const sh=p.shrinkage||0;
      const flag=sh>0?'<span class="pill prd">Loss</span>':'<span class="pill pam">Overcount</span>';
      const rec=(p.received||0),s=(p.sold||0),po=rec-s-p.stock-sh,cur=p.stock;
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')">'+
        '<td class="mo">'+esc(p.sku)+'</td>'+
        '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
        '<td class="r mu">'+rec.toLocaleString()+'</td>'+
        '<td class="r mu">'+s.toLocaleString()+'</td>'+
        '<td class="r mu">'+Math.max(0,po).toLocaleString()+'</td>'+
        '<td class="r mu">'+cur.toLocaleString()+'</td>'+
        '<td class="r stk" style="color:'+(sh>0?'var(--rd)':'var(--am)')+'">'+( sh>0?'+':'')+sh+'</td>'+
        '<td class="r" style="font-weight:600">'+fmtP(p.shrinkageValue||0)+'</td>'+
        '<td>'+flag+'</td></tr>';
    }).join(''):'<tr><td colspan="9"><div class="empty">No significant discrepancies found</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>'+items.length+' SKUs with discrepancies &gt;2 units</span></div></div>';
}

/* ── CASH IN EXPIRING STOCK ── */
function renderCashExpiry(){
  const exp=CASH_EXPIRING||{};
  const totalAtRisk=(exp.lt30||0)+(exp.lt90||0)+(exp.lt180||0);
  const totalExpired=exp.expired||0;
  function expTable(items){
    if(!items||!items.length) return '<div class="empty">No items</div>';
    return '<div class="tscroll"><table><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th style="text-align:right">Days</th><th style="text-align:right">SOH</th><th style="text-align:right">Unit price</th><th style="text-align:right">Value at risk</th></tr></thead><tbody>'+
      items.map(i=>{
        const dc=i.days<0?'color:var(--rd);font-weight:700':i.days<=30?'color:var(--rd)':i.days<=92?'color:var(--am)':'';
        return '<tr><td>'+esc(i.name)+'</td><td class="mo mu">'+esc(i.batch||'—')+'</td>'+
          '<td style="font-size:11px">'+esc(i.expiry)+'</td>'+
          '<td class="r" style="'+dc+'">'+( i.days<0?Math.abs(i.days)+' ago':i.days)+'</td>'+
          '<td class="r mu">'+i.soh+'</td>'+
          '<td class="r mu" style="font-size:11px">'+fmtP(i.price)+'</td>'+
          '<td class="r" style="font-weight:700;color:'+(i.value>0?'var(--rd)':'var(--tx3)')+'">'+fmtP(i.value)+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  const byBucket={expired:[],lt30:[],lt90:[],lt180:[]};
  (EXPIRING_ITEMS||[]).forEach(i=>{ if(byBucket[i.bucket]) byBucket[i.bucket].push(i); });
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:16px">'+
    '<div class="met rd"><div class="met-lbl">Expired — write-off risk</div><div class="met-val" style="font-size:18px">'+fmtP(totalExpired)+'</div><div class="met-sub">stock past expiry date</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Expiring &lt;30 days</div><div class="met-val" style="font-size:18px">'+fmtP(exp.lt30||0)+'</div><div class="met-sub">urgent action needed</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Expiring 1–3 months</div><div class="met-val" style="font-size:18px">'+fmtP(exp.lt90||0)+'</div><div class="met-sub">monitor closely</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Expiring 3–6 months</div><div class="met-val" style="font-size:18px">'+fmtP(exp.lt180||0)+'</div><div class="met-sub">plan ahead</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="exp-section"><div class="exp-section-hd red">Expired ('+byBucket.expired.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+expTable(byBucket.expired)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd red">Expiring within 30 days ('+byBucket.lt30.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+expTable(byBucket.lt30)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd amber">Expiring 1–3 months ('+byBucket.lt90.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+expTable(byBucket.lt90)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd amber">Expiring 3–6 months ('+byBucket.lt180.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+expTable(byBucket.lt180)+'</div></div>';
}

/* ── BRANCH TRANSFER LOG ── */
function renderBranchTransfer(){
  const branches=['BGC','Vertis North','GH Mall'];
  const branchFilter=window._branchFilter||'all';
  let rows=BRANCH_TRANSFERS||[];
  if(branchFilter!=='all') rows=rows.filter(t=>t.branch===branchFilter);
  const stats={};
  branches.forEach(b=>{
    const br=BRANCH_TRANSFERS.filter(t=>t.branch===b);
    stats[b]={orders:br.length,qty:br.reduce((a,t)=>a+t.qty,0)};
  });
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    branches.map(b=>'<div class="met bl"><div class="met-lbl">'+b+'</div><div class="met-val">'+( stats[b]?stats[b].qty.toLocaleString():0)+'</div><div class="met-sub">'+(stats[b]?stats[b].orders:0)+' shipments (2025+)</div><div class="met-bar"></div></div>').join('')+
    '</div>'+
    '<div class="tabs" style="margin-bottom:12px">'+
    ['all',...branches].map(b=>'<div class="tab'+(branchFilter===b?' active':'')+'" onclick="window._branchFilter=\''+b+'\';renderBranchTransfer()">'+( b==='all'?'All branches':b)+'</div>').join('')+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>Branch</th><th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Qty</th><th>Batch</th><th>Expiry</th><th>Order #</th></tr></thead><tbody>'+
    (rows.length?rows.slice(0,200).map(t=>{
      const brc=t.branch==='BGC'?'pbl':t.branch==='Vertis North'?'pgr':'pam';
      return '<tr><td><span class="pill '+brc+'">'+esc(t.branch)+'</span></td>'+
        '<td class="mo">'+esc(t.sku)+'</td>'+
        '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">'+esc(t.name)+'</td>'+
        '<td class="mu">'+esc(t.line||'')+'</td>'+
        '<td class="r stk">'+t.qty+'</td>'+
        '<td class="mo mu">'+esc(t.batch||'—')+'</td>'+
        '<td style="font-size:11px">'+esc(t.expiry||'—')+'</td>'+
        '<td class="mo mu">'+esc(t.order||'—')+'</td></tr>';
    }).join(''):'<tr><td colspan="8"><div class="empty">No transfers found</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Showing '+Math.min(rows.length,200)+' of '+rows.length+' shipments to Remedy branches (2025+, newest first)</span></div></div>';
}

/* ── BRANCH EXPIRY WATCH ── */
function renderBranchExpiry(){
  const branches=['BGC','Vertis North','GH Mall'];
  $('content').innerHTML=
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:14px">Product Healthspan has shipped to each <b>Remedy</b> branch (2025+), sorted by earliest expiry — so each clinic can see what to use up first.</div>'+
    branches.map(branch=>{
      const items=(BRANCH_EXPIRY[branch]||[]);
      const now=new Date();
      const urgent=items.filter(i=>{const pm=i.expiry.match(/^(\d{1,2})\/(\d{4})$/);if(!pm)return false;return (new Date(+pm[2],+pm[1]-1,1)-now)/864e5<=92;}).length;
      return '<div class="exp-section"><div class="exp-section-hd '+(urgent>0?'red':'green')+'">'+branch+(urgent?' — '+urgent+' items expiring within 3 months':'')+'</div>'+
        (items.length?'<div class="tcard" style="margin-bottom:0"><div class="tscroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Batch</th><th>Expiry</th><th style="text-align:right">Days left</th><th style="text-align:right">Qty sent</th><th>Status</th></tr></thead><tbody>'+
        items.slice(0,30).map(i=>{
          const pm=i.expiry.match(/^(\d{1,2})\/(\d{4})$/);
          const expDate=pm?new Date(+pm[2],+pm[1]-1,1):null;
          const d=expDate?Math.round((expDate-now)/864e5):null;
          const c=d===null?'pgy':d<0?'prd':d<=31?'prd':d<=92?'pam':'pgr';
          const lbl=d===null?'No date':d<0?Math.abs(d)+'d ago expired':d+'d left';
          return '<tr><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(i.name)+'</td>'+
            '<td class="mo mu">'+esc(i.sku)+'</td>'+
            '<td class="mo mu">'+esc(i.batch||'—')+'</td>'+
            '<td style="font-size:11px">'+esc(i.expiry)+'</td>'+
            '<td class="r" style="font-weight:700;color:'+(d===null?'var(--tx3)':d<0?'var(--rd)':d<=92?'var(--am)':'var(--gr)')+'">'+( d===null?'—':d<0?Math.abs(d)+'d ago':d+'d')+'</td>'+
            '<td class="r mu">'+i.qty+'</td>'+
            '<td><span class="pill '+c+'">'+lbl+'</span></td></tr>';
        }).join('')+'</tbody></table></div></div>':
        '<div class="tcard" style="margin-bottom:0"><div class="empty">No transfers recorded for '+branch+'</div></div>');
    }).join('');
}

/* ── EXPORT ── */
/* ── FORECAST HELPERS (shared by planning views) ── */
function fcRate(p,k){
  const f=p.fcM;
  if(!f||!f.length) return p.velAdj!=null?p.velAdj:(p.velocity||0);
  return k<f.length?f[k]:f[f.length-1];
}
function unitsOverDays(p,days,mult){
  // Integrate the monthly forecast curve over the next `days` days
  let rem=days,total=0,d=new Date(),k=0;
  while(rem>0&&k<24){
    const y=d.getFullYear(),m=d.getMonth();
    const dim=new Date(y,m+1,0).getDate();
    const avail=k===0?dim-d.getDate()+1:dim;
    const take=Math.min(avail,rem);
    total+=fcRate(p,k)/dim*take;
    rem-=take;d=new Date(y,m+1,1);k++;
  }
  return total*(mult||1);
}
function simDaysToStockout(p,mult){
  const s=stk(p);
  if(s===null)return null;
  if(s<=0)return 0;
  let rem=s,days=0,d=new Date();
  for(let k=0;k<18;k++){
    const y=d.getFullYear(),m=d.getMonth();
    const dim=new Date(y,m+1,0).getDate();
    const daily=fcRate(p,k)*(mult||1)/dim;
    const dRem=k===0?dim-d.getDate()+1:dim;
    if(daily>0&&rem<=daily*dRem){return days+Math.ceil(rem/daily);}
    rem-=daily*dRem;days+=dRem;d=new Date(y,m+1,1);
  }
  return null;
}
function trendBadge(p){
  if(p.trendFlag==='up')return '<span class="pill prd" title="Last 3mo vs prior 3mo">\u25b2 +'+Math.round((p.trend-1)*100)+'%</span>';
  if(p.trendFlag==='down')return '<span class="pill pbl" title="Last 3mo vs prior 3mo">\u25bc '+Math.round((p.trend-1)*100)+'%</span>';
  return '<span class="pill pgy">flat</span>';
}
function soPill(d){
  if(d===null)return '<span class="pill pgr">&gt;12 mo</span>';
  if(d===0)return '<span class="pill prd">Out now</span>';
  if(d<=30)return '<span class="pill prd">'+d+'d</span>';
  if(d<=60)return '<span class="pill pam">'+d+'d</span>';
  return '<span class="pill pgr">'+d+'d</span>';
}
function soDateFmt(iso){
  if(!iso)return '—';
  return new Date(iso).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});
}
function reorderRows(lead,cover,safety,mult){
  // Suggested PO per SKU: demand over lead time + coverage window + safety buffer, minus stock on hand
  mult=mult||1;
  const horizon=lead+cover*30.44+safety;
  const out=[];
  for(const p of DATA){
    const s=stk(p);
    if(s===null)continue;
    if((p.velAdj||0)<=0&&(p.velocity||0)<=0)continue;
    const need=unitsOverDays(p,horizon,mult);
    const qty=Math.max(0,Math.ceil(need-Math.max(0,s)));
    if(qty<=0)continue;
    const dLead=unitsOverDays(p,lead,mult);
    const runsOutInLead=s<=dLead;
    out.push({p,qty,cost:qty*(p.price||0),runsOutInLead,dLead:Math.round(dLead)});
  }
  out.sort((a,b)=>(a.p.daysToStockout??9999)-(b.p.daysToStockout??9999)||b.cost-a.cost);
  return out;
}

/* ── STOCKOUT FORECAST ── */
function renderForecast(){
  const f=window._fcFilter||'all';
  const cands=DATA.filter(p=>((p.velAdj||0)>0||(p.velocity||0)>0)&&stk(p)!==null);
  const so30=cands.filter(p=>p.daysToStockout!=null&&p.daysToStockout>0&&p.daysToStockout<=30);
  const so60=cands.filter(p=>p.daysToStockout!=null&&p.daysToStockout>30&&p.daysToStockout<=60);
  const acc=cands.filter(p=>p.trendFlag==='up');
  const dec=cands.filter(p=>p.trendFlag==='down');
  const seasonalN=cands.filter(p=>p.seasonal).length;
  let rows=cands.slice();
  if(f==='so30')rows=so30;
  else if(f==='so60')rows=so60;
  else if(f==='up')rows=acc;
  else if(f==='down')rows=dec;
  rows.sort((a,b)=>(a.daysToStockout??9999)-(b.daysToStockout??9999));
  const tabs=[['all','All ('+cands.length+')'],['so30','\u226430 days ('+so30.length+')'],['so60','31\u201360 days ('+so60.length+')'],['up','Accelerating ('+acc.length+')'],['down','Decelerating ('+dec.length+')']];
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Stockout &le;30 days</div><div class="met-val">'+so30.length+'</div><div class="met-sub">order now</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Stockout 31–60 days</div><div class="met-val">'+so60.length+'</div><div class="met-sub">order soon</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Accelerating</div><div class="met-val">'+acc.length+'</div><div class="met-sub">demand up &ge;15% (3mo vs prior 3mo)</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Decelerating</div><div class="met-val">'+dec.length+'</div><div class="met-sub">demand down &ge;15%</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Seasonality applied</div><div class="met-val">'+seasonalN+'</div><div class="met-sub">SKUs with month-of-year weighting</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tabs" style="margin-bottom:12px">'+tabs.map(([k,l])=>'<div class="tab'+(f===k?' active':'')+'" onclick="window._fcFilter=\''+k+'\';renderForecast()">'+l+'</div>').join('')+'</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>SKU</th><th>Product</th><th style="text-align:right">Stock</th><th style="text-align:right">Fcst /mo</th><th>Trend</th><th>Stockout in</th><th>Projected date</th><th>Basis</th></tr></thead><tbody>'+
    (rows.length?rows.slice(0,250).map(p=>{
      const s=stk(p);
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(p.sku)+'</td>'+
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
      '<td class="r stk">'+(s??'—')+'</td>'+
      '<td class="r">'+(p.velAdj!=null?p.velAdj:(p.velocity||0))+'</td>'+
      '<td>'+trendBadge(p)+'</td>'+
      '<td>'+soPill(p.daysToStockout)+'</td>'+
      '<td style="font-size:11px">'+soDateFmt(p.stockoutDate)+'</td>'+
      '<td style="font-size:10px;color:var(--tx3)">'+(p.seasonal?'seasonal + trend':'trend only')+'</td></tr>';
    }).join(''):'<tr><td colspan="8"><div class="empty">No SKUs match this filter</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Forecast = deseasonalized 6-mo base &times; month-of-year index &times; trend growth &middot; stockout simulated month by month</span></div></div>';
  // campaign banner: promos that will bend these numbers (async, non-blocking)
  (async()=>{try{
    await loadCampaigns();
    const today=new Date().toISOString().slice(0,10);
    const live=(CAMPAIGNS||[]).filter(c=>c.to_date>=today);
    const host=$('content');
    if(live.length&&host&&currentView==='forecast'){
      const d=document.createElement('div');
      d.className='panel';
      d.style.cssText='padding:10px 14px;margin-bottom:14px;border-left:3px solid var(--am);font-size:12px';
      d.innerHTML='<b>Campaigns ahead:</b> '+live.map(c=>esc(c.name)+' ('+esc(c.from_date)+'→'+esc(c.to_date)+(c.uplift_pct?', ~+'+c.uplift_pct+'%':'')+(c.skus?' on '+esc(c.skus):'')).join(' · ')+
        ' — expect demand above these baselines. <a href="#" onclick="showView(\'campaigns\',null);return false" style="color:var(--ac)">Calendar</a>';
      host.insertBefore(d,host.firstChild);
    }
  }catch(e){}})();
}

/* ── REORDER PLAN + BUDGET ── */
function renderReorderPlan(){
  const rows=reorderRows(PLAN.lead,PLAN.cover,PLAN.safety,1);
  const totCost=rows.reduce((a,r)=>a+r.cost,0);
  const totUnits=rows.reduce((a,r)=>a+r.qty,0);
  const urgent=rows.filter(r=>r.runsOutInLead);
  const aCost=rows.filter(r=>r.p.abc==='A').reduce((a,r)=>a+r.cost,0);
  // Budget forecast: purchases needed to cover next-quarter demand
  let q90=0;
  for(const p of DATA){
    const s=stk(p);
    if(s===null||!(p.price>0))continue;
    if((p.velAdj||0)<=0&&(p.velocity||0)<=0)continue;
    q90+=Math.max(0,unitsOverDays(p,90+PLAN.safety,1)-Math.max(0,s))*p.price;
  }
  const inp=(id,val,lbl,min,max,step,unit)=>'<div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--tx3);font-weight:500">'+lbl+'</label><div style="display:flex;align-items:center;gap:6px"><input type="number" id="'+id+'" value="'+val+'" min="'+min+'" max="'+max+'" step="'+step+'" style="width:70px;padding:5px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--sf);color:var(--tx1);font-size:12px" onchange="updatePlan()"><span style="font-size:10.5px;color:var(--tx3)">'+unit+'</span></div></div>';
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end">'+
    inp('pl-lead',PLAN.lead,'Supplier lead time',7,180,1,'days')+
    inp('pl-cover',PLAN.cover,'Coverage target',1,12,0.5,'months')+
    inp('pl-safety',PLAN.safety,'Safety stock',0,60,1,'days of demand')+
    '<button class="btn" onclick="exportReorderCSV()" style="margin-left:auto"><svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export PO draft (CSV)</button>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">SKUs to order</div><div class="met-val">'+rows.length+'</div><div class="met-sub">'+urgent.length+' run out within lead time</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Total units</div><div class="met-val">'+totUnits.toLocaleString()+'</div><div class="met-sub">suggested draft quantities</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Draft PO value</div><div class="met-val" style="font-size:17px">'+fmtK(totCost)+'</div><div class="met-sub">'+fmtK(aCost)+' on A-items</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Next-quarter budget</div><div class="met-val" style="font-size:17px">'+fmtK(q90)+'</div><div class="met-sub">projected purchasing spend, 90 days</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>SKU</th><th>Product</th><th>ABC</th><th style="text-align:right">Stock</th><th style="text-align:right">Fcst /mo</th><th>Stockout in</th><th style="text-align:right">Order qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Est. cost</th></tr></thead><tbody>'+
    (rows.length?rows.slice(0,250).map(r=>{
      const p=r.p;
      const abcC=p.abc==='A'?'prd':p.abc==='B'?'pam':'pgy';
      return '<tr'+(r.runsOutInLead?' style="background:var(--rd-bg)"':'')+'><td class="mo">'+esc(p.sku)+'</td>'+
      '<td style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
      '<td><span class="pill '+abcC+'">'+(p.abc||'—')+'</span></td>'+
      '<td class="r stk">'+(stk(p)??'—')+'</td>'+
      '<td class="r">'+(p.velAdj!=null?p.velAdj:(p.velocity||0))+'</td>'+
      '<td>'+soPill(p.daysToStockout)+'</td>'+
      '<td class="r" style="font-weight:700;color:var(--ac)">'+r.qty.toLocaleString()+'</td>'+
      '<td class="r mu" style="font-size:11px">'+fmtP(p.price)+'</td>'+
      '<td class="r" style="font-weight:600">'+fmtP(r.cost)+'</td></tr>';
    }).join(''):'<tr><td colspan="9"><div class="empty">Nothing needs reordering under these settings</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Order qty = forecast demand over lead time + '+PLAN.cover+' months coverage + '+PLAN.safety+'d safety, minus stock on hand &middot; highlighted rows run out before the shipment arrives</span></div></div>';
}
function updatePlan(){
  PLAN.lead=Math.max(1,parseInt($('pl-lead').value)||30);
  PLAN.cover=Math.max(0.5,parseFloat($('pl-cover').value)||3);
  PLAN.safety=Math.max(0,parseInt($('pl-safety').value)||0);
  try{localStorage.setItem('hs_plan',JSON.stringify(PLAN));}catch(e){}
  renderReorderPlan();
}
function exportReorderCSV(){
  const rows=reorderRows(PLAN.lead,PLAN.cover,PLAN.safety,1);
  const h=['SKU','Product','Line','ABC','Stock on hand','Forecast units/mo','Days to stockout','Projected stockout date','Suggested order qty','Unit price (PHP)','Est cost (PHP)','Runs out within lead time'];
  const csv=rows.map(r=>{const p=r.p;return[p.sku,p.name,p.line,p.abc||'',stk(p)??'',p.velAdj!=null?p.velAdj:(p.velocity||0),p.daysToStockout??'>365',p.stockoutDate||'',r.qty,p.price??'',Math.round(r.cost),r.runsOutInLead?'YES':''].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');});
  const meta='"Healthspan Global Inc. - Draft reorder plan","Generated '+new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila'})+'","Lead time: '+PLAN.lead+'d","Coverage: '+PLAN.cover+'mo","Safety: '+PLAN.safety+'d"';
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent([meta,h.join(','),...csv].join('\n'));
  a.download='healthspan_reorder_plan_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

/* ── REORDER POINT + SAFETY STOCK ── */
function renderReorderPoint(){
  const cands=DATA.filter(p=>stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0));
  const rows=cands.map(p=>({p,c:ropCalc(p)}));
  const below=rows.filter(r=>r.c.below);
  const aBelow=below.filter(r=>r.p.abc==='A');
  const totSafety=rows.reduce((a,r)=>a+r.c.safety,0);
  rows.sort((a,b)=>(a.c.below===b.c.below?((a.c.dts??1e9)-(b.c.dts??1e9)):(a.c.below?-1:1)));
  const z=zFor(PLAN.service);
  const lines=[...new Set(DATA.map(p=>p.line).filter(Boolean))].sort();
  const leadEditor=window._leadEdit?
    '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--bd)"><div style="font-size:10px;color:var(--tx3);font-weight:600;letter-spacing:.04em;margin-bottom:9px">SUPPLIER LEAD TIME BY PRODUCT LINE (days)</div><div style="display:flex;flex-wrap:wrap;gap:12px">'+
    lines.map(l=>'<div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--tx3);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(l)+'">'+esc(l)+'</label><input type="number" min="1" max="365" value="'+leadFor(l)+'" data-line="'+esc(l)+'" onchange="setLead(this.dataset.line,this.value)" style="width:66px;padding:5px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--sf);color:var(--tx1);font-size:12px"></div>').join('')+
    '</div></div>':'';
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end">'+
    '<div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--tx3);font-weight:500">Service level</label><div style="display:flex;align-items:center;gap:6px"><input type="number" id="rop-service" value="'+PLAN.service+'" min="50" max="99.9" step="0.5" onchange="updateService()" style="width:70px;padding:5px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--sf);color:var(--tx1);font-size:12px"><span style="font-size:10.5px;color:var(--tx3)">% &middot; z='+z.toFixed(2)+'</span></div></div>'+
    '<button class="btn" onclick="toggleLeadEdit()"><svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> '+(window._leadEdit?'Hide lead times':'Edit lead times')+'</button>'+
    '<button class="btn" onclick="exportROPCSV()" style="margin-left:auto"><svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export (CSV)</button>'+
    leadEditor+
    '</div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Below reorder point</div><div class="met-val">'+below.length+'</div><div class="met-sub">order now</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">A-items below ROP</div><div class="met-val">'+aBelow.length+'</div><div class="met-sub">high-value, prioritise</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Total safety stock</div><div class="met-val">'+Math.round(totSafety).toLocaleString()+'</div><div class="met-sub">buffer units across '+rows.length+' SKUs</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Service level</div><div class="met-val">'+PLAN.service+'%</div><div class="met-sub">z = '+z.toFixed(2)+' &middot; per-line lead times</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Lead</th><th>Variability</th><th style="text-align:right">Stock</th><th style="text-align:right">Fcst /mo</th><th style="text-align:right">Safety</th><th style="text-align:right">Reorder pt</th><th>Stock out in</th><th>Status</th></tr></thead><tbody>'+
    (rows.length?rows.slice(0,300).map(r=>{
      const p=r.p,c=r.c;
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer'+(c.below?';background:var(--rd-bg)':'')+'">'+
      '<td class="mo">'+esc(p.sku)+'</td>'+
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
      '<td class="mu" style="max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(p.line||'')+'</td>'+
      '<td class="r mu">'+c.lead+'d</td>'+
      '<td>'+cvBadge(p)+'</td>'+
      '<td class="r stk">'+(c.s!=null?c.s.toLocaleString():'—')+'</td>'+
      '<td class="r">'+(p.velAdj!=null?p.velAdj:(p.velocity||0))+'</td>'+
      '<td class="r" style="color:var(--pu);font-weight:600">'+c.safety.toLocaleString()+'</td>'+
      '<td class="r" style="font-weight:700;color:var(--ac)">'+c.rop.toLocaleString()+'</td>'+
      '<td>'+soPill(c.dts)+'</td>'+
      '<td>'+(c.below?'<span class="pill prd">Order now</span>':'<span class="pill pgr">OK</span>')+'</td></tr>';
    }).join(''):'<tr><td colspan="11"><div class="empty">No SKUs with demand history</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Reorder point = (forecast demand/mo &times; lead&nbsp;months) + safety stock &middot; safety = z('+PLAN.service+'%) &times; &sigma;<sub>demand</sub> &times; &radic;lead &middot; lumpier demand (higher CV) earns a bigger buffer</span></div></div>';
}
function updateService(){const v=parseFloat($('rop-service').value);if(!isNaN(v))PLAN.service=Math.min(99.9,Math.max(50,v));try{localStorage.setItem('hs_plan',JSON.stringify(PLAN));}catch(e){}refreshSidebar();renderReorderPoint();}
function setLead(line,val){const v=parseInt(val);if(!isNaN(v)&&v>0)LEADMAP[line]=Math.min(365,v);try{localStorage.setItem('hs_leadmap',JSON.stringify(LEADMAP));}catch(e){}refreshSidebar();renderReorderPoint();}
function toggleLeadEdit(){window._leadEdit=!window._leadEdit;renderReorderPoint();}
function exportROPCSV(){
  const rows=DATA.filter(p=>stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0)).map(p=>({p,c:ropCalc(p)}));
  rows.sort((a,b)=>(a.c.below===b.c.below?((a.c.dts??1e9)-(b.c.dts??1e9)):(a.c.below?-1:1)));
  const h=['SKU','Product','Line','ABC','Lead time (d)','Demand variability','CV','Stock on hand','Forecast units/mo','Safety stock','Reorder point','Days to stockout','Below reorder point'];
  const csv=rows.map(r=>{const p=r.p,c=r.c;return[p.sku,p.name,p.line,p.abc||'',c.lead,p.demandClass||'',p.cv??'',c.s??'',p.velAdj!=null?p.velAdj:(p.velocity||0),c.safety,c.rop,c.dts??'>365',c.below?'YES':''].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');});
  const meta='"Healthspan Global Inc. - Reorder points & safety stock","Generated '+new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila'})+'","Service level: '+PLAN.service+'% (z='+zFor(PLAN.service).toFixed(2)+')"';
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent([meta,h.join(','),...csv].join('\n'));
  a.download='healthspan_reorder_points_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

/* ── DEMAND VARIABILITY (CV) ── */
function renderVariability(){
  const f=window._cvFilter||'all';
  const scored=DATA.filter(p=>((p.velAdj||0)>0||(p.velocity||0)>0||(p.sold||0)>0));
  const cls=c=>scored.filter(p=>p.demandClass===c);
  const steady=cls('steady'),variable=cls('variable'),lumpy=cls('lumpy'),insuf=cls('insufficient');
  let rows=scored.slice();
  if(f==='steady')rows=steady;else if(f==='variable')rows=variable;else if(f==='lumpy')rows=lumpy;else if(f==='insufficient')rows=insuf;
  rows.sort((a,b)=>{const av=a.cv==null?-1:a.cv,bv=b.cv==null?-1:b.cv;return bv-av;});
  const tabs=[['all','All ('+scored.length+')'],['steady','Steady ('+steady.length+')'],['variable','Variable ('+variable.length+')'],['lumpy','Lumpy ('+lumpy.length+')'],['insufficient','Insufficient ('+insuf.length+')']];
  const trust=p=>{
    if(p.demandClass==='insufficient')return '<span style="color:var(--tx3)">Too little history — judge manually</span>';
    if(p.demandClass==='steady')return '<span style="color:var(--gr)">High — safe to automate</span>';
    if(p.demandClass==='variable')return '<span style="color:var(--am)">Moderate — review before ordering</span>';
    return '<span style="color:var(--rd)">Low — needs human judgment</span>';
  };
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Steady movers</div><div class="met-val">'+steady.length+'</div><div class="met-sub">CV &lt; 0.5 &middot; forecasts reliable</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Variable</div><div class="met-val">'+variable.length+'</div><div class="met-sub">CV 0.5–1.0 &middot; review orders</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Lumpy / spiky</div><div class="met-val">'+lumpy.length+'</div><div class="met-sub">CV &gt; 1.0 or intermittent</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Insufficient history</div><div class="met-val">'+insuf.length+'</div><div class="met-sub">&lt; 3 months of sales</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tabs" style="margin-bottom:12px">'+tabs.map(([k,l])=>'<div class="tab'+(f===k?' active':'')+'" onclick="window._cvFilter=\''+k+'\';renderVariability()">'+l+'</div>').join('')+'</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Months</th><th style="text-align:right">Avg /mo</th><th style="text-align:right">Std dev</th><th style="text-align:right">CV</th><th>Class</th><th>Forecast trust</th></tr></thead><tbody>'+
    (rows.length?rows.slice(0,300).map(p=>{
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(p.sku)+'</td>'+
      '<td style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
      '<td class="mu" style="max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(p.line||'')+'</td>'+
      '<td class="r mu">'+(p.demandN!=null?p.demandN:'—')+'</td>'+
      '<td class="r">'+(p.demandMean!=null?p.demandMean:'—')+'</td>'+
      '<td class="r mu">'+(p.demandStd!=null?p.demandStd:'—')+'</td>'+
      '<td class="r" style="font-weight:600">'+(p.cv!=null?p.cv.toFixed(2):'—')+'</td>'+
      '<td>'+cvBadge(p)+'</td>'+
      '<td style="font-size:11px">'+trust(p)+'</td></tr>';
    }).join(''):'<tr><td colspan="9"><div class="empty">No SKUs match this filter</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>CV = coefficient of variation (std dev &divide; mean of monthly demand) &middot; low CV = predictable, high CV = erratic &middot; drives safety-stock size on the Reorder point view</span></div></div>';
}

/* ── ABC ANALYSIS ── */
function renderABC(){
  const ranked=DATA.filter(p=>p.abc).slice().sort((a,b)=>(b.abcShare||0)-(a.abcShare||0));
  const cls=c=>ranked.filter(p=>p.abc===c);
  const A=cls('A'),B=cls('B'),C=cls('C');
  const shr=arr=>arr.reduce((a,p)=>a+(p.abcShare||0),0);
  let cum=0;
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">A-items</div><div class="met-val">'+A.length+'</div><div class="met-sub">'+Math.round(shr(A))+'% of movement value &middot; count weekly, prime bins</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">B-items</div><div class="met-val">'+B.length+'</div><div class="met-sub">'+Math.round(shr(B))+'% of movement value &middot; count monthly</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">C-items</div><div class="met-val">'+C.length+'</div><div class="met-sub">'+Math.round(shr(C))+'% of movement value &middot; count quarterly</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>#</th><th>Class</th><th>SKU</th><th>Product</th><th>Line</th><th>Bin</th><th style="text-align:right">Fcst /mo</th><th style="text-align:right">Unit price</th><th style="text-align:right">Share</th><th style="text-align:right">Cumulative</th></tr></thead><tbody>'+
    ranked.slice(0,250).map((p,i)=>{
      cum+=p.abcShare||0;
      const abcC=p.abc==='A'?'prd':p.abc==='B'?'pam':'pgy';
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mu">'+(i+1)+'</td>'+
      '<td><span class="pill '+abcC+'">'+p.abc+'</span></td>'+
      '<td class="mo">'+esc(p.sku)+'</td>'+
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
      '<td class="mu">'+esc(p.line||'')+'</td>'+
      '<td class="mo mu">'+esc(p.bin||'—')+'</td>'+
      '<td class="r">'+(p.velAdj!=null?p.velAdj:(p.velocity||0))+'</td>'+
      '<td class="r mu" style="font-size:11px">'+fmtP(p.price)+'</td>'+
      '<td class="r">'+(p.abcShare||0).toFixed(1)+'%</td>'+
      '<td class="r mu">'+Math.min(100,cum).toFixed(1)+'%</td></tr>';
    }).join('')+
    '</tbody></table></div><div class="tfooter"><span>Pareto classification by 6-month consumption value (units moved &times; unit price) &middot; A &le;80% cumulative, B &le;95%, C remainder</span></div></div>';
}

/* ── WRITE-OFF FORECAST (expiry vs demand collision) ── */
function collisionRows(mult){
  mult=mult||1;
  return (COLLISIONS||[]).map(c=>{
    const sellable=Math.max(0,c.daily*mult*c.daysToExpiry-c.stockAhead);
    const projSold=Math.min(c.soh,sellable);
    const projExpired=Math.round(c.soh-projSold);
    return Object.assign({},c,{projExpired,writeOff:Math.round(projExpired*(c.price||0))});
  }).filter(c=>c.projExpired>0).sort((a,b)=>b.writeOff-a.writeOff||b.projExpired-a.projExpired);
}
function renderWriteoff(){
  const rows=collisionRows(1);
  const totVal=rows.reduce((a,c)=>a+c.writeOff,0);
  const totUnits=rows.reduce((a,c)=>a+c.projExpired,0);
  const in90=rows.filter(c=>c.daysToExpiry<=92);
  const in90Val=in90.reduce((a,c)=>a+c.writeOff,0);
  const top=rows.find(c=>c.writeOff>0);
  const headline=top?('At current pace, <b>'+top.projExpired.toLocaleString()+' units</b> of '+esc(top.name)+' (batch '+esc(top.batch||'?')+') will expire unsold — <b style="color:var(--rd)">'+fmtP(top.writeOff)+'</b> write-off risk. '+rows.length+' batches at risk in total.'):'No projected write-offs at current sales pace.';
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px;border-left:3px solid var(--rd)"><div style="font-size:12.5px;line-height:1.5;color:var(--tx2)">'+headline+'</div></div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Projected write-off</div><div class="met-val" style="font-size:17px">'+fmtK(totVal)+'</div><div class="met-sub">'+totUnits.toLocaleString()+' units across '+rows.length+' batches</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Within 3 months</div><div class="met-val" style="font-size:17px">'+fmtK(in90Val)+'</div><div class="met-sub">'+in90.length+' batches — act now</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Levers</div><div class="met-val" style="font-size:13px;line-height:1.4">Promo / transfer / return</div><div class="met-sub">push to branches or run clinic promos</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>Product</th><th>Batch</th><th>Expiry</th><th style="text-align:right">Days left</th><th style="text-align:right">SOH</th><th style="text-align:right">Pace /day</th><th style="text-align:right">Will sell</th><th style="text-align:right">Will expire</th><th style="text-align:right">Write-off</th></tr></thead><tbody>'+
    (rows.length?rows.slice(0,150).map(c=>{
      const sold=c.soh-c.projExpired;
      const dc=c.daysToExpiry<=31?'color:var(--rd);font-weight:600':c.daysToExpiry<=92?'color:var(--am)':'';
      return '<tr><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis"><span style="font-weight:500">'+esc(c.name)+'</span><div style="font-size:10px;color:var(--tx3);font-family:monospace">'+esc(c.sku)+'</div></td>'+
      '<td class="mo mu">'+esc(c.batch||'—')+'</td>'+
      '<td style="font-size:11px">'+esc(c.expiry)+'</td>'+
      '<td class="r" style="'+dc+'">'+c.daysToExpiry+'</td>'+
      '<td class="r stk">'+c.soh.toLocaleString()+'</td>'+
      '<td class="r mu">'+c.daily+'</td>'+
      '<td class="r" style="color:var(--gr)">'+Math.round(sold).toLocaleString()+'</td>'+
      '<td class="r" style="font-weight:600;color:var(--rd)">'+c.projExpired.toLocaleString()+'</td>'+
      '<td class="r" style="font-weight:700;color:var(--rd)">'+fmtP(c.writeOff)+'</td></tr>';
    }).join(''):'<tr><td colspan="9"><div class="empty">Current velocity clears all batches before expiry</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>FEFO assumed: demand consumes earliest-expiring batches first &middot; pace = seasonality/trend-adjusted daily velocity</span></div></div>';
}

/* ── WHAT-IF SIMULATOR ── */
function renderWhatIf(){
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px">'+
    '<div style="display:flex;flex-direction:column;gap:16px">'+
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:5px"><span>Demand change</span><span id="wi-mult-lbl" style="font-weight:700;color:var(--ac)">+0%</span></div>'+
    '<input type="range" id="wi-mult" min="-50" max="100" step="5" value="'+Math.round((WHATIF.mult-1)*100)+'" style="width:100%" oninput="updateWhatIf()"></div>'+
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:5px"><span>Next shipment delayed by</span><span id="wi-delay-lbl" style="font-weight:700;color:var(--ac)">0 weeks</span></div>'+
    '<input type="range" id="wi-delay" min="0" max="42" step="7" value="'+WHATIF.delay+'" style="width:100%" oninput="updateWhatIf()"></div>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="wi-metrics"></div>'+
    '<div class="g2">'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Stockouts before shipment arrives</div><div class="alist" id="wi-solist"></div></div>'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>Biggest write-off changes</div><div class="alist" id="wi-wolist"></div></div>'+
    '</div>';
  updateWhatIf();
}
function updateWhatIf(){
  const multEl=$('wi-mult'),delayEl=$('wi-delay');
  if(!multEl)return;
  const pct=parseInt(multEl.value)||0;
  WHATIF.mult=1+pct/100;
  WHATIF.delay=parseInt(delayEl.value)||0;
  $('wi-mult-lbl').textContent=(pct>=0?'+':'')+pct+'%';
  $('wi-delay-lbl').textContent=WHATIF.delay===0?'0 weeks':(WHATIF.delay/7)+' week'+(WHATIF.delay>7?'s':'');
  const mult=WHATIF.mult;
  const arrival=PLAN.lead+WHATIF.delay;
  const cands=DATA.filter(p=>((p.velAdj||0)>0||(p.velocity||0)>0)&&stk(p)!==null);
  const base30=cands.filter(p=>{const d=simDaysToStockout(p,1);return d!=null&&d<=30;}).length;
  const scen=cands.map(p=>({p,d:simDaysToStockout(p,mult)}));
  const scen30=scen.filter(x=>x.d!=null&&x.d<=30).length;
  const gap=scen.filter(x=>x.d!=null&&x.d<=arrival&&stk(x.p)>0).sort((a,b)=>a.d-b.d);
  const woBaseRows=collisionRows(1);
  const woBase=woBaseRows.reduce((a,c)=>a+c.writeOff,0);
  const woRows=collisionRows(mult);
  const woScen=woRows.reduce((a,c)=>a+c.writeOff,0);
  let bud=0;
  for(const p of DATA){
    const s=stk(p);
    if(s===null||!(p.price>0))continue;
    if((p.velAdj||0)<=0&&(p.velocity||0)<=0)continue;
    bud+=Math.max(0,unitsOverDays(p,90+PLAN.safety,mult)-Math.max(0,s))*p.price;
  }
  const deltaN=(a,b)=>{const d=a-b;if(d===0)return '<span style="color:var(--tx3)">no change vs today</span>';return '<span style="color:'+(d>0?'var(--rd)':'var(--gr)')+'">'+(d>0?'+':'')+d.toLocaleString()+' vs today</span>';};
  const deltaV=(a,b)=>{const d=a-b;if(Math.abs(d)<1000)return '<span style="color:var(--tx3)">no change vs today</span>';return '<span style="color:'+(d>0?'var(--rd)':'var(--gr)')+'">'+(d>0?'+':'\u2212')+fmtK(Math.abs(d))+' vs today</span>';};
  $('wi-metrics').innerHTML=
    '<div class="met rd"><div class="met-lbl">Stockouts &le;30d</div><div class="met-val">'+scen30+'</div><div class="met-sub">'+deltaN(scen30,base30)+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Gap before shipment</div><div class="met-val">'+gap.length+'</div><div class="met-sub">SKUs empty before day '+arrival+' arrival</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Projected write-off</div><div class="met-val" style="font-size:17px">'+fmtK(woScen)+'</div><div class="met-sub">'+deltaV(woScen,woBase)+'</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Quarter budget</div><div class="met-val" style="font-size:17px">'+fmtK(bud)+'</div><div class="met-sub">purchasing spend at this demand</div><div class="met-bar"></div></div>';
  $('wi-solist').innerHTML=gap.length?gap.slice(0,8).map(x=>
    '<div class="arow" onclick="openDrawer(\''+esc(x.p.sku)+'\')"><div class="adot rd"></div><div class="aname">'+esc(x.p.name)+'</div><div class="ameta">day '+x.d+'</div></div>'
  ).join(''):'<div class="empty">No stockouts before shipment arrival</div>';
  const woBaseMap={};
  woBaseRows.forEach(c=>{woBaseMap[c.sku+'|'+c.batch]=c.writeOff;});
  const changes=woRows.map(c=>({c,d:c.writeOff-(woBaseMap[c.sku+'|'+c.batch]||0)})).filter(x=>Math.abs(x.d)>1000).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
  $('wi-wolist').innerHTML=changes.length?changes.slice(0,8).map(x=>
    '<div class="arow"><div class="adot '+(x.d>0?'rd':'gr')+'"></div><div class="aname">'+esc(x.c.name)+' <span style="color:var(--tx3);font-size:9px">'+esc(x.c.batch||'')+'</span></div><div class="ameta" style="color:'+(x.d>0?'var(--rd)':'var(--gr)')+'">'+(x.d>0?'+':'\u2212')+fmtK(Math.abs(x.d))+'</div></div>'
  ).join(''):'<div class="empty">Write-off exposure unchanged in this scenario</div>';
}

/* ── SIMULATOR: PROMO / MARKDOWN RESCUE ── */
function renderPromoSim(){
  $('content').innerHTML=
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-direction:column;gap:16px">'+
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:5px"><span>Promo velocity lift</span><span id="pr-lift-lbl" style="font-weight:700;color:var(--ac)">+30%</span></div>'+
    '<input type="range" id="pr-lift" min="0" max="150" step="5" value="'+SIMPROMO.lift+'" style="width:100%" oninput="updatePromoSim()"></div>'+
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:5px"><span>Discount offered</span><span id="pr-disc-lbl" style="font-weight:700;color:var(--ac)">20%</span></div>'+
    '<input type="range" id="pr-disc" min="0" max="60" step="5" value="'+SIMPROMO.disc+'" style="width:100%" oninput="updatePromoSim()"></div>'+
    '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px" id="pr-metrics"></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th style="text-align:right">To expiry</th><th style="text-align:right">SOH</th><th style="text-align:right">Expire now</th><th style="text-align:right">With promo</th><th style="text-align:right">Rescued</th><th style="text-align:right">Write-off saved</th><th style="text-align:right">Discount cost</th><th style="text-align:right">Net</th></tr></thead><tbody id="pr-tbody"></tbody></table></div><div class="tfooter"><span>Promo lift raises sell-through on at-risk batches &middot; discount cost = discount &times; unit price &times; units sold during promo &middot; net = write-off saved &minus; discount cost</span></div></div>';
  updatePromoSim();
}
function updatePromoSim(){
  const liftEl=$('pr-lift'); if(!liftEl)return;
  SIMPROMO.lift=parseInt(liftEl.value)||0;
  SIMPROMO.disc=parseInt($('pr-disc').value)||0;
  $('pr-lift-lbl').textContent='+'+SIMPROMO.lift+'%';
  $('pr-disc-lbl').textContent=SIMPROMO.disc+'%';
  const mult=1+SIMPROMO.lift/100;
  const base=collisionRows(1), promo=collisionRows(mult);
  const pMap={}; promo.forEach(c=>pMap[c.sku+'|'+c.batch]=c);
  const rows=base.map(b=>{
    const p=pMap[b.sku+'|'+b.batch];
    const promoExpired=p?p.projExpired:0, promoWO=p?p.writeOff:0;
    const rescued=Math.max(0,b.projExpired-promoExpired);
    const woSaved=Math.max(0,b.writeOff-promoWO);
    const soldUnderPromo=Math.max(0,b.soh-promoExpired);
    const discCost=Math.round(SIMPROMO.disc/100*(b.price||0)*soldUnderPromo);
    return {b,promoExpired,rescued,woSaved,discCost,net:woSaved-discCost};
  }).sort((a,b)=>b.woSaved-a.woSaved);
  const totWO=rows.reduce((a,r)=>a+r.woSaved,0), totDisc=rows.reduce((a,r)=>a+r.discCost,0), totNet=totWO-totDisc;
  const rescuedBatches=rows.filter(r=>r.rescued>0).length;
  $('pr-metrics').innerHTML=
    '<div class="met gr"><div class="met-lbl">Write-off avoided</div><div class="met-val" style="font-size:17px">'+fmtK(totWO)+'</div><div class="met-sub">value kept from expiring</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Discount given up</div><div class="met-val" style="font-size:17px">'+fmtK(totDisc)+'</div><div class="met-sub">markdown on units sold</div><div class="met-bar"></div></div>'+
    '<div class="met '+(totNet>=0?'gr':'rd')+'"><div class="met-lbl">Net benefit</div><div class="met-val" style="font-size:17px">'+(totNet<0?'−':'')+fmtK(Math.abs(totNet))+'</div><div class="met-sub">saved minus discount</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Batches rescued</div><div class="met-val">'+rescuedBatches+'</div><div class="met-sub">of '+rows.length+' at risk</div><div class="met-bar"></div></div>';
  $('pr-tbody').innerHTML=rows.length?rows.slice(0,200).map(r=>{
    const b=r.b;
    return '<tr onclick="openDrawer(\''+esc(b.sku)+'\')" style="cursor:pointer"><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(b.name)+'</td>'+
    '<td class="mo mu">'+esc(b.batch||'—')+'</td><td style="font-size:11px">'+esc(b.expiry||'—')+'</td>'+
    '<td class="r mu">'+b.daysToExpiry+'d</td><td class="r">'+b.soh.toLocaleString()+'</td>'+
    '<td class="r" style="color:var(--rd)">'+b.projExpired.toLocaleString()+'</td><td class="r">'+r.promoExpired.toLocaleString()+'</td>'+
    '<td class="r" style="color:var(--gr);font-weight:600">'+r.rescued.toLocaleString()+'</td>'+
    '<td class="r" style="color:var(--gr)">'+fmtK(r.woSaved)+'</td><td class="r mu">'+fmtK(r.discCost)+'</td>'+
    '<td class="r" style="font-weight:700;color:'+(r.net>=0?'var(--gr)':'var(--rd)')+'">'+(r.net<0?'−':'')+fmtK(Math.abs(r.net))+'</td></tr>';
  }).join(''):'<tr><td colspan="11"><div class="empty">No batches at risk of expiring</div></td></tr>';
}
