/* Monthly sales by SKU (Marj, 2026-09-28): Jan…Dec across, SKUs down grouped by
   product line, year total, stock now. Same one-eval pattern as the other sales
   suites — the app's classic scripts share one lexical scope with the assertions.
   Run from the repo root: node tools/test/sales-monthly.test.js */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.SB=null; w.SBUSER={id:'u1'}; w.SBPROFILE={name:'A'};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
const src={i:html,v01:fs.readFileSync('js/01-shopify-merge-prices.js','utf8'),v02:fs.readFileSync('js/02-views.js','utf8'),
  v05:fs.readFileSync('js/05-home-roleaware-launcher.js','utf8'),v08:fs.readFileSync('js/08-simulator-reorder-budget.js','utf8'),
  v09:fs.readFileSync('js/09-ask-ai-inapp.js','utf8')};
let fail=0;const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&x!==''?'  → '+x:''));if(!c)fail++;};

// ── static wiring: every place a new view must be known ──
ok('script tag after the org chart', /js\/19-orgchart\.js"><\/script>\n<script defer src="js\/20-sales-monthly\.js"><\/script>/.test(src.i));
ok('sidebar row under Sales analytics, right after Sales overview', /showView\('salesoverview',this\)[^\n]*\n\s*<div class="ni nv-sales" onclick="showView\('salesmonthly',this\)">[\s\S]*?Monthly by SKU<\/div>/.test(src.i));
ok('T map, dispatch, re-render, DESC, SHORT, SUBS, export', /salesmonthly:'Monthly sales by SKU'/.test(src.v02)&&/v==='salesmonthly'\) renderSalesMonthly\(\)/.test(src.v02)&&
  /currentView==='salesmonthly'\) renderSalesMonthly\(\)/.test(src.v01)&&/salesmonthly:'One year on one page/.test(src.v01)&&/salesmonthly:'Monthly'/.test(src.v09)&&
  /salesmonthly:'Jan–Dec per SKU, with stock'/.test(src.v05)&&/case 'salesmonthly': return exportSalesMonthly\(\)/.test(src.v08));

