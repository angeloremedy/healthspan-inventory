/* ── BUSINESS REVIEW ─────────────────────────────────────────────────────────
   The monthly sales performance report, generated from HQ instead of typed
   into PowerPoint. Everything numeric is computed here from the Shopify cache
   (external sales only — the same rule as targets and scorecards), the Targets
   tab / spec_targets, the visit log, account ownership and the serial register.
   People type only the commentary: the sales manager owns the wins / challenges
   / territory / plan boxes, each specialist owns their own box. Every box shows
   what it said in the previous report so the change is visible. "Save snapshot"
   freezes the figures so the next report can say what moved since last time.
   "Export PowerPoint" builds the deck client-side (pptxgenjs from a CDN).      */

const BIZ_SECTIONS=[['wins','Key wins'],['challenges','Key challenges'],['territory','Territory updates'],
                    ['plan','Plan of action'],['program','Sales programs & promos'],['forecast','Sales plan notes']];
/* a specialist's own report: five text boxes + a per-account forecast table (JSON) */
const BIZ_PS_SECTIONS=[['wins','Key wins'],['challenges','Key challenges'],['territory','Territory updates'],['activities','Training & marketing activities'],['proposals','Proposals / recommendations']];
const BIZ_PS_ALL=BIZ_PS_SECTIONS.map(x=>x[0]).concat(['forecast']);
function bizPsSec(tag,key){return 'ps:'+tag+':'+key;}
function bizNote(section){ // a saved row, with the pre-split 'ps:Tag' box standing in for Key wins
  const n=BIZ.notes[section];if(n)return n;const m=String(section).match(/^ps:([^:]+):wins$/i);return m?(BIZ.notes['ps:'+m[1]]||null):null;}
function bizForecast(tag){try{const n=BIZ.notes[bizPsSec(tag,'forecast')];return n&&n.body?JSON.parse(n.body):{};}catch(e){return {};}}
const BIZ_PPTX_CDN=['https://cdnjs.cloudflare.com/ajax/libs/PptxGenJS/3.12.0/pptxgen.bundle.js',
                    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'];
let BIZ={ym:null,R:null,notes:{},prevNotes:{},snaps:null,prev:null,busy:false};

/* ── month arithmetic (all on 'YYYY-MM' strings, no Date timezone traps) ── */
function bizYmAdd(ym,n){const y=+ym.slice(0,4),m=+ym.slice(5,7)-1+n;const d=new Date(Date.UTC(y,m,1));return d.toISOString().slice(0,7);}
function bizPrevYm(ym){return bizYmAdd(ym,-1);}
function bizMonthKeys(n,endYm){const out=[];for(let i=n-1;i>=0;i--)out.push(bizYmAdd(endYm,-i));return out;}
function bizQtrMonths(ym){const m=+ym.slice(5,7);const q0=m-((m-1)%3);const out=[];for(let k=q0;k<=m;k++)out.push(ym.slice(0,5)+String(k).padStart(2,'0'));return out;}
function bizYtdMonths(ym){const m=+ym.slice(5,7);const out=[];for(let k=1;k<=m;k++)out.push(ym.slice(0,5)+String(k).padStart(2,'0'));return out;}
function bizDaysIn(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).getUTCDate();}
function bizMonthLbl(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1,1)).toLocaleDateString('en-PH',{month:'long',year:'numeric',timeZone:'UTC'});}
function bizShortLbl(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1,1)).toLocaleDateString('en-PH',{month:'short',timeZone:'UTC'});}
function bizToday(){return new Date().toISOString().slice(0,10);} // UTC, like the cache's month keys and sumPeriod
function bizPct(a,b){return (b>0)?a/b*100:null;}
function bizFmtPct(p){return p==null?'—':Math.round(p)+'%';}
function bizCompact(v){v=Math.round(v||0);const a=Math.abs(v);if(a>=1e6)return (v<0?'-':'')+'₱'+(a/1e6).toFixed(a>=1e7?1:2).replace(/\.?0+$/,'')+'M';if(a>=1e3)return (v<0?'-':'')+'₱'+(a/1e3).toFixed(0)+'K';return '₱'+v.toLocaleString('en-PH');}
function bizDelta(cur,prev){if(!(prev>0))return cur>0?'new':'—';const d=(cur-prev)/prev*100;return (d>=0?'+':'')+Math.round(d)+'%';}
function bizDeltaTone(cur,prev){if(!(prev>0))return cur>0?'gr':'gy';return cur>=prev*1.05?'gr':cur<=prev*0.95?'rd':'am';}

/* targets: the Targets tab + spec_targets, already merged into TARGETS (js/04) */
function bizTgt(scope,name,months){
  let s=0,hit=false;const n=String(name||'').toLowerCase();
  for(const t of (TARGETS||[])){
    if(t.scope!==scope||!months.includes(t.month))continue;
    if(scope==='SPECIALIST'){if(specCanon(t.name).toLowerCase()!==specCanon(name).toLowerCase())continue;} // alias-safe, like scorecards
    else if(scope!=='TOTAL'&&String(t.name||'').toLowerCase()!==n)continue;
    s+=(+t.value||0);hit=true;}
  return hit?s:null;}
function bizTgtMonths(scope,name,months){ // how many of the months actually have a target row
  const n=String(name||'').toLowerCase();const set=new Set();
  for(const t of (TARGETS||[])){if(t.scope!==scope||!months.includes(t.month))continue;
    if(scope==='SPECIALIST'){if(specCanon(t.name).toLowerCase()!==specCanon(name).toLowerCase())continue;}else if(scope!=='TOTAL'&&String(t.name||'').toLowerCase()!==n)continue;set.add(t.month);}
  return set.size;}
function bizTgtProduct(sku,name,months){ // exact SKU, exact name, then name-contains (>=4 chars) — the same ladder as the Vs-target view
  const a=bizTgt('PRODUCT',sku,months);if(a!=null)return a;const b=bizTgt('PRODUCT',name,months);if(b!=null)return b;
  const nm=String(name||'').toLowerCase();let s=0,hit=false;
  for(const t of (TARGETS||[])){if(t.scope!=='PRODUCT'||!months.includes(t.month))continue;const k=String(t.name||'').toLowerCase();
    if(k.length>=4&&nm.includes(k)){s+=(+t.value||0);hit=true;}}
  return hit?s:null;}

/* Brands as the meeting talks about them: the sheet's product lines roll up into the
   brand a target is set for. Targets-tab names are matched loosely ("MESO", "MARK-VU",
   "SYMMED CONSUMBALES") so a typo in the sheet never zeroes a brand's attainment. */
const BIZ_GROUPS=[
  {name:'Innoaesthetics',test:/^(inno|meline)/i,aliases:['innoaesthetics','innoaesthetic','inno','meline','innotds','innoderma','innoce','innoexoma','innoepigen','innoexfo','innomkt','innoshopify']},
  {name:'Mesoestetic',test:/^meso/i,aliases:['meso','mesoestetic']},
  {name:'SkinPen',test:/^skinpen/i,aliases:['skinpen']},
  {name:'BioJuve',test:/^biojuve/i,aliases:['biojuve']},
  {name:'Symmed (Termosalud)',test:/^(symmed|termosalud)/i,aliases:['symmed','symmedconsumables','symmedconsumbales','termosalud','termosaludmkt']},
  {name:'Zionic',test:/^zionic/i,aliases:['zionic','zionicconsumables']},
  {name:'Mark-Vu',test:/^mark/i,aliases:['markvu','psiplus']},
  {name:'Unmapped (Shopify)',test:/^shopify only$/i,aliases:[]}];
function bizNorm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function bizGroupOf(line){const g=BIZ_GROUPS.find(g=>g.test.test(String(line||'').trim()));return g?g.name:(line||'(no line)');}
function bizGroupAliases(group){const g=BIZ_GROUPS.find(g=>g.name===group);return new Set(g?g.aliases.concat([bizNorm(g.name)]):[bizNorm(group)]);}
function bizLineTgt(group,months){const al=bizGroupAliases(group);let s=0,hit=false;
  for(const t of (TARGETS||[])){if(t.scope!=='LINE'||!months.includes(t.month))continue;if(!al.has(bizNorm(t.name)))continue;s+=(+t.value||0);hit=true;}
  return hit?s:null;}
function bizCanEditAll(){return canManage()||isSuper();}
function bizMySpec(){return specCanon((SBPROFILE&&SBPROFILE.specialist_tag)||'');}
// mirrors the RLS policy exactly: the raw profile tag, not the alias — so a profile tagged
// 'Kristine' cannot edit 'ps:Tin' here either (fix the tag in Team, not the code)
function bizCanEdit(section){if(bizCanEditAll())return true;const raw=String((SBPROFILE&&SBPROFILE.specialist_tag)||'').trim();const parts=String(section).split(':');return !!raw&&parts[0]==='ps'&&(parts[1]||'').toLowerCase()===raw.toLowerCase();}
function bizMonthsAvail(){
  const set=new Set();for(const k in (SALESIDX||{}))for(const m in (SALESIDX[k].monthly||{}))set.add(m);
  const cur=bizToday().slice(0,7);set.add(cur);
  return [...set].filter(m=>m<=cur).sort().reverse().slice(0,13);}
function bizOrdersFrom(){return String((SHOPIFY&&SHOPIFY.recentFrom)||'').slice(0,10);} // the order index only reaches back this far

