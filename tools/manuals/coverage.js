/* Manual coverage check: for each role manual, list the sidebar views that role
   may open (viewAllowed) which the manual never mentions. Run from the repo root:
     node tools/manuals/coverage.js            (exit 1 when anything is missing) */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});const w=dom.window;
w.Chart=function(){return{destroy(){}}};w.Chart.register=()=>{};w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
const views=[...new Set([...html.matchAll(/showView\('([a-z0-9_]+)'/g)].map(m=>m[1]))];
const roles={1:'sales',2:'manager',3:'supply_chain',4:'finance',5:'marketing',6:'admin',7:'admin',8:'viewer',9:'viewer'};
const files={1:'Product-Specialist',2:'Sales-Manager',3:'Supply-Chain',4:'Finance',5:'Marketing',6:'Admin',7:'Super-Admin',8:'Viewer',9:'IT'};
// words the manuals use for a view when the sidebar title differs
const syn={ask:['ask healthspan'],savedreports:['saved reports'],qbo:['quickbooks'],profile:['my profile'],all:['all skus'],health:['data health'],whkpi:['warehouse kpis'],poscore:['scorecard'],regs:['registration'],crmstats:['crm activity'],salesfield:['field coverage','coverage'],salesrecon:['vs accounting','accounting'],salesdue:['reorder due'],salesfree:['free items','giveaway'],salesdeals:['deals vs'],salestarget:['vs target'],salesspec:['per specialist','specialist'],salesoverview:['sales overview'],salespace:['leaderboard'],fcastacc:['forecast accuracy','mape'],aireview:['ai planning review'],ropoint:['reorder point'],reorderplan:['reorder plan'],cover:['stock coverage'],abc:['abc'],variab:['variability'],writeoff:['write-off'],forecast:['stockout forecast'],aged:['aged inventory'],shrink:['shrinkage'],cashexp:['cash in expiring'],branchship:['branch shipments'],branchexp:['branch expiry'],movement:['movement'],invvalue:['inventory value'],dealscen:['deal scenario'],batches:['batch view'],dashboard:['dashboard'],action:['action center'],customers:['accounts (crm)','accounts'],logvisit:['log a visit','log visit','visit log'],followups:['follow-ups'],neworder:['new order','taking an order'],orders:['orders register','register'],pipeline:['pipeline'],quotes:['quotation'],salesevents:['events calendar'],complaints:['complaints'],pullouts:['pull-out'],manual:['manual'],bizreview:['business review'],reports:['reports'],settings:['settings'],targets:['targets'],scorecards:['scorecards'],fulfillq:['fulfillment queue'],serials:['serial numbers'],loans:['loaners'],backorders:['backorders'],shortdated:['short-dated'],transfers:['transfer orders'],scan:['scan'],cyclecount:['cycle count'],po:['purchase orders'],quarantine:['quarantine'],suppliers:['suppliers'],recall:['recall'],catalog:['item master'],ar:['ar aging','receivables'],payments:['payment'],pdc:['pdc'],cashflow:['cash-flow forecast'],returns:['credit memo'],commissions:['commissions'],credit:['credit limit'],valuation:['landed cost','valuation'],export:['accounting export'],approvals:['approvals'],campaigns:['campaign'],promos:['promotion'],users:['team & access'],audit:['activity log'],cutover:['cutover'],numbering:['document numbering'],archive:['archive','getting them back'],routes:['approval routes'],codelists:['option lists'],funds:['fund source'],fundspend:['fund-source spend'],home:['home']};
const FIN=['voucher','orderpay','proofpay','replenish','reimburse','cashadvance','expreport'];
const script=`window.__cov={};
(function(){const V=${JSON.stringify(views)};const R=${JSON.stringify(roles)};
for(const n of Object.keys(R)){ROLE=R[n];isSuper=()=>n==='7';canUserAdmin=()=>n==='9';window.__cov[n]=V.filter(v=>{try{return viewAllowed(v);}catch(e){return false;}});}
window.__T=T_MAP_PLACEHOLDER;})();`;
// T map lives inside showView (js/02); lift it out of the source
const tm=app.match(/const T=\{([^]*?)\};\s*\n/); const tmap='{'+tm[1]+'}';
w.eval(app+'\n;\n'+script.replace('T_MAP_PLACEHOLDER','('+tmap+')'));
let bad=0;
for(const n of Object.keys(files)){
  const d=JSON.parse(fs.readFileSync('tools/manuals/content/HQ-Manual-'+n+'-'+files[n]+'.json','utf8'));
  const dir=fs.existsSync('tools/manuals/content/_directory.json')?(JSON.parse(fs.readFileSync('tools/manuals/content/_directory.json','utf8'))[n]||[]):[];
  const txt=(JSON.stringify(d.blocks)+' '+JSON.stringify(dir)).replace(/<[^>]+>/g,'').replace(/\\u2019|’/g,"'").toLowerCase();
  const allowed=w.__cov[n];
  const missing=allowed.filter(v=>{const t=(w.__T[v]||'').toLowerCase();const c=[t].concat(syn[v]||[]).concat(FIN.includes(v)?['finance forms']:[]).filter(Boolean);return !c.some(x=>txt.includes(x));});
  console.log(files[n].padEnd(20),'allowed',String(allowed.length).padStart(3),' missing:',missing.map(v=>v+' ('+(w.__T[v]||'?')+')').join(', ')||'—');
  bad+=missing.length;
}
process.exit(bad?1:0);
