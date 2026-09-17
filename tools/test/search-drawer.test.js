/* Headless check: the smart search (js/18-search.js) and the drawer's back-navigation
   fix (Alex, 2026-09-17). Run from the repo root: node tools/test/search-drawer.test.js */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window,d=w.document;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.SB=null; w.SBUSER={id:'u1'}; w.SBPROFILE={name:'Admin'};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
let fail=0; const out=[];
const ok=(n,c,x)=>out.push([!!c,n,x===undefined?'':String(x)]);
const html=fs.readFileSync('index.html','utf8');

// ── static: markup and wiring ──
ok('search module is the 19th script', /<script defer src="js\/18-search\.js"><\/script>/.test(html));
ok('sidebar box runs both the page filter and the record search, with keyboard handling', /id="navq"[^>]*oninput="navFilter\(this\.value\);srInput\(this\.value\)"[^>]*onkeydown="srKey\(event\)"/.test(html));
ok('menu box on phones keeps buildMobileMenu (the search hooks it)', /id="mmq"[^>]*oninput="buildMobileMenu\(this\.value\)"/.test(html));
ok('drawer has a sticky close row with a Back button for phones', /<div class="dhead"><button class="dback" onclick="closeDrawer\(\)">← Back<\/button><button class="dclose" onclick="closeDrawer\(\)"/.test(html) && /\.dhead\{position:sticky;top:0/.test(html));
ok('on phones the drawer sits between the top bar and the bottom tabs', /@media\(max-width:760px\)\{body\.authed \.drawer\{top:calc\(56px \+ var\(--sat,0px\)\);height:auto;bottom:calc\(64px \+ env\(safe-area-inset-bottom,0px\)\)\}/.test(html));
ok('row flash style present', /\.sr-hl\{animation:srflash/.test(html));
const src18=fs.readFileSync('js/18-search.js','utf8');
ok('no browser dialogs in the search module', !/\b(alert|confirm|prompt)\(/.test(src18));
ok('result lines never carry amounts or costs', !/fmtPeso|peso_value|landed|unit_cost|fmtP\(/.test(src18) && !/amount\|\|/.test(src18));
ok('every database query is limited', (src18.match(/SB\.from\(/g)||[]).length===(src18.match(/\.limit\(/g)||[]).length, (src18.match(/SB\.from\(/g)||[]).length+' vs '+(src18.match(/\.limit\(/g)||[]).length);
ok('search opens are in the activity log', /audit\('search\.open'/.test(src18));

const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
const test=`
(async()=>{
const OUT=[];window.__out=OUT;
await new Promise(r=>setTimeout(r,25));
const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);

// ── a fake Supabase: chainable, records the table, answers from fixtures ──
const FIX={
  orders:[{id:'o-1',num:42,account:'Dr. Cruz Clinic',spec:'Rhas',date:'2026-09-02',status:'fulfilled',total:12000,source:'native',ext_ref:null},
          {id:'o-2',num:43,account:'Skin Station',spec:'Frank',date:'2026-09-05',status:'pending',total:30000,source:'native',ext_ref:null}],
  accounts:[{name:'Dr. Cruz Clinic',specialty:'Derma'},{name:'Cruz Aesthetics',specialty:''}],
  quotes:[{id:'q1',num:7,account:'Dr. Cruz Clinic',spec:'Rhas',status:'sent',date:'2026-09-01'}],
  pos:[{id:5,supplier:'Mesoestetic',status:'ordered',eta:'2026-10-01'}],
  fin_requests:[{id:'f1',num:7,kind:'reimburse',payee:'Cruz Pharmacy',requester_name:'Tal',amount:1500,status:'submitted',date_requested:'2026-09-10',ref_no:''}],
  pullouts:[],transfers:[],complaints:[{id:5,account:'Dr. Cruz Clinic',status:'open',description:'broken seal'}],shipments:[],serials:[{id:'s1',sku:'TD040',serial:'SN-CRUZ-1',status:'in_stock',batch:'B1'}],loans:[],suppliers:[],pdcs:[],returns:[]};
const CALLS=[];
function chain(t){const st={t,filters:[]};const c={};
  for(const m of ['select','is','order','limit','in','or','ilike','eq','not']){c[m]=(...a)=>{st.filters.push([m,...a]);return c;};}
  c.maybeSingle=()=>Promise.resolve({data:null});
  c.then=(res,rej)=>{CALLS.push(st);let rows=(FIX[t]||[]).slice();
    for(const f of st.filters){
      if(f[0]==='in')rows=rows.filter(r=>f[2].includes(r[f[1]]));
      if(f[0]==='eq')rows=rows.filter(r=>String(r[f[1]])===String(f[2]));
      if(f[0]==='ilike'){const q=String(f[2]).replace(/%/g,'').toLowerCase();rows=rows.filter(r=>String(r[f[1]]||'').toLowerCase().includes(q));}
      if(f[0]==='or'){const parts=String(f[1]).split(/,(?![^()]*\\))/);rows=rows.filter(r=>parts.some(p=>{
        let m=p.match(/^(\\w+)\\.ilike\\.%(.*)%$/);if(m)return String(r[m[1]]||'').toLowerCase().includes(m[2].toLowerCase());
        m=p.match(/^(\\w+)\\.eq\\.(.*)$/);if(m)return String(r[m[1]])===m[2];
        m=p.match(/^and\\((.*)\\)$/);if(m)return m[1].split(',').every(x=>{const y=x.match(/^(\\w+)\\.eq\\.(.*)$/);return y&&String(r[y[1]])===y[2];});
        return false;}));}
    }
    return Promise.resolve({data:rows,error:null}).then(res,rej);};
  return c;}
SB={from:chain};SBUSER={id:'u1'};

// ── document numbers ──
const P=q=>srDocParse(q).map(x=>x.kind+':'+x.n).join(',');
ok('HS-1042 → order 42 (printed offset removed)', P('HS-1042')==='order:42', P('HS-1042'));
ok('dash optional, any case, spaces ignored', P('hs1042')==='order:42' && P(' HS - 1042 ')==='order:42');
ok('RE-1007 → reimbursement 7; QT-0007 → quote 7; ER-105 → expense report 5', P('RE-1007')==='reimburse:7' && P('QT-0007')==='quote:7' && P('ER-105')==='expreport:5', P('RE-1007')+' '+P('QT-0007')+' '+P('ER-105'));
ok('C-5 is a complaint, never a credit memo or cash advance', P('C-5')==='complaint:5' && P('CM-1003')==='cm:3' && P('CA-1002')==='cashadvance:2');
ok('a plain word parses as nothing', P('cruz')==='');

// ── which kinds each role may search ──
ROLE='admin';SBPROFILE={name:'Admin',role:'admin'};
let K=srKinds();
ok('admin may search everything', K.products&&K.orders&&K.accounts&&K.pos&&K.fin.length===7&&K.shipments&&K.serials&&K.pdcs);
ROLE='sales';SBPROFILE={name:'Rhas',role:'sales',specialist_tag:'Rhas'};
K=srKinds();
ok('specialist: orders, accounts, quotes, complaints, pull-outs, finance forms — never POs, shipments, serials, cheques, SKUs', K.orders&&K.accounts&&K.quotes&&K.complaints&&K.pullouts&&K.fin.length===7&&!K.pos&&!K.shipments&&!K.serials&&!K.pdcs&&!K.products&&!K.returns);
ROLE='viewer';SBPROFILE={name:'V',role:'viewer'};
K=srKinds();
ok('viewer: read-only orders and the finance forms they may file — no POs, cheques, credit memos, transfers', K.orders&&!K.pos&&!K.pdcs&&!K.returns&&!K.transfers&&K.fin.length===7);
ROLE='finance';SBPROFILE={name:'Tal',role:'finance'};
K=srKinds();
ok('finance: cheques, POs, requests, orders — no warehouse transfers', K.pdcs&&K.pos&&K.orders&&!K.transfers);

// ── a real search, as admin ──
ROLE='admin';SBPROFILE={name:'Admin',role:'admin'};
DATA.length=0;DATA.push({sku:'T-DGLA0010',name:'AOX Glutathione 60 comp',line:'MESO',supplier:'Mesoestetic',stock:92},{sku:'TD040',name:'Cruz Serum',line:'MESO',supplier:'X',stock:5});
SHOPIFY={recent:[{n:'#HG-10142',dt:'2026-09-01',t:'Frank',c:'Cruz Derma Center',ls:[]}],customers:{'Cruz Derma Center':{}},specialists:{Rhas:{},Frank:{}}};
let painted=[];
let g=await srRun('cruz',(groups,done)=>{painted.push([groups.map(x=>x.title).join('|'),done]);});
const titles=g.map(x=>x.title);
ok('admin "cruz": products, orders, accounts and the record lists all answer', titles.includes('Products')&&titles.includes('Orders')&&titles.includes('Accounts')&&titles.includes('Quotations')&&titles.includes('Finance requests')&&titles.includes('Complaints')&&titles.includes('Serial numbers'), titles.join(','));
ok('paints twice: memory first, database after', painted.length===2&&painted[0][1]===false&&painted[1][1]===true, JSON.stringify(painted));
const ord=g.find(x=>x.title==='Orders').items;
ok('native order labelled HS-1042 sits before the Shopify one; Shopify order keeps its number', ord[0].label==='HS-1042'&&ord.some(x=>x.label==='HG-10142'&&/Shopify/.test(x.sub)), JSON.stringify(ord.map(x=>x.label)));
ok('accounts merge the loaded names with the accounts table, no duplicates', (()=>{const a=g.find(x=>x.title==='Accounts').items.map(x=>x.label);return a.includes('Cruz Derma Center')&&a.includes('Dr. Cruz Clinic')&&a.includes('Cruz Aesthetics')&&new Set(a).size===a.length;})());
ok('finance request labelled by its printed number with the form title', g.find(x=>x.title==='Finance requests').items[0].label==='RE-1007'&&/Expense reimbursement/.test(g.find(x=>x.title==='Finance requests').items[0].sub), JSON.stringify(g.find(x=>x.title==='Finance requests').items[0]));
ok('no result line shows an amount', SR_HITS.every(h=>!/₱|\\d,\\d{3}\\.\\d\\d/.test(h.sub||'')));
ok('every hit is numbered and has an opener', SR_HITS.every((h,i)=>h.i===i&&typeof h.go==='function'));
// document number → exact row
g=await srRun('HS-1042',()=>{});
ok('"HS-1042" finds order 42 by number, not by text', g.find(x=>x.title==='Orders').items.length===1&&g.find(x=>x.title==='Orders').items[0].label==='HS-1042'&&CALLS.some(c=>c.t==='orders'&&c.filters.some(f=>f[0]==='in'&&f[1]==='num'&&f[2][0]===42)));
g=await srRun('RE-1007',()=>{});
ok('"RE-1007" finds the reimbursement by (kind, num)', g.find(x=>x.title==='Finance requests').items.length===1&&CALLS.some(c=>c.t==='fin_requests'&&c.filters.some(f=>f[0]==='or'&&/and\\(kind\\.eq\\.reimburse,num\\.eq\\.7\\)/.test(f[1]))));
g=await srRun('PO-1005',()=>{});
ok('"PO-1005" finds the PO and its opener expands that PO on the list', g.find(x=>x.title==='Purchase orders').items[0].label==='PO-1005');
// SKU by code and by name
g=await srRun('dgla',()=>{});
ok('SKU code fragment finds the product with stock on hand in the line', g.find(x=>x.title==='Products').items[0].label==='AOX Glutathione 60 comp'&&/92 on hand/.test(g.find(x=>x.title==='Products').items[0].sub));
g=await srRun('glutath',()=>{});
ok('product name fragment works too', g.find(x=>x.title==='Products').items.length===1);
// pages
g=await srRun('receiv',()=>{});
ok('pages answer by label', g.find(x=>x.title==='Pages').items.some(x=>x.label==='Receiving'), JSON.stringify((g.find(x=>x.title==='Pages')||{items:[]}).items.map(x=>x.label)));

// ── the same search as a specialist ──
ROLE='sales';SBPROFILE={name:'Rhas',role:'sales',specialist_tag:'Rhas'};
CALLS.length=0;
g=await srRun('cruz',()=>{});
const t2=g.map(x=>x.title);
ok('specialist: no Products, no Serial numbers, no Purchase orders in the answer', !t2.includes('Products')&&!t2.includes('Serial numbers')&&!t2.includes('Purchase orders'), t2.join(','));
ok('specialist never queries pos, serials, pdcs, shipments', !CALLS.some(c=>['pos','serials','pdcs','shipments','suppliers'].includes(c.t)));
ok('Shopify orders of another specialist are not offered (Frank\\'s HG-10142)', !(g.find(x=>x.title==='Orders')||{items:[]}).items.some(x=>x.label==='HG-10142'));
ok('specialist accounts come from their own orders, not the master list', !CALLS.some(c=>c.t==='accounts')&&CALLS.some(c=>c.t==='orders'&&c.filters.some(f=>f[0]==='ilike'&&f[1]==='account')));
ok('quotes of other specialists are dropped even if the database returned them', !(g.find(x=>x.title==='Quotations')||{items:[]}).items.some(x=>/Frank/.test(x.sub)));

// ── picking a hit ──
ROLE='admin';SBPROFILE={name:'Admin',role:'admin'};
let opened=null;window.showAccountPage=n=>{opened=n;};
g=await srRun('cruz aest',()=>{});
const hit=SR_HITS.find(h=>h.t==='acct'&&h.label==='Cruz Aesthetics');
srPick(hit.i);
ok('picking an account hit opens the account page and clears the box', opened==='Cruz Aesthetics'&&$('navq').value==='');
// keyboard
$('navq').value='cruz';srInput('cruz');await new Promise(r=>setTimeout(r,420));
const panel=$('srpanel');
ok('desktop panel appears beside the box with grouped hits', panel&&panel.style.display==='block'&&panel.querySelectorAll('.sr-grp').length>=3&&panel.querySelectorAll('.sr-it').length===SR_HITS.length);
srKey({key:'ArrowDown',preventDefault(){},target:$('navq')});srKey({key:'ArrowDown',preventDefault(){},target:$('navq')});
ok('arrow keys move the selection', SR_SEL===1&&panel.querySelector('.sr-it.sel').dataset.i==='1');
srKey({key:'Escape',preventDefault(){},target:$('navq')});
ok('Escape closes the panel', panel.style.display==='none');
// phones: the menu box
buildMobileMenu('cruz');await new Promise(r=>setTimeout(r,60));
ok('menu search prepends a records block (pages stay in the menu list itself)', !!$('sr-mobile')&&$('sr-mobile').querySelectorAll('.sr-grp').length>=2&&![...$('sr-mobile').querySelectorAll('.sr-grp')].some(e=>e.textContent==='Pages'));

// ── the drawer trap (Alex) ──
window.showAccountPage=showAccountPage;
const dr=$('drawer');const depth0=window._navDepth||0;
dr.classList.add('open');await new Promise(r=>setTimeout(r,0));
ok('opening a drawer pushes one history step', window._drawerHist===true&&(window._navDepth||0)===depth0+1);
closeDrawer();
ok('✕ closes it and walks history back (popstate to be skipped)', !dr.classList.contains('open')&&window._drawerHist===false&&window._drawerPopSkip===true&&(window._navDepth||0)===depth0);
applyRoute(); // the popstate that history.back() produces
ok('that popstate re-renders nothing and clears the skip flag', window._drawerPopSkip===false);
dr.classList.add('open');await new Promise(r=>setTimeout(r,0));
const viewBefore=currentView;let rendered=0;const _sv=showView;window.showView=function(v,el){rendered++;return _sv(v,el);};
applyRoute(); // ← in the top bar, the edge swipe or the phone's own back
ok('back while a drawer is open closes the drawer and keeps the page', !dr.classList.contains('open')&&currentView===viewBefore&&rendered===0);
window.showView=_sv;
dr.classList.add('open');await new Promise(r=>setTimeout(r,0));
showView('home',null);
ok('navigating (a bottom tab, the sidebar) closes the drawer', !dr.classList.contains('open')&&window._drawerHist===false);
openDrawer('T-DGLA0010');await new Promise(r=>setTimeout(r,0));
ok('the SKU drawer still opens and starts scrolled to the top', dr.classList.contains('open')&&dr.scrollTop===0&&/AOX Glutathione/.test($('dbody').textContent));
window.__done=true;
})().catch(e=>{window.__err=(e&&e.stack)||String(e);window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
setTimeout(()=>{
  if(w.__err){console.error(w.__err);process.exit(1);}
  for(const [p,n,x] of out.concat(w.__out||[])){if(!p)fail++;console.log((p?'  PASS  ':'  FAIL  ')+n+(p?'':'   '+x));}
  console.log(fail?fail+' FAILED':'all passed');
  process.exit(fail?1:0);
},2500);