/* ── the numbers ─────────────────────────────────────────────────────────── */
function bizCompute(ym){
  const today=bizToday();const curYm=today.slice(0,7);
  const dim=bizDaysIn(ym);
  const day=(ym===curYm)?+today.slice(8,10):dim;
  const asOf=(ym===curYm)?today:ym+'-'+String(dim).padStart(2,'0');
  const elapsed=Math.max(1,day)/dim;
  const prev=bizPrevYm(ym),qM=bizQtrMonths(ym),yM=bizYtdMonths(ym),series=bizMonthKeys(13,ym);
  const early=(ym===curYm)&&day<4;
  const ordersFrom=bizOrdersFrom();const ordersComplete=!ordersFrom||(ym+'-01')>=ordersFrom;const recentCapped=!!(SHOPIFY&&SHOPIFY.recent&&SHOPIFY.recent.length>=2500); // first three days: month-to-date ÷ elapsed is noise, not a projection
  const R={ym,prev,asOf,day,dim,elapsed,early,current:ym===curYm,ordersFrom,ordersComplete,recentCapped,intSplit:hasIntSplit(),series,label:bizMonthLbl(ym),generated:new Date().toISOString(),
    total:{},brands:[],products:[],specs:[],accounts:{},machines:{},activity:{},trends:[],notesAuto:{}};

  /* brands + products from the per-SKU index (external only) */
  const lines={};const tot={};const totU={};const prods=[];
  const allM=[...new Set([...series,...qM,...yM])];
  for(const sku in (SALESIDX||{})){
    const S=SALESIDX[sku];const nm=netMonthly(S,'',true),nb=netMonthly(S,'b',true);
    const rev=m=>(((nm[m]||{}).v)||0)+(((nb[m]||{}).v)||0);const un=m=>((nm[m]||{}).u)||0;
    const raw=S.line||'(no line)';const L=bizGroupOf(raw);const e=lines[L]||(lines[L]={name:L,m:{},u:{},raw:new Set()});e.raw.add(raw);
    for(const m of allM){const v=rev(m),u=un(m);e.m[m]=(e.m[m]||0)+v;e.u[m]=(e.u[m]||0)+u;tot[m]=(tot[m]||0)+v;totU[m]=(totU[m]||0)+u;}
    const v=rev(ym),u=un(ym),pv=rev(prev),pu=un(prev);
    if(v>0||u>0||pv>0)prods.push({sku,name:S.name||sku,line:L,raw,u,v,pv,pu,f:((nm[ym]||{}).f)||0,d:((nm[ym]||{}).d)||0,
      deal:((nb[ym]||{}).v)||0,tgt:bizTgtProduct(sku,S.name,[ym]),equip:false});}
  const sumM=(o,ms)=>ms.reduce((s,m)=>s+(o[m]||0),0);
  R.brands=Object.values(lines).map(e=>{
    const mtd=e.m[ym]||0,qtd=sumM(e.m,qM),ytd=sumM(e.m,yM),pm=e.m[prev]||0;
    const tgt=bizLineTgt(e.name,[ym]),qtgt=bizLineTgt(e.name,qM),ytgt=bizLineTgt(e.name,yM);
    return {name:e.name,lines:[...e.raw].sort(),mtd,units:e.u[ym]||0,prev:pm,tgt,qtd,qtgt,ytd,ytgt,att:bizPct(mtd,tgt),qatt:bizPct(qtd,qtgt),yatt:bizPct(ytd,ytgt),
      proj:mtd/elapsed,series:series.map(m=>e.m[m]||0)};})
    .filter(b=>b.mtd>0||b.tgt||b.qtd>0||b.ytd>0).sort((a,b)=>b.mtd-a.mtd);
  const lineTgt=ms=>{let s=0,hit=false;for(const b of R.brands){const t=bizLineTgt(b.name,ms);if(t!=null){s+=t;hit=true;}}return hit?s:null;};
  const specTgt=ms=>{let s=0,hit=false;for(const t of (TARGETS||[]))if(t.scope==='SPECIALIST'&&ms.includes(t.month)&&!INTERNAL_TAG.test(t.name||'')){s+=(+t.value||0);hit=true;}return hit?s:null;};
  const totTgt=ms=>{const t=bizTgt('TOTAL','',ms);if(t!=null)return t;const l=lineTgt(ms);if(l!=null)return l;return specTgt(ms);};
  const mtd=tot[ym]||0;
  R.total={mtd,units:totU[ym]||0,prev:tot[prev]||0,tgt:totTgt([ym]),qtd:sumM(tot,qM),qtgt:totTgt(qM),ytd:sumM(tot,yM),ytgt:totTgt(yM),
    proj:mtd/elapsed,series:series.map(m=>tot[m]||0),tgtSrc:bizTgt('TOTAL','',[ym])!=null?'TOTAL target':lineTgt([ym])!=null?'sum of brand targets':specTgt([ym])!=null?'sum of specialist targets':'no target set'};
  R.total.att=bizPct(mtd,R.total.tgt);R.total.qatt=bizPct(R.total.qtd,R.total.qtgt);R.total.yatt=bizPct(R.total.ytd,R.total.ytgt);
  R.total.projAtt=bizPct(R.total.proj,R.total.tgt);
  prods.sort((a,b)=>(b.v-a.v)||(b.u-a.u));R.products=prods;

  /* orders: one row per order, rebuilt from the per-SKU order index */
  const ords={};
  for(const sku in (ORDIDX||{})){const L=(SALESIDX[sku]&&SALESIDX[sku].line)||'(no line)';
    for(const o of ORDIDX[sku]){if(!o||!o.n)continue;if(ordInternal(o))continue;
      const e=ords[o.n]||(ords[o.n]={n:o.n,dt:o.dt||'',t:specCanon(o.t||''),c:o.c||'',a:0,skus:{},units:{},lines:new Set()});
      e.a+=(+o.a||0);e.skus[sku]=(e.skus[sku]||0)+(+o.a||0);e.units[sku]=(e.units[sku]||0)+(+o.q||0);e.lines.add(L);}}
  const O=Object.values(ords);
  const first={},last={},nRecent={};
  for(const o of O){if(!o.c)continue;if(!first[o.c]||o.dt<first[o.c])first[o.c]=o.dt;if(!last[o.c]||o.dt>last[o.c])last[o.c]=o.dt;nRecent[o.c]=(nRecent[o.c]||0)+1;}
  const custs=(SHOPIFY&&SHOPIFY.customers)||{};
  const isNewAcct=c=>{if(!ordersComplete)return false;if(!first[c]||first[c].slice(0,7)!==ym)return false;const cc=custs[c];return !cc||((cc.o||0)-(cc.io||0))<=(nRecent[c]||0);};

  /* specialists */
  const sm=specMerged();const specs={};
  // the roster: Shopify tags + specialist targets + the active roster. Owners, visit
  // authors and order tags only LOOK UP — a manager who logs a visit must not become a slide
  const getSpec=(n,create)=>{const k=specCanon(n);if(!k||INTERNAL_TAG.test(k))return null;const lk=k.toLowerCase();
    if(!create)return specs[lk]||null;
    return specs[lk]||(specs[lk]={name:k,label:specDisplay(k),team:specTeam(k),order:specOrder(k),mtd:0,prev:0,qtd:0,ytd:0,units:0,tgt:null,qtgt:null,ytgt:null,series:series.map(()=>0),
      lines:{},skus:{},accts:{},acctAll:{},prodLine:{},kits:{},events:0,demoV:0,orders:0,ordAccts:new Set(),newAccts:[],owned:new Set(),tagged:new Set(),active:0,
      visits:0,calls:0,demos:0,ordered:0,opened:0,touched:new Set()});};
  // Who is a specialist? The HQ accounts that carry a specialist tag (spec_directory).
  // Only when no directory exists yet do Shopify tags / targets / the roster stand in —
  // that fallback is what let "GMA 2", "Vacant" and territory tags masquerade as people.
  const isTestAcct=r=>/\btest\b|dummy|sample/i.test(String(r.tag||''))||/\btest\b|dummy/i.test(String(r.name||''));
  const dir=(SPEC_DIR||[]).filter(r=>r&&r.tag&&r.active!==false&&!isTestAcct(r));R.rosterSrc=dir.length?'directory':'tags';
  if(dir.length)for(const r of dir)getSpec(r.tag,true);
  const unassigned={v:0,tags:[]};
  for(const n in sm){let s=getSpec(n,!dir.length);
    if(!s){if(!INTERNAL_TAG.test(specCanon(n))){const nm0=netMonthly(sm[n],'',true);const v0=((nm0[ym]||{}).v)||0;if(v0>0){unassigned.v+=v0;unassigned.tags.push(specCanon(n));}}continue;}
    const nm=netMonthly(sm[n],'',true);const rev=m=>((nm[m]||{}).v)||0;
    s.mtd+=rev(ym);s.prev+=rev(prev);s.qtd+=sumM(Object.fromEntries(Object.keys(nm).map(m=>[m,rev(m)])),qM);
    s.ytd+=sumM(Object.fromEntries(Object.keys(nm).map(m=>[m,rev(m)])),yM);s.units+=((nm[ym]||{}).u)||0;
    s.series=series.map((m,i)=>s.series[i]+rev(m));}
  if(!dir.length){for(const t of (TARGETS||[]))if(t.scope==='SPECIALIST'&&(t.month===ym||qM.includes(t.month)||yM.includes(t.month)))getSpec(t.name,true);
    try{for(const n of (typeof specNames==='function'?specNames():[]))getSpec(n,true);}catch(e){}}
  R.unassigned=unassigned;
  for(const lk in specs){const s=specs[lk];s.tgt=bizTgt('SPECIALIST',s.name,[ym]);s.qtgt=bizTgt('SPECIALIST',s.name,qM);s.ytgt=bizTgt('SPECIALIST',s.name,yM);
    s.nextTgt=bizTgt('SPECIALIST',s.name,[bizYmAdd(ym,1)]);}

  /* orders → accounts, per specialist and company-wide */
  const acctRev={},acctPrev={},acctOrd={},acctLines={},acctSpec={};
  for(const o of O){const inM=o.dt.slice(0,7)===ym,inP=o.dt.slice(0,7)===prev;const s=o.t?getSpec(o.t):null;
    if(s&&o.c){s.tagged.add(o.c);
      // the specialist's whole order window (~6 months): per-account totals, months active, last order, kits
      const A=s.acctAll[o.c]||(s.acctAll[o.c]={v6:0,mtd:0,prev:0,orders:0,months:new Set(),last:'',first:''});
      A.v6+=o.a;A.orders++;A.months.add(o.dt.slice(0,7));if(o.dt>A.last)A.last=o.dt;if(!A.first||o.dt<A.first)A.first=o.dt;
      if(inM)A.mtd+=o.a;if(inP)A.prev+=o.a;
      for(const sku in o.skus){const nm=(SALESIDX[sku]&&SALESIDX[sku].name)||sku;if(/treatment\s*kit/i.test(nm)||sku==='F5SP072'){ // SkinPen utilisation = kits per account per month
        const K=s.kits[o.c]||(s.kits[o.c]={});K[o.dt.slice(0,7)]=(K[o.dt.slice(0,7)]||0)+(o.units[sku]||0);}}}
    if(inP&&o.c)acctPrev[o.c]=(acctPrev[o.c]||0)+o.a;
    if(!inM)continue;
    if(o.c){acctRev[o.c]=(acctRev[o.c]||0)+o.a;acctOrd[o.c]=(acctOrd[o.c]||0)+1;
      const al=acctLines[o.c]||(acctLines[o.c]=new Set());o.lines.forEach(l=>al.add(l));
      const as=acctSpec[o.c]||(acctSpec[o.c]={});if(s)as[s.name]=(as[s.name]||0)+o.a;}
    if(s){s.orders++;if(o.c){s.ordAccts.add(o.c);s.accts[o.c]=(s.accts[o.c]||0)+o.a;}
      for(const sku in o.skus){s.skus[sku]=(s.skus[sku]||0)+o.skus[sku];const L=bizGroupOf((SALESIDX[sku]&&SALESIDX[sku].line)||'(no line)');s.lines[L]=(s.lines[L]||0)+o.skus[sku];
        const PL=s.prodLine[L]||(s.prodLine[L]={});PL[sku]=(PL[sku]||0)+o.skus[sku];}}}
  const newAccts=Object.keys(acctRev).filter(isNewAcct);
  for(const c of newAccts){const as=acctSpec[c]||{};const top=Object.keys(as).sort((a,b)=>as[b]-as[a])[0];const s=top?getSpec(top):null;if(s)s.newAccts.push(c);}

  /* account universe: ownership + Shopify history */
  const shopByNorm={};
  // every figure here is the external slice; the last-order date comes from external orders in the
  // index, or from the cache only when the account has never had an internal order (cc.l is all orders)
  for(const n in custs){const cc=custs[n];const k=custNorm(acctDedup(n));if(!k)continue;if(cc.int)continue;const e=shopByNorm[k]||(shopByNorm[k]={v90:0,v:0,o:0,l:'',int:false,name:n});
    e.v90+=(cc.v90||0)-(cc.iv90||0);e.v+=(cc.v||0)-(cc.iv||0);e.o+=(cc.o||0)-(cc.io||0);
    const l=last[n]||((cc.io||0)===0?(cc.l||''):'');if(l>e.l)e.l=l;}
  for(const k in (OWNERS||{})){const s=getSpec(OWNERS[k]);if(s)s.owned.add(k);}
  for(const lk in specs){const s=specs[lk];const all=new Set([...s.owned,...[...s.tagged].map(c=>custNorm(acctDedup(c)))].filter(Boolean));
    s.masterlist=all.size;s.active=[...all].filter(k=>shopByNorm[k]&&shopByNorm[k].v90>0).length;
    s.quiet=[...all].filter(k=>shopByNorm[k]&&!shopByNorm[k].int&&shopByNorm[k].o>=2&&shopByNorm[k].v90<=0).length;}

  /* visit log (rolling 120 days, so only the current and previous month are complete) */
  for(const v of (VISITS||[])){if(v.status==='planned'||!v.date||v.date.slice(0,7)!==ym)continue;if(INTERNAL_TAG.test(String(v.account||'').trim()))continue;const s=getSpec(v.spec);if(!s)continue;
    if(/call|viber|follow-?up/i.test(v.type||''))s.calls++;else s.visits++;
    if(/demo/i.test(v.type||''))s.demos++;if(/event|congress|masterclass|training/i.test(v.type||''))s.events++;if(v.outcome==='Ordered')s.ordered++;if(v.outcome==='New account opened')s.opened++;
    if(v.account)s.touched.add(custNorm(v.account));}
  R.activity={visits:0,calls:0,demos:0,ordered:0,opened:0,partial:(VISITS||[]).length?false:true};
  for(const lk in specs){const s=specs[lk];R.activity.visits+=s.visits;R.activity.calls+=s.calls;R.activity.demos+=s.demos;R.activity.ordered+=s.ordered;R.activity.opened+=s.opened;}
  const winStart=new Date(Date.now()-120*864e5).toISOString().slice(0,10);R.activity.window=winStart;R.activity.complete=ym+'-01'>=winStart;

  /* machines: any SKU with a serial number is equipment */
  const eq=new Set((SERIALS||[]).map(s=>s.sku));
  const catOf={};for(const p of (DATA||[]))catOf[p.sku]=p.category||'';
  for(const p of R.products)p.equip=eq.has(p.sku)||isEquipment(p.sku,p.name,p.raw,catOf[p.sku]);
  for(const p of R.products)if(p.equip)eq.add(p.sku);
  // a machine with no product target of its own inherits the brand target when it is the brand's only machine
  for(const p of R.products)if(p.equip&&p.tgt==null){const sib=R.products.filter(q=>q.equip&&q.line===p.line);if(sib.length===1){const t=bizLineTgt(p.line,[ym]);if(t!=null){p.tgt=t;p.tgtFrom='brand';}}}
  const notInt=t=>!INTERNAL_TAG.test(String(t||'').trim());
  const sold=(SERIALS||[]).filter(s=>s.status==='sold'&&String(s.updated_at||'').slice(0,7)===ym&&notInt(s.sold_ref)&&notInt(s.note));
  const lo=(LOANS||[]).filter(l=>notInt(l.account)); // demo units at Remedy branches are internal moves, not field demos
  R.machines={skus:eq.size,installs:sold.length,installList:sold.map(s=>({sku:s.sku,serial:s.serial,ref:s.sold_ref||''})),
    loansOut:lo.filter(l=>String(l.out_date||'').slice(0,7)===ym).length,converted:lo.filter(l=>l.status==='converted'&&String(l.updated_at||'').slice(0,7)===ym).length,
    onLoan:lo.filter(l=>l.status==='out').length,inStock:(SERIALS||[]).filter(s=>s.status==='in_stock').length,
    rev:R.products.filter(p=>p.equip).reduce((s,p)=>s+p.v,0),units:R.products.filter(p=>p.equip).reduce((s,p)=>s+p.u,0),
    rows:R.products.filter(p=>p.equip).slice(0,12)};

  /* clients & buying — the part the old deck never had */
  const orderAccts=Object.keys(acctRev);const orders=O.filter(o=>o.dt.slice(0,7)===ym);
  const topAccts=orderAccts.map(c=>({name:c,v:acctRev[c],prev:acctPrev[c]||0,orders:acctOrd[c],lines:acctLines[c]?acctLines[c].size:0,
      spec:Object.keys(acctSpec[c]||{}).sort((a,b)=>acctSpec[c][b]-acctSpec[c][a])[0]||'',isNew:isNewAcct(c),owner:ownerOf(c)||''}))
    .sort((a,b)=>b.v-a.v);
  const movers=[...new Set([...orderAccts,...Object.keys(acctPrev)])].map(c=>({name:c,v:acctRev[c]||0,prev:acctPrev[c]||0,d:(acctRev[c]||0)-(acctPrev[c]||0),spec:(topAccts.find(x=>x.name===c)||{}).spec||''}));
  const asOfMs=Date.parse(asOf+'T00:00:00Z');
  const lapsed=Object.values(shopByNorm).filter(e=>!e.int&&e.o>=2&&e.l&&e.v>0).map(e=>({name:e.name,days:Math.round((asOfMs-Date.parse(e.l+'T00:00:00Z'))/864e5),v:e.v,o:e.o,owner:ownerOf(e.name)||''}))
    .filter(e=>e.days>=45&&e.days<=120).sort((a,b)=>b.v-a.v);
  const newRev=newAccts.reduce((s,c)=>s+acctRev[c],0);
  const dealRev=R.products.reduce((s,p)=>s+p.deal,0),free=R.products.reduce((s,p)=>s+p.f,0);
  const top5=R.products.slice(0,5).reduce((s,p)=>s+p.v,0);
  R.accounts={orders:orders.length,ordering:orderAccts.length,aov:orders.length?orders.reduce((s,o)=>s+o.a,0)/orders.length:0,
    newAccts:newAccts.map(c=>({name:c,v:acctRev[c],spec:(topAccts.find(x=>x.name===c)||{}).spec||''})).sort((a,b)=>b.v-a.v),newRev,
    repeatRev:Math.max(0,(tot[ym]||0)-newRev),reorderers:orderAccts.filter(c=>acctOrd[c]>=2).length,multiBrand:orderAccts.filter(c=>acctLines[c]&&acctLines[c].size>=2).length,
    top:topAccts.slice(0,10),risers:movers.filter(m=>m.d>0&&m.prev>0).sort((a,b)=>b.d-a.d).slice(0,5),fallers:movers.filter(m=>m.d<0).sort((a,b)=>a.d-b.d).slice(0,5),
    lapsed:lapsed.slice(0,10),lapsedN:lapsed.length,lapsedV:lapsed.reduce((s,e)=>s+e.v,0),dealShare:bizPct(dealRev,tot[ym]||0),dealRev,free,top5Share:bizPct(top5,tot[ym]||0),
    prevOrdering:Object.keys(acctPrev).length};

  /* specialist rows for output */
  R.specs=Object.values(specs).map(s=>({name:s.name,label:s.label||s.name,team:s.team||'',order:s.order,mtd:s.mtd,prev:s.prev,qtd:s.qtd,ytd:s.ytd,units:s.units,tgt:s.tgt,qtgt:s.qtgt,ytgt:s.ytgt,nextTgt:s.nextTgt,
      att:bizPct(s.mtd,s.tgt),qatt:bizPct(s.qtd,s.qtgt),yatt:bizPct(s.ytd,s.ytgt),proj:s.mtd/elapsed,projAtt:bizPct(s.mtd/elapsed,s.tgt),series:s.series,
      orders:s.orders,ordering:s.ordAccts.size,newAccts:s.newAccts,masterlist:s.masterlist,active:s.active,quiet:s.quiet,
      topAccts:Object.keys(s.accts).map(c=>({name:c,v:s.accts[c]})).sort((a,b)=>b.v-a.v).slice(0,5),
      topLines:Object.keys(s.lines).map(l=>({name:l,v:s.lines[l]})).sort((a,b)=>b.v-a.v).slice(0,4),
      topSkus:Object.keys(s.skus).map(k=>({sku:k,name:(SALESIDX[k]&&SALESIDX[k].name)||k,v:s.skus[k]})).sort((a,b)=>b.v-a.v).slice(0,5),
      lineRows:Object.keys(s.lines).map(l=>({name:l,mtd:s.lines[l],prevLine:null})).sort((a,b)=>b.mtd-a.mtd),
      prodByLine:Object.fromEntries(Object.keys(s.prodLine).map(L=>[L,Object.keys(s.prodLine[L]).map(k=>({sku:k,name:(SALESIDX[k]&&SALESIDX[k].name)||k,v:s.prodLine[L][k]})).sort((a,b)=>b.v-a.v).slice(0,10)])),
      accounts:Object.keys(s.acctAll).map(c=>{const A=s.acctAll[c];return {name:c,mtd:A.mtd,prev:A.prev,v6:A.v6,orders:A.orders,months:A.months.size,avg:A.v6/Math.max(1,A.months.size),last:A.last,isNew:s.newAccts.includes(c)};}).sort((a,b)=>b.v6-a.v6),
      declining:Object.keys(s.acctAll).map(c=>{const A=s.acctAll[c];const days=Math.round((Date.parse(asOf+'T00:00:00Z')-Date.parse(A.last+'T00:00:00Z'))/864e5);return {name:c,last:A.last,days,v6:A.v6,orders:A.orders};}).filter(a=>a.days>=60&&a.orders>=1).sort((a,b)=>b.v6-a.v6).slice(0,10),
      kits:Object.keys(s.kits).map(c=>({name:c,months:s.kits[c],total:Object.values(s.kits[c]).reduce((x,y)=>x+y,0)})).sort((a,b)=>b.total-a.total),
      events:s.events,
      visits:s.visits,calls:s.calls,demos:s.demos,ordered:s.ordered,opened:s.opened,touched:s.touched.size}))
    .filter(s=>R.rosterSrc==='directory'||s.mtd>0||s.prev>0||s.tgt||s.masterlist||s.visits||s.calls)
    // presenting order: the order set on the accounts (Team & access), then team, then revenue
    .sort((a,b)=>((a.order==null?1e9:a.order)-(b.order==null?1e9:b.order))||(a.team||'zzz').localeCompare(b.team||'zzz')||(b.mtd-a.mtd));
  R.teams=[...new Set(R.specs.map(s=>s.team||''))];
  bizTrends(R);
  return R;}

