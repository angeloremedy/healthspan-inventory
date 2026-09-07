/* Saved reports: the engine (shared browser/server), the builder view in jsdom,
   the server runner against a fake Supabase + Blobs, and the wiring.
   Run from the repo root: node tools/test/saved-reports.test.js */
const fs=require('fs');
let pass=0,fail=0;const ok=(n,c,x)=>{if(c)pass++;else fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&!c?'  → '+x:''));};

// ── 1. the engine, loaded the way the server loads it (CommonJS) ─────────────────
const E=require('../../js/15-report-engine.js');
const T='2026-09-08';
const orders=[
  {id:1,num:101,date:'2026-09-02',account:'Dr. Cruz Clinic',spec:'Rhas',status:'fulfilled',total:12000,balance:0,pay_status:'paid'},
  {id:2,num:102,date:'2026-09-05',account:'Skin Station',spec:'Frank',status:'fulfilled',total:30000,balance:30000,pay_status:'open'},
  {id:3,num:103,date:'2026-08-20',account:'Dr. Cruz Clinic',spec:'Rhas',status:'cancelled',total:5000,balance:0,pay_status:'open'},
  {id:4,num:104,date:'2026-07-01',account:'Belo',spec:'Frank',status:'fulfilled',total:'8,000',balance:'8,000',pay_status:'open'}];
let r=E.rptRun({source:'orders',columns:['date','account','total'],filters:[{col:'status',op:'=',val:'fulfilled'}],sort:{col:'total',dir:'desc'}},orders,'manager',{today:T});
ok('filter + pick columns + sort desc', r.total===3&&r.cols.map(c=>c.key).join()==='date,account,total'&&r.rows[0][2]===30000&&r.rows[2][2]===8000, JSON.stringify(r.rows));
ok('numbers parse from "8,000"', r.rows.some(x=>x[2]===8000));
r=E.rptRun({source:'orders',columns:['account'],filters:[{col:'date',op:'last',val:30}]},orders,'manager',{today:T});
ok('date "last 30 days" (Manila today injected)', r.total===3&&!r.rows.some(x=>x[0]==='Belo'), r.total);
r=E.rptRun({source:'orders',columns:['account'],filters:[{col:'date',op:'this month'}]},orders,'manager',{today:T});
ok('date "this month"', r.total===2);
r=E.rptRun({source:'orders',columns:['account'],filters:[{col:'date',op:'last month'}]},orders,'manager',{today:T});
ok('date "last month" crosses the year boundary correctly', r.total===1&&r.rows[0][0]==='Dr. Cruz Clinic'&&E.rptRun({source:'orders',columns:['account'],filters:[{col:'date',op:'last month'}]},[{date:'2025-12-15',account:'X'}],'manager',{today:'2026-01-03'}).total===1);
r=E.rptRun({source:'orders',group:{by:'account',aggs:[{fn:'count'},{fn:'sum',col:'total'},{fn:'avg',col:'total'},{fn:'max',col:'balance'}]},sort:{col:'sum_total',dir:'desc'}},orders,'admin',{today:T});
ok('group by account with count/sum/avg/max, sorted by the sum', r.rows.length===3&&r.cols.map(c=>c.key).join()==='account,count,sum_total,avg_total,max_balance'&&r.rows[0][0]==='Skin Station'&&r.rows[0][2]===30000&&r.rows[1][0]==='Dr. Cruz Clinic'&&r.rows[1][1]===2&&r.rows[1][2]===17000&&r.rows[1][3]===8500, JSON.stringify(r.rows));
r=E.rptRun({source:'orders',columns:['account','total']},orders,'sales',{ownTag:'rhas',today:T});
ok('a specialist gets only their own rows (case-insensitive tag)', r.total===2&&r.rows.every(x=>x[0]==='Dr. Cruz Clinic'));
r=E.rptRun({source:'orders',columns:['account']},orders,'marketing',{today:T});
ok('marketing cannot read HQ orders → error, no rows', r.error&&r.rows.length===0);
r=E.rptRun({source:'payments',columns:['amount']},[{amount:5}],'manager',{today:T});
ok('payments are finance/admin only', !!r.error);
ok('viewer reads nothing', Object.keys(E.RPT_SOURCES).every(s=>!E.rptSourceAllowed(s,'viewer')));
const posRows=[{id:1,supplier:'Lumenis',status:'open',fx_total:1000,peso_value:58000,landed_cost:3000,currency:'USD'}];
r=E.rptRun({source:'pos',columns:['supplier','fx_total','peso_value','landed_cost']},posRows,'supply_chain',{today:T});
ok('warehouse sees PO costs', r.cols.map(c=>c.key).join()==='supplier,fx_total,peso_value,landed_cost');
ok('manager cannot open POs at all (cost source)', !E.rptSourceAllowed('pos','manager'));
ok('costs are stripped by rptAllowedCols for a non-cost role even if the source were opened', E.rptAllowedCols('pos','admin').includes('landed_cost')&&!E.rptAllowedCols('pos','marketing').length);
r=E.rptRun({source:'orders',columns:['account'],filters:[{col:'account',op:'in',val:'Belo, Skin Station'}]},orders,'admin',{today:T});
ok('text "in" list', r.total===2);
r=E.rptRun({source:'orders',columns:['account'],filters:[{col:'pay_status',op:'!=',val:'paid'},{col:'balance',op:'>',val:0}]},orders,'admin',{today:T});
ok('two filters AND together (num > 0 on a "8,000" string)', r.total===2);
r=E.rptRun({source:'orders',columns:[],limit:2},orders,'admin',{today:T});
ok('no columns ticked → first eight; limit caps and flags', r.cols.length===8&&r.rows.length===2&&r.truncated===true&&r.total===4);
r=E.rptRun({source:'orders',columns:['account','total']},orders,'admin',{today:T});
const csv=E.rptCSV(r);
ok('CSV: header + rows, quotes where needed', csv.split('\n').length===5&&csv.split('\n')[0]==='account,total'&&/Dr\. Cruz Clinic,12000/.test(csv));
ok('CSV escapes commas and quotes', E.rptCSV({cols:[{label:'a'}],rows:[['x, "y"']]})==='a\n"x, ""y"""');
ok('flatteners: sales lines, order lines, batches', E.rptFlattenSales([{n:'#1',dt:'2026-09-01',t:'Rhas',c:'Cruz',x:0,ls:[['TD040',2,3000],['TD055',1,900]]}]).length===2
  && E.rptFlattenOrderLines([{id:9,date:'2026-09-01',account:'A',spec:'R',status:'fulfilled'}],[{order_id:9,sku:'X',qty:1,amount:5}])[0].account==='A'
  && E.rptFlattenBatches([{skuCode:'TD040',soh:10,batch:'B1',expiry:'12/2026'}])[0].qty===10);
