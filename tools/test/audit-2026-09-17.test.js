/* Regression pins for the 2026-09-17 app-wide audit. Each check names the defect it
   keeps closed. Run from the repo root: node tools/test/audit-2026-09-17.test.js */
const fs=require('fs');
let fail=0; const ok=(n,c,x)=>{if(!c)fail++;console.log((c?'  PASS  ':'  FAIL  ')+n+(c?'':'   '+(x===undefined?'':String(x))));};
const rd=p=>fs.readFileSync(p,'utf8');
const js=Object.fromEntries(fs.readdirSync('js').filter(f=>/\.js$/.test(f)).map(f=>[f,rd('js/'+f)]));
const all=Object.values(js).join('\n');

// ── the render → loadShopify → render hot loop (OOM in jsdom; a request storm on a phone with no signal)
const waits=(all.match(/loadShopify\(\)\.then\(\(\)=>\{if\(/g)||[]).length, guarded=(all.match(/window\._shopWaitRef=SHOPIFY;loadShopify\(\)\.then\(\(\)=>\{if\(window\._shopWaitRef!==SHOPIFY&&currentView===/g)||[]).length;
ok('every "wait for the sales cache" re-render is guarded by a cache-changed check', waits===6&&guarded===6, waits+' waits, '+guarded+' guarded');

// ── dates: "today"/"this month" never from UTC
ok('daysISO / monthsISO helpers exist next to todayISO', /function daysISO\(n\)/.test(js['01-shopify-merge-prices.js'])&&/function monthsISO\(n\)/.test(js['01-shopify-merge-prices.js']));
const utcNow=[...all.matchAll(/new Date\(Date\.now\(\)[-+][^)]*\)\.toISOString\(\)\.slice\(0,(?:10|7)\)|new Date\(\)\.toISOString\(\)\.slice\(0,(?:10|7)\)|now\.toISOString\(\)\.slice\(0,7\)/g)].map(m=>m[0]).filter(x=>!/\+8\*3600e3/.test(x)); // todayISO / rptToday ARE the Manila helpers
ok('no "today"/"this month" is derived from UTC any more', utcNow.length===0, utcNow.join(' | '));
{ // the helpers behave
  const src=js['01-shopify-merge-prices.js']; const fn=new Function(src.slice(src.indexOf('function todayISO'),src.indexOf('function monthsISO'))+src.slice(src.indexOf('function monthsISO'),src.indexOf('\n',src.indexOf('function monthsISO')))+';return {todayISO,daysISO,monthsISO,monthISO};');
  const H=fn(); const t=H.todayISO();
  ok('daysISO(0) is today, daysISO(-1) is yesterday, monthsISO(-1) is last month', H.daysISO(0)===t&&H.daysISO(-1)<t&&H.daysISO(1)>t&&H.monthsISO(-1)<H.monthISO()&&/^\d{4}-\d{2}$/.test(H.monthsISO(-13)));
}

// ── permission gaps closed
const j03=js['03-audit-trail-who.js'], j10=js['10-ownership-recall-deals.js'], j05=js['05-home-roleaware-launcher.js'], j02=js['02-views.js'], j17=js['17-receiving.js'];
ok('PDC register: finance may open and write; managers read; no manager write path left', /function canPDC\(\)\{return canFinance\(\);\}/.test(j03)&&/renderPDC\(\)\{\s*if\(!roleIn\('admin','manager','finance'\)\)/.test(j03)&&/async function pdcAdd\(\)\{[^]*?if\(!canPDC\(\)/.test(j03)&&/async function pdcSet\([^)]*\)\{\s*if\(!canPDC\(\)/.test(j03)&&/async function pdcDel\([^)]*\)\{\s*if\(!canPDC\(\)/.test(j03)&&/\(canPDC\(\)\?'<div class="panel"[^]*?Record a cheque/.test(j03));
ok('Returns: finance and the warehouse may open; record = admin/manager/finance; apply CM = finance', /function canReturnAdd\(\)\{return roleIn\('admin','manager','finance'\);\}/.test(j03)&&/renderReturns\(\)\{\s*if\(!roleIn\('admin','manager','finance','supply_chain'\)\)/.test(j03)&&/async function returnAdd\(\)\{\s*if\(!canReturnAdd\(\)\)return;/.test(j03)&&/async function applyCM\(id\)\{\s*if\(!canFinance\(\)\)return;/.test(j03)&&/r\.order_ref&&canFinance\(\)\?' · <a href="#" onclick="applyCM\(/.test(j03));
ok('Record payment: the function gate matches the button (finance)', /async function recordPayment\(id\)\{\s*if\(!SB\|\|!canFinance\(\)\)return;/.test(j05));
ok('Campaigns: marketing writes (database policy), everyone else on the page reads', /function canCampaign\(\)\{return roleIn\('admin','manager','marketing'\);\}/.test(j03)&&!/renderCampaigns\(\)\{\s*if\(!canManage\(\)\)/.test(j03)&&/async function campaignAdd\(\)\{\s*if\(!canCampaign\(\)/.test(j03));
ok('Finance steps: no blanket admin approval — the route decides, the super admin unsticks', !/if\(roleIn\('admin'\)\)return true;\s*const r=finStepOf\(req\)/.test(j10)&&/if\(typeof isSuper==='function'&&isSuper\(\)\)return true;\s*if\(req\.requester_id&&req\.requester_id===me0\)return false;/.test(j10));
ok('PO page: receive / add line / mark ordered / cancel only painted for the warehouse', /\(canWarehouse\(\)&&\(p\.status==='ordered'\|\|p\.status==='partial'\)&&\(l\.received\|\|0\)<l\.qty\?'<a href="#" onclick="poReceive\(/.test(j10)&&/\(canWarehouse\(\)\?'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">'\+\s*\(p\.status==='draft'\?/.test(j10));
ok('viewAllowed: sales managers never see Commissions', /if\(ROLE==='manager'\)return !\['scan','commissions'\]\.includes\(v\);/.test(j02));
ok('Receiving: finance edits the money fields of the landed-cost calculator', /money=run\|\|roleIn\('finance'\)/.test(j17)&&(j17.match(/\(money\?'onchange="ship(?:Set|Fee)\(/g)||[]).length===5&&/async function shipSet\(id,k,v\)\{if\(!\(shipCanRun\(\)\|\|roleIn\('finance'\)\)\)return;/.test(j17));
ok('escaping: branch tabs and Ask chat ids go through jsq()/esc()', /window\._branchFilter=\\''\+jsq\(b\)\+'\\'/.test(js['07-aged-inventory.js'])&&/askOpenChat\(\\''\+jsq\(c\.id\)\+'\\'\)/.test(js['09-ask-ai-inapp.js']));
ok('legacy visits fallbacks are gone from the browser', !/functions\/visits/.test(all));

// ── server side
const F=p=>rd('netlify/functions/'+p);
const au=F('admin-users.mjs');
ok('admin-users: a target id must be a UUID before it reaches any filter or path', /if \(p\.id != null && !\/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i\.test\(String\(p\.id\)\)\) return out\(400/.test(au)&&au.indexOf("return out(400, { error: 'Bad id' })")<au.indexOf("act === 'list'"));
const rr=F('report-run.mjs');
ok('report-run: a shared run opens only when every column it carries is allowed for the caller', /const allowed = new Set\(E\.rptAllowedCols\(def\.source, role\)\);/.test(rr)&&/for \(const c of used\) if \(!allowed\.has\(c\)\) return false;/.test(rr)&&/Object\.keys\(S\.cols \|\| \{\}\)\.slice\(0, 8\)/.test(rr));
const sb=F('stockbot-work-background.mjs');
ok('stockbot worker reads the sync/shopify blobs instead of session-only HTTP endpoints', /getStore\('sync'\)\.get\('data'/.test(sb)&&/getStore\('shopify'\)\.get\('data'/.test(sb)&&!/fetch\(base \+ '\/\.netlify\/functions\/refresh'/.test(sb)&&/import \{ buildSnapshot \} from '\.\/refresh\.mjs'/.test(sb));
const dd=F('deck-to-drive.mjs');
ok('deck-to-drive: decks are stamped at creation and share checks the stamp, folder and ownership', /appProperties: \{ hq_by: String\(who\.id \|\| ''\)/.test(dd)&&/fields=parents,appProperties,mimeType/.test(dd)&&/if \(!fm \|\| !\(fm\.parents \|\| \[\]\)\.includes\(FOLDER_ID\) \|\| !ap\.hq_by\) return out\(403/.test(dd)&&/if \(own && ap\.hq_by !== String\(who\.id \|\| ''\)\) return out\(403/.test(dd));
const qa=F('qbo-auth.mjs');
ok('qbo-auth: constant-time state compare, no fallback HMAC key, callback refuses when unconfigured', /function safeEq\(a, b\)/.test(qa)&&/!process\.env\.QBO_CLIENT_SECRET \|\| !safeEq\(sign\(body\), sig\)/.test(qa)&&!/QBO_CLIENT_SECRET \|\| 'x'/.test(qa)&&/if \(!process\.env\.QBO_CLIENT_ID \|\| !process\.env\.QBO_CLIENT_SECRET\) return \{ statusCode: 503/.test(qa));
const up=F('upload.mjs');
ok('upload link: same RLS-as-caller check as GET', (up.match(/attachments\?select=id&limit=1&file_id=eq\./g)||[]).length===2);
ok('visits.mjs is a 410 stub', /statusCode: 410/.test(F('visits.mjs'))&&!/getStore/.test(F('visits.mjs')));
ok('no function derives its own origin from the Host header', !['ask.mjs','qbo-admin.mjs','stockbot.mjs'].some(f=>/event\.headers\.host/.test(F(f))));
ok('QBO query literals strip backslashes; kind filters are encoded', /replace\(\/\\\\\/g, ''\)\.replace\(\/'\/g/.test(F('lib/qbo.mjs'))&&/kind=eq\.' \+ encodeURIComponent\(kind\)/.test(F('lib/qbo.mjs'))&&/kind=eq\.' \+ encodeURIComponent\(kind\)/.test(F('lib/qbo-sync.mjs'))&&/kind=eq\.' \+ encodeURIComponent\(kind\)/.test(F('qbo-admin.mjs')));

// ── the mayOpen rule, exercised
(async()=>{
  process.env.SUPABASE_URL='https://sb.test';process.env.SUPABASE_SERVICE_KEY='svc';
  const E=require('../../js/15-report-engine.js');
  // rebuild mayOpen from the module source so the test follows the code, not a copy of it
  const body=rr.slice(rr.indexOf('function mayOpen'),rr.indexOf('export const handler'));
  const mayOpen=new Function('E',body+';return mayOpen;')(E);
  const shared={owner_id:'u-fin',shared:true,def:{source:'orders',columns:['account','total','delivery_cost']}};
  ok('mayOpen: a manager cannot open a shared orders run that carries delivery_cost', mayOpen(shared,{id:'u-mgr',role:'manager'})===false);
  ok('mayOpen: the same run without the cost column opens for the manager', mayOpen({...shared,def:{source:'orders',columns:['account','total']}},{id:'u-mgr',role:'manager'})===true);
  ok('mayOpen: owner, admin and super always may', mayOpen(shared,{id:'u-fin',role:'finance'})&&mayOpen(shared,{id:'x',role:'admin'})&&mayOpen(shared,{id:'x',role:'viewer',super:true}));
  ok('mayOpen: no columns picked = the first eight (no costs there) → a manager may open a shared shipments run', mayOpen({owner_id:'u',shared:true,def:{source:'shipments',columns:[]}},{id:'m',role:'manager'})===true);
  ok('mayOpen: a group-by or an aggregate on a cost column closes it', mayOpen({owner_id:'u',shared:true,def:{source:'shipments',group:{by:'supplier',aggs:[{fn:'sum',col:'landed_total'}]}}},{id:'m',role:'manager'})===false&&mayOpen({owner_id:'u',shared:true,def:{source:'shipments',group:{by:'supplier',aggs:[{fn:'count'}]}}},{id:'m',role:'manager'})===true);
  ok('mayOpen: unshared is closed to everyone but the owner/admin', mayOpen({owner_id:'u',shared:false,def:{source:'orders',columns:['account']}},{id:'m',role:'manager'})===false);
  console.log(fail?fail+' FAILED':'all passed');
  process.exit(fail?1:0);
})();