/* ── what HQ noticed: rule-based, deterministic, re-runs identically ─────── */
function bizTrends(R){
  const T=[];const add=(tone,t)=>T.push({tone,t});const P=fmtPeso;const tot=R.total;
  if(tot.tgt&&R.early)add('info','Month to date '+P(tot.mtd)+' is '+bizFmtPct(tot.att)+' of the '+P(tot.tgt)+' target after '+R.day+' day'+(R.day===1?'':'s')+' — too early to project the month.');
  else if(tot.tgt){const pa=tot.projAtt||0;
    add(pa>=100?'up':pa>=80?'flat':'down','Month to date '+P(tot.mtd)+' is '+bizFmtPct(tot.att)+' of the '+P(tot.tgt)+' target with '+Math.round(R.elapsed*100)+'% of the month gone — on this pace the month lands at '+P(tot.proj)+' ('+bizFmtPct(pa)+' of target).');}
  else add('info','Month to date '+P(tot.mtd)+' across '+R.accounts.orders+' orders. No target is set for '+R.label+' — add one in Targets to see attainment.');
  if(tot.prev>0&&!R.early){const d=tot.proj/tot.prev-1;if(Math.abs(d)>=0.08)add(d>0?'up':'down','Projected month is '+(d>0?'+':'')+Math.round(d*100)+'% vs '+bizMonthLbl(R.prev)+' ('+P(tot.prev)+').');}
  const withT=R.brands.filter(b=>b.tgt);
  if(withT.length>=2){const best=[...withT].sort((a,b)=>b.att-a.att)[0],worst=[...withT].sort((a,b)=>a.att-b.att)[0];
    add('up',best.name+' leads on attainment at '+bizFmtPct(best.att)+' ('+P(best.mtd)+' of '+P(best.tgt)+').');
    if(worst!==best)add('down',worst.name+' is furthest behind at '+bizFmtPct(worst.att)+' — a '+P(worst.tgt-worst.mtd)+' gap to target.');}
  for(const b of R.brands.slice(0,6)){if(!R.early&&b.prev>0&&b.mtd>=100000){const d=b.proj/b.prev-1;if(Math.abs(d)>=0.25)add(d>0?'up':'down',b.name+' is tracking '+(d>0?'+':'')+Math.round(d*100)+'% vs last month ('+P(b.proj)+' projected vs '+P(b.prev)+').');}}
  if(R.brands.length&&tot.mtd>0){const b=R.brands[0];add('info',b.name+' is '+Math.round(b.mtd/tot.mtd*100)+'% of the month\'s revenue.');}
  if(R.products.length>=5&&R.accounts.top5Share!=null)add('info','The top 5 SKUs make up '+bizFmtPct(R.accounts.top5Share)+' of revenue; #1 is '+R.products[0].name+' at '+P(R.products[0].v)+'.');
  const A=R.accounts;
  if(!R.ordersComplete)add('info','Orders and accounts are not available for '+R.label+' — the order index starts '+R.ordersFrom+'.');
  else if(A.newAccts.length)add('up',A.newAccts.length+' account'+(A.newAccts.length>1?'s':'')+' placed a first order this month worth '+P(A.newRev)+(A.newAccts.length?': '+A.newAccts.slice(0,3).map(a=>a.name).join(', ')+(A.newAccts.length>3?'…':''):'')+'.');
  else add('flat','No account placed a first order this month.');
  if(R.ordersComplete&&A.ordering)add('info',A.ordering+' accounts ordered ('+(A.prevOrdering?bizDelta(A.ordering,A.prevOrdering)+' vs last month, ':'')+A.reorderers+' ordered twice or more, '+A.multiBrand+' bought from 2+ brands). Average order '+P(A.aov)+'.');
  if(R.ordersComplete&&A.lapsedN)add('down',A.lapsedN+' repeat account'+(A.lapsedN>1?'s have':' has')+' gone quiet for 45–120 days ('+P(A.lapsedV)+' of history): '+A.lapsed.slice(0,3).map(a=>a.name+' ('+a.days+'d)').join(', ')+'.');
  if(A.dealShare!=null&&A.dealShare>=10)add('info','Deals carried '+bizFmtPct(A.dealShare)+' of revenue'+(A.free?'; '+A.free+' units went out free':'')+'.');
  const lead=R.specs.filter(s=>s.mtd>0)[0]&&[...R.specs].sort((a,b)=>b.mtd-a.mtd)[0];
  if(lead&&lead.mtd>0)add('up',lead.label+' leads the month at '+P(lead.mtd)+(lead.tgt?' ('+bizFmtPct(lead.att)+' of target)':'')+(R.specs.length>1?'; '+[...R.specs].sort((a,b)=>b.mtd-a.mtd)[1].label+' next at '+P([...R.specs].sort((a,b)=>b.mtd-a.mtd)[1].mtd):'')+'.');
  const st=R.specs.filter(s=>s.tgt);
  if(st.length&&!R.early){const on=st.filter(s=>s.projAtt>=100),off=st.filter(s=>s.projAtt<50);
    if(on.length)add('up',on.map(s=>s.label).join(', ')+(on.length>1?' are':' is')+' on pace to hit target.');
    if(off.length)add('down',off.map(s=>s.label+' ('+bizFmtPct(s.att)+')').join(', ')+(off.length>1?' are':' is')+' below half of target so far.');}
  const act=R.activity;if(act.visits+act.calls){const conv=bizPct(act.ordered,act.visits+act.calls);
    add('info',(act.visits+act.calls)+' contacts logged ('+act.visits+' visits, '+act.calls+' calls, '+act.demos+' demos); '+bizFmtPct(conv)+' ended in an order'+(act.opened?', '+act.opened+' new accounts opened':'')+'.');
    const busyNoSale=R.specs.filter(s=>(s.visits+s.calls)>=8&&s.mtd===0);if(busyNoSale.length)add('flat',busyNoSale.map(s=>s.label).join(', ')+' logged activity but no sales yet this month.');}
  if(R.machines.installs||R.machines.loansOut)add('info',R.machines.installs+' machine install'+(R.machines.installs===1?'':'s')+' recorded'+(R.machines.loansOut?', '+R.machines.loansOut+' demo units sent out':'')+(R.machines.onLoan?', '+R.machines.onLoan+' currently on loan':'')+'.');
  R.trends=T.slice(0,12);
  for(const s of R.specs){const n=[];
    if(s.tgt)n.push(fmtPeso(s.mtd)+' MTD is '+bizFmtPct(s.att)+' of the '+fmtPeso(s.tgt)+' target'+(R.early?'.':'; on pace for '+fmtPeso(s.proj)+' ('+bizFmtPct(s.projAtt)+').'));else n.push(fmtPeso(s.mtd)+' MTD, no target set.');
    if(s.prev>0&&!R.early)n.push((s.proj>=s.prev?'Ahead of':'Behind')+' last month\'s '+fmtPeso(s.prev)+' ('+bizDelta(s.proj,s.prev)+' projected).');
    if(s.topAccts.length)n.push('Biggest account: '+s.topAccts[0].name+' ('+fmtPeso(s.topAccts[0].v)+')'+(s.topLines.length?'; strongest brand: '+s.topLines[0].name:'')+'.');
    if(s.newAccts.length)n.push(s.newAccts.length+' new account'+(s.newAccts.length>1?'s':'')+': '+s.newAccts.slice(0,3).join(', ')+'.');
    n.push((s.visits+s.calls)+' contacts logged ('+s.visits+' visits, '+s.calls+' calls'+(s.demos?', '+s.demos+' demos':'')+'), '+s.ordering+' of '+s.masterlist+' accounts ordered'+(s.quiet?', '+s.quiet+' repeat accounts quiet for 90+ days':'')+'.');
    R.notesAuto[s.name]=n;}
  return R;}

