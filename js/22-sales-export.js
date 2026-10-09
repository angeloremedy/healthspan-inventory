/* ── SALES EXPORT — one month of Shopify sales, by product and line by line (2026-10-08) ──
   Replaces a by-hand routine: export the month's orders from Shopify, move each order's
   subtotal onto a product, pivot "Sum of Subtotal by Lineitem name". Here: pick the month,
   HQ reads the orders from Shopify (netlify/functions/sales-export, 25 a page), and the page
   shows sales per product and every order line, with an Excel download (three sheets).
   Rules (the same as every HQ sales figure): cancelled, TEST and pull-out orders are left
   out; Remedy / Healthspan-internal orders follow the External only / Incl. Remedy switch;
   a deal or bundle line's pesos count under the product it bundles (TD040B → TD040), units
   come from the product's own lines; a package with no product of its own (PK0114) stays a
   line of its own. A line's sales = original total minus every discount allocated to it. */
let SX={ym:null,data:{},busy:false,err:'',view:'prod'};
const SX_XLSX='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const SX_XLSX_SRI='sha512-nPnkC29R0sikt0ieZaAkk28Ib7Y1Dz7IqePgELH30NnSi1DzG4x+envJAOHz8ZSAveLXAHTR3ai2E9DZUsT8pQ==';
function sxMonths(){const out=[];const [y,m]=monthISO().split('-').map(Number);for(let i=0;i<24;i++){const d=new Date(Date.UTC(y,m-1-i,1));out.push(d.toISOString().slice(0,7));}return out;}
function sxLbl(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1,1)).toLocaleDateString('en-PH',{month:'long',year:'numeric',timeZone:'UTC'});}
/* the base product a Shopify SKU counts under — the longest master SKU it starts with, else
   one it contains (deal SKUs like DLTD040184), else itself: the rule mergeShopify uses */
function sxBaseOf(skus){const set=new Set(skus),bases=[...set].sort((a,b)=>b.length-a.length);const memo={};
  return s=>{if(!s)return '';if(memo[s]!==undefined)return memo[s];
    return memo[s]=set.has(s)?s:(bases.find(b=>s.startsWith(b)&&s.length>b.length)||bases.find(b=>b.length>=4&&s.length>b.length&&s.includes(b))||s);};}
/* pure: orders (from the function) → products, lines, orders with a check, what was left out */
function sxBuild(orders,opt){
  opt=opt||{};const ext=opt.ext!==false;
  const data=opt.data||(typeof DATA!=='undefined'?DATA:[])||[];
  const nameOf={};data.forEach(p=>nameOf[p.sku]=p.name);
  const baseOf=sxBaseOf(data.map(p=>p.sku));
  const P={},L=[],O=[],skip={cancelled:0,internal:0,test:0};
  for(const o of (orders||[])){
    if(o.x){skip.cancelled++;continue;}
    if(o.test||o.pull){skip.test++;continue;}
    if(ext&&o.int){skip.internal++;continue;}
    let lineSum=0;
    for(const l of (o.ls||[])){
      const key=baseOf(l.sku)||('name:'+l.name);
      const own=!l.sku||key===l.sku;                       // the product's own line → units count
      const pr=P[key]||(P[key]={key,sku:l.sku&&key.indexOf('name:')!==0?key:'',name:'',alt:'',u:0,v:0,orders:new Set()});
      if(own&&!pr.name)pr.name=l.name;
      if(!pr.alt)pr.alt=l.name;
      if(own)pr.u+=l.q;
      pr.v+=l.amt;pr.orders.add(o.n);lineSum+=l.amt;
      L.push({n:o.n,dt:o.dt,c:o.c,co:o.co,t:o.t,fs:o.fs,ff:o.ff,int:!!o.int,sku:l.sku,name:l.name,q:l.q,p:l.p,amt:l.amt,key,uc:own?l.q:0});}
    O.push({n:o.n,dt:o.dt,c:o.c,co:o.co,t:o.t,fs:o.fs,ff:o.ff,int:!!o.int,lines:lineSum,sub:o.sub,diff:Math.round((lineSum-o.sub)*100)/100,disc:o.disc,ship:o.ship,tax:o.tax,tot:o.tot});}
  const products=Object.values(P).map(p=>({key:p.key,sku:p.sku,name:p.name||nameOf[p.key]||p.alt||p.key,u:p.u,v:p.v,orders:p.orders.size}))
    .sort((a,b)=>String(a.name).localeCompare(String(b.name),'en',{sensitivity:'base'}));
  const bad=O.filter(x=>Math.abs(x.diff)>1);
  return {products,lines:L,orders:O.sort((a,b)=>a.n<b.n?-1:1),skip,
    tot:{orders:O.length,lines:L.length,v:L.reduce((a,l)=>a+l.amt,0),u:products.reduce((a,p)=>a+p.u,0),sub:O.reduce((a,x)=>a+x.sub,0),tot:O.reduce((a,x)=>a+x.tot,0),bad}};}
