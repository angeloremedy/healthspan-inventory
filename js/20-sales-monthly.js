/* ── MONTHLY SALES BY SKU (Marj, 2026-09-28) ──
   One year across the page: Jan … Dec as columns, one row per SKU, SKUs grouped
   under their product line with a subtotal row, then the year total and the
   stock left now. Same numbers as Sales overview — booked on Shopify, base units
   (deal units and ₱0 giveaways included, as there), revenue = the SKU's own lines
   plus the deal revenue attributed to it, external-only / incl. Remedy by the one
   shared toggle. No costs anywhere on the page. */
let SMYEAR=null, SMSHOW='both', SMLINE='', SMQ='', SMHIDE=false;
const SMCOLL={};                          // product lines folded shut (this session only)
const SM_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// stock-only SKUs from these sheet categories are not merchandise — kept off unless they sold
const SM_NOSELL_RE=/sample|mkt|r\s*&\s*d|marketing/i;

function smYears(){
  const ys=new Set([monthISO().slice(0,4)]);
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
  const skus=new Set(Object.keys(SALESIDX||{}));
  (DATA||[]).forEach(p=>{const s=stk(p);if(s!=null&&s!==0&&!SM_NOSELL_RE.test(p.category||''))skus.add(p.sku);});
  const q=(SMQ||'').trim().toLowerCase();
  const L={};
  for(const sku of skus){
    const S=(SALESIDX||{})[sku], p=byData[sku];
    const name=(p&&p.name)||(S&&S.name)||sku;
    const line=(p&&p.line)||(S&&S.line)||'Unassigned';
    if(SMLINE&&line!==SMLINE)continue;
    if(q&&name.toLowerCase().indexOf(q)<0&&String(sku).toLowerCase().indexOf(q)<0)continue;
    const nm=S?netMonthly(S,''):{}, nb=S?netMonthly(S,'b'):{};
    const m=yms.map(ym=>({u:(nm[ym]&&nm[ym].u)||0,v:((nm[ym]&&nm[ym].v)||0)+((nb[ym]&&nb[ym].v)||0)}));
    const tu=m.reduce((a,c)=>a+c.u,0), tv=m.reduce((a,c)=>a+c.v,0);
    if(SMHIDE&&tu<=0&&Math.round(tv)===0)continue;
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
  return {year,yms,from:smFrom(),now:monthISO(),lines,tot};}

function smCell(c,ym,D,strong){
  if(ym>D.now)return '<td class="r" style="color:var(--tx3)"></td>';                         // not yet
  if(D.from&&ym<D.from)return '<td class="r" style="color:var(--tx3)" title="before HQ’s Shopify history">n/a</td>';
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
  const toolbar='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+
    '<select onchange="SMYEAR=this.value;renderSalesMonthly()" '+sel+' aria-label="Year">'+years.map(y=>'<option'+(y===SMYEAR?' selected':'')+'>'+y+'</option>').join('')+'</select>'+
    '<div class="tabs" style="margin:0">'+tab(SMSHOW==='both',"SMSHOW='both';renderSalesMonthly()",'Units &amp; ₱')+tab(SMSHOW==='units',"SMSHOW='units';renderSalesMonthly()",'Units')+tab(SMSHOW==='rev',"SMSHOW='rev';renderSalesMonthly()",'Revenue')+'</div>'+
    '<select onchange="SMLINE=this.value;renderSalesMonthly()" '+sel+' aria-label="Product line"><option value="">All product lines</option>'+
      lines.map(l=>'<option value="'+esc(l)+'"'+(SMLINE===l?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+
    (hasIntSplit()
      ? '<div class="tabs" style="margin:0" title="Remedy is a sister company and a customer; Healthspan also sells to its own staff and academy. Accounting excludes both.">'+
        tab(SEXT,'setSext(true);renderSalesMonthly()','External only')+tab(!SEXT,'setSext(false);renderSalesMonthly()','Incl. Remedy')+'</div>'
      : '<span style="font-size:11px;color:var(--am)">Incl. Remedy &amp; internal — the sales cache is rebuilding with the split now</span>')+
    '<input id="sm-q" type="search" placeholder="Find a SKU or product" value="'+esc(SMQ)+'" oninput="SMQ=this.value;clearTimeout(window._smT);window._smT=setTimeout(()=>{renderSalesMonthly();const i=$(\'sm-q\');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},250)" '+sel.slice(0,-1)+';min-width:190px">'+
    '<label style="font-size:12px;color:var(--tx2);display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox"'+(SMHIDE?' checked':'')+' onchange="SMHIDE=this.checked;renderSalesMonthly()">Hide SKUs with no sales this year</label>'+
    '<button class="btn" onclick="smAll(true)" style="font-size:11.5px">Expand all</button><button class="btn" onclick="smAll(false)" style="font-size:11.5px">Collapse all</button>'+
    '</div>';
  // headline cards: the year so far
  let best=-1;D.tot.m.forEach((c,i)=>{if(D.yms[i]<=D.now&&(best<0||c.v>D.tot.m[best].v))best=i;});
  const sold=D.lines.reduce((a,g)=>a+g.skus.filter(r=>r.tu>0).length,0);
  const ytd=SMYEAR===D.now.slice(0,4);
  const cards='<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Revenue '+(ytd?'year to date':SMYEAR)+'</div><div class="met-val" style="font-size:15px">'+fmtPeso(D.tot.tv)+'</div><div class="met-sub">booked on Shopify · '+sextLbl()+'</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Units sold</div><div class="met-val">'+D.tot.tu.toLocaleString()+'</div><div class="met-sub">'+sold.toLocaleString()+' SKUs sold at least once</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Best month</div><div class="met-val">'+(best>=0&&D.tot.m[best].v>0?SM_MON[best]:'—')+'</div><div class="met-sub">'+(best>=0&&D.tot.m[best].v>0?fmtPeso(D.tot.m[best].v)+' · '+D.tot.m[best].u.toLocaleString()+' u':'no sales yet')+'</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Stock now</div><div class="met-val">'+D.tot.stk.toLocaleString()+'</div><div class="met-sub">units on hand across the SKUs shown</div><div class="met-bar"></div></div>'+
    '</div>';
  // the grid: product column pinned on the left so the months scroll under it
  const pin='background:var(--sf);min-width:210px;max-width:260px;overflow:hidden;text-overflow:ellipsis';
  const head='<tr><th class="sm-l" style="'+pin+';z-index:2;background:var(--sf2)">Product line / SKU</th>'+
    D.yms.map((ym,i)=>'<th style="text-align:right">'+SM_MON[i]+(ym===D.now?' <span style="text-transform:none;font-weight:500">(to date)</span>':'')+'</th>').join('')+
    '<th class="sm-r1" style="text-align:right;'+SM_PR1+'z-index:2;background:var(--sf2)">'+(ytd?'Year to date':'Year total')+'</th><th style="text-align:right;'+SM_PR2+'z-index:2;background:var(--sf2)">Stock now</th></tr>';
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
  else body='<tr><td colspan="15"><div class="empty">No SKUs match'+(SMQ?' “'+esc(SMQ)+'”':'')+(SMLINE?' in '+esc(SMLINE):'')+'</div></td></tr>';
  const fromNote=D.from&&D.from.slice(0,4)===SMYEAR&&D.from>SMYEAR+'-01'?' · months before '+SM_MON[+D.from.slice(5,7)-1]+' '+SMYEAR+' show n/a — HQ’s Shopify history starts there':'';
  $('content').innerHTML=SM_CSS+toolbar+cards+
    '<div class="tcard"><div class="tscroll"><table id="sm-grid" style="min-width:'+(SMSHOW==='units'?1000:1300)+'px"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'+
    '<div class="tfooter"><span>Booked sales from Shopify (specialists’ POS), the same figures as Sales overview · units include deal units (+1s) and ₱0 giveaways · revenue includes the deal revenue on each product · '+
    (SEXT&&hasIntSplit()?'EXTERNAL ONLY — Remedy branches and Healthspan staff/academy orders excluded, matching accounting':'INCLUDES internal orders (Remedy branches, staff, academy)')+
    ' · stock now = on hand today (not at each month’s end) · SKUs with stock but no sales are listed too, except samples, marketing and R&amp;D items · click a line to fold it, a SKU to see its orders · Export gives every SKU with units and ₱ per month'+fromNote+'</span></div></div>';
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
  downloadCSV('monthly_sales_by_sku_'+D.year+(SEXT&&hasIntSplit()?'_external':'_incl_internal'),hdr,rows);
}
