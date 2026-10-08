/* Ask Healthspan (2026-10-08): Claude Haiku 5.5 by default, and a product specialist's
   chat only carries what her own pages show. The catalog is built in the browser, so the
   scoping is tested on askCatalog() itself, as a manager and as a specialist.
   Run from the repo root: node tools/test/ask-scope.test.js */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});
const w=dom.window;
w.Chart=function(){return{destroy(){}}}; w.Chart.register=()=>{};
w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
const wk=fs.readFileSync('netlify/functions/ask-work-background.mjs','utf8');
const v09=fs.readFileSync('js/09-ask-ai-inapp.js','utf8');
let fail=0;const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined&&x!==''?'  → '+x:''));if(!c)fail++;};

// ── the default model ──
ok('worker: the chat asks for Claude when a Claude key exists, then the person\'s pick wins',
  /const chat = mode !== 'draft';\s*if \(chat && keyFor\('anthropic'\)\) setProviderPref\('anthropic'\);[^\n]*\n[^\n]*\n\s*if \(\['gemini', 'anthropic'\]\.includes\(pick\)\) setProviderPref\(pick\);/.test(wk));
ok('worker: Claude means Haiku 5.5, and Sonnet 5.5 by itself for a hard question; Draft with AI keeps its own model', /claudeModel: chat && provider\(\) === 'anthropic' \? \(smart \? ASK_SONNET : ASK_CLAUDE\) : ''/.test(wk)&&/const smart = isHardQuestion\(question\);/.test(wk));
const OPTS=/<option value="anthropic">Claude<\/option><option value="gemini">Gemini Flash<\/option><\/select>/;
ok('both dropdowns: Claude first, Gemini Flash second — Sonnet is not a choice', OPTS.test(html)&&OPTS.test(v09)&&!/value="sonnet"/.test(html+v09));
ok('ask.mjs forwards only gemini|anthropic', /ASK_PICK = \['gemini', 'anthropic'\];/.test(fs.readFileSync('netlify/functions/ask.mjs','utf8')));
ok('old device picks (made while Gemini was the default) are not carried over', /hs_ask_model2/.test(v09)&&!/'hs_ask_model'/.test(v09));

