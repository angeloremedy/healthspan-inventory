/* ── QUICKBOOKS SYNC (Finance → QuickBooks sync) ────────────────────────────────
   The page finance and admins use to run HQ → QuickBooks Online. Everything it
   shows comes from qbo-admin.mjs; nothing here talks to Intuit directly and no
   token ever reaches the browser. Five panels: connection, settings (super admin
   writes), customer matches to confirm, the sync ledger with Retry, and the last
   run's summary. Built now, switched on at cutover — until then every run is a
   PREVIEW that shows what it would post. */
let QBO_ST=null,QBO_LISTS=null;
async function qboApi(action,body,qs){
  const url='/.netlify/functions/qbo-admin?action='+action+(qs?'&'+qs:'');
  const r=await fetch(url,body?{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),body:JSON.stringify(Object.assign({action},body))}:{headers:await sbAuthHeaders()});
  const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));return j;}
function qboCanEdit(){return typeof isSuper==='function'&&isSuper();}
function qboFmt(n){return n==null||n===''?'—':'₱'+Math.round(+n).toLocaleString('en-PH');}
function qboWhen(iso){if(!iso)return '—';try{return new Date(iso).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return iso;}}
const QBO_STATUS_TONE={posted:'pgr',updated:'pgr',voided:'pgy',pending:'pam',error:'prd',skipped:'pgy'};

