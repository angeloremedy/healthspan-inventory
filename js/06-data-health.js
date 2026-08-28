/* ── DATA HEALTH ── */
function renderDataHealth(){
  const active=DATA.filter(p=>{const s=stk(p);return (s!==null&&s>0)||p.sold>0;});
  const n=active.length||1;
  const missPrice=active.filter(p=>!(p.price>0));
  const missExp=active.filter(p=>stk(p)>0&&!p.expiry);
  const missBatch=active.filter(p=>stk(p)>0&&!p.batch);
  const missBin=active.filter(p=>stk(p)>0&&!p.bin);
  const negStk=DATA.filter(p=>{const s=stk(p);return s!==null&&s<0;});
  const lowHist=DATA.filter(p=>p.demandClass==='insufficient'&&p.sold>0);
  const batchSet=new Set((BATCHES||[]).filter(b=>b.soh>0).map(b=>b.skuCode));
  const noShelf=active.filter(p=>stk(p)>0&&p.expiry&&!batchSet.has(p.sku));
  const maxYr=new Date().getFullYear()+10;
  const oddExp=active.filter(p=>{const m=String(p.expiry||'').match(/\d{4}/g);if(!m)return false;return Math.max(...m.map(Number))>maxYr;});
  const priceMis=active.filter(p=>p.priceSrc==='shopify'&&p.priceSheet>0&&Math.abs(p.priceSheet-p.price)>1);
  const stockMis=active.filter(p=>p.shopifyInv!=null&&stk(p)!=null&&p.shopifyInv!==stk(p));
  const score=Math.round(((n-missPrice.length)/n+(n-missExp.length)/n+(n-missBatch.length)/n+(n-missBin.length)/n)/4*100);
  const scoreC=score>=90?'gr':score>=75?'am':'rd';
  const issues={};
  const add=(p,tag)=>{const k=p.sku;(issues[k]=issues[k]||{p,tags:[]}).tags.push(tag);};
  missPrice.forEach(p=>add(p,'price')); missExp.forEach(p=>add(p,'expiry')); missBatch.forEach(p=>add(p,'batch')); missBin.forEach(p=>add(p,'bin')); negStk.forEach(p=>add(p,'neg')); lowHist.forEach(p=>add(p,'hist')); noShelf.forEach(p=>add(p,'shelf')); oddExp.forEach(p=>add(p,'oddexp')); priceMis.forEach(p=>add(p,'pricemis')); stockMis.forEach(p=>add(p,'stockmis'));
  const f=window._healthFilter||'all';
  let list=Object.values(issues);
  if(f!=='all')list=list.filter(x=>x.tags.includes(f));
  list.sort((a,b)=>b.tags.length-a.tags.length||String(a.p.name).localeCompare(String(b.p.name)));
  const tags=[['all','All ('+Object.keys(issues).length+')'],['price','No price ('+missPrice.length+')'],['expiry','No expiry ('+missExp.length+')'],['batch','No batch ('+missBatch.length+')'],['neg','Negative ('+negStk.length+')'],['hist','Low history ('+lowHist.length+')'],['shelf','No shelf-life rec ('+noShelf.length+')'],['oddexp','Odd expiry ('+oddExp.length+')'],['pricemis','Price ≠ Shopify ('+priceMis.length+')'],['stockmis','Stock ≠ Shopify ('+stockMis.length+')']];
  const tagPill={price:'<span class="pill prd">No price</span>',expiry:'<span class="pill pam">No expiry</span>',batch:'<span class="pill pgy">No batch</span>',bin:'<span class="pill pgy">No bin</span>',neg:'<span class="pill prd">Negative stock</span>',hist:'<span class="pill pbl">Low history</span>',shelf:'<span class="pill pam">No shelf-life rec</span>',oddexp:'<span class="pill prd">Odd expiry</span>',pricemis:'<span class="pill pam">Sheet price ≠ Shopify</span>',stockmis:'<span class="pill pbl">Stock ≠ Shopify count</span>'};
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met '+scoreC+'"><div class="met-lbl">Data health score</div><div class="met-val">'+score+'%</div><div class="met-sub">completeness of active SKUs</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Missing price</div><div class="met-val">'+missPrice.length+'</div><div class="met-sub">'+Math.round(missPrice.length/n*100)+'% of active SKUs</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Missing expiry</div><div class="met-val">'+missExp.length+'</div><div class="met-sub">in-stock SKUs, no date</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Other flags</div><div class="met-val">'+(negStk.length+lowHist.length)+'</div><div class="met-sub">'+negStk.length+' negative · '+lowHist.length+' low history</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tabs" style="margin-bottom:12px">'+tags.map(([k,l])=>'<div class="tab'+(f===k?' active':'')+'" onclick="window._healthFilter=\''+k+'\';renderDataHealth()">'+l+'</div>').join('')+'</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>SKU</th><th>Product</th><th>Line</th><th style="text-align:right">Stock</th><th style="text-align:right">Price</th><th>Data issues</th></tr></thead><tbody>'+
    (list.length?list.slice(0,400).map(x=>{const p=x.p,s=stk(p);
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')" style="cursor:pointer"><td class="mo">'+esc(p.sku)+'</td>'+
      '<td style="max-width:210px;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</td>'+
      '<td class="mu" style="max-width:100px;overflow:hidden;text-overflow:ellipsis">'+esc(p.line||'')+'</td>'+
      '<td class="r stk" style="'+(s!=null&&s<0?'color:var(--rd)':'')+'">'+(s!=null?s.toLocaleString():'—')+'</td>'+
      '<td class="r mu" style="font-size:11px">'+fmtP(p.price)+'</td>'+
      '<td style="display:flex;flex-wrap:wrap;gap:4px">'+x.tags.map(t=>tagPill[t]).join('')+'</td></tr>';
    }).join(''):'<tr><td colspan="6"><div class="empty">No data issues in this filter — clean!</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Fix these in the source Google Sheet · score = average completeness of price, expiry, batch and bin across '+n+' active SKUs</span></div></div>';
}

/* ── CUSTOMERS / ACCOUNTS ── */
// Normalize account names so Verna's OUT destinations match Shopify customer names
function custNorm(s){return String(s||'').toLowerCase().replace(/\(.*?\)/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\b(inc|corp|corporation|co|ltd|clinic|clinics|the)\b/g,'').replace(/\s+/g,' ').trim();}

/* ── PROSPECTS working list: Shopify-only accounts, worth chasing or worth merging ── */
function renderProspects(){
  const rows=acctList();
  const sheet=rows.filter(r=>r.src==='sheet'||r.src==='both');
  const pros=rows.filter(r=>r.src==='shopify'||r.src==='prospect').sort((a,b)=>b.booked-a.booked);
  // fuzzy candidate: shared name tokens (≥4 chars) with a sheet account → likely the
  // SAME clinic under a different spelling, not a real prospect
  const tok=n=>[...new Set(custNorm(n).split(' ').filter(t=>t.length>=4))];
  const sheetToks=sheet.map(s=>({name:s.name,t:tok(s.name)}));
  const match=n=>{
    const a=tok(n);if(!a.length)return null;
    let best=null,bs=0;
    for(const s of sheetToks){
      if(!s.t.length)continue;
      const hit=s.t.filter(t=>a.includes(t)).length;
      if(!hit)continue;
      const score=hit/Math.max(a.length,s.t.length);
      if(score>bs){bs=score;best=s.name;}
    }
    return bs>=0.5?best:null;
  };
  const withM=pros.map(r=>({...r,m:match(r.name)}));
  const dupes=withM.filter(r=>r.m),fresh=withM.filter(r=>!r.m);
  const y1=new Date(Date.now()-365*864e5).toISOString().slice(0,10);
  const active=fresh.filter(r=>(r.last||'')>=y1);
  window._PROSPECTS=withM;
  const pill=r=>r.src==='prospect'?'<span class="pill" style="background:rgba(127,119,221,.15);color:var(--pu)">visit log only</span>':
    (r.last||'')>=y1?'<span class="pill pgr">active</span>':'<span class="pill pgy">lapsed</span>';
  const row=(r,i)=>'<tr onclick="showAccountPage(\''+jsq(r.name)+'\')" style="cursor:pointer"><td class="mu">'+(i+1)+'</td>'+
    '<td style="font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</td>'+
    '<td>'+pill(r)+'</td>'+
    '<td class="r" style="font-weight:600">'+(r.booked?fmtPeso(r.booked):'—')+'</td>'+
    '<td class="r mu">'+(r.v90?fmtPeso(r.v90):'—')+'</td>'+
    '<td class="r mu" style="font-size:11px">'+esc(r.last||'—')+'</td>'+
    '<td class="mu" style="font-size:11.5px;max-width:250px;overflow:hidden;text-overflow:ellipsis">'+(r.m?'≈ <a href="#" onclick="event.stopPropagation();showAccountPage(\''+jsq(r.m)+'\');return false" style="color:var(--ac)">'+esc(r.m)+'</a>'+
      (canManage()?' · <a href="#" onclick="event.stopPropagation();prospectMerge(\''+jsq(r.name)+'\',\''+jsq(r.m)+'\');return false" style="color:var(--gr);font-weight:600">merge →</a>':''):'')+(canStage(r.name)?' · <a href="#" onclick="event.stopPropagation();setStage(\''+jsq(r.name)+'\',\'qualified\');return false" style="color:var(--pu);font-size:11px">→ pipeline</a>':'')+'</td></tr>';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met pu"><div class="met-lbl">Shopify-only / prospects</div><div class="met-val">'+withM.length+'</div><div class="met-sub">never in the OUT sheet</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Active, real prospects</div><div class="met-val">'+active.length+'</div><div class="met-sub">no sheet match, ordered in the last year</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Likely name mismatches</div><div class="met-val">'+dupes.length+'</div><div class="met-sub">probably an existing account, spelled differently</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Booked value here</div><div class="met-val" style="font-size:15px">'+fmtPeso(withM.reduce((a,r)=>a+r.booked,0))+'</div><div class="met-sub">13-month Shopify bookings</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tabs" style="margin-bottom:12px">'+[['all','All accounts'],['prospects','Prospects ('+withM.length+')'],['growing','Growing'],['declining','Declining'],['dormant','Dormant'],['shopify','Vs Shopify']].map(([k,l])=>'<div class="tab'+(k==='prospects'?' active':'')+'" onclick="window._custFilter=\''+k+'\';renderCustomers()">'+l+'</div>').join('')+'</div>'+
    '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button onclick="exportProspectsCSV()" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer">Export CSV for the team</button></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>#</th><th>Account</th><th>Status</th><th style="text-align:right">Booked ₱ (13mo)</th><th style="text-align:right">₱ 90d</th><th style="text-align:right">Last activity</th><th>Possible existing account</th></tr></thead><tbody>'+
    withM.map(row).join('')+
    '</tbody></table></div><div class="tfooter"><span>Sorted by booked value · "≈" = shares name words with an OUT-sheet account, so it\'s probably the same clinic under a different spelling (open both to compare) · active = ordered within 12 months → reactivation/regular-account candidates for the specialists · lapsed = one-time buyers worth a follow-up call</span></div></div>';
}
async function prospectMerge(fromName,toName){
  if(!canManage())return;
  if(!confirm('Merge "'+fromName+'" into "'+toName+'"?\n\nOnly do this if they are the SAME customer (open both pages to compare first). Reversible from the account page.'))return;
  try{
    const {error}=await SB.from('account_links').upsert({from_key:custNorm(acctDedup(fromName)),from_name:fromName,to_name:toName,kind:'merge',created_by:(SBUSER&&SBUSER.id)||null});
    if(error)throw error;
    audit('account.merge',{from:fromName,to:toName,via:'prospects'});
    await loadAcctLinks(true);
    renderProspects();
  }catch(e){alert('Could not merge: '+(e.message||e));}
}
function exportProspectsCSV(){
  const rows=(window._PROSPECTS||[]).map(r=>[r.name,r.src==='prospect'?'visit log only':'shopify only',r.booked||0,r.v90||0,r.last||'',r.m||''].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(['"Account","Source","Booked 13mo","Booked 90d","Last activity","Possible existing account"',...rows].join('\n'));
  a.download='healthspan_prospects_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}
function renderCustShopifyRecon(all){
  const shopC=(SHOPIFY&&SHOPIFY.customers)||null;
  const tabs='<div class="tabs" style="margin-bottom:12px">'+[['all','Accounts'],['growing','Growing'],['declining','Declining'],['dormant','Dormant'],['shopify','Vs Shopify']].map(([k,l])=>'<div class="tab'+(k==='shopify'?' active':'')+'" onclick="window._custFilter=\''+k+'\';renderCustomers()">'+l+'</div>').join('')+'</div>';
  if(!shopC||!Object.keys(shopC).length){
    $('content').innerHTML=tabs+'<div class="empty" style="margin-top:30px">Waiting for the Shopify customer data — it appears after the next sales-cache rebuild (automatic, a few minutes after deploying the update).</div>';
    try{loadShopify();}catch(e){}return;}
  // index Shopify customers by normalized name
  const byNorm={};for(const n in shopC){const k=custNorm(n);if(k)(byNorm[k]||(byNorm[k]=[])).push(n);}
  const usedShop=new Set();
  const rows=all.map(c=>{
    const k=custNorm(c.name);
    let names=byNorm[k]||[];
    if(!names.length&&k.length>=6){ // containment fallback for partial names
      names=Object.keys(byNorm).filter(x=>x.length>=6&&(x.includes(k)||k.includes(x))).flatMap(x=>byNorm[x]);}
    const agg={o:0,u:0,v:0,u90:0,v90:0,l:''};
    for(const n of names){const s=shopC[n];if(!s)continue;usedShop.add(n);agg.o+=s.o;agg.u+=s.u;agg.v+=s.v;agg.u90+=s.u90;agg.v90+=s.v90;if(s.l>agg.l)agg.l=s.l;}
    return {c,matched:names.length>0,shop:agg};
  });
  const matched=rows.filter(r=>r.matched);
  const sheetOnly=rows.filter(r=>!r.matched&&!r.c.isRemedy);
  const shopOnly=Object.keys(shopC).filter(n=>!usedShop.has(n)&&!/pull\s*-?\s*out/i.test(n))
    .map(n=>({n,...shopC[n]})).sort((a,b)=>b.v-a.v);
  const totShip90=all.reduce((a,c)=>a+(c.recentVal||0),0);
  const totBook90=rows.reduce((a,r)=>a+r.shop.v90,0)+shopOnly.reduce((a,s)=>a+s.v90,0);
  $('content').innerHTML=tabs+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met gr"><div class="met-lbl">Matched accounts</div><div class="met-val">'+matched.length+' / '+all.length+'</div><div class="met-sub">sheet accounts found in Shopify</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Booked — last 90d</div><div class="met-val" style="font-size:15px">'+fmtPeso(totBook90)+'</div><div class="met-sub">Shopify, all customers</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Shipped — last 90d</div><div class="met-val" style="font-size:15px">'+fmtPeso(totShip90)+'</div><div class="met-sub">warehouse OUT sheet</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Shopify-only customers</div><div class="met-val">'+shopOnly.length+'</div><div class="met-sub">booked but never in the OUT sheet</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="tcard" style="margin-bottom:14px"><div class="tscroll"><table><thead><tr><th>Account (sheet name)</th><th style="text-align:right">Shipped u (all)</th><th style="text-align:right">Booked u (13mo)</th><th style="text-align:right">Shipped ₱ 90d</th><th style="text-align:right">Booked ₱ 90d</th><th style="text-align:right">Δ 90d</th><th>Status</th></tr></thead><tbody>'+
    rows.sort((a,b)=>(b.shop.v90+((b.c.recentVal)||0))-(a.shop.v90+((a.c.recentVal)||0))).map(r=>{
      const d90=r.shop.v90-(r.c.recentVal||0);
      return '<tr onclick="openCustDrawer('+CUSTOMERS.indexOf(r.c)+')" style="cursor:pointer"><td style="font-weight:600;max-width:230px;overflow:hidden;text-overflow:ellipsis">'+esc(r.c.name)+(r.c.isRemedy?' <span class="pill pbl">sister co.</span>':'')+'</td>'+
      '<td class="r mu">'+r.c.qty.toLocaleString()+'</td><td class="r mu">'+(r.matched?r.shop.u.toLocaleString():'—')+'</td>'+
      '<td class="r">'+fmtPeso(r.c.recentVal||0)+'</td><td class="r">'+(r.matched?fmtPeso(r.shop.v90):'—')+'</td>'+
      '<td class="r" style="font-weight:600;color:'+(r.matched?(Math.abs(d90)<20000?'var(--gr)':d90>0?'var(--bl)':'var(--am)'):'var(--tx3)')+'">'+(r.matched?((d90>=0?'+':'−')+fmtPeso(Math.abs(d90))):'—')+'</td>'+
      '<td>'+(r.matched?'<span class="pill pgr">matched</span>':'<span class="pill pgy">sheet only</span>')+'</td></tr>';}).join('')+
    '</tbody></table></div><div class="tfooter"><span>Booked = Shopify orders (13 months, pull-outs excluded) matched to sheet accounts by normalized name · Δ 90d = booked minus shipped in the last 90 days: positive = orders waiting to ship, negative = shipped more than booked (manual/legacy shipments) · Remedy ships via the sheet but books under order tags, so it shows sheet-only</span></div></div>'+
    (shopOnly.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Shopify-only customer (never in OUT sheet)</th><th style="text-align:right">Orders</th><th style="text-align:right">Units</th><th style="text-align:right">Booked ₱ (13mo)</th><th style="text-align:right">Last order</th></tr></thead><tbody>'+
      shopOnly.slice(0,60).map(s=>'<tr><td style="font-weight:600;max-width:260px;overflow:hidden;text-overflow:ellipsis">'+esc(s.n)+'</td><td class="r mu">'+s.o+'</td><td class="r">'+s.u.toLocaleString()+'</td><td class="r" style="font-weight:600">'+fmtPeso(s.v)+'</td><td class="r mu">'+esc(s.l||'—')+'</td></tr>').join('')+
      '</tbody></table></div><div class="tfooter"><span>These booked on Shopify but never appear as a destination in Verna’s OUT sheet — new accounts not yet shipped, name spellings that don’t match, or bookings fulfilled outside the warehouse log</span></div></div>':'');
}
function renderCustomers(){
  const all=CUSTOMERS||[];
  if(!all.length){$('content').innerHTML='<div class="empty" style="margin-top:40px">No customer data in the current sync yet — it appears after the next Google Sheets sync.</div>';return;}
  const f=window._custFilter||'all';
  if(f==='shopify')return renderCustShopifyRecon(all);
  if(f==='prospects')return renderProspects();
  if(f==='all'){ // unified CRM account list: sheet + Shopify + visit-log accounts merged
    ACCTBYNORM=null;
    const rows=acctList();
    const tabs2=[['all','All accounts ('+rows.length+')'],['prospects','Prospects'],['growing','Growing'],['declining','Declining'],['dormant','Dormant'],['shopify','Vs Shopify']];
    $('content').innerHTML=
      '<div class="metrics" style="margin-bottom:14px">'+
      '<div class="met bl"><div class="met-lbl">Accounts</div><div class="met-val">'+rows.length+'</div><div class="met-sub">merged across all systems</div><div class="met-bar"></div></div>'+
      '<div class="met gr"><div class="met-lbl">Booked (13mo)</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.booked,0))+'</div><div class="met-sub">Shopify, all accounts</div><div class="met-bar"></div></div>'+
      '<div class="met am"><div class="met-lbl">Shipped value</div><div class="met-val" style="font-size:15px">'+fmtPeso(rows.reduce((a,r)=>a+r.shipped,0))+'</div><div class="met-sub">warehouse OUT sheet</div><div class="met-bar"></div></div>'+
      '<div class="met pu" onclick="window._custFilter=\'prospects\';renderCustomers()" style="cursor:pointer"><div class="met-lbl">Shopify-only / prospects</div><div class="met-val">'+rows.filter(r=>r.src==='shopify'||r.src==='prospect').length+'</div><div class="met-sub">not yet in the OUT sheet — tap to work the list</div><div class="met-bar"></div></div>'+
      '</div>'+
      '<div class="tabs" style="margin-bottom:12px">'+tabs2.map(([k,l])=>'<div class="tab'+(k==='all'?' active':'')+'" onclick="window._custFilter=\''+k+'\';renderCustomers()">'+l+'</div>').join('')+'</div>'+
      '<div class="tcard"><div class="tscroll"><table><thead><tr><th>#</th><th>Account</th><th style="text-align:center">Health</th><th>Owner</th><th style="text-align:right">Shipped ₱</th><th style="text-align:right">Booked ₱ (13mo)</th><th style="text-align:right">Booked ₱ 90d</th><th style="text-align:right">Last activity</th></tr></thead><tbody>'+
      (function(){const arSet=NORDERS?arOverdueSet():null;
      return rows.map((r,i)=>{const h=healthOf(r,arSet);
        return '<tr onclick="showAccountPage(\''+jsq(r.name)+'\')" style="cursor:pointer'+(r.e.isRemedy?';background:var(--sf2)':'')+'"><td class="mu">'+(i+1)+'</td>'+
        '<td style="font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+(r.branches?' <span class="pill pbl">'+r.branches+' branches</span>':'')+(r.e.isRemedy?' <span class="pill pbl">sister co.</span>':'')+(r.src==='prospect'?' <span class="pill" style="background:rgba(127,119,221,.15);color:var(--pu)">prospect</span>':'')+'</td>'+
        '<td style="text-align:center"><span title="'+esc(h.why)+'" style="font-weight:700;color:'+h.c+'">'+h.s+'</span></td>'+
        '<td>'+(canManage()?ownerSelHTML(r.name):esc(ownerOf(r.name)||'—'))+'</td>'+
        '<td class="r">'+(r.shipped?fmtPeso(r.shipped):'—')+'</td><td class="r" style="font-weight:600">'+(r.booked?fmtPeso(r.booked):'—')+'</td>'+
        '<td class="r mu">'+(r.v90?fmtPeso(r.v90):'—')+'</td>'+
        '<td class="r mu" style="font-size:11px">'+esc(r.last||'—')+'</td></tr>';}).join('');})()+
      '</tbody></table></div><div class="tfooter"><span>One row per account, merged by name across Verna’s OUT sheet, Shopify, and the visit log · Health 0–100: recency + 90-day bookings + overdue AR + visit history (hover the number for reasons) — green ≥75, amber ≥45 · tap a row for the full profile</span></div></div>';
    if(!NORDERS)loadNativeOrders().then(()=>{if(currentView==='customers'&&(window._custFilter||'all')==='all')renderCustomers();}); // health improves once AR data lands
    if(!OWNERS)loadOwners().then(()=>{if(currentView==='customers'&&(window._custFilter||'all')==='all')renderCustomers();});
    return;
  }
  const totVal=all.reduce((a,c)=>a+c.value,0);
  const remedy=all.filter(c=>c.isRemedy).reduce((a,c)=>a+c.value,0);
  const remedyPct=totVal>0?Math.round(remedy/totVal*100):0;
  const dormant=all.filter(c=>c.daysSince!=null&&c.daysSince>90);
  const declining=all.filter(c=>c.trend==='down');
  const growing=all.filter(c=>c.trend==='up'||c.trend==='new');
  const atRisk=new Set([...declining,...dormant].map(c=>c.name)).size;
  let rows=all.slice();
  if(f==='growing')rows=growing;else if(f==='declining')rows=declining;else if(f==='dormant')rows=dormant;
  const tabs=[['all','All ('+all.length+')'],['growing','Growing ('+growing.length+')'],['declining','Declining ('+declining.length+')'],['dormant','Dormant ('+dormant.length+')'],['shopify','Vs Shopify']];
  const tb=c=>c.trend==='up'?'<span class="pill pgr">▲ growing</span>':c.trend==='new'?'<span class="pill pbl">new</span>':c.trend==='down'?'<span class="pill prd">▼ declining</span>':'<span class="pill pgy">flat</span>';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Accounts</div><div class="met-val">'+all.length+'</div><div class="met-sub">customers shipped to</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Shipped value</div><div class="met-val" style="font-size:17px">'+fmtK(totVal)+'</div><div class="met-sub">total across accounts</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Remedy concentration</div><div class="met-val">'+remedyPct+'%</div><div class="met-sub">of shipped value</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">At-risk accounts</div><div class="met-val">'+atRisk+'</div><div class="met-sub">declining or dormant 90d+</div><div class="met-bar"></div></div>'+
    '</div>'+
    (remedyPct>=50?'<div class="viewdesc" style="border-left-color:var(--am)"><svg class="vd-i" viewBox="0 0 24 24" style="stroke:var(--am)"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg><div class="vd-t"><b>Concentration risk:</b> Remedy is '+remedyPct+'% of shipped value. A large share riding on one customer is worth watching.</div></div>':'')+
    '<div class="tabs" style="margin-bottom:12px">'+tabs.map(([k,l])=>'<div class="tab'+(f===k?' active':'')+'" onclick="window._custFilter=\''+k+'\';renderCustomers()">'+l+'</div>').join('')+'</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>#</th><th>Customer</th><th style="text-align:right">Orders</th><th style="text-align:right">SKUs</th><th style="text-align:right">Units</th><th style="text-align:right">Shipped value</th><th style="text-align:right">Share</th><th style="text-align:right">Last order</th><th>Trend</th></tr></thead><tbody>'+
    (rows.length?rows.map((c,i)=>{
      const share=totVal>0?(c.value/totVal*100):0;
      const last=c.daysSince!=null?(c.daysSince<=0?'today':c.daysSince+'d ago'):'—';
      const lastC=c.daysSince!=null&&c.daysSince>90?'color:var(--rd)':'';
      return '<tr onclick="openCustDrawer('+CUSTOMERS.indexOf(c)+')" style="cursor:pointer'+(c.isRemedy?';background:var(--sf2)':'')+'"><td class="mu">'+(i+1)+'</td>'+
      '<td style="font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis">'+esc(c.name)+(c.isRemedy?' <span class="pill pbl" style="font-weight:500">sister co.</span>':'')+'</td>'+
      '<td class="r mu">'+c.orders.toLocaleString()+'</td><td class="r mu">'+c.skuCount+'</td><td class="r mu">'+c.qty.toLocaleString()+'</td>'+
      '<td class="r" style="font-weight:600">'+fmtK(c.value)+'</td><td class="r">'+share.toFixed(1)+'%</td>'+
      '<td class="r mu" style="font-size:11px;'+lastC+'">'+last+'</td><td>'+tb(c)+'</td></tr>';
    }).join(''):'<tr><td colspan="9"><div class="empty">No accounts in this filter</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>Accounts from the OUT sheet destination column · Remedy’s branches grouped as one · trend = last 90 days vs the 90 before</span></div></div>';
}

/* ── CUSTOMER DETAIL DRAWER ── */
function openCustDrawer(idx){
  const c=(CUSTOMERS||[])[idx]; if(!c)return;
  const totVal=(CUSTOMERS||[]).reduce((a,x)=>a+x.value,0);
  const share=totVal>0?(c.value/totVal*100).toFixed(1):'0';
  const tb=c.trend==='up'?'<span class="pill pgr">▲ growing</span>':c.trend==='new'?'<span class="pill pbl">new</span>':c.trend==='down'?'<span class="pill prd">▼ declining</span>':'<span class="pill pgy">flat</span>';
  const last=c.daysSince!=null?(c.daysSince<=0?'today':c.daysSince+' days ago'):'—';
  const topHTML=(c.topProducts&&c.topProducts.length)?'<div class="dsec"><div class="dsectitle">What they buy (top products)</div>'+
    c.topProducts.map(t=>'<div class="drow" onclick="openDrawer(\''+esc(t.sku)+'\')" style="cursor:pointer"><span class="dlbl" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(t.name)+'</span><span class="dval">'+t.qty.toLocaleString()+' u'+(t.value>0?' · '+fmtK(t.value):'')+'</span></div>').join('')+'</div>':'';
  const recHTML=(c.recent&&c.recent.length)?'<div class="dsec"><div class="dsectitle">Recent shipments</div>'+
    c.recent.map(r=>'<div class="drow"><span class="dlbl">'+esc(r.date)+'</span><span class="dval" style="max-width:190px;overflow:hidden;text-overflow:ellipsis;text-align:right">'+r.qty+' × '+esc(r.name)+'</span></div>').join('')+'</div>':'';
  $('dbody').innerHTML=
    '<div class="dsku">CUSTOMER</div>'+
    '<div class="dname">'+esc(c.name)+'</div>'+
    tb+(c.isRemedy?' <span class="pill pbl">sister co.</span>':'')+
    '<div class="dstk" style="color:var(--gr)">'+fmtK(c.value)+'</div>'+
    '<div class="dsub">total shipped value · '+share+'% of all accounts</div>'+
    '<div class="dsec"><div class="dsectitle">Account</div>'+
    '<div class="drow"><span class="dlbl">Units shipped</span><span class="dval">'+c.qty.toLocaleString()+'</span></div>'+
    '<div class="drow"><span class="dlbl">Orders</span><span class="dval">'+c.orders.toLocaleString()+'</span></div>'+
    '<div class="drow"><span class="dlbl">Distinct products</span><span class="dval">'+c.skuCount+'</span></div>'+
    '<div class="drow"><span class="dlbl">Last order</span><span class="dval"'+(c.daysSince!=null&&c.daysSince>90?' style="color:var(--rd);font-weight:600"':'')+'>'+last+'</span></div>'+
    '<div class="drow"><span class="dlbl">Last 90d value</span><span class="dval">'+fmtK(c.recentVal)+'</span></div>'+
    '<div class="drow"><span class="dlbl">Prior 90d value</span><span class="dval">'+fmtK(c.priorVal)+'</span></div>'+
    '</div>'+topHTML+recHTML+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:10px">From the OUT sheet destination column · tap a product to open its detail</div>';
  $('overlay').classList.add('open');
  $('drawer').classList.add('open');
}

/* ── ACTION CENTER ── */
function renderActionCenter(){
  const orders=reorderRows(PLAN.lead,PLAN.cover,PLAN.safety,1);
  const rank=p=>p.abc==='A'?0:p.abc==='B'?1:2;
  orders.sort((a,b)=>((b.runsOutInLead?1:0)-(a.runsOutInLead?1:0))||(rank(a.p)-rank(b.p))||((a.p.daysToStockout??9999)-(b.p.daysToStockout??9999)));
  const orderCost=orders.reduce((a,r)=>a+r.cost,0);
  const expiry=collisionRows(1);
  const woTotal=expiry.reduce((a,c)=>a+c.writeOff,0);
  const neg=DATA.filter(p=>{const s=stk(p);return s!==null&&s<0;});
  const negSet=new Set(neg.map(p=>p.sku));
  const lumpyLow=DATA.filter(p=>p.demandClass==='lumpy'&&stk(p)>0&&p.daysToStockout!=null&&p.daysToStockout<=30&&!negSet.has(p.sku));
  const review=[...neg.map(p=>({p,reason:'Negative stock — check count',c:'rd'})),...lumpyLow.map(p=>({p,reason:'Lumpy demand, low stock',c:'am'}))];
  const dead=DATA.filter(p=>p.agedBucket==='dead'&&stk(p)>0&&p.price>0).map(p=>({p,val:stk(p)*p.price})).sort((a,b)=>b.val-a.val);
  const deadVal=dead.reduce((a,x)=>a+x.val,0);
  const arow=(sku,dot,name,meta)=>'<div class="arow" onclick="openDrawer(\''+esc(sku)+'\')"><div class="adot '+dot+'"></div><div class="aname">'+name+'</div><div class="ameta">'+meta+'</div></div>';
  const sect=(icon,title,count,sub,link,linkLabel,body)=>'<div class="panel"><div class="phd">'+icon+title+' <span style="color:var(--tx3);font-weight:500;margin-left:4px">'+count+'</span></div><div style="font-size:11px;color:var(--tx3);margin:-2px 0 8px">'+sub+'</div><div class="alist">'+body+'</div><div style="margin-top:9px"><a href="#" onclick="showView(\''+link+'\',null);return false" style="font-size:11px;color:var(--ac);font-weight:600;text-decoration:none">'+linkLabel+' →</a></div></div>';
  const iCart='<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  const iWarn='<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>';
  const iEye='<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const iClock='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met rd"><div class="met-lbl">Order now</div><div class="met-val">'+orders.length+'</div><div class="met-sub">'+fmtK(orderCost)+' to restock</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Write-off risk</div><div class="met-val" style="font-size:17px">'+fmtK(woTotal)+'</div><div class="met-sub">'+expiry.length+' batches expiring</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">To review</div><div class="met-val">'+review.length+'</div><div class="met-sub">data issues / unreliable</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Dead stock</div><div class="met-val" style="font-size:17px">'+fmtK(deadVal)+'</div><div class="met-sub">'+dead.length+' SKUs idle 180d+</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="g2">'+
    sect(iCart,'Order now',orders.length,'Below reorder point or running out — buy these.','reorderplan','Open reorder plan',
      orders.length?orders.slice(0,7).map(r=>arow(r.p.sku,((r.p.daysToStockout!=null&&r.p.daysToStockout<=14)||r.runsOutInLead)?'rd':'am',(r.p.abc?'<b>'+r.p.abc+'</b> ':'')+esc(r.p.name),r.qty.toLocaleString()+' units · '+fmtP(r.cost))).join('')+(orders.length>7?'<div class="arow" style="justify-content:center;color:var(--ac);font-size:11px" onclick="showView(\'reorderplan\',null)">+ '+(orders.length-7)+' more</div>':''):'<div class="empty">Nothing to order right now</div>')+
    sect(iWarn,'Act on expiry',expiry.length,'Expiring unsold — promo or move to a faster site.','writeoff','Open write-off forecast',
      expiry.length?expiry.slice(0,7).map(c=>arow(c.sku,'rd',esc(c.name)+' <span style="color:var(--tx3);font-size:9px">'+esc(c.batch||'')+'</span>',fmtK(c.writeOff)+' · '+c.daysToExpiry+'d')).join('')+(expiry.length>7?'<div class="arow" style="justify-content:center;color:var(--ac);font-size:11px" onclick="showView(\'writeoff\',null)">+ '+(expiry.length-7)+' more</div>':''):'<div class="empty">No expiry write-off risk</div>')+
    sect(iEye,'Review',review.length,'Data issues or forecasts to judge by hand.','variability','Open demand variability',
      review.length?review.slice(0,7).map(x=>arow(x.p.sku,x.c,esc(x.p.name),x.reason)).join('')+(review.length>7?'<div class="arow" style="justify-content:center;color:var(--ac);font-size:11px" onclick="showView(\'neg\',null)">+ '+(review.length-7)+' more</div>':''):'<div class="empty">Nothing to review</div>')+
    sect(iClock,'Clear dead stock',dead.length,'No sale in 180+ days — clearance or promo.','aged','Open aged inventory',
      dead.length?dead.slice(0,7).map(x=>arow(x.p.sku,'',esc(x.p.name),fmtP(x.val)+(x.p.daysSinceLastSale?' · '+x.p.daysSinceLastSale+'d idle':''))).join('')+(dead.length>7?'<div class="arow" style="justify-content:center;color:var(--ac);font-size:11px" onclick="showView(\'aged\',null)">+ '+(dead.length-7)+' more</div>':''):'<div class="empty">No dead stock</div>')+
    '</div>';
}

/* ── DASHBOARD ── */
function renderDashboard(){
  const ss=DATA.map(p=>stk(p));
  const tot=ss.filter(s=>s!==null&&s>0).reduce((a,b)=>a+b,0);
  const oos=DATA.filter(p=>stk(p)===0);
  const low=DATA.filter(p=>{const s=stk(p);return s!==null&&s>0&&s<10;});
  const neg=DATA.filter(p=>{const s=stk(p);return s!==null&&s<0;});
  const expAlerts=BATCHES.filter(b=>expDaysLeft(b.expiry)!==null&&expDaysLeft(b.expiry)<=92&&b.soh>0);
  const val=DATA.reduce((a,p)=>{const s=stk(p);return a+(s>0&&p.price?s*p.price:0);},0);
  const byL={};
  DATA.forEach(p=>{const l=p.line||'Other';const s=stk(p)||0;byL[l]=(byL[l]||0)+Math.max(0,s);});
  const lE=Object.entries(byL).sort((a,b)=>b[1]-a[1]);
  const mx=Math.max(...lE.map(e=>e[1]),1);
  const byC={};
  DATA.forEach(p=>{const c=p.category||'Other';const s=stk(p)||0;byC[c]=(byC[c]||0)+Math.max(0,s);});
  const cE=Object.entries(byC).sort((a,b)=>b[1]-a[1]);

  const so30=DATA.filter(p=>p.daysToStockout!=null&&p.daysToStockout>0&&p.daysToStockout<=30&&(p.velAdj||0)>0)
    .sort((a,b)=>a.daysToStockout-b.daysToStockout);

  $('content').innerHTML=
    '<div class="metrics">'+
    '<div class="met pu"><div class="met-lbl">Total SKUs</div><div class="met-val">'+DATA.length+'</div><div class="met-sub">all product lines</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Units in stock</div><div class="met-val">'+tot.toLocaleString()+'</div><div class="met-sub">positive stock</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Out of stock</div><div class="met-val">'+oos.length+'</div><div class="met-sub">'+Math.round(oos.length/DATA.length*100)+'% of SKUs</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Stockout &le;30d</div><div class="met-val">'+so30.length+'</div><div class="met-sub">forecast to run out</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Expiring soon</div><div class="met-val">'+expAlerts.length+'</div><div class="met-sub">batches &le;3 months</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Inventory value</div><div class="met-val" style="font-size:14px">₱'+Math.round(val).toLocaleString()+'</div><div class="met-sub">VAT-exclusive</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="g2">'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Running out within 30 days</div><div class="alist" id="solist"></div></div>'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>Category split</div><div class="cw" style="height:140px"><canvas id="cc" role="img" aria-label="Category donut">Category breakdown</canvas></div><div id="cat-legend" style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px"></div></div>'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>Out of stock — commercial</div><div class="alist" id="ooslist"></div></div>'+
    '<div class="panel"><div class="phd"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>Expiring within 3 months</div><div class="alist" id="explist"></div></div>'+
    '</div>'+
    '<div class="panel" style="margin-bottom:16px"><div class="phd"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Stock by product line</div><div class="hbars" id="hbars"></div></div>';

  $('solist').innerHTML=so30.length?so30.slice(0,7).map(p=>{
    const d=new Date(p.stockoutDate).toLocaleDateString('en-PH',{month:'short',day:'numeric'});
    const tArrow=p.trendFlag==='up'?' <span style="color:var(--rd);font-size:9px">\u25b2</span>':'';
    return '<div class="arow" onclick="openDrawer(\''+esc(p.sku)+'\')"><div class="adot '+(p.daysToStockout<=14?'rd':'am')+'"></div><div class="aname">'+esc(p.name)+tArrow+'</div><div class="ameta">'+p.daysToStockout+'d &middot; '+d+'</div></div>';
  }).join('')+(so30.length>7?'<div class="arow" onclick="showView(\'forecast\',null)" style="justify-content:center;color:var(--ac);font-size:11px">View all '+so30.length+' &rarr;</div>':'')
  :'<div class="empty">Nothing forecast to run out within 30 days</div>';

  $('hbars').innerHTML=lE.map(([l,v],i)=>
    '<div class="hbrow"><div class="hblbl" title="'+esc(l)+'" onclick="fltLine(\''+l.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\',null)">'+esc(l)+'</div>'+
    '<div class="hbtrack"><div class="hbfill" style="width:'+Math.round(v/mx*100)+'%;background:'+COLORS[i%COLORS.length]+'"></div></div>'+
    '<div class="hbval">'+v.toLocaleString()+'</div></div>'
  ).join('');

  if(catInst){catInst.destroy();catInst=null;}
  catInst=new Chart($('cc'),{type:'doughnut',
    data:{labels:cE.map(([c])=>c),datasets:[{data:cE.map(([,v])=>v),backgroundColor:COLORS,borderWidth:2,borderColor:'transparent'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.label+': '+ctx.parsed.toLocaleString();}}}}}
  });
  const legEl=$('cat-legend');
  if(legEl){
    const tot2=cE.reduce((a,[,v])=>a+v,0);
    legEl.innerHTML=cE.map(([c,v],i)=>{
      const pct=tot2>0?Math.round(v/tot2*100):0;
      return '<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--tx2)"><span style="width:8px;height:8px;border-radius:2px;background:'+COLORS[i%COLORS.length]+';flex-shrink:0"></span>'+esc(c)+' <span style="color:var(--tx3)">'+pct+'%</span></span>';
    }).join('');
  }

  const oosComm=DATA.filter(p=>stk(p)===0&&p.category==='Commercial').sort((a,b)=>b.received-a.received).slice(0,7);
  $('ooslist').innerHTML=oosComm.length?oosComm.map(p=>
    '<div class="arow" onclick="openDrawer(\''+esc(p.sku)+'\')"><div class="adot rd"></div><div class="aname">'+esc(p.name)+'</div><div class="ameta">'+esc(p.sku)+'</div></div>'
  ).join(''):'<div class="empty">No out-of-stock commercial items</div>';

  const expSoon3m=BATCHES.filter(b=>{const d=expDaysLeft(b.expiry);return d!==null&&d<=92&&b.soh>0;})
    .sort((a,b)=>(expDaysLeft(a.expiry)||999)-(expDaysLeft(b.expiry)||999)).slice(0,7);
  $('explist').innerHTML=expSoon3m.length?expSoon3m.map(b=>{
    const d=expDaysLeft(b.expiry);
    const c=expColor(d);
    return '<div class="arow"><div class="adot '+c+'"></div><div class="aname">'+esc(b.name)+(b.batch?' ['+esc(b.batch)+']':'')+'</div><div class="ameta">'+expLabel(d)+'</div></div>';
  }).join(''):'<div class="empty">No batches expiring within 3 months</div>';
}

/* ── EXPIRY TRACKER ── */
function renderExpiry(){
  const now=new Date();
  const expired=BATCHES.filter(b=>expDaysLeft(b.expiry)<0).sort((a,b)=>expDaysLeft(a.expiry)-expDaysLeft(b.expiry));
  const exp1m=BATCHES.filter(b=>{const d=expDaysLeft(b.expiry);return d!==null&&d>=0&&d<=31;}).sort((a,b)=>expDaysLeft(a.expiry)-expDaysLeft(b.expiry));
  const exp3m=BATCHES.filter(b=>{const d=expDaysLeft(b.expiry);return d!==null&&d>31&&d<=92;}).sort((a,b)=>expDaysLeft(a.expiry)-expDaysLeft(b.expiry));
  const exp6m=BATCHES.filter(b=>{const d=expDaysLeft(b.expiry);return d!==null&&d>92&&d<=183;}).sort((a,b)=>expDaysLeft(a.expiry)-expDaysLeft(b.expiry));
  const safe=BATCHES.filter(b=>{const d=expDaysLeft(b.expiry);return d!==null&&d>183;}).sort((a,b)=>expDaysLeft(a.expiry)-expDaysLeft(b.expiry));

  function batchTable(rows){
    if(!rows.length) return '<div class="empty">None</div>';
    return '<div class="tscroll"><table><thead><tr><th>Product / Batch</th><th>Line</th><th>Expiry</th><th style="text-align:right">Days left</th><th style="text-align:right">SOH</th><th>Status</th></tr></thead><tbody>'+
      rows.map(b=>{
        const d=expDaysLeft(b.expiry);const c=expColor(d);
        return '<tr><td><div style="font-weight:500">'+esc(b.name)+'</div><div style="font-size:10px;color:var(--tx3);font-family:monospace">'+esc(b.batch||'')+'</div></td>'+
          '<td class="mu">'+esc(b.line||'')+'</td>'+
          '<td style="font-size:11px">'+esc(b.expiry)+'</td>'+
          '<td class="r" style="font-weight:600;color:var(--'+( d<0?'rd':d<=31?'rd':d<=92?'am':'gr')+')">'+( d<0?Math.abs(d)+' ago':d)+'</td>'+
          '<td class="r stk">'+b.soh+'</td>'+
          '<td><span class="pill '+c+'">'+expLabel(d)+'</span></td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  $('content').innerHTML=
    '<div class="exp-section"><div class="exp-section-hd red"><svg viewBox="0 0 24 24" width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>Expired ('+expired.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+batchTable(expired)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd red">Expiring within 1 month ('+exp1m.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+batchTable(exp1m)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd amber">Expiring 1–3 months ('+exp3m.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+batchTable(exp3m)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd amber">Expiring 3–6 months ('+exp6m.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+batchTable(exp6m)+'</div></div>'+
    '<div class="exp-section"><div class="exp-section-hd green">Safe — 6+ months ('+safe.length+' batches)</div><div class="tcard" style="margin-bottom:0">'+batchTable(safe)+'</div></div>';
}

/* ── BATCH VIEW (FEFO) ── */
function renderBatches(){
  const q=(fSearch||'').toLowerCase();
  let rows=BATCHES.filter(b=>!q||(b.name||'').toLowerCase().includes(q)||(b.skuCode||'').toLowerCase().includes(q)||(b.batch||'').toLowerCase().includes(q));
  $('content').innerHTML=
    '<div class="toolbar"><div class="sw"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="bsi" placeholder="Search product or batch..." value="'+esc(q)+'" oninput="fSearch=this.value;renderBatches()"></div><span style="font-size:12px;color:var(--tx3)">Sorted FEFO — earliest expiry first</span></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Line</th><th>Batch</th><th>Expiry</th><th style="text-align:right">Days left</th><th style="text-align:right">Qty received</th><th style="text-align:right">SOH</th><th>Status</th></tr></thead><tbody>'+
    (rows.length?rows.map(b=>{
      const d=expDaysLeft(b.expiry);const c=expColor(d);
      return '<tr><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis" title="'+esc(b.name)+'"><span style="font-weight:500">'+esc(b.name)+'</span></td>'+
        '<td class="mo">'+esc(b.skuCode)+'</td>'+
        '<td class="mu">'+esc(b.line||'')+'</td>'+
        '<td class="mo">'+esc(b.batch||'—')+'</td>'+
        '<td style="font-size:11px">'+esc(b.expiry||'—')+'</td>'+
        '<td class="r" style="font-weight:600;color:var(--'+(d===null?'tx3':d<0?'rd':d<=31?'rd':d<=92?'am':'gr')+')">'+( d===null?'—':d<0?Math.abs(d)+' ago':d)+'</td>'+
        '<td class="r mu">'+b.qty+'</td>'+
        '<td class="stk r">'+b.soh+'</td>'+
        '<td><span class="pill '+c+'">'+expLabel(d)+'</span></td></tr>';
    }).join(''):'<tr><td colspan="9"><div class="empty">No batches match</div></td></tr>')+
    '</tbody></table></div><div class="tfooter"><span>'+rows.length+' batches</span><span>FEFO order — pull earliest expiry first</span></div></div>';
}

/* ── MONTHLY MOVEMENT CHART ── */
function renderMovement(){
  const last12=MONTHS.slice(-12);
  $('content').innerHTML=
    '<div class="panel full" style="margin-bottom:14px"><div class="phd"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Units received vs. sold — last 12 months</div><div class="cw" style="height:280px"><canvas id="movChart" role="img" aria-label="Monthly movement chart">Monthly IN vs OUT</canvas></div></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Month</th><th style="text-align:right">Received (IN)</th><th style="text-align:right">Sold / Issued (OUT)</th><th style="text-align:right">Net</th></tr></thead><tbody>'+
    last12.slice().reverse().map(m=>{
      const inn=MONTHLY_IN[m]||0;const out=MONTHLY_OUT[m]||0;const net=inn-out;
      return '<tr><td>'+m+'</td><td class="r" style="color:var(--gr)">'+inn.toLocaleString()+'</td><td class="r" style="color:var(--rd)">'+out.toLocaleString()+'</td><td class="r" style="font-weight:600;color:'+(net>=0?'var(--gr)':'var(--rd)')+'">'+( net>=0?'+':'')+net.toLocaleString()+'</td></tr>';
    }).join('')+
    '</tbody></table></div></div>';

  if(movInst){movInst.destroy();movInst=null;}
  movInst=new Chart($('movChart'),{
    type:'bar',
    data:{
      labels:last12,
      datasets:[
        {label:'Received (IN)',data:last12.map(m=>MONTHLY_IN[m]||0),backgroundColor:'rgba(93,202,165,0.7)',borderRadius:3},
        {label:'Sold / Issued (OUT)',data:last12.map(m=>MONTHLY_OUT[m]||0),backgroundColor:'rgba(226,75,74,0.6)',borderRadius:3},
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},scales:{x:{ticks:{font:{size:10}}},y:{ticks:{font:{size:10}}}}}
  });
}

/* ── INVENTORY VALUE BY LINE ── */
function renderValue(){
  const entries=Object.entries(VALUE_BY_LINE).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((a,[,v])=>a+v,0);
  const max=entries[0]?entries[0][1]:1;
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:16px">'+
    '<div class="met gr"><div class="met-lbl">Total inventory value</div><div class="met-val" style="font-size:20px">₱'+Math.round(total).toLocaleString()+'</div><div class="met-sub">VAT-exclusive, positive stock only</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Product lines</div><div class="met-val">'+entries.length+'</div><div class="met-sub">with positive stock value</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="margin-bottom:14px"><div class="phd"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Value by product line</div>'+
    entries.map(([l,v],i)=>{
      const pct=Math.round(v/total*100);
      return '<div class="vrow"><div class="vlbl">'+esc(l)+'</div>'+
        '<div class="vbar-wrap"><div class="vbar-track"><div class="vbar-fill" style="width:'+Math.round(v/max*100)+'%;background:'+COLORS[i%COLORS.length]+'"></div></div></div>'+
        '<div class="vval">₱'+Math.round(v).toLocaleString()+' <span style="color:var(--tx3);font-size:10px">'+pct+'%</span></div></div>';
    }).join('')+'</div>'+
    '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn" onclick="exportValueCSV()"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export value report</button></div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr><th>Product line</th><th style="text-align:right">Stock value (₱)</th><th style="text-align:right">% of total</th></tr></thead><tbody>'+
    entries.map(([l,v])=>'<tr><td>'+esc(l)+'</td><td class="r" style="font-weight:600">₱'+Math.round(v).toLocaleString()+'</td><td class="r mu">'+Math.round(v/total*100)+'%</td></tr>').join('')+
    '<tr style="font-weight:700;background:var(--sf2)"><td>TOTAL</td><td class="r">₱'+Math.round(total).toLocaleString()+'</td><td class="r">100%</td></tr>'+
    '</tbody></table></div></div>';
}
function exportValueCSV(){
  const entries=Object.entries(VALUE_BY_LINE).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((a,[,v])=>a+v,0);
  const h=['Product Line','Stock Value (PHP VATex)','% of Total'];
  const rows=entries.map(([l,v])=>'"'+esc(l)+'",'+Math.round(v)+','+Math.round(v/total*100)+'%');
  rows.push('"TOTAL",'+Math.round(total)+',100%');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent([h.join(','),...rows].join('\n'));
  a.download='healthspan_value_by_line_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

/* ── TABLE (All / OOS / Low / Neg / Reorder / Bin search) ── */
function renderTable(pre){
  if(pre==='oos') fTab='oos';
  else if(pre==='low') fTab='low';
  else if(pre==='neg') fTab='neg';
  else if(pre==='reorder') fTab='reorder';
  const lines=[...new Set(DATA.map(p=>p.line).filter(Boolean))].sort();
  const cats=[...new Set(DATA.map(p=>p.category).filter(Boolean))].sort();
  const sups=[...new Set(DATA.map(p=>p.supplier).filter(Boolean))].sort();
  const tabsHTML='<div class="tabs">'+
    ['all','oos','low','neg','reorder'].map(t=>{
      const labels={all:'All',oos:'Out of stock',low:'Low stock',neg:'Negative',reorder:'Reorder alerts'};
      return '<div class="tab'+(fTab===t?' active':'')+'" onclick="setTab(\''+t+'\')">'+labels[t]+'</div>';
    }).join('')+'</div>';
  const lOpts=lines.map(l=>'<option value="'+esc(l)+'"'+(fLine===l?' selected':'')+'>'+esc(l)+'</option>').join('');
  const cOpts=cats.map(c=>'<option value="'+esc(c)+'"'+(fCat===c?' selected':'')+'>'+esc(c)+'</option>').join('');
  const sOpts=sups.map(s=>'<option value="'+esc(s)+'"'+(fSup===s?' selected':'')+'>'+esc(s)+'</option>').join('');
  $('content').innerHTML=tabsHTML+
    '<div class="toolbar">'+
    '<div class="sw"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="si" placeholder="Search SKU or name..." value="'+esc(fSearch)+'" oninput="fSearch=this.value;drawRows()"></div>'+
    '<div class="sw" style="max-width:130px"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg><input type="text" id="bi" placeholder="Bin (e.g. IB03)" value="'+esc(fBin)+'" oninput="fBin=this.value;drawRows()"></div>'+
    '<select id="li" onchange="fLine=this.value;drawRows()"><option value="">All lines</option>'+lOpts+'</select>'+
    '<select id="ci" onchange="fCat=this.value;drawRows()"><option value="">All categories</option>'+cOpts+'</select>'+
    (sups.length?'<select id="supi" onchange="fSup=this.value;drawRows()"><option value="">All suppliers</option>'+sOpts+'</select>':'')+
    '<button class="btn" id="aiCopyBtn" onclick="copyForAI()" title="Copy the filtered products with sales history as a prompt-ready text block for AI forecasting"><svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy for AI</button>'+
    '</div>'+
    '<div class="tcard"><div class="tscroll"><table><thead><tr>'+
    mkTh('sku','SKU')+mkTh('name','Product name')+mkTh('line','Line')+mkTh('category','Category')+
    mkTh('bin','Bin')+mkTh('expiry','Expiry')+mkTh('price','Price','r')+
    mkTh('velocity','Vel/mo','r')+mkTh('monthsOfStock','Mos stock','r')+mkTh('dtsBaseline','Days→out','r')+
    mkTh('received','Rcvd','r')+mkTh('sold','Sold','r')+mkTh('stock','Stock','r')+'<th>Status</th></tr></thead>'+
    '<tbody id="tbody"></tbody></table></div>'+
    '<div class="tfooter"><span id="tc"></span><span>Click row for details &middot; Vel = avg units/mo sold</span></div></div>';
  drawRows();
}
function mkTh(col,lbl,align){
  const a=sortCol===col?(sortDir>0?' &uarr;':' &darr;'):'';
  return '<th onclick="toggleSort(\''+col+'\')" class="'+(sortCol===col?'sorted':'')+'"'+(align?' style="text-align:right"':'')+'>'+lbl+a+'</th>';
}
function setTab(t){fTab=t;renderTable();}
function toggleSort(col){
  if(sortCol===col) sortDir*=-1; else{sortCol=col;sortDir=-1;}
  renderTable();
}
function currentFilteredRows(){
  const q=fSearch.toLowerCase();
  const bin=fBin.toLowerCase();
  return DATA.filter(p=>{
    if(q&&!(p.sku.toLowerCase().includes(q)||p.name.toLowerCase().includes(q))) return false;
    if(bin&&!(p.bin||'').toLowerCase().includes(bin)) return false;
    if(fLine&&p.line!==fLine) return false;
    if(fCat&&p.category!==fCat) return false;
    if(fSup&&(p.supplier||'')!==fSup) return false;
    const s=stk(p);
    if(fTab==='oos'&&s!==0) return false;
    if(fTab==='low'&&!(s!==null&&s>0&&s<10)) return false;
    if(fTab==='neg'&&!(s!==null&&s<0)) return false;
    if(fTab==='reorder'&&!isReorderAlert(p)) return false;
    return true;
  });
}
function drawRows(){
  let rows=currentFilteredRows();
  rows.sort((a,b)=>{
    let av=a[sortCol],bv=b[sortCol];
    if(av==null)av=''; if(bv==null)bv='';
    if(typeof av==='number'&&typeof bv==='number') return (av-bv)*sortDir;
    return String(av).localeCompare(String(bv))*sortDir;
  });
  const tbody=$('tbody');
  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="14"><div class="empty">No products match</div></td></tr>';
  } else {
    tbody.innerHTML=rows.map(p=>{
      const s=stk(p);const st=statusOf(s);
      const sc=s<0?'color:var(--rd)':s===0?'color:var(--rd)':s!==null&&s<10?'color:var(--am)':'';
      const ew=expSoon(p.expiry)?'color:var(--am);font-weight:600':'';
      const vel=p.velocity||0;
      const velC=vel>50?'vel-hot':vel>10?'vel-med':'vel-slow';
      const mos=p.monthsOfStock;
      const reorderFlag=isReorderAlert(p)?'<span class="pill prd" style="margin-left:4px">Reorder</span>':'';
      return '<tr onclick="openDrawer(\''+esc(p.sku)+'\')">'+
        '<td class="mo">'+esc(p.sku)+'</td>'+
        '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis" title="'+esc(p.name)+'">'+esc(p.name)+reorderFlag+'</td>'+
        '<td class="mu" style="max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(p.line||'')+'</td>'+
        '<td class="mu">'+esc(p.category||'')+'</td>'+
        '<td class="mo mu">'+esc(p.bin||'—')+'</td>'+
        '<td style="font-size:11px;'+ew+'">'+esc(p.expiry||'—')+'</td>'+
        '<td class="r mu" style="font-size:11px">'+fmtP(p.price)+'</td>'+
        '<td class="r"><span class="vel-badge '+velC+'">'+vel+'</span></td>'+
        '<td class="r mu" style="font-size:11px">'+(mos!==null?mos+'mo':'—')+'</td>'+
        '<td class="r" style="font-size:11px">'+(p.dtsBaseline!=null?(p.dtsBaseline===0?'<span style="color:var(--rd);font-weight:600">Out</span>':p.dtsBaseline+'d'):'—')+'</td>'+
        '<td class="r mu">'+(p.received||0).toLocaleString()+'</td>'+
        '<td class="r mu">'+(p.sold||0).toLocaleString()+'</td>'+
        '<td class="stk r" style="'+sc+'">'+(s!==null?s.toLocaleString():'—')+'</td>'+
        '<td><span class="pill '+st.c+'">'+st.l+'</span></td>'+
        '</tr>';
    }).join('');
  }
  $('tc').textContent=rows.length+' of '+DATA.length+' SKUs';
}

/* ── DRAWER ── */
function openDrawer(sku){
  const p=DATA.find(x=>x.sku===sku);if(!p) return;
  const s=stk(p);const st=statusOf(s);
  const vel=p.velocity||0;const mos=p.monthsOfStock;
  const sellThru=p.received>0?Math.min(100,Math.round(p.sold/p.received*100)):0;
  const sc=s<0?'var(--rd)':s===0?'var(--rd)':s!==null&&s<10?'var(--am)':'var(--gr)';
  const velC=vel>50?'vel-hot':vel>10?'vel-med':'vel-slow';
  // Batches for this SKU
  const skuBatches=BATCHES.filter(b=>b.skuCode===sku||b.name===p.name).slice(0,5);
  const batchHTML=skuBatches.length?'<div class="dsec"><div class="dsectitle">Batches (FEFO order)</div>'+
    skuBatches.map(b=>{
      const d=expDaysLeft(b.expiry);const c=expColor(d);
      return '<div class="drow"><span class="dlbl">'+esc(b.batch||'—')+'</span><span class="dval"><span class="pill '+c+'" style="margin-right:4px">'+expLabel(d)+'</span>'+b.soh+' SOH</span></div>';
    }).join('')+'</div>':'';
  const reorderT=REORDER[sku]||'';
  $('dbody').innerHTML=
    '<div class="dsku">'+esc(sku)+'</div>'+
    '<div class="dname">'+esc(p.name)+'</div>'+
    '<span class="pill '+st.c+'">'+st.l+'</span>'+
    '<div class="dstk" style="color:'+sc+'">'+(s!==null?s.toLocaleString():'—')+'</div>'+
    '<div class="dsub">units on hand</div>'+
    '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
    '<span class="vel-badge '+velC+'">'+(vel>0?vel+' units/mo avg':'No recent sales')+'</span>'+
    (mos!==null?'<span class="vel-badge '+(mos<2?'vel-hot':mos<6?'vel-med':'vel-slow')+'">'+mos+' months of stock</span>':'')+'</div>'+
    '<div class="dvel"><div class="dvhd"><span>Sell-through</span><span>'+sellThru+'%</span></div><div class="dvtrack"><div class="dvfill" style="width:'+sellThru+'%"></div></div></div>'+
    '<div class="dsec"><div class="dsectitle">Product</div>'+
    '<div class="drow"><span class="dlbl">Line</span><span class="dval">'+esc(p.line||'—')+'</span></div>'+
    '<div class="drow"><span class="dlbl">Category</span><span class="dval">'+esc(p.category||'—')+'</span></div>'+
    '<div class="drow"><span class="dlbl">Supplier</span><span class="dval">'+esc(p.supplier||'—')+'</span></div>'+
    '<div class="drow"><span class="dlbl">Price (VATex)</span><span class="dval">'+fmtP(p.price)+(p.priceSrc==='shopify'?' <span class="pill pgr" title="Live price from Shopify">Shopify</span>':'')+'</span></div>'+
    (p.priceSrc==='shopify'&&p.priceSheet>0&&Math.abs(p.priceSheet-p.price)>1?'<div class="drow"><span class="dlbl">Sheet price (differs)</span><span class="dval" style="color:var(--am)">'+fmtP(p.priceSheet)+'</span></div>':'')+
    '<div class="drow"><span class="dlbl">Stock value</span><span class="dval">'+(s>0&&p.price?fmtP(s*p.price):'—')+'</span></div>'+
    '</div>'+
    '<div class="dsec"><div class="dsectitle">Warehouse</div>'+
    '<div class="drow"><span class="dlbl">Bin location</span><span class="dval">'+esc(p.bin||'—')+'</span></div>'+
    '<div class="drow"><span class="dlbl">Batch</span><span class="dval">'+esc(p.batch||'—')+'</span></div>'+
    '<div class="drow"><span class="dlbl">Expiry</span><span class="dval" style="'+(expSoon(p.expiry)?'color:var(--am);font-weight:600':'')+'">'+esc(p.expiry||'—')+'</span></div>'+
    '</div>'+
    '<div class="dsec"><div class="dsectitle">Movement</div>'+
    '<div class="drow"><span class="dlbl">Total received</span><span class="dval">'+(p.received||0).toLocaleString()+' units</span></div>'+
    '<div class="drow"><span class="dlbl">Total sold/issued</span><span class="dval">'+(p.sold||0).toLocaleString()+' units</span></div>'+
    '<div class="drow"><span class="dlbl">Avg velocity</span><span class="dval">'+vel+' units/mo</span></div>'+
    '<div class="drow"><span class="dlbl">Months of stock</span><span class="dval">'+(mos!==null?mos+' months':'—')+'</span></div>'+
    (p.shopifySales?(()=>{const yms=Object.keys(p.shopifySales).sort();const last3=yms.slice(-3);return '<div class="drow"><span class="dlbl">Shopify demand (recent)</span><span class="dval">'+last3.map(m=>m.slice(5)+': '+p.shopifySales[m]+'u').join(' · ')+'</span></div>';})():'')+
    '</div>'+
    ((p.monthly&&p.monthly.some(v=>v>0))||p.shopifySales?
      '<div class="dsec"><div class="dsectitle">Monthly trend — 13 months</div><div style="height:150px"><canvas id="drawer-trend"></canvas></div>'+
      '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Shipped = warehouse OUT (sheet) · Booked = Shopify order units · last point is the current partial month</div></div>':'')+
    (p.deals&&p.deals.length?'<div class="dsec"><div class="dsectitle">Live deals on Shopify</div>'+p.deals.map(d=>'<div class="drow"><span class="dlbl" style="max-width:190px;overflow:hidden;text-overflow:ellipsis">'+esc(d.title)+'</span><span class="dval">'+d.setSize+' units · '+fmtP(d.price)+'</span></div>').join('')+'</div>':'')+
    batchHTML+
    (()=>{const c=ropCalc(p);const dts=dtsBaseline(p);
      return '<div class="dsec"><div class="dsectitle">Reorder intelligence</div>'+
      '<div class="drow"><span class="dlbl">Days to stockout</span><span class="dval">'+(dts!=null?(dts===0?'<span style="color:var(--rd);font-weight:600">Out now</span>':dts+' days'):'—')+'</span></div>'+
      '<div class="drow"><span class="dlbl">Demand variability</span><span class="dval">'+cvBadge(p)+'</span></div>'+
      '<div class="drow"><span class="dlbl">Supplier lead time</span><span class="dval">'+c.lead+' days</span></div>'+
      '<div class="drow"><span class="dlbl">Safety stock</span><span class="dval">'+((p.velAdj||0)>0?c.safety.toLocaleString()+' units':'—')+'</span></div>'+
      '<div class="drow"><span class="dlbl">Reorder point</span><span class="dval" style="font-weight:700;color:var(--ac)">'+((p.velAdj||0)>0?c.rop.toLocaleString()+' units':'—')+'</span></div>'+
      '<div class="drow"><span class="dlbl">Status</span><span class="dval">'+(c.below?'<span class="pill prd">Below reorder point</span>':((p.velAdj||0)>0?'<span class="pill pgr">Above reorder point</span>':'<span class="pill pgy">No demand</span>'))+'</span></div>'+
      '</div>';})()+
    '<div class="dsec"><div class="dsectitle">Reorder threshold</div>'+
    '<div class="reorder-row"><label>Alert me when stock falls below:</label><input type="number" min="0" id="reorder-inp" value="'+esc(reorderT)+'" placeholder="e.g. 20"><button class="btn" style="flex-shrink:0" onclick="saveReorder(\''+esc(sku)+'\')">Save</button></div>'+
    '<div style="font-size:10.5px;color:var(--tx3);margin-top:5px">Reorder alerts are session-based (not persisted)</div>'+
    '</div>';
  $('overlay').classList.add('open');
  $('drawer').classList.add('open');
  // monthly trend chart (units): warehouse OUT vs Shopify booked
  try{
    const cv=document.getElementById('drawer-trend');
    if(cv&&window.Chart&&MONTHS.length){
      if(window._drawerChart){try{window._drawerChart.destroy();}catch(e){}}
      const labels=MONTHS.map(m=>new Date(m+'-15').toLocaleString('en',{month:'short'}));
      const shipped=MONTHS.map((m,i)=>(p.monthly&&p.monthly[i])||0);
      const booked=p.shopifySales?MONTHS.map(m=>p.shopifySales[m]??null):null;
      const cs=getComputedStyle(document.body);
      const ds=[{label:'Shipped',data:shipped,borderColor:cs.getPropertyValue('--ac').trim()||'#0f6e56',backgroundColor:'transparent',tension:.35,pointRadius:2.5,borderWidth:2}];
      if(booked&&booked.some(v=>v!=null))ds.push({label:'Booked (Shopify)',data:booked,borderColor:cs.getPropertyValue('--am-lt').trim()||'#ef9f27',backgroundColor:'transparent',borderDash:[5,4],tension:.35,pointRadius:2,borderWidth:1.5,spanGaps:true});
      window._drawerChart=new Chart(cv,{type:'line',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:ds.length>1,labels:{boxWidth:14,font:{size:10},color:cs.getPropertyValue('--tx2').trim()}}},
        scales:{y:{beginAtZero:true,ticks:{font:{size:9},color:cs.getPropertyValue('--tx3').trim()},grid:{color:cs.getPropertyValue('--bd').trim()}},
                x:{ticks:{font:{size:9},color:cs.getPropertyValue('--tx3').trim(),maxRotation:0},grid:{display:false}}}}});
    }
  }catch(e){}
}
function saveReorder(sku){
  const v=parseInt($('reorder-inp').value);
  if(!isNaN(v)&&v>=0){REORDER[sku]=v;}else{delete REORDER[sku];}
  refreshSidebar();
  if(currentView==='all'||currentView==='reorder') drawRows();
}
function closeDrawer(){$('overlay').classList.remove('open');$('drawer').classList.remove('open');}

