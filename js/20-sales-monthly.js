/* ── MONTHLY SALES BY SKU (Marj, 2026-09-28) ──
   One year across the page: Jan … Dec as columns, one row per SKU, SKUs grouped
   under their product line with a subtotal row, then the year total and the
   stock left now. Same numbers as Sales overview — booked on Shopify, base units
   (deal units and ₱0 giveaways included, as there), revenue = the SKU's own lines
   plus the deal revenue attributed to it, external-only / incl. Remedy by the one
   shared toggle. No costs anywhere on the page.
   Specialist mode (2026-10-08, asked for by a specialist filling her bi-monthly
   report): the same grid for ONE specialist's orders, built from the per-order
   index (ORDIDX: base SKU → orders with tag, date, units, pesos). A specialist
   lands on her own sales; managers pick anyone or the whole company. */
let SMYEAR=null, SMSHOW='both', SMLINE='', SMQ='', SMHIDE=false, SMSPEC=null;
const SMCOLL={};                          // product lines folded shut (this session only)
const SM_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// stock-only SKUs from these sheet categories are not merchandise — kept off unless they sold
const SM_NOSELL_RE=/sample|mkt|r\s*&\s*d|marketing/i;

/* the specialist this browser belongs to (a product specialist's own tag), '' otherwise */
function smMyTag(){return (typeof ROLE!=='undefined'&&ROLE==='sales'&&typeof SBPROFILE!=='undefined'&&SBPROFILE&&SBPROFILE.specialist_tag)?specCanon(SBPROFILE.specialist_tag):'';}
/* first call decides the default: a specialist starts on her own sales, everyone else on the company */
function smSpecCur(){if(SMSPEC===null)SMSPEC=smMyTag();return SMSPEC;}
function smSpecList(){
  const seen={},out=[];const add=t=>{const c=specCanon(t);if(!c||INTERNAL_TAG.test(c))return;const k=c.toLowerCase();if(seen[k])return;seen[k]=1;out.push(c);};
  try{for(const r of (SPEC_DIR||[]))if(r&&r.tag&&r.active!==false&&!/\btest\b|dummy|sample/i.test(String(r.tag)))add(r.tag);}catch(e){}
  try{for(const n in specMerged())add(n);}catch(e){}
  try{for(const o of ((SHOPIFY&&SHOPIFY.recent)||[]))if(o&&o.t)add(o.t);}catch(e){}
  return out.sort((a,b)=>specDisplay(a).localeCompare(specDisplay(b)));}
/* One specialist's sales per base SKU per month, from the per-order index.
   ext: leave out Remedy / Healthspan-internal orders. → {base:{ym:{u,v}}} */
function smSpecIdx(spec,ext){
  const want=specCanon(spec).toLowerCase(),by={};if(!want)return by;
  for(const base in (ORDIDX||{}))for(const o of ORDIDX[base]){
    if(!o||!o.dt||specCanon(o.t||'').toLowerCase()!==want)continue;
    if(ext&&ordInternal(o))continue;
    const ym=o.dt.slice(0,7),B=by[base]||(by[base]={}),c=B[ym]||(B[ym]={u:0,v:0});c.u+=(+o.q||0);c.v+=(+o.a||0);}
  return by;}
/* the first COMPLETE month the per-order index holds (it starts mid-month when it reaches back 180 days) */
function smSpecFrom(){const f=String((SHOPIFY&&SHOPIFY.recentFrom)||'').slice(0,10);if(!f)return '';
  if(f.slice(8,10)==='01')return f.slice(0,7);const d=new Date(Date.UTC(+f.slice(0,4),+f.slice(5,7),1));return d.toISOString().slice(0,7);}
/* What one specialist sold in one month, product by product — the specialist page and
   the business review read this. ext defaults to external only (a target never counts internal). */
