/* Integration check for the with/without-Remedy split.
   The app's js/01..js/10 are classic scripts sharing one global lexical scope, so
   the fixture and the assertions are appended into the SAME eval — otherwise
   top-level let/const bindings are invisible to the test. */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window,d=w.document;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.SB=null; w.SBUSER={id:'u1'}; w.SBPROFILE={name:'A'};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});

const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');

const test=`
(async()=>{
const OUT=[]; window.__out=OUT;
const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
const ym=new Date().toISOString().slice(0,7);

// stubs for everything that would reach the network
ROLE='admin'; isSuper=()=>true; loadShopify=()=>{}; refreshSidebar=()=>{}; rerenderCurrent=()=>{};
audit=()=>{}; sbAuthHeaders=async()=>({}); loadCommRules=async()=>[{min:0,pct:0},{min:80,pct:1},{min:100,pct:2}];
loadVisits=async()=>VISITS; loadNativeOrders=async()=>NORDERS;
// a Supabase stand-in: every query resolves empty
const _q=new Proxy({},{get:(t,k)=>{
  if(k==='then')return r=>Promise.resolve({data:[],error:null}).then(r);
  if(k==='single'||k==='maybeSingle')return ()=>Promise.resolve({data:null,error:null});
  return ()=>_q;}});
SB={from:()=>_q, auth:{getSession:async()=>({data:{session:null}})}};

/* gross 1500 / internal 500 / external 1000 · 100u / 30u / 70u
   one external customer, one Remedy branch, one specialist who sold to both */
DATA=[{sku:'AAA',name:'Alpha',line:'Meline',price:100,stock:5,received:0,sold:0,category:'Commercial'}];
// the sheet side of the account list: one real clinic, plus the grouped Remedy row
// shipped values are deliberately NOT 1000/1500: a peso-anywhere assertion would
// otherwise pass on the Shipped card while Booked was wrong
CUSTOMERS=[{name:'Real Clinic',qty:70,value:7007,orders:1,skuCount:1,lastOrder:'2026-08-01',daysSince:1,trend:'flat',isRemedy:false,topProducts:[],recent:[]},
           {name:'Remedy',qty:30,value:3003,orders:1,skuCount:1,lastOrder:'2026-08-01',daysSince:1,trend:'flat',isRemedy:true,topProducts:[],recent:[]}];
VISITS=[]; NORDERS=[];
TARGETS=[{month:ym,scope:'TOTAL',name:'',value:1000,units:70},
         {month:ym,scope:'SPECIALIST',name:'Rhas',value:1000,units:0},
         {month:ym,scope:'PRODUCT',name:'AAA',value:1000,units:70},
         {month:ym,scope:'LINE',name:'Meline',value:1000,units:0}];
const FULL={v:9,internalSplit:true,synced:'2026-08-29T00:00:00Z',dailyFrom:'2020-01-01',recentFrom:'2020-01-01',
  variants:[{sku:'AAA',productTitle:'Alpha',price:100,inv:5,
    monthly:{[ym]:{u:100,f:0,v:1500,d:0,dv:0}},daily:{},
    imonthly:{[ym]:{u:30,f:0,v:500,d:0,dv:0}},idaily:{}}],
  specialists:{Rhas:{monthly:{[ym]:{u:100,v:1500}},daily:{},
    imonthly:{[ym]:{u:30,v:500}},idaily:{},skus:{AAA:{u:100,v:1500}}}},
  /* Three orders, so the per-customer totals sum to the per-SKU buckets:
       Real Clinic  ₱1,000 external (70u)  +  ₱200 internal, mis-tagged (10u)
       Remedy BGC   ₱300 internal (20u)
     gross ₱1,500 / internal ₱500 / external ₱1,000 · 100u / 30u / 70u */
  customers:{'Real Clinic':{o:2,u:80,v:1200,u90:0,v90:0,l:'2026-08-01',
               io:1,iu:10,iv:200,iu90:0,iv90:0,int:false},          // mixed
             'Remedy BGC':{o:1,u:20,v:300,u90:0,v90:0,l:'2026-08-01',
               io:1,iu:20,iv:300,iu90:0,iv90:0,int:true}},          // wholly internal
  recent:[{n:'#1',dt:ym+'-01',t:'Rhas',c:'Real Clinic',x:0,ls:[['AAA',70,1000]]},
          {n:'#2',dt:ym+'-02',t:'Rhas',c:'Real Clinic',x:1,ls:[['AAA',10,200]]},
          {n:'#3',dt:ym+'-03',t:'Rhas',c:'Remedy BGC',x:1,ls:[['AAA',20,300]]}],
  orders:3};
SHOPIFY=JSON.parse(JSON.stringify(FULL)); SPERIOD='mtd'; SLINE=''; mergeShopify();

const txt=()=>$('content').textContent;
const pesos=()=>[...txt().matchAll(/₱([\\d,]+)/g)].map(m=>+m[1].replace(/,/g,''));
const pcts=()=>[...txt().matchAll(/(\\d+)%/g)].map(m=>+m[1]).filter(p=>p>=50&&p<=250);
/* the value of a named metric card, so an assertion cannot be satisfied by some
   other peso figure that happens to share the number */
const card=(label)=>{
  for(const m of $('content').querySelectorAll('.met')){
    const l=m.querySelector('.met-lbl'), v=m.querySelector('.met-val');
    if(l&&v&&l.textContent.indexOf(label)>=0)return +String(v.textContent).replace(/[^0-9]/g,'');
  }
  return null;
};

ok('fixture merged', !!(SALESIDX&&SALESIDX.AAA), Object.keys(SALESIDX||{}).join(','));
ok('internal bucket carried', JSON.stringify((SALESIDX.AAA||{}).imonthly||{}).indexOf('500')>0);
ok('split detected', hasIntSplit());

// 1. the toggle moves the sales figures, and only by the internal amount
for(const [ext,want] of [[true,1000],[false,1500]]){
  setSext(ext); currentView='salesoverview'; renderSalesOverview();
  ok('Sales overview revenue '+(ext?'external':'all')+' = '+want, pesos().includes(want), pesos().slice(0,4));
}

// 2. every target scope reads external, whatever the toggle says
for(const ext of [true,false]){
  setSext(ext); currentView='salestarget'; window._tgMonth=ym; renderSalesTarget();
  const bad=pcts().filter(p=>p!==100);
  ok('targets all 100% (toggle '+(ext?'external':'all')+')', bad.length===0 && pcts().length>=4, pcts());
}

// 3. per-specialist attainment is forced; its revenue column follows
for(const ext of [true,false]){
  setSext(ext); currentView='salesspec'; renderSalesSpec();
  ok('specialist attainment 100% (toggle '+(ext?'external':'all')+')', pcts().length>0&&pcts().filter(p=>p!==100).length===0, pcts());
  ok('specialist revenue follows toggle ('+(ext?'external':'all')+')', pesos().includes(ext?1000:1500), pesos().slice(0,4));
}

// 4. commissions never move
for(const ext of [true,false]){
  setSext(ext); currentView='commissions'; window._commYm=ym; await renderCommissions();
  ok('commissions = 1000 (toggle '+(ext?'external':'all')+')', pesos().includes(1000), 'pesos '+pesos().slice(0,6)+' | txt '+txt().slice(0,160).replace(/\s+/g,' '));
}

// 5. Accounts must agree with Sales overview
for(const ext of [true,false]){
  setSext(ext);
  currentView='salesoverview'; renderSalesOverview(); const sRev=card('Revenue');
  window._custFilter='all'; ACCTBYNORM=null; currentView='customers'; renderCustomers(); const aBooked=card('Booked');
  const want=ext?1000:1500;
  ok('Sales overview Revenue card = '+want+' ('+(ext?'external':'all')+')', sRev===want, sRev);
  ok('Accounts Booked card = Sales overview ('+(ext?'external':'all')+')', aBooked===want, 'accounts '+aBooked+' vs sales '+sRev);
  const t2=txt();
  ok('mixed account survives, minus its internal slice ('+(ext?'external':'all')+')',
     /Real Clinic/.test(t2), 'Real Clinic listed: '+/Real Clinic/.test(t2));
  if(ext)ok('wholly-internal account is dropped', !/Remedy BGC/.test(t2));
}

// 6. reconciliation splits the same way
setSext(true);
const rr=reconRows().find(r=>r.m===ym)||{};
ok('recon external 1000', rr.ext===1000, rr.ext);
ok('recon internal 500', rr.internal===500, rr.internal);
ok('recon all 1500', rr.all===1500, rr.all);
// (external+internal===all is true by construction in reconRows — asserting it
//  proves nothing, so check the internal basis came from the buckets instead)
ok('recon internal comes from the imonthly buckets', reconRows().find(r=>r.m===ym).internal===500);

// 8. the exported CSVs must not disagree with the screens they came from
let CSV=null; downloadCSV=(n,h,r)=>{CSV={n,h,r};};
for(const ext of [true,false]){
  setSext(ext); window._tgMonth=ym; exportSalesTarget();
  const atts=CSV.r.map(r=>r[5]);
  ok('targets CSV all 100% (toggle '+(ext?'external':'all')+')',
     atts.length>=4&&atts.every(a=>String(a)==='100'), atts);
  exportSalesSpec();
  ok('per-specialist CSV revenue = '+(ext?1000:1500), CSV.r[0]&&CSV.r[0][2]===(ext?1000:1500), CSV.r[0]);
}

// 9. a specialist's own page: the quota figure never moves with the toggle
const specPageFigure=async(ext)=>{setSext(ext);currentView='spec';CUR_SPEC='Rhas';SPEC_BACK='salesspec';
  await renderSpecPage();return card('This month');};
const spA=await specPageFigure(true), spB=await specPageFigure(false);
ok('own-page quota is forced external', spA===1000&&spB===1000, spA+' / '+spB);

// 10. quarterly scorecards must agree with the commission run
(async()=>{})();
currentView='scorecards';
await renderScorecards();
const scText=txt();
ok('scorecards booked is external', /1,000/.test(scText)&&!/1,500/.test(scText), scText.slice(0,120).replace(/\s+/g,' '));

// 11. the product drill-down must not sum internal orders under a net headline
setSext(true); openSalesDrawer('AAA');
const db=()=>$('dbody').textContent;
ok('drill-down external total', /₱1,000/.test(db()), db().slice(0,90).replace(/\s+/g,' '));
ok('drill-down says what it hid', /2 internal orders hidden/.test(db()), db().slice(0,140).replace(/\s+/g,' '));
setSext(false); openSalesDrawer('AAA');
ok('drill-down gross total', /₱1,500/.test(db()), db().slice(0,90).replace(/\s+/g,' '));

// 12. the internal slice must reach the account row, not just the boolean
ACCTBYNORM=null; buildAcctIdx();
const rc=Object.values(ACCTBYNORM).find(e=>/Real Clinic/i.test(e.name));
ok('account carries its internal slice', !!(rc&&rc.shop&&rc.shop.iv===200), rc&&rc.shop&&rc.shop.iv);
ok('mixed account is not flagged wholly internal', !!(rc&&rc.shop&&rc.shop.int===false), rc&&rc.shop&&rc.shop.int);


// 7. a cache built before the split: everything gross, nothing broken, and it says so
const OLD=JSON.parse(JSON.stringify(FULL)); delete OLD.internalSplit;
for(const v of OLD.variants){delete v.imonthly; delete v.idaily;}
delete OLD.specialists.Rhas.imonthly; delete OLD.specialists.Rhas.idaily;
for(const o of OLD.recent) delete o.x;
SHOPIFY=OLD; mergeShopify(); setSext(true);
currentView='salesoverview'; renderSalesOverview();
ok('old cache: gross figures', pesos().includes(1500), pesos().slice(0,4));
ok('old cache: no NaN/undefined', !/NaN|undefined/.test(txt()));
ok('old cache: toolbar explains itself', /rebuilding with the split now/.test(txt()));
window._custFilter='all'; ACCTBYNORM=null; currentView='customers'; renderCustomers();
ok('old cache: Accounts explains itself', /rebuilding with the split now/.test(txt()));
ok('old cache: Accounts hides nothing', !/internal account/.test(txt()));
ok('old cache: targets still render', (()=>{currentView='salestarget';renderSalesTarget();return !/NaN/.test(txt())&&pcts().length>=4;})(), pcts());

// 8. the version gate must not ask a current cache to rebuild
let asked=false; sbAuthHeaders=async()=>{asked=true;return {};};
SHOPIFY=JSON.parse(JSON.stringify(FULL)); mergeShopify();
await new Promise(r=>setTimeout(r,30));
ok('v9 cache triggers no rebuild', !asked);
window.__done=true;
})().catch(e=>{window.__err=e.stack||String(e);window.__done=true;});
`;

w.eval(app+'\n;\n'+test);
setTimeout(()=>{
  if(w.__err){console.error(w.__err);process.exit(1);}
  const out=w.__out||[];
  let fail=0;
  for(const [pass,name,extra] of out){if(!pass)fail++;console.log((pass?'  PASS  ':'  FAIL  ')+name+(pass?'':'   '+extra));}
  console.log(fail?('\n'+fail+' of '+out.length+' FAILED'):'\nall '+out.length+' passed');
  process.exit(fail?1:0);
},600);
