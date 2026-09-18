/* ── ORG CHART (Company → Org chart) ──────────────────────────────────────────
   Healthspan Global's organisational chart. Every name is a button: it opens the
   person's card — title, who they report to, who reports to them, their level, the
   HQ account they are linked to — and, where HQ has a page for the person, the way
   to it (a product specialist's sales page; Team & access for those who may open it).
   Open to every role: it carries no cost, no pay, nothing but names, titles and the
   reporting line.
   The chart lives in public.org_people (RLS: everyone signed in reads; admin and
   super admin write — People Operations use an admin account). Admins get an Edit
   mode: add a person or a team label, change name / title / reports-to / level, link
   the row to an HQ account, remove. Every change is audited. ORG_SEED is the People
   team's chart as read on 2026-09-18 (the Healthspan page of their Canva design): it
   loads into the table the first time an admin opens an empty chart, and is what
   everyone sees until the table exists.
   Two layouts: the tree (wide screens, scrolls sideways) and the outline (phones, or
   the List toggle) — same data, same buttons. */
const ORG_LEVEL={founder:{lbl:'Co-Founders',one:'Co-Founder',bg:'#00168F',fg:'#fff',bd:'#00168F'},manager:{lbl:'Managers',one:'Manager',bg:'#FFE58A',fg:'#3a2e00',bd:'#E5C445'},lead:{lbl:'Leads',one:'Lead',bg:'#FFB459',fg:'#3a2000',bd:'#E0912A'},associate:{lbl:'Associates',one:'Associate',bg:'#DCE7FF',fg:'#10245E',bd:'#9DB4F0'},consultant:{lbl:'Part-Timers / Consultants',one:'Part-timer / Consultant',bg:'#F9D9DF',fg:'#5a1e2a',bd:'#E6A4B2'},intern:{lbl:'Interns',one:'Intern',bg:'#F0F0F4',fg:'#333',bd:'#C8C8D2'},vacant:{lbl:'Vacant',one:'Vacant post',bg:'#E3F6E5',fg:'#1f5b2a',bd:'#8CCB99'}};
// boss: the id reported to; 'exec' = the two co-founders jointly; a level:'group' row is a team label the line passes through
const ORG_SEED=[
  {id:'paul',name:'Paul Rivera',title:'Managing Director, Co-Founder',boss:null,level:'founder',sort:1},
  {id:'april',name:'Dra. April Geraldez-Rivera',title:'Medical Director, Co-Founder',boss:null,level:'founder',sort:2},
  {id:'alexis',name:'Alexis Catapang',title:'Group Finance Manager',boss:'exec',level:'manager',sort:10},
  {id:'agnes',name:'Agnes Fernando',title:'Group People Operations Sr. Manager',boss:'exec',level:'manager',sort:11},
  {id:'ivy',name:'Ivy Buenaobra-Cano',title:'Group Office Manager & Executive Assistant',boss:'exec',level:'associate',sort:12},
  {id:'justine',name:'Felicilda, Mary Justine R.',title:'Group IT Operations Associate',boss:'exec',level:'associate',sort:13},
  {id:'angelo',name:'Mojica, Angelo Brylle A.',title:'Group AI Engineer',boss:'exec',level:'associate',sort:14},
  {id:'maria',name:'Maria Drake Brockman',title:'Marketing Associate',boss:'exec',level:'associate',sort:15},
  {id:'miyahra',name:'Miyahra Lopez',title:'Medical Liaison',boss:'exec',level:'consultant',sort:16},
  {id:'marj',name:'Marjorie Sy',title:'Country Sales Head',boss:'exec',level:'manager',sort:17},
  {id:'kristal',name:'Kristal Laurente',title:'Finance Lead',boss:'alexis',level:'lead',sort:20},
  {id:'julia',name:'Julia Razo',title:'Accounting Associate',boss:'kristal',level:'associate',sort:21},
  {id:'dazthyn',name:'Dazthyn Jumawid',title:'Accounting Associate',boss:'kristal',level:'associate',sort:22},
  {id:'sean',name:'Sean Carey',title:'Accounting Associate',boss:'kristal',level:'associate',sort:23},
  {id:'kathleen',name:'Kathleen Ivy Batiancila',title:'Bookkeeper',boss:'kristal',level:'associate',sort:24},
  {id:'gladys',name:'Gladys Royales',title:'Group Procurement Officer',boss:'alexis',level:'associate',sort:25},
  {id:'jerome',name:'Jerome Matias',title:'Group Facilities Officer',boss:'alexis',level:'associate',sort:26},
  {id:'emelyn',name:'Emelyn Jore',title:'Group People Operations Jr. Manager',boss:'agnes',level:'manager',sort:30},
  {id:'aiko',name:'Aiko Gonzales',title:'Group Sr. People Operations Associate',boss:'emelyn',level:'associate',sort:31},
  {id:'bernadette',name:'Bernadette Sison',title:'Group Sr. People Operations Associate',boss:'emelyn',level:'associate',sort:32},
  {id:'nerissa',name:'Nerissa Ramos',title:'Group People Operations Associate',boss:'emelyn',level:'associate',sort:33},
  {id:'angela',name:'Angela Ibon',title:'Group People Operations Associate',boss:'emelyn',level:'associate',sort:34},
  {id:'mich',name:'Mich Fariñas',title:'Group People Operations Associate',boss:'emelyn',level:'associate',sort:35},
  {id:'ceferino',name:'Jumao-as, Ceferino',title:'Group AI Intern',boss:'angelo',level:'intern',sort:40},
  {id:'jeanne',name:'Jeanne Tecson',title:'Marketing Intern',boss:'maria',level:'intern',sort:41},
  {id:'patricia',name:'Patricia Fugen',title:'Multimedia Associate',boss:'maria',level:'associate',sort:42},
  {id:'carmen',name:'Carmen Melo',title:'Content Creator',boss:'maria',level:'associate',sort:43},
  {id:'nadine',name:'Nadine Bayot',title:'Graphic Designer',boss:'maria',level:'associate',sort:44},
  {id:'verna',name:'Vernadette Arco',title:'Supply Chain Manager',boss:'marj',level:'manager',sort:50},
  {id:'joemar',name:'Joemar Clemencio',title:'Logistics and Operations Associate',boss:'verna',level:'associate',sort:51},
  {id:'rose',name:'Rose Camba',title:'Logistics and Operations Associate',boss:'verna',level:'associate',sort:52},
  {id:'angelie',name:'Angelie Alejandria',title:'Logistics and Operations Associate',boss:'verna',level:'associate',sort:53},
  {id:'floyd',name:'Floyd Esperida',title:'Field Service Technician',boss:'verna',level:'associate',sort:54},
  {id:'camille',name:'Camille Nim',title:'Regulatory Affairs Specialist',boss:'verna',level:'associate',sort:55},
  {id:'maricris',name:'Maricris Libatique',title:'Product Marketing Manager',boss:'marj',level:'manager',sort:60},
  {id:'marichu',name:'Marichu Vanguardia',title:'Brand Manager - Mesoestetic',boss:'maricris',level:'manager',sort:61},
  {id:'anamarie',name:'Anamarie Fox',title:'Sales and Marketing Coordinator',boss:'maricris',level:'associate',sort:62},
  {id:'ruperto',name:'Ruperto Dela Cruz Jr.',title:'Sales Manager',boss:'marj',level:'manager',sort:70},
  {id:'team1',name:'Team 1',title:'Product specialists',boss:'ruperto',level:'group',sort:71},
  {id:'ruth',name:'Ruth Jabonero',title:'Product Specialist',boss:'team1',level:'associate',spec:'Ruth',sort:72},
  {id:'rhas',name:'Rhas Porciuncula',title:'Product Specialist',boss:'team1',level:'associate',spec:'Rhas',sort:73},
  {id:'tin',name:'Tin Arcos',title:'Product Specialist',boss:'team1',level:'associate',spec:'Tin',sort:74},
  {id:'charmaine',name:'Charmaine Demegillo',title:'Product Specialist',boss:'team1',level:'associate',spec:'Charmaine',sort:75},
  {id:'rechel',name:'Rechel Villafuerte',title:'Product Specialist',boss:'team1',level:'associate',spec:'Rechel',sort:76},
  {id:'joy',name:'Joy Estabillo',title:'Product Specialist',boss:'team1',level:'associate',spec:'Joy',sort:77},
  {id:'reynold',name:'Reynold Julius Ramos',title:'Product Specialist',boss:'team1',level:'associate',spec:'RJ',sort:78},
  {id:'jonathan',name:'Jonathan Yu',title:'Product Specialist',boss:'team1',level:'associate',spec:'Jonathan',sort:79},
  {id:'team2',name:'Team 2',title:'Specialists & machines',boss:'ruperto',level:'group',sort:80},
  {id:'abigael',name:'Abigael Rodriguez',title:'Product Specialist',boss:'team2',level:'associate',spec:'Abigael',sort:81},
  {id:'frank',name:'Frank Villaverde',title:'Machine Specialist',boss:'team2',level:'associate',sort:82},
  {id:'kris',name:'Kris Cyra Real',title:'Machine Specialist',boss:'team2',level:'associate',sort:83},
  {id:'orland',name:'Orland Reyes',title:'Machine Specialist (GMA)',boss:'team2',level:'associate',sort:84},
  {id:'vacant-cebu',name:'Vacant',title:'Machine Specialist (Cebu)',boss:'team2',level:'vacant',sort:85},
  {id:'ladylane',name:'Ladylane Asaytuno',title:'Key Accounts Manager',boss:'marj',level:'manager',sort:90},
  {id:'pinky',name:'Pinky Bravo',title:'Key Accounts Manager',boss:'marj',level:'manager',sort:91}
];
let ORG_PEOPLE=[],ORG_SRC='seed',ORG_LOADED=false,ORG_SEL=null,ORG_MODE=null,ORG_Q='',ORG_EDIT=false,ORG_ACCOUNTS=null,ORG_UPDATED='';
function orgCanEdit(){return typeof ROLE!=='undefined'&&ROLE==='admin';} // admin + super admin (People Operations use an admin account)
function orgById(id){return ORG_PEOPLE.find(p=>p.id===id)||null;}
function orgKids(id){return ORG_PEOPLE.filter(p=>p.boss===id).sort((a,b)=>(a.sort||0)-(b.sort||0)||a.name.localeCompare(b.name));}
function orgBossOf(p){if(!p||!p.boss)return [];if(p.boss==='exec')return ORG_PEOPLE.filter(x=>x.level==='founder');const b=orgById(p.boss);if(!b)return [];return b.level==='group'?orgBossOf(b):[b];}
function orgTeamOf(p){const b=p&&p.boss?orgById(p.boss):null;return b&&b.level==='group'?b:null;}
function orgReports(id){const out=[];for(const k of orgKids(id)){if(k.level==='group')out.push(...orgKids(k.id));else out.push(k);}return out;}
function orgMode(){if(ORG_MODE)return ORG_MODE;return (typeof window!=='undefined'&&window.innerWidth<900)?'list':'tree';}
function orgMatch(p){if(!ORG_Q)return true;const q=ORG_Q.toLowerCase();return (p.name+' '+p.title+' '+(p.hq_name||'')).toLowerCase().includes(q);}
function orgIsUnder(id,ancestor){let cur=orgById(id);for(let i=0;cur&&cur.boss&&i<50;i++){if(cur.boss===ancestor)return true;cur=orgById(cur.boss);}return false;}
function orgSlug(name){return String(name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'p';}
/* ── data: the table when it exists, the seed until then ── */
async function orgLoad(){
  ORG_LOADED=true;ORG_SRC='seed';ORG_PEOPLE=ORG_SEED.map(p=>Object.assign({},p));ORG_UPDATED='2026-09-18';
  if(typeof SB==='undefined'||!SB)return;
  try{
    const {data,error}=await SB.from('org_people').select('id,name,title,boss,level,spec,profile_id,hq_name,hq_role,sort,updated_at').eq('active',true).order('sort');
    if(error)throw error;
    if(data&&data.length){ORG_PEOPLE=data;ORG_SRC='db';ORG_UPDATED=data.reduce((m,r)=>r.updated_at>m?r.updated_at:m,'').slice(0,10)||ORG_UPDATED;}
    else ORG_SRC='empty'; // the table exists and is empty: an admin may load the seed into it
  }catch(e){ORG_SRC='seed';} // no table yet (SQL not run) → the seed, read-only
}
async function orgSeedDb(){
  if(!orgCanEdit())return;
  if(!await uiConfirm('Load the People team\'s chart (52 people, September 2026) into HQ? From then on the chart is edited here.'))return;
  const rows=ORG_SEED.map(p=>({id:p.id,name:p.name,title:p.title,boss:p.boss,level:p.level,spec:p.spec||null,sort:p.sort||0,active:true,updated_by:(SBUSER&&SBUSER.id)||null}));
  const {error}=await SB.from('org_people').upsert(rows,{onConflict:'id'});
  if(error){uiAlert('Could not load: '+error.message);return;}
  audit('orgchart.seed',{n:rows.length});ORG_LOADED=false;renderOrgChart();
}
/* ── nodes ── */
function orgNode(p){
  const L=ORG_LEVEL[p.level]||ORG_LEVEL.associate;const hit=ORG_Q&&orgMatch(p);const sel=ORG_SEL===p.id;
  if(p.level==='group')return '<a href="#" class="lnk org-grp" onclick="orgSelect(\''+jsq(p.id)+'\');return false">'+esc(p.name)+'</a>';
  return '<a href="#" class="lnk org-node'+(sel?' sel':'')+(ORG_Q&&!hit?' dim':'')+'" style="background:'+L.bg+';color:'+L.fg+';border-color:'+(sel?'var(--tx)':L.bd)+(p.level==='vacant'?';border-style:dashed':'')+'" onclick="orgSelect(\''+jsq(p.id)+'\');return false" title="'+esc(p.title)+'"><span class="org-nm">'+esc(p.name)+(p.profile_id?' <span class="org-link" title="Linked to an HQ account">⛓</span>':'')+'</span><span class="org-tt">'+esc(p.title)+'</span></a>';
}
function orgTree(id){
  const kids=orgKids(id);if(!kids.length)return '';
  // a run of leaves (nobody under them) stacks vertically under the parent, as on the People team's chart
  if(kids.length>2&&kids.every(k=>!orgKids(k.id).length&&k.level!=='group'))return '<div class="org-stack">'+kids.map(orgNode).join('')+'</div>';
  return '<ul>'+kids.map(k=>'<li>'+orgNode(k)+orgTree(k.id)+'</li>').join('')+'</ul>';
}
function orgList(id,depth){
  const kids=orgKids(id);if(!kids.length)return '';
  return kids.map(k=>'<div class="org-li" style="margin-left:'+(depth*18)+'px">'+orgNode(k)+'</div>'+orgList(k.id,depth+1)).join('');
}
function orgCard(p){
  const bosses=orgBossOf(p),team=orgTeamOf(p),reps=orgReports(p.id);const L=ORG_LEVEL[p.level]||ORG_LEVEL.associate;const isGroup=p.level==='group';
  const chip=x=>'<a href="#" class="abtn" onclick="orgSelect(\''+jsq(x.id)+'\');return false">'+esc(x.name)+'</a>';
  let acts='';
  if(p.spec&&typeof viewAllowed==='function'&&viewAllowed('spec')&&typeof showSpecPage==='function')acts+='<a href="#" class="abtn t-gr" onclick="showSpecPage(\''+jsq(p.spec)+'\');return false">Sales page</a>';
  if(p.profile_id&&typeof viewAllowed==='function'&&viewAllowed('users'))acts+='<a href="#" class="abtn" onclick="showView(\'users\');return false">Team &amp; access</a>';
  if(orgCanEdit()&&ORG_SRC!=='seed')acts+='<a href="#" class="abtn" onclick="orgEdit(\''+jsq(p.id)+'\');return false">Edit</a>'+(isGroup?'':'<a href="#" class="abtn" onclick="orgLink(\''+jsq(p.id)+'\');return false">'+(p.profile_id?'Change HQ account':'Link HQ account')+'</a>')+'<a href="#" class="abtn" onclick="orgAdd(\''+jsq(p.id)+'\');return false">Add under</a><a href="#" class="abtn t-rd" onclick="orgRemove(\''+jsq(p.id)+'\');return false">Remove</a>';
  const hq=p.profile_id?'<div style="margin-top:6px;font-size:12px"><span class="mu">HQ account:</span> <b>'+esc(p.hq_name||'linked')+'</b>'+(p.hq_role?' <span class="pill pgy">'+esc(String(p.hq_role).replace('_',' '))+'</span>':'')+(p.spec?' <span class="mu">· specialist tag '+esc(p.spec)+'</span>':'')+'</div>':(isGroup?'':'<div class="mu" style="margin-top:6px;font-size:11.5px">No HQ account linked'+(p.spec?' · specialist tag '+esc(p.spec):'')+'</div>');
  return '<div class="panel org-card" style="padding:14px 16px;margin-bottom:12px"><div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">'+
    '<div style="min-width:220px;flex:1"><div style="font-size:16px;font-weight:700">'+esc(p.name)+'</div><div class="mu" style="margin-top:2px">'+esc(p.title)+'</div>'+
    '<div style="margin-top:6px">'+(isGroup?'<span class="pill pgy">Team label</span>':'<span class="pill" style="background:'+L.bg+';color:'+L.fg+';border:1px solid '+L.bd+'">'+esc(L.one)+'</span>')+(team?' <span class="pill pgy">'+esc(team.name)+'</span>':'')+'</div>'+hq+'</div>'+
    '<div style="min-width:200px"><div class="mu" style="font-size:11px;margin-bottom:3px">'+(isGroup?'Under':'Reports to')+'</div>'+(bosses.length?bosses.map(chip).join(' '):'<span class="mu">—</span>')+'</div>'+
    '<div style="min-width:220px;flex:1"><div class="mu" style="font-size:11px;margin-bottom:3px">'+(isGroup?'Members':'Direct reports')+(reps.length?' · '+reps.length:'')+'</div>'+(reps.length?reps.map(chip).join(' '):'<span class="mu">—</span>')+'</div>'+
    (acts?'<div style="display:flex;gap:6px;flex-wrap:wrap;align-self:center">'+acts+'</div>':'')+
    '<a href="#" class="abtn" style="align-self:flex-start" onclick="orgSelect(null);return false">✕</a></div></div>';
}
async function renderOrgChart(){
  const c=$('content');
  if(!ORG_LOADED){loadingHint();await orgLoad();if(currentView!=='orgchart')return;}
  const mode=orgMode();const sel=ORG_SEL?orgById(ORG_SEL):null;const canEdit=orgCanEdit();
  const founders=ORG_PEOPLE.filter(p=>p.level==='founder').sort((a,b)=>(a.sort||0)-(b.sort||0));
  let h='';
  if(ORG_SRC==='seed'&&canEdit)h+='<div class="panel" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--am);font-size:12px">This is the People team\'s chart as read on 2026-09-18, read-only. '+(typeof isSuper==='function'&&isSuper()?'To edit it in HQ, run the <b>org_people</b> SQL from SUPABASE-SETUP.md ("Org chart", 2026-09-18) — the chart then lives in the database.':'The super admin has to switch on editing (a one-time database step).')+'</div>';
  if(ORG_SRC==='empty'&&canEdit)h+='<div class="panel" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--am);font-size:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">The chart is empty. <a href="#" class="abtn t-gr" onclick="orgSeedDb();return false">Load the People team\'s chart (Sep 2026)</a> <span class="mu">or add people one by one.</span></div>';
  if(sel)h+=orgCard(sel);
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><input id="org-q" placeholder="Find a name or title…" value="'+esc(ORG_Q)+'" oninput="orgFilter(this.value)" style="font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--sf);color:var(--tx);min-width:220px">'+
    '<a href="#" class="abtn'+(mode==='tree'?' t-gr':'')+'" onclick="orgSetMode(\'tree\');return false">Tree</a><a href="#" class="abtn'+(mode==='list'?' t-gr':'')+'" onclick="orgSetMode(\'list\');return false">List</a>'+
    (canEdit&&ORG_SRC!=='seed'?'<a href="#" class="abtn" onclick="orgAdd(null);return false">+ Add person</a>':'')+
    '<span class="mu" style="font-size:11px;margin-left:auto">'+ORG_PEOPLE.filter(p=>p.level!=='group'&&p.level!=='vacant').length+' people · updated '+esc(ORG_UPDATED)+' · '+Object.keys(ORG_LEVEL).map(k=>'<span class="org-sw" style="background:'+ORG_LEVEL[k].bg+';border-color:'+ORG_LEVEL[k].bd+'"></span>'+esc(ORG_LEVEL[k].lbl)).join(' · ')+'</span></div>';
  if(!ORG_PEOPLE.length)h+='<div class="empty" style="margin-top:30px">Nobody on the chart yet.</div>';
  else if(mode==='tree'){
    h+='<div class="panel" style="padding:16px 14px;overflow:auto"><div class="org-tree"><ul class="org-root"><li><div class="org-exec">'+founders.map(orgNode).join('<span class="org-join"></span>')+'</div>'+orgTree('exec')+'</li></ul></div></div>';
  }else{
    h+='<div class="panel" style="padding:12px 14px">'+founders.map(f=>'<div class="org-li">'+orgNode(f)+'</div>').join('')+orgList('exec',1)+'</div>';
  }
  c.innerHTML=h;
  if(typeof upgradeButtons==='function')try{upgradeButtons();}catch(e){}
  const q=$('org-q');if(q&&ORG_Q&&document.activeElement!==q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}
}
function orgSelect(id){ORG_SEL=id||null;renderOrgChart().then(()=>{if(id){const el=document.querySelector('.org-card');if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'});}});}
function orgSetMode(m){ORG_MODE=m;renderOrgChart();}
let _orgT=null;function orgFilter(v){ORG_Q=String(v||'').trim();clearTimeout(_orgT);_orgT=setTimeout(renderOrgChart,150);}
/* ── editing (admin + super admin) ── */
function orgBossOpts(excludeId){
  const opts=[{v:'exec',l:'The co-founders'}];
  const walk=(id,depth)=>{for(const k of orgKids(id)){if(k.id===excludeId||(excludeId&&orgIsUnder(k.id,excludeId)))continue;opts.push({v:k.id,l:' '.repeat(depth*3)+(k.level==='group'?'[team] ':'')+k.name});walk(k.id,depth+1);}};
  walk('exec',1);
  opts.push({v:'',l:'— nobody (a co-founder) —'});
  return opts;
}
const ORG_LEVEL_OPTS=[{v:'manager',l:'Manager'},{v:'lead',l:'Lead'},{v:'associate',l:'Associate'},{v:'consultant',l:'Part-timer / Consultant'},{v:'intern',l:'Intern'},{v:'vacant',l:'Vacant post'},{v:'founder',l:'Co-Founder'},{v:'group',l:'Team label (a heading, not a person)'}];
async function orgSave(row,what){
  row.updated_by=(SBUSER&&SBUSER.id)||null;row.updated_at=new Date().toISOString();
  const {error}=await SB.from('org_people').upsert(row,{onConflict:'id'});
  if(error){uiAlert('Could not save: '+error.message);return false;}
  audit('orgchart.'+what,{id:row.id,name:row.name,boss:row.boss,level:row.level});
  ORG_LOADED=false;ORG_SEL=row.id;await renderOrgChart();return true;
}
async function orgAdd(underId){
  if(!orgCanEdit()||ORG_SRC==='seed')return;
  const v=await uiForm('Add to the org chart',[
    {k:'name',l:'Name',req:true,placeholder:'As it should read on the chart'},
    {k:'title',l:'Title',req:true,placeholder:'Position'},
    {k:'boss',l:'Reports to',t:'select',opts:orgBossOpts(null),v:underId||'exec'},
    {k:'level',l:'Level',t:'select',opts:ORG_LEVEL_OPTS,v:'associate'},
    {k:'spec',l:'Specialist tag (product specialists only)',placeholder:'The tag their orders carry, e.g. Rhas',hint:'Lets the card open their sales page'}
  ],{ok:'Add'});
  if(!v)return;
  let id=orgSlug(v.name);if(orgById(id))id=id+'-'+Date.now().toString(36).slice(-4);
  const sibs=orgKids(v.boss||null);const sort=(sibs.length?Math.max(...sibs.map(s=>s.sort||0)):0)+1;
  await orgSave({id,name:v.name.trim(),title:v.title.trim(),boss:v.boss||null,level:v.level,spec:(v.spec||'').trim()||null,sort,active:true},'add');
}
async function orgEdit(id){
  const p=orgById(id);if(!p||!orgCanEdit()||ORG_SRC==='seed')return;
  const v=await uiForm('Edit — '+p.name,[
    {k:'name',l:'Name',req:true,v:p.name},
    {k:'title',l:'Title',req:true,v:p.title},
    {k:'boss',l:'Reports to',t:'select',opts:orgBossOpts(p.id),v:p.boss||''},
    {k:'level',l:'Level',t:'select',opts:ORG_LEVEL_OPTS,v:p.level},
    {k:'spec',l:'Specialist tag',v:p.spec||'',placeholder:'e.g. Rhas'},
    {k:'sort',l:'Order among siblings',t:'number',v:p.sort||0,hint:'Lower comes first'}
  ],{ok:'Save'});
  if(!v)return;
  await orgSave(Object.assign({},p,{name:v.name.trim(),title:v.title.trim(),boss:v.boss||null,level:v.level,spec:(v.spec||'').trim()||null,sort:parseInt(v.sort,10)||0}),'edit');
}
async function orgRemove(id){
  const p=orgById(id);if(!p||!orgCanEdit()||ORG_SRC==='seed')return;
  const kids=orgKids(id);
  if(!await uiConfirm('Remove '+p.name+' from the chart?'+(kids.length?'\n\nThe '+kids.length+' row'+(kids.length>1?'s':'')+' under them move up to '+(orgBossOf(p).map(b=>b.name).join(' & ')||'the top')+'.':'')))return;
  const bossUp=p.boss;const by=(SBUSER&&SBUSER.id)||null;
  if(kids.length){const {error}=await SB.from('org_people').update({boss:bossUp,updated_by:by,updated_at:new Date().toISOString()}).eq('boss',id);if(error){uiAlert('Could not move their reports: '+error.message);return;}}
  const {error}=await SB.from('org_people').update({active:false,updated_by:by,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){uiAlert('Could not remove: '+error.message);return;}
  audit('orgchart.remove',{id,name:p.name,moved:kids.length});
  ORG_LOADED=false;ORG_SEL=null;renderOrgChart();
}
async function orgLink(id){
  const p=orgById(id);if(!p||!orgCanEdit()||ORG_SRC==='seed')return;
  if(!ORG_ACCOUNTS){try{ORG_ACCOUNTS=((await adminUsers('list')).users||[]).filter(u=>!u.banned).sort((a,b)=>String(a.name||a.email).localeCompare(String(b.name||b.email)));}catch(e){uiAlert('Could not read the HQ accounts: '+e.message);return;}}
  const opts=[{v:'',l:'— no HQ account —'}].concat(ORG_ACCOUNTS.map(u=>({v:u.id,l:(u.name||u.email)+' · '+(u.is_super?'super admin':String(u.role||'').replace('_',' '))+(u.tag?' · '+u.tag:'')})));
  const v=await uiForm('Link '+p.name+' to an HQ account',[{k:'pid',l:'HQ account',t:'select',opts,v:p.profile_id||'',hint:'The card then shows the account and opens its pages; a specialist\'s tag is taken from the account'}],{ok:'Link'});
  if(!v)return;
  const u=ORG_ACCOUNTS.find(x=>x.id===v.pid)||null;
  await orgSave(Object.assign({},p,{profile_id:u?u.id:null,hq_name:u?(u.name||u.email):null,hq_role:u?(u.is_super?'super admin':u.role):null,spec:u&&u.tag?u.tag:p.spec||null}),u?'link':'unlink');
}
