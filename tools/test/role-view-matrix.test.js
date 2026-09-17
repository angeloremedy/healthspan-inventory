/* The role × view matrix: every page in the dispatch, rendered as every role, against
   an empty (but well-formed) database — nothing may throw, nothing may leave the page
   on the loading placeholder, and a role that viewAllowed() refuses must land on Home
   (or Sales overview for specialists). Errors are collected per (role, view) so one bad
   page never hides the others. Run from the repo root: node tools/test/role-view-matrix.test.js */
const {JSDOM,VirtualConsole}=require('jsdom'); const fs=require('fs');
let CUR=null; // the window under test, so process-level rejections land in its error list
process.on('unhandledRejection',e=>{if(CUR)CUR.__errors.push('rejection: '+(e&&e.stack||e));});
const html=fs.readFileSync('index.html','utf8');
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
const dispatch=fs.readFileSync('js/02-views.js','utf8');
// the views the dispatch knows (between showView's T map and the end of the else-if chain)
const VIEWS=[...new Set([...dispatch.matchAll(/v==='([a-z_]+)'\)\s*(?:render|show|await)/g)].map(m=>m[1]))];
const ROLES=[
  {role:'admin',profile:{name:'A',role:'admin',is_super:true}},
  {role:'admin',profile:{name:'A',role:'admin',is_super:false},label:'admin (not super)'},
  {role:'manager',profile:{name:'M',role:'manager'}},
  {role:'sales',profile:{name:'S',role:'sales',specialist_tag:'Rhas'}},
  {role:'supply_chain',profile:{name:'W',role:'supply_chain'}},
  {role:'finance',profile:{name:'F',role:'finance'}},
  {role:'marketing',profile:{name:'K',role:'marketing'}},
  {role:'viewer',profile:{name:'V',role:'viewer'}},
];
let fail=0; const out=[]; const ok=(n,c,x)=>{out.push([!!c,n,x===undefined?'':String(x)]);if(!c)fail++;};
ok('dispatch lists a healthy number of views', VIEWS.length>100, VIEWS.length);

function boot(){
  const vc=new VirtualConsole();const errs=[];
  vc.on('jsdomError',e=>errs.push('jsdomError: '+(e&&e.stack||e)));vc.on('error',(...a)=>{const m=a.map(String).join(' ');if(/Error|error/.test(m)&&!/favicon|Could not load|Not implemented/.test(m))errs.push('console.error: '+m);});
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;CUR=w;
  w.Chart=function(){return{destroy(){},update(){},resize(){}}}; w.Chart.register=()=>{};
  w.fetch=async()=>({ok:true,status:200,json:async()=>({}),text:async()=>'',blob:async()=>new w.Blob([])});
  w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=function(){};
  w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
  w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
  w.__errors=errs;w.__trace=!!process.env.TRACE;
  w.addEventListener('error',e=>{w.__errors.push('error: '+(e.error&&e.error.stack||e.message));});
  w.addEventListener('unhandledrejection',e=>{w.__errors.push('rejection: '+(e.reason&&e.reason.stack||e.reason));});
  // a fake Supabase: every table answers [] (or null for single), auth is signed in
  const chain=()=>{const c={};for(const m of ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte','like','ilike','is','in','or','not','order','limit','range','match','contains','filter','textSearch']){c[m]=()=>c;}
    c.single=()=>Promise.resolve({data:null,error:null});c.maybeSingle=()=>Promise.resolve({data:null,error:null});
    c.then=(res,rej)=>Promise.resolve({data:[],error:null,count:0}).then(res,rej);return c;};
  w.__fakeSB={from:()=>chain(),rpc:()=>chain(),auth:{getSession:async()=>({data:{session:{access_token:'t',user:{id:'u1',email:'x@y'}}}}),getUser:async()=>({data:{user:{id:'u1'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({}),updateUser:async()=>({data:{},error:null})},
    storage:{from:()=>({upload:async()=>({data:{},error:null}),getPublicUrl:()=>({data:{publicUrl:''}})})},channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}};
  return w;
}

(async()=>{
  for(const R of ROLES){
    const w=boot();
    const label=R.label||R.role;
    // ONE eval: the app and the driver share the same lexical scope (let/const globals
    // are invisible across separate eval calls)
    const driver=`
window.__done=false;
(async()=>{
  await new Promise(r=>setTimeout(r,30));
  SB=window.__fakeSB;SBUSER={id:'u1',email:'x@y'};SBPROFILE=${JSON.stringify(R.profile)};ROLE='${R.role}';document.body.classList.add('authed');
  const VIEWS=${JSON.stringify(VIEWS)};const threw=[],stuck=[],leaked=[];
  for(const v of VIEWS){
    if(window.__trace)console.error('view',v);
    window.__errors.length=0;let err=null;
    try{await (async()=>{showView(v,null);})();await new Promise(r=>setTimeout(r,25));}catch(e){err=e;}
    const allowed=viewAllowed(v);const content=document.getElementById('content');const txt=(content&&content.textContent||'').trim();
    if(err||window.__errors.length)threw.push(v+' → '+(err?String(err&&err.message||err).split(String.fromCharCode(10))[0]:window.__errors[0].split(String.fromCharCode(10))[0]));
    if(!allowed){if(currentView===v)leaked.push(v);}
    else if(currentView===v&&/^Loading([.]{3}|…)$/.test(txt)&&v!=='ask')stuck.push(v);
  }
  window.__res={threw,stuck,leaked};
})().catch(e=>{window.__res={threw:['driver: '+(e&&e.stack||e)],stuck:[],leaked:[]};}).finally(()=>{window.__done=true;});
`;
    w.eval(app+'\n;\n'+driver);
    const t0=Date.now();while(!w.__done&&Date.now()-t0<120000)await new Promise(r=>setTimeout(r,50));
    const R2=w.__res||{threw:['timed out'],stuck:[],leaked:[]};
    ok(label+': no page throws while rendering', R2.threw.length===0, R2.threw.join(' | '));
    ok(label+': a refused page never renders itself', R2.leaked.length===0, R2.leaked.join(','));
    ok(label+': no page is left on the loading placeholder', R2.stuck.length===0, R2.stuck.join(','));
    w.close();
  }
  for(const [p,n,x] of out)console.log((p?'  PASS  ':'  FAIL  ')+n+(p?'':'   '+x));
  console.log(fail?fail+' FAILED':'all passed');
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