async function renderQbo(){
  loadingHint();
  const c=$('content');
  let st=null,err='';
  try{st=await qboApi('status');QBO_ST=st;}catch(e){err=e.message;}
  if(currentView!=='qbo')return;
  // the OAuth round-trip lands here with ?connected=1 or ?error=… in the hash
  let flash='';try{const h=location.hash;const m=h.match(/\?(.*)$/);if(m){const p=new URLSearchParams(m[1]);if(p.get('connected'))flash='<div class="panel" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--gr)">Connected to QuickBooks. Pick the tax code and accounts below, then review the customer matches.</div>';if(p.get('error'))flash='<div class="panel" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--rd)">QuickBooks said: '+esc(p.get('error'))+'</div>';history.replaceState(null,'','#/v/qbo');}}catch(e){}
  let h='<div class="viewdesc">HQ posts its own orders to QuickBooks Online the way the Shopify connector does today: a fulfilled order becomes an <b>Invoice</b>, each HQ payment a <b>Payment</b> on it, each credit memo a <b>CreditMemo</b>; payments recorded directly in QuickBooks come back into HQ so AR aging stays true. Built now, <b>switched on at cutover</b> — until then every run is a preview.</div>'+flash;
  if(err){c.innerHTML=h+'<div class="empty" style="margin-top:30px">'+esc(err)+'</div>';return;}
  const canEdit=qboCanEdit();const s=st.settings||{};
  /* connection */
  h+='<div class="panel" style="padding:16px 18px;margin-bottom:14px"><div class="phd">Connection</div>';
  if(!st.configured)h+='<div class="mu">The Intuit app keys are not set in Netlify (<code>QBO_CLIENT_ID</code>, <code>QBO_CLIENT_SECRET</code>, <code>QBO_ENV</code>). See SUPABASE-SETUP → QuickBooks Online connector.</div>';
  else if(!st.connected)h+='<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="mu">Not connected · environment <b>'+esc(st.env)+'</b></span>'+(canEdit?'<a href="#" class="abtn t-gr" onclick="qboConnect();return false">Connect to QuickBooks</a>':'<span class="mu">Only the super admin can connect.</span>')+'</div>';
  else h+='<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span><b>'+esc(st.company||st.realm)+'</b> <span class="mu">· '+esc(st.connectedEnv||st.env)+' · company id '+esc(st.realm)+' · connection valid until '+qboWhen(st.refreshExpires)+'</span></span>'+
    '<span class="pill '+(s.qbo_enabled==='1'?'pgr':'pam')+'">'+(s.qbo_enabled==='1'?'Enabled — posting':'Preview — posting nothing')+'</span>'+
    '<a href="#" class="abtn" onclick="qboRun(false);return false">Sync now</a>'+(canEdit?'<a href="#" class="abtn t-rd" onclick="qboDisconnect();return false">Disconnect</a>':'')+'</div>'+
    (st.connectedEnv&&st.env!==st.connectedEnv?'<div class="mu" style="margin-top:8px;color:var(--am)">Netlify says <b>'+esc(st.env)+'</b> but the connection is to <b>'+esc(st.connectedEnv)+'</b> — connect again after switching QBO_ENV.</div>':'');
  h+='</div>';
  /* settings */
  if(st.connected){
    const sel=(id,opts,cur,ph)=>'<select id="'+id+'" '+(canEdit?'':'disabled ')+'style="font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--sf);color:var(--tx);min-width:200px"><option value="">'+esc(ph)+'</option>'+(opts||[]).map(o=>'<option value="'+esc(o.id)+'"'+(String(cur)===String(o.id)?' selected':'')+'>'+esc(o.name)+(o.sub?' — '+esc(o.sub):'')+'</option>').join('')+'</select>';
    const L=QBO_LISTS||{};
    h+='<div class="panel" style="padding:16px 18px;margin-bottom:14px"><div class="phd">Settings <span class="mu" style="font-weight:400;font-size:11px">'+(canEdit?'super admin':'read-only for your role')+'</span></div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">'+
      '<label><div class="mu" style="font-size:11px;margin-bottom:3px">Post orders fulfilled from (the cutover date)</div><input type="date" id="qbo-post-from" value="'+esc(s.qbo_post_from||'')+'" '+(canEdit?'':'disabled')+' style="font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--sf);color:var(--tx)"></label>'+
      '<label><div class="mu" style="font-size:11px;margin-bottom:3px">VAT tax code (12%, inclusive)</div>'+sel('qbo-tax',L.taxCodes,s.qbo_tax_code,QBO_LISTS?'— choose —':'load lists first')+'</label>'+
      '<label><div class="mu" style="font-size:11px;margin-bottom:3px">Deposit payments to</div>'+sel('qbo-dep',L.depositAccounts,s.qbo_deposit_account,QBO_LISTS?'Undeposited funds (QBO default)':'load lists first')+'</label>'+
      '<label><div class="mu" style="font-size:11px;margin-bottom:3px">Income account for new items</div>'+sel('qbo-inc',L.incomeAccounts,s.qbo_income_account,QBO_LISTS?'— choose —':'load lists first')+'</label>'+
      '<label><div class="mu" style="font-size:11px;margin-bottom:3px">Which orders</div><select id="qbo-src" '+(canEdit?'':'disabled')+' style="font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--sf);color:var(--tx)"><option value="native"'+((s.qbo_sources||'native')==='native'?' selected':'')+'>Orders entered in HQ only</option><option value="all"'+(s.qbo_sources==='all'?' selected':'')+'>Every order in HQ, incl. imported Shopify ones</option></select></label>'+
      '<div><div class="mu" style="font-size:11px;margin-bottom:3px">On each invoice</div><label style="display:block"><input type="checkbox" id="qbo-class" '+(s.qbo_use_class==='1'?'checked':'')+(canEdit?'':' disabled')+'> Class = specialist'+(QBO_LISTS&&!L.classTracking?' <span class="mu">(class tracking is off in QBO)</span>':'')+'</label><label style="display:block"><input type="checkbox" id="qbo-loc" '+(s.qbo_use_location==='1'?'checked':'')+(canEdit?'':' disabled')+'> Location = team'+(QBO_LISTS&&!L.locationTracking?' <span class="mu">(location tracking is off in QBO)</span>':'')+'</label><label style="display:block"><input type="checkbox" id="qbo-confirm" '+((s.qbo_require_confirm||'1')!=='0'?'checked':'')+(canEdit?'':' disabled')+'> Hold invoices until a fuzzy customer match is confirmed</label></div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px">'+(QBO_LISTS?'':'<a href="#" class="abtn" onclick="qboLoadLists();return false">Load tax codes &amp; accounts from QuickBooks</a>')+
      (canEdit?'<a href="#" class="abtn t-gr" onclick="qboSaveSettings();return false">Save settings</a><a href="#" class="abtn '+(s.qbo_enabled==='1'?'t-rd':'t-gr')+'" onclick="qboToggle();return false">'+(s.qbo_enabled==='1'?'Disable — back to preview':'Enable — start posting')+'</a>':'')+
      '<span class="mu" id="qbo-msg" style="font-size:11.5px"></span></div></div>';
  }
  /* last run */
  const R=st.lastRun;
  h+='<div class="panel" style="padding:16px 18px;margin-bottom:14px"><div class="phd">Last run</div>';
  if(!R)h+='<div class="mu">No run yet. The schedule runs every 15 minutes once connected; Sync now runs one immediately.</div>';
  else h+='<div class="metrics">'+bizKpi('Mode',R.mode==='live'?'Live':'Preview',qboWhen(R.finished||R.started)+' · by '+esc(R.by||'schedule'),R.mode==='live'?'gr':'am')+
    bizKpi('Invoices',String((R.invoices||{}).posted||0)+(R.mode==='preview'?' / '+((R.invoices||{}).preview||0)+' would post':''),((R.invoices||{}).updated||0)+' updated · '+((R.invoices||{}).voided||0)+' voided · '+((R.invoices||{}).held||0)+' held','bl')+
    bizKpi('Payments',String((R.payments||{}).posted||0)+' sent · '+((R.payments||{}).pulled||0)+' pulled',((R.payments||{}).skipped||0)+' skipped','pu')+
    bizKpi('Errors',String((R.errors||[]).length),(R.errors||[]).length?'see below':'none',(R.errors||[]).length?'rd':'gr')+'</div>'+
    ((R.errors||[]).length?'<div style="margin-top:8px;font-size:12px">'+R.errors.slice(0,12).map(e=>'<div style="color:var(--rd)">'+esc(e)+'</div>').join('')+(R.errors.length>12?'<div class="mu">… '+(R.errors.length-12)+' more</div>':'')+'</div>':'');
  h+='</div>';
  /* mappings */
  h+='<div class="panel" style="padding:16px 18px;margin-bottom:14px" id="qbo-maps"><div class="phd">Customer matches to confirm <span class="pill '+(st.unconfirmed?'pam':'pgy')+'">'+st.unconfirmed+'</span></div><div id="qbo-maps-body" class="mu">'+(st.unconfirmed?'Loading…':'Nothing waiting. A clinic whose name in HQ is not exactly the QuickBooks name lands here; confirm the match (or pick another) and the held invoices post on the next run.')+'</div></div>';
  /* ledger */
  h+='<div class="panel" style="padding:16px 18px;margin-bottom:14px"><div class="phd">Sync ledger</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><input id="qbo-q" placeholder="HS number…" oninput="qboLogDebounce()" style="font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--sf);color:var(--tx)"><select id="qbo-f" onchange="qboLoadLog()" style="font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--sf);color:var(--tx)"><option value="">All statuses</option><option value="pending">Pending / preview</option><option value="posted">Posted</option><option value="updated">Updated</option><option value="error">Errors</option><option value="voided">Voided</option><option value="skipped">Skipped</option></select>'+
    Object.entries(st.counts||{}).map(([k,v])=>'<span class="mu" style="font-size:11.5px">'+esc(k)+': '+Object.entries(v).map(([a,b])=>b+' '+a).join(', ')+'</span>').join('')+'</div><div id="qbo-log" class="mu">Loading…</div></div>';
  c.innerHTML=h;
  if(st.unconfirmed)qboLoadMaps();
  qboLoadLog();
}
async function qboLoadLists(){const m=$('qbo-msg');if(m)m.textContent='Reading QuickBooks lists…';try{QBO_LISTS=await qboApi('lists');await renderQbo();}catch(e){if(m)m.textContent='Could not read lists: '+e.message;}}
async function qboSaveSettings(){
  if(!qboCanEdit())return;const m=$('qbo-msg');if(m)m.textContent='Saving…';
  const v={qbo_post_from:($('qbo-post-from')||{}).value||'',qbo_tax_code:($('qbo-tax')||{}).value||'',qbo_deposit_account:($('qbo-dep')||{}).value||'',qbo_income_account:($('qbo-inc')||{}).value||'',qbo_sources:($('qbo-src')||{}).value||'native',
    qbo_use_class:($('qbo-class')||{}).checked?'1':'0',qbo_use_location:($('qbo-loc')||{}).checked?'1':'0',qbo_require_confirm:($('qbo-confirm')||{}).checked?'1':'0'};
  try{await qboApi('settings',{values:v});audit('qbo.settings',v);if(m)m.textContent='Saved.';}catch(e){if(m)m.textContent='Could not save: '+e.message;}}
