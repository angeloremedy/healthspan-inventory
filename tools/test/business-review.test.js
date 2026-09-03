/* Headless check of the Business review: the numbers, the trend sentences, the
   permissions on the commentary boxes, the diff against a snapshot, and the
   PowerPoint builder. Run from the repo root:
     node tools/test/business-review.test.js [out.pptx]
   With an output path it also writes a sample deck from the fixture (needs
   pptxgenjs: npm i pptxgenjs, or PPTXGENJS=/path/to/node_modules/pptxgenjs). */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window,d=w.document;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.SB=null; w.SBUSER={id:'u1'}; w.SBPROFILE={name:'Marj'};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
let fail=0; const out=[];
const ok=(n,c,x)=>out.push([!!c,n,x===undefined?'':String(x)]);
const html=fs.readFileSync('index.html','utf8');
ok('js/12 is loaded after js/11', html.indexOf('js/11-serials')<html.indexOf('js/12-business-review') && /<script defer src="js\/12-business-review\.js">/.test(html));
ok('sidebar has Business review for specialists', /class="ni nv-sales" onclick="showView\('bizreview',this\)"/.test(html));
ok('12 app scripts defer', (html.match(/<script defer src="js\//g)||[]).length===12, (html.match(/<script defer src="js\//g)||[]).length);
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');

const pad=n=>String(n).padStart(2,'0');
const now=new Date(); const ym=now.getFullYear()+'-'+pad(now.getMonth()+1);
const prevD=new Date(Date.UTC(now.getFullYear(),now.getMonth()-1,1)); const pym=prevD.toISOString().slice(0,7);
const nextD=new Date(Date.UTC(now.getFullYear(),now.getMonth()+1,1)); const nym=nextD.toISOString().slice(0,7);
const today=ym+'-'+pad(now.getDate());
const ago=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const FIX={ym,pym,nym,today,d70:ago(70),d200:ago(200)};

const test=`
(async()=>{
const OUT=[];window.__out=OUT;
await new Promise(r=>setTimeout(r,25));
const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
const F=${JSON.stringify(FIX)};const ym=F.ym,pym=F.pym;
ROLE='manager';SBUSER={id:'u1'};SBPROFILE={name:'Marj',role:'manager'};loadShopify=()=>{};refreshSidebar=()=>{};rerenderCurrent=()=>{};
audit=()=>{};sbAuthHeaders=async()=>({});
DATA=[{sku:'TD040',name:'FACE NADE',line:'Inno TDS',category:'Injectable',price:100,stock:50},
      {sku:'ME0001',name:'MELINE INTIMATE',line:'Meline',category:'Cream',price:50,stock:10},
      {sku:'SP001',name:'SKINPEN PRECISION',line:'SKINPEN',category:'Device',price:1000,stock:2},
      {sku:'CS001',name:'COSMELAN PACK',line:'Mesoestetic',category:'Peel',price:200,stock:20}];
CUSTOMERS=[];
const M=(u,v,extra)=>Object.assign({u,f:0,v,d:0,dv:0},extra||{});
const mo={};mo[pym]=M(20,200000);mo[ym]=M(30,300000);
SHOPIFY={v:9,internalSplit:true,synced:new Date().toISOString(),recentFrom:F.d200,
  variants:[{sku:'TD040',productTitle:'FACE NADE',monthly:mo,imonthly:{[ym]:M(5,50000)},daily:{},idaily:{}},
            {sku:'TD040 - AGF',productTitle:'FACE NADE 4+1',monthly:{[ym]:M(0,40000)},imonthly:{},daily:{},idaily:{}},
            {sku:'ME0001',productTitle:'MELINE',monthly:{[pym]:M(10,20000),[ym]:M(2,4000)},imonthly:{},daily:{},idaily:{}},
            {sku:'SP001',productTitle:'SKINPEN',monthly:{[ym]:M(1,150000)},imonthly:{},daily:{},idaily:{}},
            {sku:'CS001',productTitle:'COSMELAN',monthly:{[pym]:M(3,60000)},imonthly:{},daily:{},idaily:{}}],
  specialists:{Rhas:{monthly:{[pym]:{u:20,v:150000},[ym]:{u:20,v:250000}},imonthly:{},daily:{},idaily:{},skus:{}},
               Tin:{monthly:{[ym]:{u:5,v:90000}},imonthly:{},daily:{},idaily:{},skus:{}},
               Abby:{monthly:{[pym]:{u:3,v:60000}},imonthly:{},daily:{},idaily:{},skus:{}},
               'Remedy BGC':{monthly:{[ym]:{u:5,v:50000}},imonthly:{[ym]:{u:5,v:50000}},daily:{},idaily:{},skus:{}}},
  customers:{'Dr. Cruz Clinic':{o:6,u:60,v:600000,u90:40,v90:400000,l:F.today,io:0,iu:0,iv:0,iu90:0,iv90:0,int:false},
             'Skin Station':{o:1,u:5,v:90000,u90:5,v90:90000,l:F.today,io:0,iu:0,iv:0,iu90:0,iv90:0,int:false},
             'Old Clinic':{o:3,u:10,v:120000,u90:0,v90:0,l:F.d70,io:0,iu:0,iv:0,iu90:0,iv90:0,int:false},
             'Derma Hub':{o:1,u:3,v:60000,u90:3,v90:60000,l:pym+'-10',io:0,iu:0,iv:0,iu90:0,iv90:0,int:false},
             'Remedy BGC':{o:1,u:5,v:50000,u90:5,v90:50000,l:F.today,io:1,iu:5,iv:50000,iu90:5,iv90:50000,int:true}},
  recent:[{n:'#1',dt:ym+'-02',t:'Rhas',c:'Dr. Cruz Clinic',x:0,ls:[['TD040',10,100000],['TD040 - AGF',1,40000]]},
          {n:'#2',dt:ym+'-05',t:'Rhas',c:'Dr. Cruz Clinic',x:0,ls:[['TD040',10,100000]]},
          {n:'#3',dt:ym+'-06',t:'Tin',c:'Skin Station',x:0,ls:[['SP001',1,150000],['ME0001',2,4000]]},
          {n:'#4',dt:ym+'-07',t:'Remedy BGC',c:'Remedy BGC',x:1,ls:[['TD040',5,50000]]},
          {n:'#5',dt:pym+'-03',t:'Rhas',c:'Dr. Cruz Clinic',x:0,ls:[['TD040',20,200000]]},
          {n:'#6',dt:pym+'-10',t:'Abby',c:'Derma Hub',x:0,ls:[['CS001',3,60000]]},
          {n:'#7',dt:F.d200,t:'Rhas',c:'Dr. Cruz Clinic',x:0,ls:[['TD040',5,50000]]}]};
mergeShopify();
TARGETS=[{month:ym,scope:'LINE',name:'Inno TDS',value:500000},{month:ym,scope:'LINE',name:'SKINPEN',value:100000},
         {month:ym,scope:'SPECIALIST',name:'Rhas',value:300000},{month:F.nym,scope:'SPECIALIST',name:'Rhas',value:350000},
         {month:ym,scope:'SPECIALIST',name:'Tin',value:400000},{month:ym,scope:'SPECIALIST',name:'Kristine',value:100000},
         {month:ym,scope:'PRODUCT',name:'TD040',value:450000},{month:ym,scope:'PRODUCT',name:'Meline Int',value:8000}];
VISITS=[{id:1,spec:'Rhas',account:'Dr. Cruz Clinic',type:'Clinic visit',outcome:'Ordered',date:F.today,status:'done'},
        {id:2,spec:'Rhas',account:'Old Clinic',type:'Call / follow-up',outcome:'Follow-up needed',date:F.today,status:'done'},
        {id:3,spec:'Rhas',account:'New Derma',type:'Product demo',outcome:'New account opened',date:F.today,status:'done'},
        {id:4,spec:'Rhas',account:'X',type:'Clinic visit',outcome:'Ordered',date:F.today,status:'planned'},
        {id:5,spec:'Tin',account:'Skin Station',type:'Clinic visit',outcome:'Ordered',date:pym+'-20',status:'done'},
        {id:6,spec:'Marj',account:'Skin Station',type:'Clinic visit',outcome:'No order',date:F.today,status:'done'}];
loadVisits=async()=>VISITS;
OWNERS={};OWNERS[custNorm(acctDedup('Old Clinic'))]='Rhas';loadOwners=async()=>OWNERS;
SERIALS=[{id:1,sku:'SP001',serial:'SP-1',status:'sold',sold_ref:'#3',updated_at:ym+'-06T10:00:00Z',created_at:F.d200},
         {id:2,sku:'SP001',serial:'SP-2',status:'in_stock',updated_at:F.d200,created_at:F.d200},
         {id:3,sku:'SP001',serial:'SP-3',status:'on_loan',updated_at:ym+'-03T10:00:00Z',created_at:F.d200}];
LOANS=[{id:1,serial_id:3,sku:'SP001',serial:'SP-3',account:'Derma Hub',out_date:ym+'-03',due_date:ym+'-20',status:'out',out_name:'Verna',updated_at:ym+'-03T10:00:00Z'}];
loadSerials=async()=>SERIALS;loadLoans=async()=>LOANS;

/* Supabase stub with the two new tables */
const DB={review_commentary:[{month:ym,section:'wins',body:'Closed 2 SkinPens',updated_name:'Marj',updated_at:ym+'-01T00:00:00Z'}],review_snapshots:[]};
const mkq=t=>{const q={_t:t,_eq:{},select(){return q},order(){return q},limit(){return q},in(){return q},gte(){return q},
  eq(k,v){q._eq[k]=v;return q},
  _rows(){return (DB[t]||[]).filter(r=>Object.entries(q._eq).every(([k,v])=>String(r[k])===String(v)))},
  maybeSingle(){return Promise.resolve({data:q._rows()[0]||null,error:null})},single(){return q.maybeSingle()},
  insert(rows){const arr=Array.isArray(rows)?rows:[rows];arr.forEach(r=>{r.id=(DB[t]||[]).length+1;r.created_at=r.created_at||new Date(Date.now()+1000).toISOString();(DB[t]=DB[t]||[]).push(r)});return Promise.resolve({error:null});},
  upsert(row){const rows=DB[t]=DB[t]||[];const i=rows.findIndex(r=>r.month===row.month&&r.section===row.section);if(i>=0)rows[i]=row;else rows.push(row);return Promise.resolve({error:null});},
  then(res){return Promise.resolve({data:q._rows(),error:null}).then(res)}};return q;};
SB={from:t=>mkq(t),auth:{getSession:async()=>({data:{session:null}})}};

/* ── numbers ── */
const R=bizCompute(ym);
const tds=R.brands.find(b=>b.name==='Inno TDS');
ok('brand MTD is external, base + deal revenue', tds&&tds.mtd===300000-50000+40000, tds&&tds.mtd);
ok('brand attainment vs LINE target', tds&&Math.round(tds.att)===58, tds&&tds.att);
ok('brand prev month', tds&&tds.prev===200000, tds&&tds.prev);
ok('SKINPEN attainment 150%', Math.round((R.brands.find(b=>b.name==='SKINPEN')||{}).att)===150);
ok('total = sum of brands', R.total.mtd===290000+4000+150000, R.total.mtd);
ok('total target falls back to the sum of brand targets', R.total.tgt===600000&&R.total.tgtSrc==='sum of brand targets', R.total.tgtSrc);
ok('projection scales by elapsed', Math.abs(R.total.proj-R.total.mtd/R.elapsed)<1);
ok('QTD covers the quarter so far', R.total.qtd>=R.total.mtd);
ok('13-month series', R.series.length===13&&R.series[12]===ym&&R.total.series[12]===R.total.mtd);
const td=R.products.find(p=>p.sku==='TD040');
ok('product row: units, deal revenue, PRODUCT target', td&&td.u===25&&td.deal===40000&&td.tgt===450000, JSON.stringify(td));
ok('products sorted by revenue', R.products[0].sku==='TD040');
/* specialists */
const names=R.specs.map(s=>s.name);
ok('internal tag excluded from specialists', !names.some(n=>/remedy/i.test(n)), names);
ok('Rhas, Tin, Abby present (Abby from prev month)', ['Rhas','Tin','Abby'].every(n=>names.includes(n)), names);
const rh=R.specs.find(s=>s.name==='Rhas'),tin=R.specs.find(s=>s.name==='Tin');
ok('Rhas MTD from specialist buckets', rh.mtd===250000&&rh.tgt===300000&&Math.round(rh.att)===83, rh.mtd);
ok('Rhas next-month target', rh.nextTgt===350000);
ok('Rhas orders/accounts from the order index', rh.orders===2&&rh.ordering===1&&rh.topAccts[0].name==='Dr. Cruz Clinic'&&rh.topAccts[0].v===240000, JSON.stringify(rh.topAccts));
ok('Rhas masterlist = owned + tagged', rh.masterlist===2&&rh.active===1&&rh.quiet===1, [rh.masterlist,rh.active,rh.quiet]);
ok('Rhas activity: planned excluded, call vs visit, demo, opened', rh.visits===2&&rh.calls===1&&rh.demos===1&&rh.ordered===1&&rh.opened===1, [rh.visits,rh.calls,rh.demos,rh.opened]);
ok('Rhas top brand', rh.topLines[0].name==='Inno TDS');
ok('Skin Station is Tin\\'s new account', tin.newAccts.length===1&&tin.newAccts[0]==='Skin Station', tin.newAccts);
ok('Dr. Cruz is not new (older orders exist)', !rh.newAccts.length, rh.newAccts);
ok('Tin prev-month visit not counted this month', tin.visits===0&&tin.calls===0);
ok('specs sorted by MTD', R.specs[0].name==='Rhas');
ok('a manager who logs a visit does not become a specialist', !names.includes('Marj'), names);
ok('alias target rows count for the canonical specialist', tin.tgt===500000&&Math.round(tin.att)===18, tin.tgt);
ok('PRODUCT target matches by name-contains like the Vs-target view', (R.products.find(p=>p.sku==='ME0001')||{}).tgt===8000);
ok('order index window is known and complete for this month', R.ordersComplete===true&&R.ordersFrom===F.d200);
{const keep=SHOPIFY.recentFrom;SHOPIFY.recentFrom=F.today;const R2=bizCompute(pym);SHOPIFY.recentFrom=keep;
 ok('month before the order index: revenue yes, orders/accounts no', R2.ordersComplete===false&&R2.total.mtd>0&&R2.accounts.newAccts.length===0&&R2.trends.some(t=>/not available/.test(t.t)), R2.total.mtd);}
/* accounts & buying */
const A=R.accounts;
ok('orders exclude internal', A.orders===3&&A.ordering===2, [A.orders,A.ordering]);
ok('new accounts', A.newAccts.length===1&&A.newAccts[0].name==='Skin Station'&&A.newRev===154000, A.newRev);
ok('repeat revenue = total - new', A.repeatRev===R.total.mtd-154000);
ok('reorderers and multi-brand', A.reorderers===1&&A.multiBrand===1, [A.reorderers,A.multiBrand]);
ok('AOV', Math.round(A.aov)===Math.round((240000+154000)/3), A.aov);
ok('top account with delta', A.top[0].name==='Dr. Cruz Clinic'&&A.top[0].prev===200000&&A.top[0].spec==='Rhas');
ok('faller: Derma Hub (prev only)', A.fallers.some(f=>f.name==='Derma Hub'&&f.d===-60000), JSON.stringify(A.fallers));
ok('riser: Dr. Cruz', A.risers.some(f=>f.name==='Dr. Cruz Clinic'&&f.d===40000));
ok('lapsed: Old Clinic, 70 days, owner Rhas', A.lapsed.length===1&&A.lapsed[0].name==='Old Clinic'&&A.lapsed[0].days===70&&A.lapsed[0].owner==='Rhas', JSON.stringify(A.lapsed));
ok('deal share', A.dealRev===40000&&Math.round(A.dealShare)===9, A.dealShare);
/* machines */
ok('equipment = serialised SKUs', R.machines.skus===1&&R.products.find(p=>p.sku==='SP001').equip&&!td.equip);
ok('installs / loans this month', R.machines.installs===1&&R.machines.loansOut===1&&R.machines.onLoan===1&&R.machines.inStock===1&&R.machines.rev===150000, JSON.stringify(R.machines));
/* trends */
ok('trends generated', R.trends.length>=6&&R.trends.length<=12, R.trends.length);
ok('pace sentence first', /Month to date ₱444,000 is 74% of the ₱600,000 target/.test(R.trends[0].t), R.trends[0].t);
ok('early-month guard matches the day', R.early===(R.day<4) && (R.early ? /too early to project/.test(R.trends[0].t) : /on this pace the month lands at/.test(R.trends[0].t)), R.day);
ok('no projection sentences in the first three days', !R.early || !R.trends.some(t=>/Projected month is|is tracking|on pace to hit/.test(t.t)));
ok('new-account sentence names Skin Station', R.trends.some(t=>/first order this month worth ₱154,000: Skin Station/.test(t.t)));
ok('lapsed sentence', R.trends.some(t=>/gone quiet for 45–120 days.*Old Clinic \\(70d\\)/.test(t.t)));
ok('brand leader sentence', R.trends.some(t=>/SKINPEN leads on attainment at 150%/.test(t.t)));
ok('per-specialist auto notes', (R.notesAuto.Rhas||[]).length>=3&&/₱250,000 MTD is 83%/.test(R.notesAuto.Rhas[0]), (R.notesAuto.Rhas||[])[0]);
ok('specialist note skips pace when early', !R.early || !/on pace for/.test(R.notesAuto.Rhas[0]));
ok('specialist note mentions quiet accounts', /1 repeat accounts quiet/.test(R.notesAuto.Rhas.join(' ')));
/* diff */
const S0=bizSnapSlim(R);S0.asOf=ym+'-01';S0.total=Object.assign({},S0.total,{mtd:R.total.mtd-100000,att:R.total.att-10});S0.accounts=Object.assign({},S0.accounts,{newAccts:0});
const D=bizDiff(R,S0);
ok('diff: revenue + attainment + new accounts', D&&D.same&&D.kpi.some(k=>k.l==='Revenue MTD'&&k.txt==='+₱100,000')&&D.kpi.some(k=>k.l==='Attainment'&&k.txt==='+10 pts')&&D.kpi.some(k=>k.l==='New accounts'&&k.txt==='+1'), JSON.stringify(D&&D.kpi));
ok('diff: unchanged KPIs omitted', !D.kpi.some(k=>k.l==='Orders'));
ok('no snapshot → no diff', bizDiff(R,null)===null);
{const S1=bizSnapSlim(R);S1.ym=pym;S1.total=Object.assign({},S1.total,{mtd:1});const Dx=bizDiff(R,S1);
 ok('snapshot of another month: commentary comparison only, no numeric movement', Dx&&Dx.same===false&&Dx.kpi.length===0&&!Object.keys(Dx.brands).length);}
/* month helpers */
ok('month arithmetic', bizPrevYm('2026-01')==='2025-12'&&bizYmAdd('2026-12',1)==='2027-01'&&bizQtrMonths('2026-08').join()==='2026-07,2026-08'&&bizYtdMonths('2026-03').length===3&&bizDaysIn('2026-02')===28);
ok('compact pesos', bizCompact(16539510)==='₱16.5M'&&bizCompact(650000)==='₱650K'&&bizCompact(950)==='₱950', bizCompact(16539510));
/* permissions */
ok('view allowed for sales', (()=>{const r=ROLE;ROLE='sales';const a=viewAllowed('bizreview');ROLE=r;return a;})());
ok('view allowed for finance/marketing/viewer', ['finance','marketing','viewer','supply_chain'].every(x=>{const r=ROLE;ROLE=x;const a=viewAllowed('bizreview');ROLE=r;return a;}));
ok('manager edits all', bizCanEdit('wins')&&bizCanEdit('ps:Rhas'));
ROLE='sales';SBPROFILE={name:'Rhas R.',role:'sales',specialist_tag:'Rhas'};
ok('specialist edits only own box', !bizCanEdit('wins')&&bizCanEdit('ps:Rhas')&&bizCanEdit('ps:rhas')&&!bizCanEdit('ps:Tin'));
SBPROFILE={name:'K',role:'sales',specialist_tag:'Kristine'};
ok('UI mirrors RLS: an alias-tagged profile cannot edit the canonical box', !bizCanEdit('ps:Tin'));
SBPROFILE={name:'Rhas R.',role:'sales',specialist_tag:'Rhas'};
/* render as specialist */
currentView='bizreview';BIZ.ym=ym;BIZ.snaps=null;await renderBizReview();
let c=document.getElementById('content').innerHTML;
ok('page renders with the cover strip', /MONTHLY SALES PERFORMANCE REPORT/.test(c));
ok('specialist gets own textarea only', document.getElementById('bz-ps_Rhas')&&!document.getElementById('bz-wins')&&!document.getElementById('bz-ps_Tin'));
ok('specialist sees manager commentary read-only', /Closed 2 SkinPens/.test(c)&&/view only — the sales manager writes this/.test(c));
ok('specialist: export my slides, no snapshot/full export', /Export my slides/.test(c)&&!/Save snapshot/.test(c)&&!/Export PowerPoint/.test(c));
ok('no admin words in the view-only banner', !/admin/i.test(c.match(/view only[^<]*/g).join(' ')));
ok('own panel flagged', /<span class="pill pbl">you<\\/span>/.test(c));
ok('charts drawn', ['bzBrand','bzMonthly','bzAccts','bzSpecs'].every(id=>document.getElementById(id)));
ok('lapsed table present', /Repeat accounts going quiet/.test(c)&&/Old Clinic/.test(c));
/* render as manager, save note, snapshot */
ROLE='manager';SBPROFILE={name:'Marj',role:'manager'};await renderBizReview();c=document.getElementById('content').innerHTML;
ok('manager gets every textarea', document.getElementById('bz-wins')&&document.getElementById('bz-ps_Rhas')&&document.getElementById('bz-ps_Tin')&&document.getElementById('bz-plan'));
ok('manager toolbar', /Save snapshot/.test(c)&&/Export PowerPoint/.test(c)&&!/Export my slides/.test(c));
ok('no earlier snapshot note', /no earlier snapshot to compare with yet/.test(c));
document.getElementById('bz-challenges').value='Ghost month slowed BMG';await bizSaveNote('challenges');
ok('note saved through upsert', DB.review_commentary.some(r=>r.section==='challenges'&&r.body==='Ghost month slowed BMG'&&r.updated_name==='Marj'));
ok('save status shown', /Saved · Marj/.test(document.getElementById('bzs-challenges').textContent));
document.getElementById('bz-territory').value='UST accreditation ongoing';
ok('dirty detection', JSON.stringify(bizDirty())==='["territory"]', JSON.stringify(bizDirty()));
await bizSnapshot();
ok('unsaved typing is saved before the snapshot, not lost', DB.review_commentary.some(r=>r.section==='territory'&&r.body==='UST accreditation ongoing')&&DB.review_snapshots[0].notes.territory&&DB.review_snapshots[0].notes.territory.body==='UST accreditation ongoing');
ok('snapshot stored with slim data + notes', DB.review_snapshots.length===1&&DB.review_snapshots[0].data.total.mtd===R.total.mtd&&DB.review_snapshots[0].notes.challenges, DB.review_snapshots.length);
ok('snapshot data is slim (no product list)', !DB.review_snapshots[0].data.products);
/* now the page should compare with it */
DB.review_snapshots[0].created_at=new Date(Date.now()-60000).toISOString();
BIZ.snaps=null;await renderBizReview();c=document.getElementById('content').innerHTML;
ok('previous report shown in boxes', /Last report \\(/.test(c)&&/unchanged/.test(c));
ok('cover mentions comparison', /compared with the report saved/.test(c));
ok('same-month snapshot: movement banner only when something moved', !/Since the last report/.test(c), (c.match(/Since the last report[^]{0,400}/)||[''])[0].replace(/<[^>]+>/g,' '));
/* an older-month snapshot: commentary compared, numbers not */
DB.review_snapshots[0].month=pym;DB.review_snapshots[0].data.ym=pym;BIZ.snaps=null;await renderBizReview();c=document.getElementById('content').innerHTML;
ok('earlier-month snapshot still feeds the "last report" boxes', /Last report \\(/.test(c));
ok('…but never claims numeric movement', !/Since the last report/.test(c));
DB.review_snapshots[0].month=ym;DB.review_snapshots[0].data.ym=ym;BIZ.snaps=null;await renderBizReview();
/* the deck: needs the real library */
window.__R=R;window.__ctx={notes:BIZ.notes,prevNotes:BIZ.prevNotes,prev:BIZ.prev,diff:bizDiff(R,S0),author:'Marj'};
window.__ctxMine={notes:BIZ.notes,prevNotes:BIZ.prevNotes,prev:BIZ.prev,diff:null,only:'Rhas'};
window.__done=true;
})().catch(e=>{window.__out.push([false,'test threw',String(e&&e.stack||e)]);window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
(async()=>{
  for(let i=0;i<200&&!w.__done;i++)await new Promise(r=>setTimeout(r,25));
  const res=w.__out||[];
  // deck build with the real pptxgenjs (node), same code the browser runs
  let PG=null;try{PG=require('pptxgenjs');}catch(e){try{PG=require(process.env.PPTXGENJS||'/tmp/pg/node_modules/pptxgenjs');}catch(e2){}}
  if(PG&&w.__R){
    try{const p=new PG();w.bizDeck(p,w.__R,w.__ctx);const n=p.slides.length;
      res.push([n>=18,'full deck slide count',n]);
      const p2=new PG();w.bizDeck(p2,w.__R,w.__ctxMine);res.push([p2.slides.length===3,'specialist deck = cover + slide + commentary',p2.slides.length]);
      const outp=process.argv[2];if(outp){await p.writeFile({fileName:outp});res.push([fs.existsSync(outp),'sample deck written',outp]);
        const mine=outp.replace(/\.pptx$/,'-rhas.pptx');await p2.writeFile({fileName:mine});res.push([fs.existsSync(mine),'specialist deck written',mine]);}}
    catch(e){res.push([false,'deck build threw',String(e&&e.stack||e)]);}
  }else res.push([true,'deck build skipped (pptxgenjs not installed)','']);
  for(const [p,n,x] of res){if(!p)fail++;console.log((p?'PASS ':'FAIL ')+n+(x?'  → '+x:''));}
  console.log('\n'+(res.length-fail)+'/'+res.length+' passed');
  process.exit(fail?1:0);
})();
