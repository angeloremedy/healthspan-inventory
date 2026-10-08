/* Usage (2026-10-08): the super admin sees who uses HQ and Ask Healthspan, how often.
   Run from the repo root: node tools/test/usage.test.js */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/',pretendToBeVisual:true});
const w=dom.window;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
const sql=fs.readFileSync('SUPABASE-SETUP.md','utf8');
const v02=fs.readFileSync('js/02-views.js','utf8'),v04=fs.readFileSync('js/04-target-setting-admins.js','utf8'),v09=fs.readFileSync('js/09-ask-ai-inapp.js','utf8');
const asklog=fs.readFileSync('netlify/functions/asklog.mjs','utf8');
let fail=0;const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&x!==''?'  → '+x:''));if(!c)fail++;};

ok('script tag and sidebar row (Admin, after Activity log)', /js\/20-sales-monthly\.js"><\/script>\n<script defer src="js\/21-usage\.js"><\/script>/.test(html)&&/showView\('audit',this\)[^\n]*\n\s*<div class="ni" onclick="showView\('usage',this\)">[\s\S]*?Usage<\/div>/.test(html));
ok('T map, dispatch, super-only rule, never grantable', /usage:'Usage — HQ and Ask Healthspan'/.test(v02)&&/v==='usage'\) renderUsage\(\)/.test(v02)&&/if\(v==='usage'\)return typeof isSuper==='function'&&isSuper\(\);/.test(v02)&&/NEVER_GRANT=\['usage',/.test(v02));
ok('every page open is counted in pushRoute (before the back-button early return)', /function pushRoute\(h\)\{\n\s*try\{if\(typeof usagePing==='function'\)usagePing\('view',usageRouteKey\(h\)\);\}catch\(e\)\{\}/.test(v04));
ok('every Ask answer is counted by model — never the question text', /usagePing\('ask',out\.answer\?\(out\.model\|\|'answered'\):'failed'\)/.test(v09));
ok('SQL: table, super-only read, no write policy, a security-definer ping that only writes the caller\'s own row',
  /create table if not exists public\.usage_daily/.test(sql)&&/create policy "usage super read" on public\.usage_daily for select to authenticated\s+using \(public\.hs_role\(\) = 'super'\);/.test(sql)&&
  !/on public\.usage_daily for (insert|update|delete|all)/.test(sql)&&/function public\.usage_ping\(p_kind text, p_key text\)[\s\S]*security definer[\s\S]*auth\.uid\(\) is null/.test(sql)&&/grant execute on function public\.usage_ping\(text, text\) to authenticated;/.test(sql));
ok('question log reads up to 90 days, in parallel', /Math\.min\(90,/.test(asklog)&&/Promise\.all\(keys\.map/.test(asklog));

const test=`
(async()=>{
const OUT=[];window.__out=OUT;const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
loadShopify=()=>{};refreshSidebar=()=>{};audit=()=>{};
ok('route → page key', usageRouteKey('#/v/salesmonthly')==='salesmonthly'&&usageRouteKey('#/s/Lady')==='spec'&&usageRouteKey('#/o/abc')==='order'&&usageRouteKey('#/a/Skin%20Clinic')==='account'&&usageRouteKey('#/x/1')==='');
const calls=[];SBUSER={id:'u1'};SB={rpc:(n,a)=>{calls.push([n,a]);return Promise.resolve({data:null,error:null});}};
usagePing('view','home');usagePing('view','home');usagePing('view','orders');usagePing('ask','claude-haiku-5-5');
ok('ping: one RPC per page open, a repaint of the same page within 5 s is not a visit', calls.length===3&&calls[0][0]==='usage_ping'&&calls[0][1].p_kind==='view'&&calls[0][1].p_key==='home'&&calls[1][1].p_key==='orders'&&calls[2][1].p_kind==='ask'&&calls[2][1].p_key==='claude-haiku-5-5', JSON.stringify(calls));
SBUSER=null;usagePing('view','x');ok('ping: nothing before sign-in', calls.length===3);
SB={rpc:()=>{throw new Error('no function');}};SBUSER={id:'u1'};let threw=false;try{usagePing('view','y');}catch(e){threw=true;}
ok('ping: a missing function (SQL not run yet) never breaks navigation', !threw);

// the page, as the super admin
ROLE='admin';SBPROFILE={name:'Angelo',role:'admin',is_super:true};currentView='usage';
const today=todayISO(),y1=daysISO(-1);
const ROWS=[{user_id:'u1',day:today,views:12,asks:3,sessions:2,pages:{home:4,salesmonthly:6,ask:2},ask_models:{'claude-haiku-5-5':2,'claude-sonnet-5-5':1},last_at:new Date().toISOString()},
            {user_id:'u1',day:y1,views:5,asks:0,sessions:1,pages:{home:5},ask_models:{},last_at:new Date(Date.now()-864e5).toISOString()},
            {user_id:'u2',day:today,views:3,asks:1,sessions:1,pages:{spec:3},ask_models:{failed:1},last_at:new Date().toISOString()}];
const chain=(data)=>{const c={};['select','gte','limit','order','eq'].forEach(m=>c[m]=()=>c);c.then=(r,j)=>Promise.resolve({data,error:null}).then(r,j);return c;};
SB={from:t=>chain(t==='usage_daily'?ROWS:[]),rpc:()=>Promise.resolve({}),auth:{getSession:async()=>({data:{session:{access_token:'t'}}})}};
adminUsers=async a=>({users:[{id:'u1',name:'Lady Cruz',role:'sales',last:''},{id:'u2',name:'Marj Santos',role:'manager',last:''},{id:'u3',name:'Never Used',role:'viewer',last:'',invited:true},{id:'u4',name:'Gone',role:'sales',banned:true}]});
sbAuthHeaders=async()=>({});
fetch=async u=>({json:async()=>(/asklog/.test(u)?{logs:{[today]:[{src:'web',ok:true,ms:4000},{src:'web',ok:false,ms:0},{src:'slack',ok:true,ms:2000}]}}:{})});
USAGE_DAYS=30;await renderUsage();
const txt=$('content').textContent;
const rows=[...$('us-people').querySelectorAll('tbody tr')].map(tr=>[...tr.cells].map(c=>c.textContent.trim()));
ok('cards: 2 of 3 people active (the disabled account not counted), 20 page opens, 4 Ask questions, 3 more… on Slack', /People using HQ2 \\/ 3/.test(txt.replace(/\\s+/g,''))||/2\\s*\\/\\s*3/.test($('content').querySelector('.met.gr .met-val').textContent), $('content').querySelector('.met.gr .met-val').textContent);
ok('page opens and questions add up', /^20/.test($('content').querySelector('.met.bl .met-val').textContent.trim())&&/^4/.test($('content').querySelector('.met.pu .met-val').textContent.trim()));
ok('Slack questions come from the anonymous log', /1 more on Slack/.test($('content').querySelector('.met.pu').textContent), $('content').querySelector('.met.pu').textContent);
ok('busiest first: Lady (2 days, 3 sessions, 17 opens, 3 questions)', rows[0][0]==='Lady Cruz'&&rows[0][3]==='2'&&rows[0][4]==='3'&&rows[0][5]==='17'&&rows[0][6]==='3', rows[0].join('|'));
ok('her most used pages are named as in the menu', /Monthly by SKU 6/.test(rows[0][7])&&/Home 9/.test(rows[0][7]), rows[0][7]);
ok('someone who never opened HQ in the period is listed last, marked invited', rows[rows.length-1][0].startsWith('Never Used')&&/invited/.test(rows[rows.length-1][0])&&/not in the last 30 days/.test(rows[rows.length-1][7]));
ok('a disabled account is left out', !rows.some(r=>/^Gone/.test(r[0])));
ok('Ask by model: Haiku 5.5, Sonnet 5.5, and the failed one', /Claude Haiku 5\\.5/.test(txt)&&/Claude Sonnet 5\\.5/.test(txt)&&/No answer \\(error\\)/.test(txt));
ok('what people asked is never on the page', !/Why did|Stock of/.test(txt)&&/never shown with their name/.test(txt));
let got=null;downloadCSV=(n,h,r)=>{got={n,h,r};};exportCurrentView();
ok('Export CSV: one row per person', got&&got.n==='usage_30d'&&got.r.length===3&&got.r[0][0]==='Lady Cruz', got&&got.n);

SB={from:()=>{const c={};['select','gte','limit'].forEach(m=>c[m]=()=>c);c.then=(r)=>Promise.resolve({data:null,error:{message:'relation "public.usage_daily" does not exist'}}).then(r);return c;},rpc:()=>Promise.resolve({})};
await renderUsage();ok('before the SQL: the page says what to run', /Usage \\(2026-10-08\\)/.test($('content').textContent));

ROLE='admin';SBPROFILE={name:'Paul',role:'admin',is_super:false};
ok('a plain admin cannot open it', !viewAllowed('usage'));
ROLE='manager';SBPROFILE={name:'M',role:'manager',view_grants:['usage']};ok('and it can never be granted person by person', !viewAllowed('usage'));
})().catch(e=>{window.__out=[[false,'crashed: '+(e&&e.stack||e),'']];}).finally(()=>{window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
(async()=>{const t0=Date.now();while(!w.__done&&Date.now()-t0<20000)await new Promise(r=>setTimeout(r,20));
  for(const [c,n,x] of (w.__out||[[false,'timed out','']]))ok(n,c,x);
  console.log('\n'+(fail?fail+' FAILED':'all passed'));process.exit(fail?1:0);})();