/* ── comparison with the last saved report ─────────────────────────────── */
function bizSnapSlim(R){return {ym:R.ym,asOf:R.asOf,generated:R.generated,total:R.total,brands:R.brands.map(b=>({name:b.name,mtd:b.mtd,att:b.att,tgt:b.tgt})),
  specs:R.specs.map(s=>({name:s.name,mtd:s.mtd,att:s.att,tgt:s.tgt,ordering:s.ordering,newAccts:s.newAccts.length,visits:s.visits,calls:s.calls})),
  accounts:{orders:R.accounts.orders,ordering:R.accounts.ordering,newAccts:R.accounts.newAccts.length,lapsedN:R.accounts.lapsedN,aov:R.accounts.aov},
  activity:R.activity,machines:{installs:R.machines.installs,loansOut:R.machines.loansOut},trends:R.trends};}
function bizDiff(R,S){ // S = the previous snapshot's slim data. Numbers move only within a
  // month; across months the comparison is commentary-only (August vs September is not "movement")
  if(!S)return null;const same=S.ym===R.ym;const out={same,asOf:S.asOf,ym:S.ym,kpi:[],brands:{},specs:{}};
  if(!same)return out;
  const d=(l,a,b,money)=>{if(a==null||b==null)return;const x=Math.round(a)-Math.round(b);if(!x)return;out.kpi.push({l,d:x,txt:(x>0?'+':'−')+(money?fmtPeso(Math.abs(x)):Math.abs(x).toLocaleString('en-PH'))});};
  d('Revenue MTD',R.total.mtd,S.total.mtd,true);
  if(R.total.att!=null&&S.total.att!=null){const pts=Math.round(R.total.att)-Math.round(S.total.att);if(pts)out.kpi.push({l:'Attainment',d:pts,txt:(pts>0?'+':'−')+Math.abs(pts)+' pts'});}
  d('Orders',R.accounts.orders,S.accounts.orders);d('Ordering accounts',R.accounts.ordering,S.accounts.ordering);d('New accounts',R.accounts.newAccts.length,S.accounts.newAccts);
  d('Contacts logged',R.activity.visits+R.activity.calls,(S.activity.visits||0)+(S.activity.calls||0));
  for(const b of (S.brands||[]))out.brands[b.name]=b;for(const s of (S.specs||[]))out.specs[s.name]=s;
  return out;}

/* ── persistence: commentary + snapshots ───────────────────────────────── */
async function loadBizNotes(ym){
  const notes={};try{const {data}=await SB.from('review_commentary').select('section,body,updated_name,updated_at').eq('month',ym);
    for(const r of (data||[]))notes[r.section]=r;}catch(e){}
  if(BIZ.ym===ym)BIZ.notes=notes; // a slower request for an earlier month must not overwrite the current one
  return notes;}
async function loadBizSnaps(){
  try{const {data,error}=await SB.from('review_snapshots').select('id,month,as_of,created_name,created_at,notes').order('id',{ascending:false}).limit(24);
    if(error)throw error;BIZ.snaps=data||[];window._bizSnapErr='';}catch(e){BIZ.snaps=[];window._bizSnapErr=e.message||String(e);}
  return BIZ.snaps;}
async function bizLoadPrev(R){
  // "last time" = the most recent snapshot taken before now, any month
  BIZ.prev=null;BIZ.prevNotes={};
  // same month first (the mid-month report), else the newest snapshot of an earlier month
  const snaps=BIZ.snaps||[];const s=snaps.find(x=>x.month===R.ym)||snaps.filter(x=>x.month<R.ym).sort((a,b)=>b.created_at<a.created_at?-1:1)[0];if(!s)return null;
  try{const {data}=await SB.from('review_snapshots').select('data,notes').eq('id',s.id).maybeSingle();
    if(data){BIZ.prev=Object.assign({id:s.id,created_name:s.created_name},data.data||{});BIZ.prevNotes=data.notes||{};}}catch(e){}
  return BIZ.prev;}
async function bizSaveNote(section){
  if(!bizCanEdit(section))return;const ta=$('bz-'+section.replace(/[^a-z0-9]/gi,'_'));if(!ta)return;
  const body=ta.value.trim();const st=$('bzs-'+section.replace(/[^a-z0-9]/gi,'_'));if(st)st.textContent='Saving…';
  try{const row={month:BIZ.ym,section,body,updated_by:(SBUSER&&SBUSER.id)||null,updated_name:(SBPROFILE&&SBPROFILE.name)||'',updated_at:new Date().toISOString()};
    const {error}=await SB.from('review_commentary').upsert(row);if(error)throw error;
    BIZ.notes[section]=row;audit('review.note',{month:BIZ.ym,section,chars:body.length});
    if(st)st.textContent='Saved · '+row.updated_name+' · just now';}
  catch(e){if(st)st.textContent='Could not save: '+(e.message||e)+(String(e.message||'').includes('review_commentary')?' — run the review_commentary SQL from SUPABASE-SETUP.md first.':'');}}
function bizDirty(){ // sections whose textarea differs from what is saved
  const out=[];document.querySelectorAll('#content textarea[id^="bz-"]').forEach(ta=>{const sec=ta.getAttribute('data-sec');if(!sec)return;
    if(ta.value.trim()!==((bizNote(sec)||{}).body||'').trim())out.push(sec);});return out;}
async function bizSnapshot(){
  if(!bizCanEditAll()||!BIZ.R)return;const b=$('bz-snap');if(b){b.disabled=true;b.textContent='Saving…';}
  for(const sec of bizDirty())await bizSaveNote(sec); // unsaved typing goes into the snapshot, not the bin
  try{const {error}=await SB.from('review_snapshots').insert({month:BIZ.ym,as_of:BIZ.R.asOf,data:bizSnapSlim(BIZ.R),notes:BIZ.notes,
      created_by:(SBUSER&&SBUSER.id)||null,created_name:(SBPROFILE&&SBPROFILE.name)||''});
    if(error)throw error;audit('review.snapshot',{month:BIZ.ym,asOf:BIZ.R.asOf});await loadBizSnaps();renderBizReview();}
  catch(e){alert('Could not save the snapshot: '+(e.message||e)+(String(e.message||'').includes('review_snapshots')?' — run the review_snapshots SQL from SUPABASE-SETUP.md first.':''));if(b){b.disabled=false;b.textContent='Save snapshot';}}}
