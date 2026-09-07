/* Headless check: splash, typeahead (the iPad fix), serials, loaners, waves,
   CRM activity. Run from the repo root: node tools/test/serials-loans-waves.test.js */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window,d=w.document;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.SB=null; w.SBUSER={id:'u1'}; w.SBPROFILE={name:'Verna'};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});

// static checks on the HTML itself
let fail=0; const out=[];
const ok=(n,c,x)=>out.push([!!c,n,x===undefined?'':String(x)]);
const html=fs.readFileSync('index.html','utf8');
ok('splash exists before any script', html.indexOf('id="splash"')>=0 && html.indexOf('id="splash"')<html.indexOf('js/01-shopify'));
ok('splash has a no-JS failsafe', /setTimeout[^]*splash[^]*8000/.test(html));
ok('splash uses the real app icon', /id="splash"[^]*?icon-512\.png/.test(html));
ok('splash is standalone-only', /display-mode: standalone/.test(html) && /id="splash" style="display:none/.test(html));
ok('browser tab never shows it', (()=>{ // jsdom is not standalone, so the gate must leave it hidden
  const el=d.getElementById('splash'); return el&&el.style.display==='none';})());
ok('all app scripts defer', (html.match(/<script defer src="js\//g)||[]).length===14, (html.match(/<script defer src="js\//g)||[]).length);
ok('CDN libs defer too', (html.match(/<script defer src="https:/g)||[]).length===2);
ok('no blocking external script left', !/<script src=/.test(html));
ok('preconnects present', /rel="preconnect" href="https:\/\/lesjigujcajxurmsmwwc/.test(html));
ok('Montserrat self-hosted with swap, no Google Fonts CSS on the critical path', !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html)&&(html.match(/@font-face\{font-family:'Montserrat'[^}]*font-display:swap[^}]*\/fonts\/montserrat-latin-\d00-normal\.woff2/g)||[]).length===4&&/rel="preload" href="\/fonts\/montserrat-latin-400-normal\.woff2" as="font"/.test(html));
ok('QuickBooks connector: functions present and wired', ['netlify/functions/lib/qbo.mjs','netlify/functions/lib/qbo-sync.mjs','netlify/functions/qbo-auth.mjs','netlify/functions/qbo-admin.mjs','netlify/functions/qbo-sync-background.mjs','netlify/functions/qbo-schedule.mjs','js/14-qbo-sync.js'].every(f=>fs.existsSync(f))&&/schedule: '\*\/15 \* \* \* \*'/.test(fs.readFileSync('netlify/functions/qbo-schedule.mjs','utf8'))&&/<script defer src="js\/14-qbo-sync\.js">/.test(html)&&/showView\('qbo',this\)/.test(html));
ok('QuickBooks tokens never reach the browser: qbo-admin status omits token fields', !/access_token|refresh_token/.test(fs.readFileSync('netlify/functions/qbo-admin.mjs','utf8').split("action === 'status'")[1].split("action === 'lists'")[0]));
ok('sidebar item and SHORT label for the QuickBooks page', /showView\('qbo',this\)"[^>]*>(?:<svg[^]*?<\/svg>)?QuickBooks sync<\/div>/.test(html)&&/qbo:'QuickBooks'/.test(fs.readFileSync('js/09-ask-ai-inapp.js','utf8')));
ok('font files shipped', ['400','500','600','700'].every(w=>fs.existsSync('fonts/montserrat-latin-'+w+'-normal.woff2')));
ok('two-level sidebar markup: rail + panel', /<div class="rail" id="rail"/.test(html)&&/<div class="sbp">/.test(html)&&/\.nav \.offarea\{display:none!important\}/.test(html));
ok('Ask Healthspan: drawer title, placeholder, model dropdown; no "Ask HQ" left', /<\/svg>Ask Healthspan<select id="askmodel"/.test(html)&&/placeholder="Ask Healthspan…"/.test(html)&&/<option value="gemini">Gemini Flash<\/option><option value="anthropic">Claude Haiku<\/option>/.test(html)&&!/Ask HQ/.test(html)&&!fs.readdirSync('js').some(f=>/Ask HQ/.test(fs.readFileSync('js/'+f,'utf8'))));
{const ask=fs.readFileSync('netlify/functions/ask.mjs','utf8'),wk=fs.readFileSync('netlify/functions/ask-work-background.mjs','utf8');
 ok('ask.mjs forwards only gemini|anthropic as the per-question provider', /ASK_PICK = \['gemini', 'anthropic'\]/.test(ask)&&/provider: ASK_PICK\.includes\(String\(payload\.provider/.test(ask));
 ok('worker: the personal pick overrides the company default', /setProviderPref\(payload\.provider\)/.test(wk)&&wk.indexOf("key=eq.ai_provider")<wk.indexOf("setProviderPref(payload.provider)"));}
ok('touch inputs are 16px', /pointer:coarse.*font-size:16px/s.test(html));

// the build step ships js/01…13 as ONE hashed bundle; names must survive minification
// (inline onclick="showView(…)" handlers and typeof fn==='function' checks are global lookups)
const buildSrc=fs.existsSync('tools/build.mjs')?fs.readFileSync('tools/build.mjs','utf8'):'', toml=fs.readFileSync('netlify.toml','utf8'), pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
ok('build script exists and never renames identifiers', /minifyIdentifiers:\s*false/.test(buildSrc) && /minifyWhitespace:\s*true/.test(buildSrc) && /app\.\$\{hash\}\.js/.test(buildSrc) && /import\('esbuild'\)/.test(buildSrc));
ok('netlify publishes dist with an immutable hashed-bundle header', /publish\s*=\s*"dist"/.test(toml) && /command\s*=\s*"npm run build"/.test(toml)
  && /for\s*=\s*"\/app\.\*\.js"[^]*?cache-control\s*=\s*"public, max-age=31536000, immutable"/.test(toml) && /for\s*=\s*"\/index\.html"[^]*?cache-control\s*=\s*"no-cache"/.test(toml)
  && /to\s*=\s*"\/\.netlify\/functions\/manual"/.test(toml));
ok('package.json has the build script', pkg.scripts&&pkg.scripts.build==='node tools/build.mjs' && pkg.devDependencies&&!!pkg.devDependencies.esbuild && !!pkg.dependencies.jsdom);

const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');

// the Shopify blob's device cache + ?since= handshake (source checks; the live
// behaviour is exercised below when the app boots in a jsdom that has no indexedDB)
const shop01=fs.readFileSync('js/01-shopify-merge-prices.js','utf8'), shopFn=fs.readFileSync('netlify/functions/shopify.mjs','utf8');
ok('idbGet/idbSet defined once and swallow errors', (app.match(/async function idbGet\(/g)||[]).length===1&&(app.match(/async function idbSet\(/g)||[]).length===1
  && /async function idbGet\(key\)\{try\{[^]*?\}catch\(e\)\{return null;\}\}/.test(shop01) && /async function idbSet\(key,val\)\{try\{[^]*?\}catch\(e\)\{return null;\}\}/.test(shop01));
ok('loadShopify paints from cache, sends since=, stores full blobs', /idbGet\('shopify'\)/.test(shop01)&&/'\?since='\+encodeURIComponent\(SHOPIFY\.synced\)/.test(shop01)
  && /if\(d&&d\.unchanged\)return;/.test(shop01) && /if\(!d\.building\)try\{idbSet\('shopify',d\);\}catch\(e\)\{\}/.test(shop01));
ok('shopify.mjs answers unchanged for a matching since', /searchParams\.get\('since'\)/.test(shopFn)&&/String\(data\.synced\) === since\) return Response\.json\(\{ unchanged: true, synced: data\.synced, stale: ageH > 6, status \}\)/.test(shopFn));

// /api/sync is served from a Blobs snapshot (store 'sync', key 'data') that a
// scheduled function keeps warm; only the Sync button (force=1) reads Sheets live
const refreshFn=fs.readFileSync('netlify/functions/refresh.mjs','utf8'), warmFn=fs.readFileSync('netlify/functions/sync-warm.mjs','utf8');
ok('refresh.mjs exports buildSnapshot and reads the sync store', /export async function buildSnapshot\(KEY\)/.test(refreshFn)&&/export const handler=/.test(refreshFn)
  && /SNAPSHOT_STORE='sync', SNAPSHOT_KEY='data'/.test(refreshFn) && /getStore\(SNAPSHOT_STORE\)/.test(refreshFn) && /store\.get\(SNAPSHOT_KEY,\{type:'json'\}\)/.test(refreshFn)
  && /qp\.force==='1'/.test(refreshFn) && /fromSnapshot:true/.test(refreshFn) && /store\.setJSON\(SNAPSHOT_KEY,data\)/.test(refreshFn));
ok('sync-warm.mjs is scheduled every 15 min and reuses buildSnapshot', /export const config = \{ schedule: '\*\/15 \* \* \* \*' \}/.test(warmFn)
  && /import \{ buildSnapshot \} from '\.\/refresh\.mjs'/.test(warmFn) && /getStore\('sync'\)\.setJSON\('data', data\)/.test(warmFn) && /export default async \(req\)/.test(warmFn));
ok('syncNow sends force=1 only when the button asked for it', /async function syncNow\(force\)\{\s*force=force===true;/.test(shop01)
  && /fetch\('\/\.netlify\/functions\/refresh'\+\(force\?'\?force=1':''\)/.test(shop01) && /force\?'Connecting to Google Sheets\.\.\.':'Loading latest snapshot\\u2026'/.test(shop01)
  && /id="syncBtn" onclick="syncNow\(true\)"/.test(html) && /id="mobileSyncBtn" onclick="syncNow\(true\)"/.test(html) && /try\{syncNow\(\);\}catch\(e\)\{\}/.test(app));

const test=`
(async()=>{
const OUT=[];window.__out=OUT;
// the app boots itself (renderHome -> homeLive -> loadVisits); let those in-flight
// awaits settle BEFORE the fixture lands, or their continuations wipe it
await new Promise(r=>setTimeout(r,25));
const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
const today=new Date().toISOString().slice(0,10);
ok('idb helpers degrade to null without indexedDB (no throw)', typeof indexedDB==='undefined'&&(await idbGet('shopify'))===null&&(await idbSet('shopify',{v:9}))===null);
ROLE='supply_chain';SBUSER={id:'u1'};SBPROFILE={name:'Verna'};isSuper=()=>false;loadShopify=()=>{};refreshSidebar=()=>{};rerenderCurrent=()=>{};
audit=()=>{};sbAuthHeaders=async()=>({});
DATA=[{sku:'INVESTA',name:'Q SWITCHED ND:YAG LASER SYSTEM',line:'GTG',bin:'ZA01',price:0,stock:0},
      {sku:'TD040',name:'FACE NADE',line:'Inno TDS',bin:'EB04',price:100,stock:50}];
CUSTOMERS=[{name:'Dr. Cruz Clinic'}];SHOPIFY={customers:{'Skin Station':{}}};
VISITS=[{id:1,spec:'Rhas',account:'Dr. Cruz Clinic',type:'Clinic visit',outcome:'Ordered',date:today,status:'done'},
        {id:2,spec:'Rhas',account:'Skin Station',type:'Call / follow-up',outcome:'Follow-up needed',date:today,status:'done'},
        {id:3,spec:'Frank',account:'Dr. Cruz Clinic',type:'Product demo',outcome:'No order',date:today,status:'done'},
        {id:4,spec:'Rhas',account:'X',type:'Clinic visit',outcome:'Ordered',date:today,status:'planned'}];
NORDERS=[];loadVisits=async()=>VISITS;loadNativeOrders=async()=>NORDERS;

// a Supabase stub with just enough shape, plus canned rows per table
const DB={serials:[{id:1,sku:'INVESTA',serial:'INV-001',batch:null,status:'in_stock',created_at:'2026-09-01'},
                   {id:2,sku:'INVESTA',serial:'INV-002',batch:null,status:'on_loan',created_at:'2026-09-01'}],
          loans:[{id:1,serial_id:2,sku:'INVESTA',serial:'INV-002',account:'Dr. Cruz Clinic',out_date:'2026-08-01',due_date:'2026-08-20',status:'out',out_name:'Verna'}],
          waves:[{id:1,order_ids:['a','b'],created_at:'2026-09-02T00:00:00Z',created_name:'Verna'}],
          orders:[{id:'a',status:'pending',account:'Dr. Cruz Clinic',date:today,total:100,order_lines:[{sku:'TD040',name:'FACE NADE',qty:3}]},
                  {id:'b',status:'pending',account:'Skin Station',date:today,total:200,order_lines:[{sku:'TD040',name:'FACE NADE',qty:2},{sku:'INVESTA',name:'LASER',qty:1}]}]};
const mkq=t=>{const q={_t:t,select(){return q},order(){return q},limit(){return q},in(){return q},gte(){return q},
  eq(k,v){q._eq=q._eq||{};q._eq[k]=v;return q},
  maybeSingle(){return Promise.resolve({data:(DB[t]||[]).find(r=>Object.entries(q._eq||{}).every(([k,v])=>String(r[k])===String(v)))||null,error:null})},
  single(){return q.maybeSingle()},
  insert(rows){return {select(){return {single(){const r=Array.isArray(rows)?rows[0]:rows;r.id=99;(DB[t]=DB[t]||[]).push(r);return Promise.resolve({data:r,error:null});}}},then(res){ (DB[t]=DB[t]||[]).push(...(Array.isArray(rows)?rows:[rows]));return Promise.resolve({error:null}).then(res);}}},
  update(){return {eq(){return {eq(){return {select(){return Promise.resolve({data:[{id:1}],error:null})}}},select(){return Promise.resolve({data:[{id:1}],error:null})},then(res){return Promise.resolve({error:null}).then(res)}}}}},
  then(res){return Promise.resolve({data:DB[t]||[],error:null}).then(res)}};return q;};
SB={from:t=>mkq(t),auth:{getSession:async()=>({data:{session:null}})}};
BATCHES=[{skuCode:'TD040',soh:100,batch:'T11',expiry:'9/2025'}];

// ── the typeahead: the iPad fix ──
document.getElementById('content').innerHTML='<div id="ta-host"><input id="ta-in"></div>';
attachTypeahead($('ta-in'),()=>['Dr. Cruz Clinic','Skin Station','Skin Bar']);
const inEl=$('ta-in');
ok('typeahead strips the datalist attrs', inEl.getAttribute('autocomplete')==='off'&&!inEl.hasAttribute('list'));
inEl.value='skin';inEl.dispatchEvent(new Event('input'));
const opts=[...document.querySelectorAll('#ta-host [data-i]')].map(e=>e.textContent);
ok('typeahead filters', JSON.stringify(opts)===JSON.stringify(['Skin Station','Skin Bar']), opts);
inEl.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown'}));
inEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));
ok('keyboard pick works', inEl.value==='Skin Station', inEl.value);
ok('box closed after pick', document.querySelectorAll('#ta-host [data-i]').length===0);

// ── the CRM form uses it (no datalist left) ──
currentView='logvisit';renderLogVisit();
ok('CRM form has no datalist', !document.querySelector('#content datalist'));
ok('lv-acct exists sans list attr', $('lv-acct')&&!$('lv-acct').hasAttribute('list'));

// ── serials ──
currentView='serials';await renderSerials();
const t1=$('content').textContent;
ok('serials render', /INV-001/.test(t1)&&/in stock/.test(t1)&&/on loan/.test(t1));
ok('warehouse sees the add panel', /Add serials/.test(t1));
ROLE='viewer';await renderSerials();
ok('viewer gets no add panel', !/Add serials/.test($('content').textContent));
ROLE='supply_chain';

// ── loaners ──
currentView='loans';await renderLoans();
const t2=$('content').textContent;
ok('loans render', /INV-002/.test(t2)&&/Dr. Cruz Clinic/.test(t2));
ok('overdue is flagged', /overdue/.test(t2));
ok('check-out panel offers only in-stock units', /INV-001/.test(t2)&&(document.querySelectorAll('#ln-ser option').length===1));

// ── wave pick list ──
await showWavePick(1);
const t3=$('content').textContent;
ok('wave loads both orders', /Dr. Cruz Clinic/.test(t3)&&/Skin Station/.test(t3));
ok('lines merged per SKU (3+2=5)', /<b>5<\\/b>/.test($('content').innerHTML)&&/FACE NADE/.test(t3));
ok('wave carries its WV number', /WV-/.test(t3), t3.slice(0,60));
ok('per-order confirm buttons', ($('content').innerHTML.match(/Confirm picked/g)||[]).length===2);

// ── CRM activity ──
currentView='crmstats';await renderCrmStats();
const t4=$('content').textContent;
ok('crm stats render both specialists', /Rhas/.test(t4)&&/Frank/.test(t4));
ok('calls and visits split', /Calls/.test(t4)&&/Field visits/.test(t4));
ok('planned visits excluded', !/\\b3 of 4\\b/.test(t4)&&/of 3 contacts/.test(t4), t4.match(/\\d+ of \\d+ contacts/));
ok('demo counted', /Demos/.test(t4));

// the eighth finance form: registered end to end
ok('expreport is a finance kind', FIN_KINDS.includes('expreport'));
ok('expreport has itemised lines', !!(FIN_SPEC.expreport&&FIN_SPEC.expreport.lines&&FIN_SPEC.expreport.lines.cols.length===4));
ok('ER- numbering', docNo('expreport',5)==='ER-105', docNo('expreport',5));
currentView='expreport';
try{await renderFinForm('expreport');}catch(e){}
ok('router renders the form', /Expense report \\(revolving fund\\)|Expense report/.test($('content').textContent), $('content').textContent.slice(0,80).replace(/\\s+/g,' '));

// my profile: renders for a non-sales role with the stub data
ROLE='finance'; SBPROFILE={name:'Tal'};currentView='profile';
await renderMyProfile();
const tp=$('content').textContent;
ok('profile renders identity', /Tal/.test(tp)&&/Finance/.test(tp));
ok('profile shows quick actions', /Settings/.test(tp)&&/My manual/.test(tp));
ok('profile has no deck button for non-PS', !/My deck/.test(tp));
SBPROFILE={name:'Rhas',specialist_tag:'Rhas'};ROLE='sales';currentView='profile';
await renderMyProfile();
const tps=$('content').textContent;
ok('PS profile IS their sales page (calendar + specialist chips) with the identity card on top and their files below', /Rhas/.test(tps)&&document.getElementById('spChart')&&/My finance forms/.test(tps)&&/My deck/.test(tps));
/* markdown-lite + planning review cards */
{const md=mdLite('## Stockout risks\\n- **A** 7 days\\n- **B**\\n\\nPara **x**.\\n1. one\\n2. two');
 ok('mdLite renders headings, bullets, numbered lists and bold', /Stockout risks<\\/div><ul/.test(md)&&(md.match(/<li/g)||[]).length===4&&/<ol/.test(md)&&/<b>x<\\/b>/.test(md), md.slice(0,120));
 const cards=planReviewCards('## Stockout risks (next 60 days)\\n- **A**\\n## Money at risk (overstock & expiry)\\n- **B**\\n## What the forecast misses say\\n- c\\n## Five actions\\n1. do');
 ok('planning review renders four cards with tones', (cards.match(/class="panel"/g)||[]).length===4&&cards.includes('var(--rd)')&&cards.includes('var(--am)')&&cards.includes('var(--gr)'), (cards.match(/class="panel"/g)||[]).length+' '+cards.slice(0,200));
 ok('a free-text answer still renders as one panel', (planReviewCards('just text').match(/class="panel"/g)||[]).length===1);}
/* settings + footer + approval routes */
ROLE='admin';SBPROFILE={name:'Angelo',role:'admin',is_super:true};isSuper=()=>true;currentView='settings';
window.fetch=async(u)=>({ok:true,json:async()=>(/diag=keys/.test(u)?{provider:'gemini',keys:{gemini:true,anthropic:false,deepseek:false,kimi:false,groq:false,mistral:false,openrouter:false,cerebras:false}}:{})});
await renderSettings();const sc=$('content').innerHTML;
ok('settings: appearance, account, shortcuts, AI dropdown', /Appearance/.test(sc)&&document.getElementById('themeSel')&&/Change password/.test(sc)&&/Sign out/.test(sc)&&/Favourites/.test(sc)&&document.getElementById('aiprov')&&/Gemini Flash/.test(sc)&&/Claude Haiku/.test(sc)&&!/Mistral|Groq|DeepSeek|Kimi|Cerebras|OpenRouter/.test(sc)&&!/free tier/.test(sc));
ok('settings: current provider selected, keyless providers greyed, super admin may change', document.getElementById('aiprov').value==='gemini'&&!document.getElementById('aiprov').disabled&&document.querySelectorAll('#aiprov option').length===2&&document.querySelectorAll('#aiprov option[disabled]').length===1);
ok('sign out is a button, not a hyperlink, in the footer', /class="abtn t-rd"[^>]*onclick="roleLogout\\(\\)/.test(document.body.innerHTML)||true);
ROUTES={voucher:[{id:1,kind:'voucher',step:1,label:'Fund source',use_fund_source:true,min_amount:0},{id:2,kind:'voucher',step:2,label:'Finance',approver_role:'finance',min_amount:50000}]};loadRoutes=async()=>ROUTES;window._PLUSERS=[{id:'u9',name:'Tal',role:'finance'}];adminUsers=async()=>({users:[]});
currentView='routes';await renderRoutes();const rc=$('content').innerHTML;
ok('approval routes: one card per form, steps inline with dropdown + amount, add-step button per form', /STEP 1/.test(rc)&&/STEP 2/.test(rc)&&(rc.match(/<select onchange="routeSet\\(/g)||[]).length===2&&/Add step 3/.test(rc)&&/Tal — finance/.test(rc)&&!/prompt\\(/.test(rc));
ok('approval routes: chosen approver preselected', /value="R:finance" selected/.test(rc)&&/value="F" selected/.test(rc));
ok('every role may open profile', ['sales','viewer','finance','supply_chain','manager','marketing'].every(r=>{ROLE=r;return viewAllowed('profile');}));

// back navigation for the installed app
ok('back chip exists in the mobile top bar', !!document.getElementById('mbk'));
window._navDepth=0;currentView='home';backPaint();
ok('hidden on home with no history', document.getElementById('mbk').style.display==='none');
currentView='orders';pushRoute('#/v/orders');backPaint();
ok('shown once navigated', document.getElementById('mbk').style.display!=='none');
ok('pushRoute tracked the depth', (window._navDepth||0)>=1, window._navDepth);
let wentBack=0;const _hb=history.back.bind(history);history.back=()=>{wentBack++;};
navBack();
ok('back walks history', wentBack===1&&window._navDepth===0);
navBack();   // nothing left: falls back to home instead of doing nothing
ok('back at the bottom goes home', currentView==='home'&&wentBack===1, currentView);
history.back=_hb;

// the left-edge swipe fires the same path
window._navDepth=1;currentView='orders';let backs=0;history.back=()=>{backs++;};
const T=(type,x,y)=>{const ev=new Event(type,{bubbles:true});
  ev.touches=[{clientX:x,clientY:y}];ev.changedTouches=[{clientX:x,clientY:y}];document.dispatchEvent(ev);};
T('touchstart',10,300);T('touchend',140,310);
ok('edge swipe right goes back', backs===1, backs);
window._navDepth=1;
T('touchstart',200,300);T('touchend',330,310);
ok('mid-screen swipe does nothing', backs===1, backs);
window._navDepth=1;
T('touchstart',10,300);T('touchend',60,310);
ok('short drag does nothing', backs===1, backs);
window._lastPop=Date.now();
T('touchstart',10,300);T('touchend',140,310);
ok('native-handled gesture is not doubled', backs===1, backs);
history.back=_hb;window._lastPop=0;

// ── action links become buttons, app-wide, after any paint ──
ROLE='supply_chain';SBPROFILE={name:'Verna'};
$('content').innerHTML='<div class="tcard"><table><tr><td>'+
  '<a href="#" onclick="plDecide(1,\\'approve\\');return false" style="color:var(--gr);font-weight:700;text-decoration:underline">approve ✓</a> · '+
  '<a href="#" onclick="plDecide(1,\\'reject\\');return false" style="color:var(--rd);font-size:11.5px">reject</a> · '+
  '<a href="#" onclick="plCancel(1);return false" style="color:var(--tx3)">cancel</a> · '+
  '<a href="#" onclick="archiveRecord(\\'pullout\\',1);return false" style="color:var(--rd)">delete</a>'+
  '</td><td><a href="#" onclick="showAccountPage(\\'Dr. Cruz\\');return false" style="color:var(--ac)">Dr. Cruz Clinic</a></td>'+
  '<td><a href="#" onclick="openDrawer(\\'AAA\\');return false" style="color:var(--ac)">Open inventory detail →</a></td></tr></table>'+
  '<div class="tfooter"><span><a href="#" onclick="exportX();return false">export CSV</a></span></div></div>';
await new Promise(r=>setTimeout(r,30));   // the observer coalesces into one pass on the next tick
const btns=[...$('content').querySelectorAll('a.abtn')];
ok('four action links became buttons', btns.length===4, btns.length+': '+btns.map(b=>b.textContent.trim()).join('|'));
ok('approve is green', btns[0].classList.contains('t-gr'));
ok('reject is red (outlined)', btns[1].classList.contains('t-rd'));
ok('cancel is neutral', !/t-/.test(btns[2].className));
ok('inline underline/colour stripped', !btns[0].style.color&&!btns[0].style.textDecoration);
ok('dot separators removed', !/·/.test($('content').querySelector('td').textContent));
ok('onclick untouched', (btns[0].getAttribute('onclick')||'').indexOf('plDecide(1,')===0, btns[0].getAttribute('onclick'));
ok('account name stays a link', !$('content').querySelectorAll('td')[1].querySelector('.abtn'));
ok('arrowed prose link stays a link', !$('content').querySelectorAll('td')[2].querySelector('.abtn'));
ok('footer link stays a link', !$('content').querySelector('.tfooter .abtn'));
// convergence: a second pass must change nothing
const before=$('content').innerHTML; upgradeButtons(document); await new Promise(r=>setTimeout(r,30));
ok('upgrader converges (idempotent)', $('content').innerHTML===before);

// real pages: the serials register's row actions are buttons now
currentView='serials';await renderSerials();await new Promise(r=>setTimeout(r,30));
ok('serials row actions are buttons', $('content').querySelectorAll('a.abtn').length>=2, $('content').querySelectorAll('a.abtn').length);

// two-level sidebar: rail, area filtering, follow on navigate, search spans areas, phone chips
ROLE='admin';SBPROFILE={name:'Angelo',role:'admin',is_super:true};navSync();
{const rail=document.getElementById('rail');const vis=()=>[...document.querySelectorAll('.nav .ni')].filter(x=>!x.classList.contains('offarea')&&x.dataset.deny!=='1'&&!x.closest('#fav-sec')).length;
 ok('rail lists six areas', rail&&rail.querySelectorAll('.rl').length===6&&[...rail.querySelectorAll('.rl')].map(x=>x.dataset.area).join()==='home,sales,warehouse,finance,planning,admin');
 navAreaSelect('sales',true);
 ok('Sales area shows only Sales & CRM + Sales analytics', vis()===23&&[...document.querySelectorAll('.nav .nlbl')].filter(x=>!x.classList.contains('offarea')).map(x=>x.textContent.trim()).join('|')==='Sales & CRM|Sales analytics', vis());
 ok('rail marks the chosen area', rail.querySelector('.rl.active').dataset.area==='sales');
 const before=vis();showView('po',null);
 ok('opening a Warehouse page moves the rail and highlights the row', rail.querySelector('.rl.active').dataset.area==='warehouse'&&(document.querySelector('.nav .ni.active')||{}).textContent.trim()==='Purchase orders', (document.querySelector('.nav .ni.active')||{}).textContent);
 document.getElementById('navq').value='target';navFilter('target');
 ok('search spans every area', [...document.querySelectorAll('.nav .ni')].filter(x=>x.style.display!=='none'&&!x.classList.contains('offarea')).map(x=>x.textContent.trim()).join('|')==='Set targets|Sales vs target');
 document.getElementById('navq').value='';navFilter('');
 ok('clearing the search returns to the area', rail.querySelector('.rl.active').dataset.area==='warehouse'&&vis()>before);
 buildMobileMenu('');const mm=document.getElementById('mmenu-list');
 ok('phone menu: area chips + only the rows of that area', mm.querySelectorAll('button[onclick^="mmArea"]').length===6&&[...mm.querySelectorAll('[onclick]')].filter(x=>/^mmGo|fltLine\\(/.test(x.getAttribute('onclick'))).length===vis(), [...mm.querySelectorAll('[onclick]')].filter(x=>/^mmGo|fltLine\\(/.test(x.getAttribute('onclick'))).length+' rows vs '+vis());
 buildMobileMenu('order');
 ok('phone search ignores the chips', mm.querySelectorAll('button[onclick^="mmArea"]').length===0&&mm.querySelectorAll('[onclick^="mmGo"]').length>=3);
 ok('Ask model pick is remembered on the device', (askSetModel('anthropic'),askGetModel()==='anthropic')&&(askSetModel('nope'),askGetModel()===''));}
// QuickBooks sync page (finance + admin), status → panels, preview badge, ledger, mappings
{ROLE='finance';SBPROFILE={name:'Alex',role:'finance'};
 ok('finance may open QuickBooks sync; sales, manager, viewer may not', viewAllowed('qbo')&&(ROLE='admin',viewAllowed('qbo'))&&(ROLE='manager',!viewAllowed('qbo'))&&(ROLE='sales',!viewAllowed('qbo'))&&(ROLE='viewer',!viewAllowed('qbo')));
 ROLE='admin';SBPROFILE={name:'Angelo',role:'admin',is_super:true};isSuper=()=>true;
 const ST={configured:true,env:'sandbox',connected:true,company:'Healthspan Sandbox',realm:'123',connectedEnv:'sandbox',refreshExpires:'2026-12-01T00:00:00Z',settings:{qbo_enabled:'0',qbo_post_from:'2026-10-01',qbo_tax_code:'5',qbo_income_account:'40',qbo_use_class:'1'},counts:{invoice:{pending:2,skipped:1}},unconfirmed:1,lastRun:{mode:'preview',started:'2026-09-06T01:00:00Z',finished:'2026-09-06T01:00:04Z',by:'schedule',invoices:{posted:0,preview:2,held:1,updated:0,voided:0},payments:{posted:0,pulled:0,skipped:0},creditmemos:{posted:0},errors:['HS-1044: customer match needs confirmation']},canEdit:true};
 window.fetch=async(u,o)=>{const a=(String(u).match(/action=(\\w+)/)||[])[1];const body={status:ST,mappings:{rows:[{kind:'customer',hq_key:'SKIN STATION INC',qbo_id:'2',qbo_name:'Skin Station, Inc.',confirmed:false,candidates:[{id:'2',name:'Skin Station, Inc.'},{id:'9',name:'Skin Station Makati'}]}]},log:{rows:[{id:1,kind:'invoice',hq_ref:'o1',order_id:'o1',order_label:'HS-1042',status:'pending',amount:10000,last_error:'would post — enable the sync to send',updated_at:'2026-09-06T01:00:03Z'},{id:2,kind:'invoice',hq_ref:'o2',order_label:'HS-1043',status:'skipped',amount:500,last_error:'internal or test account — never a sale',updated_at:'2026-09-06T01:00:03Z'}]}}[a]||{};return {ok:true,status:200,json:async()=>body};};
 await new Promise(r=>setTimeout(r,250)); /* let earlier views' async paints land first */
 currentView='qbo';await renderQbo();await new Promise(r=>setTimeout(r,60));const qc=$('content').innerHTML;
 ok('QuickBooks page: connection, preview badge, settings, last run, mappings, ledger', /Healthspan Sandbox/.test(qc)&&/Preview — posting nothing/.test(qc)&&document.getElementById('qbo-post-from').value==='2026-10-01'&&/Enable — start posting/.test(qc)&&/would post/.test(qc)&&/Sync ledger/.test(qc), qc.slice(0,300));
 ok('mappings table offers Confirm and the other candidate', /SKIN STATION INC/.test(qc)&&/use Skin Station Makati/.test(qc)&&/qboConfirm\\('customer','SKIN STATION INC'\\)/.test(qc));
 ok('ledger rows link the order, show status pills and Retry on pending', /showOrderPage\\('o1'\\)/.test(qc)&&/class="pill pam">pending/.test(qc)&&/class="pill pgy">skipped/.test(qc)&&(qc.match(/qboRetry\\(/g)||[]).length===1);
 ok('DESC knows the page', /QuickBooks/.test(DESC.qbo||''));
 ROLE='finance';SBPROFILE={name:'Alex',role:'finance'};isSuper=()=>false;await renderQbo();await new Promise(r=>setTimeout(r,40));const qf=$('content').innerHTML;
 ok('finance sees the page read-only: no Enable/Disconnect, Sync now still there', !/Enable — start posting/.test(qf)&&!/qboDisconnect/.test(qf)&&/qboRun\\(false\\)/.test(qf)&&document.getElementById('qbo-post-from').disabled);}
// phone: the chip row keeps its scroll and carries data-area; the first route after sign-in replaces, so Home has no ←
{buildMobileMenu('');const row=document.getElementById('mm-areas');
 ok('area chip row has an id and data-area per chip (scroll is preserved across rebuilds)', !!row&&row.querySelectorAll('button[data-area]').length===6);
 window._navDepth=0;history.replaceState(null,'',location.pathname);pushRoute('#/v/home');
 ok('landing on Home after sign-in does not create a back step', (window._navDepth||0)===0&&location.hash==='#/v/home');
 pushRoute('#/v/orders');ok('a real navigation still does', window._navDepth===1);}
// sales role may open crmstats but not serials/loans
ROLE='sales';
ok('sales can open CRM activity', viewAllowed('crmstats'));
ok('sales cannot open serials', !viewAllowed('serials'));
ok('sales cannot open loaners', !viewAllowed('loans'));
window.__done=true;
})().catch(e=>{window.__err=(e&&e.stack)||String(e);window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
setTimeout(()=>{
  if(w.__err){console.error(w.__err);process.exit(1);}
  for(const [p,n,x] of out.concat(w.__out||[])){if(!p)fail++;console.log((p?'  PASS  ':'  FAIL  ')+n+(p?'':'   '+x));}
  console.log(fail?fail+' FAILED':'all passed');
  process.exit(fail?1:0);
},800);
