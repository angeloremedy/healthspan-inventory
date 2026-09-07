/* Generates content/_directory.json from the LIVE app: for each of the nine manuals,
   every sidebar page that role may open (viewAllowed), grouped under the sidebar's
   own headings, with the page's plain-language description (DESC). compose.py
   appends it to each manual as "Your pages — the complete directory", so a manual
   can never miss a page its reader can reach. Run from the repo root:
     node tools/manuals/directory.js */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://hq.healthspan.ph/'});const w=dom.window,d=w.document;
w.Chart=function(){return{destroy(){}}};w.Chart.register=()=>{};w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});
const app=fs.readdirSync('js').sort().map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n;\n');
// sidebar order: headings (.nlbl) and pages (.ni showView) as they appear
const items=[];let sec='Home';
for(const el of d.querySelectorAll('.nav > *')){
  if(el.classList.contains('nlbl')){sec=el.textContent.replace(/[▾▸]/g,'').trim();continue;}
  const m=(el.getAttribute('onclick')||'').match(/showView\('([a-z0-9_]+)'/);
  if(m)items.push({sec,view:m[1]});
}
const roles={1:'sales',2:'manager',3:'supply_chain',4:'finance',5:'marketing',6:'admin',7:'admin',8:'viewer',9:'viewer'};
const tm=app.match(/const T=\{([^]*?)\};\s*\n/);
const script=`window.__dir={};window.__T=(${'{'+tm[1]+'}'});window.__D=DESC;
(function(){const R=${JSON.stringify(roles)};const V=${JSON.stringify(items.map(i=>i.view))};
for(const n of Object.keys(R)){ROLE=R[n];isSuper=()=>n==='7';canUserAdmin=()=>n==='9';window.__dir[n]=V.filter(v=>{try{return viewAllowed(v);}catch(e){return false;}});}})();`;
w.eval(app+'\n;\n'+script);
const strip=s=>String(s||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
// the first two sentences are enough for a directory row; the manual's own sections carry the detail
const brief=s=>{const t=strip(s);const m=t.match(/^(.*?[.!?])(\s+[^.!?]*[.!?])?/);return m?(m[1]+(m[2]||'')).trim():t;};
const FALLBACK={neworder:'Take an order: searchable account and product pickers, deal pricing (the +1 lines add themselves), FOC lines, credit and approval checks, an HS number on submit.',
  orders:'The register of every HQ order — status, amount, paid and balance, shipment marks — with a full page per order.'};
const out={};
for(const n of Object.keys(roles)){
  const ok=new Set(w.__dir[n]);
  out[n]=items.filter(i=>ok.has(i.view)&&i.view!=='home').map(i=>({sec:i.sec,view:i.view,title:strip(w.__T[i.view]||i.view),desc:brief(w.__D[i.view]||FALLBACK[i.view]||'')}));
}
fs.writeFileSync('tools/manuals/content/_directory.json',JSON.stringify(out,null,1));
console.log('directory:',Object.entries(out).map(([n,v])=>n+':'+v.length).join(' '));
process.exit(0);