async function sxFetch(ym,force){
  if(SX.busy)return;
  if(SX.data[ym]&&!force)return;
  SX.busy=true;SX.err='';
  const orders=[];let after=null,page=0;
  try{
    do{
      const st=$('sx-status');if(st)st.textContent='Reading '+sxLbl(ym)+' from Shopify… '+orders.length+' orders so far';
      const r=await fetch('/.netlify/functions/sales-export?ym='+encodeURIComponent(ym)+(after?'&after='+encodeURIComponent(after):''),{headers:await sbAuthHeaders()});
      const j=await r.json().catch(()=>({error:'HTTP '+r.status}));
      if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));
      orders.push(...(j.orders||[]));after=j.next||null;page++;
    }while(after&&page<60);
    SX.data[ym]={orders,at:new Date().toISOString()};
  }catch(e){SX.err=String(e.message||e);}
  SX.busy=false;
}
async function renderSalesExport(){
  if(!SX.ym)SX.ym=sxMonths()[1]; // the last complete month first
  const tab=(on,js,l)=>'<div class="tab'+(on?' active':'')+'" onclick="'+js+'">'+l+'</div>';
  const sel='style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;font-size:12px"';
  const bar='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+
    '<select id="sx-month" onchange="SX.ym=this.value;renderSalesExport()" '+sel.slice(0,-1)+';font-weight:600" aria-label="Month">'+sxMonths().map(m=>'<option value="'+m+'"'+(m===SX.ym?' selected':'')+'>'+sxLbl(m)+(m===monthISO()?' (to date)':'')+'</option>').join('')+'</select>'+
    '<div class="tabs" style="margin:0">'+tab(SEXT,'setSext(true);renderSalesExport()','External only')+tab(!SEXT,'setSext(false);renderSalesExport()','Incl. Remedy')+'</div>'+
    '<button class="btn" onclick="sxFetch(SX.ym,true).then(renderSalesExport)" title="Read the month from Shopify again">↻ Refresh from Shopify</button>'+
    '<button class="btn" id="sx-dl" onclick="sxExcel()" style="background:var(--ac);color:#fff;border-color:var(--ac);font-weight:600">⬇ Download Excel</button>'+
    '<span id="sx-status" class="mu" style="font-size:11.5px"></span></div>';
  const ym=SX.ym;
  if(!SX.data[ym]){
    $('content').innerHTML=bar+'<div class="empty" style="margin-top:30px">Reading '+esc(sxLbl(ym))+' from Shopify…</div>';
    await sxFetch(ym);
    if(currentView!=='salesexport'||SX.ym!==ym)return;
    if(!SX.data[ym]){$('content').innerHTML=bar+'<div class="viewdesc" style="border-left-color:var(--rd)"><div class="vd-t"><b>Could not read '+esc(sxLbl(ym))+' from Shopify.</b> '+esc(SX.err)+'</div></div>';return;}
  }
  const B=sxBuild(SX.data[ym].orders,{ext:SEXT&&true});
  const T=B.tot;
  const cards='<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Sales — '+esc(sxLbl(ym))+'</div><div class="met-val" style="font-size:15px">'+fmtPeso(T.v)+'</div><div class="met-sub">'+(SEXT?'external only':'incl. Remedy &amp; internal')+' · VAT-inclusive, as booked</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Orders</div><div class="met-val">'+T.orders.toLocaleString()+'</div><div class="met-sub">'+T.lines.toLocaleString()+' lines · '+B.products.length+' products</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Left out</div><div class="met-val">'+(B.skip.cancelled+B.skip.internal+B.skip.test)+'</div><div class="met-sub">'+B.skip.cancelled+' cancelled · '+B.skip.internal+' internal · '+B.skip.test+' test / pull-out</div><div class="met-bar"></div></div>'+
    '<div class="met '+(T.bad.length?'am':'gr')+'"><div class="met-lbl">Check vs Shopify</div><div class="met-val">'+(T.bad.length?T.bad.length+' to look at':'✓')+'</div><div class="met-sub">'+(T.bad.length?'orders whose lines differ from Shopify’s subtotal':'every order’s lines add up to Shopify’s subtotal')+'</div><div class="met-bar"></div></div>'+
    '</div>';
  const tabs='<div class="tabs" style="margin:0 0 10px">'+tab(SX.view==='prod',"SX.view='prod';renderSalesExport()",'By product')+tab(SX.view==='lines',"SX.view='lines';renderSalesExport()",'Order lines')+tab(SX.view==='orders',"SX.view='orders';renderSalesExport()",'Orders'+(T.bad.length?' ('+T.bad.length+' ⚠)':''))+'</div>';
  let tbl='';
  if(SX.view==='prod'){
    tbl='<div class="tcard"><div class="tscroll"><table id="sx-prod"><thead><tr><th>Product</th><th>SKU</th><th style="text-align:right">Units</th><th style="text-align:right">Sales</th><th style="text-align:right">Orders</th></tr></thead><tbody>'+
      (B.products.length?B.products.map(p=>'<tr><td style="font-weight:600;white-space:normal">'+esc(p.name)+'</td><td class="mu">'+esc(p.sku)+'</td><td class="r">'+p.u.toLocaleString()+'</td><td class="r" style="font-weight:600">'+fmtPeso(p.v)+'</td><td class="r mu">'+p.orders+'</td></tr>').join('')+
        '<tr style="background:var(--sf2)"><td style="font-weight:700">Grand total</td><td></td><td class="r" style="font-weight:700">'+T.u.toLocaleString()+'</td><td class="r" style="font-weight:700">'+fmtPeso(T.v)+'</td><td class="r" style="font-weight:700">'+T.orders+'</td></tr>'
       :'<tr><td colspan="5"><div class="empty">No sales in '+esc(sxLbl(ym))+'.</div></td></tr>')+
      '</tbody></table></div><div class="tfooter"><span>A deal or bundle line’s pesos count under the product it bundles; units come from the product’s own lines (deal +1s included) · packages with no product of their own stay a line of their own · cancelled, TEST and pull-out orders left out · '+(SEXT?'Remedy and Healthspan-internal orders left out (switch to Incl. Remedy to add them)':'Remedy and Healthspan-internal orders INCLUDED')+'</span></div></div>';
  }else if(SX.view==='lines'){
    tbl='<div class="tcard"><div class="tscroll"><table id="sx-lines"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Specialist</th><th>Line item</th><th>SKU</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Sales</th><th>Counted under</th></tr></thead><tbody>'+
      B.lines.map(l=>'<tr><td style="font-weight:600">'+esc(l.n)+'</td><td class="mu">'+esc(l.dt)+'</td><td style="white-space:normal">'+esc(l.co||l.c)+(l.int?' <span class="pill pgy">internal</span>':'')+'</td><td>'+esc(specDisplay(l.t)||'')+'</td><td style="white-space:normal">'+esc(l.name)+'</td><td class="mu">'+esc(l.sku)+'</td><td class="r">'+l.q+'</td><td class="r">'+fmtPeso(l.p)+'</td><td class="r" style="font-weight:600">'+fmtPeso(l.amt)+'</td><td class="mu">'+(l.key!==l.sku?esc(l.key):'')+'</td></tr>').join('')+
      '</tbody></table></div><div class="tfooter"><span>Every line of every counted order · Sales = the line’s price × quantity less every discount allocated to it · "Counted under" shows the product a deal line’s pesos go to</span></div></div>';
  }else{
    tbl='<div class="tcard"><div class="tscroll"><table id="sx-orders"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Specialist</th><th>Payment</th><th>Fulfilment</th><th style="text-align:right">Lines</th><th style="text-align:right">Shopify subtotal</th><th style="text-align:right">Difference</th><th style="text-align:right">Total</th></tr></thead><tbody>'+
      B.orders.map(x=>'<tr'+(Math.abs(x.diff)>1?' style="background:var(--am-bg)"':'')+'><td style="font-weight:600">'+esc(x.n)+'</td><td class="mu">'+esc(x.dt)+'</td><td style="white-space:normal">'+esc(x.co||x.c)+'</td><td>'+esc(specDisplay(x.t)||'')+'</td><td class="mu">'+esc(String(x.fs).toLowerCase().replace(/_/g,' '))+'</td><td class="mu">'+esc(String(x.ff).toLowerCase().replace(/_/g,' '))+'</td><td class="r">'+fmtPeso(x.lines)+'</td><td class="r">'+fmtPeso(x.sub)+'</td><td class="r"'+(Math.abs(x.diff)>1?' style="color:var(--am);font-weight:700"':'')+'>'+(Math.abs(x.diff)>1?fmtPeso(x.diff):'—')+'</td><td class="r">'+fmtPeso(x.tot)+'</td></tr>').join('')+
      '</tbody></table></div><div class="tfooter"><span>One row per counted order · a difference means the lines do not add up to Shopify’s own subtotal for that order (usually an edit or a refund) — open the order in Shopify to see why</span></div></div>';
  }
  const asOf=SX.data[ym].at?new Date(SX.data[ym].at).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  $('content').innerHTML=bar+cards+tabs+tbl;
  const st=$('sx-status');if(st)st.textContent=asOf?'read from Shopify '+asOf:'';
}
function sxLoadXlsx(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src=SX_XLSX;s.integrity=SX_XLSX_SRI;s.crossOrigin='anonymous';s.referrerPolicy='no-referrer';
    s.onload=()=>window.XLSX?res(window.XLSX):rej(new Error('Excel library did not load'));s.onerror=()=>rej(new Error('Excel library did not load'));document.head.appendChild(s);});}
