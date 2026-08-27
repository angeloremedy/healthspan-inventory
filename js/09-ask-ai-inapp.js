/* ── ASK AI (in-app chat over the live catalog) ── */
function toggleAsk(){
  const d=document.getElementById('askdrawer'); if(!d)return;
  d.classList.toggle('open');
  if(d.classList.contains('open')){const i=document.getElementById('askinput'); if(i)setTimeout(()=>i.focus(),150);}
}
let ASKHIST=[];
function askCatalog(){
  const prods=DATA.map(p=>[p.sku,p.name,p.line||'',(typeof p.stock==='number'?p.stock:''),
    (p.price!=null?p.price:''),(p.velAdj!=null?p.velAdj:(p.velocity!=null?p.velocity:'')),
    (p.monthsOfStock!=null?p.monthsOfStock:''),p.expiry||'',p.batch||'',
    (p.daysToStockout!=null?p.daysToStockout:''),p.stockoutDate||'',p.supplier||''].join('|')).join('\n');
  const batches=(BATCHES||[]).filter(b=>b.soh>0).map(b=>[b.skuCode||'',b.name,b.batch||'',b.expiry||'',b.soh].join('|')).join('\n');
  const custs=(CUSTOMERS||[]).slice(0,150).map(c=>[c.name,c.qty,c.value,c.orders,c.skuCount,c.lastOrder||'',c.daysSince!=null?c.daysSince:'',c.trend,c.isRemedy?'REMEDY':''].join('|')).join('\n');
  const ships=(BRANCH_TRANSFERS||[]).slice(0,80).map(t=>[t.branch,t.sku,t.name,t.qty,t.dateSerial?new Date((t.dateSerial-25569)*864e5).toISOString().slice(0,10):''].join('|')).join('\n');
  const wo=collisionRows(1).slice(0,50).map(c=>[c.sku,c.name,c.batch||'',c.expiry||'',c.projExpired,c.writeOff].join('|')).join('\n');
  const mo=(MONTHS||[]).map(m=>m+'='+((MONTHLY_OUT||{})[m]||0)).join(', ');
  let out='PRODUCTS (sku|name|line|stock|price_php|forecast_per_month|months_of_cover|expiry|batch|days_to_stockout|stockout_date|supplier):\n'+prods+
    '\n\nBATCHES with stock, FEFO order — earliest expiry first (sku|name|batch|expiry_MM/YYYY|units_on_hand):\n'+batches+
    '\n\nCUSTOMERS (name|units|value_php|orders|sku_count|last_order|days_since_order|trend|remedy_flag):\n'+custs+
    '\n\nREMEDY SHIPMENTS — recent shipments to Remedy branches (branch|sku|name|qty|date):\n'+ships+
    '\n\nWRITE-OFF RISK — projected to expire unsold (sku|name|batch|expiry|units_at_risk|writeoff_value_php):\n'+wo+
    '\n\nMONTHLY UNITS OUT (month=units): '+mo;
  const shopSales=DATA.filter(p=>p.shopifySales).map(p=>p.sku+'|'+p.name+'|'+Object.keys(p.shopifySales).sort().map(m=>m+'='+p.shopifySales[m]).join(',')).join('\n');
  if(shopSales)out+='\n\nSHOPIFY UNIT DEMAND — physical units booked at the store incl. free +1 deal units (sku|name|month=units,...):\n'+shopSales;
  const shopDeals=DATA.filter(p=>p.deals&&p.deals.length).map(p=>p.deals.map(d=>[p.sku,d.title,d.setSize,d.price].join('|')).join('\n')).join('\n');
  if(shopDeals)out+='\n\nLIVE DEALS ON SHOPIFY (sku|deal_title|physical_units_per_set|set_price_php):\n'+shopDeals;
  return out;
}
function askFmt(t){
  return esc(t).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
}
async function sendAsk(){
  const inp=document.getElementById('askinput'), log=document.getElementById('asklog'), btn=document.getElementById('askbtn');
  if(!inp||!log)return;
  if(btn&&btn.disabled)return; // a question is already in flight (guards Enter-key double submit)
  const q=inp.value.trim(); if(!q)return;
  const empty=log.querySelector('.askempty'); if(empty)empty.remove();
  inp.value='';
  log.insertAdjacentHTML('beforeend','<div class="askq">'+esc(q)+'</div>');
  log.insertAdjacentHTML('beforeend','<div class="aska" id="ask-pending">Checking the live inventory…</div>');
  log.scrollTop=log.scrollHeight;
  btn.disabled=true;
  try{
    const r=await fetch('/.netlify/functions/ask',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({question:q,catalog:askCatalog(),history:ASKHIST.slice(-3)})});
    const job=await r.json();
    if(!job.id)throw new Error(job.error||'could not start');
    // Poll for the answer — deep questions can take 30s+ on the smart model.
    let out=null;
    const pendEl=()=>document.getElementById('ask-pending');
    for(let i=0;i<60;i++){
      await new Promise(res=>setTimeout(res,2500));
      const pe=pendEl();
      if(pe&&i===4)pe.textContent='Thinking it through…';
      if(pe&&i===12)pe.textContent='Still working — deep analysis takes a little longer…';
      try{
        const rr=await fetch('/.netlify/functions/ask?id='+job.id,{headers:await sbAuthHeaders()});
        const o=await rr.json();
        if(!o.pending){out=o;break;}
      }catch(e){}
    }
    const p=pendEl();
    if(!out)out={error:'Timed out waiting for the answer — please try again.'};
    if(p){p.removeAttribute('id');p.innerHTML=out.answer?askFmt(out.answer):'<span style="color:var(--rd)">'+esc(out.error||'No answer')+'</span>';}
    if(out.answer){ASKHIST.push({q:q,a:out.answer});if(ASKHIST.length>10)ASKHIST.shift();}
  }catch(err){
    const p=document.getElementById('ask-pending');
    if(p){p.removeAttribute('id');p.innerHTML='<span style="color:var(--rd)">Could not reach the AI: '+esc(err.message)+'</span>';}
  }
  btn.disabled=false;
  log.scrollTop=log.scrollHeight;
}

