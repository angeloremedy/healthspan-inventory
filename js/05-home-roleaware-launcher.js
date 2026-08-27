/* ── HOME — role-aware launcher ── */
function homeGo(v){
  const el=[...document.querySelectorAll('.ni')].find(n=>(n.getAttribute('onclick')||'').includes("'"+v+"'"));
  showView(v,el||undefined);
}
function renderHome(){
  // stable shell: during sync the app re-renders repeatedly — if the home shell is
  // already on screen for this role, just refresh the live numbers (no flicker)
  if($('hm-live')&&window._homeRole===ROLE){try{homeLive();}catch(e){}return;}
  window._homeRole=ROLE;
  const name=(SBPROFILE&&SBPROFILE.name)||'';
  const first=(name.split(' ')[0])||'there';
  const h=new Date().getHours();
  const greet=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  const myTag=(ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const isMgr=ROLE==='sales'&&!myTag;
  const dstr=new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  // icons (24px stroke set, matches the sidebar)
  const HI={
    cart:'<path d="M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor"/><path d="M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    check:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bag:'<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    truck:'<path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/>',
    card:'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    key:'<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    scale:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'
  };
  const ic=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px">'+p+'</svg>';
  const card=(v,title,sub,icon,accent)=>'<div class="hmc'+(accent?' hmc-ac':'')+'" onclick="'+v+'">'+
    '<div class="hmc-ic">'+ic(icon)+'</div><div><div class="hmc-t">'+title+'</div><div class="hmc-s">'+sub+'</div></div></div>';
  const go=v=>'homeGo(\''+v+'\')';
  let sections=[];
  /* Role-true launchers: what you act on comes FIRST; what your role can't open never shows. */
  if(ROLE==='admin'){
    sections=[
      ['Needs you',[
        card(go('approvals'),'Approvals','Held orders waiting for a decision',HI.check,1),
        card(go('fulfillq'),'Fulfillment queue','Pending orders, oldest first',HI.truck,1),
        card(go('neworder'),'New order','Take an order in a minute',HI.cart),
        card(go('orders'),'Orders','Every order, all-time register',HI.bag)]],
      ['Money',[
        card(go('ar'),'AR aging','Who owes what, 30/60/90',HI.card),
        card(go('cashflow'),'Cash-flow forecast','Expected collections by week',HI.chart),
        card(go('pdc'),'PDC register','Cheques to maturity',HI.card),
        card(go('valuation'),'Landed cost & valuation','True margins, value at cost',HI.scale),
        card(go('returns'),'Returns & credit memos','CMs, restock or write-off',HI.bag),
        card(go('commissions'),'Commissions','Tiers & payroll CSV',HI.target)]],
      ['Sales & CRM',[
        card(go('salespace'),'Leaderboard & pace','Projected month-end per PS',HI.chart),
        card(go('salestarget'),'Vs target','Monthly attainment',HI.target),
        card(go('customers'),'Accounts','Unified customer profiles',HI.users),
        card(go('pipeline'),'Pipeline','Staged funnel & opportunities',HI.chart),
        card(go('quotes'),'Quotations','Open quotes & win rate',HI.list),
        card(go('scorecards'),'Review scorecards','Quarterly reviews, auto-filled',HI.check),
        card(go('targets'),'Set targets','Monthly ₱ per specialist',HI.target)]],
      ['Warehouse & inventory',[
        card(go('dashboard'),'Inventory dashboard','Stock health at a glance',HI.grid),
        card(go('forecast'),'Days to stockout','Which products run out, when',HI.chart),
        card(go('whkpi'),'Warehouse KPIs','Cycle time, fill rate',HI.chart),
        card(go('quarantine'),'Quarantine','Held stock & disposals',HI.scale),
        card(go('po'),'Purchase orders','Ordering & receiving',HI.truck),
        card(go('suppliers'),'Suppliers & imports','Lead times, on the water',HI.truck),
        card(go('health'),'Data health','Feed & reconciliation checks',HI.scale)]],
      ['Admin',[
        card(go('users'),'Team & access','Accounts, roles, passwords',HI.key),
        card(go('audit'),'Activity log','Who did what, when',HI.list)]
        .concat(isSuper()?[card(go('cutover'),'Cutover switches','Independence & evidence',HI.key)]:[])]
    ];
  }else if(ROLE==='manager'){
    sections=[
      ['Needs you',[
        card(go('approvals'),'Approvals','Held orders waiting for YOUR decision',HI.check,1),
        card(go('fulfillq'),'Fulfillment queue','Pending orders, oldest first',HI.truck),
        card(go('followups'),'Follow-ups','The team\u2019s open to-dos',HI.check),
        card(go('neworder'),'New order','Take an order in a minute',HI.cart)]],
      ['Coach the team',[
        card(go('salespace'),'Leaderboard & pace','Projected month-end per PS',HI.chart,1),
        card(go('salestarget'),'Vs target','Monthly attainment',HI.target),
        card(go('salesspec'),'Specialists','Per-PS drill-downs',HI.user),
        card(go('scorecards'),'Review scorecards','Quarterly reviews, auto-filled',HI.check),
        card(go('targets'),'Set targets','Monthly ₱ per specialist',HI.target),
        card(go('salesfield'),'Field coverage','Reach vs universe',HI.pin)]],
      ['CRM & orders',[
        card(go('customers'),'Accounts','Profiles, merges, prospects',HI.users),
        card(go('pipeline'),'Pipeline','Staged funnel & opportunities',HI.chart),
        card(go('quotes'),'Quotations','Whole-team quotes & win rate',HI.list),
        card(go('salesdue'),'Reorder due','Accounts past their rhythm',HI.check),
        card(go('orders'),'Orders','Register & status',HI.bag)]]
    ];
  }else if(ROLE==='supply_chain'){
    sections=[
      ['Today',[
        card(go('fulfillq'),'Fulfillment queue','Pick these, oldest first (+ backorders)',HI.truck,1),
        card(go('scan'),'Scan','Receive · pick · count',HI.grid,1),
        card(go('cyclecount'),'Cycle counts','Blind counts — cutover evidence',HI.check),
        card(go('po'),'Purchase orders','Ordering & receiving',HI.truck)]],
      ['Warehouse',[
        card(go('quarantine'),'Quarantine','Held stock, release or dispose',HI.scale),
        card(go('whkpi'),'Warehouse KPIs','Cycle time, fill rate',HI.chart),
        card(go('suppliers'),'Suppliers & imports','Lead times, on the water',HI.truck),
        card(go('recall'),'Batch recall trace','Any lot → every clinic',HI.pin),
        card(go('batches'),'Batch view','FEFO, expiry, bins',HI.list)]],
      ['Inventory',[
        card(go('dashboard'),'Inventory dashboard','Stock health at a glance',HI.grid),
        card(go('forecast'),'Days to stockout','Which products run out, when',HI.chart),
        card(go('all'),'All SKUs','Full product list',HI.list),
        card(go('health'),'Data health','Feed & reconciliation checks',HI.scale),
        card(go('orders'),'Orders','Register (read + status)',HI.bag)]]
    ];
  }else if(ROLE==='finance'){
    sections=[
      ['Today',[
        card(go('ar'),'AR aging','Who owes what, 30/60/90',HI.card,1),
        card(go('cashflow'),'Cash-flow forecast','Expected collections by week',HI.chart,1),
        card(go('pdc'),'PDC register','Cheques to maturity',HI.card),
        card(go('returns'),'Returns & credit memos','CMs, restock or write-off',HI.bag)]],
      ['Money',[
        card(go('commissions'),'Commissions','Tiers & payroll CSV',HI.target),
        card(go('valuation'),'Landed cost & valuation','True margins, value at cost',HI.scale),
        card(go('catalog'),'Item master','Prices, costs, registrations',HI.list),
        card(go('po'),'Purchase orders','Supplier AP on each PO',HI.truck),
        card(go('suppliers'),'Suppliers & imports','Terms, currencies, ETAs',HI.truck)]],
      ['Watch',[
        card(go('salesoverview'),'Sales overview','Units, value, deals split',HI.chart),
        card(go('salestarget'),'Vs target','Monthly attainment',HI.target),
        card(go('customers'),'Accounts','Profiles & statements',HI.users),
        card(go('approvals'),'Approvals','How your credit limits behave',HI.check),
        card(go('dashboard'),'Inventory dashboard','Stock as money',HI.grid)]]
    ];
  }else if(ROLE==='marketing'){
    sections=[
      ['Today',[
        card(go('campaigns'),'Campaign calendar','Demand signals & windows',HI.cal,1),
        card(go('promos'),'Promotions','Mechanics that apply themselves',HI.target,1),
        card(go('salesevents'),'Events calendar','Campaigns, demos, visits',HI.cal)]],
      ['Measure',[
        card(go('salesoverview'),'Sales overview','Uptake, any period',HI.chart),
        card(go('salestarget'),'Vs target','Monthly attainment',HI.target),
        card(go('salesfield'),'Field coverage','Reach vs universe',HI.pin),
        card(go('pipeline'),'Pipeline','Staged funnel (read)',HI.chart),
        card(go('customers'),'Accounts','Profiles & health scores',HI.users),
        card(go('forecast'),'Days to stockout','Will the promo hold?',HI.grid)]]
    ];
  }else if(circleRole()){ // viewer / IT — the weekly-meeting numbers, read-only
    sections=[
      ['The weekly numbers',[
        card(go('salesoverview'),'Sales overview','Units, value, deals split',HI.chart,1),
        card(go('salestarget'),'Vs target','Monthly attainment',HI.target),
        card(go('salespace'),'Leaderboard & pace','Projected month-end per PS',HI.chart),
        card(go('ar'),'AR aging','Receivables, 30/60/90',HI.card),
        card(go('value'),'Inventory value','Stock by line',HI.grid),
        card(go('salesevents'),'Events calendar','Campaigns, demos, visits',HI.cal),
        card(go('pipeline'),'Pipeline','Staged funnel',HI.chart),
        card(go('campaigns'),'Campaign calendar','What\u2019s running',HI.cal)]]
    ];
    if(typeof canUserAdmin==='function'&&canUserAdmin())sections.push(['Admin',[card(go('users'),'Team & access','Create / disable specialist accounts',HI.key)]]);
  }else{ // sales — the field day
    const today=[];
    today.push(card(go('neworder'),'New order','Take an order in a minute',HI.cart,1));
    today.push(card(go('logvisit'),'Log a visit','~10 seconds, right after the call',HI.pin,1));
    today.push(card(go('followups'),'Follow-ups','Your to-dos & planned visits',HI.check));
    if(myTag)today.push(card('showSpecPage(\''+esc(myTag).replace(/'/g,"\\'")+'\')','My page','Your numbers, calendar & accounts',HI.cal));
    sections=[
      ['Today',today],
      ['Sell more',[
        card(go('salesdue'),'Reorder due','Clinics past their rhythm — call first',HI.check,1),
        card(go('quotes'),'Quotations','Formal quotes → one-tap orders',HI.list),
        card(go('pipeline'),'Pipeline','Your prospects, staged',HI.chart),
        card(go('salesevents'),'Events calendar','Campaigns & your planned visits',HI.cal)]],
      ['Your numbers',[
        card(go('salespace'),'Leaderboard & pace','Where you stand mid-month',HI.chart),
        card(go('salesoverview'),'Sales overview','Units, value, deals split',HI.chart),
        card(go('salestarget'),'Vs target','Monthly attainment',HI.target),
        card(go('orders'),'Orders','Your register & statuses',HI.bag),
        card(go('complaints'),'Complaints log','File a quality report',HI.list)]]
    ];
  }
  $('content').innerHTML=
  '<style>'+
  '.hm-hero{border-radius:18px;padding:26px 28px;margin-bottom:18px;color:#fff;position:relative;overflow:hidden;'+
    'background:linear-gradient(120deg,var(--ac) 0%,color-mix(in srgb,var(--ac) 55%,#0b2e26) 100%)}'+
  '.hm-hero::after{content:"";position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.08)}'+
  '.hm-hero::before{content:"";position:absolute;right:60px;bottom:-90px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.06)}'+
  '.hm-lbl{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--tx3);margin:18px 0 10px}'+
  '.hm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:10px}'+
  '.hmc{display:flex;gap:12px;align-items:center;background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:14px 16px;cursor:pointer;transition:transform .12s,box-shadow .12s,border-color .12s}'+
  '.hmc:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.10);border-color:var(--ac)}'+
  '.hmc-ic{flex:0 0 auto;width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--ac) 12%,transparent);color:var(--ac)}'+
  '.hmc-ac .hmc-ic{background:var(--ac);color:#fff}'+
  '.hmc-t{font-weight:650;font-size:13.5px}.hmc-s{font-size:11px;color:var(--tx3);margin-top:1px}'+
  '@media(max-width:640px){.hm-hero{padding:20px 18px}.hm-grid{grid-template-columns:1fr 1fr}}'+
  '</style>'+
  '<div class="hm-hero"><div style="font-size:12px;opacity:.85;position:relative">'+esc(dstr)+'</div>'+
  '<div style="font-size:24px;font-weight:700;margin-top:2px;position:relative">'+greet+', '+esc(first)+'</div>'+
  '<div style="font-size:12.5px;opacity:.85;margin-top:4px;position:relative">'+(ROLE==='admin'?'Everything Healthspan, in one place.':ROLE==='manager'?'Sales manager view — the whole team, all accounts.':ROLE==='supply_chain'?'Supply chain view — warehouse, POs, and inventory.':ROLE==='finance'?'Finance view — receivables, cheques, and exports.':ROLE==='marketing'?'Marketing view — campaigns, pipeline, and analytics.':ROLE==='viewer'?'Viewer — the weekly-meeting numbers, live.':(myTag?'Signed in as '+esc(myTag)+' — your orders and visits log under your name.':'Manager view — you see the whole team.'))+'</div></div>'+
  '<div id="hm-live" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px"></div>'+
  '<div id="hm-attn"></div>'+
  sections.map(s=>'<div class="hm-lbl">'+s[0]+'</div><div class="hm-grid">'+s[1].join('')+'</div>').join('');
  try{homeLive();}catch(e){}
}

/* ── TEAM & ACCESS — in-app account management (admin) ── */
async function adminUsers(action,payload){
  const {data:{session}}=await SB.auth.getSession();
  if(!session)throw new Error('Sign in again');
  const r=await fetch('/.netlify/functions/admin-users',{method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
    body:JSON.stringify({action,...(payload||{})})});
  const d=await r.json();
  if(d.error)throw new Error(d.error);
  return d;
}
async function renderUsers(){
  if(!canUserAdmin()){$('content').innerHTML='<div class="empty" style="margin-top:40px">Admins only.</div>';return;}
  const psOnly=ROLE!=='admin'; // scoped PS-admin (e.g. Justine): create/disable specialists only
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading team…</div>';
  let users=[];
  try{users=(await adminUsers('list')).users||[];}
  catch(e){$('content').innerHTML='<div class="empty" style="margin-top:40px">Could not load: '+esc(e.message)+'</div>';return;}
  const inp='style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:9px 10px;font-size:13px"';
  const lbl='style="font-size:10.5px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin:8px 0 3px"';
  $('content').innerHTML=
    '<div class="g2" style="align-items:start;gap:14px">'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Tag</th><th>Last sign-in</th><th></th></tr></thead><tbody>'+
    users.map(u=>'<tr'+(u.banned?' style="opacity:.5"':'')+'><td style="font-weight:600">'+esc(u.name||'—')+(u.is_super?' <span class="pill pbl">super</span>':'')+(u.banned?' <span class="pill prd">disabled</span>':'')+'</td>'+
      '<td class="mu" style="font-size:11.5px">'+esc(u.email)+'</td>'+
      '<td>'+(u.is_super?'<span class="pill pbl" style="font-weight:700">super admin</span>':u.role==='admin'?'<span class="pill pbl">admin</span>':u.role==='manager'?'<span class="pill" style="background:rgba(127,119,221,.15);color:var(--pu)">sales manager</span>':u.role==='sales'?'<span class="pill pgr">product specialist</span>':u.role==='viewer'&&u.ps?'<span class="pill pgy">IT · PS accounts</span>':['supply_chain','finance','marketing','viewer'].includes(u.role)?'<span class="pill pgy">'+esc(u.role.replace('_',' '))+'</span>':'<span class="pill prd">'+esc(u.role)+'</span>')+'</td>'+
      '<td class="mu">'+esc(u.tag||'—')+'</td>'+
      '<td class="mu" style="font-size:11px">'+(u.last?esc(u.last.slice(0,10)):'never')+'</td>'+
      '<td style="white-space:nowrap">'+
      ((u.is_super&&u.id!==(SBUSER&&SBUSER.id))||(psOnly&&u.role!=='sales')?'<span class="pill pbl" title="Outside your scope">'+(u.is_super?'🛡 protected':'—')+'</span>':
      psOnly?((u.banned?'<a href="#" onclick="userToggle(\''+u.id+'\',\'enable\');return false" style="color:var(--gr);font-size:11.5px">enable</a>':'<a href="#" onclick="userToggle(\''+u.id+'\',\'disable\');return false" style="color:var(--rd);font-size:11.5px">disable</a>')):
      '<a href="#" onclick="userEdit(\''+u.id+'\',\''+esc(u.name).replace(/'/g,'&#39;')+'\',\''+esc(u.role)+'\',\''+esc(u.tag).replace(/'/g,'&#39;')+'\','+(u.ps?1:0)+');return false" style="color:var(--ac);font-size:11.5px">edit</a> · '+
      '<a href="#" onclick="userPass(\''+u.id+'\',\''+esc(u.name||u.email).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac);font-size:11.5px">password</a> · '+
      (isSuper()&&u.id!==(SBUSER&&SBUSER.id)?'<a href="#" onclick="userDelete(\''+u.id+'\',\''+esc(u.name||u.email).replace(/'/g,'&#39;')+'\');return false" style="color:var(--rd);font-size:11.5px;font-weight:700">delete</a> · ':'')+
      (u.banned?'<a href="#" onclick="userToggle(\''+u.id+'\',\'enable\');return false" style="color:var(--gr);font-size:11.5px">enable</a>':
      '<a href="#" onclick="userToggle(\''+u.id+'\',\'disable\');return false" style="color:var(--rd);font-size:11.5px">disable</a>'))+
      '</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>'+users.length+' accounts · disabling blocks sign-in immediately (data is kept) · you can’t disable yourself</span></div></div>'+
    '<div class="panel" style="padding:16px"><div class="phd">Add account</div>'+
    '<label '+lbl+'>Name</label><input id="au-name" '+inp+'>'+
    '<label '+lbl+'>Email</label><input id="au-email" type="email" '+inp+'>'+
    '<label '+lbl+'>Starter password (8+ chars)</label><input id="au-pass" '+inp+'>'+
    '<label '+lbl+'>Role</label><select id="au-role"'+(psOnly?' disabled':'')+' onchange="var t=$(\'au-tagwrap\');if(t)t.style.display=this.value===\'sales\'?\'block\':\'none\'" '+inp+'><option value="sales">Product specialist</option><option value="manager">Sales manager</option><option value="supply_chain">Supply chain — warehouse, POs, receiving</option><option value="finance">Finance — AR, payments, PDCs, costs</option><option value="marketing">Marketing — campaigns + circle read</option><option value="viewer">Viewer — read-only, no writes</option><option value="it">IT — viewer + manage specialist accounts</option><option value="admin">Admin — everything</option></select>'+
    '<div id="au-tagwrap"><label '+lbl+'>Specialist tag <span style="text-transform:none;font-weight:400">(blank = manager, sees all)</span></label><input id="au-tag" list="au-tags" '+inp+'>'+
    '<datalist id="au-tags">'+specNames().map(s=>'<option value="'+esc(s)+'">').join('')+'</datalist></div>'+
    '<div id="au-msg" style="min-height:16px;font-size:11.5px;margin:8px 0 4px"></div>'+
    '<button onclick="userCreate()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:8px;padding:11px;font-size:13px;font-weight:600;cursor:pointer">Create account</button>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:10px">Send them the starter password privately — they can change it in-app via the “password” link in their sidebar.</div>'+
    '</div></div>';
}
async function userCreate(){
  const g=id=>($(id)&&$(id).value||'').trim();const msg=$('au-msg');
  try{
    const rv=g('au-role');
    await adminUsers('create',{email:g('au-email'),password:g('au-pass'),name:g('au-name'),role:rv==='it'?'viewer':rv,can_manage_ps:rv==='it',tag:rv==='sales'?g('au-tag'):''});
    renderUsers();
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent=e.message;}}
}
async function userEdit(id,name,role,tag,ps){
  const nn=prompt('Name:',name);if(nn===null)return;
  let nr=prompt('Role (admin / manager / sales / supply_chain / finance / marketing / viewer / it):',ps?'it':(role==='(no profile)'?'sales':role));if(nr===null)return;
  nr=nr.trim().toLowerCase();
  const nt=nr==='sales'?prompt('Specialist tag (blank = manager, sees all):',tag||''):'';
  if(nt===null)return;
  try{await adminUsers('update',{id,name:nn.trim(),role:nr==='it'?'viewer':nr,can_manage_ps:nr==='it',tag:(nt||'').trim()});renderUsers();}
  catch(e){alert(e.message);}
}
async function userPass(id,who){
  const p=prompt('New password for '+who+' (8+ characters):','');if(!p)return;
  try{await adminUsers('password',{id,password:p});alert('Password updated for '+who+'. Send it to them privately.');}
  catch(e){alert(e.message);}
}
async function userDelete(id,who){
  if(!isSuper())return alert('Super admin only.');
  if(!confirm('PERMANENTLY DELETE '+who+'?\n\nThis removes their login entirely. If they have orders/visits on record, deletion is blocked — use disable instead.'))return;
  if(!confirm('Really sure? This cannot be undone. (Disable is the reversible option.)'))return;
  try{await adminUsers('delete',{id});renderUsers();}catch(e){alert(e.message);}
}
async function userToggle(id,act){
  if(act==='disable'&&!confirm('Disable this account? They’ll be signed out and blocked from signing in.'))return;
  try{await adminUsers(act,{id});renderUsers();}catch(e){alert(e.message);}
}

/* ── AR AGING & PAYMENTS (Phase 2) ── */
function arRows(){
  const today=Date.now();
  const open=(NORDERS||[]).filter(o=>!o.deleted_at&&o.status!=='cancelled'&&(o.balance||0)>0);
  const acc={};
  for(const o of open){
    const key=acctDedup(o.account||'(no account)');
    const due=new Date(o.date).getTime()+((o.terms_days||0)*864e5);
    const overdueDays=Math.floor((today-due)/864e5);
    const b=o.balance||0;
    const a=acc[key]||(acc[key]={name:key,total:0,cur:0,d30:0,d60:0,d90:0,n:0,oldest:''});
    a.total+=b;a.n++;
    if(!a.oldest||o.date<a.oldest)a.oldest=o.date;
    if(overdueDays<=30)a.cur+=b;else if(overdueDays<=60)a.d30+=b;else if(overdueDays<=90)a.d60+=b;else a.d90+=b;
  }
  return Object.values(acc).sort((a,b)=>b.total-a.total);
}
async function renderAR(){
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  await loadNativeOrders(true);
  const rows=arRows();
  const T2={total:0,cur:0,d30:0,d60:0,d90:0};
  rows.forEach(r=>{T2.total+=r.total;T2.cur+=r.cur;T2.d30+=r.d30;T2.d60+=r.d60;T2.d90+=r.d90;});
  const allPaid=(NORDERS||[]).filter(o=>!o.deleted_at&&o.status!=='cancelled');
  const collected=allPaid.reduce((a,o)=>a+(o.paid||0),0),booked=allPaid.reduce((a,o)=>a+(o.total||0),0);
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Total outstanding</div><div class="met-val" style="font-size:15px">'+fmtPeso(T2.total)+'</div><div class="met-sub">'+rows.length+' accounts owe</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Current (≤30d)</div><div class="met-val" style="font-size:15px">'+fmtPeso(T2.cur)+'</div><div class="met-sub">'+(T2.total?(T2.cur/T2.total*100).toFixed(0):0)+'% of AR</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">31–90 days</div><div class="met-val" style="font-size:15px">'+fmtPeso(T2.d30+T2.d60)+'</div><div class="met-sub">chase these</div><div class="met-bar"></div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="met-lbl">Over 90 days</div><div class="met-val" style="font-size:15px;color:var(--rd)">'+fmtPeso(T2.d90)+'</div><div class="met-sub">collection risk</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div style="font-size:11.5px;color:var(--tx3);margin-bottom:12px">Collection rate all-time: <b>'+(booked?(collected/booked*100).toFixed(1):0)+'%</b> ('+fmtPeso(collected)+' of '+fmtPeso(booked)+' booked) · payment statuses sync from Shopify via the backfill; ages count from order date + terms days where noted (e.g. “PDC 30 days”)</div>'+
    (canManage()?(function(){const m0=new Date();const from=new Date(m0.getFullYear(),m0.getMonth(),1).toISOString().slice(0,10);const to=new Date().toISOString().slice(0,10);
      const di='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12px"';
      return '<div class="panel" style="padding:10px 14px;margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:12px">Accounting export</b>'+
      '<input type="date" id="ax-from" value="'+from+'" '+di+'> <span style="font-size:12px;color:var(--tx3)">to</span> <input type="date" id="ax-to" value="'+to+'" '+di+'>'+
      '<button onclick="acctExportCSV()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">Download CSV</button>'+
      '<span style="font-size:11px;color:var(--tx3)">every order in the period with totals, payments, balances & terms — for the accounting sign-off</span></div>';})():'')+
    (rows.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Account</th><th style="text-align:right">Outstanding</th><th style="text-align:right">Current</th><th style="text-align:right">31–60d</th><th style="text-align:right">61–90d</th><th style="text-align:right">90d+</th><th style="text-align:right">Open</th><th style="text-align:right">Oldest</th></tr></thead><tbody>'+
    rows.slice(0,150).map(r=>'<tr onclick="showAccountPage(\''+esc(r.name).replace(/'/g,'&#39;')+'\')" style="cursor:pointer"><td style="font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</td>'+
      '<td class="r" style="font-weight:700">'+fmtPeso(r.total)+'</td>'+
      '<td class="r">'+(r.cur?fmtPeso(r.cur):'—')+'</td><td class="r" style="color:var(--am)">'+(r.d30?fmtPeso(r.d30):'—')+'</td>'+
      '<td class="r" style="color:var(--am);font-weight:600">'+(r.d60?fmtPeso(r.d60):'—')+'</td><td class="r" style="color:var(--rd);font-weight:700">'+(r.d90?fmtPeso(r.d90):'—')+'</td>'+
      '<td class="r mu">'+r.n+'</td><td class="r mu" style="font-size:11px">'+esc(r.oldest)+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Unpaid balances across all orders (migrated + native) · buckets by days past due (order date + noted terms) · tap an account for its profile · record payments on native orders from their order page</span></div></div>':
    '<div class="empty" style="margin-top:30px">No outstanding balances — everything collected. 🎉</div>');
}
async function recordPayment(id){
  if(!SB||ROLE!=='admin')return;
  const os=await loadNativeOrders();const o=os.find(x=>x.id===id);if(!o)return;
  const amt=parseFloat(prompt('Amount received (balance '+fmtPeso(o.balance||0)+'):','')||'');
  if(!amt||amt<=0)return;
  if(o.source==='shopify'&&!confirm('This is a migrated Shopify order — the payment sync will overwrite this next backfill run. Record here anyway? (Better: mark it paid in Shopify.)'))return;
  try{
    const paid=(o.paid||0)+amt;const balance=Math.max(0,(o.total||0)-paid);
    const {error}=await SB.from('orders').update({paid,balance,pay_status:balance<=0?'paid':'partial'}).eq('id',id);
    if(error)throw new Error(error.message);
    audit('payment.record',{order:ordLabel(o),account:o.account,amount:amt,newBalance:balance});
    NORDERS=null;renderOrderPage();
  }catch(e){alert('Could not record: '+e.message);}
}
function noAcctChanged(){
  const el=$('no-credit');if(!el)return;
  const name=acctDedup(($('no-acct')&&$('no-acct').value||'').trim());
  if(!name||!NORDERS){el.innerHTML='';return;}
  const open=(NORDERS||[]).filter(o=>!o.deleted_at&&o.status!=='cancelled'&&(o.balance||0)>0&&acctDedup(o.account||'')===name);
  const owe=open.reduce((a,o)=>a+o.balance,0);
  const overdue=open.filter(o=>(Date.now()-new Date(o.date).getTime())/864e5>((o.terms_days||0)+30)).reduce((a,o)=>a+o.balance,0);
  const _lim=creditLimitOf(name);
  let html=(_lim!=null&&name?'<div style="font-size:11px;color:var(--tx3);margin-top:4px">Credit limit '+fmtPeso(_lim)+' · open balance '+fmtPeso(openExposure(name))+'</div>':'');
  html+=owe?'<div style="background:'+(overdue?'var(--rd-bg)':'var(--am-bg)')+';color:'+(overdue?'var(--rd)':'var(--am)')+';border-radius:8px;padding:8px 12px;font-size:12px;margin-top:6px"><b>Credit check:</b> this account owes '+fmtPeso(owe)+' across '+open.length+' unpaid order'+(open.length>1?'s':'')+(overdue?' — '+fmtPeso(overdue)+' overdue':'')+'</div>':'';
  // duplicate-entry guard
  const sug=acctSuggest(($('no-acct')&&$('no-acct').value||'').trim());
  if(sug)html+='<div style="background:var(--am-bg);color:var(--am);border-radius:8px;padding:8px 12px;font-size:12px;margin-top:6px">⚠ Not an existing account — did you mean <a href="#" onclick="$(\'no-acct\').value=\''+esc(sug).replace(/'/g,'&#39;')+'\';noAcctChanged();return false" style="color:var(--am);font-weight:700">'+esc(sug)+'</a>? Tap to use it, or continue if it’s truly new.</div>';
  // upsell nudge for the chosen account
  try{
    const recs=name&&!sug?upsellFor(name,3):[];
    if(recs.length)html+='<div style="background:var(--bl-bg);color:var(--bl);border-radius:8px;padding:8px 12px;font-size:12px;margin-top:6px"><b>Worth offering:</b> '+recs.map(r=>esc(r.name)+' ('+Math.round(r.conf*100)+'% of similar clinics buy it)').join(' · ')+'</div>';
  }catch(e){}
  el.innerHTML=html;
}

/* ── SPECIALIST PROFILE + CALENDAR (full page) ── */
let CUR_SPEC=null,SPEC_BACK='salesspec',CAL_YM=null,CAL_SEL=null;
function showSpecPage(name){
  if(currentView!=='spec')SPEC_BACK=currentView||'salesspec';
  CUR_SPEC=specCanon(String(name||'').trim());
  currentView='spec';
  pushRoute('#/s/'+encodeURIComponent(CUR_SPEC));
  $('ptitle').textContent=CUR_SPEC;
  renderSpecPage();
  injectDesc('spec');
}
function calShift(d){const [y,m]=(CAL_YM||new Date().toISOString().slice(0,7)).split('-').map(Number);const nd=new Date(y,m-1+d,1);CAL_YM=nd.getFullYear()+'-'+String(nd.getMonth()+1).padStart(2,'0');CAL_SEL=null;renderSpecPage();}
function calPick(day){CAL_SEL=day;renderSpecPage();}
async function renderSpecPage(){
  const name=CUR_SPEC;if(!name){showView(SPEC_BACK);return;}
  await loadVisits();await loadNativeOrders();
  const specs=specMerged();const sp=specs[name]||specs[Object.keys(specs).find(k=>k.toLowerCase()===name.toLowerCase())]||{monthly:{},daily:{},skus:{}};
  const isMine=v=>specCanon(v).toLowerCase()===name.toLowerCase();
  const ymNow=new Date().toISOString().slice(0,10).slice(0,7);
  const today=new Date().toISOString().slice(0,10);
  const myVisits=(VISITS||[]).filter(v=>isMine(v.spec||''));
  const myOrders=(NORDERS||[]).filter(o=>isMine(o.spec||'')&&!o.deleted_at&&o.status!=='cancelled');
  const mc=(sp.monthly||{})[ymNow]||{u:0,v:0};
  const tg=(TARGETS||[]).find(x=>x.month===ymNow&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===name.toLowerCase());
  const fus=myVisits.filter(v=>v.status!=='planned'&&v.outcome==='Follow-up needed'&&!v.fu_done);
  const custs30=new Set(myOrders.filter(o=>o.date>=new Date(Date.now()-30*864e5).toISOString().slice(0,10)).map(o=>acctDedup(o.account||'')).filter(Boolean));
  for(const v of myVisits)if(v.date>=new Date(Date.now()-30*864e5).toISOString().slice(0,10)&&v.status!=='planned')custs30.add(acctDedup(v.account||''));
  // ── calendar data for the shown month
  CAL_YM=CAL_YM||ymNow;
  const [cy,cm]=CAL_YM.split('-').map(Number);
  const first=new Date(cy,cm-1,1);const startDow=first.getDay();const daysIn=new Date(cy,cm,0).getDate();
  const dayKey=d=>CAL_YM+'-'+String(d).padStart(2,'0');
  const byDay={};
  const addD=(d,k,item)=>{if(!d||!d.startsWith(CAL_YM))return;const o=byDay[d]||(byDay[d]={plan:[],visit:[],order:[]});o[k].push(item);};
  for(const v of myVisits)addD(v.date,v.status==='planned'?'plan':'visit',v);
  for(const o of myOrders)addD(o.date,'order',o);
  let calHtml='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'+
    '<button onclick="calShift(-1)" class="no-print" style="background:var(--sf2);border:1px solid var(--bd);color:var(--tx);border-radius:6px;padding:4px 12px;cursor:pointer">‹</button>'+
    '<b style="font-size:14px">'+new Date(cy,cm-1,1).toLocaleString("en-PH",{month:"long",year:"numeric"})+'</b>'+
    '<button onclick="calShift(1)" class="no-print" style="background:var(--sf2);border:1px solid var(--bd);color:var(--tx);border-radius:6px;padding:4px 12px;cursor:pointer">›</button>'+
    '<span style="font-size:10.5px;color:var(--tx3)">🟦 planned · 🟧 visits · 🟩 orders — tap a day</span></div>'+
    '<div class="cal">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<div class="ch">'+d+'</div>').join('');
  for(let i=0;i<startDow;i++)calHtml+='<div class="cd dim"></div>';
  for(let d=1;d<=daysIn;d++){
    const k=dayKey(d);const e=byDay[k]||{plan:[],visit:[],order:[]};
    calHtml+='<div class="cd'+(k===today?' today':'')+(k===CAL_SEL?' sel':'')+'" onclick="calPick(\''+k+'\')"><div class="cnum">'+d+'</div>'+
      (e.plan.length?'<span class="cdot" style="background:var(--bl-bg);color:var(--bl)">'+e.plan.length+'</span>':'')+
      (e.visit.length?'<span class="cdot" style="background:var(--am-bg);color:var(--am)">'+e.visit.length+'</span>':'')+
      (e.order.length?'<span class="cdot" style="background:var(--gr-bg);color:var(--gr)">'+e.order.length+'</span>':'')+'</div>';
  }
  calHtml+='</div>';
  let dayHtml='';
  if(CAL_SEL){
    const e=byDay[CAL_SEL]||{plan:[],visit:[],order:[]};
    const row=(pill,main,sub,click)=>'<div class="drow" '+(click?'onclick="'+click+'" style="cursor:pointer;':'style="')+'align-items:flex-start;border-bottom:1px solid var(--bd);padding:7px 0"><span class="dlbl" style="max-width:70%">'+pill+' <b>'+main+'</b><br><span style="color:var(--tx3);font-size:11px">'+sub+'</span></span></div>';
    dayHtml='<div class="panel" style="padding:14px;margin-top:10px"><div class="phd">'+esc(CAL_SEL)+'</div>'+
      (e.plan.length+e.visit.length+e.order.length===0?'<div style="font-size:12px;color:var(--tx3)">Nothing on this day.</div>':'')+
      e.plan.map(v=>row('<span class="pill pbl">planned</span>',esc(v.account),esc(v.type||'')+(v.notes?' · '+esc(v.notes):''),'showAccountPage(\''+esc(v.account).replace(/'/g,'&#39;')+'\')')).join('')+
      e.visit.map(v=>row('<span class="pill" style="background:var(--am-bg);color:var(--am)">visit</span>',esc(v.account),esc(v.type||'')+' · '+esc(v.outcome||''),'showAccountPage(\''+esc(v.account).replace(/'/g,'&#39;')+'\')')).join('')+
      e.order.map(o=>row('<span class="pill pgr">order</span>',esc(ordLabel(o))+' · '+esc(o.account),fmtPeso(o.total),'showOrderPage(\''+o.id+'\')')).join('')+
      '<button class="no-print" onclick="window._lvAccount=\'\';window._lvDate=\''+CAL_SEL+'\';showView(\'logvisit\',null)" style="margin-top:10px;background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer">+ Plan / log a visit on this day</button></div>';
  }
  // top products (13-mo) from sp.skus
  const nameOf={};DATA.forEach(p=>nameOf[p.sku]=p.name);
  const sheetSkus=new Set(DATA.map(p=>p.sku));const bases=[...sheetSkus].sort((a,b)=>b.length-a.length);
  const agg={};for(const sku in (sp.skus||{})){const c=sp.skus[sku];const s=String(sku).trim();
    const base=sheetSkus.has(s)?s:(bases.find(b=>s.startsWith(b)&&s.length>b.length)||bases.find(b=>b.length>=4&&s.length>b.length&&s.includes(b))||s);
    const isB=base!==s&&sheetSkus.has(base);const g=agg[base]||(agg[base]={u:0,v:0});if(!isB)g.u+=c.u||0;g.v+=c.v||0;}
  const top=Object.keys(agg).map(k=>({n:nameOf[k]||k,u:agg[k].u,v:agg[k].v})).sort((a,b)=>b.v-a.v).slice(0,8);
  const canSeeAll=ROLE==='admin'||!(SBPROFILE&&SBPROFILE.specialist_tag);
  $('content').innerHTML=
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap" class="no-print">'+
    (canSeeAll?'<a href="#" onclick="showView(\''+esc(SPEC_BACK)+'\');return false" style="color:var(--ac);font-size:12.5px">← Back</a>':'')+
    (fus.length?'<span class="pill prd">'+fus.length+' open follow-up'+(fus.length>1?'s':'')+'</span>':'')+
    '<span style="flex:1"></span>'+
    '<button onclick="window._lvAccount=\'\';showView(\'logvisit\',null)" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer">+ Log visit</button>'+
    '<button onclick="showView(\'neworder\',null)" style="background:var(--gr);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer">+ New order</button>'+
    '</div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">This month</div><div class="met-val" style="font-size:15px">'+fmtPeso(mc.v)+'</div><div class="met-sub">'+mc.u.toLocaleString()+' units booked</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Target ('+ymNow+')</div><div class="met-val" style="font-size:15px">'+(tg&&tg.value?fmtPeso(tg.value):'—')+'</div><div class="met-sub">'+(tg&&tg.value?(mc.v/tg.value*100).toFixed(0)+'% attained':'no target set')+'</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Accounts reached (30d)</div><div class="met-val">'+custs30.size+'</div><div class="met-sub">bookings + visits</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Open follow-ups</div><div class="met-val">'+fus.length+'</div><div class="met-sub">'+myVisits.filter(v=>v.status==='planned'&&v.date>=today).length+' planned visits ahead</div><div class="met-bar"></div></div>'+
    '</div>'+
    (tg&&tg.value?'<div style="margin-bottom:14px">'+attBar(mc.v/tg.value*100)+'</div>':'')+
    '<div class="panel" style="padding:16px;margin-bottom:14px"><div class="phd">Calendar — visits & orders</div>'+calHtml+dayHtml+'</div>'+
    '<div class="g2" style="align-items:start;margin-bottom:14px">'+
    '<div class="panel" style="padding:16px"><div class="phd">Monthly sales'+(tg?' vs target':'')+'</div><div class="cw" style="height:220px"><canvas id="spChart"></canvas></div></div>'+
    '<div class="panel" style="padding:16px"><div class="phd">Top products (12 months)</div>'+
    (top.length?top.map(t=>'<div class="drow"><span class="dlbl">'+esc(t.n)+'</span><span class="dval">'+t.u.toLocaleString()+' u'+(t.v?' · '+fmtPeso(t.v):'')+'</span></div>').join(''):'<div style="font-size:12px;color:var(--tx3)">No product data yet.</div>')+'</div>'+
    '</div>'+
    '<div class="g2" style="align-items:start">'+
    '<div class="panel" style="padding:16px"><div class="phd">Open follow-ups</div>'+
    (fus.length?fus.slice(0,10).map(v=>'<div class="drow" onclick="showAccountPage(\''+esc(v.account).replace(/'/g,'&#39;')+'\')" style="cursor:pointer;align-items:flex-start"><span class="dlbl"><b>'+esc(v.account)+'</b> · '+esc(v.date)+'<br><span style="color:var(--tx3);font-size:11px">'+esc(v.notes||'')+'</span></span></div>').join(''):'<div style="font-size:12px;color:var(--tx3)">None — clear!</div>')+'</div>'+
    '<div class="panel" style="padding:16px"><div class="phd">Recent activity</div>'+
    [...myVisits.filter(v=>v.status!=='planned').slice(0,6).map(v=>({dt:v.date,h:'<span class="pill" style="background:var(--am-bg);color:var(--am)">visit</span> <b>'+esc(v.account)+'</b>',s:esc(v.outcome||'')})),
     ...myOrders.slice(0,6).map(o=>({dt:o.date,h:'<span class="pill pgr">order</span> <b>'+esc(ordLabel(o))+'</b> · '+esc(o.account),s:fmtPeso(o.total)}))]
     .sort((a,b)=>a.dt<b.dt?1:-1).slice(0,8).map(x=>'<div class="drow" style="align-items:flex-start"><span class="dlbl">'+x.h+'<br><span style="color:var(--tx3);font-size:11px">'+esc(x.dt)+' · '+x.s+'</span></span></div>').join('')+'</div>'+
    '</div>';
  // chart: 13-month bars + target line
  try{
    const yms=Object.keys(sp.monthly||{}).sort();
    const tgt=yms.map(m=>{const t=(TARGETS||[]).find(x=>x.month===m&&x.scope==='SPECIALIST'&&specCanon(x.name||'').toLowerCase()===name.toLowerCase());return t?t.value:null;});
    if(window._spChart)window._spChart.destroy();
    window._spChart=new Chart($('spChart'),{data:{labels:yms,datasets:[
      {type:'bar',label:'Booked',data:yms.map(m=>Math.round(sp.monthly[m].v)),backgroundColor:'rgba(29,158,117,0.55)',borderRadius:3},
      {type:'line',label:'Target',data:tgt,borderColor:'#BA7517',borderDash:[5,4],pointRadius:2,spanGaps:true}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'₱'+Math.round(v).toLocaleString()},grid:{color:'rgba(128,128,128,0.12)'}},x:{grid:{display:false}}}}});
  }catch(e){}
}

/* ── FULFILLMENT QUEUE (Verna's worklist) ── */
async function renderFulfillQ(){
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Loading…</div>';
  await loadNativeOrders(true);
  const today=new Date().toISOString().slice(0,10);
  const held=(NORDERS||[]).filter(o=>o.status==='pending'&&!o.deleted_at&&o.approved===false).length;
  const pend=(NORDERS||[]).filter(o=>o.status==='pending'&&!o.deleted_at&&o.approved!==false).sort((a,b)=>a.date<b.date?-1:1);
  const age=d=>Math.max(0,Math.round((Date.now()-new Date(d))/864e5));
  const doneToday=(NORDERS||[]).filter(o=>o.status==='fulfilled'&&o.date===today).length;
  let bos=[];try{const {data}=await SB.from('backorders').select('*').eq('status','open').order('id');bos=data||[];}catch(e){}
  const boPanel=bos.length?'<div class="panel" style="padding:14px 16px;margin-bottom:14px;border-left:3px solid var(--am)"><div class="phd">Backorders waiting on stock ('+bos.length+')</div>'+
    bos.map(b=>'<div class="drow" style="border-bottom:1px solid var(--bd);padding:7px 0"><span class="dlbl" style="max-width:70%"><b>'+esc(b.order_label)+'</b> · '+esc(b.account)+'<br><span style="color:var(--tx3);font-size:11.5px">'+b.qty_short+'u '+esc(b.name)+' short since '+esc((b.created_at||'').slice(0,10))+'</span></span>'+
    '<span class="dval" style="font-size:11.5px">'+(canFulfil()?'<a href="#" onclick="boCancel('+b.id+');return false" style="color:var(--rd)">cancel</a>':'')+'</span></div>').join('')+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:6px">Auto-releases (and pings you + the specialist) the moment a PO receive covers the shortfall.</div></div>':'';
  $('content').innerHTML=boPanel+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met am"><div class="met-lbl">Pending orders</div><div class="met-val">'+pend.length+'</div><div class="met-sub">waiting to ship'+(held?' · '+held+' held for approval':'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met rd" style="border-left:3px solid var(--rd)"><div class="met-lbl">Oldest pending</div><div class="met-val">'+(pend.length?age(pend[0].date)+'d':'—')+'</div><div class="met-sub">'+(pend.length?esc(ordLabel(pend[0])):'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Fulfilled today</div><div class="met-val">'+doneToday+'</div><div class="met-sub">nice pace</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Pending value</div><div class="met-val" style="font-size:15px">'+fmtPeso(pend.reduce((a,o)=>a+(o.total||0),0))+'</div><div class="met-sub">booked, unshipped</div><div class="met-bar"></div></div>'+
    '</div>'+
    (pend.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Order</th><th>Date</th><th style="text-align:right">Age</th><th>Account</th><th>Specialist</th><th style="text-align:right">Items</th><th style="text-align:right">Total</th><th class="no-print"></th></tr></thead><tbody>'+
    pend.map(o=>'<tr onclick="showOrderPage(\''+o.id+'\')" style="cursor:pointer"><td style="font-weight:700">'+esc(ordLabel(o))+'</td><td class="mu">'+esc(o.date)+'</td>'+
      '<td class="r" style="font-weight:600;color:'+(age(o.date)>7?'var(--rd)':age(o.date)>3?'var(--am)':'var(--tx)')+'">'+age(o.date)+'d</td>'+
      '<td style="font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(o.account||'—')+'</td><td>'+esc(o.spec||'—')+'</td>'+
      '<td class="r mu">'+(ordItems(o)==null?'—':ordItems(o))+'</td><td class="r" style="font-weight:600">'+fmtPeso(o.total)+'</td>'+
      '<td class="no-print"><button onclick="event.stopPropagation();showPickSlip(\''+o.id+'\')" style="background:var(--bl);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer">Pick list</button></td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Oldest first · red = waiting more than a week · tap an order to fulfill it, or Pick list to print the FEFO pull sheet</span></div></div>':
    '<div class="empty" style="margin-top:30px">Queue is clear — every order shipped. 🎉</div>');
}

/* ── PICK LIST / PACKING SLIP (printable, FEFO batch allocation) ── */
async function showPickSlip(ref){
  currentView='pickslip';
  pushRoute('#/p/'+encodeURIComponent(ref));
  $('ptitle').textContent='Pick list';
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Preparing…</div>';
  let o=null;
  if(SB&&/^[0-9a-f-]{30,40}$/i.test(ref)){try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('id',ref).maybeSingle();o=data;}catch(e){}}
  if(!o&&SB&&/HG-/i.test(ref)){try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('ext_ref',ref).maybeSingle();o=data;}catch(e){}}
  if(!o){$('content').innerHTML='<div class="empty" style="margin-top:40px">Order not found.</div>';return;}
  const binOf={},nameOf={};DATA.forEach(p=>{binOf[p.sku]=p.bin||'';nameOf[p.sku]=p.name;});
  // FEFO allocation: walk this SKU's batches earliest-expiry-first until qty covered
  const alloc=(sku,qty)=>{
    const bs=(BATCHES||[]).filter(b=>b.skuCode===sku&&b.soh>0);
    const out=[];let need=qty;
    for(const b of bs){if(need<=0)break;const take=Math.min(need,b.soh);out.push({batch:b.batch||'—',expiry:b.expiry||'—',take});need-=take;}
    if(need>0)out.push({batch:'⚠ short by '+need,expiry:'',take:need});
    return out;
  };
  const rows=(o.order_lines||[]).map(l=>{
    const a=alloc(l.sku,l.qty);
    return a.map((b,i)=>'<tr>'+(i===0?'<td rowspan="'+a.length+'"><b>'+esc(l.name||nameOf[l.sku]||l.sku)+'</b>'+(l.is_free?' (FREE)':'')+'</td><td rowspan="'+a.length+'">'+esc(l.sku)+'</td><td rowspan="'+a.length+'" style="text-align:center"><b>'+l.qty+'</b></td><td rowspan="'+a.length+'">'+esc(binOf[l.sku]||'—')+'</td>':'')+
      '<td>'+esc(b.batch)+'</td><td>'+esc(b.expiry)+'</td><td style="text-align:center">'+b.take+'</td><td style="width:44px"></td></tr>').join('');
  }).join('');
  $('content').innerHTML=
    '<div class="no-print" style="display:flex;gap:10px;margin-bottom:12px">'+
    '<a href="#" onclick="showOrderPage(\''+esc(String(ref)).replace(/'/g,'&#39;')+'\');return false" style="color:var(--ac);font-size:12.5px">← Back to order</a><span style="flex:1"></span>'+
    '<button onclick="showScanPick(\''+esc(String(o.id))+'\')" style="background:var(--pu);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">📷 Scan to pick</button>'+
    '<button onclick="confirmPick(\''+esc(String(o.id))+'\')" title="Confirm without scanning each unit" style="background:var(--gr);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">✓ Confirm picked</button>'+
    '<button onclick="window.print()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">🖨 Print</button></div>'+
    '<div class="printdoc">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div>'+hsLogo(34,'#00168F')+'<div style="font-size:19px;font-weight:800;margin-top:5px">HEALTHSPAN GLOBAL, INC.</div><div style="font-size:12px;color:#555">Pick List & Packing Slip</div></div>'+
    '<div style="text-align:right;font-size:12px"><b style="font-size:15px">'+esc(ordLabel(o))+'</b><br>Date: '+esc(o.date)+'<br>Printed: '+new Date().toISOString().slice(0,10)+'</div></div>'+
    '<div style="display:flex;gap:30px;margin:14px 0;font-size:12.5px"><div><b>Deliver to</b><br>'+esc(o.account||'—')+'</div><div><b>Specialist</b><br>'+esc(o.spec||'—')+'</div><div><b>Status</b><br>'+esc(o.status)+'</div></div>'+
    '<table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Bin</th><th>Batch (FEFO)</th><th>Expiry</th><th>Pull</th><th>✓</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="text-align:right;font-weight:700;font-size:14px">Total: '+fmtPeso(o.total)+'</div>'+
    (o.notes?'<div style="font-size:12px;margin-top:8px"><b>Notes:</b> '+esc(o.notes)+'</div>':'')+
    '<div style="display:flex;gap:40px;margin-top:36px;font-size:12px">'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Picked / packed by · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Checked by · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Received by · date</div></div>'+
    '<div style="font-size:10px;color:#777;margin-top:14px">Batches suggested first-expiry-first-out from live stock at print time · ⚠ short = insufficient batch stock on record</div>'+
    '</div>';
}

/* ── FIELD COVERAGE — Veeva-style specialist activity, computed from bookings ── */
function fieldPeriodRange(){
  const today=new Date().toISOString().slice(0,10);
  const back=d=>new Date(Date.now()-d*864e5).toISOString().slice(0,10);
  if(SPERIOD==='today')return[today,today];
  if(SPERIOD==='yest'){const y=back(1);return[y,y];}
  if(SPERIOD==='7d')return[back(7),today];
  if(SPERIOD==='30d')return[back(30),today];
  if(SPERIOD==='3m')return[back(92),today];
  if(SPERIOD==='custom')return[SFROM||back(30),STO||today];
  if(SPERIOD==='all')return[(SHOPIFY&&SHOPIFY.recentFrom)||back(180),today];
  return[today.slice(0,8)+'01',today]; // mtd
}
function fieldRows(){
  const [from,to]=fieldPeriodRange();
  const recent=(SHOPIFY&&SHOPIFY.recent)||[];
  const specs={};const disp={};const universe={};const custLast={};const custSpec={};
  const isFreeLine=(l,ls)=>((l[2]||0)<=0)&&(l[1]||0)>0&&!ls.some(o2=>o2!==l&&String(o2[0]).length>String(l[0]).length&&String(o2[0]).includes(String(l[0])));
  for(const o of recent){
    const raw=specCanon(o.t||'');
    if(!raw||INTERNAL_TAG.test(raw))continue; // untagged & internal orders aren't field activity
    const tag=raw.toLowerCase();               // merge case variants (Rhas/RHAS)
    if(!disp[tag])disp[tag]=raw;
    const S=specs[tag]||(specs[tag]={orders:0,days:new Set(),custs:new Set(),custs6:new Set(),rev:0,free:0});
    const c=(o.c||'').trim();
    if(c){S.custs6.add(c);(universe[c]=universe[c]||new Set()).add(tag);
      if(!custLast[c]||o.dt>custLast[c])custLast[c]=o.dt;
      custSpec[c]=custSpec[c]||{};custSpec[c][tag]=(custSpec[c][tag]||0)+1;}
    if(o.dt<from||o.dt>to)continue;
    S.orders++;S.days.add(o.dt);S.rev+=(o.ls||[]).reduce((x,l)=>x+(l[2]||0),0);
    S.free+=(o.ls||[]).reduce((x,l)=>x+(isFreeLine(l,o.ls)?(l[1]||0):0),0);
    if(c)S.custs.add(c);
  }
  // logged visits (the in-app visit log) count as field contact too — planned ones don't, yet
  for(const v of (VISITS||[])){
    if(v.status==='planned')continue;
    const raw=specCanon(v.spec||'');if(!raw||INTERNAL_TAG.test(raw))continue;
    const tag=raw.toLowerCase();if(!disp[tag])disp[tag]=raw;
    const S=specs[tag]||(specs[tag]={orders:0,days:new Set(),custs:new Set(),custs6:new Set(),rev:0,free:0});
    const c=(v.account||'').trim();
    if(c){S.custs6.add(c);(universe[c]=universe[c]||new Set()).add(tag);
      if(!custLast[c]||v.date>custLast[c])custLast[c]=v.date;
      custSpec[c]=custSpec[c]||{};custSpec[c][tag]=(custSpec[c][tag]||0)+1;}
    if(v.date<from||v.date>to)continue;
    S.visits=(S.visits||0)+1;S.days.add(v.date);
    if(c)S.custs.add(c);
  }
  const rows=Object.keys(specs).map(k=>{const s=specs[k];const n=disp[k]||k;return{n,orders:s.orders,visits:s.visits||0,days:s.days.size,
    perDay:s.days.size?(s.orders+(s.visits||0))/s.days.size:0,custs:s.custs.size,custs6:s.custs6.size,
    cov:s.custs6.size?s.custs.size/s.custs6.size*100:0,rev:s.rev,free:s.free};})
    .filter(r=>r.orders>0||r.custs6>0||r.visits>0).sort((a,b)=>b.rev-a.rev);
  // accounts not booked in the period (universe = anyone booked in the ~6-month window)
  const visited=new Set();for(const n in specs)for(const c of specs[n].custs)visited.add(c);
  const notVisited=Object.keys(universe).filter(c=>!visited.has(c)&&!/pull\s*-?\s*out/i.test(c))
    .map(c=>{const sp=Object.entries(custSpec[c]||{}).sort((a,b)=>b[1]-a[1]);const shopC=((SHOPIFY&&SHOPIFY.customers)||{})[c]||{};
      return{c,last:custLast[c]||'',spec:sp.length?(disp[sp[0][0]]||sp[0][0]):'',v:shopC.v||0};})
    .sort((a,b)=>b.v-a.v);
  return{rows,notVisited,from,to,universeN:Object.keys(universe).length,visitedN:visited.size};
}
function renderSalesField(){
  if(!salesGuard())return;
  if(!(SHOPIFY&&SHOPIFY.recent&&SHOPIFY.recent.length)){
    $('content').innerHTML='<div class="empty" style="margin-top:40px">Waiting for order-level data — appears after the next sales-cache rebuild.</div>';try{loadShopify();}catch(e){}return;}
  if(VISITS===null)loadVisits().then(()=>{if(currentView==='salesfield')renderSalesField();}); // pull logged visits in, once
  const periods=[['today','Today'],['yest','Yesterday'],['7d','7 days'],['mtd','This month'],['30d','30 days'],['3m','3 months'],['all','≈6 months'],['custom','Custom']];
  const dInp='style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:5px 8px;font-size:12px"';
  const F=fieldRows();
  const cov=F.universeN?F.visitedN/F.universeN*100:0;
  $('content').innerHTML=
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+
    '<div class="tabs" style="margin:0">'+periods.map(([k,l])=>'<div class="tab'+(SPERIOD===k?' active':'')+'" onclick="SPERIOD=\''+k+'\';renderSalesField()">'+l+'</div>').join('')+'</div>'+
    (SPERIOD==='custom'?('<input type="date" value="'+SFROM+'" onchange="SFROM=this.value;renderSalesField()" '+dInp+'><span style="color:var(--tx3);font-size:12px">to</span><input type="date" value="'+STO+'" onchange="STO=this.value;renderSalesField()" '+dInp+'>'):'')+
    '</div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Accounts reached</div><div class="met-val">'+F.visitedN+'</div><div class="met-sub">booked '+spLbl()+'</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Account universe</div><div class="met-val">'+F.universeN+'</div><div class="met-sub">customers seen in ≈6 months</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Coverage</div><div class="met-val">'+cov.toFixed(0)+'%</div><div class="met-sub">of the universe reached</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Not reached</div><div class="met-val">'+F.notVisited.length+'</div><div class="met-sub">accounts with no booking '+spLbl()+'</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard" style="margin-bottom:14px"><div class="tscroll"><table><thead><tr><th>Specialist</th><th style="text-align:right">Orders</th><th style="text-align:right">Visits logged</th><th style="text-align:right">Active days</th><th style="text-align:right">Contacts/day</th><th style="text-align:right">Accounts reached</th><th style="text-align:right">Their universe</th><th style="min-width:120px">Coverage</th><th style="text-align:right">Free/sample u</th><th style="text-align:right">Booked ₱</th></tr></thead><tbody>'+
    F.rows.map(r=>'<tr onclick="openSpecDrawer(\''+esc(r.n).replace(/\'/g,'&#39;')+'\')" style="cursor:pointer"><td style="font-weight:600">'+esc(r.n)+'</td>'+
      '<td class="r">'+r.orders.toLocaleString()+'</td><td class="r" style="color:var(--bl);font-weight:600">'+(r.visits?r.visits.toLocaleString():'—')+'</td><td class="r mu">'+r.days+'</td><td class="r">'+((r.orders+r.visits)?r.perDay.toFixed(1):'—')+'</td>'+
      '<td class="r" style="font-weight:600">'+r.custs+'</td><td class="r mu">'+r.custs6+'</td><td>'+attBar(r.cov)+'</td>'+
      '<td class="r" style="color:var(--pu)">'+(r.free?r.free.toLocaleString():'—')+'</td><td class="r" style="font-weight:600">'+fmtPeso(r.rev)+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Contacts = Shopify bookings + visits logged in the Log visit tab · universe = accounts contacted in the last ≈6 months · contacts/day = (orders + visits) ÷ active days · free/sample u = ₱0 giveaway units in their orders · pull-outs and internal orders excluded</span></div></div>'+
    (F.notVisited.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Account not reached '+spLbl()+'</th><th>Usual specialist</th><th style="text-align:right">Last booking</th><th style="text-align:right">Booked ₱ (13mo)</th></tr></thead><tbody>'+
      F.notVisited.slice(0,60).map(x=>'<tr onclick="openAccountDrawer(\''+esc(x.c).replace(/'/g,'&#39;')+'\')" style="cursor:pointer"><td style="font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis">'+esc(x.c)+'</td><td>'+esc(x.spec||'—')+'</td><td class="r mu">'+esc(x.last||'—')+'</td><td class="r" style="font-weight:600">'+fmtPeso(x.v)+'</td></tr>').join('')+
      '</tbody></table></div><div class="tfooter"><span>Sorted by 13-month booked value — the most valuable accounts going quiet sit on top · a ready-made follow-up list for the team</span></div></div>':'');}

/* ── VS ACCOUNTING — peso-for-peso reconciliation against the official Sales Report ── */
const INTERNAL_TAG=/^(remedy|reemdy|healthspan)/i; // internal orders: Remedy branches (+typo), Healthspan employees/academy
function reconRows(){
  // per-month: dashboard total booked, internal portion (from order tags), external = total − internal
  const dashAll={},internal={};
  for(const sku in (SALESIDX||{})){const S=SALESIDX[sku];
    for(const m in S.monthly)if(m>='2026-01')dashAll[m]=(dashAll[m]||0)+(S.monthly[m].v||0);
    for(const m in (S.bmonthly||{}))if(m>='2026-01')dashAll[m]=(dashAll[m]||0)+(S.bmonthly[m].v||0);}
  for(const tag in ((SHOPIFY&&SHOPIFY.specialists)||{})){
    if(!INTERNAL_TAG.test(tag.trim()))continue;
    const sp=SHOPIFY.specialists[tag];
    for(const m in (sp.monthly||{}))if(m>='2026-01')internal[m]=(internal[m]||0)+(sp.monthly[m].v||0);}
  const acctM=(ACCT&&ACCT.months)||{};
  const yms=[...new Set([...Object.keys(dashAll),...Object.keys(acctM)])].sort();
  return yms.map(m=>{
    const all=Math.round(dashAll[m]||0),int_=Math.round(internal[m]||0),ext=all-int_;
    const a=acctM[m]||null;
    return {m,all,internal:int_,ext,acct:a?a.total:null,qbo:a?a.qbo:null,gap:a?ext-a.total:null};
  });
}
function renderSalesRecon(){
  if(!salesGuard())return;
  if(!ACCT||!ACCT.months||!Object.keys(ACCT.months).length){
    $('content').innerHTML=
      '<div class="viewdesc" style="border-left-color:var(--am);margin-bottom:14px"><svg class="vd-i" viewBox="0 0 24 24" style="stroke:var(--am)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>'+
      '<div class="vd-t"><b>Can’t read the accounting sheet yet.</b> This view compares booked sales against the official “2026 | Healthspan Sales Report” Google Sheet, peso for peso. To turn it on, open that sheet → <b>Share</b> → change General access to <b>Anyone with the link · Viewer</b>, then hit Sync here. (The dashboard reads it with the same key it uses for Verna’s sheet — nobody gets edit access.)</div></div>';
    return;}
  const rows=reconRows().filter(r=>r.acct!==null||r.all>0);
  const withA=rows.filter(r=>r.acct!==null);
  const ytd=withA.reduce((a,r)=>({e:a.e+r.ext,a:a.a+r.acct,i:a.i+r.internal}),{e:0,a:0,i:0});
  const last=withA[withA.length-1];
  const gapCls=g=>Math.abs(g)<50000?'var(--gr)':Math.abs(g)<500000?'var(--am)':'var(--rd)';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">YTD — dashboard (external)</div><div class="met-val" style="font-size:15px">'+fmtPeso(ytd.e)+'</div><div class="met-sub">Shopify booked minus Remedy/internal</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">YTD — accounting</div><div class="met-val" style="font-size:15px">'+fmtPeso(ytd.a)+'</div><div class="met-sub">Sales Booked ('+esc(ACCT.tab||'Summary')+' tab)</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">YTD gap</div><div class="met-val" style="font-size:17px;color:'+gapCls(ytd.e-ytd.a)+'">'+fmtPeso(Math.abs(ytd.e-ytd.a))+'</div><div class="met-sub">'+(ytd.e>=ytd.a?'dashboard above accounting':'accounting above dashboard')+' · '+(ytd.a>0?(Math.abs(ytd.e-ytd.a)/ytd.a*100).toFixed(1):'0')+'%</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">YTD internal (excluded)</div><div class="met-val" style="font-size:15px">'+fmtPeso(ytd.i)+'</div><div class="met-sub">Remedy branches + Healthspan internal</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Month</th><th style="text-align:right">Accounting booked</th><th style="text-align:right">QBO</th><th style="text-align:right">Dashboard external</th><th style="text-align:right">Δ vs accounting</th><th style="text-align:right">Δ%</th><th style="text-align:right">Internal (excl.)</th><th style="text-align:right">Dashboard total</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td style="font-weight:600">'+r.m+'</td>'+
      '<td class="r" style="font-weight:600">'+(r.acct!==null?fmtPeso(r.acct):'<span class="mu">—</span>')+'</td>'+
      '<td class="r mu">'+(r.qbo?fmtPeso(r.qbo):'—')+'</td>'+
      '<td class="r" style="font-weight:600">'+fmtPeso(r.ext)+'</td>'+
      '<td class="r" style="font-weight:600;color:'+(r.gap!==null?gapCls(r.gap):'var(--tx3)')+'">'+(r.gap!==null?(r.gap>=0?'+':'−')+fmtPeso(Math.abs(r.gap)):'—')+'</td>'+
      '<td class="r mu">'+(r.gap!==null&&r.acct>0?(r.gap/r.acct*100).toFixed(1)+'%':'—')+'</td>'+
      '<td class="r mu">'+(r.internal?fmtPeso(r.internal):'—')+'</td>'+
      '<td class="r mu">'+fmtPeso(r.all)+'</td></tr>').join('')+
    '</tbody></table></div><div class="tfooter"><span>Accounting = the official Sales Report’s monthly Sales Booked (excludes Remedy — confirmed: their 102.4M incl. Remedy − 9.9M Remedy = 92.5M booked) · dashboard external applies the same rule via order tags · remaining Δ comes from their as-of date (they lag a few days), credit memos, and untagged orders · QBO shown for reference</span></div></div>';}

/* ── STOCK COVERAGE (weeks/months of runway) ── */
function renderCoverage(){
  const unit=window._covUnit||'weeks';
  const cands=DATA.filter(p=>{const s=stk(p);return s>0&&((p.velAdj||0)>0||(p.velocity||0)>0);})
    .map(p=>{const rate=(p.velAdj!=null&&p.velAdj>0)?p.velAdj:p.velocity;const m=stk(p)/rate;return {p,rate,mo:m,wk:m*4.345};})
    .sort((a,b)=>a.wk-b.wk);
  const B=[
    {k:'crit',label:'Under 2 weeks',color:'#D85A30',cls:'prd',status:'Critical',test:x=>x.wk<2},
    {k:'low',label:'2–4 weeks',color:'#BA7517',cls:'pam',status:'Low',test:x=>x.wk>=2&&x.wk<4},
    {k:'ok',label:'1–2 months',color:'#378ADD',cls:'pbl',status:'OK',test:x=>x.wk>=4&&x.wk<8.7},
    {k:'healthy',label:'2–4 months',color:'#1D9E75',cls:'pgr',status:'Healthy',test:x=>x.wk>=8.7&&x.wk<17.4},
    {k:'over',label:'Over 4 months',color:'#7F77DD',cls:'',status:'Overstock',test:x=>x.wk>=17.4}
  ];
  const bIdx=x=>{for(let i=0;i<B.length;i++)if(B[i].test(x))return i;return 4;};
  const counts=B.map(b=>cands.filter(b.test).length);
  const med=cands.length?cands[Math.floor(cands.length/2)]:null;
  const medTxt=med?(unit==='weeks'?Math.round(med.wk*10)/10+' wk':Math.round(med.mo*10)/10+' mo'):'—';
  const cap=unit==='weeks'?26:6;
  const fmtCov=x=>unit==='weeks'?(x.wk<1?'<1 wk':Math.round(x.wk*10)/10+' wk'):(x.mo<0.1?'<0.1 mo':Math.round(x.mo*10)/10+' mo');
  const pill=b=>b.k==='over'?'<span class="pill" style="background:var(--pu-bg);color:var(--pu)">Overstock</span>':'<span class="pill '+b.cls+'">'+b.status+'</span>';
  $('content').innerHTML=
    '<div class="tabs" style="margin-bottom:14px"><div class="tab'+(unit==='weeks'?' active':'')+'" onclick="window._covUnit=\'weeks\';renderCoverage()">Weeks</div><div class="tab'+(unit==='months'?' active':'')+'" onclick="window._covUnit=\'months\';renderCoverage()">Months</div></div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Critical</div><div class="met-val">'+counts[0]+'</div><div class="met-sub">under 2 weeks left</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Low</div><div class="met-val">'+counts[1]+'</div><div class="met-sub">2–4 weeks left</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Median cover</div><div class="met-val" style="font-size:19px">'+medTxt+'</div><div class="met-sub">typical runway</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Overstock</div><div class="met-val">'+counts[4]+'</div><div class="met-sub">over 4 months on hand</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="margin-bottom:14px"><div class="phd">SKUs by coverage band</div><div class="cw" style="height:220px"><canvas id="cov-canvas"></canvas></div></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Stock</th><th style="text-align:right">Fcst /mo</th><th style="min-width:170px">Cover left</th><th>Status</th></tr></thead><tbody>'+
    (cands.length?cands.slice(0,400).map(x=>{
      const b=B[bIdx(x)];
      const pct=Math.max(3,Math.min(100,Math.round((unit==='weeks'?x.wk:x.mo)/cap*100)));
      return '<tr onclick="openDrawer(\''+esc(x.p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(x.p.sku)+'</td>'+
      '<td style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(x.p.name)+'</td>'+
      '<td class="mu" style="max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(x.p.line||'')+'</td>'+
      '<td class="r stk">'+stk(x.p).toLocaleString()+'</td>'+
      '<td class="r mu">'+(x.p.velAdj!=null?x.p.velAdj:x.p.velocity)+'</td>'+
      '<td><div style="display:flex;align-items:center;gap:8px"><div style="flex:0 0 90px;height:6px;background:var(--sf2);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+b.color+'"></div></div><span style="font-size:11px;font-weight:600">'+fmtCov(x)+'</span></div></td>'+
      '<td>'+pill(b)+'</td></tr>';
    }).join(''):'<tr><td colspan="7"><div class="empty">No SKUs with stock and sales velocity</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Cover = current stock ÷ forecast monthly demand · '+cands.length+' active SKUs · items with no stock or no recent sales are excluded</span></div></div>';
  if(covInst){covInst.destroy();covInst=null;}
  covInst=new Chart($('cov-canvas'),{type:'bar',data:{labels:B.map(b=>b.label),datasets:[{label:'SKUs',data:counts,backgroundColor:B.map(b=>b.color)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'SKUs'},grid:{color:'rgba(128,128,128,0.12)'}}}}});
}

/* ── DEAL SCENARIOS (inventory value: ala carte vs bundle deals, per-product plan) ── */
const DEALS=[['À la carte',0],['2+1',2],['3+1',3],['4+1',4],['5+1',5],['6+1',6]];
let DEALPLAN=(()=>{try{return JSON.parse(localStorage.getItem('hs_dealplan')||'{}');}catch(e){return {};}})();
function dealVal(s,price,n){if(!n)return s*price;const free=Math.floor(s/(n+1));return (s-free)*price;}
function dealRows(){
  return DATA.filter(p=>stk(p)>0&&p.price>0).map(p=>{
    const s=stk(p);
    const assigned=DEALPLAN[p.sku]||0;
    const vals=DEALS.map(([,n])=>dealVal(s,p.price,n));
    return {p,s,vals,assigned,planVal:dealVal(s,p.price,assigned)};
  }).sort((a,b)=>b.vals[0]-a.vals[0]);
}
function setDeal(sku,n){
  n=parseInt(n)||0;
  if(n)DEALPLAN[sku]=n; else delete DEALPLAN[sku];
  try{localStorage.setItem('hs_dealplan',JSON.stringify(DEALPLAN));}catch(e){}
  renderDealValue();
}
function setAllDeals(n){
  n=parseInt(n)||0;
  DEALPLAN={};
  if(n)for(const p of DATA){if(stk(p)>0&&p.price>0)DEALPLAN[p.sku]=n;}
  try{localStorage.setItem('hs_dealplan',JSON.stringify(DEALPLAN));}catch(e){}
  renderDealValue();
}
function renderDealValue(){
  const rows=dealRows();
  const tot=DEALS.map((_,i)=>rows.reduce((a,r)=>a+r.vals[i],0));
  const planTot=rows.reduce((a,r)=>a+r.planVal,0);
  const assignedCount=rows.filter(r=>r.assigned>0).length;
  const excluded=DATA.filter(p=>stk(p)>0&&!(p.price>0)).length;
  const cardCls=['gr','bl','bl','am','am','pu'];
  const dealOpts=(sel)=>DEALS.map(([lbl,n])=>'<option value="'+n+'"'+(sel===n?' selected':'')+'>'+lbl+'</option>').join('');
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Your deal plan</div><div class="met-val" style="font-size:17px">'+fmtK(planTot)+'</div><div class="met-sub">'+assignedCount+' SKUs on deals · −'+fmtK(tot[0]-planTot)+' vs à la carte</div><div class="met-bar"></div></div>'+
    DEALS.map(([lbl],i)=>{
      const giveaway=tot[0]-tot[i];
      const sub=i===0?'full SRP, no freebies':('if ALL stock sold '+lbl+' · −'+fmtK(giveaway));
      return '<div class="met '+cardCls[i]+'"><div class="met-lbl">'+lbl+'</div><div class="met-val" style="font-size:17px">'+fmtK(tot[i])+'</div><div class="met-sub">'+sub+'</div><div class="met-bar"></div></div>';
    }).join('')+
    '</div>'+
    '<div class="panel" style="margin-bottom:14px"><div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">'+
    '<span style="font-size:11px;font-weight:600;color:var(--tx2)">Assign per product below, or set all:</span>'+
    '<select onchange="setAllDeals(this.value);this.value=\'\'" style="padding:6px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--sf);color:var(--tx1);font-size:12px"><option value="" selected>choose…</option>'+DEALS.map(([lbl,n])=>'<option value="'+n+'">'+lbl+'</option>').join('')+'</select>'+
    '<button class="btn" onclick="setAllDeals(0)">Reset all to à la carte</button>'+
    '<span style="font-size:10.5px;color:var(--tx3)">Assignments are saved in this browser only</span>'+
    '</div></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    '<th>SKU</th><th>Product</th><th style="text-align:right">Stock</th><th style="text-align:right">SRP</th><th>Deal</th><th style="text-align:right">Plan value</th>'+
    DEALS.slice(1).map(([lbl])=>'<th style="text-align:right">'+lbl+'</th>').join('')+
    '</tr></thead><tbody>'+
    (rows.length?rows.slice(0,300).map(r=>{
      const p=r.p;
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(p.sku)+'</td>'+
      '<td style="max-width:170px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
      '<td class="r stk">'+r.s.toLocaleString()+'</td>'+
      '<td class="r mu" style="font-size:11px">'+fmtP(p.price)+'</td>'+
      '<td onclick="event.stopPropagation()"><select onchange="setDeal(\''+esc(p.sku)+'\',this.value)" style="padding:4px 6px;border:1px solid var(--bd);border-radius:6px;background:'+(r.assigned?'var(--am-bg)':'var(--sf)')+';color:var(--tx1);font-size:11px">'+dealOpts(r.assigned)+'</select></td>'+
      '<td class="r" style="font-weight:700;color:'+(r.assigned?'var(--am)':'var(--tx1)')+'">'+fmtK(r.planVal)+'</td>'+
      r.vals.slice(1).map(v=>'<td class="r mu">'+fmtK(v)+'</td>').join('')+
      '</tr>';
    }).join(''):'<tr><td colspan="'+(6+DEALS.length-1)+'"><div class="empty">No priced SKUs with stock</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>'+rows.length+' priced SKUs · Plan value = value under each product’s assigned deal · '+excluded+' in-stock SKUs excluded for missing SRP · revenue at SRP, not profit</span></div></div>';
}
function exportDeals(){
  const rows=dealRows();
  downloadCSV('deal_scenarios',['SKU','Product','Line','Stock','SRP','Assigned deal','Plan value',...DEALS.map(([l])=>l+' value')],
    rows.map(r=>[r.p.sku,r.p.name,r.p.line,r.s,r.p.price,(DEALS.find(([,n])=>n===r.assigned)||['À la carte'])[0],Math.round(r.planVal),...r.vals.map(v=>Math.round(v))]));
}
