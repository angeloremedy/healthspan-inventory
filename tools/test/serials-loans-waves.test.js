/* Headless check: splash, typeahead (the iPad fix), serials, loaners, waves,
   CRM activity. Run from the repo root: node tools/test/serials-loans-waves.test.js */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window,d=w.document;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.SB=null; w.SBUSER={id:'u1'}; w.SBPROFILE={name:'Verna'};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});

// static checks on the HTML itself
let fail=0; const out=[];
const ok=(n,c,x)=>out.push([!!c,n,x===undefined?'':String(x)]);
const html=fs.readFileSync('index.html','utf8');
ok('splash exists before any script', html.indexOf('id="splash"')>=0 && html.indexOf('id="splash"')<html.indexOf('js/01-shopify'));
ok('splash has a no-JS failsafe', /setTimeout[^]*splash[^]*8000/.test(html));
ok('splash uses the real app icon', /id="splash"[^]*?icon-512\.png/.test(html));
ok('splash is standalone-only', /display-mode: standalone/.test(html) && /id="splash" style="display:none/.test(html));
ok('browser tab never shows it', (()=>{ // jsdom is not standalone, so the gate must leave it hidden
  const el=d.getElementById('splash'); return el&&el.style.display==='none';})());
ok('all app scripts defer', (html.match(/<script defer src="js\//g)||[]).length===11, (html.match(/<script defer src="js\//g)||[]).length);
ok('CDN libs defer too', (html.match(/<script defer src="https:/g)||[]).length===2);
ok('no blocking external script left', !/<script src=/.test(html));
ok('preconnects present', /rel="preconnect" href="https:\/\/lesjigujcajxurmsmwwc/.test(html));
ok('touch inputs are 16px', /pointer:coarse.*font-size:16px/s.test(html));

const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');

const test=`
(async()=>{
const OUT=[];window.__out=OUT;
// the app boots itself (renderHome -> homeLive -> loadVisits); let those in-flight
// awaits settle BEFORE the fixture lands, or their continuations wipe it
await new Promise(r=>setTimeout(r,25));
const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
const today=new Date().toISOString().slice(0,10);
ROLE='supply_chain';SBUSER={id:'u1'};SBPROFILE={name:'Verna'};isSuper=()=>false;loadShopify=()=>{};refreshSidebar=()=>{};rerenderCurrent=()=>{};
audit=()=>{};sbAuthHeaders=async()=>({});
DATA=[{sku:'INVESTA',name:'Q SWITCHED ND:YAG LASER SYSTEM',line:'GTG',bin:'ZA01',price:0,stock:0},
      {sku:'TD040',name:'FACE NADE',line:'Inno TDS',bin:'EB04',price:100,stock:50}];
CUSTOMERS=[{name:'Dr. Cruz Clinic'}];SHOPIFY={customers:{'Skin Station':{}}};
VISITS=[{id:1,spec:'Rhas',account:'Dr. Cruz Clinic',type:'Clinic visit',outcome:'Ordered',date:today,status:'done'},
        {id:2,spec:'Rhas',account:'Skin Station',type:'Call / follow-up',outcome:'Follow-up needed',date:today,status:'done'},
        {id:3,spec:'Frank',account:'Dr. Cruz Clinic',type:'Product demo',outcome:'No order',date:today,status:'done'},
        {id:4,spec:'Rhas',account:'X',type:'Clinic visit',outcome:'Ordered',date:today,status:'planned'}];
NORDERS=[];loadVisits=async()=>VISITS;loadNativeOrders=async()=>NORDERS;

// a Supabase stub with just enough shape, plus canned rows per table
const DB={serials:[{id:1,sku:'INVESTA',serial:'INV-001',batch:null,status:'in_stock',created_at:'2026-09-01'},
                   {id:2,sku:'INVESTA',serial:'INV-002',batch:null,status:'on_loan',created_at:'2026-09-01'}],
          loans:[{id:1,serial_id:2,sku:'INVESTA',serial:'INV-002',account:'Dr. Cruz Clinic',out_date:'2026-08-01',due_date:'2026-08-20',status:'out',out_name:'Verna'}],
          waves:[{id:1,order_ids:['a','b'],created_at:'2026-09-02T00:00:00Z',created_name:'Verna'}],
          orders:[{id:'a',status:'pending',account:'Dr. Cruz Clinic',date:today,total:100,order_lines:[{sku:'TD040',name:'FACE NADE',qty:3}]},
                  {id:'b',status:'pending',account:'Skin Station',date:today,total:200,order_lines:[{sku:'TD040',name:'FACE NADE',qty:2},{sku:'INVESTA',name:'LASER',qty:1}]}]};
const mkq=t=>{const q={_t:t,select(){return q},order(){return q},limit(){return q},in(){return q},gte(){return q},
  eq(k,v){q._eq=q._eq||{};q._eq[k]=v;return q},
  maybeSingle(){return Promise.resolve({data:(DB[t]||[]).find(r=>Object.entries(q._eq||{}).every(([k,v])=>String(r[k])===String(v)))||null,error:null})},
  single(){return q.maybeSingle()},
  insert(rows){return {select(){return {single(){const r=Array.isArray(rows)?rows[0]:rows;r.id=99;(DB[t]=DB[t]||[]).push(r);return Promise.resolve({data:r,error:null});}}},then(res){ (DB[t]=DB[t]||[]).push(...(Array.isArray(rows)?rows:[rows]));return Promise.resolve({error:null}).then(res);}}},
  update(){return {eq(){return {eq(){return {select(){return Promise.resolve({data:[{id:1}],error:null})}}},select(){return Promise.resolve({data:[{id:1}],error:null})},then(res){return Promise.resolve({error:null}).then(res)}}}}},
  then(res){return Promise.resolve({data:DB[t]||[],error:null}).then(res)}};return q;};
SB={from:t=>mkq(t),auth:{getSession:async()=>({data:{session:null}})}};
BATCHES=[{skuCode:'TD040',soh:100,batch:'T11',expiry:'9/2025'}];

// ── the typeahead: the iPad fix ──
document.getElementById('content').innerHTML='<div id="ta-host"><input id="ta-in"></div>';
attachTypeahead($('ta-in'),()=>['Dr. Cruz Clinic','Skin Station','Skin Bar']);
const inEl=$('ta-in');
ok('typeahead strips the datalist attrs', inEl.getAttribute('autocomplete')==='off'&&!inEl.hasAttribute('list'));
inEl.value='skin';inEl.dispatchEvent(new Event('input'));
const opts=[...document.querySelectorAll('#ta-host [data-i]')].map(e=>e.textContent);
ok('typeahead filters', JSON.stringify(opts)===JSON.stringify(['Skin Station','Skin Bar']), opts);
inEl.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown'}));
inEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));
ok('keyboard pick works', inEl.value==='Skin Station', inEl.value);
ok('box closed after pick', document.querySelectorAll('#ta-host [data-i]').length===0);

// ── the CRM form uses it (no datalist left) ──
currentView='logvisit';renderLogVisit();
ok('CRM form has no datalist', !document.querySelector('#content datalist'));
ok('lv-acct exists sans list attr', $('lv-acct')&&!$('lv-acct').hasAttribute('list'));

// ── serials ──
currentView='serials';await renderSerials();
const t1=$('content').textContent;
ok('serials render', /INV-001/.test(t1)&&/in stock/.test(t1)&&/on loan/.test(t1));
ok('warehouse sees the add panel', /Add serials/.test(t1));
ROLE='viewer';await renderSerials();
ok('viewer gets no add panel', !/Add serials/.test($('content').textContent));
ROLE='supply_chain';

// ── loaners ──
currentView='loans';await renderLoans();
const t2=$('content').textContent;
ok('loans render', /INV-002/.test(t2)&&/Dr. Cruz Clinic/.test(t2));
ok('overdue is flagged', /overdue/.test(t2));
ok('check-out panel offers only in-stock units', /INV-001/.test(t2)&&(document.querySelectorAll('#ln-ser option').length===1));

// ── wave pick list ──
await showWavePick(1);
const t3=$('content').textContent;
ok('wave loads both orders', /Dr. Cruz Clinic/.test(t3)&&/Skin Station/.test(t3));
ok('lines merged per SKU (3+2=5)', /<b>5<\\/b>/.test($('content').innerHTML)&&/FACE NADE/.test(t3));
ok('wave carries its WV number', /WV-/.test(t3), t3.slice(0,60));
ok('per-order confirm buttons', ($('content').innerHTML.match(/Confirm picked/g)||[]).length===2);

// ── CRM activity ──
currentView='crmstats';await renderCrmStats();
const t4=$('content').textContent;
ok('crm stats render both specialists', /Rhas/.test(t4)&&/Frank/.test(t4));
ok('calls and visits split', /Calls/.test(t4)&&/Field visits/.test(t4));
ok('planned visits excluded', !/\\b3 of 4\\b/.test(t4)&&/of 3 contacts/.test(t4), t4.match(/\\d+ of \\d+ contacts/));
ok('demo counted', /Demos/.test(t4));

// the eighth finance form: registered end to end
ok('expreport is a finance kind', FIN_KINDS.includes('expreport'));
ok('expreport has itemised lines', !!(FIN_SPEC.expreport&&FIN_SPEC.expreport.lines&&FIN_SPEC.expreport.lines.cols.length===4));
ok('ER- numbering', docNo('expreport',5)==='ER-105', docNo('expreport',5));
currentView='expreport';
try{await renderFinForm('expreport');}catch(e){}
ok('router renders the form', /Expense report \\(revolving fund\\)|Expense report/.test($('content').textContent), $('content').textContent.slice(0,80).replace(/\\s+/g,' '));

// my profile: renders for a non-sales role with the stub data
ROLE='finance'; SBPROFILE={name:'Tal'};
await renderMyProfile();
const tp=$('content').textContent;
ok('profile renders identity', /Tal/.test(tp)&&/Finance/.test(tp));
ok('profile shows quick actions', /Change password/.test(tp)&&/My manual/.test(tp));
ok('profile has no sales page button for non-PS', !/My sales page/.test(tp));
SBPROFILE={name:'Rhas',specialist_tag:'Rhas'};ROLE='sales';
await renderMyProfile();
ok('PS profile links to their sales page', /My sales page/.test($('content').textContent));
ok('every role may open profile', ['sales','viewer','finance','supply_chain','manager','marketing'].every(r=>{ROLE=r;return viewAllowed('profile');}));

// back navigation for the installed app
ok('back chip exists in the mobile top bar', !!document.getElementById('mbk'));
window._navDepth=0;currentView='home';backPaint();
ok('hidden on home with no history', document.getElementById('mbk').style.display==='none');
currentView='orders';pushRoute('#/v/orders');backPaint();
ok('shown once navigated', document.getElementById('mbk').style.display!=='none');
ok('pushRoute tracked the depth', (window._navDepth||0)>=1, window._navDepth);
let wentBack=0;const _hb=history.back.bind(history);history.back=()=>{wentBack++;};
navBack();
ok('back walks history', wentBack===1&&window._navDepth===0);
navBack();   // nothing left: falls back to home instead of doing nothing
ok('back at the bottom goes home', currentView==='home'&&wentBack===1, currentView);
history.back=_hb;

// the left-edge swipe fires the same path
window._navDepth=1;currentView='orders';let backs=0;history.back=()=>{backs++;};
const T=(type,x,y)=>{const ev=new Event(type,{bubbles:true});
  ev.touches=[{clientX:x,clientY:y}];ev.changedTouches=[{clientX:x,clientY:y}];document.dispatchEvent(ev);};
T('touchstart',10,300);T('touchend',140,310);
ok('edge swipe right goes back', backs===1, backs);
window._navDepth=1;
T('touchstart',200,300);T('touchend',330,310);
ok('mid-screen swipe does nothing', backs===1, backs);
window._navDepth=1;
T('touchstart',10,300);T('touchend',60,310);
ok('short drag does nothing', backs===1, backs);
window._lastPop=Date.now();
T('touchstart',10,300);T('touchend',140,310);
ok('native-handled gesture is not doubled', backs===1, backs);
history.back=_hb;window._lastPop=0;

// ── action links become buttons, app-wide, after any paint ──
ROLE='supply_chain';SBPROFILE={name:'Verna'};
$('content').innerHTML='<div class="tcard"><table><tr><td>'+
  '<a href="#" onclick="plDecide(1,\\'approve\\');return false" style="color:var(--gr);font-weight:700;text-decoration:underline">approve ✓</a> · '+
  '<a href="#" onclick="plDecide(1,\\'reject\\');return false" style="color:var(--rd);font-size:11.5px">reject</a> · '+
  '<a href="#" onclick="plCancel(1);return false" style="color:var(--tx3)">cancel</a> · '+
  '<a href="#" onclick="archiveRecord(\\'pullout\\',1);return false" style="color:var(--rd)">delete</a>'+
  '</td><td><a href="#" onclick="showAccountPage(\\'Dr. Cruz\\');return false" style="color:var(--ac)">Dr. Cruz Clinic</a></td>'+
  '<td><a href="#" onclick="openDrawer(\\'AAA\\');return false" style="color:var(--ac)">Open inventory detail →</a></td></tr></table>'+
  '<div class="tfooter"><span><a href="#" onclick="exportX();return false">export CSV</a></span></div></div>';
await new Promise(r=>setTimeout(r,30));   // the observer coalesces into one pass on the next tick
const btns=[...$('content').querySelectorAll('a.abtn')];
ok('four action links became buttons', btns.length===4, btns.length+': '+btns.map(b=>b.textContent.trim()).join('|'));
ok('approve is green', btns[0].classList.contains('t-gr'));
ok('reject is red (outlined)', btns[1].classList.contains('t-rd'));
ok('cancel is neutral', !/t-/.test(btns[2].className));
ok('inline underline/colour stripped', !btns[0].style.color&&!btns[0].style.textDecoration);
ok('dot separators removed', !/·/.test($('content').querySelector('td').textContent));
ok('onclick untouched', (btns[0].getAttribute('onclick')||'').indexOf('plDecide(1,')===0, btns[0].getAttribute('onclick'));
ok('account name stays a link', !$('content').querySelectorAll('td')[1].querySelector('.abtn'));
ok('arrowed prose link stays a link', !$('content').querySelectorAll('td')[2].querySelector('.abtn'));
ok('footer link stays a link', !$('content').querySelector('.tfooter .abtn'));
// convergence: a second pass must change nothing
const before=$('content').innerHTML; upgradeButtons(document); await new Promise(r=>setTimeout(r,30));
ok('upgrader converges (idempotent)', $('content').innerHTML===before);

// real pages: the serials register's row actions are buttons now
currentView='serials';await renderSerials();await new Promise(r=>setTimeout(r,30));
ok('serials row actions are buttons', $('content').querySelectorAll('a.abtn').length>=2, $('content').querySelectorAll('a.abtn').length);

// sales role may open crmstats but not serials/loans
ROLE='sales';
ok('sales can open CRM activity', viewAllowed('crmstats'));
ok('sales cannot open serials', !viewAllowed('serials'));
ok('sales cannot open loaners', !viewAllowed('loans'));
window.__done=true;
})().catch(e=>{window.__err=(e&&e.stack)||String(e);window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
setTimeout(()=>{
  if(w.__err){console.error(w.__err);process.exit(1);}
  for(const [p,n,x] of out.concat(w.__out||[])){if(!p)fail++;console.log((p?'  PASS  ':'  FAIL  ')+n+(p?'':'   '+x));}
  console.log(fail?fail+' FAILED':'all passed');
  process.exit(fail?1:0);
},800);