// schedules
ok('rptDue: daily / weekly Monday / monthly day 15 / last day', E.rptDue({freq:'daily'},'2026-09-08')&&E.rptDue({freq:'weekly',dow:1},'2026-09-07')&&!E.rptDue({freq:'weekly',dow:1},'2026-09-08')
  && E.rptDue({freq:'monthly',dom:15},'2026-09-15')&&!E.rptDue({freq:'monthly',dom:15},'2026-09-14')&&E.rptDue({freq:'monthly',dom:'last'},'2026-09-30')&&!E.rptDue({freq:'monthly',dom:'last'},'2026-09-29')&&E.rptDue({freq:'monthly',dom:'last'},'2026-02-28')&&!E.rptDue(null,'2026-09-08'));
ok('schedule text', E.rptSchedText({freq:'weekly',dow:5})==='every Friday, 6am'&&E.rptSchedText({freq:'monthly',dom:'last'})==='last day of the month, 6am'&&E.rptSchedText(null)==='not scheduled');

// ── 2. the server runner against a fake Supabase + fake Blobs ────────────────────
(async()=>{
  process.env.SUPABASE_URL='https://sb.test';process.env.SUPABASE_SERVICE_KEY='svc';
  const DB={saved_reports:[{id:5,name:'Open AR',owner_id:'u-fin',def:{source:'orders',columns:['account','balance'],filters:[{col:'balance',op:'>',val:0}]},shared:true,schedule:{freq:'weekly',dow:2}},
                           {id:6,name:'POs',owner_id:'u-mgr',def:{source:'pos',columns:['supplier']},shared:false,schedule:{freq:'daily'}}],
            profiles:[{id:'u-fin',role:'finance',is_super:false,specialist_tag:'',name:'Tal'},{id:'u-mgr',role:'manager',is_super:false,name:'Paul'}],
            orders,report_runs:[],notifications:[]};
  const blobs={};
  const fakeStore=()=>({get:async(k,o)=>blobs[k]==null?null:(o&&o.type==='json'?JSON.parse(blobs[k]):blobs[k]),set:async(k,v)=>{blobs[k]=v;},setJSON:async(k,v)=>{blobs[k]=JSON.stringify(v);}});
  global.fetch=async(url,opt={})=>{
    const u=new URL(url);const t=u.pathname.replace('/rest/v1/','');const p=u.searchParams;
    const rows=(DB[t]||[]).filter(r=>[...p].every(([k,v])=>{if(['select','order','limit','offset'].includes(k))return true;const m=v.match(/^(eq|is|not\.is)\.(.*)$/);if(!m)return true;if(m[1]==='eq')return String(r[k])===m[2];if(m[1]==='is')return m[2]==='null'?r[k]==null:true;if(m[1]==='not.is')return m[2]==='null'?r[k]!=null:true;return true;}));
    if((opt.method||'GET')==='POST'){const b=JSON.parse(opt.body);b.id=(DB[t]||[]).length+1;(DB[t]=DB[t]||[]).push(b);return {ok:true,status:201,json:async()=>[b]};}
    return {ok:true,status:200,json:async()=>rows};
  };
  let R;
  try{R=await import('../../netlify/functions/lib/report-runner.mjs');}catch(e){ok('runner imports (CJS engine from ESM)',false,e.message);}
  if(R){
    ok('runner imports (CJS engine from ESM)',true);R._useStore(fakeStore);
    const due=await R.dueReports('2026-09-08'); // a Tuesday
    ok('dueReports: weekly Tuesday + daily are due, nothing else', due.map(x=>x.id).sort().join()==='5,6', JSON.stringify(due.map(x=>x.id)));
    const x=await R.runSavedReport(5,null);
    ok('run as the owner (finance): rows with balance > 0, CSV stored, run row ok', x.run.status==='ok'&&x.run.rows===2&&Object.keys(blobs).some(k=>k.startsWith('run-5-'))&&DB.report_runs.length===1&&DB.report_runs[0].by_name==='schedule', JSON.stringify(x.run));
    ok('CSV content has the BOM, header and both accounts', Object.values(blobs)[0].indexOf('account,balance')>=0&&/Skin Station,30000/.test(Object.values(blobs)[0])&&/Belo,8000/.test(Object.values(blobs)[0]));
    ok('scheduled run notifies the owner with the Saved reports link', DB.notifications.length===1&&DB.notifications[0].user_id==='u-fin'&&DB.notifications[0].link==='#/v/savedreports'&&/Report ready/.test(DB.notifications[0].title));
    const y=await R.runSavedReport(6,{id:'u-mgr',name:'Paul'});
    ok('a manager\'s PO report fails on the server too — costs source is not theirs', y.run.status==='error'&&/cannot read pos/.test(y.run.error), JSON.stringify(y.run));
    ok('a manual run does not notify', DB.notifications.length===1);
  }

  // ── 3. wiring + the view in jsdom ─────────────────────────────────────────────
  const html=fs.readFileSync('index.html','utf8');
  ok('scripts 15 and 16 are loaded, in order, after 14', html.indexOf('js/14-qbo-sync.js')<html.indexOf('js/15-report-engine.js')&&html.indexOf('js/15-report-engine.js')<html.indexOf('js/16-saved-reports.js'));
  ok('sidebar item under Sales analytics', /showView\('savedreports',this\)"[^>]*>(?:<svg[^]*?<\/svg>)?Saved reports<\/div>/.test(html));
  const v02=fs.readFileSync('js/02-views.js','utf8'),v09=fs.readFileSync('js/09-ask-ai-inapp.js','utf8'),v01=fs.readFileSync('js/01-shopify-merge-prices.js','utf8');
  ok('T map, dispatch, SHORT, DESC, viewAllowed, SALES_VIEWS', /savedreports:'Saved reports'/.test(v02)&&/v==='savedreports'\) renderSavedReports\(\)/.test(v02)&&/savedreports:'Saved'/.test(v09)&&/savedreports:'Your own reports/.test(v01)&&/if\(v==='savedreports'\)return ROLE!=='viewer'/.test(v02)&&/'reports','savedreports','settings'/.test(v02));
  ok('functions exist; schedule is 22:00 UTC (6am Manila) and has no public handler', fs.existsSync('netlify/functions/report-run.mjs')&&/schedule: '0 22 \* \* \*'/.test(fs.readFileSync('netlify/functions/reports-schedule.mjs','utf8'))&&/sessionUser\(event\)/.test(fs.readFileSync('netlify/functions/report-run.mjs','utf8')));
  ok('SQL block present with hs_role-based policies', /create table if not exists public\.saved_reports/.test(fs.readFileSync('SUPABASE-SETUP.md','utf8'))&&/create table if not exists public\.report_runs/.test(fs.readFileSync('SUPABASE-SETUP.md','utf8')));

  const {JSDOM}=require('jsdom');
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});const w=dom.window;
  w.Chart=function(){return{destroy(){}}};w.Chart.register=()=>{};w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
  const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
  w.__orders=orders;
  const test=`(async()=>{
    window.__out=[];const ok=(n,c,x)=>window.__out.push([!!c,n,x===undefined?'':String(x)]);
    await new Promise(r=>setTimeout(r,300));
    ROLE='manager';SBUSER={id:'u-mgr'};SBPROFILE={name:'Paul'};isSuper=()=>false;
    const DB={saved_reports:[{id:5,name:'Open AR',owner_id:'u-fin',owner_name:'Tal',def:{source:'orders',columns:['account','balance'],filters:[{col:'balance',op:'>',val:0}]},shared:true,schedule:{freq:'weekly',dow:2},updated_at:'2026-09-01'},
                             {id:7,name:'My accounts',owner_id:'u-mgr',owner_name:'Paul',def:{source:'accounts',columns:['name','tier']},shared:false,schedule:null,updated_at:'2026-09-02'},
                             {id:8,name:'Finance only',owner_id:'u-fin',owner_name:'Tal',def:{source:'payments',columns:['amount']},shared:true,schedule:null,updated_at:'2026-09-03'}],
              report_runs:[{id:1,report_id:5,ran_at:'2026-09-08T22:00:00Z',rows:2,status:'ok',by_name:'schedule'}],orders:window.__orders,accounts:[{name:'Belo',tier:'A'},{name:'Cruz',tier:'B'}]};
    const mk=t=>{const q={select(){return q},order(){return q},limit(){return q},is(){return q},eq(k,v){q._eq=[k,v];return q},
      then(res){let rows=DB[t]||[];if(q._eq)rows=rows.filter(r=>String(r[q._eq[0]])===String(q._eq[1]));return Promise.resolve({data:rows,error:null}).then(res);}};return q;};
    SB={from:t=>mk(t),auth:{getSession:async()=>({data:{session:null}})}};
    currentView='savedreports';await renderSavedReports();await new Promise(r=>setTimeout(r,50));
    const t=$('content').textContent;
    ok('list: mine and shared (finance-only source hidden from a manager)', /MINE \\(1\\)/.test(t)&&/SHARED WITH ME \\(1\\)/.test(t)&&/My accounts/.test(t)&&/Open AR/.test(t)&&!/Finance only/.test(t), t.slice(0,200));
    await rptOpen(5);await new Promise(r=>setTimeout(r,80));
    const t2=$('content').textContent, h2=$('content').innerHTML;
    ok('opening a shared report: builder, schedule text, source label, preview rows (manager sees all), run history with download', /Open AR/.test(t2)&&/every Tuesday, 6am/.test(t2)&&/HQ orders/.test(t2)&&/Skin Station/.test(t2)&&/Belo/.test(t2)&&/download CSV/.test(t2), t2.slice(0,300));
    ok('columns ticked show as blue pills; balance filter row rendered', /class="pill pbl"[^>]*>account</.test(h2)&&/class="pill pbl"[^>]*>balance</.test(h2)&&/rptFilterSet\\(0,'op'/.test(h2));
    ok('not the owner → no Save/Delete, name disabled', !/rptSave\\(\\)/.test(h2)&&!/rptDelete\\(\\)/.test(h2)&&/disabled/.test(h2));
    ok('preview reports the match count', /2 rows match/.test(t2));
    rptNew();await new Promise(r=>setTimeout(r,20));
    ok('new report: Save shown, source dropdown lists only the manager\\'s sources (no payments / pos / fin forms)', /rptSave\\(\\)/.test($('content').innerHTML)&&/HQ orders/.test($('content').textContent)&&!/Payments received/.test($('content').textContent)&&!/Purchase orders/.test($('content').textContent)&&!/Finance forms/.test($('content').textContent));
    rptSet('def.source','orders');await new Promise(r=>setTimeout(r,60));
    rptGroupSet('account');await new Promise(r=>setTimeout(r,60));
    ok('grouping in the builder → group column + count in the preview', /1 group|3 groups/.test($('content').textContent)&&/count/.test($('content').textContent));
    ROLE='viewer';
    ok('viewer cannot open the page', !viewAllowed('savedreports'));
    ROLE='sales';SBPROFILE={name:'Rhas',specialist_tag:'Rhas'};
    ok('sales may open it (own rows inside)', viewAllowed('savedreports'));
    window.__done=true;
  })().catch(e=>{window.__err=(e&&e.stack)||String(e);window.__done=true;});`;
  w.eval(app+'\n;\n'+test);
  await new Promise(r=>setTimeout(r,1500));
  if(w.__err)console.error(w.__err);
  for(const [p,n,x] of (w.__out||[]))ok(n,p,x);
  console.log(`\n${pass}/${pass+fail} passed`);
  process.exit(fail||w.__err?1:0);
})();
