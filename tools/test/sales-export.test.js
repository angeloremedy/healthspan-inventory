/* Sales export, browser side: the rules that turn order lines into sales per product,
   the page, who sees it, and the Excel download. Run: node tools/test/sales-export.test.js */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
const v01=fs.readFileSync('js/01-shopify-merge-prices.js','utf8'),v02=fs.readFileSync('js/02-views.js','utf8'),v05=fs.readFileSync('js/05-home-roleaware-launcher.js','utf8'),v08=fs.readFileSync('js/08-simulator-reorder-budget.js','utf8'),v09=fs.readFileSync('js/09-ask-ai-inapp.js','utf8');
let fail=0;const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&x!==''?'  → '+x:''));if(!c)fail++;};

ok('script tag and sidebar row under Sales analytics, after Monthly by SKU', /js\/21-usage\.js"><\/script>\n<script defer src="js\/22-sales-export\.js"><\/script>/.test(html)&&/showView\('salesmonthly',this\)[^\n]*\n\s*<div class="ni nv-sales" onclick="showView\('salesexport',this\)">[\s\S]*?Sales export<\/div>/.test(html));
ok('T map, dispatch, DESC, SHORT, SUBS, export', /salesexport:'Sales export — one month from Shopify'/.test(v02)&&/v==='salesexport'\) renderSalesExport\(\)/.test(v02)&&/salesexport:'One click instead of a Shopify export/.test(v01)&&/salesexport:'Export'/.test(v09)&&/salesexport:'A month from Shopify, in one click'/.test(v05)&&/case 'salesexport': return sxExcel\(\)/.test(v08));
ok('Excel library loads on demand from cdnjs with an integrity hash', /cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/xlsx\.full\.min\.js/.test(fs.readFileSync('js/22-sales-export.js','utf8'))&&/s\.integrity=SX_XLSX_SRI/.test(fs.readFileSync('js/22-sales-export.js','utf8')));

const test=`
(async()=>{
const OUT=[];window.__out=OUT;const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
loadShopify=()=>{};refreshSidebar=()=>{};audit=()=>{};SB=null;
DATA=[{sku:'TD040',name:'FACE NADE',line:'Inno TDS'},{sku:'F5SP072',name:'SKINPEN TREATMENT KIT',line:'SKINPEN'},{sku:'ME000F',name:'F GENTLE FOAM',line:'Meline'}];
const L=(sku,name,q,p,amt)=>({sku,name,q,p,amt});
const ORDERS=[
  {n:'#HG-9280',dt:'2026-05-21',c:'Jan Dipasupil',co:'Jan Medical Group',t:'Rhas',fs:'PENDING',ff:'UNFULFILLED',x:false,int:false,sub:57000,tot:57000,disc:66500,ship:0,tax:6107.14,
   ls:[L('TD040B','6+1 BUNDLE – TDS FACE NADE 4*2.5ML',1,57000,57000),L('TD040','TDS FACE NADE 4*2.5ML',7,9500,0)]},
  {n:'#HG-9281',dt:'2026-05-21',c:'Joyzen',co:'Nuveu Clinic',t:'joy',fs:'PENDING',ff:'UNFULFILLED',x:false,int:false,sub:180000,tot:180000,disc:57240,ship:0,tax:0,
   ls:[L('PK0114','2026 Package 3: SkinPen Standard w/o event',1,180000,180000),L('F5SP072','Treatment kit-3 pieces- 12/case',12,3550,0)]},
  {n:'#HG-9277',dt:'2026-05-20',c:'Walk-in',co:'',t:'Lady',fs:'PAID',ff:'FULFILLED',x:false,int:false,sub:2000,tot:2000,disc:0,ship:0,tax:0,ls:[L('ME000F','F GENTLE FOAM 150ML',1,2000,2000)]},
  {n:'#HG-9300',dt:'2026-05-22',c:'Remedy BGC',co:'',t:'Remedy',fs:'PAID',ff:'FULFILLED',x:false,int:true,sub:4000,tot:4000,disc:0,ship:0,tax:0,ls:[L('ME000F','F GENTLE FOAM 150ML',2,2000,4000)]},
  {n:'#HG-9316',dt:'2026-05-25',c:'Clinic X',co:'',t:'Pinky',fs:'VOIDED',ff:'UNFULFILLED',x:true,int:false,sub:80000,tot:80000,disc:0,ship:0,tax:0,ls:[L('EX1','4+1 EXO-SKIN',1,80000,80000)]},
  {n:'#HG-9301',dt:'2026-05-23',c:'Edited Clinic',co:'',t:'Tin',fs:'PAID',ff:'FULFILLED',x:false,int:false,sub:9000,tot:9000,disc:0,ship:0,tax:0,ls:[L('ME000F','F GENTLE FOAM 150ML',3,2000,6000)]}];
let B=sxBuild(ORDERS,{ext:true});
const P=k=>B.products.find(p=>p.key===k);
ok('a bundle\\'s pesos count under the product it bundles; units from the product\\'s own line', P('TD040')&&P('TD040').v===57000&&P('TD040').u===7&&!P('TD040B'), JSON.stringify(P('TD040')));
ok('the product keeps its Shopify name', P('TD040').name==='TDS FACE NADE 4*2.5ML');
ok('a package with no product of its own stays a line of its own; its kits count as units at ₱0', P('PK0114')&&P('PK0114').v===180000&&P('F5SP072').u===12&&P('F5SP072').v===0);
ok('external only: the Remedy order is left out; cancelled always', !B.lines.some(l=>l.n==='#HG-9300'||l.n==='#HG-9316')&&B.skip.internal===1&&B.skip.cancelled===1, JSON.stringify(B.skip));
ok('total = sum of counted lines = ₱245,000 (57,000 + 180,000 + 2,000 + 6,000)', Math.round(B.tot.v)===245000, B.tot.v);
ok('the check flags the order whose lines miss Shopify\\'s subtotal (₱6,000 vs ₱9,000)', B.tot.bad.length===1&&B.tot.bad[0].n==='#HG-9301'&&B.tot.bad[0].diff===-3000, JSON.stringify(B.tot.bad));
ok('products sorted A→Z like the old pivot', B.products.map(p=>p.name).join('|')===[...B.products.map(p=>p.name)].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'})).join('|'));
B=sxBuild(ORDERS,{ext:false});
ok('incl. Remedy adds the internal order', B.lines.some(l=>l.n==='#HG-9300'&&l.int)&&Math.round(B.tot.v)===249000);

// the page, as a granted viewer
ROLE='viewer';SBPROFILE={name:'Marie',role:'viewer',view_grants:['salesexport']};
ok('a viewer with the page granted may open it; without, not', viewAllowed('salesexport')&&(()=>{SBPROFILE={name:'V',role:'viewer'};const r=viewAllowed('salesexport');SBPROFILE={name:'Marie',role:'viewer',view_grants:['salesexport']};return !r;})());
const calls=[];sbAuthHeaders=async()=>({});
fetch=async u=>{if(!/sales-export/.test(u))return {ok:true,json:async()=>({})};calls.push(u);const after=/after=/.test(u);return {ok:true,json:async()=>({orders:after?ORDERS.slice(3):ORDERS.slice(0,3),next:after?null:'C1'})};};
SX.ym='2026-05';SX.data={};setSext(true);currentView='salesexport';
await renderSalesExport();
ok('one click: the page reads every page of the month', calls.length===2&&/ym=2026-05/.test(calls[0])&&/after=C1/.test(calls[1]), calls.join(' | '));
const txt=$('content').textContent;
ok('cards: sales, orders, left out, check', /₱245,000/.test(txt)&&/Left out/.test(txt)&&/1 cancelled · 1 internal/.test(txt)&&/1 to look at/.test(txt), txt.slice(0,300));
const rows=[...$('sx-prod').querySelectorAll('tbody tr')].map(r=>[...r.cells].map(c=>c.textContent));
const BX=sxBuild(ORDERS,{ext:true});ok('By product table with a grand total', rows.length===BX.products.length+1&&rows[rows.length-1][0]==='Grand total'&&rows[rows.length-1][3]==='₱245,000', rows.map(r=>r.join('/')).join(' || '));
SX.view='orders';await renderSalesExport();
ok('Orders tab highlights the order to look at', /HG-9301/.test($('sx-orders').textContent)&&$('sx-orders').querySelector('tr[style*="am-bg"]'));
SX.view='lines';await renderSalesExport();
ok('Order lines tab shows where a bundle line is counted', /TD040B/.test($('sx-lines').textContent)&&[...$('sx-lines').querySelectorAll('tbody tr')].some(r=>r.cells[5].textContent==='TD040B'&&r.cells[9].textContent==='TD040'));
ok('no second read of the same month', calls.length===2);

// Excel: three sheets through the library; CSV files when it cannot load
let wb=null,file='';XLSX={utils:{book_new:()=>({s:[]}),aoa_to_sheet:a=>({a}),book_append_sheet:(b,s,n)=>b.s.push([n,s.a])},writeFile:(b,f)=>{wb=b;file=f;}};window.XLSX=XLSX;
await sxExcel();
ok('Download Excel: one file, three sheets', file==='healthspan_sales_2026-05.xlsx'&&wb.s.map(x=>x[0]).join('|')==='By product|Order lines|Orders', file+' '+(wb&&wb.s.map(x=>x[0]).join('|')));
const bp=wb.s[0][1];ok('By product sheet: header, rows, grand total', bp[0].join('|')==='Product|SKU|Units|Sales PHP|Orders'&&bp[bp.length-1][0]==='Grand total'&&bp[bp.length-1][3]===245000);
ok('Order lines sheet carries customer, company, specialist and where each line counts', wb.s[1][1][0].join('|')==='Order|Date|Customer|Company|Specialist|Payment|Fulfilment|Internal|Line item|SKU|Qty|Unit price PHP|Sales PHP|Counted under SKU');
window.XLSX=undefined;XLSX=undefined;sxLoadXlsx=()=>Promise.reject(new Error('blocked'));const csv=[];downloadCSV=(n)=>csv.push(n);
await sxExcel();ok('no Excel library → the same three sheets as CSV files', csv.length===3&&/sales_2026-05_by_product/.test(csv[0]), csv.join(','));

ROLE='sales';SBPROFILE={name:'S',role:'sales',specialist_tag:'Lady',view_grants:['salesexport']};ok('a specialist cannot be given it', !viewAllowed('salesexport'));
ROLE='finance';SBPROFILE={name:'F',role:'finance'};ok('finance by role', viewAllowed('salesexport'));
ROLE='marketing';SBPROFILE={name:'K',role:'marketing'};ok('marketing not by default', !viewAllowed('salesexport'));
})().catch(e=>{window.__out=[[false,'crashed: '+(e&&e.stack||e),'']];}).finally(()=>{window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
(async()=>{const t0=Date.now();while(!w.__done&&Date.now()-t0<20000)await new Promise(r=>setTimeout(r,20));
  for(const [c,n,x] of (w.__out||[[false,'timed out','']]))ok(n,c,x);
  console.log('\n'+(fail?fail+' FAILED':'all passed'));process.exit(fail?1:0);})();