async function qboToggle(){
  if(!qboCanEdit()||!QBO_ST)return;const on=(QBO_ST.settings||{}).qbo_enabled==='1';const s=QBO_ST.settings||{};
  if(!on){if(!s.qbo_post_from||!s.qbo_tax_code||!s.qbo_income_account){uiAlert('Before enabling: set the post-from date, the VAT tax code and the income account, then Save settings.');return;}
    if(!await uiConfirm('Enable the QuickBooks sync?\n\nFrom the next run, fulfilled orders dated '+s.qbo_post_from+' onward are posted to '+(QBO_ST.company||'QuickBooks')+' as invoices, with their payments. Make sure the Shopify→QBO connector is OFF for the same orders, or they will be booked twice.'))return;}
  else if(!await uiConfirm('Disable the sync? Nothing more is posted; runs continue in preview.'))return;
  try{await qboApi('settings',{values:{qbo_enabled:on?'0':'1'}});audit('qbo.'+(on?'disable':'enable'),{});await renderQbo();}catch(e){uiAlert('Could not change: '+e.message);}}
async function qboRun(force){const m=$('qbo-msg');if(m)m.textContent='Sync started — refresh in a minute for the result.';try{await qboApi('run',{force:!!force});}catch(e){if(m)m.textContent='Could not start: '+e.message;else uiAlert(e.message);}}
async function qboConnect(){
  if(!qboCanEdit())return;
  try{const r=await fetch('/.netlify/functions/qbo-auth?action=start',{headers:await sbAuthHeaders()});const j=await r.json();if(!j.url)throw new Error(j.error||'no url');
    audit('qbo.connect.start',{env:j.env});location.href=j.url;}catch(e){uiAlert('Could not start the QuickBooks connection: '+e.message);}}
