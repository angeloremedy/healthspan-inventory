/* ── VIEWS ── */
function showView(v,el){
  const SALES_OK=['home','logvisit','followups','account','neworder','orders','order','spec','pickslip','pipeline','quotes','salesevents']; // non-"sales*" views the sales role may open
  if(typeof ROLE!=='undefined'&&ROLE==='sales'&&!String(v).startsWith('sales')&&!SALES_OK.includes(v)){v='salesoverview';el=document.querySelector('.ni.nv-sales');}
  if(typeof ROLE!=='undefined'&&ROLE==='manager'&&v==='users'&&!(typeof canUserAdmin==='function'&&canUserAdmin())){v='home';el=document.querySelector('.ni[onclick*="\'home\'"]');} // managers: no account management (unless scoped PS-admin)
  if(v==='cutover'&&typeof isSuper==='function'&&!isSuper()){v='home';el=document.querySelector('.ni[onclick*="\'home\'"]');} // cutover: super admin only
  // circle roles: broad read, no order/visit entry, role-scoped ops (writes are DB-enforced anyway)
  if(typeof ROLE!=='undefined'&&['supply_chain','finance','marketing','viewer'].includes(ROLE)){
    const common=['neworder','logvisit','cutover','targets','scorecards','approvals'];
    if(!(typeof canUserAdmin==='function'&&canUserAdmin()))common.push('users');
    const per={supply_chain:['pdc','commissions'],finance:['scan','scanpick','fulfillq','recall','cyclecount'],marketing:['scan','scanpick','po','fulfillq','pdc','returns','commissions','cyclecount'],viewer:['scan','scanpick','po','fulfillq','pdc','returns','recall','audit','commissions','cyclecount']};
    if(common.includes(v)||(per[ROLE]||[]).includes(v)){v='home';el=document.querySelector('.ni[onclick*="\'home\'"]');}
  }
  if(typeof pushRoute==='function')pushRoute('#/v/'+v); // browser back/forward works across views
  currentView=v;
  try{if(window._animReady&&window._lastAnimView!==v){window._lastAnimView=v;const _c=$('content');_c.style.animation='none';void _c.offsetHeight;_c.style.animation='viewin .18s ease';}}catch(e){}fLine='';fSearch='';fTab='all';fBin='';fSup='';
  document.querySelectorAll('.ni').forEach(x=>x.classList.remove('active'));
  if(el) el.classList.add('active');
  const T={dashboard:'Dashboard',action:'Action center',customers:'Accounts (CRM)',health:'Data health',all:'All SKUs',oos:'Out of stock',low:'Low stock',neg:'Negative stock',
           expiry:'Expiry tracker',value:'Inventory value',dealvalue:'Deal scenarios',movement:'Monthly movement',reorder:'Reorder alerts',batches:'Batch view',
           forecast:'Stockout forecast',coverage:'Stock coverage',reorderplan:'Reorder plan',ropoint:'Reorder point',variability:'Demand variability',abc:'ABC analysis',writeoff:'Write-off forecast',whatif:'What-if simulator',
           simpromo:'Promo rescue simulator',simbudget:'Budget optimizer',simservice:'Service-level simulator',simsurge:'Campaign surge simulator',
           simmonte:'Monte Carlo stockout risk',simproject:'12-month projection',simcash:'Cash-flow timeline',simbulk:'Bulk-buy trade-off',simbranch:'Remedy branch rebalancing',
           aged:'Aged inventory',shrinkage:'Shrinkage tracker',cashexpiry:'Cash in expiring stock',branchtransfer:'Remedy branch shipments',branchexpiry:'Remedy branch expiry watch',
           salesoverview:'Sales overview',salesfree:'Free items',salestarget:'Sales vs target',salesspec:'Sales per specialist',salesdeals:'Deals vs à la carte',salesrecon:'Vs accounting',salesfield:'Field coverage',logvisit:'Log a visit',followups:'Follow-ups & planned visits',account:'Account profile',neworder:'New order',orders:'Orders',order:'Order',spec:'Specialist',fulfillq:'Fulfillment queue',pickslip:'Pick list',ar:'AR aging — receivables',users:'Team & access',home:'Home',audit:'Activity log',statement:'Statement of account',delivery:'Delivery receipt',targets:'Set targets',fcastacc:'Forecast accuracy',campaigns:'Campaign calendar',planreview:'AI planning review',salespace:'Leaderboard & pace',pdc:'PDC register',salesdue:'Reorder due',catalog:'Item master',returns:'Returns & credit memos',scan:'Scan — receive / pick / count',cutover:'Cutover switches',creditmemo:'Credit memo',scorecards:'Review scorecards',scanpick:'Scan to pick',recall:'Batch recall trace',pipeline:'Pipeline',po:'Purchase orders',approvals:'Approvals',commissions:'Commissions',salesevents:'Events calendar',quotes:'Quotations',promos:'Promotions',regs:'Product registrations',cyclecount:'Cycle counts',cashflow:'Cash-flow forecast'};
  $('ptitle').textContent=T[v]||v;
  if(v==='dashboard') renderDashboard();
  else if(v==='action') renderActionCenter();
  else if(v==='customers') renderCustomers();
  else if(v==='health') renderDataHealth();
  else if(v==='expiry') renderExpiry();
  else if(v==='value') renderValue();
  else if(v==='dealvalue') renderDealValue();
  else if(v==='movement') renderMovement();
  else if(v==='batches') renderBatches();
  else if(v==='aged') renderAged();
  else if(v==='shrinkage') renderShrinkage();
  else if(v==='cashexpiry') renderCashExpiry();
  else if(v==='branchtransfer') renderBranchTransfer();
  else if(v==='branchexpiry') renderBranchExpiry();
  else if(v==='forecast') renderForecast();
  else if(v==='coverage') renderCoverage();
  else if(v==='reorderplan') renderReorderPlan();
  else if(v==='ropoint') renderReorderPoint();
  else if(v==='variability') renderVariability();
  else if(v==='abc') renderABC();
  else if(v==='writeoff') renderWriteoff();
  else if(v==='whatif') renderWhatIf();
  else if(v==='simpromo') renderPromoSim();
  else if(v==='simbudget') renderBudgetSim();
  else if(v==='simservice') renderServiceSim();
  else if(v==='simsurge') renderSurgeSim();
  else if(v==='simmonte') renderMonteSim();
  else if(v==='simproject') renderProjectSim();
  else if(v==='simcash') renderCashSim();
  else if(v==='simbulk') renderBulkSim();
  else if(v==='simbranch') renderBranchSim();
  else if(v==='salesoverview') renderSalesOverview();
  else if(v==='salesfree') renderSalesFree();
  else if(v==='salestarget') renderSalesTarget();
  else if(v==='salesspec') renderSalesSpec();
  else if(v==='salesdeals') renderSalesDeals();
  else if(v==='salesrecon') renderSalesRecon();
  else if(v==='salesfield') renderSalesField();
  else if(v==='logvisit') renderLogVisit();
  else if(v==='followups') renderFollowups();
  else if(v==='neworder') renderNewOrder();
  else if(v==='orders') renderOrders();
  else if(v==='order') renderOrderPage();
  else if(v==='spec') renderSpecPage();
  else if(v==='fulfillq') renderFulfillQ();
  else if(v==='ar') renderAR();
  else if(v==='users') renderUsers();
  else if(v==='home') renderHome();
  else if(v==='audit') renderAudit();
  else if(v==='targets') renderTargets();
  else if(v==='fcastacc') renderFcastAcc();
  else if(v==='salespace') renderSalesPace();
  else if(v==='pdc') renderPDC();
  else if(v==='salesdue') renderSalesDue();
  else if(v==='catalog') renderCatalog();
  else if(v==='returns') renderReturns();
  else if(v==='scan') renderScan();
  else if(v==='cutover') renderCutover();
  else if(v==='scorecards') renderScorecards();
  else if(v==='recall') renderRecall();
  else if(v==='pipeline') renderPipeline();
  else if(v==='po') renderPOs();
  else if(v==='approvals') renderApprovals();
  else if(v==='commissions') renderCommissions();
  else if(v==='salesevents') renderEvents();
  else if(v==='quotes') renderQuotes();
  else if(v==='promos') renderPromos();
  else if(v==='regs') renderRegs();
  else if(v==='cyclecount') renderCycleCounts();
  else if(v==='cashflow') renderCashflow();
  else if(v==='campaigns') renderCampaigns();
  else if(v==='planreview') renderPlanReview();
  else renderTable(v);
  injectDesc(v);
  injectCalc(v);
}
function fltLine(line,el){
  currentView='line';fLine=line;fSearch='';fTab='all';fBin='';
  document.querySelectorAll('.ni').forEach(x=>x.classList.remove('active'));
  if(el) el.classList.add('active');
  $('ptitle').textContent=line;
  renderTable();
}

/* ── SALES SECTION (Shopify booked sales — for Jojo & Marj) ── */
const SP_LBL={today:'today',yest:'yesterday',['7d']:'last 7 days',mtd:'this month',['30d']:'last 30 days',['3m']:'last 3 months',all:'last 12 months'};
function fmtPeso(v){return '₱'+Math.round(v||0).toLocaleString('en-PH');} // exact pesos — Jojo wants no K-rounding in Sales views
/* Sales drill-down drawer: which orders, customers and specialists moved this product */
function openSalesDrawer(sku){
  const S=(SALESIDX||{})[sku];
  const ords=((ORDIDX||{})[sku]||[]).slice(0,40);
  const name=S?(S.name||sku):sku;
  const inSheet=DATA.some(p=>p.sku===sku);
  const rows=ords.length?ords.map(o=>
    '<div class="drow" style="align-items:flex-start"><span class="dlbl" style="max-width:190px">'+
    '<b>'+esc(o.n||'—')+'</b> · '+esc(o.dt)+'<br><span style="color:var(--tx3)">'+(o.c?'<a href="#" onclick="openAccountDrawer(\''+esc(o.c).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(o.c)+'</a>':'no customer name')+(o.t?' · PS: '+esc(o.t):'')+'</span></span>'+
    '<span class="dval" style="text-align:right">'+o.q.toLocaleString()+' u'+(o.a>0?'<br>'+fmtPeso(o.a):'<br><span style="color:var(--pu)">₱0</span>')+'</span></div>').join(''):
    '<div style="font-size:11.5px;color:var(--tx3)">No orders for this product in the drill-down window (last ~6 months). Older sales are still counted in the totals.</div>';
  const tot=ords.reduce((x,o)=>({q:x.q+o.q,a:x.a+o.a}),{q:0,a:0});
  $('dbody').innerHTML=
    '<div class="dsku">'+esc(sku)+'</div>'+
    '<div class="dname">'+esc(name)+'</div>'+
    '<div class="dstk" style="color:var(--gr)">'+fmtPeso(tot.a)+'</div>'+
    '<div class="dsub">'+tot.q.toLocaleString()+' units across '+ords.length+' recent orders (≈6 months)</div>'+
    (inSheet?'<div style="margin:10px 0"><a href="#" onclick="openDrawer(\''+esc(sku)+'\');return false" style="color:var(--ac);font-size:12px">Open inventory detail →</a></div>':'')+
    '<div class="dsec"><div class="dsectitle">Orders — number · customer · specialist</div>'+rows+'</div>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:10px">From Shopify orders · amounts are what was booked on this product’s lines in each order (deal revenue included) · blank customer means the order has no customer attached in Shopify</div>';
  $('overlay').classList.add('open');
  $('drawer').classList.add('open');
}
function spLbl(){return SPERIOD==='custom'?((SFROM||'start')+' → '+(STO||'today')):SP_LBL[SPERIOD];}
function salesLines(){return [...new Set(Object.values(SALESIDX||{}).map(S=>S.line).filter(Boolean))].sort();}
function salesLineCur(){if(SLINE!==null)return SLINE;const ls=salesLines();const meso=ls.find(l=>/meso/i.test(l));SLINE=(meso!==undefined)?meso:'';return SLINE;}
function salesRows(){
  const line=salesLineCur();const out=[];
  for(const sku in SALESIDX){const S=SALESIDX[sku];if(line&&S.line!==line)continue;
    const t=sumPeriod(S,SPERIOD);                                          // base lines: units + à-la-carte revenue
    const tb=sumPeriod({monthly:S.bmonthly||{},daily:S.bdaily||{}},SPERIOD); // deal/bundle lines: deal revenue
    const v=t.v+tb.v;
    if(t.u<=0&&v<=0&&t.f<=0)continue;
    out.push({sku,name:S.name||sku,line:S.line||'',
      u:t.u,f:t.f,d:t.d,au:Math.max(0,t.u-t.d-t.f),          // total / free / via-deal / à-la-carte units
      v,dealRev:tb.v+t.dv,alaRev:Math.max(0,t.v-t.dv),        // total / deal / à-la-carte revenue
      paid:Math.max(0,t.u-t.f)});}
  out.sort((a,b)=>(b.v-a.v)||(b.u-a.u));return out;}