const test=`
(async()=>{
const OUT=[];window.__out=OUT;const ok=(n,c,x)=>OUT.push([!!c,n,x===undefined?'':String(x)]);
loadShopify=()=>{};refreshSidebar=()=>{};audit=()=>{};SB=null;
document.body.insertAdjacentHTML('beforeend','<select class="askmodel" id="m1"><option value="anthropic">a</option><option value="gemini">g</option></select>');
askPaintModel();ok('no pick on this device → the dropdown shows Claude Haiku 5.5', $('m1').value==='anthropic', $('m1').value);
askSetModel('gemini');ok('a pick is kept on the device', askGetModel()==='gemini'&&$('m1').value==='gemini');
askSetModel('');askPaintModel();ok('clearing the pick returns to Claude', $('m1').value==='anthropic');
askSetModel('sonnet');ok('"sonnet" is not a pick any more', askGetModel()==='');askSetModel('');
// every answer names the model that wrote it — Haiku 5.5, or Sonnet 5.5 when the question was hard
document.body.insertAdjacentHTML('beforeend','<div id="asklog"></div><input id="askinput"><button id="askbtn"></button>');
ASK_CUR={id:null,title:'',messages:[{r:'u',t:'Stock of TD040?'},{r:'a',t:'Haiku answer',m:'claude-haiku-5-5'},{r:'u',t:'Why did Meline drop? Compare brands.'},{r:'a',t:'Sonnet answer',m:'claude-sonnet-5-5'}]};askPaintAll();
const metas=[...$('asklog').querySelectorAll('.askmeta')].map(x=>x.textContent);
ok('each answer says which model wrote it', metas.join('|')==='Claude Haiku 5.5|Claude Sonnet 5.5', metas.join('|'));
ok('no "ask again" button — the switch is automatic', !$('asklog').querySelector('.askre')&&typeof askAgainSonnet==='undefined');

DATA=[{sku:'AAA',name:'Alpha cream',line:'Meline',stock:7,price:100,supplier:'Acme Labs Spain',expiry:'12/2027',batch:'B1'}];
BATCHES=[{skuCode:'AAA',name:'Alpha cream',batch:'B1',expiry:'12/2027',soh:7}];
CUSTOMERS=[{name:'Lady Clinic',qty:5,value:5000,orders:1,skuCount:1,trend:'up'},{name:'Rhas Derma',qty:9,value:9000,orders:2,skuCount:1,trend:'flat'}];
BRANCH_TRANSFERS=[{branch:'BGC',sku:'AAA',name:'Alpha cream',qty:3}];
OWNERS={[custNorm(acctDedup('Lady Clinic'))]:'Lady',[custNorm(acctDedup('Rhas Derma'))]:'Rhas'};
SHOPIFY={internalSplit:true,recent:[{n:'#1',dt:monthISO()+'-02',t:'Lady',c:'Walk-in Lady Account',x:0,ls:[['AAA',1,100]]},{n:'#2',dt:monthISO()+'-03',t:'Rhas',c:'Rhas Derma',x:0,ls:[['AAA',2,200]]}]};
SALESIDX={AAA:{name:'Alpha cream',line:'Meline',monthly:{}}};
TARGETS=[{month:monthISO(),scope:'SPECIALIST',name:'Lady',value:300000},{month:monthISO(),scope:'SPECIALIST',name:'Rhas',value:500000},{month:monthISO(),scope:'TOTAL',name:'',value:2000000}];
LOANS=[{status:'out',sku:'SP1',serial:'S9',account:'Rhas Derma',out_date:'2026-10-01',due_date:'2026-10-20'}];
const spec=(name,team,mtd,att)=>({name,label:name,team,mtd,tgt:1,att,prev:1,orders:1,ordering:1,newAccts:[],masterlist:3,active:2,quiet:1,visits:1,calls:1,demos:0,topAccts:[{name:name==='Rhas'?'Rhas Derma':'Lady Clinic',v:1}]});
bizCompute=()=>({label:'This month',asOf:todayISO(),total:{mtd:1,tgt:1,att:1,proj:1,qtd:1,ytd:1},accounts:{orders:2,ordering:2,newAccts:[{name:'Rhas Derma',v:9000,spec:'Rhas'},{name:'Lady Clinic',v:5000,spec:'Lady'}],
    top:[{name:'Rhas Derma',v:9000,prev:0,orders:2,lines:1,spec:'Rhas'},{name:'Lady Clinic',v:5000,prev:0,orders:1,lines:1,spec:'Lady'}],lapsed:[{name:'Rhas Derma',days:60,o:3,v:1,owner:'Rhas'}],
    risers:[{name:'Rhas Derma',d:100}],fallers:[{name:'Lady Clinic',d:-50}],dealShare:0,free:0},
  brands:[],series:[],specs:[spec('Lady','T1',5000,50),spec('Rhas','T2',9000,90)],products:[],machines:{rev:0,units:0,installs:0,loansOut:0,onLoan:0,inStock:0,rows:[]},
  activity:{visits:0,calls:0,demos:0,ordered:0,opened:0},trends:[{t:'Rhas Derma is Rhas Porciuncula\\'s biggest account this month.'}],unassigned:{v:0,tags:[]}});

ROLE='manager';SBPROFILE={name:'M',role:'manager'};
const M=askCatalog();
ok('manager: the full catalog — every account, batches, suppliers, shipments, all targets, loaners, observations',
  /Rhas Derma/.test(M)&&/Lady Clinic/.test(M)&&/BATCHES/.test(M)&&/Acme Labs/.test(M)&&/REMEDY SHIPMENTS/.test(M)&&/SPECIALIST\\|Rhas/.test(M)&&/DEMO \\/ LOANER/.test(M)&&/WHAT HQ NOTICED/.test(M));

ROLE='sales';SBPROFILE={name:'Lady',role:'sales',specialist_tag:'Lady'};
const L=askCatalog();
ok('specialist: her own accounts are in (owned, or ordered under her tag)', /Lady Clinic/.test(L)&&askScope().acct('Walk-in Lady Account'));
ok('specialist: another specialist\\'s account appears nowhere', !/Rhas Derma/.test(L), (L.match(/.{0,40}Rhas Derma.{0,40}/)||[''])[0]);
ok('specialist: the leaderboard stays (names, MTD, attainment) …', /leaderboard[\\s\\S]*Rhas\\|T2\\|₱9,000/.test(L));
ok('… but full details only for her', /YOUR NUMBERS THIS MONTH[^\\n]*\\nLady\\|/.test(L)&&!/YOUR NUMBERS THIS MONTH[^\\n]*\\n(?:[^\\n]*\\n)*Rhas\\|T2\\|₱9,000\\|₱1/.test(L));
ok('specialist: her target and the company total, not another specialist\\'s target', /SPECIALIST\\|Lady/.test(L)&&/TOTAL\\|TOTAL/.test(L)&&!/SPECIALIST\\|Rhas/.test(L));
ok('specialist: no batches, suppliers, Remedy shipments, write-off risk, loaners or account-naming observations',
  !/BATCHES with stock/.test(L)&&!/Acme Labs/.test(L)&&!/REMEDY SHIPMENTS/.test(L)&&!/WRITE-OFF RISK/.test(L)&&!/DEMO \\/ LOANER/.test(L)&&!/WHAT HQ NOTICED/.test(L));
ok('specialist: the model is told the scope', /SCOPE: this person is a product specialist \\(Lady\\)/.test(L));
ok('unit costs never come from the browser (only the server adds them, for finance and admin)', !/UNIT COSTS/.test(M)&&!/UNIT COSTS/.test(L));
})().catch(e=>{window.__out=[[false,'crashed: '+(e&&e.stack||e),'']];}).finally(()=>{window.__done=true;});
`;
w.eval(app+'\n;\n'+test);
(async()=>{const t0=Date.now();while(!w.__done&&Date.now()-t0<20000)await new Promise(r=>setTimeout(r,20));
  for(const [c,n,x] of (w.__out||[[false,'timed out','']]))ok(n,c,x);
  console.log('\n'+(fail?fail+' FAILED':'all passed'));process.exit(fail?1:0);})();