async function bizAiDraft(section){
  // asks the same /ask job the chat uses, with the report figures as the live data
  if(!bizCanEdit(section)||!BIZ.R)return;const id=section.replace(/[^a-z0-9]/gi,'_');const ta=$('bz-'+id),st=$('bzs-'+id);if(!ta)return;
  const R=BIZ.R;const lbl=(BIZ_SECTIONS.find(x=>x[0]===section)||[])[1]||section;
  const STYLE=' Style: 5-8 bullet-like sentences, each starting with "- ". Every bullet pairs a figure with its context — versus target, versus last month, who did it, which accounts (name up to three) — so it reads as an insight, not a number. Where the data allows, add the one-line "so what" (what it means for the rest of the month). Refer to specialists by FIRST NAME only (the first word of their name). Money is written with the peso sign and thousands separators, exactly like ₱1,234,567 — never "P1,234" or "PHP". Attainment as a whole percent. No headings, no preamble, no restating the month total — the at-a-glance slide already has it. Say nothing that is not in the data.';
  const BRIEF={
    wins:'Key wins = achievements, not a recap: the specialist(s) who beat or are on pace for target, deals and machine installs (AXION, SkinPen devices, Mark-Vu, Symmed, Zionic), first orders worth naming, the brand furthest ahead, accounts that rose most. Lead with people and accounts. Never present attainment under 80% as a win.',
    challenges:'Key challenges = what is behind or at risk: brands and specialists under 50% of target with the peso gap, the biggest fallers vs last month, repeat accounts going quiet (name the largest), machines with targets and no sales, activity that has not turned into orders. Be specific and unemotional.',
    territory:'Territory updates = coverage and accounts: new accounts opened and by whom, ordering accounts vs masterlist per specialist, quiet accounts to recover, demos and events logged, gaps (specialists with no new accounts or low contacts). Group by specialist or area.',
    plan:'Plan of action = the three numbers to focus on for the rest of the month and why (gap to target by brand, machines to install, accounts to recover), each with an owner (first name) and a peso or unit figure. End with one sentence on what the manager needs from the company.',
    program:'Sales programs & promos = which brands need a push based on attainment and prev-month movement, which promo mechanics fit (deal share and free units are in the data), and which specialists should carry them. Keep to what the data supports.',
    forecast:'Sales plan notes = how next month\'s targets compare with this month\'s run-rate per specialist (targets and forecasts are in the data), who looks stretched or sandbagged, and the assumptions worth challenging.'};
  const psBriefs={wins:'Key wins for THIS specialist: deals, first orders, accounts that grew, pace vs target if at or above 80%.',challenges:'Key challenges for this specialist: gap to target in pesos, accounts that fell or went quiet, activity that has not converted.',
    territory:'Territory updates for this specialist: masterlist vs ordering accounts, new accounts, quiet accounts to recover, demos/events done.',activities:'Training & marketing activities for this specialist from the visit log: demos, events, trainings — accounts reached and what came of it.',proposals:'Proposals / recommendations from this specialist: 3 concrete asks or actions for next month tied to the numbers (accounts, brands, support needed).'};
  let q,data;
  if(section.startsWith('ps:')){const parts=section.split(':');const n=parts[1];const key=parts[2]||'wins';const s=R.specs.find(x=>x.name.toLowerCase()===n.toLowerCase());
    q='Write the "'+((BIZ_PS_SECTIONS.find(x=>x[0]===key)||[])[1]||key)+'" box of '+specDisplay(n)+'\'s own '+R.label+' sales report, in first person plural ("we"). '+(psBriefs[key]||'')+STYLE.replace('4-6','3-5');
    data=JSON.stringify({specialist:s,autoNotes:R.notesAuto[n],asOf:R.asOf,forecast:bizForecast(n),previousCommentary:(BIZ.prevNotes[section]||{}).body||''});}
  else{q='Write the "'+lbl+'" section of the '+R.label+' monthly sales performance review (as of '+R.asOf+') for the sales manager to edit. '+(BRIEF[section]||'')+STYLE;
    data=JSON.stringify({total:R.total,brands:R.brands.map(b=>({name:b.name,mtd:b.mtd,tgt:b.tgt,att:b.att,prev:b.prev,proj:b.proj})),
      specs:R.specs.map(s=>({name:s.label,team:s.team,mtd:s.mtd,tgt:s.tgt,att:s.att,prev:s.prev,proj:s.proj,orders:s.orders,ordering:s.ordering,masterlist:s.masterlist,quiet:s.quiet,newAccts:s.newAccts,visits:s.visits,calls:s.calls,demos:s.demos,topAccts:s.topAccts,nextTgt:s.nextTgt,forecastTotal:Object.values(bizForecast(s.name)).reduce((a,b)=>a+(+b||0),0)})),
      accounts:{top:R.accounts.top,newAccts:R.accounts.newAccts,lapsed:R.accounts.lapsed,risers:R.accounts.risers,fallers:R.accounts.fallers,dealShare:R.accounts.dealShare,free:R.accounts.free,reorderers:R.accounts.reorderers,multiBrand:R.accounts.multiBrand},
      machines:{rev:R.machines.rev,units:R.machines.units,installs:R.machines.installs,loansOut:R.machines.loansOut,rows:R.machines.rows.map(p=>({name:p.name,u:p.u,v:p.v,tgt:p.tgt}))},activity:R.activity,trends:R.trends.map(t=>t.t),early:R.early,previousCommentary:(BIZ.prevNotes[section]||{}).body||''});}
  if(st)st.textContent='Drafting with AI…';
  try{const r=await fetch('/.netlify/functions/ask',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),body:JSON.stringify({question:q,catalog:'BUSINESS REVIEW FIGURES (external sales only, JSON):\n'+data,history:[],mode:'draft'})});
    const job=await r.json();if(!job||!job.id)throw new Error(job&&job.error||'no job id');
    let last=null;
    for(let i=0;i<60;i++){await new Promise(x=>setTimeout(x,2500));
      const p=await (await fetch('/.netlify/functions/ask?id='+encodeURIComponent(job.id),{headers:await sbAuthHeaders()})).json();last=p;
      if(p&&p.pending){if(st&&p.stage)st.textContent='Drafting with AI… ('+p.stage+(p.provider?' · '+p.provider:'')+')';continue;}if(p&&p.error)throw new Error(p.error);
      const txt=String((p&&p.answer)||'').replace(/\*\*/g,'').trim();if(!txt)throw new Error('empty answer');
      ta.value=(ta.value.trim()?ta.value.trim()+'\n\n':'')+txt;if(st)st.textContent='Draft added — edit, then Save.';return;}
    throw new Error('timed out'+(last&&last.stage?' — job still at "'+last.stage+'"':' — job never started'));}
  catch(e){if(st)st.textContent='AI draft failed: '+(e.message||e);}}

/* ── the page ──────────────────────────────────────────────────────────── */
function bizSetMonth(ym){const dirty=bizDirty();if(dirty.length&&!confirm(dirty.length+' commentary box'+(dirty.length>1?'es have':' has')+' unsaved text. Switch month and lose it?')){const sel=document.querySelector('#content select');if(sel)sel.value=BIZ.ym;return;}BIZ.ym=ym;renderBizReview();}
function bizKpi(l,v,sub,tone){return '<div class="met '+(tone||'')+'"><div class="met-lbl">'+esc(l)+'</div><div class="met-val" style="font-size:15px">'+v+'</div>'+(sub?'<div class="mu" style="font-size:11px;margin-top:2px">'+sub+'</div>':'')+'</div>';}
function bizTrendHTML(T){const ic={up:'▲',down:'▼',flat:'▶',info:'●'},col={up:'var(--gr)',down:'var(--rd)',flat:'var(--am)',info:'var(--bl)'};
  return '<div style="display:grid;gap:6px">'+T.map(t=>'<div style="display:flex;gap:10px;align-items:flex-start;font-size:13px"><span style="color:'+col[t.tone]+';font-size:11px;padding-top:3px;width:12px">'+ic[t.tone]+'</span><span>'+esc(t.t)+'</span></div>').join('')+'</div>';}
function bizNoteBox(section,title,hint){
  const id=section.replace(/[^a-z0-9]/gi,'_');const cur=bizNote(section)||{};const prev=BIZ.prevNotes[section]||{};const can=bizCanEdit(section);
  const changed=prev.body!=null&&(cur.body||'')!==(prev.body||'');
  return '<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-'+id+'"><div class="phd" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>'+esc(title)+'</span>'+
    (can?'<span class="mu" style="font-weight:400;font-size:11px">'+(section.startsWith('ps:')?'your slide — only you and the sales manager can edit it':'sales manager edits this')+'</span>':'<span class="mu" style="font-weight:400;font-size:11px">view only — the '+(section.startsWith('ps:')?'specialist':'sales manager')+' writes this</span>')+'</div>'+
    (hint?'<div class="mu" style="font-size:12px;margin-bottom:8px">'+hint+'</div>':'')+
    (BIZ.prev?'<details style="margin-bottom:8px"'+(changed?'':'')+'><summary style="cursor:pointer;font-size:12px;color:var(--mu)">Last report ('+esc(BIZ.prev.asOf||'')+')'+(prev.body?(changed?' · <span style="color:var(--am)">changed since</span>':' · <span style="color:var(--gr)">unchanged</span>'):' · was empty')+'</summary><div style="white-space:pre-wrap;font-size:12.5px;background:var(--sf2);border-radius:8px;padding:8px 10px;margin-top:6px">'+esc(prev.body||'(nothing written last time)')+'</div></details>':'')+
    (can?'<textarea id="bz-'+id+'" data-sec="'+esc(section)+'" rows="5" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--bd);border-radius:8px;resize:vertical" placeholder="Type here — this goes straight onto the slide.">'+esc(cur.body||'')+'</textarea>'+
      '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"><a href="#" class="abtn" onclick="bizSaveNote(\''+jsq(section)+'\');return false">Save</a><a href="#" class="abtn" onclick="bizAiDraft(\''+jsq(section)+'\');return false">Draft with AI</a><span class="mu" id="bzs-'+id+'" style="font-size:11px">'+(cur.updated_at?'Saved · '+esc(cur.updated_name||'')+' · '+esc(String(cur.updated_at).slice(0,10)):'Nothing saved yet')+'</span></div>'
       :'<div style="white-space:pre-wrap;font-size:13px;min-height:24px">'+esc(cur.body||'(nothing written yet)')+'</div>'+(cur.updated_at?'<div class="mu" style="font-size:11px;margin-top:4px">'+esc(cur.updated_name||'')+' · '+esc(String(cur.updated_at).slice(0,10))+'</div>':''))+
    '</div>';}
