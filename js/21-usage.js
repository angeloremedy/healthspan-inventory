/* ── USAGE — who uses HQ and Ask Healthspan, and how often (super admin, 2026-10-08) ──
   Every page open (pushRoute) and every Ask Healthspan answer calls usagePing(), a
   fire-and-forget RPC (public.usage_ping) that adds one to the person's row for the
   Manila day in public.usage_daily: page opens per page, sessions (a gap of 30+
   minutes starts a new one), Ask questions per model, first and last time seen.
   Only the super admin can read the table (RLS). Question text is never stored
   against a name: the anonymous question log (Blobs, /api/asklog) only gives this
   page counts, failures and response times — including the Slack /stock bot.
   Before the SQL runs the RPC simply fails quietly and the page says what to run. */
const USAGE_ROUTE={a:'account',d:'delivery',m:'statement',o:'order',p:'pickslip',s:'spec'};
let USAGE_LAST={k:'',t:0}, USAGE_DAYS=30;
function usageRouteKey(h){const m=String(h||'').match(/^#\/([a-z])\/([^/?#]*)/);if(!m)return '';
  if(m[1]!=='v')return USAGE_ROUTE[m[1]]||'';try{return decodeURIComponent(m[2]);}catch(e){return m[2];}}
function usagePing(kind,key){
  try{
    if(typeof SB==='undefined'||!SB||!SB.rpc||typeof SBUSER==='undefined'||!SBUSER)return;
    key=String(key||'').replace(/[^a-z0-9_.:-]/gi,'').slice(0,40);if(!key)return;
    if(kind==='view'){const now=Date.now();if(USAGE_LAST.k===key&&now-USAGE_LAST.t<5000)return;USAGE_LAST={k:key,t:now};} // a re-render is not a visit
    const q=SB.rpc('usage_ping',{p_kind:kind,p_key:key});if(q&&q.then)q.then(()=>{},()=>{});
  }catch(e){}}
/* the sidebar's own name for a page, so the table reads like the menu */
function usagePageLbl(v){
  const X={spec:'Specialist page',order:'Order',account:'Account profile',pickslip:'Pick list',delivery:'Delivery receipt',statement:'Statement',ask:'Ask Healthspan',home:'Home'};
  if(X[v])return X[v];
  try{const el=[...document.querySelectorAll('.nav .ni')].find(x=>(x.getAttribute('onclick')||'').indexOf("showView('"+v+"'")>=0);
    if(el){const t=el.textContent.replace(/\d+$/,'').trim();if(t)return t;}}catch(e){}
  return v;}
function usageModelLbl(m){return typeof askModelLbl==='function'?askModelLbl(m):m;}
async function usageLoad(days){
  const from=daysISO(-(days-1));
  const out={rows:[],users:[],ask:null,err:'',from};
  const jobs=[];
  jobs.push((async()=>{try{const {data,error}=await SB.from('usage_daily').select('user_id,day,views,asks,sessions,pages,ask_models,first_at,last_at').gte('day',from).limit(20000);
    if(error)throw error;out.rows=data||[];}catch(e){out.err=String(e.message||e);}})());
  jobs.push((async()=>{try{const d=await adminUsers('list');out.users=(d&&d.users)||[];}catch(e){}})());
  jobs.push((async()=>{try{const r=await fetch('/api/asklog?days='+Math.min(90,days),{headers:await sbAuthHeaders()});const o=await r.json();if(o&&o.logs)out.ask=o;}catch(e){}})());
  await Promise.all(jobs);
  return out;}
/* fold the daily rows into per-person, per-page, per-day and per-model totals */
function usageFold(D,days){
  const P={},pages={},daily={},models={};
  const dayKeys=[];for(let i=days-1;i>=0;i--)dayKeys.push(daysISO(-i));
  for(const k of dayKeys)daily[k]={people:new Set(),views:0,asks:0};
  for(const r of D.rows){
    const p=P[r.user_id]||(P[r.user_id]={id:r.user_id,days:0,views:0,asks:0,sessions:0,pages:{},last:'',first:''});
    p.days++;p.views+=r.views||0;p.asks+=r.asks||0;p.sessions+=r.sessions||0;
    if(String(r.last_at||'')>p.last)p.last=String(r.last_at||'');
    for(const k in (r.pages||{})){const n=+r.pages[k]||0;p.pages[k]=(p.pages[k]||0)+n;const g=pages[k]||(pages[k]={n:0,people:new Set()});g.n+=n;g.people.add(r.user_id);}
    for(const k in (r.ask_models||{}))models[k]=(models[k]||0)+(+r.ask_models[k]||0);
    const d=daily[String(r.day).slice(0,10)];if(d){if((r.views||0)+(r.asks||0)>0)d.people.add(r.user_id);d.views+=r.views||0;d.asks+=r.asks||0;}}
  const byId={};for(const u of D.users)byId[u.id]=u;
  const people=[];
  for(const u of D.users){if(u.banned)continue;const p=P[u.id]||{id:u.id,days:0,views:0,asks:0,sessions:0,pages:{},last:''};
    people.push(Object.assign({name:u.name||u.email||'—',email:u.email||'',role:u.is_super?'Super admin':({admin:'Admin',manager:'Sales manager',sales:'Product specialist',supply_chain:'Supply chain',finance:'Finance',marketing:'Marketing',viewer:'Viewer'}[u.role]||u.role||''),signin:u.last||'',invited:!!u.invited},p));}
  for(const id in P)if(!byId[id])people.push(Object.assign({name:'(account removed)',role:'',signin:''},P[id]));
  people.sort((a,b)=>(b.views+b.asks*3)-(a.views+a.asks*3)||String(a.name).localeCompare(String(b.name)));
  // the anonymous question log: web vs Slack, failures, response time
  let web=0,slack=0,failed=0,ms=0,msN=0;
  if(D.ask&&D.ask.logs)for(const d in D.ask.logs)for(const e of D.ask.logs[d]){if(e.src==='slack')slack++;else web++;if(!e.ok)failed++;if(e.ms>0){ms+=e.ms;msN++;}}
  return {people,pages,daily,dayKeys,models,log:D.ask?{web,slack,failed,avgMs:msN?ms/msN:0}:null};}
function usageAgo(iso){if(!iso)return '—';const s=(Date.now()-Date.parse(iso))/1000;if(!(s>=0))return '—';
  if(s<3600)return Math.max(1,Math.round(s/60))+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';const d=Math.round(s/86400);return d+' day'+(d===1?'':'s')+' ago';}
async function renderUsage(){
  if(!(typeof isSuper==='function'&&isSuper())){$('content').innerHTML='<div class="empty" style="margin-top:40px">Super admin only.</div>';return;}
  loadingHint();
  const days=USAGE_DAYS;
  const D=await usageLoad(days);
  if(currentView!=='usage')return;
  const tab=(n,l)=>'<div class="tab'+(USAGE_DAYS===n?' active':'')+'" onclick="USAGE_DAYS='+n+';renderUsage()">'+l+'</div>';
  const bar='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><div class="tabs" style="margin:0">'+tab(7,'7 days')+tab(30,'30 days')+tab(90,'90 days')+'</div>'+
    '<span class="mu" style="font-size:11.5px">Counted since this page went live — earlier days are empty, not idle.</span></div>';
  if(D.err&&!D.rows.length){
    $('content').innerHTML=bar+'<div class="viewdesc" style="border-left-color:var(--am)"><div class="vd-t"><b>The usage table is not there yet.</b> Run the SQL in SUPABASE-SETUP.md → “Usage (2026-10-08)” in the Supabase SQL editor; HQ starts counting from the next page anyone opens.<br><span class="mu" style="font-size:11px">'+esc(D.err)+'</span></div></div>';
    return;}
  const F=usageFold(D,days);
  const active=F.people.filter(p=>p.views+p.asks>0);
  const accounts=F.people.filter(p=>p.name!=='(account removed)');
  const totViews=F.people.reduce((a,p)=>a+p.views,0),totAsks=F.people.reduce((a,p)=>a+p.asks,0),totSess=F.people.reduce((a,p)=>a+p.sessions,0);
  const askers=F.people.filter(p=>p.asks>0).length;
  const wk=F.dayKeys.filter(k=>{const d=new Date(k+'T00:00:00Z').getUTCDay();return d>0&&d<6;});
  const avgDau=wk.length?wk.reduce((a,k)=>a+F.daily[k].people.size,0)/wk.length:0;
  const cards='<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">People using HQ</div><div class="met-val">'+active.length+' <span style="font-size:13px;color:var(--tx3)">/ '+accounts.length+'</span></div><div class="met-sub">opened HQ in the last '+days+' days · '+avgDau.toFixed(1)+' a weekday on average</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Page opens</div><div class="met-val">'+totViews.toLocaleString()+'</div><div class="met-sub">'+totSess.toLocaleString()+' sessions'+(active.length?' · '+Math.round(totViews/active.length).toLocaleString()+' per active person':'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Ask Healthspan questions</div><div class="met-val">'+totAsks.toLocaleString()+'</div><div class="met-sub">from '+askers+' '+(askers===1?'person':'people')+(F.log?' · '+F.log.slack.toLocaleString()+' more on Slack /stock':'')+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Ask answers</div><div class="met-val">'+(F.log&&(F.log.web+F.log.slack)?Math.round((1-F.log.failed/(F.log.web+F.log.slack))*100)+'%':'—')+'</div><div class="met-sub">'+(F.log?'answered without an error · '+(F.log.avgMs?(F.log.avgMs/1000).toFixed(1)+' s on average':'no timings yet'):'question log not available')+'</div><div class="met-bar"></div></div>'+
    '</div>';
  const chart='<div class="panel" style="padding:16px;margin-bottom:14px"><div class="phd">Every day — people in HQ and Ask questions</div><div class="cw" style="height:220px"><canvas id="usChart"></canvas></div></div>';
  const topPages=Object.keys(F.pages).map(k=>({k,n:F.pages[k].n,ppl:F.pages[k].people.size})).sort((a,b)=>b.n-a.n);
  const pp=p=>Object.keys(p.pages).map(k=>[k,p.pages[k]]).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,n])=>esc(usagePageLbl(k))+' <span class="mu">'+n+'</span>').join(' · ');
  const tbl='<div class="tcard" style="margin-bottom:14px"><div class="tscroll"><table id="us-people"><thead><tr><th>Person</th><th>Role</th><th>Last seen</th><th style="text-align:right">Days active</th><th style="text-align:right">Sessions</th><th style="text-align:right">Page opens</th><th style="text-align:right">Ask questions</th><th>Most used pages</th></tr></thead><tbody>'+
    (F.people.length?F.people.map(p=>{const idle=!(p.views+p.asks);
      return '<tr'+(idle?' style="opacity:.6"':'')+'><td style="font-weight:600">'+esc(p.name)+(p.invited?' <span class="pill pam">invited</span>':'')+'</td><td class="mu">'+esc(p.role)+'</td>'+
        '<td>'+(p.last?esc(usageAgo(p.last)):(p.signin?'<span class="mu">signed in '+esc(usageAgo(p.signin))+'</span>':'<span class="mu">never</span>'))+'</td>'+
        '<td class="r">'+(p.days||'—')+'</td><td class="r">'+(p.sessions||'—')+'</td><td class="r" style="font-weight:600">'+(p.views?p.views.toLocaleString():'—')+'</td><td class="r" style="font-weight:600">'+(p.asks?p.asks.toLocaleString():'—')+'</td>'+
        '<td style="white-space:normal;font-size:11.5px">'+(idle?'<span class="mu">not in the last '+days+' days</span>':pp(p))+'</td></tr>';}).join(''):
      '<tr><td colspan="8"><div class="empty">No accounts loaded.</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Busiest first; people who have not opened HQ in the period are dimmed at the bottom · last seen = the last page or question HQ counted (else the last sign-in) · a session = activity with no gap longer than 30 minutes · Export CSV gives this table</span></div></div>';
  const pagesTbl='<div class="panel" style="padding:16px"><div class="phd">Pages people open</div>'+
    (topPages.length?'<div class="tscroll"><table style="min-width:0"><thead><tr><th>Page</th><th style="text-align:right">Opens</th><th style="text-align:right">People</th></tr></thead><tbody>'+
      topPages.slice(0,25).map(t=>'<tr><td>'+esc(usagePageLbl(t.k))+'</td><td class="r">'+t.n.toLocaleString()+'</td><td class="r">'+t.ppl+'</td></tr>').join('')+'</tbody></table></div>':'<div class="mu" style="font-size:12px">Nothing counted yet.</div>')+'</div>';
  const mk=Object.keys(F.models).sort((a,b)=>F.models[b]-F.models[a]);
  const askTbl='<div class="panel" style="padding:16px"><div class="phd">Ask Healthspan</div>'+
    (mk.length?'<div class="tscroll"><table style="min-width:0"><thead><tr><th>Answered by</th><th style="text-align:right">Questions</th></tr></thead><tbody>'+
      mk.map(k=>'<tr><td>'+esc(k==='failed'?'No answer (error)':usageModelLbl(k))+'</td><td class="r">'+F.models[k].toLocaleString()+'</td></tr>').join('')+'</tbody></table></div>':'<div class="mu" style="font-size:12px">No questions counted yet.</div>')+
    '<div class="mu" style="font-size:11px;margin-top:8px">Counts only — what people asked is never shown with their name; chats stay private to their owner.'+(F.log?' Slack /stock: '+F.log.slack.toLocaleString()+' questions in the period (no names — the bot is not tied to HQ accounts).':'')+'</div></div>';
  $('content').innerHTML=bar+cards+chart+tbl+'<div class="g2" style="align-items:start">'+pagesTbl+askTbl+'</div>';
  try{
    if(window._usChart)window._usChart.destroy();
    window._usChart=new Chart($('usChart'),{data:{labels:F.dayKeys.map(k=>k.slice(5)),datasets:[
      {type:'bar',label:'People in HQ',data:F.dayKeys.map(k=>F.daily[k].people.size),backgroundColor:'rgba(0,22,143,0.6)',borderRadius:3,yAxisID:'y'},
      {type:'line',label:'Ask questions',data:F.dayKeys.map(k=>F.daily[k].asks),borderColor:'#BA7517',backgroundColor:'#BA7517',pointRadius:2,yAxisID:'y1'}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(128,128,128,0.12)'}},y1:{beginAtZero:true,position:'right',ticks:{precision:0},grid:{display:false}},x:{grid:{display:false}}}}});
  }catch(e){}
  window._usLast=F;
}
function exportUsage(){
  const F=window._usLast;if(!F)return;
  downloadCSV('usage_'+USAGE_DAYS+'d',['Person','E-mail','Role','Last seen','Days active','Sessions','Page opens','Ask questions','Most used pages'],
    F.people.map(p=>[p.name,p.email||'',p.role,p.last||p.signin||'',p.days,p.sessions,p.views,p.asks,Object.keys(p.pages).sort((a,b)=>p.pages[b]-p.pages[a]).slice(0,5).map(k=>usagePageLbl(k)+' '+p.pages[k]).join('; ')]));
}