function salesGuard(){
  if(!DATA.length){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sync from Google Sheets first — product names come from the master sheet.</div>';return false;}
  if(!SHOPIFY||!SALESIDX||!Object.keys(SALESIDX).length){
    $('content').innerHTML=SHOPIFY_ERR?
      '<div class="viewdesc" style="border-left-color:var(--rd);margin-top:20px"><svg class="vd-i" viewBox="0 0 24 24" style="stroke:var(--rd)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>'+
      '<div class="vd-t"><b>Shopify connection failed:</b> '+esc(SHOPIFY_ERR)+'<br><span style="color:var(--tx2)">If this mentions an invalid API key or token, the SHOPIFY_ADMIN_TOKEN in Netlify needs to be replaced — in Shopify admin go to Settings → Apps and sales channels → Develop apps, open the custom app, and check the Admin API access token (reinstall the app to get a new one if it was revoked), then update the token in Netlify and reload.</span></div></div>':
      '<div class="empty" style="margin-top:40px">Building the sales cache from Shopify — one-time after an update, usually 2–4 minutes. This page will fill in by itself; no need to re-sync.</div>';
    try{loadShopify();}catch(e){}return false;}
  return true;}
function salesToolbar(fn){
  const periods=[['today','Today'],['yest','Yesterday'],['7d','7 days'],['mtd','This month'],['30d','30 days'],['3m','3 months'],['all','12 months'],['custom','Custom']];
  const lines=salesLines();const cur=salesLineCur();
  const syn=SHOPIFY&&SHOPIFY.synced?new Date(SHOPIFY.synced).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):null;
  const dMin=(SHOPIFY&&SHOPIFY.dailyFrom)||'';
  const dInp='style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:5px 8px;font-size:12px"';
  return '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+
    '<div class="tabs" style="margin:0">'+periods.map(([k,l])=>'<div class="tab'+(SPERIOD===k?' active':'')+'" onclick="SPERIOD=\''+k+'\';'+fn+'()">'+l+'</div>').join('')+'</div>'+
    (SPERIOD==='custom'?('<input type="date" value="'+SFROM+'"'+(dMin?' min="'+dMin+'"':'')+' onchange="SFROM=this.value;'+fn+'()" '+dInp+'>'+
      '<span style="color:var(--tx3);font-size:12px">to</span>'+
      '<input type="date" value="'+STO+'"'+(dMin?' min="'+dMin+'"':'')+' onchange="STO=this.value;'+fn+'()" '+dInp+'>'+
      (dMin?'<span style="font-size:11px;color:var(--tx3)">day-level detail covers '+dMin+' onward</span>':'')):'')+
    '<select onchange="SLINE=this.value;'+fn+'()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;font-size:12px">'+
    '<option value=""'+(cur===''?' selected':'')+'>All product lines</option>'+
    lines.map(l=>'<option value="'+esc(l)+'"'+(cur===l?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+
    (syn?'<span style="font-size:11px;color:var(--tx3)">Shopify synced '+syn+'</span>':'')+'</div>';}
function attBar(pct){
  const c=pct>=100?'var(--gr)':pct>=70?'var(--bl)':pct>=40?'var(--am)':'var(--rd)';
  return '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--sf2);border-radius:3px;overflow:hidden;min-width:60px"><div style="height:100%;width:'+Math.min(100,pct).toFixed(0)+'%;background:'+c+'"></div></div><span style="font-weight:600;font-size:11.5px;color:'+c+';min-width:38px;text-align:right">'+pct.toFixed(0)+'%</span></div>';}

function renderSalesOverview(){
  if(!salesGuard())return;
  const rows=salesRows();
  const stkOf={};DATA.forEach(p=>stkOf[p.sku]=stk(p));
  const tot=rows.reduce((a,r)=>({u:a.u+r.u,f:a.f+r.f,d:a.d+r.d,v:a.v+r.v}),{u:0,f:0,d:0,v:0});
  const line=salesLineCur();
  let td={u:0,v:0};
  for(const sku in SALESIDX){const S=SALESIDX[sku];if(line&&S.line!==line)continue;
    const t=sumPeriod(S,'today');const tb=sumPeriod({monthly:S.bmonthly||{},daily:S.bdaily||{}},'today');td.u+=t.u;td.v+=t.v+tb.v;}
  $('content').innerHTML=
    salesToolbar('renderSalesOverview')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Revenue ('+spLbl()+')</div><div class="met-val" style="font-size:15px">'+fmtPeso(tot.v)+'</div><div class="met-sub">booked on Shopify</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Units sold</div><div class="met-val">'+tot.u.toLocaleString()+'</div><div class="met-sub">'+tot.d.toLocaleString()+' via deals · '+Math.max(0,tot.u-tot.d-tot.f).toLocaleString()+' à la carte · '+tot.f.toLocaleString()+' free</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Via deals</div><div class="met-val">'+(tot.u>0?(tot.d/tot.u*100).toFixed(0)+'%':'—')+'</div><div class="met-sub">'+tot.d.toLocaleString()+' units in deal orders</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Today</div><div class="met-val">'+td.u.toLocaleString()+' u</div><div class="met-sub">'+fmtPeso(td.v)+' booked today</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="g2" style="margin-bottom:14px">'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>Revenue by month'+(line?' — '+esc(line):'')+'</div><div class="cw" style="height:230px"><canvas id="soRevChart"></canvas></div></div>'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>Top products '+spLbl()+' — sold vs stock</div><div class="cw" style="height:230px"><canvas id="soTopChart"></canvas></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>#</th><th>Product</th><th>SKU</th><th style="text-align:right">Total u</th><th style="text-align:right">Via deals</th><th style="text-align:right">À la carte</th><th style="text-align:right">Free u</th><th style="text-align:right">Revenue</th><th style="text-align:right">Stock now</th><th style="text-align:right">Share</th></tr></thead><tbody>'+
    (rows.length?rows.map((r,i)=>{const s=stkOf[r.sku];
      return '<tr onclick="openSalesDrawer(\''+esc(r.sku)+'\')" style="cursor:pointer"><td class="mu">'+(i+1)+'</td>'+
      '<td style="font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</td><td class="mu" style="font-size:11px">'+esc(r.sku)+'</td>'+
      '<td class="r" style="font-weight:600">'+r.u.toLocaleString()+'</td><td class="r">'+(r.d?r.d.toLocaleString():'—')+'</td><td class="r">'+(r.au?r.au.toLocaleString():'—')+'</td><td class="r" style="color:var(--pu)">'+(r.f?r.f.toLocaleString():'—')+'</td>'+
      '<td class="r" style="font-weight:600">'+fmtPeso(r.v)+'</td><td class="r'+(s!=null&&s<r.u?'" style="color:var(--am)':'')+'">'+(s!=null?s.toLocaleString():'—')+'</td><td class="r mu">'+(tot.v>0?(r.v/tot.v*100).toFixed(1)+'%':'—')+'</td></tr>';}).join(''):
      '<tr><td colspan="10"><div class="empty">No booked sales for this period'+(line?' in '+esc(line):'')+'</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Booked sales from Shopify (specialists’ POS) · via deals = units in orders with a deal line (deals counted as a whole, +1s included) · free = ₱0 giveaways outside any deal · SHOPIFY ONLY line = package SKUs not in the master sheet (units are sets) · includes internal orders (Remedy branches, employees) · TEST orders and marketing/executive pull-outs excluded (pull-outs remain in the finance & logistics views) · accounting’s Sales Booked may exclude internal orders and book by invoice date, so small differences vs accounting are expected</span></div></div>';
  // ── charts: 13-month revenue trend + top products sold vs current stock
  const ymNow=new Date().toISOString().slice(0,7);
  const revM={};
  for(const sku in SALESIDX){const S=SALESIDX[sku];if(line&&S.line!==line)continue;
    for(const m in S.monthly)revM[m]=(revM[m]||0)+(S.monthly[m].v||0);
    for(const m in (S.bmonthly||{}))revM[m]=(revM[m]||0)+(S.bmonthly[m].v||0);}
  const yms=Object.keys(revM).sort();
  try{
    if(window._soRev)window._soRev.destroy();
    window._soRev=new Chart($('soRevChart'),{type:'bar',
      data:{labels:yms,datasets:[{label:'Revenue',data:yms.map(m=>Math.round(revM[m])),backgroundColor:yms.map(m=>m===ymNow?'#1D9E75':'rgba(29,158,117,0.45)'),borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'₱'+Math.round(c.raw).toLocaleString()+(c.label===ymNow?' (month in progress)':'')}}},
        scales:{y:{beginAtZero:true,ticks:{callback:v=>'₱'+Math.round(v).toLocaleString()},grid:{color:'rgba(128,128,128,0.12)'}},x:{grid:{display:false}}}}});
    const top=rows.slice(0,8);
    if(window._soTop)window._soTop.destroy();
    window._soTop=new Chart($('soTopChart'),{type:'bar',
      data:{labels:top.map(r=>r.name.length>16?r.name.slice(0,15)+'…':r.name),datasets:[
        {label:'Units sold '+spLbl(),data:top.map(r=>r.u),backgroundColor:'#378ADD',borderRadius:3},
        {label:'Stock now',data:top.map(r=>Math.max(0,stkOf[r.sku]??0)),backgroundColor:'#BA7517',borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},
        scales:{y:{beginAtZero:true,grid:{color:'rgba(128,128,128,0.12)'}},x:{grid:{display:false}}}}});
  }catch(e){}
}

/* Deals vs à la carte — do the bundles outsell single-unit pricing? (Alex) */
function renderSalesDeals(){
  if(!salesGuard())return;
  const priceOf={};DATA.forEach(p=>priceOf[p.sku]=p.price||0);
  const dealTypeOf=sku=>{const S=SALESIDX[sku];if(!S||!S.bundles||!S.bundles.length)return '';
    return [...new Set(S.bundles.map(b=>{const m=(b.productTitle||'').match(/\d+\s*\+\s*\d+/);return m?m[0].replace(/\s+/g,''):(b.productTitle||'').slice(0,16);}))].sort().join(', ');};
  const rows=salesRows().filter(r=>r.d>0||r.au>0).map(r=>{
    const dPU=r.d>0?r.dealRev/r.d:null, aPU=r.au>0?r.alaRev/r.au:(priceOf[r.sku]||null);
    return {...r,dPU,aPU,disc:(dPU!=null&&aPU>0)?(1-dPU/aPU)*100:null,dealType:dealTypeOf(r.sku)};
  }).sort((a,b)=>(b.d+b.au)-(a.d+a.au));
  const tot=rows.reduce((a,r)=>({d:a.d+r.d,au:a.au+r.au,dr:a.dr+r.dealRev,ar:a.ar+r.alaRev}),{d:0,au:0,dr:0,ar:0});
  const sold=tot.d+tot.au;
  $('content').innerHTML=
    salesToolbar('renderSalesDeals')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met pu"><div class="met-lbl">Units via deals</div><div class="met-val">'+tot.d.toLocaleString()+'</div><div class="met-sub">'+(sold>0?(tot.d/sold*100).toFixed(0)+'% of sold units':'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Units à la carte</div><div class="met-val">'+tot.au.toLocaleString()+'</div><div class="met-sub">'+(sold>0?(tot.au/sold*100).toFixed(0)+'% of sold units':'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Deal revenue</div><div class="met-val" style="font-size:15px">'+fmtPeso(tot.dr)+'</div><div class="met-sub">'+(tot.d>0?'₱'+Math.round(tot.dr/tot.d).toLocaleString()+' per unit':'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">À-la-carte revenue</div><div class="met-val" style="font-size:15px">'+fmtPeso(tot.ar)+'</div><div class="met-sub">'+(tot.au>0?'₱'+Math.round(tot.ar/tot.au).toLocaleString()+' per unit':'')+'</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th>Deal type</th><th style="text-align:right">Deal u</th><th style="text-align:right">À-la-carte u</th><th style="text-align:right">Deal share</th><th style="text-align:right">Deal rev</th><th style="text-align:right">₱/u via deal</th><th style="text-align:right">₱/u à la carte</th><th style="text-align:right">Eff. discount</th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>{const sh=(r.d+r.au)>0?r.d/(r.d+r.au)*100:0;
      return '<tr onclick="openSalesDrawer(\''+esc(r.sku)+'\')" style="cursor:pointer"><td style="font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</td>'+
      '<td>'+(r.dealType?'<span class="pill pbl">'+esc(r.dealType)+'</span>':'<span class="mu">—</span>')+'</td>'+
      '<td class="r" style="font-weight:600;color:var(--pu)">'+r.d.toLocaleString()+'</td><td class="r">'+r.au.toLocaleString()+'</td>'+
      '<td class="r"'+(sh>=50?' style="color:var(--pu);font-weight:600"':'')+'>'+sh.toFixed(0)+'%</td>'+
      '<td class="r">'+fmtPeso(r.dealRev)+'</td><td class="r">'+(r.dPU!=null?'₱'+Math.round(r.dPU).toLocaleString():'—')+'</td>'+
      '<td class="r">'+(r.aPU?'₱'+Math.round(r.aPU).toLocaleString():'—')+'</td>'+
      '<td class="r mu">'+(r.disc!=null?r.disc.toFixed(0)+'%':'—')+'</td></tr>';}).join(''):
      '<tr><td colspan="9"><div class="empty">No sales in this period</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Deal u = units moved through bundle orders (whole deal incl. +1s) · ₱/u via deal = deal revenue ÷ all deal units · eff. discount = how much cheaper a unit effectively is inside a deal vs à la carte</span></div></div>';}

function renderSalesFree(){
  if(!salesGuard())return;
  const priceOf={},stkOf={};DATA.forEach(p=>{priceOf[p.sku]=p.price||0;stkOf[p.sku]=stk(p);});
  const rows=salesRows().filter(r=>r.f>0||r.paid>0).sort((a,b)=>b.f-a.f||b.u-a.u);
  const totF=rows.reduce((a,r)=>a+r.f,0),totU=rows.reduce((a,r)=>a+r.u,0);
  const totFV=rows.reduce((a,r)=>a+r.f*(priceOf[r.sku]||0),0);
  $('content').innerHTML=
    salesToolbar('renderSalesFree')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met pu"><div class="met-lbl">Free units ('+spLbl()+')</div><div class="met-val">'+totF.toLocaleString()+'</div><div class="met-sub">true giveaways (outside deals)</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Giveaway value</div><div class="met-val" style="font-size:15px">'+fmtPeso(totFV)+'</div><div class="met-sub">at à-la-carte list price</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Free share</div><div class="met-val">'+(totU>0?(totF/totU*100).toFixed(0)+'%':'—')+'</div><div class="met-sub">of all units moved</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Paid units</div><div class="met-val">'+Math.max(0,totU-totF).toLocaleString()+'</div><div class="met-sub">customer-paid</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th style="text-align:right">Free u</th><th style="text-align:right">Paid u</th><th style="text-align:right">Free %</th><th style="text-align:right">Value @ list</th><th style="text-align:right">Stock now</th><th style="text-align:right">Free vs stock</th></tr></thead><tbody>'+
    (rows.length?rows.map(r=>{const fv=r.f*(priceOf[r.sku]||0);const s=stkOf[r.sku];
      return '<tr onclick="openSalesDrawer(\''+esc(r.sku)+'\')" style="cursor:pointer"><td style="font-weight:600;max-width:260px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</td>'+
      '<td class="r" style="font-weight:600;color:var(--pu)">'+r.f.toLocaleString()+'</td><td class="r">'+r.paid.toLocaleString()+'</td>'+
      '<td class="r mu">'+(r.u>0?(r.f/r.u*100).toFixed(0)+'%':'—')+'</td><td class="r">'+(fv>0?fmtPeso(fv):'—')+'</td>'+
      '<td class="r">'+(s!=null?s.toLocaleString():'—')+'</td><td class="r mu">'+((s>0&&r.f>0)?(r.f/s*100).toFixed(0)+'%':'—')+'</td></tr>';}).join(''):
      '<tr><td colspan="7"><div class="empty">No sales in this period</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Free = ₱0 items given away OUTSIDE any deal (samples, marketing, goodwill) · deal +1s are NOT counted here — the deal is sold as a whole and its units sit in the deal columns · free items still leave inventory but book no revenue</span></div></div>';}

function tgMonths(){return [...new Set((TARGETS||[]).map(t=>t.month))].sort().reverse();}
function tgActualProduct(ym,key){
  // match target NAME to a product: exact SKU, else case-insensitive name equality, else substring
  const kk=key.toUpperCase();
  let S=SALESIDX[key]||SALESIDX[kk];
  if(!S){for(const sku in SALESIDX){const n=(SALESIDX[sku].name||'').toUpperCase();if(n===kk){S=SALESIDX[sku];break;}}}
  if(!S){for(const sku in SALESIDX){const n=(SALESIDX[sku].name||'').toUpperCase();if(kk.length>=4&&n.includes(kk)){S=SALESIDX[sku];break;}}}
  if(!S)return null;const c=(S.monthly||{})[ym],b=(S.bmonthly||{})[ym];
  return {u:c?c.u:0,v:(c?c.v:0)+(b?b.v:0),name:S.name};}
function renderSalesTarget(){
  if(!salesGuard())return;
  if(!(TARGETS||[]).length){
    $('content').innerHTML=
      '<div class="viewdesc" style="border-left-color:var(--am);margin-bottom:14px"><svg class="vd-i" viewBox="0 0 24 24" style="stroke:var(--am)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>'+
      '<div class="vd-t"><b>No targets set up yet.</b> This view compares booked sales against monthly targets kept in the Google Sheet. To turn it on, add a tab named <b>Targets</b> to the master sheet with these five columns (row 1 = headers):</div></div>'+
      '<div class="tcard" style="margin-bottom:14px"><div class="tscroll"><table><thead><tr><th>MONTH</th><th>SCOPE</th><th>NAME</th><th>TARGET_VALUE_PHP</th><th>TARGET_UNITS</th></tr></thead><tbody>'+
      '<tr><td>2026-08</td><td>TOTAL</td><td class="mu">(blank)</td><td>2500000</td><td class="mu">(optional)</td></tr>'+
      '<tr><td>2026-08</td><td>LINE</td><td>Mesoestetic</td><td>1800000</td><td>400</td></tr>'+
      '<tr><td>2026-08</td><td>PRODUCT</td><td>Cosmelan 2 <span class="mu">(or the SKU)</span></td><td>600000</td><td>50</td></tr>'+
      '<tr><td>2026-08</td><td>SPECIALIST</td><td>Rhas</td><td>500000</td><td></td></tr>'+
      '</tbody></table></div><div class="tfooter"><span>MONTH must be YYYY-MM · SCOPE is TOTAL, LINE, PRODUCT or SPECIALIST · NAME matches a line, product/SKU, or specialist tag · leave a value blank if you only target the other one</span></div></div>'+
      '<div style="font-size:12px;color:var(--tx2)">Once the tab exists, hit <b>Sync from Google Sheets</b> and this view lights up automatically. Verna can add or change targets any time.</div>';
    return;}
  const months=tgMonths();const ymNow=new Date().toISOString().slice(0,7);
  const ym=window._tgMonth&&months.includes(window._tgMonth)?window._tgMonth:(months.includes(ymNow)?ymNow:months[0]);
  window._tgMonth=ym;
  const rowsT=TARGETS.filter(t=>t.month===ym);
  // actuals for the month (base units + revenue, plus deal revenue from bundle lines)
  let actTotal={u:0,v:0};const actLine={};
  for(const sku in SALESIDX){const S=SALESIDX[sku];const c=(S.monthly||{})[ym],b=(S.bmonthly||{})[ym];if(!c&&!b)continue;
    const u=c?c.u:0,v=(c?c.v:0)+(b?b.v:0);
    actTotal.u+=u;actTotal.v+=v;
    const L=S.line||'(no line)';const a=actLine[L]||(actLine[L]={u:0,v:0});a.u+=u;a.v+=v;}
  const specs=specMerged();
  const specActual=name=>{const key=Object.keys(specs).find(k=>k.toLowerCase()===name.trim().toLowerCase());const c=key?(specs[key].monthly||{})[ym]:null;return {u:c?c.u:0,v:c?c.v:0};};
  const isCur=ym===ymNow;
  const dayFrac=isCur?(new Date().getDate()/new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()):1;
  const mkRow=t=>{
    let act={u:0,v:0},label=t.name||'Company total';
    if(t.scope==='TOTAL')act=actTotal;
    else if(t.scope==='LINE'){const k=Object.keys(actLine).find(x=>x.toLowerCase()===(t.name||'').toLowerCase());act=k?actLine[k]:{u:0,v:0};}
    else if(t.scope==='SPECIALIST')act=specActual(t.name||'');
    else{const a=tgActualProduct(ym,t.name||'');if(a){act={u:a.u,v:a.v};label=a.name||t.name;}}
    const pctV=t.value>0?act.v/t.value*100:null,pctU=t.units>0?act.u/t.units*100:null;
    return {t,label,act,pctV,pctU,pct:pctV!==null?pctV:(pctU!==null?pctU:0)};};
  const groups=[['TOTAL','Company total'],['LINE','Per product line'],['PRODUCT','Per product'],['SPECIALIST','Per specialist']];
  let html=
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">'+
    '<div class="tabs" style="margin:0">'+months.slice(0,8).map(m=>'<div class="tab'+(m===ym?' active':'')+'" onclick="window._tgMonth=\''+m+'\';renderSalesTarget()">'+m+'</div>').join('')+'</div>'+
    (isCur?'<span style="font-size:11px;color:var(--tx3)">month is '+(dayFrac*100).toFixed(0)+'% elapsed — on pace means roughly '+(dayFrac*100).toFixed(0)+'% attainment</span>':'')+'</div>';
  for(const[scope,title] of groups){
    const rs=rowsT.filter(t=>t.scope===scope).map(mkRow).sort((a,b)=>b.pct-a.pct);
    if(!rs.length)continue;
    html+='<div class="tcard" style="margin-bottom:14px"><div class="tscroll"><table><thead><tr><th>'+title+'</th><th style="text-align:right">Actual ₱</th><th style="text-align:right">Target ₱</th><th style="min-width:130px">Attainment (₱)</th><th style="text-align:right">Actual u</th><th style="text-align:right">Target u</th><th style="min-width:130px">Attainment (u)</th></tr></thead><tbody>'+
      rs.map(r=>'<tr><td style="font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis">'+esc(r.label)+'</td>'+
        '<td class="r" style="font-weight:600">'+fmtPeso(r.act.v)+'</td><td class="r mu">'+(r.t.value>0?fmtPeso(r.t.value):'—')+'</td>'+
        '<td>'+(r.pctV!==null?attBar(r.pctV):'<span class="mu">—</span>')+'</td>'+
        '<td class="r">'+r.act.u.toLocaleString()+'</td><td class="r mu">'+(r.t.units>0?r.t.units.toLocaleString():'—')+'</td>'+
        '<td>'+(r.pctU!==null?attBar(r.pctU):'<span class="mu">—</span>')+'</td></tr>').join('')+
      '</tbody></table></div></div>';}
  html+='<div style="font-size:11px;color:var(--tx3)">Actuals are booked Shopify sales for '+ym+' · targets come from the sheet’s Targets tab · edit them there and re-sync</div>';
  $('content').innerHTML=html;}

// Known alias tags: same person tagged under different names on Shopify orders.
// Left side lowercase → canonical display name.
const SPEC_ALIAS={'kristine':'Tin'};
function specCanon(tag){const t=String(tag||'').trim();return SPEC_ALIAS[t.toLowerCase()]||t;}
// Merge specialist tags that differ only by case/spacing ("Rhas"/"RHAS") or known aliases (Kristine=Tin)
function specMerged(){
  const specs=(SHOPIFY&&SHOPIFY.specialists)||{};
  const merged={};
  for(const n in specs){
    const canon=specCanon(n);
    const k=canon.toLowerCase();
    const M=merged[k]||(merged[k]={name:canon,monthly:{},daily:{},skus:{}});
    if(SPEC_ALIAS[n.trim().toLowerCase()])M.name=canon; // alias resolved: prefer the canonical name
    for(const src of ['monthly','daily'])for(const m in (specs[n][src]||{})){
      const c=specs[n][src][m];const d=M[src][m]||(M[src][m]={u:0,v:0});d.u+=c.u||0;d.v+=c.v||0;}
    for(const sku in (specs[n].skus||{})){
      const c=specs[n].skus[sku];const d=M.skus[sku]||(M.skus[sku]={u:0,v:0});d.u+=c.u||0;d.v+=c.v||0;}
  }
  const out={};for(const k in merged)out[merged[k].name]=merged[k];
  return out;}
/* Specialist detail drawer — trend, target, and what they sold */
function openSpecDrawer(name){
  const specs=specMerged();const sp=specs[name];if(!sp)return;
  const t=sumPeriod(sp,SPERIOD);
  const ymNow=new Date().toISOString().slice(0,7);
  const mc=(sp.monthly||{})[ymNow]||{u:0,v:0};
  const tg=(TARGETS||[]).find(x=>x.month===ymNow&&x.scope==='SPECIALIST'&&(x.name||'').trim().toLowerCase()===name.toLowerCase());
  const yms=Object.keys(sp.monthly||{}).sort().slice(-6).reverse();
  // Resolve their sold SKUs to sheet products (bundle lines → revenue only, base lines → units)
  const sheetSkus=new Set(DATA.map(p=>p.sku));
  const bases=[...sheetSkus].sort((a,b)=>b.length-a.length);
  const nameOf={};DATA.forEach(p=>nameOf[p.sku]=p.name);
  const agg={};
  for(const sku in (sp.skus||{})){
    const c=sp.skus[sku];
    let base=sheetSkus.has(sku)?sku:bases.find(b=>sku.startsWith(b)&&sku.length>b.length);
    const isBundle=!!base&&base!==sku;
    if(!base)base=sku;
    const a=agg[base]||(agg[base]={u:0,v:0});
    if(!isBundle)a.u+=c.u||0;
    a.v+=c.v||0;
  }
  const top=Object.keys(agg).map(k=>({sku:k,name:nameOf[k]||k,u:agg[k].u,v:agg[k].v}))
    .sort((a,b)=>(b.v-a.v)||(b.u-a.u)).slice(0,12);
  const topHTML=top.length?
    '<div class="dsec"><div class="dsectitle">What they sell (12 months, top products)</div>'+
    top.map(x=>'<div class="drow"'+(nameOf[x.sku]?' onclick="openDrawer(\''+esc(x.sku)+'\')" style="cursor:pointer"':'')+'><span class="dlbl" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(x.name)+'</span><span class="dval">'+x.u.toLocaleString()+' u'+(x.v>0?' · '+fmtPeso(x.v):'')+'</span></div>').join('')+'</div>':
    '<div class="dsec"><div class="dsectitle">What they sell</div><div style="font-size:11.5px;color:var(--tx3)">Product breakdown appears after the next sales-cache rebuild (automatic — check back in a few minutes).</div></div>';
  // Their recent orders (order # · date · customer), from the ~6-month drill-down window
  const myOrders=(SHOPIFY.recent||[]).filter(o=>specCanon(o.t).toLowerCase()===name.toLowerCase())
    .map(o=>({n:o.n,dt:o.dt,c:o.c||'',q:(o.ls||[]).reduce((x,l)=>x+(l[1]||0),0),a:(o.ls||[]).reduce((x,l)=>x+(l[2]||0),0)}))
    .sort((a,b)=>a.dt<b.dt?1:a.dt>b.dt?-1:0);
  const ordHTML=myOrders.length?
    '<div class="dsec"><div class="dsectitle">Recent orders ('+myOrders.length+' in ≈6 months)</div>'+
    myOrders.slice(0,30).map(o=>'<div class="drow" style="align-items:flex-start"><span class="dlbl" style="max-width:190px"><b>'+esc(o.n||'—')+'</b> · '+esc(o.dt)+'<br><span style="color:var(--tx3)">'+esc(o.c||'no customer name')+'</span></span><span class="dval" style="text-align:right">'+o.q.toLocaleString()+' u<br>'+fmtPeso(o.a)+'</span></div>').join('')+
    (myOrders.length>30?'<div style="font-size:10.5px;color:var(--tx3);margin-top:6px">Showing the 30 most recent — export CSV for the full list.</div>':'')+'</div>':
    '<div class="dsec"><div class="dsectitle">Recent orders</div><div style="font-size:11.5px;color:var(--tx3)">No orders in the drill-down window (last ~6 months).</div></div>';
  const trendHTML=yms.length?
    '<div class="dsec"><div class="dsectitle">Monthly trend</div>'+
    yms.map(m=>{const c=sp.monthly[m];return '<div class="drow"><span class="dlbl">'+m+(m===ymNow?' <span class="mu">(partial)</span>':'')+'</span><span class="dval">'+c.u.toLocaleString()+' u · '+fmtPeso(c.v)+'</span></div>';}).join('')+'</div>':'';
  const tgHTML=tg?
    '<div class="dsec"><div class="dsectitle">Target — '+ymNow+'</div>'+
    (tg.value>0?'<div class="drow"><span class="dlbl">Revenue</span><span class="dval">'+fmtPeso(mc.v)+' / '+fmtPeso(tg.value)+'</span></div><div style="margin:6px 0">'+attBar(mc.v/tg.value*100)+'</div>':'')+
    (tg.units>0?'<div class="drow"><span class="dlbl">Units</span><span class="dval">'+mc.u.toLocaleString()+' / '+tg.units.toLocaleString()+'</span></div><div style="margin:6px 0">'+attBar(mc.u/tg.units*100)+'</div>':'')+'</div>':'';
  $('dbody').innerHTML=
    '<div class="dsku">PRODUCT SPECIALIST</div>'+
    '<div class="dname">'+esc(name)+'</div>'+
    '<div class="dstk" style="color:var(--gr)">'+fmtPeso(t.v)+'</div>'+
    '<div class="dsub">'+t.u.toLocaleString()+' units booked '+spLbl()+'</div>'+
    '<div class="dsec"><div class="dsectitle">This month (MTD)</div>'+
    '<div class="drow"><span class="dlbl">Revenue</span><span class="dval">'+fmtPeso(mc.v)+'</span></div>'+
    '<div class="drow"><span class="dlbl">Units</span><span class="dval">'+mc.u.toLocaleString()+'</span></div>'+
    '</div>'+tgHTML+ordHTML+trendHTML+topHTML+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:10px">From Shopify order tags'+(name.toLowerCase()==='tin'?' · includes orders tagged Kristine (same person)':'')+' · tap a product to open its inventory detail</div>';
  $('overlay').classList.add('open');
  $('drawer').classList.add('open');
}
function renderSalesSpec(){
  if(!salesGuard())return;
  const specs=specMerged();
  const names=Object.keys(specs);
  if(!names.length){$('content').innerHTML=salesToolbar('renderSalesSpec')+'<div class="empty" style="margin-top:30px">No specialist tags found on Shopify orders yet. Specialists are read from each order’s first tag (e.g. Rhas, Frank, Ruth, Charmaine) — make sure orders are tagged at the POS.</div>';return;}
  const ymNow=new Date().toISOString().slice(0,7);
  const rows=names.map(n=>{const t=sumPeriod(specs[n],SPERIOD);
    const tg=(TARGETS||[]).find(x=>x.month===ymNow&&x.scope==='SPECIALIST'&&(x.name||'').toLowerCase()===n.toLowerCase());
    const mc=(specs[n].monthly||{})[ymNow]||{u:0,v:0};
    return {n,u:t.u,v:t.v,tg,mtdV:mc.v,mtdU:mc.u};}).filter(r=>r.u>0||r.v>0||r.tg).sort((a,b)=>b.v-a.v);
  const totV=rows.reduce((a,r)=>a+r.v,0),totU=rows.reduce((a,r)=>a+r.u,0);
  const anyTg=rows.some(r=>r.tg);
  $('content').innerHTML=
    salesToolbar('renderSalesSpec')+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Specialists</div><div class="met-val">'+rows.length+'</div><div class="met-sub">with sales '+spLbl()+'</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Revenue ('+spLbl()+')</div><div class="met-val" style="font-size:15px">'+fmtPeso(totV)+'</div><div class="met-sub">across specialists</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Units</div><div class="met-val">'+totU.toLocaleString()+'</div><div class="met-sub">booked '+spLbl()+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Top specialist</div><div class="met-val" style="font-size:15px">'+(rows[0]?esc(rows[0].n):'—')+'</div><div class="met-sub">'+(rows[0]?fmtPeso(rows[0].v):'')+'</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>#</th><th>Specialist</th><th style="text-align:right">Units</th><th style="text-align:right">Revenue</th><th style="text-align:right">Share</th>'+(anyTg?'<th style="text-align:right">Target ('+ymNow+')</th><th style="min-width:130px">Attainment (MTD)</th>':'')+'</tr></thead><tbody>'+
    rows.map((r,i)=>'<tr onclick="showSpecPage(\''+esc(r.n).replace(/'/g,'&#39;')+'\')" style="cursor:pointer"><td class="mu">'+(i+1)+'</td><td style="font-weight:600">'+esc(r.n)+'</td>'+
      '<td class="r">'+r.u.toLocaleString()+'</td><td class="r" style="font-weight:600">'+fmtPeso(r.v)+'</td>'+
      '<td class="r mu">'+(totV>0?(r.v/totV*100).toFixed(1)+'%':'—')+'</td>'+
      (anyTg?('<td class="r mu">'+(r.tg&&r.tg.value>0?fmtPeso(r.tg.value):(r.tg&&r.tg.units>0?r.tg.units.toLocaleString()+' u':'—'))+'</td>'+
        '<td>'+(r.tg&&r.tg.value>0?attBar(r.mtdV/r.tg.value*100):(r.tg&&r.tg.units>0?attBar(r.mtdU/r.tg.units*100):'<span class="mu">—</span>'))+'</td>'):'')+
      '</tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Specialist = the order’s first tag in Shopify · units include free +1s · attainment compares this calendar month (MTD) against the Targets tab'+(anyTg?'':' — add SPECIALIST rows to the Targets tab to enable targets')+'</span></div></div>';}

/* ── VISIT LOG — specialists log doctor/clinic visits from the iPad (CRM brick #1) ── */
let VISITS=null; // recent logged visits, fetched on demand
async function loadVisits(force){
  if(VISITS&&!force)return VISITS;
  try{
    if(SB){
      const since=new Date(Date.now()-120*864e5).toISOString().slice(0,10);
      const {data}=await SB.from('visits').select('id,date,spec,account,type,outcome,notes,status,fu_done').gte('date',since).order('date',{ascending:false}).limit(2000);
      VISITS=data||[];
    }else{
      const r=await fetch('/.netlify/functions/visits?months=4',{headers:await sbAuthHeaders()});const d=await r.json();VISITS=d.visits||[];
    }
  }catch(e){VISITS=VISITS||[];}
  return VISITS;
}
/* Specialist ROSTER: order tags + Targets tab, plus manually added names, minus
   deactivated ones. Deactivating hides a PS from pickers & target setting only —
   every historical record stays. */
let SPEC_ROSTER=null;
async function loadSpecRoster(force){
  if(SPEC_ROSTER&&!force)return SPEC_ROSTER;
  SPEC_ROSTER=[];
  if(SB){try{const {data}=await SB.from('spec_roster').select('spec,active');SPEC_ROSTER=data||[];}catch(e){}}
  return SPEC_ROSTER;
}
function specNames(){ // picker options: Shopify tags, else Targets tab, so it's never empty
  let s=Object.keys(specMerged());
  if(!s.length)s=[...new Set((TARGETS||[]).filter(t=>t.scope==='SPECIALIST').map(t=>t.name))];
  const R=SPEC_ROSTER||[];
  const inact=new Set(R.filter(r=>!r.active).map(r=>specCanon(r.spec).toLowerCase()));
  const extra=R.filter(r=>r.active).map(r=>r.spec);
  s=[...new Set([...s,...extra])].filter(n=>!inact.has(specCanon(n).toLowerCase()));
  return s.sort((a,b)=>a.localeCompare(b));
}
async function specAdd(){
  if(!canManage())return alert('Admins and sales managers only.');
  const n=prompt('New product specialist name (as it will appear on orders/visits):','');
  if(!n||!n.trim())return;
  try{
    const {error}=await SB.from('spec_roster').upsert({spec:n.trim(),active:true,updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()});
    if(error)throw error;
    audit('specialist.add',{spec:n.trim()});
    await loadSpecRoster(true);
    if(currentView==='targets')renderTargets();
  }catch(e){alert('Could not add: '+(e.message||e)+(String(e.message||'').includes('spec_roster')?'\n\n(Run the spec_roster SQL from SUPABASE-SETUP.md.)':''));}
}
async function specDeact(n){
  if(ROLE!=='admin')return alert('Admins only.');
  if(!confirm('Deactivate '+n+'?\n\nThey disappear from target setting and the order/visit pickers. All their history stays, and you can reactivate anytime.'))return;
  try{
    const {error}=await SB.from('spec_roster').upsert({spec:n,active:false,updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()});
    if(error)throw error;
    audit('specialist.deactivate',{spec:n});
    await loadSpecRoster(true);
    if(currentView==='targets')renderTargets();
  }catch(e){alert('Could not deactivate: '+(e.message||e));}
}
async function specReact(n){
  if(ROLE!=='admin')return;
  try{
    const {error}=await SB.from('spec_roster').update({active:true,updated_by:(SBUSER&&SBUSER.id)||null,updated_at:new Date().toISOString()}).eq('spec',n);
    if(error)throw error;
    audit('specialist.reactivate',{spec:n});
    await loadSpecRoster(true);
    if(currentView==='targets')renderTargets();
  }catch(e){alert(e.message||e);}
}
function renderLogVisit(){
  if(!SHOPIFY)try{loadShopify().then(()=>{if(currentView==='logvisit')renderLogVisit();});}catch(e){}
  const specs=specNames();
  const accounts=[...new Set([...Object.keys((SHOPIFY&&SHOPIFY.customers)||{}),...(CUSTOMERS||[]).map(c=>c.name)])].filter(a=>a&&!/pull\s*-?\s*out/i.test(a)).sort();
  const today=new Date().toISOString().slice(0,10);
  const preAcct=window._lvAccount||'';window._lvAccount='';
  const preDate=window._lvDate||'';setTimeout(()=>{window._lvDate='';},0);
  const myTag=(SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const last=myTag||localStorage.getItem('hs_visit_spec')||'';
  const lockSpec=!!myTag&&ROLE==='sales'; // logged-in specialists log as themselves
  const inp='style="width:100%;box-sizing:border-box;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:12px;font-size:14px"';
  const lbl='style="font-size:11.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin:12px 0 5px;display:block"';
  $('content').innerHTML=
    '<div style="max-width:520px">'+
    '<div class="panel" style="padding:18px">'+
    '<label '+lbl+'>Specialist</label>'+
    (lockSpec?'<input id="lv-spec" value="'+esc(myTag)+'" readonly '+inp.slice(0,-1)+';opacity:.75">':
    '<select id="lv-spec" '+inp+'>'+'<option value=""></option>'+specs.map(s=>'<option'+(s===last?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select>')+
    '<label '+lbl+'>Account / doctor / clinic</label>'+
    '<input id="lv-acct" list="lv-accts" value="'+esc(preAcct)+'" placeholder="Start typing — or enter a new account" onchange="dupeHint(\'lv-acct\',\'lv-dupe\')" '+inp+'>'+
    '<datalist id="lv-accts">'+accounts.map(a=>'<option value="'+esc(a)+'">').join('')+'</datalist>'+
    '<div id="lv-dupe"></div>'+
    '<label '+lbl+'>Visit type</label>'+
    '<select id="lv-type" '+inp+'><option>Clinic visit</option><option>Call / follow-up</option><option>Product demo</option><option>Delivery / after-sales</option><option>Event / congress</option></select>'+
    '<label '+lbl+'>Outcome</label>'+
    '<select id="lv-out" '+inp+'><option>Ordered</option><option>Follow-up needed</option><option>Left samples</option><option>No order</option><option>New account opened</option></select>'+
    '<label '+lbl+'>Products endorsed <span style="text-transform:none;font-weight:400">(pitched to the doctor — tap to add)</span></label>'+
    '<input id="lv-prod" list="lv-prods" placeholder="Start typing a product…" onchange="lvAddProd()" '+inp+'>'+
    '<datalist id="lv-prods">'+DATA.map(p=>'<option value="'+esc(p.name)+'">').join('')+'</datalist>'+
    '<div id="lv-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"></div>'+
    '<label '+lbl+'>Date <span style="text-transform:none;font-weight:400">(a future date = planned visit)</span></label><input id="lv-date" type="date" value="'+esc(window._lvDate||today)+'" '+inp+'>'+
    '<label '+lbl+'>Notes (optional)</label><textarea id="lv-notes" rows="2" placeholder="e.g. interested in Cosmelan, follow up next week" '+inp+'></textarea>'+
    '<div id="lv-msg" style="min-height:18px;font-size:12px;margin-top:8px"></div>'+
    '<button id="lv-btn" onclick="submitVisit()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px">Log visit</button>'+
    '</div>'+
    '<div id="lv-recent" style="margin-top:14px"></div></div>';
  window._lvProds=[];
  renderRecentVisits();
}
function lvAddProd(){
  const el=$('lv-prod');if(!el)return;
  const v=el.value.trim();if(!v)return;
  window._lvProds=window._lvProds||[];
  if(!window._lvProds.includes(v))window._lvProds.push(v);
  el.value='';
  lvChips();
}
function lvDelProd(i){(window._lvProds||[]).splice(i,1);lvChips();}
function lvChips(){
  const box=$('lv-chips');if(!box)return;
  box.innerHTML=(window._lvProds||[]).map((p,i)=>'<span style="display:inline-flex;align-items:center;gap:5px;background:var(--bl-bg);color:var(--bl);border-radius:14px;padding:4px 10px;font-size:12px">'+esc(p)+'<a href="#" onclick="lvDelProd('+i+');return false" style="color:var(--bl);font-weight:700;text-decoration:none">×</a></span>').join('');
}
async function renderRecentVisits(){
  const box=$('lv-recent');if(!box)return;
  const vs=await loadVisits();
  const mine=(localStorage.getItem('hs_visit_spec')||'');
  const show=vs.filter(v=>!mine||v.spec===mine).slice(0,10);
  if(!$('lv-recent'))return;
  box.innerHTML=show.length?'<div class="panel" style="padding:14px"><div class="phd">Recent logged visits'+(mine?' — '+esc(mine):'')+'</div>'+
    show.map(v=>'<div class="drow" style="align-items:flex-start"><span class="dlbl" style="max-width:280px"><b>'+esc(v.account)+'</b> · '+esc(v.date)+'<br><span style="color:var(--tx3)">'+esc(v.type)+' · '+esc(v.outcome)+(v.products?' · <b>endorsed:</b> '+esc(v.products):'')+(v.notes?' · '+esc(v.notes):'')+'</span></span><span class="dval">'+esc(v.spec)+'</span></div>').join('')+'</div>':'';
}
async function submitVisit(){
  const g=id=>($(id)&&$(id).value||'').trim();
  const msg=$('lv-msg'),btn=$('lv-btn');
  const spec=g('lv-spec'),account=g('lv-acct');
  if(!spec||!account){if(msg){msg.style.color='var(--rd)';msg.textContent='Pick your name and the account.';}return;}
  if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    if(SB&&SBUSER){
      const dt=g('lv-date')||new Date().toISOString().slice(0,10);
      const planned=dt>new Date().toISOString().slice(0,10); // future date = planned visit
      const prods=(window._lvProds||[]).join(', ')||null;
      const {error}=await SB.from('visits').insert({spec,account,type:g('lv-type'),outcome:planned?'Planned':g('lv-out'),date:dt,notes:g('lv-notes'),products:prods,user_id:SBUSER.id,status:planned?'planned':'done'});
      if(error)throw new Error(error.message);
    }else{
      const r=await fetch('/.netlify/functions/visits',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),
        body:JSON.stringify({spec,account,type:g('lv-type'),outcome:g('lv-out'),date:g('lv-date'),notes:g('lv-notes')})});
      const d=await r.json();
      if(d.error)throw new Error(d.error);
    }
    localStorage.setItem('hs_visit_spec',spec);
    if(msg){msg.style.color='var(--gr)';msg.textContent='Saved — '+account+' logged.';}
    if($('lv-acct'))$('lv-acct').value='';if($('lv-notes'))$('lv-notes').value='';
    window._lvProds=[];lvChips();
    VISITS=null;renderRecentVisits();
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not save: '+e.message;}}
  if(btn){btn.disabled=false;btn.textContent='Log visit';}
}

/* ── ORDER TAKING (native orders — the Shopify replacement, pilot) ── */
let NORDERS=null,CUR_ORDER=null,ORDER_BACK='orders';
const fmtOrdNum=n=>'HS-'+String(1000+Number(n||0));
async function loadNativeOrders(force){
  // cached; mutations set NORDERS=null; auto-refreshes when older than 2 minutes
  const fresh=Date.now()-(window._nordTs||0)<120000;
  if(NORDERS&&fresh&&!force)return NORDERS;
  if(NORDERS&&fresh&&force)return NORDERS;   // even "force" respects the 2-min window
  if(!SB){NORDERS=[];return NORDERS;}
  try{
    // lean headers only (no line-count join — that was the slow part), pages in PARALLEL
    const COLS='id,num,date,account,spec,status,total,deleted_at,source,ext_ref,pay_status,paid,balance,terms_days,approved';
    const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
    const q=()=>{
      let x=SB.from('orders').select(COLS).order('date',{ascending:false}).order('id',{ascending:true});
      if(myTag){ // specialists only ever see their own — fetch just those (near-instant)
        const names=[myTag,...Object.keys(SPEC_ALIAS).filter(k=>(SPEC_ALIAS[k]||'').toLowerCase()===myTag.toLowerCase())];
        x=x.or(names.map(n=>'spec.ilike.'+n.replace(/[,()]/g,'')).join(','));
      }
      return x;
    };
    const first=await q().range(0,999);
    NORDERS=first.data||[];
    window._nordTs=Date.now();
    window._MIGRATED=NORDERS.some(o=>o.source==='shopify');
    if((first.data||[]).length===1000){ // more pages exist — hydrate them in parallel
      const {count}=await SB.from('orders').select('id',{count:'exact',head:true});
      const pages=Math.min(20,Math.max(1,Math.ceil((count||1000)/1000)));
      const reqs=[];for(let i=1;i<pages;i++)reqs.push(q().range(i*1000,(i+1)*1000-1));
      const res=await Promise.all(reqs);
      NORDERS=[...NORDERS,...res.flatMap(r=>r.data||[])];
      window._MIGRATED=NORDERS.some(o=>o.source==='shopify');
    }
  }catch(e){NORDERS=NORDERS||[];}
  return NORDERS;
}
const ordLabel=o=>o.source==='shopify'?(o.ext_ref||''):fmtOrdNum(o.num);
const ordItems=o=>Array.isArray(o.order_lines)?(o.order_lines.length&&o.order_lines[0]&&typeof o.order_lines[0].count==='number'?o.order_lines[0].count:o.order_lines.length):null;
let CART=[];
function renderNewOrder(){
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in with your Healthspan account to take orders.</div>';return;}
  if(!SHOPIFY)try{loadShopify().then(()=>{if(currentView==='neworder')renderNewOrder();});}catch(e){}
  if(!NORDERS)loadNativeOrders().then(()=>{if(currentView==='neworder')noAcctChanged();}); // credit check data
  try{if(SB)loadPromos();}catch(e){} // live promos auto-apply on add-to-order
  try{if(SB)loadReservations();}catch(e){} // ATP: stock already promised to pending orders
  const myTag=(SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const specs=specNames();
  const accounts=acctList().map(r=>r.name);
  const E=window._EDITORD||null; // edit mode: reuse this form to modify an existing order
  const preAcct=(E&&E.account)||window._noAccount||'';window._noAccount='';
  const inp='style="width:100%;box-sizing:border-box;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:14px"';
  const lbl='style="font-size:11.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin:12px 0 5px;display:block"';
  const prodOpts=DATA.filter(p=>p.price>0||stk(p)>0).map(p=>'<option value="'+esc(p.name)+' ('+esc(p.sku)+')">'+(p.price>0?fmtPeso(p.price):'no price')+'</option>').join('');
  $('content').innerHTML=
    '<div style="max-width:680px">'+
    (E?'<div class="panel" style="padding:12px 16px;margin-bottom:14px;border-left:3px solid var(--am);display:flex;align-items:center;gap:10px"><b style="font-size:13px">✎ Editing '+esc(E.label)+'</b><span style="font-size:11.5px;color:var(--tx3)">change the lines/details below, then Save</span><span style="flex:1"></span>'+
      '<a href="#" onclick="cancelOrderEdit();return false" style="color:var(--rd);font-size:12px">Cancel edit</a></div>':'')+
    '<div class="panel" style="padding:18px;margin-bottom:14px">'+
    '<label '+lbl+'>Account / doctor / clinic</label>'+
    '<input id="no-acct" list="no-accts" value="'+esc(preAcct)+'" placeholder="Start typing…" onchange="noAcctChanged()" '+inp+'>'+
    '<datalist id="no-accts">'+accounts.map(a=>'<option value="'+esc(a)+'">').join('')+'</datalist>'+
    '<div id="no-credit"></div>'+
    '<div class="g2" style="gap:10px"><div><label '+lbl+'>Specialist</label>'+
    (myTag&&ROLE==='sales'?'<input id="no-spec" value="'+esc(myTag)+'" readonly '+inp.slice(0,-1)+';opacity:.75">':
    '<select id="no-spec" '+inp+'>'+specs.map(s=>'<option>'+esc(s)+'</option>').join('')+'</select>')+
    '</div><div><label '+lbl+'>Date</label><input id="no-date" type="date" value="'+esc((E&&E.date)||new Date().toISOString().slice(0,10))+'" '+inp+'></div></div>'+
    '</div>'+
    '<div class="panel" style="padding:18px;margin-bottom:14px"><div class="phd">Add products</div>'+
    '<label '+lbl+'>Product</label><input id="no-prod" list="no-prods" oninput="noProdChanged()" placeholder="Start typing or select…" '+inp+'>'+
    '<datalist id="no-prods">'+prodOpts+'</datalist>'+
    '<div class="g2" style="gap:10px"><div><label '+lbl+'>Pricing</label><select id="no-deal" '+inp+'><option value="">À la carte</option></select></div>'+
    '<div><label '+lbl+'>Qty <span style="text-transform:none;font-weight:400">(sets, for deals)</span></label><input id="no-qty" type="number" min="1" value="1" '+inp+'></div></div>'+
    '<label style="display:flex;align-items:center;gap:8px;margin:10px 0;font-size:12.5px"><input type="checkbox" id="no-free"> Free of charge (sample / goodwill)</label>'+
    '<button onclick="addCartLine()" style="width:100%;background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:13.5px;font-weight:600;cursor:pointer">+ Add to order</button>'+
    '<div id="no-cart" style="margin-top:12px"></div>'+
    '</div>'+
    '<div class="panel" style="padding:18px">'+
    '<label '+lbl+'>Order notes (optional)</label><textarea id="no-notes" rows="2" '+inp+'>'+esc((E&&E.notes)||'')+'</textarea>'+
    '<div id="no-msg" style="min-height:18px;font-size:12px;margin:10px 0 4px"></div>'+
    '<button id="no-btn" onclick="submitOrder()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">'+(E?'Save changes to '+esc(E.label):'Submit order')+'</button>'+
    (flagOn('native_only_orders')?'':'<div style="font-size:10.5px;color:var(--tx3);margin-top:10px">Pilot: keep entering the order in Shopify too — we cut over once the parallel run checks out.</div>')+
    '</div></div>';
  if(E&&E.spec&&$('no-spec'))$('no-spec').value=E.spec;
  renderCart();
}
/* Edit an existing native order: load it into the order form (specialists: own orders only) */
async function editOrder(id){
  if(!SB)return;
  const {data:o}=await SB.from('orders').select('*,order_lines(*)').eq('id',id).maybeSingle();
  if(!o)return alert('Order not found.');
  if(o.source==='shopify')return alert('This order came from Shopify — edit it there; the sync brings changes over.');
  if(o.status!=='pending')return alert('Only pending orders can be edited — unfulfill/reopen it first.');
  const own=SBUSER&&o.user_id===SBUSER.id;
  if(!canManage()&&!own)return alert('You can only edit your own orders.');
  window._EDITORD={id:o.id,label:ordLabel(o),account:o.account,spec:o.spec,date:o.date,notes:o.notes||'',paid:o.paid||0};
  CART=(o.order_lines||[]).map(l=>({sku:l.sku,name:l.name,qty:l.qty,price:l.price,amount:l.amount,is_free:l.is_free,deal:l.deal}));
  showView('neworder',null);
}
function cancelOrderEdit(){
  const E=window._EDITORD;window._EDITORD=null;CART=[];
  if(E)showOrderPage(E.id);else showView('orders',null);
}
function noProdResolve(){
  const v=(($('no-prod')&&$('no-prod').value)||'').trim();
  if(!v)return null;
  const m=v.match(/\(([^()]+)\)\s*$/);                                  // "Name (SKU)" from the picker
  if(m){const p=DATA.find(x=>x.sku.toLowerCase()===m[1].trim().toLowerCase());if(p)return p;}
  let p=DATA.find(x=>x.sku.toLowerCase()===v.toLowerCase());            // raw SKU typed
  if(p)return p;
  const c=DATA.filter(x=>x.name.toLowerCase().startsWith(v.toLowerCase()));
  return c.length===1?c[0]:null;                                        // unique name prefix
}
function noProdChanged(){
  const p=noProdResolve();
  const sel=$('no-deal');if(!sel)return;
  let html='<option value="">À la carte'+(p&&p.price>0?' — '+fmtPeso(p.price)+'/u':'')+'</option>';
  if(p&&p.deals)p.deals.forEach((d,i)=>{if(d.setSize&&d.price>0)html+='<option value="'+i+'">'+esc(d.title)+' — '+fmtPeso(d.price)+'/set</option>';});
  sel.innerHTML=html;
  try{ // ATP hint: what can this order still promise?
    const msg=$('no-msg');
    if(p&&msg&&typeof reservedQty==='function'){
      const onHand=stk(p);
      if(onHand!==null){
        const promised=reservedQty(p.sku);
        const atp=onHand-promised;
        msg.style.color=atp<=0?'var(--rd)':promised>0?'var(--am)':'var(--tx3)';
        msg.textContent=onHand+' on hand'+(promised>0?' · '+promised+' promised to pending orders':'')+' · '+Math.max(0,atp)+' available to promise';
      }
    }
  }catch(e){}
}
function addCartLine(){
  const p=noProdResolve();
  const sku=p?p.sku:'';
  const msg=$('no-msg');
  if(!p){if(msg){msg.style.color='var(--rd)';msg.textContent='Pick a product from the list (or type its exact SKU).';}return;}
  const sets=Math.max(1,parseInt(($('no-qty')&&$('no-qty').value)||'1',10)||1);
  const dealIx=($('no-deal')&&$('no-deal').value)||'';
  const free=$('no-free')&&$('no-free').checked;
  // ── ATP guard: this order commits stock; two orders can't promise the same units
  try{
    const onHand=stk(p);
    if(onHand!==null&&typeof reservedQty==='function'){
      const addUnits=(dealIx!==''&&p.deals&&p.deals[dealIx])?sets*p.deals[dealIx].setSize:sets;
      const inCart=CART.filter(l=>l.sku===sku).reduce((a,l)=>a+(l.qty||0),0);
      const promised=reservedQty(sku);
      const atp=onHand-promised-inCart;
      if(addUnits>atp){
        const info='Only '+Math.max(0,atp)+' available to promise — '+onHand+' on hand, '+promised+' already promised to pending orders'+(inCart?', '+inCart+' in this order':'')+'.';
        if(!canManage()){if(msg){msg.style.color='var(--rd)';msg.textContent=info+' Reduce the quantity or check with your manager.';}return;}
        if(!confirm(info+'\n\nAdd anyway? (manager override — the shortfall becomes a backorder problem)'))return;
      }
    }
  }catch(e){}
  if(free){CART.push({sku,name:p.name,qty:sets,price:0,amount:0,is_free:true,deal:null});}
  else if(dealIx!==''&&p.deals&&p.deals[dealIx]){
    const d=p.deals[dealIx];const per=d.setSize-1;
    CART.push({sku,name:p.name,qty:sets*per,price:Math.round(d.price/per),amount:Math.round(sets*d.price),is_free:false,deal:(d.title.match(/\d+\s*\+\s*\d+/)||[d.title])[0]});
    CART.push({sku,name:p.name,qty:sets,price:0,amount:0,is_free:true,deal:(d.title.match(/\d+\s*\+\s*\d+/)||[d.title])[0]});
  }else{
    if(!(p.price>0)){if(msg){msg.style.color='var(--rd)';msg.textContent='No price on file — tick “free of charge” or fix the price first.';}return;}
    const pr=(typeof promoFor==='function')?promoFor(sku):null; // live promo? applies automatically
    if(pr&&pr.mechanic==='pct'&&pr.pct>0){
      const up=Math.round(p.price*(1-pr.pct/100));
      CART.push({sku,name:p.name,qty:sets,price:up,amount:Math.round(sets*up),is_free:false,deal:pr.name});
      window._promoMsg='Promo applied: '+pr.name+' ('+pr.pct+'% off)';
    }else{
      CART.push({sku,name:p.name,qty:sets,price:p.price,amount:Math.round(sets*p.price),is_free:false,deal:null});
      if(pr&&pr.mechanic==='nplusm'&&pr.buy_n>0&&sets>=pr.buy_n){
        const fq=Math.floor(sets/pr.buy_n)*(pr.free_m||0);
        if(fq>0){CART.push({sku,name:p.name,qty:fq,price:0,amount:0,is_free:true,deal:pr.name});window._promoMsg='Promo applied: '+pr.name+' — +'+fq+' free';}
      }
    }
  }
  if(msg){if(window._promoMsg){msg.style.color='var(--gr)';msg.textContent=window._promoMsg;window._promoMsg=null;}else msg.textContent='';}
  if($('no-free'))$('no-free').checked=false;
  renderCart();
}
function rmCartLine(i){CART.splice(i,1);renderCart();}
function renderCart(){
  const box=$('no-cart');if(!box)return;
  if(!CART.length){box.innerHTML='<div style="font-size:12px;color:var(--tx3)">No items yet.</div>';return;}
  const tot=CART.reduce((a,l)=>a+l.amount,0);
  box.innerHTML='<table style="width:100%;font-size:12.5px"><thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>'+
    CART.map((l,i)=>'<tr><td>'+esc(l.name)+(l.deal?' <span class="pill pbl">'+esc(l.deal)+'</span>':'')+(l.is_free?' <span class="pill" style="background:var(--pu-bg);color:var(--pu)">free</span>':'')+'</td>'+
      '<td style="text-align:right">'+l.qty+'</td><td style="text-align:right">'+(l.amount?fmtPeso(l.amount):'₱0')+'</td>'+
      '<td style="text-align:right"><a href="#" onclick="rmCartLine('+i+');return false" style="color:var(--rd)">✕</a></td></tr>').join('')+
    '</tbody></table><div style="text-align:right;font-weight:700;font-size:15px;margin-top:10px">Total '+fmtPeso(tot)+'</div>';
}
async function submitOrder(){
  const msg=$('no-msg'),btn=$('no-btn');
  const account=($('no-acct')&&$('no-acct').value||'').trim();
  const spec=($('no-spec')&&$('no-spec').value||'').trim();
  if(!account||!spec||!CART.length){if(msg){msg.style.color='var(--rd)';msg.textContent='Need an account, a specialist, and at least one item.';}return;}
  if(btn){btn.disabled=true;btn.textContent='Submitting…';}
  try{
    const total=CART.reduce((a,l)=>a+l.amount,0);
    const E=window._EDITORD;
    if(E){ // EDIT: replace details + lines on the existing order
      const paid=E.paid||0;
      const balance=Math.max(0,total-paid);
      const pay_status=balance<=0&&paid>0?'paid':paid>0?'partial':'pending';
      const {error}=await SB.from('orders').update({account,spec,date:($('no-date')&&$('no-date').value)||undefined,notes:($('no-notes')&&$('no-notes').value||'').trim(),total,balance,pay_status}).eq('id',E.id);
      if(error)throw new Error(error.message);
      const {error:eD}=await SB.from('order_lines').delete().eq('order_id',E.id);
      if(eD)throw new Error('Could not replace the lines: '+eD.message);
      const {error:e2}=await SB.from('order_lines').insert(CART.map(l=>({order_id:E.id,sku:l.sku,name:l.name,qty:l.qty,price:l.price,amount:l.amount,is_free:l.is_free,deal:l.deal})));
      if(e2)throw new Error('Details saved but lines failed — re-edit the order: '+e2.message);
      audit('order.edit',{order:E.label,account,spec,total});
      const id=E.id;window._EDITORD=null;CART=[];NORDERS=null;
      showOrderPage(id);
      return;
    }
    // anomaly detection (non-blocking): 3× usual order size, unusually deep discounts
    let anomalies=[];
    try{
      const prior=(NORDERS||[]).filter(o=>!o.deleted_at&&o.status!=='cancelled'&&(o.total||0)>0&&String(o.account||'').trim().toLowerCase()===account.toLowerCase()).map(o=>o.total).sort((a,b)=>a-b);
      if(prior.length>=3){
        const med=prior[Math.floor(prior.length/2)];
        if(med>0&&total>=3*med)anomalies.push('order is '+(total/med).toFixed(1)+'× this account\u2019s usual size (median '+fmtPeso(med)+')');
      }
      const deep=CART.filter(l=>!l.is_free&&!l.deal&&l.price>0).filter(l=>{const p=DATA.find(d=>d.sku===l.sku);return p&&p.price>0&&l.price<p.price*0.7;}).map(l=>l.name);
      if(deep.length)anomalies.push('deep discount (>30% below list) on: '+deep.join(', '));
    }catch(e){}
    // credit / big-order holds: specialist orders that trip a limit are held for approval
    let holdReason=null;
    if(ROLE==='sales'){
      try{
        const lim=creditLimitOf(account);
        if(lim!=null&&(openExposure(account)+total)>lim)holdReason='Credit limit ₱'+lim.toLocaleString()+' exceeded (open ₱'+openExposure(account).toLocaleString()+' + this ₱'+total.toLocaleString()+')';
        const thr=parseInt((FLAGS&&FLAGS.approval_threshold)||'',10);
        if(!holdReason&&thr>0&&total>thr)holdReason='Order above the ₱'+thr.toLocaleString()+' approval threshold';
      }catch(e){}
    }
    const {data:ord,error}=await SB.from('orders').insert({account,spec,date:($('no-date')&&$('no-date').value)||undefined,notes:($('no-notes')&&$('no-notes').value||'').trim(),total,user_id:SBUSER.id,pay_status:'pending',paid:0,balance:total,approved:!holdReason}).select().single();
    if(error)throw new Error(error.message);
    if(holdReason){
      try{
        await SB.from('approvals').insert({kind:holdReason.startsWith('Credit')?'credit':'threshold',order_id:ord.id,order_label:fmtOrdNum(ord.num),account,amount:total,reason:holdReason,requested_by:SBUSER.id,requested_name:(SBPROFILE&&SBPROFILE.name)||spec});
        audit('approval.request',{order:fmtOrdNum(ord.num),reason:holdReason});
        try{notify({roles:['manager','admin']},'approval','Approval needed: '+fmtOrdNum(ord.num),account+' · '+fmtPeso(total)+' — '+holdReason,'#/v/approvals');}catch(e){}
        if(msg){msg.style.color='var(--am)';msg.textContent='Order '+fmtOrdNum(ord.num)+' saved — HELD for manager approval ('+holdReason+').';}
      }catch(e){}
    }
    const {error:e2}=await SB.from('order_lines').insert(CART.map(l=>({order_id:ord.id,sku:l.sku,name:l.name,qty:l.qty,price:l.price,amount:l.amount,is_free:l.is_free,deal:l.deal})));
    if(e2)throw new Error('Order saved but lines failed: '+e2.message);
    CART=[];NORDERS=null;
    audit('order.create',{order:fmtOrdNum(ord.num),account,spec,total});
    if(!holdReason)try{notify({roles:['supply_chain']},'order','New order '+fmtOrdNum(ord.num),account+' · '+fmtPeso(total)+' — ready to pick','#/v/fulfillq');}catch(e){}
    if(anomalies.length)try{
      notify({roles:['manager','admin']},'auto','Anomaly: '+fmtOrdNum(ord.num)+' ('+account+')',anomalies.join(' · '),'#/v/orders');
      audit('order.anomaly',{order:fmtOrdNum(ord.num),flags:anomalies.join(' | ').slice(0,300)});
    }catch(e){}
    if(msg){msg.style.color='var(--gr)';msg.textContent='Order '+fmtOrdNum(ord.num)+' submitted.';}
    showOrderPage(ord.id);
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not submit: '+e.message;}}
  if(btn){btn.disabled=false;btn.textContent='Submit order';}
}
async function renderOrders(){
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  const [os]=await Promise.all([loadNativeOrders(true),loadOverrides(true)]);
  const myTag=(SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const mine=o=>!myTag||specCanon(o.spec).toLowerCase()===specCanon(myTag).toLowerCase();
  const isAdmin=ROLE==='admin';
  const trash=!!window._ordTrash&&isAdmin;
  // ONE register: native orders + every imported Shopify order (overrides applied)
  const nat=os.map(o=>({ref:o.id,label:ordLabel(o),date:o.date,account:acctDedup(o.account||''),spec:o.spec,items:ordItems(o),total:o.total,status:o.status,native:true,del:!!o.deleted_at,src:o.source}));
  // pre-migration only: blob-imported Shopify orders (once migrated, the table has them all)
  const shop=window._MIGRATED?[]:((SHOPIFY&&SHOPIFY.recent)||[]).map(s=>{const v=OVR[s.n]||{};
    return {ref:s.n,label:s.n,date:s.dt,account:acctDedup(s.c||''),spec:s.t||'',items:(s.ls||[]).length,total:(s.ls||[]).reduce((a,l)=>a+(l[2]||0),0),status:v.status||'imported',native:false,del:!!v.deleted_at};});
  const rows=[...nat,...shop].filter(mine).filter(o=>trash?o.del:!o.del).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const trashN=[...nat,...shop].filter(o=>o.del).length;
  // pagination: 50 per page by default, toggle 50/100/250
  const per=[50,100,250].includes(window._ordPer)?window._ordPer:50;
  const pages=Math.max(1,Math.ceil(rows.length/per));
  const page=Math.min(Math.max(1,window._ordPage||1),pages);
  window._ordPage=page;
  const shown=rows.slice((page-1)*per,page*per);
  const pageBtn=(p,label,on)=>'<button onclick="window._ordPage='+p+';renderOrders()" '+(on?'disabled style="background:var(--ac);color:#fff;':'style="background:var(--sf2);color:var(--tx);')+'border:1px solid var(--bd);border-radius:6px;padding:5px 10px;font-size:11.5px;cursor:pointer;min-width:32px">'+label+'</button>';
  let pager='';
  if(pages>1){
    const around=[...new Set([1,2,page-1,page,page+1,pages-1,pages])].filter(p=>p>=1&&p<=pages).sort((a,b)=>a-b);
    let items='';let prev=0;
    for(const p of around){if(prev&&p-prev>1)items+='<span style="color:var(--tx3);padding:0 2px">…</span>';items+=pageBtn(p,p,p===page);prev=p;}
    pager='<div style="display:flex;gap:5px;align-items:center;justify-content:center;margin-top:14px;flex-wrap:wrap">'+
      (page>1?pageBtn(page-1,'‹',false):'')+items+(page<pages?pageBtn(page+1,'›',false):'')+
      '<span style="font-size:11px;color:var(--tx3);margin-left:10px">'+((page-1)*per+1)+'–'+Math.min(rows.length,page*per)+' of '+rows.length.toLocaleString()+'</span>'+
      '<select onchange="window._ordPer=parseInt(this.value,10);window._ordPage=1;renderOrders()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:4px 6px;font-size:11px;margin-left:6px">'+
      [50,100,250].map(n=>'<option value="'+n+'"'+(n===per?' selected':'')+'>'+n+' / page</option>').join('')+'</select></div>';
  }else{
    pager='<div style="display:flex;justify-content:flex-end;margin-top:10px"><select onchange="window._ordPer=parseInt(this.value,10);window._ordPage=1;renderOrders()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:4px 6px;font-size:11px">'+
      [50,100,250].map(n=>'<option value="'+n+'"'+(n===per?' selected':'')+'>'+n+' / page</option>').join('')+'</select></div>';
  }
  const stPill=s=>s==='fulfilled'?'<span class="pill pgr">fulfilled</span>':s==='cancelled'?'<span class="pill prd">cancelled</span>':s==='imported'?'<span class="pill pbl">Shopify</span>':'<span class="pill" style="background:var(--am-bg);color:var(--am)">pending</span>';
  $('content').innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">'+
    '<div style="font-size:12px;color:var(--tx3)">'+(trash?'Trash — '+rows.length+' deleted orders':'')+
    (!trash?rows.length.toLocaleString()+' orders'+(myTag?' (yours)':'')+(window._MIGRATED?' — all-time register ('+nat.filter(o=>!o.del&&o.src!=='shopify').length+' entered here, '+nat.filter(o=>!o.del&&o.src==='shopify').length+' migrated from Shopify)':' — '+nat.filter(o=>!o.del).length+' entered here + '+shop.filter(o=>!o.del).length+' from Shopify (≈6-month import window)'):'')+'</div>'+
    '<div style="display:flex;gap:8px">'+
    (isAdmin?'<button onclick="window._ordTrash='+(trash?'false':'true')+';window._ordPage=1;renderOrders()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 14px;font-size:12.5px;cursor:pointer">'+(trash?'← Back to orders':'Trash ('+trashN+')')+'</button>':'')+
    (trash&&trashN?'<button onclick="emptyOrderTrash()" style="background:var(--rd);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:600;cursor:pointer">Empty trash</button>':'')+
    (!trash?'<button onclick="showView(\'neworder\',null)" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer">+ New order</button>':'')+
    '</div></div>'+
    (shown.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Order</th><th>Date</th><th>Account</th><th>Specialist</th><th style="text-align:right">Items</th><th style="text-align:right">Total</th><th>Status</th>'+(trash?'<th></th>':'')+'</tr></thead><tbody>'+
    shown.map(o=>'<tr'+(trash?'':' onclick="showOrderPage(\''+esc(String(o.ref)).replace(/'/g,'&#39;')+'\')" style="cursor:pointer"')+'><td style="font-weight:700">'+esc(o.label)+'</td><td class="mu">'+esc(o.date)+'</td>'+
      '<td style="font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(o.account||'—')+'</td><td>'+esc(o.spec||'—')+'</td>'+
      '<td class="r mu">'+(o.items==null?'—':o.items)+'</td><td class="r" style="font-weight:600">'+fmtPeso(o.total)+'</td><td>'+stPill(o.status)+'</td>'+
      (trash?'<td><button onclick="orderRestore(\''+(o.native?'native':'shopify')+'\',\''+esc(String(o.ref)).replace(/'/g,'&#39;')+'\')" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Restore</button></td>':'')+'</tr>').join('')+
    '</tbody></table></div>'+(trash?'<div class="tfooter"><span>Restore puts an order back in the register · Empty trash is permanent for orders entered here; Shopify imports keep a tombstone so they never reappear</span></div>':'')+'</div>'+pager:
    '<div class="empty" style="margin-top:30px">'+(trash?'Trash is empty.':'No orders yet — tap “+ New order” to take the first one.')+'</div>');
}
function showOrderPage(ref){
  if(currentView!=='order')ORDER_BACK=currentView||'orders';
  CUR_ORDER=String(ref);
  currentView='order';
  pushRoute('#/o/'+encodeURIComponent(CUR_ORDER));
  renderOrderPage();
}
async function renderOrderPage(){
  const ref=CUR_ORDER;if(!ref){showView(ORDER_BACK);return;}
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  let o=null,src='native';
  if(SB&&/^[0-9a-f-]{30,40}$/i.test(ref)){try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('id',ref).maybeSingle();o=data;}catch(e){}}
  if(!o&&SB&&/HG-/i.test(ref)){ // migrated Shopify order opened by its number
    try{const r1=await SB.from('orders').select('*,order_lines(*)').eq('ext_ref',ref).maybeSingle();o=r1.data;
      if(!o){const r2=await SB.from('orders').select('*,order_lines(*)').eq('ext_ref','#'+ref).maybeSingle();o=r2.data;}}catch(e){}}
  if(!o){ // Shopify order by number (e.g. #HG-10142)
    const s=((SHOPIFY&&SHOPIFY.recent)||[]).find(x=>x.n===ref||x.n===('#'+ref));
    if(s){src='shopify';
      const skuName=(()=>{const m={};DATA.forEach(p=>m[p.sku]=p.name);const bs=Object.keys(m).sort((a,b)=>b.length-a.length);return t=>{t=String(t).trim();if(m[t])return m[t];const b=bs.find(x=>t.startsWith(x)&&t.length>x.length)||bs.find(x=>x.length>=4&&t.length>x.length&&t.includes(x));return b?m[b]+' (deal)':t;};})();
      o={num:null,id:s.n,date:s.dt,account:s.c||'',spec:s.t||'',status:'imported',notes:'',total:(s.ls||[]).reduce((a,l)=>a+(l[2]||0),0),
        order_lines:(s.ls||[]).map(l=>({sku:l[0],name:skuName(l[0]),qty:l[1]||0,amount:l[2]||0,is_free:(l[2]||0)<=0,deal:null}))};}
  }
  if(!o){$('content').innerHTML='<div class="empty" style="margin-top:40px">Order not found — it may be outside the imported window.</div>';return;}
  $('ptitle').textContent=src==='shopify'?String(o.id):ordLabel(o);
  await loadOverrides();
  const ovr=src==='shopify'?(OVR[String(o.id)]||{}):{};
  const eff=src==='shopify'?(ovr.status||'imported'):o.status;
  const inTrash=src==='shopify'?!!ovr.deleted_at:!!o.deleted_at;
  const isAdmin=ROLE==='admin';
  const canStatus=isAdmin||ROLE==='supply_chain';
  const stPill=s=>s==='fulfilled'?'<span class="pill pgr">fulfilled</span>':s==='cancelled'?'<span class="pill prd">cancelled</span>':s==='imported'?'<span class="pill pbl">Shopify import</span>':'<span class="pill" style="background:var(--am-bg);color:var(--am)">pending</span>';
  const btn=(label,color,fn)=>'<button onclick="'+fn+'" style="background:'+color+';color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">'+label+'</button>';
  const act=a=>'orderAct(\''+src+'\',\''+esc(String(src==='shopify'?o.id:o.id)).replace(/'/g,'&#39;')+'\',\''+a+'\')';
  let actions='';
  if(canStatus&&SB&&!inTrash){
    if(eff!=='fulfilled'&&eff!=='cancelled')actions+=btn('Mark fulfilled','var(--gr)',act('fulfilled'));
    if(eff==='fulfilled')actions+=btn('Unfulfill','var(--am)',act('pending'));
    if(eff!=='cancelled')actions+=btn('Cancel order','var(--rd)',act('cancelled'));
    if(eff==='cancelled')actions+=btn('Reopen','var(--bl)',act('pending'));
    if(isAdmin)actions+=btn('Delete','var(--tx3)',act('trash'));
  }
  $('content').innerHTML=
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">'+
    '<a href="#" onclick="showView(\''+esc(ORDER_BACK)+'\');return false" style="color:var(--ac);font-size:12.5px">← Back</a>'+
    stPill(eff)+(inTrash?'<span class="pill prd">in trash</span>':'')+
    '<span style="flex:1"></span>'+
    (src==='native'&&o.source!=='shopify'&&eff==='pending'&&!inTrash&&(canManage()||(SBUSER&&o.user_id===SBUSER.id))?'<button onclick="editOrder(\''+o.id+'\')" style="background:var(--am);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">✎ Edit order</button>':'')+
    (src==='native'?'<button onclick="showPickSlip(\''+o.id+'\')" style="background:var(--bl);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">🖨 Pick list</button>'+
    '<button onclick="showDeliveryReceipt(\''+o.id+'\')" style="background:var(--pu);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">🖨 Delivery receipt</button>':'')+
    actions+
    '</div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Total</div><div class="met-val" style="font-size:16px">'+fmtPeso(o.total)+'</div><div class="met-sub">'+(o.order_lines||[]).length+' lines</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Account</div><div class="met-val" style="font-size:13px"><a href="#" onclick="showAccountPage(\''+esc(o.account).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac)">'+esc(o.account||'—')+'</a></div><div class="met-sub">tap for profile</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Specialist</div><div class="met-val" style="font-size:14px">'+esc(o.spec||'—')+'</div><div class="met-sub">'+esc(o.date)+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Source</div><div class="met-val" style="font-size:13px">'+(src==='shopify'?'Shopify':(o.source==='shopify'?'Shopify (migrated)':'Healthspan'))+'</div><div class="met-sub">'+(src==='shopify'?'imported order':(o.source==='shopify'?'in our database now':'entered here'))+'</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th>SKU</th><th style="text-align:right">Qty</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>'+
    (o.order_lines||[]).map(l=>'<tr><td style="font-weight:600">'+esc(l.name)+(l.deal?' <span class="pill pbl">'+esc(l.deal)+'</span>':'')+'</td><td class="mu" style="font-size:11px">'+esc(l.sku)+'</td>'+
      '<td class="r">'+l.qty+'</td><td class="r" style="font-weight:600">'+(l.amount>0?fmtPeso(l.amount):'<span style="color:var(--pu)">₱0</span>')+'</td>'+
      '<td>'+(l.is_free?'<span class="pill" style="background:var(--pu-bg);color:var(--pu)">free</span>':'')+'</td></tr>').join('')+
    '</tbody></table></div>'+(o.notes||o.order_note?'<div class="tfooter"><span>Notes: '+esc(o.notes||o.order_note)+'</span></div>':'')+'</div>'+
    (src==='native'?'<div class="panel" style="padding:14px;margin-top:14px;max-width:480px"><div class="phd">Payment</div>'+
      '<div class="drow"><span class="dlbl">Status</span><span class="dval">'+(o.pay_status==='paid'?'<span class="pill pgr">paid</span>':o.pay_status==='partial'?'<span class="pill" style="background:var(--am-bg);color:var(--am)">partial</span>':o.pay_status==='refunded'?'<span class="pill pgy">refunded</span>':'<span class="pill prd">unpaid</span>')+'</span></div>'+
      '<div class="drow"><span class="dlbl">Paid</span><span class="dval">'+fmtPeso(o.paid||0)+'</span></div>'+
      '<div class="drow"><span class="dlbl">Balance</span><span class="dval" style="font-weight:700;color:'+((o.balance||0)>0?'var(--rd)':'var(--gr)')+'">'+fmtPeso(o.balance||0)+'</span></div>'+
      (o.terms_days?'<div class="drow"><span class="dlbl">Terms</span><span class="dval">'+o.terms_days+' days</span></div>':'')+
      (canFinance()&&(o.balance||0)>0&&!inTrash?'<button onclick="recordPayment(\''+o.id+'\')" style="width:100%;background:var(--gr);color:#fff;border:none;border-radius:8px;padding:10px;font-size:12.5px;font-weight:600;cursor:pointer;margin-top:8px">+ Record payment</button>':'')+
      '</div>':'')+
    (src==='native'?(function(){
      const inp='style="flex:1;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font-size:12.5px;min-width:100px"';
      const chip=(lbl,val,fld)=>val
        ?'<div class="drow"><span class="dlbl">'+lbl+'</span><span class="dval"><span class="pill pgr">'+esc(val)+'</span>'+(canManage()?' <a href="#" onclick="shipUnmark(\''+o.id+'\',\''+fld+'\');return false" style="color:var(--tx3);font-size:10px">undo</a>':'')+'</span></div>'
        :(canManage()&&!inTrash?'<button onclick="shipMark(\''+o.id+'\',\''+fld+'\')" style="width:100%;background:var(--bl);color:#fff;border:none;border-radius:8px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;margin-top:6px">Mark '+(fld==='dispatched_at'?'dispatched':'delivered')+' today</button>':'<div class="drow"><span class="dlbl">'+lbl+'</span><span class="dval mu">—</span></div>');
      return '<div class="panel" style="padding:14px;margin-top:14px;max-width:480px"><div class="phd">Shipment</div>'+
        (canManage()&&!inTrash
          ?'<div style="display:flex;gap:8px;margin-bottom:8px"><input id="sh-courier" placeholder="Courier (e.g. LBC, Lalamove)" value="'+esc(o.courier||'')+'" '+inp+'><input id="sh-waybill" placeholder="Waybill / tracking no." value="'+esc(o.waybill||'')+'" '+inp+'>'+
           '<button onclick="shipSave(\''+o.id+'\')" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">Save</button></div>'
          :((o.courier||o.waybill)?'<div class="drow"><span class="dlbl">Courier</span><span class="dval">'+esc(o.courier||'—')+'</span></div><div class="drow"><span class="dlbl">Waybill</span><span class="dval">'+esc(o.waybill||'—')+'</span></div>':''))+
        chip('Dispatched',o.dispatched_at,'dispatched_at')+
        chip('Delivered',o.delivered_at,'delivered_at')+
        '</div>';})():'');
}
/* Status overrides for Shopify-imported orders + trash for everything (admin) */
let OVR=null;
async function loadOverrides(force){
  if(OVR&&!force)return OVR;
  OVR={};
  if(SB){try{const {data}=await SB.from('order_overrides').select('*');for(const r of (data||[]))OVR[r.ref]=r;}catch(e){}}
  return OVR;
}
async function orderAct(src,ref,action){
  if(!SB)return;
  if(action==='trash'&&ROLE!=='admin')return;
  if(!roleIn('admin','supply_chain'))return;
  const labels={fulfilled:'Mark this order fulfilled?',pending:'Reopen this order (back to pending)?',cancelled:'Cancel this order?',trash:'Move this order to the trash?'};
  if(!confirm(labels[action]||'Proceed?'))return;
  try{
    if(src==='native'){
      const patch=action==='trash'?{deleted_at:new Date().toISOString()}:{status:action};
      const {error}=await SB.from('orders').update(patch).eq('id',ref);
      if(error)throw new Error(error.message);
    }else{
      const patch={ref,updated_at:new Date().toISOString(),updated_by:SBUSER?SBUSER.id:null};
      if(action==='trash')patch.deleted_at=new Date().toISOString();else patch.status=action;
      const {error}=await SB.from('order_overrides').upsert(patch,{onConflict:'ref'});
      if(error)throw new Error(error.message);
    }
    audit('order.'+action,{order:ref.slice(0,12),src});
    NORDERS=null;OVR=null;
    if(action==='trash')showView('orders',null);else renderOrderPage();
  }catch(e){alert('Could not update: '+e.message);}
}
async function orderRestore(src,ref){
  if(!SB||ROLE!=='admin')return;
  try{
    if(src==='native'){const {error}=await SB.from('orders').update({deleted_at:null}).eq('id',ref);if(error)throw new Error(error.message);}
    else{const {error}=await SB.from('order_overrides').update({deleted_at:null}).eq('ref',ref);if(error)throw new Error(error.message);}
    audit('order.restore',{order:String(ref).slice(0,12)});
    NORDERS=null;OVR=null;renderOrders();
  }catch(e){alert('Could not restore: '+e.message);}
}
async function emptyOrderTrash(){
  if(!SB||ROLE!=='admin')return;
  if(!confirm('Permanently delete everything in the trash? This cannot be undone.'))return;
  if(!confirm('Really sure? Native orders and their lines are erased forever.'))return;
  try{
    const os=await loadNativeOrders();
    const delIds=os.filter(o=>o.deleted_at).map(o=>o.id);
    if(delIds.length){const {error}=await SB.from('orders').delete().in('id',delIds);if(error)throw new Error(error.message);}
    audit('trash.empty',{purged:delIds.length});
    NORDERS=null;OVR=null;window._ordTrash=false;renderOrders();
  }catch(e){alert('Could not empty the trash: '+e.message);}
}