function bizForecastBox(s){
  const sec=bizPsSec(s.name,'forecast');const can=bizCanEdit(sec);const F=bizForecast(s.name);const saved=BIZ.notes[sec];
  const rows=s.accounts.slice(0,15);const extra=Object.keys(F).filter(a=>!rows.some(r=>r.name===a)).map(a=>({name:a,avg:0,mtd:0,v6:0,months:0}));
  const all=rows.concat(extra);const tot=all.reduce((x,a)=>x+(+F[a.name]||0),0);
  return '<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-'+esc(sec.replace(/[^a-z0-9]/gi,'_'))+'"><div class="phd" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>'+esc(s.label)+' — Sales plan / forecast for '+esc(bizMonthLbl(bizYmAdd(BIZ.ym,1)))+'</span><span class="mu" style="font-weight:400;font-size:11px">'+(can?'type a peso forecast per account':'view only — the specialist fills this in')+'</span></div>'+
    '<div class="mu" style="font-size:12px;margin-bottom:8px">Average monthly sales = the account\'s external orders over the last six months ÷ months with an order. The forecast column is yours.</div>'+
    bizTbl(['Account','Avg monthly','MTD','Forecast'],all.map(a=>[esc(a.name),a.avg?fmtPeso(a.avg):'—',a.mtd?fmtPeso(a.mtd):'—',can?'<input type="number" min="0" step="1000" data-fc="'+esc(a.name)+'" value="'+(F[a.name]!=null?esc(String(F[a.name])):'')+'" style="width:110px;font:inherit;font-size:12px;padding:4px 6px;border:1px solid var(--bd);border-radius:6px;text-align:right">':(F[a.name]!=null?fmtPeso(F[a.name]):'—')]).concat([['<b>Total</b>','','','<b id="fc-tot-'+esc(s.name.replace(/[^a-z0-9]/gi,'_'))+'">'+fmtPeso(tot)+'</b>']]))+
    (can?'<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><a href="#" class="abtn" onclick="bizSaveForecast(\''+jsq(s.name)+'\');return false">Save forecast</a><a href="#" class="abtn" onclick="bizAddForecastRow(\''+jsq(s.name)+'\');return false">Add an account</a><span class="mu" id="bzs-'+esc(sec.replace(/[^a-z0-9]/gi,'_'))+'" style="font-size:11px">'+(saved&&saved.updated_at?'Saved · '+esc(saved.updated_name||'')+' · '+esc(String(saved.updated_at).slice(0,10)):'Nothing saved yet')+'</span></div>':'')+'</div>';}
async function bizSaveForecast(tag){
  const sec=bizPsSec(tag,'forecast');if(!bizCanEdit(sec))return;const id=sec.replace(/[^a-z0-9]/gi,'_');const box=document.getElementById('sec-'+id);if(!box)return;
  const F={};box.querySelectorAll('input[data-fc]').forEach(i=>{const v=parseFloat(i.value);if(!isNaN(v)&&v>0)F[i.getAttribute('data-fc')]=Math.round(v);});
  const st=document.getElementById('bzs-'+id);if(st)st.textContent='Saving…';
  try{const row={month:BIZ.ym,section:sec,body:JSON.stringify(F),updated_by:(SBUSER&&SBUSER.id)||null,updated_name:(SBPROFILE&&SBPROFILE.name)||'',updated_at:new Date().toISOString()};
    const {error}=await SB.from('review_commentary').upsert(row);if(error)throw error;BIZ.notes[sec]=row;audit('review.forecast',{month:BIZ.ym,tag,accounts:Object.keys(F).length});
    const tot=document.getElementById('fc-tot-'+tag.replace(/[^a-z0-9]/gi,'_'));if(tot)tot.textContent=fmtPeso(Object.values(F).reduce((a,b)=>a+b,0));
    if(st)st.textContent='Saved · '+row.updated_name+' · just now';}
  catch(e){if(st)st.textContent='Could not save: '+(e.message||e);}}
function bizAddForecastRow(tag){const name=prompt('Account name (as it appears on orders):');if(!name||!name.trim())return;
  const sec=bizPsSec(tag,'forecast');const id=sec.replace(/[^a-z0-9]/gi,'_');const box=document.getElementById('sec-'+id);const tb=box&&box.querySelector('tbody');if(!tb)return;
  const tr=document.createElement('tr');tr.innerHTML='<td>'+esc(name.trim())+'</td><td class="r">—</td><td class="r">—</td><td class="r"><input type="number" min="0" step="1000" data-fc="'+esc(name.trim())+'" style="width:110px;font:inherit;font-size:12px;padding:4px 6px;border:1px solid var(--bd);border-radius:6px;text-align:right"></td>';
  tb.insertBefore(tr,tb.lastElementChild);tr.querySelector('input').focus();}