function specProducts(spec,ym,ext){
  const idx=smSpecIdx(spec,ext!==false),byData={};(DATA||[]).forEach(p=>byData[p.sku]=p);
  const rows=[];
  for(const sku in idx){const c=idx[sku][ym];if(!c||(!c.u&&!Math.round(c.v)))continue;const p=byData[sku],S=(SALESIDX||{})[sku];
    rows.push({sku,name:(p&&p.name)||(S&&S.name)||sku,line:(p&&p.line)||(S&&S.line)||'Unassigned',u:c.u,v:c.v});}
  rows.sort((a,b)=>(b.v-a.v)||(b.u-a.u)||String(a.name).localeCompare(String(b.name)));
  const from=smSpecFrom();
  return {rows,tot:rows.reduce((a,r)=>({u:a.u+r.u,v:a.v+r.v}),{u:0,v:0}),complete:!from||ym>=from,from};}
function smYears(){
  const ys=new Set([monthISO().slice(0,4)]);
  if(smSpecCur()){const f=smSpecFrom();if(f)ys.add(f.slice(0,4));return [...ys].sort().reverse();}
  for(const k in (SALESIDX||{})){const S=SALESIDX[k];
    for(const src of ['monthly','bmonthly'])for(const ym in (S[src]||{}))ys.add(ym.slice(0,4));}
  return [...ys].sort().reverse();}
/* the first month HQ holds Shopify history for — earlier months of a year are "no data", not zero */
function smFrom(){
  let min='';
  for(const k in (SALESIDX||{})){const S=SALESIDX[k];
    for(const src of ['monthly','bmonthly'])for(const ym in (S[src]||{}))if(!min||ym<min)min=ym;}
  return min;}
/* The whole grid as data, so the page and the CSV cannot disagree.
   → {year, yms, from, now, lines:[{line, skus:[row], m:[{u,v}×12], tu, tv, stk}], tot} */
function smData(year){
  const yms=SM_MON.map((_,i)=>year+'-'+String(i+1).padStart(2,'0'));
  const byData={};(DATA||[]).forEach(p=>byData[p.sku]=p);
  const spec=smSpecCur();
  const sidx=spec?smSpecIdx(spec,SEXT&&hasIntSplit()):null;
  // a specialist's grid lists what she sold; the company grid also lists unsold stock
  const skus=new Set(Object.keys(sidx||SALESIDX||{}));
  if(!spec)(DATA||[]).forEach(p=>{const s=stk(p);if(s!=null&&s!==0&&!SM_NOSELL_RE.test(p.category||''))skus.add(p.sku);});
  const q=(SMQ||'').trim().toLowerCase();
  const L={};
  for(const sku of skus){
    const S=(SALESIDX||{})[sku], p=byData[sku];
    const name=(p&&p.name)||(S&&S.name)||sku;
    const line=(p&&p.line)||(S&&S.line)||'Unassigned';
    if(SMLINE&&line!==SMLINE)continue;
    if(q&&name.toLowerCase().indexOf(q)<0&&String(sku).toLowerCase().indexOf(q)<0)continue;
    let m;
    if(sidx){const B=sidx[sku]||{};m=yms.map(ym=>({u:(B[ym]&&B[ym].u)||0,v:(B[ym]&&B[ym].v)||0}));}
    else{const nm=S?netMonthly(S,''):{}, nb=S?netMonthly(S,'b'):{};
      m=yms.map(ym=>({u:(nm[ym]&&nm[ym].u)||0,v:((nm[ym]&&nm[ym].v)||0)+((nb[ym]&&nb[ym].v)||0)}));}
    const tu=m.reduce((a,c)=>a+c.u,0), tv=m.reduce((a,c)=>a+c.v,0);
    if((SMHIDE||sidx)&&tu<=0&&Math.round(tv)===0)continue;
    const s=p?stk(p):null;
    const g=L[line]||(L[line]={line,skus:[],m:yms.map(()=>({u:0,v:0})),tu:0,tv:0,stk:0,hasStk:false});
    g.skus.push({sku,name,line,m,tu,tv,stk:s,pseudo:!!(S&&S.pseudo)});
    m.forEach((c,i)=>{g.m[i].u+=c.u;g.m[i].v+=c.v;});g.tu+=tu;g.tv+=tv;
    if(s!=null){g.stk+=s;g.hasStk=true;}
  }
  const lines=Object.values(L);
  lines.forEach(g=>g.skus.sort((a,b)=>(b.tv-a.tv)||(b.tu-a.tu)||String(a.name).localeCompare(String(b.name))));
  lines.sort((a,b)=>(b.tv-a.tv)||(b.tu-a.tu)||a.line.localeCompare(b.line));
  const tot={m:yms.map(()=>({u:0,v:0})),tu:0,tv:0,stk:0,n:0};
  lines.forEach(g=>{g.m.forEach((c,i)=>{tot.m[i].u+=c.u;tot.m[i].v+=c.v;});tot.tu+=g.tu;tot.tv+=g.tv;tot.stk+=g.stk;tot.n+=g.skus.length;});
  return {year,yms,from:spec?smSpecFrom():smFrom(),now:monthISO(),lines,tot,spec};}