/* the three sheets, as rows — the CSV fallback and the tests read the same thing */
function sxSheets(B,ym){
  const r2=v=>Math.round((v||0)*100)/100;
  return {
    'By product':[['Product','SKU','Units','Sales PHP','Orders']].concat(B.products.map(p=>[p.name,p.sku,p.u,r2(p.v),p.orders]),[['Grand total','',B.tot.u,r2(B.tot.v),B.tot.orders]]),
    'Order lines':[['Order','Date','Customer','Company','Specialist','Payment','Fulfilment','Internal','Line item','SKU','Qty','Unit price PHP','Sales PHP','Counted under SKU']].concat(
      B.lines.map(l=>[l.n,l.dt,l.c,l.co,l.t,l.fs,l.ff,l.int?'yes':'',l.name,l.sku,l.q,r2(l.p),r2(l.amt),l.key])),
    'Orders':[['Order','Date','Customer','Company','Specialist','Payment','Fulfilment','Internal','Lines PHP','Shopify subtotal PHP','Difference PHP','Discounts PHP','Shipping PHP','Tax PHP','Total PHP']].concat(
      B.orders.map(x=>[x.n,x.dt,x.c,x.co,x.t,x.fs,x.ff,x.int?'yes':'',r2(x.lines),r2(x.sub),r2(x.diff),r2(x.disc),r2(x.ship),r2(x.tax),r2(x.tot)]))};}