function bizTbl(head,rows,opts){opts=opts||{};return '<div class="tcard"><div class="tscroll"><table><thead><tr>'+head.map((h,i)=>'<th'+(i&&!opts.left?' class="r"':'')+'>'+h+'</th>').join('')+'</tr></thead><tbody>'+
  (rows.length?rows.map(r=>'<tr>'+r.map((c,i)=>'<td'+(i&&!opts.left?' class="r"':'')+'>'+c+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+head.length+'" class="mu">Nothing to show</td></tr>')+'</tbody></table></div></div>';}
function bizDiffChip(cur,S,key){if(!S||S[key]==null||cur==null)return '';const d=cur-S[key];if(!d)return ' <span class="pill pgy" title="unchanged since last report">=</span>';
  return ' <span class="pill '+(d>0?'pgr':'prd')+'" title="since last report">'+(d>0?'+':'−')+fmtPeso(Math.abs(d))+'</span>';}

async function renderBizReview(){
  loadingHint();
  if(!salesGuard())return;
  if(!hasIntSplit()){ // the report is external-only by definition: without the split there is nothing honest to show
    $('content').innerHTML='<div class="empty" style="margin-top:40px"><b>The Business review is external sales only.</b><br>The sales cache has not finished computing the Remedy / internal split yet, so there are no external figures to report. It rebuilds nightly at 2am, or ask for a rebuild from Sales overview, then come back — nothing here will ever show Remedy or internal orders.</div>';return;}
  if(!BIZ.ym)BIZ.ym=bizToday().slice(0,7);
  const ym=BIZ.ym;
  try{await Promise.all([loadVisits(),typeof loadOwners==='function'?(OWNERS?null:loadOwners()):null,typeof loadSerials==='function'?(SERIALS?null:loadSerials()):null,typeof loadLoans==='function'?(LOANS?null:loadLoans()):null,loadBizNotes(ym),BIZ.snaps?null:loadBizSnaps()]);}catch(e){}
  if(currentView!=='bizreview'||BIZ.ym!==ym)return;
  const R=BIZ.R=bizCompute(ym);
  await bizLoadPrev(R);
  if(currentView!=='bizreview'||BIZ.ym!==ym)return;
  const D=bizDiff(R,BIZ.prev);
  const canAll=bizCanEditAll();const me=bizMySpec();
  const months=bizMonthsAvail();
  const P=fmtPeso;
  let h='';
  /* toolbar */
  h+='<div class="no-print" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">'+
    '<select onchange="bizSetMonth(this.value)" style="font:inherit;padding:6px 8px;border-radius:8px;border:1px solid var(--bd)">'+months.map(m=>'<option value="'+m+'"'+(m===ym?' selected':'')+'>'+bizMonthLbl(m)+'</option>').join('')+'</select>'+
    '<span class="mu" style="font-size:12px">as of '+esc(R.asOf)+' · external sales only · targets: '+esc(R.total.tgtSrc)+'</span><span style="flex:1"></span>'+
    (canAll?'<a href="#" class="abtn" id="bz-snap" onclick="bizSnapshot();return false">Save snapshot</a><a href="#" class="abtn" onclick="showView(\'reports\',null);return false">Reports &amp; downloads</a>':'')+
    (me&&!canAll?'<a href="#" class="abtn" onclick="bizDownload(\''+jsq(me)+'\',\'pptx\');return false">My deck (PowerPoint)</a><a href="#" class="abtn" onclick="bizDownload(\''+jsq(me)+'\',\'pdf\');return false">My deck (PDF)</a>':'')+
    '<a href="#" class="abtn" onclick="window.print();return false">Print</a></div>';
  if(!R.ordersComplete)h+='<div class="viewdesc" style="border-color:var(--am)">The order index only reaches back to '+esc(R.ordersFrom)+' — for '+esc(R.label)+' this page shows revenue by brand, product and specialist, but orders, accounts and buying behaviour are blank. Pick a more recent month for the full report.</div>';
  else if(R.recentCapped&&canAll)h+='<div class="viewdesc" style="border-color:var(--am)">The order index hit its 2,500-order cap, so the newest orders may be missing from the account tables. Ask for a cache rebuild (Sales overview → rebuild).</div>';
  if(!R.current)h+='<div class="viewdesc">Viewing a past month: revenue, targets and activity are for '+esc(R.label)+'; "Active (90d)", "Quiet 90d+" and the going-quiet list are as of today.</div>';
  if(window._bizSnapErr&&canAll)h+='<div class="viewdesc" style="border-color:var(--am)">Snapshots table not reachable ('+esc(window._bizSnapErr)+') — run the review_snapshots SQL from SUPABASE-SETUP.md.</div>';
  h+='<div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;font-size:12px">'+[['glance','At a glance'],['brands','Brands'],['monthly','Monthly'],['products','Products'],['machines','Machines'],['accounts','Accounts'],['clients','Clients & buying'],['specs','Specialists'],['plan-top','Plan']].map(x=>'<a href="#sec-'+x[0]+'" class="pill pbl" onclick="const e=document.getElementById(\'sec-'+x[0]+'\');if(e)e.scrollIntoView({behavior:\'smooth\'});return false">'+x[1]+'</a>').join('')+'</div>';
  /* cover strip */
  h+='<div class="panel" style="padding:18px 20px;margin-bottom:14px;background:#00168F;color:#fff"><div style="font-size:11px;letter-spacing:.12em;opacity:.8">MONTHLY SALES PERFORMANCE REPORT</div><div style="font-size:24px;font-weight:700;margin-top:2px">'+esc(R.label)+'</div><div style="font-size:12px;opacity:.85;margin-top:4px">Generated by Healthspan HQ · as of '+esc(R.asOf)+(BIZ.prev?' · compared with the report saved '+esc(BIZ.prev.asOf||''):' · no earlier snapshot to compare with yet')+'</div></div>';
  /* at a glance */
  h+='<div id="sec-glance"></div><div class="metrics">'+
    bizKpi('Revenue MTD',P(R.total.mtd),R.total.tgt?bizFmtPct(R.total.att)+' of '+P(R.total.tgt):'no target',R.total.att==null?'bl':R.total.att>=100?'gr':R.total.att>=70?'bl':R.total.att>=40?'am':'rd')+
    (R.early?bizKpi('Projected month','—','too early — day '+R.day+' of '+R.dim,'gy'):bizKpi('Projected month',P(R.total.proj),R.total.tgt?bizFmtPct(R.total.projAtt)+' of target':(Math.round(R.elapsed*100)+'% of month gone'),R.total.projAtt==null?'bl':R.total.projAtt>=100?'gr':'am'))+
    (R.early?bizKpi('vs '+bizShortLbl(R.prev),'—',P(R.total.prev)+' last month','gy'):bizKpi('vs '+bizShortLbl(R.prev),bizDelta(R.total.proj,R.total.prev),'projected vs '+P(R.total.prev),bizDeltaTone(R.total.proj,R.total.prev)))+
    bizKpi('QTD',P(R.total.qtd),R.total.qtgt?bizFmtPct(R.total.qatt)+' of '+P(R.total.qtgt):'no target','bl')+
    bizKpi('YTD',P(R.total.ytd),R.total.ytgt?bizFmtPct(R.total.yatt)+' of '+P(R.total.ytgt):'no target','pu')+
    bizKpi('Orders · accounts',R.accounts.orders+' · '+R.accounts.ordering,'avg order '+P(R.accounts.aov),'bl')+
    bizKpi('New accounts',String(R.accounts.newAccts.length),P(R.accounts.newRev)+' first orders',R.accounts.newAccts.length?'gr':'gy')+
    bizKpi('Contacts logged',String(R.activity.visits+R.activity.calls),R.activity.visits+' visits · '+R.activity.calls+' calls · '+R.activity.demos+' demos','bl')+
    '</div>';
  if(D&&D.kpi.length)h+='<div class="viewdesc"><b>Since the last report ('+esc(D.asOf)+(D.same?'':', '+bizMonthLbl(D.ym))+'):</b> '+D.kpi.map(k=>esc(k.l)+' <b style="color:'+(k.d>0?'var(--gr)':'var(--rd)')+'">'+esc(k.txt)+'</b>').join(' · ')+'</div>';
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">What HQ noticed</div>'+bizTrendHTML(R.trends)+'<div class="mu" style="font-size:11px;margin-top:8px">Generated from the figures on this page; the boxes below are where people add the story behind the numbers.</div></div>';
  h+=bizNoteBox('wins','Key wins','Deals closed, installs, promos that landed. HQ already lists new accounts and pace above — add what the numbers cannot see.');
  h+=bizNoteBox('challenges','Key challenges','Complaints, stock, weather, competitor moves.');
  h+=bizNoteBox('territory','Territory updates','Accreditations, ongoing demos, offers being sent.');
  /* brands */
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-brands"><div class="phd">Sales performance overview — by brand</div>'+
    bizTbl(['Brand','MTD','Target','%','QTD','Target','%','YTD','Target','%','vs '+bizShortLbl(R.prev)],
      R.brands.map(b=>[esc(b.name)+(D?bizDiffChip(b.mtd,D.brands[b.name],'mtd'):''),P(b.mtd),b.tgt!=null?P(b.tgt):'—',b.att!=null?attBar(b.att):'—',P(b.qtd),b.qtgt!=null?P(b.qtgt):'—',bizFmtPct(b.qatt),P(b.ytd),b.ytgt!=null?P(b.ytgt):'—',bizFmtPct(b.yatt),'<span class="pill p'+bizDeltaTone(b.proj,b.prev)+'">'+bizDelta(b.proj,b.prev)+'</span>'])
      .concat([['<b>Total</b>','<b>'+P(R.total.mtd)+'</b>',R.total.tgt!=null?'<b>'+P(R.total.tgt)+'</b>':'—',R.total.att!=null?attBar(R.total.att):'—','<b>'+P(R.total.qtd)+'</b>',R.total.qtgt!=null?P(R.total.qtgt):'—',bizFmtPct(R.total.qatt),'<b>'+P(R.total.ytd)+'</b>',R.total.ytgt!=null?P(R.total.ytgt):'—',bizFmtPct(R.total.yatt),'<span class="pill p'+bizDeltaTone(R.total.proj,R.total.prev)+'">'+bizDelta(R.total.proj,R.total.prev)+'</span>']]))+
    '<div class="cw" style="height:220px;margin-top:12px"><canvas id="bzBrand"></canvas></div><div class="mu" style="font-size:11px;margin-top:4px">"vs" compares the month\'s projected finish with last month\'s actual. Brand targets come from the Targets tab (LINE rows).</div></div>';
  /* monthly */
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-monthly"><div class="phd">Monthly performance — 13 months, by brand</div><div class="cw" style="height:260px"><canvas id="bzMonthly"></canvas></div></div>';
  /* products per brand */
  h+='<div id="sec-products"></div>';
  const brandsWithSales=R.brands.filter(b=>b.mtd>0).slice(0,8);
  for(const b of brandsWithSales){const rows=R.products.filter(p=>p.line===b.name&&(p.v>0||p.u>0||p.tgt)).slice(0,12);
    h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">'+esc(b.name)+' — product sales'+(b.lines.length>1?' <span class="mu" style="font-weight:400;font-size:11px">'+esc(b.lines.join(' · '))+'</span>':'')+'</div>'+
      bizTbl(['Product','Units','MTD','Target','%','vs '+bizShortLbl(R.prev),'via deals'],rows.map(p=>[esc(p.name)+'<div class="mu" style="font-size:10px">'+esc(p.sku)+(b.lines.length>1&&p.raw!==b.name?' · '+esc(p.raw):'')+'</div>',p.u.toLocaleString('en-PH'),P(p.v),p.tgt!=null?P(p.tgt):'—',p.tgt!=null?attBar(bizPct(p.v,p.tgt)):'—','<span class="pill p'+bizDeltaTone(p.v/R.elapsed,p.pv)+'">'+bizDelta(p.v/R.elapsed,p.pv)+'</span>',p.deal>0?P(p.deal):'—']))+'</div>';}
  /* machines */
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-machines"><div class="phd">Machine sales & demo units</div><div class="metrics">'+
    bizKpi('Machine revenue',P(R.machines.rev),R.machines.units+' units','bl')+bizKpi('Installs recorded',String(R.machines.installs),'serials marked sold this month',R.machines.installs?'gr':'gy')+
    bizKpi('Demo units out',String(R.machines.loansOut),R.machines.onLoan+' on loan now · '+R.machines.converted+' converted','am')+bizKpi('Equipment in stock',String(R.machines.inStock),R.machines.skus+' serialised SKUs','pu')+'</div>'+
    bizTbl(['Machine','Units','MTD','Target','%'],R.machines.rows.map(p=>[esc(p.name)+'<div class="mu" style="font-size:10px">'+esc(p.line)+'</div>',p.u.toLocaleString('en-PH'),P(p.v),p.tgt!=null?P(p.tgt)+(p.tgtFrom==='brand'?' <span class="mu">(brand)</span>':''):'—',p.tgt!=null?attBar(bizPct(p.v,p.tgt)):'—']))+
    '<div class="mu" style="font-size:11px;margin-top:6px">Machines = the SkinPen device packages, Axion, Mark-Vu, Symmed, Zionic and the GTG platforms, plus anything in the serial register — recognised from the product title, so cartridges, kits and tips stay consumables. A machine paid outside Shopify (cash, cheque, direct to the bank) is not in Shopify and therefore not here until it is booked as an order.</div></div>';
  /* accounts monitoring */
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-accounts"><div class="phd">Accounts monitoring — per specialist</div>'+
    bizTbl(['Specialist','Masterlist','Active (90d)','Ordered MTD','New MTD','Quiet 90d+','Contacts','Opened (CRM)'],R.specs.map(s=>[esc(s.label)+(s.team?' <span class="mu" style="font-size:10px">'+esc(s.team)+'</span>':''),String(s.masterlist),String(s.active),String(s.ordering),String(s.newAccts.length),String(s.quiet),(s.visits+s.calls)+'',String(s.opened)]))+
    '<div class="mu" style="font-size:11px;margin-top:6px">Masterlist = accounts assigned in Accounts (owner) plus any that ordered under the specialist\'s tag in the last 6 months. Active = an external order in the last 90 days. New = first order in 13 months landed this month.'+(R.rosterSrc==='directory'?' Specialists = HQ accounts with a specialist tag (names as on the account).':' No specialist directory yet — names come from Shopify tags; run the spec_directory SQL to use account names.')+'</div>'+
    (R.unassigned.v>0?'<div class="viewdesc" style="border-color:var(--am);margin-top:8px">'+P(R.unassigned.v)+' this month sits under Shopify tags that are not a specialist account ('+esc(R.unassigned.tags.join(', '))+'). It is in the brand totals but on nobody\'s slide — fix the tag on those orders, or add the person in Team &amp; access.</div>':'')+'</div>';
  /* clients & buying */
  const A=R.accounts;
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-clients"><div class="phd">Clients & buying behaviour</div><div class="metrics">'+
    bizKpi('Repeat vs new revenue',P(A.repeatRev)+' · '+P(A.newRev),bizFmtPct(bizPct(A.newRev,R.total.mtd))+' from first orders','bl')+bizKpi('Ordered 2+ times',String(A.reorderers),'of '+A.ordering+' ordering accounts','gr')+
    bizKpi('Bought 2+ brands',String(A.multiBrand),'cross-sell this month','pu')+bizKpi('Deal share',bizFmtPct(A.dealShare),P(A.dealRev)+' via deals · '+A.free+' free units','am')+'</div>'+
    '<div class="cw" style="height:220px;margin:6px 0 12px"><canvas id="bzAccts"></canvas></div>'+
    '<div class="phd" style="font-size:13px">Top accounts this month</div>'+bizTbl(['Account','MTD','vs '+bizShortLbl(R.prev),'Orders','Brands','Specialist'],A.top.map(a=>[esc(a.name)+(a.isNew?' <span class="pill pgr">new</span>':''),P(a.v),'<span class="pill p'+bizDeltaTone(a.v,a.prev)+'">'+bizDelta(a.v,a.prev)+'</span>',String(a.orders),String(a.lines),esc(specDisplay(a.spec||a.owner)||'—')]))+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px">'+
      '<div><div class="phd" style="font-size:13px">Biggest risers vs last month</div>'+bizTbl(['Account','Δ','MTD'],A.risers.map(m=>[esc(m.name),'<span style="color:var(--gr)">+'+P(m.d)+'</span>',P(m.v)]))+'</div>'+
      '<div><div class="phd" style="font-size:13px">Biggest fallers vs last month</div>'+bizTbl(['Account','Δ','MTD'],A.fallers.map(m=>[esc(m.name),'<span style="color:var(--rd)">−'+P(-m.d)+'</span>',P(m.v)]))+'</div></div>'+
    '<div class="phd" style="font-size:13px;margin-top:12px">Repeat accounts going quiet (45–120 days since last order)</div>'+bizTbl(['Account','Days quiet','Orders (13m)','Revenue (13m)','Owner'],A.lapsed.map(l=>[esc(l.name),String(l.days),String(l.o),P(l.v),esc(l.owner||'—')]))+
    '<div class="mu" style="font-size:11px;margin-top:6px">Accounts that ordered at least twice and have not ordered for 45–120 days — the recoverable window before they go dormant.</div></div>';
  /* specialists */
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px" id="sec-specs"><div class="phd">Specialists — attainment and pace</div>'+
    bizTbl(['Specialist','MTD','Target','%','Pace','vs '+bizShortLbl(R.prev),'QTD %','YTD %','Orders','New','Contacts'],R.specs.map(s=>[esc(s.label)+(s.team?' <span class="mu" style="font-size:10px">'+esc(s.team)+'</span>':'')+(D?bizDiffChip(s.mtd,D.specs[s.name],'mtd'):''),P(s.mtd),s.tgt!=null?P(s.tgt):'—',s.att!=null?attBar(s.att):'—',s.tgt!=null?bizFmtPct(s.projAtt):P(s.proj),'<span class="pill p'+bizDeltaTone(s.proj,s.prev)+'">'+bizDelta(s.proj,s.prev)+'</span>',bizFmtPct(s.qatt),bizFmtPct(s.yatt),String(s.orders),String(s.newAccts.length),String(s.visits+s.calls)]))+
    '<div class="cw" style="height:'+Math.max(160,R.specs.length*26+40)+'px;margin-top:12px"><canvas id="bzSpecs"></canvas></div></div>';
  for(const s of R.specs){const mine=me&&s.name.toLowerCase()===me.toLowerCase();
    h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px'+(mine?';border-color:var(--bl)':'')+'" id="sec-ps-'+esc(s.name.replace(/[^a-z0-9]/gi,'_'))+'"><div class="phd">'+esc(s.label)+(s.team?' <span class="mu" style="font-weight:400;font-size:11px">'+esc(s.team)+'</span>':'')+(mine?' <span class="pill pbl">you</span>':'')+'</div>'+
      '<div class="metrics">'+bizKpi('MTD',P(s.mtd),s.tgt?bizFmtPct(s.att)+' of '+P(s.tgt):'no target',s.att>=100?'gr':s.att>=70?'bl':s.att>=40?'am':s.tgt?'rd':'gy')+(R.early?bizKpi('Pace','—','too early to project','gy'):bizKpi('Pace',P(s.proj),s.tgt?bizFmtPct(s.projAtt)+' of target':'projected','bl'))+(R.early?bizKpi('vs '+bizShortLbl(R.prev),'—',P(s.prev)+' last month','gy'):bizKpi('vs '+bizShortLbl(R.prev),bizDelta(s.proj,s.prev),P(s.prev)+' last month',bizDeltaTone(s.proj,s.prev)))+bizKpi('Accounts',s.ordering+' / '+s.masterlist,s.newAccts.length+' new · '+s.quiet+' quiet','pu')+bizKpi('Activity',String(s.visits+s.calls),s.visits+' visits · '+s.calls+' calls · '+s.demos+' demos','am')+'</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"><div><div class="phd" style="font-size:13px">Top accounts</div>'+bizTbl(['Account','MTD'],s.topAccts.map(a=>[esc(a.name),P(a.v)]))+'</div><div><div class="phd" style="font-size:13px">Top products</div>'+bizTbl(['Product','MTD'],s.topSkus.map(a=>[esc(a.name),P(a.v)]))+'</div><div><div class="phd" style="font-size:13px">HQ notes</div><div style="font-size:12.5px;display:grid;gap:4px">'+(R.notesAuto[s.name]||[]).map(t=>'<div>• '+esc(t)+'</div>').join('')+'</div></div></div></div>';
    {h+='<div class="mu" style="font-size:11px;margin:-6px 0 8px 4px">'+esc(s.label)+'\'s own report — these boxes and the forecast go onto '+(mine?'your':'their')+' deck (Reports → '+esc(s.label)+').</div>';
      for(const [k,lbl] of BIZ_PS_SECTIONS)h+=bizNoteBox(bizPsSec(s.name,k),s.label+' — '+lbl,k==='wins'?'Deals closed, demos that landed, lectures given.':k==='challenges'?'Pricing pushback, stock, competitors, doctor schedules.':k==='territory'?'Accreditations, institutions, menu inclusions, upcoming presentations.':k==='activities'?'Masterclasses, 1:1 demos, trainings, events — accounts reached and what came of it.':'What you propose for next month and what you need from the company.');
      h+=bizForecastBox(s);}}
  /* plan */
  h+='<div id="sec-plan-top"></div>'+bizNoteBox('plan','Plan of action','The three numbers to focus on, and why.')+bizNoteBox('program','Sales programs & promos','Running promos, deadlines, exclusions.');
  const nextYm=bizYmAdd(ym,1);
  h+='<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">Sales plan — '+esc(bizMonthLbl(nextYm))+' targets per specialist</div>'+
    bizTbl(['Specialist','This month target','MTD','Gap','Next month target'],R.specs.map(s=>[esc(s.label),s.tgt!=null?P(s.tgt):'—',P(s.mtd),s.tgt!=null?P(Math.max(0,s.tgt-s.mtd)):'—',s.nextTgt!=null?P(s.nextTgt):'<span class="mu">not set</span>']))+
    '<div class="mu" style="font-size:11px;margin-top:6px">Next month\'s targets come from Targets → specialists. Set them there and this table fills itself.</div></div>'+bizNoteBox('forecast','Sales plan notes','Programs per team, conversions, anything the target table does not say.');
  h+='<div class="mu" style="font-size:11px;margin:6px 0 20px">External sales only — Remedy, Healthspan-internal and pull-out orders are excluded everywhere on this page, as in Targets. QTD / YTD attainment counts only months that have a target row. Visit log covers a rolling 120 days'+(R.activity.complete?'':' — activity for this month is incomplete')+'; the order index covers orders since '+esc(R.ordersFrom||'—')+'. Generated '+esc(R.generated.slice(0,16).replace('T',' '))+'.</div>';
  $('content').innerHTML=h;
  bizCharts(R);}

/* Chart configs are built once and used twice: live on the page, and rendered to
   PNG for the deck. Keynote and Google Slides do not draw pptxgenjs's native
   charts reliably (blank boxes), so the exported deck carries pictures of the
   same charts; native charts remain the fallback when no canvas is available. */
function bizChartCfg(R,key,arg,fs){
  fs=fs||12;const F={size:fs};const leg={position:'bottom',labels:{font:F,boxWidth:fs}};const tick=extra=>Object.assign({font:F},extra||{});
  const money={callback:v=>bizCompact(v)};
  if(key==='brand'){const brands=R.brands.slice(0,8);
    return {type:'bar',data:{labels:brands.map(b=>b.name),datasets:[{label:'MTD',data:brands.map(b=>Math.round(b.mtd)),backgroundColor:'rgba(0,22,143,0.85)',borderRadius:3},{label:'Projected',data:brands.map(b=>Math.round(b.proj)),backgroundColor:'rgba(0,22,143,0.25)',borderRadius:3},{label:'Target',data:brands.map(b=>Math.round(b.tgt||0)),backgroundColor:'rgba(215,90,48,0.6)',borderRadius:3}]},
      options:{plugins:{legend:leg},scales:{x:{ticks:tick()},y:{beginAtZero:true,ticks:tick(money)}}}};}
  if(key==='monthly'){const top=R.brands.slice(0,6).map(b=>b.name);const other=R.series.map((m,i)=>R.brands.filter(b=>!top.includes(b.name)).reduce((s,b)=>s+b.series[i],0));
    const ds=R.brands.filter(b=>top.includes(b.name)).map((b,i)=>({type:'bar',label:b.name,data:b.series.map(Math.round),backgroundColor:COLORS[i%COLORS.length],stack:'s'}));
    if(other.some(x=>x>0))ds.push({type:'bar',label:'Other',data:other.map(Math.round),backgroundColor:'#9AA3B2',stack:'s'});
    return {data:{labels:R.series.map(m=>bizShortLbl(m)+' '+m.slice(2,4)),datasets:ds.concat([{type:'line',label:'Total',data:R.total.series.map(Math.round),borderColor:'#00168F',backgroundColor:'#00168F',tension:.3,pointRadius:3,yAxisID:'y'}])},
      options:{plugins:{legend:leg},scales:{x:{stacked:true,ticks:tick()},y:{stacked:true,beginAtZero:true,ticks:tick(money)}}}};}
  if(key==='accts'){const ta=R.accounts.top;
    return {type:'bar',data:{labels:ta.map(a=>a.name.length>22?a.name.slice(0,21)+'…':a.name),datasets:[{label:bizShortLbl(R.prev),data:ta.map(a=>Math.round(a.prev)),backgroundColor:'rgba(0,22,143,0.25)',borderRadius:3},{label:'MTD',data:ta.map(a=>Math.round(a.v)),backgroundColor:'rgba(0,22,143,0.85)',borderRadius:3}]},
      options:{plugins:{legend:leg},scales:{x:{ticks:tick()},y:{beginAtZero:true,ticks:tick(money)}}}};}
  if(key==='specs'){const sp=R.specs;
    return {type:'bar',data:{labels:sp.map(s=>s.label),datasets:[{label:'MTD',data:sp.map(s=>Math.round(s.mtd)),backgroundColor:sp.map(s=>s.att==null?'rgba(0,22,143,0.6)':s.att>=100?'rgba(14,138,95,0.85)':s.att>=70?'rgba(0,22,143,0.85)':s.att>=40?'rgba(183,121,31,0.85)':'rgba(200,60,60,0.85)'),borderRadius:3},{label:'Target',data:sp.map(s=>Math.round(s.tgt||0)),backgroundColor:'rgba(0,0,0,0.12)',borderRadius:3}]},
      options:{indexAxis:'y',plugins:{legend:leg},scales:{x:{beginAtZero:true,ticks:tick(money)},y:{ticks:tick()}}}};}
  if(key==='prod'){const rows=arg||[];
    return {type:'bar',data:{labels:rows.map(p=>p.name.length>28?p.name.slice(0,27)+'…':p.name),datasets:[{label:'MTD',data:rows.map(p=>Math.round(p.v)),backgroundColor:'rgba(0,22,143,0.85)',borderRadius:3}]},
      options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:tick(money)},y:{ticks:tick()}}}};}
  if(key==='pslines'){const rows=(arg.lineRows||[]).slice(0,8);
    return {type:'bar',data:{labels:rows.map(r=>r.name),datasets:[{label:'MTD',data:rows.map(r=>Math.round(r.mtd)),backgroundColor:rows.map((r,i)=>COLORS[i%COLORS.length]),borderRadius:3}]},
      options:{plugins:{legend:{display:false}},scales:{x:{ticks:tick()},y:{beginAtZero:true,ticks:tick(money)}}}};}
  if(key==='spec'){const sp=arg;const labels=R.series.map(m=>bizShortLbl(m));
    const ds=[{type:'line',label:'Revenue',data:sp.series.map(Math.round),borderColor:'#00168F',backgroundColor:'#00168F',tension:.3,pointRadius:3}];
    if(sp.tgt)ds.push({type:'line',label:'Target',data:labels.map(()=>Math.round(sp.tgt)),borderColor:'#D85A30',borderDash:[6,4],pointRadius:0});
    return {data:{labels,datasets:ds},options:{plugins:{legend:{display:!!sp.tgt,position:'bottom',labels:{font:F,boxWidth:fs}}},scales:{x:{ticks:tick()},y:{beginAtZero:true,ticks:tick(money)}}}};}
  return null;}