function smCell(c,ym,D,strong){
  if(ym>D.now)return '<td class="r" style="color:var(--tx3)"></td>';                         // not yet
  if(D.from&&ym<D.from)return '<td class="r" style="color:var(--tx3)" title="'+(D.spec?'before HQ’s per-order history':'before HQ’s Shopify history')+'">n/a</td>';
  const w=strong?'font-weight:700;':'';
  if(!c.u&&!Math.round(c.v))return '<td class="r mu">—</td>';
  if(SMSHOW==='units')return '<td class="r" style="'+w+'">'+c.u.toLocaleString()+'</td>';
  if(SMSHOW==='rev')return '<td class="r" style="'+w+'">'+fmtPeso(c.v)+'</td>';
  return '<td class="r" style="'+w+'line-height:1.25">'+c.u.toLocaleString()+' u<div style="font-size:10.5px;color:var(--tx2);font-weight:'+(strong?'600':'400')+'">'+fmtPeso(c.v)+'</div></td>';}
/* the year total and the stock sit pinned on the right, so they never scroll out of sight */
const SM_PR1='min-width:112px;width:112px;';
const SM_PR2='min-width:84px;width:84px;';
function smTotCell(tu,tv,strong){
  const w=SM_PR1+'background:'+(strong?'var(--sf2)':'var(--sf)')+';font-weight:'+(strong?'700':'600')+';';
  if(SMSHOW==='units')return '<td class="r sm-r1" style="'+w+'">'+tu.toLocaleString()+'</td>';
  if(SMSHOW==='rev')return '<td class="r sm-r1" style="'+w+'">'+fmtPeso(tv)+'</td>';
  return '<td class="r sm-r1" style="'+w+'line-height:1.25">'+tu.toLocaleString()+' u<div style="font-size:10.5px;color:var(--tx2)">'+fmtPeso(tv)+'</div></td>';}
function smStkCell(s,strong){
  const b=SM_PR2+'background:'+(strong?'var(--sf2)':'var(--sf)')+';';
  if(s==null)return '<td class="r mu sm-r2" style="'+b+'">—</td>';
  return '<td class="r sm-r2" style="'+b+(strong?'font-weight:700;':'font-weight:600;')+(s<0?'color:var(--rd)':s===0?'color:var(--am)':'')+'">'+s.toLocaleString()+'</td>';}
/* pinned columns: the product on the left always; the year total and stock on the right
   only where there is room for both pins and some months between them */
const SM_CSS='<style>#sm-grid .sm-l{position:sticky;left:0;z-index:1}'+
  '@media(min-width:900px){#sm-grid .sm-r1{position:sticky;right:84px;z-index:1;box-shadow:-1px 0 0 var(--bd)}#sm-grid .sm-r2{position:sticky;right:0;z-index:1}}'+
  '@media(max-width:600px){#sm-grid .sm-l{min-width:136px!important;max-width:150px!important;white-space:normal}}</style>';