ok('business review: a specialist\'s name opens the specialist page', /\(mine\|\|ROLE!=='sales'\)&&viewAllowed\('spec'\)\?'<a href="#" onclick="showSpecPage\(/.test(fs.readFileSync('js/12-business-review.js','utf8')));
ok('specialist page: the month chart is clickable', /onClick:\(e,els\)=>\{if\(els&&els\.length&&yms\[els\[0\]\.index\]\)specPickMonth/.test(src.v05));
const test=`
(async()=>{
const OUT=[];window.__out=OUT;const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
ROLE='manager';loadShopify=()=>{};refreshSidebar=()=>{};audit=()=>{};sbAuthHeaders=async()=>({});
const _q=new Proxy({},{get:(t,k)=>{if(k==='then')return r=>Promise.resolve({data:[],error:null}).then(r);if(k==='single'||k==='maybeSingle')return ()=>Promise.resolve({data:null,error:null});return ()=>_q;}});
SB={from:()=>_q,auth:{getSession:async()=>({data:{session:null}})}};
const Y=monthISO().slice(0,4), NOW=monthISO(), JAN=Y+'-01', PREV=(+Y-1)+'-12';
/* Meline:   AAA sold in Jan (10u ₱1,000, 4u ₱400 of it internal) and this month (5u ₱500)
             plus ₱300 of deal revenue in Jan; stock 7
   Inno TDS: BBB sold this month only, 20u ₱4,000; stock 0
             CCC never sold, stock 12 (sellable) — listed
             SMP a sample with stock 9 — not listed
   Package:  PK01 Shopify-only, ₱900 in Jan — listed under SHOPIFY ONLY, stock n/a
   Last December: AAA 3u ₱300 — the previous year is selectable */
DATA=[{sku:'AAA',name:'Alpha cream',line:'Meline',category:'Commercial',price:100,stock:7},
      {sku:'BBB',name:'Beta serum',line:'Inno TDS',category:'Commercial',price:200,stock:0},
      {sku:'CCC',name:'Gamma mask',line:'Inno TDS',category:'Commercial',price:50,stock:12},
      {sku:'SMP',name:'Sample sachet',line:'Meline',category:'MKT SAMPLES',price:0,stock:9}];
const JM=(JAN===NOW)?{[JAN]:{u:15,f:0,v:1500,d:0,dv:0}}:{[JAN]:{u:10,f:0,v:1000,d:0,dv:0},[NOW]:{u:5,f:0,v:500,d:0,dv:0}};
SHOPIFY={v:9,internalSplit:true,synced:'2026-09-28T00:00:00Z',dailyFrom:'2020-01-01',
  variants:[
    {sku:'AAA',productTitle:'Alpha cream',price:100,inv:7,monthly:Object.assign({[PREV]:{u:3,f:0,v:300,d:0,dv:0}},JM),daily:{},imonthly:{[JAN]:{u:4,f:0,v:400,d:0,dv:0}},idaily:{}},
    {sku:'AAA - 5+1',productTitle:'Alpha cream 5+1',price:500,monthly:{[JAN]:{u:0,f:0,v:300,d:0,dv:0}},daily:{},imonthly:{},idaily:{}},
    {sku:'BBB',productTitle:'Beta serum',price:200,inv:0,monthly:{[NOW]:{u:20,f:0,v:4000,d:0,dv:0}},daily:{},imonthly:{},idaily:{}},
    {sku:'PK01',productTitle:'Starter package',price:900,monthly:{[JAN]:{u:1,f:0,v:900,d:0,dv:0}},daily:{},imonthly:{},idaily:{}}],
  specialists:{},customers:{},recent:[],orders:0};
SLINE='';setSext(true);mergeShopify();
const grid=()=>$('sm-grid');
const rowOf=label=>[...grid().querySelectorAll('tbody tr')].find(tr=>tr.cells[0].textContent.indexOf(label)>=0);
const cellTxt=(tr,i)=>tr.cells[i].textContent.replace(/\\s+/g,' ').replace(/ u₱/,' u ₱').trim();  // i: 1..12 months, 13 year, 14 stock
const nowI=+NOW.slice(5,7);

SMYEAR=null;SMSHOW='both';showView('salesmonthly',null);
ok('manager may open it, and it renders the grid', viewAllowed('salesmonthly')&&!!grid(), currentView);
ok('title', $('ptitle').textContent==='Monthly sales by SKU', $('ptitle').textContent);
const hd=[...grid().querySelectorAll('thead th')].map(t=>t.textContent);
ok('columns: product, Jan … Dec, year total, stock now', hd.length===15&&hd[1]==='Jan'&&/^Dec/.test(hd[12])&&/Year to date/.test(hd[13])&&hd[14]==='Stock now', hd.join('|'));
ok('the running month is marked "to date"', /\\(to date\\)/.test(hd[nowI]), hd[nowI]);
const lines=[...grid().querySelectorAll('tbody tr')].filter(tr=>/SKU/.test(tr.cells[0].textContent)&&/▾|▸/.test(tr.cells[0].textContent)).map(tr=>tr.cells[0].textContent.replace(/^[▾▸] /,'').split(' · ')[0].trim());
ok('lines grouped, biggest year first (Inno TDS ₱4,000 > Meline > package)', lines[0]==='Inno TDS'&&lines[1]==='Meline'&&lines.length===3, lines.join(','));
const A=rowOf('Alpha cream');
if(JAN!==NOW){
  ok('AAA January external: 10 − 4 internal = 6 u; ₱1,000 − ₱400 + ₱300 deal revenue = ₱900', cellTxt(A,1)==='6 u ₱900', cellTxt(A,1));
  ok('AAA this month: 5 u ₱500', cellTxt(A,nowI)==='5 u ₱500', cellTxt(A,nowI));
}
ok('AAA year to date: 11 u ₱1,400 (last December not included)', cellTxt(A,13)==='11 u ₱1,400', cellTxt(A,13));
ok('AAA stock now 7', cellTxt(A,14)==='7', cellTxt(A,14));
ok('a month with no sales shows a dash', JAN===NOW||nowI<3||cellTxt(A,2)==='—', cellTxt(A,2));
ok('months after this one stay empty', nowI===12||cellTxt(A,12)==='', cellTxt(A,12));
const M=rowOf('Meline · ');
ok('Meline subtotal carries its SKUs: 11 u ₱1,400, stock 7', cellTxt(M,13)==='11 u ₱1,400'&&cellTxt(M,14)==='7', cellTxt(M,13)+' / '+cellTxt(M,14));
ok('an unsold SKU with stock is listed (Gamma mask, stock 12)', !!rowOf('Gamma mask')&&cellTxt(rowOf('Gamma mask'),14)==='12');
ok('a sample with stock is not', !rowOf('Sample sachet'));
ok('a Shopify-only package is listed, stock n/a', !!rowOf('Starter package')&&cellTxt(rowOf('Starter package'),14)==='—');
ok('zero stock is shown as 0 (amber), not a dash', cellTxt(rowOf('Beta serum'),14)==='0');
const T=rowOf('All product lines');
ok('grand total: 32 u (6 + 5 + 20 + the package) ₱6,300 · stock 19', cellTxt(T,13)==='32 u ₱6,300'&&cellTxt(T,14)==='19', cellTxt(T,13)+' / '+cellTxt(T,14));
ok('headline cards: revenue and units year to date', /₱6,300/.test($('content').querySelector('.met.gr').textContent)&&/32/.test($('content').querySelector('.met.bl').textContent));

setSext(false);renderSalesMonthly();
ok('Incl. Remedy puts the internal order back: AAA 15 u ₱1,800', cellTxt(rowOf('Alpha cream'),13)==='15 u ₱1,800', cellTxt(rowOf('Alpha cream'),13));
setSext(true);

SMSHOW='units';renderSalesMonthly();
ok('Units only: plain counts, no pesos in the grid', cellTxt(rowOf('Alpha cream'),13)==='11'&&grid().textContent.indexOf('₱')<0, cellTxt(rowOf('Alpha cream'),13));
SMSHOW='rev';renderSalesMonthly();
ok('Revenue only: pesos, no unit counts', cellTxt(rowOf('Alpha cream'),13)==='₱1,400', cellTxt(rowOf('Alpha cream'),13));
SMSHOW='both';

SMHIDE=true;renderSalesMonthly();
ok('Hide SKUs with no sales drops Gamma mask, keeps the rest', !rowOf('Gamma mask')&&!!rowOf('Beta serum'));
SMHIDE=false;

smToggle('Meline');
ok('clicking a line folds its SKUs, the subtotal stays', !rowOf('Alpha cream')&&!!rowOf('Meline · ')&&/▸/.test(rowOf('Meline · ').cells[0].textContent));
smAll(true);
ok('Expand all opens it again', !!rowOf('Alpha cream'));

SMLINE='Inno TDS';renderSalesMonthly();
ok('line filter: only Inno TDS, total row names the line', !rowOf('Alpha cream')&&!!rowOf('Beta serum')&&!!rowOf('Inno TDS — total'));
SMLINE='';SMQ='gamma';renderSalesMonthly();
ok('search by name', !!rowOf('Gamma mask')&&!rowOf('Beta serum'));
SMQ='bbb';renderSalesMonthly();
ok('search by SKU', !!rowOf('Beta serum')&&!rowOf('Gamma mask'));
SMQ='';

SMYEAR=String(+Y-1);renderSalesMonthly();
ok('last year is selectable: AAA December 3 u ₱300, header says Year total', cellTxt(rowOf('Alpha cream'),12)==='3 u ₱300'&&/Year total/.test(grid().querySelector('thead').textContent), cellTxt(rowOf('Alpha cream'),12));
ok('…and months before HQ’s Shopify history read n/a', cellTxt(rowOf('Alpha cream'),1)==='n/a', cellTxt(rowOf('Alpha cream'),1));
SMYEAR=Y;

// cell rules on their own, independent of today's date
ok('smCell: a future month is blank', smCell({u:1,v:1},'2026-12',{now:'2026-09',from:'2025-09'},false)==='<td class="r" style="color:var(--tx3)"></td>');
ok('smCell: before the history is n/a', /n\\/a/.test(smCell({u:0,v:0},'2026-01',{now:'2026-09',from:'2026-03'},false)));

let got=null;downloadCSV=(n,h,r)=>{got={n,h,r};};
exportCurrentView();
ok('Export: file named by year and external', got&&got.n==='monthly_sales_by_sku_'+Y+'_external', got&&got.n);
ok('Export header: line, SKU, product, units + PHP per month, year, stock', got&&got.h.length===3+24+3&&got.h[3]==='Jan '+Y+' units'&&got.h[4]==='Jan '+Y+' PHP'&&got.h[29]==='Stock now', got&&got.h.length);
const ra=got&&got.r.find(r=>r[1]==='AAA');
ok('Export row for AAA: year 11 u / 1400 PHP / stock 7', ra&&ra[27]===11&&ra[28]===1400&&ra[29]===7, ra&&ra.slice(27).join('/'));
ok('Export has a total row per line and a grand total', got&&got.r.filter(r=>r[2]==='Line total').length===3&&got.r[got.r.length-1][2]==='Grand total');
ok('Export leaves future months empty rather than 0', nowI===12||(ra&&ra[3+2*11]===''), ra&&ra[3+2*11]);

ok('no cost or margin anywhere on the page', !/cost|margin/i.test($('content').textContent));
ROLE='sales';SBPROFILE={name:'S',role:'sales',specialist_tag:'Rhas'};
ok('specialists may open it, like Sales overview', viewAllowed('salesmonthly'));
ROLE='viewer';ok('viewers may open it', viewAllowed('salesmonthly'));

// ── specialist mode (2026-10-08): one specialist's products, month by month ──
/* Lady: Jan  AAA 3u ₱300 + its 5+1 deal line ₱150 · BBB 2u ₱400
         now  AAA 4u ₱400 · an internal order (Remedy BGC) AAA 10u ₱1,000
   Rhas: now  AAA 6u ₱600 */
ROLE='manager';SBPROFILE={name:'M',role:'manager'};SMSPEC=null;SMYEAR=Y;SMLINE='';SMQ='';SMSHOW='both';setSext(true);
SHOPIFY.recentFrom=(+Y-1)+'-12-15';
SHOPIFY.recent=(JAN===NOW?[]:[{n:'#L1',dt:JAN+'-05',t:'Lady',c:'Skin Clinic',x:0,ls:[['AAA',3,300],['AAA - 5+1',0,150],['BBB',2,400]]}]).concat([
  {n:'#L2',dt:NOW+'-02',t:'Lady',c:'Skin Clinic',x:0,ls:[['AAA',4,400]]},
  {n:'#L3',dt:NOW+'-03',t:'Lady',c:'Remedy BGC',x:1,ls:[['AAA',10,1000]]},
  {n:'#R1',dt:NOW+'-04',t:'Rhas',c:'Derma Hub',x:0,ls:[['AAA',6,600]]}]);
mergeShopify();
renderSalesMonthly();
const so=[...$('sm-spec').options].map(o=>o.textContent);
ok('managers get a picker: whole company + every specialist', so[0]==='Whole company'&&so.includes('Lady')&&so.includes('Rhas'), so.join('|'));
ok('…and start on the whole company', $('sm-spec').value==='', $('sm-spec').value);
SMSPEC='Lady';renderSalesMonthly();
const LA=rowOf('Alpha cream');
if(JAN!==NOW){
  ok('Lady, AAA January: 3 u, ₱300 + ₱150 deal line = ₱450', cellTxt(LA,1)==='3 u ₱450', cellTxt(LA,1));
  ok('Lady, BBB January 2 u ₱400', cellTxt(rowOf('Beta serum'),1)==='2 u ₱400', cellTxt(rowOf('Beta serum'),1));
}
ok('Lady, AAA this month: 4 u ₱400 — the Remedy order left out, Rhas not counted', cellTxt(LA,nowI)==='4 u ₱400', cellTxt(LA,nowI));
ok('only what she sold is listed (no Gamma mask, no package)', !rowOf('Gamma mask')&&!rowOf('Starter package'));
ok('her total: '+(JAN===NOW?'4 u ₱400':'9 u ₱1,250'), cellTxt(rowOf('All product lines'),13)===(JAN===NOW?'4 u ₱400':'9 u ₱1,250'), cellTxt(rowOf('All product lines'),13));
ok('the card says whose orders', /Lady’s orders/.test($('content').querySelector('.met.gr').textContent));
ok('no "hide unsold" box in specialist mode', !/Hide SKUs with no sales/.test($('content').textContent));
setSext(false);renderSalesMonthly();
ok('Incl. Remedy adds her internal order: AAA this month 14 u ₱1,400', cellTxt(rowOf('Alpha cream'),nowI)==='14 u ₱1,400', cellTxt(rowOf('Alpha cream'),nowI));
setSext(true);
ok('the year picker offers only years the per-order history covers (it starts '+Y+'-01 here)', smYears().join()===Y, smYears().join());
let got2=null;downloadCSV=(n,h,r)=>{got2={n,h,r};};exportSalesMonthly();
ok('her export is named for her', got2&&got2.n==='monthly_sales_by_sku_'+Y+'_Lady_external', got2&&got2.n);

const P=specProducts('Lady',NOW,true);
ok('specProducts: this month = AAA 4 u ₱400, external', P.rows.length===1&&P.rows[0].sku==='AAA'&&P.rows[0].u===4&&P.rows[0].v===400&&P.tot.v===400, JSON.stringify(P.tot));
ok('specProducts: incl. internal when asked', specProducts('Lady',NOW,false).tot.u===14);

// a specialist signs in: the page opens on her own sales, and she can only switch to the company
ROLE='sales';SBPROFILE={name:'Lady',role:'sales',specialist_tag:'Lady'};SMSPEC=null;renderSalesMonthly();
const so2=[...$('sm-spec').options].map(o=>o.textContent);
ok('a specialist lands on "My sales"', $('sm-spec').value==='Lady'&&so2.length===2&&/^My sales/.test(so2[0])&&so2[1]==='Whole company', so2.join('|'));
ok('…and is never offered another specialist', !so2.includes('Rhas'));

// her own page: the products follow the calendar month
loadVisits=async()=>[];loadNativeOrders=async()=>[];VISITS=[];NORDERS=[];
CAL_YM=NOW;CAL_SEL=null;CUR_SPEC='Lady';currentView='spec';await renderSpecPage();
const pp=()=>$('sp-prods').textContent;
ok('specialist page: "Products sold — <this month>" lists AAA with 4 units and the total', /Products sold —/.test(pp())&&/Alpha cream/.test(pp())&&/Total — 1 product/.test(pp())&&/₱400/.test(pp()), pp().slice(0,160));
ok('…the 12-month top list is gone', !/Top products \(12 months\)/.test($('content').textContent));
if(JAN!==NOW){
  specPickMonth(JAN);await new Promise(r=>setTimeout(r,20));
  ok('tapping a month (or ‹ ›) switches the list: January has AAA and BBB, ₱850', CAL_YM===JAN&&/Beta serum/.test(pp())&&/₱850/.test(pp()), pp().slice(0,200));
}
ok('a button opens every month, product by product', /Every month, product by product/.test(pp()));

// business review: the full product list per specialist, open for your own section
const bz=bizProdDetails({name:'Lady',label:'Lady'},{ym:NOW,label:'This month'},true);
ok('business review: "All products sold" opens for her own section with units and pesos', /<details class="bz-prods" open/.test(bz)&&/Alpha cream/.test(bz)&&/₱400/.test(bz)&&/Total — 1 product/.test(bz));
ok('…and is folded for someone else’s', !/ open/.test(bizProdDetails({name:'Rhas',label:'Rhas'},{ym:NOW,label:'x'},false).split('>')[0]));
})().catch(e=>{window.__out=[[false,'crashed: '+(e&&e.stack||e),'']];}).finally(()=>{window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
(async()=>{const t0=Date.now();while(!w.__done&&Date.now()-t0<20000)await new Promise(r=>setTimeout(r,20));
  for(const [c,n,x] of (w.__out||[[false,'timed out','']]))ok(n,c,x);
  console.log('\n'+(fail?fail+' FAILED':'all passed'));process.exit(fail?1:0);})();