async function qboDisconnect(){
  if(!qboCanEdit())return;if(!await uiConfirm('Disconnect QuickBooks? The sync stops and the tokens are revoked. Connecting again is one click.'))return;
  try{const r=await fetch('/.netlify/functions/qbo-auth',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),body:JSON.stringify({action:'disconnect'})});const j=await r.json();if(j.error)throw new Error(j.error);QBO_LISTS=null;await renderQbo();}catch(e){uiAlert('Could not disconnect: '+e.message);}}
async function qboLoadMaps(){
  const b=$('qbo-maps-body');if(!b)return;
  try{const {rows}=await qboApi('mappings');if(!rows.length){b.textContent='Nothing waiting.';return;}
    b.className='';b.innerHTML=bizTbl(['HQ name','Matched in QuickBooks','Other candidates','',''],rows.map(r=>{const cands=(r.candidates||[]).filter(x=>String(x.id)!==String(r.qbo_id));
      return ['<b>'+esc(r.hq_key)+'</b> <span class="mu" style="font-size:10px">'+esc(r.kind)+'</span>',esc(r.qbo_name||r.qbo_id),
        cands.length?cands.map(x=>'<a href="#" class="abtn" onclick="qboConfirm(\''+esc(r.kind)+'\',\''+esc(r.hq_key).replace(/'/g,'&#39;')+'\',\''+esc(x.id)+'\',\''+esc(x.name).replace(/'/g,'&#39;')+'\');return false">use '+esc(x.name)+'</a>').join(' '):'<span class="mu">—</span>',
        '<a href="#" class="abtn t-gr" onclick="qboConfirm(\''+esc(r.kind)+'\',\''+esc(r.hq_key).replace(/'/g,'&#39;')+'\');return false">Confirm</a>',
        '<a href="#" class="abtn" onclick="qboPick(\''+esc(r.kind)+'\',\''+esc(r.hq_key).replace(/'/g,'&#39;')+'\');return false">Search QuickBooks…</a>'];}),{left:true});
  }catch(e){b.textContent='Could not load: '+e.message;}}
async function qboConfirm(kind,key,qboId,qboName){
  try{await qboApi('confirm',{kind,hq_key:key,qbo_id:qboId||undefined,qbo_name:qboName||undefined});await renderQbo();}catch(e){uiAlert('Could not confirm: '+e.message);}}
async function qboPick(kind,key){
  const term=await uiPrompt('Search QuickBooks customers for:',key);if(!term)return;
  try{const {rows}=await qboApi('search',null,'q='+encodeURIComponent(term));if(!rows.length){uiAlert('No QuickBooks customer contains "'+term+'". Confirm the current match to keep it, or create the customer in QuickBooks first.');return;}
    const pick=await uiPrompt(rows.map((r,i)=>(i+1)+'. '+r.name).join('\n')+'\n\nType the number to use for "'+key+'":');const r=rows[(+pick||0)-1];if(!r)return;
    await qboConfirm(kind,key,r.id,r.name);}catch(e){uiAlert('Search failed: '+e.message);}}
let _qboLogT=null;function qboLogDebounce(){clearTimeout(_qboLogT);_qboLogT=setTimeout(qboLoadLog,300);}
async function qboLoadLog(){
  const el=$('qbo-log');if(!el)return;const q=($('qbo-q')||{}).value||'',f=($('qbo-f')||{}).value||'';
  try{const {rows}=await qboApi('log',null,(f?'status='+encodeURIComponent(f):'')+(q?'&q='+encodeURIComponent(q):''));
    if(!rows.length){el.className='mu';el.textContent='Nothing here yet.';return;}
    el.className='';el.innerHTML=bizTbl(['Order','Document','Status','QBO no.','Amount','Detail','Updated',''],rows.map(r=>[r.order_id?'<a href="#" onclick="showOrderPage(\''+esc(r.order_id)+'\');return false">'+esc(r.order_label||r.hq_ref)+'</a>':esc(r.order_label||r.hq_ref),esc(r.kind),'<span class="pill '+(QBO_STATUS_TONE[r.status]||'pgy')+'">'+esc(r.status)+'</span>',esc(r.qbo_doc_no||r.qbo_id||'—'),qboFmt(r.amount),'<span class="mu" style="font-size:11px">'+esc(r.last_error||'')+'</span>',qboWhen(r.updated_at),
      r.status==='error'||r.status==='pending'?'<a href="#" class="abtn" onclick="qboRetry('+r.id+');return false">Retry</a>':'']),{left:true});
  }catch(e){el.className='mu';el.textContent='Could not load: '+e.message;}}
async function qboRetry(id){try{await qboApi('retry',{id});qboLoadLog();}catch(e){uiAlert('Could not retry: '+e.message);}}