function smToggle(line){SMCOLL[line]=!SMCOLL[line];renderSalesMonthly();}
function smAll(open){const D=smData(SMYEAR||monthISO().slice(0,4));D.lines.forEach(g=>{SMCOLL[g.line]=!open;});renderSalesMonthly();}

function renderSalesMonthly(){
  if(!salesGuard())return;
  const years=smYears();
  if(!SMYEAR||years.indexOf(SMYEAR)<0)SMYEAR=monthISO().slice(0,4);
  const D=smData(SMYEAR);
  const lines=salesLines();
  const sel='style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;font-size:12px"';
  const tab=(on,js,l)=>'<div class="tab'+(on?' active':'')+'" onclick="'+js+'">'+l+'</div>';
  const spec=D.spec, mine=smMyTag();
  const specOpts=ROLE==='sales'
    ? (mine?[[mine,'My sales — '+specDisplay(mine)],['','Whole company']]:[['','Whole company']])
    : [['','Whole company']].concat(smSpecList().map(t=>[t,specDisplay(t)]));
  if(spec&&!specOpts.some(o=>o[0]===spec))specOpts.push([spec,specDisplay(spec)]);
  const toolbar='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+
    (specOpts.length>1?'<select id="sm-spec" onchange="SMSPEC=this.value;renderSalesMonthly()" '+sel.slice(0,-1)+';font-weight:600" aria-label="Whose sales">'+
      specOpts.map(o=>'<option value="'+esc(o[0])+'"'+(o[0]===spec?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>':'')+
    '<select onchange="SMYEAR=this.value;renderSalesMonthly()" '+sel+' aria-label="Year">'+years.map(y=>'<option'+(y===SMYEAR?' selected':'')+'>'+y+'</option>').join('')+'</select>'+
    '<div class="tabs" style="margin:0">'+tab(SMSHOW==='both',"SMSHOW='both';renderSalesMonthly()",'Units &amp; ₱')+tab(SMSHOW==='units',"SMSHOW='units';renderSalesMonthly()",'Units')+tab(SMSHOW==='rev',"SMSHOW='rev';renderSalesMonthly()",'Revenue')+'</div>'+
    '<select onchange="SMLINE=this.value;renderSalesMonthly()" '+sel+' aria-label="Product line"><option value="">All product lines</option>'+
      lines.map(l=>'<option value="'+esc(l)+'"'+(SMLINE===l?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+
    (hasIntSplit()
      ? '<div class="tabs" style="margin:0" title="Remedy is a sister company and a customer; Healthspan also sells to its own staff and academy. Accounting excludes both.">'+
        tab(SEXT,'setSext(true);renderSalesMonthly()','External only')+tab(!SEXT,'setSext(false);renderSalesMonthly()','Incl. Remedy')+'</div>'
      : '<span style="font-size:11px;color:var(--am)">Incl. Remedy &amp; internal — the sales cache is rebuilding with the split now</span>')+
    '<input id="sm-q" type="search" placeholder="Find a SKU or product" value="'+esc(SMQ)+'" oninput="SMQ=this.value;clearTimeout(window._smT);window._smT=setTimeout(()=>{renderSalesMonthly();const i=$(\'sm-q\');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},250)" '+sel.slice(0,-1)+';min-width:190px">'+
    (spec?'':'<label style="font-size:12px;color:var(--tx2);display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox"'+(SMHIDE?' checked':'')+' onchange="SMHIDE=this.checked;renderSalesMonthly()">Hide SKUs with no sales this year</label>')+
    '<button class="btn" onclick="smAll(true)" style="font-size:11.5px">Expand all</button><button class="btn" onclick="smAll(false)" style="font-size:11.5px">Collapse all</button>'+
    '</div>';
  // headline cards: the year so far
  let best=-1;D.tot.m.forEach((c,i)=>{if(D.yms[i]<=D.now&&(best<0||c.v>D.tot.m[best].v))best=i;});
  const sold=D.lines.reduce((a,g)=>a+g.skus.filter(r=>r.tu>0).length,0);
  const ytd=SMYEAR===D.now.slice(0,4);
  const cards='<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Revenue '+(ytd?'year to date':SMYEAR)+'</div><div class="met-val" style="font-size:15px">'+fmtPeso(D.tot.tv)+'</div><div class="met-sub">'+(spec?esc(specDisplay(spec))+'’s orders':'booked on Shopify')+' · '+sextLbl()+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Units sold</div><div class="met-val">'+D.tot.tu.toLocaleString()+'</div><div class="met-sub">'+sold.toLocaleString()+' SKUs sold at least once</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Best month</div><div class="met-val">'+(best>=0&&D.tot.m[best].v>0?SM_MON[best]:'—')+'</div><div class="met-sub">'+(best>=0&&D.tot.m[best].v>0?fmtPeso(D.tot.m[best].v)+' · '+D.tot.m[best].u.toLocaleString()+' u':'no sales yet')+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Stock now</div><div class="met-val">'+D.tot.stk.toLocaleString()+'</div><div class="met-sub">units on hand across the SKUs shown</div><div class="met-bar"></div></div>'+
    '</div>';
  // the grid: product column pinned on the left so the months scroll under it
  const pin='background:var(--sf);min-width:210px;max-width:260px;overflow:hidden;text-overflow:ellipsis';
  const head='<tr><th class="sm-l" style="'+pin+';z-index:2;background:var(--sf2)">Product line / SKU</th>'+
    D.yms.map((ym,i)=>'<th style="text-align:right">'+SM_MON[i]+(ym===D.now?' <span style="text-transform:none;font-weight:500">(to date)</span>':'')+'</th>').join('')+
    '<th class="sm-r1" style="text-align:right;'+SM_PR1+'z-index:2;background:var(--sf2)">'+(ytd?'Year to date':'Year total')+'</th><th class="sm-r2" style="text-align:right;'+SM_PR2+'z-index:2;background:var(--sf2)">Stock now</th></tr>';
  let body='';
  for(const g of D.lines){
    const shut=!!SMCOLL[g.line];
    body+='<tr onclick="smToggle(\''+jsq(g.line)+'\')" style="cursor:pointer;background:var(--sf2)">'+
      '<td class="sm-l" style="'+pin+';background:var(--sf2);font-weight:700">'+(shut?'▸':'▾')+' '+esc(g.line)+' <span class="mu" style="font-weight:500;font-size:11px">· '+g.skus.length+' SKU'+(g.skus.length===1?'':'s')+'</span></td>'+
      g.m.map((c,i)=>smCell(c,D.yms[i],D,true)).join('')+smTotCell(g.tu,g.tv,true)+smStkCell(g.hasStk?g.stk:null,true)+'</tr>';
    if(shut)continue;
    for(const r of g.skus){
      body+='<tr onclick="openSalesDrawer(\''+jsq(r.sku)+'\')" style="cursor:pointer">'+
        '<td class="sm-l" style="'+pin+';padding-left:22px" title="'+esc(r.name)+'"><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</div><div class="mu" style="font-size:10.5px">'+esc(r.sku)+(r.pseudo?' · Shopify-only package':'')+'</div></td>'+
        r.m.map((c,i)=>smCell(c,D.yms[i],D,false)).join('')+smTotCell(r.tu,r.tv,false)+smStkCell(r.stk,false)+'</tr>';
    }
  }
  if(D.lines.length)body+='<tr style="background:var(--sf2);border-top:2px solid var(--bd)"><td class="sm-l" style="'+pin+';background:var(--sf2);font-weight:700">'+(SMLINE?esc(SMLINE)+' — total':'All product lines')+'</td>'+
    D.tot.m.map((c,i)=>smCell(c,D.yms[i],D,true)).join('')+smTotCell(D.tot.tu,D.tot.tv,true)+smStkCell(D.tot.stk,true)+'</tr>';
  else body='<tr><td colspan="15"><div class="empty">'+(spec&&!SMQ&&!SMLINE?'No sales booked under '+esc(specDisplay(spec))+' in '+esc(SMYEAR)+' yet':'No SKUs match'+(SMQ?' “'+esc(SMQ)+'”':'')+(SMLINE?' in '+esc(SMLINE):''))+'</div></td></tr>';
  const fromNote=D.from&&D.from.slice(0,4)===SMYEAR&&D.from>SMYEAR+'-01'?' · months before '+SM_MON[+D.from.slice(5,7)-1]+' '+SMYEAR+' show n/a — '+(spec?'HQ’s per-order history':'HQ’s Shopify history')+' starts there':
    (D.from&&D.from.slice(0,4)>SMYEAR?' · HQ holds no '+(spec?'per-order':'Shopify')+' history for '+esc(SMYEAR):'');
  const capped=spec&&SHOPIFY&&SHOPIFY.recent&&SHOPIFY.recent.length>=((SHOPIFY.recentCap)||2500);
  $('content').innerHTML=SM_CSS+toolbar+cards+
    '<div class="tcard"><div class="tscroll"><table id="sm-grid" style="min-width:'+(SMSHOW==='units'?1000:1300)+'px"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'+
    '<div class="tfooter"><span>'+(spec?'<b>'+esc(specDisplay(spec))+'</b> — orders tagged to '+esc(spec)+' in Shopify (the specialists’ POS), product by product: units on the product’s own lines, pesos including its deal lines'+(capped?' · <b>the order index is at its size cap — the oldest months may be short</b>':'')+' · ':
      'Booked sales from Shopify (specialists’ POS), the same figures as Sales overview · ')+'units include deal units (+1s) and ₱0 giveaways · revenue includes the deal revenue on each product · '+
    (SEXT&&hasIntSplit()?'EXTERNAL ONLY — Remedy branches and Healthspan staff/academy orders excluded, matching accounting':'INCLUDES internal orders (Remedy branches, staff, academy)')+
    ' · stock now = company on-hand today (not at each month’s end)'+(spec?' · only products sold this year are listed':' · SKUs with stock but no sales are listed too, except samples, marketing and R&amp;D items')+' · click a line to fold it, a SKU to see its orders · Export gives every SKU with units and ₱ per month'+fromNote+'</span></div></div>';
}

function exportSalesMonthly(){
  if(!SALESIDX)return;
  const D=smData(SMYEAR||monthISO().slice(0,4));
  const hdr=['Product line','SKU','Product'];
  SM_MON.forEach(m=>{hdr.push(m+' '+D.year+' units');hdr.push(m+' '+D.year+' PHP');});
  hdr.push('Year units','Year PHP','Stock now');
  const cells=m=>{const o=[];m.forEach((c,i)=>{const na=D.yms[i]>D.now||(D.from&&D.yms[i]<D.from);o.push(na?'':c.u);o.push(na?'':Math.round(c.v));});return o;};
  const rows=[];
  for(const g of D.lines){
    for(const r of g.skus)rows.push([g.line,r.sku,r.name].concat(cells(r.m),[r.tu,Math.round(r.tv),r.stk==null?'':r.stk]));
    rows.push([g.line,'','Line total'].concat(cells(g.m),[g.tu,Math.round(g.tv),g.hasStk?g.stk:'']));
  }
  rows.push(['All product lines','','Grand total'].concat(cells(D.tot.m),[D.tot.tu,Math.round(D.tot.tv),D.tot.stk]));
  downloadCSV('monthly_sales_by_sku_'+D.year+(D.spec?'_'+String(specDisplay(D.spec)).replace(/[^A-Za-z0-9]+/g,'_'):'')+(SEXT&&hasIntSplit()?'_external':'_incl_internal'),hdr,rows);
}