function bizCharts(R){
  if(typeof Chart==='undefined')return;
  const mk=(id,cfg)=>{try{const k='_bz_'+id;if(window[k])window[k].destroy();const el=$(id);if(!el||!cfg)return;
    cfg.options=Object.assign({responsive:true,maintainAspectRatio:false},cfg.options);window[k]=new Chart(el,cfg);}catch(e){}};
  mk('bzBrand',bizChartCfg(R,'brand'));mk('bzMonthly',bizChartCfg(R,'monthly'));mk('bzAccts',bizChartCfg(R,'accts'));mk('bzSpecs',bizChartCfg(R,'specs'));}
/* Renders every chart the deck needs to a PNG data URL. Boxes are in inches (the
   deck's), drawn at 160 px per inch and 2x pixel ratio so they print crisp. */
const BIZ_CHART_BOX={brand:[9,1.7],monthly:[9,4.05],specs:[3.15,4.05],prod:[2.95,4.0],spec:[4.6,2.0],pslines:[4.2,2.6]};
async function bizChartImages(R,opts){
  opts=opts||{};const out={};
  if(typeof Chart==='undefined'||typeof document==='undefined')return out;
  const draw=(cfg,box)=>{try{const c=document.createElement('canvas');const W=Math.round(box[0]*160),H=Math.round(box[1]*160);c.width=W;c.height=H;c.style.width=W+'px';c.style.height=H+'px';
      cfg.options=Object.assign({responsive:false,animation:false,devicePixelRatio:2},cfg.options);
      const ch=new Chart(c,cfg);if(typeof ch.toBase64Image!=='function'){ch.destroy&&ch.destroy();return null;}
      const url=ch.toBase64Image('image/png',1);ch.destroy();return url&&url.length>200?url:null;}catch(e){return null;}};
  const fs=20;
  if(!opts.only){out.brand=draw(bizChartCfg(R,'brand',null,fs),BIZ_CHART_BOX.brand);
  out.monthly=draw(bizChartCfg(R,'monthly',null,fs),BIZ_CHART_BOX.monthly);
  out.specs=draw(bizChartCfg(R,'specs',null,fs),BIZ_CHART_BOX.specs);}
  out.prod={};if(!opts.only)for(const b of R.brands.filter(b=>b.mtd>0).slice(0,8)){const rows=R.products.filter(p=>p.line===b.name&&(p.v>0||p.u>0||p.tgt)).slice(0,8);if(rows.length)out.prod[b.name]=draw(bizChartCfg(R,'prod',rows,fs),BIZ_CHART_BOX.prod);}
  const want=opts&&opts.only?R.specs.filter(s=>s.name.toLowerCase()===String(opts.only).toLowerCase()):R.specs;
  out.spec={};out.pslines={};for(const sp of want){out.spec[sp.name]=draw(bizChartCfg(R,'spec',sp,fs),BIZ_CHART_BOX.spec);if(sp.lineRows&&sp.lineRows.length)out.pslines[sp.name]=draw(bizChartCfg(R,'pslines',sp,fs),BIZ_CHART_BOX.pslines);}
  return out;}