function exportCSV(){
  const h=['SKU','Name','Supplier','Line','Category','Bin','Batch','Expiry','Price','Velocity/mo','Months of stock','Received','Sold','Stock','Status'];
  const rows=DATA.map(p=>{const s=stk(p);return[p.sku,p.name,p.supplier||'',p.line,p.category,p.bin,p.batch,p.expiry,p.price??'',p.velocity??'',p.monthsOfStock??'',p.received,p.sold,s??'',statusOf(s).l].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');});
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent([h.join(','),...rows].join('\n'));
  a.download='healthspan_inventory_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

/* ── THEME SELECTOR: "Healthspan" (brand, from healthspan.ph) or "Classic" ── */
function applyTheme(t){
  if(t==='healthspan')document.body.setAttribute('data-theme','healthspan');
  else document.body.removeAttribute('data-theme');
  try{localStorage.setItem('hs_theme',t);}catch(e){}
  const el=document.getElementById('themeSel');if(el)el.value=t;
}
/* light / dark / system mode */
function applyMode(m){
  window._hsMode=m;
  try{localStorage.setItem('hs_mode',m);}catch(e){}
  const mq=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');
  document.body.classList.toggle('dark',m==='dark'||(m==='system'&&mq&&mq.matches));
  document.querySelectorAll('.modeBtn').forEach(b=>b.style.opacity=b.dataset.m===m?'1':'.45');
}
if(window.matchMedia)try{window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(window._hsMode==='system')applyMode('system');});}catch(e){}
function initTheme(){
  const t=(function(){try{return localStorage.getItem('hs_theme');}catch(e){return null;}})()||'healthspan';
  applyTheme(t);
  const m=(function(){try{return localStorage.getItem('hs_mode');}catch(e){return null;}})()||'system';
  const sf=$('sf-foot');
  if(sf&&!document.getElementById('themeRow')){
    const d=document.createElement('div');d.id='themeRow';
    d.style.cssText='padding:6px 14px;border-top:1px solid var(--bd);font-size:10.5px;color:var(--tx3);display:flex;align-items:center;gap:6px;flex-wrap:wrap';
    const mb=(v,icon,title)=>'<span class="modeBtn" data-m="'+v+'" onclick="applyMode(\''+v+'\')" title="'+title+'" style="cursor:pointer;font-size:12px;line-height:1;padding:3px 5px;border:1px solid var(--bd);border-radius:6px;background:var(--sf)">'+icon+'</span>';
    d.innerHTML='Theme <select id="themeSel" onchange="applyTheme(this.value)" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:2px 6px;font-size:10.5px">'+
      '<option value="healthspan"'+(t==='healthspan'?' selected':'')+'>Healthspan</option>'+
      '<option value="classic"'+(t==='classic'?' selected':'')+'>Classic</option></select>'+
      '<span style="display:inline-flex;gap:3px;margin-left:2px">'+mb('light','☀️','Light')+mb('dark','🌙','Dark')+mb('system','🖥','Match device')+'</span>';
    sf.parentNode.insertBefore(d,sf);
  }
  applyMode(m);
}

/* ── MOBILE NAV — rebuilt per role so phones/iPads always have the right tabs ── */
function buildMobileNav(){
  const bar=document.querySelector('.mobile-nav-inner');if(!bar)return;
  const I={cart:'<circle cx="9" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    bag:'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>',
    pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    check:'<path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    peso:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    pin:'<circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>'};
  const home=['home','Home','<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'];
  // Home + FOUR customizable slots + Menu. Each person picks their own four
  // (Menu → Customize bottom bar); role defaults until they do.
  // sales: Home · Log visit · New order are FIXED — only 2 slots are theirs to pick
  const FIXED=(ROLE==='sales')?['logvisit','neworder']:[];
  const NSLOTS=(ROLE==='sales')?2:4;
  const DEF={sales:['followups','salesdue'],
    manager:['approvals','orders','salespace','customers'],
    supply_chain:['fulfillq','scan','cyclecount','po'],
    finance:['ar','pdc','cashflow','returns'],
    marketing:['campaigns','promos','salesoverview','pipeline'],
    viewer:['salesoverview','dashboard','ar','salespace'],
    admin:['approvals','orders','fulfillq','ar']};
  let picks=null;
  try{picks=JSON.parse(localStorage.getItem('hs_mbar_'+((SBUSER&&SBUSER.id)||'anon'))||'null');}catch(e){}
  if(!Array.isArray(picks))picks=null;
  let slots=(picks||DEF[ROLE]||DEF.admin).filter(v=>!FIXED.includes(v)&&(typeof viewAllowed!=='function'||viewAllowed(v))).slice(0,NSLOTS);
  (DEF[ROLE]||DEF.admin).forEach(v=>{if(slots.length<NSLOTS&&!slots.includes(v)&&!FIXED.includes(v)&&(typeof viewAllowed!=='function'||viewAllowed(v)))slots.push(v);});
  slots=FIXED.concat(slots); // fixed items render first, right after Home
  const mIcon=v=>{ // the sidebar's icon for this view, with explicit stroke attrs
    const el=document.querySelector('.nav .ni[onclick*="\''+v+'\'"] svg');
    return el?el.outerHTML.replace('<svg ','<svg fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" '):'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
  };
  const mLabel=v=>{
    const SHORT={neworder:'Order',logvisit:'Visit',followups:'To-dos',salesdue:'Reorder',approvals:'Approve',orders:'Orders',salespace:'Pace',customers:'Accounts',fulfillq:'Fulfill',scan:'Scan',cyclecount:'Count',po:'POs',ar:'AR',pdc:'PDCs',cashflow:'Cash',returns:'Returns',campaigns:'Campaigns',promos:'Promos',salesoverview:'Sales',pipeline:'Pipeline',dashboard:'Inventory',quotes:'Quotes',complaints:'Complaints',salesevents:'Events',transfers:'Transfers',quarantine:'Quarantine',whkpi:'KPIs',suppliers:'Suppliers',valuation:'Costs',catalog:'Items',recall:'Recall',targets:'Targets',scorecards:'Reviews',users:'Team',audit:'Log',commissions:'Commis.',regs:'Regs',salestarget:'Vs target',salesfield:'Coverage',all:'SKUs',forecast:'Stockout',health:'Data'};
    if(SHORT[v])return SHORT[v];
    const el=document.querySelector('.nav .ni[onclick*="\''+v+'\'"]');
    if(!el)return v;
    let t='';el.childNodes.forEach(n=>{if(n.nodeType===3)t+=n.textContent;});
    return (t.trim().split(/\s|&/)[0])||v;
  };
  let html='<div class="mni'+(currentView==='home'?' active':'')+'" onclick="showView(\'home\',null)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Home</div>';
  html+=slots.map(v=>'<div class="mni'+(currentView===v?' active':'')+'" onclick="showView(\''+v+'\',null);document.querySelectorAll(\'.mni\').forEach(x=>x.classList.remove(\'active\'));this.classList.add(\'active\')">'+mIcon(v)+mLabel(v)+'</div>').join('');
  html+='<div class="mni" onclick="openMobileMenu()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>Menu</div>';
  bar.innerHTML=html;
}

/* ── SUPABASE AUTH (Phase A) ──
   Paste your project's URL and anon PUBLIC key here (Supabase → Settings → API).
   The anon key is designed to be public — security lives in row-level policies.
   While these are empty, the dashboard falls back to the old passcode gate. */
const SUPABASE_URL='https://lesjigujcajxurmsmwwc.supabase.co';
const SUPABASE_ANON='sb_publishable_r9XyNNTaFzNu1msTaHgt-w_FBm-vsI4'; // publishable key (new format) — public by design, RLS is the security
let SB=null,SBUSER=null,SBPROFILE=null;
function sbInit(force){
  if(SB!==null&&!force)return SB;
  if(SUPABASE_URL&&SUPABASE_ANON&&window.supabase){
    try{
      // "Remember me" unchecked → session-only storage (sign-in ends with the browser)
      const remember=(function(){try{return localStorage.getItem('hs_remember')!=='no';}catch(e){return true;}})();
      SB=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON,{auth:{storage:remember?window.localStorage:window.sessionStorage,persistSession:true,autoRefreshToken:true}});
    }catch(e){SB=false;}
  }else SB=false;
  return SB;
}
async function initAuth(){
  sbInit();
  if(!SB){showSbLogin('Login is unavailable — the auth service could not be loaded. Refresh, or check the connection.');return;}
  try{
    const {data:{session}}=await SB.auth.getSession();
    if(session)await sbLoadProfile(session.user);
    else showSbLogin();
  }catch(e){showSbLogin('Could not reach the login server — check the connection.');}
}
async function sbLoadProfile(user){
  SBUSER=user;
  try{const {data}=await SB.from('profiles').select('name,role,specialist_tag,is_super,can_manage_ps').eq('id',user.id).single();SBPROFILE=data||null;}
  catch(e){try{const {data}=await SB.from('profiles').select('name,role,specialist_tag').eq('id',user.id).single();SBPROFILE=data||null;}catch(e2){SBPROFILE=null;}}
  ROLE=(SBPROFILE&&SBPROFILE.role)||'sales';
  try{localStorage.setItem('hs_role_cache',ROLE);localStorage.setItem('hs_name_cache',(SBPROFILE&&SBPROFILE.name)||'');}catch(e){}
  const g=$('rolegate');if(g)g.style.display='none';
  document.body.classList.add('authed'); // mobile bars render only when signed in
  document.body.classList.toggle('role-sales',ROLE==='sales');
  document.body.classList.toggle('role-manager',ROLE==='manager');
  try{await loadAcctLinks(true);}catch(e){} // curated merges/branches apply everywhere
  try{loadSpecTargets(true);}catch(e){}     // in-app specialist targets (override sheet)
  try{loadSpecRoster(true);}catch(e){}      // added/deactivated specialists for pickers
  try{await loadFlags(true);if(flagOn('use_catalog_pricing')){await loadItems(true);applyCatalog();}}catch(e){} // cutover switches
  try{maybeSnapshotForecast();}catch(e){}   // monthly forecast freeze (runs if data is ready)
  // endpoints are session-locked: pull anything that failed before sign-in
  try{syncNow();}catch(e){}
  try{if(!SHOPIFY)loadShopify();}catch(e){}
  try{if(!VISITS)loadVisits();}catch(e){}
  const sf=$('sf-foot');
  const who=(SBPROFILE&&SBPROFILE.name)||user.email||'';
  if(sf){const old=document.getElementById('rolebadge');if(old)old.remove();
    const d=document.createElement('div');d.id='rolebadge';
    d.innerHTML=esc(who)+' · '+(ROLE==='sales'?'Sales':ROLE==='manager'?'Sales manager':ROLE==='admin'?'Admin':esc(String(ROLE).replace('_',' ')))+' · <a href="#" onclick="openChangePassword();return false" style="color:var(--ac)">password</a> · <a href="#" onclick="downloadManual();return false" style="color:var(--ac)" title="Download the user manual for your role">manual</a> · <a href="#" onclick="roleLogout();return false" style="color:var(--ac)">sign out</a>';
    d.style.cssText='padding:6px 14px;border-top:1px solid var(--bd);font-size:10.5px;color:var(--tx3)';
    sf.parentNode.insertBefore(d,sf);}
  buildMobileNav();
  try{if(typeof navSync==='function')navSync();}catch(e){} // sidebar = exactly what viewAllowed() permits
  setTimeout(()=>{window._animReady=true;},400); // animations start after login settles (no boot flicker)
  if(location.hash&&location.hash.startsWith('#/'))applyRoute(); // deep link / refresh keeps the page
  else showView('home',document.querySelector('.ni[onclick*="\'home\'"]')); // everyone lands on the role-aware home
}
function showSbLogin(err){
  const g=$('rolegate');if(!g)return;
  document.body.classList.remove('authed'); // signed out / expired: hide app chrome
  g.style.display='flex';
  g.innerHTML='<div style="background:var(--sf);border:1px solid var(--bd);border-radius:16px;padding:32px 36px;max-width:360px;width:90%;text-align:center">'+
    '<div style="display:flex;justify-content:center;margin-bottom:12px">'+hsLogo(52,'var(--ac)')+'</div>'+
    '<div style="font-weight:700;font-size:18px;margin-bottom:4px;letter-spacing:3px">HEALTHSPAN <span style="color:var(--ac)">HQ</span></div>'+
    '<div style="font-size:12.5px;color:var(--tx3);margin-bottom:18px">Sign in with your Healthspan account</div>'+
    '<input id="sb-email" type="email" placeholder="Email" autocomplete="username" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:8px">'+
    '<input id="sb-pass" type="password" placeholder="Password" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')sbLogin()" style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px 12px;font-size:14px">'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--tx2);margin-top:10px;cursor:pointer"><input type="checkbox" id="sb-remember" checked> Remember me on this device</label>'+
    '<div id="sb-err" style="color:var(--rd);font-size:11.5px;min-height:16px;margin:8px 0 4px">'+(err?esc(err):'')+'</div>'+
    '<button onclick="sbLogin()" style="width:100%;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:11px;font-size:13.5px;font-weight:600;cursor:pointer">Sign in</button>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:14px">No account or forgot the password? Ask Angelo.</div></div>';
}
async function sbLogin(){
  const email=($('sb-email')&&$('sb-email').value||'').trim();
  const pass=($('sb-pass')&&$('sb-pass').value||'');
  const err=$('sb-err');
  if(!email||!pass){if(err)err.textContent='Enter your email and password.';return;}
  try{
    const remember=!$('sb-remember')||$('sb-remember').checked;
    try{localStorage.setItem('hs_remember',remember?'yes':'no');}catch(e){}
    sbInit(true); // rebuild the client with the chosen storage before signing in
    const {data,error}=await SB.auth.signInWithPassword({email,password:pass});
    if(error){if(err)err.textContent=error.message==='Invalid login credentials'?'Wrong email or password.':error.message;return;}
    await sbLoadProfile(data.user);
  }catch(e){if(err)err.textContent='Could not sign in: '+e.message;}
}

/* ── ROLE state: set ONLY from the Supabase profile after sign-in (passcodes removed) ── */
let ROLE='';try{ROLE=localStorage.getItem('hs_role_cache')||'';}catch(e){} // last-known role: first paint matches the post-profile render (kills the profile-load flicker)
try{localStorage.removeItem('hs_role');}catch(e){} // clear any legacy passcode sessions
function roleLogout(){
  try{if(SB)SB.auth.signOut();}catch(e){}
  SBUSER=null;SBPROFILE=null;ROLE='';try{localStorage.removeItem('hs_role_cache');localStorage.removeItem('hs_name_cache');}catch(e){}
  location.reload();
}

/* ── INIT ── */
refreshSidebar();
renderHome();
injectDesc('home');
initTheme();
initAuth();
(function(){const b=document.getElementById('tipsBtn');if(b)b.style.opacity=TIPS_ON?'1':'0.55';})();
$('sf-foot').innerHTML='Loading... <a href="#" onclick="syncNow();return false" style="color:var(--ac)">load data</a>';
// boot sync removed: endpoints are session-locked — sbLoadProfile() syncs right after sign-in
try{navApplyCollapse();}catch(e){}