async function sxExcel(){
  const ym=SX.ym;if(!ym)return;
  if(!SX.data[ym]){await sxFetch(ym);if(!SX.data[ym]){uiAlert('Could not read '+sxLbl(ym)+' from Shopify: '+SX.err);return;}}
  const B=sxBuild(SX.data[ym].orders,{ext:SEXT&&true});const S=sxSheets(B,ym);
  const base='healthspan_sales_'+ym+(SEXT?'':'_incl_internal');
  try{
    const X=await sxLoadXlsx();const wb=X.utils.book_new();
    for(const name of Object.keys(S)){const ws=X.utils.aoa_to_sheet(S[name]);ws['!cols']=S[name][0].map((h,i)=>({wch:Math.min(48,Math.max(10,...S[name].slice(0,200).map(r=>String(r[i]==null?'':r[i]).length+2)))}));X.utils.book_append_sheet(wb,ws,name);}
    X.writeFile(wb,base+'.xlsx');
    try{audit('salesexport.download',{ym,ext:!!SEXT,orders:B.tot.orders});}catch(e){}
  }catch(e){ // no Excel library (offline, blocked): the same sheets as CSV files
    for(const name of Object.keys(S))downloadCSV(base.replace('healthspan_','')+'_'+name.toLowerCase().replace(/\s+/g,'_'),S[name][0],S[name].slice(1));
  }
}
